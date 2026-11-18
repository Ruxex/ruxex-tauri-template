use std::fs;
use std::path::{Path, PathBuf};

use std::fs::OpenOptions;
use std::io::{ErrorKind, Write};

use base64::Engine;
use ruxex::ProductIdentity;

use crate::desktop_config::DesktopConfig;
use crate::error::{CommandResult, DesktopAppServerErrorKind, command_error};
use crate::platform;

#[cfg(test)]
pub(crate) static TEST_RUXEX_HOME_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[cfg(test)]
pub(crate) struct TestRuxexHomeOverride(Option<std::ffi::OsString>);

#[cfg(test)]
impl TestRuxexHomeOverride {
    pub(crate) fn set(home: &Path) -> Self {
        let previous = std::env::var_os("RUXEX_HOME");
        unsafe { std::env::set_var("RUXEX_HOME", home) };
        Self(previous)
    }
}

#[cfg(test)]
impl Drop for TestRuxexHomeOverride {
    fn drop(&mut self) {
        match self.0.take() {
            Some(previous) => unsafe { std::env::set_var("RUXEX_HOME", previous) },
            None => unsafe { std::env::remove_var("RUXEX_HOME") },
        }
    }
}

pub(crate) fn product_identity(config: &DesktopConfig) -> ProductIdentity {
    ProductIdentity::new(
        &config.branding.window_title,
        &config.branding.product_slug,
        &config.branding.home_dir_name,
        &config.branding.home_marker_file,
    )
    .expect("desktop product identity is static and valid")
}

fn ruxex_home_from_user_home(user_home: &Path, config: &DesktopConfig) -> PathBuf {
    product_identity(config)
        .resolve_home_from(user_home)
        .expect("desktop user home should be absolute")
        .into_path_buf()
}

pub(crate) fn ruxex_home() -> Result<PathBuf, String> {
    if let Some(home) = std::env::var_os("RUXEX_HOME") {
        let home = PathBuf::from(home);
        fs::create_dir_all(&home)
            .map_err(|error| format!("failed to create Desktop Ruxex home: {error}"))?;
        return Ok(home);
    }
    let user_home =
        dirs::home_dir().ok_or_else(|| "failed to resolve user home directory".to_string())?;
    let home = ruxex_home_from_user_home(&user_home, &crate::desktop_config::default_config());
    fs::create_dir_all(&home)
        .map_err(|error| format!("failed to create Desktop Ruxex home: {error}"))?;
    Ok(home)
}

pub(crate) fn initialize_provider_home(
    home: &Path,
    identity: &ProductIdentity,
    descriptor: &ruxex::provider::ProviderDescriptor,
) -> Result<(), String> {
    let marker_file = identity.home_marker_file();
    match ruxex::provider::mount_provider_home(home, marker_file, descriptor) {
        Ok(_) => Ok(()),
        Err(ruxex::provider::ProviderHomeError::DescriptorMismatch {
            expected, actual, ..
        }) if actual.provider_kind == "example" && expected.provider_kind == "dummy" => {
            let marker_path = home.join(marker_file);
            let contents = serde_json::to_string_pretty(&expected).map_err(|error| {
                format!("failed to serialize migrated provider marker: {error}")
            })?;
            fs::write(&marker_path, format!("{contents}\n")).map_err(|error| {
                format!(
                    "failed to migrate Desktop provider marker `{}`: {error}",
                    marker_path.display()
                )
            })?;
            Ok(())
        }
        Err(ruxex::provider::ProviderHomeError::MissingMarker { .. }) => {
            let marker_path = home.join(marker_file);
            let marker = ruxex::provider::ProviderHomeMarker::from(descriptor);
            let contents = serde_json::to_string_pretty(&marker)
                .map_err(|error| format!("failed to serialize Desktop provider marker: {error}"))?;
            let mut marker_handle = match OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&marker_path)
            {
                Ok(handle) => handle,
                Err(error) if error.kind() == ErrorKind::AlreadyExists => {
                    return ruxex::provider::mount_provider_home(home, marker_file, descriptor)
                        .map(|_| ())
                        .map_err(|error| {
                            format!("failed to initialize Desktop provider home: {error}")
                        });
                }
                Err(error) => {
                    return Err(format!(
                        "failed to create Desktop provider marker `{}`: {error}",
                        marker_path.display()
                    ));
                }
            };
            if let Err(error) = marker_handle
                .write_all(format!("{contents}\n").as_bytes())
                .and_then(|_| marker_handle.flush())
            {
                let _ = fs::remove_file(&marker_path);
                return Err(format!(
                    "failed to write Desktop provider marker `{}`: {error}",
                    marker_path.display()
                ));
            }
            Ok(())
        }
        Err(error) => Err(format!(
            "failed to initialize Desktop provider home: {error}"
        )),
    }
}

