#!/usr/bin/env python3
"""Run the real-Tauri WebdriverIO suite in an isolated local environment."""

from __future__ import annotations

import argparse
import json
import os
import re
import signal
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Mapping, Sequence


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ARTIFACT_ROOT = REPOSITORY_ROOT / "artifacts" / "e2e"
# Keep the generated home at a short repository-local path. The App Server's
# Unix socket path includes RUXEX_HOME and must stay below Linux's limit.
DUMMY_HOME_DIR = REPOSITORY_ROOT / ".d"
MARKETPLACE_HOME_DIR = REPOSITORY_ROOT / ".m"
TAURI_DRIVER_PORT = 4444
SAFE_ENVIRONMENT_KEYS = frozenset(
    {
        "HOME",
        "RUXEX_HOME",
        "RUXEX_DUMMY_HOME",
        "RUXEX_PROVIDER",
        "RUXEX_APP_SERVER_MODE",
        "GDK_BACKEND",
        "DISPLAY",
        "WAYLAND_DISPLAY",
        "XDG_CONFIG_HOME",
        "XDG_DATA_HOME",
        "XDG_CACHE_HOME",
        "XDG_STATE_HOME",
        "RUXEX_E2E_APP_BINARY",
        "RUXEX_E2E_ARTIFACTS",
        "RUXEX_E2E_HEADLESS",
        "RUXEX_E2E_PLUGIN",
        "RUXEX_E2E_LOG_LEVEL",
        "RUXEX_E2E_GIT_DIFF_WORKSPACE",
        "TAURI_DRIVER_PATH",
        "WDIO_TAURI_DRIVER_PORT",
        "WEBKIT_WEBDRIVER_PATH",
        "XVFB_RUN_PATH",
    }
)
SENSITIVE_ENV_PATTERN = re.compile(
    r"(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PASSWD|PRIVATE[_-]?KEY|CREDENTIAL)",
    re.IGNORECASE,
)
DUMMY_PROVIDER_CONFIG = (
    'approval_policy = "on-request"\n'
    'sandbox_mode = "read-only"\n\n'
    '[features]\n'
    'request_permissions_tool = true\n'
    'default_mode_request_user_input = true\n'
    '\n[tools.update_plan]\n'
    'enabled = true\n'
)


def is_sensitive_environment_key(name: str) -> bool:
    return bool(SENSITIVE_ENV_PATTERN.search(name))


def build_environment(
    base_env: Mapping[str, str], home_dir: Path, artifact_dir: Path
) -> dict[str, str]:
    """Return a child environment that cannot use the developer's Ruxex home."""

    environment = {
        key: value
        for key, value in base_env.items()
        if not is_sensitive_environment_key(key)
    }
    artifact_dir = artifact_dir.resolve()
    environment.pop("RUXEX_PROVIDER", None)
    environment.update(
        {
            "HOME": str(home_dir),
            "RUXEX_HOME": str(home_dir / ".ruxex_desktop"),
            "RUXEX_DUMMY_HOME": str(home_dir / ".ruxex_desktop"),
            "RUXEX_APP_SERVER_MODE": "daemon",
            "RUXEX_E2E_PLUGIN": base_env.get("RUXEX_E2E_PLUGIN", "1"),
            "GDK_BACKEND": "x11",
            "XDG_CONFIG_HOME": str(home_dir / "xdg-config"),
            "XDG_DATA_HOME": str(home_dir / "xdg-data"),
            "XDG_CACHE_HOME": str(home_dir / "xdg-cache"),
            "XDG_STATE_HOME": str(home_dir / "xdg-state"),
            "RUXEX_E2E_ARTIFACTS": str(artifact_dir),
        }
    )

    additional_path_entries: list[str] = []
    for variable in ("TAURI_DRIVER_PATH", "WEBKIT_WEBDRIVER_PATH", "XVFB_RUN_PATH"):
        value = environment.get(variable)
        if value:
            additional_path_entries.append(str(Path(value).expanduser().resolve().parent))
    if additional_path_entries:
        existing_path = environment.get("PATH", "")
        environment["PATH"] = os.pathsep.join(
            [*additional_path_entries, existing_path]
        )
    return environment


def build_wdio_command(
    spec: str | None = None, *, config: str = "wdio.conf.ts"
) -> list[str]:
    command = ["pnpm", "exec", "wdio", "run", config]
    if spec:
        command.extend(["--spec", spec])
    return command


def wrap_headless(command: Sequence[str], headless: bool) -> list[str]:
    if not headless:
        return list(command)
    return [
        "xvfb-run",
        "--auto-servernum",
        "--server-args=-screen 0 1280x800x24",
        *command,
    ]


