# Local screenshot gallery

This ignored development tool serves the screenshots under `artifacts/e2e` as a small browser gallery.

By default it shows the newest complete `make ui-fixtures` batch (the six E2E runs that make target executes, including the Git diff review fixture) and groups the cards by page name. If no complete batch is available, it falls back to the newest screenshot collection. Use `--all` when you need to inspect every historical collection.

Click a screenshot card to open the slideshow at that image. Use the previous
and next buttons, the left/right arrow keys, or swipe horizontally on the image
to move through every screenshot in gallery order, including across page
groups. Press `Escape` or the close button to return to the gallery.

Run it from the repository root:

```bash
python3 scripts/screenshot-gallery/server.py
```

The server binds to `0.0.0.0` so it is reachable on the host's network interfaces. Open <http://127.0.0.1:8765/> locally. Press `Ctrl-C` to stop the server.

Useful options:

```bash
python3 scripts/screenshot-gallery/server.py --open
python3 scripts/screenshot-gallery/server.py --root path/to/screenshots --port 8877
python3 scripts/screenshot-gallery/server.py --all
```

The server uses only Python's standard library and is intended for local development. The server is a standalone Python script with tests and usage notes alongside it under `scripts/screenshot-gallery/`.
