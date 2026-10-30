// @vitest-environment jsdom

import { StrictMode } from "react";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const startAppServerEventStore = vi.hoisted(() => vi.fn());
const stopAppServerEventStore = vi.hoisted(() => vi.fn());

vi.mock("../app-server/event-store", () => ({
  startAppServerEventStore,
  stopAppServerEventStore,
}));
vi.mock("../app-server/hooks", () => ({
  useAppServerNotifications: vi.fn(),
}));
vi.mock("../app-server/runtime", () => ({ isDesktopRuntime: false }));
vi.mock("../platform/deep-links", () => ({
  pathForDeepLink: vi.fn(),
  startDeepLinkListener: vi.fn(),
}));
vi.mock("react-router-dom", () => ({
  RouterProvider: () => null,
}));
vi.mock("./ui-preferences", () => ({
  UiPreferencesProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

describe("AppProviders", () => {
  afterEach(() => {
    startAppServerEventStore.mockReset();
    stopAppServerEventStore.mockReset();
  });

  it("starts the event store for each StrictMode lifecycle and leaves the second one active", async () => {
    const { AppProviders } = await import("./providers");
    render(
      <StrictMode>
        <AppProviders router={{} as never} />
      </StrictMode>,
    );

    expect(startAppServerEventStore).toHaveBeenCalledTimes(2);
    expect(stopAppServerEventStore).toHaveBeenCalledTimes(1);
  });
});
