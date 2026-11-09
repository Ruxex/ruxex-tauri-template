// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StoryVariantList } from "./StoryVariantList";

describe("StoryVariantList", () => {
  afterEach(cleanup);

  it("renders each variant in a labeled region", () => {
    render(
      <StoryVariantList
        variants={[
          {
            content: <span data-testid="success-content">Success preview</span>,
            label: "Success",
          },
          {
            content: <span data-testid="failure-content">Failure preview</span>,
            label: "Failure",
          },
        ]}
      />,
    );

    expect(screen.getByRole("region", { name: "Success" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Failure" })).toBeTruthy();
    expect(screen.getByTestId("success-content")).toBeTruthy();
    expect(screen.getByTestId("failure-content")).toBeTruthy();
  });
});
