import type { v2 } from "../../protocol";
import type { CollaborationMode } from "../../protocol/generated/CollaborationMode";

export type SubmissionMode = "send" | "steer" | "queue";
export type PermissionMode = "ask" | "read-only" | "full-access";

export type ComposerSubmissionPlan =
  | {
      kind: "send";
      params: {
        threadId: string;
        input: v2.UserInput[];
        model: string | null;
        effort: string | null;
        collaborationMode?: CollaborationMode;
      };
    }
  | {
      kind: "queue";
      params: { threadId: string; input: v2.UserInput[] };
    }
  | {
      kind: "steer";
      params: {
        threadId: string;
        expectedTurnId: string;
        input: v2.UserInput[];
      };
    }
  | { kind: "goal"; threadId: string; objective: string };

export function buildComposerSubmission(options: {
  threadId: string;
  input: v2.UserInput[];
  mode: SubmissionMode;
  activeTurnId: string | null;
  model: string;
  effort: string;
  planMode: boolean;
  collaborationMode: CollaborationMode | null;
  goal?: string;
}): ComposerSubmissionPlan | null {
  if (options.goal !== undefined) {
    return {
      kind: "goal",
      threadId: options.threadId,
      objective: options.goal,
    };
  }

  if (options.mode === "steer") {
    return options.activeTurnId
      ? {
          kind: "steer",
          params: {
            threadId: options.threadId,
            expectedTurnId: options.activeTurnId,
            input: options.input,
          },
        }
      : null;
  }

  if (options.mode === "queue") {
    return {
      kind: "queue",
      params: { threadId: options.threadId, input: options.input },
    };
  }

  return {
    kind: "send",
    params: {
      threadId: options.threadId,
      input: options.input,
      model: options.model || null,
      effort: options.effort || null,
      ...(options.planMode && options.collaborationMode
        ? { collaborationMode: options.collaborationMode }
        : {}),
    },
  };
}

export function permissionModeSettings(mode: PermissionMode) {
  return {
    ask: {
      approvalPolicy: "on-request" as const,
      sandboxPolicy: null,
    },
    "read-only": {
      approvalPolicy: "on-request" as const,
      sandboxPolicy: { type: "readOnly" as const, networkAccess: false },
    },
    "full-access": {
      approvalPolicy: "never" as const,
      sandboxPolicy: { type: "dangerFullAccess" as const },
    },
  }[mode];
}

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
