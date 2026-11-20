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
    if kind == "insert_paragraph_after" {
        return insert_paragraph_after(body, operation);
    }
    if kind == "replace_table_cell_text" {
        return replace_table_cell_text(body, operation);
    }
    if kind == "insert_table_after" {
        return insert_table_after(body, operation);
    }
    if kind == "replace_table_rows" || kind == "append_table_row" {
        return edit_table_rows(body, operation, kind);
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

fn insert_paragraph_after(
    body: &mut XmlElement,
    operation: &serde_json::Map<String, Value>,
) -> Result<(), ArtifactError> {
    const ALLOWED: &[&str] = &["op", "part", "contains", "text", "style"];
    reject_unknown_fields(operation, ALLOWED, "insert_paragraph_after")?;
    let substring = operation
        .get("contains")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ArtifactError::new("invalid_arguments", "insert_paragraph_after requires a nonempty contains substring"))?;
    let matches = body
        .child_indices("p")
        .into_iter()
        .filter(|index| matches!(&body.children[*index], XmlContent::Element(paragraph) if paragraph.text_content().contains(substring)))
        .collect::<Vec<_>>();
    if matches.len() != 1 {
        return Err(ArtifactError::new(
            "invalid_arguments",
            format!("insert_paragraph_after target must match exactly one top-level paragraph; found {}", matches.len()),
        ));
    }
    let text = operation.get("text").and_then(Value::as_str).ok_or_else(|| {
        ArtifactError::new("invalid_arguments", "insert_paragraph_after requires text as a string")
    })?;
    let mut paragraph = XmlElement {
        name: "w:p".to_owned(),
        attributes: Vec::new(),
        children: Vec::new(),
    };
    if let Some(style) = operation.get("style") {
        let style = style_id(style)?;
        paragraph
            .ensure_child_ordered("pPr", &[])
            .ensure_child_ordered("pStyle", PPR_ORDER)
            .set_attr("w:val", style);
    }
    let mut run = XmlElement {
        name: "w:r".to_owned(),
        attributes: Vec::new(),
        children: Vec::new(),
    };
    let mut text_element = XmlElement {
        name: "w:t".to_owned(),
        attributes: Vec::new(),
        children: vec![XmlContent::Text(text.to_owned())],
    };
    if text.starts_with(' ') || text.ends_with(' ') {
        text_element.set_attr("xml:space", "preserve");
    }
    run.children.push(XmlContent::Element(text_element));
    paragraph.children.push(XmlContent::Element(run));
    body.children
        .insert(matches[0] + 1, XmlContent::Element(paragraph));
    Ok(())
}

const UNSAFE_CELL_TAGS: &[&str] = &[
    "tbl", "fldSimple", "fldChar", "instrText", "commentRangeStart", "commentRangeEnd",
    "commentReference", "ins", "del", "moveFrom", "moveTo", "moveFromRangeStart",
    "moveFromRangeEnd", "moveToRangeStart", "moveToRangeEnd", "drawing", "pict", "object",
    "hyperlink", "sdt", "bookmarkStart", "bookmarkEnd", "gridSpan", "hMerge", "vMerge",
    "footnoteReference", "endnoteReference", "permStart", "permEnd", "customXml", "smartTag",
];

