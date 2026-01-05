import chalk from "chalk";

export function formatErrors(errors: unknown) {
  if (!errors || typeof errors !== "object") {
    return undefined;
  }

  const lines = [];

  for (const [field, messages] of Object.entries(errors)) {
    for (const msg of messages) {
      lines.push(`  • ${capitalize(field)} ${msg}`);
    }
  }

  return [
    chalk.red.bold("X Registration failed"),
    chalk.red(lines.join("\n")),
  ].join("\n");
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
