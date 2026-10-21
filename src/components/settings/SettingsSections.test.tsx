import { describe, expect, it } from "vitest";

import { buildApprovalScope } from "../approvals/approval-model";
import { availableSubmissionModes } from "../conversation/composer-model";
import {
  DEFAULT_UI_PREFERENCES,
  updateUiPreferences,
} from "../../app/ui-preferences";

describe("settings and composer selectors", () => {
  it("only exposes steer and queue while a turn is active", () => {
    expect(availableSubmissionModes(null)).toEqual(["send"]);
    expect(availableSubmissionModes("turn-1")).toEqual([
      "send",
      "steer",
      "queue",
    ]);
  });

  it("keeps approval scope tied to the server request", () => {
    expect(
      buildApprovalScope({
        method: "item/commandExecution/requestApproval",
        id: 7,
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "item-1",
          command: "pnpm check",
          cwd: "/workspace",
        },
      } as never),
    ).toEqual({
      command: "pnpm check",
      cwd: "/workspace",
      itemId: "item-1",
      threadId: "thread-1",
      turnId: "turn-1",
    });
  });

  it("updates only presentation preferences locally", () => {
    expect(
      updateUiPreferences(DEFAULT_UI_PREFERENCES, {
        density: "compact",
        colorScheme: "dark",
        theme: { accentColor: "violet" },
      }),
    ).toMatchObject({
      density: "compact",
      colorScheme: "dark",
      theme: { accentColor: "violet" },
      version: 2,
    });
  });
});
