import { useTranslation } from "react-i18next";
import {
  CodeBracketIcon,
  FolderOpenIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { formatErrorMessage } from "../../app/error-message";
import { useWorktrees } from "../../app-server/hooks";

export function WorktreeCard({ root }: { root: string }) {
  const { t } = useTranslation("projects");

  const worktrees = useWorktrees(root);
  const [branch, setBranch] = useState("");
  const [force, setForce] = useState(false);

  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <div>
          <h2 className="card-title">
            <CodeBracketIcon aria-hidden="true" className="size-5" />
            {t("gitWorktrees")}
          </h2>
          <p className="text-sm text-base-content/70">
            {t("repository", { path: root })}
          </p>
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
            aria-label={t("worktreeBranch")}
            className="input input-bordered input-sm"
            onChange={(event) => setBranch(event.target.value)}
            placeholder={t("worktreeBranchPlaceholder")}
            value={branch}
          />
          <button
            aria-label={t("createWorktree")}
            className="btn btn-sm btn-primary gap-1"
            disabled={worktrees.create.isPending}
            type="submit"
          >
            <PlusIcon aria-hidden="true" className="size-4" />
            {t("createWorktree")}
          </button>
        </form>
        <label className="label cursor-pointer justify-start gap-2">
          <input
            aria-label={t("forceRemovalOfDirtyWorktrees")}
            checked={force}
            className="checkbox checkbox-sm"
            onChange={(event) => setForce(event.target.checked)}
            type="checkbox"
          />
          <span className="label-text">
            {t("forceRemovalOfDirtyWorktrees")}
          </span>
        </label>
        {worktrees.query.isLoading && (
          <span className="loading loading-spinner" />
        )}
        {worktrees.query.isError && (
          <p className="text-sm text-error">
            {t("worktreesError", {
              error: formatErrorMessage(worktrees.query.error),
            })}
          </p>
        )}
        <ul className="space-y-2">
          {worktrees.query.data?.map((worktree) => {
            const label = worktree.branch ?? t("detachedBranch");
            return (
              <li
                className="flex flex-wrap items-center justify-between gap-2 rounded-box bg-base-200 p-3"
                key={worktree.path}
              >
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-base-content/60">
                    {worktree.path} · {worktree.clean ? t("clean") : t("dirty")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <span
                    className={`badge ${worktree.clean ? "badge-success" : "badge-warning"}`}
                  >
                    {worktree.clean ? t("clean") : t("dirty")}
                  </span>
                  <button
                    aria-label={t("openWorktree", { name: label })}
                    className="btn btn-xs btn-ghost gap-1"
                    onClick={() => worktrees.open.mutate(worktree.path)}
                    type="button"
                  >
                    <FolderOpenIcon aria-hidden="true" className="size-4" />
                    {t("open")}
                  </button>
                  <button
                    aria-label={t("removeWorktree", { name: label })}
                    className="btn btn-xs btn-ghost gap-1 text-error"
                    onClick={() =>
                      worktrees.remove.mutate({ path: worktree.path, force })
                    }
                    type="button"
                  >
                    <TrashIcon aria-hidden="true" className="size-4" />
                    {t("remove")}
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
