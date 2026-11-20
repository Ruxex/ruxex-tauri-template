use super::*;

#[derive(Clone, Debug)]
struct XmlElement {
    name: String,
    attributes: Vec<(String, String)>,
    children: Vec<XmlContent>,
}

#[derive(Clone, Debug)]
enum XmlContent {
    Element(XmlElement),
    Text(String),
    Raw(String),
}

#[derive(Clone, Debug)]
struct XmlDocument {
    before_root: Vec<String>,
    root: XmlElement,
    after_root: Vec<String>,
}

impl XmlElement {
    fn local_name(&self) -> &str {
        self.name.rsplit(':').next().unwrap_or(&self.name)
    }

    fn is_word(&self, local: &str) -> bool {
        self.name == format!("w:{local}") || self.name == local
    }

    fn attr(&self, name: &str) -> Option<&str> {
        self.attributes
            .iter()
            .find_map(|(key, value)| (key == name).then_some(value.as_str()))
            .or_else(|| {
                let local = name.rsplit(':').next().unwrap_or(name);
                self.attributes.iter().find_map(|(key, value)| {
                    (key.rsplit(':').next().unwrap_or(key) == local).then_some(value.as_str())
                })
            })
    }

    fn set_attr(&mut self, name: &str, value: impl Into<String>) {
        let value = value.into();
        if let Some((_, current)) = self.attributes.iter_mut().find(|(key, _)| key == name) {
            *current = value;
        } else {
            self.attributes.push((name.to_owned(), value));
        }
    }

    fn child_indices(&self, local: &str) -> Vec<usize> {
        self.children
            .iter()
            .enumerate()
            .filter_map(|(index, child)| match child {
                XmlContent::Element(element) if element.is_word(local) => Some(index),
                _ => None,
            })
            .collect()
    }

    fn first_child(&self, local: &str) -> Option<&XmlElement> {
        self.children.iter().find_map(|child| match child {
            XmlContent::Element(element) if element.is_word(local) => Some(element),
            _ => None,
        })
    }

    fn first_child_mut(&mut self, local: &str) -> Option<&mut XmlElement> {
        self.children.iter_mut().find_map(|child| match child {
            XmlContent::Element(element) if element.is_word(local) => Some(element),
            _ => None,
        })
    }

    fn text_content(&self) -> String {
        let mut text = String::new();
        self.append_text(&mut text);
        text
    }

    fn append_text(&self, text: &mut String) {
        if self.is_word("t") {
            for child in &self.children {
                if let XmlContent::Text(value) = child {
                    text.push_str(value);
                }
            }
            return;
        }
        for child in &self.children {
            match child {
                XmlContent::Element(element) => element.append_text(text),
                _ => {}
            }
        }
    }

    fn ensure_child_ordered(&mut self, local: &str, order: &[&str]) -> &mut XmlElement {
        let existing = self.children.iter().position(
            |child| matches!(child, XmlContent::Element(element) if element.is_word(local)),
        );
        if let Some(index) = existing {
            return match &mut self.children[index] {
                XmlContent::Element(element) => element,
                _ => unreachable!(),
            };
        }
        let target_position = order.iter().position(|name| *name == local);
        let insertion_index = if local == "pPr" {
            0
        } else {
            self.children.iter().position(|child| {
            let XmlContent::Element(element) = child else {
                return false;
            };
            let current_position = order.iter().position(|name| *name == element.local_name());
            matches!((target_position, current_position), (Some(target), Some(current)) if current > target)
            }).unwrap_or(self.children.len())
        };
        self.children.insert(
            insertion_index,
            XmlContent::Element(XmlElement {
                name: format!("w:{local}"),
                attributes: Vec::new(),
                children: Vec::new(),
            }),
        );
        match &mut self.children[insertion_index] {
            XmlContent::Element(element) => element,
            _ => unreachable!(),
        }
    }
}

