use image::{ImageFormat, Rgb, RgbImage, imageops};
use ruxex_artifact_common::ArtifactError;
use ruxex_artifact_common::artifacts::ooxml;
use serde_json::{Value, json};
use std::collections::HashSet;
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Command, Output, Stdio};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const HELPERS: &[&str] = &[
    "inspect-template",
    "validate-template-plan",
    "prepare-template-starter-deck",
    "check-template-fidelity",
    "render-slides",
    "make-contact-sheet",
    "inspect-package-integrity",
    "inspect-layout-geometry",
    "native-chart-title-gate",
    "native-quantitative-chart-gate",
    "native-table-arithmetic-gate",
];

pub fn run_pptx(args: &[String]) -> Result<Value, ArtifactError> {
    if args.first().is_some_and(|arg| arg == "helper") {
        return run_helper(&args[1..]);
    }
    ooxml::run_ooxml("pptx", args)
}

fn run_helper(args: &[String]) -> Result<Value, ArtifactError> {
    let Some(operation) = args.first().map(String::as_str) else {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "a PPTX helper operation is required",
        ));
    };
    if operation == "list" {
        if args.len() != 1 {
            return Err(ArtifactError::new(
                "invalid_arguments",
                "pptx helper list takes no flags",
            ));
        }
        return Ok(json!({"ok":true,"helpers":HELPERS}));
    }
    let flags = parse_flags(
        &args[1..],
        &[
            "fail-on-overflow",
            "include-overlaps",
            "remove-placeholders",
        ],
    )?;
    match operation {
        "inspect-template" => inspect_template(&flags),
        "validate-template-plan" => validate_template_plan(&flags),
        "check-template-fidelity" => check_template_fidelity(&flags),
        "inspect-package-integrity" => inspect_package_integrity(&flags),
        "inspect-layout-geometry" => inspect_layout_geometry(&flags),
        "native-chart-title-gate" => chart_title_gate(&flags),
        "native-quantitative-chart-gate" => quantitative_chart_gate(&flags),
        "native-table-arithmetic-gate" => table_arithmetic_gate(&flags),
        "prepare-template-starter-deck" => prepare_starter(&flags),
        "render-slides" => render_slides(&flags),
        "make-contact-sheet" => make_contact_sheet(&flags),
        other => Err(ArtifactError::new(
            "invalid_arguments",
            format!("unknown PPTX helper: {other}"),
        )),
    }
}

fn parse_flags(
    args: &[String],
    bool_flags: &[&str],
) -> Result<Vec<(String, Option<String>)>, ArtifactError> {
    let mut flags = Vec::new();
    let mut index = 0;
    while index < args.len() {
        let Some(name) = args[index].strip_prefix("--") else {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("expected a flag, got: {}", args[index]),
            ));
        };
        if bool_flags.contains(&name) {
            flags.push((name.to_owned(), None));
            index += 1;
        } else {
            let value = args.get(index + 1).ok_or_else(|| {
                ArtifactError::new("invalid_arguments", format!("missing value for --{name}"))
            })?;
            if value.starts_with("--") {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    format!("missing value for --{name}"),
                ));
            }
            flags.push((name.to_owned(), Some(value.clone())));
            index += 2;
        }
    }
    let mut names = HashSet::new();
    if flags
        .iter()
        .any(|(name, _)| name != "image" && !names.insert(name.clone()))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "duplicate flags are not allowed",
        ));
    }
    Ok(flags)
}
fn value<'a>(flags: &'a [(String, Option<String>)], name: &str) -> Option<&'a str> {
    flags
        .iter()
        .find(|(key, _)| key == name)
        .and_then(|(_, value)| value.as_deref())
}
fn values<'a>(flags: &'a [(String, Option<String>)], name: &str) -> Vec<&'a str> {
    flags
        .iter()
        .filter(|(key, _)| key == name)
        .filter_map(|(_, value)| value.as_deref())
        .collect()
}
fn present(flags: &[(String, Option<String>)], name: &str) -> bool {
    flags.iter().any(|(key, _)| key == name)
}
fn required<'a>(
    flags: &'a [(String, Option<String>)],
    name: &str,
) -> Result<&'a str, ArtifactError> {
    value(flags, name)
        .ok_or_else(|| ArtifactError::new("invalid_arguments", format!("--{name} is required")))
}
fn allowed(flags: &[(String, Option<String>)], names: &[&str]) -> Result<(), ArtifactError> {
    if let Some((name, _)) = flags
        .iter()
        .find(|(name, _)| !names.contains(&name.as_str()))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            format!("unknown flag: --{name}"),
        ));
    }
    Ok(())
}
fn input(value: &str) -> Result<PathBuf, ArtifactError> {
    let path = PathBuf::from(value);
    if !path.is_absolute() || !path.is_file() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            format!("input must be an existing absolute file path: {value}"),
        ));
    }
    Ok(path)
}
fn report_file(
    flags: &[(String, Option<String>)],
    key: &str,
    report: &Value,
) -> Result<(), ArtifactError> {
    if let Some(path) = value(flags, key) {
        let path = PathBuf::from(path);
        if !path.is_absolute() {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("--{key} must be absolute"),
            ));
        }
        if path.exists() {
            return Err(ArtifactError::new(
                "output_exists",
                format!("refusing to overwrite existing file: {}", path.display()),
            ));
        }
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(io_error)?;
        }
        fs::write(
            path,
            format!(
                "{}\n",
                serde_json::to_string_pretty(report).map_err(json_error)?
            ),
        )
        .map_err(io_error)?;
    }
    Ok(())
}
fn io_error(error: std::io::Error) -> ArtifactError {
    ArtifactError::new("io_error", error.to_string())
}
fn json_error(error: serde_json::Error) -> ArtifactError {
    ArtifactError::new("json_error", error.to_string())
}
fn failing(mut report: Value) -> Value {
    report
        .as_object_mut()
        .unwrap()
        .insert("_exitCode".into(), json!(1));
    report
}
fn read_deck(path: &str) -> Result<Value, ArtifactError> {
    ooxml::run_ooxml("pptx", &["read".into(), "--input".into(), path.into()])
}
fn slides(deck: &Value) -> &[Value] {
    deck["slides"].as_array().map(Vec::as_slice).unwrap_or(&[])
}
fn objects(slide: &Value) -> &[Value] {
    slide["objects"]
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or(&[])
}
fn count(slide: &Value, kind: &str) -> usize {
    objects(slide)
        .iter()
        .filter(|object| object["kind"] == kind)
        .count()
}

