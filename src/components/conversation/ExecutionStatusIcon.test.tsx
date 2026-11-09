// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExecutionStatusIcon } from "./ExecutionStatusIcon";

describe("ExecutionStatusIcon", () => {
  it("centers a high-contrast spinner while the command is running", () => {
    const { container } = render(<ExecutionStatusIcon status="inProgress" />);

    const status = screen.getByRole("img", { name: "Command running" });
    expect(status.className).toContain("inline-flex");
    expect(status.className).toContain("items-center");
    expect(status.className).toContain("justify-center");
    expect(status.className).toContain("text-primary");
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("uses a green check for completed status", () => {
    const { container } = render(<ExecutionStatusIcon status="completed" />);

    const status = screen.getByRole("img", { name: "Command completed" });
    expect(status.className).toContain("text-success");
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it.each([
    ["failed", "Command failed"],
    ["unexpected", "Command status: unexpected"],
  ])("uses a yellow warning for %s status", (statusValue, label) => {
    render(<ExecutionStatusIcon status={statusValue} />);

    const status = screen.getByRole("img", { name: label });
    expect(status.className).toContain("text-warning");
  });

  it("uses only a green success icon for exit code zero", () => {
    const { container } = render(<ExecutionStatusIcon exitCode="0" />);

    const status = screen.getByRole("img", {
      name: "Command exited successfully",
    });
    expect(status.className).toContain("text-success");
    expect(screen.queryByText("Exit code: 0")).toBeNull();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("does not duplicate a completed status with a zero exit code", () => {
    const { container } = render(
      <ExecutionStatusIcon exitCode="0" status="completed" />,
    );

    expect(container.querySelectorAll('[role="img"]')).toHaveLength(1);
    expect(
      container.querySelector('[aria-label="Command completed"]'),
    ).toBeTruthy();
  });

  it("shows a red error icon and the non-zero exit code", () => {
    render(<ExecutionStatusIcon exitCode="1" />);

    const status = screen.getByRole("img", {
      name: "Command exited with code 1",
    });
    expect(status.className).toContain("text-error");
    expect(screen.getByText("Exit code: 1")).toBeTruthy();
  });

  it("renders nothing when no status or exit code is available", () => {
    const { container } = render(<ExecutionStatusIcon />);

    expect(container.firstChild).toBeNull();
  });
});
