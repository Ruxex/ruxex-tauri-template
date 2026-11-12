// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { SettingsSidebar } from "./SettingsSidebar";

describe("SettingsSidebar", () => {
  afterEach(cleanup);

  it("links to archived chats in the settings sections", () => {
    render(
      <MemoryRouter initialEntries={["/settings/archive"]}>
        <SettingsSidebar onClose={() => undefined} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: "Archived chats" }).getAttribute("href"),
    ).toBe("/settings/archive");
  });

  it("groups archived chats under Personal", () => {
    render(
      <MemoryRouter initialEntries={["/settings/archive"]}>
        <SettingsSidebar onClose={() => undefined} />
      </MemoryRouter>,
    );

    const archivedChats = screen.getByRole("link", { name: "Archived chats" });
    expect(archivedChats.closest("section")?.querySelector("h3")?.textContent)
      .toBe("Personal");
  });

  it("links to global MCP server settings", () => {
    render(
      <MemoryRouter initialEntries={["/settings/mcp-servers"]}>
        <SettingsSidebar onClose={() => undefined} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: "MCP servers" }).getAttribute("href"),
    ).toBe("/settings/mcp-servers");
  });

  it("does not duplicate the account entry in settings navigation", () => {
    render(
      <MemoryRouter initialEntries={["/settings/account"]}>
        <SettingsSidebar onClose={() => undefined} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "Account" })).toBeNull();
  });
});
