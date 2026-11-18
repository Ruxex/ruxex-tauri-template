use std::collections::HashMap;
use std::ffi::OsString;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use portable_pty::{Child, CommandBuilder, MasterPty, PtySize, native_pty_system};
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, Runtime, State};

static NEXT_TERMINAL_ID: AtomicU64 = AtomicU64::new(1);
const TERMINAL_SESSION_PREFERENCES_FILE: &str = "terminal-session.json";
const DEFAULT_TERMINAL_IDLE_TIMEOUT_HOURS: u64 = 24;

#[derive(Deserialize, Serialize)]
struct TerminalSessionPreferences {
    #[serde(default = "default_terminal_idle_timeout_hours")]
    idle_timeout_hours: Option<u64>,
}

fn default_terminal_idle_timeout_hours() -> Option<u64> {
    Some(DEFAULT_TERMINAL_IDLE_TIMEOUT_HOURS)
}

fn terminal_session_preferences_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(TERMINAL_SESSION_PREFERENCES_FILE))
        .map_err(|error| format!("failed to resolve terminal session preferences: {error}"))
}

fn read_terminal_idle_timeout(path: &Path) -> Option<u64> {
    fs::read_to_string(path)
        .ok()
        .and_then(|contents| serde_json::from_str::<TerminalSessionPreferences>(&contents).ok())
        .and_then(|preferences| match preferences.idle_timeout_hours {
            Some(hours @ (1 | 6 | 24 | 72)) => Some(Some(hours)),
            None => Some(None),
            _ => None,
        })
        .unwrap_or(Some(DEFAULT_TERMINAL_IDLE_TIMEOUT_HOURS))
}

fn write_terminal_idle_timeout(path: &Path, hours: Option<u64>) -> Result<(), String> {
    if !matches!(hours, Some(1 | 6 | 24 | 72) | None) {
        return Err("unsupported terminal session timeout".to_string());
    }
    let parent = path
        .parent()
        .ok_or_else(|| "terminal session preference path has no parent".to_string())?;
    fs::create_dir_all(parent).map_err(|error| {
        format!(
            "failed to create terminal session preference directory `{}`: {error}",
            parent.display()
        )
    })?;
    let temporary_path = path.with_extension("json.tmp");
    let contents = serde_json::to_vec_pretty(&TerminalSessionPreferences {
        idle_timeout_hours: hours,
    })
    .map_err(|error| format!("failed to serialize terminal session preference: {error}"))?;
    fs::write(&temporary_path, contents).map_err(|error| {
        format!(
            "failed to write terminal session preference `{}`: {error}",
            temporary_path.display()
        )
    })?;
    #[cfg(windows)]
    if path.exists() {
        fs::remove_file(path).map_err(|error| {
            format!(
                "failed to replace terminal session preference `{}`: {error}",
                path.display()
            )
        })?;
    }
    fs::rename(&temporary_path, path).map_err(|error| {
        let _ = fs::remove_file(&temporary_path);
        format!(
            "failed to commit terminal session preference `{}`: {error}",
            path.display()
        )
    })
}

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub(crate) enum TerminalEvent {
    Output { data: Vec<u8> },
    Exited,
}

struct TerminalSession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send>,
}

impl TerminalSession {
    fn terminate(&mut self) {
        #[cfg(unix)]
        {
            if let Some(fd) = self.master.as_raw_fd() {
                // SAFETY: tcgetpgrp reads the foreground process group for a live PTY fd.
                let foreground_group = unsafe { libc::tcgetpgrp(fd) };
                if foreground_group > 0 {
                    // SAFETY: a negative pid targets only the PTY's foreground process group.
                    unsafe {
                        libc::kill(-foreground_group, libc::SIGHUP);
                    }
                }
            }
        }
        let _ = self.child.kill();
    }
}

impl Drop for TerminalSession {
    fn drop(&mut self) {
        self.terminate();
    }
}

#[derive(Default)]
pub(crate) struct TerminalState {
    sessions: Mutex<HashMap<String, Arc<Mutex<TerminalSession>>>>,
}

