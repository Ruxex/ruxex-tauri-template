import importlib.util
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).with_name("ci_test_native_artifact_runtime.py")
SPEC = importlib.util.spec_from_file_location("ci_native_runtime", SCRIPT)
assert SPEC and SPEC.loader
CI_RUNTIME = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CI_RUNTIME)


class CiNativeArtifactRuntimeTest(unittest.TestCase):
    def test_validates_the_dependency_closure_of_an_existing_release_runtime(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            runtime = Path(temporary)
            office = runtime / "native/libreoffice/program/soffice.bin"
            office.parent.mkdir(parents=True)
            office.write_text("test binary", encoding="utf-8")
            office.chmod(0o755)
            (runtime / "native/poppler/bin").mkdir(parents=True)
            (runtime / "native/poppler/bin/pdfinfo").write_text("", encoding="utf-8")
            (runtime / "native/poppler/bin/pdftoppm").write_text("", encoding="utf-8")
            manifest = {
                "executables": {
                    "pdfinfo": "native/poppler/bin/pdfinfo",
                    "pdftoppm": "native/poppler/bin/pdftoppm",
                },
                "native": {
                    "libreofficeVersion": "test-office",
                    "popplerVersion": "test-poppler",
                },
            }
            (runtime / "runtime-manifest.json").write_text(
                json.dumps(manifest), encoding="utf-8"
            )

            with (
                patch.object(CI_RUNTIME.sys, "platform", "linux"),
                patch.object(CI_RUNTIME.STAGER, "validate_artifact_runtime") as stage,
                patch.object(CI_RUNTIME, "validate_linux_dependency_closure") as closure,
            ):
                CI_RUNTIME.validate_assembled_runtime(runtime)

            stage.assert_called_once_with(runtime, CI_RUNTIME.BUILDER.target_triple())
            self.assertEqual(closure.call_count, 2)
            self.assertEqual(closure.call_args_list[0].args[1], "native/libreoffice")
            self.assertEqual(closure.call_args_list[1].args[1], "native/poppler")

    def test_parses_dyld_image_log_format(self) -> None:
        images = CI_RUNTIME.parse_macos_dyld_loaded_images(
            "dyld[12345]: <01234567-89AB-CDEF-0123-456789ABCDEF> "
            "/tmp/runtime/native/poppler/lib/libpoppler.dylib\n"
            "<no uuid> /System/Library/Frameworks/AppKit.framework/AppKit\n"
            "dyld[12345]: <no uuid> @rpath/libnot-resolved.dylib\n"
        )

        self.assertEqual(
            images,
            [
                Path("/tmp/runtime/native/poppler/lib/libpoppler.dylib"),
                Path("/System/Library/Frameworks/AppKit.framework/AppKit"),
            ],
        )

    def test_recognizes_macos_system_and_cryptex_libraries(self) -> None:
        self.assertTrue(CI_RUNTIME.is_macos_system_library(
            Path("/System/Volumes/Preboot/Cryptexes/OS/System/Library/libSystem.B.dylib")
        ))
        self.assertTrue(CI_RUNTIME.is_macos_system_library(Path("/usr/lib/libobjc.A.dylib")))
        self.assertFalse(CI_RUNTIME.is_macos_system_library(
            Path("/opt/homebrew/Cellar/poppler/25.01/lib/libpoppler.dylib")
        ))

    def test_macos_dependency_failure_reports_the_command_and_loader_error(self) -> None:
        with self.assertRaisesRegex(
            RuntimeError, "packaged native command pdfinfo failed to start: missing dylib"
        ):
            with patch.object(
                CI_RUNTIME.subprocess,
                "run",
                return_value=SimpleNamespace(returncode=1, stderr="missing dylib"),
            ):
                CI_RUNTIME.validate_macos_dependency_closure(
                    Path("/tmp/runtime"),
                    "native/poppler",
                    ((Path("/tmp/runtime/native/poppler/bin/pdfinfo"), ("-v",)),),
                )


if __name__ == "__main__":
    unittest.main()
