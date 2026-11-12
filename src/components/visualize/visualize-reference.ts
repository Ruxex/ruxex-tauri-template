export type VisualizeReference = {
  path: string;
  mode: "regular" | "wide";
};

export type MessageSegment =
  | { type: "markdown"; text: string }
  | { type: "visualize"; reference: VisualizeReference };

const visualizeToken = /visualize(\{[\s\S]*?\})/g;

export function parseVisualizeReferences(text: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let cursor = 0;
  let markdown = "";

  function appendMarkdown(value: string) {
    markdown += value;
  }

  function flushMarkdown() {
    if (!markdown) return;
    segments.push({ type: "markdown", text: markdown });
    markdown = "";
  }

  for (const match of text.matchAll(visualizeToken)) {
    const fullMatch = match[0] ?? "";
    const index = match.index ?? cursor;
    appendMarkdown(text.slice(cursor, index));
    const reference = parseReference(match[1]);
    if (reference) {
      flushMarkdown();
      segments.push({ type: "visualize", reference });
    } else {
      appendMarkdown(fullMatch);
    }
    cursor = index + fullMatch.length;
  }

  appendMarkdown(text.slice(cursor));
  flushMarkdown();
  return segments.length > 0
    ? segments
    : [{ type: "markdown", text }];
}

function parseReference(value: string | undefined): VisualizeReference | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;

    const candidate = parsed as { path?: unknown; mode?: unknown };
    if (typeof candidate.path !== "string" || candidate.path.length === 0) {
      return null;
    }
    if (
      candidate.mode !== undefined &&
      candidate.mode !== "regular" &&
      candidate.mode !== "wide"
    ) {
      return null;
    }

    return {
      path: candidate.path,
      mode: candidate.mode === "wide" ? "wide" : "regular",
    };
  } catch {
    return null;
  }
}
