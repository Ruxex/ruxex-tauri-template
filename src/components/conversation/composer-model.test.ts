import { describe, expect, it } from "vitest";

import {
  availableSubmissionModes,
  buildImageUserInput,
  isComposerSubmitShortcut,
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
