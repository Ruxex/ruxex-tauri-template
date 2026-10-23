import json
import struct
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "src-tauri" / "icons"
TAURI_CONFIG = ROOT / "src-tauri" / "tauri.conf.json"


def png_metadata(path: Path) -> tuple[int, int, int, int]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise AssertionError(f"{path} is not a PNG file")
    width, height, bit_depth, color_type = struct.unpack(">IIBB", data[16:26])
    return width, height, bit_depth, color_type


class DesktopIconTests(unittest.TestCase):
    def test_tauri_bundle_declares_standard_desktop_icons(self) -> None:
        config = json.loads(TAURI_CONFIG.read_text(encoding="utf-8"))
        icons = config["bundle"]["icon"]

        self.assertEqual(
            icons,
            [
                "icons/32x32.png",
                "icons/128x128.png",
                "icons/128x128@2x.png",
                "icons/icon.icns",
                "icons/icon.ico",
            ],
        )

    def test_desktop_icons_have_expected_formats_and_sizes(self) -> None:
        for name, expected_size in (
            ("32x32.png", 32),
            ("128x128.png", 128),
            ("128x128@2x.png", 256),
        ):
            path = ICON_DIR / name
            self.assertTrue(path.is_file(), path)
            width, height, bit_depth, color_type = png_metadata(path)
            self.assertEqual((width, height), (expected_size, expected_size))
            self.assertEqual(bit_depth, 8)
            self.assertEqual(color_type, 6)

        self.assertEqual((ICON_DIR / "icon.icns").read_bytes()[:4], b"icns")
        self.assertTrue((ICON_DIR / "icon.ico").is_file())


if __name__ == "__main__":
    unittest.main()
