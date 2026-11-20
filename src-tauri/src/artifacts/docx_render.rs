use super::*;
use std::process::{Command, Output, Stdio};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use zip::write::SimpleFileOptions;

const MAX_TOOL_DURATION: Duration = Duration::from_secs(180);

struct RenderTools {
    soffice: PathBuf,
    pdfinfo: PathBuf,
    pdftoppm: PathBuf,
}

struct TemporaryDirectory(PathBuf);

impl Drop for TemporaryDirectory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn temporary_directory(label: &str) -> Result<TemporaryDirectory, ArtifactError> {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let path = std::env::temp_dir().join(format!("ruxex-docx-{label}-{}-{nonce}", std::process::id()));
    fs::create_dir(&path).map_err(|error| ArtifactError::new("io_error", error.to_string()))?;
    Ok(TemporaryDirectory(path))
}

fn resolve_tools() -> Result<RenderTools, ArtifactError> {
    let runtime_root = std::env::var_os("RUXEX_RUNTIME_ROOT").filter(|value| !value.is_empty());
    let runtime_bin = std::env::var_os("RUXEX_RUNTIME_BIN_DIR").filter(|value| !value.is_empty());
    let (root, bin_dir) = match (runtime_root, runtime_bin) {
        (Some(root), Some(bin)) => (PathBuf::from(root), PathBuf::from(bin)),
        (None, None) => discover_packaged_tools().ok_or_else(|| {
            ArtifactError::new(
                "missing_runtime_resource",
                "document rendering requires the managed renderer runtime; host tools are not used",
            )
        })?,
        _ => {
            return Err(ArtifactError::new(
                "missing_runtime_resource",
                "RUXEX_RUNTIME_ROOT and RUXEX_RUNTIME_BIN_DIR must both identify the managed renderer runtime",
            ));
        }
    };
    let expected = root.join("bin/override");
    let canonical_bin = bin_dir.canonicalize().map_err(|error| {
        ArtifactError::new("missing_runtime_resource", format!("managed renderer directory is missing: {error}"))
    })?;
    let canonical_expected = expected.canonicalize().map_err(|error| {
        ArtifactError::new("missing_runtime_resource", format!("managed renderer directory is missing: {error}"))
    })?;
    if canonical_bin != canonical_expected {
        return Err(ArtifactError::new(
            "missing_runtime_resource",
            "RUXEX_RUNTIME_BIN_DIR does not match RUXEX_RUNTIME_ROOT/bin/override",
        ));
    }
    let paths = ["soffice", "pdfinfo", "pdftoppm"].map(|name| bin_dir.join(name));
    for (name, path) in ["soffice", "pdfinfo", "pdftoppm"].into_iter().zip(paths.iter()) {
        let metadata = fs::metadata(path).map_err(|_| {
            ArtifactError::new(
                "missing_runtime_resource",
                format!("bundled rendering tool is missing or not executable: {name} ({})", path.display()),
            )
        })?;
        if !metadata.is_file() || !is_executable(&metadata) {
            return Err(ArtifactError::new(
                "missing_runtime_resource",
                format!("bundled rendering tool is missing or not executable: {name} ({})", path.display()),
            ));
        }
    }
    Ok(RenderTools {
        soffice: paths[0].clone(),
        pdfinfo: paths[1].clone(),
        pdftoppm: paths[2].clone(),
    })
}

#[cfg(unix)]
fn is_executable(metadata: &fs::Metadata) -> bool {
    use std::os::unix::fs::PermissionsExt;
    metadata.permissions().mode() & 0o111 != 0
}

#[cfg(not(unix))]
fn is_executable(_metadata: &fs::Metadata) -> bool {
    true
}

fn discover_packaged_tools() -> Option<(PathBuf, PathBuf)> {
    let executable = std::env::current_exe().ok()?;
    discover_packaged_tools_from(&executable)
}