impl XmlDocument {
    fn parse(xml: &str) -> Result<Self, ArtifactError> {
        use quick_xml::events::Event;
        let mut reader = quick_xml::Reader::from_str(xml);
        reader.config_mut().trim_text(false);
        reader.config_mut().check_end_names = true;
        let mut stack = Vec::<XmlElement>::new();
        let mut root = None::<XmlElement>;
        let mut before_root = Vec::new();
        let mut after_root = Vec::new();
        loop {
            let event = reader
                .read_event()
                .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
            match event {
                Event::Start(start) => stack.push(parse_element_start(&start, reader.decoder())?),
                Event::Empty(start) => {
                    let element = parse_element_start(&start, reader.decoder())?;
                    attach_element(element, &mut stack, &mut root)?;
                }
                Event::End(_) => {
                    let element = stack.pop().ok_or_else(|| {
                        ArtifactError::new("invalid_ooxml_xml", "unexpected XML closing tag")
                    })?;
                    attach_element(element, &mut stack, &mut root)?;
                }
                Event::Text(text) => {
                    let decoded = text.decode().map_err(|error| {
                        ArtifactError::new("invalid_ooxml_xml", error.to_string())
                    })?;
                    let decoded = quick_xml::escape::unescape(&decoded).map_err(|error| {
                        ArtifactError::new("invalid_ooxml_xml", error.to_string())
                    })?;
                    if let Some(parent) = stack.last_mut() {
                        parent.children.push(XmlContent::Text(decoded.into_owned()));
                    } else if root.is_none() {
                        before_root.push(escape_xml_text(&decoded));
                    } else {
                        after_root.push(escape_xml_text(&decoded));
                    }
                }
                Event::CData(data) => {
                    let decoded = data.decode().map_err(|error| {
                        ArtifactError::new("invalid_ooxml_xml", error.to_string())
                    })?;
                    attach_raw(
                        format!("<![CDATA[{decoded}]]>"),
                        &mut stack,
                        root.is_some(),
                        &mut before_root,
                        &mut after_root,
                    );
                }
                Event::Comment(comment) => {
                    let value = comment.decode().map_err(|error| {
                        ArtifactError::new("invalid_ooxml_xml", error.to_string())
                    })?;
                    attach_raw(
                        format!("<!--{value}-->"),
                        &mut stack,
                        root.is_some(),
                        &mut before_root,
                        &mut after_root,
                    );
                }
                Event::Decl(declaration) => attach_raw(
                    format!("<?{}?>", String::from_utf8_lossy(declaration.as_ref())),
                    &mut stack,
                    root.is_some(),
                    &mut before_root,
                    &mut after_root,
                ),
                Event::PI(instruction) => attach_raw(
                    format!("<?{}?>", String::from_utf8_lossy(instruction.as_ref())),
                    &mut stack,
                    root.is_some(),
                    &mut before_root,
                    &mut after_root,
                ),
                Event::DocType(declaration) => attach_raw(
                    format!(
                        "<!DOCTYPE{}>",
                        String::from_utf8_lossy(declaration.as_ref())
                    ),
                    &mut stack,
                    root.is_some(),
                    &mut before_root,
                    &mut after_root,
                ),
                Event::GeneralRef(reference) => {
                    let name = reference.decode().map_err(|error| {
                        ArtifactError::new("invalid_ooxml_xml", error.to_string())
                    })?;
                    let decoded = match name.as_ref() {
                        "amp" => "&".to_owned(),
                        "lt" => "<".to_owned(),
                        "gt" => ">".to_owned(),
                        "apos" => "'".to_owned(),
                        "quot" => "\"".to_owned(),
                        _ => format!("&{name};"),
                    };
                    if let Some(parent) = stack.last_mut() {
                        parent.children.push(XmlContent::Text(decoded));
                    }
                }
                Event::Eof => break,
            }
        }
        if !stack.is_empty() {
            return Err(ArtifactError::new(
                "invalid_ooxml_xml",
                "XML contains unclosed elements",
            ));
        }
        Ok(Self {
            before_root,
            root: root.ok_or_else(|| {
                ArtifactError::new("invalid_ooxml_xml", "XML document has no root element")
            })?,
            after_root,
        })
    }

    fn to_xml(&self) -> String {
        let mut xml = self.before_root.join("");
        write_element(&self.root, &mut xml);
        xml.push_str(&self.after_root.join(""));
        xml
    }
}

fn parse_element_start(
    start: &quick_xml::events::BytesStart<'_>,
    decoder: quick_xml::encoding::Decoder,
) -> Result<XmlElement, ArtifactError> {
    let name = std::str::from_utf8(start.name().as_ref())
        .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
        .to_owned();
    let mut attributes = Vec::new();
    for attribute in start.attributes().with_checks(true) {
        let attribute = attribute
            .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
        let key = std::str::from_utf8(attribute.key.as_ref())
            .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
            .to_owned();
        let value = attribute
            .decode_and_unescape_value(decoder)
            .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
            .into_owned();
        attributes.push((key, value));
    }
    Ok(XmlElement {
        name,
        attributes,
        children: Vec::new(),
    })
}

fn attach_element(
    element: XmlElement,
    stack: &mut [XmlElement],
    root: &mut Option<XmlElement>,
) -> Result<(), ArtifactError> {
    if let Some(parent) = stack.last_mut() {
        parent.children.push(XmlContent::Element(element));
    } else if root.replace(element).is_some() {
        return Err(ArtifactError::new(
            "invalid_ooxml_xml",
            "XML document contains multiple root elements",
        ));
    }
    Ok(())
}

