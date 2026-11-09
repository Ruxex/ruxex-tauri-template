use std::fs;
use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::process::{Command, Output};
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

fn write_ooxml_package(dir: &Path, label: &str, parts: &[&str]) -> PathBuf {
    let path = dir.join(format!("{label}.zip"));
    let file = File::create(&path).expect("package is writable");
    let mut archive = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default();
    for part in parts {
        archive
            .start_file(*part, options)
            .expect("package part starts");
        archive
            .write_all(b"<package-part />")
            .expect("package part is writable");
    }
    archive.finish().expect("package finishes");
    path
}

fn write_zip_parts(dir: &Path, label: &str, parts: &[(&str, &[u8])]) -> PathBuf {
    let path = dir.join(format!("{label}.zip"));
    let file = File::create(&path).expect("package is writable");
    let mut archive = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default();
    for (name, contents) in parts {
        archive
            .start_file(*name, options)
            .expect("package part starts");
        archive
            .write_all(contents)
            .expect("package part is writable");
    }
    archive.finish().expect("package finishes");
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
    assert_eq!(value["commands"]["docx"][0], "create");
    assert_eq!(value["commands"]["docx"][1], "read");
    assert_eq!(value["commands"]["docx"][2], "validate");
    assert_eq!(value["commands"]["pptx"][0], "create");
    assert_eq!(value["commands"]["pptx"][1], "read");
    assert_eq!(value["commands"]["pptx"][2], "validate");
    assert_eq!(value["commands"]["pdf"][0], "create");
    assert_eq!(value["commands"]["pdf"][1], "read");
    assert_eq!(value["commands"]["pdf"][2], "validate");
}

#[test]
fn pdf_create_read_and_validate_support_local_text_pages() {
    let dir = temp_dir("pdf-roundtrip");
    let input = write_input(
        &dir,
        r#"{"pages":[{"width":595,"height":842,"blocks":[{"text":"Page one","x":48,"y":780,"size":18},{"text":"Total 3","x":48,"y":740,"size":12}]},{"width":595,"height":842,"blocks":[{"text":"Page two","x":48,"y":780,"size":18}]}]}"#,
    );
    let pdf = dir.join("report.pdf");
    let created = run(&[
        "pdf",
        "create",
        "--input",
        input.to_str().unwrap(),
        "--output",
        pdf.to_str().unwrap(),
        "--json",
    ]);
    assert!(
        created.status.success(),
        "{}",
        String::from_utf8_lossy(&created.stderr)
    );

    let validated = run(&[
        "pdf",
        "validate",
        "--input",
        pdf.to_str().unwrap(),
        "--json",
    ]);
    assert!(validated.status.success());
    let validation: serde_json::Value = serde_json::from_slice(&validated.stdout).unwrap();
    assert_eq!(validation["valid"], true);
    assert_eq!(validation["pages"], 2);

    let read = run(&["pdf", "read", "--input", pdf.to_str().unwrap(), "--json"]);
    assert!(read.status.success());
    let response: serde_json::Value = serde_json::from_slice(&read.stdout).unwrap();
    assert_eq!(response["pages"], 2);
    assert!(
        response["text"]
            .as_array()
            .unwrap()
            .iter()
            .any(|value| value == "Page two")
    );
}

#[test]
fn docx_validate_accepts_a_minimal_editable_package() {
    let dir = temp_dir("docx-validate");
    let package = write_ooxml_package(
        &dir,
        "report.docx",
        &[
            "[Content_Types].xml",
            "_rels/.rels",
            "word/document.xml",
            "word/_rels/document.xml.rels",
            "word/styles.xml",
        ],
    );
    let output = run(&[
        "docx",
        "validate",
        "--input",
        package.to_str().unwrap(),
        "--json",
    ]);

    assert!(output.status.success());
    let value: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["valid"], true);
    assert_eq!(value["format"], "docx");
}

#[test]
fn pptx_validate_accepts_a_minimal_editable_package() {
    let dir = temp_dir("pptx-validate");
    let package = write_ooxml_package(
        &dir,
        "review.pptx",
        &[
            "[Content_Types].xml",
            "_rels/.rels",
            "ppt/presentation.xml",
            "ppt/_rels/presentation.xml.rels",
            "ppt/slides/slide1.xml",
        ],
    );
    let output = run(&[
        "pptx",
        "validate",
        "--input",
        package.to_str().unwrap(),
        "--json",
    ]);

    assert!(output.status.success());
    let value: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["valid"], true);
    assert_eq!(value["format"], "pptx");
}