fn replace_table_cell_text(
    body: &mut XmlElement,
    operation: &serde_json::Map<String, Value>,
) -> Result<(), ArtifactError> {
    const ALLOWED: &[&str] = &[
        "op", "part", "tableIndex", "row", "column", "text", "alignment",
    ];
    reject_unknown_fields(operation, ALLOWED, "replace_table_cell_text")?;
    let table_index = operation_index(operation, "tableIndex")?;
    let row_index = operation_index(operation, "row")?;
    let column_index = operation_index(operation, "column")?;
    let text = operation.get("text").and_then(Value::as_str).ok_or_else(|| {
        ArtifactError::new("invalid_arguments", "replace_table_cell_text requires text as a string")
    })?;
    let alignment = operation.get("alignment").map(validate_alignment).transpose()?;
    let tables = body.child_indices("tbl");
    let table_position = *tables.get(table_index).ok_or_else(|| {
        ArtifactError::new("invalid_arguments", format!("tableIndex {table_index} is out of range"))
    })?;
    let XmlContent::Element(table) = &mut body.children[table_position] else { unreachable!() };
    let rows = table.child_indices("tr");
    let row_position = *rows.get(row_index).ok_or_else(|| {
        ArtifactError::new("invalid_arguments", format!("row {row_index} is out of range for table {table_index}"))
    })?;
    let XmlContent::Element(row) = &mut table.children[row_position] else { unreachable!() };
    let row_properties = row.first_child("trPr");
    if row_properties.is_some_and(|properties| {
        properties.first_child("gridBefore").is_some() || properties.first_child("gridAfter").is_some()
    }) {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "table row has gridBefore/gridAfter, so its cell indexes are ambiguous",
        ));
    }
    if contains_word_element(row, &["gridSpan", "hMerge", "vMerge"]) {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "table row has merged cells, so its cell indexes are ambiguous",
        ));
    }
    let cells = row.child_indices("tc");
    let cell_position = *cells.get(column_index).ok_or_else(|| {
        ArtifactError::new(
            "invalid_arguments",
            format!("column {column_index} is out of range for table {table_index}, row {row_index}"),
        )
    })?;
    let XmlContent::Element(cell) = &mut row.children[cell_position] else { unreachable!() };
    replace_cell(cell, text, alignment.as_deref())
}

fn operation_index(
    operation: &serde_json::Map<String, Value>,
    key: &str,
) -> Result<usize, ArtifactError> {
    operation
        .get(key)
        .and_then(Value::as_u64)
        .and_then(|value| usize::try_from(value).ok())
        .ok_or_else(|| ArtifactError::new("invalid_arguments", format!("{key} must be a nonnegative integer")))
}

fn contains_word_element(root: &XmlElement, names: &[&str]) -> bool {
    names.iter().any(|name| root.first_child(name).is_some())
        || root.children.iter().any(|child| match child {
            XmlContent::Element(element) => contains_word_element(element, names),
            _ => false,
        })
}

fn replace_cell(
    cell: &mut XmlElement,
    text: &str,
    alignment: Option<&str>,
) -> Result<(), ArtifactError> {
    if let Some(reason) = unsafe_cell_descendant(cell) {
        return Err(ArtifactError::new(
            "invalid_arguments",
            format!("table cell contains unsupported {reason} content"),
        ));
    }
    if cell.children.iter().any(|child| {
        matches!(child, XmlContent::Element(element) if !element.is_word("tcPr") && !element.is_word("p"))
    }) {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "table cell contains unsupported non-paragraph content",
        ));
    }
    let properties = cell.first_child("tcPr").cloned();
    let first_paragraph = cell
        .children
        .iter()
        .find_map(|child| match child {
            XmlContent::Element(element) if element.is_word("p") => Some(element.clone()),
            _ => None,
        })
        .unwrap_or(XmlElement { name: "w:p".to_owned(), attributes: Vec::new(), children: Vec::new() });
    let paragraph_properties = first_paragraph.first_child("pPr").cloned();
    let run_properties = first_paragraph
        .children
        .iter()
        .find_map(|child| match child {
            XmlContent::Element(run) if run.is_word("r") => run.first_child("rPr").cloned(),
            _ => None,
        });
    let mut paragraph = XmlElement {
        name: first_paragraph.name,
        attributes: first_paragraph.attributes,
        children: Vec::new(),
    };
    if let Some(properties) = paragraph_properties {
        paragraph.children.push(XmlContent::Element(properties));
    }
    let mut run = XmlElement { name: "w:r".to_owned(), attributes: Vec::new(), children: Vec::new() };
    if let Some(properties) = run_properties {
        run.children.push(XmlContent::Element(properties));
    }
    let mut text_element = XmlElement {
        name: "w:t".to_owned(),
        attributes: Vec::new(),
        children: vec![XmlContent::Text(text.to_owned())],
    };
    if text.starts_with(' ') || text.ends_with(' ') {
        text_element.set_attr("xml:space", "preserve");
    }
    run.children.push(XmlContent::Element(text_element));
    paragraph.children.push(XmlContent::Element(run));
    if let Some(alignment) = alignment {
        paragraph
            .ensure_child_ordered("pPr", PPR_ORDER)
            .ensure_child_ordered("jc", PPR_ORDER)
            .set_attr("w:val", alignment);
    }
    cell.children.clear();
    if let Some(properties) = properties {
        cell.children.push(XmlContent::Element(properties));
    }
    cell.children.push(XmlContent::Element(paragraph));
    Ok(())
}

