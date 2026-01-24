import fs from "fs-extra";
import path from "path";

type Stack =
  | "nodejs"
  | "python"
  | "elixir"
  | "nextjs"
  | "django"
  | "flask"
  | "fastapi"
  | "static"
  | "unknown";

type PackageManager =
  | "npm"
  | "yarn"
  | "pnpm"
  | "bun"
  | "pip"
  | "pipenv"
  | "poetry"
  | "mix"
  | "unknown";

interface StackInfo {
  version?: string;
  type: Stack;
  label: string;
  port: number;
  detectedPM: PackageManager;
  defaultBuild: string;
  defaultStart: string;
  ignoreList: string[];
  confidence: "high" | "medium" | "low";
  detectedFiles: string[];
  buildCommand?: string; 
  startCommand?: string; 
  healthCheckPath?: string;
  envVars?: string[]; // Required env vars
}

interface DetectionResult {
  stack: Stack;
  confidence: "high" | "medium" | "low";
  detectedFiles: string[];
  frameworks?: string[]; // Secondary frameworks detected
}

const STACK_PRIORITIES: Record<Stack, number> = {
  nextjs: 10,
  django: 9,
  flask: 8,
  fastapi: 8,
  elixir: 7,
  nodejs: 5,
  python: 4,
  static: 2,
  unknown: 0,
};

const STACK_MAP: Record<
  Stack,
  Omit<StackInfo, "type" | "confidence" | "detectedFiles" | "version" | "port">
> = {
  nodejs: {
    label: "Node.js",
    detectedPM: "npm",
    defaultBuild: "npm ci && npm run build",
    defaultStart: "node dist/index.js",
    ignoreList: [
      "node_modules",
      "dist",
      "build",
      ".npm",
      "npm-debug.log*",
      ".pnpm-store",
      "coverage",
      ".nyc_output",
    ],
    healthCheckPath: "/health",
    envVars: ["NODE_ENV"],
  },
  nextjs: {
    label: "Next.js",
    detectedPM: "npm",
    defaultBuild: "npm ci && npm run build",
    defaultStart: "npm start",
    ignoreList: [
      "node_modules",
      ".next/cache",
      "out",
      ".env*.local",
      ".vercel",
      ".turbo",
    ],
    healthCheckPath: "/api/health",
    envVars: ["NODE_ENV"],
  },
  python: {
    label: "Python",
    detectedPM: "pip",
    defaultBuild: "pip install --no-cache-dir -r requirements.txt",
    defaultStart: "python main.py",
    ignoreList: [
      "__pycache__",
      "*.py[cod]",
      "*$py.class",
      "venv",
      ".venv",
      "env",
      "ENV",
      ".pytest_cache",
      "*.egg-info",
      "dist",
      "build",
      ".tox",
      "htmlcov",
    ],
    healthCheckPath: "/health",
    envVars: ["PYTHONUNBUFFERED"],
  },
  django: {
    label: "Django",
    detectedPM: "pip",
    defaultBuild:
      "pip install --no-cache-dir -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate",
    defaultStart: "gunicorn --bind 0.0.0.0:$PORT --workers 4 wsgi:application",
    ignoreList: [
      "__pycache__",
      "*.py[cod]",
      "venv",
      ".venv",
      "staticfiles",
      "media",
      "db.sqlite3",
      "*.log",
    ],
    healthCheckPath: "/health/",
    envVars: ["DJANGO_SETTINGS_MODULE", "SECRET_KEY", "DATABASE_URL"],
  },
  flask: {
    label: "Flask",
    detectedPM: "pip",
    defaultBuild: "pip install --no-cache-dir -r requirements.txt",
    defaultStart: "gunicorn --bind 0.0.0.0:$PORT --workers 4 app:app",
    ignoreList: [
      "__pycache__",
      "*.py[cod]",
      "venv",
      ".venv",
      "instance",
      "*.db",
    ],
    healthCheckPath: "/health",
    envVars: ["FLASK_APP", "FLASK_ENV"],
  },
  fastapi: {
    label: "FastAPI",
    detectedPM: "pip",
    defaultBuild: "pip install --no-cache-dir -r requirements.txt",
    defaultStart:
      "uvicorn main:app --host 0.0.0.0 --port $PORT --workers 4",
    ignoreList: ["__pycache__", "*.py[cod]", "venv", ".venv"],
    healthCheckPath: "/health",
    envVars: [],
  },
  elixir: {
    label: "Elixir",
    detectedPM: "mix",
    defaultBuild: "mix deps.get --only prod && MIX_ENV=prod mix compile",
    defaultStart: "MIX_ENV=prod mix phx.server",
    ignoreList: [
      "deps",
      "_build",
      ".elixir_ls",
      "erl_crash.dump",
      "*.ez",
      ".fetch",
    ],
    healthCheckPath: "/health",
    envVars: ["SECRET_KEY_BASE", "DATABASE_URL"],
  },
  static: {
    label: "Static Site",
    detectedPM: "unknown",
    defaultBuild: "echo 'Static site - no build required'",
    defaultStart: "nginx -g 'daemon off;",
    ignoreList: [".git", ".DS_Store", "Thumbs.db"],
    healthCheckPath: "/",
    envVars: [],
  },
  unknown: {
    label: "Unknown",
    detectedPM: "unknown",
    defaultBuild: "echo 'No build command detected'",
    defaultStart: "echo 'No start command detected'",
    ignoreList: [".git"],
    envVars: [],
  },
};

