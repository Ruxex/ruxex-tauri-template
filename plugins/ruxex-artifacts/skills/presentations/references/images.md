# Local images

`slide.images.add()` embeds local files or data, including PNG, JPEG, GIF, BMP,
and supported SVG input. HTTP URLs are not fetched. Supply a position and
meaningful `alt` text when the image conveys information. Use `fit: "contain"`
to preserve the full image, or `fit: "cover"` with a deliberate crop. The
original image remains an editable picture object in the PPTX.

```js
slide.images.add({
  src: "/absolute/path/chart-source.png",
  position: { left: 760, top: 180, width: 430, height: 300 },
  fit: "contain",
  alt: "Monthly demand by region",
});
```

Crop insets accept fractions, percentages, or pixel values. Imported crops,
shape masks, rotation, flips, alternative text, and external hyperlinks have
bounded support. Do not use a screenshot in place of an editable chart or table
when the user needs to revise the evidence.
