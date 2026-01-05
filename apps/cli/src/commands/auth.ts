import inquirer from "inquirer";
import ora from "ora";
import chalk from "chalk";
import { apiClient } from "../services/api";
import {
  saveToken,
  readToken as getToken,
  logOut as logout,
} from "../services/auth";
import { formatErrors } from "../utils/formatErrors";

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
    handleAuthError(error, "Authentication failed");
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
    handleAuthError(error, "Registration failed");
  }
}

function handleAuthError(error: any, fallbackMessage: string) {
  const apiErrors =
    error?.response?.data?.errors || error?.response?.data?.error;
  const message = formatErrors(apiErrors) || chalk.red(`X ${fallbackMessage}`);

  console.log(message);
  process.exit(1);
}
