use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::process::Stdio;
use std::time::{SystemTime, UNIX_EPOCH};

fn binary() -> &'static str {
    env!("CARGO_BIN_EXE_ruxex-artifacts")
}

fn engine_binary() -> String {
    std::env::var("CARGO_BIN_EXE_ruxex-artifacts-engine")
        .or_else(|_| std::env::var("CARGO_BIN_EXE_ruxex_artifacts_engine"))
        .expect("cargo exposes the private artifact engine binary")
}

fn temp_dir(label: &str) -> PathBuf {
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock is after unix epoch")
        .as_nanos();
    let path = std::env::temp_dir().join(format!("ruxex-artifacts-{label}-{suffix}"));
    fs::create_dir_all(&path).expect("temporary directory is writable");
    path
}

fn run(args: &[&str]) -> Output {
    Command::new(binary())
        .args(args)
        .output()
        .expect("artifact CLI starts")
}

fn run_engine(request: &str) -> Output {
    let mut child = Command::new(engine_binary())
        .arg("--json-stdio")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("artifact engine starts");
    child
        .stdin
        .take()
        .expect("engine stdin is available")
        .write_all(request.as_bytes())
        .expect("engine request is writable");
    child.wait_with_output().expect("engine exits")
}

fn write_input(dir: &Path, contents: &str) -> PathBuf {
    let path = dir.join("input.json");
    fs::write(&path, contents).expect("input JSON is writable");
    path
}

#[test]
fn capabilities_reports_the_supported_artifact_commands() {
    let output = run(&["capabilities", "--json"]);

    assert!(output.status.success());
    let value: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["ok"], true);
    assert_eq!(value["commands"]["xlsx"][0], "create");
    assert_eq!(value["commands"]["xlsx"][1], "read");
    assert_eq!(value["commands"]["xlsx"][2], "validate");
}

#[test]
fn malformed_json_returns_structured_diagnostic() {
    let dir = temp_dir("malformed");
    let input = write_input(&dir, "{\"sheets\": [}");
    let output = run(&[
        "xlsx",
        "create",
        "--input",
        input.to_str().unwrap(),
        "--output",
        dir.join("broken.xlsx").to_str().unwrap(),
        "--json",
    ]);

    assert!(!output.status.success());
    let diagnostic: serde_json::Value = serde_json::from_slice(&output.stderr).unwrap();
    assert_eq!(diagnostic["ok"], false);
    assert_eq!(diagnostic["error"]["code"], "invalid_json");
}

#[test]
fn xlsx_create_and_read_preserve_scalar_cells_and_sheet_names() {
    let dir = temp_dir("roundtrip");
    let input = write_input(
        &dir,
        r#"{"sheets":[{"name":"Summary","rows":[["name", "Ada"],["count", 3],["enabled", true],["empty", null]]},{"name":"Details","rows":[["id", 1]]}]}"#,
    );
    let workbook = dir.join("report.xlsx");
    let created = run(&[
        "xlsx",
        "create",
        "--input",
        input.to_str().unwrap(),
        "--output",
        workbook.to_str().unwrap(),
        "--json",
    ]);
    assert!(created.status.success());

    let read = run(&[
        "xlsx",
        "read",
        "--input",
        workbook.to_str().unwrap(),
        "--json",
    ]);
    assert!(read.status.success());
    let value: serde_json::Value = serde_json::from_slice(&read.stdout).unwrap();
    assert_eq!(value["sheets"][0]["name"], "Summary");
    assert_eq!(value["sheets"][0]["rows"][1][1], 3);
    assert_eq!(value["sheets"][0]["rows"][2][1], true);
    assert_eq!(value["sheets"][0]["rows"][3][1], serde_json::Value::Null);
    assert_eq!(value["sheets"][1]["name"], "Details");
}

#[test]
fn xlsx_validate_reports_dimensions_for_each_sheet() {
    let dir = temp_dir("validate");
    let input = write_input(
        &dir,
        r#"{"sheets":[{"name":"One","rows":[[1,2],[3,4]]},{"name":"Two","rows":[["x"]]}]}"#,
    );
    let workbook = dir.join("dimensions.xlsx");
    assert!(
        run(&[
            "xlsx",
            "create",
            "--input",
            input.to_str().unwrap(),
            "--output",
            workbook.to_str().unwrap(),
            "--json",
        ])
        .status
        .success()
    );

    let output = run(&[
        "xlsx",
        "validate",
        "--input",
        workbook.to_str().unwrap(),
        "--json",
    ]);
    assert!(output.status.success());
    let value: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["valid"], true);
    assert_eq!(value["sheets"][0]["rows"], 2);
    assert_eq!(value["sheets"][0]["columns"], 2);
    assert_eq!(value["sheets"][1]["rows"], 1);
    assert_eq!(value["sheets"][1]["columns"], 1);
}

#[test]
fn unsupported_cell_values_are_rejected_without_creating_a_workbook() {
    let dir = temp_dir("unsupported");
    let input = write_input(
        &dir,
        r#"{"sheets":[{"name":"Summary","rows":[[{"nested":true}]]}]}"#,
    );
    let workbook = dir.join("unsupported.xlsx");
    let output = run(&[
        "xlsx",
        "create",
        "--input",
        input.to_str().unwrap(),
        "--output",
        workbook.to_str().unwrap(),
        "--json",
    ]);

    assert!(!output.status.success());
    let diagnostic: serde_json::Value = serde_json::from_slice(&output.stderr).unwrap();
    assert_eq!(diagnostic["error"]["code"], "unsupported_cell_value");
    assert!(!workbook.exists());
}

#[test]
fn unknown_xlsx_flags_return_an_invalid_arguments_diagnostic() {
    let output = run(&[
        "xlsx",
        "validate",
        "--unknown",
        "value",
        "--input",
        "/path/that/does/not/exist.xlsx",
        "--json",
    ]);

    assert!(!output.status.success());
    let diagnostic: serde_json::Value = serde_json::from_slice(&output.stderr).unwrap();
    assert_eq!(diagnostic["error"]["code"], "invalid_arguments");
}

#[test]
fn json_stdio_engine_creates_a_workbook_from_a_versioned_request() {
    let dir = temp_dir("engine-create");
    let input = write_input(
        &dir,
        r#"{"sheets":[{"name":"Summary","rows":[["Name","Count"],["Ada",3]]}]}"#,
    );
    let workbook = dir.join("engine-report.xlsx");
    let request = serde_json::json!({
        "version": 1,
        "operation": "create",
        "input_path": input,
        "output_path": workbook,
    });
    let output = run_engine(&format!("{}\n", request));

    assert!(output.status.success());
    let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(response["ok"], true);
    assert!(workbook.is_file());
}

#[test]
fn json_stdio_engine_rejects_unknown_protocol_versions() {
    let output = run_engine(
        r#"{"version":999,"operation":"validate","input_path":"missing.xlsx"}
"#,
    );

    assert!(!output.status.success());
    let diagnostic: serde_json::Value = serde_json::from_slice(&output.stderr).unwrap();
    assert_eq!(diagnostic["error"]["code"], "unsupported_protocol_version");
}

#[test]
fn launcher_reports_missing_bundled_runtime_instead_of_using_host_node() {
    let output = run(&["run", "/tmp/ruxex-builder.mjs"]);

    assert!(!output.status.success());
    let diagnostic: serde_json::Value = serde_json::from_slice(&output.stderr).unwrap();
    assert_eq!(diagnostic["error"]["code"], "missing_runtime_resource");
}
