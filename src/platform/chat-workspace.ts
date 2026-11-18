import { invoke } from "@tauri-apps/api/core";
import { getMockAppServer } from "@/app-server/mock-runtime";
import { isMockAppServerRuntime } from "@/app-server/runtime";

export function createChatWorkspace(): Promise<string> {
  if (isMockAppServerRuntime) {
    return getMockAppServer().invoke("create_chat_workspace") as Promise<string>;
  }
  return invoke<string>("create_chat_workspace");
}
