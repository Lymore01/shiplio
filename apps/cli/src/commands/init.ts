import chalk from "chalk";
import {
  createShiplioConfig,
  createShiplioIgnoreFile,
  generateShiplioJson,
  getCurrentFolderName,
  hasShiplioConfig,
} from "../utils/config.js";
import inquirer from "inquirer";
import { apiClient } from "../services/api.js";
import ora from "ora";
import { handleError } from "../utils/formatErrors.js";
import { getProjectContext } from "../utils/detector.js";

function validateProjectName(name: string) {
  if (!name || !name.trim()) return "Project name cannot be empty.";
  if (name.includes(" ")) return "Project name cannot contain spaces.";
  return true;
}

export async function init(projectName: string) {
  try {
    const context = await getProjectContext();
    console.log(
      `${chalk.green("✔")} Detected ${chalk.bold(context.label)} stack.`,
    );

    const configExists = await hasShiplioConfig();
    if (configExists) {
      console.log(
        chalk.yellow(
          "ℹ Shiplio project already initialized in this directory.",
        ),
      );
      return;
    }

    if (!projectName) {
      const { projectName: inputName } = await inquirer.prompt([
        {
          type: "input",
          name: "projectName",
          message: "Project name:",
          default: getCurrentFolderName(),
          validate: validateProjectName,
        },
      ]);
      projectName = inputName;
    }

    const { port } = await inquirer.prompt([
      {
        type: "number",
        name: "port",
        message: "Which port does your app run on?",
        default: context.port,
      },
    ]);

    const spinner = ora(
      `Initializing ${chalk.cyan(projectName)} on Shiplio...\n`,
    ).start();

    const { data: response } = await apiClient.post("/projects", {
      name: projectName,
      stack: context.type,
      default_port: port,
    });

    const project = response.data;

    await createShiplioConfig(projectName, project.id);

    await createShiplioIgnoreFile();

    await generateShiplioJson({
      version: context.version,
      name: projectName,
      project_id: project.id,
      port: port,
      stack: context.type,
      build_command: context.defaultBuild,
      start_command: context.defaultStart,
    });

    spinner.succeed(chalk.green("Project initialized successfully!"));

    console.log(`\n${chalk.bold("Next Steps:")}`);
    console.log(
      `${chalk.dim("1.")} Review ${chalk.cyan(
        "shiplio.json",
      )} to confirm your build commands.`,
    );
    console.log(
      `${chalk.dim("2.")} Run ${chalk.bold.blue(
        "shiplio deploy",
      )} to start your first build.\n`,
    );
  } catch (error: any) {
    if (error?.response?.status === 401) {
      console.log(chalk.red("\n✖ Authentication required."));
      console.log(chalk.dim("Run 'shiplio login' to get started."));
      process.exit(1);
    }

    handleError(error, "Project initialization failed");
  }
}
