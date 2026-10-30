// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageContainer } from "./PageContainer";

describe("PageContainer", () => {
  it("provides the shared page layout contract without changing its children", () => {
    const { container } = render(
      <PageContainer>
        <span>content</span>
      </PageContainer>,
    );

    expect(container.firstElementChild?.className).toContain("mx-auto");
    expect(container.firstElementChild?.className).toContain("w-full");
    expect(container.firstElementChild?.className).toContain("max-w-5xl");
    expect(container.firstElementChild?.className).toContain("space-y-6");
    expect(screen.getByText("content")).toBeTruthy();
  });
});