fn attach_raw(
    value: String,
    stack: &mut [XmlElement],
    has_root: bool,
    before_root: &mut Vec<String>,
    after_root: &mut Vec<String>,
) {
    if let Some(parent) = stack.last_mut() {
        parent.children.push(XmlContent::Raw(value));
    } else if has_root {
        after_root.push(value);
    } else {
        before_root.push(value);
    }
}

fn write_element(element: &XmlElement, xml: &mut String) {
    xml.push('<');
    xml.push_str(&element.name);
    for (name, value) in &element.attributes {
        xml.push(' ');
        xml.push_str(name);
        xml.push_str("=\"");
        xml.push_str(&escape_xml_attribute(value));
        xml.push('"');
    }
    if element.children.is_empty() {
        xml.push_str("/>");
        return;
    }
    xml.push('>');
    for child in &element.children {
        match child {
            XmlContent::Element(child) => write_element(child, xml),
            XmlContent::Text(text) => xml.push_str(&escape_xml_text(text)),
            XmlContent::Raw(raw) => xml.push_str(raw),
        }
    }
    xml.push_str("</");
    xml.push_str(&element.name);
    xml.push('>');
}

const PPR_ORDER: &[&str] = &[
    "pStyle",
    "keepNext",
    "keepLines",
    "pageBreakBefore",
    "framePr",
    "widowControl",
    "numPr",
    "suppressLineNumbers",
    "pBdr",
    "shd",
    "tabs",
    "suppressAutoHyphens",
    "kinsoku",
    "wordWrap",
    "overflowPunct",
    "topLinePunct",
    "autoSpaceDE",
    "autoSpaceDN",
    "bidi",
    "adjustRightInd",
    "snapToGrid",
    "spacing",
    "ind",
    "contextualSpacing",
    "mirrorIndents",
    "jc",
    "textDirection",
    "textAlignment",
    "textboxTightWrap",
    "outlineLvl",
    "divId",
    "cnfStyle",
    "rPr",
    "sectPr",
    "pPrChange",
];

const RPR_ORDER: &[&str] = &[
    "rStyle", "rFonts", "b", "bCs", "i", "iCs", "caps", "smallCaps", "strike",
    "dstrike", "outline", "shadow", "emboss", "imprint", "noProof", "snapToGrid",
    "vanish", "webHidden", "color", "spacing", "w", "kern", "position", "sz",
    "szCs", "highlight", "u", "effect", "bdr", "shd", "fitText", "vertAlign",
    "rtl", "cs", "em", "lang", "eastAsianLayout", "specVanish", "oMath", "rPrChange",
];

const BUILTIN_STYLES: &[(&str, &str)] = &[
    ("normal", "Normal"),
    ("title", "Title"),
    ("subtitle", "Subtitle"),
    ("heading 1", "Heading1"),
    ("heading1", "Heading1"),
    ("heading 2", "Heading2"),
    ("heading2", "Heading2"),
    ("heading 3", "Heading3"),
    ("heading3", "Heading3"),
    ("heading 4", "Heading4"),
    ("heading4", "Heading4"),
    ("heading 5", "Heading5"),
    ("heading5", "Heading5"),
    ("heading 6", "Heading6"),
    ("heading6", "Heading6"),
    ("heading 7", "Heading7"),
    ("heading7", "Heading7"),
    ("heading 8", "Heading8"),
    ("heading8", "Heading8"),
    ("heading 9", "Heading9"),
    ("heading9", "Heading9"),
    ("caption", "Caption"),
    ("quote", "Quote"),
    ("intense quote", "IntenseQuote"),
    ("list paragraph", "ListParagraph"),
    ("no spacing", "NoSpacing"),
    ("body text", "BodyText"),
    ("header", "Header"),
    ("footer", "Footer"),
    ("footnote text", "FootnoteText"),
    ("endnote text", "EndnoteText"),
];

