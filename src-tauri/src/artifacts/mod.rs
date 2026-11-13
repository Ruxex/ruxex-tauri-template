use serde_json::Value;
use std::fmt::{Display, Formatter};

mod cli;
mod engine;
mod ooxml;
mod pdf;
mod xlsx;

pub use cli::run_cli;
pub use engine::run_engine_stdio;

#[derive(Debug)]
pub(super) struct ArtifactError {
    code: &'static str,
    message: String,
}

impl ArtifactError {
    pub(super) fn new(code: &'static str, message: impl Into<String>) -> Self {
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

pub(super) fn print_json(value: &Value, stderr: bool) {
    let output = serde_json::to_string(value).expect("artifact JSON is serializable");
    if stderr {
        eprintln!("{output}");
    } else {
        println!("{output}");
    }
}