fn inspect_template(flags: &[(String, Option<String>)]) -> Result<Value, ArtifactError> {
    allowed(flags, &["input", "output"])?;
    let source = input(required(flags, "input")?)?;
    let deck = read_deck(source.to_str().unwrap())?;
    let slides_report = slides(&deck).iter().enumerate().map(|(index, slide)| {
        let mut kinds = serde_json::Map::new(); let mut texts = Vec::new();
        for object in objects(slide) {
            let kind = object["kind"].as_str().unwrap_or("unknown");
            let item = kinds.entry(kind.to_owned()).or_insert(json!(0)); *item = json!(item.as_u64().unwrap_or(0) + 1);
            if kind == "table" { for row in object["rows"].as_array().into_iter().flatten() { for cell in row.as_array().into_iter().flatten() { if let Some(text) = cell.as_str().filter(|text| !text.trim().is_empty()) { texts.push(text.to_owned()); } } } }
            else if let Some(text) = object["text"].as_str().filter(|text| !text.trim().is_empty()) { texts.push(text.to_owned()); }
        }
        json!({"slide":index+1,"layout":slide["layout"],"shapeCount":objects(slide).len(),"shapeTypes":kinds,"text":texts,"chartCount":count(slide,"chart"),"tableCount":count(slide,"table")})
    }).collect::<Vec<_>>();
    let size = &deck["slideSize"];
    let report = json!({"input":source,"slideCount":slides_report.len(),"slideSizeEmu":{"width":(size["width"].as_f64().unwrap_or(0.0)*9525.0).round() as u64,"height":(size["height"].as_f64().unwrap_or(0.0)*9525.0).round() as u64},"slides":slides_report});
    report_file(flags, "output", &report)?;
    Ok(report)
}

fn validate_template_plan(flags: &[(String, Option<String>)]) -> Result<Value, ArtifactError> {
    allowed(flags, &["input", "plan", "output"])?;
    let source = input(required(flags, "input")?)?;
    let plan_path = input(required(flags, "plan")?)?;
    let deck = read_deck(source.to_str().unwrap())?;
    let plan: Value =
        serde_json::from_slice(&fs::read(plan_path).map_err(io_error)?).map_err(json_error)?;
    let mut errors = Vec::new();
    let items = plan["slides"].as_array();
    if items.is_none() {
        errors.push("plan must contain a slides array".to_owned());
    }
    let items = items.map(Vec::as_slice).unwrap_or(&[]);
    let mut outputs = HashSet::new();
    let source_count = slides(&deck).len();
    let actions = ["reuse", "adapt", "rebuild", "new", "omit"];
    for (index, item) in items.iter().enumerate() {
        let prefix = format!("slides[{index}]");
        if !item.is_object() {
            errors.push(format!("{prefix} must be an object"));
            continue;
        }
        let action = item["action"].as_str();
        if !action.is_some_and(|a| actions.contains(&a)) {
            errors.push(format!(
                "{prefix}.action must be one of adapt, new, omit, rebuild, reuse"
            ));
        }
        let output = item["outputSlide"].as_u64();
        if action == Some("omit") {
            if item.get("outputSlide").is_some() {
                errors.push(format!(
                    "{prefix}.outputSlide must be omitted when action is omit"
                ));
            }
        } else if output.is_none_or(|n| n == 0) {
            errors.push(format!(
                "{prefix}.outputSlide must be a positive 1-based slide number"
            ));
        } else if !outputs.insert(output.unwrap()) {
            errors.push(format!(
                "{prefix}.outputSlide {} is duplicated",
                output.unwrap()
            ));
        }
        let src = item["sourceSlide"].as_u64();
        let needs = matches!(action, Some("reuse" | "adapt" | "omit"));
        if needs && src.is_none_or(|n| n == 0 || n as usize > source_count) {
            errors.push(format!(
                "{prefix}.sourceSlide must reference a source slide from 1 to {source_count}"
            ));
        } else if !needs
            && item.get("sourceSlide").is_some()
            && src.is_none_or(|n| n == 0 || n as usize > source_count)
        {
            errors.push(format!("{prefix}.sourceSlide must be omitted or reference a source slide from 1 to {source_count}"));
        }
    }
    if let Some(max) = outputs.iter().max() {
        if outputs.len() != *max as usize {
            errors.push("outputSlide numbers must form a contiguous sequence from 1".into());
        }
    }
    let report = json!({"valid":errors.is_empty(),"sourceSlideCount":source_count,"planSlideCount":items.len(),"errors":errors});
    report_file(flags, "output", &report)?;
    if report["valid"] == false {
        Ok(failing(report))
    } else {
        Ok(report)
    }
}

fn check_template_fidelity(flags: &[(String, Option<String>)]) -> Result<Value, ArtifactError> {
    allowed(flags, &["source", "output", "output-json"])?;
    let source = input(required(flags, "source")?)?;
    let output = input(required(flags, "output")?)?;
    let before = read_deck(source.to_str().unwrap())?;
    let after = read_deck(output.to_str().unwrap())?;
    let a = slides(&before);
    let b = slides(&after);
    let mut details = Vec::new();
    for i in 0..a.len().max(b.len()) {
        let left = a.get(i);
        let right = b.get(i);
        let ac = left.map(|s| objects(s).len()).unwrap_or(0);
        let bc = right.map(|s| objects(s).len()).unwrap_or(0);
        let al = left.map(|s| s["layout"].clone()).unwrap_or(Value::Null);
        let bl = right.map(|s| s["layout"].clone()).unwrap_or(Value::Null);
        details.push(json!({"slide":i+1,"sourceShapeCount":ac,"outputShapeCount":bc,"shapeCountDelta":bc as i64-ac as i64,"sourceLayout":al,"outputLayout":bl,"layoutChanged":left.is_some()&&right.is_some()&&al!=bl}));
    }
    let report = json!({"source":source,"output":output,"sourceSlideCount":a.len(),"outputSlideCount":b.len(),"slideCountDelta":b.len() as i64-a.len() as i64,"slideSizeChanged":before["slideSize"]!=after["slideSize"],"slides":details,"note":"Structural signals only; this report does not establish visual identity or full PowerPoint fidelity."});
    report_file(flags, "output-json", &report)?;
    Ok(report)
}

fn inspect_package_integrity(flags: &[(String, Option<String>)]) -> Result<Value, ArtifactError> {
    allowed(flags, &["input"])?;
    let path = input(required(flags, "input")?)?;
    let file = fs::File::open(&path).map_err(io_error)?;
    let mut zip = zip::ZipArchive::new(file)
        .map_err(|e| ArtifactError::new("invalid_ooxml_package", e.to_string()))?;
    let names = (0..zip.len())
        .filter_map(|i| zip.by_index(i).ok().map(|f| f.name().to_owned()))
        .collect::<HashSet<_>>();
    let required = [
        "[Content_Types].xml",
        "_rels/.rels",
        "ppt/presentation.xml",
        "ppt/_rels/presentation.xml.rels",
    ];
    let missing = required
        .iter()
        .filter(|name| !names.contains(**name))
        .map(|s| s.to_string())
        .collect::<Vec<_>>();
    let mut corrupt = None;
    let mut broken = Vec::new();
    let mut malformed = Vec::new();
    for i in 0..zip.len() {
        let Ok(mut entry) = zip.by_index(i) else {
            continue;
        };
        let name = entry.name().to_owned();
        let mut bytes = Vec::new();
        if entry.read_to_end(&mut bytes).is_err() {
            corrupt = Some(name.clone());
            break;
        }
        if !name.ends_with(".rels") {
            continue;
        }
        let xml = String::from_utf8_lossy(&bytes);
        if !is_well_formed_xml(&xml) {
            malformed.push(name.clone());
            continue;
        }
        let base = if name == "_rels/.rels" {
            String::new()
        } else if let Some((dir, _)) = name.split_once("/_rels/") {
            format!("{dir}/")
        } else {
            malformed.push(name.clone());
            continue;
        };
        for rel in ruxex_artifact_common::ooxml::elements(&xml, "Relationship") {
            if rel.get("TargetMode").is_some_and(|m| m == "External") {
                continue;
            }
            let target = rel.get("Target").cloned().unwrap_or_default();
            if target.is_empty() {
                broken.push(json!({"relationshipFile":name,"target":""}));
                continue;
            }
            let resolved = normalize_target(&base, &target);
            if !names.contains(&resolved) {
                broken.push(json!({"relationshipFile":name,"target":target}));
            }
        }
    }
    let report = json!({"valid":missing.is_empty()&&corrupt.is_none()&&broken.is_empty()&&malformed.is_empty(),"input":path,"missingRequiredParts":missing,"corruptZipEntry":corrupt,"brokenRelationships":broken,"malformedRelationshipFiles":malformed});
    if !report["valid"].as_bool().unwrap_or(false) {
        Ok(failing(report))
    } else {
        Ok(report)
    }
}
fn normalize_target(base: &str, target: &str) -> String {
    let raw = if target.starts_with('/') {
        target.trim_start_matches('/').to_owned()
    } else {
        format!("{base}{target}")
    };
    let mut parts = Vec::new();
    for part in raw.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                parts.pop();
            }
            v => parts.push(v),
        }
    }
    parts.join("/")
}

