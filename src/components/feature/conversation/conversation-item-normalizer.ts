import type { TFunction } from "i18next";
import { i18n } from "@/app/i18n";
import type { v2 } from "@/protocol";
import type { ConversationViewItem } from "./conversation-model";

export function normalizeThreadItem(
  turnId: string,
  item: v2.ThreadItem,
  assistantName?: string,
  t: TFunction = i18n.getFixedT(null, "conversation"),
): ConversationViewItem {
  switch (item.type) {
    case "userMessage": {
      const text = item.content
        .filter((content) => content.type === "text")
        .map((content) => content.text)
        .join("\n");
      return {
        id: item.id,
        turnId,
        type: item.type,
        category: "message",
        title: t("you"),
        text,
        editable:
          item.content.length > 0 &&
          item.content.every((content) => content.type === "text") &&
          text.trim().length > 0,
      };
    }
    case "agentMessage":
      return {
        id: item.id,
        turnId,
        type: item.type,
        category: "message",
        title: assistantName ?? t("assistant"),
        text: item.text,
      };
    case "plan":
      return messageActivity(item.id, turnId, item.type, t("plan"), item.text);
    case "reasoning":
      return messageActivity(
        item.id,
        turnId,
        item.type,
        t("reasoning"),
        [...item.summary, ...item.content].join("\n"),
      );
    case "commandExecution":
      return {
        ...messageActivity(
          item.id,
          turnId,
          item.type,
          t("command"),
          item.aggregatedOutput || item.command,
          compactMetadata({
            command: item.command,
            cwd: item.cwd,
            status: item.status,
            exitCode: item.exitCode,
          }),
        ),
        ...findArtifactOutput(item.aggregatedOutput),
      };
    case "fileChange":
      return messageActivity(
        item.id,
        turnId,
        item.type,
        t("changes"),
        item.changes.length > 0
          ? item.changes.map((change) => JSON.stringify(change)).join("\n")
          : t("noFileChangesRecorded"),
        compactMetadata({ status: item.status, files: item.changes.length }),
      );
    case "mcpToolCall":
      return messageActivity(
        item.id,
        turnId,
        item.type,
        t("mcpToolTitle", { server: item.server, tool: item.tool }),
        item.error ? JSON.stringify(item.error) : item.result ? JSON.stringify(item.result) : t("toolCallCompleted"),
        compactMetadata({
          server: item.server,
          tool: item.tool,
          status: item.status,
        }),
      );
    case "dynamicToolCall": {
      const imageUrls = (item.contentItems ?? []).flatMap((content) =>
        content.type === "inputImage" ? [content.imageUrl] : [],
      );
      const browserUrl = findHttpUrl(item.arguments);
      return {
        ...messageActivity(
          item.id,
          turnId,
          item.type,
          t("toolName", { tool: item.tool }),
          safeJson(item.arguments),
          compactMetadata({
            namespace: item.namespace,
            status: item.status,
            success: item.success === null ? null : String(item.success),
          }),
        ),
        ...(imageUrls.length > 0 ? { imageUrls } : {}),
        ...(browserUrl ? { browserUrl } : {}),
      };
    }
    case "imageView":
      return {
        ...messageActivity(item.id, turnId, item.type, t("screenshot"), item.path),
        imagePath: item.path,
      };
    case "collabAgentToolCall":
      return messageActivity(
        item.id,
        turnId,
        item.type,
        t("agentCollaboration"),
        item.prompt || t("toolName", { tool: item.tool }),
        compactMetadata({
          tool: item.tool,
          status: item.status,
          agents: item.receiverThreadIds.length,
        }),
      );
    default:
      return messageActivity(item.id, turnId, item.type, t("activity"), safeJson(item));
  }
}

export function liveActivityTitle(type: string, t: TFunction = i18n.getFixedT(null, "conversation")): string {
  switch (type) {
    case "commandExecution":
      return t("command");
    case "fileChange":
      return t("changes");
    case "mcpToolCall":
      return t("mcpTool");
    case "dynamicToolCall":
      return t("tool");
    case "plan":
      return t("plan");
    case "reasoning":
      return t("reasoning");
    case "imageView":
      return t("screenshot");
    case "collabAgentToolCall":
      return t("agentCollaboration");
    default:
      return t("activity");
  }
}

function messageActivity(
  id: string,
  turnId: string,
  type: string,
  title: string,
  text: string,
  metadata?: Record<string, string>,
): ConversationViewItem {
  return { id, turnId, type, category: "activity", title, text, metadata };
}

function compactMetadata(values: Record<string, string | number | null>): Record<string, string> | undefined {
  const entries = Object.entries(values).filter(([, value]) => value !== null && value !== "");
  return entries.length > 0 ? Object.fromEntries(entries.map(([key, value]) => [key, String(value)])) : undefined;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return i18n.t("conversation:thisActivityCannotBePreviewed");
  }
}

function findArtifactOutput(output: string | null): Pick<ConversationViewItem, "artifactPath" | "artifactFormat"> {
  if (!output) return {};
  for (const line of output.split(/\r?\n/).reverse()) {
    try {
      const value = JSON.parse(line) as {
        format?: unknown;
        output?: unknown;
        artifactPath?: unknown;
      };
      const artifactPath =
        typeof value.artifactPath === "string"
          ? value.artifactPath
          : typeof value.output === "string"
            ? value.output
            : null;
      const artifactFormat = typeof value.format === "string" ? value.format : undefined;
      if (artifactPath && artifactFormat) {
        return { artifactPath, artifactFormat };
      }
    } catch {
      // Only explicit JSON output is an artifact signal; ordinary command text is unchanged.
    }
  }
  return {};
}

function findHttpUrl(value: unknown): string | undefined {
  if (typeof value === "string") {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
    } catch {
      return undefined;
    }
  }
  if (Array.isArray(value)) {
    return value.map(findHttpUrl).find((url): url is string => Boolean(url));
  }
  if (value && typeof value === "object") {
    return Object.values(value)
      .map(findHttpUrl)
      .find((url): url is string => Boolean(url));
  }
  return undefined;
}
