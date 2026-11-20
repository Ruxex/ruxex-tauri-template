use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::Value;
use zip::ZipWriter;
use zip::write::SimpleFileOptions;

struct TempDir(PathBuf);

impl TempDir {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!(
            "ruxex-docx-render-integration-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system clock after Unix epoch")
                .as_nanos()
        ));
        fs::create_dir(&path).expect("create integration temp directory");
        Self(path)
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn write_minimal_docx(path: &Path) {
    let file = File::create(path).expect("create fixture DOCX");
    let mut archive = ZipWriter::new(file);
    let options = SimpleFileOptions::default();
    for (name, contents) in [
        (
            "[Content_Types].xml",
            r#"<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"#,
        ),
        (
            "_rels/.rels",
            r#"<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"#,
        ),
        (
            "word/document.xml",
            r#"<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>Managed renderer integration check</w:t></w:r></w:p>
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>"#,
        ),
    ] {
        archive
            .start_file(name, options)
            .expect("start fixture DOCX member");
        archive
            .write_all(contents.as_bytes())
            .expect("write fixture DOCX member");
    }
    archive.finish().expect("finish fixture DOCX");
}

fn run_helper(args: &[&str]) -> Value {
    let mut command = Command::new(env!("CARGO_BIN_EXE_ruxex-artifacts"));
    command.args(args);
    if let Some(path) = std::env::var_os("RUXEX_TEST_PATH") {
        command.env("PATH", path);
    }
    let result = command.output().expect("run ruxex-artifacts");
    assert!(
        result.status.success(),
        "ruxex-artifacts failed: {}\n{}",
        String::from_utf8_lossy(&result.stdout),
        String::from_utf8_lossy(&result.stderr)
    );
    serde_json::from_slice(&result.stdout).expect("parse helper JSON output")
}

#[test]
fn bundled_office_and_poppler_render_and_compare_a_real_docx() {
    if std::env::var_os("RUXEX_RUNTIME_ROOT").is_none()
        || std::env::var_os("RUXEX_RUNTIME_BIN_DIR").is_none()
    {
        eprintln!("skipping managed-runtime integration: bundled runtime is not configured");
        return;
    }

    let temporary = TempDir::new();
    let source = temporary.path().join("report.docx");
    write_minimal_docx(&source);

    let pages_dir = temporary.path().join("pages");
    let rendered = run_helper(&[
        "docx",
        "helper",
        "render",
        "--input",
        source.to_str().expect("UTF-8 source path"),
        "--output-dir",
        pages_dir.to_str().expect("UTF-8 output path"),
        "--dpi",
        "72",
        "--keep-pdf",
        "--json",
    ]);
    let pages = rendered["pages"].as_array().expect("rendered page list");
    assert_eq!(pages.len(), 1);
    let page_path = pages[0].as_str().expect("page path");
    let (width, height) = image::image_dimensions(page_path).expect("valid rendered PNG");
    assert!(width > 0 && height > 0);
    let pdf_path = pages_dir.join("report.pdf");
    assert!(fs::metadata(pdf_path).expect("rendered PDF exists").len() > 0);

    let comparison_dir = temporary.path().join("comparison");
    let comparison = run_helper(&[
        "docx",
        "helper",
        "compare",
        "--before",
        source.to_str().expect("UTF-8 source path"),
        "--after",
        source.to_str().expect("UTF-8 source path"),
        "--output-dir",
        comparison_dir.to_str().expect("UTF-8 comparison path"),
        "--dpi",
        "72",
        "--json",
    ]);
    assert_eq!(comparison["pageCounts"]["before"], 1);
    assert_eq!(comparison["pageCounts"]["after"], 1);
    assert!(comparison["imageDiffAvailable"].as_bool().unwrap_or(false));
    assert!(comparison_dir.join("comparison.json").is_file());
}
