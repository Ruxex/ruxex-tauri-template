# Presentation object

Create a model with Presentation.create({ title, slideSize }). The default
canvas is 1280 × 720 CSS pixels. Set a positive custom width and height when
the user supplies a different aspect ratio; do not assume 16:9. Add slides
through presentation.slides and set the deck's default font and color scheme
through presentation.theme.

The model owns slides, themes, masters, layouts, comments, and view settings.
Export a local editable file with PresentationFile.exportPptx(presentation).
The facade uses Ruxex's local runtime and is not a hosted artifact session.

    const presentation = Presentation.create({
      title: "Research briefing",
      slideSize: { width: 1280, height: 720 },
    });
    presentation.theme.defaultFont = "Aptos";
