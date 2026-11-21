use base64::Engine;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::fs;
use std::io::Read;

use crate::ooxml;
pub use crate::ooxml::{blocks, elements, text_values};
use crate::{ArtifactError, cli};

pub fn run_ooxml(format: &str, args: &[String]) -> Result<Value, ArtifactError> {
    let Some(operation) = args.first().map(String::as_str) else {
        return Err(ArtifactError::new(
            "invalid_arguments",
            format!("a {format} operation is required"),
        ));
    };
    let flags = cli::parse_flags(&args[1..])?;
    for (flag, _) in &flags {
        if !matches!(flag.as_str(), "input" | "--json") {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    match operation {
        "read" => read_ooxml(format, cli::required_flag(&flags, "input")?),
        "validate" => inspect_ooxml(format, cli::required_flag(&flags, "input")?),
        "create" => Err(ArtifactError::new(
            "unsupported_operation",
            format!("{format} creation is available through `ruxex-artifacts run`"),
        )),
        _ => Err(ArtifactError::new(
            "invalid_arguments",
            format!("unknown {format} operation: {operation}"),
        )),
    }
}

pub fn inspect_ooxml(format: &str, input_path: &str) -> Result<Value, ArtifactError> {
    let file = fs::File::open(input_path).map_err(|error| {
        ArtifactError::new(
            "ooxml_read_error",
            format!("failed to read {input_path}: {error}"),
        )
    })?;
    let mut archive = zip::ZipArchive::new(file).map_err(|error| {
        ArtifactError::new(
            "ooxml_read_error",
            format!("failed to open {input_path} as a ZIP package: {error}"),
        )
    })?;
    let parts = (0..archive.len())
        .filter_map(|index| {
            archive
                .by_index(index)
                .ok()
                .map(|entry| entry.name().to_owned())
        })
        .collect::<Vec<_>>();
    let required = match format {
        "docx" => vec![
            "[Content_Types].xml",
            "_rels/.rels",
            "word/document.xml",
            "word/_rels/document.xml.rels",
            "word/styles.xml",
        ],
        "pptx" => vec![
            "[Content_Types].xml",
            "_rels/.rels",
            "ppt/presentation.xml",
            "ppt/_rels/presentation.xml.rels",
            "ppt/slides/slide1.xml",
        ],
        _ => {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unsupported OOXML format: {format}"),
            ));
        }
    };
    let missing = required
        .into_iter()
        .filter(|required_part| !parts.iter().any(|part| part == required_part))
        .collect::<Vec<_>>();
    if !missing.is_empty() {
        return Err(ArtifactError::new(
            "invalid_ooxml_package",
            format!(
                "{format} package is missing required parts: {}",
                missing.join(", ")
            ),
        ));
    }
    Ok(json!({
        "ok": true,
        "valid": true,
        "format": format,
        "parts": parts,
    }))
}

pub fn read_ooxml(format: &str, input_path: &str) -> Result<Value, ArtifactError> {
    let validation = inspect_ooxml(format, input_path)?;
    let file = fs::File::open(input_path).map_err(|error| {
        ArtifactError::new(
            "ooxml_read_error",
            format!("failed to read {input_path}: {error}"),
        )
    })?;
    let mut archive = zip::ZipArchive::new(file).map_err(|error| {
        ArtifactError::new(
            "ooxml_read_error",
            format!("failed to open {input_path} as a ZIP package: {error}"),
        )
    })?;
    if format == "docx" {
        let xml = read_ooxml_part(&mut archive, "word/document.xml")?;
        let items = docx_items(&xml);
        let mut diagnostics = Vec::new();
        if xml.contains("w:drawing") || xml.contains("a:blip") {
            diagnostics.push(json!({
                "code": "unsupported_images",
                "message": "document images are preserved as diagnostics and are not editable yet",
            }));
        }
        if xml.contains("w:hyperlink") || xml.contains("w:fldSimple") {
            diagnostics.push(json!({
                "code": "unsupported_fields",
                "message": "hyperlinks and fields are not editable yet",
            }));
        }
        let mut header_footer_count = 0;
        for index in 0..archive.len() {
            if archive.by_index(index).ok().is_some_and(|entry| {
                entry.name().starts_with("word/header") || entry.name().starts_with("word/footer")
            }) {
                header_footer_count += 1;
            }
        }
        if header_footer_count > 0 {
            diagnostics.push(json!({
                "code": "unsupported_headers_footers",
                "message": "headers and footers are readable only as loss diagnostics",
                "count": header_footer_count,
            }));
        }
        Ok(json!({
            "ok": true,
            "valid": true,
            "format": format,
            "parts": validation["parts"].clone(),
            "items": items,
            "diagnostics": diagnostics,
        }))
    } else {
        let mut slide_names = (0..archive.len())
            .filter_map(|index| {
                archive
                    .by_index(index)
                    .ok()
                    .map(|entry| entry.name().to_string())
            })
            .filter(|name| ooxml::slide_number(name).is_some())
            .collect::<Vec<_>>();
        slide_names.sort_by_key(|name| ooxml::slide_number(name).unwrap_or(usize::MAX));
        let presentation_xml = read_ooxml_part(&mut archive, "ppt/presentation.xml")?;
        let theme_xml = read_ooxml_part(&mut archive, "ppt/theme/theme1.xml").ok();
        let relationships_xml = read_ooxml_part(&mut archive, "ppt/_rels/presentation.xml.rels")?;
        let relationship_targets = ooxml::elements(&relationships_xml, "Relationship")
            .into_iter()
            .filter_map(|attributes| {
                Some((
                    attributes.get("Id")?.clone(),
                    attributes.get("Target")?.clone(),
                ))
            })
            .collect::<HashMap<_, _>>();
        let presentation_order = ooxml::attribute_values(&presentation_xml, "p:sldId", "r:id")
            .into_iter()
            .filter_map(|relationship_id| relationship_targets.get(&relationship_id))
            .map(|target| ooxml::normalize_target(target, "ppt"))
            .filter(|target| slide_names.contains(target))
            .collect::<Vec<_>>();
        if !presentation_order.is_empty() {
            slide_names = presentation_order;
        }
        let slide_size = ooxml::elements(&presentation_xml, "p:sldSz")
            .first()
            .and_then(|attributes| {
                Some(json!({
                    "width": attributes.get("cx")?.parse::<f64>().ok()? / 9525.0,
                    "height": attributes.get("cy")?.parse::<f64>().ok()? / 9525.0,
                }))
            });
        let theme = theme_xml.map(|xml| {
            let defaults = [
                ("accent1", "4472C4"),
                ("accent2", "ED7D31"),
                ("accent3", "A5A5A5"),
                ("accent4", "FFC000"),
                ("accent5", "5B9BD5"),
                ("accent6", "70AD47"),
                ("bg1", "FFFFFF"),
                ("bg2", "E7E6E6"),
                ("tx1", "000000"),
                ("tx2", "44546A"),
                ("dk1", "000000"),
                ("dk2", "44546A"),
                ("lt1", "FFFFFF"),
                ("lt2", "E7E6E6"),
                ("hlink", "0563C1"),
                ("folHlink", "954F72"),
            ];
            let mut colors = serde_json::Map::new();
            for (key, fallback) in defaults {
                let xml_key = match key {
                    "tx1" => "dk1",
                    "tx2" => "dk2",
                    "bg1" => "lt1",
                    "bg2" => "lt2",
                    _ => key,
                };
                let color =
                    if let Some(part) = ooxml::blocks(&xml, &format!("a:{xml_key}")).first() {
                        let srgb = ooxml::elements(part, "a:srgbClr")
                            .first()
                            .and_then(|attributes| attributes.get("val"))
                            .cloned();
                        srgb.or_else(|| {
                            ooxml::elements(part, "a:sysClr")
                                .first()
                                .and_then(|attributes| attributes.get("lastClr"))
                                .cloned()
                        })
                    } else {
                        None
                    }
                    .unwrap_or_else(|| fallback.to_owned());
                colors.insert(key.to_owned(), json!(format!("#{color}")));
            }
            let name = ooxml::elements(&xml, "a:clrScheme")
                .first()
                .and_then(|attributes| attributes.get("name"))
                .cloned()
                .unwrap_or_else(|| "Imported Theme".to_owned());
            let default_font = ooxml::blocks(&xml, "a:minorFont")
                .first()
                .and_then(|font| {
                    ooxml::elements(font, "a:latin")
                        .first()
                        .and_then(|attributes| attributes.get("typeface"))
                        .cloned()
                })
                .filter(|font| !font.is_empty())
                .unwrap_or_else(|| "Arial".to_owned());
            json!({"defaultFont":default_font,"colorScheme":{"name":name,"themeColors":colors}})
        });
        let mut slides = Vec::new();
        let mut diagnostics = Vec::new();
        let mut layouts = serde_json::Map::new();
        let slide_order = slide_names
            .iter()
            .enumerate()
            .filter_map(|(index, name)| {
                std::path::Path::new(name)
                    .file_name()
                    .and_then(|value| value.to_str())
                    .map(|file_name| (file_name.to_owned(), index as u64 + 1))
            })
            .collect::<HashMap<_, _>>();
        for (index, name) in slide_names.iter().enumerate() {
            let xml = read_ooxml_part(&mut archive, name)?;
            let slide_relationships = presentation_slide_relationships(&mut archive, name);
            let layout = presentation_imported_layout(&mut archive, &slide_relationships);
            if let Some(layout) = &layout {
                if let (Some(layout_name), Some(placeholders)) = (
                    layout.get("name").and_then(Value::as_str),
                    layout.get("placeholders"),
                ) {
                    layouts.insert(
                        layout_name.to_owned(),
                        json!({"id":layout.get("id"),"name":layout_name,"parentMasterId":layout.get("parentMasterId"),"master":layout.get("master"),"placeholders":placeholders,"masterObjects":layout.get("masterObjects").cloned().unwrap_or_else(|| json!([])),"layoutObjects":layout.get("layoutObjects").cloned().unwrap_or_else(|| json!([]))}),
                    );
                }
                if layout
                    .get("hasUnsupportedInheritedObjects")
                    .and_then(Value::as_bool)
                    == Some(true)
                {
                    diagnostics.push(json!({
                        "code": "unsupported_layout_content",
                        "message": format!("slide {} uses a PowerPoint layout with inherited artwork that is not editable in the local model", index + 1),
                        "slide": index + 1,
                    }));
                }
            }
            let image_objects = presentation_slide_images(&mut archive, name, &xml);
            let image_fill_sources =
                presentation_fill_image_sources(&mut archive, name, &xml, &slide_relationships);
            let supported_image_count = image_objects.len();
            let chart_objects = presentation_slide_charts(&mut archive, &xml, &slide_relationships);
            let supported_chart_count = chart_objects.len();
            let mut extra_objects = image_objects;
            extra_objects.extend(chart_objects);
            let image_count = ooxml::blocks(&xml, "p:pic").len();
            let custom_shape_count = ooxml::blocks(&xml, "p:sp")
                .into_iter()
                .filter(|shape| shape.contains("<a:custGeom"))
                .count();
            let supported_custom_shape_count = ooxml::blocks(&xml, "p:sp")
                .into_iter()
                .filter(|shape| !presentation_custom_paths(shape).is_empty())
                .count();
            let unsupported_custom_shape_count =
                custom_shape_count.saturating_sub(supported_custom_shape_count);
            if unsupported_custom_shape_count > 0 {
                diagnostics.push(json!({
                    "code": "unsupported_custom_geometry",
                    "message": format!("slide {} contains {} custom path shape(s) that are not editable after import", index + 1, unsupported_custom_shape_count),
                    "slide": index + 1,
                    "count": unsupported_custom_shape_count,
                }));
            }
            let objects = presentation_slide_objects(
                &xml,
                extra_objects,
                &slide_relationships,
                &slide_order,
                &image_fill_sources,
            );
            let notes = presentation_slide_notes(&mut archive, name);
            let table_frame_count = ooxml::blocks(&xml, "p:graphicFrame")
                .iter()
                .filter(|frame| frame.contains("<a:tbl"))
                .count();
            let unsupported_chart_count = xml
                .matches("<p:graphicFrame")
                .count()
                .saturating_sub(table_frame_count + supported_chart_count);
            if unsupported_chart_count > 0 {
                diagnostics.push(json!({
                    "code": "unsupported_slide_objects",
                    "message": format!("slide {} contains {} chart(s) that are preview-only", index + 1, unsupported_chart_count),
                    "slide": index + 1,
                    "count": unsupported_chart_count,
                }));
            }
            if image_count > supported_image_count {
                diagnostics.push(json!({
                    "code": "unsupported_images",
                    "message": format!("slide {} contains {} image(s) that could not be imported", index + 1, image_count - supported_image_count),
                    "slide": index + 1,
                    "count": image_count - supported_image_count,
                }));
            }
            let background = ooxml::blocks(&xml, "p:bg")
                .first()
                .and_then(|background| presentation_import_fill(background));
            slides.push(json!({"objects": objects, "notes": notes, "layout":layout.and_then(|value| value.get("name").cloned()),"background":{"fill":background.unwrap_or_else(|| json!("none"))}}));
        }
        Ok(json!({
            "ok": true,
            "valid": true,
            "format": format,
            "parts": validation["parts"].clone(),
            "slides": slides,
            "layouts": layouts.into_values().collect::<Vec<_>>(),
            "slideSize": slide_size.unwrap_or(json!({"width":1280,"height":720})),
            "theme": theme,
            "diagnostics": diagnostics,
        }))
    }
}

