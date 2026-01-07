import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { detectStack } from "./detector";

const execAsync = promisify(exec);

export async function hasShiplioConfig(): Promise<boolean | false> {
  try {
    const exists = await fs.pathExists(".shiplio");
    return exists;
  } catch (error) {
    console.error(error);
    return false;
  }
}

export function getCurrentFolderName() {
  return path.basename(process.cwd());
}

const CONFIG_FILE_PATH = path.join(process.cwd(), ".shiplio", "config.json");

export async function createShiplioConfig(name: string, project_id: string) {
  const comment =
    "This file is managed by Shiplio. Manual changes may break your link.";
  const config = {
    _warning: comment,
    name,
    project_id,
  };
  const configDir = path.join(process.cwd(), ".shiplio");

  try {
    await fs.ensureDir(configDir);

    await fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(config, null, 2));

    if (process.platform === "win32") {
      try {
        await execAsync(`attrib +h ${configDir}`);
      } catch (error) {
        console.error("Error hiding folder:", error);
      }
    }

    console.log(chalk.green("Project initialized and linked successfully."));
  } catch (error) {
    console.error("Error creating Shiplio config:", error);
  }
}

export async function readShiplioConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE_PATH)) {
      throw new Error("Shiplio config not found");
    }
    const configData = await fs.readFile(CONFIG_FILE_PATH, "utf-8");
    return JSON.parse(configData);
  } catch (error) {
    console.error("Error reading Shiplio config:", error);
    return null;
  }
}

const GLOBAL_IGNORES = [".git", ".shiplio", ".env", ".DS_Store", "thumbs.db"];

export async function createShiplioIgnoreFile() {
  const ignorePath = path.join(process.cwd(), ".shiplioignore");

  if (await fs.pathExists(ignorePath)) return;

  const stackIgnores = await detectStack();

  const content = [
    "# Shiplio Ignore - prevents large/sensitive files from being uploaded",
    ...GLOBAL_IGNORES,
    "",
    "# Stack-specific files",
    ...stackIgnores,
  ].join("\n");

  await fs.writeFile(ignorePath, content);
}
