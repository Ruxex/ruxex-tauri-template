use serde::Serialize;

pub const MAX_ARTIFACT_BYTES: u64 = 16 * 1024 * 1024;
pub const MAX_ARTIFACT_SECTIONS: usize = 4;
pub const MAX_ARTIFACT_ELEMENTS: usize = 512;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactDocument {
    pub format: String,
    pub byte_size: u64,
    pub sections: Vec<ArtifactSection>,
    pub diagnostics: Vec<ArtifactDiagnostic>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactSection {
    pub label: String,
    pub elements: Vec<ArtifactElement>,
}

impl ArtifactSection {
    pub fn new(label: impl Into<String>, elements: Vec<ArtifactElement>) -> Self {
        Self {
            label: label.into(),
            elements,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
#[allow(dead_code)]
pub enum ArtifactElement {
    Text { value: String },
    Table { rows: Vec<Vec<String>> },
    Shape { kind: String },
    Chart { kind: String },
    Image { asset_id: String },
    Unsupported { kind: String, message: String },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct ArtifactAsset {
    pub id: String,
    pub mime_type: String,
    pub data_url: String,
    pub byte_size: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactDiagnostic {
    pub code: String,
    pub message: String,
    pub section: Option<String>,
}

impl ArtifactDiagnostic {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            section: None,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactPreviewPage {
    pub label: String,
    pub data_url: String,
    pub width: usize,
    pub height: usize,
    pub diagnostics: Vec<String>,
}

impl ArtifactDocument {
    pub fn new(
        format: impl Into<String>,
        byte_size: u64,
        mut sections: Vec<ArtifactSection>,
        mut diagnostics: Vec<ArtifactDiagnostic>,
    ) -> Self {
        if byte_size > MAX_ARTIFACT_BYTES {
            diagnostics.push(ArtifactDiagnostic::new(
                "byte_limit",
                "artifact exceeds the 16 MiB native model limit",
            ));
        }
        if sections.len() > MAX_ARTIFACT_SECTIONS {
            sections.truncate(MAX_ARTIFACT_SECTIONS);
            diagnostics.push(ArtifactDiagnostic::new(
                "section_limit",
                "artifact preview is limited to four sections",
            ));
        }
        for section in &mut sections {
            if section.elements.len() > MAX_ARTIFACT_ELEMENTS {
                section.elements.truncate(MAX_ARTIFACT_ELEMENTS);
                diagnostics.push(ArtifactDiagnostic {
                    code: "element_limit".to_string(),
                    message: "artifact section exceeded the native element limit".to_string(),
                    section: Some(section.label.clone()),
                });
            }
        }
        Self {
            format: format.into(),
            byte_size,
            sections,
            diagnostics,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{ArtifactDocument, ArtifactElement, ArtifactSection};

    #[test]
    fn bounds_sections_and_records_a_diagnostic() {
        let sections = (0..8)
            .map(|index| ArtifactSection::new(format!("Section {index}"), Vec::new()))
            .collect();

        let document = ArtifactDocument::new("xlsx", 128, sections, Vec::new());

        assert_eq!(document.sections.len(), 4);
        assert!(
            document
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "section_limit")
        );
    }

    #[test]
    fn preserves_section_order_and_unsupported_elements() {
        let sections = vec![
            ArtifactSection::new(
                "First",
                vec![ArtifactElement::Unsupported {
                    kind: "macro".to_string(),
                    message: "macros are not executed".to_string(),
                }],
            ),
            ArtifactSection::new("Second", Vec::new()),
        ];

        let document = ArtifactDocument::new("docx", 256, sections, Vec::new());

        assert_eq!(document.sections[0].label, "First");
        assert_eq!(document.sections[1].label, "Second");
        assert!(matches!(
            document.sections[0].elements[0],
            ArtifactElement::Unsupported { .. }
        ));
    }

    #[test]
    fn rejects_documents_over_the_byte_limit() {
        let document = ArtifactDocument::new("pdf", u64::MAX, Vec::new(), Vec::new());

        assert!(
            document
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "byte_limit")
        );
    }
}
