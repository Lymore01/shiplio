import fs from "fs-extra";
import path from "path";

type Stack = "nodejs" | "python" | "elixir" | "nextjs" | "static" | "unknown";

interface StackInfo {
  version?: string;
  type: Stack;
  label: string;
  port?: number;
  detectedPM: "npm" | "yarn" | "pnpm" | "bun" | "pip" | "mix" | "unknown";
  defaultBuild: string;
  defaultStart: string;
  ignoreList: string[];
}

const STACK_MAP: Record<Stack, Omit<StackInfo, "type">> = {
  nodejs: {
    label: "Node.js",
    detectedPM: "npm",
    defaultBuild: "npm install && npm run build",
    defaultStart: "node dist/index.js",
    ignoreList: ["node_modules", "dist", ".npm", "npm-debug.log"],
  },
  nextjs: {
    label: "Next.js",
    detectedPM: "npm",
    defaultBuild: "npm install && npm run build",
    defaultStart: "npm start",
    // Next.js produces a heavy .next folder, but we NEED it for SSR.
    // We only ignore the cache.
    ignoreList: ["node_modules", ".next/cache", "out", ".env.local"],
  },
  python: {
    label: "Python",
    detectedPM: "pip",
    defaultBuild: "pip install -r requirements.txt",
    defaultStart: "python manage.py runserver",
    ignoreList: ["__pycache__", "venv", ".venv", "*.pyc", ".pytest_cache"],
  },
  elixir: {
    label: "Elixir",
    detectedPM: "mix",
    defaultBuild: "mix deps.get && mix compile",
    defaultStart: "mix phx.server",
    ignoreList: ["deps", "_build", "erl_crash.dump"],
  },
  static: {
    label: "Static Site",
    detectedPM: "unknown",
    defaultBuild: "echo 'Static site detected. No build required.'",
    defaultStart: "nginx -g 'daemon off;'",
    ignoreList: [".git", ".vscode", ".github"],
  },
  unknown: {
    label: "Generic",
    detectedPM: "unknown",
    defaultBuild: "echo 'No build command specified'",
    defaultStart: "echo 'No start command specified'",
    ignoreList: [],
  },
};

const STACK_ANCHORS: Record<string, Stack> = {
  "index.html": "static",
  "manage.py": "python",
  "pyproject.toml": "python",
  "requirements.txt": "python",
  "mix.exs": "elixir",
};

async function detectPackageManager(
  root: string,
): Promise<"npm" | "yarn" | "pnpm" | "bun"> {
  const pkgPath = path.join(root, "package.json");

  if (await fs.pathExists(pkgPath)) {
    const pkg = await fs.readJson(pkgPath);

    if (pkg.packageManager) {
      if (pkg.packageManager.startsWith("pnpm")) return "pnpm";
      if (pkg.packageManager.startsWith("yarn")) return "yarn";
      if (pkg.packageManager.startsWith("bun")) return "bun";
    }

    if (pkg.scripts?.preinstall?.includes("pnpm")) return "pnpm";
  }

  if (await fs.pathExists(path.join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (await fs.pathExists(path.join(root, "yarn.lock"))) return "yarn";
  if (await fs.pathExists(path.join(root, "bun.lockb"))) return "bun";

  const userAgent = process.env.npm_config_user_agent || "";
  if (userAgent.includes("pnpm")) return "pnpm";
  if (userAgent.includes("yarn")) return "yarn";
  if (userAgent.includes("bun")) return "bun";
  return "npm";
}

export async function getProjectContext(): Promise<StackInfo> {
  const root = process.cwd();
  const pkgPath = path.join(root, "package.json");

  const detectedPort = await detectLikelyPort(root);

  if (await fs.pathExists(pkgPath)) {
    const pkg = await fs.readJson(pkgPath);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const pm = await detectPackageManager(root);

    const isNext = !!deps.next;
    const stackType: Stack = isNext ? "nextjs" : "nodejs";
    const baseConfig = STACK_MAP[stackType];

    const pmCommands = getPMCommands(pm);

    return {
      version: pkg.version,
      type: stackType,
      label: `${baseConfig.label} (${pm})`,
      detectedPM: pm,
      port: detectedPort,
      defaultBuild: `${pmCommands.build}`,
      defaultStart: pmCommands.start,
      ignoreList: [
        ...baseConfig.ignoreList,
        pm === "pnpm" ? "pnpm-lock.yaml" : "",
      ].filter(Boolean),
    };
  }

  let detectedType: Stack = "unknown";

  for (const [file, stack] of Object.entries(STACK_ANCHORS)) {
    if (await fs.pathExists(path.join(root, file))) {
      detectedType = stack;
      break;
    }
  }

  const baseConfig = STACK_MAP[detectedType];

  const LikelyStaticPort =
    detectedType === "static" ? 80 : await detectLikelyPort(root);

  return {
    version: "unknown",
    type: detectedType,
    port: LikelyStaticPort,
    ...baseConfig,
    label: baseConfig.label,
  };
}

function getPMCommands(pm: string) {
  const commands: Record<string, any> = {
    npm: { install: "npm install", build: "npm run build", start: "npm start" },
    yarn: { install: "yarn install", build: "yarn build", start: "yarn start" },
    pnpm: { install: "pnpm install", build: "pnpm build", start: "pnpm start" },
    bun: { install: "bun install", build: "bun run build", start: "bun start" },
  };
  return commands[pm] || commands.npm;
}

export async function detectLikelyPort(projectDir: string): Promise<number> {
  const envPort = await detectFromEnv(projectDir);
  if (envPort) return envPort;

  const fromDocker = await detectFromDockerfile(projectDir);
  if (fromDocker) return fromDocker;

  if (fs.existsSync(path.join(projectDir, "package.json"))) {
    return await detectFromNode(projectDir);
  }

  if (
    fs.existsSync(path.join(projectDir, "index.html")) &&
    !fs.existsSync(path.join(projectDir, "package.json"))
  ) {
    return 80;
  }

  // for elixir
  if (fs.existsSync(path.join(projectDir, "mix.exs"))) {
    return await detectFromElixir(projectDir);
  }

  const isPython = ["requirements.txt", "manage.py", "pyproject.toml"].some(
    (file) => fs.existsSync(path.join(projectDir, file)),
  );

  if (isPython) {
    return await detectFromPython(projectDir);
  }

  return 3000;
}

async function detectFromPython(dir: string): Promise<number> {
  const files = ["manage.py", "app.py", "main.py", "pyproject.toml"];
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const match = content.match(/port[:=]\s*(\d+)/i);
      if (match) return parseInt(match[1], 10);
    }
  }
  return 8000;
}

