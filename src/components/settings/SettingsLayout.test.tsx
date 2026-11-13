// @vitest-environment jsdom

import { BellIcon } from "@heroicons/react/24/outline";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UI_NOTIFICATION_SOUND_OPTIONS } from "../../app/ui-preferences";
import {
  AppServerCard,
  CapabilitiesCard,
  LanguageCard,
  NotificationsCard,
  RuntimeSummary,
  SettingsPanel,
  TypographyCard,
  UiPreferencesCard,
} from "./SettingsCards";

describe("settings card layout", () => {
  afterEach(cleanup);

  it("aligns key-value values to the right of their keys", () => {
    render(
      <AppServerCard
        appServerReady
        connected
        isAvailable={false}
        isFetching={false}
        isPending={false}
        isRefreshing={false}
        isUpdatePending={false}
        onReconnect={vi.fn()}
        onRefresh={vi.fn()}
        onUpdate={vi.fn()}
        resynchronizing={false}
        onAction={vi.fn()}
        mode="inprocess"
      />,
    );

    const statusRow = screen.getByText("Status").parentElement;
    expect(statusRow?.className).toContain(
      "grid-cols-[minmax(0,1fr)_minmax(12rem,40%)]",
    );
    expect(statusRow?.querySelector("dd")?.className).toContain("text-right");
    expect(
      screen.getByText("Connected").querySelector("svg")?.getAttribute("class"),
    ).toContain("text-success");
    expect(
      screen
        .getByText("Synchronized")
        .querySelector("svg")
        ?.getAttribute("class"),
    ).toContain("text-success");
    expect(
      screen
        .getByText("Running in this process")
        .querySelector("svg")
        ?.getAttribute("class"),
    ).toContain("text-success");
  });

  it("separates rows inside each settings panel", () => {
    render(
      <AppServerCard
        appServerReady
        connected
        isAvailable={false}
        isFetching={false}
        isPending={false}
        isRefreshing={false}
        isUpdatePending={false}
        onReconnect={vi.fn()}
        onRefresh={vi.fn()}
        onUpdate={vi.fn()}
        resynchronizing={false}
        onAction={vi.fn()}
        mode="inprocess"
      />,
    );

    const connectionPanel = screen
      .getByRole("heading", { name: "App Server" })
      .closest("section");

    expect(connectionPanel?.className).toContain("overflow-visible");
    expect(connectionPanel?.querySelector("dl")?.className).toContain(
      "divide-y",
    );
  });

  it("groups app server controls with distinct semantic variants", () => {
    const onAction = vi.fn();
    render(
      <AppServerCard
        appServerReady
        connected
        daemon={{
          status: "running",
          pid: 123,
          managedRuxexPath: "/tmp/ruxex",
          socketPath: "/tmp/app.sock",
        }}
        isAvailable
        isFetching={false}
        isPending={false}
        isRefreshing={false}
        isUpdatePending={false}
        mode="daemon"
        onAction={onAction}
        onReconnect={vi.fn()}
        onRefresh={vi.fn()}
        onUpdate={vi.fn()}
        resynchronizing={false}
      />,
    );

    const reconnect = screen.getByRole("button", { name: "Reconnect" });
    const actionRow = reconnect.parentElement;

    expect(actionRow?.className).toContain("flex-wrap");
    expect(actionRow?.querySelectorAll("button")).toHaveLength(5);
    expect(reconnect.className).toContain("btn-outline");
    const refresh = screen.getByRole("button", { name: "Refresh" });
    expect(refresh.textContent).toBe("");
    expect(refresh.className).toContain("btn-square");
    expect(
      within(
        screen.getByRole("heading", { name: "App Server" })
          .parentElement as HTMLElement,
      ).getByRole("button", { name: "Refresh" }),
    ).toBe(refresh);
    expect(screen.getByRole("button", { name: "Restart" }).className).toContain(
      "btn-outline",
    );
    expect(screen.getByRole("button", { name: "Stop" }).className).toContain(
      "btn-outline",
    );
    expect(screen.queryByRole("button", { name: "Force stop" })).toBeNull();
    const stopOptions = screen.getByLabelText("Stop options");
    expect(stopOptions.className).toContain("btn-outline");
    fireEvent.click(stopOptions);
    const forceStopOption = screen.getByRole("menuitemradio", {
      name: "Force stop",
    });
    fireEvent.click(forceStopOption);
    expect(onAction).not.toHaveBeenCalled();
    const forceStopButton = screen.getByRole("button", { name: "Force stop" });
    fireEvent.click(forceStopButton);
    expect(onAction).not.toHaveBeenCalled();
    const confirmation = screen.getByRole("dialog", {
      name: "Force stop App Server?",
    });
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Force stop" }),
    );
    expect(onAction).toHaveBeenCalledWith("forceStop");
    expect(screen.getByText("Running")).toBeTruthy();
  });

  it("shows only Start when the daemon is not running", () => {
    render(
      <AppServerCard
        appServerReady
        connected={false}
        daemon={{
          status: "notRunning",
          managedRuxexPath: "/tmp/ruxex",
          socketPath: "/tmp/app.sock",
        }}
        isAvailable
        isFetching={false}
        isPending={false}
        isRefreshing={false}
        isUpdatePending={false}
        mode="daemon"
        onAction={vi.fn()}
        onReconnect={vi.fn()}
        onRefresh={vi.fn()}
        onUpdate={vi.fn()}
        resynchronizing={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
    for (const name of ["Reconnect", "Restart", "Stop"]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
  });

  it("shows progress and disables app server actions while one is running", () => {
    render(
      <AppServerCard
        appServerReady
        connected
        daemon={{
          status: "running",
          managedRuxexPath: "/tmp/ruxex",
          socketPath: "/tmp/app.sock",
        }}
        isAvailable
        isFetching={false}
        isPending
        isRefreshing={false}
        isUpdatePending={false}
        mode="daemon"
        onAction={vi.fn()}
        onReconnect={vi.fn()}
        onRefresh={vi.fn()}
        onUpdate={vi.fn()}
        resynchronizing={false}
      />,
    );

    for (const name of ["Reconnect", "Refresh", "Restart", "Stop"]) {
      expect(screen.getByRole("button", { name })).toHaveProperty(
        "disabled",
        true,
      );
    }
    expect(
      screen.getByLabelText("Stop options").getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("groups runtime summaries into a single panel", () => {
    render(
      <RuntimeSummary
        modelCount={3}
        permissionCount={2}
        rateLimitName="Standard"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Runtime summary" }),
    ).toBeTruthy();
  });

  it("expands the model summary to show model information", () => {
    render(
      <RuntimeSummary
        modelCount={1}
        models={[
          {
            id: "model-1",
            model: "catalog-model",
            displayName: "Catalog model",
            description: "A test model",
            inputModalities: ["text"],
            supportedReasoningEfforts: [],
          } as never,
        ]}
        permissionCount={0}
        rateLimitName="Standard"
      />,
    );

    const models = screen.getByText("1 available");
    const modelDetails = models.closest("details");
    expect(modelDetails?.open).toBe(false);
    fireEvent.click(models);
    expect(modelDetails?.open).toBe(true);
    expect(screen.getByText("Catalog model")).toBeTruthy();
    expect(screen.getByText("catalog-model")).toBeTruthy();
    expect(screen.getByText("A test model")).toBeTruthy();
  });

  it("keeps settings summary cards in one vertical column", () => {
    render(
      <RuntimeSummary
        modelCount={3}
        permissionCount={2}
        rateLimitName="Standard"
      />,
    );

    expect(
      screen.getByText("Models").closest("section")?.className,
    ).not.toMatch(/(?:^| )(?:sm|md|lg):grid-cols-/);
  });

  it("uses a compact responsive key-value grid for capabilities", () => {
    render(
      <>
        <CapabilitiesCard
          capabilities={{ browser: true, shell: false, native: "Unsupported" }}
        />
        <UiPreferencesCard onThemePresetChange={vi.fn()} preset="system" />
        <TypographyCard
          chatFontFamily="system-ui"
          onChatFontSizeChange={vi.fn()}
          onChatFontFamilyChange={vi.fn()}
          onReset={vi.fn()}
          onUiFontFamilyChange={vi.fn()}
          onUiFontSizeChange={vi.fn()}
          onUiZoomChange={vi.fn()}
          chatFontSize={16}
          uiFontFamily="system-ui"
          uiFontSize={16}
          uiZoom={100}
        />
      </>,
    );

    const capabilitiesPanel = screen
      .getByRole("heading", { name: "Capabilities" })
      .closest("section");
    const capabilitiesGrid = capabilitiesPanel?.querySelector("dl");
    expect(capabilitiesGrid?.className).toContain("grid");
    expect(capabilitiesGrid?.className).toContain("sm:grid-cols-2");
    expect(capabilitiesGrid?.className).toContain("xl:grid-cols-3");
    expect(capabilitiesGrid?.firstElementChild?.className).toContain(
      "grid-cols-[minmax(0,1fr)_auto]",
    );
    expect(screen.queryByText("Color mode")).toBeNull();
    expect(screen.getByRole("heading", { name: "Interface" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Typography" })).toBeTruthy();
    expect(screen.getByLabelText("Chat font size")).toBeTruthy();
    expect(screen.getByLabelText("UI font size")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Enabled" })).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Disabled" })).toBeNull();
    expect(
      screen.getByRole("status", { name: "Enabled" }).className,
    ).not.toContain("badge");
    for (const unsupported of screen.getAllByRole("status", {
      name: "Unsupported",
    })) {
      expect(unsupported.className).toContain("text-base-content/50");
    }
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.getAllByRole("status", { name: "Unsupported" })).toHaveLength(
      2,
    );
    expect(screen.queryByText("Show project sidebar")).toBeNull();
    expect(screen.queryByText("Show context drawer")).toBeNull();
  });

  it("humanizes provider capability keys", () => {
    render(
      <CapabilitiesCard
        capabilities={{ apiKeyModelDiscovery: true, namespaceTools: false }}
      />,
    );

    expect(screen.getByText("API key model discovery")).toBeTruthy();
    expect(screen.getByText("Namespace tools")).toBeTruthy();
    expect(screen.queryByText("apiKeyModelDiscovery")).toBeNull();
  });

  it("offers built-in theme presets as realistic preview cards", () => {
    const onThemePresetChange = vi.fn();
    render(
      <UiPreferencesCard
        onThemePresetChange={onThemePresetChange}
        preset="system"
      />,
    );

    const interfacePanel = screen
      .getByRole("heading", { name: "Interface" })
      .closest("section");
    expect(interfacePanel?.className).toContain("overflow-visible");
    const presetSelector = screen.getByTestId(
      "theme-preset-selector",
    ) as HTMLDetailsElement;
    expect(presetSelector.className).toContain("relative");
    expect(presetSelector.className).toContain("z-50");
    expect(presetSelector.open).toBe(false);
    expect(
      presetSelector.querySelector("[data-theme-preview-panel]"),
    ).toBeTruthy();
    fireEvent.click(presetSelector.querySelector("summary") as HTMLElement);

    const presetGrid = within(presetSelector).getByRole("group", {
      name: "Theme preset options",
    });
    const presetPopover = presetGrid.parentElement;
    expect(presetPopover?.className).toContain("absolute");
    expect(presetPopover?.className).toContain("top-full");
    expect(presetPopover?.className).toContain("z-[60]");
    expect(presetGrid.className).toContain("sm:grid-cols-3");
    expect(
      within(presetGrid).getByText(
        "Theme palettes are inspired by third-party projects. Ruxex is not affiliated with or endorsed by those projects.",
      ),
    ).toBeTruthy();
    expect(within(presetGrid).getAllByRole("button")).toHaveLength(15);
    expect(
      within(presetGrid)
        .getByRole("button", { name: "GitHub Dark" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    expect(within(presetGrid).getByText("GitHub Dark")).toBeTruthy();
    expect(
      within(presetGrid)
        .getByRole("button", { name: "System" })
        .querySelector("[data-theme-preview-panel]"),
    ).toBeTruthy();
    expect(
      within(presetGrid)
        .getByRole("button", { name: "System" })
        .querySelector("[data-theme-selected]"),
    ).toBeTruthy();
    expect(within(presetGrid).queryByText("Follows OS")).toBeNull();
    expect(within(presetGrid).queryByText("LIGHT PALETTE")).toBeNull();
    expect(within(presetGrid).queryByText("DARK PALETTE")).toBeNull();
    expect(
      within(presetGrid).getByRole("button", { name: "System" }).className,
    ).toContain("min-h-32");
    fireEvent.click(
      within(presetGrid).getByRole("button", { name: "GitHub Dark" }),
    );
    expect(onThemePresetChange).toHaveBeenCalledWith("github-dark");
    expect(presetSelector.open).toBe(false);
  });

  it("provides a font reset action", () => {
    const onReset = vi.fn();
    render(
      <TypographyCard
        chatFontFamily="system-ui"
        chatFontSize={18}
        onChatFontFamilyChange={vi.fn()}
        onChatFontSizeChange={vi.fn()}
        onReset={onReset}
        onUiFontFamilyChange={vi.fn()}
        onUiFontSizeChange={vi.fn()}
        onUiZoomChange={vi.fn()}
        uiFontFamily="system-ui"
        uiFontSize={16}
        uiZoom={100}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));

    expect(onReset).toHaveBeenCalledOnce();
  });

  it("renders language and notification settings in general panels", () => {
    render(
      <>
        <LanguageCard language="system" onLanguageChange={vi.fn()} />
        <NotificationsCard
          enabled
          onEnabledChange={vi.fn()}
          onSoundChange={vi.fn()}
          sound="system"
        />
      </>,
    );

    expect(screen.getByLabelText("Language")).toBeTruthy();
    expect(screen.getByLabelText("Desktop notifications")).toBeTruthy();
    const soundSelect = screen.getByLabelText("Notification sound");
    for (const option of UI_NOTIFICATION_SOUND_OPTIONS) {
      expect(
        within(soundSelect).getAllByRole("option", { name: option.label }),
      ).toHaveLength(1);
    }
  });

  it("does not render redundant explanatory panel descriptions", () => {
    render(
      <>
        <NotificationsCard
          enabled
          onEnabledChange={vi.fn()}
          onSoundChange={vi.fn()}
          sound="system"
        />
        <UiPreferencesCard onThemePresetChange={vi.fn()} preset="system" />
        <TypographyCard
          chatFontFamily="system-ui"
          onChatFontSizeChange={vi.fn()}
          onChatFontFamilyChange={vi.fn()}
          onReset={vi.fn()}
          onUiFontFamilyChange={vi.fn()}
          onUiFontSizeChange={vi.fn()}
          onUiZoomChange={vi.fn()}
          chatFontSize={16}
          uiFontFamily="system-ui"
          uiFontSize={16}
          uiZoom={100}
        />
      </>,
    );

    expect(
      screen.queryByText(
        "Control desktop notifications when the app is in the background.",
      ),
    ).toBeNull();
    expect(
      screen.queryByText("These are local presentation preferences only."),
    ).toBeNull();
    expect(
      screen.queryByText("Adjust chat content and interface text sizes."),
    ).toBeNull();
  });

  it("keeps an explicitly supplied icon when the panel title changes", () => {
    render(
      <SettingsPanel icon={BellIcon} title="Renamed notification settings">
        <p>Content</p>
      </SettingsPanel>,
    );

    expect(
      screen
        .getByRole("heading", { name: "Renamed notification settings" })
        .querySelector("svg"),
    ).toBeTruthy();
  });

  it("wraps panel actions instead of squeezing the title at narrow widths", () => {
    render(
      <SettingsPanel
        action={<button type="button">Reset</button>}
        title="A settings panel with a long title"
      >
        <p>Content</p>
      </SettingsPanel>,
    );

    const heading = screen.getByRole("heading", {
      name: "A settings panel with a long title",
    });
    expect(heading.parentElement?.className).toContain("flex-wrap");
    expect(
      screen.getByRole("button", { name: "Reset" }).parentElement?.className,
    ).toContain("shrink-0");
  });
});
