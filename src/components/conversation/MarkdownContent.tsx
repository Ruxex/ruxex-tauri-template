import { code as codeHighlight } from "@streamdown/code";
import { mermaid } from "@streamdown/mermaid";
import { useEffect, useState } from "react";
import type { CustomRendererProps } from "streamdown";
import { defaultRehypePlugins, Streamdown } from "streamdown";

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
  code: codeHighlight,
  mermaid,
  renderers: [{ language: "diff", component: DiffCodeBlock }],
};

function getPrefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function MarkdownContent({
  isAnimating = false,
  text,
}: MarkdownContentProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    getPrefersReducedMotion,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  return (
    <Streamdown
      animated={
        isAnimating && !prefersReducedMotion
          ? { animation: "blurIn", duration: 180, sep: "word", stagger: 20 }
          : false
      }
      className="selectable-content markdown-body"
      codeBlockMaxHeight={0}
      controls={{
        code: { download: false },
        image: false,
        mermaid: false,
        table: false,
      }}
      data-chat-content="true"
      isAnimating={isAnimating && !prefersReducedMotion}
      mode={isAnimating && !prefersReducedMotion ? "streaming" : "static"}
      linkSafety={{ enabled: false }}
      lineNumbers={false}
      plugins={plugins}
      rehypePlugins={rehypePlugins}
      shikiTheme={["github-light", "github-dark"]}
    >
      {text}
    </Streamdown>
  );
}