fn discover_packaged_tools_from(executable: &Path) -> Option<(PathBuf, PathBuf)> {
    for ancestor in executable.ancestors() {
        let nested = ancestor.join("ruxex-resources");
        let root = if nested.join("bin/override/soffice").is_file() {
            nested
        } else if ancestor.file_name().is_some_and(|name| name == "ruxex-resources")
            && ancestor.join("bin/override/soffice").is_file()
        {
            ancestor.to_owned()
        } else {
            continue;
        };
        return Some((root.clone(), root.join("bin/override")));
    }
    None
}

pub(super) fn render_command(args: &[String]) -> Result<Value, ArtifactError> {
    let keep_pdf = args.iter().any(|arg| arg == "--keep-pdf");
    let normalized = args
        .iter()
        .filter(|arg| arg.as_str() != "--keep-pdf")
        .cloned()
        .collect::<Vec<_>>();
    let flags = cli::parse_flags(&normalized)?;
    for (flag, _) in &flags {
        if !matches!(flag.as_str(), "input" | "output-dir" | "dpi" | "--json") {
            return Err(ArtifactError::new("invalid_arguments", format!("unknown flag: --{flag}")));
        }
    }
    let input = cli::required_flag(&flags, "input")?;
    let output_dir = cli::required_flag(&flags, "output-dir")?;
    let dpi = flags
        .iter()
        .find(|(flag, _)| flag == "dpi")
        .and_then(|(_, value)| value.as_deref())
        .unwrap_or("150")
        .parse::<u32>()
        .ok()
        .filter(|dpi| (72..=600).contains(dpi))
        .ok_or_else(|| ArtifactError::new("invalid_arguments", "--dpi must be between 72 and 600"))?;
    let pages = render(input, output_dir, dpi, keep_pdf)?;
    Ok(json!({ "ok": true, "pages": pages, "dpi": dpi, "pdf": keep_pdf }))
}

pub(super) fn compare_command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(flag.as_str(), "before" | "after" | "output-dir" | "dpi" | "--json") {
            return Err(ArtifactError::new("invalid_arguments", format!("unknown flag: --{flag}")));
        }
    }
    let before = cli::required_flag(&flags, "before")?;
    let after = cli::required_flag(&flags, "after")?;
    let output_dir = cli::required_flag(&flags, "output-dir")?;
    let dpi = flags
        .iter()
        .find(|(flag, _)| flag == "dpi")
        .and_then(|(_, value)| value.as_deref())
        .unwrap_or("120")
        .parse::<u32>()
        .ok()
        .filter(|dpi| (72..=600).contains(dpi))
        .ok_or_else(|| ArtifactError::new("invalid_arguments", "--dpi must be between 72 and 600"))?;
    compare(&before, &after, &output_dir, dpi)
}

fn compare(
    before_path: &str,
    after_path: &str,
    output_dir: &str,
    dpi: u32,
) -> Result<Value, ArtifactError> {
    let tools = resolve_tools()?;
    compare_with_tools(before_path, after_path, output_dir, dpi, &tools)
}

