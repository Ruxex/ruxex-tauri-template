use std::path::Path;
use std::process::{Command, Stdio};

use crate::error::{CommandResult, DesktopAppServerErrorKind, command_error};

#[cfg(windows)]
const EDITOR_CANDIDATES: &[&str] = &[
    "lapce",
    "geany",
    "kate",
    "gedit",
    "zed",
    "zeditor",
    "subl",
    "codium",
    "idea64.exe",
    "pycharm64.exe",
    "webstorm64.exe",
    "goland64.exe",
    "rider64.exe",
    "clion64.exe",
    "datagrip64.exe",
    "rubymine64.exe",
    "phpstorm64.exe",
    "code-insiders",
    "code",
];

#[cfg(not(windows))]
const EDITOR_CANDIDATES: &[&str] = &[
    "lapce",
    "geany",
    "kate",
    "gedit",
    "zed",
    "zeditor",
    "subl",
    "codium",
    "idea",
    "idea.sh",
    "pycharm",
    "pycharm.sh",
    "webstorm",
    "webstorm.sh",
    "goland",
    "goland.sh",
    "rider",
    "rider.sh",
    "clion",
    "clion.sh",
    "datagrip",
    "datagrip.sh",
    "rubymine",
    "rubymine.sh",
    "phpstorm",
    "phpstorm.sh",
    "code-insiders",
    "code",
];

fn command_exists(command: &str) -> bool {
    #[cfg(windows)]
    let mut lookup = Command::new("where.exe");
    #[cfg(not(windows))]
    let mut lookup = Command::new("which");

    lookup
        .arg(command)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|status| status.success())
}

fn detected_editor_command() -> Option<&'static str> {
    EDITOR_CANDIDATES
        .iter()
        .copied()
        .find(|command| command_exists(command))
}

fn resolve_editor_command(configured: Option<&str>) -> Result<Vec<String>, String> {
    if let Some(configured) = configured.map(str::trim).filter(|value| !value.is_empty()) {
        let parsed = shell_words::split(configured)
            .map_err(|error| format!("invalid editor command: {error}"))?;
        if parsed.is_empty() {
            return Err("editor command cannot be empty".to_string());
        }
        return Ok(parsed);
    }

    detected_editor_command()
        .map(|command| vec![command.to_string()])
        .ok_or_else(|| {
            "no supported editor was found on PATH; set an editor command in Settings".to_string()
        })
}

#[tauri::command]
pub(crate) fn detect_editor_command() -> Option<String> {
    detected_editor_command().map(str::to_string)
}

#[tauri::command]
pub(crate) fn open_workspace_in_editor(
    workspace: String,
    editor_command: Option<String>,
) -> CommandResult<()> {
    let workspace_path = Path::new(&workspace);
    if !workspace_path.is_dir() {
        return Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            "workspace path is not an accessible directory",
        ));
    }

    let command = resolve_editor_command(editor_command.as_deref())
        .map_err(|error| command_error(DesktopAppServerErrorKind::Initialization, error))?;
    let (program, args) = command
        .split_first()
        .expect("editor command resolver returns a non-empty command");

    Command::new(program)
        .args(args)
        .arg(workspace_path)
        .current_dir(workspace_path)
        .spawn()
        .map(|_| ())
        .map_err(|error| {
            command_error(
                DesktopAppServerErrorKind::Initialization,
                format!("failed to launch editor {program}: {error}"),
            )
        })
}

#[cfg(test)]
mod tests {
    use super::{detect_editor_command, open_workspace_in_editor, resolve_editor_command};
    use std::fs;
    use std::path::PathBuf;

    fn test_workspace(label: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "ruxex-editor-{label}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn parses_a_configured_editor_with_arguments() {
        assert_eq!(
            resolve_editor_command(Some("code --reuse-window")).unwrap(),
            ["code", "--reuse-window"]
        );
    }

    #[test]
    fn rejects_a_malformed_configured_editor() {
        let error = resolve_editor_command(Some("code 'unfinished")).unwrap_err();
        assert!(error.starts_with("invalid editor command:"));
    }

    #[test]
    fn editor_detection_matches_path_lookup() {
        assert_eq!(
            detect_editor_command().is_some(),
            resolve_editor_command(None).is_ok()
        );
    }

    #[test]
    fn rejects_a_workspace_that_is_not_a_directory() {
        let missing =
            std::env::temp_dir().join(format!("ruxex-editor-missing-{}", std::process::id()));
        let _ = fs::remove_dir_all(&missing);
        assert!(
            open_workspace_in_editor(missing.display().to_string(), Some("true".into())).is_err()
        );
    }

    #[cfg(unix)]
    #[test]
    fn launches_the_configured_editor_from_the_workspace() {
        let workspace = test_workspace("launch");
        open_workspace_in_editor(workspace.display().to_string(), Some("/bin/true".into()))
            .unwrap();
        fs::remove_dir_all(workspace).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn reports_a_configured_editor_that_cannot_be_started() {
        let workspace = test_workspace("missing-editor");
        let result = open_workspace_in_editor(
            workspace.display().to_string(),
            Some("ruxex-editor-does-not-exist".into()),
        );
        assert!(result.is_err());
        fs::remove_dir_all(workspace).unwrap();
    }
}
