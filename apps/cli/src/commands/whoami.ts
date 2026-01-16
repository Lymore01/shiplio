import { apiClient } from "../services/api.js";
import { handleError } from "../utils/formatErrors.js";
import ora from "ora";

export async function whoami() {
  try {
    const spinner = ora("Fetching user information...").start();

    const { data: response } = await apiClient.get("/auth/me");

    spinner.stop();


    console.log(`${response.user.email}`);
    console.log("\n")
  } catch (error) {
    handleError(error, "Failed to fetch user information");

    process.exit(1);
  }
}