fn compare_with_tools(
    before_path: &str,
    after_path: &str,
    output_dir: &str,
    dpi: u32,
    tools: &RenderTools,
) -> Result<Value, ArtifactError> {
    let before = valid_docx_path(before_path)?;
    let after = valid_docx_path(after_path)?;
    let output = Path::new(output_dir)
        .canonicalize()
        .or_else(|_| {
            fs::create_dir_all(output_dir)?;
            Path::new(output_dir).canonicalize()
        })
        .map_err(|error| ArtifactError::new("io_error", error.to_string()))?;
    if fs::read_dir(&output)
        .map_err(|error| ArtifactError::new("io_error", error.to_string()))?
        .next()
        .is_some()
    {
        return Err(ArtifactError::new("invalid_arguments", "output directory must be empty"));
    }
    let temp = temporary_directory("compare")?;
    let staged = temp.0.join("results");
    fs::create_dir(&staged).map_err(|error| ArtifactError::new("io_error", error.to_string()))?;
    let before_pages = render_with_tools(
        before.to_string_lossy().as_ref(),
        temp.0.join("before").to_string_lossy().as_ref(),
        dpi,
        false,
        tools,
    )?;
    let after_pages = render_with_tools(
        after.to_string_lossy().as_ref(),
        temp.0.join("after").to_string_lossy().as_ref(),
        dpi,
        false,
        tools,
    )?;
    let old_lines = paragraph_text_lines(&before)?;
    let new_lines = paragraph_text_lines(&after)?;
    let text_diff = similar::TextDiff::from_lines(
        &old_lines.iter().map(|line| format!("{line}\n")).collect::<String>(),
        &new_lines.iter().map(|line| format!("{line}\n")).collect::<String>(),
    )
    .unified_diff()
    .header(
        before.file_name().and_then(|name| name.to_str()).unwrap_or("before.docx"),
        after.file_name().and_then(|name| name.to_str()).unwrap_or("after.docx"),
    )
    .to_string();
    let text_diff = if text_diff.is_empty() || text_diff.ends_with('\n') {
        text_diff
    } else {
        format!("{text_diff}\n")
    };
    fs::write(staged.join("text.diff"), text_diff)
        .map_err(|error| ArtifactError::new("io_error", error.to_string()))?;

    let mut page_comparison = Vec::new();
    for index in 0..before_pages.len().max(after_pages.len()) {
        let has_before = index < before_pages.len();
        let has_after = index < after_pages.len();
        let mut entry = serde_json::Map::new();
        entry.insert("page".to_owned(), json!(index + 1));
        entry.insert("before".to_owned(), json!(has_before));
        entry.insert("after".to_owned(), json!(has_after));
        if has_before && has_after {
            let old = image::open(&before_pages[index])
                .map_err(|error| ArtifactError::new("image_read_error", error.to_string()))?
                .to_rgb8();
            let new = image::open(&after_pages[index])
                .map_err(|error| ArtifactError::new("image_read_error", error.to_string()))?
                .to_rgb8();
            let width = old.width().max(new.width());
            let height = old.height().max(new.height());
            let mut difference = image::RgbImage::new(width, height);
            let mut sum = 0u64;
            for y in 0..height {
                for x in 0..width {
                    let old_pixel = old.get_pixel_checked(x, y).copied().unwrap_or(image::Rgb([255, 255, 255]));
                    let new_pixel = new.get_pixel_checked(x, y).copied().unwrap_or(image::Rgb([255, 255, 255]));
                    let channels = [
                        old_pixel[0].abs_diff(new_pixel[0]),
                        old_pixel[1].abs_diff(new_pixel[1]),
                        old_pixel[2].abs_diff(new_pixel[2]),
                    ];
                    sum += u64::from(channels[0]) + u64::from(channels[1]) + u64::from(channels[2]);
                    difference.put_pixel(x, y, image::Rgb(channels));
                }
            }
            let mean = sum as f64 / (width as f64 * height as f64 * 3.0);
            let diff_name = format!("page-{:03}-diff.png", index + 1);
            difference
                .save(staged.join(&diff_name))
                .map_err(|error| ArtifactError::new("image_write_error", error.to_string()))?;
            entry.insert("meanAbsoluteDifference".to_owned(), json!((mean * 1000.0).round() / 1000.0));
            entry.insert("diffImage".to_owned(), json!(output.join(diff_name)));
        }
        page_comparison.push(Value::Object(entry));
    }
    for (label, pages) in [("before", &before_pages), ("after", &after_pages)] {
        for (index, page) in pages.iter().enumerate() {
            let name = format!("{label}-page-{:03}.png", index + 1);
            fs::copy(page, staged.join(name))
                .map_err(|error| ArtifactError::new("io_error", error.to_string()))?;
        }
    }
    let report = json!({
        "ok": true,
        "before": before,
        "after": after,
        "pageCounts": { "before": before_pages.len(), "after": after_pages.len() },
        "textChanged": old_lines != new_lines,
        "textDiff": output.join("text.diff"),
        "pageComparison": page_comparison,
        "imageDiffAvailable": true
    });
    let mut report_bytes = serde_json::to_vec_pretty(&report)
        .map_err(|error| ArtifactError::new("json_write_error", error.to_string()))?;
    report_bytes.push(b'\n');
    fs::write(staged.join("comparison.json"), report_bytes)
        .map_err(|error| ArtifactError::new("json_write_error", error.to_string()))?;
    let mut copied = Vec::new();
    let copy_result = (|| {
        for entry in fs::read_dir(&staged).map_err(|error| ArtifactError::new("io_error", error.to_string()))? {
            let entry = entry.map_err(|error| ArtifactError::new("io_error", error.to_string()))?;
            let target = output.join(entry.file_name());
            fs::copy(entry.path(), &target)
                .map_err(|error| ArtifactError::new("io_error", error.to_string()))?;
            copied.push(target);
        }
        Ok(())
    })();
    if copy_result.is_err() {
        for path in copied {
            let _ = fs::remove_file(path);
        }
    }
    copy_result?;
    Ok(report)
}

