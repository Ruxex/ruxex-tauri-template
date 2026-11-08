export const catalogThread = {
  id: "thread-catalog",
  name: "Product planning",
  preview: "Discuss the next release scope",
  model: "gpt-5",
  updatedAt: 0,
};

export const catalogProject = {
  id: "project-catalog",
  name: "Ruxex",
  root: "/workspace/ruxex",
  color: "violet",
  icon: "code",
};

export const catalogApproval = {
  requestId: 17,
  threadId: catalogThread.id,
  turnId: "turn-catalog",
  itemId: "item-catalog",
};

export const catalogMcpServer = {
  name: "filesystem",
  runtimeStatus: "connected",
  authStatus: "oAuth",
};

export const catalogPlugin = {
  id: "plugin-catalog",
  name: "Example plugin",
  description: "A deterministic plugin used by the component catalog.",
  version: "1.0.0",
};

export const catalogConversation = {
  id: "conversation-catalog",
  threadId: catalogThread.id,
  title: catalogThread.name,
};

export const noop = () => undefined;
export const noopAsync = async () => undefined;
