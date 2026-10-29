import { createElement, type ReactNode } from "react";

type MarkdownContentProps = {
  text: string;
};

type CodeBlock = {
  language: string;
  text: string;
};

function renderInline(text: string): ReactNode[] {
  const parts = text.split(
    /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*[^*]+\*)/g,
  );

  let offset = 0;
  return parts.map((part) => {
    const key = `${offset}-${part}`;
    offset += part.length;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code className="rounded bg-base-300 px-1 py-0.5 text-sm" key={key}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("[") && part.includes("](") && part.endsWith(")")) {
      const separator = part.indexOf("](");
      const label = part.slice(1, separator);
      const href = part.slice(separator + 2, -1);
      return (
        <a
          className="link link-primary"
          href={href}
          key={key}
          rel="noreferrer"
          target="_blank"
        >
          {label}
        </a>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return <span key={key}>{part}</span>;
  });
}

function CodeBlockView({ block }: { block: CodeBlock }) {
  if (block.language.toLowerCase() !== "diff") {
    return (
      <pre className="overflow-x-auto rounded-box bg-neutral p-4 text-sm text-neutral-content">
        <code
          data-testid="fenced-code"
          data-language={block.language || undefined}
        >
          {block.text}
        </code>
      </pre>
    );
  }

  return (
    <pre className="overflow-x-auto rounded-box bg-neutral p-0 text-sm text-neutral-content">
      <code data-language="diff">
        {(() => {
          let offset = 0;
          return block.text.split("\n").map((line) => {
            const lineOffset = offset;
            const isLast = lineOffset + line.length === block.text.length;
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
                {isLast ? "" : "\n"}
              </span>
            );
          });
        })()}
      </code>
    </pre>
  );
}

export function MarkdownContent({ text }: MarkdownContentProps) {
  const lines = text.split("\n");
  const blocks: Array<
    | { type: "paragraph"; text: string }
    | { type: "heading"; level: number; text: string }
    | { type: "list"; items: string[] }
    | { type: "code"; block: CodeBlock }
  > = [];
  let paragraph: string[] = [];
  let index = 0;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join("\n") });
      paragraph = [];
    }
  };

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      flushParagraph();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]?.startsWith("```")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      blocks.push({
        type: "code",
        block: { language: fence[1]?.trim() ?? "", text: codeLines.join("\n") },
      });
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: heading[1]?.length ?? 1,
        text: heading[2] ?? "",
      });
      index += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\s*[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
    } else {
      paragraph.push(line);
    }
    index += 1;
  }
  flushParagraph();

  return (
    <div
      className="selectable-content space-y-3 leading-7"
      data-chat-content="true"
    >
      {blocks.map((block) => {
        const blockKey =
          block.type === "code"
            ? `code-${block.block.language}-${block.block.text}`
            : block.type === "list"
              ? `list-${block.items.join("\n")}`
              : `${block.type}-${block.text}`;
        if (block.type === "code") {
          return <CodeBlockView block={block.block} key={blockKey} />;
        }
        if (block.type === "heading") {
          const headingTag = `h${block.level}` as
            | "h1"
            | "h2"
            | "h3"
            | "h4"
            | "h5"
            | "h6";
          return createElement(
            headingTag,
            {
              className: "font-semibold leading-tight",
              key: blockKey,
            },
            renderInline(block.text),
          );
        }
        if (block.type === "list") {
          return (
            <ul className="list-disc space-y-1 pl-6" key={blockKey}>
              {block.items.map((item) => (
                <li key={item}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p className="whitespace-pre-wrap" key={blockKey}>
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