#[tauri::command]
pub(crate) fn read_image_file(path: String) -> CommandResult<String> {
    let requested = PathBuf::from(&path);
    if !requested.is_absolute() {
        return Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            "image path must be absolute",
        ));
    }
    let home =
        ruxex_home().map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))?;
    let user_home = dirs::home_dir().ok_or_else(|| {
        command_error(
            DesktopAppServerErrorKind::Lifecycle,
            "failed to resolve user home directory",
        )
    })?;
    let workspace = std::env::current_dir().map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Lifecycle,
            format!("failed to resolve workspace root: {error}"),
        )
    })?;
    read_image_file_from_roots(&requested, &[&home, &user_home, &workspace])
}

fn read_image_file_from_roots(requested: &Path, roots: &[&Path]) -> CommandResult<String> {
    if !requested.is_absolute() {
        return Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            "image path must be absolute",
        ));
    }
    let canonical = requested.canonicalize().map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("image path cannot be opened: {error}"),
        )
    })?;
    let canonical_roots = roots
        .iter()
        .filter_map(|root| root.canonicalize().ok())
        .collect::<Vec<_>>();
    let root_refs = canonical_roots
        .iter()
        .map(PathBuf::as_path)
        .collect::<Vec<_>>();
    if !platform::is_path_under_any_root(&canonical, &root_refs) {
        return Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            "image path is outside the Ruxex or workspace roots",
        ));
    }
    let mime = platform::image_mime_type(&canonical).ok_or_else(|| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            "only png, jpeg, gif, and webp images are supported",
        )
    })?;
    let bytes = fs::read(&canonical).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to read image: {error}"),
        )
    })?;
    if bytes.len() > 16 * 1024 * 1024 {
        return Err(command_error(
            DesktopAppServerErrorKind::Initialization,
            "image exceeds the 16 MiB presentation limit",
        ));
    }
    Ok(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}

#[tauri::command]
pub(crate) fn open_browser_window(url: String) -> CommandResult<()> {
    let url = platform::validate_browser_url(&url).ok_or_else(|| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            "browser URL must use http:// or https://",
        )
    })?;
    #[cfg(feature = "e2e")]
    if std::env::var_os("RUXEX_E2E_AUTO_OAUTH").as_deref() == Some(std::ffi::OsStr::new("1")) {
        let result = std::process::Command::new("curl")
            .args([
                "--fail",
                "--silent",
                "--show-error",
                "--location",
                "--max-time",
                "20",
            ])
            .arg(url.as_str())
            .output()
            .map_err(|error| {
                command_error(
                    DesktopAppServerErrorKind::Initialization,
                    format!("failed to run OAuth browser fixture: {error}"),
                )
            })?;
        if !result.status.success() {
            return Err(command_error(
                DesktopAppServerErrorKind::Initialization,
                format!(
                    "OAuth browser fixture failed: {}",
                    String::from_utf8_lossy(&result.stderr).trim()
                ),
            ));
        }
        return Ok(());
    }
    tauri_plugin_opener::open_url(url, None::<&str>).map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Initialization,
            format!("failed to open browser URL: {error}"),
        )
    })
}

const VENDORED_SKILL_NAMES: [&str; 4] = ["documents", "presentations", "spreadsheets", "pdf"];

fn validate_vendored_skills(source_root: &Path) -> Result<(), String> {
    for name in VENDORED_SKILL_NAMES {
        let source = source_root.join(name);
        for relative in ["SKILL.md", "agents/ruxex.yaml"] {
            if !source.join(relative).is_file() {
                return Err(format!(
                    "bundled Skill asset is missing: {}",
                    source.join(relative).display()
                ));
            }
        }
    }
    Ok(())
}

