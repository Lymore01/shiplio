import { createArchive } from "../services/archiver.js";
import { handleError } from "../utils/formatErrors.js";
import fs from "fs-extra";
import FormData from "form-data";
import { apiClient } from "../services/api.js";
import { readShiplioConfig } from "../utils/config.js";
import chalk from "chalk";
import ora from "ora";
import { streamBuildLogs } from "../services/socket.js";

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
    const buildStreamPromise = streamBuildLogs(spinner);

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

    await buildStreamPromise;
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
