import { describe, expect, it } from "vitest";

import {
  availableSubmissionModes,
  buildImageUserInput,
  submissionModeLabel,
} from "./composer-model";

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
