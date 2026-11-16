// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { StrictMode, useContext } from "react";
import { I18nContext, useTranslation } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

const startAppServerEventStore = vi.hoisted(() => vi.fn());
const stopAppServerEventStore = vi.hoisted(() => vi.fn());

function TranslationProbe() {
  const context = useContext(I18nContext);
  const { t } = useTranslation("common");
  return (
    <output>
      {context ? t("actions.cancel") : "Missing localization provider"}
    </output>
  );
}

vi.mock("../app-server/event-store", () => ({
  startAppServerEventStore,
  stopAppServerEventStore,
}));
vi.mock("../app-server/hooks", () => ({
  useAppServerNotifications: vi.fn(),
  useAppServerQuerySync: vi.fn(),
}));
vi.mock("../app-server/runtime", () => ({
  isDesktopRuntime: false,
  isNativeDesktopRuntime: false,
}));
vi.mock("../platform/deep-links", () => ({
  pathForDeepLink: vi.fn(),
  startDeepLinkListener: vi.fn(),
}));
vi.mock("react-router-dom", () => ({
  RouterProvider: () => <TranslationProbe />,
}));
vi.mock("./ui-preferences", () => ({
  UiPreferencesProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

describe("AppProviders", () => {
  afterEach(() => {
    cleanup();
    startAppServerEventStore.mockReset();
    stopAppServerEventStore.mockReset();
  });

  it("provides the initialized instance to routed UI and updates translated messages", async () => {
    const { AppProviders } = await import("./providers");
    const { i18n } = await import("./i18n");
    render(<AppProviders router={{} as never} />);
    expect(screen.getByRole("status").textContent).toBe("Cancel");
    try {
      await act(async () => {
        await i18n.changeLanguage("ja");
      });
      expect(screen.getByRole("status").textContent).toBe("キャンセル");
    } finally {
      await act(async () => {
        await i18n.changeLanguage("en");
      });
    }
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