pub(crate) fn select_vendored_skills_source(
    packaged_sources: &[PathBuf],
    development_source: &Path,
    allow_development_fallback: bool,
) -> Result<PathBuf, String> {
    let mut failures = Vec::new();
    for source in packaged_sources {
        match validate_vendored_skills(source) {
            Ok(()) => return Ok(source.to_path_buf()),
            Err(error) => failures.push(error),
        }
    }
    if allow_development_fallback {
        match validate_vendored_skills(development_source) {
            Ok(()) => return Ok(development_source.to_path_buf()),
            Err(error) => failures.push(error),
        }
    }
    Err(format!(
        "bundled Skill assets not found; {}",
        failures.join("; ")
    ))
}

pub(crate) fn sync_vendored_skills(source_root: &Path, home: &Path) -> Result<PathBuf, String> {
    validate_vendored_skills(source_root)?;

    let vendored_dir = home.join("vendored");
    reject_symlink(&vendored_dir)?;
    fs::create_dir_all(&vendored_dir)
        .map_err(|error| format!("failed to create vendored Skills directory: {error}"))?;
    let skills_dir = vendored_dir.join("skills");
    reject_symlink(&skills_dir)?;
    fs::create_dir_all(&skills_dir)
        .map_err(|error| format!("failed to create vendored Skills directory: {error}"))?;

    for name in VENDORED_SKILL_NAMES {
        let source = source_root.join(name);
        let destination = skills_dir.join(name);
        remove_path_if_exists(&destination)?;
        copy_directory_tree(&source, &destination).map_err(|error| {
            format!(
                "failed to sync bundled Skill `{name}` to {}: {error}",
                destination.display()
            )
        })?;
    }

    sync_vendored_artifact_runtime(source_root, &skills_dir)?;

    Ok(skills_dir)
}

fn sync_vendored_artifact_runtime(source_root: &Path, skills_dir: &Path) -> Result<(), String> {
    let Some(package_root) = source_root
        .ancestors()
        .find(|candidate| candidate.join("ruxex-package.json").is_file())
    else {
        return Ok(());
    };

    let resources_source = package_root.join("ruxex-resources");
    let path_source = package_root.join("ruxex-path");
    for path in [
        resources_source.join("node"),
        resources_source.join("ruxex-artifact-tool"),
    ] {
        if !path.is_dir() {
            return Err(format!(
                "bundled artifact runtime asset is missing: {}",
                path.display()
            ));
        }
    }
    let engine_source = path_source.join("ruxex-artifacts-engine");
    if !engine_source.is_file() {
        return Err(format!(
            "bundled artifact runtime asset is missing: {}",
            engine_source.display()
        ));
    }

    let resources_destination = skills_dir.join("ruxex-resources");
    reject_symlink(&resources_destination)?;
    remove_path_if_exists(&resources_destination)?;
    fs::create_dir_all(&resources_destination)
        .map_err(|error| format!("failed to create artifact runtime resources: {error}"))?;
    for name in ["node", "ruxex-artifact-tool"] {
        copy_directory_tree(
            &resources_source.join(name),
            &resources_destination.join(name),
        )
        .map_err(|error| format!("failed to sync artifact runtime resource `{name}`: {error}"))?;
    }

    let path_destination = skills_dir.join("ruxex-path");
    reject_symlink(&path_destination)?;
    fs::create_dir_all(&path_destination)
        .map_err(|error| format!("failed to create artifact runtime command directory: {error}"))?;
    let engine_destination = path_destination.join("ruxex-artifacts-engine");
    reject_symlink(&engine_destination)?;
    fs::copy(engine_source, &engine_destination)
        .map_err(|error| format!("failed to sync artifact runtime engine: {error}"))?;
    Ok(())
}

fn reject_symlink(path: &Path) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => Err(format!(
            "vendored Skills path must not be a symlink: {}",
            path.display()
        )),
        Ok(_) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "failed to inspect vendored Skills path {}: {error}",
            path.display()
        )),
    }
}

