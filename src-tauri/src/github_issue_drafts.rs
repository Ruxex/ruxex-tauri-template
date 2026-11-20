use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use crate::error::{CommandResult, DesktopAppServerErrorKind, command_error};
use crate::git_context;
use crate::github::{
    RemoteTarget, ensure_connected, gh_api, gh_api_write, repository_root, resolve_repository,
};
use crate::github_links::{
    AgentThreadReference, GitHubLinkState, GitHubObject, GitHubObjectKind, GitHubObjectThreadLink,
    GitHubRepository, add_object_thread_link,
};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitHubIssueDraft {
    pub(crate) draft_id: String,
    pub(crate) title: String,
    pub(crate) body: String,
    #[serde(default)]
    pub(crate) labels: Vec<String>,
    #[serde(default)]
    pub(crate) assignees: Vec<String>,
    #[serde(default)]
    pub(crate) milestone_title: Option<String>,
    #[serde(default)]
    pub(crate) priority_label: Option<String>,
    #[serde(default)]
    pub(crate) parent_draft_id: Option<String>,
    #[serde(default)]
    pub(crate) depends_on: Vec<String>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitHubIssueDraftProblem {
    pub(crate) draft_id: Option<String>,
    pub(crate) message: String,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitHubIssueDuplicate {
    pub(crate) draft_id: String,
    pub(crate) number: u64,
    pub(crate) title: String,
    pub(crate) html_url: String,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitHubIssueDraftValidation {
    pub(crate) repository: GitHubRepository,
    pub(crate) valid: bool,
    pub(crate) errors: Vec<GitHubIssueDraftProblem>,
    pub(crate) warnings: Vec<GitHubIssueDraftProblem>,
    pub(crate) duplicates: Vec<GitHubIssueDuplicate>,
    pub(crate) creation_order: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitHubCreatedIssue {
    pub(crate) draft_id: String,
    pub(crate) number: u64,
    pub(crate) title: String,
    pub(crate) state: String,
    pub(crate) html_url: String,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitHubIssueBatchCreateResult {
    pub(crate) repository: GitHubRepository,
    pub(crate) created: Vec<GitHubCreatedIssue>,
    pub(crate) remaining_draft_ids: Vec<String>,
    pub(crate) failure: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitHubLabelRecord {
    name: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitHubMilestoneRecord {
    number: u64,
    title: String,
}

#[tauri::command]
pub(crate) fn github_issue_drafts_validate(
    workspace: String,
    remote_name: Option<String>,
    remote_target: Option<RemoteTarget>,
    drafts: Vec<GitHubIssueDraft>,
) -> CommandResult<GitHubIssueDraftValidation> {
    let (discovery, _remote_name, target) =
        resolve_repository(&workspace, remote_name.as_deref(), remote_target.as_ref())?;
    ensure_connected(&discovery)?;
    let root = repository_root(&discovery)?;
    validate_drafts(&target, &root, &drafts)
}

#[tauri::command]
pub(crate) fn github_issue_drafts_create(
    links: State<'_, GitHubLinkState>,
    workspace: String,
    remote_name: Option<String>,
    remote_target: Option<RemoteTarget>,
    thread: Option<AgentThreadReference>,
    drafts: Vec<GitHubIssueDraft>,
    confirmed: bool,
    allow_duplicates: bool,
) -> CommandResult<GitHubIssueBatchCreateResult> {
    if !confirmed {
        return Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            "Issue batch creation requires explicit confirmation",
        ));
    }
    let (discovery, _remote_name, target) =
        resolve_repository(&workspace, remote_name.as_deref(), remote_target.as_ref())?;
    ensure_connected(&discovery)?;
    let root = repository_root(&discovery)?;
    let context = git_context::workspace_context(Path::new(&discovery.workspace_root))?;
    let validation = validate_drafts(&target, &root, &drafts)?;
    if !validation.valid {
        return Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            "Issue drafts failed validation; resolve the validation errors before creating them",
        ));
    }
    if !allow_duplicates && !validation.duplicates.is_empty() {
        return Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            "possible duplicate Issues were found; review them and explicitly allow duplicates to continue",
        ));
    }

    let milestones = repository_milestones(&root, &target)?;
    let milestone_numbers = milestones
        .into_iter()
        .map(|item| (item.title, item.number))
        .collect::<HashMap<_, _>>();
    let drafts_by_id = drafts
        .iter()
        .map(|draft| (draft.draft_id.clone(), draft))
        .collect::<HashMap<_, _>>();
    let mut created_by_draft = HashMap::<String, GitHubCreatedIssue>::new();
    let mut created_bodies = HashMap::<String, String>::new();
    let mut created = Vec::new();
    let mut failure = None;

    for draft_id in &validation.creation_order {
        let draft = drafts_by_id[draft_id];
        let mut body = draft.body.clone();
        let dependencies = draft
            .depends_on
            .iter()
            .filter_map(|dependency| created_by_draft.get(dependency))
            .map(|issue| format!("- #{} — {}", issue.number, issue.title))
            .collect::<Vec<_>>();
        if !dependencies.is_empty() {
            body.push_str("\n\n## Dependencies\n");
            body.push_str(&dependencies.join("\n"));
        }
        created_bodies.insert(draft.draft_id.clone(), body.clone());

        let endpoint = format!("repos/{}/{}/issues", target.owner, target.repository);
        let mut command = vec![("title", draft.title.trim().to_string()), ("body", body)];
        for label in effective_labels(draft) {
            command.push(("labels[]", label));
        }
        for assignee in effective_assignees(draft) {
            command.push(("assignees[]", assignee));
        }
        if let Some(title) = draft
            .milestone_title
            .as_ref()
            .map(|title| title.trim())
            .filter(|title| !title.is_empty())
        {
            if let Some(number) = milestone_numbers.get(title) {
                command.push(("milestone", number.to_string()));
            }
        }
        let fields = command
            .iter()
            .map(|(key, value)| (*key, value.clone()))
            .collect::<Vec<_>>();
        let response = match gh_api_write(&root, &target.host, &endpoint, "POST", &fields) {
            Ok(response) => response,
            Err(error) => {
                failure = Some(format!(
                    "failed to create draft `{}` after {} Issue(s): {}",
                    draft.draft_id,
                    created.len(),
                    error.message
                ));
                break;
            }
        };
        let issue = match decode_created_issue(&response, &draft.draft_id) {
            Ok(issue) => issue,
            Err(error) => {
                failure = Some(format!(
                    "GitHub created draft `{}` after {} Issue(s), but its response could not be decoded: {}",
                    draft.draft_id,
                    created.len(),
                    error.message
                ));
                break;
            }
        };
        created_by_draft.insert(draft.draft_id.clone(), issue.clone());
        created.push(issue);
        if let (Some(thread), Some(issue)) = (thread.as_ref(), created.last()) {
            if let Err(error) = add_object_thread_link(
                &links,
                GitHubObjectThreadLink {
                    object: GitHubObject {
                        repository: GitHubRepository::from(target.clone()),
                        kind: GitHubObjectKind::Issue,
                        number: issue.number,
                        node_id: None,
                    },
                    thread: thread.clone(),
                    workspace_root: context.workspace_root.clone(),
                    checkout_path: Some(context.workspace_root.clone()),
                    branch: context.branch.clone(),
                },
            ) {
                failure = Some(format!(
                    "Issue #{} was created, but its planning-thread association could not be saved: {}",
                    issue.number, error.message
                ));
                break;
            }
        }
    }

    if failure.is_none() {
        for parent in drafts.iter().filter(|draft| {
            drafts
                .iter()
                .any(|child| child.parent_draft_id.as_deref() == Some(&draft.draft_id))
        }) {
            let Some(parent_issue) = created_by_draft.get(&parent.draft_id) else {
                continue;
            };
            let task_items = drafts
                .iter()
                .filter(|child| child.parent_draft_id.as_deref() == Some(&parent.draft_id))
                .filter_map(|child| {
                    created_by_draft
                        .get(&child.draft_id)
                        .map(|issue| format!("- [ ] #{} — {}", issue.number, issue.title))
                })
                .collect::<Vec<_>>();
            if task_items.is_empty() {
                continue;
            }
            let body = format!(
                "{}\n\n## Tasks\n{}",
                created_bodies
                    .get(&parent.draft_id)
                    .map(String::as_str)
                    .unwrap_or(parent.body.as_str()),
                task_items.join("\n")
            );
            let endpoint = format!(
                "repos/{}/{}/issues/{}",
                target.owner, target.repository, parent_issue.number
            );
            let fields = [("body", body)];
            if let Err(error) = gh_api_write(&root, &target.host, &endpoint, "PATCH", &fields) {
                failure = Some(format!(
                    "the Issues were created, but the task list for parent #{} could not be updated: {}",
                    parent_issue.number, error.message
                ));
                break;
            }
        }
    }

    let created_ids = created
        .iter()
        .map(|issue| issue.draft_id.as_str())
        .collect::<HashSet<_>>();
    let remaining_draft_ids = drafts
        .iter()
        .filter(|draft| !created_ids.contains(draft.draft_id.as_str()))
        .map(|draft| draft.draft_id.clone())
        .collect();
    Ok(GitHubIssueBatchCreateResult {
        repository: GitHubRepository::from(target),
        created,
        remaining_draft_ids,
        failure,
    })
}

fn validate_drafts(
    target: &RemoteTarget,
    root: &Path,
    drafts: &[GitHubIssueDraft],
) -> CommandResult<GitHubIssueDraftValidation> {
    let repository = GitHubRepository::from(target.clone());
    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    let mut duplicates = Vec::new();
    let mut ids = HashSet::new();
    let mut batch_titles = HashMap::<String, String>::new();

    if drafts.is_empty() {
        errors.push(problem(None, "at least one Issue draft is required"));
    }
    for draft in drafts {
        let id = draft.draft_id.trim();
        if id.is_empty() {
            errors.push(problem(None, "every draft needs a stable draft ID"));
        } else if id != draft.draft_id
            || !id
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
        {
            errors.push(problem(
                Some(&draft.draft_id),
                "draft IDs may contain only letters, numbers, hyphens, and underscores",
            ));
        } else if !ids.insert(id.to_string()) {
            errors.push(problem(Some(id), "draft IDs must be unique"));
        }
        if draft.title.trim().is_empty() {
            errors.push(problem(
                Some(&draft.draft_id),
                "Issue title must not be empty",
            ));
        }
        if draft.title.chars().count() > 256 {
            errors.push(problem(
                Some(&draft.draft_id),
                "Issue title exceeds GitHub's 256 character limit",
            ));
        }
        let title_key = normalize_title(&draft.title);
        if !title_key.is_empty() {
            if let Some(existing_id) = batch_titles.insert(title_key, draft.draft_id.clone()) {
                errors.push(problem(
                    Some(&draft.draft_id),
                    format!("draft title duplicates draft `{existing_id}` in this batch"),
                ));
            }
        }
        if draft.body.trim().is_empty() {
            errors.push(problem(
                Some(&draft.draft_id),
                "Issue body must not be empty",
            ));
        }
        if draft
            .labels
            .iter()
            .chain(draft.priority_label.iter())
            .any(|value| value.trim().is_empty())
        {
            errors.push(problem(Some(&draft.draft_id), "labels must not be empty"));
        }
        if draft
            .assignees
            .iter()
            .any(|assignee| assignee.trim().is_empty())
        {
            errors.push(problem(
                Some(&draft.draft_id),
                "assignee names must not be empty",
            ));
        }
        for related in draft.parent_draft_id.iter().chain(draft.depends_on.iter()) {
            if related == &draft.draft_id {
                errors.push(problem(
                    Some(&draft.draft_id),
                    "a draft cannot reference itself",
                ));
            } else if !drafts
                .iter()
                .any(|candidate| candidate.draft_id == *related)
            {
                errors.push(problem(
                    Some(&draft.draft_id),
                    format!("referenced draft `{related}` does not exist"),
                ));
            }
        }
    }

    let (creation_order, cycle_ids) = topological_order(drafts);
    for draft_id in cycle_ids {
        errors.push(problem(
            Some(&draft_id),
            "Issue dependencies contain a cycle",
        ));
    }

    let labels = repository_labels(root, target)?;
    for draft in drafts {
        for label in effective_labels(draft) {
            if !labels.contains(&label) {
                errors.push(problem(
                    Some(&draft.draft_id),
                    format!("label `{label}` does not exist in this repository"),
                ));
            }
        }
    }
    let milestones = repository_milestones(root, target)?;
    let milestone_titles = milestones
        .iter()
        .map(|milestone| milestone.title.as_str())
        .collect::<HashSet<_>>();
    for draft in drafts {
        if let Some(title) = draft
            .milestone_title
            .as_ref()
            .map(|title| title.trim())
            .filter(|title| !title.is_empty())
        {
            if !milestone_titles.contains(title) {
                errors.push(problem(
                    Some(&draft.draft_id),
                    format!("milestone `{title}` does not exist in this repository"),
                ));
            }
        }
        if let Some(priority) = draft.priority_label.as_ref() {
            warnings.push(problem(
                Some(&draft.draft_id),
                format!("priority is represented by the repository label `{priority}`"),
            ));
        }
        match find_title_duplicates(root, target, &draft.title) {
            Ok(matches) => {
                duplicates.extend(matches.into_iter().map(|(number, title, html_url)| {
                    GitHubIssueDuplicate {
                        draft_id: draft.draft_id.clone(),
                        number,
                        title,
                        html_url,
                    }
                }))
            }
            Err(error) => warnings.push(problem(
                Some(&draft.draft_id),
                format!("duplicate check could not complete: {}", error.message),
            )),
        }
    }

    duplicates.sort_by_key(|item| (item.draft_id.clone(), item.number));
    duplicates
        .dedup_by(|left, right| left.draft_id == right.draft_id && left.number == right.number);
    Ok(GitHubIssueDraftValidation {
        repository,
        valid: errors.is_empty(),
        errors,
        warnings,
        duplicates,
        creation_order,
    })
}

fn repository_labels(root: &Path, target: &RemoteTarget) -> CommandResult<HashSet<String>> {
    let endpoint = format!("repos/{}/{}/labels", target.owner, target.repository);
    let response = gh_api(
        root,
        &target.host,
        &endpoint,
        &[("per_page", "100".to_string())],
    )?;
    let labels: Vec<GitHubLabelRecord> = serde_json::from_value(response).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Decode,
            format!("failed to decode repository labels: {error}"),
        )
    })?;
    Ok(labels.into_iter().map(|label| label.name).collect())
}