fn presentation_imported_layout<R: std::io::Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    relationships: &HashMap<String, (String, String)>,
) -> Option<Value> {
    let target = relationships
        .iter()
        .find_map(|(_, (target, target_mode))| {
            if target_mode == "External" || !target.contains("slideLayout") {
                return None;
            }
            Some(if target.starts_with('/') {
                target.trim_start_matches('/').to_owned()
            } else {
                ooxml::normalize_target(target, "ppt/slides")
            })
        })?;
    let layout_xml = read_ooxml_part(archive, &target).ok()?;
    let raw_name = ooxml::elements(&layout_xml, "p:cSld")
        .first()
        .and_then(|attributes| attributes.get("name"))
        .cloned()
        .unwrap_or_default();
    let name = if raw_name == "DEFAULT" || raw_name.trim().is_empty() {
        let index = std::path::Path::new(&target)
            .file_stem()
            .and_then(|value| value.to_str())
            .and_then(|value| value.strip_prefix("slideLayout"))
            .unwrap_or("1");
        format!("Imported Layout {index}")
    } else {
        raw_name
            .strip_prefix("RUXEX_LAYOUT - ")
            .unwrap_or(&raw_name)
            .to_owned()
    };
    let mut master_objects = Vec::new();
    let layout_relationships = presentation_slide_relationships(archive, &target);
    let mut master_info = None;
    if let Some(master_target) = layout_relationships.iter().find_map(|(_, (target, _))| {
        target.contains("slideMaster").then(|| {
            if target.starts_with('/') {
                target.trim_start_matches('/').to_owned()
            } else {
                ooxml::normalize_target(target, "ppt/slideLayouts")
            }
        })
    }) {
        if let Ok(master_xml) = read_ooxml_part(archive, &master_target) {
            let master_relationships = presentation_slide_relationships(archive, &master_target);
            let master_images = presentation_slide_images(archive, &master_target, &master_xml);
            let master_image_count = master_images.len();
            let master_fill_sources = presentation_fill_image_sources(
                archive,
                &master_target,
                &master_xml,
                &master_relationships,
            );
            master_objects.extend(presentation_slide_objects(
                &master_xml,
                master_images,
                &master_relationships,
                &HashMap::new(),
                &master_fill_sources,
            ));
            let master_raw_name = ooxml::elements(&master_xml, "p:cSld")
                .first()
                .and_then(|attributes| attributes.get("name"))
                .cloned()
                .unwrap_or_default();
            let master_name = if master_raw_name.trim().is_empty() {
                std::path::Path::new(&master_target)
                    .file_stem()
                    .and_then(|value| value.to_str())
                    .unwrap_or("Imported Master")
                    .to_owned()
            } else {
                master_raw_name
            };
            let mut color_map = serde_json::Map::new();
            if let Some(attributes) = ooxml::elements(&master_xml, "p:clrMap").first() {
                for key in [
                    "bg1", "tx1", "bg2", "tx2", "accent1", "accent2", "accent3", "accent4",
                    "accent5", "accent6", "hlink", "folHlink",
                ] {
                    if let Some(value) = attributes.get(key) {
                        color_map.insert(key.to_owned(), json!(value));
                    }
                }
            }
            let background = ooxml::blocks(&master_xml, "p:bg")
                .into_iter()
                .next()
                .and_then(|background| {
                    let scheme_color = ooxml::elements(&background, "a:schemeClr")
                        .into_iter()
                        .find_map(|attributes| attributes.get("val").cloned());
                    let rgb_color = ooxml::elements(&background, "a:srgbClr")
                        .into_iter()
                        .find_map(|attributes| attributes.get("val").cloned());
                    scheme_color
                        .map(|value| json!({"ref":value}))
                        .or_else(|| rgb_color.map(|value| json!({"ref":format!("#{value}")})))
                })
                .unwrap_or_else(|| json!({}));
            master_info = Some(json!({
                "id": format!("pptx-master/{master_target}"),
                "name": master_name,
                "colorMap": color_map,
                "background": background,
            }));
            if ooxml::blocks(&master_xml, "p:pic").len() > master_image_count
                || ooxml::blocks(&master_xml, "p:graphicFrame").len() > 0
                || ooxml::blocks(&master_xml, "p:grpSp").len() > 0
            {
                master_objects.push(json!({"kind":"unsupportedMasterContent"}));
            }
        }
    }
    let layout_images = presentation_slide_images(archive, &target, &layout_xml);
    let layout_image_count = layout_images.len();
    let layout_fill_sources =
        presentation_fill_image_sources(archive, &target, &layout_xml, &layout_relationships);
    let mut layout_objects = presentation_slide_objects(
        &layout_xml,
        layout_images,
        &layout_relationships,
        &HashMap::new(),
        &layout_fill_sources,
    );
    if ooxml::blocks(&layout_xml, "p:pic").len() > layout_image_count
        || ooxml::blocks(&layout_xml, "p:graphicFrame").len() > 0
        || ooxml::blocks(&layout_xml, "p:grpSp").len() > 0
    {
        layout_objects.push(json!({"kind":"unsupportedLayoutContent"}));
    }
    let is_supported_master_object = |object: &Value| {
        matches!(object.get("kind").and_then(Value::as_str), Some("text"))
            || object.get("kind").and_then(Value::as_str) == Some("image")
            || (object.get("kind").and_then(Value::as_str) == Some("shape")
                && matches!(
                    object.get("shape").and_then(Value::as_str),
                    Some("rect" | "line")
                ))
    };
    let has_unsupported_inherited_objects =
        master_objects.iter().chain(&layout_objects).any(|object| {
            object
                .get("options")
                .and_then(|options| options.get("placeholderType"))
                .is_none()
                && !is_supported_master_object(object)
        });
    let imported_master_objects = master_objects
        .iter()
        .filter(|object| {
            object
                .get("options")
                .and_then(|options| options.get("placeholderType"))
                .is_none()
                && is_supported_master_object(object)
        })
        .cloned()
        .collect::<Vec<_>>();
    let imported_layout_objects = layout_objects
        .iter()
        .filter(|object| {
            object
                .get("options")
                .and_then(|options| options.get("placeholderType"))
                .is_none()
                && is_supported_master_object(object)
        })
        .cloned()
        .collect::<Vec<_>>();
    let objects = master_objects
        .iter()
        .chain(&layout_objects)
        .cloned()
        .collect::<Vec<_>>();
    let mut placeholders: Vec<Value> = Vec::new();
    for object in &objects {
        let Some(options) = object.get("options") else {
            continue;
        };
        let Some(kind) = options.get("placeholderType").and_then(Value::as_str) else {
            continue;
        };
        let index = options
            .get("placeholderIndex")
            .and_then(Value::as_u64)
            .unwrap_or(0);
        let geometry = if object.get("kind").and_then(Value::as_str) == Some("shape") {
            object
                .get("shape")
                .and_then(Value::as_str)
                .unwrap_or("textbox")
        } else {
            "textbox"
        };
        let position = json!({
            "left": options.get("x").cloned().unwrap_or(json!(0)),
            "top": options.get("y").cloned().unwrap_or(json!(0)),
            "width": options.get("w").cloned().unwrap_or(json!(0)),
            "height": options.get("h").cloned().unwrap_or(json!(0)),
        });
        let mut style = serde_json::Map::new();
        if let Some(text_style) = options.get("textStyle").and_then(Value::as_object) {
            style.extend(
                text_style
                    .iter()
                    .map(|(key, value)| (key.clone(), value.clone())),
            );
        }
        for key in ["fill", "line", "shadow", "borderRadius"] {
            if let Some(value) = options.get(key) {
                style.insert(key.to_owned(), value.clone());
            }
        }
        let text = object.get("text").and_then(Value::as_str).unwrap_or("");
        let placeholder = json!({"type":kind,"index":index,"geometry":geometry,"position":position,"text":text,"style":style});
        if let Some(existing) = placeholders.iter_mut().find(|existing| {
            existing.get("type").and_then(Value::as_str) == Some(kind)
                && existing.get("index").and_then(Value::as_u64) == Some(index)
        }) {
            *existing = placeholder;
        } else {
            placeholders.push(placeholder);
        }
    }
    Some(
        json!({"id":format!("pptx-layout/{target}"),"name":name,"parentMasterId":master_info.as_ref().and_then(|master| master.get("id")).cloned(),"master":master_info,"placeholders":placeholders,"masterObjects":imported_master_objects,"layoutObjects":imported_layout_objects,"hasUnsupportedInheritedObjects":has_unsupported_inherited_objects}),
    )
}

