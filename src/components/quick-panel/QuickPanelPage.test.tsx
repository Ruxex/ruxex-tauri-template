// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createThread = vi.hoisted(() => vi.fn());
const sendMessage = vi.hoisted(() => vi.fn());
const closeQuickPanel = vi.hoisted(() => vi.fn());

vi.mock("../../app-server/hooks", () => ({
  useCreateThread: () => ({ mutateAsync: createThread, isPending: false }),
  useSendMessage: () => ({ mutateAsync: sendMessage, isPending: false }),
}));

vi.mock("../../app/branding-context", () => ({
  useBranding: () => ({ assistantName: "Ruxex" }),
}));

vi.mock("../../platform/native", () => ({ closeQuickPanel }));

describe("QuickPanelPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    createThread.mockReset();
    sendMessage.mockReset();
    closeQuickPanel.mockReset();
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