pub(super) fn command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(
            flag.as_str(),
            "input" | "output" | "operations-file" | "--json"
        ) {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    let input = cli::required_flag(&flags, "input")?;
    let output = cli::required_flag(&flags, "output")?;
    let operations_file = cli::required_flag(&flags, "operations-file")?;
    let operations_bytes = fs::read(operations_file)
        .map_err(|error| ArtifactError::new("invalid_arguments", error.to_string()))?;
    let operations: Value = serde_json::from_slice(&operations_bytes)
        .map_err(|error| ArtifactError::new("invalid_arguments", error.to_string()))?;
    let operations = operations
        .as_array()
        .filter(|operations| !operations.is_empty())
        .ok_or_else(|| {
            ArtifactError::new(
                "invalid_arguments",
                "operations must be a nonempty JSON array",
            )
        })?;
    let source = Path::new(input)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let file = File::open(&source)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let names = archive
        .file_names()
        .map(str::to_owned)
        .collect::<BTreeSet<_>>();
    if !names.contains("word/document.xml") {
        return Err(ArtifactError::new(
            "invalid_ooxml_package",
            "DOCX is missing word/document.xml",
        ));
    }
    let mut parts = BTreeMap::<String, XmlDocument>::new();
    for (operation_index, operation) in operations.iter().enumerate() {
        let operation = operation.as_object().ok_or_else(|| {
            ArtifactError::new("invalid_arguments", "each operation must be a JSON object")
        })?;
        let kind = operation.get("op").and_then(Value::as_str).ok_or_else(|| {
            ArtifactError::new(
                "invalid_arguments",
                "each operation must include a string op",
            )
        })?;
        let part = operation
            .get("part")
            .and_then(Value::as_str)
            .unwrap_or("document");
        if !valid_part_name(part) {
            return Err(ArtifactError::new(
                "invalid_arguments",
                "part must be document, headerN or footerN (N starts at 1)",
            ));
        }
        if part != "document"
            && !matches!(
                kind,
                "format_paragraph" | "format_run" | "replace_table_cell_text"
            )
        {
            return Err(ArtifactError::new(
                "invalid_arguments",
                "header/footer parts support only paragraph/run formatting and cell replacement",
            ));
        }
        let part_name = format!("word/{part}.xml");
        if !names.contains(&part_name) {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("DOCX is missing selected part: {part_name}"),
            ));
        }
        if !parts.contains_key(&part_name) {
            let mut bytes = Vec::new();
            archive
                .by_name(&part_name)
                .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?
                .take(MAX_DOCX_PART_BYTES + 1)
                .read_to_end(&mut bytes)
                .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
            if bytes.len() as u64 > MAX_DOCX_PART_BYTES {
                return Err(ArtifactError::new(
                    "ooxml_part_too_large",
                    format!("{part_name} exceeds the 2 MiB operation limit"),
                ));
            }
            let xml = String::from_utf8(bytes)
                .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
            let document = XmlDocument::parse(&xml)?;
            let expected_root = if part == "document" {
                "document"
            } else if part.starts_with("header") {
                "hdr"
            } else {
                "ftr"
            };
            if !document.root.is_word(expected_root) {
                return Err(ArtifactError::new(
                    "invalid_ooxml_xml",
                    format!("{part_name} has an unexpected root element"),
                ));
            }
            parts.insert(part_name.clone(), document);
        }
        let document = parts.get_mut(&part_name).expect("selected part was parsed");
        let body_index = if part == "document" {
            document
                .root
                .child_indices("body")
                .first()
                .copied()
                .ok_or_else(|| {
                    ArtifactError::new("invalid_ooxml_xml", "word/document.xml is missing w:body")
                })?
        } else {
            usize::MAX
        };
        if part == "document" {
            let XmlContent::Element(body) = &mut document.root.children[body_index] else {
                unreachable!()
            };
            apply_operation(body, operation, operation_index)?;
        } else {
            apply_operation(&mut document.root, operation, operation_index)?;
        }
    }
    drop(archive);
    let replacements = parts
        .into_iter()
        .map(|(name, document)| (name, document.to_xml().into_bytes()))
        .collect::<BTreeMap<_, _>>();
    let output_path = rewrite_docx_package(input, output, |name, bytes| {
        if let Some(replacement) = replacements.get(name) {
            *bytes = replacement.clone();
        }
        Ok(())
    })?;
    Ok(json!({
        "ok": true,
        "input": source,
        "output": output_path,
        "operationsApplied": operations.len(),
        "limitations": [
            "paragraph targets are top-level paragraphs in the selected document/headerN/footerN part and must match one substring uniquely",
            "structural table edits support simple body tables with a fixed explicit column grid; new rows clone the last row without its header flag",
            "paragraph style values are limited to the built-in styles listed by the helper",
            "table cell replacement collapses simple cell content to one paragraph",
            "table cell replacement refuses fields, comments, revisions, drawings, merges, hyperlinks, nested tables, and content controls",
            "run formatting matches a unique substring contained within one simple text run",
            "section layout edits only main document sectPr elements",
            "inserted tables use equal 9360-DXA widths when columnWidthsDxa is omitted"
        ]
    }))
}

