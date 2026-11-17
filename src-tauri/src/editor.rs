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
