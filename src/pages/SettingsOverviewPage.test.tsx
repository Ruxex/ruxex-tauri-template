// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readQuickPanelShortcut = vi.hoisted(() => vi.fn());
const updateQuickPanelShortcut = vi.hoisted(() => vi.fn());
const openQuickPanel = vi.hoisted(() => vi.fn());

vi.mock("../platform/native", () => ({
  readQuickPanelShortcut,
  updateQuickPanelShortcut,
  openQuickPanel,
}));

import { UiPreferencesProvider } from "../app/ui-preferences";
import { SettingsOverviewPage } from "./SettingsOverviewPage";

function renderPage() {
  return render(
    <UiPreferencesProvider>
      <SettingsOverviewPage />
    </UiPreferencesProvider>,
  );
}

describe("SettingsOverviewPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.localStorage.clear();
    readQuickPanelShortcut.mockReset();
    updateQuickPanelShortcut.mockReset();
    openQuickPanel.mockReset();
    readQuickPanelShortcut.mockResolvedValue({
      shortcut: "CmdOrCtrl+Alt+R",
      defaultShortcut: "CmdOrCtrl+Shift+Space",
    });
    updateQuickPanelShortcut.mockImplementation(async (shortcut: string) => ({
      shortcut,
      defaultShortcut: "CmdOrCtrl+Shift+Space",
    }));
  });

  it("opens the quick panel directly from settings", async () => {
    renderPage();

    await screen.findByRole("textbox", {
      name: "Quick panel shortcut",
    });
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    await waitFor(() => expect(openQuickPanel).toHaveBeenCalledOnce());
  });

  it("loads the native shortcut and saves a new value", async () => {
    renderPage();

    const input = await screen.findByRole("textbox", {
      name: "Quick panel shortcut",
    });
    expect(input).toHaveProperty("value", "CmdOrCtrl+Alt+R");

    fireEvent.keyDown(input, {
      code: "KeyT",
      ctrlKey: true,
      key: "t",
      altKey: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateQuickPanelShortcut).toHaveBeenCalledWith(
        "CmdOrCtrl+Alt+T",
      ),
    );
    expect(input).toHaveProperty("value", "CmdOrCtrl+Alt+T");
  });

  it("records a shortcut from the keys the user presses", async () => {
    renderPage();
    const input = await screen.findByRole("textbox", {
      name: "Quick panel shortcut",
    });

    expect(input).toHaveProperty("readOnly", true);
    fireEvent.keyDown(input, {
      code: "KeyP",
      ctrlKey: true,
      key: "p",
      shiftKey: true,
    });

    expect(input).toHaveProperty("value", "CmdOrCtrl+Shift+P");
  });

  it("resets the shortcut to the native default", async () => {
    renderPage();
    const input = await screen.findByRole("textbox", {
      name: "Quick panel shortcut",
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    await waitFor(() =>
      expect(updateQuickPanelShortcut).toHaveBeenCalledWith(
        "CmdOrCtrl+Shift+Space",
      ),
    );
    expect(input).toHaveProperty("value", "CmdOrCtrl+Shift+Space");
  });

  it("disables actions while saving and surfaces native errors", async () => {
    let resolveUpdate: (value: unknown) => void = () => undefined;
    updateQuickPanelShortcut.mockImplementationOnce(
      () => new Promise((resolve) => (resolveUpdate = resolve)),
    );
    renderPage();
    const input = await screen.findByRole("textbox", {
      name: "Quick panel shortcut",
    });

    fireEvent.keyDown(input, {
      code: "KeyT",
      ctrlKey: true,
      key: "t",
      altKey: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toHaveProperty(
      "disabled",
      true,
    );
    resolveUpdate({
      shortcut: "CmdOrCtrl+Alt+T",
      defaultShortcut: "CmdOrCtrl+Shift+Space",
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).toHaveProperty(
        "disabled",
        false,
      ),
    );

    updateQuickPanelShortcut.mockRejectedValueOnce(
      new Error("Shortcut is already in use."),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Shortcut is already in use.",
    );
  });
});
