import { invoke } from "@tauri-apps/api/core";

export type GitHubRepository = { host: string; owner: string; name: string; repositoryId?: string | null };
export type GitHubRemoteTarget = { host: string; owner: string; repository: string };
export type GitHubRemote = { name: string; targets: GitHubRemoteTarget[] };
export type GitHubDiscovery = {
  workspaceRoot: string;
  repositoryRoot: string | null;
  remotes: GitHubRemote[];
  state:
    | "notGitRepository"
    | "noRemotes"
    | "remoteSelectionRequired"
    | "ghMissing"
    | "authenticationRequired"
    | "connected";
  cliVersion: string | null;
};
export type GitHubIssue = {
  number: number;
  title: string;
  body: string | null;
  state: string;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  comments: number;
  labels: { name: string }[];
  user: { login: string } | null;
};
export type GitHubIssueDetail = {
  repository: GitHubRepository;
  issue: GitHubIssue;
  issueObject: GitHubObject;
  comments: { id: number; body: string; htmlUrl: string; createdAt: string; user: { login: string } | null }[];
};
export type GitHubPullRequest = {
  number: number;
  title: string;
  body: string | null;
  state: string;
  url: string;
  isDraft: boolean;
  reviewDecision: string | null;
  mergeable: string | null;
  mergeStateStatus: string | null;
  headRefName: string | null;
  baseRefName: string | null;
  headRefOid: string | null;
  checksState: string;
};
export type GitHubPullRequestDetail = {
  repository: GitHubRepository;
  pullRequest: GitHubPullRequest;
  pullRequestObject: GitHubObject;
};
export type GitHubObject = {
  repository: GitHubRepository;
  kind: "issue" | "pullRequest";
  number: number;
  nodeId?: string | null;
};
export type GitHubPullRequestIssueLink = { pullRequest: GitHubObject; issue: GitHubObject };
export type GitWorkspaceContext = {
  workspaceRoot: string;
  repositoryRoot: string | null;
  branch: string | null;
  headCommit: string | null;
  isLinkedWorktree: boolean;
  hasUncommittedChanges: boolean;
  diff: { files: number; added: number; deleted: number } | null;
};
export type GitHubThreadLink = {
  object: GitHubObject;
  thread: { appServerConnectionId: string; threadId: string };
  workspaceRoot: string;
  checkoutPath: string | null;
  branch: string | null;
};
export type GitHubPullRequestPreparation = {
  repository: GitHubRepository;
  workspaceRoot: string;
  repositoryRoot: string;
  branch: string;
  baseBranch: string;
  headCommit: string;
  aheadCommits: number;
  commitSummaries: string[];
  branchDiffSummary: string;
  hasUncommittedChanges: boolean;
  uncommittedDiff: GitWorkspaceContext["diff"];
};
export type GitHubIssueDraft = {
  draftId: string;
  title: string;
  body: string;
  labels?: string[];
  assignees?: string[];
  milestoneTitle?: string | null;
  priorityLabel?: string | null;
  parentDraftId?: string | null;
  dependsOn?: string[];
};
export type GitHubIssueDraftValidation = {
  repository: GitHubRepository;
  valid: boolean;
  errors: { draftId: string | null; message: string }[];
  warnings: { draftId: string | null; message: string }[];
  duplicates: { draftId: string; number: number; title: string; htmlUrl: string }[];
  creationOrder: string[];
};
export type GitHubIssueBatchCreateResult = {
  repository: GitHubRepository;
  created: { draftId: string; number: number; title: string; state: string; htmlUrl: string }[];
  remainingDraftIds: string[];
  failure: string | null;
};

