#!/usr/bin/env python3
"""Serve a small, local screenshot gallery for the Ruxex E2E artifacts."""

from __future__ import annotations

import argparse
import html
import json
import webbrowser
from datetime import datetime, timedelta
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Iterable
from urllib.parse import quote, urlsplit


IMAGE_EXTENSIONS = {".jpeg", ".jpg", ".png", ".webp"}
UI_FIXTURE_SPECS = (
    "fixtures/dummy-home/persistent.spec.ts",
    "fixtures/dummy-home/pages.spec.ts",
    "fixtures/dummy-home/unshot.spec.ts",
    "fixtures/dummy-home/volatile.spec.ts",
    "fixtures/marketplace-home/persistent.spec.ts",
)
PAGE_GROUPS = (
    ("home", "Home"),
    ("login", "Login"),
    ("threads", "Threads"),
    ("chat", "Chat"),
    ("disconnect-recovery", "Message States"),
    ("pending", "Message States"),
    ("queued-message", "Message States"),
    ("slow-stream", "Message States"),
    ("composer", "Composer"),
    ("slash-commands", "Slash Commands"),
    ("quick-panel", "Quick Panel"),
    ("project", "Projects"),
    ("projects", "Projects"),
    ("settings", "Settings"),
    ("automation", "Automations"),
    ("approval-center", "Approval Center"),
    ("capabilities", "Capabilities"),
    ("mcp", "MCP"),
    ("marketplace", "Marketplace"),
    ("archived-chats", "Archived Chats"),
    ("contact-sheet", "Contact Sheet"),
)


def format_size(size: int) -> str:
    """Return a compact human-readable file size."""

    if size < 1024:
        return f"{size} B"
    if size < 1024 * 1024:
        return f"{size / 1024:.1f} KB"
    return f"{size / (1024 * 1024):.1f} MB"


def list_images(root: Path, collections: Iterable[Path] | None = None) -> list[tuple[Path, int, float]]:
    """Collect image files from selected collections, newest first."""

    images: list[tuple[Path, int, float]] = []
    for collection in collections or (root,):
        for path in collection.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
                continue
            try:
                stat = path.stat()
            except OSError:
                continue
            images.append((path.relative_to(root), stat.st_size, stat.st_mtime))
    return sorted(images, key=lambda image: image[2], reverse=True)


def find_latest_collection(root: Path) -> Path:
    """Find the newest direct child directory containing screenshots."""

    collections = [
        child
        for child in root.iterdir()
        if child.is_dir()
        and any(
            path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
            for path in child.rglob("*")
        )
    ]
    if not collections:
        return root

    def newest_image_mtime(collection: Path) -> float:
        return max(
            path.stat().st_mtime
            for path in collection.rglob("*")
            if path.is_file()
        )

    return max(collections, key=newest_image_mtime)


def _run_records(root: Path) -> list[tuple[datetime, Path, str]]:
    records: list[tuple[datetime, Path, str]] = []
    for collection in root.iterdir():
        run_file = collection / "run.json"
        if not collection.is_dir() or not run_file.is_file():
            continue
        try:
            run = json.loads(run_file.read_text(encoding="utf-8"))
            started_at = datetime.fromisoformat(run["started_at"])
            if run.get("exit_code") != 0:
                continue
            records.append((started_at, collection, run["spec"]))
        except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError):
            continue
    return sorted(records)


def find_latest_batch(root: Path) -> list[Path]:
    """Find the newest complete `make ui-fixtures` sequence."""

    records = _run_records(root)
    for final_index in range(len(records) - 1, -1, -1):
        started_at, collection, spec = records[final_index]
        if spec != UI_FIXTURE_SPECS[-1]:
            continue

        selected = [collection]
        cursor = started_at
        for expected_spec in reversed(UI_FIXTURE_SPECS[:-1]):
            candidates = [
                record
                for record in records[:final_index]
                if record[0] < cursor
                and record[2] == expected_spec
                and cursor - record[0] <= timedelta(minutes=10)
            ]
            if not candidates:
                break
            previous = candidates[-1]
            selected.insert(0, previous[1])
            cursor = previous[0]
            final_index = records.index(previous)
        else:
            return selected

    latest = find_latest_collection(root)
    return [latest]


