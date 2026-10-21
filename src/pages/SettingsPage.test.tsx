// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  afterEach(cleanup);

  it("provides Codex-style settings tabs including the account tab", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings/*" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const tabs = screen.getByRole("tablist", { name: "Settings sections" });

    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(tabs.querySelector('a[href="/settings"]')).toBeTruthy();
    expect(tabs.querySelector('a[href="/settings/account"]')).toBeTruthy();
    expect(screen.getByText("General")).toBeTruthy();
    expect(screen.getByText("Account")).toBeTruthy();
  });
});