fn repository_milestones(
    root: &Path,
    target: &RemoteTarget,
) -> CommandResult<Vec<GitHubMilestoneRecord>> {
    let endpoint = format!("repos/{}/{}/milestones", target.owner, target.repository);
    let response = gh_api(
        root,
        &target.host,
        &endpoint,
        &[
            ("state", "all".to_string()),
            ("per_page", "100".to_string()),
        ],
    )?;
    serde_json::from_value(response).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Decode,
            format!("failed to decode repository milestones: {error}"),
        )
    })
}

fn find_title_duplicates(
    root: &Path,
    target: &RemoteTarget,
    title: &str,
) -> CommandResult<Vec<(u64, String, String)>> {
    let escaped = title.replace('\\', "\\\\").replace('"', "\\\"");
    let query = format!(
        "repo:{}/{} is:issue in:title \"{escaped}\"",
        target.owner, target.repository
    );
    let response = gh_api(
        root,
        &target.host,
        "search/issues",
        &[("q", query), ("per_page", "100".to_string())],
    )?;
    let Some(items) = response.get("items").and_then(Value::as_array) else {
        return Err(command_error(
            DesktopAppServerErrorKind::Decode,
            "GitHub search response did not include Issues",
        ));
    };
    let normalized = normalize_title(title);
    Ok(items
        .iter()
        .filter(|item| item.get("pull_request").is_none())
        .filter_map(|item| {
            let issue_title = item.get("title")?.as_str()?;
            if normalize_title(issue_title) != normalized {
                return None;
            }
            Some((
                item.get("number")?.as_u64()?,
                issue_title.to_string(),
                item.get("html_url")?.as_str()?.to_string(),
            ))
        })
        .collect())
}

