// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { McpStatusSummary } from "./McpStatusSummary";

describe("McpStatusSummary", () => {
  it("separates unavailable connection state from authentication state", () => {
    render(<McpStatusSummary authStatus="notLoggedIn" runtimeStatus={null} />);

    expect(screen.getByText("Connection:")).toBeTruthy();
    expect(screen.getByText("Status unavailable")).toBeTruthy();
    expect(screen.getByText("Authentication:")).toBeTruthy();
    expect(screen.getByText("Authentication not configured")).toBeTruthy();
  });
});
