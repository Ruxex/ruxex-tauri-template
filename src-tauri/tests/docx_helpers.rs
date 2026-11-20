use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Command, Output};
use std::time::{SystemTime, UNIX_EPOCH};

fn binary() -> &'static str {
    env!("CARGO_BIN_EXE_ruxex-artifacts")
}

fn temp_dir(label: &str) -> PathBuf {
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock is after unix epoch")
        .as_nanos();
    let path = std::env::temp_dir().join(format!("ruxex-docx-{label}-{suffix}"));
    fs::create_dir_all(&path).expect("temporary directory is writable");
    path
}

fn run(args: &[&str]) -> Output {
    Command::new(binary())
        .args(args)
        .output()
        .expect("artifact CLI starts")
}

fn read_zip_part(archive: &mut zip::ZipArchive<File>, name: &str) -> String {
    let mut contents = String::new();
    archive
        .by_name(name)
        .unwrap()
        .read_to_string(&mut contents)
        .unwrap();
    contents
}

fn write_docx(dir: &std::path::Path) -> PathBuf {
    write_docx_with_document(
        dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading2"/><w:spacing w:after="120"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Aptos"/><w:b/></w:rPr><w:t>Heading text</w:t></w:r></w:p></w:body></w:document>"#,
    )
}

fn write_docx_with_document(dir: &std::path::Path, document_xml: &str) -> PathBuf {
    write_docx_with_parts(dir, document_xml, &[])
}

fn write_docx_with_parts(
    dir: &std::path::Path,
    document_xml: &str,
    extra_parts: &[(&str, &str)],
) -> PathBuf {
    let path = dir.join("style-lint.docx");
    let file = File::create(&path).expect("DOCX package is writable");
    let mut archive = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default();
    for (name, contents) in [
        ("[Content_Types].xml", "<Types />"),
        ("_rels/.rels", "<Relationships />"),
        ("word/document.xml", document_xml),
        ("word/_rels/document.xml.rels", "<Relationships />"),
        (
            "word/styles.xml",
            "<w:styles xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii=\"Aptos\"/><w:sz w:val=\"22\"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type=\"paragraph\" w:styleId=\"Normal\"><w:name w:val=\"Normal\"/></w:style></w:styles>",
        ),
    ] {
        archive.start_file(name, options).expect("DOCX part starts");
        archive
            .write_all(contents.as_bytes())
            .expect("DOCX part is writable");
    }
    for (name, contents) in extra_parts {
        archive
            .start_file(*name, options)
            .expect("extra part starts");
        archive
            .write_all(contents.as_bytes())
            .expect("extra part is writable");
    }
    archive.finish().expect("DOCX package finishes");
    path
}

