use std::fs;
use std::io::Write;
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};

fn engine_binary() -> &'static str {
    env!("CARGO_BIN_EXE_ruxex-artifacts-engine")
}

fn temp_dir(label: &str) -> std::path::PathBuf {
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock is after unix epoch")
        .as_nanos();
    let path = std::env::temp_dir().join(format!("ruxex-artifact-engine-{label}-{suffix}"));
    fs::create_dir_all(&path).expect("temporary directory is writable");
    path
}

fn run_engine(request: &str) -> std::process::Output {
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

#[test]
fn json_stdio_engine_creates_a_workbook_from_a_versioned_request() {
    let dir = temp_dir("engine-create");
    let input = dir.join("input.json");
    fs::write(
        &input,
        r#"{"sheets":[{"name":"Summary","rows":[["Name","Count"],["Ada",3]]}]}"#,
    )
    .expect("input JSON is writable");
    let workbook = dir.join("engine-report.xlsx");
    let request = serde_json::json!({
        "version": 1,
        "operation": "create",
        "input_path": input,
        "output_path": workbook,
    });
    let output = run_engine(&format!("{request}\n"));

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
