// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  afterEach(cleanup);

  it("renders the settings content shell", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings/*" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const heading = screen.getByRole("heading", { name: "Settings" });
    expect(heading).toBeTruthy();
    expect(heading.parentElement?.parentElement?.className).toContain(
      "max-w-3xl",
    );
  });
});
