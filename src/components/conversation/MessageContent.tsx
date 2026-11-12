import { Fragment } from "react";

import { MarkdownContent } from "./MarkdownContent";
import { VisualizeFrame } from "../visualize/VisualizeFrame";
import { parseVisualizeReferences } from "../visualize/visualize-reference";

export function MessageContent({ text }: { text: string }) {
  const segments = parseVisualizeReferences(text);
  if (segments.length === 1 && segments[0]?.type === "markdown") {
    return <MarkdownContent text={segments[0].text} />;
  }

  return (
    <div className="space-y-3">
      {segments.map((segment, index) => (
        <Fragment key={`${segment.type}-${index}`}>
          {segment.type === "markdown" ? (
            <MarkdownContent text={segment.text} />
          ) : (
            <VisualizeFrame reference={segment.reference} />
          )}
        </Fragment>
      ))}
    </div>
  );
}
