export type SubmissionMode = "send" | "steer" | "queue";

export function availableSubmissionModes(activeTurnId: string | null): SubmissionMode[] {
  return activeTurnId ? ["send", "steer", "queue"] : ["send"];
}

export function submissionModeLabel(mode: SubmissionMode): string {
  return mode === "steer" ? "Steer active turn" : mode === "queue" ? "Queue next message" : "Send";
}
