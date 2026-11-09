use std::fs;
use std::path::{Path, PathBuf};

use image::ImageReader;
use lopdf::Document;
use pdf_writer::{Content, Finish, Name, Pdf, Rect, Ref, Str};
use serde::Deserialize;

use crate::artifact_model::{
    ArtifactDocument, ArtifactElement, ArtifactSection, MAX_ARTIFACT_BYTES, MAX_ARTIFACT_ELEMENTS,
    MAX_ARTIFACT_SECTIONS,
};

const MAX_PDF_PAGES: usize = MAX_ARTIFACT_SECTIONS;
const MAX_PDF_TEXT_BLOCKS: usize = MAX_ARTIFACT_ELEMENTS;
const MAX_PDF_TEXT_BYTES_PER_PAGE: usize = 2 * 1024 * 1024;
const MAX_PDF_PAGE_WIDTH: f32 = 4096.0;
const MAX_PDF_PAGE_HEIGHT: f32 = 4096.0;

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct PdfTextBlock {
    pub(crate) text: String,
    pub(crate) x: f32,
    pub(crate) y: f32,
    pub(crate) size: f32,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub(crate) struct PdfPageSpec {
    pub(crate) width: f32,
    pub(crate) height: f32,
    pub(crate) blocks: Vec<PdfTextBlock>,
    #[serde(default)]
    pub(crate) tables: Vec<PdfTableSpec>,
    #[serde(default)]
    pub(crate) images: Vec<PdfImageSpec>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub(crate) struct PdfTableSpec {
    pub(crate) rows: Vec<Vec<String>>,
    pub(crate) x: f32,
    pub(crate) y: f32,
    #[serde(default = "default_table_row_height")]
    pub(crate) row_height: f32,
    #[serde(default = "default_table_font_size")]
    pub(crate) font_size: f32,
    #[serde(default)]
    pub(crate) column_widths: Vec<f32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub(crate) struct PdfImageSpec {
    pub(crate) path: String,
    pub(crate) x: f32,
    pub(crate) y: f32,
    pub(crate) width: f32,
    pub(crate) height: f32,
}

fn default_table_row_height() -> f32 {
    24.0
}

fn default_table_font_size() -> f32 {
    10.0
}

#[derive(Debug)]
pub(crate) struct PdfInspection {
    pub(crate) page_count: usize,
    pub(crate) text: Vec<String>,
}

pub(crate) fn create_pdf_bytes(pages: &[PdfPageSpec]) -> Result<Vec<u8>, String> {
    create_pdf_bytes_with_roots(pages, &[])
}

pub(crate) fn create_pdf_bytes_with_roots(
    pages: &[PdfPageSpec],
    allowed_roots: &[PathBuf],
) -> Result<Vec<u8>, String> {
    if pages.is_empty() {
        return Err("PDF must contain at least one page".to_string());
    }
    if pages.len() > MAX_PDF_PAGES {
        return Err(format!("PDF is limited to {MAX_PDF_PAGES} pages"));
    }

    let catalog_id = Ref::new(1);
    let page_tree_id = Ref::new(2);
    let font_id = Ref::new(3);
    let page_ids = pages
        .iter()
        .enumerate()
        .map(|(index, _)| Ref::new(4 + (index as i32) * 2))
        .collect::<Vec<_>>();

    let mut pdf = Pdf::new();
    pdf.catalog(catalog_id).pages(page_tree_id);
    pdf.pages(page_tree_id)
        .kids(page_ids.iter().copied())
        .count(page_ids.len() as i32);
    pdf.type1_font(font_id).base_font(Name(b"Helvetica"));

    for (index, page_spec) in pages.iter().enumerate() {
        validate_page_spec(page_spec)?;
        let page_id = page_ids[index];
        let content_id = Ref::new(5 + (index as i32) * 2);
        {
            let mut page = pdf.page(page_id);
            page.media_box(Rect::new(0.0, 0.0, page_spec.width, page_spec.height));
            page.parent(page_tree_id);
            page.contents(content_id);
            {
                let mut resources = page.resources();
                resources.fonts().pair(Name(b"F1"), font_id);
                for image_index in 0..page_spec.images.len() {
                    let image_id = Ref::new(100 + (index as i32) * 32 + image_index as i32);
                    let image_name = format!("Im{image_index}");
                    resources
                        .x_objects()
                        .pair(Name(image_name.as_bytes()), image_id);
                }
            }
            page.finish();
        }

        let mut content = Content::new();
        content.begin_text();
        for block in page_spec.blocks.iter().take(MAX_PDF_TEXT_BLOCKS) {
            content.set_font(Name(b"F1"), block.size);
            content.set_text_matrix([1.0, 0.0, 0.0, 1.0, block.x, block.y]);
            content.show(Str(&pdf_text_bytes(&block.text)));
        }
        content.end_text();
        for table in &page_spec.tables {
            write_table(&mut content, table)?;
        }
        for (image_index, image_spec) in page_spec.images.iter().enumerate() {
            let image = load_image(image_spec, allowed_roots)?;
            let image_id = Ref::new(100 + (index as i32) * 32 + image_index as i32);
            let image_name = format!("Im{image_index}");
            let mut image_object = pdf.image_xobject(image_id, &image.samples);
            image_object
                .width(image.width as i32)
                .height(image.height as i32)
                .color_space_name(Name(b"DeviceRGB"))
                .bits_per_component(8);
            image_object.finish();
            content
                .save_state()
                .transform([
                    image_spec.width,
                    0.0,
                    0.0,
                    image_spec.height,
                    image_spec.x,
                    image_spec.y,
                ])
                .x_object(Name(image_name.as_bytes()))
                .restore_state();
        }
        let content_bytes = content.finish();
        pdf.stream(content_id, &content_bytes);
    }

    let bytes = pdf.finish();
    if bytes.len() as u64 > MAX_ARTIFACT_BYTES {
        return Err("generated PDF exceeds the 16 MiB limit".to_string());
    }
    Ok(bytes)
}

pub(crate) fn inspect_pdf_bytes(bytes: &[u8]) -> Result<PdfInspection, String> {
    if bytes.is_empty() {
        return Err("PDF is empty".to_string());
    }
    if bytes.len() as u64 > MAX_ARTIFACT_BYTES {
        return Err("PDF exceeds the 16 MiB limit".to_string());
    }
    let document = Document::load_mem(bytes).map_err(|error| format!("invalid PDF: {error}"))?;
    if document.is_encrypted() {
        return Err("encrypted PDFs are not supported".to_string());
    }
    let pages = document.get_pages();
    if pages.is_empty() {
        return Err("PDF contains no pages".to_string());
    }
    if pages.len() > MAX_PDF_PAGES {
        return Err(format!("PDF is limited to {MAX_PDF_PAGES} pages"));
    }
    let text = pages
        .keys()
        .map(|page_number| {
            document
                .extract_text_with_limit(&[*page_number], MAX_PDF_TEXT_BYTES_PER_PAGE)
                .map(|value| normalize_page_text(&value))
                .map_err(|error| format!("failed to extract PDF page {page_number}: {error}"))
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(PdfInspection {
        page_count: pages.len(),
        text,
    })
}

pub(crate) fn preview_pdf_bytes(bytes: &[u8]) -> Result<ArtifactDocument, String> {
    let inspection = inspect_pdf_bytes(bytes)?;
    let sections = inspection
        .text
        .iter()
        .enumerate()
        .map(|(index, text)| {
            let elements = if text.is_empty() {
                vec![ArtifactElement::Unsupported {
                    kind: "empty_page".to_string(),
                    message: "page contains no extractable text".to_string(),
                }]
            } else {
                text.lines()
                    .filter(|line| !line.trim().is_empty())
                    .take(MAX_PDF_TEXT_BLOCKS)
                    .map(|line| ArtifactElement::Text {
                        value: line.trim().to_string(),
                    })
                    .collect()
            };
            ArtifactSection::new(format!("Page {}", index + 1), elements)
        })
        .collect();
    Ok(ArtifactDocument::new(
        "pdf",
        bytes.len() as u64,
        sections,
        Vec::new(),
    ))
}

fn validate_page_spec(page: &PdfPageSpec) -> Result<(), String> {
    if !page.width.is_finite()
        || !page.height.is_finite()
        || page.width <= 0.0
        || page.height <= 0.0
        || page.width > MAX_PDF_PAGE_WIDTH
        || page.height > MAX_PDF_PAGE_HEIGHT
    {
        return Err("PDF page dimensions are outside the supported range".to_string());
    }
    if page.blocks.len() > MAX_PDF_TEXT_BLOCKS {
        return Err(format!(
            "PDF is limited to {MAX_PDF_TEXT_BLOCKS} text blocks per page"
        ));
    }
    if page.tables.len() + page.images.len() > MAX_PDF_TEXT_BLOCKS {
        return Err(format!(
            "PDF is limited to {MAX_PDF_TEXT_BLOCKS} visual elements per page"
        ));
    }
    for block in &page.blocks {
        if !block.x.is_finite()
            || !block.y.is_finite()
            || !block.size.is_finite()
            || block.size <= 0.0
            || block.size > 256.0
        {
            return Err("PDF text block coordinates or size are invalid".to_string());
        }
        if block.text.len() > MAX_PDF_TEXT_BYTES_PER_PAGE {
            return Err("PDF text block exceeds the 2 MiB page limit".to_string());
        }
    }
    for table in &page.tables {
        validate_table(table)?;
    }
    for image in &page.images {
        if !image.x.is_finite()
            || !image.y.is_finite()
            || !image.width.is_finite()
            || !image.height.is_finite()
            || image.width <= 0.0
            || image.height <= 0.0
        {
            return Err("PDF image coordinates or size are invalid".to_string());
        }
    }
    Ok(())
}

fn validate_table(table: &PdfTableSpec) -> Result<(), String> {
    if table.rows.is_empty() || table.rows.iter().any(Vec::is_empty) {
        return Err("PDF tables must contain at least one column".to_string());
    }
    let columns = table.rows[0].len();
    if table.rows.iter().any(|row| row.len() != columns) {
        return Err("PDF table rows must be rectangular".to_string());
    }
    if table.rows.len() > MAX_PDF_TEXT_BLOCKS || columns > 64 {
        return Err("PDF table is too large".to_string());
    }
    if !table.x.is_finite()
        || !table.y.is_finite()
        || !table.row_height.is_finite()
        || !table.font_size.is_finite()
        || table.row_height <= 0.0
        || table.font_size <= 0.0
        || table.font_size > 256.0
    {
        return Err("PDF table coordinates or sizes are invalid".to_string());
    }
    if !table.column_widths.is_empty()
        && (table.column_widths.len() != columns
            || table
                .column_widths
                .iter()
                .any(|width| !width.is_finite() || *width <= 0.0))
    {
        return Err("PDF table column widths are invalid".to_string());
    }
    Ok(())
}

fn write_table(content: &mut Content, table: &PdfTableSpec) -> Result<(), String> {
    let columns = table.rows[0].len();
    let widths = if table.column_widths.is_empty() {
        vec![120.0; columns]
    } else {
        table.column_widths.clone()
    };
    let total_width = widths.iter().sum::<f32>();
    let total_height = table.rows.len() as f32 * table.row_height;
    content.set_stroke_color([0.75, 0.78, 0.82]);
    content.set_line_width(0.5);
    for row in 0..=table.rows.len() {
        let y = table.y - row as f32 * table.row_height;
        content
            .move_to(table.x, y)
            .line_to(table.x + total_width, y)
            .stroke();
    }
    let mut x = table.x;
    for width in &widths {
        content
            .move_to(x, table.y)
            .line_to(x, table.y - total_height)
            .stroke();
        x += width;
    }
    content
        .move_to(table.x + total_width, table.y)
        .line_to(table.x + total_width, table.y - total_height)
        .stroke();

    content.begin_text();
    for (row_index, row) in table.rows.iter().enumerate() {
        let mut cell_x = table.x;
        let baseline = table.y - row_index as f32 * table.row_height - table.row_height + 7.0;
        for (column_index, value) in row.iter().enumerate() {
            content
                .set_font(Name(b"F1"), table.font_size)
                .set_text_matrix([1.0, 0.0, 0.0, 1.0, cell_x + 4.0, baseline])
                .show(Str(&pdf_text_bytes(value)));
            cell_x += widths[column_index];
        }
    }
    content.end_text();
    Ok(())
}

struct LoadedImage {
    width: u32,
    height: u32,
    samples: Vec<u8>,
}

fn load_image(image: &PdfImageSpec, allowed_roots: &[PathBuf]) -> Result<LoadedImage, String> {
    let path = Path::new(&image.path);
    if !path.is_absolute() {
        return Err("PDF image paths must be absolute".to_string());
    }
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("PDF image cannot be opened: {error}"))?;
    if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
        return Err("PDF image path must be a regular file".to_string());
    }
    if metadata.len() > 4 * 1024 * 1024 {
        return Err("PDF image exceeds the 4 MiB limit".to_string());
    }
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());
    if !matches!(extension.as_deref(), Some("png" | "jpg" | "jpeg")) {
        return Err("PDF images must be PNG or JPEG files".to_string());
    }
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("PDF image path cannot be resolved: {error}"))?;
    if !allowed_roots.is_empty() && !allowed_roots.iter().any(|root| canonical.starts_with(root)) {
        return Err("PDF image path is outside the allowed roots".to_string());
    }
    let mut reader = ImageReader::open(&canonical)
        .map_err(|error| format!("failed to read PDF image: {error}"))?;
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(2048);
    limits.max_image_height = Some(2048);
    limits.max_alloc = Some(32 * 1024 * 1024);
    reader.limits(limits);
    let image = reader
        .decode()
        .map_err(|error| format!("invalid PDF image: {error}"))?
        .to_rgb8();
    let (width, height) = image.dimensions();
    Ok(LoadedImage {
        width,
        height,
        samples: image.into_raw(),
    })
}

fn pdf_text_bytes(value: &str) -> Vec<u8> {
    value
        .bytes()
        .map(|byte| match byte {
            32..=126 => byte,
            _ => b'?',
        })
        .collect()
}

fn normalize_page_text(value: &str) -> String {
    value
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod tests {
    use super::{
        PdfImageSpec, PdfPageSpec, PdfTableSpec, PdfTextBlock, create_pdf_bytes,
        create_pdf_bytes_with_roots, inspect_pdf_bytes, preview_pdf_bytes,
    };

    #[test]
    fn creates_inspects_and_previews_a_bounded_multi_page_pdf() {
        let pages = vec![
            PdfPageSpec {
                width: 595.0,
                height: 842.0,
                blocks: vec![PdfTextBlock {
                    text: "Page one".to_string(),
                    x: 48.0,
                    y: 780.0,
                    size: 18.0,
                }],
                ..Default::default()
            },
            PdfPageSpec {
                width: 595.0,
                height: 842.0,
                blocks: vec![PdfTextBlock {
                    text: "Page two".to_string(),
                    x: 48.0,
                    y: 780.0,
                    size: 18.0,
                }],
                ..Default::default()
            },
        ];

        let bytes = create_pdf_bytes(&pages).unwrap();
        assert!(bytes.starts_with(b"%PDF-"));
        let inspection = inspect_pdf_bytes(&bytes).unwrap();
        assert_eq!(inspection.page_count, 2);
        assert_eq!(inspection.text, vec!["Page one", "Page two"]);
        let preview = preview_pdf_bytes(&bytes).unwrap();
        assert_eq!(preview.sections.len(), 2);
    }

    #[test]
    fn creates_a_table_and_embeds_a_local_png_within_the_allowed_root() {
        let root = std::env::temp_dir().join(format!("ruxex-pdf-image-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).unwrap();
        let image_path = root.join("sample.png");
        let image = image::RgbImage::from_pixel(2, 2, image::Rgb([220, 40, 40]));
        image.save(&image_path).unwrap();
        let pages = vec![PdfPageSpec {
            width: 595.0,
            height: 842.0,
            blocks: Vec::new(),
            tables: vec![PdfTableSpec {
                rows: vec![vec!["Name".to_string(), "Value".to_string()]],
                x: 48.0,
                y: 760.0,
                row_height: 24.0,
                font_size: 10.0,
                ..Default::default()
            }],
            images: vec![PdfImageSpec {
                path: image_path.to_string_lossy().into_owned(),
                x: 48.0,
                y: 500.0,
                width: 120.0,
                height: 120.0,
            }],
        }];
        let bytes = create_pdf_bytes_with_roots(&pages, &[root.canonicalize().unwrap()]).unwrap();
        assert!(bytes.windows(b"Name".len()).any(|window| window == b"Name"));
        assert!(
            bytes
                .windows(b"/Subtype /Image".len())
                .any(|window| window == b"/Subtype /Image")
        );

        let outside =
            std::env::temp_dir().join(format!("ruxex-pdf-outside-{}.png", std::process::id()));
        image.save(&outside).unwrap();
        let mut outside_page = pages[0].clone();
        outside_page.images[0].path = outside.to_string_lossy().into_owned();
        let error = create_pdf_bytes_with_roots(&[outside_page], &[root.canonicalize().unwrap()])
            .unwrap_err();
        assert!(error.contains("outside the allowed roots"));
        let _ = std::fs::remove_file(outside);
        let _ = std::fs::remove_dir_all(root);
    }
}