const DETECTION_PATTERNS = {
  nextjs: {
    required: ["package.json"],
    dependencies: ["next"],
    files: ["next.config.js", "next.config.mjs", "next.config.ts"],
    confidence: "high" as const,
  },
  django: {
    required: ["manage.py"],
    dependencies: ["django", "Django"],
    files: ["settings.py", "wsgi.py", "asgi.py"],
    patterns: [/from django/i, /import django/i],
    confidence: "high" as const,
  },
  flask: {
    required: [],
    dependencies: ["flask", "Flask"],
    files: ["app.py", "application.py"],
    patterns: [/from flask import/i, /Flask\(__name__\)/],
    confidence: "medium" as const,
  },
  fastapi: {
    required: [],
    dependencies: ["fastapi", "FastAPI"],
    files: ["main.py", "app.py"],
    patterns: [/from fastapi import/i, /FastAPI\(/],
    confidence: "medium" as const,
  },
  elixir: {
    required: ["mix.exs"],
    dependencies: ["phoenix"],
    files: ["config/config.exs", "lib/**/endpoint.ex"],
    confidence: "high" as const,
  },
};

class DetectionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "DetectionError";
  }
}

async function safeReadFile(
  filePath: string,
  maxSize = 1024 * 1024,
): Promise<string | null> {
  try {
    const stats = await fs.stat(filePath);
    if (stats.size > maxSize) {
      console.warn(`File ${filePath} exceeds max size, skipping`);
      return null;
    }
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    return null;
  }
}

