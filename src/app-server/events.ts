import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { ServerNotification, ServerRequest } from "../protocol";
import { isMockAppServerRuntime } from "./runtime";

export type AppServerEvent =
  | { type: "lagged"; data: { skipped: number } }
  | { type: "serverNotification"; data: ServerNotification }
  | { type: "serverRequest"; data: ServerRequest }
  | { type: "disconnected"; data: { message: string } };

export function listenToAppServerEvents(
  handler: (event: AppServerEvent) => void,
): Promise<UnlistenFn> {
  if (isMockAppServerRuntime) {
    return Promise.resolve(() => {
      void handler;
    });
  }
  return listen<AppServerEvent>("app-server-event", (event) => {
    handler(event.payload);
  });
}
