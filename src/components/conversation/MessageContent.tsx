import { Fragment } from "react";
import { VisualizeFrame } from "../visualize/VisualizeFrame";
import { parseVisualizeReferences } from "../visualize/visualize-reference";
import { MarkdownContent } from "./MarkdownContent";

export function MessageContent({
  isAnimating = false,
  text,
}: {
  isAnimating?: boolean;
  text: string;
}) {
  const segments = parseVisualizeReferences(text);
  if (segments.length === 1 && segments[0]?.type === "markdown") {
    return <MarkdownContent isAnimating={isAnimating} text={segments[0].text} />;
  }

  const segmentKeys = new Map<string, number>();
  return (
    <div className="space-y-3">
      {segments.map((segment) => {
        const baseKey =
          segment.type === "markdown"
            ? `markdown-${segment.text}`
            : `visualize-${segment.reference.path}-${segment.reference.mode}`;
        const occurrence = segmentKeys.get(baseKey) ?? 0;
        segmentKeys.set(baseKey, occurrence + 1);
        return (
          <Fragment key={`${baseKey}-${occurrence}`}>
            {segment.type === "markdown" ? (
              <MarkdownContent
                isAnimating={isAnimating}
                text={segment.text}
              />
            ) : (
              <VisualizeFrame reference={segment.reference} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