async function safeReadJson<T>(filePath: string): Promise<T | null> {
  try {
    return await fs.readJson(filePath);
  } catch (error) {
    console.warn(`Failed to parse JSON from ${filePath}:`, error);
    return null;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectPackageManager(root: string): Promise<PackageManager> {
  const pkgPath = path.join(root, "package.json");

  if (await fileExists(pkgPath)) {
    const pkg = await safeReadJson<any>(pkgPath);
    if (pkg?.packageManager) {
      if (pkg.packageManager.startsWith("pnpm")) return "pnpm";
      if (pkg.packageManager.startsWith("yarn")) return "yarn";
      if (pkg.packageManager.startsWith("bun")) return "bun";
    }
  }

  const lockfileChecks = [
    { file: "bun.lockb", pm: "bun" as const },
    { file: "pnpm-lock.yaml", pm: "pnpm" as const },
    { file: "yarn.lock", pm: "yarn" as const },
    { file: "package-lock.json", pm: "npm" as const },
  ];

  for (const { file, pm } of lockfileChecks) {
    if (await fileExists(path.join(root, file))) {
      return pm;
    }
  }

  if (await fileExists(path.join(root, "Pipfile"))) return "pipenv";
  if (await fileExists(path.join(root, "poetry.lock"))) return "poetry";

  const userAgent = process.env.npm_config_user_agent || "";
  if (userAgent.includes("pnpm")) return "pnpm";
  if (userAgent.includes("yarn")) return "yarn";
  if (userAgent.includes("bun")) return "bun";

  return "npm";
}

async function detectPythonPackageManager(
  root: string,
): Promise<"pip" | "pipenv" | "poetry"> {
  if (await fileExists(path.join(root, "poetry.lock"))) return "poetry";
  if (await fileExists(path.join(root, "Pipfile"))) return "pipenv";
  return "pip";
}

async function detectStack(root: string): Promise<DetectionResult> {
  const detectedStacks: Array<{
    stack: Stack;
    confidence: "high" | "medium" | "low";
    score: number;
    files: string[];
  }> = [];

  const pkgPath = path.join(root, "package.json");
  if (await fileExists(pkgPath)) {
    const pkg = await safeReadJson<any>(pkgPath);
    if (pkg) {
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      if (allDeps.next) {
        const nextFiles = [];
        const configFiles = [
          "next.config.js",
          "next.config.mjs",
          "next.config.ts",
        ];
        for (const file of configFiles) {
          if (await fileExists(path.join(root, file))) {
            nextFiles.push(file);
          }
        }
        detectedStacks.push({
          stack: "nextjs",
          confidence: "high",
          score: STACK_PRIORITIES.nextjs,
          files: ["package.json", ...nextFiles],
        });
      } else {
        detectedStacks.push({
          stack: "nodejs",
          confidence: "medium",
          score: STACK_PRIORITIES.nodejs,
          files: ["package.json"],
        });
      }
    }
  }

  const pythonMarkers = [
    "requirements.txt",
    "pyproject.toml",
    "setup.py",
    "Pipfile",
    "poetry.lock",
  ];
  const foundPythonFiles: string[] = [];

  for (const file of pythonMarkers) {
    if (await fileExists(path.join(root, file))) {
      foundPythonFiles.push(file);
    }
  }

  if (foundPythonFiles.length > 0) {
    if (await fileExists(path.join(root, "manage.py"))) {
      const managePy = await safeReadFile(path.join(root, "manage.py"));
      if (managePy?.includes("django")) {
        detectedStacks.push({
          stack: "django",
          confidence: "high",
          score: STACK_PRIORITIES.django,
          files: ["manage.py", ...foundPythonFiles],
        });
      }
    }

    const mainPy = await safeReadFile(path.join(root, "main.py"));
    if (mainPy?.match(/from fastapi import|FastAPI\(/)) {
      detectedStacks.push({
        stack: "fastapi",
        confidence: "high",
        score: STACK_PRIORITIES.fastapi,
        files: ["main.py", ...foundPythonFiles],
      });
    }

    const flaskFiles = ["app.py", "application.py", "main.py"];
    for (const file of flaskFiles) {
      const content = await safeReadFile(path.join(root, file));
      if (content?.match(/from flask import|Flask\(__name__\)/)) {
        detectedStacks.push({
          stack: "flask",
          confidence: "high",
          score: STACK_PRIORITIES.flask,
          files: [file, ...foundPythonFiles],
        });
        break;
      }
    }

    // Generic Python if no framework detected
    if (
      !detectedStacks.some((s) =>
        ["django", "flask", "fastapi"].includes(s.stack),
      )
    ) {
      detectedStacks.push({
        stack: "python",
        confidence: "medium",
        score: STACK_PRIORITIES.python,
        files: foundPythonFiles,
      });
    }
  }

  if (await fileExists(path.join(root, "mix.exs"))) {
    const mixContent = await safeReadFile(path.join(root, "mix.exs"));
    const isPhoenix = mixContent?.includes("phoenix");
    detectedStacks.push({
      stack: "elixir",
      confidence: isPhoenix ? "high" : "medium",
      score: STACK_PRIORITIES.elixir,
      files: ["mix.exs"],
    });
  }

  // Check for static site
  if (
    await fileExists(path.join(root, "index.html")) &&
    !(await fileExists(pkgPath))
  ) {
    detectedStacks.push({
      stack: "static",
      confidence: "medium",
      score: STACK_PRIORITIES.static,
      files: ["index.html"],
    });
  }

  // Sort by score (highest first) and return best match
  if (detectedStacks.length === 0) {
    return {
      stack: "unknown",
      confidence: "low",
      detectedFiles: [],
    };
  }

  detectedStacks.sort((a, b) => b.score - a.score);
  const best = detectedStacks[0];

  return {
    stack: best.stack,
    confidence: best.confidence,
    detectedFiles: best.files,
    frameworks: detectedStacks.slice(1).map((s) => s.stack),
  };
}

async function detectPort(projectDir: string, stack: Stack): Promise<number> {
  // Priority order: ENV files > Dockerfile > framework config > defaults
  const envPort = await detectFromEnv(projectDir);
  if (envPort) return envPort;

  const dockerPort = await detectFromDockerfile(projectDir);
  if (dockerPort) return dockerPort;

  switch (stack) {
    case "nodejs":
    case "nextjs":
      return await detectFromNode(projectDir);
    case "python":
    case "django":
    case "flask":
    case "fastapi":
      return await detectFromPython(projectDir);
    case "elixir":
      return await detectFromElixir(projectDir);
    case "static":
      return 80;
    default:
      return 3000;
  }
}

async function detectFromEnv(dir: string): Promise<number | null> {
  const envFiles = [
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
  ];

  for (const file of envFiles) {
    const content = await safeReadFile(path.join(dir, file));
    if (content) {
      const match = content.match(/^PORT\s*[=:]\s*(\d+)/m);
      if (match) {
        const port = parseInt(match[1], 10);
        if (port > 0 && port < 65536) {
          return port;
        }
      }
    }
  }
  return null;
}

async function detectFromDockerfile(dir: string): Promise<number | null> {
  const dockerfiles = ["Dockerfile", "dockerfile", "Dockerfile.prod"];

  for (const file of dockerfiles) {
    const content = await safeReadFile(path.join(dir, file));
    if (content) {
      const match = content.match(/EXPOSE\s+(\d+)/i);
      if (match) {
        const port = parseInt(match[1], 10);
        if (port > 0 && port < 65536) {
          return port;
        }
      }
    }
  }
  return null;
}

async function detectFromNode(dir: string): Promise<number> {
  const pkgPath = path.join(dir, "package.json");
  const pkg = await safeReadJson<any>(pkgPath);

  if (pkg?.scripts) {
    const allScripts = Object.values(pkg.scripts).join(" ");
    const portMatch =
      allScripts.match(/PORT[=:](\d+)/) ||
      allScripts.match(/--port[=\s]+(\d+)/) ||
      allScripts.match(/-p\s+(\d+)/);

    if (portMatch) {
      const port = parseInt(portMatch[1], 10);
      if (port > 0 && port < 65536) return port;
    }
  }

  // Search common entry files
  const entryFiles = [
    pkg?.main,
    "src/index.ts",
    "src/index.js",
    "src/server.ts",
    "src/server.js",
    "index.js",
    "server.js",
    "app.js",
  ].filter(Boolean);

  for (const file of entryFiles) {
    const content = await safeReadFile(path.join(dir, file!));
    if (content) {
      const cleanContent = content.replace(
        /\/\*[\s\S]*?\*\/|\/\/.*/g,
        "",
      );
      const match =
        cleanContent.match(/\.listen\(\s*(\d+)/) ||
        cleanContent.match(/port\s*[=:]\s*(\d+)/i) ||
        cleanContent.match(/PORT\s*[=:]\s*(\d+)/);

      if (match) {
        const port = parseInt(match[1], 10);
        if (port > 0 && port < 65536) return port;
      }
    }
  }

  return 3000;
}

async function detectFromPython(dir: string): Promise<number> {
  const files = [
    "manage.py",
    "app.py",
    "main.py",
    "application.py",
    "wsgi.py",
    "asgi.py",
  ];

  for (const file of files) {
    const content = await safeReadFile(path.join(dir, file));
    if (content) {
      const match =
        content.match(/port\s*[=:]\s*(\d+)/i) ||
        content.match(/\.run\([^)]*port\s*=\s*(\d+)/i) ||
        content.match(/bind.*:(\d+)/);

      if (match) {
        const port = parseInt(match[1], 10);
        if (port > 0 && port < 65536) return port;
      }
    }
  }

  // Check Django settings
  const settingsFiles = [
    "settings.py",
    "config/settings.py",
    "*/settings.py",
  ];
  for (const pattern of settingsFiles) {
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (file === "settings.py" || file.endsWith("/settings.py")) {
          const content = await safeReadFile(path.join(dir, file));
          if (content?.match(/PORT\s*=\s*(\d+)/)) {
            const match = content.match(/PORT\s*=\s*(\d+)/);
            if (match) {
              const port = parseInt(match[1], 10);
              if (port > 0 && port < 65536) return port;
            }
          }
        }
      }
    } catch {}
  }

  return 8000;
}

async function detectFromElixir(dir: string): Promise<number> {
  const configFiles = [
    "config/runtime.exs",
    "config/prod.exs",
    "config/dev.exs",
    "config/config.exs",
  ];

  for (const file of configFiles) {
    const content = await safeReadFile(path.join(dir, file));
    if (content) {
      const match =
        content.match(/port:\s*(\d+)/) ||
        content.match(/port:\s*String\.to_integer\([^)]*"(\d+)"\)/);

      if (match) {
        const port = parseInt(match[1], 10);
        if (port > 0 && port < 65536) return port;
      }
    }
  }

  // Scan lib directory for endpoint.ex
  const libPath = path.join(dir, "lib");
  if (await fileExists(libPath)) {
    const port = await scanForEndpointPort(libPath);
    if (port) return port;
  }

  return 4000;
}

async function scanForEndpointPort(
  dir: string,
  depth = 0,
): Promise<number | null> {
  if (depth > 5) return null; // Prevent deep recursion

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const found = await scanForEndpointPort(fullPath, depth + 1);
        if (found) return found;
      } else if (entry.name.endsWith("_endpoint.ex")) {
        const content = await safeReadFile(fullPath);
        if (content) {
          const match = content.match(/port:\s*(\d+)/);
          if (match) {
            const port = parseInt(match[1], 10);
            if (port > 0 && port < 65536) return port;
          }
        }
      }
    }
  } catch (error) {
    console.warn(`Error scanning directory ${dir}:`, error);
  }

  return null;
}