fn valid_part_name(part: &str) -> bool {
    if part == "document" {
        return true;
    }
    ["header", "footer"].iter().any(|prefix| {
        part.strip_prefix(prefix).is_some_and(|number| {
            !number.is_empty()
                && !number.starts_with('0')
                && number.chars().all(|character| character.is_ascii_digit())
        })
    })
}

fn apply_operation(
    body: &mut XmlElement,
    operation: &serde_json::Map<String, Value>,
    _operation_index: usize,
) -> Result<(), ArtifactError> {
    let kind = operation.get("op").and_then(Value::as_str).unwrap_or_default();
    if kind == "format_run" {
        return format_run(body, operation);
    }
    if kind == "set_section_layout" {
        return set_section_layout(body, operation);
    }
    if kind != "format_paragraph" {
        return Err(ArtifactError::new(
            "invalid_arguments",
            format!("unsupported operation: {kind:?}"),
        ));
    }
    let allowed = [
        "op",
        "part",
        "contains",
        "style",
        "alignment",
        "spacingBefore",
        "spacingAfter",
        "keepWithNext",
        "pageBreakBefore",
    ];
    reject_unknown_fields(operation, &allowed, "format_paragraph")?;
    let substring = operation
        .get("contains")
        .and_then(Value::as_str)
        .filter(|substring| !substring.is_empty())
        .ok_or_else(|| {
            ArtifactError::new(
                "invalid_arguments",
                "format_paragraph requires a nonempty contains substring",
            )
        })?;
    let matches = body
        .child_indices("p")
        .into_iter()
        .filter(|index| {
            matches!(&body.children[*index], XmlContent::Element(paragraph) if paragraph.text_content().contains(substring))
        })
        .collect::<Vec<_>>();
    if matches.len() != 1 {
        return Err(ArtifactError::new(
            "invalid_arguments",
            format!(
                "format_paragraph target must match exactly one top-level paragraph; found {}",
                matches.len()
            ),
        ));
    }
    let XmlContent::Element(paragraph) = &mut body.children[matches[0]] else {
        unreachable!()
    };
    if ![
        "style",
        "alignment",
        "spacingBefore",
        "spacingAfter",
        "keepWithNext",
        "pageBreakBefore",
    ]
    .iter()
    .any(|key| operation.contains_key(*key))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "format_paragraph must specify at least one formatting property",
        ));
    }
    let properties = paragraph.ensure_child_ordered("pPr", &[]);
    if let Some(style) = operation.get("style") {
        let style = style_id(style)?;
        properties
            .ensure_child_ordered("pStyle", PPR_ORDER)
            .set_attr("w:val", style);
    }
    if let Some(alignment) = operation.get("alignment") {
        let alignment = validate_alignment(alignment)?;
        properties
            .ensure_child_ordered("jc", PPR_ORDER)
            .set_attr("w:val", alignment);
    }
    if operation.contains_key("spacingBefore") || operation.contains_key("spacingAfter") {
        let spacing = properties.ensure_child_ordered("spacing", PPR_ORDER);
        for (key, attribute) in [("spacingBefore", "w:before"), ("spacingAfter", "w:after")] {
            if let Some(value) = operation.get(key) {
                let value = nonnegative_integer(value, key)?;
                spacing.set_attr(attribute, value.to_string());
            }
        }
    }
    for (key, local) in [
        ("keepWithNext", "keepNext"),
        ("pageBreakBefore", "pageBreakBefore"),
    ] {
        if let Some(value) = operation.get(key) {
            let value = value.as_bool().ok_or_else(|| {
                ArtifactError::new("invalid_arguments", format!("{key} must be a JSON boolean"))
            })?;
            properties
                .ensure_child_ordered(local, PPR_ORDER)
                .set_attr("w:val", if value { "1" } else { "0" });
        }
    }
    Ok(())
}

const SECTPR_ORDER: &[&str] = &[
    "headerReference", "footerReference", "footnotePr", "endnotePr", "type", "pgSz",
    "pgMar", "paperSrc", "pgBorders", "lnNumType", "pgNumType", "cols", "formProt",
    "vAlign", "noEndnote", "titlePg", "textDirection", "bidi", "rtlGutter", "docGrid",
];

