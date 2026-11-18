// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import defaultCapability from "../../../src-tauri/capabilities/default.json";
import tauriConfig from "../../../src-tauri/tauri.conf.json";
import { i18n } from "../../app/i18n";
import {
  DEFAULT_UI_PREFERENCES,
  UI_PREFERENCES_KEY,
  UiPreferencesProvider,
  useUiPreferences,
} from "../../app/ui-preferences";

const nativeRuntime = vi.hoisted(() => ({ enabled: false }));
const setTitle = vi.hoisted(() => vi.fn());
const getCurrentWindow = vi.hoisted(() => vi.fn(() => ({ setTitle })));

vi.mock("../../app-server/runtime", () => ({
  get isNativeDesktopRuntime() {
    return nativeRuntime.enabled;
  },
}));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow }));

const createThread = vi.hoisted(() => vi.fn());
const sendMessage = vi.hoisted(() => vi.fn());
const closeQuickPanel = vi.hoisted(() => vi.fn());
const detectEditorCommand = vi.hoisted(() => vi.fn());

vi.mock("../../app-server/hooks", () => ({
  useCreateThread: () => ({ mutateAsync: createThread, isPending: false }),
  useSendMessage: () => ({ mutateAsync: sendMessage, isPending: false }),
}));

vi.mock("../../app/branding-context", () => ({
  useBranding: () => ({ assistantName: "Ruxex" }),
}));

vi.mock("../../platform/native", () => ({
  closeQuickPanel,
  detectEditorCommand,
}));

