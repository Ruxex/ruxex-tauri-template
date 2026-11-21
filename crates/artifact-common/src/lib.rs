use serde_json::Value;
use std::fmt::{Display, Formatter};

pub mod artifacts;
pub mod cli;
pub mod ooxml;

#[derive(Debug)]
pub struct ArtifactError {
    pub code: &'static str,
    pub message: String,
}

impl ArtifactError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

impl Display for ArtifactError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}: {}", self.code, self.message)
    }
}

pub fn print_json(value: &Value, stderr: bool) {
    let output = serde_json::to_string(value).expect("artifact JSON is serializable");
    if stderr {
        eprintln!("{output}");
    } else {
        println!("{output}");
    }
}