def safe_environment_metadata(environment: Mapping[str, str]) -> dict[str, str]:
    return {
        key: environment[key]
        for key in sorted(SAFE_ENVIRONMENT_KEYS.intersection(environment))
        if not is_sensitive_environment_key(key)
    }


def prepare_dummy_provider_home(environment: Mapping[str, str]) -> Path:
    """Create only the local auth fixture needed by the fixed-response provider."""

    ruxex_home = Path(environment["RUXEX_HOME"])
    ruxex_home.mkdir(parents=True, exist_ok=True)
    (ruxex_home / "config.toml").write_text(
        DUMMY_PROVIDER_CONFIG,
        encoding="utf-8",
    )
    auth_file = ruxex_home / "auth.json"
    auth_file.write_text(
        json.dumps(
            {
                "auth_mode": "apiKey",
                "api_key": "ruxex-e2e-dummy",
                "credentials": {},
            }
        )
        + "\n",
        encoding="utf-8",
    )
    return auth_file


def prepare_persistent_dummy_home() -> Path:
    """Reset and return the repository-local dummy-home directory."""

    if DUMMY_HOME_DIR.exists():
        shutil.rmtree(DUMMY_HOME_DIR)
    DUMMY_HOME_DIR.mkdir(parents=True, exist_ok=True)
    return DUMMY_HOME_DIR


def prepare_persistent_marketplace_home() -> Path:
    """Reset and return the repository-local marketplace fixture directory."""

    if MARKETPLACE_HOME_DIR.exists():
        shutil.rmtree(MARKETPLACE_HOME_DIR)
    MARKETPLACE_HOME_DIR.mkdir(parents=True, exist_ok=True)
    return MARKETPLACE_HOME_DIR


@contextmanager
def _run_home(
    dummy_home: bool,
    dummy_events: bool = False,
    marketplace_home: bool = False,
) -> Iterator[Path]:
    if sum((dummy_home, dummy_events, marketplace_home)) > 1:
        raise ValueError("fixture home modes are mutually exclusive")
    if dummy_home:
        yield prepare_persistent_dummy_home()
        return

    if dummy_events:
        if not DUMMY_HOME_DIR.is_dir():
            raise RuntimeError(
                "volatile dummy events require a prepared home; "
                "run make prepare-dummy-home first"
            )
        yield DUMMY_HOME_DIR
        return

    if marketplace_home:
        yield prepare_persistent_marketplace_home()
        return

    with tempfile.TemporaryDirectory(prefix="ruxex-e2e-home-") as temporary_home:
        yield Path(temporary_home)


def process_output_preview(output: str, max_chars: int = 4000) -> str:
    """Keep terminal output useful without flooding the agent transcript."""

    if len(output) <= max_chars:
        return output
    return "[...truncated...]\n" + output[-max_chars:]


def _resolve_executable(
    name: str, environment: Mapping[str, str], override_variable: str | None = None
) -> str | None:
    if override_variable:
        override = environment.get(override_variable)
        if override:
            candidate = Path(override).expanduser()
            if candidate.is_file() and os.access(candidate, os.X_OK):
                return str(candidate)
    return shutil.which(name, path=environment.get("PATH"))


def _start_tauri_driver(
    environment: dict[str, str], run_directory: Path
) -> subprocess.Popen[bytes]:
    executable = _resolve_executable(
        "tauri-driver", environment, "TAURI_DRIVER_PATH"
    )
    if executable is None:
        raise RuntimeError("tauri-driver was not found in PATH")

    port = _find_tauri_driver_port()
    environment["WDIO_TAURI_DRIVER_PORT"] = str(port)
    log_path = run_directory / "tauri-driver.log"
    with log_path.open("wb") as log_file:
        process = subprocess.Popen(
            [executable, "--port", str(port)],
            cwd=REPOSITORY_ROOT,
            env=dict(environment),
            stdout=log_file,
            stderr=subprocess.STDOUT,
        )

    deadline = time.monotonic() + 10.0
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(
                f"tauri-driver exited before becoming ready; see {log_path}"
            )
        try:
            with socket.create_connection(
                ("127.0.0.1", port), timeout=0.2
            ):
                return process
        except OSError:
            time.sleep(0.05)

    process.terminate()
    raise RuntimeError(
        f"tauri-driver did not become ready on port {port}; see {log_path}"
    )


