// @vitest-environment jsdom

import { i18n } from "@/app/i18n";

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ComposerMessageInput } from "./ComposerMessageInput";

describe("ComposerMessageInput", () => {
  const originalRangeGeometry = {
    getClientRects: Object.getOwnPropertyDescriptor(Range.prototype, "getClientRects"),
    getBoundingClientRect: Object.getOwnPropertyDescriptor(Range.prototype, "getBoundingClientRect"),
  };

  beforeEach(() => {
    vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    // jsdom has no layout geometry; ProseMirror reads it while editing a selection.
    Object.defineProperties(Range.prototype, {
      getClientRects: {
        configurable: true,
        value: () => [new DOMRect(0, 0, 1, 16)],
      },
      getBoundingClientRect: {
        configurable: true,
        value: () => new DOMRect(0, 0, 1, 16),
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    for (const [name, descriptor] of Object.entries(originalRangeGeometry)) {
      if (descriptor) Object.defineProperty(Range.prototype, name, descriptor);
      else Reflect.deleteProperty(Range.prototype, name);
    }
  });

  it("provides a WYSIWYG Markdown editing surface", async () => {
    const value = "# Plan\n\n- first\n- second\n\n```ts\nconst ready = true;\n```";

    render(<ComposerMessageInput disabled={false} onChange={vi.fn()} placeholder="Write a message" value={value} />);

    await waitFor(() => {
      const editor = screen.getByRole("textbox");
      expect(editor.getAttribute("contenteditable")).toBe("true");
      expect(editor.textContent).toContain("Plan");
    });
    expect(screen.queryByRole("region", { name: "Markdown preview" })).toBeNull();
  });

  it("keeps an empty message editable", async () => {
    render(<ComposerMessageInput disabled={false} onChange={vi.fn()} placeholder="Write a message" value="" />);

    await waitFor(() => {
      expect(screen.getByRole("textbox").getAttribute("contenteditable")).toBe("true");
    });
  });
  it("updates the accessible editor name without changing its draft", async () => {
    render(
      <ComposerMessageInput disabled={false} onChange={vi.fn()} placeholder="Write a message" value="Draft content" />,
    );
    await screen.findByRole("textbox", { name: "Message" });
    await act(async () => {
      await i18n.changeLanguage("ja");
    });
    const editor = await screen.findByRole("textbox", { name: "メッセージ" });
    expect(editor.textContent).toContain("Draft content");
  });
  it("preserves draft, focus, selection and undo when the translated placeholder changes", async () => {
    function LocalizedEditor() {
      const { t } = useTranslation("conversation");
      const [value, setValue] = useState("Draft content");
      return (
        <>
          <ComposerMessageInput disabled={false} onChange={setValue} placeholder={t("askAssistant")} value={value} />
          <button type="button" onClick={() => setValue("")}>
            Clear draft
          </button>
        </>
      );
    }
    render(<LocalizedEditor />);
    const editor = await screen.findByRole("textbox", { name: "Message" });
    editor.focus();
    fireEvent.paste(editor, {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? "/edited" : ""),
        files: [],
        types: ["text/plain"],
      },
    });
    await waitFor(() => expect(editor.textContent).toBe("Draft content/edited"));
    const text = editor.querySelector("p")?.firstChild;
    expect(text).toBeTruthy();
    const selection = window.getSelection();
    expect(selection).toBeTruthy();
    const range = document.createRange();
    range.setStart(text as Text, 2);
    range.setEnd(text as Text, 6);
    selection?.removeAllRanges();
    selection?.addRange(range);
    fireEvent(document, new Event("selectionchange"));

    await act(async () => {
      await i18n.changeLanguage("ja");
    });
    expect(await screen.findByRole("textbox", { name: "メッセージ" })).toBe(editor);
    expect(editor.textContent).toBe("Draft content/edited");
    expect(document.activeElement).toBe(editor);
    expect(window.getSelection()?.anchorNode).toBe(text);
    expect(window.getSelection()?.anchorOffset).toBe(2);
    expect(window.getSelection()?.focusOffset).toBe(6);

    fireEvent.keyDown(editor, { key: "z", ctrlKey: true });
    await waitFor(() => expect(editor.textContent).toBe("Draft content"));
    fireEvent.click(screen.getByRole("button", { name: "Clear draft" }));
    await waitFor(() =>
      expect(editor.querySelector("[data-placeholder]")?.getAttribute("data-placeholder")).toBe(
        "アシスタントに作業を依頼…",
      ),
    );
  });
});
