import fs from "fs-extra";
import path from "path";

type Stack = "nodejs" | "python" | "elixir" | "nextjs" | "unknown";

interface StackInfo {
  type: Stack;
  label: string;
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
  unknown: {
    label: "Generic",
    detectedPM: "unknown",
    defaultBuild: "echo 'No build command specified'",
    defaultStart: "echo 'No start command specified'",
    ignoreList: [],
  },
};

const STACK_ANCHORS: Record<string, Stack> = {
  "manage.py": "python",
  "requirements.txt": "python",
  "mix.exs": "elixir",
};

async function detectPackageManager(
  root: string
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

  if (await fs.pathExists(pkgPath)) {
    const pkg = await fs.readJson(pkgPath);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const pm = await detectPackageManager(root);

    const isNext = !!deps.next;
    const stackType: Stack = isNext ? "nextjs" : "nodejs";
    const baseConfig = STACK_MAP[stackType];

    const pmCommands = {
      npm: {
        install: "npm install",
        build: "npm run build",
        start: "npm start",
      },
      yarn: {
        install: "yarn install",
        build: "yarn build",
        start: "yarn start",
      },
      pnpm: {
        install: "pnpm install",
        build: "pnpm build",
        start: "pnpm start",
      },
      bun: {
        install: "bun install",
        build: "bun run build",
        start: "bun start",
      },
    }[pm];

    return {
      type: stackType,
      label: `${baseConfig.label} (${pm})`,
      detectedPM: pm,
      defaultBuild: `${pmCommands.install} && ${pmCommands.build}`,
      defaultStart: pmCommands.start,
      ignoreList: [
        ...baseConfig.ignoreList,
        pm === "pnpm" ? "pnpm-lock.yaml" : "",
      ].filter(Boolean),
    };
  }

  // --- Other Stacks (Python, Elixir, etc.) ---
  let detectedType: Stack = "unknown";

  for (const [file, stack] of Object.entries(STACK_ANCHORS)) {
    if (await fs.pathExists(path.join(root, file))) {
      detectedType = stack;
      break;
    }
  }

  return {
    type: detectedType,
    ...STACK_MAP[detectedType],
  };
}
