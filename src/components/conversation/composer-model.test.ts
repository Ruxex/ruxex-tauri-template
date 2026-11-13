import { describe, expect, it } from "vitest";

import {
  availableSubmissionModes,
  buildImageUserInput,
  buildComposerSubmission,
  isComposerSubmitShortcut,
  permissionModeSettings,
  submissionModeLabel,
} from "./composer-model";

function keyboardEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    altKey: false,
    ctrlKey: false,
    key: "Enter",
    metaKey: false,
    nativeEvent: { isComposing: false },
    shiftKey: false,
    ...overrides,
  } as KeyboardEvent;
}

describe("composer model", () => {
  it("allows only send before a turn is active", () => {
    expect(availableSubmissionModes(null)).toEqual(["send"]);
  });

  it("allows send, steer, and queue during an active turn", () => {
    expect(availableSubmissionModes("turn-1")).toEqual([
      "send",
      "steer",
      "queue",
    ]);
  });

  it("uses explicit labels for every submission mode", () => {
    expect(submissionModeLabel("send")).toBe("Send");
    expect(submissionModeLabel("steer")).toBe("Steer active turn");
    expect(submissionModeLabel("queue")).toBe("Queue next message");
  });

  it("builds an image user input without leaking local File objects into the protocol", () => {
    expect(buildImageUserInput("data:image/png;base64,AA==")).toEqual({
      type: "image",
      url: "data:image/png;base64,AA==",
    });
  });

  it("builds the requested mutation plan for send, queue, steer, and goals", () => {
    const input = [{ type: "text" as const, text: "hello", text_elements: [] }];
    const collaborationMode = {
      mode: "plan" as const,
      settings: {
        model: "model-a",
        reasoning_effort: "high",
        developer_instructions: null,
      },
    };

    expect(
      buildComposerSubmission({
        threadId: "thread-1",
        input: [...input],
        mode: "send",
        activeTurnId: null,
        model: "model-a",
        effort: "high",
        planMode: true,
        collaborationMode,
      }),
    ).toEqual({
      kind: "send",
      params: {
        threadId: "thread-1",
        input: [...input],
        model: "model-a",
        effort: "high",
        collaborationMode,
      },
    });
    expect(
      buildComposerSubmission({
        threadId: "thread-1",
        input: [...input],
        mode: "queue",
        activeTurnId: "turn-1",
        model: "model-a",
        effort: "high",
        planMode: true,
        collaborationMode,
      }),
    ).toEqual({
      kind: "queue",
      params: { threadId: "thread-1", input: [...input] },
    });
    expect(
      buildComposerSubmission({
        threadId: "thread-1",
        input: [...input],
        mode: "steer",
        activeTurnId: "turn-1",
        model: "model-a",
        effort: "high",
        planMode: false,
        collaborationMode: null,
      }),
    ).toEqual({
      kind: "steer",
      params: {
        threadId: "thread-1",
        expectedTurnId: "turn-1",
        input: [...input],
      },
    });
    expect(
      buildComposerSubmission({
        threadId: "thread-1",
        input: [...input],
        mode: "steer",
        activeTurnId: null,
        model: "model-a",
        effort: "high",
        planMode: false,
        collaborationMode: null,
      }),
    ).toBeNull();
    expect(
      buildComposerSubmission({
        threadId: "thread-1",
        input: [...input],
        mode: "send",
        activeTurnId: null,
        model: "model-a",
        effort: "high",
        planMode: true,
        collaborationMode,
        goal: "ship this",
      }),
    ).toEqual({ kind: "goal", threadId: "thread-1", objective: "ship this" });
  });

  it("maps each permission mode to its server settings", () => {
    expect(permissionModeSettings("ask")).toEqual({
      approvalPolicy: "on-request",
      sandboxPolicy: null,
    });
    expect(permissionModeSettings("read-only")).toEqual({
      approvalPolicy: "on-request",
      sandboxPolicy: { type: "readOnly", networkAccess: false },
    });
    expect(permissionModeSettings("full-access")).toEqual({
      approvalPolicy: "never",
      sandboxPolicy: { type: "dangerFullAccess" },
    });
  });
});

describe("isComposerSubmitShortcut", () => {
  it.each([
    ["Ctrl+Enter", { ctrlKey: true }, true],
    ["Enter", {}, false],
    ["Shift+Enter", { shiftKey: true }, false],
    ["Ctrl+Shift+Enter", { ctrlKey: true, shiftKey: true }, false],
    [
      "composing Ctrl+Enter",
      { ctrlKey: true, nativeEvent: { isComposing: true } },
      false,
    ],
    [
      "native composing Ctrl+Enter",
      { ctrlKey: true, isComposing: true },
      false,
    ],
  ] as const)("handles %s", (_label, event, expected) => {
    expect(isComposerSubmitShortcut(keyboardEvent(event))).toBe(expected);
  });
});