fn normalize_title(title: &str) -> String {
    title
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn effective_labels(draft: &GitHubIssueDraft) -> Vec<String> {
    draft
        .labels
        .iter()
        .chain(draft.priority_label.iter())
        .map(|label| label.trim().to_string())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

fn effective_assignees(draft: &GitHubIssueDraft) -> Vec<String> {
    draft
        .assignees
        .iter()
        .map(|assignee| assignee.trim().to_string())
        .filter(|assignee| !assignee.is_empty())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

fn topological_order(drafts: &[GitHubIssueDraft]) -> (Vec<String>, Vec<String>) {
    let mut states = BTreeMap::<String, u8>::new();
    let mut order = Vec::new();
    let mut cycle_ids = BTreeSet::new();
    let by_id = drafts
        .iter()
        .map(|draft| (draft.draft_id.clone(), draft))
        .collect::<HashMap<_, _>>();
    for draft in drafts {
        visit_draft(
            &draft.draft_id,
            &by_id,
            &mut states,
            &mut order,
            &mut cycle_ids,
        );
    }
    (order, cycle_ids.into_iter().collect())
}

fn visit_draft(
    draft_id: &str,
    by_id: &HashMap<String, &GitHubIssueDraft>,
    states: &mut BTreeMap<String, u8>,
    order: &mut Vec<String>,
    cycle_ids: &mut BTreeSet<String>,
) {
    match states.get(draft_id).copied().unwrap_or_default() {
        2 => return,
        1 => {
            cycle_ids.insert(draft_id.to_string());
            return;
        }
        _ => {}
    }
    states.insert(draft_id.to_string(), 1);
    if let Some(draft) = by_id.get(draft_id) {
        for dependency in &draft.depends_on {
            if states.get(dependency).copied() == Some(1) {
                cycle_ids.insert(dependency.clone());
                cycle_ids.insert(draft_id.to_string());
            }
            if by_id.contains_key(dependency) {
                visit_draft(dependency, by_id, states, order, cycle_ids);
            }
        }
    }
    states.insert(draft_id.to_string(), 2);
    order.push(draft_id.to_string());
}

fn decode_created_issue(value: &Value, draft_id: &str) -> CommandResult<GitHubCreatedIssue> {
    Ok(GitHubCreatedIssue {
        draft_id: draft_id.to_string(),
        number: value.get("number").and_then(Value::as_u64).ok_or_else(|| {
            command_error(
                DesktopAppServerErrorKind::Decode,
                "Issue response omitted number",
            )
        })?,
        title: value
            .get("title")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        state: value
            .get("state")
            .and_then(Value::as_str)
            .unwrap_or("open")
            .to_string(),
        html_url: value
            .get("html_url")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
    })
}

fn problem(draft_id: Option<&str>, message: impl Into<String>) -> GitHubIssueDraftProblem {
    GitHubIssueDraftProblem {
        draft_id: draft_id.map(str::to_string),
        message: message.into(),
    }
}
