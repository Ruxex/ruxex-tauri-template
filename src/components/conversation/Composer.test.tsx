// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMutation = vi.hoisted(() => vi.fn());
const steerMutation = vi.hoisted(() => vi.fn());
const queueMutation = vi.hoisted(() => vi.fn());
const interruptMutation = vi.hoisted(() => vi.fn());

vi.mock("../../app-server/hooks", () => ({
  useSendMessage: () => ({
    mutateAsync: sendMutation,
    isPending: false,
    error: null,
  }),
  useSteerTurn: () => ({
    mutateAsync: steerMutation,
    isPending: false,
    error: null,
  }),
  useQueueMessage: () => ({
    mutateAsync: queueMutation,
    isPending: false,
    error: null,
  }),
  useInterruptTurn: () => ({
    mutateAsync: interruptMutation,
    isPending: false,
    error: null,
  }),
}));

describe("Composer", () => {
  afterEach(cleanup);

  beforeEach(() => {
    sendMutation.mockReset();
    steerMutation.mockReset();
    queueMutation.mockReset();
    interruptMutation.mockReset();
    sendMutation.mockResolvedValue({});
    steerMutation.mockResolvedValue({});
    queueMutation.mockResolvedValue({});
    interruptMutation.mockResolvedValue({});
  });

  it("sends a selected image alongside the text input", async () => {
    const { Composer } = await import("./Composer");

    render(<Composer threadId="thread-1" activeTurnId={null} />);
    fireEvent.change(screen.getByLabelText("Image attachment"), {
      target: {
        files: [new File(["png"], "diagram.png", { type: "image/png" })],
      },
    });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Explain this" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(sendMutation).toHaveBeenCalled());
    expect(sendMutation).toHaveBeenCalledWith({
      threadId: "thread-1",
      input: [
        {
          type: "image",
          url: expect.stringMatching(/^data:image\/png;base64,/),
        },
        { type: "text", text: "Explain this", text_elements: [] },
      ],
      turnTrigger: null,
    });
    expect(screen.queryByTestId("selected-image")).toBeNull();
  });

  it("rejects non-image files before sending and keeps the composer usable", async () => {
    const { Composer } = await import("./Composer");

    render(<Composer threadId="thread-1" activeTurnId={null} />);
    fireEvent.change(screen.getByLabelText("Image attachment"), {
      target: {
        files: [new File(["text"], "notes.txt", { type: "text/plain" })],
      },
    });

    expect(
      screen.getByText("Only image attachments are supported."),
    ).toBeTruthy();
    expect(screen.queryByTestId("selected-image")).toBeNull();
    expect(sendMutation).not.toHaveBeenCalled();
  });

  it("keeps a selected image after a failed send for retry", async () => {
    sendMutation.mockRejectedValueOnce(new Error("send failed"));
    const { Composer } = await import("./Composer");

    render(<Composer threadId="thread-1" activeTurnId={null} />);
    fireEvent.change(screen.getByLabelText("Image attachment"), {
      target: {
        files: [new File(["png"], "diagram.png", { type: "image/png" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(sendMutation).toHaveBeenCalled());
    expect(screen.getByTestId("selected-image").textContent).toContain(
      "diagram.png",
    );
  });

  it("keeps Enter for newlines and sends with Shift+Enter", async () => {
    const { Composer } = await import("./Composer");

    render(<Composer threadId="thread-1" activeTurnId={null} />);
    const message = screen.getByLabelText("Message");
    fireEvent.change(message, { target: { value: "Do the work" } });

    fireEvent.keyDown(message, { key: "Enter", shiftKey: false });
    expect(sendMutation).not.toHaveBeenCalled();

    fireEvent.keyDown(message, { key: "Enter", shiftKey: true });

    await waitFor(() => expect(sendMutation).toHaveBeenCalled());
    expect(sendMutation).toHaveBeenCalledWith({
      threadId: "thread-1",
      input: [{ type: "text", text: "Do the work", text_elements: [] }],
      turnTrigger: null,
    });
  });

  it("does not submit an empty message with Shift+Enter", async () => {
    const { Composer } = await import("./Composer");

    render(<Composer threadId="thread-1" activeTurnId={null} />);
    fireEvent.keyDown(screen.getByLabelText("Message"), {
      key: "Enter",
      shiftKey: true,
    });

    await waitFor(() => expect(sendMutation).not.toHaveBeenCalled());
  });

  it("uses the selected queue mode from the submission menu", async () => {
    const { Composer } = await import("./Composer");

    render(<Composer threadId="thread-1" activeTurnId="turn-1" />);
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Queue this" },
    });
    fireEvent.click(
      screen.getByLabelText("Submission mode menu"),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /Queue/ }));
    fireEvent.click(screen.getByRole("button", { name: "Queue" }));

    await waitFor(() => expect(queueMutation).toHaveBeenCalled());
    expect(queueMutation).toHaveBeenCalledWith({
      threadId: "thread-1",
      input: [{ type: "text", text: "Queue this", text_elements: [] }],
    });
  });

  it("keeps image-only input sendable with Shift+Enter", async () => {
    const { Composer } = await import("./Composer");

    render(<Composer threadId="thread-1" activeTurnId={null} />);
    fireEvent.change(screen.getByLabelText("Image attachment"), {
      target: {
        files: [new File(["png"], "diagram.png", { type: "image/png" })],
      },
    });
    fireEvent.keyDown(screen.getByLabelText("Message"), {
      key: "Enter",
      shiftKey: true,
    });

    await waitFor(() => expect(sendMutation).toHaveBeenCalled());
    expect(sendMutation).toHaveBeenCalledWith({
      threadId: "thread-1",
      input: [
        {
          type: "image",
          url: expect.stringMatching(/^data:image\/png;base64,/),
        },
      ],
      turnTrigger: null,
    });
  });
});
