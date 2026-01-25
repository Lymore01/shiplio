import chalk from "chalk";
import { readShiplioConfig } from "../utils/config.js";
import ora from "ora";
import { apiClient } from "../services/api.js";
import { handleError } from "../utils/formatErrors.js";

export async function unsetEnv(keys: string[]) {
  const config = await readShiplioConfig();
  if (!config) return console.log(chalk.red("✖ No shiplio.json found."));

  if (keys.length === 0) {
    return console.log(chalk.yellow("Usage: shiplio env unset KEY1 KEY2"));
  }

  const spinner = ora(`Removing ${keys.join(", ")}...`).start();

  try {
    await apiClient.post(`/projects/${config.project_id}/env/unset`, { keys });
    spinner.succeed(`Removed ${keys.length} variable(s) and restarting...`);
  } catch (error) {
    spinner.stop();
    handleError(error, "Failed to remove variables.");
  }
}
