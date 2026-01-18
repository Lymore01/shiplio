import { createArchive } from "../services/archiver.js";
import { handleError } from "../utils/formatErrors.js";
import fs from "fs-extra";
import FormData from "form-data";
import { apiClient } from "../services/api.js";
import { readShiplioConfig } from "../utils/config.js";
import chalk from "chalk";
import ora from "ora";
import { connectToDeploymentLogs } from "../services/socket.js";

interface Payload {
  level: string;
  step: string;
  message: string;
  timestamp: string;
}

export async function deploy() {
  const archivePath = await createArchive();
  const config = await readShiplioConfig();

  if (!config) {
    console.log(
      chalk.red("✖ No Shiplio project found. Run 'shiplio init' first."),
    );
    return;
  }

  const spinner = ora(`Deploying project...\n`).start();

  try {
    const channelPromise = connectToDeploymentLogs();
    const stream = fs.createReadStream(archivePath);

    const filename = `upload-${Date.now()}.tar.gz`;

    const form = new FormData();
    form.append("file", stream, {
      filename,
      contentType: "application/gzip",
    });

    spinner.text = "Uploading to Shiplio...\n";

    await apiClient.post(`/projects/${config.project_id}/deployments`, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    console.log(chalk.dim("--- Remote Build Started ---\n"));
    const channel = await channelPromise;

    channel.on("new_log", (payload: Payload) => {
      const { level, message } = payload;

      spinner.stop();

      const colors: Record<string, any> = {
        info: chalk.blue,
        success: chalk.green,
        error: chalk.red,
        warn: chalk.yellow,
      };

      const colorize = colors[level] || chalk.white;
      const prefix = colorize(`[${level}]`);

      console.log(`${prefix} ${message.trim()}`);

      if (message.includes("successful") || message.includes("failed")) {
        if (message.includes("successful")) process.exit(0);
        if (message.includes("failed")) process.exit(1);
      } else {
        spinner.text = chalk.dim(`Remote: ${message.trim()}`);
        spinner.start();
      }
    });

    // channel.on("status_change", (payload: { status: string }) => {
    //   if (payload.status === "success") {
    //     console.log(chalk.green("\n Deployment successful!"));
    //     process.exit(0);
    //   }
    //   if (payload.status === "failed") {
    //     console.log(chalk.red("\n✖ Build failed. Check the logs above."));
    //     process.exit(1);
    //   }
    // });
  } catch (error) {
    spinner.stop();
    handleError(error, "Deployment failed");
    process.exit(1);
  } finally {
    if (await fs.pathExists(archivePath)) {
      await fs.remove(archivePath);
    }
  }
}
