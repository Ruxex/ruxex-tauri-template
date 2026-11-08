// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PluginInformationItem } from "./PluginInformationItem";

describe("PluginInformationItem", () => {
  it("renders plain metadata values", () => {
    render(
      <dl>
        <PluginInformationItem label="Category" value="Developer tools" />
      </dl>,
    );

    expect(screen.getByText("Category")).toBeTruthy();
    expect(screen.getByText("Developer tools")).toBeTruthy();
  });

  it("renders linked metadata as a safe external link", () => {
    render(
      <dl>
        <PluginInformationItem
          href="https://example.com/plugin"
          label="Website"
          value="https://example.com/plugin"
        />
      </dl>,
    );

    const link = screen.getByRole("link", { name: "https://example.com/plugin" });
    expect(link.getAttribute("href")).toBe("https://example.com/plugin");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });
});
