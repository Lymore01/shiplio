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

const getEnvDefaults = (envVars: string[]) => {
  const env: Record<string, string> = {};

  env["DEPLOYMENT_ENV"] = "production";

  envVars.forEach((key) => {
    if (key === "NODE_ENV") env[key] = "production";
    else if (key === "PYTHONUNBUFFERED") env[key] = "1";
    else if (key === "MIX_ENV") env[key] = "prod";
    else env[key] = "";
  });

  return env;
};

export async function generateShiplioJson(config: any) {
  const content = {
    version: config.version,
    name: config.name,
    project_id: config.project_id,
    stack: config.stack,
    build: {
      command: config.build_command || "",
    },
    runtime: {
      start_command: config.start_command,
      port: config.port,
      env: getEnvDefaults(config.envVars),
    },
    metadata: {
      confidence: config.confidence,
      detected_files: config.detectedFiles,
      pm: config.detectedPM,
    },
  };

  await fs.writeJson(path.join(process.cwd(), "shiplio.json"), content, {
    spaces: 2,
  });
}