describe("QuickPanelPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await i18n.changeLanguage("en");
    window.localStorage.clear();
    nativeRuntime.enabled = false;
    setTitle.mockReset().mockResolvedValue(undefined);
    getCurrentWindow.mockClear();
    createThread.mockReset();
    sendMessage.mockReset();
    closeQuickPanel.mockReset();
    detectEditorCommand.mockReset().mockResolvedValue(null);
    createThread.mockResolvedValue({ thread: { id: "thread-1" } });
    sendMessage.mockResolvedValue({});
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getDisplayMedia: vi.fn(),
        getUserMedia: vi.fn(),
      },
    });
  });

  it("localizes attachment controls and errors live without changing the native title contract", async () => {
    const { QuickPanelPage } = await import("./QuickPanelPage");
    render(<QuickPanelPage />);
    await act(() => i18n.changeLanguage("ja"));
    expect(
      screen
        .getByRole("textbox", { name: "クイックリクエスト" })
        .getAttribute("placeholder"),
    ).toBe("質問を入力…");
    fireEvent.change(screen.getByLabelText("画像の添付"), {
      target: {
        files: [new File(["text"], "note.txt", { type: "text/plain" })],
      },
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "添付できるのは画像のみです。",
    );
    fireEvent.click(screen.getByRole("button", { name: "画面をキャプチャ" }));
    expect(
      await screen.findByText("画面キャプチャをキャンセルしました。"),
    ).toBeTruthy();
    await act(() => i18n.changeLanguage("en"));
    expect(screen.getByRole("alert").textContent).toBe(
      "Screen capture cancelled.",
    );
    expect(screen.getByRole("button", { name: "Attach image" })).toBeTruthy();
  });

  it("keeps the capture accessible name aligned with its Japanese loading label", async () => {
    const { QuickPanelPage } = await import("./QuickPanelPage");
    let rejectCapture: ((reason: Error) => void) | undefined;
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectCapture = reject;
        }),
    );
    await i18n.changeLanguage("ja");
    render(<QuickPanelPage />);
    fireEvent.click(screen.getByRole("button", { name: "画面をキャプチャ" }));
    expect(screen.getByRole("button", { name: "キャプチャ中…" })).toBeTruthy();
    await act(async () => rejectCapture?.(new Error("cancelled")));
  });

  it("sets the Japanese native Quick Panel title from persisted preferences", async () => {
    nativeRuntime.enabled = true;
    window.localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({
        ...DEFAULT_UI_PREFERENCES,
        language: "ja",
      }),
    );
    const { QuickPanelPage } = await import("./QuickPanelPage");
    render(
      <UiPreferencesProvider>
        <QuickPanelPage />
      </UiPreferencesProvider>,
    );

    await waitFor(() =>
      expect(setTitle).toHaveBeenLastCalledWith("クイックリクエスト"),
    );
    expect(i18n.resolvedLanguage).toBe("ja");
    expect(document.documentElement.lang).toBe("ja");
  });

  it("updates the native title when the live language preference changes", async () => {
    nativeRuntime.enabled = true;
    const { QuickPanelPage } = await import("./QuickPanelPage");
    function LanguageControls() {
      const { update } = useUiPreferences();
      return (
        <>
          <button type="button" onClick={() => update({ language: "ja" })}>
            Japanese
          </button>
          <button type="button" onClick={() => update({ language: "en" })}>
            English
          </button>
        </>
      );
    }
    render(
      <UiPreferencesProvider>
        <QuickPanelPage />
        <LanguageControls />
      </UiPreferencesProvider>,
    );
    await waitFor(() =>
      expect(setTitle).toHaveBeenLastCalledWith("Quick request"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Japanese" }));
    await waitFor(() =>
      expect(setTitle).toHaveBeenLastCalledWith("クイックリクエスト"),
    );
    expect(document.documentElement.lang).toBe("ja");
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    await waitFor(() =>
      expect(setTitle).toHaveBeenLastCalledWith("Quick request"),
    );
    expect(document.documentElement.lang).toBe("en");
  });

  it("updates an open panel title from preferences saved by the main window", async () => {
    nativeRuntime.enabled = true;
    const { QuickPanelPage } = await import("./QuickPanelPage");
    render(
      <UiPreferencesProvider>
        <QuickPanelPage />
      </UiPreferencesProvider>,
    );
    await waitFor(() =>
      expect(setTitle).toHaveBeenLastCalledWith("Quick request"),
    );

    for (const language of ["ja", "en"] as const) {
      const newValue = JSON.stringify({ ...DEFAULT_UI_PREFERENCES, language });
      window.localStorage.setItem(UI_PREFERENCES_KEY, newValue);
      act(() =>
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: UI_PREFERENCES_KEY,
            newValue,
            storageArea: window.localStorage,
          }),
        ),
      );
      await waitFor(() =>
        expect(setTitle).toHaveBeenLastCalledWith(
          language === "ja" ? "クイックリクエスト" : "Quick request",
        ),
      );
      expect(i18n.resolvedLanguage).toBe(language);
      expect(document.documentElement.lang).toBe(language);
    }
  });

  it("updates the native title when the resolved system language changes", async () => {
    nativeRuntime.enabled = true;
    const systemLanguage = vi
      .spyOn(navigator, "language", "get")
      .mockReturnValue("ja-JP");
    const { QuickPanelPage } = await import("./QuickPanelPage");
    render(
      <UiPreferencesProvider>
        <QuickPanelPage />
      </UiPreferencesProvider>,
    );
    await waitFor(() =>
      expect(setTitle).toHaveBeenLastCalledWith("クイックリクエスト"),
    );
    systemLanguage.mockReturnValue("fr-FR");
    act(() => window.dispatchEvent(new Event("languagechange")));
    await waitFor(() =>
      expect(setTitle).toHaveBeenLastCalledWith("Quick request"),
    );
    expect(document.documentElement.lang).toBe("en");
  });

  it("does not access the Tauri window API in the browser runtime", async () => {
    const { QuickPanelPage } = await import("./QuickPanelPage");
    render(
      <UiPreferencesProvider>
        <QuickPanelPage />
      </UiPreferencesProvider>,
    );
    await act(() => i18n.changeLanguage("ja"));
    expect(getCurrentWindow).not.toHaveBeenCalled();
    expect(setTitle).not.toHaveBeenCalled();
  });

  it("grants only title-setting permission while preserving capability targets and main branding", () => {
    expect(defaultCapability.identifier).toBe("default");
    expect(defaultCapability.windows).toEqual(["main", "quick-panel"]);
    expect(defaultCapability.permissions).toEqual([
      "core:default",
      "core:window:allow-set-title",
      "dialog:default",
      "notification:default",
      "opener:default",
    ]);
    expect(tauriConfig.app.windows[0].title).toBe("Ruxex Desktop");
  });

  it("sends a short text request to a new thread", async () => {
    const { QuickPanelPage } = await import("./QuickPanelPage");
    render(<QuickPanelPage />);

    fireEvent.change(screen.getByLabelText("Quick request"), {
      target: { value: "Summarize this" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        threadId: "thread-1",
        input: [{ type: "text", text: "Summarize this", text_elements: [] }],
      }),
    );
    expect(closeQuickPanel).toHaveBeenCalled();
  });

  it("includes an image attachment in the request", async () => {
    const { QuickPanelPage } = await import("./QuickPanelPage");
    render(<QuickPanelPage />);

    const image = new File([new Uint8Array([137, 80, 78, 71])], "shot.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByLabelText("Image attachment"), {
      target: { files: [image] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        threadId: "thread-1",
        input: [
          {
            type: "image",
            url: expect.stringContaining("data:image/png;base64"),
          },
        ],
      }),
    );
  });

  it("includes a recorded audio request", async () => {
    class FakeMediaRecorder {
      static isTypeSupported() {
        return true;
      }
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      mimeType = "audio/webm";
      start() {}
      stop() {
        this.ondataavailable?.({
          data: new Blob(["audio"], { type: "audio/webm" }),
        });
        this.onstop?.();
      }
    }
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: FakeMediaRecorder,
    });
    const stream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      stream as never,
    );

    const { QuickPanelPage } = await import("./QuickPanelPage");
    render(<QuickPanelPage />);

    fireEvent.click(screen.getByRole("button", { name: "Record audio" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Stop recording" }),
      ).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
    await screen.findByText("Audio recorded");
    fireEvent.change(screen.getByLabelText("Quick request"), {
      target: { value: "Transcribe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        threadId: "thread-1",
        input: [
          { type: "text", text: "Transcribe", text_elements: [] },
          { type: "audio", url: expect.stringContaining("data:audio/webm") },
        ],
      }),
    );
  });

  it("keeps the panel usable when display capture is cancelled", async () => {
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockRejectedValue(
      new Error("cancelled"),
    );
    const { QuickPanelPage } = await import("./QuickPanelPage");
    render(<QuickPanelPage />);

    fireEvent.click(screen.getByRole("button", { name: "Capture screen" }));

    expect(await screen.findByText("Screen capture cancelled.")).toBeTruthy();
    expect(screen.getByLabelText("Quick request")).toBeTruthy();
  });

  it("reports when microphone recording is unavailable", async () => {
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: undefined,
    });
    const { QuickPanelPage } = await import("./QuickPanelPage");
    render(<QuickPanelPage />);

    fireEvent.click(screen.getByRole("button", { name: "Record audio" }));

    expect(
      await screen.findByText("Audio recording is unavailable."),
    ).toBeTruthy();
  });
});
