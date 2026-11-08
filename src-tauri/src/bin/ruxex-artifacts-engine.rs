#[path = "../artifacts.rs"]
mod artifacts;

fn main() -> std::process::ExitCode {
    artifacts::run_engine_stdio()
}