function getPMCommands(pm: PackageManager) {
  const commands: Record<string, any> = {
    npm: {
      install: "npm ci",
      build: "npm run build",
      start: "npm start",
      dev: "npm run dev",
    },
    yarn: {
      install: "yarn install --frozen-lockfile",
      build: "yarn build",
      start: "yarn start",
      dev: "yarn dev",
    },
    pnpm: {
      install: "pnpm install --frozen-lockfile",
      build: "pnpm build",
      start: "pnpm start",
      dev: "pnpm dev",
    },
    bun: {
      install: "bun install",
      build: "bun run build",
      start: "bun start",
      dev: "bun dev",
    },
    pip: {
      install: "pip install --no-cache-dir -r requirements.txt",
    },
    pipenv: {
      install: "pipenv install --deploy",
    },
    poetry: {
      install: "poetry install --no-dev",
    },
  };
  return commands[pm] || commands.npm;
}

async function detectBuildStart(
  root: string,
  stack: Stack,
  pm: PackageManager,
): Promise<{ build?: string; start?: string }> {
  if (stack === "nodejs" || stack === "nextjs") {
    const pkg = await safeReadJson<any>(path.join(root, "package.json"));
    if (pkg?.scripts) {
      return {
        build: pkg.scripts.build,
        start: pkg.scripts.start || pkg.scripts.serve,
      };
    }
  }

  return {};
}

