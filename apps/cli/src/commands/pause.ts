import chalk from "chalk";
import { readShiplioConfig } from "../utils/config.js";
import { apiClient } from "../services/api.js";
import ora from "ora";
import { handleError } from "../utils/formatErrors.js";

export async function pause() {
  const config = await readShiplioConfig();

  if (!config) {
    console.log(
      chalk.red("✖ No Shiplio project found. Run 'shiplio init' first."),
    );
    return;
  }

  const spinner = ora("Pausing the project...").start();

  try {
    const response = await apiClient.post(`/projects/${config.project_id}/pause`);
    spinner.succeed(response.data.message || "Project paused.");
  } catch (error) {
    spinner.stop();
    handleError(error, "Failed to pause the project.");
  }
}
