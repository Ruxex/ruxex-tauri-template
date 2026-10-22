// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CapabilitiesCard,
  ConnectionCard,
  LanguageCard,
  NotificationsCard,
  RuntimeSummary,
  UiPreferencesCard,
} from "./SettingsCards";

describe("settings card layout", () => {
  afterEach(cleanup);

  it("aligns key-value values to the right of their keys", () => {
    render(
      <ConnectionCard
        connected
        isFetching={false}
        onReconnect={vi.fn()}
        resynchronizing={false}
      />,
    );

    const statusRow = screen.getByText("Status").parentElement;
    expect(statusRow?.className).toContain(
      "grid-cols-[minmax(0,1fr)_minmax(12rem,40%)]",
    );
    expect(statusRow?.querySelector("dd")?.className).toContain("text-right");
  });

  it("separates rows inside each settings panel", () => {
    render(
      <ConnectionCard
        connected
        isFetching={false}
        onReconnect={vi.fn()}
        resynchronizing={false}
      />,
    );

    const connectionPanel = screen
      .getByRole("heading", { name: "Connection" })
      .closest("section");

    expect(connectionPanel?.className).toContain("overflow-hidden");
    expect(connectionPanel?.querySelector("dl")?.className).toContain(
      "divide-y",
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
        <CapabilitiesCard capabilities={{ browser: true, shell: false }} />
        <UiPreferencesCard
          onAccentColorChange={vi.fn()}
          onColorSchemeChange={vi.fn()}
          colorScheme="system"
          density="comfortable"
          onDensityChange={vi.fn()}
          theme={{ accentColor: "blue" }}
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
    expect(screen.getByLabelText("Notification sound")).toBeTruthy();
  });
});