fn is_well_formed_xml(xml: &str) -> bool {
    let mut stack = Vec::<String>::new();
    let mut roots = 0usize;
    let mut cursor = 0usize;
    while let Some(relative) = xml[cursor..].find('<') {
        let start = cursor + relative;
        if xml[start..].starts_with("<!--") {
            let Some(end) = xml[start + 4..].find("-->") else {
                return false;
            };
            cursor = start + 4 + end + 3;
            continue;
        }
        if xml[start..].starts_with("<![CDATA[") {
            let Some(end) = xml[start + 9..].find("]]>") else {
                return false;
            };
            cursor = start + 9 + end + 3;
            continue;
        }
        let Some(relative_end) = xml[start..].find('>') else {
            return false;
        };
        let end = start + relative_end;
        let token = xml[start + 1..end].trim();
        if token.starts_with('?') || token.starts_with('!') {
            cursor = end + 1;
            continue;
        }
        let closing = token.starts_with('/');
        let self_closing = token.ends_with('/');
        let name = token
            .trim_start_matches('/')
            .split_whitespace()
            .next()
            .unwrap_or("")
            .trim_end_matches('/');
        if name.is_empty() {
            return false;
        }
        if closing {
            if stack.pop().as_deref() != Some(name) {
                return false;
            }
        } else if !self_closing {
            if stack.is_empty() {
                roots += 1;
            }
            stack.push(name.to_owned());
        } else if stack.is_empty() {
            roots += 1;
        }
        cursor = end + 1;
    }
    stack.is_empty() && roots == 1
}

fn inspect_layout_geometry(flags: &[(String, Option<String>)]) -> Result<Value, ArtifactError> {
    allowed(flags, &["input", "fail-on-overflow", "include-overlaps"])?;
    let source = required(flags, "input")?;
    let path = input(source)?;
    let deck = read_deck(source)?;
    let w = deck["slideSize"]["width"].as_f64().unwrap_or(0.0) * 9525.0;
    let h = deck["slideSize"]["height"].as_f64().unwrap_or(0.0) * 9525.0;
    let mut out = Vec::new();
    let mut overlaps = Vec::new();
    for (si, slide) in slides(&deck).iter().enumerate() {
        let mut visible = Vec::new();
        for (oi, obj) in objects(slide).iter().enumerate() {
            let opt = &obj["options"];
            let x = opt["x"].as_f64().unwrap_or(0.0) * 9525.0;
            let y = opt["y"].as_f64().unwrap_or(0.0) * 9525.0;
            let sw = opt["w"].as_f64().unwrap_or(0.0) * 9525.0;
            let sh = opt["h"].as_f64().unwrap_or(0.0) * 9525.0;
            let shape_name = obj["name"]
                .as_str()
                .or_else(|| opt["name"].as_str())
                .unwrap_or("");
            let b = [x, y, x + sw, y + sh];
            if x < 0.0 || y < 0.0 || x + sw > w || y + sh > h {
                out.push(json!({"slide":si+1,"shape":oi,"name":shape_name,"boundsEmu":b}));
            }
            if sw > 0.0 && sh > 0.0 {
                visible.push((oi, obj, b));
            }
        }
        if present(flags, "include-overlaps") {
            for i in 0..visible.len() {
                for j in i + 1..visible.len() {
                    let a = visible[i].2;
                    let b = visible[j].2;
                    let iw = a[2].min(b[2]) - a[0].max(b[0]);
                    let ih = a[3].min(b[3]) - a[1].max(b[1]);
                    if iw > 0.0 && ih > 0.0 {
                        let first_name = visible[i].1["name"]
                            .as_str()
                            .or_else(|| visible[i].1["options"]["name"].as_str())
                            .unwrap_or("");
                        let second_name = visible[j].1["name"]
                            .as_str()
                            .or_else(|| visible[j].1["options"]["name"].as_str())
                            .unwrap_or("");
                        overlaps.push(json!({"slide":si+1,"firstShape":visible[i].0,"firstName":first_name,"secondShape":visible[j].0,"secondName":second_name,"intersectionEmu":[iw,ih]}));
                    }
                }
            }
        }
    }
    let report = json!({"input":path,"slideCount":slides(&deck).len(),"slideSizeEmu":{"width":w,"height":h},"outOfBoundsCount":out.len(),"outOfBounds":out,"overlapCount":overlaps.len(),"overlaps":overlaps,"note":"Overlaps may be intentional; they are reported only when --include-overlaps is set."});
    if present(flags, "fail-on-overflow") && report["outOfBoundsCount"].as_u64().unwrap_or(0) > 0 {
        Ok(failing(report))
    } else {
        Ok(report)
    }
}

