import chalk from "chalk";
import { readShiplioConfig } from "../utils/config.js";
import path from "path";
import fs from "fs-extra";
import ora from "ora";
import { handleError } from "../utils/formatErrors.js";
import dotenv from "dotenv";

export async function pushEnv() {
  const config = await readShiplioConfig();
  if (!config) {
    console.log(
      chalk.red("✖ No Shiplio project found. Run 'shiplio init' first.")
    );
    return;
  }

  const envPath = path.join(process.cwd(), ".env");

  if (!(await fs.pathExists(envPath))) {
    console.log(chalk.yellow("⚠ No .env file found in the current directory."));
    return;
  }

  const spinner = ora("Reading .env and syncing with Shiplio...").start();

  try {
    const envRaw = await fs.readFile(envPath, "utf-8");
    const envVars = dotenv.parse(envRaw);

    const keys = Object.keys(envVars);
    if (keys.length === 0) {
      spinner.info("The .env file is empty. Nothing to sync.");
      return;
    }

    // await apiClient.post(`/projects/${config.project_id}/env_vars`, {
    //   vars: envVars,
    // });

    spinner.succeed(
      chalk.green(`Successfully synced ${keys.length} variables.`)
    );

    console.log(chalk.dim("\nSynced keys:"));
    keys.forEach((key) => console.log(`  ${chalk.cyan("→")} ${key}`));
    spinner.stop();
  } catch (error) {
    spinner.stop();
    handleError(error, "Failed to push environment variables");
  }
}
