// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PasswordInput } from "./PasswordInput";

describe("PasswordInput", () => {
  it("associates the label and input with a deliberate vertical gap", () => {
    render(
      <PasswordInput
        id="account-api-key"
        label="API key"
        placeholder="Enter your API key"
      />,
    );

    const input = screen.getByLabelText("API key");
    expect(input.getAttribute("type")).toBe("password");
    expect(input.className).toContain("input-bordered");
    expect(input.parentElement?.className).toContain("gap-2");
  });
});
