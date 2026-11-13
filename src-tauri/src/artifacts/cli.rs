use serde_json::{Value, json};
use std::ffi::OsString;

use super::{ArtifactError, print_json};
use super::{ooxml, pdf, xlsx};

pub fn run_cli<I>(args: I) -> std::process::ExitCode
where
    I: IntoIterator<Item = OsString>,
{
    match run(args.into_iter().skip(1).collect()) {
        Ok(value) => {
            print_json(&value, false);
            std::process::ExitCode::SUCCESS
        }
        Err(error) => {
            print_json(
                &json!({
                    "ok": false,
                    "error": {
                        "code": error.code,
                        "message": error.message,
                    },
                }),
                true,
            );
            std::process::ExitCode::from(1)
        }
    }
}

fn run(args: Vec<OsString>) -> Result<Value, ArtifactError> {
    let args = args
        .into_iter()
        .map(|argument| {
            argument
                .into_string()
                .map_err(|_| ArtifactError::new("invalid_arguments", "arguments must be UTF-8"))
        })
        .collect::<Result<Vec<_>, _>>()?;

    match args.first().map(String::as_str) {
        Some("capabilities") => capabilities(&args[1..]),
        Some("xlsx") => xlsx::run_xlsx(&args[1..]),
        Some("docx") => ooxml::run_ooxml("docx", &args[1..]),
        Some("pptx") => ooxml::run_ooxml("pptx", &args[1..]),
        Some("pdf") => pdf::run_pdf(&args[1..]),
        Some(command) => Err(ArtifactError::new(
            "invalid_arguments",
            format!("unknown command: {command}"),
        )),
        None => Err(ArtifactError::new(
            "invalid_arguments",
            "a command is required",
        )),
    }
}

fn capabilities(args: &[String]) -> Result<Value, ArtifactError> {
    reject_unknown_flags(args)?;
    Ok(json!({
        "ok": true,
        "commands": {
            "xlsx": ["create", "read", "validate"],
            "docx": ["create", "read", "validate"],
            "pptx": ["create", "read", "validate"],
            "pdf": ["create", "read", "validate"],
        },
    }))
}

pub(super) fn parse_flags(args: &[String]) -> Result<Vec<(String, Option<String>)>, ArtifactError> {
    let mut flags = Vec::new();
    let mut index = 0;
    while index < args.len() {
        let flag = &args[index];
        if flag == "--json" {
            flags.push((flag.clone(), None));
            index += 1;
            continue;
        }
        let Some(name) = flag.strip_prefix("--") else {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("expected a flag, got: {flag}"),
            ));
        };
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
    Ok(flags)
}

pub(super) fn required_flag<'a>(
    flags: &'a [(String, Option<String>)],
    name: &str,
) -> Result<&'a str, ArtifactError> {
    flags
        .iter()
        .find_map(|(flag, value)| (flag == name).then_some(value.as_deref()).flatten())
        .ok_or_else(|| ArtifactError::new("invalid_arguments", format!("--{name} is required")))
}

pub(super) fn reject_unknown_flags(args: &[String]) -> Result<(), ArtifactError> {
    for argument in args {
        if argument != "--json" {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: {argument}"),
            ));
        }
    }
    Ok(())
}
