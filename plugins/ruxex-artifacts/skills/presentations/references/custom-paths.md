# Custom paths

Custom editable shapes use geometry: "custom" with a customPaths list.
Paths support the documented DrawingML move, line, cubic Bezier, and close
commands. Use custom paths for a requested editable diagram or an evidence
shape. Do not use them to draw decorative illustrations; use a suitable image
asset for decoration.

The local SVG preview and PPTX exporter support a bounded path subset. PowerPoint
may render curves and joins differently, and unsupported path commands are not
silently converted into equivalent artwork. Check the exported file with the
packaged renderer when path geometry affects meaning.
