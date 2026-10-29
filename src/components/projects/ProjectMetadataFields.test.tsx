// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PROJECT_METADATA } from "./project-metadata";
import { ProjectMetadataFields } from "./ProjectMetadataFields";

describe("ProjectMetadataFields", () => {
  afterEach(() => {
    cleanup();
  });

  it("starts with compact icon and color controls", () => {
    render(
      <ProjectMetadataFields
        value={DEFAULT_PROJECT_METADATA}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Project icon: Folder" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Project color: Blue" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("group", { name: "Project icon options" }),
    ).toBeNull();
    expect(
      screen.queryByRole("group", { name: "Project color options" }),
    ).toBeNull();
  });

  it("opens one selector at a time", () => {
    render(
      <ProjectMetadataFields
        value={DEFAULT_PROJECT_METADATA}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Project icon: Folder" }),
    );
    expect(
      screen.getByRole("group", { name: "Project icon options" }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Project color: Blue" }),
    );
    expect(
      screen.queryByRole("group", { name: "Project icon options" }),
    ).toBeNull();
    expect(
      screen.getByRole("group", { name: "Project color options" }),
    ).toBeTruthy();
  });

  it("updates the selected icon and closes its options", () => {
    const onChange = vi.fn();
    render(
      <ProjectMetadataFields
        value={DEFAULT_PROJECT_METADATA}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Project icon: Folder" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Code" }));

    expect(onChange).toHaveBeenCalledWith({ icon: "code", color: "blue" });
    expect(
      screen.queryByRole("group", { name: "Project icon options" }),
    ).toBeNull();
  });

  it("updates the selected color and closes its options", () => {
    const onChange = vi.fn();
    render(
      <ProjectMetadataFields
        value={DEFAULT_PROJECT_METADATA}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Project color: Blue" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Violet" }));

    expect(onChange).toHaveBeenCalledWith({ icon: "folder", color: "violet" });
    expect(
      screen.queryByRole("group", { name: "Project color options" }),
    ).toBeNull();
  });

  it("closes the active options on outside pointer or Escape", () => {
    render(
      <ProjectMetadataFields
        value={DEFAULT_PROJECT_METADATA}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Project icon: Folder" }),
    );
    fireEvent.pointerDown(document.body);
    expect(
      screen.queryByRole("group", { name: "Project icon options" }),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Project color: Blue" }),
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("group", { name: "Project color options" }),
    ).toBeNull();
  });

  it("returns focus to the trigger after closing with Escape", () => {
    render(
      <ProjectMetadataFields
        value={DEFAULT_PROJECT_METADATA}
        onChange={vi.fn()}
      />,
    );

    const colorTrigger = screen.getByRole("button", {
      name: "Project color: Blue",
    });
    fireEvent.click(colorTrigger);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(document.activeElement).toBe(colorTrigger);
  });
});
