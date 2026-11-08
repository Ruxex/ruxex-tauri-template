use std::ffi::OsString;
use std::path::PathBuf;
use std::process::{Command, ExitCode};

fn main() -> ExitCode {
    let args = std::env::args_os().collect::<Vec<_>>();
    if args.get(1).map(OsString::as_os_str) == Some("run".as_ref()) {
        return run_builder(&args[2..]);
    }
    ruxex_desktop_lib::artifacts::run_cli(args)
}

fn run_builder(args: &[OsString]) -> ExitCode {
    let Some(builder) = args.first() else {
        return print_error(
            "invalid_arguments",
            "ruxex-artifacts run requires a builder path",
        );
    };
    let Some(root) = package_root() else {
        return print_error(
            "missing_runtime_resource",
            "the bundled artifact runtime package could not be located",
        );
    };

    let node = root.join("ruxex-resources/node/bin/node");
    let node_modules = root.join("ruxex-resources/node/node_modules");
    let sdk = root.join("ruxex-resources/ruxex-artifact-tool");
    let loader = sdk.join("src/loader.mjs");
    let runner = root.join("ruxex-resources/ruxex-artifact-tool/src/runner.mjs");
    let engine = root.join("ruxex-path/ruxex-artifacts-engine");
    for (label, path) in [
        ("Node.js", &node),
        ("artifact SDK loader", &loader),
        ("artifact SDK", &runner),
        ("artifact engine", &engine),
    ] {
        if !path.is_file() {
            return print_error(
                "missing_runtime_resource",
                format!("bundled {label} is missing: {}", path.display()),
            );
        }
    }

    let mut command = Command::new(node);
    command
        .arg("--no-warnings")
        .arg("--experimental-loader")
        .arg(loader)
        .arg(runner)
        .arg(builder)
        .args(&args[1..])
        .env("RUXEX_ARTIFACT_ENGINE", engine)
        .env("RUXEX_ARTIFACT_SDK", sdk)
        .env("RUXEX_ARTIFACT_NODE_MODULES", node_modules);
    match command.status() {
        Ok(status) => status
            .code()
            .map_or(ExitCode::from(1), |code| ExitCode::from(code as u8)),
        Err(error) => print_error("runtime_launch_error", error.to_string()),
    }
}

fn package_root() -> Option<PathBuf> {
    if let Some(root) = std::env::var_os("RUXEX_ARTIFACT_PACKAGE_ROOT") {
        return Some(PathBuf::from(root));
    }
    let executable = std::env::current_exe().ok()?;
    executable.parent()?.parent().map(PathBuf::from)
}

fn print_error(code: &'static str, message: impl Into<String>) -> ExitCode {
    eprintln!(
        "{}",
        serde_json::json!({
            "ok": false,
            "error": {"code": code, "message": message.into()},
        })
    );
    ExitCode::from(1)
}
