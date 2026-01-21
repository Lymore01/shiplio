import { streamRuntimeLogs } from "../services/socket.js";
import { readShiplioConfig } from "../utils/config.js";
import { handleError } from "../utils/formatErrors.js";
import ora from "ora";

export async function logs(options: { tail?: string }) {
  const config = await readShiplioConfig();
  const tailCount = options.tail ? parseInt(options.tail) : 50;

  const spinner = ora(`Connecting to ${config?.name} log stream...`).start();

  try {
    await streamRuntimeLogs(spinner, tailCount);
  } catch (error) {
    if (spinner.isSpinning) spinner.stop();
    handleError(error, "Fetching logs Failed");
    process.exit(1);
  }
}
