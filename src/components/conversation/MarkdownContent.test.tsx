// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownContent } from "./MarkdownContent";

describe("MarkdownContent", () => {
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
    expect(screen.getByText("Ready").tagName).toBe("STRONG");
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

    expect(screen.getByRole("list").textContent).toBe("firstsecond");
    expect(screen.getByTestId("fenced-code").textContent).toContain(
      'fn main() { println!("hi"); }',
    );
  });

  it("marks added and removed diff lines while preserving their exact text", () => {
    render(
      <MarkdownContent text={"```diff\n+added\n-removed\n context\n```"} />,
    );

    expect(screen.getByTestId("diff-added").textContent).toContain("+added");
    expect(screen.getByTestId("diff-removed").textContent).toContain(
      "-removed",
    );
    expect(screen.getByTestId("diff-context").textContent).toContain(
      " context",
    );
  });
});