impl TerminalState {
    fn start(
        &self,
        cwd: Option<String>,
        cols: u16,
        rows: u16,
        on_event: Channel<TerminalEvent>,
    ) -> Result<String, String> {
        let cwd = resolve_working_directory(cwd)?;
        let shell = resolve_default_shell();
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(pty_size(cols, rows))
            .map_err(|error| format!("Unable to open terminal: {error}"))?;
        let mut command = CommandBuilder::new(&shell);
        command.cwd(cwd);
        command.env("TERM", "xterm-256color");
        command.env("COLORTERM", "truecolor");
        #[cfg(unix)]
        command.arg("-l");

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|error| format!("Unable to read terminal output: {error}"))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|error| format!("Unable to write to terminal: {error}"))?;
        let child = pair
            .slave
            .spawn_command(command)
            .map_err(|error| format!("Unable to start shell: {error}"))?;
        drop(pair.slave);
        let session = Arc::new(Mutex::new(TerminalSession {
            master: pair.master,
            writer,
            child,
        }));
        let id = format!(
            "terminal-{}-{}",
            std::process::id(),
            NEXT_TERMINAL_ID.fetch_add(1, Ordering::Relaxed)
        );

        let output_session = Arc::clone(&session);
        std::thread::Builder::new()
            .name(format!("terminal-output-{id}"))
            .spawn(move || stream_output(reader, output_session, on_event))
            .map_err(|error| format!("Unable to read terminal output: {error}"))?;

        self.sessions
            .lock()
            .map_err(|_| "Terminal state is unavailable".to_string())?
            .insert(id.clone(), session);
        Ok(id)
    }

    fn write(&self, session_id: &str, data: &str) -> Result<(), String> {
        let session = self.session(session_id)?;
        let mut session = session
            .lock()
            .map_err(|_| "Terminal session is unavailable".to_string())?;
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(|error| format!("Unable to write to terminal: {error}"))
    }

    fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let session = self.session(session_id)?;
        let session = session
            .lock()
            .map_err(|_| "Terminal session is unavailable".to_string())?;
        session
            .master
            .resize(pty_size(cols, rows))
            .map_err(|error| format!("Unable to resize terminal: {error}"))
    }

    fn close(&self, session_id: &str) -> Result<(), String> {
        let session = self
            .sessions
            .lock()
            .map_err(|_| "Terminal state is unavailable".to_string())?
            .remove(session_id);
        if let Some(session) = session {
            let mut session = session
                .lock()
                .map_err(|_| "Terminal session is unavailable".to_string())?;
            session.terminate();
        }
        Ok(())
    }

    fn session(&self, session_id: &str) -> Result<Arc<Mutex<TerminalSession>>, String> {
        self.sessions
            .lock()
            .map_err(|_| "Terminal state is unavailable".to_string())?
            .get(session_id)
            .cloned()
            .ok_or_else(|| "Terminal session was closed".to_string())
    }
}

impl Drop for TerminalState {
    fn drop(&mut self) {
        let sessions = match self.sessions.get_mut() {
            Ok(sessions) => sessions,
            Err(poisoned) => poisoned.into_inner(),
        };
        for session in sessions.values() {
            if let Ok(mut session) = session.lock() {
                session.terminate();
            }
        }
    }
}

fn stream_output(
    mut reader: Box<dyn Read + Send>,
    session: Arc<Mutex<TerminalSession>>,
    on_event: Channel<TerminalEvent>,
) {
    let mut buffer = [0_u8; 4096];
    loop {
        match reader.read(&mut buffer) {
            Ok(0) | Err(_) => break,
            Ok(read) => {
                let data = buffer[..read].to_vec();
                if on_event.send(TerminalEvent::Output { data }).is_err() {
                    if let Ok(mut session) = session.lock() {
                        let _ = session.child.kill();
                    }
                    break;
                }
            }
        }
    }
    if let Ok(mut session) = session.lock() {
        let _ = session.child.wait();
    }
    let _ = on_event.send(TerminalEvent::Exited);
}

fn pty_size(cols: u16, rows: u16) -> PtySize {
    PtySize {
        rows: rows.max(1),
        cols: cols.max(1),
        pixel_width: 0,
        pixel_height: 0,
    }
}

fn resolve_working_directory(cwd: Option<String>) -> Result<PathBuf, String> {
    match cwd.filter(|cwd| !cwd.trim().is_empty()) {
        Some(cwd) => {
            let path = PathBuf::from(cwd);
            if !path.is_dir() {
                return Err(format!(
                    "Workspace directory does not exist: {}",
                    path.display()
                ));
            }
            Ok(path)
        }
        None => home_directory().ok_or_else(|| "Unable to find the user's home directory".into()),
    }
}