def page_group(relative_path: Path) -> str:
    """Convert a screenshot filename into a human-readable page group."""

    stem = relative_path.stem.lower()
    for prefix, label in sorted(PAGE_GROUPS, key=lambda item: len(item[0]), reverse=True):
        if stem == prefix or stem.startswith(f"{prefix}-"):
            return label
    return stem.split("-", 1)[0].replace("-", " ").title() or "Other"


def group_images(images: list[tuple[Path, int, float]]) -> list[tuple[str, list[tuple[Path, int, float]]]]:
    """Group screenshots by page and keep the configured page order."""

    groups: dict[str, list[tuple[Path, int, float]]] = {}
    for image in images:
        groups.setdefault(page_group(image[0]), []).append(image)

    page_order = {label: index for index, (_, label) in enumerate(PAGE_GROUPS)}
    return sorted(
        groups.items(),
        key=lambda item: (page_order.get(item[0], len(page_order)), item[0]),
    )


def image_card(
    relative_path: Path,
    size: int,
    modified: float,
    *,
    index: int,
) -> str:
    """Render one gallery card."""

    relative_url = quote(relative_path.as_posix(), safe="/")
    display_path = html.escape(relative_path.as_posix())
    modified_at = datetime.fromtimestamp(modified).astimezone().strftime("%Y-%m-%d %H:%M")
    return f"""
      <button class="card slideshow-trigger" type="button" data-slideshow-index="{index}" aria-label="Open {display_path} in slideshow">
        <div class="preview"><img src="/{relative_url}" alt="{display_path}" loading="lazy"></div>
        <div class="card-body">
          <div class="filename">{display_path}</div>
          <div class="metadata">{modified_at} · {format_size(size)}</div>
        </div>
      </button>"""


