# Slide view settings

presentation.view can show, hide, or toggle gridlines, guides, and empty
placeholders. Grid spacing is configurable. These settings help authoring and
layout review; they do not add a visible grid to normal slide content.

    presentation.view.showGridlines();
    presentation.view.showGuides();
    presentation.view.hidePlaceholders();

Gridline and guide visibility round-trip through Ruxex proto data. Grid spacing
is written to PPTX view properties. Empty placeholders hidden from the preview
and export remain model records; filled placeholders stay visible.