fn home_directory() -> Option<PathBuf> {
    dirs::home_dir().filter(|path| path.is_dir())
}

fn resolve_default_shell() -> OsString {
    #[cfg(windows)]
    {
        std::env::var_os("COMSPEC")
            .filter(|shell| Path::new(shell).is_file())
            .unwrap_or_else(|| OsString::from("cmd.exe"))
    }

    #[cfg(unix)]
    {
        std::env::var_os("SHELL")
            .filter(|shell| Path::new(shell).is_file())
            .or_else(account_shell)
            .filter(|shell| Path::new(shell).is_file())
            .unwrap_or_else(|| OsString::from("/bin/sh"))
    }
}

#[cfg(unix)]
fn account_shell() -> Option<OsString> {
    use std::ffi::CStr;
    use std::mem::MaybeUninit;
    use std::os::unix::ffi::OsStringExt;

    let mut user = MaybeUninit::<libc::passwd>::zeroed();
    let mut buffer = vec![0_u8; 16 * 1024];
    let mut result = std::ptr::null_mut();
    // SAFETY: getpwuid_r writes into the provided passwd and scratch buffers.
    let status = unsafe {
        libc::getpwuid_r(
            libc::geteuid(),
            user.as_mut_ptr(),
            buffer.as_mut_ptr().cast(),
            buffer.len(),
            &mut result,
        )
    };
    if status != 0 || result.is_null() {
        return None;
    }

    // SAFETY: a non-null result means getpwuid_r initialized the passwd value.
    let user = unsafe { user.assume_init() };
    if user.pw_shell.is_null() {
        return None;
    }
    // SAFETY: pw_shell points into the live scratch buffer returned by getpwuid_r.
    let shell = unsafe { CStr::from_ptr(user.pw_shell) };
    Some(OsString::from_vec(shell.to_bytes().to_vec()))
}

#[tauri::command]
pub(crate) fn terminal_start(
    state: State<'_, TerminalState>,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
    on_event: Channel<TerminalEvent>,
) -> Result<String, String> {
    state.start(cwd, cols, rows, on_event)
}

#[tauri::command]
pub(crate) fn terminal_write(
    state: State<'_, TerminalState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    state.write(&session_id, &data)
}

#[tauri::command]
pub(crate) fn terminal_resize(
    state: State<'_, TerminalState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    state.resize(&session_id, cols, rows)
}

#[tauri::command]
pub(crate) fn terminal_close(
    state: State<'_, TerminalState>,
    session_id: String,
) -> Result<(), String> {
    state.close(&session_id)
}

#[tauri::command]
pub(crate) fn terminal_session_timeout_read<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Option<u64>, String> {
    let path = terminal_session_preferences_path(&app)?;
    Ok(read_terminal_idle_timeout(&path))
}

#[tauri::command]
pub(crate) fn terminal_session_timeout_update<R: Runtime>(
    app: AppHandle<R>,
    hours: Option<u64>,
) -> Result<Option<u64>, String> {
    let path = terminal_session_preferences_path(&app)?;
    write_terminal_idle_timeout(&path, hours)?;
    Ok(hours)
}

#[cfg(test)]
mod tests {
    use super::{
        TerminalEvent, TerminalState, default_terminal_idle_timeout_hours, pty_size,
        read_terminal_idle_timeout, resolve_working_directory, write_terminal_idle_timeout,
    };
    use std::sync::mpsc;
    use std::time::Duration;
    use tauri::ipc::{Channel, InvokeResponseBody};

    #[test]
    fn terminal_dimensions_never_fall_below_one_cell() {
        let size = pty_size(0, 0);

        assert_eq!((size.cols, size.rows), (1, 1));
    }

