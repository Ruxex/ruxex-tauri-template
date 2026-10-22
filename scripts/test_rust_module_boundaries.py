import unittest
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
LIB_RS = REPOSITORY_ROOT / "src-tauri" / "src" / "lib.rs"


class RustModuleBoundariesTest(unittest.TestCase):
    def test_lib_rs_is_only_a_composition_root(self) -> None:
        source = LIB_RS.read_text(encoding="utf-8")

        self.assertLess(
            len(source.splitlines()),
            220,
            "lib.rs should only compose the Tauri application",
        )
        self.assertNotIn(
            "#[tauri::command]",
            source,
            "Tauri commands belong in focused command modules",
        )


if __name__ == "__main__":
    unittest.main()
