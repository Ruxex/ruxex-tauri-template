import type { v2 } from "../protocol";

export const appServerQueryKeys = {
  all: ["app-server"] as const,
  status: ["app-server", "status"] as const,
  daemonStatus: ["app-server", "daemon-status"] as const,
  config: (params: object) => ["app-server", "config", params] as const,
  configRequirements: ["app-server", "config-requirements"] as const,
  schedules: ["platform", "schedules"] as const,
  worktrees: (root: string) => ["platform", "worktrees", root] as const,
  models: ["app-server", "models"] as const,
  provider: ["app-server", "provider"] as const,
  providerCapabilities: ["app-server", "provider", "capabilities"] as const,
  permissionProfiles: ["app-server", "permission-profiles"] as const,
  skills: ["app-server", "skills"] as const,
  mcpServers: ["app-server", "mcp-servers"] as const,
  plugins: ["app-server", "plugins"] as const,
  collaborationModes: ["app-server", "collaboration-modes"] as const,
  account: ["app-server", "account"] as const,
  accountRead: (refreshToken: boolean) =>
    ["app-server", "account", { refreshToken }] as const,
  threads: ["app-server", "threads"] as const,
  threadListRoot: ["app-server", "threads", "list"] as const,
  threadSearchRoot: ["app-server", "threads", "search"] as const,
  projects: ["app-server", "projects"] as const,
  projectList: (params: v2.ProjectListParams) =>
    ["app-server", "projects", "list", params] as const,
  project: (projectId: string) => ["app-server", "project", projectId] as const,
  threadList: (params: v2.ThreadListParams) =>
    ["app-server", "threads", "list", params] as const,
  threadSearch: (params: v2.ThreadSearchParams) =>
    ["app-server", "threads", "search", params] as const,
  thread: (threadId: string) => ["app-server", "thread", threadId] as const,
  threadMetadata: (threadId: string) =>
    ["app-server", "thread", threadId, "metadata"] as const,
  threadConversationRoot: (threadId: string) =>
    ["app-server", "thread", threadId, "conversation"] as const,
  threadTurnsRoot: (threadId: string) =>
    ["app-server", "thread", threadId, "conversation", "turns"] as const,
  threadTurns: (threadId: string, params: object) =>
    [
      "app-server",
      "thread",
      threadId,
      "conversation",
      "turns",
      params,
    ] as const,
  threadItemsRoot: (threadId: string) =>
    ["app-server", "thread", threadId, "conversation", "items"] as const,
  threadItems: (threadId: string, params: object) =>
    [
      "app-server",
      "thread",
      threadId,
      "conversation",
      "items",
      params,
    ] as const,
  threadGoal: (threadId: string) =>
    ["app-server", "thread", threadId, "goal"] as const,
  threadAttachmentsRoot: (threadId: string) =>
    ["app-server", "thread", threadId, "attachments"] as const,
  threadAttachments: (threadId: string, params: object) =>
    ["app-server", "thread", threadId, "attachments", params] as const,
  threadQueueRoot: (threadId: string) =>
    ["app-server", "thread", threadId, "queue"] as const,
  threadQueue: (threadId: string, params: object) =>
    ["app-server", "thread", threadId, "queue", params] as const,
};