export const githubApi = {
  discover: (workspace: string, remoteName?: string, remoteTarget?: GitHubRemoteTarget) =>
    invoke<GitHubDiscovery>("github_workspace_discover", {
      workspace,
      remoteName: remoteName ?? null,
      remoteTarget: remoteTarget ?? null,
    }),
  issues: (workspace: string, remoteName: string, remoteTarget: GitHubRemoteTarget, query = "") =>
    invoke<{
      repository: GitHubRepository;
      issues: GitHubIssue[];
      page: number;
      perPage: number;
      hasNextPage: boolean;
    }>("github_issue_list", {
      workspace,
      remoteName,
      remoteTarget,
      issueState: "open",
      query: query || null,
      page: 1,
      perPage: 50,
    }),
  issue: (workspace: string, remoteName: string, remoteTarget: GitHubRemoteTarget, number: number) =>
    invoke<GitHubIssueDetail>("github_issue_read", { workspace, remoteName, remoteTarget, number }),
  startIssueThread: (
    workspace: string,
    remoteName: string,
    remoteTarget: GitHubRemoteTarget,
    number: number,
    projectId: string,
  ) =>
    invoke<{ threadId: string; issue: GitHubObject }>("github_issue_thread_start", {
      workspace,
      remoteName,
      remoteTarget,
      number,
      projectId,
    }),
  pullRequests: (workspace: string, remoteName: string, remoteTarget: GitHubRemoteTarget, state = "open") =>
    invoke<{ repository: GitHubRepository; pullRequests: GitHubPullRequest[] }>("github_pull_request_list", {
      workspace,
      remoteName,
      remoteTarget,
      state,
    }),
  pullRequest: (workspace: string, remoteName: string, remoteTarget: GitHubRemoteTarget, number: number) =>
    invoke<GitHubPullRequestDetail>("github_pull_request_read", { workspace, remoteName, remoteTarget, number }),
  preparePullRequest: (workspace: string, remoteName: string, remoteTarget: GitHubRemoteTarget, baseBranch?: string) =>
    invoke<GitHubPullRequestPreparation>("github_pull_request_prepare", {
      workspace,
      remoteName,
      remoteTarget,
      baseBranch: baseBranch ?? null,
    }),
  createPullRequest: (params: {
    workspace: string;
    remoteName: string;
    remoteTarget: GitHubRemoteTarget;
    baseBranch: string;
    title: string;
    body: string;
    draft: boolean;
    relatedIssues: number[];
    confirmed: true;
    thread?: { appServerConnectionId: string; threadId: string };
  }) => invoke<GitHubPullRequestDetail>("github_pull_request_create", params),
  gitContext: (workspace: string) => invoke<GitWorkspaceContext>("git_workspace_context", { workspace }),
  threadLinks: (thread: { appServerConnectionId: string; threadId: string }) =>
    invoke<GitHubThreadLink[]>("github_thread_links_list", { thread }),
  objectThreadLinks: (object: GitHubObject) =>
    invoke<GitHubThreadLink[]>("github_object_thread_links_list", { object }),
  pullRequestIssueLinks: (pullRequest: GitHubObject) =>
    invoke<GitHubPullRequestIssueLink[]>("github_pull_request_issue_links_list", { pullRequest }),
  validateIssueDrafts: (
    workspace: string,
    remoteName: string,
    remoteTarget: GitHubRemoteTarget,
    drafts: GitHubIssueDraft[],
  ) =>
    invoke<GitHubIssueDraftValidation>("github_issue_drafts_validate", {
      workspace,
      remoteName,
      remoteTarget,
      drafts,
    }),
  createIssueDrafts: (
    workspace: string,
    remoteName: string,
    remoteTarget: GitHubRemoteTarget,
    drafts: GitHubIssueDraft[],
    allowDuplicates: boolean,
    thread?: { appServerConnectionId: string; threadId: string },
  ) =>
    invoke<GitHubIssueBatchCreateResult>("github_issue_drafts_create", {
      workspace,
      remoteName,
      remoteTarget,
      drafts,
      confirmed: true,
      allowDuplicates,
      thread: thread ?? null,
    }),
};
