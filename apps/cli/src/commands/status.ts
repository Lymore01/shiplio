import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { apiClient } from "../services/api.js";
import { handleError } from "../utils/formatErrors.js";
import { readShiplioConfig } from "../utils/config.js";
import { formatTerminalDate } from "../utils/formatTerminalDate.js";
import { formatDuration } from "../utils/formatDuration.js";

export async function status() {
  const config = await readShiplioConfig();

  if (!config) {
    console.log(chalk.red("\n✖ No Shiplio project found in this directory."));
    console.log(
      chalk.dim("Run 'shiplio init' or 'shiplio link' to get started.\n"),
    );
    return;
  }

  const spinner = ora(
    `Fetching status for ${chalk.cyan(config.name)}...`,
  ).start();

  try {
    const { data: response } = await apiClient.get(
      `/projects/${config.project_id}`,
    );
    const project = response.data;

    spinner.stop();

    const statusTheme = {
      active: { color: chalk.green, icon: "●" },
      building: { color: chalk.yellow, icon: "⚙" },
      failed: { color: chalk.red, icon: "✖" },
      initialized: { color: chalk.blue, icon: "○" },
      stopped: { color: chalk.gray, icon: "◌" },
    };

    // @ts-ignore
    const theme = statusTheme[project.status] || {
      color: chalk.white,
      icon: "?",
    };

    const table = new Table({
      head: [chalk.cyan("Property"), chalk.cyan("Value")],
      colWidths: [15, 45],
      wordWrap: true,
    });

    table.push(
      { [chalk.bold("Name")]: project.name },
      { [chalk.bold("ID")]: chalk.dim(project.id) },
      { [chalk.bold("Stack")]: project.stack },
      {
        [chalk.bold("Status")]:
          `${theme.color(theme.icon)} ${theme.color(project.status.toUpperCase())}`,
      },
    );

    if (project.url) {
      table.push({
        [chalk.bold("URL")]: chalk.underline.blue(project.url),
      });
    }

    if (project.duration) {
      table.push({
        [chalk.bold("Duration")]: formatDuration(project.duration),
      });
    }

    table.push({
      [chalk.bold("Last Update")]: formatTerminalDate(project.updated_at),
    });

    console.log(`\n${chalk.bold.cyan("PROJECT INSIGHTS")}`);
    console.log(table.toString());

    if (project.status === "failed") {
      console.log(
        chalk.red(
          `💡 Tip: Run ${chalk.bold("shiplio logs")} to see why the build failed.\n`,
        ),
      );
    } else if (project.status === "active") {
      console.log(
        chalk.green(`🚀 Your project is live and ready for requests.\n`),
      );
    }
  } catch (error: any) {
    spinner.stop();

    if (error?.response?.status === 404) {
      handleError(
        error,
        "Project not found on server. Your local link might be broken.",
      );
      console.log(chalk.dim("\nRun 'shiplio link' to fix it."));
    } else {
      handleError(
        error,
        "Failed to fetch project status. Your local link might be broken.",
      );
      console.log(chalk.dim("\nRun 'shiplio link' to fix it."));
    }
  }
}
