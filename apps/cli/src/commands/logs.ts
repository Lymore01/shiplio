import chalk from "chalk";
import { streamRuntimeLogs } from "../services/socket.js";
import { readShiplioConfig } from "../utils/config.js";
import { handleError } from "../utils/formatErrors.js";
import ora from "ora";

export async function logs(options: { tail?: string; project_id?: string }) {
  let targetProjectId = options?.project_id;
  let projectName;

  if (!targetProjectId) {
    try {
      const config = await readShiplioConfig();
      targetProjectId = config?.project_id;
      projectName = config?.name ?? "project";
    } catch (error) {
      console.error(
        chalk.red("\nError:"),
        "No project ID provided and no shiplio.json found.",
      );
      console.log(
        chalk.dim(
          "Try: shiplio logs <project_id> or run inside a project folder.\n",
        ),
      );
      process.exit(1);
    }
  }

  const tailCount = options.tail ? parseInt(options.tail) : 50;

  const spinner = ora(
    `Connecting to ${chalk.cyan(projectName)} log stream...`,
  ).start();

  try {
    await streamRuntimeLogs(spinner, tailCount, targetProjectId);
  } catch (error) {
    if (spinner.isSpinning) spinner.stop();
    handleError(error, "Fetching logs Failed");
    process.exit(1);
  }
}
