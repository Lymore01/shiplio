import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { getProjectContext } from "./detector.js";

const execAsync = promisify(exec);

interface ShiplioConfig {
  _warning: string;
  name: string;
  project_id: string;
}

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
  const config: ShiplioConfig = {
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

export async function readShiplioConfig(): Promise<Omit<
  ShiplioConfig,
  "_warning"
> | null> {
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

  const { ignoreList: stackIgnores } = await getProjectContext();

  const content = [
    "# Shiplio Ignore - prevents large/sensitive files from being uploaded",
    ...GLOBAL_IGNORES,
    "",
    "# Stack-specific files",
    ...stackIgnores,
  ].join("\n");

  await fs.writeFile(ignorePath, content);
}

export async function generateShiplioJson(projectName?: string) {
  const filePath = path.join(process.cwd(), "shiplio.json");

  if (await fs.pathExists(filePath)) return;
  const context = await getProjectContext();

  const content = {
    version: "1.0",
    name: projectName ?? path.basename(process.cwd()),
    stack: context.type,
    package_manager: context.detectedPM,
    build: {
      command: context.defaultBuild,
      output_dir: "dist",
    },
    runtime: {
      start_command: context.defaultStart,
      env: {
        NODE_ENV: "production",
      },
    },
  };

  await fs.writeJson(filePath, content, { spaces: 2 });
}