async function detectFromDockerfile(dir: string): Promise<number | null> {
  const dockerfilePath = path.join(dir, "Dockerfile");
  if (!fs.existsSync(dockerfilePath)) return null;

  const content = fs.readFileSync(dockerfilePath, "utf-8");
  const match = content.match(/EXPOSE\s*(\d+)/i);
  if (match) return parseInt(match[1], 10);

  return null;
}

async function detectFromNode(dir: string): Promise<number> {
  const packageJsonPath = path.join(dir, "package.json");
  if (!fs.existsSync(packageJsonPath)) return 3000;

  const pkg = fs.readJsonSync(packageJsonPath);
  const scripts = pkg.scripts || {};

  const allScripts = Object.values(scripts).join(" ");
  const portInScript =
    allScripts.match(/PORT=(\d+)/) || allScripts.match(/--port\s+(\d+)/);
  if (portInScript) return parseInt(portInScript[1], 10);

  const entryFile = getEntryPointFromScripts(scripts);
  const searchFiles = entryFile
    ? [entryFile]
    : ["src/index.ts", "index.js", "server.js", "app.js"];

  for (const file of searchFiles) {
    const filePath = path.join(dir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const cleanContent = content.replace(
        /\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm,
        "$1",
      );
      const match =
        cleanContent.match(/\.listen\(\s*(\d+)/) ||
        cleanContent.match(/port\s*=\s*(\d+)/i);
      if (match) return parseInt(match[1], 10);
    }
  }

  return 3000;
}

export async function detectFromElixir(dir: string): Promise<number> {
  const devConfigPath = path.join(dir, "config", "dev.exs");
  const runtimeConfigPath = path.join(dir, "config", "runtime.exs");

  const configFiles = [devConfigPath, runtimeConfigPath];

  for (const configPath of configFiles) {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");

      const match =
        content.match(/port:\s*(\d+)/) ||
        content.match(/port:\s*String\.to_integer\(.*\|\|\s*"(\d+)"\)/);

      if (match) return parseInt(match[1], 10);
    }
  }

  const libPath = path.join(dir, "lib");
  if (fs.existsSync(libPath)) {
    const endpointPort = await scanForEndpointPort(libPath);
    if (endpointPort) return endpointPort;
  }

  return 4000;
}

async function scanForEndpointPort(dir: string): Promise<number | null> {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      const found = await scanForEndpointPort(fullPath);
      if (found) return found;
    } else if (file.endsWith("endpoint.ex")) {
      const content = fs.readFileSync(fullPath, "utf-8");
      const match = content.match(/port:\s*(\d+)/);
      if (match) return parseInt(match[1], 10);
    }
  }
  return null;
}

function getEntryPointFromScripts(
  scripts: Record<string, string>,
): string | null {
  const command = scripts.start || scripts.dev;
  if (!command) return null;

  const match = command.match(
    /(?:node|tsx|ts-node|nodemon)\s+([\w\/\.-]+\.(?:js|ts))/,
  );

  return match ? match[1] : null;
}

async function detectFromEnv(dir: string): Promise<number | null> {
  const envFiles = [".env", ".env.local", ".env.development"];

  for (const file of envFiles) {
    const filePath = path.join(dir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const match = content.match(/^PORT\s*=\s*(\d+)/m);
      if (match) return parseInt(match[1], 10);
    }
  }
  return null;
}
