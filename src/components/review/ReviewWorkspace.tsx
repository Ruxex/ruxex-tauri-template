import { formatErrorMessage } from "../../app/error-message";

export type ReviewFileChange = {
  id: string;
  metadata?: Record<string, string>;
  text: string;
};

export type ReviewMutationState = {
  data?: unknown;
  error?: unknown;
  isError: boolean;
  isPending: boolean;
};

type ReviewWorkspaceProps = {
  branch?: string | null;
  changedFiles: ReviewFileChange[];
  onStartReview: () => void;
  review: ReviewMutationState;
  threadId: string;
  worktree?: { clean: boolean; path: string };
  workspacePath?: string | null;
};

export function ReviewWorkspace({
  branch,
  changedFiles,
  onStartReview,
  review,
  threadId,
  worktree,
  workspacePath,
}: ReviewWorkspaceProps) {
  return (
    <section
      aria-label={`Review context for ${threadId}`}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Review</h3>
          <p className="text-sm text-base-content/65">
            Review the changes reported by this task.
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          disabled={review.isPending}
          onClick={onStartReview}
        >
          {review.isPending ? "Starting review…" : "Start review"}
        </button>
      </div>
      <dl className="grid gap-2 rounded-box bg-base-200 p-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-base-content/60">Workspace</dt>
          <dd className="truncate" title={workspacePath ?? undefined}>
            {workspacePath ?? "Workspace unavailable"}
          </dd>
        </div>
        <div>
          <dt className="text-base-content/60">Branch</dt>
          <dd>{branch ?? "Branch unavailable"}</dd>
        </div>
        <div>
          <dt className="text-base-content/60">Worktree</dt>
          <dd>
            {worktree
              ? `${worktree.clean ? "Clean" : "Dirty"} worktree`
              : "Working tree status unavailable"}
          </dd>
        </div>
      </dl>
      {review.isError && (
        <p className="alert alert-error" role="alert">
          {formatErrorMessage(review.error)}
        </p>
      )}
      {review.isPending && (
        <p className="text-sm text-info" role="status">
          Review is starting…
        </p>
      )}
      {Boolean(review.data) && (
        <p className="text-sm text-success" role="status">
          Review started
        </p>
      )}
      <div>
        <h4 className="font-medium">Changed files</h4>
        {changedFiles.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {changedFiles.map((change) => (
              <li className="rounded-box bg-base-200 p-3" key={change.id}>
                <p className="font-mono text-sm">{change.text}</p>
                {change.metadata && (
                  <p className="mt-1 text-xs text-base-content/60">
                    {Object.entries(change.metadata)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-base-content/60">
            No file changes reported yet.
          </p>
        )}
      </div>
    </section>
  );
}