fn chart_title_gate(flags: &[(String, Option<String>)]) -> Result<Value, ArtifactError> {
    allowed(flags, &["input", "contracts"])?;
    let deck = read_deck(required(flags, "input")?)?;
    let p = input(required(flags, "contracts")?)?;
    let c: Value = serde_json::from_slice(&fs::read(p).map_err(io_error)?).map_err(json_error)?;
    let req = c["requiredTitles"].as_array().ok_or_else(|| {
        ArtifactError::new(
            "invalid_arguments",
            "contracts must contain a requiredTitles array",
        )
    })?;
    let mut errors = Vec::new();
    for item in req {
        let Some(sn) = item["slide"].as_u64() else {
            errors.push("each requiredTitles entry must contain a 1-based slide number".into());
            continue;
        };
        if sn == 0 || sn as usize > slides(&deck).len() {
            errors.push(format!("slide {sn} is outside the deck"));
            continue;
        }
        let charts = objects(&slides(&deck)[sn as usize - 1])
            .iter()
            .filter(|o| o["kind"] == "chart")
            .collect::<Vec<_>>();
        if item.get("chart").is_some() && item["chart"].as_u64().is_none() {
            errors.push(format!(
                "slide {sn} chart index must be a non-negative integer"
            ));
            continue;
        }
        let indexes = if let Some(i) = item["chart"].as_u64() {
            vec![i as usize]
        } else {
            (0..charts.len()).collect()
        };
        if indexes.is_empty() {
            errors.push(format!(
                "slide {sn} has no native chart for a required title"
            ));
            continue;
        }
        for i in indexes {
            if i >= charts.len() {
                errors.push(format!("slide {sn} chart {i} is outside the chart list"));
            } else if charts[i]["options"]["title"]
                .as_str()
                .unwrap_or("")
                .trim()
                .is_empty()
            {
                errors.push(format!("slide {sn} chart {i} has no title"));
            }
        }
    }
    let report = json!({"valid":errors.is_empty(),"checkedRequirements":req.len(),"errors":errors});
    if !report["valid"].as_bool().unwrap_or(false) {
        Ok(failing(report))
    } else {
        Ok(report)
    }
}
fn quantitative_chart_gate(flags: &[(String, Option<String>)]) -> Result<Value, ArtifactError> {
    allowed(flags, &["input", "contracts"])?;
    let deck = read_deck(required(flags, "input")?)?;
    let p = input(required(flags, "contracts")?)?;
    let c: Value = serde_json::from_slice(&fs::read(p).map_err(io_error)?).map_err(json_error)?;
    let defs = c["charts"].as_array().ok_or_else(|| {
        ArtifactError::new("invalid_arguments", "contracts must contain a charts array")
    })?;
    let mut errors = Vec::new();
    let mut results = Vec::new();
    for (i, d) in defs.iter().enumerate() {
        let label = format!("charts[{i}]");
        if !d.is_object() {
            errors.push(format!("{label} must be an object"));
            continue;
        }
        let Some(sn) = d["slide"].as_u64() else {
            errors.push(format!(
                "{label} requires integer 1-based slide and zero-based chart indexes"
            ));
            continue;
        };
        if d.get("chart").is_some() && d["chart"].as_u64().is_none() {
            errors.push(format!(
                "{label} requires integer 1-based slide and zero-based chart indexes"
            ));
            continue;
        }
        let ci = d["chart"].as_u64().unwrap_or(0);
        if sn == 0 || sn as usize > slides(&deck).len() {
            errors.push(format!("{label} slide {sn} is outside the deck"));
            continue;
        }
        let charts = objects(&slides(&deck)[sn as usize - 1])
            .iter()
            .filter(|o| o["kind"] == "chart")
            .collect::<Vec<_>>();
        if ci as usize >= charts.len() {
            errors.push(format!("{label} chart {ci} is outside slide {sn}"));
            continue;
        }
        let series = charts[ci as usize]["series"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        let counts = series
            .iter()
            .map(|s| s["values"].as_array().map(Vec::len).unwrap_or(0))
            .collect::<Vec<_>>();
        let min = d["minPointsPerSeries"].as_u64().unwrap_or(1);
        if min == 0
            || (d.get("minPointsPerSeries").is_some() && d["minPointsPerSeries"].as_u64().is_none())
        {
            errors.push(format!(
                "{label}.minPointsPerSeries must be a positive integer"
            ));
            continue;
        }
        let expected = d["seriesCount"].as_u64();
        if d.get("seriesCount").is_some() && expected.is_none_or(|count| count == 0) {
            errors.push(format!("{label}.seriesCount must be a positive integer"));
            continue;
        }
        let pass = !series.is_empty()
            && expected.is_none_or(|n| n as usize == series.len())
            && counts.iter().all(|n| *n >= min as usize);
        results.push(json!({"check":i,"slide":sn,"chart":ci,"seriesCount":series.len(),"pointCounts":counts,"status":if pass{"pass"}else{"fail"}}));
        if !pass {
            errors.push(format!("{label} found {} series with point counts {:?}; expected {} series and at least {min} points per series",series.len(),counts,expected.map(|n|n.to_string()).unwrap_or("any".into())));
        }
    }
    let report = json!({"valid":errors.is_empty(),"results":results,"errors":errors});
    if !report["valid"].as_bool().unwrap_or(false) {
        Ok(failing(report))
    } else {
        Ok(report)
    }
}
fn table_arithmetic_gate(flags: &[(String, Option<String>)]) -> Result<Value, ArtifactError> {
    allowed(flags, &["input", "contracts"])?;
    let deck = read_deck(required(flags, "input")?)?;
    let p = input(required(flags, "contracts")?)?;
    let c: Value = serde_json::from_slice(&fs::read(p).map_err(io_error)?).map_err(json_error)?;
    let checks = c["checks"].as_array().ok_or_else(|| {
        ArtifactError::new("invalid_arguments", "contracts must contain a checks array")
    })?;
    let mut errors = Vec::new();
    let mut results = Vec::new();
    for (i, ch) in checks.iter().enumerate() {
        let label = format!("checks[{i}]");
        if !ch.is_object() {
            errors.push(format!("{label} must be an object"));
            continue;
        }
        let nums = ["slide", "table", "row", "column"].map(|k| ch[k].as_u64());
        if nums.iter().any(Option::is_none) || ch["sumRows"].as_array().is_none_or(Vec::is_empty) {
            errors.push(format!(
                "{label} requires integer slide/table/row/column and a non-empty sumRows array"
            ));
            continue;
        }
        if ch["sumRows"]
            .as_array()
            .is_some_and(|rows| rows.iter().any(|row| row.as_u64().is_none()))
        {
            errors.push(format!(
                "{label} requires integer slide/table/row/column and a non-empty sumRows array"
            ));
            continue;
        }
        let [Some(sn), Some(ti), Some(row), Some(col)] = nums else {
            continue;
        };
        if sn == 0 || sn as usize > slides(&deck).len() {
            errors.push(format!("{label} slide {sn} is outside the deck"));
            continue;
        }
        let tables = objects(&slides(&deck)[sn as usize - 1])
            .iter()
            .filter(|o| o["kind"] == "table")
            .collect::<Vec<_>>();
        if ti as usize >= tables.len() {
            errors.push(format!("{label} table index {ti} is outside slide {sn}"));
            continue;
        }
        let rows = tables[ti as usize]["rows"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        let indexes = std::iter::once(row)
            .chain(
                ch["sumRows"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .filter_map(Value::as_u64),
            )
            .collect::<Vec<_>>();
        if indexes.iter().any(|n| *n as usize >= rows.len())
            || col as usize
                >= rows
                    .first()
                    .and_then(Value::as_array)
                    .map(Vec::len)
                    .unwrap_or(0)
        {
            errors.push(format!("{label} row or column index is outside the table"));
            continue;
        }
        let vals = indexes
            .iter()
            .map(|n| parse_number(rows[*n as usize][col as usize].as_str().unwrap_or("")))
            .collect::<Vec<_>>();
        if vals.iter().any(Option::is_none) {
            results.push(json!({"check":i,"status":"skipped","reason":"blank or non-numeric displayed cells are not treated as zero"}));
            continue;
        }
        let v = vals.into_iter().flatten().collect::<Vec<_>>();
        let Some(sum) = v
            .iter()
            .skip(1)
            .try_fold(ExactDecimal::zero(), |sum, item| sum.add(*item))
        else {
            errors.push(format!("{label} displayed values exceed the numeric range"));
            continue;
        };
        let tolerance_value = ch.get("tolerance");
        if tolerance_value.is_some_and(|value| !value.is_number()) {
            errors.push(format!("{label} tolerance must be numeric"));
            continue;
        }
        let tol = tolerance_value
            .and_then(|value| parse_number(&value.to_string()))
            .unwrap_or_else(ExactDecimal::zero);
        if tol.coefficient < 0 {
            errors.push(format!(
                "{label} tolerance must be a finite non-negative number"
            ));
            continue;
        }
        let Some(pass) = v[0].within(sum, tol) else {
            errors.push(format!("{label} displayed values exceed the numeric range"));
            continue;
        };
        results.push(json!({"check":i,"status":if pass{"pass"}else{"fail"},"actual":v[0].to_string(),"sum":sum.to_string(),"tolerance":tol.to_string()}));
        if !pass {
            errors.push(format!(
                "{label} displayed total {} differs from displayed sum {}",
                v[0], sum
            ));
        }
    }
    let report = json!({"valid":errors.is_empty(),"results":results,"errors":errors});
    if !report["valid"].as_bool().unwrap_or(false) {
        Ok(failing(report))
    } else {
        Ok(report)
    }
}
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct ExactDecimal {
    coefficient: i128,
    scale: u32,
}

impl ExactDecimal {
    fn zero() -> Self {
        Self {
            coefficient: 0,
            scale: 0,
        }
    }

    fn factor(scale: u32) -> Option<i128> {
        10_i128.checked_pow(scale)
    }

    fn at_scale(self, scale: u32) -> Option<i128> {
        self.coefficient
            .checked_mul(Self::factor(scale.checked_sub(self.scale)?)?)
    }

    fn add(self, other: Self) -> Option<Self> {
        let scale = self.scale.max(other.scale);
        Some(Self {
            coefficient: self.at_scale(scale)?.checked_add(other.at_scale(scale)?)?,
            scale,
        })
    }

    fn within(self, other: Self, tolerance: Self) -> Option<bool> {
        let scale = self.scale.max(other.scale).max(tolerance.scale);
        let difference = self
            .at_scale(scale)?
            .checked_sub(other.at_scale(scale)?)?
            .unsigned_abs();
        let tolerance = tolerance.at_scale(scale)?.unsigned_abs();
        Some(difference <= tolerance)
    }
}

impl std::fmt::Display for ExactDecimal {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let negative = self.coefficient < 0;
        let digits = self.coefficient.unsigned_abs().to_string();
        if negative {
            formatter.write_str("-")?;
        }
        if self.scale == 0 {
            return formatter.write_str(&digits);
        }
        let scale = self.scale as usize;
        if digits.len() <= scale {
            formatter.write_str("0.")?;
            for _ in 0..scale - digits.len() {
                formatter.write_str("0")?;
            }
            formatter.write_str(&digits)
        } else {
            let split = digits.len() - scale;
            formatter.write_str(&digits[..split])?;
            formatter.write_str(".")?;
            formatter.write_str(&digits[split..])
        }
    }
}

fn parse_number(value: &str) -> Option<ExactDecimal> {
    let mut raw = value.trim().replace([',', '$', '¥', '€'], "");
    if raw.is_empty() || matches!(raw.as_str(), "-" | "—" | "–") {
        return None;
    }
    if raw.starts_with('(') && raw.ends_with(')') {
        raw = format!("-{}", &raw[1..raw.len() - 1]);
    }
    if raw.ends_with('%') {
        raw.pop();
    }
    let (negative, raw) = raw
        .strip_prefix('-')
        .map_or((false, raw.as_str()), |rest| (true, rest));
    let raw = raw.strip_prefix('+').unwrap_or(raw);
    let (whole, fraction) = raw.split_once('.').unwrap_or((raw, ""));
    if whole.is_empty() && fraction.is_empty()
        || !whole.chars().all(|c| c.is_ascii_digit())
        || !fraction.chars().all(|c| c.is_ascii_digit())
    {
        return None;
    }
    let scale = u32::try_from(fraction.len()).ok()?;
    if scale > 38 {
        return None;
    }
    let digits = format!("{}{}", if whole.is_empty() { "0" } else { whole }, fraction);
    let mut coefficient = digits.parse::<i128>().ok()?;
    if negative {
        coefficient = coefficient.checked_neg()?;
    }
    Some(ExactDecimal { coefficient, scale })
}

fn prepare_starter(flags: &[(String, Option<String>)]) -> Result<Value, ArtifactError> {
    allowed(flags, &["input", "output", "remove-placeholders"])?;
    let source = input(required(flags, "input")?)?;
    let output = PathBuf::from(required(flags, "output")?);
    if !output.is_absolute() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--output must be absolute",
        ));
    }
    if output.exists() {
        return Err(ArtifactError::new(
            "output_exists",
            format!("refusing to overwrite existing file: {}", output.display()),
        ));
    }
    if source == output {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--input and --output must be different files",
        ));
    }
    let mut archive = zip::ZipArchive::new(fs::File::open(&source).map_err(io_error)?)
        .map_err(|e| ArtifactError::new("invalid_ooxml_package", e.to_string()))?;
    let mut entries = Vec::new();
    let mut slides_count = 0;
    let mut removed = 0;
    let mut preserved = 0;
    let mut cleared = 0;
    let mut notes = 0;
    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| ArtifactError::new("invalid_ooxml_package", e.to_string()))?;
        let name = entry.name().to_owned();
        let mut bytes = Vec::new();
        entry.read_to_end(&mut bytes).map_err(io_error)?;
        if name.starts_with("ppt/slides/slide") && name.ends_with(".xml") {
            slides_count += 1;
            let xml = String::from_utf8(bytes)
                .map_err(|e| ArtifactError::new("invalid_ooxml_xml", e.to_string()))?;
            let (result, r, p, c) = clear_slide_xml(&xml, present(flags, "remove-placeholders"));
            bytes = result.into_bytes();
            removed += r;
            preserved += p;
            cleared += c;
        } else if name.starts_with("ppt/notesSlides/notesSlide") && name.ends_with(".xml") {
            let xml = String::from_utf8(bytes)
                .map_err(|e| ArtifactError::new("invalid_ooxml_xml", e.to_string()))?;
            let result = clear_notes_xml(&xml);
            if result != xml {
                notes += 1;
            }
            bytes = result.into_bytes();
        }
        entries.push((name, bytes));
    }
    let parent = output.parent().ok_or_else(|| {
        ArtifactError::new("invalid_arguments", "--output must have a parent directory")
    })?;
    fs::create_dir_all(parent).map_err(io_error)?;
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temp = parent.join(format!(
        ".ruxex-pptx-starter-{}-{suffix}.tmp",
        std::process::id()
    ));
    let result = (|| {
        let file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)
            .map_err(io_error)?;
        let mut writer = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default();
        for (name, data) in entries {
            writer
                .start_file(name, options)
                .map_err(|e| ArtifactError::new("zip_write_error", e.to_string()))?;
            writer.write_all(&data).map_err(io_error)?;
        }
        writer
            .finish()
            .map_err(|e| ArtifactError::new("zip_write_error", e.to_string()))?;
        if output.exists() {
            return Err(ArtifactError::new(
                "output_exists",
                format!("refusing to overwrite existing file: {}", output.display()),
            ));
        }
        fs::rename(&temp, &output).map_err(io_error)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result?;
    Ok(
        json!({"input":source,"output":output,"slideCount":slides_count,"removedShapeCount":removed,"preservedPlaceholderCount":preserved,"clearedPlaceholderTextCount":cleared,"clearedSpeakerNotesCount":notes}),
    )
}

