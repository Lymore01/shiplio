import chalk from "chalk";
import { readShiplioConfig } from "../utils/config.js";
import ora from "ora";
import { apiClient } from "../services/api.js";
import { handleError } from "../utils/formatErrors.js";
import Table from "cli-table3";

export async function listEnv(options: { raw?: boolean }) {
  const config = await readShiplioConfig();
  if (!config) return console.log(chalk.red("✖ No shiplio.json found."));

  const spinner = ora("Fetching environment variables...").start();

  try {
    const response = await apiClient.get(`/projects/${config.project_id}/env`);
    spinner.stop();

    const envVars = response.data.env_vars || {};
    const keys = Object.keys(envVars);

    if (keys.length === 0) {
      console.log(
        chalk.yellow("ℹ No environment variables set for this project."),
      );
      console.log(chalk.dim("Use 'shiplio env set KEY=VALUE' to add one."));
      return;
    }

    const table = new Table({
      head: [chalk.cyan("Variable"), chalk.cyan("Value")],
      colWidths: [30, 50],
      wordWrap: true,
    });

    keys.forEach((key) => {
      const value = envVars[key];
      if (options.raw) {
        table.push([chalk.green(key), value]);
        return;
      }

      const displayValue =
        key.toLowerCase().includes("secret") ||
        key.toLowerCase().includes("key")
          ? `${value.substring(0, 4)}****************`
          : value;

      table.push([chalk.green(key), displayValue]);
    });

    console.log(
      chalk.bold(`\nEnvironment for project: ${chalk.blue(config.name)}`),
    );
    console.log(table.toString());
    console.log(chalk.dim(`Total: ${keys.length} variables\n`));
  } catch (error) {
    spinner.stop();
    handleError(error, "Failed to fetch environment variables.");
  }
}