def build_gallery_document(
    root: Path,
    *,
    select_latest: bool = True,
    collection_label: str | None = None,
    collections: Iterable[Path] | None = None,
) -> str:
    """Build the gallery page, selecting the latest fixture batch by default."""

    selected_collections = list(collections or (find_latest_batch(root) if select_latest else (root,)))
    images = list_images(root, selected_collections)
    sections: list[str] = []
    slideshow_images: list[dict[str, str]] = []
    for group, group_images_list in group_images(images):
        global_index = len(slideshow_images)
        slideshow_images.extend(
            {
                "src": f"/{quote(path.as_posix(), safe='/')}",
                "alt": path.as_posix(),
                "label": path.as_posix(),
            }
            for path, _, _ in group_images_list
        )
        cards = "\n".join(
            image_card(
                path,
                size,
                modified,
                index=global_index + index,
            )
            for index, (path, size, modified) in enumerate(group_images_list)
        )
        count = len(group_images_list)
        suffix = "s" if count != 1 else ""
        sections.append(
            f'''<section class="page-group">
        <div class="section-heading"><h2>{html.escape(group)}</h2><span>{count} screenshot{suffix}</span></div>
        <div class="grid">{cards}
        </div>
      </section>'''
        )

    if not sections:
        sections.append('<div class="empty">No screenshots found in this directory.</div>')

    title = "Screenshot Gallery"
    label = collection_label or f"Collection: {', '.join(collection.name for collection in selected_collections)}"
    subtitle = f"{len(images)} screenshot{'s' if len(images) != 1 else ''} · {html.escape(label)}"
    slideshow_json = json.dumps(slideshow_images, ensure_ascii=False).replace("<", "\\u003c")
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{title}</title>
    <style>
      :root {{ color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }}
      * {{ box-sizing: border-box; }}
      body {{ margin: 0; min-width: 320px; color: #e5e7eb; background: #0f172a; }}
      main {{ width: min(1440px, calc(100% - 40px)); margin: 0 auto; padding: 36px 0 48px; }}
      header {{ margin-bottom: 32px; }}
      h1 {{ margin: 0; font-size: clamp(1.7rem, 3vw, 2.5rem); letter-spacing: -0.04em; }}
      .subtitle {{ margin: 8px 0 0; color: #94a3b8; font-size: 0.9rem; overflow-wrap: anywhere; }}
      .page-group + .page-group {{ margin-top: 36px; }}
      .section-heading {{ display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 12px; }}
      h2 {{ margin: 0; color: #f8fafc; font-size: 1.15rem; letter-spacing: -0.02em; }}
      .section-heading span {{ color: #64748b; font-size: 0.78rem; white-space: nowrap; }}
      .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }}
      .card {{ display: block; overflow: hidden; color: inherit; text-decoration: none; background: #1e293b; border: 1px solid #334155; border-radius: 14px; transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease; }}
      button.card {{ width: 100%; padding: 0; text-align: left; font: inherit; cursor: pointer; }}
      .card:hover {{ transform: translateY(-2px); border-color: #60a5fa; box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22); }}
      .preview {{ aspect-ratio: 16 / 10; background: #020617; }}
      .preview img {{ display: block; width: 100%; height: 100%; object-fit: contain; }}
      .card-body {{ padding: 12px 14px 13px; }}
      .filename {{ color: #f8fafc; font-size: 0.88rem; line-height: 1.4; overflow-wrap: anywhere; }}
      .metadata {{ margin-top: 6px; color: #94a3b8; font-size: 0.75rem; }}
      .empty {{ padding: 48px 20px; text-align: center; color: #94a3b8; background: #1e293b; border: 1px dashed #475569; border-radius: 14px; }}
      dialog.slideshow {{ width: 100vw; height: 100dvh; max-width: none; max-height: none; margin: 0; padding: 0; color: #e5e7eb; background: #0f172a; border: 0; border-radius: 0; box-shadow: none; }}
      dialog.slideshow::backdrop {{ background: rgba(2, 6, 23, 0.84); backdrop-filter: blur(4px); }}
      .slideshow-shell {{ display: grid; width: 100%; height: 100%; grid-template-columns: auto minmax(0, 1fr) auto; grid-template-rows: auto minmax(0, 1fr); gap: 8px; padding: max(8px, 1.5vw); }}
      .slideshow-close {{ grid-column: 1 / -1; justify-self: end; }}
      .slideshow-control {{ display: inline-flex; align-items: center; justify-content: center; align-self: center; width: 44px; height: 44px; color: #f8fafc; background: #1e293b; border: 1px solid #475569; border-radius: 999px; cursor: pointer; font-size: 1.5rem; }}
      .slideshow-control:hover {{ background: #334155; border-color: #93c5fd; }}
      .slideshow-control:focus-visible, .slideshow-trigger:focus-visible {{ outline: 2px solid #60a5fa; outline-offset: 3px; }}
      .slideshow-stage {{ display: flex; min-width: 0; min-height: 0; flex-direction: column; align-items: center; justify-content: center; gap: 8px; margin: 0; touch-action: pan-y; user-select: none; }}
      .slideshow-stage img {{ display: block; max-width: 100%; max-height: calc(100dvh - 96px); object-fit: contain; }}
      .slideshow-caption {{ display: flex; width: 100%; justify-content: space-between; gap: 16px; color: #cbd5e1; font-size: 0.85rem; }}
      .slideshow-caption span:first-child {{ min-width: 0; overflow-wrap: anywhere; }}
      @media (max-width: 640px) {{ .slideshow-shell {{ padding: 6px; }} .slideshow-control {{ width: 38px; height: 38px; }} .slideshow-stage img {{ max-height: calc(100dvh - 82px); }} }}
      @media (max-width: 640px) {{ main {{ width: min(100% - 24px, 520px); padding-top: 24px; }} .grid {{ grid-template-columns: 1fr; }} }}
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>{title}</h1>
        <p class="subtitle">{subtitle}</p>
      </header>
      {''.join(sections)}
    </main>
    <dialog class="slideshow" id="slideshow-dialog" aria-labelledby="slideshow-title">
      <div class="slideshow-shell">
        <button class="slideshow-control slideshow-close" id="slideshow-close" type="button" aria-label="Close slideshow">×</button>
        <button class="slideshow-control" id="slideshow-previous" type="button" aria-label="Previous screenshot">‹</button>
        <figure class="slideshow-stage" id="slideshow-stage">
          <img id="slideshow-image" alt="" draggable="false">
          <figcaption class="slideshow-caption">
            <span id="slideshow-title"></span>
            <span id="slideshow-position" aria-live="polite"></span>
          </figcaption>
        </figure>
        <button class="slideshow-control" id="slideshow-next" type="button" aria-label="Next screenshot">›</button>
      </div>
    </dialog>
    <script id="slideshow-data" type="application/json">{slideshow_json}</script>
    <script>
      (() => {{
        const slideshowImages = JSON.parse(document.getElementById("slideshow-data").textContent);
        const dialog = document.getElementById("slideshow-dialog");
        const image = document.getElementById("slideshow-image");
        const title = document.getElementById("slideshow-title");
        const position = document.getElementById("slideshow-position");
        const stage = document.getElementById("slideshow-stage");
        const previous = document.getElementById("slideshow-previous");
        const next = document.getElementById("slideshow-next");
        const close = document.getElementById("slideshow-close");
        let currentIndex = 0;
        let pointerStart = null;

        function renderSlide() {{
          if (!slideshowImages.length) return;
          const slide = slideshowImages[currentIndex];
          image.src = slide.src;
          image.alt = slide.alt;
          title.textContent = slide.label;
          position.textContent = `${{currentIndex + 1}} / ${{slideshowImages.length}}`;
        }}

        function openSlideshow(index) {{
          if (!slideshowImages.length) return;
          currentIndex = ((index % slideshowImages.length) + slideshowImages.length) % slideshowImages.length;
          renderSlide();
          if (!dialog.open) dialog.showModal();
        }}

        function move(delta) {{
          if (!slideshowImages.length) return;
          currentIndex = (currentIndex + delta + slideshowImages.length) % slideshowImages.length;
          renderSlide();
        }}

        function closeSlideshow() {{
          if (dialog.open) dialog.close();
        }}

        document.querySelectorAll("[data-slideshow-index]").forEach((card) => {{
          card.addEventListener("click", () => {{
            const index = Number(card.dataset.slideshowIndex);
            openSlideshow(index);
          }});
        }});
        previous.addEventListener("click", () => move(-1));
        next.addEventListener("click", () => move(1));
        close.addEventListener("click", closeSlideshow);
        dialog.addEventListener("cancel", (event) => {{
          event.preventDefault();
          closeSlideshow();
        }});
        dialog.addEventListener("click", (event) => {{
          if (event.target === dialog) closeSlideshow();
        }});
        dialog.addEventListener("keydown", (event) => {{
          if (event.key === "ArrowLeft") move(-1);
          if (event.key === "ArrowRight") move(1);
          if (event.key === "Escape") closeSlideshow();
        }});
        stage.addEventListener("pointerdown", (event) => {{
          pointerStart = {{ x: event.clientX, y: event.clientY }};
          stage.setPointerCapture?.(event.pointerId);
        }});
        stage.addEventListener("pointerup", (event) => {{
          if (!pointerStart) return;
          const deltaX = event.clientX - pointerStart.x;
          const deltaY = event.clientY - pointerStart.y;
          pointerStart = null;
          if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) >= 40) {{
            move(deltaX < 0 ? 1 : -1);
          }}
        }});
        stage.addEventListener("pointercancel", () => {{ pointerStart = null; }});
      }})();
    </script>
  </body>
</html>
"""


class GalleryHandler(SimpleHTTPRequestHandler):
    """Add a generated index page while retaining normal static file serving."""

    server_version = "RuxexScreenshotGallery/1.0"

    def __init__(self, *args, collection_label: str, collections: tuple[Path, ...], **kwargs):
        self.collection_label = collection_label
        self.collections = collections
        super().__init__(*args, **kwargs)

    def do_GET(self) -> None:
        if urlsplit(self.path).path in {"/", "/index.html"}:
            self.send_gallery()
            return
        super().do_GET()

    def send_gallery(self) -> None:
        document = build_gallery_document(
            Path(self.directory),
            select_latest=False,
            collection_label=self.collection_label,
            collections=self.collections,
        )
        payload = document.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path("artifacts/e2e"),
        help="directory containing screenshot collections (default: artifacts/e2e)",
    )
    parser.add_argument("--all", action="store_true", help="show every collection instead of only the latest ui-fixtures batch")
    parser.add_argument("--host", default="0.0.0.0", help="host to bind (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8765, help="port to bind (default: 8765)")
    parser.add_argument("--open", action="store_true", help="open the gallery in the default browser")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    root = args.root.expanduser().resolve()
    if not root.is_dir():
        raise SystemExit(f"Screenshot directory does not exist: {root}")

    collections = [root] if args.all else find_latest_batch(root)
    label = "All collections" if args.all else f"Latest ui-fixtures batch ({len(collections)} runs)"
    handler = partial(
        GalleryHandler,
        directory=str(root),
        collection_label=label,
        collections=tuple(collections),
    )
    server = ThreadingHTTPServer((args.host, args.port), handler)
    url = f"http://{args.host}:{args.port}/"
    print(f"Serving {root}")
    print(f"Screenshot gallery: {url}")
    if args.open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping screenshot gallery")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