fn clear_slide_xml(xml: &str, remove_placeholders: bool) -> (String, usize, usize, usize) {
    let Some(start) = xml.find("<p:spTree") else {
        return (xml.to_owned(), 0, 0, 0);
    };
    let Some(open) = xml[start..].find('>') else {
        return (xml.to_owned(), 0, 0, 0);
    };
    let content_start = start + open + 1;
    let Some(rel_end) = xml[content_start..].find("</p:spTree>") else {
        return (xml.to_owned(), 0, 0, 0);
    };
    let content_end = content_start + rel_end;
    let inner = &xml[content_start..content_end];
    let children = top_level_elements(inner);
    let mut result = String::new();
    let mut cursor = 0;
    let (mut removed, mut preserved, mut cleared) = (0, 0, 0);
    for (a, b, tag) in children {
        result.push_str(&inner[cursor..a]);
        let element = &inner[a..b];
        if matches!(tag.as_str(), "p:nvGrpSpPr" | "p:grpSpPr") {
            result.push_str(element);
        } else if matches!(
            tag.as_str(),
            "p:sp" | "p:graphicFrame" | "p:pic" | "p:cxnSp"
        ) {
            let placeholder = element.contains("<p:ph");
            let visual = element.contains("<a:tbl")
                || element.contains("<c:chart")
                || tag == "p:pic"
                || element.contains("type=\"pic\"");
            if placeholder && !remove_placeholders && !visual {
                let clean = clear_text_elements(element);
                if clean != element {
                    cleared += 1;
                }
                preserved += 1;
                result.push_str(&clean);
            } else {
                removed += 1;
            }
        } else {
            result.push_str(element);
        }
        cursor = b;
    }
    result.push_str(&inner[cursor..]);
    let mut full = String::new();
    full.push_str(&xml[..content_start]);
    full.push_str(&result);
    full.push_str(&xml[content_end..]);
    (full, removed, preserved, cleared)
}
fn top_level_elements(xml: &str) -> Vec<(usize, usize, String)> {
    let bytes = xml.as_bytes();
    let mut cursor = 0;
    let mut depth = 0usize;
    let mut start = None;
    let mut name = String::new();
    let mut out = Vec::new();
    while cursor < bytes.len() {
        if bytes[cursor] != b'<' {
            cursor += 1;
            continue;
        }
        if xml[cursor..].starts_with("<!--") {
            if let Some(end) = xml[cursor + 4..].find("-->") {
                cursor += 4 + end + 3;
                continue;
            }
            break;
        }
        let Some(gt_rel) = xml[cursor..].find('>') else {
            break;
        };
        let gt = cursor + gt_rel;
        let raw = xml[cursor + 1..gt].trim();
        if raw.starts_with('?') || raw.starts_with('!') {
            cursor = gt + 1;
            continue;
        }
        let close = raw.starts_with('/');
        let self_close = raw.ends_with('/');
        let tag = raw
            .trim_start_matches('/')
            .split_whitespace()
            .next()
            .unwrap_or("")
            .trim_end_matches('/');
        if tag.is_empty() {
            cursor = gt + 1;
            continue;
        }
        if close {
            depth = depth.saturating_sub(1);
            if depth == 0 {
                if let Some(begin) = start.take() {
                    out.push((begin, gt + 1, name.clone()));
                }
            }
        } else if depth == 0 {
            start = Some(cursor);
            name = tag.to_owned();
            if self_close {
                out.push((cursor, gt + 1, name.clone()));
                start = None;
            } else {
                depth = 1;
            }
        } else if !self_close {
            depth += 1;
        }
        cursor = gt + 1;
    }
    out
}
fn clear_text_elements(xml: &str) -> String {
    let mut result = String::new();
    let mut cursor = 0;
    while let Some(rel) = xml[cursor..].find("<a:t>") {
        let start = cursor + rel;
        let Some(end_rel) = xml[start + 5..].find("</a:t>") else {
            break;
        };
        let end = start + 5 + end_rel;
        result.push_str(&xml[cursor..start + 5]);
        result.push_str(&xml[end..end + 6]);
        cursor = end + 6;
    }
    if cursor == 0 {
        return xml.to_owned();
    }
    result.push_str(&xml[cursor..]);
    result
}

