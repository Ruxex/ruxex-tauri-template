use std::collections::HashMap;
use std::ffi::OsString;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use portable_pty::{Child, CommandBuilder, MasterPty, PtySize, native_pty_system};
use serde::Serialize;
use tauri::State;
use tauri::ipc::Channel;

static NEXT_TERMINAL_ID: AtomicU64 = AtomicU64::new(1);

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
