export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return String(error);
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return "Unable to display the error.";
    }
  }
  return String(error);
}
