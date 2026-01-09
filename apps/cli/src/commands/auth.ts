import inquirer from "inquirer";
import ora from "ora";
import chalk from "chalk";
import { apiClient } from "../services/api.js";
import {
  saveToken,
  readToken as getToken,
  logOut as logout,
} from "../services/auth.js";
import { handleError } from "../utils/formatErrors.js";
import open from "open";
import http from "http";

const AUTH_PROMPTS = [
  {
    type: "input",
    name: "email",
    message: "Enter your email:",
    validate: (value: string) => {
      const pass = value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      if (pass) return true;
      return "Please enter a valid email address.";
    },
  },
  {
    type: "password",
    name: "password",
    message: "Enter your password:",
    validate: (value: string) => {
      if (value.length < 8) return "Password must be at least 8 characters.";
      return true;
    },
  },
];

export async function login() {
  const existingToken = getToken();
  if (existingToken) {
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: chalk.yellow(
          "You are already logged in. Do you want to log in as a different user?"
        ),
        default: false,
      },
    ]);

    if (!confirm) return;
    logout();
  }

  console.log(chalk.cyan("\nLogin to your Shiplio account"));

  try {
    const answers = await inquirer.prompt(AUTH_PROMPTS);
    const spinner = ora("Authenticating...").start();

    const { data } = await apiClient.post("/auth/login", answers);

    saveToken(data.token);

    spinner.succeed(chalk.green("Authentication successful!"));
    console.log(
      chalk.dim(
        "\nNext step: Run 'shiplio init <project-name>' to get started."
      )
    );
  } catch (error: any) {
    handleError(error, "Login failed");
    process.exit(1);
  }
}

export async function register() {
  console.log(chalk.cyan("\nCreate a new Shiplio account"));

  console.log(chalk.dim("Requirements: 8+ chars, 1 uppercase, 1 digit."));

  try {
    const answers = await inquirer.prompt(AUTH_PROMPTS);
    const spinner = ora("Creating account...").start();

    const { data } = await apiClient.post("/auth/register", answers);

    saveToken(data.token);

    spinner.succeed(chalk.green("Account created successfully!"));
    console.log(chalk.blue("You have been automatically logged in."));
  } catch (error: any) {
    handleError(error, "Registration failed");
    process.exit(1);
  }
}

// magic-link flow
export async function loginViaWeb() {
  const PORT = 54321;
  const SERVER_URL = "http://localhost:4000";
  const callbackUrl = `http://localhost:${PORT}`;

  const authUrl = `${SERVER_URL}/cli/auth?callbackUrl=${encodeURIComponent(
    callbackUrl
  )}`;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url!, `http://localhost:${PORT}`);
    const token = url.searchParams.get("token");

    if (token) {
      await saveToken(token);

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
            <h1 style="color: #2ecc71;">Authenticated!</h1>
            <p>You can close this window and return to your terminal.</p>
          </body>
        </html>
      `);

      console.log(chalk.green("\nSuccessfully logged in!"));

      res.socket?.destroy();
      server.close(() => {
        process.exit(0);
      });
    } else {
      res.writeHead(400);
      res.end("Invalid request");
    }
  });

  server.listen(PORT, async () => {
    console.log(chalk.cyan("Opening your browser to authenticate..."));
    console.log(chalk.dim(`If the browser doesn't open, visit: ${authUrl}`));

    await open(authUrl);
  });
}