def _find_tauri_driver_port() -> int:
    """Choose an unused WebDriver port and leave its adjacent WebKit port free."""

    candidates = [TAURI_DRIVER_PORT]
    for _ in range(20):
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            candidates.append(probe.getsockname()[1])

    for port in candidates:
        if port >= 65535:
            continue
        try:
            with socket.socket() as webdriver_probe, socket.socket() as webkit_probe:
                webdriver_probe.bind(("127.0.0.1", port))
                webkit_probe.bind(("127.0.0.1", port + 1))
        except OSError:
            continue
        return port
    raise RuntimeError("No available adjacent ports for tauri-driver and WebKitWebDriver")


def _stop_tauri_driver(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=2.0)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()


def preflight_errors(
    environment: Mapping[str, str], app_binary: Path, headless: bool
) -> list[str]:
    errors: list[str] = []
    if not app_binary.is_file():
        errors.append(f"Tauri app binary not found: {app_binary}")
    elif not os.access(app_binary, os.X_OK):
        errors.append(f"Tauri app binary is not executable: {app_binary}")
    if _resolve_executable("pnpm", environment) is None:
        errors.append("pnpm was not found in PATH")
    if _resolve_executable("tauri-driver", environment, "TAURI_DRIVER_PATH") is None:
        errors.append("tauri-driver was not found in PATH")
    if (
        _resolve_executable("WebKitWebDriver", environment, "WEBKIT_WEBDRIVER_PATH")
        is None
    ):
        errors.append("WebKitWebDriver was not found in PATH")
    if headless and _resolve_executable("xvfb-run", environment, "XVFB_RUN_PATH") is None:
        errors.append("xvfb-run was not found in PATH for headless execution")
    return errors


def _write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _create_artifact_directory(artifact_root: Path) -> Path:
    artifact_root.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
    run_directory = artifact_root / run_id
    run_directory.mkdir()
    return run_directory


def _snapshot_service_logs() -> dict[Path, int]:
    log_directory = REPOSITORY_ROOT / "logs"
    if not log_directory.is_dir():
        return {}
    snapshot: dict[Path, int] = {}
    for path in log_directory.glob("wdio-*.log"):
        try:
            snapshot[path] = path.stat().st_mtime_ns
        except OSError:
            continue
    return snapshot


def _copy_new_service_logs(
    run_directory: Path, previous_logs: Mapping[Path, int]
) -> None:
    log_directory = REPOSITORY_ROOT / "logs"
    if not log_directory.is_dir():
        return
    for source in log_directory.glob("wdio-*.log"):
        try:
            changed = previous_logs.get(source) != source.stat().st_mtime_ns
        except OSError:
            continue
        if not changed:
            continue
        try:
            shutil.copy2(source, run_directory / source.name)
        except OSError as error:
            print(f"E2E log artifact copy failed for {source.name}: {error}")


def _isolated_process_ids(environment: Mapping[str, str]) -> list[int]:
    """Find children that inherited this run's unique HOME and RUXEX_HOME."""

    expected = {
        key: environment[key]
        for key in ("HOME", "RUXEX_HOME")
        if key in environment
    }
    if len(expected) != 2 or not Path("/proc").is_dir():
        return []

    process_ids: list[int] = []
    for entry in Path("/proc").iterdir():
        if not entry.name.isdigit():
            continue
        try:
            values = {
                item.split(b"=", 1)[0].decode("utf-8", "replace"): item.split(
                    b"=", 1
                )[1].decode("utf-8", "replace")
                for item in (entry / "environ").read_bytes().split(b"\0")
                if b"=" in item
            }
        except (OSError, ValueError):
            continue
        if all(values.get(key) == value for key, value in expected.items()):
            process_ids.append(int(entry.name))
    return process_ids


def _terminate_isolated_processes(environment: Mapping[str, str]) -> None:
    """Stop app-server descendants before the temporary home is removed."""

    process_ids = [pid for pid in _isolated_process_ids(environment) if pid != os.getpid()]
    for process_id in process_ids:
        try:
            os.kill(process_id, signal.SIGTERM)
        except ProcessLookupError:
            continue

    deadline = time.monotonic() + 2.0
    while time.monotonic() < deadline:
        remaining = [
            pid for pid in _isolated_process_ids(environment) if pid != os.getpid()
        ]
        if not remaining:
            return
        time.sleep(0.05)

    for process_id in remaining:
        try:
            os.kill(process_id, signal.SIGKILL)
        except ProcessLookupError:
            continue


