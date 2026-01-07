import ora from "ora";
import inquirer from "inquirer";
import chalk from "chalk";
import { handleError } from "../utils/formatErrors";
import { apiClient } from "../services/api";
import { createShiplioConfig } from "../utils/config";

export async function link() {
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
          '? You don\'t have any projects yet. Run "shiplio init" to create one.'
        )
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

    const configSpinner = ora(`Linking to ${selectedProject.name}...`).start();

    await createShiplioConfig(selectedProject.name, selectedProject.id);

    configSpinner.succeed(
      chalk.green(`Successfully linked to ${selectedProject.name}!`)
    );
    console.log(
      chalk.dim('You can now run "shiplio status" or "shiplio deploy".')
    );
  } catch (error) {
    spinner.stop();
    handleError(error, "Linking Failed");
    process.exit(1);
  }
}