fn unsafe_cell_descendant(cell: &XmlElement) -> Option<String> {
    for child in &cell.children {
        let XmlContent::Element(child) = child else { continue };
        let local = child.local_name();
        if child.name.contains(':') && !child.name.starts_with("w:") {
            return Some("foreign XML".to_owned());
        }
        for (name, _) in &child.attributes {
            if name.starts_with("xmlns") || name.starts_with("xml:") || name.starts_with("w:") {
                continue;
            }
            if name.contains(':') || name.starts_with('{') {
                return Some("relationship or extension attributes".to_owned());
            }
        }
        if child.name.contains(':') && !child.name.starts_with("w:") {
            return Some("foreign XML".to_owned());
        }
        if UNSAFE_CELL_TAGS.contains(&local) || local.ends_with("Change") || local == "delText" {
            return Some(local.to_owned());
        }
        if let Some(reason) = unsafe_cell_descendant(child) {
            return Some(reason);
        }
    }
    None
}

const TBLPR_ORDER: &[&str] = &[
    "tblStyle", "tblpPr", "tblOverlap", "bidiVisual", "tblStyleRowBandSize",
    "tblStyleColBandSize", "tblW", "jc", "tblCellSpacing", "tblInd", "tblBorders",
    "shd", "tblLayout", "tblCellMar", "tblLook", "tblCaption", "tblDescription",
];

