import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowUpOnSquareIcon, ArrowPathIcon, XMarkIcon } from "@heroicons/react/24/outline";

import { formatErrorMessage } from "@/app/error-message";
import { useAppServerStatus } from "@/app-server/queries";
import { useNativeModalDialog } from "@/components/base/common/useNativeModalDialog";
import { githubApi, type GitHubRemoteTarget } from "@/platform/github";
import { openBrowserWindow } from "@/platform/native";

export function ThreadPullRequestAction({ workspace, threadId }: { workspace: string; threadId: string }) {
  const { t } = useTranslation("github");
  const queryClient = useQueryClient();
  const status = useAppServerStatus();
  const [open, setOpen] = useState(false);
  const [remoteKey, setRemoteKey] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [baseBranch, setBaseBranch] = useState("");
  const [relatedIssues, setRelatedIssues] = useState("");
  const [draft, setDraft] = useState(false);
  const dialogRef = useNativeModalDialog(open);
  const relatedIssueTokens = relatedIssues.trim() ? relatedIssues.trim().split(/[ ,]+/) : [];
  const relatedIssuesValid = relatedIssueTokens.every((value) => /^\d+$/.test(value) && Number(value) > 0);
  const discovery = useQuery({
    queryKey: ["github", "discovery", workspace],
    queryFn: () => githubApi.discover(workspace),
    enabled: Boolean(workspace),
    retry: false,
  });
  const remotes = discovery.data?.remotes ?? [];
  const selected = useMemo(() => {
    const all = remotes.flatMap((remote) => remote.targets.map((target) => ({ remoteName: remote.name, target })));
    return (
      all.find(
        ({ remoteName, target }) => remoteKey === `${remoteName}:${target.host}/${target.owner}/${target.repository}`,
      ) ?? (all.length === 1 ? all[0] : null)
    );
  }, [remoteKey, remotes]);
  const selectedDiscovery = useQuery({
    queryKey: ["github", "discovery-selected", workspace, selected?.remoteName, selected?.target],
    queryFn: () => {
      if (!selected) throw new Error("Select a repository remote.");
      return githubApi.discover(workspace, selected.remoteName, selected.target);
    },
    enabled: Boolean(selected),
    retry: false,
  });
  const activeDiscovery = selected ? selectedDiscovery.data : discovery.data;
  const prepare = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error(t("chooseRepository"));
      return githubApi.preparePullRequest(workspace, selected.remoteName, selected.target);
    },
    onSuccess: (result) => {
      setBaseBranch(result.baseBranch);
      setTitle(result.commitSummaries[0] ?? result.branch);
      setBody(
        result.commitSummaries.length
          ? `## Summary\n\n${result.commitSummaries.map((summary) => `- ${summary}`).join("\n")}\n`
          : "## Summary\n\n",
      );
    },
  });
  const create = useMutation({
    mutationFn: () => {
      const preparation = prepare.data;
      if (!preparation || !selected) throw new Error(t("prepareFirst"));
      const issues = relatedIssueTokens.map(Number);
      return githubApi.createPullRequest({
        workspace,
        remoteName: selected.remoteName,
        remoteTarget: selected.target,
        baseBranch,
        title,
        body,
        draft,
        relatedIssues: issues,
        confirmed: true,
        ...(status.data?.homeDataDir
          ? { thread: { appServerConnectionId: `local:${status.data.homeDataDir}`, threadId } }
          : {}),
      });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: ["github", "thread-links", status.data?.homeDataDir, threadId],
      });
      setOpen(false);
      void openBrowserWindow(result.pullRequest.url);
    },
  });

  function begin() {
    setOpen(true);
    if (selected) prepare.mutate();
  }

  return (
    <>
      <button
        className="btn btn-ghost btn-sm mt-2 w-full justify-start"
        disabled={!["connected", "remoteSelectionRequired"].includes(activeDiscovery?.state ?? "")}
        onClick={begin}
        type="button"
      >
        <ArrowUpOnSquareIcon aria-hidden="true" className="size-4" />
        {t("preparePullRequest")}
      </button>
      {open && (
        <dialog
          aria-labelledby="create-pr-title"
          className="modal"
          ref={dialogRef}
          onCancel={(event) => {
            event.preventDefault();
            setOpen(false);
          }}
        >
          <div className="modal-box max-h-[90vh] w-full max-w-2xl overflow-y-auto overscroll-contain">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold" id="create-pr-title">
                  {t("reviewPullRequest")}
                </h2>
                <p className="mt-1 text-sm text-base-content/70">{t("pullRequestReviewDescription")}</p>
              </div>
              <button
                aria-label={t("closeDialog")}
                className="btn btn-ghost btn-sm btn-square"
                onClick={() => setOpen(false)}
                type="button"
              >
                <XMarkIcon aria-hidden="true" className="size-4" />
              </button>
            </div>
            {activeDiscovery?.state !== "connected" && (
              <p className="mt-4 text-sm text-error">
                {activeDiscovery?.state ? t(`discovery.${activeDiscovery.state}`) : t("checkingRepository")}
              </p>
            )}
            {remotes.length > 1 && (
              <label className="form-control mt-4">
                <span className="label-text mb-1">{t("repository")}</span>
                <select
                  className="select select-bordered"
                  value={
                    selected
                      ? `${selected.remoteName}:${selected.target.host}/${selected.target.owner}/${selected.target.repository}`
                      : ""
                  }
                  onChange={(event) => {
                    setRemoteKey(event.target.value);
                    prepare.reset();
                    create.reset();
                  }}
                >
                  {remotes.flatMap((remote) =>
                    remote.targets.map((target: GitHubRemoteTarget) => {
                      const key = `${remote.name}:${target.host}/${target.owner}/${target.repository}`;
                      return (
                        <option key={key} value={key}>
                          {target.owner}/{target.repository} · {remote.name}
                        </option>
                      );
                    }),
                  )}
                </select>
              </label>
            )}
            {selected && (
              <div className="mt-4 flex justify-end">
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={prepare.isPending}
                  onClick={() => prepare.mutate()}
                  type="button"
                >
                  <ArrowPathIcon aria-hidden="true" className="size-4" />
                  {t("prepareAgain")}
                </button>
              </div>
            )}
            {prepare.isPending && (
              <p className="mt-3 text-sm" role="status">
                {t("preparingPullRequest")}
              </p>
            )}
            {prepare.isError && (
              <p className="mt-3 text-sm text-error" role="alert">
                {t("requestError", { error: formatErrorMessage(prepare.error) })}
              </p>
            )}
            {prepare.data && (
              <>
                <dl className="mt-3 grid grid-cols-2 gap-2 rounded-box bg-base-200 p-3 text-sm">
                  <div>
                    <dt className="text-base-content/60">{t("branch")}</dt>
                    <dd className="truncate font-medium">{prepare.data.branch}</dd>
                  </div>
                  <div>
                    <dt className="text-base-content/60">{t("baseBranch")}</dt>
                    <dd>
                      <input
                        aria-label={t("baseBranch")}
                        className="input input-sm input-bordered w-full"
                        value={baseBranch}
                        onChange={(event) => setBaseBranch(event.target.value)}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-base-content/60">{t("commitsAhead")}</dt>
                    <dd>{prepare.data.aheadCommits}</dd>
                  </div>
                  <div>
                    <dt className="text-base-content/60">{t("diffSummary")}</dt>
                    <dd>{prepare.data.branchDiffSummary || t("noDiffSummary")}</dd>
                  </div>
                </dl>
                {prepare.data.hasUncommittedChanges && (
                  <p className="mt-3 rounded-box bg-warning/15 p-3 text-sm text-warning-content" role="alert">
                    {t("uncommittedChanges")}
                  </p>
                )}
                <form
                  className="mt-4 grid gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    create.mutate();
                  }}
                >
                  <label className="form-control">
                    <span className="label-text mb-1">{t("prTitle")}</span>
                    <input
                      className="input input-bordered"
                      required
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </label>
                  <label className="form-control">
                    <span className="label-text mb-1">{t("prBody")}</span>
                    <textarea
                      className="textarea textarea-bordered min-h-36"
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                    />
                  </label>
                  <label className="form-control">
                    <span className="label-text mb-1">{t("relatedIssueNumbers")}</span>
                    <input
                      aria-invalid={relatedIssueTokens.length > 0 && !relatedIssuesValid}
                      className="input input-bordered"
                      inputMode="numeric"
                      placeholder="12, 15"
                      value={relatedIssues}
                      onChange={(event) => setRelatedIssues(event.target.value)}
                    />
                    {relatedIssueTokens.length > 0 && !relatedIssuesValid && (
                      <span className="mt-1 text-sm text-error">{t("invalidIssueNumbers")}</span>
                    )}
                  </label>
                  <label className="label cursor-pointer justify-start gap-3">
                    <input
                      checked={draft}
                      className="checkbox checkbox-sm"
                      onChange={(event) => setDraft(event.target.checked)}
                      type="checkbox"
                    />
                    <span className="label-text">{t("createAsDraft")}</span>
                  </label>
                  <p className="text-xs text-base-content/65">
                    {t("pushConfirmation", { branch: prepare.data.branch })}
                  </p>
                  {create.isError && (
                    <p className="text-sm text-error" role="alert">
                      {t("requestError", { error: formatErrorMessage(create.error) })}
                    </p>
                  )}
                  <div className="modal-action mt-1">
                    <button className="btn btn-ghost" onClick={() => setOpen(false)} type="button">
                      {t("cancel")}
                    </button>
                    <button
                      className="btn btn-primary"
                      disabled={
                        create.isPending ||
                        prepare.data.hasUncommittedChanges ||
                        prepare.data.aheadCommits === 0 ||
                        !title.trim() ||
                        !relatedIssuesValid
                      }
                      type="submit"
                    >
                      {create.isPending ? t("creatingPullRequest") : t("pushAndCreate")}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
          <button
            aria-label={t("closeDialog")}
            className="modal-backdrop"
            onClick={() => setOpen(false)}
            type="button"
          >
            {t("closeDialog")}
          </button>
        </dialog>
      )}
    </>
  );
}
