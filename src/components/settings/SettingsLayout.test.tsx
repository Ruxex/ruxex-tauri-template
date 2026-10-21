// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CapabilitiesCard,
  ConnectionCard,
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
    expect(statusRow?.className).toContain("justify-between");
    expect(statusRow?.querySelector("dd")?.className).toContain("text-right");
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
    ).not.toMatch(/(?:sm|md|lg):grid-cols-/);
  });

  it("keeps capability rows and preference fields vertically stacked", () => {
    render(
      <>
        <CapabilitiesCard capabilities={{ browser: true, shell: false }} />
        <UiPreferencesCard
          contextDrawerOpen
          density="comfortable"
          onContextDrawerChange={vi.fn()}
          onDensityChange={vi.fn()}
          onSidebarChange={vi.fn()}
          onThemeChange={vi.fn()}
          sidebarCollapsed={false}
          theme="system"
        />
      </>,
    );

    expect(
      screen
        .getByRole("heading", { name: "Capabilities" })
        .closest("section")
        ?.querySelector("div.grid")?.className,
    ).not.toMatch(/(?:sm|md|lg):grid-cols-/);
    expect(screen.getByText("Theme").closest("label")?.className).toContain(
      "grid-cols-[1fr_auto]",
    );
  });
});