fn clear_notes_xml(xml: &str) -> String {
    let Some(start) = xml.find("<p:spTree") else {
        return xml.to_owned();
    };
    let Some(open) = xml[start..].find('>') else {
        return xml.to_owned();
    };
    let content_start = start + open + 1;
    let Some(relative_end) = xml[content_start..].find("</p:spTree>") else {
        return xml.to_owned();
    };
    let content_end = content_start + relative_end;
    let inner = &xml[content_start..content_end];
    let mut result = String::new();
    let mut cursor = 0usize;
    let mut changed = false;
    for (a, b, tag) in top_level_elements(inner) {
        result.push_str(&inner[cursor..a]);
        let element = &inner[a..b];
        if tag == "p:sp" && (element.contains("type=\"body\"") || element.contains("type='body'")) {
            let cleared = clear_text_elements(element);
            changed |= cleared != element;
            result.push_str(&cleared);
        } else {
            result.push_str(element);
        }
        cursor = b;
    }
    if !changed {
        return xml.to_owned();
    }
    result.push_str(&inner[cursor..]);
    let mut output = String::new();
    output.push_str(&xml[..content_start]);
    output.push_str(&result);
    output.push_str(&xml[content_end..]);
    output
}

fn render_slides(flags: &[(String, Option<String>)]) -> Result<Value, ArtifactError> {
    allowed(flags, &["input", "output-dir", "dpi"])?;
    let source = input(required(flags, "input")?)?;
    let out = PathBuf::from(required(flags, "output-dir")?);
    if !out.is_absolute() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--output-dir must be absolute",
        ));
    }
    let dpi = value(flags, "dpi")
        .unwrap_or("144")
        .parse::<u32>()
        .map_err(|_| ArtifactError::new("invalid_arguments", "--dpi must be an integer"))?;
    if !(36..=600).contains(&dpi) {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--dpi must be between 36 and 600",
        ));
    }
    let (root, bin) = native_runtime_paths()?;
    if !root.is_absolute() || bin != root.join("bin/override") {
        return Err(ArtifactError::new(
            "runtime_invalid",
            "RUXEX_RUNTIME_BIN_DIR does not match RUXEX_RUNTIME_ROOT",
        ));
    }
    let soffice = bin.join(if cfg!(windows) {
        "soffice.exe"
    } else {
        "soffice"
    });
    let pdftoppm = bin.join(if cfg!(windows) {
        "pdftoppm.exe"
    } else {
        "pdftoppm"
    });
    if !soffice.is_file() || !pdftoppm.is_file() {
        return Err(ArtifactError::new(
            "runtime_missing",
            "packaged LibreOffice or Poppler executable is missing",
        ));
    }
    fs::create_dir_all(&out).map_err(io_error)?;
    if fs::read_dir(&out)
        .map_err(io_error)?
        .filter_map(Result::ok)
        .any(|e| {
            e.file_name().to_string_lossy().starts_with("slide-")
                && e.path().extension().is_some_and(|x| x == "png")
        })
    {
        return Err(ArtifactError::new(
            "output_exists",
            "--output-dir already contains slide-*.png files; choose an empty review directory",
        ));
    }
    let work = std::env::temp_dir().join(format!(
        "ruxex-pptx-render-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    ));
    fs::create_dir(&work).map_err(io_error)?;
    let profile = url::Url::from_directory_path(work.join("lo-profile")).map_err(|_| {
        ArtifactError::new(
            "runtime_error",
            "could not form the LibreOffice profile URL",
        )
    })?;
    let profile_uri = format!("-env:UserInstallation={profile}");
    let mut convert = Command::new(&soffice);
    convert
        .args([
            "--headless",
            profile_uri.as_str(),
            "--convert-to",
            "pdf",
            "--outdir",
        ])
        .arg(&work)
        .arg(&source);
    let converted = match run_bounded(&mut convert, Duration::from_secs(180)) {
        Ok(output) => output,
        Err(error) => {
            let _ = fs::remove_dir_all(&work);
            return Err(error);
        }
    };
    if !converted.status.success() {
        let _ = fs::remove_dir_all(&work);
        return Err(ArtifactError::new(
            "render_error",
            "packaged LibreOffice could not render the PPTX",
        ));
    }
    let pdf = work.join(format!(
        "{}.pdf",
        source
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("presentation")
    ));
    let prefix = work.join("slide");
    let mut rasterize = Command::new(&pdftoppm);
    rasterize
        .arg("-png")
        .arg("-r")
        .arg(dpi.to_string())
        .arg(&pdf)
        .arg(&prefix);
    let raster = match run_bounded(&mut rasterize, Duration::from_secs(180)) {
        Ok(output) => output,
        Err(error) => {
            let _ = fs::remove_dir_all(&work);
            return Err(error);
        }
    };
    if !raster.status.success() {
        let _ = fs::remove_dir_all(&work);
        return Err(ArtifactError::new(
            "render_error",
            "packaged Poppler could not rasterize the rendered pages",
        ));
    }
    let mut pages = fs::read_dir(&work)
        .map_err(io_error)?
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|s| s.to_str())
                .is_some_and(|n| n.starts_with("slide-") && n.ends_with(".png"))
        })
        .collect::<Vec<_>>();
    pages.sort_by_key(|p| {
        p.file_stem()
            .and_then(|s| s.to_str())
            .and_then(|s| s.rsplit('-').next())
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(u32::MAX)
    });
    if pages.is_empty() {
        let _ = fs::remove_dir_all(&work);
        return Err(ArtifactError::new(
            "render_error",
            "the renderer produced no slide images",
        ));
    }
    let mut outputs = Vec::new();
    for (i, page) in pages.iter().enumerate() {
        let destination = out.join(format!("slide-{:03}.png", i + 1));
        fs::copy(page, &destination).map_err(io_error)?;
        outputs.push(destination);
    }
    let _ = fs::remove_dir_all(work);
    Ok(json!({"input":source,"outputDir":out,"slideCount":outputs.len(),"slides":outputs}))
}