fn valid_docx_path(input: &str) -> Result<PathBuf, ArtifactError> {
    let path = Path::new(input)
        .canonicalize()
        .map_err(|error| ArtifactError::new("invalid_arguments", error.to_string()))?;
    if !path.is_file()
        || !path
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("docx"))
    {
        return Err(ArtifactError::new("invalid_arguments", "both inputs must be regular .docx files"));
    }
    Ok(path)
}

fn paragraph_text_lines(path: &Path) -> Result<Vec<String>, ArtifactError> {
    let file = File::open(path).map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut archive = ZipArchive::new(file).map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let document = super::read_docx_part(&mut archive, "word/document.xml")?;
    super::ordered_docx_blocks(&document, "w:p")
        .iter()
        .map(|(_, paragraph)| super::docx_paragraph_text(paragraph))
        .collect()
}

fn render(
    input_path: &str,
    output_dir: &str,
    dpi: u32,
    keep_pdf: bool,
) -> Result<Vec<PathBuf>, ArtifactError> {
    let tools = resolve_tools()?;
    render_with_tools(input_path, output_dir, dpi, keep_pdf, &tools)
}

fn render_with_tools(
    input_path: &str,
    output_dir: &str,
    dpi: u32,
    keep_pdf: bool,
    tools: &RenderTools,
) -> Result<Vec<PathBuf>, ArtifactError> {
    let source = Path::new(input_path)
        .canonicalize()
        .map_err(|error| ArtifactError::new("invalid_arguments", error.to_string()))?;
    if !source.is_file()
        || !source.extension().is_some_and(|extension| {
            extension.eq_ignore_ascii_case("docx") || extension.eq_ignore_ascii_case("docm")
        })
    {
        return Err(ArtifactError::new("invalid_arguments", "input must be a regular .docx or .docm file"));
    }
    let destination = Path::new(output_dir)
        .canonicalize()
        .or_else(|_| {
            fs::create_dir_all(output_dir)?;
            Path::new(output_dir).canonicalize()
        })
        .map_err(|error| ArtifactError::new("io_error", error.to_string()))?;
    let temp = temporary_directory("render")?;
    let render_source = normalized_docx_copy(&source, &temp.0)?;
    let stem = source.file_stem().and_then(|stem| stem.to_str()).unwrap_or("document");
    let pdf = temp.0.join(format!("{stem}.pdf"));
    let profile = url::Url::from_directory_path(temp.0.join("lo-profile"))
        .map_err(|_| ArtifactError::new("io_error", "could not construct LibreOffice profile URI"))?;
    let conversion = run_tool(
        Command::new(&tools.soffice)
            .arg("--headless")
            .arg(format!("-env:UserInstallation={profile}"))
            .args(["--convert-to", "pdf", "--outdir"])
            .arg(&temp.0)
            .arg(&render_source),
        "LibreOffice conversion",
    )?;
    if !conversion.status.success() || !pdf.is_file() {
        return Err(ArtifactError::new(
            "render_failed",
            tool_detail(&conversion).unwrap_or_else(|| "LibreOffice did not create a PDF".to_owned()),
        ));
    }
    let info = run_tool(Command::new(&tools.pdfinfo).arg(&pdf), "PDF metadata inspection")?;
    if !info.status.success() {
        return Err(ArtifactError::new("render_failed", tool_detail(&info).unwrap_or_else(|| "pdfinfo failed".to_owned())));
    }
    let page_count = String::from_utf8_lossy(&info.stdout)
        .lines()
        .find_map(|line| line.strip_prefix("Pages:").and_then(|count| count.trim().parse::<usize>().ok()))
        .filter(|count| *count > 0)
        .ok_or_else(|| ArtifactError::new("render_failed", "pdfinfo did not report a positive page count"))?;
    let prefix = temp.0.join(stem);
    let raster = run_tool(
        Command::new(&tools.pdftoppm)
            .args(["-r", &dpi.to_string(), "-png"])
            .arg(&pdf)
            .arg(&prefix),
        "PDF page rendering",
    )?;
    if !raster.status.success() {
        return Err(ArtifactError::new("render_failed", tool_detail(&raster).unwrap_or_else(|| "pdftoppm failed".to_owned())));
    }
    let rendered_pages = (1..=page_count)
        .map(|number| temp.0.join(format!("{stem}-{number}.png")))
        .collect::<Vec<_>>();
    if rendered_pages.iter().any(|page| !page.is_file()) {
        return Err(ArtifactError::new("render_failed", "renderer completed without producing all page images"));
    }
    let output_pages = rendered_pages
        .iter()
        .map(|page| destination.join(page.file_name().unwrap_or_default()))
        .collect::<Vec<_>>();
    let retained_pdf = destination.join(format!("{stem}.pdf"));
    if output_pages.iter().any(|page| page.exists()) || (keep_pdf && retained_pdf.exists()) {
        return Err(ArtifactError::new("invalid_arguments", "one or more page images already exist in the output directory"));
    }
    let mut copied = Vec::new();
    let copy_result = (|| {
        for (source_page, target_page) in rendered_pages.iter().zip(&output_pages) {
            fs::copy(source_page, target_page).map_err(|error| ArtifactError::new("io_error", error.to_string()))?;
            copied.push(target_page.clone());
        }
        if keep_pdf {
            fs::copy(&pdf, &retained_pdf).map_err(|error| ArtifactError::new("io_error", error.to_string()))?;
            copied.push(retained_pdf);
        }
        Ok(())
    })();
    if copy_result.is_err() {
        for path in copied {
            let _ = fs::remove_file(path);
        }
    }
    copy_result?;
    Ok(output_pages)
}

