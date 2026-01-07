import chalk from "chalk";
import {
  createShiplioConfig,
  createShiplioIgnoreFile,
  getCurrentFolderName,
  hasShiplioConfig,
} from "../utils/config.js";
import inquirer from "inquirer";
import { apiClient } from "../services/api.js";
import ora from "ora";
import { handleError } from "../utils/formatErrors.js";

function validateProjectName(name: string) {
  if (!name || !name.trim()) {
    return "Project name cannot be empty.";
  }

  if (name.includes(" ")) {
    return "Project name cannot contain spaces.";
  }

  return true;
}

export async function init(projectName: string) {
  try {
    const configExists = await hasShiplioConfig();
    if (configExists) {
      console.log(
        chalk.green("Shiplio project already initialized. You can now deploy!")
      );
      return;
    }

    const defaultProjectName = getCurrentFolderName();

    if (!projectName) {
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "projectName",
          message: "Project name:",
          default: defaultProjectName,
          validate: (value: string) => {
            return validateProjectName(value);
          },
        },
      ]);
      projectName = answers.projectName;
    }

    const spinner = ora(`Initializing project ${projectName}...\n`).start();

    const { data: response } = await apiClient.post("/projects", {
      name: projectName,
    });

    await createShiplioConfig(projectName, response.data.id);
    await createShiplioIgnoreFile();

    spinner.succeed(chalk.green(`${response.message} You can now deploy!`));
  } catch (error) {
    handleError(error, "Project initialization failed");
    if ((error as any).response.status === 401) {
      console.log(chalk.dim("\nRun 'shiplio login' to get started"));
    }
    process.exit(1);
  }
}
