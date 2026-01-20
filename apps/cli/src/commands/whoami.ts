import { apiClient } from "../services/api.js";
import { handleError } from "../utils/formatErrors.js";
import ora from "ora";
import chalk from "chalk";
import boxen from "boxen";

export async function whoami() {
  const spinner = ora("Fetching user information...").start();

  try {
    const { data: response } = await apiClient.get("/auth/me");

    spinner.stop();

    const content = [
      `${chalk.bold("Email:   ")} ${chalk.cyan(response.user.email)}`,
      `${chalk.bold("User ID: ")} ${chalk.dim(response.user.id)}`,
      `${chalk.bold("Role:    ")} ${chalk.yellow(response.user.role || "Developer")}`,
    ].join("\n");

    console.log(
      boxen(content, {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "cyan",
        title: chalk.bold("Shiplio Profile"),
        titleAlignment: "center",
      }),
    );
  } catch (error) {
    spinner.stop();
    handleError(error, "Failed to fetch user information");
    process.exit(1);
  }
}