#[test]
fn docx_read_returns_editable_text_tables_and_loss_diagnostics() {
    let dir = temp_dir("docx-read");
    let package = write_zip_parts(
        &dir,
        "report.docx",
        &[
            ("[Content_Types].xml", b"<types />"),
            ("_rels/.rels", b"<rels />"),
            ("word/_rels/document.xml.rels", b"<rels />"),
            ("word/styles.xml", b"<styles />"),
            (
                "word/document.xml",
                br#"<w:document><w:body><w:p><w:pPr><w:pStyle w:val="Heading1" /></w:pPr><w:r><w:t>Quarterly Review</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Name</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Value</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:drawing /></w:r></w:p></w:body></w:document>"#,
            ),
        ],
    );
    let output = run(&[
        "docx",
        "read",
        "--input",
        package.to_str().unwrap(),
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let value: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["items"][0]["kind"], "heading");
    assert_eq!(value["items"][0]["text"], "Quarterly Review");
    assert_eq!(value["items"][1]["kind"], "table");
    assert_eq!(value["diagnostics"][0]["code"], "unsupported_images");
}

#[test]
fn pptx_read_returns_editable_text_slides_and_loss_diagnostics() {
    let dir = temp_dir("pptx-read");
    let package = write_zip_parts(
        &dir,
        "review.pptx",
        &[
            ("[Content_Types].xml", b"<types />"),
            ("_rels/.rels", b"<rels />"),
            ("ppt/_rels/presentation.xml.rels", b"<rels />"),
            ("ppt/presentation.xml", b"<p:presentation />"),
            (
                "ppt/slides/slide1.xml",
                br#"<p:sld><p:sp><a:t>Quarterly Review</a:t></p:sp><p:graphicFrame /></p:sld>"#,
            ),
        ],
    );
    let output = run(&[
        "pptx",
        "read",
        "--input",
        package.to_str().unwrap(),
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let value: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["slides"][0]["objects"][0]["text"], "Quarterly Review");
    assert_eq!(value["diagnostics"][0]["code"], "unsupported_slide_objects");
}

#[test]
fn ooxml_validate_rejects_a_package_without_required_parts() {
    let dir = temp_dir("invalid-ooxml");
    let package = write_ooxml_package(&dir, "broken.docx", &["junk.txt"]);
    let output = run(&[
        "docx",
        "validate",
        "--input",
        package.to_str().unwrap(),
        "--json",
    ]);

    assert!(!output.status.success());
    let diagnostic: serde_json::Value = serde_json::from_slice(&output.stderr).unwrap();
    assert_eq!(diagnostic["ok"], false);
    assert_eq!(diagnostic["error"]["code"], "invalid_ooxml_package");
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

#[test]
fn engine_creates_rich_xlsx_metadata_and_reports_formula_counts() {
    let dir = temp_dir("engine-rich-xlsx");
    let input = write_input(
        &dir,
        r##"{
          "sheets": [{
            "name": "Summary",
            "rows": [["Name", "Count"], ["Ada", 3], ["Grace", 5], ["Total", 8]],
            "formulas": [[null, null], [null, null], [null, null], [null, "=SUM(B2:B3)"]],
            "formats": [{
              "range": "A1:B1",
              "font": {"bold": true, "color": "#ffffff"},
              "fill": "#1f4e78",
              "horizontal_alignment": "center"
            }, {
              "range": "A2",
              "font": {"italic": true}
            }],
            "merges": [{"range": "A1:B1"}],
            "column_widths": [{"column": "A", "width": 18}],
            "tables": [{"name": "SummaryTable", "range": "A1:B3", "has_headers": true}],
            "charts": [{
              "type": "column",
              "position": "D2:J16",
              "series": [{"name": "Count", "categories": "A2:A3", "values": "B2:B3"}]
            }]
          }]
        }"##,
    );
    let workbook = dir.join("rich.xlsx");
    let output = run(&[
        "xlsx",
        "create",
        "--input",
        input.to_str().unwrap(),
        "--output",
        workbook.to_str().unwrap(),
        "--json",
    ]);

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(response["formulas"]["total"], 1);
    assert_eq!(response["formulas"]["evaluated"], 1);
    assert_eq!(response["objects"]["merges"], 1);
    assert_eq!(response["objects"]["tables"], 1);
    assert_eq!(response["objects"]["charts"], 1);
    assert!(workbook.is_file());

    let file = File::open(&workbook).unwrap();
    let mut archive = zip::ZipArchive::new(file).unwrap();
    let worksheet = archive.by_name("xl/worksheets/sheet1.xml").unwrap();
    let worksheet = std::io::read_to_string(worksheet).unwrap();
    assert!(worksheet.contains("<f>SUM(B2:B3)</f>"));
    assert!(worksheet.contains("<mergeCell ref=\"A1:B1\""));

    let read = run(&[
        "xlsx",
        "read",
        "--input",
        workbook.to_str().unwrap(),
        "--json",
    ]);
    assert!(
        read.status.success(),
        "{}",
        String::from_utf8_lossy(&read.stderr)
    );
    let read_value: serde_json::Value = serde_json::from_slice(&read.stdout).unwrap();
    assert_eq!(read_value["sheets"][0]["merges"][0]["range"], "A1:B1");
    assert_eq!(read_value["sheets"][0]["tables"][0]["name"], "SummaryTable");
    assert_eq!(read_value["sheets"][0]["charts"][0]["type"], "column");
    assert!(read_value["sheets"][0]["formats"].as_array().unwrap().len() >= 1);
}

#[test]
fn engine_rejects_invalid_rich_xlsx_metadata() {
    let dir = temp_dir("engine-invalid-rich-xlsx");
    let input = write_input(
        &dir,
        r##"{
          "sheets": [{
            "name": "Summary",
            "rows": [[1]],
            "formats": [{"range": "A1", "fill": "not-a-color"}]
          }]
        }"##,
    );
    let workbook = dir.join("invalid-rich.xlsx");
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
    assert_eq!(diagnostic["error"]["code"], "invalid_format");
    assert!(!workbook.exists());
}
