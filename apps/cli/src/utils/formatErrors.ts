import chalk from "chalk";

/**
 * Transforms API error objects into a formatted CLI string.
 * @param title - The header message (e.g., "Deployment failed")
 * @param errors - The raw error object from Phoenix/Ecto or string from Guardian
 */
export function formatErrors(title: string, errors: unknown): string {
  const header = chalk.red.bold(`\n× ${title}`);

  if (!errors) return header;

  const lines: string[] = [];

  if (typeof errors === "string") {
    lines.push(chalk.red(`  • ${capitalize(errors)}`));
  }

  else if (typeof errors === "object") {
    for (const [field, messages] of Object.entries(errors)) {
      if (Array.isArray(messages)) {
        messages.forEach((msg) => {
          lines.push(chalk.red(`  • ${capitalize(field)} ${msg}`));
        });
      } else if (typeof messages === "string") {
        const label = ["error", "message"].includes(field.toLowerCase())
          ? ""
          : `${capitalize(field)} `;
        lines.push(chalk.red(`  • ${label}${messages}`));
      }
    }
  }

  return lines.length > 0 ? `${header}\n${lines.join("\n")}` : header;
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function handleError(error: any, contextTitle: string) {
  const apiErrors =
    error?.response?.data?.errors || error?.response?.data?.error || error?.response?.data?.message

  const message = formatErrors(contextTitle, apiErrors);

  console.error(message);
}
