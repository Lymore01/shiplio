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

  const authUrl = `${SERVER_URL}/cli/auth?callback=${encodeURIComponent(
    callbackUrl
  )}`;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url!, `http://localhost:${PORT}`);
    const token = url.searchParams.get("token");

    if (token) {
      await saveToken(token);

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --bg: #0b0b0b;
      --panel: #111;
      --border: #1f1f1f;
      --success: #10b981; /* Matching your dark green */
      --text: #f5f5f5;
      --muted: #9a9a9a;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      overflow: hidden;
    }

    .success-card {
      background: var(--panel);
      border: 1px solid var(--border);
      padding: 3rem;
      border-radius: 20px;
      text-align: center;
      max-width: 400px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .icon-circle {
      width: 80px;
      height: 80px;
      background: rgba(16, 185, 129, 0.1);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
      color: var(--success);
    }

    h1 {
      font-size: 1.8rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      letter-spacing: -0.02em;
    }

    p {
      color: var(--muted);
      line-height: 1.5;
      font-size: 0.95rem;
    }

    .shortcut-hint {
      margin-top: 2rem;
      font-size: 0.75rem;
      color: #444;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Simple Checkmark Animation */
    .checkmark {
      width: 40px;
      height: 40px;
      stroke-width: 3;
      stroke: var(--success);
      stroke-miterlimit: 10;
      stroke-dasharray: 48;
      stroke-dashoffset: 48;
      animation: stroke 0.4s cubic-bezier(0.65, 0, 0.45, 1) 0.3s forwards;
    }

    @keyframes stroke {
      to { stroke-dashoffset: 0; }
    }
  </style>
</head>
<body>
  <div class="success-card">
    <div class="icon-circle">
      <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
        <path fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
      </svg>
    </div>
    <h1>Authenticated!</h1>
    <p>Your account is now linked. You can close this tab and return to your terminal to continue.</p>
    
    <div class="shortcut-hint">
      Shiplio CLI • Secure Session
    </div>
  </div>
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
    console.log(
      chalk.dim(
        `If the browser doesn't open, visit: ${decodeURIComponent(authUrl)}`
      )
    );

    await open(authUrl);
  });
}
