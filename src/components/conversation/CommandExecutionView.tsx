import { MarkdownContent } from "./MarkdownContent";

type CommandExecutionViewProps = {
  command: string;
  result: string;
  status?: string;
  exitCode?: string;
};

export function CommandExecutionView({
  command,
  result,
  status,
  exitCode,
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
        className="border-t border-base-300 bg-base-100 p-3"
        data-testid="command-execution-result"
      >
        <MarkdownContent text={result || "…"} />
      </div>
      {(status || exitCode) && (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-base-300 bg-base-100 px-3 py-2 text-xs text-base-content/60"
          data-testid="command-execution-diagnostics"
        >
          {status && (
            <span>
              <span className="font-medium">status</span> {status}
            </span>
          )}
          {exitCode && (
            <span>
              <span className="font-medium">exit code</span> {exitCode}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
