use std::ffi::OsString;
use std::path::PathBuf;
use std::process::{Command, ExitCode};

fn main() -> ExitCode {
    let args = std::env::args_os().collect::<Vec<_>>();
    match args.get(1).map(OsString::as_os_str) {
        Some(command) if command == "run" => return run_builder(&args[2..]),
        _ => {}
    }
    ruxex_desktop_lib::artifacts::run_cli(args)
}

#[derive(Debug)]
struct RuntimePaths {
    resource_root: PathBuf,
    node: PathBuf,
    node_modules: PathBuf,
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
            bin_dir: resource_root.join("bin/override"),
            native_root: resource_root.join("native"),
            sdk: resource_root.join("ruxex-artifact-tool"),
            resource_root,
        };
        for (label, path) in [
            ("Node.js", &paths.node),
            ("Node.js packages", &paths.node_modules),
            ("native binary directory", &paths.bin_dir),
            ("native runtime", &paths.native_root),
            ("artifact SDK", &paths.sdk),
        ] {
            let valid = if label == "Node.js" {
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
            .env("RUXEX_RUNTIME_BIN_DIR", &self.bin_dir)
            .env("RUXEX_RUNTIME_NATIVE_ROOT", &self.native_root)
            .env_remove("RUXEX_RUNTIME_PYTHON");
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
        .find(|candidate| candidate.join("ruxex-resources/runtime-manifest.json").is_file())
        .map(PathBuf::from)
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
    use super::{RuntimePaths, package_root_from_executable};
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
            "bin/override/.keep",
            "native/.keep",
            "ruxex-artifact-tool/.keep",
        ] {
            let path = resources.join(relative);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, "runtime").unwrap();
        }
        fs::write(resources.join("runtime-manifest.json"), "{}").unwrap();
        root
    }

    #[test]
    fn resolves_native_assets_without_a_python_runtime() {
        let root = runtime_root();
        let runtime = RuntimePaths::new(root.clone()).unwrap();
        assert_eq!(runtime.bin_dir, root.join("ruxex-resources/bin/override"));
        assert_eq!(runtime.native_root, root.join("ruxex-resources/native"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn removes_the_legacy_python_runtime_environment_variable() {
        let root = runtime_root();
        let runtime = RuntimePaths::new(root.clone()).unwrap();
        let mut command = std::process::Command::new("node");
        runtime.add_environment(&mut command);

        assert!(command
            .get_envs()
            .any(|(key, value)| key == "RUXEX_RUNTIME_PYTHON" && value.is_none()));
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
        let installed_manifest = installed_root.join("ruxex-resources/runtime-manifest.json");
        fs::create_dir_all(installed_manifest.parent().unwrap()).unwrap();
        fs::write(installed_manifest, "{}").unwrap();
        let installed_executable = installed_root.join("documents/ruxex-artifacts");
        fs::create_dir_all(installed_executable.parent().unwrap()).unwrap();
        fs::write(&installed_executable, "binary").unwrap();
        assert_eq!(
            package_root_from_executable(&installed_executable),
            Some(installed_root)
        );
        let _ = fs::remove_dir_all(package);
    }
}
