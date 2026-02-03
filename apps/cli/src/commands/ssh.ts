import chalk from "chalk";
import { readShiplioConfig } from "../utils/config.js";
import { handleError } from "../utils/formatErrors.js";
import { apiClient } from "../services/api.js";
import { spawn } from "child_process";

// note: For now this only supports connecting to local Docker containers.
// todo: Add support for remote SSH connections in the future.
export async function sshCommand() {
  const config = await readShiplioConfig();

  if (!config) {
    console.log(chalk.red("\n✖ No Shiplio project found in this directory."));
    console.log(
      chalk.dim("Run 'shiplio init' or 'shiplio link' to get started.\n"),
    );
    return;
  }

  try {
    const { data: response } = await apiClient.get(
      `/projects/${config.project_id}`,
    );
    const project = response.data;

    if (!project.container_id) {
      console.log(
        chalk.red(`\n✖ The project is not currently running a container.`),
      );
      console.log(chalk.dim("Start the project to enable SSH access.\n"));
      return;
    }

    console.log(
      chalk.green(`\nConnecting to container ${project.container_id}...\n`),
    );
    console.log(
      chalk.dim(
        "Type 'exit' or press Ctrl+D to leave the container and return to Shiplio.\n",
      ),
    );

    const shell = spawn(
      "docker",
      ["exec", "-it", project.container_id, "/bin/sh"],
      {
        stdio: "inherit",
      },
    );

    shell.on("exit", (code) => {
      if (code === 0 || code === 130) {
        console.log("\nLeft the container. Back to Shiplio!");
      } else {
        console.error(`\nSession closed with error code: ${code}`);
      }
      process.exit();
    });
  } catch (error) {
    handleError(error, "Failed to retrieve SSH connection details.");
  }
}