fn presentation_slide_images<R: std::io::Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    slide_part: &str,
    slide_xml: &str,
) -> Vec<(usize, Value)> {
    let Some(file_name) = std::path::Path::new(slide_part)
        .file_name()
        .and_then(|value| value.to_str())
    else {
        return Vec::new();
    };
    let parent = std::path::Path::new(slide_part)
        .parent()
        .and_then(|value| value.to_str())
        .unwrap_or("ppt/slides");
    let relationships_part = format!("{parent}/_rels/{file_name}.rels");
    let Ok(relationships_xml) = read_ooxml_part(archive, &relationships_part) else {
        return Vec::new();
    };
    let relationships = ooxml::elements(&relationships_xml, "Relationship")
        .into_iter()
        .filter_map(|attributes| {
            Some((
                attributes.get("Id")?.clone(),
                (
                    attributes.get("Target")?.clone(),
                    attributes.get("TargetMode").cloned().unwrap_or_default(),
                ),
            ))
        })
        .collect::<HashMap<_, _>>();
    ordered_ooxml_blocks(slide_xml, "p:pic")
        .into_iter()
        .filter_map(|(offset, picture)| {
            let blip_attributes = ooxml::elements(&picture, "a:blip");
            let relationship_id = blip_attributes
                .first()
                .and_then(|attributes| attributes.get("r:embed"))?
                .clone();
            let (target, _) = relationships.get(&relationship_id)?;
            let media_part = ooxml::normalize_target(target, parent);
            let extension = std::path::Path::new(&media_part)
                .extension()
                .and_then(|value| value.to_str())?
                .to_ascii_lowercase();
            let mime = match extension.as_str() {
                "png" => "image/png",
                "jpg" | "jpeg" => "image/jpeg",
                "gif" => "image/gif",
                "bmp" => "image/bmp",
                "svg" => "image/svg+xml",
                _ => return None,
            };
            let bytes = read_ooxml_binary_part(archive, &media_part).ok()?;
            let data = base64::engine::general_purpose::STANDARD.encode(bytes);
            let mut options = serde_json::Map::new();
            let transform = ooxml::elements(&picture, "a:off").into_iter().next();
            let extent = ooxml::elements(&picture, "a:ext")
                .into_iter()
                .find(|attributes| attributes.contains_key("cx") && attributes.contains_key("cy"));
            if let Some(attributes) = transform {
                for (source, target) in [("x", "x"), ("y", "y")] {
                    if let Some(value) = attributes.get(source).and_then(|value| value.parse::<f64>().ok()) {
                        options.insert(target.into(), json!(value / 9525.0));
                    }
                }
            }
            if let Some(attributes) = ooxml::elements(&picture, "a:xfrm").first() {
                if let Some(value) = attributes.get("rot").and_then(|value| value.parse::<f64>().ok()) {
                    options.insert("rotation".into(), json!(value / 60_000.0));
                }
                if attributes.get("flipH").is_some_and(|value| value == "1" || value == "true") {
                    options.insert("flipHorizontal".into(), json!(true));
                }
                if attributes.get("flipV").is_some_and(|value| value == "1" || value == "true") {
                    options.insert("flipVertical".into(), json!(true));
                }
            }
            if let Some(attributes) = ooxml::elements(&picture, "a:prstGeom").first() {
                if let Some(value) = attributes.get("prst") {
                    options.insert("geometry".into(), json!(value));
                }
            }
            if let Some(attributes) = extent {
                for (source, target) in [("cx", "w"), ("cy", "h")] {
                    if let Some(value) = attributes.get(source).and_then(|value| value.parse::<f64>().ok()) {
                        options.insert(target.into(), json!(value / 9525.0));
                    }
                }
            }
            if let Some(adjustment) = ooxml::elements(&picture, "a:gd")
                .first()
                .and_then(|attributes| attributes.get("fmla"))
                .and_then(|formula| formula.strip_prefix("val "))
                .and_then(|value| value.parse::<f64>().ok())
            {
                let min_dimension = options.get("w").and_then(Value::as_f64)
                    .zip(options.get("h").and_then(Value::as_f64))
                    .map(|(width, height)| width.min(height));
                if let Some(min_dimension) = min_dimension {
                    options.insert("borderRadius".into(), json!(adjustment / 100_000.0 * min_dimension));
                }
            }
            if let Some(crop) = ooxml::elements(&picture, "a:srcRect").first() {
                let mut edges = serde_json::Map::new();
                for (source, target) in [("l", "left"), ("t", "top"), ("r", "right"), ("b", "bottom")] {
                    if let Some(value) = crop.get(source).and_then(|value| value.parse::<f64>().ok()) {
                        edges.insert(target.into(), json!(value / 100_000.0));
                    }
                }
                if !edges.is_empty() {
                    options.insert("crop".into(), json!(edges));
                }
            }
            let alt_text = ooxml::elements(&picture, "p:cNvPr")
                .first()
                .and_then(|attributes| attributes.get("descr"))
                .cloned()
                .unwrap_or_default();
            let hyperlink = ooxml::elements(&picture, "a:hlinkClick")
                .first()
                .and_then(|attributes| attributes.get("r:id"))
                .and_then(|id| relationships.get(id))
                .filter(|(_, target_mode)| target_mode == "External")
                .map(|(uri, _)| json!({"uri":uri,"isExternal":true}));
            Some((
                offset,
                json!({"kind":"image","src":format!("data:{mime};base64,{data}"),"altText":alt_text,"hyperlink":hyperlink,"options":options}),
            ))
        })
        .collect()
}

fn presentation_fill_image_sources<R: std::io::Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    slide_part: &str,
    slide_xml: &str,
    relationships: &HashMap<String, (String, String)>,
) -> HashMap<String, String> {
    let parent = std::path::Path::new(slide_part)
        .parent()
        .and_then(|value| value.to_str())
        .unwrap_or("ppt/slides");
    ordered_ooxml_blocks(slide_xml, "p:sp")
        .into_iter()
        .filter_map(|(_, shape)| {
            let relationship_id = ooxml::blocks(&shape, "a:blipFill")
                .first()
                .and_then(|fill| ooxml::elements(fill, "a:blip").into_iter().next())
                .and_then(|attributes| attributes.get("r:embed").cloned())?;
            let (target, target_mode) = relationships.get(&relationship_id)?;
            if target_mode == "External" {
                return None;
            }
            let media_part = ooxml::normalize_target(target, parent);
            let extension = std::path::Path::new(&media_part)
                .extension()?
                .to_str()?
                .to_ascii_lowercase();
            let mime = match extension.as_str() {
                "png" => "image/png",
                "jpg" | "jpeg" => "image/jpeg",
                "gif" => "image/gif",
                "bmp" => "image/bmp",
                "svg" => "image/svg+xml",
                _ => return None,
            };
            let bytes = read_ooxml_binary_part(archive, &media_part).ok()?;
            let src = format!(
                "data:{mime};base64,{}",
                base64::engine::general_purpose::STANDARD.encode(bytes)
            );
            Some((relationship_id, src))
        })
        .collect()
}

fn presentation_slide_relationships<R: std::io::Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    slide_part: &str,
) -> HashMap<String, (String, String)> {
    let Some(file_name) = std::path::Path::new(slide_part)
        .file_name()
        .and_then(|value| value.to_str())
    else {
        return HashMap::new();
    };
    let parent = std::path::Path::new(slide_part)
        .parent()
        .and_then(|value| value.to_str())
        .unwrap_or("ppt/slides");
    let relationships_part = format!("{parent}/_rels/{file_name}.rels");
    let Ok(relationships_xml) = read_ooxml_part(archive, &relationships_part) else {
        return HashMap::new();
    };
    ooxml::elements(&relationships_xml, "Relationship")
        .into_iter()
        .filter_map(|attributes| {
            Some((
                attributes.get("Id")?.clone(),
                (
                    attributes.get("Target")?.clone(),
                    attributes.get("TargetMode").cloned().unwrap_or_default(),
                ),
            ))
        })
        .collect()
}

