#[path = "../artifact_model.rs"]
mod artifact_model;
#[path = "../artifact_pdf.rs"]
mod artifact_pdf;
#[path = "../artifacts.rs"]
mod artifacts;

fn main() -> std::process::ExitCode {
    artifacts::run_engine_stdio()
}
