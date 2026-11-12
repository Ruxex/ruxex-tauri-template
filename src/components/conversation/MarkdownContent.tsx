import { mermaid } from "@streamdown/mermaid";
import { defaultRehypePlugins, Streamdown } from "streamdown";
import type { CustomRendererProps } from "streamdown";

type MarkdownContentProps = {
  isAnimating?: boolean;
  text: string;
};

const rehypePlugins = [
  defaultRehypePlugins.sanitize,
  defaultRehypePlugins.harden,
];

function DiffCodeBlock({ code }: CustomRendererProps) {
  const codeText = code;
  const lines = codeText.split("\n");
  let offset = 0;
  return (
    <code data-language="diff">
      {lines.map((line) => {
        const lineOffset = offset;
        offset += line.length + 1;
        const kind = line.startsWith("+")
          ? "added"
          : line.startsWith("-")
            ? "removed"
            : "context";
        return (
          <span
            className={
              kind === "added"
                ? "block bg-success/20"
                : kind === "removed"
                  ? "block bg-error/20"
                  : "block"
            }
            data-testid={`diff-${kind}`}
            key={`${lineOffset}-${line}`}
          >
            {line}
            {lineOffset + line.length === codeText.length ? "" : "\n"}
          </span>
        );
      })}
    </code>
  );
}

const plugins = {
  mermaid,
  renderers: [{ language: "diff", component: DiffCodeBlock }],
};

export function MarkdownContent({
  isAnimating = false,
  text,
}: MarkdownContentProps) {
  return (
    <Streamdown
      animated={
        isAnimating
          ? { animation: "blurIn", duration: 180, sep: "word", stagger: 20 }
          : false
      }
      className="selectable-content leading-7"
      codeBlockMaxHeight={0}
      controls={false}
      data-chat-content="true"
      isAnimating={isAnimating}
      mode={isAnimating ? "streaming" : "static"}
      linkSafety={{ enabled: false }}
      lineNumbers={false}
      plugins={plugins}
      rehypePlugins={rehypePlugins}
    >
      {text}
    </Streamdown>
  );
}
