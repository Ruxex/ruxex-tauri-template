use std::ffi::OsString;
use std::path::PathBuf;
use std::process::{Command, ExitCode};

fn main() -> ExitCode {
    let args = std::env::args_os().collect::<Vec<_>>();
    match args.get(1).map(OsString::as_os_str) {
        Some(command) if command == "run" => return run_builder(&args[2..]),
        Some(command) if command == "python" => return run_python(&args[2..]),
        _ => {}
    }
    ruxex_desktop_lib::artifacts::run_cli(args)
}

#[derive(Debug)]
struct RuntimePaths {
    resource_root: PathBuf,
    node: PathBuf,
    node_modules: PathBuf,
    python: PathBuf,
    bin_dir: PathBuf,
    native_root: PathBuf,
    sdk: PathBuf,
}

impl RuntimePaths {
    fn new(root: PathBuf) -> Result<Self, String> {
        let resource_root = root.join("ruxex-resources");
        let paths = Self {
            node: resource_root.join("node/bin/node"),
            node_modules: resource_root.join("node/node_modules"),
            python: resource_root.join("python/bin/python3"),
            bin_dir: resource_root.join("bin/override"),
            native_root: resource_root.join("native"),
            sdk: resource_root.join("ruxex-artifact-tool"),
            resource_root,
        };
        for (label, path) in [
            ("Node.js", &paths.node),
            ("Node.js packages", &paths.node_modules),
            ("Python", &paths.python),
            ("native binary directory", &paths.bin_dir),
            ("native runtime", &paths.native_root),
            ("artifact SDK", &paths.sdk),
        ] {
            let valid = if label == "Node.js" || label == "Python" {
                path.is_file()
            } else {
                path.is_dir()
            };
            if !valid {
                return Err(format!("bundled {label} is missing: {}", path.display()));
            }
        }
        Ok(paths)
    }

    fn add_environment(&self, command: &mut Command) {
        command
            .env("RUXEX_RUNTIME_ROOT", &self.resource_root)
            .env("RUXEX_RUNTIME_NODE", &self.node)
            .env("RUXEX_RUNTIME_NODE_MODULES", &self.node_modules)
            .env("RUXEX_RUNTIME_PYTHON", &self.python)
            .env("RUXEX_RUNTIME_BIN_DIR", &self.bin_dir)
            .env("RUXEX_RUNTIME_NATIVE_ROOT", &self.native_root)
            .env_remove("PYTHONHOME")
            .env_remove("PYTHONPATH")
            .env_remove("PYTHONUSERBASE")
            .env("PYTHONNOUSERSITE", "1");
    }
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

    let runtime = match RuntimePaths::new(root.clone()) {
        Ok(runtime) => runtime,
        Err(error) => return print_error("missing_runtime_resource", error),
    };
    let sdk = &runtime.sdk;
    let loader = sdk.join("src/loader.mjs");
    let runner = root.join("ruxex-resources/ruxex-artifact-tool/src/runner.mjs");
    let engine = root.join("ruxex-path/ruxex-artifacts-engine");
    for (label, path) in [
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

    let mut command = Command::new(&runtime.node);
    command
        .arg("--no-warnings")
        .arg("--experimental-loader")
        .arg(loader)
        .arg(runner)
        .arg(builder)
        .args(&args[1..])
        .env("RUXEX_ARTIFACT_ENGINE", engine)
        .env("RUXEX_ARTIFACT_SDK", sdk)
        .env("RUXEX_ARTIFACT_NODE_MODULES", &runtime.node_modules);
    runtime.add_environment(&mut command);
    match command.status() {
        Ok(status) => status
            .code()
            .map_or(ExitCode::from(1), |code| ExitCode::from(code as u8)),
        Err(error) => print_error("runtime_launch_error", error.to_string()),
    }
}

fn run_python(args: &[OsString]) -> ExitCode {
    let Some(script) = args.first() else {
        return print_error(
            "invalid_arguments",
            "ruxex-artifacts python requires a helper script path",
        );
    };
    let Some(root) = package_root() else {
        return print_error(
            "missing_runtime_resource",
            "the bundled artifact runtime package could not be located",
        );
    };
    let runtime = match RuntimePaths::new(root) {
        Ok(runtime) => runtime,
        Err(error) => return print_error("missing_runtime_resource", error),
    };
    let script = PathBuf::from(script);
    if !script.is_file() {
        return print_error(
            "invalid_arguments",
            format!("Python helper script is missing: {}", script.display()),
        );
    }
    let command = python_helper_command(&runtime, script, &args[1..]);
    let mut command = command;
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
    package_root_from_executable(&executable)
}

fn package_root_from_executable(executable: &std::path::Path) -> Option<PathBuf> {
    executable
        .parent()?
        .ancestors()
        .find(|candidate| {
            candidate
                .join("ruxex-resources/python/bin/python3")
                .is_file()
        })
        .map(PathBuf::from)
}

fn python_helper_command(runtime: &RuntimePaths, script: PathBuf, args: &[OsString]) -> Command {
    let mut command = Command::new(&runtime.python);
    command.arg(script).args(args);
    runtime.add_environment(&mut command);
    command
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

#[cfg(test)]
mod tests {
    use super::{RuntimePaths, package_root_from_executable, python_helper_command};
    use std::ffi::OsString;
    use std::fs;
    use std::path::PathBuf;

    fn runtime_root() -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "ruxex-artifact-runtime-paths-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let resources = root.join("ruxex-resources");
        for relative in [
            "node/bin/node",
            "node/node_modules/.keep",
            "python/bin/python3",
            "bin/override/.keep",
            "native/.keep",
            "ruxex-artifact-tool/.keep",
        ] {
            let path = resources.join(relative);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, "runtime").unwrap();
        }
        root
    }

