// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { BrowserNavigationBar } from "./BrowserNavigationBar";

function LocationProbe() {
  const location = useLocation();

  return <output data-testid="location">{location.pathname}</output>;
}

describe("BrowserNavigationBar", () => {
  afterEach(cleanup);

  it("moves backward and forward through browser history", () => {
    render(
      <MemoryRouter initialEntries={["/home", "/settings"]} initialIndex={1}>
        <BrowserNavigationBar />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByTestId("location").textContent).toBe("/home");

    fireEvent.click(screen.getByRole("button", { name: "Forward" }));
    expect(screen.getByTestId("location").textContent).toBe("/settings");
  });

  it("uses a compact, subdued visual treatment", () => {
    render(
      <MemoryRouter>
        <BrowserNavigationBar />
      </MemoryRouter>,
    );

    const navigation = screen.getByRole("navigation", {
      name: "Browser navigation",
    });
    expect(navigation.className).toContain("h-8");
    expect(navigation.className).toContain("bg-base-200/70");
    expect(navigation.className).toContain("text-base-content/60");
    expect(screen.getByRole("button", { name: "Back" }).className).toContain(
      "btn-xs",
    );
  });

  it("renders breadcrumbs for the current route", () => {
    render(
      <MemoryRouter initialEntries={["/settings/appearance"]}>
        <BrowserNavigationBar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();
    expect(screen.getByText("Appearance")).toBeTruthy();
  });
});