fn remove_path_if_exists(path: &Path) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() || metadata.is_file() => {
            fs::remove_file(path)
        }
        Ok(_) => fs::remove_dir_all(path),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => {
            return Err(format!(
                "failed to inspect bundled Skill path {}: {error}",
                path.display()
            ));
        }
    }
    .map_err(|error| {
        format!(
            "failed to replace bundled Skill path {}: {error}",
            path.display()
        )
    })
}

fn copy_directory_tree(source: &Path, destination: &Path) -> std::io::Result<()> {
    fs::create_dir_all(destination)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            copy_directory_tree(&source_path, &destination_path)?;
        } else if file_type.is_file() {
            fs::copy(source_path, destination_path)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use super::{
        TEST_RUXEX_HOME_LOCK, TestRuxexHomeOverride, product_identity, read_image_file,
        read_image_file_from_roots, ruxex_home_from_user_home, select_vendored_skills_source,
        sync_vendored_skills,
    };
    use crate::desktop_config::DesktopConfig;
    use crate::marketplace_assets::{
        detect_marketplace_image_mime, read_marketplace_asset_file_from_roots,
        validate_marketplace_asset_url, validate_marketplace_svg,
    };

    #[cfg(not(feature = "example"))]
    use crate::desktop_config::default_config;

    #[cfg(feature = "example")]
    use super::initialize_provider_home;

    fn test_default_config() -> DesktopConfig {
        #[cfg(feature = "example")]
        {
            return crate::desktop_config::example_provider_config(None);
        }

        #[cfg(not(feature = "example"))]
        {
            default_config()
        }
    }

    fn write_vendored_skill_fixture(root: &Path, file_content: &str) {
        for name in ["documents", "presentations", "spreadsheets", "pdf"] {
            let skill = root.join(name);
            fs::create_dir_all(skill.join("agents")).unwrap();
            fs::write(skill.join("SKILL.md"), file_content).unwrap();
            fs::write(skill.join("agents/ruxex.yaml"), "interface: {}\n").unwrap();
        }
    }

    #[test]
    fn image_file_reader_enforces_allowed_roots_types_and_size() {
        let root = std::env::temp_dir().join(format!(
            "ruxex-image-reader-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let outside = root.with_extension("outside");
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&outside).unwrap();

        let png = root.join("logo.png");
        fs::write(&png, b"\x89PNG\r\n\x1a\n").unwrap();
        assert_eq!(
            read_image_file_from_roots(&png, &[&root]).unwrap(),
            "data:image/png;base64,iVBORw0KGgo="
        );

        let unsupported = root.join("unsupported.svg");
        fs::write(&unsupported, b"<svg/>").unwrap();
        assert!(read_image_file_from_roots(&unsupported, &[&root]).is_err());
        assert!(read_image_file_from_roots(Path::new("relative.png"), &[&root]).is_err());

        let outside_png = outside.join("outside.png");
        fs::write(&outside_png, b"\x89PNG\r\n\x1a\n").unwrap();
        assert!(read_image_file_from_roots(&outside_png, &[&root]).is_err());

        let oversized = root.join("large.png");
        fs::write(&oversized, vec![b'x'; 16 * 1024 * 1024 + 1]).unwrap();
        assert!(
            read_image_file_from_roots(&oversized, &[&root])
                .unwrap_err()
                .message
                .contains("16 MiB")
        );
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    #[test]
    fn image_file_command_reads_from_the_configured_desktop_home() {
        let _env_lock = TEST_RUXEX_HOME_LOCK.lock().unwrap();
        let home = std::env::temp_dir().join(format!(
            "ruxex-image-command-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&home).unwrap();
        let _home_override = TestRuxexHomeOverride::set(&home);
        let image = home.join("command.png");
        fs::write(&image, b"\x89PNG\r\n\x1a\n").unwrap();

        assert_eq!(
            read_image_file(image.display().to_string()).unwrap(),
            "data:image/png;base64,iVBORw0KGgo="
        );

        drop(_home_override);
        fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn sync_vendored_skills_updates_only_bundled_skill_directories() {
        let root = std::env::temp_dir().join(format!(
            "ruxex-vendored-skills-sync-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let source = root.join("package/ruxex-resources/vendored/skills");
        let home = root.join("home");
        write_vendored_skill_fixture(&source, "new bundled skill\n");
        fs::create_dir_all(home.join("skills/user-skill")).unwrap();
        fs::write(home.join("skills/user-skill/SKILL.md"), "user\n").unwrap();
        fs::create_dir_all(home.join("vendored/skills/presentations")).unwrap();
        fs::write(
            home.join("vendored/skills/presentations/obsolete.txt"),
            "stale bundled file\n",
        )
        .unwrap();
        fs::create_dir_all(home.join("vendored/skills/custom")).unwrap();
        fs::write(home.join("vendored/skills/custom/SKILL.md"), "custom\n").unwrap();

        let result = sync_vendored_skills(&source, &home);

        assert_eq!(result.unwrap(), home.join("vendored/skills"));
        for name in ["documents", "presentations", "spreadsheets", "pdf"] {
            assert_eq!(
                fs::read_to_string(home.join(format!("vendored/skills/{name}/SKILL.md"))).unwrap(),
                "new bundled skill\n"
            );
            assert!(
                home.join(format!("vendored/skills/{name}/agents/ruxex.yaml"))
                    .is_file()
            );
        }
        assert!(
            !home
                .join("vendored/skills/presentations/obsolete.txt")
                .exists()
        );
        assert_eq!(
            fs::read_to_string(home.join("vendored/skills/custom/SKILL.md")).unwrap(),
            "custom\n"
        );
        assert_eq!(
            fs::read_to_string(home.join("skills/user-skill/SKILL.md")).unwrap(),
            "user\n"
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn sync_vendored_skills_rejects_missing_bundled_assets() {
        let root = std::env::temp_dir().join(format!(
            "ruxex-vendored-skills-missing-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let source = root.join("package/ruxex-resources/vendored/skills");
        let home = root.join("home");
        write_vendored_skill_fixture(&source, "bundled skill\n");
        fs::remove_dir_all(source.join("pdf")).unwrap();

        let error = sync_vendored_skills(&source, &home).unwrap_err();

        assert!(error.contains("pdf"));
        assert!(!home.join("vendored/skills").exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn artifact_runtime_assets_are_staged_when_the_skill_source_is_packaged() {
        let root = std::env::temp_dir().join(format!(
            "ruxex-vendored-runtime-sync-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let package = root.join("ruxex-package");
        let source = package.join("ruxex-resources/vendored/skills");
        let resources = package.join("ruxex-resources");
        let engine = package.join("ruxex-path/ruxex-artifacts-engine");
        let home = root.join("home");
        write_vendored_skill_fixture(&source, "bundled");
        fs::write(package.join("ruxex-package.json"), "{}").unwrap();
        fs::create_dir_all(resources.join("node/bin")).unwrap();
        fs::write(resources.join("node/bin/node"), "runtime").unwrap();
        fs::create_dir_all(resources.join("ruxex-artifact-tool")).unwrap();
        fs::write(resources.join("ruxex-artifact-tool/index.mjs"), "tool").unwrap();
        fs::create_dir_all(engine.parent().unwrap()).unwrap();
        fs::write(&engine, "engine").unwrap();

        let staged = sync_vendored_skills(&source, &home).unwrap();

        assert_eq!(
            fs::read_to_string(staged.join("ruxex-resources/node/bin/node")).unwrap(),
            "runtime"
        );
        assert_eq!(
            fs::read_to_string(staged.join("ruxex-resources/ruxex-artifact-tool/index.mjs"))
                .unwrap(),
            "tool"
        );
        assert_eq!(
            fs::read_to_string(staged.join("ruxex-path/ruxex-artifacts-engine")).unwrap(),
            "engine"
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn artifact_runtime_staging_reports_missing_assets_and_rejects_symlinks() {
        let root = std::env::temp_dir().join(format!(
            "ruxex-vendored-runtime-errors-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let package = root.join("ruxex-package");
        let source = package.join("ruxex-resources/vendored/skills");
        let resources = package.join("ruxex-resources");
        let home = root.join("home");
        write_vendored_skill_fixture(&source, "bundled");
        fs::write(package.join("ruxex-package.json"), "{}").unwrap();

        let missing_runtime = sync_vendored_skills(&source, &home).unwrap_err();
        assert!(missing_runtime.contains("node"));

        fs::create_dir_all(resources.join("node")).unwrap();
        fs::create_dir_all(resources.join("ruxex-artifact-tool")).unwrap();
        let missing_engine = sync_vendored_skills(&source, &home).unwrap_err();
        assert!(missing_engine.contains("ruxex-artifacts-engine"));

        let engine_dir = package.join("ruxex-path");
        fs::create_dir_all(&engine_dir).unwrap();
        fs::write(engine_dir.join("ruxex-artifacts-engine"), "engine").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;
            let staged_resources = home.join("vendored/skills/ruxex-resources");
            fs::create_dir_all(home.join("vendored/skills")).unwrap();
            symlink(&resources, &staged_resources).unwrap();
            let error = sync_vendored_skills(&source, &home).unwrap_err();
            assert!(error.contains("must not be a symlink"));
        }
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn skills_source_selection_checks_packaged_order_and_development_fallback() {
        let root = std::env::temp_dir().join(format!(
            "ruxex-vendored-selection-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let first = root.join("first");
        let second = root.join("second");
        let development = root.join("development");
        write_vendored_skill_fixture(&second, "packaged");
        write_vendored_skill_fixture(&development, "development");

        assert_eq!(
            select_vendored_skills_source(&[first.clone(), second.clone()], &development, true)
                .unwrap(),
            second
        );
        assert_eq!(
            select_vendored_skills_source(&[first], &development, true).unwrap(),
            development
        );
        assert!(select_vendored_skills_source(&[], &root.join("missing"), false).is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn desktop_home_is_isolated_under_user_home() {
        assert_eq!(
            ruxex_home_from_user_home(Path::new("/home/user"), &test_default_config()),
            Path::new("/home/user/.ruxex_desktop"),
        );
    }

    #[test]
    fn desktop_product_identity_is_separate_from_tui_branding() {
        let config = test_default_config();
        let identity = product_identity(&config);

        assert_eq!(identity.product_name(), "Ruxex Desktop");
        assert_eq!(identity.product_slug(), "ruxex-desktop");
        assert_eq!(identity.home_dir_name(), ".ruxex_desktop");
    }

    #[test]
    fn marketplace_asset_urls_are_limited_to_allowed_https_hosts() {
        assert!(
            validate_marketplace_asset_url(
                "https://raw.githubusercontent.com/acme/plugin/main/logo.svg"
            )
            .is_some()
        );
        for value in [
            "http://raw.githubusercontent.com/acme/plugin/main/logo.svg",
            "https://raw.githubusercontent.com.evil/acme/plugin/main/logo.svg",
            "https://user@raw.githubusercontent.com/acme/plugin/main/logo.svg",
            "https://raw.githubusercontent.com:444/acme/plugin/main/logo.svg",
            "https://raw.githubusercontent.com/acme/plugin/main/logo.svg?x=1",
            "https://raw.githubusercontent.com/acme/plugin/main/logo.svg#x",
            "https://raw.githubusercontent.com/acme/plugin/main/%2e%2e/logo.svg",
            "https://example.com/acme/plugin/main/logo.svg",
        ] {
            assert!(
                validate_marketplace_asset_url(value).is_none(),
                "URL should be rejected: {value}"
            );
        }
    }

    #[test]
    fn marketplace_image_validation_checks_content_and_svg_safety() {
        assert_eq!(
            detect_marketplace_image_mime(b"\x89PNG\r\n\x1a\n"),
            Some("image/png")
        );
        assert_eq!(
            detect_marketplace_image_mime(b"<svg xmlns=\"http://www.w3.org/2000/svg\" />"),
            Some("image/svg+xml")
        );
        assert!(validate_marketplace_svg(b"<svg><path /></svg>").is_ok());
        for value in [
            b"<svg><script>alert(1)</script></svg>".as_slice(),
            b"<svg onload=\"alert(1)\"></svg>".as_slice(),
            b"<svg><use href=\"https://example.com/icon.svg\" /></svg>".as_slice(),
        ] {
            assert!(validate_marketplace_svg(value).is_err());
        }
    }

    #[test]
    fn local_marketplace_asset_reader_revalidates_path_and_bytes() {
        let root = std::env::temp_dir().join(format!(
            "ruxex-marketplace-asset-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let path = root.join("logo.png");
        fs::write(&path, b"\x89PNG\r\n\x1a\n").unwrap();

        let data_url = read_marketplace_asset_file_from_roots(&path, &[root.as_path()]).unwrap();
        assert_eq!(data_url, "data:image/png;base64,iVBORw0KGgo=");
        assert!(
            read_marketplace_asset_file_from_roots(&root.join("missing.png"), &[root.as_path()])
                .is_err()
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[cfg(feature = "example")]
    #[test]
    fn dummy_provider_home_initialization_writes_and_validates_marker() {
        let home = std::env::temp_dir().join(format!(
            "ruxex-desktop-provider-home-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&home);

        let config = test_default_config();
        initialize_provider_home(
            &home,
            &product_identity(&config),
            &config.provider_factory.1,
        )
        .unwrap();
        let marker_path = home.join(product_identity(&config).home_marker_file());
        let marker = fs::read_to_string(&marker_path).unwrap();
        let marker: serde_json::Value = serde_json::from_str(&marker).unwrap();
        assert_eq!(marker["providerKind"], "dummy");

        initialize_provider_home(
            &home,
            &product_identity(&config),
            &config.provider_factory.1,
        )
        .unwrap();

        let _ = fs::remove_dir_all(home);
    }

    #[cfg(feature = "example")]
    #[test]
    fn legacy_example_provider_home_is_migrated_to_dummy() {
        let home = std::env::temp_dir().join(format!(
            "ruxex-desktop-legacy-example-home-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&home);
        fs::create_dir_all(&home).unwrap();
        fs::write(
            home.join(product_identity(&test_default_config()).home_marker_file()),
            serde_json::json!({
                "formatVersion": 2,
                "providerKind": "example",
                "providerProtocolVersion": ruxex::provider::contract::CURRENT_PROVIDER_PROTOCOL_VERSION,
                "serverSignature": "legacy-example-signature"
            })
            .to_string(),
        )
        .unwrap();

        let config = test_default_config();
        initialize_provider_home(
            &home,
            &product_identity(&config),
            &config.provider_factory.1,
        )
        .unwrap();

        let marker: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(home.join(product_identity(&config).home_marker_file())).unwrap(),
        )
        .unwrap();
        assert_eq!(marker["providerKind"], "dummy");
        assert_eq!(marker["serverSignature"], "legacy-example-signature");

        let _ = fs::remove_dir_all(home);
    }

    #[cfg(feature = "example")]
    #[test]
    fn legacy_nonempty_home_is_initialized_without_deleting_data() {
        let home =
            std::env::temp_dir().join(format!("ruxex-desktop-legacy-home-{}", std::process::id()));
        let _ = fs::remove_dir_all(&home);
        fs::create_dir_all(home.join("app-server-daemon")).unwrap();
        fs::write(home.join("schedules.json"), "[]\n").unwrap();

        let config = test_default_config();
        initialize_provider_home(
            &home,
            &product_identity(&config),
            &config.provider_factory.1,
        )
        .unwrap();

        assert!(home.join("schedules.json").is_file());
        assert!(
            home.join(product_identity(&config).home_marker_file())
                .is_file()
        );

        let _ = fs::remove_dir_all(home);
    }

    #[test]
    fn vendored_skills_source_uses_the_plugin_tree_when_dev_package_is_unstaged() {
        let root = std::env::temp_dir().join(format!(
            "ruxex-vendored-skills-source-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let staged = root.join("staged/ruxex-resources/vendored/skills");
        let development = root.join("plugins/ruxex-artifacts/skills");
        write_vendored_skill_fixture(&development, "development skill\n");

        assert_eq!(
            super::select_vendored_skills_source(
                std::slice::from_ref(&staged),
                &development,
                true,
            )
            .unwrap(),
            development
        );
        assert!(
            super::select_vendored_skills_source(
                std::slice::from_ref(&staged),
                &development,
                false,
            )
            .is_err()
        );
        let _ = fs::remove_dir_all(root);
    }
}
