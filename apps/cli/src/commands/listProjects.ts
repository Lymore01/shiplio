import ora from "ora";
import chalk from "chalk";
import Table from "cli-table3";
import { apiClient } from "../services/api.js";
import { handleError } from "../utils/formatErrors.js";

export async function listProjects() {
  const spinner = ora({
    text: "Fetching your projects...",
    color: "cyan",
  }).start();

  try {
    const { data: res } = await apiClient.get("/projects");

    const project = res.data || [];

    spinner.stop();

    if (project.length === 0) {
      console.log(
        `\n${chalk.yellow("!")} You haven't created any projects yet.`,
      );
      console.log(
        `${chalk.dim("Run")} ${chalk.cyan("shiplio init")} ${chalk.dim("to get started.")}\n`,
      );
      return;
    }

    const table = new Table({
      head: [
        chalk.cyan("Project Name"),
        chalk.cyan("ID"),
        chalk.cyan("Stack"),
        chalk.cyan("Status"),
        chalk.cyan("URL"),
      ],
      colWidths: [25, 15, 12, 20, 35],
      style: { head: [], border: ["dim"] },
      wordWrap: true,
    });

    project.forEach((p: any) => {
      const statusColor =
        p.status === "active" ? chalk.green("●") : chalk.yellow("○");
      const url = p.local_url
        ? chalk.blue(`https://${p.local_url}`)
        : chalk.dim("not deployed");

      table.push([
        chalk.bold(p.name),
        chalk.dim(typeof p.id === "string" ? p.id.split("-")[0] : p.id),
        p.stack,
        `${statusColor} ${p.status}`,
        url,
      ]);
    });

    console.log(`\n${chalk.bold("Your Projects")}`);
    console.log(table.toString());
    console.log(`${chalk.dim(`Total: ${project.length} project(s)`)}\n`);
  } catch (error) {
    spinner.stop();
    console.log(error);
    handleError(error, "Failed to retrieve projects.");
  }
}
