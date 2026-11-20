# Native charts

Create editable charts with `slide.charts.add(type, options)`. Provide a
position and one or more named series with labels and finite numeric values or
null for missing observations. Chart categories can be shared or set per
series. Common chart options pass through to PptxGenJS.

```js
slide.charts.add("bar", {
  position: { left: 820, top: 190, width: 380, height: 360 },
  series: [{ name: "Revenue", labels: ["Q1", "Q2"], values: [12, 18] }],
  title: "Revenue by quarter",
  showLegend: false,
});
```

The local preview draws basic bar, line, and pie charts with simple axes,
ticks, gridlines, titles, and legends. It does not reproduce every native chart
family or option. Inspect the exported chart and compare categories, series,
periods, units, signs, and labels with the source. See [native evidence](native-evidence.md)
for the chart title and quantitative chart gates.
