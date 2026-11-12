// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { v2 } from "../protocol";
import { HooksPage } from "./HooksPage";

const useHooksList = vi.hoisted(() => vi.fn());

vi.mock("../app-server/hooks", () => ({ useHooksList }));

function hookResult(
  overrides: Partial<ReturnType<typeof defaultHookResult>> = {},
) {
  return { ...defaultHookResult(), ...overrides };
}

function defaultHookResult() {
  return {
    data: undefined as v2.HooksListResponse | undefined,
    error: null as unknown,
    isError: false,
    isLoading: false,
  };
}

function baseHook(
  metadata: Partial<v2.HookMetadata> &
    Pick<
      v2.HookMetadata,
      "eventName" | "handlerType" | "source" | "trustStatus"
    >,
): v2.HookMetadata {
  return {
    key: `${metadata.eventName}-${metadata.handlerType}`,
    matcher: null,
    timeoutSec: 10n,
    statusMessage: null,
    additionalContextLimit: null,
    sourcePath: "/workspace/.ruxex/hooks.json",
    pluginId: null,
    displayOrder: 0n,
    enabled: true,
    isManaged: false,
    currentHash: "hash-123",
    ...metadata,
  } as v2.HookMetadata;
}

function populatedResponse(): v2.HooksListResponse {
  return {
    data: [
      {
        cwd: "/workspace/app",
        warnings: ["Hook configuration warning"],
        errors: [
          {
            path: "/workspace/app/.ruxex/hooks.json",
            message: "Hook configuration error",
          },
        ],
        hooks: [
          baseHook({
            eventName: "preToolUse",
            handlerType: "command",
            source: "project",
            trustStatus: "untrusted",
            matcher: "Bash",
            command: "python3 /workspace/app/check.py",
            async: false,
            statusMessage: "Checking Bash command",
            pluginId: "policy-plugin",
          }),
          baseHook({
            eventName: "postToolUse",
            handlerType: "mcpTool",
            source: "plugin",
            trustStatus: "modified",
            server: "policy",
            tool: "scan_result",
            enabled: false,
            isManaged: false,
          }),
          baseHook({
            eventName: "stop",
            handlerType: "prompt",
            source: "user",
            trustStatus: "trusted",
          }),
          baseHook({
            eventName: "sessionStart",
            handlerType: "agent",
            source: "system",
            trustStatus: "managed",
            isManaged: true,
          }),
        ],
      },
      {
        cwd: "/workspace/docs",
        warnings: [],
        errors: [],
        hooks: [
          baseHook({
            eventName: "interrupt",
            handlerType: "command",
            source: "sessionFlags",
            trustStatus: "trusted",
            sourcePath: "/tmp/session-hooks.json",
          }),
        ],
      },
    ],
  };
}

describe("HooksPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useHooksList
      .mockReset()
      .mockReturnValue(hookResult({ data: populatedResponse() }));
  });

  it("shows hook groups, trust states, sources, and handler details", () => {
    render(<HooksPage />);

    expect(screen.getByRole("heading", { name: "Hooks" })).toBeTruthy();
    expect(screen.getByText("/workspace/app")).toBeTruthy();
    expect(screen.getByText("/workspace/docs")).toBeTruthy();
    expect(screen.getByText("PreToolUse")).toBeTruthy();
    expect(screen.getByText("PostToolUse")).toBeTruthy();
    expect(screen.getByText("Stop")).toBeTruthy();
    expect(screen.getByText("SessionStart")).toBeTruthy();
    expect(screen.getByText("Interrupt")).toBeTruthy();
    expect(screen.getByText("Project")).toBeTruthy();
    expect(screen.getAllByText("Plugin").length).toBeGreaterThan(0);
    expect(screen.getByText("User")).toBeTruthy();
    expect(screen.getByText("System")).toBeTruthy();
    expect(screen.getByText("Session flags")).toBeTruthy();
    expect(screen.getAllByText("Review required").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Modified — review required").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Trusted").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Managed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Enabled").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Disabled").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Command").length).toBeGreaterThan(0);
    expect(screen.getAllByText("MCP tool").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Prompt").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Agent").length).toBeGreaterThan(0);
    expect(screen.getByText("Hook configuration warning")).toBeTruthy();
    expect(screen.getByText("Hook configuration error")).toBeTruthy();
    expect(
      screen.getByText(
        /Review or edit the source configuration outside the desktop app/,
      ),
    ).toBeTruthy();
    expect(document.querySelectorAll("details")[0]?.open).toBe(false);

    const summaries = Array.from(document.querySelectorAll("summary"));
    expect(summaries).toHaveLength(5);
    fireEvent.click(summaries[0]);

    expect(screen.getByText("python3 /workspace/app/check.py")).toBeTruthy();
    expect(
      screen.getAllByText("/workspace/.ruxex/hooks.json").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Bash").length).toBeGreaterThan(0);
    expect(screen.getByText("policy-plugin")).toBeTruthy();

    fireEvent.click(summaries[1]);
    expect(screen.getByText("policy · scan_result")).toBeTruthy();
  });

  it("shows an empty state when no hooks are configured", () => {
    useHooksList.mockReturnValue(hookResult({ data: { data: [] } }));

    render(<HooksPage />);

    expect(screen.getByText("No hooks configured.")).toBeTruthy();
  });

  it("shows an error when the hook catalog cannot be loaded", () => {
    useHooksList.mockReturnValue(
      hookResult({ isError: true, error: new Error("socket closed") }),
    );

    render(<HooksPage />);

    expect(screen.getByRole("alert").textContent).toContain(
      "Unable to load hooks:",
    );
  });

  it("shows a loading state while the hook catalog is pending", () => {
    useHooksList.mockReturnValue(hookResult({ isLoading: true }));

    render(<HooksPage />);

    expect(screen.getByLabelText("Loading hooks")).toBeTruthy();
  });
});
