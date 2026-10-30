// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { BellIcon } from "@heroicons/react/24/outline";
import { afterEach, describe, expect, it, vi } from "vitest";

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
import { UI_NOTIFICATION_SOUND_OPTIONS } from "../../app/ui-preferences";

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
        onReconnect={vi.fn()}
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
    expect(screen.getByText("Connected").className).toContain("badge-success");
    expect(screen.getByText("Synchronized").className).toContain(
      "badge-success",
    );
    expect(screen.getByText("Running in this process").className).toContain(
      "badge-success",
    );
  });

  it("separates rows inside each settings panel", () => {
    render(
      <AppServerCard
        appServerReady
        connected
        isAvailable={false}
        isFetching={false}
        isPending={false}
        onReconnect={vi.fn()}
        resynchronizing={false}
        onAction={vi.fn()}
        mode="inprocess"
      />,
    );

    const connectionPanel = screen
      .getByRole("heading", { name: "AppServer" })
      .closest("section");

    expect(connectionPanel?.className).toContain("overflow-hidden");
    expect(connectionPanel?.querySelector("dl")?.className).toContain(
      "divide-y",
    );
  });

  it("groups app server controls with distinct semantic variants", () => {
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
        mode="daemon"
        onAction={vi.fn()}
        onReconnect={vi.fn()}
        resynchronizing={false}
      />,
    );

    const reconnect = screen.getByRole("button", { name: "Reconnect" });
    const actionRow = reconnect.parentElement;

    expect(actionRow?.className).toContain("flex-wrap");
    expect(actionRow?.querySelectorAll("button")).toHaveLength(4);
    expect(reconnect.className).toContain("btn-outline");
    expect(screen.getByRole("button", { name: "Start" }).className).toContain(
      "btn-success",
    );
    expect(
      screen.getByRole("button", { name: "Restart" }).className,
    ).toContain("btn-warning");
    expect(screen.getByRole("button", { name: "Stop" }).className).toContain(
      "btn-error",
    );
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

  it("keeps capability rows and preference fields vertically stacked", () => {
    render(
      <>
        <CapabilitiesCard
          capabilities={{ browser: true, shell: false, native: "Unsupported" }}
        />
        <UiPreferencesCard
          onAccentColorChange={vi.fn()}
          onColorSchemeChange={vi.fn()}
          colorScheme="system"
          theme={{ accentColor: "blue" }}
        />
        <TypographyCard
          onChatFontSizeChange={vi.fn()}
          onUiFontSizeChange={vi.fn()}
          chatFontSize={16}
          uiFontSize={16}
        />
      </>,
    );

    expect(
      screen
        .getByRole("heading", { name: "Capabilities" })
        .closest("section")
        ?.querySelector("div.grid")?.className,
    ).not.toMatch(/(?:^| )(?:sm|md|lg):grid-cols-/);
    expect(screen.getByText("Color mode").closest("div")?.className).toContain(
      "grid-cols-[minmax(0,1fr)_minmax(12rem,40%)]",
    );
    expect(screen.getByRole("heading", { name: "Interface" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Typography" })).toBeTruthy();
    expect(screen.getByLabelText("Chat font size")).toBeTruthy();
    expect(screen.getByLabelText("UI font size")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Enabled" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Disabled" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Enabled" }).className).not.toContain(
      "badge",
    );
    expect(screen.getByRole("status", { name: "Disabled" }).className).not.toContain(
      "badge",
    );
    expect(screen.getByText("Unsupported").className).not.toContain("badge");
    expect(screen.queryByText("Show project sidebar")).toBeNull();
    expect(screen.queryByText("Show context drawer")).toBeNull();
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
        <UiPreferencesCard
          onAccentColorChange={vi.fn()}
          onColorSchemeChange={vi.fn()}
          colorScheme="system"
          theme={{ accentColor: "blue" }}
        />
        <TypographyCard
          onChatFontSizeChange={vi.fn()}
          onUiFontSizeChange={vi.fn()}
          chatFontSize={16}
          uiFontSize={16}
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
});
