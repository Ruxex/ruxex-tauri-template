// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import {
  createMemoryRouter,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { NewTaskRedirect } from "./NewTaskRedirect";

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}

describe("NewTaskRedirect", () => {
  afterEach(cleanup);

  it("redirects an unscoped legacy route to the start screen", async () => {
    const router = createMemoryRouter(
      [
        { path: "/chat/new", element: <NewTaskRedirect /> },
        { path: "/", element: <LocationProbe /> },
      ],
      { initialEntries: ["/chat/new"] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe("/"),
    );
  });

  it("preserves the project when redirecting a project legacy route", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/projects/:projectId/chat/new",
          element: <NewTaskRedirect />,
        },
        { path: "/", element: <LocationProbe /> },
      ],
      { initialEntries: ["/projects/project-1/chat/new"] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe(
        "/?projectId=project-1",
      ),
    );
  });
});