fn run_bounded(command: &mut Command, timeout: Duration) -> Result<Output, ArtifactError> {
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command.spawn().map_err(io_error)?;
    let stdout = child.stdout.take().expect("piped stdout is available");
    let stderr = child.stderr.take().expect("piped stderr is available");
    let stdout_reader = thread::spawn(move || {
        let mut bytes = Vec::new();
        let _ = std::io::Read::read_to_end(&mut std::io::BufReader::new(stdout), &mut bytes);
        bytes
    });
    let stderr_reader = thread::spawn(move || {
        let mut bytes = Vec::new();
        let _ = std::io::Read::read_to_end(&mut std::io::BufReader::new(stderr), &mut bytes);
        bytes
    });
    let started = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait().map_err(io_error)? {
            break status;
        }
        if started.elapsed() >= timeout {
            let _ = child.kill();
            let _ = child.wait();
            let _ = stdout_reader.join();
            let _ = stderr_reader.join();
            return Err(ArtifactError::new(
                "render_timeout",
                "presentation rendering exceeded the 180 second limit",
            ));
        }
        thread::sleep(Duration::from_millis(50));
    };
    Ok(Output {
        status,
        stdout: stdout_reader.join().unwrap_or_default(),
        stderr: stderr_reader.join().unwrap_or_default(),
    })
}

fn native_runtime_paths() -> Result<(PathBuf, PathBuf), ArtifactError> {
    match (
        std::env::var_os("RUXEX_RUNTIME_ROOT"),
        std::env::var_os("RUXEX_RUNTIME_BIN_DIR"),
    ) {
        (Some(root), Some(bin)) => Ok((PathBuf::from(root), PathBuf::from(bin))),
        (None, None) => {
            let executable = std::env::current_exe().map_err(io_error)?;
            for ancestor in executable.ancestors() {
                if ancestor
                    .file_name()
                    .is_some_and(|name| name == "ruxex-resources")
                    && ancestor.join("runtime-manifest.json").is_file()
                {
                    return Ok((ancestor.to_path_buf(), ancestor.join("bin/override")));
                }
                let root = ancestor.join("ruxex-resources");
                if root.join("runtime-manifest.json").is_file() {
                    return Ok((root.clone(), root.join("bin/override")));
                }
            }
            Err(ArtifactError::new(
                "runtime_missing",
                "the packaged native runtime could not be located",
            ))
        }
        _ => Err(ArtifactError::new(
            "runtime_invalid",
            "RUXEX_RUNTIME_ROOT and RUXEX_RUNTIME_BIN_DIR must be set together",
        )),
    }
}

