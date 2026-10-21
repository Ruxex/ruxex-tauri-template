import { beforeEach, describe, expect, it, vi } from "vitest";

const isPermissionGranted = vi.hoisted(() => vi.fn());
const requestPermission = vi.hoisted(() => vi.fn());
const sendNotification = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted,
  requestPermission,
  sendNotification,
}));

import type { AppServerEvent } from "../app-server/events";
import {
  classifyAppServerEvent,
  createNotificationDispatcher,
  sendDesktopNotification,
} from "./notifications";

const completed = (turnId = "turn-1"): AppServerEvent => ({
  type: "serverNotification",
  data: {
    method: "turn/completed",
    params: {
      threadId: "thread-1",
      turn: { id: turnId, status: "completed", items: [] },
    },
  } as never,
});

describe("notification adapter", () => {
  beforeEach(() => {
    isPermissionGranted.mockReset();
    requestPermission.mockReset();
    sendNotification.mockReset();
  });

  it("classifies only actionable background events", () => {
    expect(classifyAppServerEvent(completed())).toMatchObject({
      id: "turn-completed:thread-1:turn-1",
      title: "Turn completed",
    });
    expect(
      classifyAppServerEvent({
        type: "serverRequest",
        data: {
          method: "item/commandExecution/requestApproval",
          id: 7,
          params: { threadId: "thread-1" },
        } as never,
      }),
    ).toMatchObject({ id: "server-request:7", title: "Action required" });
    expect(
      classifyAppServerEvent({
        type: "serverNotification",
        data: { method: "thread/status/changed", params: {} },
      } as never),
    ).toBeNull();
  });

  it("suppresses focused-window notifications and duplicate background events", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    let focused = true;
    const dispatcher = createNotificationDispatcher({
      isFocused: () => focused,
      send,
    });

    await expect(dispatcher.dispatch(completed())).resolves.toBe(false);
    focused = false;
    await expect(dispatcher.dispatch(completed())).resolves.toBe(true);
    await expect(dispatcher.dispatch(completed())).resolves.toBe(false);

    expect(send).toHaveBeenCalledOnce();
  });

  it("suppresses notifications when the preference is disabled", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const dispatcher = createNotificationDispatcher({
      enabled: () => false,
      isFocused: () => false,
      send,
    });

    await expect(dispatcher.dispatch(completed())).resolves.toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("requests permission before sending a native notification", async () => {
    isPermissionGranted.mockResolvedValueOnce(false);
    requestPermission.mockResolvedValueOnce("granted");

    await sendDesktopNotification({
      id: "turn-1",
      title: "Turn completed",
      body: "done",
    });

    expect(requestPermission).toHaveBeenCalledOnce();
    expect(sendNotification).toHaveBeenCalledWith({
      title: "Turn completed",
      body: "done",
    });
  });
});
