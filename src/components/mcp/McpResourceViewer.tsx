import type { v2 } from "../../protocol";
import { formatErrorMessage } from "../../app/error-message";

type McpResourceViewerProps = {
  response?: v2.McpResourceReadResponse;
  isLoading?: boolean;
  error?: unknown;
};

export function McpResourceViewer({
  response,
  isLoading = false,
  error,
}: McpResourceViewerProps) {
  if (isLoading) {
    return <p role="status">Loading Resource…</p>;
  }

  if (error) {
    return (
      <p role="alert">
        Unable to read MCP Resource: {formatErrorMessage(error)}
      </p>
    );
  }

  if (!response?.contents.length) {
    return <p role="status">No Resource content.</p>;
  }

  return (
    <div className="space-y-3" data-testid="mcp-resource-viewer">
      {response.contents.map((content) => {
        if ("text" in content) {
          return (
            <pre
              className="max-h-96 overflow-auto whitespace-pre-wrap rounded-box bg-base-200 p-3 text-xs"
              data-testid="mcp-resource-text"
              key={`text:${content.uri}`}
            >
              {formatTextContent(content.text)}
            </pre>
          );
        }

        return (
          <div
            className="rounded-box bg-base-200 p-3 text-sm"
            key={`blob:${content.uri}`}
          >
            <p className="font-medium">Binary content</p>
            <p className="text-xs text-base-content/60">
              {content.mimeType ?? "MIME type unavailable"}
            </p>
            <p className="text-xs text-base-content/60">
              {content.blob.length} base64 characters
            </p>
          </div>
        );
      })}
    </div>
  );
}

function formatTextContent(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
