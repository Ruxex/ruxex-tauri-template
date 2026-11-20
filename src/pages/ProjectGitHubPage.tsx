import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { v2 } from "@/protocol";
import { ArrowTopRightOnSquareIcon, ArrowPathIcon, MagnifyingGlassIcon, PlayIcon } from "@heroicons/react/24/outline";
import { Link, useNavigate, useParams } from "react-router-dom";

import { formatErrorMessage } from "@/app/error-message";
import { useCreateThread, useProject, useProjectThreads, useSendMessage, useSkillsList } from "@/app-server/hooks";
import { useAppServerStatus } from "@/app-server/queries";
import { ErrorState, LoadingState } from "@/components/base/common/AsyncState";
import { useNativeModalDialog } from "@/components/base/common/useNativeModalDialog";
import { PageContainer } from "@/components/feature/layout/PageContainer";
import { openBrowserWindow } from "@/platform/native";
import { githubApi, type GitHubIssueDraft, type GitHubRemoteTarget } from "@/platform/github";

type View = "issues" | "pullRequests";

export function ProjectGitHubPage() {
  const { t } = useTranslation("github");
  const { projectId = "" } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const project = useProject(projectId);
  const projectThreads = useProjectThreads(projectId);
  const availableSkills = useSkillsList();
  const [workspace, setWorkspace] = useState("");
  const [remoteKey, setRemoteKey] = useState("");
  const [view, setView] = useState<View>("issues");
  const [pullRequestState, setPullRequestState] = useState("open");
  const [query, setQuery] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<number | null>(null);
  const createThread = useCreateThread();
  const sendMessage = useSendMessage();
  const planningSkill = availableSkills.data?.data
    .flatMap((entry) => entry.skills)
    .find((skill) => skill.name === "requirements-planning" && skill.enabled);

  const roots = project.data?.project.roots ?? [];
  const activeWorkspace = roots.find((root) => root.path === workspace)?.path ?? roots[0]?.path ?? "";
  const discovery = useQuery({
    queryKey: ["github", "discovery", activeWorkspace],
    queryFn: () => githubApi.discover(activeWorkspace),
    enabled: Boolean(activeWorkspace),
    retry: false,
  });
  const remotes = discovery.data?.remotes ?? [];
  const selectedRemote = useMemo(() => {
    const candidates = remotes.flatMap((remote) =>
      remote.targets.map((target) => ({ remoteName: remote.name, target })),
    );
    const requested = candidates.find(
      ({ remoteName, target }) => remoteKey === `${remoteName}:${target.host}/${target.owner}/${target.repository}`,
    );
    return requested ?? (candidates.length === 1 ? candidates[0] : null);
  }, [remoteKey, remotes]);
  const remoteTarget = selectedRemote?.target;
  const selectedDiscovery = useQuery({
    queryKey: ["github", "discovery-selected", activeWorkspace, selectedRemote?.remoteName, remoteTarget],
    queryFn: () => {
      if (!selectedRemote || !remoteTarget) throw new Error("Select a repository remote.");
      return githubApi.discover(activeWorkspace, selectedRemote.remoteName, remoteTarget);
    },
    enabled: Boolean(activeWorkspace && selectedRemote),
    retry: false,
  });
  const activeDiscovery = selectedRemote ? selectedDiscovery.data : discovery.data;
  const issueList = useQuery({
    queryKey: ["github", "issues", activeWorkspace, selectedRemote?.remoteName, remoteTarget, query],
    queryFn: () => {
      if (!selectedRemote || !remoteTarget) throw new Error("Select a repository remote.");
      return githubApi.issues(activeWorkspace, selectedRemote.remoteName, remoteTarget, query);
    },
    enabled: Boolean(activeWorkspace && selectedRemote && activeDiscovery?.state === "connected" && view === "issues"),
    retry: false,
  });
  const pullRequests = useQuery({
    queryKey: ["github", "pull-requests", activeWorkspace, selectedRemote?.remoteName, remoteTarget, pullRequestState],
    queryFn: () => {
      if (!selectedRemote || !remoteTarget) throw new Error("Select a repository remote.");
      return githubApi.pullRequests(activeWorkspace, selectedRemote.remoteName, remoteTarget, pullRequestState);
    },
    enabled: Boolean(
      activeWorkspace && selectedRemote && activeDiscovery?.state === "connected" && view === "pullRequests",
    ),
    retry: false,
  });
  const issueDetail = useQuery({
    queryKey: ["github", "issue", activeWorkspace, selectedRemote?.remoteName, remoteTarget, selectedIssue],
    queryFn: () => {
      if (!selectedRemote || !remoteTarget || selectedIssue === null) throw new Error("Select an Issue.");
      return githubApi.issue(activeWorkspace, selectedRemote.remoteName, remoteTarget, selectedIssue);
    },
    enabled: Boolean(selectedIssue && selectedRemote && view === "issues"),
    retry: false,
  });
  const issueThreadLinks = useQuery({
    queryKey: ["github", "issue-thread-links", issueDetail.data?.issueObject],
    queryFn: () => {
      if (!issueDetail.data?.issueObject) throw new Error("Select an Issue.");
      return githubApi.objectThreadLinks(issueDetail.data.issueObject);
    },
    enabled: Boolean(issueDetail.data?.issueObject),
    retry: false,
  });
  const startIssue = useMutation({
    mutationFn: (number: number) => {
      if (!selectedRemote || !remoteTarget) throw new Error("Select a repository remote.");
      return githubApi.startIssueThread(activeWorkspace, selectedRemote.remoteName, remoteTarget, number, projectId);
    },
    onSuccess: (result) => navigate(`/chat/${result.threadId}`),
  });
  const planIssues = async () => {
    if (!activeWorkspace) return;
    try {
      const thread = await createThread.mutateAsync({ cwd: activeWorkspace, projectId });
      await sendMessage.mutateAsync({
        threadId: thread.thread.id,
        cwd: activeWorkspace,
        input: [
          ...(planningSkill ? [{ type: "skill" as const, name: planningSkill.name, path: planningSkill.path }] : []),
          { type: "text", text: t("planningPrompt"), text_elements: [] },
        ],
      });
      navigate(`/chat/${thread.thread.id}`);
    } catch {
      // Mutation errors are shown in the action status below.
    }
  };

  if (project.isLoading) return <LoadingState />;
  if (project.isError || !project.data) return <ErrorState>{t("projectLoadError")}</ErrorState>;

  const stateMessage = activeDiscovery?.state ? t(`discovery.${activeDiscovery.state}`) : null;
  const discoveryError = discovery.isError ? formatErrorMessage(discovery.error) : null;
  const activeError = view === "issues" ? issueList.error : pullRequests.error;

  return (
    <PageContainer>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link className="link link-hover text-sm" to={`/projects/${encodeURIComponent(projectId)}`}>
            {project.data.project.name}
          </Link>
          <h1 className="mt-1 text-3xl font-semibold">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-base-content/70">{t("description")}</p>
        </div>
        <button
          className="btn btn-outline"
          disabled={!activeWorkspace || createThread.isPending || sendMessage.isPending}
          onClick={() => void planIssues()}
          type="button"
        >
          <PlayIcon aria-hidden="true" className="size-4" />
          {t("planIssues")}
        </button>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="form-control">
          <span className="label-text mb-1 text-sm font-medium">{t("workspace")}</span>
          <select
            className="select select-bordered w-full"
            value={activeWorkspace}
            onChange={(event) => {
              setWorkspace(event.target.value);
              setRemoteKey("");
              setSelectedIssue(null);
            }}
          >
            {roots.map((root) => (
              <option key={root.path} value={root.path}>
                {root.path}
              </option>
            ))}
          </select>
        </label>
        <label className="form-control">
          <span className="label-text mb-1 text-sm font-medium">{t("repository")}</span>
          <select
            className="select select-bordered w-full"
            disabled={!remotes.length}
            value={
              selectedRemote
                ? `${selectedRemote.remoteName}:${selectedRemote.target.host}/${selectedRemote.target.owner}/${selectedRemote.target.repository}`
                : ""
            }
            onChange={(event) => {
              setRemoteKey(event.target.value);
              setSelectedIssue(null);
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
      </div>

      {!roots.length && <p className="mt-5 rounded-box bg-base-200 p-4 text-sm">{t("noWorkspaces")}</p>}
      {activeWorkspace && discovery.isLoading && (
        <div className="mt-6">
          <LoadingState />
        </div>
      )}
      {discoveryError && (
        <p className="mt-5 text-sm text-error" role="alert">
          {t("requestError", { error: discoveryError })}
        </p>
      )}
      {stateMessage && activeDiscovery?.state !== "connected" && (
        <div
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-box bg-base-200 p-4 text-sm"
          role="status"
        >
          <span>{stateMessage}</span>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => void (selectedRemote ? selectedDiscovery.refetch() : discovery.refetch())}
            type="button"
          >
            <ArrowPathIcon aria-hidden="true" className="size-4" />
            {t("retry")}
          </button>
        </div>
      )}
      {activeDiscovery?.state === "connected" && !selectedRemote && (
        <p className="mt-5 rounded-box bg-base-200 p-4 text-sm">{t("chooseRepository")}</p>
      )}
      {activeDiscovery?.state === "connected" && selectedRemote && (
        <>
          <div className="mt-4 flex justify-end">
            <IssueDraftBatchDialog
              key={`${activeWorkspace}:${selectedRemote.remoteName}:${selectedRemote.target.host}/${selectedRemote.target.owner}/${selectedRemote.target.repository}`}
              workspace={activeWorkspace}
              remoteName={selectedRemote.remoteName}
              remoteTarget={selectedRemote.target}
              threads={projectThreads.data?.data ?? []}
              t={t}
            />
          </div>
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-b border-base-300">
            <div className="flex gap-1">
              {(["issues", "pullRequests"] as const).map((tab) => (
                <button
                  aria-pressed={view === tab}
                  className={`btn btn-sm rounded-b-none ${view === tab ? "btn-primary" : "btn-ghost"}`}
                  key={tab}
                  onClick={() => setView(tab)}
                  type="button"
                >
                  {t(tab)}
                </button>
              ))}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => (view === "issues" ? void issueList.refetch() : void pullRequests.refetch())}
              type="button"
            >
              <ArrowPathIcon aria-hidden="true" className="size-4" />
              {t("refresh")}
            </button>
          </div>
          {view === "issues" ? (
            <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
              <section aria-label={t("issues")}>
                <label className="input input-bordered flex items-center gap-2">
                  <MagnifyingGlassIcon aria-hidden="true" className="size-4 opacity-60" />
                  <span className="sr-only">{t("searchIssues")}</span>
                  <input
                    aria-label={t("searchIssues")}
                    className="grow"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("searchPlaceholder")}
                    value={query}
                  />
                </label>
                {issueList.isLoading && (
                  <div className="mt-4">
                    <LoadingState />
                  </div>
                )}
                {issueList.isError && (
                  <p className="mt-4 text-sm text-error" role="alert">
                    {t("requestError", { error: formatErrorMessage(issueList.error) })}
                  </p>
                )}
                <ul className="mt-3 divide-y divide-base-300 rounded-box border border-base-300">
                  {(issueList.data?.issues ?? []).map((issue) => (
                    <li key={issue.number}>
                      <button
                        aria-current={selectedIssue === issue.number ? "true" : undefined}
                        className="w-full px-4 py-3 text-left hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary"
                        onClick={() => setSelectedIssue(issue.number)}
                        type="button"
                      >
                        <span className="block font-medium">{issue.title}</span>
                        <span className="mt-1 block text-xs text-base-content/65">
                          #{issue.number} · {issue.state}
                          {issue.labels.map((label) => (
                            <span className="ml-2 rounded bg-base-200 px-1.5 py-0.5" key={label.name}>
                              {label.name}
                            </span>
                          ))}
                        </span>
                      </button>
                    </li>
                  ))}
                  {!issueList.isLoading && !issueList.isError && issueList.data?.issues.length === 0 && (
                    <li className="p-4 text-sm text-base-content/70">{t("noIssues")}</li>
                  )}
                </ul>
              </section>
              <IssueDetailPanel
                detail={issueDetail.data}
                threadLinks={issueThreadLinks.data ?? []}
                loading={issueDetail.isLoading}
                error={issueDetail.error}
                onStart={() => selectedIssue && startIssue.mutate(selectedIssue)}
                onOpenThread={(threadId) => navigate(`/chat/${threadId}`)}
                startPending={startIssue.isPending}
                t={t}
              />
            </div>
          ) : (
            <section aria-label={t("pullRequests")} className="mt-5">
              <label className="form-control mb-3 max-w-xs">
                <span className="label-text mb-1 text-sm font-medium">{t("filterPullRequests")}</span>
                <select
                  className="select select-bordered select-sm"
                  onChange={(event) => setPullRequestState(event.target.value)}
                  value={pullRequestState}
                >
                  <option value="open">{t("state.open")}</option>
                  <option value="closed">{t("state.closed")}</option>
                  <option value="merged">{t("state.merged")}</option>
                  <option value="all">{t("state.all")}</option>
                </select>
              </label>
              {pullRequests.isLoading && <LoadingState />}
              {pullRequests.isError && (
                <p className="text-sm text-error" role="alert">
                  {t("requestError", { error: formatErrorMessage(activeError) })}
                </p>
              )}
              <section
                aria-label={t("pullRequests")}
                className="overflow-x-auto overscroll-x-contain rounded-box border border-base-300"
                // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to focus this region to scroll the table horizontally.
                tabIndex={0}
              >
                <table className="table table-sm">
                  <caption className="sr-only">{t("pullRequests")}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t("number")}</th>
                      <th scope="col">{t("title")}</th>
                      <th scope="col">{t("status")}</th>
                      <th scope="col">{t("checks")}</th>
                      <th scope="col">{t("review")}</th>
                      <th scope="col">{t("mergeability")}</th>
                      <th scope="col">{t("relations")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pullRequests.data?.pullRequests ?? []).map((pr) => (
                      <tr key={pr.number}>
                        <td>
                          <a
                            className="link link-hover"
                            href={pr.url}
                            onClick={(event) => {
                              event.preventDefault();
                              void openBrowserWindow(pr.url);
                            }}
                          >
                            #{pr.number}
                          </a>
                        </td>
                        <td className="min-w-56">
                          {pr.title}
                          {pr.isDraft && <span className="ml-2 badge badge-sm">{t("draft")}</span>}
                        </td>
                        <td>{pr.state}</td>
                        <td>{t(`checkState.${pr.checksState}`, { defaultValue: pr.checksState })}</td>
                        <td>
                          {t(`reviewState.${pr.reviewDecision ?? "none"}`, {
                            defaultValue: pr.reviewDecision ?? t("notReviewed"),
                          })}
                        </td>
                        <td>{pr.mergeStateStatus ?? pr.mergeable ?? t("unknown")}</td>
                        <td>
                          {pullRequests.data?.repository && (
                            <PullRequestAssociations
                              repository={pullRequests.data.repository}
                              number={pr.number}
                              onOpenThread={(threadId) => navigate(`/chat/${threadId}`)}
                              t={t}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!pullRequests.isLoading && !pullRequests.isError && pullRequests.data?.pullRequests.length === 0 && (
                  <p className="p-4 text-sm text-base-content/70">{t("noPullRequests")}</p>
                )}
              </section>
            </section>
          )}
          {(startIssue.isError || createThread.isError || sendMessage.isError) && (
            <p className="mt-3 text-sm text-error" role="alert">
              {t("requestError", {
                error: formatErrorMessage(startIssue.error ?? createThread.error ?? sendMessage.error),
              })}
            </p>
          )}
        </>
      )}
    </PageContainer>
  );
}

function PullRequestAssociations({
  repository,
  number,
  onOpenThread,
  t,
}: {
  repository: { host: string; owner: string; name: string };
  number: number;
  onOpenThread: (threadId: string) => void;
  t: TFunction<"github">;
}) {
  const object = useMemo(() => ({ repository, kind: "pullRequest" as const, number }), [number, repository]);
  const issues = useQuery({
    queryKey: ["github", "pr-issues", object],
    queryFn: () => githubApi.pullRequestIssueLinks(object),
  });
  const threads = useQuery({
    queryKey: ["github", "pr-threads", object],
    queryFn: () => githubApi.objectThreadLinks(object),
  });
  return (
    <div className="flex min-w-36 flex-wrap gap-x-2 gap-y-1 text-xs">
      {issues.data?.map((link) => (
        <a
          className="link link-hover whitespace-nowrap"
          href={`https://${repository.host}/${repository.owner}/${repository.name}/issues/${link.issue.number}`}
          key={`issue:${link.issue.number}`}
          onClick={(event) => {
            event.preventDefault();
            void openBrowserWindow(
              `https://${repository.host}/${repository.owner}/${repository.name}/issues/${link.issue.number}`,
            );
          }}
        >
          #{link.issue.number}
        </a>
      ))}
      {threads.data?.map((link) => (
        <button
          className="link link-hover whitespace-nowrap"
          key={link.thread.threadId}
          onClick={() => onOpenThread(link.thread.threadId)}
          type="button"
        >
          {t("agentThreadShort", { id: link.thread.threadId.slice(0, 6) })}
        </button>
      ))}
      {!issues.data?.length && !threads.data?.length && <span className="text-base-content/50">—</span>}
    </div>
  );
}

function IssueDraftBatchDialog({
  workspace,
  remoteName,
  remoteTarget,
  threads,
  t,
}: {
  workspace: string;
  remoteName: string;
  remoteTarget: GitHubRemoteTarget;
  threads: v2.Thread[];
  t: TFunction<"github">;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [source, setSource] = useState("");
  const [validatedSource, setValidatedSource] = useState("");
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const dialogRef = useNativeModalDialog(isOpen);
  const appServer = useAppServerStatus();
  const [planningThreadId, setPlanningThreadId] = useState("");
  const validate = useMutation({
    mutationFn: (drafts: GitHubIssueDraft[]) =>
      githubApi.validateIssueDrafts(workspace, remoteName, remoteTarget, drafts),
  });
  const create = useMutation({
    mutationFn: (drafts: GitHubIssueDraft[]) =>
      githubApi.createIssueDrafts(
        workspace,
        remoteName,
        remoteTarget,
        drafts,
        allowDuplicates,
        planningThreadId && appServer.data?.homeDataDir
          ? { appServerConnectionId: `local:${appServer.data.homeDataDir}`, threadId: planningThreadId }
          : undefined,
      ),
  });
  const drafts = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(source);
      const list = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && "drafts" in parsed
          ? (parsed as { drafts: unknown }).drafts
          : null;
      return Array.isArray(list) && list.every((item) => item !== null && typeof item === "object")
        ? (list as GitHubIssueDraft[])
        : null;
    } catch {
      return null;
    }
  }, [source]);

  function validateDrafts() {
    if (!drafts?.length) return;
    setValidatedSource("");
    validate.mutate(drafts, { onSuccess: () => setValidatedSource(source) });
  }
  function createDrafts() {
    if (drafts?.length && validatedSource === source && validate.data?.valid) create.mutate(drafts);
  }

  return (
    <>
      <button className="btn btn-outline btn-sm" onClick={() => setIsOpen(true)} type="button">
        {t("reviewIssueDrafts")}
      </button>
      {isOpen && (
        <dialog
          aria-labelledby="issue-drafts-title"
          className="modal"
          ref={dialogRef}
          onCancel={(event) => {
            event.preventDefault();
            setIsOpen(false);
          }}
        >
          <div className="modal-box max-h-[90vh] w-full max-w-3xl overflow-y-auto overscroll-contain">
            <h2 className="text-lg font-semibold" id="issue-drafts-title">
              {t("reviewIssueDrafts")}
            </h2>
            <p className="mt-1 text-sm text-base-content/70">{t("issueDraftsHelp")}</p>
            {threads.length > 0 && (
              <label className="form-control mt-3 max-w-xl">
                <span className="label-text mb-1">{t("linkPlanningThread")}</span>
                <select
                  className="select select-bordered select-sm"
                  onChange={(event) => setPlanningThreadId(event.target.value)}
                  value={planningThreadId}
                >
                  <option value="">{t("noPlanningThread")}</option>
                  {threads.map((thread) => (
                    <option key={thread.id} value={thread.id}>
                      {thread.preview || thread.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="form-control mt-4">
              <span className="label-text mb-1">{t("issueDraftJson")}</span>
              <textarea
                aria-invalid={source.length > 0 && !drafts}
                className="textarea textarea-bordered min-h-60 font-mono text-xs"
                onChange={(event) => {
                  setSource(event.target.value);
                  setValidatedSource("");
                  setAllowDuplicates(false);
                  validate.reset();
                  create.reset();
                }}
                placeholder={t("issueDraftJsonPlaceholder")}
                value={source}
              />
            </label>
            {source && !drafts && (
              <p className="mt-2 text-sm text-error" role="alert">
                {t("invalidDraftJson")}
              </p>
            )}
            {drafts && (
              <section aria-label={t("draftPreview")} className="mt-4">
                <h3 className="font-medium">{t("draftPreview")}</h3>
                <ol className="mt-2 list-decimal space-y-2 pl-5">
                  {drafts.map((draft, index) => (
                    <li key={draft.draftId ?? index}>
                      <span className="font-medium">
                        {typeof draft.title === "string" && draft.title ? draft.title : t("untitledDraft")}
                      </span>
                      <p className="whitespace-pre-wrap text-sm text-base-content/70">
                        {typeof draft.body === "string" ? draft.body : ""}
                      </p>
                      <span className="text-xs text-base-content/60">
                        {Array.isArray(draft.labels)
                          ? draft.labels.filter((label) => typeof label === "string").join(", ")
                          : ""}
                        {draft.parentDraftId ? ` · ${t("parentDraft", { id: draft.parentDraftId })}` : ""}
                        {Array.isArray(draft.dependsOn) && draft.dependsOn.length
                          ? ` · ${t("dependsOn", { ids: draft.dependsOn.join(", ") })}`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {validate.isError && (
              <p className="mt-3 text-sm text-error" role="alert">
                {t("requestError", { error: formatErrorMessage(validate.error) })}
              </p>
            )}
            {validate.data && validatedSource === source && (
              <section className="mt-4 rounded-box bg-base-200 p-3" aria-live="polite">
                <h3 className="font-medium">{validate.data.valid ? t("draftsValidated") : t("draftsNeedChanges")}</h3>
                {[...validate.data.errors, ...validate.data.warnings].map((problem, index) => (
                  <p
                    className={`mt-1 text-sm ${index < validate.data.errors.length ? "text-error" : "text-warning-content"}`}
                    key={`${problem.draftId}:${problem.message}`}
                  >
                    {problem.draftId ? `${problem.draftId}: ` : ""}
                    {problem.message}
                  </p>
                ))}
                {validate.data.duplicates.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium">{t("possibleDuplicates")}</p>
                    <ul className="list-disc pl-5 text-sm">
                      {validate.data.duplicates.map((duplicate) => (
                        <li key={`${duplicate.draftId}:${duplicate.number}`}>
                          <a
                            className="link"
                            href={duplicate.htmlUrl}
                            onClick={(event) => {
                              event.preventDefault();
                              void openBrowserWindow(duplicate.htmlUrl);
                            }}
                          >
                            {duplicate.title} (#{duplicate.number})
                          </a>
                        </li>
                      ))}
                    </ul>
                    <label className="label cursor-pointer justify-start gap-2">
                      <input
                        checked={allowDuplicates}
                        className="checkbox checkbox-sm"
                        onChange={(event) => setAllowDuplicates(event.target.checked)}
                        type="checkbox"
                      />
                      <span className="label-text">{t("allowDuplicates")}</span>
                    </label>
                  </div>
                )}
              </section>
            )}
            {create.isError && (
              <p className="mt-3 text-sm text-error" role="alert">
                {t("requestError", { error: formatErrorMessage(create.error) })}
              </p>
            )}
            {create.data && (
              <section className="mt-4 rounded-box bg-success/10 p-3" role="status">
                <p className="font-medium">{t("createdIssues", { count: create.data.created.length })}</p>
                {create.data.created.map((issue) => (
                  <p key={issue.draftId}>
                    <a
                      className="link"
                      href={issue.htmlUrl}
                      onClick={(event) => {
                        event.preventDefault();
                        void openBrowserWindow(issue.htmlUrl);
                      }}
                    >
                      #{issue.number} {issue.title}
                    </a>
                  </p>
                ))}
                {create.data.failure && (
                  <p className="mt-2 text-error">{t("partialCreateFailure", { error: create.data.failure })}</p>
                )}
              </section>
            )}
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setIsOpen(false)} type="button">
                {t("cancel")}
              </button>
              <button
                className="btn btn-outline"
                disabled={!drafts?.length || validate.isPending}
                onClick={validateDrafts}
                type="button"
              >
                {validate.isPending ? t("validatingDrafts") : t("validateDrafts")}
              </button>
              <button
                className="btn btn-primary"
                disabled={
                  !validate.data?.valid ||
                  validatedSource !== source ||
                  (validate.data.duplicates.length > 0 && !allowDuplicates) ||
                  create.isPending
                }
                onClick={createDrafts}
                type="button"
              >
                {create.isPending ? t("creatingIssues") : t("confirmCreateIssues")}
              </button>
            </div>
          </div>
          <button aria-label={t("cancel")} className="modal-backdrop" onClick={() => setIsOpen(false)} type="button">
            {t("cancel")}
          </button>
        </dialog>
      )}
    </>
  );
}

function IssueDetailPanel({
  detail,
  threadLinks,
  loading,
  error,
  onStart,
  startPending,
  onOpenThread,
  t,
}: {
  detail?: Awaited<ReturnType<typeof githubApi.issue>>;
  threadLinks: Awaited<ReturnType<typeof githubApi.objectThreadLinks>>;
  loading: boolean;
  error: unknown;
  onStart: () => void;
  startPending: boolean;
  onOpenThread: (threadId: string) => void;
  t: TFunction<"github">;
}) {
  if (loading)
    return (
      <div className="rounded-box bg-base-200 p-4">
        <LoadingState />
      </div>
    );
  if (error)
    return (
      <p className="text-sm text-error" role="alert">
        {t("requestError", { error: formatErrorMessage(error) })}
      </p>
    );
  if (!detail) return <p className="rounded-box bg-base-200 p-4 text-sm text-base-content/70">{t("selectIssue")}</p>;
  return (
    <article className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{detail.issue.title}</h2>
          <p className="mt-1 text-xs text-base-content/65">
            #{detail.issue.number} · {detail.issue.state}
          </p>
        </div>
        <a
          aria-label={t("openOnGitHub")}
          className="btn btn-ghost btn-sm btn-square"
          href={detail.issue.htmlUrl}
          onClick={(event) => {
            event.preventDefault();
            void openBrowserWindow(detail.issue.htmlUrl);
          }}
        >
          <ArrowTopRightOnSquareIcon aria-hidden="true" className="size-4" />
        </a>
      </div>
      <div className="prose prose-sm mt-4 max-w-none whitespace-pre-wrap break-words">
        {detail.issue.body || t("emptyIssueBody")}
      </div>
      {threadLinks.length > 0 && (
        <section className="mt-5">
          <h3 className="font-medium">{t("relatedAgentThreads")}</h3>
          <ul className="mt-1 space-y-1">
            {threadLinks.map((link) => (
              <li key={`${link.thread.appServerConnectionId}:${link.thread.threadId}`}>
                <button
                  className="link link-hover text-sm"
                  onClick={() => onOpenThread(link.thread.threadId)}
                  type="button"
                >
                  {t("openAgentThread", { id: link.thread.threadId.slice(0, 8) })}
                  {link.branch ? ` · ${link.branch}` : ""}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <h3 className="mt-6 font-medium">{t("comments", { count: detail.comments.length })}</h3>
      <ul className="mt-2 space-y-3">
        {detail.comments.map((comment) => (
          <li className="rounded-box bg-base-200 p-3" key={comment.id}>
            <p className="text-xs font-medium">{comment.user?.login ?? t("unknownAuthor")}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{comment.body}</p>
          </li>
        ))}
      </ul>
      <button className="btn btn-primary mt-5 w-full" disabled={startPending} onClick={onStart} type="button">
        <PlayIcon aria-hidden="true" className="size-4" />
        {startPending ? t("startingAgent") : t("startAgent")}
      </button>
    </article>
  );
}
