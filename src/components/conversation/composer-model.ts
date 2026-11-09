import type { v2 } from "../../protocol";

export type SubmissionMode = "send" | "steer" | "queue";

export function availableSubmissionModes(
  activeTurnId: string | null,
): SubmissionMode[] {
  return activeTurnId ? ["send", "steer", "queue"] : ["send"];
}

export function submissionModeLabel(mode: SubmissionMode): string {
  return mode === "steer"
    ? "Steer active turn"
    : mode === "queue"
      ? "Queue next message"
      : "Send";
}

export function buildImageUserInput(url: string): v2.UserInput {
  return { type: "image", url };
}

type ComposerShortcutEvent = {
  altKey: boolean;
  ctrlKey: boolean;
  isComposing?: boolean;
  key: string;
  metaKey: boolean;
  nativeEvent?: { isComposing?: boolean };
  shiftKey: boolean;
};

export function isComposerSubmitShortcut(
  event: ComposerShortcutEvent,
): boolean {
  return (
    event.key === "Enter" &&
    event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.metaKey &&
    !event.isComposing &&
    !event.nativeEvent?.isComposing
  );
}