fn presentation_chart_cache(xml: &str, container: &str) -> Vec<String> {
    let Some(block) = ooxml::blocks(xml, container).first().cloned() else {
        return Vec::new();
    };
    let mut points = ooxml::blocks(&block, "c:pt")
        .into_iter()
        .map(|point| {
            let index = ooxml::elements(&point, "c:pt")
                .first()
                .and_then(|attributes| attributes.get("idx"))
                .and_then(|value| value.parse::<usize>().ok())
                .unwrap_or(usize::MAX);
            let value = ooxml::text_values(&point, "c:v").join("");
            (index, value)
        })
        .collect::<Vec<_>>();
    points.sort_by_key(|(index, _)| *index);
    points.into_iter().map(|(_, value)| value).collect()
}

fn presentation_chart_object(frame: &str, chart: &str) -> Option<Value> {
    let chart_type = if chart.contains("<c:lineChart") {
        "line"
    } else if chart.contains("<c:pieChart") {
        "pie"
    } else if chart.contains("<c:doughnutChart") {
        "doughnut"
    } else if chart.contains("<c:areaChart") {
        "area"
    } else if chart.contains("<c:barChart") {
        "bar"
    } else {
        return None;
    };
    let mut series = Vec::new();
    for (series_index, item) in ooxml::blocks(chart, "c:ser").into_iter().enumerate() {
        let name = presentation_chart_cache(&item, "c:tx")
            .first()
            .cloned()
            .or_else(|| {
                ooxml::blocks(&item, "c:tx")
                    .first()
                    .map(|name| ooxml::text_values(name, "c:v").join(""))
            })
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| format!("Series {}", series_index + 1));
        let labels = presentation_chart_cache(&item, "c:cat");
        let values = presentation_chart_cache(&item, "c:val")
            .into_iter()
            .filter_map(|value| value.parse::<f64>().ok())
            .collect::<Vec<_>>();
        if labels.is_empty() || values.is_empty() || labels.len() != values.len() {
            continue;
        }
        series.push(json!({"name":name,"labels":labels,"values":values}));
    }
    if series.is_empty() {
        return None;
    }
    let mut options = serde_json::Map::new();
    if let Some(attributes) = ooxml::elements(frame, "a:off").first() {
        for (source, target) in [("x", "x"), ("y", "y")] {
            if let Some(value) = attributes
                .get(source)
                .and_then(|value| value.parse::<f64>().ok())
            {
                options.insert(target.into(), json!(value / 9525.0));
            }
        }
    }
    if let Some(attributes) = ooxml::elements(frame, "a:ext")
        .into_iter()
        .find(|attributes| attributes.contains_key("cx") && attributes.contains_key("cy"))
    {
        for (source, target) in [("cx", "w"), ("cy", "h")] {
            if let Some(value) = attributes
                .get(source)
                .and_then(|value| value.parse::<f64>().ok())
            {
                options.insert(target.into(), json!(value / 9525.0));
            }
        }
    }
    let title_xml = ooxml::blocks(chart, "c:chart")
        .into_iter()
        .next()
        .and_then(|chart_body| {
            let chart_body_end = chart_body.find("<c:plotArea").unwrap_or(chart_body.len());
            ooxml::blocks(&chart_body[..chart_body_end], "c:title")
                .into_iter()
                .next()
        })
        .unwrap_or_default();
    let title = ooxml::text_values(&title_xml, "a:t")
        .into_iter()
        .chain(ooxml::text_values(&title_xml, "c:v"))
        .collect::<String>();
    if !title.is_empty() {
        options.insert("title".into(), json!(title));
    }
    options.insert(
        "legend".into(),
        json!({"showLegend": chart.contains("<c:legend>")}),
    );
    Some(json!({"kind":"chart","type":chart_type,"series":series,"options":options}))
}

fn presentation_slide_charts<R: std::io::Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    slide_xml: &str,
    relationships: &HashMap<String, (String, String)>,
) -> Vec<(usize, Value)> {
    ordered_ooxml_blocks(slide_xml, "p:graphicFrame")
        .into_iter()
        .filter_map(|(offset, frame)| {
            if frame.contains("<a:tbl") {
                return None;
            }
            let relationship_id = ooxml::elements(&frame, "c:chart")
                .first()
                .and_then(|attributes| attributes.get("r:id"))
                .cloned()?;
            let (target, _) = relationships.get(&relationship_id)?;
            let part = if target.starts_with('/') {
                target.trim_start_matches('/').to_owned()
            } else {
                ooxml::normalize_target(target, "ppt/slides")
            };
            let chart_xml = read_ooxml_part(archive, &part).ok()?;
            presentation_chart_object(&frame, &chart_xml).map(|object| (offset, object))
        })
        .collect()
}

fn presentation_slide_notes<R: std::io::Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    slide_part: &str,
) -> String {
    let Some(file_name) = std::path::Path::new(slide_part)
        .file_name()
        .and_then(|value| value.to_str())
    else {
        return String::new();
    };
    let relationships_part = format!("ppt/slides/_rels/{file_name}.rels");
    let Ok(relationships_xml) = read_ooxml_part(archive, &relationships_part) else {
        return String::new();
    };
    let notes_target = ooxml::elements(&relationships_xml, "Relationship")
        .into_iter()
        .find(|attributes| {
            attributes
                .get("Type")
                .is_some_and(|value| value.ends_with("/notesSlide"))
        })
        .and_then(|attributes| attributes.get("Target").cloned())
        .map(|target| ooxml::normalize_target(&target, "ppt/slides"));
    let Some(notes_target) = notes_target else {
        return String::new();
    };
    let Ok(notes_xml) = read_ooxml_part(archive, &notes_target) else {
        return String::new();
    };
    presentation_notes_text(&notes_xml)
}