fn normalized_docx_copy(source: &Path, temporary: &Path) -> Result<PathBuf, ArtifactError> {
    let file = File::open(source).map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut archive = ZipArchive::new(file).map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let names = archive.file_names().map(str::to_owned).collect::<Vec<_>>();
    let repaired = names.iter().map(|name| name.replace('\\', "/")).collect::<Vec<_>>();
    let unique = repaired.iter().collect::<BTreeSet<_>>();
    if unique.len() != repaired.len() {
        return Err(ArtifactError::new("invalid_ooxml_package", "DOCX ZIP member names collide after path separator repair"));
    }
    if repaired == names {
        return Ok(source.to_owned());
    }
    let repaired_path = temporary.join(source.file_name().unwrap_or_default());
    let output = File::create(&repaired_path).map_err(|error| ArtifactError::new("io_error", error.to_string()))?;
    let mut writer = ZipWriter::new(output);
    for (name, repaired_name) in names.iter().zip(&repaired) {
        let mut data = Vec::new();
        archive
            .by_name(name)
            .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?
            .read_to_end(&mut data)
            .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
        writer
            .start_file(repaired_name, SimpleFileOptions::default())
            .map_err(|error| ArtifactError::new("io_error", error.to_string()))?;
        writer
            .write_all(&data)
            .map_err(|error| ArtifactError::new("io_error", error.to_string()))?;
    }
    writer.finish().map_err(|error| ArtifactError::new("io_error", error.to_string()))?;
    Ok(repaired_path)
}

fn run_tool(command: &mut Command, operation: &str) -> Result<Output, ArtifactError> {
    let mut child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| ArtifactError::new("runtime_launch_error", format!("{operation}: {error}")))?;
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if started.elapsed() <= MAX_TOOL_DURATION => thread::sleep(Duration::from_millis(50)),
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(ArtifactError::new("render_timeout", format!("{operation} exceeded 180 seconds")));
            }
            Err(error) => {
                let _ = child.kill();
                return Err(ArtifactError::new("runtime_launch_error", format!("{operation}: {error}")));
            }
        }
    }
    child.wait_with_output().map_err(|error| ArtifactError::new("runtime_launch_error", error.to_string()))
}