fn make_contact_sheet(flags: &[(String, Option<String>)]) -> Result<Value, ArtifactError> {
    allowed(flags, &["output", "image", "columns", "tile-width"])?;
    let out = PathBuf::from(required(flags, "output")?);
    if !out.is_absolute() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--output must be absolute",
        ));
    }
    if out.exists() {
        return Err(ArtifactError::new(
            "output_exists",
            format!("refusing to overwrite existing file: {}", out.display()),
        ));
    }
    let columns = value(flags, "columns")
        .unwrap_or("3")
        .parse::<u32>()
        .map_err(|_| {
            ArtifactError::new("invalid_arguments", "--columns must be a positive integer")
        })?;
    let width = value(flags, "tile-width")
        .unwrap_or("480")
        .parse::<u32>()
        .map_err(|_| ArtifactError::new("invalid_arguments", "--tile-width must be an integer"))?;
    if columns == 0 || width < 120 {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--columns must be positive and --tile-width at least 120",
        ));
    }
    let paths = values(flags, "image")
        .into_iter()
        .map(PathBuf::from)
        .collect::<Vec<_>>();
    if paths.is_empty() || paths.iter().any(|p| !p.is_absolute() || !p.is_file()) {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "all image paths must be existing absolute paths",
        ));
    }
    let mut images = Vec::new();
    for p in &paths {
        let im = image::open(p)
            .map_err(|e| {
                ArtifactError::new(
                    "image_read_error",
                    format!("could not read {}: {e}", p.display()),
                )
            })?
            .to_rgb8();
        images.push((
            p.file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            im,
        ));
    }
    let (fw, fh) = images[0].1.dimensions();
    let image_h = ((width as f64 * fh as f64 / fw.max(1) as f64).round() as u32).max(1);
    let tile_h = image_h + 34;
    let rows = (images.len() as u32).div_ceil(columns);
    let pad = 18;
    let mut sheet = RgbImage::from_pixel(
        pad + columns * (width + pad),
        pad + rows * (tile_h + pad),
        Rgb([231, 234, 240]),
    );
    for (i, (name, image)) in images.iter().enumerate() {
        let x = pad + (i as u32 % columns) * (width + pad);
        let y = pad + (i as u32 / columns) * (tile_h + pad);
        let resized = imageops::thumbnail(image, width, image_h);
        imageops::replace(
            &mut sheet,
            &resized,
            (x + (width - resized.width()) / 2) as i64,
            (y + (image_h - resized.height()) / 2) as i64,
        );
        draw_label(
            &mut sheet,
            x as i32,
            (y + image_h + 5) as i32,
            &name.chars().take(72).collect::<String>(),
        );
    }
    if let Some(parent) = out.parent() {
        fs::create_dir_all(parent).map_err(io_error)?;
    }
    sheet
        .save_with_format(&out, ImageFormat::Png)
        .map_err(|e| ArtifactError::new("image_write_error", e.to_string()))?;
    Ok(json!({"output":out,"imageCount":images.len()}))
}
fn draw_label(image: &mut RgbImage, x: i32, y: i32, text: &str) {
    for (i, ch) in text.to_ascii_uppercase().chars().enumerate().take(72) {
        for (row, bits) in glyph(ch).iter().enumerate() {
            for col in 0..5 {
                if bits & (1 << (4 - col)) != 0 {
                    let px = x + i as i32 * 6 + col;
                    let py = y + row as i32;
                    if px >= 0
                        && py >= 0
                        && (px as u32) < image.width()
                        && (py as u32) < image.height()
                    {
                        image.put_pixel(px as u32, py as u32, Rgb([32, 39, 51]));
                    }
                }
            }
        }
    }
}
fn glyph(c: char) -> [u8; 7] {
    match c {
        'A' => [14, 17, 17, 31, 17, 17, 17],
        'B' => [30, 17, 17, 30, 17, 17, 30],
        'C' => [14, 17, 16, 16, 16, 17, 14],
        'D' => [30, 17, 17, 17, 17, 17, 30],
        'E' => [31, 16, 16, 30, 16, 16, 31],
        'F' => [31, 16, 16, 30, 16, 16, 16],
        'G' => [14, 17, 16, 23, 17, 17, 15],
        'H' => [17, 17, 17, 31, 17, 17, 17],
        'I' => [14, 4, 4, 4, 4, 4, 14],
        'J' => [7, 2, 2, 2, 18, 18, 12],
        'K' => [17, 18, 20, 24, 20, 18, 17],
        'L' => [16, 16, 16, 16, 16, 16, 31],
        'M' => [17, 27, 21, 21, 17, 17, 17],
        'N' => [17, 25, 21, 19, 17, 17, 17],
        'O' => [14, 17, 17, 17, 17, 17, 14],
        'P' => [30, 17, 17, 30, 16, 16, 16],
        'Q' => [14, 17, 17, 17, 21, 18, 13],
        'R' => [30, 17, 17, 30, 20, 18, 17],
        'S' => [15, 16, 16, 14, 1, 1, 30],
        'T' => [31, 4, 4, 4, 4, 4, 4],
        'U' => [17, 17, 17, 17, 17, 17, 14],
        'V' => [17, 17, 17, 17, 17, 10, 4],
        'W' => [17, 17, 17, 21, 21, 21, 10],
        'X' => [17, 17, 10, 4, 10, 17, 17],
        'Y' => [17, 17, 10, 4, 4, 4, 4],
        'Z' => [31, 1, 2, 4, 8, 16, 31],
        '0' => [14, 17, 19, 21, 25, 17, 14],
        '1' => [4, 12, 4, 4, 4, 4, 14],
        '2' => [14, 17, 1, 2, 4, 8, 31],
        '3' => [30, 1, 1, 14, 1, 1, 30],
        '4' => [2, 6, 10, 18, 31, 2, 2],
        '5' => [31, 16, 16, 30, 1, 1, 30],
        '6' => [14, 16, 16, 30, 17, 17, 14],
        '7' => [31, 1, 2, 4, 8, 8, 8],
        '8' => [14, 17, 17, 14, 17, 17, 14],
        '9' => [14, 17, 17, 15, 1, 1, 14],
        '-' => [0, 0, 0, 31, 0, 0, 0],
        '_' => [0, 0, 0, 0, 0, 0, 31],
        '.' => [0, 0, 0, 0, 0, 12, 12],
        ' ' => [0; 7],
        _ => [0; 7],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn helper_catalog_lists_each_python_free_operation() {
        let value = run_helper(&["list".into()]).unwrap();
        assert_eq!(value["helpers"].as_array().unwrap().len(), 11);
        assert!(
            value["helpers"]
                .as_array()
                .unwrap()
                .iter()
                .all(|name| { name.as_str().is_some_and(|name| !name.ends_with(".py")) })
        );
    }

    #[test]
    fn helper_commands_require_their_documented_inputs() {
        for operation in HELPERS {
            let error = run_helper(&[(*operation).into()]).unwrap_err();
            assert_eq!(error.code, "invalid_arguments", "{operation}");
        }
    }

    #[test]
    fn template_plan_requires_an_existing_absolute_source() {
        let error = run_helper(&[
            "validate-template-plan".into(),
            "--input".into(),
            "relative.pptx".into(),
            "--plan".into(),
            "relative.json".into(),
        ])
        .unwrap_err();
        assert_eq!(error.code, "invalid_arguments");
        assert!(error.message.contains("existing absolute file path"));
    }

    #[test]
    fn table_number_parser_skips_blanks_and_handles_displayed_currencies() {
        assert_eq!(
            parse_number(" $1,250.50 ").map(|number| number.to_string()),
            Some("1250.50".into())
        );
        assert_eq!(
            parse_number("(€25.00)").map(|number| number.to_string()),
            Some("-25.00".into())
        );
        assert_eq!(parse_number("—"), None);
        assert_eq!(
            parse_number("15%").map(|number| number.to_string()),
            Some("15".into())
        );
        let sum = parse_number("0.1")
            .unwrap()
            .add(parse_number("0.2").unwrap())
            .unwrap();
        assert_eq!(sum.to_string(), "0.3");
    }

    #[test]
    fn relationship_xml_validator_rejects_unbalanced_and_multiple_roots() {
        assert!(is_well_formed_xml(
            "<Relationships><Relationship/></Relationships>"
        ));
        assert!(!is_well_formed_xml(
            "<Relationships><Relationship></Relationships>"
        ));
        assert!(!is_well_formed_xml("<Relationships/><Relationships/>"));
    }
}