fn insert_table_after(
    body: &mut XmlElement,
    operation: &serde_json::Map<String, Value>,
) -> Result<(), ArtifactError> {
    const ALLOWED: &[&str] = &["op", "part", "contains", "rows", "headerRow", "columnWidthsDxa", "style"];
    reject_unknown_fields(operation, ALLOWED, "insert_table_after")?;
    let substring = operation
        .get("contains")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ArtifactError::new("invalid_arguments", "insert_table_after requires a nonempty contains substring"))?;
    let targets = body
        .child_indices("p")
        .into_iter()
        .filter(|index| matches!(&body.children[*index], XmlContent::Element(paragraph) if paragraph.text_content().contains(substring)))
        .collect::<Vec<_>>();
    if targets.len() != 1 {
        return Err(ArtifactError::new(
            "invalid_arguments",
            format!("insert_table_after target must match exactly one top-level paragraph; found {}", targets.len()),
        ));
    }
    let rows = operation.get("rows").and_then(Value::as_array).filter(|rows| !rows.is_empty()).ok_or_else(|| {
        ArtifactError::new("invalid_arguments", "rows must be a nonempty rectangular array of nonempty row arrays")
    })?;
    let first_row = rows[0].as_array().filter(|row| !row.is_empty()).ok_or_else(|| {
        ArtifactError::new("invalid_arguments", "rows must be a nonempty rectangular array of nonempty row arrays")
    })?;
    let column_count = first_row.len();
    let rows = rows
        .iter()
        .map(|row| {
            let cells = row.as_array().filter(|cells| cells.len() == column_count).ok_or_else(|| {
                ArtifactError::new("invalid_arguments", "rows must be rectangular and contain only string cell values")
            })?;
            cells.iter().map(|cell| cell.as_str().map(str::to_owned).ok_or_else(|| {
                ArtifactError::new("invalid_arguments", "rows must be rectangular and contain only string cell values")
            })).collect::<Result<Vec<_>, _>>()
        })
        .collect::<Result<Vec<_>, _>>()?;
    let header_row = operation.get("headerRow").map(|value| value.as_bool().ok_or_else(|| {
        ArtifactError::new("invalid_arguments", "headerRow must be a JSON boolean")
    })).transpose()?.unwrap_or(false);
    let style = operation.get("style").map(|value| {
        let style = value.as_str().map(str::trim).filter(|style| !style.is_empty() && style.len() <= 40).ok_or_else(|| {
            ArtifactError::new("invalid_arguments", "style must be a nonempty table style ID of at most 40 characters")
        })?;
        Ok::<String, ArtifactError>(style.to_owned())
    }).transpose()?;
    let widths = if let Some(widths) = operation.get("columnWidthsDxa") {
        let widths = widths.as_array().filter(|widths| widths.len() == column_count).ok_or_else(|| {
            ArtifactError::new("invalid_arguments", "columnWidthsDxa must contain one positive integer DXA value per column")
        })?;
        widths.iter().map(|value| value.as_u64().filter(|width| *width > 0).ok_or_else(|| {
            ArtifactError::new("invalid_arguments", "columnWidthsDxa must contain one positive integer DXA value per column")
        })).collect::<Result<Vec<_>, _>>()?
    } else {
        if column_count > 9360 {
            return Err(ArtifactError::new("invalid_arguments", "too many columns for the default 9360-DXA table width; provide columnWidthsDxa"));
        }
        let base = 9360 / column_count as u64;
        let mut widths = vec![base; column_count];
        widths[column_count - 1] += 9360 - base * column_count as u64;
        widths
    };
    let total_width = widths.iter().try_fold(0u64, |total, width| total.checked_add(*width)).filter(|total| *total > 0).ok_or_else(|| {
        ArtifactError::new("invalid_arguments", "table width must be positive and fit in a DXA integer")
    })?;

    let mut table = XmlElement { name: "w:tbl".to_owned(), attributes: Vec::new(), children: Vec::new() };
    let properties = table.ensure_child_ordered("tblPr", &[]);
    if let Some(style) = style {
        properties.ensure_child_ordered("tblStyle", TBLPR_ORDER).set_attr("w:val", style);
    }
    let table_width = properties.ensure_child_ordered("tblW", TBLPR_ORDER);
    table_width.set_attr("w:w", total_width.to_string());
    table_width.set_attr("w:type", "dxa");
    properties.ensure_child_ordered("tblLayout", TBLPR_ORDER).set_attr("w:type", "fixed");
    let mut grid = XmlElement { name: "w:tblGrid".to_owned(), attributes: Vec::new(), children: Vec::new() };
    for width in &widths {
        let mut column = XmlElement { name: "w:gridCol".to_owned(), attributes: Vec::new(), children: Vec::new() };
        column.set_attr("w:w", width.to_string());
        grid.children.push(XmlContent::Element(column));
    }
    table.children.push(XmlContent::Element(grid));
    for (row_index, values) in rows.iter().enumerate() {
        let mut row = XmlElement { name: "w:tr".to_owned(), attributes: Vec::new(), children: Vec::new() };
        if header_row && row_index == 0 {
            let mut row_properties = XmlElement { name: "w:trPr".to_owned(), attributes: Vec::new(), children: Vec::new() };
            row_properties.children.push(XmlContent::Element(XmlElement {
                name: "w:tblHeader".to_owned(), attributes: vec![("w:val".to_owned(), "1".to_owned())], children: Vec::new(),
            }));
            row.children.push(XmlContent::Element(row_properties));
        }
        for (value, width) in values.iter().zip(&widths) {
            let mut cell = XmlElement { name: "w:tc".to_owned(), attributes: Vec::new(), children: Vec::new() };
            let mut cell_properties = XmlElement { name: "w:tcPr".to_owned(), attributes: Vec::new(), children: Vec::new() };
            let mut cell_width = XmlElement { name: "w:tcW".to_owned(), attributes: Vec::new(), children: Vec::new() };
            cell_width.set_attr("w:w", width.to_string());
            cell_width.set_attr("w:type", "dxa");
            cell_properties.children.push(XmlContent::Element(cell_width));
            cell.children.push(XmlContent::Element(cell_properties));
            let mut paragraph = XmlElement { name: "w:p".to_owned(), attributes: Vec::new(), children: Vec::new() };
            paragraph.children.push(XmlContent::Element(text_run(value)));
            cell.children.push(XmlContent::Element(paragraph));
            row.children.push(XmlContent::Element(cell));
        }
        table.children.push(XmlContent::Element(row));
    }
    body.children.insert(targets[0] + 1, XmlContent::Element(table));
    Ok(())
}

