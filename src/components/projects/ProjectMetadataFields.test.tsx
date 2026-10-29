// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PROJECT_METADATA } from "./project-metadata";
import { ProjectMetadataFields } from "./ProjectMetadataFields";

describe("ProjectMetadataFields", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders icon choices as a compact grid of actual icon buttons", () => {
    render(
      <ProjectMetadataFields
        value={DEFAULT_PROJECT_METADATA}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("combobox", { name: "Project icon" })).toBeNull();
    const iconGroup = screen.getByRole("group", { name: "Project icon" });
    expect(iconGroup.className.split(/\s+/)).toContain("grid-cols-4");

    const folderButton = screen.getByRole("button", { name: "Folder" });
    expect(folderButton.textContent?.trim()).toBe("");
    expect(folderButton.querySelector("svg")).toBeTruthy();
    expect(folderButton.getAttribute("aria-pressed")).toBe("true");
  });

  it("updates the selected icon without rendering option text", () => {
    const onChange = vi.fn();
    render(
      <ProjectMetadataFields
        value={DEFAULT_PROJECT_METADATA}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Code" }));

    expect(onChange).toHaveBeenCalledWith({ icon: "code", color: "blue" });
    expect(screen.queryByText("Folder")).toBeNull();
    expect(screen.queryByText("Code")).toBeNull();
  });
});
