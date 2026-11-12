// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownContent } from "./MarkdownContent";

describe("MarkdownContent", () => {
  it("animates streamed Markdown without requiring a text diff", () => {
    render(
      <MarkdownContent isAnimating text="A streamed assistant response" />,
    );

    expect(document.querySelector("[data-sd-animate]")).toBeTruthy();
  });

  it("defines the desktop selection policy and content exception", () => {
    const styles = readFileSync(
      resolve(process.cwd(), "src/styles/index.css"),
      "utf8",
    );

    expect(styles).toContain("user-select: none");
    expect(styles).toContain(".selectable-content");
    expect(styles).toMatch(/input[^}]*user-select: text/s);
    expect(styles).toMatch(/textarea[^}]*user-select: text/s);
  });

  it("renders headings, emphasis, inline code, and links as structured content", () => {
    render(
      <MarkdownContent
        text={
          "# Result\n\n**Ready** with `pnpm test` — [docs](https://example.com/docs)"
        }
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Result", level: 1 }),
    ).toBeTruthy();
    const content = screen
      .getByRole("heading", { name: "Result", level: 1 })
      .closest("[data-chat-content]");
    expect(content).toBeTruthy();
    expect(content?.className.split(/\s+/)).toContain("selectable-content");
    expect(screen.getByText("Ready").getAttribute("data-streamdown")).toBe(
      "strong",
    );
    expect(screen.getByText("pnpm test").tagName).toBe("CODE");
    expect(
      screen.getByRole("link", { name: "docs" }).getAttribute("href"),
    ).toBe("https://example.com/docs");
  });

  it("renders lists and fenced code without interpreting code as markup", () => {
    render(
      <MarkdownContent
        text={
          '- first\n- second\n\n```rust\nfn main() { println!("hi"); }\n```'
        }
      />,
    );

    expect(screen.getByRole("list").textContent).toContain("first");
    expect(screen.getByRole("list").textContent).toContain("second");
    expect(screen.getByText('fn main() { println!("hi"); }')).toBeTruthy();
  });

  it("renders diff code blocks while preserving their exact text", () => {
    render(
      <MarkdownContent text={"```diff\n+added\n-removed\n context\n```"} />,
    );

    const codeBlock = screen.getByTestId("diff-added").closest("code");
    expect(codeBlock).toBeTruthy();
    expect(codeBlock?.textContent).toContain("+added");
    expect(codeBlock?.textContent).toContain("-removed");
    expect(codeBlock?.textContent).toContain(" context");
  });

  it("renders Mermaid fences as diagrams", async () => {
    render(
      <MarkdownContent
        text={"```mermaid\ngraph TD\n  A[Start] --> B[End]\n```"}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-streamdown="mermaid"]')).toBeTruthy();
    });
  });
});