fn set_section_layout(
    root: &mut XmlElement,
    operation: &serde_json::Map<String, Value>,
) -> Result<(), ArtifactError> {
    const ALLOWED: &[&str] = &[
        "op", "part", "sectionIndex", "orientation", "pageWidthDxa", "pageHeightDxa",
        "marginsDxa",
    ];
    reject_unknown_fields(operation, ALLOWED, "set_section_layout")?;
    let section_index = operation
        .get("sectionIndex")
        .and_then(Value::as_u64)
        .ok_or_else(|| ArtifactError::new("invalid_arguments", "sectionIndex must be a nonnegative integer"))? as usize;
    if !["orientation", "pageWidthDxa", "pageHeightDxa", "marginsDxa"]
        .iter()
        .any(|key| operation.contains_key(*key))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "set_section_layout must specify at least one layout property",
        ));
    }
    let mut section_paths = Vec::new();
    collect_element_paths(root, "sectPr", &mut Vec::new(), &mut section_paths);
    let path = section_paths.get(section_index).ok_or_else(|| {
        ArtifactError::new("invalid_arguments", format!("sectionIndex {section_index} is out of range"))
    })?;
    let section = element_at_path_mut(root, path)
        .ok_or_else(|| ArtifactError::new("invalid_ooxml_xml", "section path is invalid"))?;
    if let Some(value) = operation.get("orientation") {
        let orientation = value.as_str().map(str::to_lowercase).ok_or_else(|| {
            ArtifactError::new("invalid_arguments", "orientation must be portrait or landscape")
        })?;
        if !["portrait", "landscape"].contains(&orientation.as_str()) {
            return Err(ArtifactError::new("invalid_arguments", "orientation must be portrait or landscape"));
        }
        section.ensure_child_ordered("pgSz", SECTPR_ORDER).set_attr("w:orient", orientation);
    }
    if operation.contains_key("pageWidthDxa") || operation.contains_key("pageHeightDxa") {
        let page_size = section.ensure_child_ordered("pgSz", SECTPR_ORDER);
        for (key, attribute) in [("pageWidthDxa", "w:w"), ("pageHeightDxa", "w:h")] {
            if let Some(value) = operation.get(key) {
                let value = value.as_u64().filter(|value| *value > 0).ok_or_else(|| {
                    ArtifactError::new("invalid_arguments", format!("{key} must be a positive integer in DXA"))
                })?;
                page_size.set_attr(attribute, value.to_string());
            }
        }
    }
    if let Some(margins) = operation.get("marginsDxa") {
        let margins = margins.as_object().filter(|margins| !margins.is_empty()).ok_or_else(|| {
            ArtifactError::new("invalid_arguments", "marginsDxa must be a nonempty object of supported DXA margins")
        })?;
        const MARGIN_NAMES: &[&str] = &["top", "bottom", "left", "right", "header", "footer", "gutter"];
        if let Some(name) = margins.keys().find(|name| !MARGIN_NAMES.contains(&name.as_str())) {
            return Err(ArtifactError::new("invalid_arguments", format!("unsupported margin name: {name}")));
        }
        let page_margins = section.ensure_child_ordered("pgMar", SECTPR_ORDER);
        for (name, value) in margins {
            let value = value.as_u64().ok_or_else(|| {
                ArtifactError::new("invalid_arguments", format!("margin {name} must be a nonnegative integer in DXA"))
            })?;
            page_margins.set_attr(&format!("w:{name}"), value.to_string());
        }
    }
    Ok(())
}

fn collect_element_paths(
    element: &XmlElement,
    local: &str,
    path: &mut Vec<usize>,
    found: &mut Vec<Vec<usize>>,
) {
    if element.is_word(local) {
        found.push(path.clone());
    }
    for (index, child) in element.children.iter().enumerate() {
        if let XmlContent::Element(child) = child {
            path.push(index);
            collect_element_paths(child, local, path, found);
            path.pop();
        }
    }
}

fn reject_unknown_fields(
    object: &serde_json::Map<String, Value>,
    allowed: &[&str],
    operation: &str,
) -> Result<(), ArtifactError> {
    if let Some(field) = object
        .keys()
        .find(|field| !allowed.contains(&field.as_str()))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            format!("unknown {operation} field: {field}"),
        ));
    }
    Ok(())
}

fn nonnegative_integer(value: &Value, name: &str) -> Result<u64, ArtifactError> {
    value.as_u64().ok_or_else(|| {
        ArtifactError::new(
            "invalid_arguments",
            format!("{name} must be a nonnegative integer in DXA"),
        )
    })
}

fn style_id(value: &Value) -> Result<String, ArtifactError> {
    let style = value.as_str().ok_or_else(|| {
        ArtifactError::new(
            "invalid_arguments",
            "style must be a built-in paragraph style name",
        )
    })?;
    let key = style.trim().to_lowercase();
    BUILTIN_STYLES
        .iter()
        .find_map(|(name, id)| (*name == key).then_some((*id).to_owned()))
        .ok_or_else(|| {
            ArtifactError::new(
                "invalid_arguments",
                format!("unsupported built-in paragraph style: {style:?}"),
            )
        })
}

