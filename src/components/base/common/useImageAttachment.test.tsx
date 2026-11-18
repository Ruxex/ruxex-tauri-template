// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import type { ChangeEvent } from "react";
import { afterEach, expect, it } from "vitest";

import { i18n } from "@/app/i18n";
import { useImageAttachment } from "./useImageAttachment";

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
});

it("updates an existing invalid-attachment error when Japanese is selected", async () => {
  const { result } = renderHook(useImageAttachment);
  const input = document.createElement("input");
  Object.defineProperty(input, "files", {
    value: [new File(["plain"], "note.txt", { type: "text/plain" })],
  });
  act(() =>
    result.current.handleAttachmentChange({
      target: input,
    } as ChangeEvent<HTMLInputElement>),
  );
  expect(result.current.attachmentError).toBe("Only image attachments are supported.");
  await act(() => i18n.changeLanguage("ja"));
  expect(result.current.attachmentError).toBe("添付できるのは画像のみです。");
  act(() => result.current.resetAttachment());
  expect(result.current.attachmentError).toBeNull();
});
