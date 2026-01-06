import fs from "fs-extra";
import path from "path";

type Stack = "node" | "python" | "elixir" | "unknown";

const STACK_CONFIG: Record<Stack, string[]> = {
  node: ["node_modules", "dist", ".npm", "npm-debug.log"],
  python: ["__pycache__", "venv", ".venv", "*.pyc", ".pytest_cache"],
  elixir: ["deps", "_build", "erl_crash.dump"],
  unknown: [],
};

const STACK_ANCHORS: Record<string, Stack> = {
  "package.json": "node",
  "manage.py": "python",
  "requirements.txt": "python",
  "mix.exs": "elixir",
};

export async function detectStack(): Promise<string[]> {
  const detectedIgnores: string[] = [];
  
  for (const [file, stack] of Object.entries(STACK_ANCHORS)) {
    if (await fs.pathExists(path.join(process.cwd(), file))) {
      detectedIgnores.push(...STACK_CONFIG[stack]);
    }
  }

  return [...new Set(detectedIgnores)];
}