fn validate_alignment(value: &Value) -> Result<String, ArtifactError> {
    let alignment = value
        .as_str()
        .ok_or_else(|| ArtifactError::new("invalid_arguments", "alignment must be a string"))?;
    let alignment = alignment.trim().to_lowercase();
    if [
        "left",
        "center",
        "right",
        "both",
        "distribute",
        "start",
        "end",
    ]
    .contains(&alignment.as_str())
    {
        Ok(alignment)
    } else {
        Err(ArtifactError::new(
            "invalid_arguments",
            format!("unsupported paragraph alignment: {alignment:?}"),
        ))
    }
}

fn format_run(
    root: &mut XmlElement,
    operation: &serde_json::Map<String, Value>,
) -> Result<(), ArtifactError> {
    const ALLOWED: &[&str] = &[
        "op", "part", "contains", "bold", "italic", "fontFace", "fontSizePt", "color",
    ];
    reject_unknown_fields(operation, ALLOWED, "format_run")?;
    let substring = operation
        .get("contains")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ArtifactError::new("invalid_arguments", "format_run requires a nonempty contains substring"))?;
    let formatting = operation
        .iter()
        .filter(|(key, _)| !matches!(key.as_str(), "op" | "part" | "contains"))
        .map(|(key, value)| (key.clone(), value.clone()))
        .collect::<serde_json::Map<_, _>>();
    if formatting.is_empty() {
        return Err(ArtifactError::new("invalid_arguments", "format_run must specify at least one formatting property"));
    }
    let mut matches = Vec::<(Vec<usize>, String, usize)>::new();
    collect_run_matches(root, &mut Vec::new(), substring, &mut matches)?;
    if matches.len() != 1 {
        return Err(ArtifactError::new(
            "invalid_arguments",
            format!("format_run target must be fully contained in one unique run; found {}", matches.len()),
        ));
    }
    let (path, text, match_at) = matches.pop().unwrap();
    let original = element_at_path(root, &path)
        .ok_or_else(|| ArtifactError::new("invalid_ooxml_xml", "format_run target path is invalid"))?;
    if !original.is_word("r") {
        return Err(ArtifactError::new("invalid_arguments", "format_run target is not a run"));
    }
    if original.children.iter().any(|child| matches!(child, XmlContent::Element(element) if !element.is_word("rPr") && !element.is_word("t"))) {
        return Err(ArtifactError::new("invalid_arguments", "format_run refuses runs with non-text content"));
    }
    if original.child_indices("rPr").len() > 1 || original.child_indices("t").is_empty() {
        return Err(ArtifactError::new("invalid_arguments", "format_run requires a simple text run"));
    }
    if path.is_empty() {
        return Err(ArtifactError::new("invalid_arguments", "format_run target is inside unsupported markup"));
    }
    let parent = element_at_path(root, &path[..path.len() - 1])
        .ok_or_else(|| ArtifactError::new("invalid_ooxml_xml", "format_run parent path is invalid"))?;
    if !parent.is_word("p") && !parent.is_word("hyperlink") {
        return Err(ArtifactError::new("invalid_arguments", "format_run target is inside unsupported markup"));
    }
    let original = original.clone();
    let end = match_at + substring.len();
    let mut replacements = Vec::<XmlContent>::new();
    if match_at > 0 {
        replacements.push(XmlContent::Element(clone_run(&original, &text[..match_at], None)?));
    }
    replacements.push(XmlContent::Element(clone_run(&original, &text[match_at..end], Some(&formatting))?));
    if end < text.len() {
        replacements.push(XmlContent::Element(clone_run(&original, &text[end..], None)?));
    }
    let parent = element_at_path_mut(root, &path[..path.len() - 1])
        .ok_or_else(|| ArtifactError::new("invalid_ooxml_xml", "format_run parent path is invalid"))?;
    let run_index = *path.last().unwrap();
    parent.children.splice(run_index..=run_index, replacements);
    Ok(())
}

fn collect_run_matches(
    element: &XmlElement,
    path: &mut Vec<usize>,
    substring: &str,
    matches: &mut Vec<(Vec<usize>, String, usize)>,
) -> Result<(), ArtifactError> {
    for (index, child) in element.children.iter().enumerate() {
        let XmlContent::Element(child) = child else { continue; };
        path.push(index);
        if child.is_word("r") {
            let text = child.children.iter().filter_map(|item| match item {
                XmlContent::Element(text) if text.is_word("t") => Some(text.text_content()),
                _ => None,
            }).collect::<String>();
            let positions = text.match_indices(substring).map(|(at, _)| at).collect::<Vec<_>>();
            if positions.len() > 1 {
                return Err(ArtifactError::new("invalid_arguments", "format_run substring must occur exactly once within its run"));
            }
            if let Some(at) = positions.first() {
                matches.push((path.clone(), text, *at));
            }
        }
        collect_run_matches(child, path, substring, matches)?;
        path.pop();
    }
    Ok(())
}

