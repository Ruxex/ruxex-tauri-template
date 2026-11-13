// This standalone engine shares modules with the desktop target, but only a
// subset of their entry points is reachable from the engine's stdio runner.
#[allow(dead_code)]
#[path = "../artifact_model.rs"]
mod artifact_model;
#[allow(dead_code)]
#[path = "../artifact_pdf.rs"]
mod artifact_pdf;
#[allow(dead_code)]
#[path = "../artifacts/mod.rs"]
mod artifacts;
#[allow(dead_code)]
#[path = "../ooxml.rs"]
mod ooxml;

fn main() -> std::process::ExitCode {
    artifacts::run_engine_stdio()
}
