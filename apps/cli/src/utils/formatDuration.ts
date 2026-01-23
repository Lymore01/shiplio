export function formatDuration(duration: number): string {
  if (duration > 1000) {
    const seconds = Math.floor(duration / 1000);

    return `${seconds}s`;
  } else {
    return `${duration}ms`;
  }
}