fn text_run(text: &str) -> XmlElement {
    let mut run = XmlElement { name: "w:r".to_owned(), attributes: Vec::new(), children: Vec::new() };
    let mut text_element = XmlElement {
        name: "w:t".to_owned(), attributes: Vec::new(), children: vec![XmlContent::Text(text.to_owned())],
    };
    if text.starts_with(' ') || text.ends_with(' ') {
        text_element.set_attr("xml:space", "preserve");
    }
    run.children.push(XmlContent::Element(text_element));
    run
}

fn edit_table_rows(
    body: &mut XmlElement,
    operation: &serde_json::Map<String, Value>,
    kind: &str,
) -> Result<(), ArtifactError> {
    let values_key = if kind == "append_table_row" { "values" } else { "rows" };
    let allowed = ["op", "part", "tableIndex", values_key];
    reject_unknown_fields(operation, &allowed, kind)?;
    let table_index = operation_index(operation, "tableIndex")?;
    let (table_position, row_positions, columns) = simple_table(body, table_index)?;
    let values = operation
        .get(values_key)
        .and_then(Value::as_array)
        .filter(|values| !values.is_empty())
        .ok_or_else(|| ArtifactError::new("invalid_arguments", format!("{values_key} must contain string cells matching the existing {columns}-column grid")))?;
    let replacement = if kind == "append_table_row" {
        vec![values]
    } else {
        values.iter().map(|row| row.as_array()).collect::<Option<Vec<_>>>().ok_or_else(|| {
            ArtifactError::new("invalid_arguments", format!("{values_key} must contain string cells matching the existing {columns}-column grid"))
        })?
    };
    let rows = replacement
        .iter()
        .map(|row| {
            if row.len() != columns {
                return Err(ArtifactError::new("invalid_arguments", format!("{values_key} must contain string cells matching the existing {columns}-column grid")));
            }
            row.iter().map(|value| value.as_str().map(str::to_owned).ok_or_else(|| {
                ArtifactError::new("invalid_arguments", format!("{values_key} must contain string cells matching the existing {columns}-column grid"))
            })).collect::<Result<Vec<_>, _>>()
        })
        .collect::<Result<Vec<_>, _>>()?;
    let XmlContent::Element(table) = &mut body.children[table_position] else { unreachable!() };
    let mut new_rows = Vec::with_capacity(rows.len());
    for (index, values) in rows.iter().enumerate() {
        let template_index = if kind == "append_table_row" {
            row_positions.len() - 1
        } else {
            index.min(row_positions.len() - 1)
        };
        let XmlContent::Element(existing) = &table.children[row_positions[template_index]] else { unreachable!() };
        let mut new_row = existing.clone();
        if kind == "append_table_row" || index >= row_positions.len() {
            clear_table_header_flag(&mut new_row);
        }
        let cell_positions = new_row.child_indices("tc");
        for (cell_position, value) in cell_positions.into_iter().zip(values) {
            let XmlContent::Element(cell) = &mut new_row.children[cell_position] else { unreachable!() };
            replace_cell(cell, value, None)?;
        }
        new_rows.push(XmlContent::Element(new_row));
    }
    if kind == "replace_table_rows" {
        table.children.retain(|child| {
            !matches!(child, XmlContent::Element(element) if element.is_word("tr"))
        });
    }
    table.children.extend(new_rows);
    Ok(())
}

fn clear_table_header_flag(row: &mut XmlElement) {
    if let Some(properties) = row.first_child_mut("trPr") {
        properties.children.retain(|child| {
            !matches!(child, XmlContent::Element(element) if element.is_word("tblHeader"))
        });
    }
}

