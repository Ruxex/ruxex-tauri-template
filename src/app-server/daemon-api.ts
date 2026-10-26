import { invoke } from "@tauri-apps/api/core";

export type AppServerDaemonAction = "start" | "restart" | "stop" | "version";

export type AppServerDaemonStatus =
  | "alreadyRunning"
  | "started"
  | "restarted"
  | "stopped"
  | "notRunning"
  | "running";

export type AppServerDaemonOutput = {
  status: AppServerDaemonStatus;
  backend?: "pid";
  pid?: number;
  managedRuxexPath: string;
  managedRuxexVersion?: string;
  socketPath: string;
  cliVersion?: string;
  appServerVersion?: string;
};

export function controlAppServerDaemon(
  action: AppServerDaemonAction,
): Promise<AppServerDaemonOutput> {
  return invoke<AppServerDaemonOutput>("app_server_daemon_control", {
    action,
  });
}
