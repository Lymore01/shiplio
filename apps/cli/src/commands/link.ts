import ora from "ora";
import inquirer from "inquirer";
import chalk from "chalk";
import { handleError } from "../utils/formatErrors.js";
import { apiClient } from "../services/api.js";
import { createShiplioConfig, generateShiplioJson } from "../utils/config.js";
import { getProjectContext } from "../utils/detectorV2.js";

export async function link() {
  const context = await getProjectContext();

  const spinner = ora("Fetching your projects from Shiplio...").start();
  try {
    const { data: axiosResponse } = await apiClient.get("/projects");

    const projects = Array.isArray(axiosResponse.data)
      ? axiosResponse.data
      : axiosResponse;

    spinner.stop();

    if (projects.length === 0) {
      console.log(
        chalk.yellow(
          '? You don\'t have any projects yet. Run "shiplio init" to create one.',
        ),
      );
      return;
    }

    const { selectedProject } = await inquirer.prompt({
      name: "selectedProject",
      type: "select",
      message: "Which project do you want to link to this directory?\n",
      choices: projects.map((p: any) => ({
        name: `${p.name} ${chalk.dim(`(${p.status})`)}`,
        value: p,
      })),
    });

    const configSpinner = ora(
      `Linking to ${selectedProject.name}...\n`,
    ).start();

    await createShiplioConfig(selectedProject.name, selectedProject.id);

    await generateShiplioJson({
      version: context.version || "unknown",
      name: selectedProject.name,
      project_id: selectedProject.id,
      port: selectedProject.default_port,
      stack: context.type,
      build_command: context.defaultBuild,
      start_command: context.defaultStart,
      envVars: context.envVars,
      confidence: context.confidence,
      detectedFiles: context.detectedFiles,
      detectedPM: context.detectedPM,
    });

    configSpinner.succeed(
      chalk.green(`Successfully linked to ${selectedProject.name}!`),
    );
    console.log(
      chalk.dim('You can now run "shiplio status" or "shiplio deploy".'),
    );
  } catch (error) {
    spinner.stop();
    handleError(error, "Linking Failed");
    process.exit(1);
  }
}