    #[test]
    fn resolves_python_and_native_assets_from_the_shared_resource_root() {
        let root = runtime_root();
        let runtime = RuntimePaths::new(root.clone()).unwrap();
        assert_eq!(
            runtime.python,
            root.join("ruxex-resources/python/bin/python3")
        );
        assert_eq!(runtime.bin_dir, root.join("ruxex-resources/bin/override"));
        assert_eq!(runtime.native_root, root.join("ruxex-resources/native"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn refuses_to_fall_back_when_the_bundled_python_runtime_is_missing() {
        let root = runtime_root();
        fs::remove_file(root.join("ruxex-resources/python/bin/python3")).unwrap();
        let error = RuntimePaths::new(root.clone()).unwrap_err();
        assert!(error.contains("Python"));
        assert!(error.contains("ruxex-resources/python/bin/python3"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn locates_shared_runtime_from_packaged_and_installed_skill_layouts() {
        let package = runtime_root();
        let packaged_executable =
            package.join("ruxex-resources/vendored/skills/documents/ruxex-artifacts");
        fs::create_dir_all(packaged_executable.parent().unwrap()).unwrap();
        fs::write(&packaged_executable, "binary").unwrap();
        assert_eq!(
            package_root_from_executable(&packaged_executable),
            Some(package.clone())
        );

        let installed_root = package.join("vendored/skills");
        let installed_python = installed_root.join("ruxex-resources/python/bin/python3");
        fs::create_dir_all(installed_python.parent().unwrap()).unwrap();
        fs::write(installed_python, "python").unwrap();
        let installed_executable = installed_root.join("documents/ruxex-artifacts");
        fs::create_dir_all(installed_executable.parent().unwrap()).unwrap();
        fs::write(&installed_executable, "binary").unwrap();
        assert_eq!(
            package_root_from_executable(&installed_executable),
            Some(installed_root)
        );
        let _ = fs::remove_dir_all(package);
    }

    #[test]
    fn python_helper_command_uses_bundled_interpreter_and_forwards_arguments() {
        let root = runtime_root();
        let runtime = RuntimePaths::new(root.clone()).unwrap();
        let script = root.join("helper with spaces.py");
        let args = vec![OsString::from("--label"), OsString::from("日本語 report")];
        let command = python_helper_command(&runtime, script.clone(), &args);

        assert_eq!(command.get_program(), runtime.python.as_os_str());
        assert_eq!(command.get_args().collect::<Vec<_>>(), {
            let mut expected = vec![script.as_os_str()];
            expected.extend(args.iter().map(OsString::as_os_str));
            expected
        });
        let environment = command
            .get_envs()
            .filter_map(|(name, value)| {
                value.map(|value| {
                    (
                        name.to_string_lossy().into_owned(),
                        value.to_string_lossy().into_owned(),
                    )
                })
            })
            .collect::<std::collections::HashMap<_, _>>();
        assert_eq!(
            environment["RUXEX_RUNTIME_ROOT"],
            runtime.resource_root.to_string_lossy()
        );
        assert_eq!(
            environment["RUXEX_RUNTIME_PYTHON"],
            runtime.python.to_string_lossy()
        );
        assert_eq!(
            environment["RUXEX_RUNTIME_BIN_DIR"],
            runtime.bin_dir.to_string_lossy()
        );
        assert_eq!(environment["PYTHONNOUSERSITE"], "1");
        for name in ["PYTHONHOME", "PYTHONPATH", "PYTHONUSERBASE"] {
            assert!(
                command
                    .get_envs()
                    .any(|(key, value)| key == name && value.is_none())
            );
        }
        let _ = fs::remove_dir_all(root);
    }
}