fn simple_table(
    body: &XmlElement,
    table_index: usize,
) -> Result<(usize, Vec<usize>, usize), ArtifactError> {
    let tables = body.child_indices("tbl");
    let table_position = *tables.get(table_index).ok_or_else(|| {
        ArtifactError::new("invalid_arguments", format!("tableIndex {table_index} is out of range"))
    })?;
    let XmlContent::Element(table) = &body.children[table_position] else { unreachable!() };
    validate_structural_table_node(table, true)?;
    if table.children.iter().any(|child| {
        matches!(child, XmlContent::Element(element) if !["tblPr", "tblGrid", "tr"].iter().any(|name| element.is_word(name)))
    }) {
        return Err(ArtifactError::new("invalid_arguments", "structural table edits require direct table rows"));
    }
    let rows = table.child_indices("tr");
    let columns = table
        .first_child("tblGrid")
        .map(|grid| grid.child_indices("gridCol").len())
        .unwrap_or(0);
    if rows.is_empty() || columns == 0 {
        return Err(ArtifactError::new("invalid_arguments", "structural table edits require existing rows and an explicit column grid"));
    }
    for row_position in &rows {
        let XmlContent::Element(row) = &table.children[*row_position] else { unreachable!() };
        if row.children.iter().any(|child| {
            matches!(child, XmlContent::Element(element) if !element.is_word("trPr") && !element.is_word("tc"))
        }) {
            return Err(ArtifactError::new("invalid_arguments", "structural table edits require direct row cells"));
        }
        let cells = row.child_indices("tc");
        if cells.len() != columns {
            return Err(ArtifactError::new("invalid_arguments", "structural table edits require rectangular rows matching the column grid"));
        }
        for cell_position in cells {
            let XmlContent::Element(cell) = &row.children[cell_position] else { unreachable!() };
            if cell.children.iter().any(|child| {
                matches!(child, XmlContent::Element(element) if !element.is_word("tcPr") && !element.is_word("p"))
            }) {
                return Err(ArtifactError::new("invalid_arguments", "structural table edits require plain paragraph cells"));
            }
            for paragraph_position in cell.child_indices("p") {
                let XmlContent::Element(paragraph) = &cell.children[paragraph_position] else { unreachable!() };
                if paragraph.children.iter().any(|child| {
                    matches!(child, XmlContent::Element(element) if !element.is_word("pPr") && !element.is_word("r"))
                }) {
                    return Err(ArtifactError::new("invalid_arguments", "structural table edits require plain text paragraphs"));
                }
                for run_position in paragraph.child_indices("r") {
                    let XmlContent::Element(run) = &paragraph.children[run_position] else { unreachable!() };
                    if run.children.iter().any(|child| {
                        matches!(child, XmlContent::Element(element) if !element.is_word("rPr") && !element.is_word("t"))
                    }) {
                        return Err(ArtifactError::new("invalid_arguments", "structural table edits refuse non-text run content"));
                    }
                }
            }
        }
    }
    Ok((table_position, rows, columns))
}

fn validate_structural_table_node(element: &XmlElement, root: bool) -> Result<(), ArtifactError> {
    let local = element.local_name();
    let is_word = !element.name.contains(':') || element.name.starts_with("w:");
    if !is_word {
        return Err(ArtifactError::new("invalid_arguments", "structural table edits require WordprocessingML-only content"));
    }
    if element.attributes.iter().any(|(name, _)| {
        !name.starts_with("xmlns") && !name.starts_with("w:") && !name.starts_with("xml:") && name.contains(':')
    }) {
        return Err(ArtifactError::new("invalid_arguments", "structural table edits refuse relationship or extension attributes"));
    }
    if !root && (UNSAFE_CELL_TAGS.contains(&local) || local.ends_with("Change") || [
        "delText", "gridBefore", "gridAfter", "tblPrEx", "tblpPr", "sectPr", "numPr",
    ].contains(&local)) {
        return Err(ArtifactError::new("invalid_arguments", format!("structural table edits refuse unsupported {local} content")));
    }
    for child in &element.children {
        if let XmlContent::Element(child) = child {
            validate_structural_table_node(child, false)?;
        }
    }
    Ok(())
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
