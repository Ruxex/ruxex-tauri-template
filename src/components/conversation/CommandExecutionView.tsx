import { MarkdownContent } from "./MarkdownContent";

type CommandExecutionViewProps = {
  command: string;
  result: string;
};

export function CommandExecutionView({
  command,
  result,
}: CommandExecutionViewProps) {
  return (
    <div
      className="mb-3 overflow-hidden rounded-box border border-base-300 bg-base-100"
      data-testid="command-execution-content"
    >
      <pre className="overflow-x-auto whitespace-pre-wrap break-words bg-base-200 p-3 font-mono text-sm text-base-content">
        <code data-testid="command-execution-command">{command}</code>
      </pre>
      <div
        className="max-h-96 overflow-y-auto border-t border-base-300 bg-base-100 p-3"
        data-testid="command-execution-result"
      >
        <MarkdownContent text={result || "…"} />
      </div>
    </div>
  );
}
