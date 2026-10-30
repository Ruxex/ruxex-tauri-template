// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StateBadge } from "./StateBadge";

describe("StateBadge", () => {
  it("uses DaisyUI outline variants for semantic states", () => {
    render(
      <>
        <StateBadge tone="success">Connected</StateBadge>
        <StateBadge tone="neutral">Unknown</StateBadge>
      </>,
    );

    expect(screen.getByText("Connected").className).toContain("badge-outline");
    expect(screen.getByText("Connected").className).toContain("badge-success");
    expect(screen.getByText("Unknown").className).toContain("badge-outline");
    expect(screen.getByText("Unknown").className).toContain("badge-neutral");
    expect(screen.getByText("Unknown").className).not.toContain("badge-ghost");
  });
});
