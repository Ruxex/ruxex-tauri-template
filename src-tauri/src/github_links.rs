use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::desktop::ruxex_home;
use crate::error::{CommandResult, DesktopAppServerErrorKind, command_error};
use crate::github::RemoteTarget;

const LINKS_FILE: &str = "github-links.json";
const CURRENT_SCHEMA_VERSION: u8 = 1;

#[derive(Default)]
pub(crate) struct GitHubLinkState {
    operations: Mutex<()>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitHubRepository {
    pub(crate) host: String,
    pub(crate) owner: String,
    pub(crate) name: String,
    #[serde(default)]
    pub(crate) repository_id: Option<String>,
}

impl From<RemoteTarget> for GitHubRepository {
    fn from(target: RemoteTarget) -> Self {
        Self {
            host: target.host,
            owner: target.owner,
            name: target.repository,
            repository_id: None,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceRepositoryBinding {
    pub(crate) workspace_root: String,
    pub(crate) repository_root: String,
    pub(crate) remote_name: String,
    pub(crate) repository: GitHubRepository,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum GitHubObjectKind {
    Issue,
    PullRequest,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitHubObject {
    pub(crate) repository: GitHubRepository,
    pub(crate) kind: GitHubObjectKind,
    pub(crate) number: u64,
    #[serde(default)]
    pub(crate) node_id: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentThreadReference {
    pub(crate) app_server_connection_id: String,
    pub(crate) thread_id: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitHubObjectThreadLink {
    pub(crate) object: GitHubObject,
    pub(crate) thread: AgentThreadReference,
    pub(crate) workspace_root: String,
    #[serde(default)]
    pub(crate) checkout_path: Option<String>,
    #[serde(default)]
    pub(crate) branch: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PullRequestIssueLink {
    pub(crate) pull_request: GitHubObject,
    pub(crate) issue: GitHubObject,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct GitHubLinksFile {
    schema_version: u8,
    #[serde(default)]
    repository_bindings: Vec<WorkspaceRepositoryBinding>,
    #[serde(default)]
    object_thread_links: Vec<GitHubObjectThreadLink>,
    #[serde(default)]
    pull_request_issue_links: Vec<PullRequestIssueLink>,
}

impl Default for GitHubLinksFile {
    fn default() -> Self {
        Self {
            schema_version: CURRENT_SCHEMA_VERSION,
            repository_bindings: Vec::new(),
            object_thread_links: Vec::new(),
            pull_request_issue_links: Vec::new(),
        }
    }
}

#[tauri::command]
pub(crate) fn github_repository_bindings_list(
    state: State<'_, GitHubLinkState>,
    workspace_root: Option<String>,
) -> CommandResult<Vec<WorkspaceRepositoryBinding>> {
    let _guard = lock(&state)?;
    let home = links_home()?;
    let file = load(&home)?;
    Ok(file
        .repository_bindings
        .into_iter()
        .filter(|binding| {
            workspace_root
                .as_deref()
                .is_none_or(|root| binding.workspace_root == root)
        })
        .collect())
}

#[tauri::command]
pub(crate) fn github_repository_binding_save(
    state: State<'_, GitHubLinkState>,
    binding: WorkspaceRepositoryBinding,
) -> CommandResult<WorkspaceRepositoryBinding> {
    let _guard = lock(&state)?;
    let home = links_home()?;
    let binding = normalize_binding(binding)?;
    let mut file = load(&home)?;
    file.repository_bindings.retain(|existing| {
        !(existing.workspace_root == binding.workspace_root
            && existing.repository_root == binding.repository_root
            && existing.remote_name == binding.remote_name
            && !same_repository(&existing.repository, &binding.repository))
    });
    if let Some(existing) = file.repository_bindings.iter_mut().find(|existing| {
        existing.workspace_root == binding.workspace_root
            && existing.repository_root == binding.repository_root
            && existing.remote_name == binding.remote_name
            && same_repository(&existing.repository, &binding.repository)
    }) {
        *existing = binding.clone();
    } else {
        file.repository_bindings.push(binding.clone());
    }
    save(&home, &file)?;
    Ok(binding)
}

#[tauri::command]
pub(crate) fn github_object_thread_links_list(
    state: State<'_, GitHubLinkState>,
    object: GitHubObject,
) -> CommandResult<Vec<GitHubObjectThreadLink>> {
    let _guard = lock(&state)?;
    let home = links_home()?;
    let object = normalize_object(object)?;
    Ok(load(&home)?
        .object_thread_links
        .into_iter()
        .filter(|link| same_object(&link.object, &object))
        .collect())
}

#[tauri::command]
pub(crate) fn github_thread_links_list(
    state: State<'_, GitHubLinkState>,
    thread: AgentThreadReference,
) -> CommandResult<Vec<GitHubObjectThreadLink>> {
    let _guard = lock(&state)?;
    let home = links_home()?;
    validate_thread(&thread)?;
    Ok(load(&home)?
        .object_thread_links
        .into_iter()
        .filter(|link| link.thread == thread)
        .collect())
}

#[tauri::command]
pub(crate) fn github_object_thread_link_add(
    state: State<'_, GitHubLinkState>,
    link: GitHubObjectThreadLink,
) -> CommandResult<GitHubObjectThreadLink> {
    add_object_thread_link(&state, link)
}

pub(crate) fn add_object_thread_link(
    state: &GitHubLinkState,
    link: GitHubObjectThreadLink,
) -> CommandResult<GitHubObjectThreadLink> {
    let _guard = lock(&state)?;
    let home = links_home()?;
    let link = normalize_object_thread_link(link)?;
    let mut file = load(&home)?;
    if !file.object_thread_links.iter().any(|existing| {
        same_object(&existing.object, &link.object) && existing.thread == link.thread
    }) {
        file.object_thread_links.push(link.clone());
        save(&home, &file)?;
    }
    Ok(link)
}

#[tauri::command]
pub(crate) fn github_object_thread_link_remove(
    state: State<'_, GitHubLinkState>,
    object: GitHubObject,
    thread: AgentThreadReference,
) -> CommandResult<()> {
    let _guard = lock(&state)?;
    let home = links_home()?;
    let object = normalize_object(object)?;
    validate_thread(&thread)?;
    let mut file = load(&home)?;
    let before = file.object_thread_links.len();
    file.object_thread_links
        .retain(|link| !(same_object(&link.object, &object) && link.thread == thread));
    if before != file.object_thread_links.len() {
        save(&home, &file)?;
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn github_pull_request_issue_links_list(
    state: State<'_, GitHubLinkState>,
    pull_request: GitHubObject,
) -> CommandResult<Vec<PullRequestIssueLink>> {
    let _guard = lock(&state)?;
    let home = links_home()?;
    let pull_request = normalize_object(pull_request)?;
    if pull_request.kind != GitHubObjectKind::PullRequest {
        return Err(invalid_data("object must be a pull request"));
    }
    Ok(load(&home)?
        .pull_request_issue_links
        .into_iter()
        .filter(|link| same_object(&link.pull_request, &pull_request))
        .collect())
}

#[tauri::command]
pub(crate) fn github_issue_pull_request_links_list(
    state: State<'_, GitHubLinkState>,
    issue: GitHubObject,
) -> CommandResult<Vec<PullRequestIssueLink>> {
    let _guard = lock(&state)?;
    let home = links_home()?;
    let issue = normalize_object(issue)?;
    if issue.kind != GitHubObjectKind::Issue {
        return Err(invalid_data("object must be an Issue"));
    }
    Ok(load(&home)?
        .pull_request_issue_links
        .into_iter()
        .filter(|link| same_object(&link.issue, &issue))
        .collect())
}

#[tauri::command]
pub(crate) fn github_pull_request_issue_link_add(
    state: State<'_, GitHubLinkState>,
    pull_request: GitHubObject,
    issue: GitHubObject,
) -> CommandResult<PullRequestIssueLink> {
    add_pull_request_issue_link_record(&state, pull_request, issue)
}

pub(crate) fn add_pull_request_issue_link_record(
    state: &GitHubLinkState,
    pull_request: GitHubObject,
    issue: GitHubObject,
) -> CommandResult<PullRequestIssueLink> {
    let _guard = lock(state)?;
    let home = links_home()?;
    let pull_request = normalize_object(pull_request)?;
    let issue = normalize_object(issue)?;
    if pull_request.kind != GitHubObjectKind::PullRequest || issue.kind != GitHubObjectKind::Issue {
        return Err(invalid_data("expected a pull request and an Issue"));
    }
    let link = PullRequestIssueLink {
        pull_request,
        issue,
    };
    let mut file = load(&home)?;
    if !file.pull_request_issue_links.iter().any(|existing| {
        same_object(&existing.pull_request, &link.pull_request)
            && same_object(&existing.issue, &link.issue)
    }) {
        file.pull_request_issue_links.push(link.clone());
        save(&home, &file)?;
    }
    Ok(link)
}

fn normalize_binding(
    mut binding: WorkspaceRepositoryBinding,
) -> CommandResult<WorkspaceRepositoryBinding> {
    binding.workspace_root = normalize_absolute_path(&binding.workspace_root, "workspace root")?;
    binding.repository_root = normalize_absolute_path(&binding.repository_root, "repository root")?;
    binding.remote_name = required_text(&binding.remote_name, "remote name")?;
    binding.repository = normalize_repository(binding.repository)?;
    Ok(binding)
}

fn normalize_object_thread_link(
    mut link: GitHubObjectThreadLink,
) -> CommandResult<GitHubObjectThreadLink> {
    link.object = normalize_object(link.object)?;
    link.workspace_root = normalize_absolute_path(&link.workspace_root, "workspace root")?;
    link.checkout_path = link
        .checkout_path
        .map(|path| normalize_absolute_path(&path, "checkout path"))
        .transpose()?;
    link.branch = link
        .branch
        .map(|branch| required_text(&branch, "branch"))
        .transpose()?;
    validate_thread(&link.thread)?;
    Ok(link)
}

fn normalize_object(mut object: GitHubObject) -> CommandResult<GitHubObject> {
    object.repository = normalize_repository(object.repository)?;
    if object.number == 0 {
        return Err(invalid_data("GitHub Issue/PR number must be positive"));
    }
    object.node_id = object
        .node_id
        .map(|node_id| required_text(&node_id, "GitHub node ID"))
        .transpose()?;
    Ok(object)
}

fn normalize_repository(mut repository: GitHubRepository) -> CommandResult<GitHubRepository> {
    repository.host = required_text(&repository.host, "repository host")?.to_ascii_lowercase();
    repository.owner = required_text(&repository.owner, "repository owner")?;
    repository.name = required_text(&repository.name, "repository name")?;
    repository.repository_id = repository
        .repository_id
        .map(|id| required_text(&id, "repository ID"))
        .transpose()?;
    Ok(repository)
}

fn validate_thread(thread: &AgentThreadReference) -> CommandResult<()> {
    required_text(&thread.app_server_connection_id, "App Server connection ID")?;
    required_text(&thread.thread_id, "thread ID")?;
    Ok(())
}

fn normalize_absolute_path(value: &str, label: &str) -> CommandResult<String> {
    let path = Path::new(value);
    if !path.is_absolute() {
        return Err(invalid_data(format!("{label} must be an absolute path")));
    }
    Ok(path
        .canonicalize()
        .unwrap_or_else(|_| path.to_path_buf())
        .display()
        .to_string())
}

fn required_text(value: &str, label: &str) -> CommandResult<String> {
    let value = value.trim();
    if value.is_empty() {
        return Err(invalid_data(format!("{label} must not be empty")));
    }
    Ok(value.to_string())
}

fn same_repository(left: &GitHubRepository, right: &GitHubRepository) -> bool {
    if !left.host.eq_ignore_ascii_case(&right.host) {
        return false;
    }
    match (&left.repository_id, &right.repository_id) {
        (Some(left_id), Some(right_id)) => left_id == right_id,
        _ => {
            left.owner.eq_ignore_ascii_case(&right.owner)
                && left.name.eq_ignore_ascii_case(&right.name)
        }
    }
}

fn same_object(left: &GitHubObject, right: &GitHubObject) -> bool {
    same_repository(&left.repository, &right.repository)
        && left.kind == right.kind
        && match (&left.node_id, &right.node_id) {
            (Some(left), Some(right)) => left == right,
            _ => left.number == right.number,
        }
}

fn lock(state: &GitHubLinkState) -> CommandResult<std::sync::MutexGuard<'_, ()>> {
    state.operations.lock().map_err(|_| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            "GitHub association store is unavailable",
        )
    })
}

fn links_home() -> CommandResult<PathBuf> {
    ruxex_home().map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))
}

fn links_path(home: &Path) -> PathBuf {
    home.join(LINKS_FILE)
}

fn load(home: &Path) -> CommandResult<GitHubLinksFile> {
    let path = links_path(home);
    if !path.exists() {
        return Ok(GitHubLinksFile::default());
    }
    let contents = fs::read_to_string(&path).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to read GitHub associations: {error}"),
        )
    })?;
    let mut file: GitHubLinksFile = serde_json::from_str(&contents).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Decode,
            format!("failed to decode GitHub associations: {error}"),
        )
    })?;
    if file.schema_version > CURRENT_SCHEMA_VERSION {
        return Err(command_error(
            DesktopAppServerErrorKind::Decode,
            "GitHub association data was created by a newer Ruxex version",
        ));
    }
    if file.schema_version == 0 {
        file.schema_version = CURRENT_SCHEMA_VERSION;
    }
    Ok(file)
}

fn save(home: &Path, file: &GitHubLinksFile) -> CommandResult<()> {
    fs::create_dir_all(home).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to create GitHub association home: {error}"),
        )
    })?;
    let path = links_path(home);
    let temporary = path.with_extension("json.tmp");
    let contents = serde_json::to_string_pretty(file).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Decode,
            format!("failed to encode GitHub associations: {error}"),
        )
    })?;
    fs::write(&temporary, format!("{contents}\n")).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to write GitHub associations: {error}"),
        )
    })?;
    fs::rename(&temporary, &path).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to replace GitHub associations: {error}"),
        )
    })
}

fn invalid_data(message: impl Into<String>) -> crate::error::DesktopAppServerError {
    command_error(DesktopAppServerErrorKind::Initialization, message)
}
