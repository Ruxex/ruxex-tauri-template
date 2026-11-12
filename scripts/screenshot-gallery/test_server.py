#!/usr/bin/env python3

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from server import (
    build_gallery_document,
    find_latest_batch,
    find_latest_collection,
    group_images,
)


class ScreenshotGalleryTests(unittest.TestCase):
    def test_selects_the_newest_collection_with_images(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            old = root / "20261109T150958Z-old"
            newest = root / "20261109T151428Z-new"
            old.mkdir()
            newest.mkdir()
            (old / "home.png").write_bytes(b"old")
            (newest / "settings.png").write_bytes(b"new")
            os.utime(old, (100, 100))
            os.utime(newest, (200, 200))

            self.assertEqual(find_latest_collection(root), newest)

    def test_selects_the_latest_complete_ui_fixture_batch(self) -> None:
        specs = (
            "fixtures/dummy-home/persistent.spec.ts",
            "fixtures/dummy-home/pages.spec.ts",
            "fixtures/dummy-home/unshot.spec.ts",
            "fixtures/dummy-home/volatile.spec.ts",
            "fixtures/marketplace-home/persistent.spec.ts",
            "fixtures/dummy-home/git-diff-review.spec.ts",
        )
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            names = ["run-1", "run-2", "run-3", "run-4", "run-5", "run-6"]
            for index, (name, spec) in enumerate(zip(names, specs, strict=True), start=1):
                run = root / name
                run.mkdir()
                (run / "run.json").write_text(
                    json.dumps(
                        {
                            "exit_code": 0,
                            "spec": spec,
                            "started_at": f"2026-11-07T20:4{index}:00+00:00",
                        }
                    )
                )
                (run / f"screenshot-{index}.png").write_bytes(b"image")

            unrelated = root / "newer-dialog-run"
            unrelated.mkdir()
            (unrelated / "run.json").write_text(
                json.dumps(
                    {
                        "exit_code": 0,
                        "spec": "fixtures/dummy-home/dialog-review.spec.ts",
                        "started_at": "2026-11-09T15:14:28+00:00",
                    }
                )
            )
            (unrelated / "dialog.png").write_bytes(b"image")

            batch = find_latest_batch(root)

            self.assertEqual([run.name for run in batch], names)

    def test_groups_screenshots_by_page_prefix(self) -> None:
        images = [
            (Path("settings-appearance.png"), 1, 1.0),
            (Path("settings-models.png"), 1, 1.0),
            (Path("project-create.png"), 1, 1.0),
            (Path("mcp-add-http.png"), 1, 1.0),
        ]

        groups = group_images(images)

        self.assertEqual([group for group, _ in groups], ["Projects", "Settings", "MCP"])
        self.assertEqual({group: len(items) for group, items in groups}, {"Settings": 2, "Projects": 1, "MCP": 1})

    def test_document_contains_page_headings_for_latest_collection(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            collection = root / "latest"
            collection.mkdir()
            (collection / "settings-appearance.png").write_bytes(b"settings")
            (collection / "project-create.png").write_bytes(b"project")
            (collection / "git-diff-review.png").write_bytes(b"git diff")

            document = build_gallery_document(root)

            self.assertIn("Settings", document)
            self.assertIn("Projects", document)
            self.assertIn("Git Diff Review", document)
            self.assertEqual(document.count('<img '), 4)

    def test_document_generates_grouped_slideshow_triggers_and_controls(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            collection = root / "latest"
            collection.mkdir()
            (collection / "settings-general.png").write_bytes(b"general")
            (collection / "settings-appearance.png").write_bytes(b"appearance")
            (collection / "project-create.png").write_bytes(b"project")
            (collection / "git-diff-review.png").write_bytes(b"git diff")

            document = build_gallery_document(root)

            self.assertNotIn('target="_blank"', document)
            self.assertEqual(document.count("data-slideshow-index="), 4)
            self.assertIn('data-slideshow-index="0"', document)
            self.assertIn('data-slideshow-index="1"', document)
            self.assertIn('data-slideshow-index="2"', document)
            self.assertIn('data-slideshow-index="3"', document)
            self.assertIn('<dialog class="slideshow" id="slideshow-dialog"', document)
            self.assertIn('id="slideshow-previous"', document)
            self.assertIn('id="slideshow-next"', document)
            self.assertIn('id="slideshow-close"', document)
            self.assertIn("const slideshowImages =", document)
            self.assertIn("openSlideshow(index)", document)
            self.assertIn('event.key === "ArrowLeft"', document)
            self.assertIn('event.key === "ArrowRight"', document)
            self.assertIn("pointerdown", document)
            self.assertIn("Math.abs(deltaX) > Math.abs(deltaY)", document)
            self.assertIn("width: 100vw", document)
            self.assertIn("height: 100dvh", document)
            self.assertIn("max-height: calc(100dvh", document)


if __name__ == "__main__":
    unittest.main()