fn presentation_notes_text(xml: &str) -> String {
    ooxml::blocks(xml, "p:sp")
        .into_iter()
        .filter(|shape| {
            ooxml::elements(shape, "p:ph")
                .iter()
                .any(|attributes| attributes.get("type").is_some_and(|value| value == "body"))
        })
        .flat_map(|shape| {
            ooxml::blocks(&shape, "a:p")
                .into_iter()
                .map(|paragraph| ooxml::text_values(&paragraph, "a:t").join(""))
                .collect::<Vec<_>>()
        })
        .filter(|text| !text.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

fn presentation_text_runs(
    shape: &str,
    relationships: &HashMap<String, (String, String)>,
    slide_order: &HashMap<String, u64>,
) -> Vec<Value> {
    ooxml::blocks(shape, "a:p")
        .into_iter()
        .filter_map(|paragraph| {
            let runs = ooxml::blocks(&paragraph, "a:r")
                .into_iter()
                .filter_map(|run| {
                    let text = ooxml::text_values(&run, "a:t").join("");
                    if text.is_empty() {
                        return None;
                    }
                    let mut style = serde_json::Map::new();
                    if let Some(properties) = ooxml::blocks(&run, "a:rPr").first() {
                        if let Some(attributes) = ooxml::elements(properties, "a:rPr").first() {
                            if let Some(size) = attributes
                                .get("sz")
                                .and_then(|value| value.parse::<f64>().ok())
                            {
                                style.insert(
                                    "fontSize".into(),
                                    json!(format!("{}pt", size / 100.0)),
                                );
                            }
                            if attributes
                                .get("b")
                                .is_some_and(|value| value == "1" || value == "true")
                            {
                                style.insert("bold".into(), json!(true));
                            }
                            if attributes
                                .get("i")
                                .is_some_and(|value| value == "1" || value == "true")
                            {
                                style.insert("italic".into(), json!(true));
                            }
                            if let Some(underline) = attributes.get("u").filter(|value| value.as_str() != "none") {
                                style.insert("underline".into(), json!(underline));
                            }
                        }
                        if let Some(color) = ooxml::elements(properties, "a:srgbClr")
                            .first()
                            .and_then(|attributes| attributes.get("val"))
                        {
                            style.insert("color".into(), json!(format!("#{color}")));
                        }
                        if let Some(font) = ooxml::elements(properties, "a:latin")
                            .first()
                            .and_then(|attributes| attributes.get("typeface"))
                        {
                            style.insert("typeface".into(), json!(font));
                        }
                    }
                    let link_attributes = ooxml::elements(&run, "a:hlinkClick");
                    let link = link_attributes.first().and_then(|attributes| {
                        let action = attributes.get("action").filter(|value| !value.is_empty());
                        let relationship = attributes
                            .get("r:id")
                            .and_then(|id| relationships.get(id));
                        if let Some((uri, _mode)) = relationship.filter(|(_, mode)| mode == "External") {
                            let mut link = json!({"uri":uri,"isExternal":true});
                            if let Some(action) = action { link["action"] = json!(action); }
                            return Some(link);
                        }
                        let target = relationship.map(|(target, _)| target);
                        let target_slide = target
                            .and_then(|target| std::path::Path::new(target).file_name())
                            .and_then(|value| value.to_str())
                            .and_then(|name| slide_order.get(name));
                        if let (Some(slide), Some(action)) = (target_slide, action) {
                            return Some(json!({"uri":format!("slide:{slide}"),"isExternal":false,"action":action}));
                        }
                        action.map(|action| json!({"uri":action,"isExternal":false,"action":action}))
                    });
                    let mut result = json!({"run": text});
                    if !style.is_empty() {
                        result["style"] = json!(style);
                    }
                    if let Some(link) = link {
                        result["link"] = link;
                    }
                    Some(result)
                })
                .collect::<Vec<_>>();
            if runs.is_empty() {
                return None;
            }
            let mut result = json!({"runs": runs});
            if let Some(attributes) = ooxml::elements(&paragraph, "a:pPr").first() {
                for (source, target) in [("marL", "marginLeft"), ("indent", "indent")] {
                    if let Some(value) = attributes
                        .get(source)
                        .and_then(|value| value.parse::<f64>().ok())
                    {
                        result[target] = json!(value / 9525.0);
                    }
                }
            }
            if let Some(character) = ooxml::elements(&paragraph, "a:buChar")
                .first()
                .and_then(|attributes| attributes.get("char"))
            {
                if let Some(character) = decode_xml_character(character) {
                    result["bulletCharacter"] = json!(character.to_string());
                }
            }
            for (tag, target) in [("a:spcBef", "spaceBefore"), ("a:spcAft", "spaceAfter")] {
                if let Some(spacing) = ooxml::blocks(&paragraph, tag).first() {
                    if let Some(value) = ooxml::elements(spacing, "a:spcPts")
                        .first()
                        .and_then(|spacing| spacing.get("val"))
                        .and_then(|value| value.parse::<f64>().ok())
                    {
                        result[target] = json!(value / 100.0 * (4.0 / 3.0));
                    }
                }
            }
            Some(result)
        })
        .collect()
}

fn presentation_custom_paths(shape: &str) -> Vec<Value> {
    let Some(custom_geometry) = ooxml::blocks(shape, "a:custGeom").first().cloned() else {
        return Vec::new();
    };
    ooxml::blocks(&custom_geometry, "a:path")
        .into_iter()
        .filter_map(|path| {
            let attributes = ooxml::elements(&path, "a:path").first().cloned()?;
            let width = attributes.get("w")?.parse::<f64>().ok()? / 9525.0;
            let height = attributes.get("h")?.parse::<f64>().ok()? / 9525.0;
            let mut commands = Vec::new();
            let mut ordered = Vec::new();
            for tag in [
                "a:moveTo",
                "a:lnTo",
                "a:quadBezTo",
                "a:cubicBezTo",
                "a:close",
            ] {
                ordered.extend(ordered_ooxml_blocks(&path, tag));
            }
            ordered.sort_by_key(|(offset, _)| *offset);
            for (_, command_xml) in ordered {
                if command_xml.starts_with("<a:close") {
                    commands.push(json!({"close":{}}));
                    continue;
                }
                let points = ooxml::elements(&command_xml, "a:pt")
                    .into_iter()
                    .filter_map(|point| {
                        Some((
                            point.get("x")?.parse::<f64>().ok()? / 9525.0,
                            point.get("y")?.parse::<f64>().ok()? / 9525.0,
                        ))
                    })
                    .collect::<Vec<_>>();
                match points.as_slice() {
                    [(x, y)] if command_xml.starts_with("<a:moveTo") => {
                        commands.push(json!({"moveTo":{"x":x,"y":y}}))
                    }
                    [(x, y)] if command_xml.starts_with("<a:lnTo") => {
                        commands.push(json!({"lineTo":{"x":x,"y":y}}))
                    }
                    [(x1, y1), (x, y)] if command_xml.starts_with("<a:quadBezTo") => {
                        commands.push(json!({"quadBezTo":{"x1":x1,"y1":y1,"x":x,"y":y}}))
                    }
                    [(x1, y1), (x2, y2), (x, y)] if command_xml.starts_with("<a:cubicBezTo") => {
                        commands.push(
                            json!({"cubicBezTo":{"x1":x1,"y1":y1,"x2":x2,"y2":y2,"x":x,"y":y}}),
                        )
                    }
                    _ => {}
                }
            }
            (!commands.is_empty())
                .then_some(json!({"width":width,"height":height,"commands":commands}))
        })
        .collect()
}

fn presentation_gradient_fill(shape_properties: &str) -> Option<Value> {
    let gradient = ooxml::blocks(shape_properties, "a:gradFill")
        .into_iter()
        .next()?;
    let mut stops = Vec::new();
    for stop in ooxml::blocks(&gradient, "a:gs") {
        let stop_attributes = ooxml::elements(&stop, "a:gs");
        let attributes = stop_attributes.first()?;
        let offset = attributes.get("pos")?.parse::<f64>().ok()?;
        let color_attributes = ooxml::elements(&stop, "a:srgbClr");
        let color = color_attributes.first()?.get("val")?;
        let opacity = ooxml::elements(&stop, "a:alpha")
            .first()
            .and_then(|attributes| attributes.get("val"))
            .and_then(|value| value.parse::<f64>().ok())
            .map(|value| value / 100_000.0)
            .unwrap_or(1.0);
        let color = if opacity < 1.0 {
            format!("#{color}/{opacity}")
        } else {
            format!("#{color}")
        };
        stops.push(json!({"offset":offset,"color":color}));
    }
    if stops.len() < 2 {
        return None;
    }
    let path_attributes = ooxml::elements(&gradient, "a:path");
    let path = path_attributes.first();
    let angle = ooxml::elements(&gradient, "a:lin")
        .first()
        .and_then(|attributes| attributes.get("ang"))
        .and_then(|value| value.parse::<f64>().ok())
        .map(|value| value / 60_000.0);
    Some(json!({
        "type":"gradient",
        "gradientKind":if path.is_some() { "path" } else { "linear" },
        "angleDeg":angle.unwrap_or(0.0),
        "stops":stops,
    }))
}

fn presentation_import_fill(properties: &str) -> Option<Value> {
    if let Some(gradient) = presentation_gradient_fill(properties) {
        return Some(gradient);
    }
    if let Some(pattern) = ooxml::blocks(properties, "a:pattFill").first() {
        let pattern_type = ooxml::elements(pattern, "a:pattFill")
            .first()
            .and_then(|attributes| attributes.get("prst"))?
            .clone();
        let pattern_type = match pattern_type.as_str() {
            "diagCross" => "diagonalCross".to_owned(),
            value if value.starts_with("pct") => format!("percent{}", &value[3..]),
            value => value.to_owned(),
        };
        let color_from = |tag: &str, fallback: &str| {
            ooxml::blocks(pattern, tag)
                .first()
                .and_then(|fill| ooxml::elements(fill, "a:srgbClr").into_iter().next())
                .and_then(|attributes| attributes.get("val").cloned())
                .map(|color| format!("#{color}"))
                .unwrap_or_else(|| fallback.to_owned())
        };
        return Some(
            json!({"type":"solid","color":color_from("a:bgClr", "#FFFFFF"),"pattern":{"type":pattern_type,"color":color_from("a:fgClr", "#000000")}}),
        );
    }
    let solid_fill = ooxml::blocks(properties, "a:solidFill")
        .into_iter()
        .next()?;
    if let Some(color) = ooxml::elements(&solid_fill, "a:srgbClr")
        .first()
        .and_then(|attributes| attributes.get("val"))
    {
        return Some(json!(format!("#{color}")));
    }
    if let Some(color) = ooxml::elements(&solid_fill, "a:schemeClr")
        .first()
        .and_then(|attributes| attributes.get("val"))
    {
        return Some(json!(color));
    }
    if properties.contains("<a:noFill") {
        return Some(json!("none"));
    }
    None
}

fn decode_xml_character(value: &str) -> Option<char> {
    if let Some(hex) = value
        .strip_prefix("&#x")
        .and_then(|value| value.strip_suffix(';'))
    {
        return u32::from_str_radix(hex, 16).ok().and_then(char::from_u32);
    }
    if let Some(decimal) = value
        .strip_prefix("&#")
        .and_then(|value| value.strip_suffix(';'))
    {
        return decimal.parse::<u32>().ok().and_then(char::from_u32);
    }
    match value {
        "&amp;" => Some('&'),
        "&lt;" => Some('<'),
        "&gt;" => Some('>'),
        "&quot;" => Some('"'),
        "&apos;" => Some('\''),
        value => value.chars().next(),
    }
}

fn presentation_slide_objects(
    xml: &str,
    extra_objects: Vec<(usize, Value)>,
    relationships: &HashMap<String, (String, String)>,
    slide_order: &HashMap<String, u64>,
    image_fill_sources: &HashMap<String, String>,
) -> Vec<Value> {
    let normalized_xml = xml
        .replace("<p:cxnSp>", "<p:sp ruxexConnector=\"1\">")
        .replace("</p:cxnSp>", "</p:sp>")
        .replace("<p:nvCxnSpPr>", "<p:nvSpPr>")
        .replace("</p:nvCxnSpPr>", "</p:nvSpPr>")
        .replace("<p:cNvCxnSpPr>", "<p:cNvSpPr>")
        .replace("</p:cNvCxnSpPr>", "</p:cNvSpPr>");
    let xml = normalized_xml.as_str();
    let mut objects = ordered_ooxml_blocks(xml, "p:sp")
        .into_iter()
        .filter_map(|(offset, shape)| {
            let is_connector = shape.contains("ruxexConnector=\"1\"");
            let paragraphs = ooxml::blocks(&shape, "a:p")
                .into_iter()
                .map(|paragraph| ooxml::text_values(&paragraph, "a:t").join(""))
                .collect::<Vec<_>>();
            let text = if paragraphs.is_empty() {
                ooxml::text_values(&shape, "a:t").join("")
            } else {
                paragraphs.join("\n")
            };
            let text_runs = presentation_text_runs(&shape, relationships, slide_order);
            let shape_name = ooxml::elements(&shape, "p:cNvPr")
                .first()
                .and_then(|attributes| attributes.get("name"))
                .cloned();
            let transform = ooxml::elements(&shape, "a:off").into_iter().next();
            let extent = ooxml::elements(&shape, "a:ext").into_iter().next();
            let mut options = serde_json::Map::new();
            if let Some(id) = ooxml::elements(&shape, "p:cNvPr")
                .first()
                .and_then(|attributes| attributes.get("id"))
                .and_then(|value| value.parse::<u64>().ok())
            {
                options.insert("pptxShapeId".into(), json!(id));
            }
            if let Some(name) = &shape_name {
                options.insert("name".into(), json!(name));
            }
            if let Some(placeholder) = ooxml::elements(&shape, "p:ph").first() {
                let kind = placeholder.get("type").map(String::as_str).unwrap_or("obj");
                let kind = match kind {
                    "ctrTitle" | "title" => "title",
                    "subTitle" => "subtitle",
                    "body" | "obj" => "body",
                    "pic" => "picture",
                    "tbl" => "table",
                    "sldNum" => "slideNumber",
                    "dt" => "dateTime",
                    "ftr" => "footer",
                    "hdr" => "header",
                    other => other,
                };
                options.insert("placeholderType".into(), json!(kind));
                options.insert(
                    "placeholderIndex".into(),
                    json!(placeholder
                        .get("idx")
                        .and_then(|value| value.parse::<u64>().ok())
                        .unwrap_or(0)),
                );
            }
            if let Some(attributes) = transform {
                for (source, target) in [("x", "x"), ("y", "y")] {
                    if let Some(value) = attributes
                        .get(source)
                        .and_then(|value| value.parse::<f64>().ok())
                    {
                        options.insert(target.into(), json!(value / 9525.0));
                    }
                }
            }
            if let Some(attributes) = extent {
                for (source, target) in [("cx", "w"), ("cy", "h")] {
                    if let Some(value) = attributes
                        .get(source)
                        .and_then(|value| value.parse::<f64>().ok())
                    {
                        options.insert(target.into(), json!(value / 9525.0));
                    }
                }
            }
            if !text.is_empty() {
                let text_body = ooxml::blocks(&shape, "p:txBody")
                    .into_iter()
                    .next()
                    .unwrap_or_default();
                let mut text_style = serde_json::Map::new();
                if let Some(run) = ooxml::elements(&text_body, "a:rPr").first() {
                    if let Some(size) = run.get("sz").and_then(|value| value.parse::<f64>().ok()) {
                        text_style.insert("fontSize".into(), json!(size * 96.0 / 7200.0));
                    }
                    if run
                        .get("b")
                        .is_some_and(|value| value == "1" || value == "true")
                    {
                        text_style.insert("bold".into(), json!(true));
                    }
                    if run
                        .get("i")
                        .is_some_and(|value| value == "1" || value == "true")
                    {
                        text_style.insert("italic".into(), json!(true));
                    }
                }
                if let Some(color) = ooxml::elements(&text_body, "a:srgbClr")
                    .first()
                    .and_then(|attributes| attributes.get("val"))
                {
                    text_style.insert("color".into(), json!(format!("#{color}")));
                }
                if let Some(font) = ooxml::elements(&text_body, "a:latin")
                    .first()
                    .and_then(|attributes| attributes.get("typeface"))
                {
                    text_style.insert("fontFace".into(), json!(font));
                }
                if !text_style.is_empty() {
                    options.insert("textStyle".into(), json!(text_style));
                }
            }
            if options.contains_key("placeholderType") && !options.contains_key("textStyle") {
                let text_body = ooxml::blocks(&shape, "p:txBody")
                    .into_iter()
                    .next()
                    .unwrap_or_default();
                let run_properties = ooxml::elements(&text_body, "a:defRPr")
                    .into_iter()
                    .chain(ooxml::elements(&text_body, "a:endParaRPr"))
                    .next();
                if let Some(run) = run_properties {
                    let mut text_style = serde_json::Map::new();
                    if let Some(size) = run.get("sz").and_then(|value| value.parse::<f64>().ok()) {
                        text_style.insert("fontSize".into(), json!(size / 75.0));
                    }
                    if run
                        .get("b")
                        .is_some_and(|value| value == "1" || value == "true")
                    {
                        text_style.insert("bold".into(), json!(true));
                    }
                    if run
                        .get("i")
                        .is_some_and(|value| value == "1" || value == "true")
                    {
                        text_style.insert("italic".into(), json!(true));
                    }
                    if let Some(color) = ooxml::elements(&text_body, "a:srgbClr")
                        .first()
                        .and_then(|attributes| attributes.get("val"))
                    {
                        text_style.insert("color".into(), json!(format!("#{color}")));
                    }
                    if let Some(font) = ooxml::elements(&text_body, "a:latin")
                        .first()
                        .and_then(|attributes| attributes.get("typeface"))
                    {
                        text_style.insert("fontFace".into(), json!(font));
                    }
                    if !text_style.is_empty() {
                        options.insert("textStyle".into(), json!(text_style));
                    }
                }
            }
            let shape_properties = ooxml::blocks(&shape, "p:spPr")
                .into_iter()
                .next()
                .unwrap_or_default();
            if let Some(fill) = ooxml::blocks(&shape_properties, "a:solidFill")
                .first()
                .and_then(|fill| ooxml::elements(fill, "a:srgbClr").into_iter().next())
                .and_then(|attributes| attributes.get("val").cloned())
            {
                options.insert("fill".into(), json!(format!("#{fill}")));
            } else if shape_properties.contains("<a:noFill") {
                options.insert("fill".into(), json!("none"));
            }
            if let Some(pattern_fill) = ooxml::blocks(&shape_properties, "a:pattFill").first() {
                let pattern_type = ooxml::elements(pattern_fill, "a:pattFill")
                    .first()
                    .and_then(|attributes| attributes.get("prst"))
                    .cloned();
                if let Some(pattern_type) = pattern_type {
                    let pattern_type = match pattern_type.as_str() {
                        "diagCross" => "diagonalCross".to_owned(),
                        "pct5" => "percent5".to_owned(),
                        "pct10" => "percent10".to_owned(),
                        "pct20" => "percent20".to_owned(),
                        "pct25" => "percent25".to_owned(),
                        "pct30" => "percent30".to_owned(),
                        "pct40" => "percent40".to_owned(),
                        "pct50" => "percent50".to_owned(),
                        "pct60" => "percent60".to_owned(),
                        "pct70" => "percent70".to_owned(),
                        "pct75" => "percent75".to_owned(),
                        "pct80" => "percent80".to_owned(),
                        "pct90" => "percent90".to_owned(),
                        value => value.to_owned(),
                    };
                    let color_from = |tag: &str| {
                        ooxml::blocks(pattern_fill, tag)
                            .first()
                            .and_then(|fill| ooxml::elements(fill, "a:srgbClr").into_iter().next())
                            .and_then(|attributes| attributes.get("val").cloned())
                            .map(|color| format!("#{color}"))
                    };
                    options.insert(
                        "fill".into(),
                        json!({
                            "type":"solid",
                            "color":color_from("a:bgClr").unwrap_or_else(|| "#FFFFFF".into()),
                            "pattern":{"type":pattern_type,"color":color_from("a:fgClr").unwrap_or_else(|| "#000000".into())}
                        }),
                    );
                }
            }
            if let Some(fill) = presentation_gradient_fill(&shape_properties) {
                options.insert("fill".into(), fill);
            }
            if let Some(image_fill) = ooxml::blocks(&shape_properties, "a:blipFill").first() {
                let relationship_id = ooxml::elements(image_fill, "a:blip")
                    .first()
                    .and_then(|attributes| attributes.get("r:embed").cloned());
                let shape_id = ooxml::elements(&shape, "p:cNvPr")
                    .first()
                    .and_then(|attributes| attributes.get("id").cloned());
                if let (Some(relationship_id), Some(shape_id)) = (relationship_id, shape_id) {
                if let Some(src) = image_fill_sources.get(&relationship_id) {
                    let mut fill = serde_json::Map::new();
                    fill.insert("type".into(), json!("image"));
                    let mut image_reference = serde_json::Map::new();
                    image_reference.insert("id".into(), json!(format!("pptx-fill-source-{shape_id}")));
                    image_reference.insert("src".into(), json!(src));
                    fill.insert("imageReference".into(), Value::Object(image_reference));
                    for (element, key) in [("a:srcRect", "srcRect"), ("a:fillRect", "fillRect"), ("a:fillToRect", "fillRect"), ("a:fillRect", "stretchFillRect")] {
                        if let Some(attributes) = ooxml::elements(image_fill, element).first() {
                            let mut rect = serde_json::Map::new();
                            for (source, target) in [("l", "l"), ("t", "t"), ("r", "r"), ("b", "b")] {
                                if let Some(value) = attributes.get(source).and_then(|value| value.parse::<f64>().ok()) {
                                    rect.insert(target.into(), json!(value));
                                }
                            }
                            if !rect.is_empty() { fill.insert(key.into(), Value::Object(rect)); }
                        }
                    }
                    if let Some(alpha) = ooxml::elements(image_fill, "a:alphaModFix")
                        .first().and_then(|attributes| attributes.get("amt")).and_then(|value| value.parse::<f64>().ok()) {
                        fill.insert("alphaModFix".into(), json!(alpha));
                    }
                    options.insert("fill".into(), Value::Object(fill));
                }
                }
            }
            if let Some(line_block) = ooxml::blocks(&shape_properties, "a:ln").first() {
                let color = ooxml::blocks(line_block, "a:solidFill")
                    .first()
                    .and_then(|fill| ooxml::elements(fill, "a:srgbClr").into_iter().next())
                    .and_then(|attributes| attributes.get("val").cloned());
                let width = ooxml::elements(&shape_properties, "a:ln")
                    .first()
                    .and_then(|attributes| attributes.get("w"))
                    .and_then(|value| value.parse::<f64>().ok())
                    .map(|value| value / 9525.0);
                let mut line = serde_json::Map::new();
                if let Some(color) = color {
                    line.insert("fill".into(), json!(format!("#{color}")));
                } else if line_block.contains("<a:noFill") {
                    line.insert("fill".into(), json!("none"));
                }
                if let Some(fill) = presentation_gradient_fill(line_block) {
                    line.insert("fill".into(), fill);
                }
                if let Some(width) = width {
                    line.insert("width".into(), json!(width));
                }
                if !line.is_empty() {
                    options.insert("line".into(), json!(line));
                }
            }
            let custom_paths = presentation_custom_paths(&shape);
            if !custom_paths.is_empty() {
                options.insert("customPaths".into(), json!(custom_paths.clone()));
            }
            let geometry = ooxml::elements(&shape, "a:prstGeom")
                .first()
                .and_then(|attributes| attributes.get("prst"))
                .cloned()
                .or_else(|| (!custom_paths.is_empty()).then(|| "custom".to_owned()));
            if is_connector {
                let geometry_name = geometry.as_deref().unwrap_or("straightConnector1");
                let kind = if geometry_name.starts_with("bentConnector") {
                    if geometry_name == "bentConnector3" { "elbow".to_owned() }
                    else { geometry_name.strip_prefix("bentConnector").map(|value| format!("elbow{value}")).unwrap_or_else(|| "elbow".to_owned()) }
                } else if geometry_name.starts_with("curvedConnector") {
                    "curved".to_owned()
                } else {
                    "straight".to_owned()
                };
                let start_attributes = ooxml::elements(&shape, "a:stCxn");
                let end_attributes = ooxml::elements(&shape, "a:endCxn");
                let start = start_attributes.first();
                let end = end_attributes.first();
                let line = ooxml::elements(&shape, "a:ln").into_iter().next();
                let cap = line
                    .as_ref()
                    .and_then(|attributes| attributes.get("cap"))
                    .and_then(|cap| match cap.as_str() {
                        "rnd" => Some("round"),
                        "sq" => Some("square"),
                        "flat" => Some("flat"),
                        _ => None,
                    });
                let join = if ooxml::elements(&shape, "a:round").len() > 0 {
                    Some("round")
                } else if ooxml::elements(&shape, "a:bevel").len() > 0 {
                    Some("bevel")
                } else if ooxml::elements(&shape, "a:miter").len() > 0 {
                    Some("miter")
                } else {
                    None
                };
                options.insert("connector".into(), json!({
                    "kind":kind,
                    "cap":cap,
                    "join":join,
                    "fromPptxId":start.and_then(|attributes| attributes.get("id")).and_then(|value| value.parse::<u64>().ok()),
                    "fromIdx":start.and_then(|attributes| attributes.get("idx")).and_then(|value| value.parse::<u64>().ok()),
                    "toPptxId":end.and_then(|attributes| attributes.get("id")).and_then(|value| value.parse::<u64>().ok()),
                    "toIdx":end.and_then(|attributes| attributes.get("idx")).and_then(|value| value.parse::<u64>().ok()),
                }));
            }
            if geometry.as_deref() == Some("roundRect") {
                let adjustment = ooxml::elements(&shape_properties, "a:gd")
                    .first()
                    .and_then(|attributes| attributes.get("fmla"))
                    .and_then(|formula| formula.strip_prefix("val "))
                    .and_then(|value| value.parse::<f64>().ok());
                if let (Some(adjustment), Some(width), Some(height)) = (
                    adjustment,
                    options.get("w").and_then(Value::as_f64),
                    options.get("h").and_then(Value::as_f64),
                ) {
                    options.insert(
                        "borderRadius".into(),
                        json!(adjustment / 100_000.0 * width.min(height)),
                    );
                }
            }
            if let Some(shadow) = ooxml::blocks(&shape_properties, "a:outerShdw").first() {
                let attributes = ooxml::elements(shadow, "a:outerShdw").first().cloned();
                let color = ooxml::elements(shadow, "a:srgbClr")
                    .first()
                    .and_then(|value| value.get("val"))
                    .cloned();
                if let (Some(attributes), Some(color)) = (attributes, color) {
                    let distance = attributes
                        .get("dist")
                        .and_then(|value| value.parse::<f64>().ok())
                        .unwrap_or(0.0)
                        / 9525.0;
                    let angle = attributes
                        .get("dir")
                        .and_then(|value| value.parse::<f64>().ok())
                        .unwrap_or(0.0)
                        / 60_000.0;
                    let radians = angle.to_radians();
                    let dx = distance * radians.cos();
                    let dy = -distance * radians.sin();
                    let blur = attributes
                        .get("blurRad")
                        .and_then(|value| value.parse::<f64>().ok())
                        .unwrap_or(0.0)
                        / 9525.0;
                    let opacity = ooxml::elements(shadow, "a:alpha")
                        .first()
                        .and_then(|value| value.get("val"))
                        .and_then(|value| value.parse::<f64>().ok())
                        .map(|value| (value / 1000.0).round() as u32)
                        .unwrap_or(17);
                    options.insert(
                        "shadow".into(),
                        json!(format!(
                            "{:.0}px {:.0}px {:.0}px #{color}/{opacity}",
                            dx, dy, blur
                        )),
                    );
                }
            }
            let explicit_textbox =
                ooxml::elements(&shape, "p:cNvSpPr")
                    .first()
                    .is_some_and(|attributes| {
                        attributes.get("txBox").is_some_and(|value| value == "1")
                    })
                    || ooxml::elements(&shape, "p:cNvPr")
                        .first()
                        .and_then(|attributes| attributes.get("name"))
                        .is_some_and(|name| name.starts_with("Text "));
            if !text.is_empty() && (geometry.is_none() || explicit_textbox) {
                let mut object = json!({"kind": "text", "text": text, "options": options});
                if let Some(name) = &shape_name {
                    object["name"] = json!(name);
                }
                if !text_runs.is_empty() {
                    object["textRuns"] = json!(text_runs);
                }
                return Some((offset, object));
            }
            geometry.map(|geometry| {
                let mut object =
                    json!({"kind": "shape", "shape": if is_connector { "line" } else { &geometry }, "text": text, "options": options});
                if let Some(name) = &shape_name {
                    object["name"] = json!(name);
                }
                if !text_runs.is_empty() {
                    object["textRuns"] = json!(text_runs);
                }
                (offset, object)
            })
        })
        .collect::<Vec<_>>();
    for (frame_offset, frame) in ordered_ooxml_blocks(xml, "p:graphicFrame") {
        let Some(table_xml) = ooxml::blocks(&frame, "a:tbl").into_iter().next() else {
            continue;
        };
        let rows = ooxml::blocks(&table_xml, "a:tr")
            .into_iter()
            .map(|row| {
                ooxml::blocks(&row, "a:tc")
                    .into_iter()
                    .map(|cell| ooxml::text_values(&cell, "a:t").join(""))
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>();
        if rows.is_empty() || rows.iter().any(Vec::is_empty) {
            continue;
        }
        let cell_options = ooxml::blocks(&table_xml, "a:tr")
            .into_iter()
            .map(|row| {
                ooxml::blocks(&row, "a:tc")
                    .into_iter()
                    .map(|cell| {
                        let mut options = serde_json::Map::new();
                        let properties = ooxml::blocks(&cell, "a:tcPr")
                            .into_iter()
                            .next()
                            .unwrap_or_default();
                        let fill_color = ooxml::blocks(&properties, "a:solidFill")
                            .into_iter()
                            .next()
                            .and_then(|fill| ooxml::elements(&fill, "a:srgbClr").into_iter().next())
                            .and_then(|attributes| attributes.get("val").cloned());
                        if let Some(color) = fill_color {
                            options.insert("fill".into(), json!(format!("#{color}")));
                        }
                        if let Some(attributes) = ooxml::elements(&properties, "a:tcPr").first() {
                            if let Some(anchor) = attributes.get("anchor") {
                                let value = match anchor.as_str() {
                                    "ctr" => "middle",
                                    "b" => "bottom",
                                    _ => "top",
                                };
                                options.insert("anchor".into(), json!(value));
                            }
                            let margins = [
                                ("marT", "top"),
                                ("marR", "right"),
                                ("marB", "bottom"),
                                ("marL", "left"),
                            ]
                            .into_iter()
                            .filter_map(|(source, target)| {
                                attributes
                                    .get(source)
                                    .and_then(|value| value.parse::<f64>().ok())
                                    .map(|value| (target.to_owned(), json!(value / 9525.0)))
                            })
                            .collect::<serde_json::Map<_, _>>();
                            if !margins.is_empty() {
                                options.insert("margins".into(), json!(margins));
                            }
                        }
                        let mut borders = serde_json::Map::new();
                        for (tag, side) in [
                            ("a:lnL", "left"),
                            ("a:lnT", "top"),
                            ("a:lnR", "right"),
                            ("a:lnB", "bottom"),
                        ] {
                            if let Some(line) = ooxml::blocks(&properties, tag).first() {
                                let mut border = serde_json::Map::new();
                                let line_color = ooxml::blocks(line, "a:solidFill")
                                    .into_iter()
                                    .next()
                                    .and_then(|fill| {
                                        ooxml::elements(&fill, "a:srgbClr").into_iter().next()
                                    })
                                    .and_then(|attributes| attributes.get("val").cloned());
                                if let Some(color) = line_color {
                                    border.insert("fill".into(), json!(format!("#{color}")));
                                }
                                if let Some(width) = ooxml::elements(line, tag)
                                    .first()
                                    .and_then(|attributes| attributes.get("w"))
                                    .and_then(|value| value.parse::<f64>().ok())
                                {
                                    border.insert("width".into(), json!(width / 9525.0));
                                }
                                if !border.is_empty() {
                                    borders.insert(side.into(), json!(border));
                                }
                            }
                        }
                        if !borders.is_empty() {
                            options.insert("borders".into(), json!(borders));
                        }
                        Value::Object(options)
                    })
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>();
        let mut options = serde_json::Map::new();
        if let Some(style_id) = ooxml::elements(&table_xml, "a:tableStyleId")
            .first()
            .and_then(|attributes| attributes.get("val"))
        {
            options.insert("style".into(), json!(style_id));
        }
        let transform = ooxml::elements(&frame, "a:off").into_iter().next();
        let extent = ooxml::elements(&frame, "a:ext").into_iter().next();
        if let Some(attributes) = transform {
            for (source, target) in [("x", "x"), ("y", "y")] {
                if let Some(value) = attributes
                    .get(source)
                    .and_then(|value| value.parse::<f64>().ok())
                {
                    options.insert(target.into(), json!(value / 9525.0));
                }
            }
        }
        if let Some(attributes) = extent {
            for (source, target) in [("cx", "w"), ("cy", "h")] {
                if let Some(value) = attributes
                    .get(source)
                    .and_then(|value| value.parse::<f64>().ok())
                {
                    options.insert(target.into(), json!(value / 9525.0));
                }
            }
        }
        let row_heights = ooxml::elements(&table_xml, "a:tr")
            .into_iter()
            .filter_map(|attributes| {
                attributes
                    .get("h")?
                    .parse::<f64>()
                    .ok()
                    .map(|value| value / 9525.0)
            })
            .collect::<Vec<_>>();
        if !row_heights.is_empty() {
            options.insert("rowHeights".into(), json!(row_heights));
        }
        let column_widths = ooxml::elements(&table_xml, "a:gridCol")
            .into_iter()
            .filter_map(|attributes| {
                attributes
                    .get("w")?
                    .parse::<f64>()
                    .ok()
                    .map(|value| value / 9525.0)
            })
            .collect::<Vec<_>>();
        if !column_widths.is_empty() {
            options.insert("columnWidths".into(), json!(column_widths));
        }
        objects.push((
            frame_offset,
            json!({"kind":"table","rows":rows,"cellOptions":cell_options,"options":options}),
        ));
    }
    objects.extend(extra_objects);
    objects.sort_by_key(|(offset, _)| *offset);
    objects.into_iter().map(|(_, object)| object).collect()
}

fn ordered_ooxml_blocks(xml: &str, tag: &str) -> Vec<(usize, String)> {
    let mut cursor = 0;
    ooxml::blocks(xml, tag)
        .into_iter()
        .filter_map(|block| {
            let offset = xml[cursor..].find(&block)? + cursor;
            cursor = offset + block.len();
            Some((offset, block))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{presentation_notes_text, presentation_slide_objects};
    use serde_json::json;
    use std::collections::HashMap;

    #[test]
    fn presentation_objects_keep_text_and_basic_geometry() {
        let xml = r#"<p:sld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Text 0"/><p:cNvSpPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="1371600"/><a:ext cx="10820400" cy="609600"/></a:xfrm><a:prstGeom prst="rect"/></p:spPr><p:txBody><a:p><a:r><a:rPr sz="1800" b="1"><a:solidFill><a:srgbClr val="123456"/></a:solidFill></a:rPr><a:t>Source</a:t></a:r></a:p></p:txBody></p:sp><p:graphicFrame><a:xfrm><a:off x="9525" y="19050"/><a:ext cx="28575" cy="38100"/></a:xfrm><a:graphic><a:graphicData><a:tbl><a:tr><a:tc><a:p><a:r><a:t>Header</a:t></a:r></a:p></a:tc><a:tc><a:p><a:r><a:t>Value</a:t></a:r></a:p></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame><p:sp><p:spPr><a:xfrm><a:off x="9525" y="19050"/><a:ext cx="28575" cy="38100"/></a:xfrm><a:prstGeom prst="ellipse"/></p:spPr></p:sp><p:sp><p:nvSpPr><p:cNvPr id="5" name="Rounded Rectangle 1"/><p:cNvSpPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="19050" y="28575"/><a:ext cx="57150" cy="38100"/></a:xfrm><a:prstGeom prst="roundRect"/><a:solidFill><a:srgbClr val="445566"/></a:solidFill></p:spPr><p:txBody><a:p><a:r><a:rPr sz="1800"><a:solidFill><a:srgbClr val="AABBCC"/></a:solidFill></a:rPr><a:t>Badge</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:sld>"#;
        assert_eq!(
            presentation_slide_objects(
                xml,
                vec![],
                &HashMap::new(),
                &HashMap::new(),
                &HashMap::new()
            ),
            vec![
                json!({"kind":"text","text":"Source","name":"Text 0","textRuns":[{"runs":[{"run":"Source","style":{"fontSize":"18pt","bold":true,"color":"#123456"}}]}],"options":{"pptxShapeId":2,"name":"Text 0","x":72.0,"y":144.0,"w":1136.0,"h":64.0,"textStyle":{"fontSize":24.0,"bold":true,"color":"#123456"}}}),
                json!({"kind":"table","rows":[["Header","Value"]],"cellOptions":[[{},{}]],"options":{"x":1.0,"y":2.0,"w":3.0,"h":4.0}}),
                json!({"kind":"shape","shape":"ellipse","text":"","options":{"x":1.0,"y":2.0,"w":3.0,"h":4.0}}),
                json!({"kind":"shape","shape":"roundRect","text":"Badge","name":"Rounded Rectangle 1","textRuns":[{"runs":[{"run":"Badge","style":{"fontSize":"18pt","color":"#AABBCC"}}]}],"options":{"pptxShapeId":5,"name":"Rounded Rectangle 1","x":2.0,"y":3.0,"w":6.0,"h":4.0,"textStyle":{"fontSize":24.0,"color":"#AABBCC"},"fill":"#445566"}}),
            ]
        );
    }

    #[test]
    fn presentation_import_retains_external_text_hyperlinks() {
        let xml = r#"<p:sld><p:sp><p:nvSpPr><p:cNvPr id="2" name="Text 0"/><p:cNvSpPr txBox="1"/></p:nvSpPr><p:spPr/><p:txBody><a:p><a:r><a:rPr><a:hlinkClick r:id="rId9"/></a:rPr><a:t>Read more</a:t></a:r></a:p></p:txBody></p:sp></p:sld>"#;
        let relationships = HashMap::from([(
            "rId9".to_string(),
            ("https://example.com".to_string(), "External".to_string()),
        )]);
        let objects = presentation_slide_objects(
            xml,
            vec![],
            &relationships,
            &HashMap::new(),
            &HashMap::new(),
        );
        assert_eq!(
            objects[0]["textRuns"][0]["runs"][0]["link"],
            json!({"uri":"https://example.com","isExternal":true})
        );
    }

    #[test]
    fn presentation_notes_read_only_body_placeholder_text() {
        let xml = r#"<p:notes><p:sp><p:nvSpPr><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>7</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Source: report.</a:t></a:r></a:p><a:p><a:r><a:t>Check the period.</a:t></a:r></a:p></p:txBody></p:sp></p:notes>"#;
        assert_eq!(
            presentation_notes_text(xml),
            "Source: report.\nCheck the period."
        );
    }

    #[test]
    fn presentation_import_reconstructs_cached_line_chart_series() {
        let frame = r#"<p:graphicFrame><p:xfrm><a:off x="9525" y="19050"/><a:ext cx="381000" cy="190500"/></p:xfrm><c:chart r:id="rId1"/></p:graphicFrame>"#;
        let chart = r#"<c:chartSpace><c:chart><c:plotArea><c:lineChart><c:ser><c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>Revenue</c:v></c:pt></c:strCache></c:strRef></c:tx><c:cat><c:strRef><c:strCache><c:pt idx="0"><c:v>Q1</c:v></c:pt><c:pt idx="1"><c:v>Q2</c:v></c:pt></c:strCache></c:strRef></c:cat><c:val><c:numRef><c:numCache><c:pt idx="0"><c:v>12</c:v></c:pt><c:pt idx="1"><c:v>18</c:v></c:pt></c:numCache></c:numRef></c:val></c:ser></c:lineChart></c:plotArea></c:chart></c:chartSpace>"#;
        let object = super::presentation_chart_object(frame, chart).unwrap();
        assert_eq!(object["kind"], "chart");
        assert_eq!(object["type"], "line");
        assert_eq!(object["series"][0]["name"], "Revenue");
        assert_eq!(object["series"][0]["labels"], json!(["Q1", "Q2"]));
        assert_eq!(object["series"][0]["values"], json!([12.0, 18.0]));
        assert_eq!(object["options"]["x"], json!(1.0));
    }
}

fn read_ooxml_part<R: std::io::Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    name: &str,
) -> Result<String, ArtifactError> {
    let entry = archive
        .by_name(name)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut xml = String::new();
    entry
        .take(2 * 1024 * 1024 + 1)
        .read_to_string(&mut xml)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if xml.len() > 2 * 1024 * 1024 {
        return Err(ArtifactError::new(
            "ooxml_read_error",
            format!("{name} exceeds the 2 MiB XML limit"),
        ));
    }
    Ok(xml)
}

fn read_ooxml_binary_part<R: std::io::Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    name: &str,
) -> Result<Vec<u8>, ArtifactError> {
    const MAX_MEDIA_BYTES: u64 = 16 * 1024 * 1024;
    let entry = archive
        .by_name(name)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if entry.size() > MAX_MEDIA_BYTES {
        return Err(ArtifactError::new(
            "ooxml_read_error",
            format!("{name} exceeds the 16 MiB media limit"),
        ));
    }
    let mut bytes = Vec::with_capacity(entry.size() as usize);
    entry
        .take(MAX_MEDIA_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if bytes.len() as u64 > MAX_MEDIA_BYTES {
        return Err(ArtifactError::new(
            "ooxml_read_error",
            format!("{name} exceeds the 16 MiB media limit"),
        ));
    }
    Ok(bytes)
}

fn docx_items(xml: &str) -> Vec<Value> {
    let mut items = Vec::new();
    let tables = ooxml::blocks(xml, "w:tbl");
    for paragraph in ooxml::blocks(xml, "w:p") {
        if tables.iter().any(|table| table.contains(&paragraph)) {
            continue;
        }
        let text = ooxml::text_values(&paragraph, "w:t").join("");
        if text.trim().is_empty() {
            continue;
        }
        let style = ooxml::attribute_values(&paragraph, "w:pStyle", "w:val")
            .first()
            .cloned();
        let item = if let Some(style) = style
            .as_deref()
            .filter(|style| style.starts_with("Heading"))
        {
            let level = style
                .trim_start_matches("Heading")
                .parse::<u8>()
                .unwrap_or(1);
            json!({"kind": "heading", "text": text, "level": level})
        } else {
            json!({"kind": "paragraph", "text": text})
        };
        items.push(item);
    }
    for table in tables {
        let rows = ooxml::blocks(&table, "w:tr")
            .into_iter()
            .map(|row| {
                ooxml::blocks(&row, "w:tc")
                    .into_iter()
                    .map(|cell| ooxml::text_values(&cell, "w:t").join(""))
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>();
        if !rows.is_empty() {
            items.push(json!({"kind": "table", "rows": rows}));
        }
    }
    items
}
