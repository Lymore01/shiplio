import { Socket } from "phoenix";
import { readToken } from "./auth.js";
import { readShiplioConfig } from "../utils/config.js";
import chalk from "chalk";

export async function connectToDeploymentLogs() {
  const token = readToken();
  const config = await readShiplioConfig();

  const socket = new Socket("ws://localhost:4000/socket", {
    params: { token },
  });

  socket.connect();

  const channel = socket.channel(`logs:${config?.project_id}`, {});

  channel
    .join()
    .receive("error", (resp) =>
      process.stdout.write(`${chalk.red('[ERROR]')} Unable to join`, resp),
    );

  return channel;
}
