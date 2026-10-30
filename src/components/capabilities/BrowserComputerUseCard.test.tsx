// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BrowserComputerUseCard } from "./BrowserComputerUseCard";

describe("BrowserComputerUseCard", () => {
  afterEach(cleanup);

  it("shows policy-disabled browser and computer use explicitly", () => {
    render(
      <BrowserComputerUseCard
        config={null}
        requirements={{
          allowBrowserAndComputerUse: false,
          browserUse: null,
          computerUse: null,
        }}
      />,
    );

    expect(screen.getByText("Disabled by policy")).toBeTruthy();
    expect(screen.getAllByText("Unsupported")).toHaveLength(2);
  });

  it("shows configured server-backed Browser and Computer Use", () => {
    render(
      <BrowserComputerUseCard
        config={{ browser_use: {}, computer_use: {} }}
        requirements={{
          allowBrowserAndComputerUse: true,
          browserUse: {},
          computerUse: {},
        }}
      />,
    );

    expect(screen.getAllByRole("status", { name: "Available" })).toHaveLength(
      2,
    );
    expect(
      screen.getAllByRole("status", { name: "Configured" }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("status", { name: "Available" })[0].className,
    ).not.toContain("badge");
    expect(
      screen.getAllByRole("status", { name: "Configured" })[0].className,
    ).not.toContain("badge");
    expect(screen.queryByText(/App Server owns execution/)).toBeNull();
  });
});
