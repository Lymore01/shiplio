import { Socket } from "phoenix";
import { readToken } from "./auth.js";
import { readShiplioConfig } from "../utils/config.js";
import chalk from "chalk";
import type { Ora } from "ora";

interface Payload {
  level: string;
  step: string;
  message: string;
  timestamp: string;
}

export async function streamBuildLogs(spinner: Ora) {
  const token = readToken();
  const config = await readShiplioConfig();

  const socket = new Socket("ws://localhost:4000/socket", {
    params: { token },
  });

  socket.connect();

  const channel = socket.channel(`logs:${config?.project_id}`, {});

  return new Promise((resolve, reject) => {
    channel.on("new_log", (payload: Payload) => {
      const { level, message, step } = payload;

      spinner.stop();

      const colors: Record<string, any> = {
        info: chalk.blue,
        success: chalk.green,
        error: chalk.red,
        warn: chalk.yellow,
      };

      const colorize = colors[level] || chalk.white;
      const prefix = colorize(`[${level}]`);

      console.log(`${prefix} ${message.trim()}`);

      if (step === "done") {
        if (level === "success") process.exit(0);
        else process.exit(1);
      } else {
        spinner.text = chalk.dim(`Remote: ${message.trim()}\n`);
        spinner.start();
      }
    });

    channel.on(
      "build_complete",
      (payload: { url: string; duration: string }) => {
        spinner.stop();

        console.log(
          `\n${chalk.green.bold("[SUCCESS]")}` +
            " " +
            chalk.green.bold(`✅ Deployment successful!`),
        );
        console.log(`${chalk.gray("───")}`);
        console.log(
          `${chalk.cyan("➜ URL:")}  ${chalk.bold.underline.white(payload.url)}`,
        );
        console.log(
          `${chalk.cyan("➜ Time:")} ${chalk.white(payload.duration)}`,
        );
        console.log(`${chalk.gray("───")}\n`);

        process.exit(0);
      },
    );

    channel.onClose(() => {
      spinner.stop();
    });

    channel
      .join()
      .receive("ok", () => {
        process.stdout.write(
          `${chalk.cyan("➜")} Connected to build stream...\n`,
        );
        resolve(channel);
      })
      .receive("error", (resp) => {
        process.stdout.write(
          `${chalk.red("[ERROR]")} Unauthorized or Project not found\n`,
        );
        reject(resp);
      })
      .receive("timeout", () => reject("Connection timeout"));

    process.on("SIGINT", () => {
      spinner.stop();
      socket.disconnect();
      process.stdout.write(chalk.yellow("\nDisconnected from Build logs.\n"));
      process.exit(0);
    });
  });
}

export async function streamRuntimeLogs(spinner: Ora, tail: number = 50) {
  const token = readToken();
  const config = await readShiplioConfig();

  const socket = new Socket("ws://localhost:4000/socket", {
    params: { token },
  });

  socket.connect();

  const channel = socket.channel(`logs:runtime:${config?.project_id}`, {
    tail: tail,
  });

  channel.on(
    "runtime_log",
    (payload: { message: string; timestamp: string }) => {
      const timestamp = payload.timestamp
        ? `[${new Date(payload.timestamp).toLocaleTimeString()}] `
        : "";
      process.stdout.write(`${chalk.gray(timestamp)}${payload.message}\n`);
    },
  );

  return new Promise((resolve, reject) => {
    channel
      .join()
      .receive("ok", () => {
        spinner.succeed(chalk.green(`Connected to ${config?.name} logs`));
        process.stdout.write(
          chalk.yellow("\n--- Showing runtime logs (Ctrl+C to exit) ---\n\n"),
        );
      })
      .receive("error", (resp) => {
        spinner.fail("Connection failed");
        process.stdout.write(`${chalk.red("[ERROR]")} Unable to access logs\n`);
        reject(resp);
      });

    process.on("SIGINT", () => {
      spinner.stop();
      socket.disconnect();
      process.stdout.write(chalk.yellow("\nDisconnected from logs.\n"));
      process.exit(0);
    });
  });
}
