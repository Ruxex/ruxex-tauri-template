import {
  ensureAppServer,
  type AppServerStatus,
} from "./api";
import { startAppServerEventStore } from "./event-store";
import { isMockAppServerRuntime } from "./runtime";

export async function ensureAppServerRuntime(): Promise<AppServerStatus> {
  if (!isMockAppServerRuntime) {
    await startAppServerEventStore();
  }
  return ensureAppServer();
}
