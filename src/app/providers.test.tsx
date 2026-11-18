// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { StrictMode, useContext } from "react";
import { I18nContext, useTranslation } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

const startAppServerEventStore = vi.hoisted(() => vi.fn());
const stopAppServerEventStore = vi.hoisted(() => vi.fn());
const desktopMocks = vi.hoisted(() => ({
  enabled: false,
  callback: undefined as ((target: never) => void) | undefined,
  resolveListener: undefined as ((stop: () => void) => void) | undefined,
  stopListener: vi.fn(),
  pathForDeepLink: vi.fn(),
  startDeepLinkListener: vi.fn(),
  navigate: vi.fn(),
}));

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
  get isDesktopRuntime() {
    return desktopMocks.enabled;
  },
  isNativeDesktopRuntime: false,
}));
vi.mock("../platform/deep-links", () => ({
  pathForDeepLink: desktopMocks.pathForDeepLink,
  startDeepLinkListener: desktopMocks.startDeepLinkListener,
}));
vi.mock("react-router-dom", () => ({
  RouterProvider: ({
    router,
  }: {
    router: { navigate?: (path: string) => void };
  }) => {
    desktopMocks.navigate.mockImplementation(
      router.navigate ?? (() => undefined),
    );
    return <TranslationProbe />;
  },
}));
vi.mock("./ui-preferences", () => ({
  UiPreferencesProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

describe("AppProviders", () => {
  afterEach(() => {
    cleanup();
    vi.resetModules();
    startAppServerEventStore.mockReset();
    stopAppServerEventStore.mockReset();
    desktopMocks.enabled = false;
    desktopMocks.callback = undefined;
    desktopMocks.resolveListener = undefined;
    desktopMocks.stopListener.mockReset();
    desktopMocks.pathForDeepLink.mockReset();
    desktopMocks.startDeepLinkListener.mockReset();
    desktopMocks.navigate.mockReset();
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

  it("navigates to a deep link and stops its listener when unmounted", async () => {
    desktopMocks.enabled = true;
    desktopMocks.pathForDeepLink.mockReturnValue("/chat/thread-42");
    desktopMocks.startDeepLinkListener.mockImplementation(
      async (callback: (target: never) => void) => {
        desktopMocks.callback = callback;
        return desktopMocks.stopListener;
      },
    );
    const { AppProviders } = await import("./providers");
    const navigate = vi.fn();
    const view = render(<AppProviders router={{ navigate } as never} />);

    await act(async () => {
      desktopMocks.callback?.({ kind: "thread", id: "thread-42" } as never);
    });

    expect(desktopMocks.pathForDeepLink).toHaveBeenCalledWith({
      kind: "thread",
      id: "thread-42",
    });
    expect(navigate).toHaveBeenCalledWith("/chat/thread-42");
    view.unmount();
    expect(desktopMocks.stopListener).toHaveBeenCalledOnce();
  });

  it("stops a deep link listener that resolves after unmount", async () => {
    desktopMocks.enabled = true;
    desktopMocks.startDeepLinkListener.mockImplementation(
      () =>
        new Promise((resolve) => {
          desktopMocks.resolveListener = resolve;
        }),
    );
    const { AppProviders } = await import("./providers");
    const view = render(<AppProviders router={{} as never} />);
    view.unmount();

    await act(async () => {
      desktopMocks.resolveListener?.(desktopMocks.stopListener);
    });

    expect(desktopMocks.stopListener).toHaveBeenCalledOnce();
  });
});
