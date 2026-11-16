// @vitest-environment jsdom

import { act, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { i18n } from "../../app/i18n";
import { ExecutionStatusIcon } from "./ExecutionStatusIcon";
import {
  ExecutionStatusSummary,
  ExitCodeDisplay,
} from "./ExecutionStatusSummary";

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

  it("uses the supplied subject in the accessible status label", () => {
    render(<ExecutionStatusIcon status="inProgress" subject="MCP tool" />);

    expect(screen.getByRole("img", { name: "MCP tool running" })).toBeTruthy();
  });

  it("shows exit code zero as text without an icon", () => {
    const { container } = render(<ExitCodeDisplay exitCode="0" />);

    expect(container.textContent).toContain("0");
    expect(screen.queryByText("Exit code: 0")).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("does not duplicate a completed status with a zero exit code", () => {
    const { container } = render(
      <ExecutionStatusSummary exitCode="0" status="completed" />,
    );

    expect(container.querySelectorAll('[role="img"]')).toHaveLength(1);
    expect(
      container.querySelector('[aria-label="Command completed"]'),
    ).toBeTruthy();
    expect(container.textContent).toContain("0");
  });

  it("shows a red error icon and the non-zero exit code", () => {
    const { container } = render(<ExitCodeDisplay exitCode="1" />);

    const status = screen.getByRole("img", {
      name: "Command exited with code 1",
    });
    expect(status.className).toContain("text-error");
    expect(container.textContent).toContain("1");
    expect(screen.queryByText("Exit code: 1")).toBeNull();
  });

  it("renders nothing when no status or exit code is available", () => {
    const { container } = render(<ExecutionStatusSummary />);

    expect(container.firstChild).toBeNull();
  });
  it("updates the default command subject in a standalone summary when language changes", async () => {
    const { container } = render(<ExecutionStatusSummary status="completed" />);
    const summary = within(container);
    expect(
      summary.getByRole("img", { name: "Command completed" }),
    ).toBeTruthy();
    await act(async () => {
      await i18n.changeLanguage("ja");
    });
    expect(summary.getByRole("img", { name: "コマンドが完了" })).toBeTruthy();
  });
  it.each([
    ["declined", "拒否"],
    ["interrupted", "中断"],
    ["future-status", "future-status"],
  ])(
    "localizes known Japanese execution status %s and retains unknown values",
    async (status, label) => {
      await i18n.changeLanguage("ja");
      const { container } = render(<ExecutionStatusIcon status={status} />);
      const icon = within(container).getByRole("img", {
        name: `コマンドの状態: ${label}`,
      });
      expect(icon.getAttribute("title")).toBe(`コマンドの状態: ${label}`);
      expect(icon.className).toContain("text-warning");
    },
  );
});
