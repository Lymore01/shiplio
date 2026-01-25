import { createArchive } from "../services/archiver.js";
import { handleError } from "../utils/formatErrors.js";
import fs from "fs-extra";
import FormData from "form-data";
import { apiClient } from "../services/api.js";
import { readShiplioConfig, readShiplioJson } from "../utils/config.js";
import chalk from "chalk";
import ora from "ora";
import { streamBuildLogs } from "../services/socket.js";

export async function deploy() {
  const archivePath = await createArchive();
  const config = await readShiplioConfig();
  const context = await readShiplioJson();

  if (!config) {
    console.log(
      chalk.red("✖ No Shiplio project found. Run 'shiplio init' first."),
    );
    return;
  }

  const spinner = ora(`Deploying project...\n`).start();

  try {
    spinner.text = "Cleaning up previous deployment...\n";
    try {
      await apiClient.delete(`/projects/${config.project_id}?soft=true`);
    } catch (e: any) {
      if (e.response?.status === 404) {
        spinner.text = "Fresh deployment detected. Skipping cleanup...\n";
      } else {
        throw e;
      }
    }

    const buildStreamPromise = streamBuildLogs(spinner);

    const stream = fs.createReadStream(archivePath);

    const filename = `upload-${Date.now()}.tar.gz`;

    const form = new FormData();
    form.append("file", stream, {
      filename,
      contentType: "application/gzip",
    });

    form.append("public_env", JSON.stringify(context?.runtime.env || {}));

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
