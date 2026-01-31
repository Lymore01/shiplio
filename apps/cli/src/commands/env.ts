import chalk from "chalk";
import { readShiplioConfig } from "../utils/config.js";
import path from "path";
import fs from "fs-extra";
import ora from "ora";
import { apiClient } from "../services/api.js";
import { handleError } from "../utils/formatErrors.js";
import dotenv from "dotenv";
import { env } from "process";

export async function pushEnvFromDotEnv(options: { replace?: boolean }) {
  const config = await readShiplioConfig();
  if (!config) {
    console.log(
      chalk.red("✖ No Shiplio project found. Run 'shiplio init' first."),
    );
    return;
  }

  const envPath = path.join(process.cwd(), ".env");

  if (!(await fs.pathExists(envPath))) {
    console.log(chalk.yellow("⚠ No .env file found in the current directory."));
    return;
  }

  const spinner = ora("Reading .env file...").start();

  try {
    const envRaw = await fs.readFile(envPath, "utf-8");
    const envVars = dotenv.parse(envRaw);
    const keys = Object.keys(envVars);

    console.log(envVars)

    if (keys.length === 0) {
      spinner.info("The .env file is empty. Nothing to sync.");
      return;
    }

    spinner.text = `Syncing ${keys.length} variables to ${chalk.blue(config.project_id)}...`;

    await apiClient.patch(`/projects/${config.project_id}/env`, {
      env_vars: envVars,
      mode: options.replace ? "replace" : "merge",
    });

    spinner.succeed(
      chalk.green(`Successfully synced ${keys.length} variables.`),
    );

    console.log(chalk.bold("\nSynced Keys:"));
    keys.forEach((key) => {
      console.log(`  ${chalk.green("✔")} ${chalk.dim(key)}`);
    });

    console.log(
      chalk.yellow(`\nℹ The container is restarting to apply changes.`),
    );
  } catch (error) {
    console.log(error)
    spinner.stop();
    handleError(error, "Failed to push environment variables");
  }
}