fn write_docx_with_headers(dir: &std::path::Path, headers: &[&str]) -> PathBuf {
    let path = dir.join("watermark.docx");
    let file = File::create(&path).expect("DOCX package is writable");
    let mut archive = zip::ZipWriter::new(file);
    archive.set_comment("Preserve archive comment");
    let options = zip::write::SimpleFileOptions::default();
    for (name, contents) in [
        (
            "word/document.xml",
            format!(
                r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:sectPr>{}</w:sectPr></w:body></w:document>"#,
                headers
                    .iter()
                    .enumerate()
                    .map(|(index, _)| format!(r#"<w:headerReference w:type="default" r:id="rId{index}"/>"#))
                    .collect::<String>()
            ),
        ),
        (
            "word/_rels/document.xml.rels",
            format!(
                r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{}</Relationships>"#,
                headers
                    .iter()
                    .enumerate()
                    .map(|(index, name)| format!(r#"<Relationship Id="rId{index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="{name}"/>"#))
                    .collect::<String>()
            ),
        ),
        (
            "[Content_Types].xml",
            "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\" />".to_string(),
        ),
        ("_rels/.rels", "<Relationships />".to_string()),
    ] {
        archive.start_file(name, options).unwrap();
        archive.write_all(contents.as_bytes()).unwrap();
    }
    for name in headers {
        archive.start_file(format!("word/{name}"), options).unwrap();
        archive
            .write_all(
                br#"<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" mc:Ignorable="w14"><!--keep--><w:p><w:r><w:t>Existing header</w:t></w:r></w:p></w:hdr>"#,
            )
            .unwrap();
    }
    archive.start_file("custom/opaque.bin", options).unwrap();
    archive.write_all(b"\0opaque\xff").unwrap();
    archive.finish().unwrap();
    path
}

fn write_docx_with_document_rels(
    dir: &std::path::Path,
    document_xml: &str,
    relationships_xml: &str,
) -> PathBuf {
    let path = dir.join("document-rels.docx");
    let file = File::create(&path).expect("DOCX package is writable");
    let mut archive = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default();
    for (name, contents) in [
        (
            "[Content_Types].xml",
            "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\" />",
        ),
        ("_rels/.rels", "<Relationships />"),
        ("word/document.xml", document_xml),
        ("word/_rels/document.xml.rels", relationships_xml),
        (
            "word/styles.xml",
            "<w:styles xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" />",
        ),
    ] {
        archive.start_file(name, options).unwrap();
        archive.write_all(contents.as_bytes()).unwrap();
    }
    archive.finish().unwrap();
    path
}

#[test]
fn style_lint_reports_direct_formatting_fonts_and_heading_paragraphs() {
    let dir = temp_dir("style-lint");
    let input = write_docx(&dir);
    let output = run(&[
        "docx",
        "helper",
        "style-lint",
        "--input",
        input.to_str().unwrap(),
        "--json",
    ]);

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(response["ok"], true);
    assert_eq!(response["format"], "docx");
    assert_eq!(response["summary"]["paragraphs"], 1);
    assert_eq!(response["summary"]["paragraphsWithDirectFormatting"], 1);
    assert_eq!(response["summary"]["paragraphsWithRunOverrides"], 1);
    assert_eq!(response["summary"]["headingParagraphs"], 1);
    assert_eq!(response["fonts"]["Aptos"], 1);
    assert_eq!(response["headingParagraphs"][0]["text"], "Heading text");
}

#[test]
fn audit_features_reports_heading_level_skips() {
    let dir = temp_dir("audit-features");
    let input = write_docx(&dir);
    let output = run(&[
        "docx",
        "helper",
        "audit-features",
        "--input",
        input.to_str().unwrap(),
        "--json",
    ]);

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(response["ok"], true);
    assert_eq!(response["findings"][0]["code"], "heading_level_skip");
    assert_eq!(response["findings"][0]["part"], "word/document.xml");
}

#[test]
fn tables_to_csv_writes_utf8_bom_and_escapes_csv_cells() {
    let dir = temp_dir("tables-to-csv");
    let input = write_docx_with_document(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr><w:tc><w:p><w:r><w:t>North, West</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Quote "City"</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>"#,
    );
    let output_dir = dir.join("csv");
    let output = run(&[
        "docx",
        "helper",
        "tables-to-csv",
        "--input",
        input.to_str().unwrap(),
        "--output-dir",
        output_dir.to_str().unwrap(),
        "--json",
    ]);

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(response["ok"], true);
    assert_eq!(response["count"], 1);
    let csv = fs::read(output_dir.join("table-1.csv")).unwrap();
    assert!(csv.starts_with(&[0xef, 0xbb, 0xbf]));
    assert_eq!(
        String::from_utf8(csv[3..].to_vec()).unwrap(),
        "\"North, West\",\"Quote \"\"City\"\"\"\r\n"
    );
}

#[test]
fn tables_to_csv_refuses_existing_outputs_without_overwriting_them() {
    let dir = temp_dir("tables-collision");
    let input = write_docx_with_document(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr><w:tc><w:p><w:r><w:t>value</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>"#,
    );
    let output_dir = dir.join("csv");
    fs::create_dir_all(&output_dir).unwrap();
    let existing = output_dir.join("table-1.csv");
    fs::write(&existing, "keep me").unwrap();
    let output = run(&[
        "docx",
        "helper",
        "tables-to-csv",
        "--input",
        input.to_str().unwrap(),
        "--output-dir",
        output_dir.to_str().unwrap(),
        "--json",
    ]);

    assert!(!output.status.success());
    let response: serde_json::Value = serde_json::from_slice(&output.stderr).unwrap();
    assert_eq!(response["error"]["code"], "output_exists");
    assert_eq!(fs::read_to_string(existing).unwrap(), "keep me");
}

#[test]
fn inspect_review_markup_extracts_comments_anchors_and_revisions() {
    let dir = temp_dir("review-markup");
    let input = write_docx_with_parts(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:commentRangeStart w:id="7"/><w:ins w:id="11" w:author="Editor" w:date="2026-11-20T00:00:00Z"><w:r><w:t>added</w:t></w:r></w:ins><w:commentRangeEnd w:id="7"/><w:r><w:commentReference w:id="7"/></w:r></w:p></w:body></w:document>"#,
        &[
            (
                "word/comments.xml",
                r#"<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="7" w:author="A. Writer" w:initials="AW" w:date="2026-11-19T00:00:00Z"><w:p><w:r><w:t>Please clarify.</w:t></w:r></w:p></w:comment></w:comments>"#,
            ),
            (
                "word/header1.xml",
                r#"<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:del w:id="12" w:author="Editor"><w:r><w:delText>removed</w:delText></w:r></w:del></w:p></w:hdr>"#,
            ),
        ],
    );

    let comments = run(&[
        "docx",
        "helper",
        "inspect-review-markup",
        "--input",
        input.to_str().unwrap(),
        "--kind",
        "comments",
        "--json",
    ]);
    assert!(
        comments.status.success(),
        "{}",
        String::from_utf8_lossy(&comments.stderr)
    );
    let comments_json: serde_json::Value = serde_json::from_slice(&comments.stdout).unwrap();
    assert_eq!(comments_json["kind"], "comments");
    assert_eq!(comments_json["records"][0]["id"], "7");
    assert_eq!(comments_json["records"][0]["text"], "Please clarify.");
    assert_eq!(comments_json["records"][0]["anchors"]["rangeStarts"], 1);
    assert_eq!(comments_json["records"][0]["anchors"]["rangeEnds"], 1);
    assert_eq!(comments_json["records"][0]["anchors"]["references"], 1);

    let revisions = run(&[
        "docx",
        "helper",
        "inspect-review-markup",
        "--input",
        input.to_str().unwrap(),
        "--kind",
        "revisions",
        "--json",
    ]);
    assert!(
        revisions.status.success(),
        "{}",
        String::from_utf8_lossy(&revisions.stderr)
    );
    let revisions_json: serde_json::Value = serde_json::from_slice(&revisions.stdout).unwrap();
    assert_eq!(revisions_json["records"].as_array().unwrap().len(), 2);
    assert!(
        revisions_json["records"]
            .as_array()
            .unwrap()
            .iter()
            .any(|record| {
                record["part"] == "word/document.xml"
                    && record["kind"] == "ins"
                    && record["text"] == "added"
            })
    );
    assert!(
        revisions_json["records"]
            .as_array()
            .unwrap()
            .iter()
            .any(|record| {
                record["part"] == "word/header1.xml"
                    && record["kind"] == "del"
                    && record["text"] == "removed"
            })
    );
}

#[test]
fn rsid_strip_removes_only_word_revision_session_attributes() {
    let dir = temp_dir("rsid-strip");
    let input = write_docx_with_parts(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p w:rsidR="00AB12CD"><w:r><w:t>Keep text</w:t></w:r></w:p></w:body></w:document>"#,
        &[("custom/retained.bin", "keep bytes")],
    );
    let output_path = dir.join("clean.docx");
    let output = run(&[
        "docx",
        "helper",
        "rsid-strip",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--json",
    ]);

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(response["rsidAttributesRemoved"], 1);
    assert_eq!(response["partsChanged"][0], "word/document.xml");
    let file = File::open(output_path).unwrap();
    let mut archive = zip::ZipArchive::new(file).unwrap();
    let mut document = String::new();
    archive
        .by_name("word/document.xml")
        .unwrap()
        .read_to_string(&mut document)
        .unwrap();
    assert!(!document.contains("w:rsidR"));
    let mut retained = String::new();
    archive
        .by_name("custom/retained.bin")
        .unwrap()
        .read_to_string(&mut retained)
        .unwrap();
    assert_eq!(retained, "keep bytes");
}

#[test]
fn publishing_controls_remove_protection_without_changing_other_parts() {
    let dir = temp_dir("remove-protection");
    let input = write_docx_with_parts(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Retained</w:t></w:r></w:p></w:body></w:document>"#,
        &[
            (
                "word/settings.xml",
                r#"<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:documentProtection w:edit="readOnly"/></w:settings>"#,
            ),
            ("custom/retained.bin", "keep bytes"),
        ],
    );
    let output_path = dir.join("unprotected.docx");
    let output = run(&[
        "docx",
        "helper",
        "publishing-controls-remove",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--kind",
        "protection",
        "--json",
    ]);

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(response["removed"], 1);
    assert_eq!(response["modifiedParts"][0], "word/settings.xml");
    let file = File::open(output_path).unwrap();
    let mut archive = zip::ZipArchive::new(file).unwrap();
    let mut settings = String::new();
    archive
        .by_name("word/settings.xml")
        .unwrap()
        .read_to_string(&mut settings)
        .unwrap();
    assert!(!settings.contains("documentProtection"));
    let mut retained = String::new();
    archive
        .by_name("custom/retained.bin")
        .unwrap()
        .read_to_string(&mut retained)
        .unwrap();
    assert_eq!(retained, "keep bytes");
}

#[test]
fn text_replace_spans_runs_and_reports_structural_skips() {
    let dir = temp_dir("text-replace");
    let input = write_docx_with_document(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:xml="http://www.w3.org/XML/1998/namespace"><w:body><w:p><w:bookmarkStart w:id="1" w:name="mark"/><w:r><w:t>Hello World</w:t></w:r></w:p><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Hello </w:t></w:r><w:r><w:t>World</w:t></w:r></w:p></w:body></w:document>"#,
    );
    let output_path = dir.join("replaced.docx");
    let output = run(&[
        "docx",
        "helper",
        "text-replace",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--replace",
        "Hello World=Greetings",
        "--json",
    ]);

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(response["replacementsApplied"], 1);
    assert_eq!(response["skippedMatches"].as_array().unwrap().len(), 1);
    let file = File::open(output_path).unwrap();
    let mut archive = zip::ZipArchive::new(file).unwrap();
    let mut document = String::new();
    archive
        .by_name("word/document.xml")
        .unwrap()
        .read_to_string(&mut document)
        .unwrap();
    assert!(document.contains("<w:b/>"));
    assert!(document.contains("<w:t>Greetings</w:t>"));
    assert!(document.contains("Hello World</w:t>"));
}

#[test]
fn tracked_process_accepts_insertions_rejects_deletions_and_disables_tracking() {
    let dir = temp_dir("tracked-process");
    let input = write_docx_with_parts(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:ins w:id="1"><w:r><w:t>New</w:t></w:r></w:ins><w:del w:id="2"><w:r><w:delText>Old</w:delText></w:r></w:del></w:p></w:body></w:document>"#,
        &[(
            "word/settings.xml",
            r#"<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:trackRevisions/></w:settings>"#,
        )],
    );
    let output_path = dir.join("accepted.docx");
    let output = run(&[
        "docx",
        "helper",
        "tracked-process",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--operation",
        "accept",
        "--json",
    ]);

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(response["processedMarkers"], 2);
    assert_eq!(response["trackingDisabled"], true);
    let file = File::open(output_path).unwrap();
    let mut archive = zip::ZipArchive::new(file).unwrap();
    let mut document = String::new();
    archive
        .by_name("word/document.xml")
        .unwrap()
        .read_to_string(&mut document)
        .unwrap();
    assert!(document.contains("<w:t>New</w:t>"));
    assert!(!document.contains("<w:ins"));
    assert!(!document.contains("Old"));
    let mut settings = String::new();
    archive
        .by_name("word/settings.xml")
        .unwrap()
        .read_to_string(&mut settings)
        .unwrap();
    assert!(!settings.contains("trackRevisions"));
}

#[test]
fn tracked_add_replacements_creates_revision_wrappers_and_reports_skips() {
    let dir = temp_dir("tracked-add-replacements");
    let input = write_docx_with_document(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>draft needs review</w:t></w:r></w:p><w:p><w:r><w:t>split </w:t></w:r><w:r><w:t>match</w:t></w:r></w:p></w:body></w:document>"#,
    );
    let output_path = dir.join("tracked.docx");
    let output = run(&[
        "docx",
        "helper",
        "tracked-add-replacements",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--author",
        "Reviewer",
        "--replace",
        "draft=final",
        "--replace",
        "split match=combined",
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["replacements"], 1);
    assert_eq!(report["unmatched"], serde_json::json!(["split match"]));
    assert_eq!(report["trackingEnabled"], true);
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let document = read_zip_part(&mut archive, "word/document.xml");
    let settings = read_zip_part(&mut archive, "word/settings.xml");
    assert!(document.contains("<w:del w:id=\"1\" w:author=\"Reviewer\""));
    assert!(document.contains("<w:ins w:id=\"2\" w:author=\"Reviewer\""));
    assert!(document.contains("<w:delText>draft</w:delText>"));
    assert!(document.contains("<w:t>final</w:t>"));
    assert!(document.contains("<w:t xml:space=\"preserve\"> needs review</w:t>"));
    assert!(document.contains("<w:rPr><w:b/></w:rPr>"));
    assert!(settings.contains("<w:trackRevisions"));
}

#[test]
fn table_geometry_set_updates_selected_top_level_tables_and_rejects_merges() {
    let dir = temp_dir("table-geometry-set");
    let input = write_docx_with_document(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr><w:tc><w:p/></w:tc><w:tc><w:p/></w:tc></w:tr></w:tbl><w:tbl><w:tr><w:tc><w:p/></w:tc><w:tc><w:p/></w:tc></w:tr></w:tbl></w:body></w:document>"#,
    );
    let output_path = dir.join("sized.docx");
    let output = run(&[
        "docx",
        "helper",
        "table-geometry-set",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--column-widths-dxa",
        "1800",
        "4200",
        "--table-index",
        "1",
        "--indent-dxa",
        "240",
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["tableIndices"], serde_json::json!([1]));
    assert_eq!(report["columnWidthsDxa"], serde_json::json!([1800, 4200]));
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let document = read_zip_part(&mut archive, "word/document.xml");
    let mut table_chunks = document.split("<w:tbl>").skip(1);
    let first = table_chunks
        .next()
        .unwrap()
        .split("</w:tbl>")
        .next()
        .unwrap();
    let second = table_chunks
        .next()
        .unwrap()
        .split("</w:tbl>")
        .next()
        .unwrap();
    assert!(!first.contains("w:tblW"));
    assert!(second.contains("<w:tblW w:w=\"6000\" w:type=\"dxa\"/>"));
    assert!(second.contains("<w:tblInd w:w=\"240\" w:type=\"dxa\"/>"));
    assert!(second.contains("<w:tblLayout w:type=\"fixed\"/>"));
    assert!(second.contains("<w:gridCol w:w=\"1800\"/><w:gridCol w:w=\"4200\"/>"));
    assert!(second.contains("<w:tcW w:w=\"1800\" w:type=\"dxa\"/>"));
    assert!(second.contains("<w:start w:w=\"120\" w:type=\"dxa\"/>"));

    let merged_dir = temp_dir("table-geometry-merged");
    let merged_input = write_docx_with_document(
        &merged_dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p/></w:tc></w:tr></w:tbl></w:body></w:document>"#,
    );
    let rejected_path = merged_dir.join("rejected.docx");
    let rejected = run(&[
        "docx",
        "helper",
        "table-geometry-set",
        "--input",
        merged_input.to_str().unwrap(),
        "--output",
        rejected_path.to_str().unwrap(),
        "--column-widths-dxa",
        "6000",
        "--json",
    ]);
    assert!(!rejected.status.success());
    assert!(!rejected_path.exists());
    let error: serde_json::Value = serde_json::from_slice(&rejected.stderr).unwrap();
    assert_eq!(error["error"]["code"], "invalid_arguments");
}

#[test]
fn fields_process_inspects_updates_and_flattens_common_fields() {
    let dir = temp_dir("fields-process");
    let input = write_docx_with_parts(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:bookmarkStart w:id="1" w:name="figureOne"/><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> SEQ Figure </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>0</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r><w:bookmarkEnd w:id="1"/></w:p><w:p><w:fldSimple w:instr=" REF figureOne \h "><w:r><w:t>0</w:t></w:r></w:fldSimple></w:p><w:p><w:fldSimple w:instr=" PAGEREF figureOne \h "><w:r><w:t>4</w:t></w:r></w:fldSimple></w:p></w:body></w:document>"#,
        &[(
            "word/header1.xml",
            r#"<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:fldSimple w:instr=" SEQ Table "><w:r><w:t>0</w:t></w:r></w:fldSimple></w:p></w:hdr>"#,
        )],
    );
    let inspected = run(&[
        "docx",
        "helper",
        "fields-process",
        "--input",
        input.to_str().unwrap(),
        "--operation",
        "inspect",
        "--json",
    ]);
    assert!(
        inspected.status.success(),
        "{}",
        String::from_utf8_lossy(&inspected.stderr)
    );
    let inspected: serde_json::Value = serde_json::from_slice(&inspected.stdout).unwrap();
    assert_eq!(inspected["fields"].as_array().unwrap().len(), 4);
    assert_eq!(inspected["fields"][0]["kind"], "simple");
    assert_eq!(inspected["fields"][0]["instruction"], "REF figureOne \\h");

    let updated_path = dir.join("updated.docx");
    let updated = run(&[
        "docx",
        "helper",
        "fields-process",
        "--input",
        input.to_str().unwrap(),
        "--output",
        updated_path.to_str().unwrap(),
        "--operation",
        "update",
        "--json",
    ]);
    assert!(
        updated.status.success(),
        "{}",
        String::from_utf8_lossy(&updated.stderr)
    );
    let report: serde_json::Value = serde_json::from_slice(&updated.stdout).unwrap();
    assert_eq!(report["counts"]["updatedSeq"], 2);
    assert_eq!(report["counts"]["updatedRef"], 1);
    assert_eq!(report["counts"]["unchangedPageFields"], 1);
    let mut archive = zip::ZipArchive::new(File::open(&updated_path).unwrap()).unwrap();
    let document = read_zip_part(&mut archive, "word/document.xml");
    let header = read_zip_part(&mut archive, "word/header1.xml");
    assert!(document.contains("<w:t>1</w:t>"));
    assert!(header.contains("<w:t>1</w:t>"));

    let flattened_path = dir.join("flattened.docx");
    let flattened = run(&[
        "docx",
        "helper",
        "fields-process",
        "--input",
        updated_path.to_str().unwrap(),
        "--output",
        flattened_path.to_str().unwrap(),
        "--operation",
        "flatten",
        "--json",
    ]);
    assert!(
        flattened.status.success(),
        "{}",
        String::from_utf8_lossy(&flattened.stderr)
    );
    let flattened: serde_json::Value = serde_json::from_slice(&flattened.stdout).unwrap();
    assert_eq!(flattened["counts"]["simpleFieldsFlattened"], 3);
    let mut archive = zip::ZipArchive::new(File::open(flattened_path).unwrap()).unwrap();
    let document = read_zip_part(&mut archive, "word/document.xml");
    assert!(!document.contains("w:fldSimple"));
    assert!(!document.contains("w:fldChar"));
    assert!(!document.contains("w:instrText"));
}

#[test]
fn reference_fields_insert_replaces_simple_markers_and_reports_complex_runs() {
    let dir = temp_dir("reference-fields");
    let input = write_docx_with_parts(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>See [[REF:figureOne]] now: [[REF:table_2]]</w:t></w:r></w:p><w:p><w:r><w:t>[[REF:split</w:t></w:r><w:r><w:t>Marker]]</w:t></w:r><w:r><w:t>[[REF:complexRun]]</w:t><w:tab/></w:r></w:p></w:body></w:document>"#,
        &[(
            "word/header1.xml",
            r#"<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>[[REF:figureOne]]</w:t></w:r></w:p></w:hdr>"#,
        )],
    );
    let output_path = dir.join("refs.docx");
    let output = run(&[
        "docx",
        "helper",
        "reference-fields-insert",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--prefix",
        "Figure ",
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["markersReplaced"], 3);
    assert_eq!(
        report["modifiedParts"],
        serde_json::json!(["word/document.xml", "word/header1.xml"])
    );
    assert_eq!(
        report["skippedMarkers"],
        serde_json::json!(["[[REF:complexRun]]"])
    );
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let document = read_zip_part(&mut archive, "word/document.xml");
    let header = read_zip_part(&mut archive, "word/header1.xml");
    assert!(document.contains("<w:rPr><w:b/></w:rPr><w:t xml:space=\"preserve\">See </w:t>"));
    assert!(
        document.contains("<w:instrText xml:space=\"preserve\"> REF figureOne \\h </w:instrText>")
    );
    assert!(
        document.contains("<w:instrText xml:space=\"preserve\"> REF table_2 \\h </w:instrText>")
    );
    assert!(
        header.contains("<w:instrText xml:space=\"preserve\"> REF figureOne \\h </w:instrText>")
    );

    let invalid_dir = temp_dir("reference-fields-invalid");
    let invalid_input = write_docx_with_document(
        &invalid_dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>[[REF:1bad]]</w:t></w:r></w:p></w:body></w:document>"#,
    );
    let invalid_path = invalid_dir.join("invalid.docx");
    let invalid = run(&[
        "docx",
        "helper",
        "reference-fields-insert",
        "--input",
        invalid_input.to_str().unwrap(),
        "--output",
        invalid_path.to_str().unwrap(),
        "--json",
    ]);
    assert!(!invalid.status.success());
    assert!(!invalid_path.exists());
}

#[test]
fn captions_insert_adds_table_and_figure_seq_fields_and_skips_existing_captions() {
    let dir = temp_dir("captions-insert");
    let input = write_docx_with_document(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:bookmarkStart w:id="4" w:name="tbl1"/><w:tbl><w:tr><w:tc><w:p/></w:tc></w:tr></w:tbl><w:p><w:r><w:drawing/></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Caption"/></w:pPr><w:r><w:t>Table Already captioned</w:t></w:r></w:p><w:bookmarkEnd w:id="4"/></w:body></w:document>"#,
    );
    let output_path = dir.join("captioned.docx");
    let output = run(&[
        "docx",
        "helper",
        "captions-insert",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--tables",
        "--figures",
        "--caption-text",
        "Summary",
        "--bookmarks",
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["counts"]["tables"], 1);
    assert_eq!(report["counts"]["figures"], 1);
    assert_eq!(report["counts"]["bookmarks"], 2);
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let document = read_zip_part(&mut archive, "word/document.xml");
    assert_eq!(document.matches("<w:instrText").count(), 2);
    assert!(document.contains("SEQ Table \\* ARABIC"));
    assert!(document.contains("SEQ Figure \\* ARABIC"));
    assert!(document.contains(": Summary"));
    assert!(document.contains("w:name=\"tbl2\""));
    assert!(document.contains("w:name=\"fig1\""));
    assert!(document.contains("Table Already captioned"));
    assert!(document.contains("w:id=\"5\""));
    assert!(document.contains("w:id=\"6\""));
}

#[test]
fn toc_insert_replaces_one_placeholder_and_adds_settings_metadata() {
    let dir = temp_dir("toc-insert");
    let input = write_docx_with_document(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:keepNext/></w:pPr><w:r><w:t>[[TOC]]</w:t></w:r></w:p></w:body></w:document>"#,
    );
    let output_path = dir.join("toc.docx");
    let output = run(&[
        "docx",
        "helper",
        "toc-insert",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--placeholder",
        "[[TOC]]",
        "--levels",
        "2-4",
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["placeholder"], "[[TOC]]");
    assert_eq!(report["levels"], "2-4");
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let document = read_zip_part(&mut archive, "word/document.xml");
    let settings = read_zip_part(&mut archive, "word/settings.xml");
    let rels = read_zip_part(&mut archive, "word/_rels/document.xml.rels");
    let content_types = read_zip_part(&mut archive, "[Content_Types].xml");
    assert!(document.contains("<w:keepNext/>"));
    assert!(document.contains(" TOC \\o \"2-4\" \\h \\z \\u "));
    assert!(document.contains("(TOC will populate after updating fields)"));
    assert!(settings.contains("<w:updateFields w:val=\"true\"/>"));
    assert!(rels.contains("relationships/settings"));
    assert!(content_types.contains("/word/settings.xml"));

    let invalid_path = dir.join("invalid-toc.docx");
    let invalid = run(&[
        "docx",
        "helper",
        "toc-insert",
        "--input",
        input.to_str().unwrap(),
        "--output",
        invalid_path.to_str().unwrap(),
        "--levels",
        "3-1",
        "--json",
    ]);
    assert!(!invalid.status.success());
    assert!(!invalid_path.exists());
}

#[test]
fn internal_nav_inserts_static_toc_bookmarks_and_back_links() {
    let dir = temp_dir("internal-nav");
    let input = write_docx_with_document(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:bookmarkStart w:id="7" w:name="sec001"/><w:bookmarkStart w:id="8" w:name="Top"/><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Overview</w:t></w:r></w:p><w:p><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:r><w:t>Details</w:t></w:r></w:p><w:p><w:r><w:t>Body</w:t></w:r></w:p><w:bookmarkEnd w:id="8"/><w:bookmarkEnd w:id="7"/></w:body></w:document>"#,
    );
    let output_path = dir.join("navigation.docx");
    let output = run(&[
        "docx",
        "helper",
        "internal-nav",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--levels",
        "1",
        "2",
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["counts"]["headingsBookmarked"], 2);
    assert_eq!(report["counts"]["tocEntries"], 2);
    assert_eq!(report["counts"]["topBottomBookmarks"], 2);
    assert_eq!(report["counts"]["backToTocLinks"], 2);
    assert_eq!(report["bookmarks"]["toc"], "TOC");
    assert_eq!(report["bookmarks"]["top"], "Top_2");
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let document = read_zip_part(&mut archive, "word/document.xml");
    assert!(document.starts_with("<w:document"));
    assert!(document.contains("Table of Contents"));
    assert!(document.contains("w:anchor=\"sec001_2\""));
    assert!(document.contains("w:anchor=\"sec002\""));
    assert!(document.contains("Back to TOC"));
    assert!(document.contains("w:name=\"Top_2\""));
    assert!(document.contains("w:name=\"Bottom\""));
}

#[test]
fn note_insert_creates_footnote_relationship_content_type_and_marker_reference() {
    let dir = temp_dir("note-insert");
    let input = dir.join("input.docx");
    let file = File::create(&input).unwrap();
    let mut source = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default();
    for (name, contents) in [
        (
            "[Content_Types].xml",
            r#"<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>"#,
        ),
        (
            "_rels/.rels",
            r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>"#,
        ),
        (
            "word/document.xml",
            r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Text [[NOTE]] tail</w:t><w:tab/></w:r></w:p></w:body></w:document>"#,
        ),
        (
            "word/_rels/document.xml.rels",
            r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>"#,
        ),
        (
            "word/styles.xml",
            r#"<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>"#,
        ),
    ] {
        source.start_file(name, options).unwrap();
        source.write_all(contents.as_bytes()).unwrap();
    }
    source.finish().unwrap();
    let output_path = dir.join("footnote.docx");
    let output = run(&[
        "docx",
        "helper",
        "note-insert",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--kind",
        "footnote",
        "--marker",
        "[[NOTE]]",
        "--text",
        "Citation detail",
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["kind"], "footnote");
    assert_eq!(report["noteId"], 1);
    assert_eq!(report["markerFound"], true);
    assert_eq!(report["separatorsEnsured"], true);
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let document = read_zip_part(&mut archive, "word/document.xml");
    let notes = read_zip_part(&mut archive, "word/footnotes.xml");
    let rels = read_zip_part(&mut archive, "word/_rels/document.xml.rels");
    let content_types = read_zip_part(&mut archive, "[Content_Types].xml");
    assert!(document.contains("<w:footnoteReference w:id=\"1\"/>"));
    assert!(document.contains("Text "));
    assert!(document.contains(" tail"));
    assert!(document.contains("<w:tab/>"));
    assert!(!document.contains("[[NOTE]]"));
    assert!(notes.contains("w:type=\"separator\""));
    assert!(notes.contains("w:type=\"continuationSeparator\""));
    assert!(notes.contains("Citation detail"));
    assert!(rels.contains("relationships/footnotes"));
    assert!(content_types.contains("/word/footnotes.xml"));
}

#[test]
fn note_insert_appends_endnote_before_section_properties_when_marker_is_absent() {
    let dir = temp_dir("endnote-insert");
    let input = dir.join("input.docx");
    let file = File::create(&input).unwrap();
    let mut source = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default();
    for (name, contents) in [
        (
            "[Content_Types].xml",
            r#"<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/endnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml"/></Types>"#,
        ),
        (
            "_rels/.rels",
            r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>"#,
        ),
        (
            "word/document.xml",
            r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Body</w:t></w:r></w:p><w:sectPr/></w:body></w:document>"#,
        ),
        (
            "word/_rels/document.xml.rels",
            r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes" Target="endnotes.xml"/></Relationships>"#,
        ),
        (
            "word/styles.xml",
            r#"<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>"#,
        ),
        (
            "word/endnotes.xml",
            r#"<w:endnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:endnote w:id="-1" w:type="separator"><w:p><w:r><w:separator/></w:r></w:p></w:endnote><w:endnote w:id="0" w:type="continuationSeparator"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:endnote><w:endnote w:id="4"><w:p><w:r><w:endnoteRef/></w:r><w:r><w:t>Existing</w:t></w:r></w:p></w:endnote></w:endnotes>"#,
        ),
    ] {
        source.start_file(name, options).unwrap();
        source.write_all(contents.as_bytes()).unwrap();
    }
    source.finish().unwrap();
    let output_path = dir.join("endnote.docx");
    let output = run(&[
        "docx",
        "helper",
        "note-insert",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--kind",
        "endnote",
        "--text",
        "Appended note",
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["noteId"], 5);
    assert_eq!(report["markerFound"], false);
    assert_eq!(report["separatorsEnsured"], false);
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let document = read_zip_part(&mut archive, "word/document.xml");
    assert!(document.contains("<w:endnoteReference w:id=\"5\"/>"));
    assert!(document.find("<w:endnoteReference").unwrap() < document.find("<w:sectPr").unwrap());
    let notes = read_zip_part(&mut archive, "word/endnotes.xml");
    assert!(notes.contains("w:id=\"5\""));
    assert!(notes.contains("Appended note"));
}

#[test]
fn template_styles_apply_replaces_matching_styles_and_document_defaults() {
    let dir = temp_dir("template-styles-apply");
    let write_package = |path: &std::path::Path, styles: &str| {
        let file = File::create(path).unwrap();
        let mut archive = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default();
        for (name, contents) in [
            (
                "[Content_Types].xml",
                r#"<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>"#,
            ),
            (
                "_rels/.rels",
                r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>"#,
            ),
            (
                "word/document.xml",
                r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/></w:body></w:document>"#,
            ),
            (
                "word/_rels/document.xml.rels",
                r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>"#,
            ),
            ("word/styles.xml", styles),
        ] {
            archive.start_file(name, options).unwrap();
            archive.write_all(contents.as_bytes()).unwrap();
        }
        archive.finish().unwrap();
    };
    let template_path = dir.join("reference.dotx");
    let input_path = dir.join("draft.docx");
    write_package(
        &template_path,
        r#"<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:b/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/></w:style></w:styles>"#,
    );
    write_package(
        &input_path,
        r#"<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:i/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="KeepMe"><w:name w:val="Keep Me"/></w:style></w:styles>"#,
    );
    let output_path = dir.join("styled.docx");
    let output = run(&[
        "docx",
        "helper",
        "template-styles-apply",
        "--template",
        template_path.to_str().unwrap(),
        "--input",
        input_path.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(
        report["stylesCopied"],
        serde_json::json!(["Normal", "Heading1"])
    );
    assert_eq!(report["themePartsCopied"], serde_json::json!([]));
    assert_eq!(report["numberingPartCopied"], false);
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let styles = read_zip_part(&mut archive, "word/styles.xml");
    assert!(styles.contains("w:ascii=\"Aptos\""));
    assert!(styles.contains("w:styleId=\"Normal\""));
    assert!(styles.contains("w:styleId=\"Heading1\""));
    assert!(styles.contains("w:styleId=\"KeepMe\""));
    assert!(!styles.contains("w:ascii=\"Calibri\""));
}

#[test]
fn template_styles_apply_remaps_numbering_and_registers_theme_assets() {
    let dir = temp_dir("template-styles-assets");
    let write_package = |path: &std::path::Path, styles: &str, extras: &[(&str, &str)]| {
        let file = File::create(path).unwrap();
        let mut archive = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default();
        for (name, contents) in [
            (
                "[Content_Types].xml",
                r#"<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>"#,
            ),
            (
                "_rels/.rels",
                r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>"#,
            ),
            (
                "word/document.xml",
                r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/></w:body></w:document>"#,
            ),
            (
                "word/_rels/document.xml.rels",
                r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>"#,
            ),
            ("word/styles.xml", styles),
        ] {
            archive.start_file(name, options).unwrap();
            archive.write_all(contents.as_bytes()).unwrap();
        }
        for (name, contents) in extras {
            archive.start_file(*name, options).unwrap();
            archive.write_all(contents.as_bytes()).unwrap();
        }
        archive.finish().unwrap();
    };
    let template_path = dir.join("reference.dotx");
    let input_path = dir.join("draft.docx");
    write_package(
        &template_path,
        r#"<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="BulletList"><w:pPr><w:numPr><w:numId w:val="7"/></w:numPr></w:pPr></w:style></w:styles>"#,
        &[
            (
                "word/numbering.xml",
                r#"<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"/><w:num w:numId="7"><w:abstractNumId w:val="0"/></w:num></w:numbering>"#,
            ),
            (
                "word/theme/theme1.xml",
                r#"<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>"#,
            ),
            (
                "word/fontTable.xml",
                r#"<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>"#,
            ),
        ],
    );
    write_package(
        &input_path,
        r#"<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Normal"/></w:styles>"#,
        &[(
            "word/numbering.xml",
            r#"<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"/><w:num w:numId="3"><w:abstractNumId w:val="0"/></w:num></w:numbering>"#,
        )],
    );
    let output_path = dir.join("styled.docx");
    let output = run(&[
        "docx",
        "helper",
        "template-styles-apply",
        "--template",
        template_path.to_str().unwrap(),
        "--input",
        input_path.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["themePartsCopied"].as_array().unwrap().len(), 2);
    assert_eq!(report["numberingPartCopied"], true);
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let styles = read_zip_part(&mut archive, "word/styles.xml");
    let numbering = read_zip_part(&mut archive, "word/numbering.xml");
    let rels = read_zip_part(&mut archive, "word/_rels/document.xml.rels");
    let content_types = read_zip_part(&mut archive, "[Content_Types].xml");
    assert!(styles.contains("w:styleId=\"BulletList\""));
    assert!(styles.contains("w:numId w:val=\"4\""));
    assert!(numbering.contains("w:abstractNumId=\"1\""));
    assert!(numbering.contains("w:numId=\"4\""));
    assert!(numbering.contains("w:abstractNumId w:val=\"1\""));
    assert!(rels.contains("relationships/numbering"));
    assert!(rels.contains("relationships/theme"));
    assert!(rels.contains("relationships/fontTable"));
    assert!(content_types.contains("/word/numbering.xml"));
    assert!(content_types.contains("/word/theme/theme1.xml"));
    assert!(content_types.contains("/word/fontTable.xml"));
}

#[test]
fn content_edit_formats_a_unique_body_paragraph_with_json_operations() {
    let dir = temp_dir("content-edit");
    let input = write_docx_with_parts(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Executive summary</w:t></w:r></w:p><w:sectPr/></w:body></w:document>"#,
        &[("custom/opaque.bin", "preserve")],
    );
    let operations_path = dir.join("operations.json");
    fs::write(
        &operations_path,
        r#"[{"op":"format_paragraph","contains":"Executive summary","style":"Heading 1","alignment":"center","spacingAfter":160,"keepWithNext":true}]"#,
    )
    .unwrap();
    let output_path = dir.join("formatted.docx");
    let output = run(&[
        "docx",
        "helper",
        "content-edit",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--operations-file",
        operations_path.to_str().unwrap(),
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["operationsApplied"], 1);
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let document = read_zip_part(&mut archive, "word/document.xml");
    assert!(document.contains("w:pStyle w:val=\"Heading1\""));
    assert!(document.contains("w:jc w:val=\"center\""));
    assert!(document.contains("w:after=\"160\""));
    assert!(document.contains("w:keepNext w:val=\"1\""));
}

#[test]
fn content_edit_formats_a_unique_simple_run_without_changing_other_parts() {
    let dir = temp_dir("content-edit-run");
    let input = write_docx_with_parts(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Important decision</w:t></w:r></w:p></w:body></w:document>"#,
        &[("custom/opaque.bin", "preserve")],
    );
    let operations_path = dir.join("operations.json");
    fs::write(
        &operations_path,
        r##"[{"op":"format_run","contains":"decision","fontFace":"Arial","fontSizePt":12,"color":"#1a2b3c","italic":true}]"##,
    )
    .unwrap();
    let output_path = dir.join("formatted.docx");
    let output = run(&[
        "docx",
        "helper",
        "content-edit",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--operations-file",
        operations_path.to_str().unwrap(),
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let document = read_zip_part(&mut archive, "word/document.xml");
    assert!(document.contains("Important "));
    assert!(document.contains("decision"));
    assert!(document.contains("w:rFonts w:ascii=\"Arial\""));
    assert!(document.contains("w:sz w:val=\"24\""));
    assert!(document.contains("w:color w:val=\"1A2B3C\""));
    assert!(document.contains("w:i w:val=\"1\""));
}

#[test]
fn content_edit_sets_section_page_size_orientation_and_margins() {
    let dir = temp_dir("content-edit-section");
    let input = write_docx_with_document(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/><w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:bottom="1440" w:left="1440" w:right="1440"/></w:sectPr></w:body></w:document>"#,
    );
    let operations_path = dir.join("operations.json");
    fs::write(
        &operations_path,
        r#"[{"op":"set_section_layout","sectionIndex":0,"orientation":"landscape","pageWidthDxa":15840,"pageHeightDxa":12240,"marginsDxa":{"top":720,"left":900}}]"#,
    )
    .unwrap();
    let output_path = dir.join("layout.docx");
    let output = run(&[
        "docx", "helper", "content-edit", "--input", input.to_str().unwrap(),
        "--output", output_path.to_str().unwrap(), "--operations-file", operations_path.to_str().unwrap(), "--json",
    ]);
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let document = read_zip_part(&mut archive, "word/document.xml");
    assert!(document.contains("w:orient=\"landscape\""));
    assert!(document.contains("w:w=\"15840\""));
    assert!(document.contains("w:h=\"12240\""));
    assert!(document.contains("w:top=\"720\""));
    assert!(document.contains("w:left=\"900\""));
}

#[test]
fn content_edit_inserts_a_styled_paragraph_after_unique_target_before_section_properties() {
    let dir = temp_dir("content-edit-insert-paragraph");
    let input = write_docx_with_document(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Summary</w:t></w:r></w:p><w:sectPr/></w:body></w:document>"#,
    );
    let operations_path = dir.join("operations.json");
    fs::write(
        &operations_path,
        r#"[{"op":"insert_paragraph_after","contains":"Summary","text":"Next steps","style":"Heading 2"}]"#,
    )
    .unwrap();
    let output_path = dir.join("inserted.docx");
    let output = run(&[
        "docx", "helper", "content-edit", "--input", input.to_str().unwrap(),
        "--output", output_path.to_str().unwrap(), "--operations-file", operations_path.to_str().unwrap(), "--json",
    ]);
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let document = read_zip_part(&mut archive, "word/document.xml");
    let target = document.find("Summary").unwrap();
    let inserted = document.find("Next steps").unwrap();
    let section = document.find("<w:sectPr").unwrap();
    assert!(target < inserted && inserted < section);
    assert!(document.contains("w:pStyle w:val=\"Heading2\""));
}

#[test]
fn content_edit_replaces_plain_table_cell_text_and_sets_alignment() {
    let dir = temp_dir("content-edit-cell");
    let input = write_docx_with_document(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr><w:tc><w:tcPr/><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Old value</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>"#,
    );
    let operations_path = dir.join("operations.json");
    fs::write(
        &operations_path,
        r#"[{"op":"replace_table_cell_text","tableIndex":0,"row":0,"column":0,"text":"New value","alignment":"center"}]"#,
    )
    .unwrap();
    let output_path = dir.join("cell.docx");
    let output = run(&[
        "docx", "helper", "content-edit", "--input", input.to_str().unwrap(),
        "--output", output_path.to_str().unwrap(), "--operations-file", operations_path.to_str().unwrap(), "--json",
    ]);
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let document = read_zip_part(&mut archive, "word/document.xml");
    assert!(document.contains("New value"));
    assert!(!document.contains("Old value"));
    assert!(document.contains("w:b"));
    assert!(document.contains("w:jc w:val=\"center\""));
}

#[test]
fn content_edit_inserts_rectangular_table_after_unique_paragraph() {
    let dir = temp_dir("content-edit-insert-table");
    let input = write_docx_with_document(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Results</w:t></w:r></w:p><w:sectPr/></w:body></w:document>"#,
    );
    let operations_path = dir.join("operations.json");
    fs::write(
        &operations_path,
        r#"[{"op":"insert_table_after","contains":"Results","rows":[["Item","Status"],["Docs","Ready"]],"headerRow":true,"columnWidthsDxa":[2500,3500],"style":"TableGrid"}]"#,
    )
    .unwrap();
    let output_path = dir.join("table.docx");
    let output = run(&[
        "docx", "helper", "content-edit", "--input", input.to_str().unwrap(),
        "--output", output_path.to_str().unwrap(), "--operations-file", operations_path.to_str().unwrap(), "--json",
    ]);
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let document = read_zip_part(&mut archive, "word/document.xml");
    let target = document.find("Results").unwrap();
    let table = document.find("<w:tbl").unwrap();
    let section = document.find("<w:sectPr").unwrap();
    assert!(target < table && table < section);
    assert!(document.contains("w:tblStyle w:val=\"TableGrid\""));
    assert!(document.contains("w:w=\"6000\""));
    assert!(document.contains("w:tblHeader w:val=\"1\""));
    assert!(document.contains("Docs"));
}

#[test]
fn content_edit_appends_table_row_using_last_row_format_without_header_flag() {
    let dir = temp_dir("content-edit-append-row");
    let input = write_docx_with_document(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tblGrid><w:gridCol w:w="3000"/></w:tblGrid><w:tr><w:trPr><w:tblHeader/></w:trPr><w:tc><w:tcPr/><w:p><w:r><w:t>Heading</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:tcPr/><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Old</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>"#,
    );
    let operations_path = dir.join("operations.json");
    fs::write(&operations_path, r#"[{"op":"append_table_row","tableIndex":0,"values":["Added"]}]"#).unwrap();
    let output_path = dir.join("rows.docx");
    let output = run(&[
        "docx", "helper", "content-edit", "--input", input.to_str().unwrap(),
        "--output", output_path.to_str().unwrap(), "--operations-file", operations_path.to_str().unwrap(), "--json",
    ]);
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let document = read_zip_part(&mut archive, "word/document.xml");
    assert_eq!(document.matches("<w:tr>").count(), 3);
    assert_eq!(document.matches("<w:tblHeader").count(), 1);
    assert!(document.contains("Heading"));
    assert!(document.contains("Added"));
    assert!(document.contains("w:b"));
}

#[test]
fn content_edit_replaces_table_rows_with_template_formatting_and_preserves_header() {
    let dir = temp_dir("content-edit-replace-rows");
    let input = write_docx_with_document(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tblGrid><w:gridCol w:w="3000"/></w:tblGrid><w:tr><w:trPr><w:tblHeader/></w:trPr><w:tc><w:tcPr/><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Old header</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:tcPr/><w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Old body</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>"#,
    );
    let operations_path = dir.join("operations.json");
    fs::write(
        &operations_path,
        r#"[{"op":"replace_table_rows","tableIndex":0,"rows":[["Column"],["First"],["Second"]]}]"#,
    )
    .unwrap();
    let output_path = dir.join("rows.docx");
    let output = run(&[
        "docx", "helper", "content-edit", "--input", input.to_str().unwrap(),
        "--output", output_path.to_str().unwrap(), "--operations-file", operations_path.to_str().unwrap(), "--json",
    ]);
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let document = read_zip_part(&mut archive, "word/document.xml");
    assert_eq!(document.matches("<w:tr>").count(), 3);
    assert_eq!(document.matches("<w:tblHeader").count(), 1);
    assert!(!document.contains("Old header"));
    assert!(!document.contains("Old body"));
    assert!(document.contains("Second"));
    assert!(document.contains("w:b"));
}

#[test]
fn docx_render_requires_the_managed_runtime_without_host_fallback() {
    let dir = temp_dir("docx-render-runtime");
    let input = write_docx(&dir);
    let output_dir = dir.join("pages");
    let output = Command::new(binary())
        .args([
            "docx", "helper", "render", "--input", input.to_str().unwrap(),
            "--output-dir", output_dir.to_str().unwrap(), "--dpi", "120",
        ])
        .env("RUXEX_RUNTIME_ROOT", "")
        .env("RUXEX_RUNTIME_BIN_DIR", "")
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("managed renderer runtime"));
    assert!(!output_dir.exists());
}

#[test]
fn docx_compare_requires_the_managed_runtime_without_host_fallback() {
    let dir = temp_dir("docx-compare-runtime");
    let before = write_docx(&dir);
    let after = dir.join("after.docx");
    fs::copy(&before, &after).unwrap();
    let output_dir = dir.join("comparison");
    let output = Command::new(binary())
        .args([
            "docx", "helper", "compare", "--before", before.to_str().unwrap(),
            "--after", after.to_str().unwrap(), "--output-dir", output_dir.to_str().unwrap(),
        ])
        .env("RUXEX_RUNTIME_ROOT", "")
        .env("RUXEX_RUNTIME_BIN_DIR", "")
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("managed renderer runtime"));
    assert!(!output_dir.exists());
}

#[test]
fn distill_template_reports_page_defaults_styles_and_numbering_inventory() {
    let dir = temp_dir("distill-template");
    let input = write_docx_with_parts(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/><w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>"#,
        &[
            (
                "word/theme/theme1.xml",
                r#"<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:clrScheme><a:accent1><a:srgbClr val="4472C4"/></a:accent1></a:clrScheme><a:fontScheme><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>"#,
            ),
            (
                "word/numbering.xml",
                r#"<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"/><w:num w:numId="1"/></w:numbering>"#,
            ),
        ],
    );
    let output_path = dir.join("template.md");
    let output = run(&[
        "docx",
        "helper",
        "distill-template",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--json",
    ]);

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let markdown = fs::read_to_string(output_path).unwrap();
    assert!(markdown.contains("Page size: 12240 × 15840 twips"));
    assert!(markdown.contains("Default run: font `Aptos`, size `22` half-points"));
    assert!(markdown.contains("Color `accent1`: `4472C4`"));
    assert!(markdown.contains("Font `majorFont`: `Aptos Display`"));
    assert!(markdown.contains("| paragraph | Normal | Normal |"));
    assert!(markdown.contains("Abstract numbering definitions: 1."));
    assert!(markdown.contains("Numbering instances: 1."));
}

#[test]
fn protection_set_creates_settings_relationship_and_content_type_override() {
    let dir = temp_dir("protection-set");
    let input = write_docx(&dir);
    let output_path = dir.join("protected.docx");
    let output = run(&[
        "docx",
        "helper",
        "protection-set",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--mode",
        "forms",
        "--json",
    ]);

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(response["mode"], "forms");
    assert_eq!(response["passwordProtected"], false);
    assert_eq!(response["settingsPartCreated"], true);
    assert_eq!(response["settingsRelationshipAdded"], true);
    let file = File::open(output_path).unwrap();
    let mut archive = zip::ZipArchive::new(file).unwrap();
    let mut settings = String::new();
    archive
        .by_name("word/settings.xml")
        .unwrap()
        .read_to_string(&mut settings)
        .unwrap();
    assert!(settings.contains("w:edit=\"forms\""));
    assert!(settings.contains("w:enforcement=\"1\""));
    let mut rels = String::new();
    archive
        .by_name("word/_rels/document.xml.rels")
        .unwrap()
        .read_to_string(&mut rels)
        .unwrap();
    assert!(rels.contains("relationships/settings"));
    assert!(rels.contains("Target=\"settings.xml\""));
    let mut content_types = String::new();
    archive
        .by_name("[Content_Types].xml")
        .unwrap()
        .read_to_string(&mut content_types)
        .unwrap();
    assert!(content_types.contains("/word/settings.xml"));
}

#[test]
fn style_normalize_clears_selected_run_and_paragraph_overrides() {
    let dir = temp_dir("style-normalize");
    let input = write_docx_with_document(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FF0000"/></w:rPr><w:t>Text</w:t></w:r></w:p></w:body></w:document>"#,
    );
    let output_path = dir.join("normalized.docx");
    let output = run(&[
        "docx",
        "helper",
        "style-normalize",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--clear-paragraph-formatting",
        "--json",
    ]);

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(response["counts"]["runFormattingProperties"], 2);
    assert_eq!(response["counts"]["paragraphFormattingProperties"], 2);
    assert_eq!(response["modifiedParts"][0], "word/document.xml");
    let file = File::open(output_path).unwrap();
    let mut archive = zip::ZipArchive::new(file).unwrap();
    let mut document = String::new();
    archive
        .by_name("word/document.xml")
        .unwrap()
        .read_to_string(&mut document)
        .unwrap();
    assert!(!document.contains("<w:b/>") && !document.contains("<w:b "));
    assert!(!document.contains("w:color"));
    assert!(!document.contains("w:spacing"));
    assert!(!document.contains("w:jc"));
    assert!(!document.contains("<w:rPr></w:rPr>"));
}

#[test]
fn unknown_docx_helper_is_a_structured_invalid_argument() {
    let output = run(&["docx", "helper", "not-registered", "--json"]);

    assert!(!output.status.success());
    let response: serde_json::Value = serde_json::from_slice(&output.stderr).unwrap();
    assert_eq!(response["ok"], false);
    assert_eq!(response["error"]["code"], "invalid_arguments");
}

#[test]
fn watermark_add_targets_one_referenced_header_and_preserves_other_parts() {
    let dir = temp_dir("watermark-add");
    let input = write_docx_with_headers(&dir, &["header1.xml", "header2.xml"]);
    let output_path = dir.join("watermarked.docx");
    let output = run(&[
        "docx",
        "helper",
        "watermark-add",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--text",
        "DRAFT & <private>",
        "--header-part",
        "word/header2.xml",
        "--json",
    ]);

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(response["modifiedParts"][0], "word/header2.xml");
    let original = File::open(input).unwrap();
    let mut before = zip::ZipArchive::new(original).unwrap();
    let result = File::open(output_path).unwrap();
    let mut after = zip::ZipArchive::new(result).unwrap();
    assert_eq!(after.comment(), b"Preserve archive comment");
    assert_eq!(before.len(), after.len());
    let mut header = String::new();
    after
        .by_name("word/header2.xml")
        .unwrap()
        .read_to_string(&mut header)
        .unwrap();
    assert!(header.contains("RuxexWatermark1"));
    assert!(header.contains("DRAFT &amp; &lt;private&gt;"));
    assert!(header.contains("<!--keep-->"));
    assert!(header.contains("mc:Ignorable=\"w14\""));
    let mut untouched_before = Vec::new();
    before
        .by_name("word/header1.xml")
        .unwrap()
        .read_to_end(&mut untouched_before)
        .unwrap();
    let mut untouched_after = Vec::new();
    after
        .by_name("word/header1.xml")
        .unwrap()
        .read_to_end(&mut untouched_after)
        .unwrap();
    assert_eq!(untouched_before, untouched_after);
    let mut opaque = Vec::new();
    after
        .by_name("custom/opaque.bin")
        .unwrap()
        .read_to_end(&mut opaque)
        .unwrap();
    assert_eq!(opaque, b"\0opaque\xff");
}

#[test]
fn watermark_add_rejects_ambiguous_headers_and_invalid_text_without_output() {
    let dir = temp_dir("watermark-validation");
    let input = write_docx_with_headers(&dir, &["header1.xml", "header2.xml"]);
    let output_path = dir.join("watermarked.docx");
    let ambiguous = run(&[
        "docx",
        "helper",
        "watermark-add",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--text",
        "DRAFT",
        "--json",
    ]);
    assert!(!ambiguous.status.success());
    assert!(!output_path.exists());

    let invalid = run(&[
        "docx",
        "helper",
        "watermark-add",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--text",
        "\u{1}",
        "--header-part",
        "word/header1.xml",
        "--json",
    ]);
    assert!(!invalid.status.success());
    let response: serde_json::Value = serde_json::from_slice(&invalid.stderr).unwrap();
    assert_eq!(response["error"]["code"], "invalid_arguments");
    assert!(!output_path.exists());
}

#[test]
fn merge_text_appends_simple_paragraphs_before_base_section_properties() {
    let dir = temp_dir("merge-text");
    let base_dir = dir.join("base");
    let append_dir = dir.join("append");
    fs::create_dir_all(&base_dir).unwrap();
    fs::create_dir_all(&append_dir).unwrap();
    let base = write_docx_with_parts(
        &base_dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Base paragraph</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body></w:document>"#,
        &[("custom/retained.bin", "opaque base part")],
    );
    let append = write_docx_with_document(
        &append_dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Appended heading</w:t></w:r></w:p><w:p><w:r><w:t>Appended body</w:t></w:r></w:p></w:body></w:document>"#,
    );
    let output_path = dir.join("merged.docx");
    let output = run(&[
        "docx",
        "helper",
        "merge-text",
        "--base",
        base.to_str().unwrap(),
        "--append",
        append.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(response["appendedParagraphs"], 2);
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let mut document = String::new();
    archive
        .by_name("word/document.xml")
        .unwrap()
        .read_to_string(&mut document)
        .unwrap();
    assert!(document.find("Appended body").unwrap() < document.find("<w:sectPr").unwrap());
    assert_eq!(document.matches("<w:p>").count(), 3);
    let mut retained = String::new();
    archive
        .by_name("custom/retained.bin")
        .unwrap()
        .read_to_string(&mut retained)
        .unwrap();
    assert_eq!(retained, "opaque base part");
}

#[test]
fn merge_text_rejects_unsupported_source_content_without_output() {
    let dir = temp_dir("merge-text-refusal");
    let base_dir = dir.join("base");
    let append_dir = dir.join("append");
    fs::create_dir_all(&base_dir).unwrap();
    fs::create_dir_all(&append_dir).unwrap();
    let base = write_docx_with_document(
        &base_dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Base</w:t></w:r></w:p></w:body></w:document>"#,
    );
    let append = write_docx_with_document(
        &append_dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr><w:tc><w:p><w:r><w:t>table content</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>"#,
    );
    let output_path = dir.join("merged.docx");
    let output = run(&[
        "docx",
        "helper",
        "merge-text",
        "--base",
        base.to_str().unwrap(),
        "--append",
        append.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--json",
    ]);
    assert!(!output.status.success());
    let response: serde_json::Value = serde_json::from_slice(&output.stderr).unwrap();
    assert_eq!(response["error"]["code"], "invalid_arguments");
    assert!(!output_path.exists());
}

#[test]
fn redact_text_matches_across_runs_and_preserves_text_node_lengths() {
    let dir = temp_dir("redact-text");
    let input = write_docx_with_document(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Contact Alice at alice@exa</w:t></w:r><w:r><w:t>mple.test today</w:t></w:r></w:p></w:body></w:document>"#,
    );
    let output_path = dir.join("redacted.docx");
    let output = run(&[
        "docx",
        "helper",
        "redact-text",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--pattern",
        "alice@example\\.test",
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(response["matches"], 1);
    assert_eq!(response["paragraphsTouched"], 1);
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let mut document = String::new();
    archive
        .by_name("word/document.xml")
        .unwrap()
        .read_to_string(&mut document)
        .unwrap();
    assert!(!document.contains("alice@example.test"));
    assert_eq!(
        document.matches('█').count(),
        "alice@example.test".chars().count()
    );
    assert_eq!(document.matches("<w:t").count(), 2);
}

#[test]
fn redact_text_rejects_no_matches_without_creating_output() {
    let dir = temp_dir("redact-text-no-match");
    let input = write_docx_with_document(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>No secrets here</w:t></w:r></w:p></w:body></w:document>"#,
    );
    let output_path = dir.join("redacted.docx");
    let output = run(&[
        "docx",
        "helper",
        "redact-text",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--emails",
        "--json",
    ]);
    assert!(!output.status.success());
    let response: serde_json::Value = serde_json::from_slice(&output.stderr).unwrap();
    assert_eq!(response["error"]["code"], "invalid_arguments");
    assert!(!output_path.exists());
}

#[test]
fn merge_append_inserts_body_ooxml_at_marker_and_keeps_section_properties_last() {
    let dir = temp_dir("merge-append");
    let base_dir = dir.join("base");
    let append_dir = dir.join("append");
    fs::create_dir_all(&base_dir).unwrap();
    fs::create_dir_all(&append_dir).unwrap();
    let base = write_docx_with_document(
        &base_dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Before</w:t></w:r></w:p><w:p><w:r><w:t>insert here</w:t></w:r></w:p><w:p><w:r><w:t>After</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body></w:document>"#,
    );
    let append = write_docx_with_document(
        &append_dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Appended text</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Appended table</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr/></w:body></w:document>"#,
    );
    let output_path = dir.join("merged.docx");
    let output = run(&[
        "docx",
        "helper",
        "merge-append",
        "--base",
        base.to_str().unwrap(),
        "--append",
        append.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--after-marker",
        "insert here",
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(response["bodyChildrenAppended"], 2);
    assert_eq!(response["afterMarker"], "insert here");
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let mut document = String::new();
    archive
        .by_name("word/document.xml")
        .unwrap()
        .read_to_string(&mut document)
        .unwrap();
    assert!(document.find("insert here").unwrap() < document.find("Appended text").unwrap());
    assert!(document.find("Appended table").unwrap() < document.find("After").unwrap());
    assert!(document.rfind("<w:sectPr").unwrap() > document.find("After").unwrap());
}

#[test]
fn merge_append_rejects_relationship_backed_content_before_writing() {
    let dir = temp_dir("merge-append-relationship");
    let base_dir = dir.join("base");
    let append_dir = dir.join("append");
    fs::create_dir_all(&base_dir).unwrap();
    fs::create_dir_all(&append_dir).unwrap();
    let base = write_docx_with_document(
        &base_dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Base</w:t></w:r></w:p></w:body></w:document>"#,
    );
    let append = write_docx_with_document(
        &append_dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:rel="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:hyperlink rel:id="rId3"><w:r><w:t>linked</w:t></w:r></w:hyperlink></w:p></w:body></w:document>"#,
    );
    let output_path = dir.join("merged.docx");
    let output = run(&[
        "docx",
        "helper",
        "merge-append",
        "--base",
        base.to_str().unwrap(),
        "--append",
        append.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--json",
    ]);
    assert!(!output.status.success());
    let response: serde_json::Value = serde_json::from_slice(&output.stderr).unwrap();
    assert_eq!(response["error"]["code"], "invalid_arguments");
    assert!(!output_path.exists());
}

#[test]
fn template_fidelity_snapshots_and_allows_only_declared_editable_part_changes() {
    let dir = temp_dir("template-fidelity");
    let reference_dir = dir.join("reference");
    let changed_dir = dir.join("changed");
    fs::create_dir_all(&reference_dir).unwrap();
    fs::create_dir_all(&changed_dir).unwrap();
    let reference = write_docx_with_document(
        &reference_dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Reference</w:t></w:r></w:p></w:body></w:document>"#,
    );
    let changed = write_docx_with_document(
        &changed_dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Edited content</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>New table</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>"#,
    );
    let manifest = dir.join("template.json");
    let snapshot = run(&[
        "docx",
        "helper",
        "template-fidelity",
        "snapshot",
        "--reference",
        reference.to_str().unwrap(),
        "--manifest",
        manifest.to_str().unwrap(),
        "--json",
    ]);
    assert!(
        snapshot.status.success(),
        "{}",
        String::from_utf8_lossy(&snapshot.stderr)
    );
    let snapshot_json: serde_json::Value = serde_json::from_slice(&snapshot.stdout).unwrap();
    assert_eq!(snapshot_json["schemaVersion"], 1);
    assert!(snapshot_json["parts"]["word/document.xml"]["features"]["sectPr"].is_null());

    let strict = run(&[
        "docx",
        "helper",
        "template-fidelity",
        "verify",
        "--reference",
        reference.to_str().unwrap(),
        "--input",
        changed.to_str().unwrap(),
        "--manifest",
        manifest.to_str().unwrap(),
        "--json",
    ]);
    assert_eq!(strict.status.code(), Some(1));
    let strict_json: serde_json::Value = serde_json::from_slice(&strict.stdout).unwrap();
    assert_eq!(strict_json["ok"], false);
    assert_eq!(
        strict_json["changedPreserveOnlyParts"][0],
        "word/document.xml"
    );

    let editable = run(&[
        "docx",
        "helper",
        "template-fidelity",
        "verify",
        "--reference",
        reference.to_str().unwrap(),
        "--input",
        changed.to_str().unwrap(),
        "--manifest",
        manifest.to_str().unwrap(),
        "--editable-part",
        "word/document.xml",
        "--json",
    ]);
    assert!(
        editable.status.success(),
        "{}",
        String::from_utf8_lossy(&editable.stderr)
    );
    let editable_json: serde_json::Value = serde_json::from_slice(&editable.stdout).unwrap();
    assert_eq!(editable_json["ok"], true);
    assert_eq!(
        editable_json["changedEditableParts"][0],
        "word/document.xml"
    );
    assert_eq!(
        editable_json["featureChanges"]["word/document.xml"]["after"]["tbl"],
        1
    );
}

#[test]
fn template_fidelity_refuses_overwriting_the_manifest() {
    let dir = temp_dir("template-fidelity-collision");
    let reference = write_docx_with_document(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/></w:body></w:document>"#,
    );
    let manifest = dir.join("template.json");
    fs::write(&manifest, "keep existing").unwrap();
    let output = run(&[
        "docx",
        "helper",
        "template-fidelity",
        "snapshot",
        "--reference",
        reference.to_str().unwrap(),
        "--manifest",
        manifest.to_str().unwrap(),
        "--json",
    ]);
    assert!(!output.status.success());
    let response: serde_json::Value = serde_json::from_slice(&output.stderr).unwrap();
    assert_eq!(response["error"]["code"], "output_exists");
    assert_eq!(fs::read_to_string(manifest).unwrap(), "keep existing");
}

#[test]
fn a11y_fixes_adds_image_alt_fallbacks_and_repeating_table_headers() {
    let dir = temp_dir("a11y-fixes");
    let input = write_docx_with_document_rels(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:r><w:drawing><wp:inline><wp:docPr id="1" name="Picture 1"/><a:graphic><a:graphicData><a:blip r:embed="rId1"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Header</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>Value</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>"#,
        r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/draft.png"/></Relationships>"#,
    );
    let output_path = dir.join("accessible.docx");
    let output = run(&[
        "docx",
        "helper",
        "a11y-fixes",
        input.to_str().unwrap(),
        "--fix_image_alt",
        "from_filename",
        "--fix_table_headers",
        "first_row",
        "--out",
        output_path.to_str().unwrap(),
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(response["image_alt_filled"], 1);
    assert_eq!(response["table_headers_set"], 1);
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let mut document = String::new();
    archive
        .by_name("word/document.xml")
        .unwrap()
        .read_to_string(&mut document)
        .unwrap();
    assert!(document.contains("descr=\"Image: draft.png\""));
    assert!(document.contains("<w:tblHeader/>"));
}

#[test]
fn comments_extract_writes_comment_text_and_body_header_anchors_as_json() {
    let dir = temp_dir("comments-extract");
    let input = write_docx_with_parts(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:commentRangeStart w:id="10"/><w:r><w:t>Review this</w:t><w:tab/><w:t>paragraph</w:t></w:r><w:commentRangeEnd w:id="10"/></w:p></w:body></w:document>"#,
        &[
            (
                "word/comments.xml",
                r#"<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="10" w:author="Reviewer" w:initials="RV" w:date="2026-11-20T00:00:00Z" w:done="1"><w:p><w:r><w:t>First note</w:t></w:r></w:p><w:p><w:r><w:t>Second note</w:t></w:r></w:p></w:comment></w:comments>"#,
            ),
            (
                "word/header1.xml",
                r#"<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:commentRangeEnd w:id="10"/><w:r><w:t>Header anchor</w:t></w:r></w:p></w:hdr>"#,
            ),
        ],
    );
    let output_path = dir.join("comments.json");
    let output = run(&[
        "docx",
        "helper",
        "comments-extract",
        "--input",
        input.to_str().unwrap(),
        "--output-json",
        output_path.to_str().unwrap(),
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(response["comment_count"], 1);
    let report: serde_json::Value =
        serde_json::from_slice(&fs::read(output_path).unwrap()).unwrap();
    assert_eq!(report["comments"][0]["text"], "First note\nSecond note");
    assert_eq!(report["comments"][0]["resolved"], true);
    assert_eq!(
        report["comments"][0]["anchors"][0]["part"],
        "word/document.xml"
    );
    assert_eq!(report["comments"][0]["anchors"][0]["markers"][0], "start");
    assert_eq!(
        report["comments"][0]["anchors"][0]["paragraph"],
        "Review this\tparagraph"
    );
    assert_eq!(
        report["comments"][0]["anchors"][1]["part"],
        "word/header1.xml"
    );
}

#[test]
fn comments_manage_updates_resolves_and_strips_classic_comment_markup() {
    let dir = temp_dir("comments-manage");
    let input = write_docx_with_parts(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:commentRangeStart w:id="1"/><w:r><w:t>Text</w:t><w:commentReference w:id="1"/></w:r><w:commentRangeEnd w:id="1"/></w:p></w:body></w:document>"#,
        &[(
            "word/comments.xml",
            r#"<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="1" w:author="Reviewer"><w:p><w:r><w:t>Old note</w:t></w:r></w:p></w:comment></w:comments>"#,
        )],
    );
    let updated = dir.join("updated.docx");
    let update = run(&[
        "docx",
        "helper",
        "comments-manage",
        "--operation",
        "update",
        "--input",
        input.to_str().unwrap(),
        "--output",
        updated.to_str().unwrap(),
        "--id",
        "1",
        "--text",
        "New & revised",
        "--json",
    ]);
    assert!(
        update.status.success(),
        "{}",
        String::from_utf8_lossy(&update.stderr)
    );
    let update_report: serde_json::Value = serde_json::from_slice(&update.stdout).unwrap();
    assert_eq!(update_report["changes"], 1);
    let mut archive = zip::ZipArchive::new(File::open(&updated).unwrap()).unwrap();
    let comments = read_zip_part(&mut archive, "word/comments.xml");
    assert!(comments.contains("New &amp; revised"));
    assert!(comments.contains("w:author=\"Reviewer\""));

    let resolved = dir.join("resolved.docx");
    let resolve = run(&[
        "docx",
        "helper",
        "comments-manage",
        "--operation",
        "resolve",
        "--input",
        updated.to_str().unwrap(),
        "--output",
        resolved.to_str().unwrap(),
        "--id",
        "1",
        "--json",
    ]);
    assert!(
        resolve.status.success(),
        "{}",
        String::from_utf8_lossy(&resolve.stderr)
    );
    let mut archive = zip::ZipArchive::new(File::open(&resolved).unwrap()).unwrap();
    let comments = read_zip_part(&mut archive, "word/comments.xml");
    assert!(comments.contains("w:done=\"1\""));

    let unresolved = dir.join("unresolved.docx");
    let unresolve = run(&[
        "docx",
        "helper",
        "comments-manage",
        "--operation",
        "resolve",
        "--input",
        resolved.to_str().unwrap(),
        "--output",
        unresolved.to_str().unwrap(),
        "--id",
        "1",
        "--resolved",
        "false",
        "--json",
    ]);
    assert!(
        unresolve.status.success(),
        "{}",
        String::from_utf8_lossy(&unresolve.stderr)
    );
    let mut archive = zip::ZipArchive::new(File::open(&unresolved).unwrap()).unwrap();
    let comments = read_zip_part(&mut archive, "word/comments.xml");
    assert!(!comments.contains("w:done="));

    let stripped = dir.join("stripped.docx");
    let strip = run(&[
        "docx",
        "helper",
        "comments-manage",
        "--operation",
        "strip",
        "--input",
        unresolved.to_str().unwrap(),
        "--output",
        stripped.to_str().unwrap(),
        "--json",
    ]);
    assert!(
        strip.status.success(),
        "{}",
        String::from_utf8_lossy(&strip.stderr)
    );
    let mut archive = zip::ZipArchive::new(File::open(stripped).unwrap()).unwrap();
    let document = read_zip_part(&mut archive, "word/document.xml");
    let comments = read_zip_part(&mut archive, "word/comments.xml");
    assert!(!document.contains("commentRange"));
    assert!(!document.contains("commentReference"));
    assert!(!comments.contains("<w:comment "));
}

#[test]
fn comments_add_inserts_range_references_and_package_relationships() {
    let dir = temp_dir("comments-add");
    let input = write_docx_with_document(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr><w:r><w:t>First paragraph</w:t></w:r></w:p><w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p></w:body></w:document>"#,
    );
    let output_path = dir.join("commented.docx");
    let output = run(&[
        "docx",
        "helper",
        "comments-add",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--paragraph-index",
        "1",
        "--text",
        "Please review this section",
        "--author",
        "Reviewer",
        "--initials",
        "RV",
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["addedComments"], 1);
    assert_eq!(report["commentIds"], serde_json::json!([0]));
    assert_eq!(report["paragraphIndexes"], serde_json::json!([1]));
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let document = read_zip_part(&mut archive, "word/document.xml");
    let second = document.split("Second paragraph").next().unwrap();
    assert!(second.rfind("<w:commentRangeStart w:id=\"0\"/>").is_some());
    assert!(document.contains("<w:commentRangeEnd w:id=\"0\"/>"));
    assert!(document.contains("<w:commentReference w:id=\"0\"/>"));
    let comments = read_zip_part(&mut archive, "word/comments.xml");
    assert!(comments.contains("w:author=\"Reviewer\""));
    assert!(comments.contains("w:initials=\"RV\""));
    assert!(comments.contains("Please review this section"));
    let rels = read_zip_part(&mut archive, "word/_rels/document.xml.rels");
    assert!(rels.contains("relationships/comments"));
    assert!(rels.contains("Target=\"comments.xml\""));
    let types = read_zip_part(&mut archive, "[Content_Types].xml");
    assert!(types.contains("/word/comments.xml"));
}

#[test]
fn comments_add_matches_paragraph_patterns_and_reports_unmatched_targets() {
    let dir = temp_dir("comments-add-patterns");
    let input = write_docx_with_document(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Needle in first paragraph</w:t></w:r></w:p><w:p><w:r><w:t>Another paragraph</w:t></w:r></w:p></w:body></w:document>"#,
    );
    let output_path = dir.join("commented.docx");
    let output = run(&[
        "docx",
        "helper",
        "comments-add",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--add",
        "needle=Pattern comment",
        "--add",
        "missing=Unmatched comment",
        "--ignore-case",
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["addedComments"], 1);
    assert_eq!(report["unmatchedPatterns"], serde_json::json!(["missing"]));
    assert_eq!(report["paragraphIndexes"], serde_json::json!([0]));
}

#[test]
fn comments_apply_patches_replaces_appends_resolves_and_reports_missing_ids() {
    let dir = temp_dir("comments-apply-patches");
    let input = write_docx_with_parts(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:commentRangeStart w:id="1"/><w:r><w:t>Text</w:t></w:r><w:commentRangeEnd w:id="1"/></w:p></w:body></w:document>"#,
        &[(
            "word/comments.xml",
            r#"<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="1"><w:p><w:r><w:t>Old</w:t></w:r></w:p></w:comment></w:comments>"#,
        )],
    );
    let patch_path = dir.join("patch.json");
    fs::write(
        &patch_path,
        r#"{"ops":[{"id":1,"replace":"Updated\nparagraph"},{"id":1,"append":"Follow-up"},{"id":1,"resolved":true},{"id":99,"append":"Missing"},{}]}"#,
    )
    .unwrap();
    let output_path = dir.join("patched.docx");
    let output = run(&[
        "docx",
        "helper",
        "comments-apply-patches",
        "--input",
        input.to_str().unwrap(),
        "--patch-json",
        patch_path.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["comments_touched"], 1);
    assert_eq!(report["ops_applied"], 3);
    assert_eq!(report["warnings"].as_array().unwrap().len(), 2);
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let comments = read_zip_part(&mut archive, "word/comments.xml");
    assert!(comments.contains("Updated"));
    assert!(comments.contains("paragraph"));
    assert!(comments.contains("Follow-up"));
    assert!(!comments.contains("Old"));
    assert!(comments.contains("w:done=\"1\""));
}

#[test]
fn content_controls_lists_plain_text_and_other_controls_across_word_parts() {
    let dir = temp_dir("content-controls-list");
    let input = write_docx_with_parts(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:sdt><w:sdtPr><w:tag w:val="NAME"/><w:alias w:val="Name"/><w:text/></w:sdtPr><w:sdtContent><w:r><w:t>Ada</w:t></w:r></w:sdtContent></w:sdt></w:body></w:document>"#,
        &[(
            "word/header1.xml",
            r#"<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:sdt><w:sdtPr><w:tag w:val="LOCKED"/></w:sdtPr><w:sdtContent><w:r><w:t>Header</w:t></w:r></w:sdtContent></w:sdt></w:hdr>"#,
        )],
    );
    let output = run(&[
        "docx",
        "helper",
        "content-controls",
        "--action",
        "list",
        "--input",
        input.to_str().unwrap(),
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["controls"].as_array().unwrap().len(), 2);
    assert_eq!(
        report["controls"][0],
        serde_json::json!({
            "part": "word/document.xml",
            "tag": "NAME",
            "alias": "Name",
            "type": "plainText",
            "text": "Ada"
        })
    );
    assert_eq!(report["controls"][1]["part"], "word/header1.xml");
    assert_eq!(report["controls"][1]["type"], "other");
}

#[test]
fn content_controls_wraps_placeholders_in_direct_body_runs_and_preserves_other_parts() {
    let dir = temp_dir("content-controls-wrap");
    let input = write_docx_with_parts(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Before {{NAME}} and {{EMAIL}} after</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>{{TABLE}}</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr/></w:body></w:document>"#,
        &[(
            "word/header1.xml",
            r#"<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:sdt><w:sdtPr><w:tag w:val="OLD"/><w:id w:val="+01"/></w:sdtPr><w:sdtContent><w:r><w:t>unchanged</w:t></w:r></w:sdtContent></w:sdt></w:hdr>"#,
        )],
    );
    let output_path = dir.join("wrapped.docx");
    let output = run(&[
        "docx",
        "helper",
        "content-controls",
        "--action",
        "wrap-placeholders",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["matches"], 2);
    assert_eq!(report["tags"], serde_json::json!(["NAME", "EMAIL"]));
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let mut document = String::new();
    archive
        .by_name("word/document.xml")
        .unwrap()
        .read_to_string(&mut document)
        .unwrap();
    assert!(document.contains("<w:pPr><w:jc w:val=\"right\"/></w:pPr>"));
    assert_eq!(
        document.matches("<w:sdt>").count(),
        2,
        "only direct main-body placeholder runs become controls"
    );
    assert!(document.contains("<w:id w:val=\"2\"/>"));
    assert!(document.contains("<w:id w:val=\"3\"/>"));
    assert!(document.contains("{{TABLE}}"));
    let mut header = String::new();
    archive
        .by_name("word/header1.xml")
        .unwrap()
        .read_to_string(&mut header)
        .unwrap();
    assert_eq!(
        header,
        "<w:hdr xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:sdt><w:sdtPr><w:tag w:val=\"OLD\"/><w:id w:val=\"+01\"/></w:sdtPr><w:sdtContent><w:r><w:t>unchanged</w:t></w:r></w:sdtContent></w:sdt></w:hdr>"
    );
}

#[test]
fn content_controls_fills_tagged_plain_text_controls_and_rejects_existing_output() {
    let dir = temp_dir("content-controls-fill");
    let input = write_docx_with_parts(
        &dir,
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:sdt><w:sdtPr><w:tag w:val="NAME"/><w:text/></w:sdtPr><w:sdtContent><w:r><w:t>old</w:t><w:t> second</w:t></w:r></w:sdtContent></w:sdt></w:body></w:document>"#,
        &[(
            "word/header1.xml",
            r#"<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>unchanged</w:t></w:r></w:p></w:hdr>"#,
        )],
    );
    let output_path = dir.join("filled.docx");
    let output = run(&[
        "docx",
        "helper",
        "content-controls",
        "--action",
        "fill",
        "--input",
        input.to_str().unwrap(),
        "--output",
        output_path.to_str().unwrap(),
        "--tag",
        "NAME",
        "--value",
        " Ada ",
        "--json",
    ]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["matches"], 1);
    let mut archive = zip::ZipArchive::new(File::open(output_path).unwrap()).unwrap();
    let mut document = String::new();
    archive
        .by_name("word/document.xml")
        .unwrap()
        .read_to_string(&mut document)
        .unwrap();
    assert!(document.contains("<w:t xml:space=\"preserve\"> Ada </w:t>"));
    assert!(document.contains("<w:t></w:t>"));
}

#[test]
fn content_controls_wrap_rejects_duplicate_malformed_split_and_non_run_markers() {
    let cases = [
        r#"<w:p><w:r><w:t>{{NAME}} {{NAME}}</w:t></w:r></w:p>"#,
        r#"<w:p><w:r><w:t>{{bad tag}}</w:t></w:r></w:p>"#,
        r#"<w:p><w:r><w:t>{{NA</w:t></w:r><w:r><w:t>ME}}</w:t></w:r></w:p>"#,
        r#"<w:p><w:hyperlink><w:r><w:t>{{NAME}}</w:t></w:r></w:hyperlink></w:p>"#,
        r#"<w:p><w:r><w:t>{{NAME}}</w:t><w:tab/></w:r></w:p>"#,
    ];
    for (index, paragraph) in cases.iter().enumerate() {
        let dir = temp_dir(&format!("content-controls-invalid-{index}"));
        let input = write_docx_with_document(
            &dir,
            &format!(
                r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{paragraph}</w:body></w:document>"#
            ),
        );
        let original = fs::read(&input).unwrap();
        let output_path = dir.join("wrapped.docx");
        let output = run(&[
            "docx",
            "helper",
            "content-controls",
            "--action",
            "wrap-placeholders",
            "--input",
            input.to_str().unwrap(),
            "--output",
            output_path.to_str().unwrap(),
            "--json",
        ]);
        assert!(
            !output.status.success(),
            "case {index} unexpectedly succeeded"
        );
        assert!(!output_path.exists(), "case {index} left a partial output");
        assert_eq!(
            fs::read(input).unwrap(),
            original,
            "case {index} changed source"
        );
    }
}
