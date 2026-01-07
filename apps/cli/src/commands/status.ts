import chalk from "chalk";
import ora from "ora";
import { apiClient } from "../services/api";
import { handleError } from "../utils/formatErrors";
import { readShiplioConfig } from "../utils/config";

export async function status() {
  const config = await readShiplioConfig();

  if (!config) {
    console.log(chalk.red("\n✖ No Shiplio project found in this directory."));
    console.log(
      chalk.dim("Run 'shiplio init' or 'shiplio link' to get started.\n")
    );
    return;
  }

  const spinner = ora(
    `Fetching status for ${chalk.cyan(config.name)}...`
  ).start();

  try {
    const { data: response } = await apiClient.get(
      `/projects/${config.project_id}`
    );
    const project = response.data;

    spinner.stop();

    console.log(`\n${chalk.bold.cyan("--- Project Status ---")}`);
    console.log(`${chalk.bold("Name:  ")} ${project.name}`);
    console.log(`${chalk.bold("ID:    ")} ${chalk.dim(project.id)}`);

    const statusColor =
      project.status === "active" ? chalk.green : chalk.yellow;
    console.log(
      `${chalk.bold("Status:")} ${statusColor(project.status.toUpperCase())}`
    );

    if (project.url) {
      console.log(
        `${chalk.bold("URL:   ")} ${chalk.underline.blue(project.url)}`
      );
    }

    console.log(
      `${chalk.bold("Created:")} ${new Date(
        project.inserted_at
      ).toLocaleString()}`
    );
    console.log(chalk.cyan("----------------------\n"));
  } catch (error: any) {
    spinner.stop();

    if (error?.response?.status === 404) {
      handleError(
        error,
        "Project not found on server. Your local link might be broken."
      );
      console.log(chalk.dim("\nRun 'shiplio link' to fix it."));
    } else {
      handleError(
        error,
        "Failed to fetch project status. Your local link might be broken."
      );
      console.log(chalk.dim("\nRun 'shiplio link' to fix it."));
    }
  }
}
