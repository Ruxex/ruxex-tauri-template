import { useState } from "react";

import { useWorktrees } from "../../app-server/hooks";

export function WorktreeCard({ root }: { root: string }) {
  const worktrees = useWorktrees(root);
  const [branch, setBranch] = useState("");
  const [force, setForce] = useState(false);

  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <div>
          <h2 className="card-title">Git worktrees</h2>
          <p className="text-sm text-base-content/70">Repository: {root}</p>
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = branch.trim();
            if (value)
              worktrees.create.mutate({
                root,
                branch: value,
                destination: `${root.replace(/\/$/, "")}/.worktrees/${value}`,
              });
          }}
        >
          <input
            aria-label="Worktree branch"
            className="input input-bordered input-sm"
            onChange={(event) => setBranch(event.target.value)}
            placeholder="branch-name"
            value={branch}
          />
          <button
            className="btn btn-sm btn-primary"
            disabled={worktrees.create.isPending}
            type="submit"
          >
            Create worktree
          </button>
        </form>
        <label className="label cursor-pointer justify-start gap-2">
          <input
            checked={force}
            className="checkbox checkbox-sm"
            onChange={(event) => setForce(event.target.checked)}
            type="checkbox"
          />
          <span className="label-text">Force removal of dirty worktrees</span>
        </label>
        {worktrees.query.isLoading && (
          <span className="loading loading-spinner" />
        )}
        {worktrees.query.isError && (
          <p className="text-sm text-error">
            Unable to load worktrees: {String(worktrees.query.error)}
          </p>
        )}
        <ul className="space-y-2">
          {worktrees.query.data?.map((worktree) => {
            const label = worktree.branch ?? "detached";
            return (
              <li
                className="flex flex-wrap items-center justify-between gap-2 rounded-box bg-base-200 p-3"
                key={worktree.path}
              >
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-base-content/60">
                    {worktree.path} · {worktree.clean ? "Clean" : "Dirty"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <span
                    className={`badge ${worktree.clean ? "badge-success" : "badge-warning"}`}
                  >
                    {worktree.clean ? "Clean" : "Dirty"}
                  </span>
                  <button
                    aria-label={`Open ${label}`}
                    className="btn btn-xs btn-ghost"
                    onClick={() => worktrees.open.mutate(worktree.path)}
                    type="button"
                  >
                    Open
                  </button>
                  <button
                    aria-label={`Remove ${label}`}
                    className="btn btn-xs btn-ghost text-error"
                    onClick={() =>
                      worktrees.remove.mutate({ path: worktree.path, force })
                    }
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