    #[test]
    fn working_directory_requires_an_existing_directory() {
        let existing = std::env::temp_dir();
        assert_eq!(
            resolve_working_directory(Some(existing.to_string_lossy().into_owned())).unwrap(),
            existing
        );

        let missing = std::env::temp_dir().join(format!(
            "ruxex-terminal-path-that-does-not-exist-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&missing);
        let error =
            resolve_working_directory(Some(missing.to_string_lossy().into_owned())).unwrap_err();
        assert!(error.contains("Workspace directory does not exist"));
        assert!(resolve_working_directory(Some("  ".into())).is_ok());
    }

    #[test]
    fn idle_timeout_preferences_default_validate_and_persist_supported_values() {
        let path = std::env::temp_dir().join(format!(
            "ruxex-terminal-timeout-{}-{}.json",
            std::process::id(),
            std::thread::current().name().unwrap_or("test")
        ));
        let _ = std::fs::remove_file(&path);
        assert_eq!(default_terminal_idle_timeout_hours(), Some(24));
        assert_eq!(read_terminal_idle_timeout(&path), Some(24));

        std::fs::write(&path, "not json").unwrap();
        assert_eq!(read_terminal_idle_timeout(&path), Some(24));
        for (json, expected) in [
            (r#"{"idle_timeout_hours":1}"#, Some(1)),
            (r#"{"idle_timeout_hours":6}"#, Some(6)),
            (r#"{"idle_timeout_hours":24}"#, Some(24)),
            (r#"{"idle_timeout_hours":72}"#, Some(72)),
            (r#"{"idle_timeout_hours":null}"#, None),
            ("{}", Some(24)),
            (r#"{"idle_timeout_hours":2}"#, Some(24)),
        ] {
            std::fs::write(&path, json).unwrap();
            assert_eq!(read_terminal_idle_timeout(&path), expected);
        }

        assert!(write_terminal_idle_timeout(&path, Some(2)).is_err());
        for hours in [Some(1), Some(6), Some(24), Some(72), None] {
            write_terminal_idle_timeout(&path, hours).unwrap();
            assert_eq!(read_terminal_idle_timeout(&path), hours);
        }
        std::fs::remove_file(path).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn closing_a_terminal_ends_the_session_and_emits_exit() {
        let (events_tx, events_rx) = mpsc::channel();
        let channel = Channel::<TerminalEvent>::new(move |body| {
            if let InvokeResponseBody::Json(payload) = body {
                let _ = events_tx.send(payload);
            }
            Ok(())
        });
        let state = TerminalState::default();
        let id = state
            .start(
                Some(std::env::temp_dir().to_string_lossy().into_owned()),
                80,
                24,
                channel,
            )
            .unwrap();
        state.write(&id, "sleep 30\n").unwrap();

        state.close(&id).unwrap();

        assert_eq!(
            state.write(&id, "echo closed\n").unwrap_err(),
            "Terminal session was closed"
        );
        let mut saw_exit = false;
        while let Ok(payload) = events_rx.recv_timeout(Duration::from_secs(5)) {
            let event: serde_json::Value = serde_json::from_str(&payload).unwrap();
            if event["type"] == "exited" {
                saw_exit = true;
                break;
            }
        }
        assert!(saw_exit, "terminal should emit Exited after it is closed");
    }

    #[cfg(unix)]
    #[test]
    fn terminal_sessions_write_resize_and_stream_shell_output() {
        let (events_tx, events_rx) = mpsc::channel();
        let channel = Channel::<TerminalEvent>::new(move |body| {
            if let InvokeResponseBody::Json(payload) = body {
                let _ = events_tx.send(payload);
            }
            Ok(())
        });
        let state = TerminalState::default();
        let id = state
            .start(
                Some(std::env::temp_dir().to_string_lossy().into_owned()),
                80,
                24,
                channel,
            )
            .unwrap();
        state.resize(&id, 100, 40).unwrap();
        state.write(&id, "printf 'coverage-marker\\n'\n").unwrap();

        let deadline = std::time::Instant::now() + Duration::from_secs(5);
        let mut saw_marker = false;
        while std::time::Instant::now() < deadline {
            let Ok(payload) = events_rx.recv_timeout(Duration::from_millis(250)) else {
                continue;
            };
            let event: serde_json::Value = serde_json::from_str(&payload).unwrap();
            let data = event["data"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(serde_json::Value::as_u64)
                .filter_map(|byte| u8::try_from(byte).ok())
                .collect::<Vec<_>>();
            if String::from_utf8_lossy(&data).contains("coverage-marker") {
                saw_marker = true;
                break;
            }
        }
        assert!(saw_marker, "the terminal should stream shell output");
        state.close(&id).unwrap();
        assert!(state.close(&id).is_ok());
    }
}