fn element_at_path<'a>(root: &'a XmlElement, path: &[usize]) -> Option<&'a XmlElement> {
    let mut current = root;
    for index in path {
        let XmlContent::Element(element) = current.children.get(*index)? else { return None; };
        current = element;
    }
    Some(current)
}

fn element_at_path_mut<'a>(root: &'a mut XmlElement, path: &[usize]) -> Option<&'a mut XmlElement> {
    let mut current = root;
    for index in path {
        let XmlContent::Element(element) = current.children.get_mut(*index)? else { return None; };
        current = element;
    }
    Some(current)
}

fn clone_run(
    original: &XmlElement,
    text: &str,
    formatting: Option<&serde_json::Map<String, Value>>,
) -> Result<XmlElement, ArtifactError> {
    let mut run = XmlElement { name: original.name.clone(), attributes: original.attributes.clone(), children: Vec::new() };
    let mut properties = original.first_child("rPr").cloned();
    if let Some(formatting) = formatting {
        if properties.is_none() {
            properties = Some(XmlElement { name: "w:rPr".to_owned(), attributes: Vec::new(), children: Vec::new() });
        }
        format_run_properties(properties.as_mut().unwrap(), formatting)?;
    }
    if let Some(properties) = properties {
        run.children.push(XmlContent::Element(properties));
    }
    let mut text_element = XmlElement { name: "w:t".to_owned(), attributes: Vec::new(), children: vec![XmlContent::Text(text.to_owned())] };
    if text.starts_with(char::is_whitespace) || text.ends_with(char::is_whitespace) {
        text_element.set_attr("xml:space", "preserve");
    }
    run.children.push(XmlContent::Element(text_element));
    Ok(run)
}

fn format_run_properties(
    properties: &mut XmlElement,
    formatting: &serde_json::Map<String, Value>,
) -> Result<(), ArtifactError> {
    for (key, local) in [("bold", "b"), ("italic", "i")] {
        if let Some(value) = formatting.get(key) {
            let value = value.as_bool().ok_or_else(|| ArtifactError::new("invalid_arguments", format!("{key} must be a JSON boolean")))?;
            properties.ensure_child_ordered(local, RPR_ORDER).set_attr("w:val", if value { "1" } else { "0" });
        }
    }
    if let Some(value) = formatting.get("fontFace") {
        let face = value.as_str().filter(|value| !value.trim().is_empty()).ok_or_else(|| ArtifactError::new("invalid_arguments", "fontFace must be a nonempty string"))?;
        let fonts = properties.ensure_child_ordered("rFonts", RPR_ORDER);
        fonts.attributes.retain(|(name, _)| !["asciiTheme", "hAnsiTheme", "eastAsiaTheme", "cstheme"].contains(&name.rsplit(':').next().unwrap_or(name)));
        for attribute in ["ascii", "hAnsi", "eastAsia", "cs"] {
            fonts.set_attr(&format!("w:{attribute}"), face.trim());
        }
    }
    if let Some(value) = formatting.get("fontSizePt") {
        let size = value.as_f64().filter(|value| value.is_finite() && *value > 0.0).ok_or_else(|| ArtifactError::new("invalid_arguments", "fontSizePt must be a positive finite number"))?;
        let half_points = ((size * 2.0).round() as u64).max(1).to_string();
        for local in ["sz", "szCs"] {
            properties.ensure_child_ordered(local, RPR_ORDER).set_attr("w:val", half_points.clone());
        }
    }
    if let Some(value) = formatting.get("color") {
        let color = value.as_str().ok_or_else(|| ArtifactError::new("invalid_arguments", "color must be a 6-digit RGB string"))?.trim_start_matches('#');
        if color.len() != 6 || !color.chars().all(|character| character.is_ascii_hexdigit()) {
            return Err(ArtifactError::new("invalid_arguments", "color must be a 6-digit RGB string"));
        }
        let color_element = properties.ensure_child_ordered("color", RPR_ORDER);
        color_element.attributes.retain(|(name, _)| !["themeColor", "themeTint", "themeShade"].contains(&name.rsplit(':').next().unwrap_or(name)));
        color_element.set_attr("w:val", color.to_ascii_uppercase());
    }
    Ok(())
}
