// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComposerMessageInput } from "./ComposerMessageInput";

describe("ComposerMessageInput", () => {
  afterEach(cleanup);

  it("provides a WYSIWYG Markdown editing surface", async () => {
    const value =
      "# Plan\n\n- first\n- second\n\n```ts\nconst ready = true;\n```";

    render(
      <ComposerMessageInput
        disabled={false}
        onChange={vi.fn()}
        placeholder="Write a message"
        value={value}
      />,
    );

    await waitFor(() => {
      const editor = screen.getByRole("textbox");
      expect(editor.getAttribute("contenteditable")).toBe("true");
      expect(editor.textContent).toContain("Plan");
    });
    expect(
      screen.queryByRole("region", { name: "Markdown preview" }),
    ).toBeNull();
  });

  it("keeps an empty message editable", async () => {
    render(
      <ComposerMessageInput
        disabled={false}
        onChange={vi.fn()}
        placeholder="Write a message"
        value=""
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("textbox").getAttribute("contenteditable")).toBe(
        "true",
      );
    });
  });
});