export async function getProjectContext(
  projectDir?: string,
): Promise<StackInfo> {
  const root = projectDir || process.cwd();

  try {
    if (!(await fileExists(root))) {
      throw new DetectionError(
        `Directory not found: ${root}`,
        "DIR_NOT_FOUND",
      );
    }

    const detection = await detectStack(root);

    const baseConfig = STACK_MAP[detection.stack];

    let pm: PackageManager = baseConfig.detectedPM;
    if (detection.stack === "nodejs" || detection.stack === "nextjs") {
      pm = await detectPackageManager(root);
    } else if (
      detection.stack === "python" ||
      detection.stack === "django" ||
      detection.stack === "flask" ||
      detection.stack === "fastapi"
    ) {
      pm = await detectPythonPackageManager(root);
    }

    const port = await detectPort(root, detection.stack);

    const customCommands = await detectBuildStart(root, detection.stack, pm);

    let version: string | undefined;
    if (detection.stack === "nodejs" || detection.stack === "nextjs") {
      const pkg = await safeReadJson<any>(path.join(root, "package.json"));
      version = pkg?.version;
    }

    const pmCommands = getPMCommands(pm);
    const buildCmd =
      detection.stack === "nodejs" || detection.stack === "nextjs"
        ? `${pmCommands.install} && ${pmCommands.build}`
        : baseConfig.defaultBuild;

    return {
      version,
      type: detection.stack,
      label: `${baseConfig.label}${pm !== "unknown" ? ` (${pm})` : ""}`,
      port,
      detectedPM: pm,
      defaultBuild: buildCmd,
      defaultStart: baseConfig.defaultStart,
      buildCommand: customCommands.build,
      startCommand: customCommands.start,
      ignoreList: baseConfig.ignoreList,
      confidence: detection.confidence,
      detectedFiles: detection.detectedFiles,
      healthCheckPath: baseConfig.healthCheckPath,
      envVars: baseConfig.envVars,
    };
  } catch (error) {
    if (error instanceof DetectionError) {
      throw error;
    }

    throw new DetectionError(
      `Failed to detect project context: ${error}`,
      "DETECTION_FAILED",
      error,
    );
  }
}

export { detectStack, detectPort, detectPackageManager, DetectionError };
export type { Stack, StackInfo, PackageManager, DetectionResult };