fn tool_detail(output: &Output) -> Option<String> {
    let detail = String::from_utf8_lossy(&output.stderr).trim().to_owned();
    if detail.is_empty() {
        let detail = String::from_utf8_lossy(&output.stdout).trim().to_owned();
        (!detail.is_empty()).then_some(detail)
    } else {
        Some(detail)
    }
}

#[cfg(test)]
mod tests {
    use super::{
        RenderTools, compare_with_tools, discover_packaged_tools_from, normalized_docx_copy,
        render_with_tools, temporary_directory,
    };
    use std::fs::{self, File};
    use std::io::Write;
    use zip::ZipWriter;

    #[cfg(unix)]
    fn executable(path: &std::path::Path, contents: &str) {
        use std::os::unix::fs::PermissionsExt;
        fs::write(path, contents).unwrap();
        fs::set_permissions(path, fs::Permissions::from_mode(0o755)).unwrap();
    }

    #[cfg(unix)]
    fn fake_tools(root: &std::path::Path, rasterizer_ok: bool) -> RenderTools {
        let bin_dir = root.join("bin/override");
        fs::create_dir_all(&bin_dir).unwrap();
        let soffice = bin_dir.join("soffice");
        executable(
            &soffice,
            "#!/bin/sh\nwhile [ \"$#\" -gt 0 ]; do\n  if [ \"$1\" = \"--outdir\" ]; then out=\"$2\"; shift 2; else input=\"$1\"; shift; fi\ndone\nname=${input##*/}\nstem=${name%.*}\nprintf 'pdf' > \"$out/$stem.pdf\"\n",
        );
        let pdfinfo = bin_dir.join("pdfinfo");
        executable(&pdfinfo, "#!/bin/sh\nprintf 'Pages: 2\\n'\n");
        let image_path = root.join("page.png");
        image::RgbImage::from_pixel(2, 3, image::Rgb([255, 255, 255]))
            .save(&image_path)
            .unwrap();
        let pdftoppm = bin_dir.join("pdftoppm");
        let script = if rasterizer_ok {
            format!(
                "#!/bin/sh\nfor arg in \"$@\"; do prefix=\"$arg\"; done\ncp '{}' \"$prefix-1.png\"\ncp '{}' \"$prefix-2.png\"\n",
                image_path.display(),
                image_path.display()
            )
        } else {
            "#!/bin/sh\nexit 9\n".to_owned()
        };
        executable(&pdftoppm, &script);
        RenderTools {
            soffice,
            pdfinfo,
            pdftoppm,
        }
    }

    #[cfg(unix)]
    #[test]
    fn rendering_uses_supplied_tools_saves_every_page_and_optional_pdf() {
        let temporary = temporary_directory("render-tools-test").unwrap();
        let source = temporary.0.join("report.docx");
        let mut archive = ZipWriter::new(File::create(&source).unwrap());
        archive.start_file("word/document.xml", zip::write::SimpleFileOptions::default()).unwrap();
        archive.write_all(b"<document/>").unwrap();
        archive.finish().unwrap();
        let tools = fake_tools(&temporary.0, true);
        let output = temporary.0.join("output");
        let pages = render_with_tools(source.to_str().unwrap(), output.to_str().unwrap(), 120, true, &tools).unwrap();
        assert_eq!(pages.len(), 2);
        assert!(pages.iter().all(|page| page.is_file()));
        assert!(output.join("report.pdf").is_file());
    }

    #[cfg(unix)]
    #[test]
    fn rasterization_failure_leaves_no_partial_page_files() {
        let temporary = temporary_directory("render-failure-test").unwrap();
        let source = temporary.0.join("report.docx");
        let mut archive = ZipWriter::new(File::create(&source).unwrap());
        archive.start_file("word/document.xml", zip::write::SimpleFileOptions::default()).unwrap();
        archive.write_all(b"<document/>").unwrap();
        archive.finish().unwrap();
        let tools = fake_tools(&temporary.0, false);
        let output = temporary.0.join("output");
        assert!(render_with_tools(source.to_str().unwrap(), output.to_str().unwrap(), 120, false, &tools).is_err());
        assert!(fs::read_dir(output).unwrap().next().is_none());
    }

