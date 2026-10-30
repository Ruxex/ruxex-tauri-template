// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { CheckIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { describe, expect, it } from "vitest";

import { StateBadge } from "./StateBadge";

describe("StateBadge", () => {
  it("renders plain text with a tone-colored icon", () => {
    render(
      <>
        <StateBadge icon={CheckIcon} tone="success">
          Connected
        </StateBadge>
        <StateBadge icon={InformationCircleIcon} tone="neutral">
          Unknown
        </StateBadge>
      </>,
    );

    const connected = screen.getByText("Connected");
    const unknown = screen.getByText("Unknown");
    expect(connected.className).toContain("inline-flex");
    expect(connected.className).not.toContain("badge");
    expect(connected.querySelector("svg")?.getAttribute("class")).toContain(
      "text-success",
    );
    expect(unknown.className).not.toContain("badge");
    expect(unknown.querySelector("svg")?.getAttribute("class")).toContain(
      "text-base-content/60",
    );
  });
});