def run_e2e(
    headless: bool,
    spec: str | None = None,
    dummy_home: bool = False,
    dummy_events: bool = False,
    marketplace_home: bool = False,
) -> int:
    artifact_root = Path(
        os.environ.get("RUXEX_E2E_ARTIFACT_ROOT", str(DEFAULT_ARTIFACT_ROOT))
    ).expanduser()
    run_directory = _create_artifact_directory(artifact_root)
    app_binary = Path(
        os.environ.get(
            "RUXEX_E2E_APP_BINARY", str(REPOSITORY_ROOT / "target" / "debug" / "ruxex-desktop")
        )
    ).expanduser()
    fixture_home = dummy_home or dummy_events or marketplace_home
    config = fixture_wdio_config(dummy_home, dummy_events, marketplace_home)
    command = wrap_headless(build_wdio_command(spec, config=config), headless)

    with _run_home(dummy_home, dummy_events, marketplace_home) as home_dir:
        environment = build_environment(os.environ, home_dir, run_directory)
        environment["RUXEX_E2E_APP_BINARY"] = str(app_binary.resolve())
        if headless:
            environment["RUXEX_E2E_HEADLESS"] = "1"
        if os.environ.get("RUXEX_E2E_LOG_LEVEL"):
            environment["RUXEX_E2E_LOG_LEVEL"] = os.environ["RUXEX_E2E_LOG_LEVEL"]
        if dummy_home or marketplace_home:
            prepare_dummy_provider_home(environment)
        previous_service_logs = _snapshot_service_logs()

        metadata: dict[str, object] = {
            "app_binary": str(app_binary.resolve()),
            "command": command,
            "environment": safe_environment_metadata(environment),
            "headless": headless,
            "dummy_home": dummy_home,
            "dummy_events": dummy_events,
            "marketplace_home": marketplace_home,
            "fixture_mode": (
                "persistent"
                if dummy_home
                else "volatile"
                if dummy_events
                else "marketplace"
                if marketplace_home
                else "temporary"
            ),
            "spec": spec,
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
        _write_json(run_directory / "run.json", metadata)

        errors = preflight_errors(environment, app_binary.resolve(), headless)
        if errors:
            exit_code = 2
            output = "E2E preflight failed:\n" + "\n".join(f"- {error}" for error in errors)
        else:
            tauri_driver_process: subprocess.Popen[bytes] | None = None
            try:
                if fixture_home:
                    tauri_driver_process = _start_tauri_driver(
                        environment, run_directory
                    )
                completed = subprocess.run(
                    command,
                    cwd=REPOSITORY_ROOT,
                    env=environment,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    check=False,
                )
                exit_code = completed.returncode
                output = completed.stdout
            except KeyboardInterrupt:
                exit_code = 130
                output = "E2E command interrupted by user\n"
            except OSError as error:
                exit_code = 127
                output = f"Failed to start E2E command: {error}"
            except RuntimeError as error:
                exit_code = 127
                output = f"Failed to start Tauri fixture runner: {error}\n"
            finally:
                if tauri_driver_process is not None:
                    _stop_tauri_driver(tauri_driver_process)

        (run_directory / "process.log").write_text(output, encoding="utf-8")
        _copy_new_service_logs(run_directory, previous_service_logs)
        metadata.update(
            {
                "exit_code": exit_code,
                "finished_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        _write_json(run_directory / "run.json", metadata)
        _terminate_isolated_processes(environment)
        print(f"E2E artifacts: {run_directory}")
        if output:
            preview = process_output_preview(output)
            print(preview, end="" if preview.endswith("\n") else "\n")
        return exit_code


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--headless", action="store_true")
    parser.add_argument("--spec")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--binary", dest="app_binary")
    fixture_modes = parser.add_mutually_exclusive_group()
    fixture_modes.add_argument("--dummy-home", action="store_true")
    fixture_modes.add_argument("--dummy-events", action="store_true")
    fixture_modes.add_argument("--marketplace-home", action="store_true")
    return parser.parse_args(argv)


def fixture_wdio_config(
    dummy_home: bool, dummy_events: bool, marketplace_home: bool
) -> str:
    if marketplace_home:
        return "wdio.marketplace-home.conf.mjs"
    if dummy_home or dummy_events:
        return "wdio.dummy-home.conf.mjs"
    return "wdio.conf.ts"


def main(argv: Sequence[str] | None = None) -> int:
    arguments = parse_args(argv)
    if arguments.app_binary:
        os.environ["RUXEX_E2E_APP_BINARY"] = arguments.app_binary
    if arguments.verbose:
        os.environ["RUXEX_E2E_LOG_LEVEL"] = "debug"
    try:
        return run_e2e(
            arguments.headless,
            arguments.spec,
            arguments.dummy_home,
            arguments.dummy_events,
            arguments.marketplace_home,
        )
    except RuntimeError as error:
        print(f"E2E preflight failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