    #[cfg(unix)]
    #[test]
    fn comparison_writes_text_diff_page_images_and_pixel_report() {
        let temporary = temporary_directory("compare-tools-test").unwrap();
        let before = temporary.0.join("before.docx");
        let after = temporary.0.join("after.docx");
        write_docx(&before, "Old paragraph");
        write_docx(&after, "New paragraph");
        let tools = fake_tools(&temporary.0, true);
        let output = temporary.0.join("comparison");
        let report = compare_with_tools(
            before.to_str().unwrap(),
            after.to_str().unwrap(),
            output.to_str().unwrap(),
            120,
            &tools,
        )
        .unwrap();
        assert_eq!(report["textChanged"], true);
        assert_eq!(report["pageCounts"]["before"], 2);
        assert_eq!(report["pageComparison"][0]["meanAbsoluteDifference"], 0.0);
        assert_eq!(report["imageDiffAvailable"], true);
        assert!(output.join("text.diff").is_file());
        assert!(output.join("comparison.json").is_file());
        assert!(output.join("page-001-diff.png").is_file());
        assert!(output.join("before-page-001.png").is_file());
        assert!(output.join("after-page-002.png").is_file());
        let diff = fs::read_to_string(output.join("text.diff")).unwrap();
        assert!(diff.contains("-Old paragraph"));
        assert!(diff.contains("+New paragraph"));
    }

    fn write_docx(path: &std::path::Path, text: &str) {
        let xml = format!(
            "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>"
        );
        let mut archive = ZipWriter::new(File::create(path).unwrap());
        archive.start_file("word/document.xml", zip::write::SimpleFileOptions::default()).unwrap();
        archive.write_all(xml.as_bytes()).unwrap();
        archive.finish().unwrap();
    }

    #[test]
    fn docx_zip_member_separator_repair_is_temporary_and_rejects_collisions() {
        let temporary = temporary_directory("zip-repair-test").unwrap();
        let source = temporary.0.join("source.docx");
        let file = File::create(&source).unwrap();
        let mut archive = ZipWriter::new(file);
        archive.start_file("word\\document.xml", zip::write::SimpleFileOptions::default()).unwrap();
        archive.write_all(b"<document/>").unwrap();
        archive.finish().unwrap();
        let work = temporary.0.join("work");
        fs::create_dir(&work).unwrap();
        let repaired = normalized_docx_copy(&source, &work).unwrap();
        assert_ne!(repaired, source);
        let mut reopened = zip::ZipArchive::new(File::open(repaired).unwrap()).unwrap();
        assert!(reopened.by_name("word/document.xml").is_ok());

        let collision = temporary.0.join("collision.docx");
        let mut archive = ZipWriter::new(File::create(&collision).unwrap());
        for name in ["word/document.xml", "word\\document.xml"] {
            archive.start_file(name, zip::write::SimpleFileOptions::default()).unwrap();
            archive.write_all(b"<document/>").unwrap();
        }
        archive.finish().unwrap();
        assert!(normalized_docx_copy(&collision, &work).is_err());
    }

    #[test]
    fn packaged_runtime_discovery_walks_only_bundled_resource_layouts() {
        let temporary = temporary_directory("runtime-discovery-test").unwrap();
        let root = temporary.0.join("ruxex-resources");
        let tool = root.join("bin/override/soffice");
        fs::create_dir_all(tool.parent().unwrap()).unwrap();
        fs::write(&tool, "tool").unwrap();
        let executable = root.join("vendored/skills/documents/ruxex-artifacts");
        fs::create_dir_all(executable.parent().unwrap()).unwrap();
        fs::write(&executable, "binary").unwrap();
        let (discovered_root, bin_dir) = discover_packaged_tools_from(&executable).unwrap();
        assert_eq!(discovered_root, root);
        assert_eq!(bin_dir, discovered_root.join("bin/override"));
    }
}
