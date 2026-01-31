import { apiClient } from "../services/api.js";
import { readShiplioConfig } from "../utils/config.js";
import chalk from "chalk";
import ora from "ora";
import { handleError } from "../utils/formatErrors.js";

export async function setEnv(vars: string[]) {
  if (!Array.isArray(vars) || vars.length === 0) {
    console.log(chalk.yellow("Usage: shiplio env set KEY=VALUE [KEY2=VALUE2...]"));
    return;
  }

  const config = await readShiplioConfig();
  if (!config) {
    console.log(chalk.red("✖ No shiplio.json found. Run 'shiplio init' first."));
    return;
  }

  const envMap: Record<string, string> = {};
  vars.forEach((arg) => {
    if (!arg.includes("=")) {
      console.log(chalk.dim(`  ${chalk.yellow("⚠")} Skipping invalid format: ${arg}`));
      return;
    }
    const [key, ...valueParts] = arg.split("=");
    envMap[key] = valueParts.join("=");
  });

  const keys = Object.keys(envMap);
  if (keys.length === 0) return;

  const spinner = ora(`Setting ${keys.length} variable(s) on server...`).start();

  try {
    await apiClient.patch(`/projects/${config.project_id}/env`, {
      env_vars: envMap,
    });

    spinner.succeed(chalk.green(`Successfully updated ${keys.length} variables.`));

    console.log(chalk.bold("\nUpdated Keys:"));
    keys.forEach((key) => {
      console.log(`  ${chalk.green("✔")} ${chalk.dim(key)}`);
    });

    console.log(chalk.yellow(`\nℹ The container is restarting to apply changes.`));
    
  } catch (err) {
    spinner.stop();
    handleError(err, "Failed to set environment variables.");
  }
}