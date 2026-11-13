use std::collections::HashMap;

pub(crate) fn normalize_target(target: &str, base: &str) -> String {
    let mut parts = base.split('/').collect::<Vec<_>>();
    for part in target.split('/') {
        match part {
            ".." => {
                parts.pop();
            }
            "." | "" => {}
            value => parts.push(value),
        }
    }
    parts.join("/")
}

pub(crate) fn attribute_values(xml: &str, tag: &str, attribute: &str) -> Vec<String> {
    elements(xml, tag)
        .into_iter()
        .filter_map(|attributes| attributes.get(attribute).cloned())
        .collect()
}

pub(crate) fn elements(xml: &str, tag: &str) -> Vec<HashMap<String, String>> {
    let marker = format!("<{tag}");
    let mut cursor = 0;
    let mut elements = Vec::new();
    while let Some(offset) = xml[cursor..].find(&marker) {
        let start = cursor + offset;
        let Some(end_offset) = xml[start..].find('>') else {
            break;
        };
        let tag_contents = &xml[start + marker.len()..start + end_offset];
        if !tag.ends_with(' ')
            && tag_contents.chars().next().is_some_and(|character| {
                character.is_ascii_alphanumeric() || character == ':' || character == '_'
            })
        {
            cursor = start + marker.len();
            continue;
        }
        elements.push(parse_attributes(tag_contents));
        cursor = start + end_offset + 1;
    }
    elements
}

pub(crate) fn parse_attributes(value: &str) -> HashMap<String, String> {
    let mut attributes = HashMap::new();
    let mut rest = value;
    while let Some(equal) = rest.find('=') {
        let name = rest[..equal].split_whitespace().last().unwrap_or_default();
        let quoted = rest[equal + 1..].trim_start();
        let Some(quote) = quoted.chars().next() else {
            break;
        };
        if quote != '"' && quote != '\'' {
            break;
        }
        let Some(close) = quoted[1..].find(quote) else {
            break;
        };
        attributes.insert(name.to_string(), quoted[1..close + 1].to_string());
        rest = &quoted[close + 2..];
    }
    attributes
}

pub(crate) fn decode_entities(value: &str) -> String {
    value
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&amp;", "&")
}

pub(crate) fn slide_number(name: &str) -> Option<usize> {
    name.strip_prefix("ppt/slides/slide")?
        .strip_suffix(".xml")?
        .parse()
        .ok()
}

pub(crate) fn column_label(number: u32) -> String {
    let mut index = number.saturating_sub(1);
    let mut result = String::new();
    loop {
        result.insert(0, (b'A' + (index % 26) as u8) as char);
        if index < 26 {
            break;
        }
        index = index / 26 - 1;
    }
    result
}
