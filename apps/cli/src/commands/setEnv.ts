import { apiClient } from "../services/api.js";
import { readShiplioConfig } from "../utils/config.js";
import chalk from "chalk";
import ora from "ora";
import { handleError } from "../utils/formatErrors.js";

export async function setEnv(vars: string[]) {
  if (!Array.isArray(vars)) {
    console.log(chalk.red("✖ Expected an array of variables."));
    return;
  }

  if (!vars || vars.length === 0) {
    console.log(
      chalk.yellow("Usage: shiplio env set KEY=VALUE [KEY2=VALUE2...]"),
    );
    return;
  }

  const config = await readShiplioConfig();
  if (!config) return console.log(chalk.red("✖ No shiplio.json found."));

  const envMap: Record<string, string> = {};

  vars.forEach((arg) => {
    if (!arg.includes("=")) return;
    const [key, ...valueParts] = arg.split("=");
    envMap[key] = valueParts.join("=");
  });

  if (Object.keys(envMap).length === 0) {
    return console.log(chalk.yellow("Usage: shiplio env set KEY=VALUE"));
  }

  const spinner = ora("Updating secrets on server...\n").start();
  try {
    await apiClient.patch(`/projects/${config.project_id}/env`, {
      env: envMap,
    });
    spinner.succeed(
      "Secrets updated. Note: It may take a few seconds for the changes to reflect in your running application.",
    );
  } catch (err) {
    spinner.stop();
    handleError(err, "Failed to set environment variables.");
  }
}

