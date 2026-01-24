import ora from "ora";
import { cleanUpConfigs, readShiplioConfig } from "../utils/config.js";
import inquirer from "inquirer";
import { apiClient } from "../services/api.js";
import { handleError } from "../utils/formatErrors.js";
import chalk from "chalk";

export async function destroy() {
  const config = await readShiplioConfig();

  if (!config) {
    console.log(chalk.red("✖ No Shiplio project found in this directory."));
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Are you sure you want to destroy ${config?.name}? This cannot be undone.`,
      default: false,
    },
  ]);

  if (!confirm) return;

  const spinner = ora(`Destroying ${config?.name}...\n`).start();

  try {
    await apiClient.delete(`/projects/${config?.project_id}?soft=false`);

    spinner.text = "Cleaning up local configuration files...\n";
    const result = await cleanUpConfigs();

    if (!result) {
      spinner.warn(
        chalk.yellow(
          "! Project destroyed on server, but failed to remove local config files. Please delete shiplio.json manually.",
        ),
      );
    } else {
      spinner.succeed(
        `✔ Project ${chalk.bold(config.name)} has been fully wiped.`,
      );
    }
  } catch (error: any) {
    spinner.stop();
    if (error?.response?.status === 404) {
      console.log(chalk.red("✖ Project not deployed yet."));
    } else {
      handleError(error, "Failed to destroy project");
    }
  }
}
