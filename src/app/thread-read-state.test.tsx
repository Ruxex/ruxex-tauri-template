// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  THREAD_READ_STATE_KEY,
  ThreadReadStateProvider,
  parseThreadReadState,
  readThreadReadState,
  useThreadReadState,
  writeThreadReadState,
} from "./thread-read-state";

function Probe() {
  const { isThreadUnread, markThreadRead, readAtByThreadId } =
    useThreadReadState();
  const readAt = readAtByThreadId["thread-1"] ?? null;

  return (
    <div>
      <span data-testid="read-at">{readAt ?? "none"}</span>
      <span data-testid="unread">
        {isThreadUnread("thread-1", 10) ? "unread" : "read"}
      </span>
      <button type="button" onClick={() => markThreadRead("thread-1", 10)}>
        Mark read
      </button>
      <button type="button" onClick={() => markThreadRead("thread-1", 5)}>
        Mark old
      </button>
    </div>
  );
}

describe("thread read state", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("uses an empty state for missing, malformed, or mismatched data", () => {
    expect(parseThreadReadState(null)).toEqual({
      version: 1,
      readAtByThreadId: {},
    });
    expect(parseThreadReadState("not json")).toEqual({
      version: 1,
      readAtByThreadId: {},
    });
    expect(parseThreadReadState(JSON.stringify({ version: 2 }))).toEqual({
      version: 1,
      readAtByThreadId: {},
    });
  });

  it("keeps valid timestamps and drops invalid entries", () => {
    expect(
      parseThreadReadState(
        JSON.stringify({
          version: 1,
          readAtByThreadId: {
            "thread-1": 42,
            "thread-2": 0,
            "thread-3": -1,
            "thread-4": "not a timestamp",
          },
        }),
      ),
    ).toEqual({
      version: 1,
      readAtByThreadId: { "thread-1": 42, "thread-2": 0 },
    });
  });

  it("reads and writes the versioned state from localStorage", () => {
    const state = { version: 1 as const, readAtByThreadId: { "thread-1": 7 } };
    writeThreadReadState(state);

    expect(window.localStorage.getItem(THREAD_READ_STATE_KEY)).toBe(
      JSON.stringify(state),
    );
    expect(readThreadReadState()).toEqual(state);
  });

  it("marks a thread read without moving its cursor backwards", async () => {
    render(
      <ThreadReadStateProvider>
        <Probe />
      </ThreadReadStateProvider>,
    );

    expect(screen.getByTestId("unread").textContent).toBe("unread");
    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
    expect(screen.getByTestId("read-at").textContent).toBe("10");
    expect(screen.getByTestId("unread").textContent).toBe("read");

    fireEvent.click(screen.getByRole("button", { name: "Mark old" }));
    expect(screen.getByTestId("read-at").textContent).toBe("10");

    await waitFor(() => {
      expect(readThreadReadState()).toEqual({
        version: 1,
        readAtByThreadId: { "thread-1": 10 },
      });
    });
  });
});
