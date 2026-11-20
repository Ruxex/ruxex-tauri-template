import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";
import { JSONPath } from "jsonpath-plus";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";

import { ArtifactToolError } from "./a1-range.mjs";
import { runEngine } from "./engine-client.mjs";
import { presentationColorTokens } from "./presentation-color-tokens.mjs";

const pptxShapeTypes = new Set(Object.keys(new PptxGenJS().ShapeType));
const supportedShapes = new Set([...pptxShapeTypes, "rect", "roundRect", "ellipse", "line", "custom"]);
const supportedChartTypes = new Set(Object.keys(new PptxGenJS().ChartType));
const pixelsPerInch = 96;
const defaultThemeColors = {
  accent1: "#4472C4", accent2: "#ED7D31", accent3: "#A5A5A5", accent4: "#FFC000", accent5: "#5B9BD5", accent6: "#70AD47",
  bg1: "#FFFFFF", bg2: "#E7E6E6", tx1: "#000000", tx2: "#44546A", dk1: "#000000", dk2: "#44546A",
  lt1: "#FFFFFF", lt2: "#E7E6E6", hlink: "#0563C1", folHlink: "#954F72",
};

export function fr(value) {
  if (!Number.isFinite(value) || value <= 0) throw new ArtifactToolError("invalid_table_columns", "fr track weight must be positive");
  return { mode: "fr", value };
}

export function fixed(value) {
  if (!Number.isFinite(value) || value <= 0) throw new ArtifactToolError("invalid_table_columns", "fixed track width must be positive pixels");
  return { mode: "fixed", value };
}

function validateCell(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  throw new ArtifactToolError(
    "unsupported_cell_value",
    "presentation tables support strings, numbers, booleans, and null",
  );
}

function validateRows(rows) {
  if (!Array.isArray(rows) || !rows.every(Array.isArray) || rows.length === 0) {
    throw new ArtifactToolError("invalid_table", "presentation tables must be a non-empty matrix");
  }
  const width = rows[0].length;
  if (width === 0 || rows.some((row) => row.length !== width)) {
    throw new ArtifactToolError("invalid_table", "presentation tables must be rectangular");
  }
  rows.flat().forEach(validateCell);
}

function normalizeChartSeries(series, categories = []) {
  if (!Array.isArray(series) || series.length === 0) {
    throw new ArtifactToolError("invalid_chart", "presentation charts require at least one series");
  }
  for (const item of series) {
    if (
      !item ||
      typeof item.name !== "string" ||
      !Array.isArray(item.values) ||
      item.values.length === 0 ||
      item.values.some((value) => value !== null && (typeof value !== "number" || !Number.isFinite(value)))
    ) {
      throw new ArtifactToolError(
        "invalid_chart_series",
        "chart series require a name and non-empty finite numeric or null values",
      );
    }
    const labels = item.labels ?? item.categories ?? categories;
    if (!Array.isArray(labels) || labels.length !== item.values.length || labels.some((label) => typeof label !== "string")) {
      throw new ArtifactToolError("invalid_chart_series", "chart series require matching string labels or chart categories");
    }
    for (const field of ["xValues", "bubbleSizes"]) {
      if (item[field] !== undefined && (!Array.isArray(item[field]) || item[field].length !== item.values.length || item[field].some((value) => value !== null && (typeof value !== "number" || !Number.isFinite(value))))) {
        throw new ArtifactToolError("invalid_chart_series", `${field} must contain one finite number or null per data point`);
      }
    }
    if (item.categoryPaths !== undefined && (!Array.isArray(item.categoryPaths) || item.categoryPaths.length !== item.values.length || item.categoryPaths.some((path) => !Array.isArray(path) || path.some((part) => typeof part !== "string")))) {
      throw new ArtifactToolError("invalid_chart_series", "categoryPaths must contain a string path for each data point");
    }
    if (item.bubbleSizeFormula !== undefined && typeof item.bubbleSizeFormula !== "string") throw new ArtifactToolError("invalid_chart_series", "bubbleSizeFormula must be a string");
    if (item.bubbleSizesFormatCode !== undefined && typeof item.bubbleSizesFormatCode !== "string") throw new ArtifactToolError("invalid_chart_series", "bubbleSizesFormatCode must be a string");
    if (item.explosion !== undefined && (!Number.isFinite(item.explosion) || item.explosion < 0)) throw new ArtifactToolError("invalid_chart_series", "series explosion must be a non-negative number");
    if (item.smooth !== undefined && typeof item.smooth !== "boolean") throw new ArtifactToolError("invalid_chart_series", "series smooth must be a boolean");
    if (item.marker !== undefined && (!item.marker || typeof item.marker !== "object" || Array.isArray(item.marker) || (item.marker.symbol !== undefined && !["circle", "diamond", "dot", "none", "plus", "square", "star", "triangle", "x"].includes(item.marker.symbol)) || (item.marker.size !== undefined && (!Number.isFinite(item.marker.size) || item.marker.size < 0)))) {
      throw new ArtifactToolError("invalid_chart_series", "marker requires a supported symbol and a non-negative size");
    }
    if (item.points !== undefined && (!Array.isArray(item.points) || item.points.some((point) => !Number.isInteger(point?.idx) || point.idx < 0 || point.idx >= item.values.length))) {
      throw new ArtifactToolError("invalid_chart_point", "series points require valid zero-based data indexes");
    }
    if (item.trendlines !== undefined && (!Array.isArray(item.trendlines) || item.trendlines.some((trendline) => !trendline || typeof trendline !== "object" || Array.isArray(trendline) || (trendline.type !== undefined && !["linear", "exponential", "logarithmic", "polynomial", "power", "movingAverage"].includes(trendline.type))))) {
      throw new ArtifactToolError("invalid_chart_series", "trendlines must use a supported trendline type");
    }
    if (item.errorBars !== undefined && (!item.errorBars || typeof item.errorBars !== "object" || Array.isArray(item.errorBars) || (item.errorBars.type !== undefined && !["standardError", "percentage", "standardDeviation", "none"].includes(item.errorBars.type)) || (item.errorBars.value !== undefined && (!Number.isFinite(item.errorBars.value) || item.errorBars.value < 0)) || (item.errorBars.endStyle !== undefined && !["cap", "noCap"].includes(item.errorBars.endStyle)))) {
      throw new ArtifactToolError("invalid_chart_series", "errorBars must use supported type, value, and endStyle options");
    }
  }
  return series.map((item) => ({ ...structuredClone(item), name: item.name, labels: [...(item.labels ?? item.categories ?? categories)], values: [...item.values] }));
}

function mergeConfig(current, value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ArtifactToolError("invalid_chart_config", `${label} must be an object`);
  }
  return { ...(current ?? {}), ...structuredClone(value) };
}

function displayCell(value) {
  return value === null ? "" : String(value);
}

async function imageSourceBytes(src) {
  if (src.startsWith("data:")) {
    const comma = src.indexOf(",");
    if (comma < 0) throw new ArtifactToolError("invalid_image", "image data URI is malformed");
    const header = src.slice(0, comma);
    const body = src.slice(comma + 1);
    return header.endsWith(";base64") ? Buffer.from(body, "base64") : Buffer.from(decodeURIComponent(body));
  }
  return readFile(src);
}

async function imagePlacement(src, options = {}) {
  const { fit = "fill", crop, ...position } = options;
  if (!["fill", "contain", "cover"].includes(fit)) {
    throw new ArtifactToolError("unsupported_image_fit", `unsupported image fit mode: ${fit}`);
  }
  const cropEdges = await resolveImageCrop(src, crop);
  if (fit !== "contain") return position;
  const metadata = await sharp(await imageSourceBytes(src)).metadata();
  if (!metadata.width || !metadata.height) {
    throw new ArtifactToolError("invalid_image", "image dimensions could not be read for contain fitting");
  }
  const sourceWidth = metadata.width * (1 - cropEdges.left - cropEdges.right);
  const sourceHeight = metadata.height * (1 - cropEdges.top - cropEdges.bottom);
  const scale = Math.min(position.w / sourceWidth, position.h / sourceHeight);
  const w = sourceWidth * scale;
  const h = sourceHeight * scale;
  return { ...position, x: position.x + (position.w - w) / 2, y: position.y + (position.h - h) / 2, w, h };
}

function normalizeImageCrop(crop = {}) {
  const result = {};
  for (const edge of ["left", "top", "right", "bottom"]) {
    const value = crop?.[edge] ?? 0;
    if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 1) {
      result[edge] = value;
    } else if (typeof value === "string" && /^(?:\d+(?:\.\d+)?%|\d+(?:\.\d+)?px)$/.test(value.trim())) {
      result[edge] = value.trim();
    } else {
      throw new ArtifactToolError("invalid_image_crop", "image crop edges must be fractions, percentages, or pixel insets");
    }
  }
  for (const [first, second] of [["left", "right"], ["top", "bottom"]]) {
    if (typeof result[first] === "number" && typeof result[second] === "number" && result[first] + result[second] >= 1) {
      throw new ArtifactToolError("invalid_image_crop", "image crop must leave a non-empty source area");
    }
  }
  return result;
}

async function resolveImageCrop(src, crop = {}) {
  const input = normalizeImageCrop(crop);
  if (Object.values(input).every((value) => typeof value === "number")) return input;
  const metadata = await sharp(await imageSourceBytes(src)).metadata();
  if (!metadata.width || !metadata.height) throw new ArtifactToolError("invalid_image", "image dimensions could not be read for crop");
  const result = {};
  for (const edge of ["left", "top", "right", "bottom"]) {
    const value = input[edge];
    result[edge] = typeof value === "number" ? value : value.endsWith("%")
      ? Number.parseFloat(value) / 100
      : Number.parseFloat(value) / (edge === "left" || edge === "right" ? metadata.width : metadata.height);
    if (result[edge] < 0 || result[edge] >= 1) throw new ArtifactToolError("invalid_image_crop", "image crop edges must remove less than the full source dimension");
  }
  if (result.left + result.right >= 1 || result.top + result.bottom >= 1) {
    throw new ArtifactToolError("invalid_image_crop", "image crop must leave a non-empty source area");
  }
  return result;
}

function resolveImageBorderRadius(value, dimension) {
  if (typeof value === "number") return Math.min(value, dimension / 2);
  if (typeof value !== "string") return 0;
  const tokens = { "rounded-sm": 4, "rounded": 8, "rounded-md": 8, "rounded-lg": 12, "rounded-xl": 16, "rounded-2xl": 24, "rounded-3xl": 32, "rounded-full": dimension / 2 };
  return Math.min(tokens[value] ?? 0, dimension / 2);
}

async function exportedImageSource(src, options = {}) {
  const { fit = "fill", crop, ...position } = options;
  normalizeImageCrop(crop);
  if (!["fill", "contain", "cover"].includes(fit)) throw new ArtifactToolError("unsupported_image_fit", `unsupported image fit mode: ${fit}`);
  return { src, position };
}

async function renderedImageSource(src, options = {}) {
  const { fit = "fill", crop, ...position } = options;
  const edges = await resolveImageCrop(src, crop);
  const input = await imageSourceBytes(src);
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) throw new ArtifactToolError("invalid_image", "image dimensions could not be read");
  const left = Math.round(metadata.width * edges.left);
  const top = Math.round(metadata.height * edges.top);
  const width = Math.max(1, metadata.width - left - Math.round(metadata.width * edges.right));
  const height = Math.max(1, metadata.height - top - Math.round(metadata.height * edges.bottom));
  let pipeline = sharp(input).extract({ left, top, width, height });
  if (fit === "cover") pipeline = pipeline.resize(Math.max(1, Math.round(position.w)), Math.max(1, Math.round(position.h)), { fit: "cover" });
  const outputFormat = metadata.format === "jpeg" ? "jpeg" : metadata.format === "webp" ? "webp" : "png";
  const bytes = await pipeline.toFormat(outputFormat).toBuffer();
  return { src: `data:image/${outputFormat};base64,${bytes.toString("base64")}`, position };
}

async function pptxImageCrop(src, options = {}) {
  const crop = await resolveImageCrop(src, options.crop);
  const fit = options.fit ?? "fill";
  if (fit === "fill" || fit === "contain") return crop;
  const metadata = await sharp(await imageSourceBytes(src)).metadata();
  if (!metadata.width || !metadata.height || !options.w || !options.h) return crop;
  const sourceWidth = metadata.width * (1 - crop.left - crop.right);
  const sourceHeight = metadata.height * (1 - crop.top - crop.bottom);
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = options.w / options.h;
  if (sourceAspect > targetAspect) {
    const extra = (1 - targetAspect / sourceAspect) * (1 - crop.left - crop.right);
    crop.left += extra / 2;
    crop.right += extra / 2;
  } else if (sourceAspect < targetAspect) {
    const extra = (1 - sourceAspect / targetAspect) * (1 - crop.top - crop.bottom);
    crop.top += extra / 2;
    crop.bottom += extra / 2;
  }
  return crop;
}

function normalizeTextInput(value) {
  if (typeof value === "string") return { text: value };
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return { text: value.join("\n") };
  }
  if (value && typeof value === "object" && value.text !== undefined) {
    const normalized = normalizeTextInput(value.text);
    const style = value.style ?? value.textStyle;
    return { ...normalized, ...(style !== undefined ? { style } : {}) };
  }
  const paragraphs = Array.isArray(value) && value.every((item) =>
    typeof item === "number" || (item && typeof item === "object" && typeof item.run === "string"),
  ) ? [value] : Array.isArray(value) ? value :
    value && typeof value === "object" && Array.isArray(value.runs) ? [value] : null;
  if (paragraphs) {
    const runs = [];
    const lines = [];
    const metadata = [];
    for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
      const values = Array.isArray(paragraph) ? paragraph :
        paragraph && typeof paragraph === "object" && Array.isArray(paragraph.runs) ? paragraph.runs : null;
      if (!values) throw new ArtifactToolError("invalid_text", "structured text paragraphs require runs arrays");
      const paragraphMetadata = !Array.isArray(paragraph) ? Object.fromEntries(
        ["bulletCharacter", "marginLeft", "indent", "spaceBefore", "spaceAfter", "styleId", "paragraphStyle"]
          .filter((key) => paragraph[key] !== undefined).map((key) => [key, structuredClone(paragraph[key])]),
      ) : {};
      const paragraphRuns = values.map((run) => {
        if (typeof run === "string" || typeof run === "number") return { text: String(run), paragraphIndex };
        if (!run || typeof run !== "object" || typeof run.run !== "string") {
          throw new ArtifactToolError("invalid_text", "structured text runs require a string or { run } value");
        }
        const style = run.style ?? run.textStyle;
        if (style !== undefined && (!style || typeof style !== "object" || Array.isArray(style))) {
          throw new ArtifactToolError("invalid_text_style", "structured text run style must be an object");
        }
        if (run.link !== undefined && (!run.link || typeof run.link.uri !== "string")) {
          throw new ArtifactToolError("invalid_text_link", "structured text links require a uri");
        }
        return { text: run.run, paragraphIndex, ...(style ? { style: { ...style } } : {}), ...(run.link ? { link: { ...run.link } } : {}) };
      });
      lines.push(paragraphRuns.map((run) => run.text).join(""));
      if (runs.length > 0) runs.push({ text: "\n", paragraphIndex: paragraphIndex - 1 });
      runs.push(...paragraphRuns);
      metadata.push(paragraphMetadata);
    }
    return { text: lines.join("\n"), runs, paragraphs: metadata };
  }
  throw new ArtifactToolError("invalid_text", "text must be a string, string array, or text config");
}

function pptxTextStyleOptions(style = {}) {
  const options = { ...style };
  if (options.typeface !== undefined || options.fontFace !== undefined) {
    options.fontFace = options.typeface ?? options.fontFace;
    delete options.typeface;
  }
  if (options.leading !== undefined) {
    options.lineSpacingMultiple ??= options.leading;
    delete options.leading;
  }
  if (options.wrap === "square") options.wrap = true;
  else if (options.wrap === "none") options.wrap = false;
  if (typeof options.autoFit === "string") {
    const fitModes = { none: "none", shrinkText: "shrink", resizeShapeToFitText: "resize" };
    if (fitModes[options.autoFit] !== undefined) options.fit = fitModes[options.autoFit];
    delete options.autoFit;
  }
  if (options.insets !== undefined) {
    const toPoints = (value) => Number(value) * 0.75;
    if (Number.isFinite(options.insets)) options.margin = toPoints(options.insets);
    else if (options.insets && typeof options.insets === "object") {
      const { top = 0, right = 0, bottom = 0, left = 0 } = options.insets;
      options.margin = [top, right, bottom, left].map(toPoints);
    }
    delete options.insets;
  }
  if (typeof options.underline === "string") {
    options.underline = options.underline === "none" ? false : { style: options.underline };
  }
  return options;
}

function pptxRichText(runs = [], theme) {
  return runs.map((run) => {
    const style = run.style ?? {};
    const options = pptxTextStyleOptions(style);
    delete options.color;
    for (const key of ["bold", "italic", "breakLine", "charSpacing", "transparency"]) {
      if (style[key] !== undefined) options[key] = style[key];
    }
    if (style.fontSize !== undefined) {
      const size = typeof style.fontSize === "number" ? style.fontSize * 0.75 : String(style.fontSize);
      options.fontSize = typeof size === "string" && size.endsWith("px") ? Number.parseFloat(size) * 0.75 : size;
    }
    if (style.typeface !== undefined || style.fontFace !== undefined) options.fontFace = style.typeface ?? style.fontFace;
    if (style.color !== undefined) Object.assign(options, pptxTextColor(style.color, theme));
    if (run.link) {
      const internalSlide = run.link.isExternal === false && /^slide:(\d+)$/.exec(run.link.uri ?? "");
      if (internalSlide) options.hyperlink = { slide: Number(internalSlide[1]) };
      else if (run.link.isExternal !== false) options.hyperlink = { url: run.link.uri };
    }
    return { text: run.text, ...(Object.keys(options).length > 0 ? { options } : {}) };
  });
}

function pptxTextRuns(model, theme) {
  return pptxRichText(model.textRuns ?? [{ text: model.text ?? "" }], theme);
}

function textNeedsRichParagraphRuns(model) {
  return model.textRuns?.some((run) => run.style || run.link) ?? false;
}

function pptxParagraphOptions(model) {
  const paragraphs = model.textParagraphs;
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) return {};
  const bullets = paragraphs.map((item) => item.bulletCharacter).filter(Boolean);
  const spacesBefore = paragraphs.map((item) => item.spaceBefore).filter(Number.isFinite);
  const spacesAfter = paragraphs.map((item) => item.spaceAfter).filter(Number.isFinite);
  const options = {};
  if (bullets.length === paragraphs.length && bullets.every((value) => value === bullets[0])) {
    options.bullet = {
      characterCode: [...bullets[0]].map((character) => character.codePointAt(0).toString(16).toUpperCase()).join(""),
      ...(Number.isFinite(paragraphs[0].marginLeft) ? { indent: paragraphs[0].marginLeft * 0.75 } : {}),
    };
  }
  if (spacesBefore.length === paragraphs.length && spacesBefore.every((value) => value === spacesBefore[0])) options.paraSpaceBefore = spacesBefore[0] * 0.75;
  if (spacesAfter.length === paragraphs.length && spacesAfter.every((value) => value === spacesAfter[0])) options.paraSpaceAfter = spacesAfter[0] * 0.75;
  return options;
}

function pptxTextValue(model, theme) {
  return model.textParagraphs?.length && !textNeedsRichParagraphRuns(model)
    ? model.text
    : model.textRuns ? pptxTextRuns(model, theme) : model.text;
}

function setTextRangeStyle(model, start, end, patch) {
  const source = model.textRuns ?? [{ text: model.text ?? "" }];
  const next = [];
  let cursor = 0;
  for (const run of source) {
    const text = String(run.text ?? "");
    const runStart = cursor;
    const runEnd = cursor + text.length;
    cursor = runEnd;
    if (runEnd <= start || runStart >= end) {
      next.push(structuredClone(run));
      continue;
    }
    const from = Math.max(0, start - runStart);
    const to = Math.min(text.length, end - runStart);
    if (from > 0) next.push({ ...structuredClone(run), text: text.slice(0, from) });
    const styled = { ...structuredClone(run), text: text.slice(from, to), style: { ...(run.style ?? {}), ...patch } };
    if (patch.link === undefined && Object.hasOwn(patch, "link")) delete styled.link;
    else if (patch.link !== undefined) styled.link = structuredClone(patch.link);
    delete styled.style.link;
    if (Object.keys(styled.style).length === 0) delete styled.style;
    next.push(styled);
    if (to < text.length) next.push({ ...structuredClone(run), text: text.slice(to) });
  }
  model.textRuns = next;
}

function replaceTextRange(model, start, end, replacement) {
  const source = model.textRuns ?? [{ text: model.text ?? "" }];
  const before = [];
  const after = [];
  let cursor = 0;
  let inherited;
  for (const run of source) {
    const text = String(run.text ?? "");
    const runStart = cursor;
    const runEnd = cursor + text.length;
    cursor = runEnd;
    if (runStart < end && runEnd > start) inherited ??= structuredClone(run);
    if (runEnd <= start) before.push(structuredClone(run));
    else if (runStart >= end) after.push(structuredClone(run));
    else {
      if (runStart < start) before.push({ ...structuredClone(run), text: text.slice(0, start - runStart) });
      if (runEnd > end) after.unshift({ ...structuredClone(run), text: text.slice(end - runStart) });
    }
  }
  const inserted = { ...(inherited ?? {}), text: replacement };
  const next = [...before, ...(replacement ? [inserted] : []), ...after];
  model.textRuns = next;
  model.text = next.map((run) => run.text).join("");
}

function textOptions(options = {}) {
  const { role, textStyle = {}, ...rest } = options;
  const defaults = role === "title"
    ? { x: 72, y: 48, w: 1136, h: 80, fontSize: 56, bold: true }
    : { x: 72, y: 144, w: 1136, h: 64, fontSize: 24 };
  return pptxTextStyleOptions({ ...defaults, ...rest, ...textStyle });
}

function newPresentationId(prefix) {
  return `${prefix}/${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

class PresentationTheme {
  constructor(config = {}) {
    this.defaultFont = typeof config.defaultFont === "string" && config.defaultFont ? config.defaultFont : "Arial";
    this._colorScheme = config.colorScheme ? structuredClone(config.colorScheme) : { name: "Ruxex Default", themeColors: { ...defaultThemeColors } };
  }
  get colorScheme() { return structuredClone(this._colorScheme); }
  set colorScheme(value) {
    const required = Object.keys(defaultThemeColors);
    if (!value || typeof value.name !== "string" || !value.themeColors || typeof value.themeColors !== "object" || required.some((key) => value.themeColors[key] === undefined)) {
      throw new ArtifactToolError("invalid_theme", "colorScheme requires a name and a complete themeColors map");
    }
    this._colorScheme = structuredClone(value);
  }
  get hexColorMap() { return Object.fromEntries(Object.entries(this._colorScheme.themeColors).map(([name, value]) => [name, typeof value === "string" ? value : value?.color])); }
}

function renderedThemeColor(color, presentation) {
  const resolved = resolveColorSpec(color, presentation.theme);
  const match = /^#?([0-9a-f]{6})$/i.exec(resolved.color);
  if (match && resolved.opacity < 1) {
    const value = match[1];
    const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
    return `rgba(${channels.join(",")},${resolved.opacity})`;
  }
  return resolved.color;
}

function resolvePresentationColor(color, theme) {
  return resolveColorSpec(color, theme).color;
}

function resolveColorSpec(color, theme) {
  if (color === "transparent") return { color: "#000000", opacity: 0 };
  if (color && typeof color === "object" && !Array.isArray(color)) {
    const normalized = normalizeColorConfig(color);
    const themeKey = normalized.type === "theme" ? normalized.value : undefined;
    let value = themeKey ? (theme?.hexColorMap?.[themeKey] ?? defaultThemeColors[themeKey]) : `#${normalized.value.toUpperCase()}`;
    let opacity = 1;
    const transform = normalized.transform ?? {};
    if (transform.lighten !== undefined) {
      const amount = transform.lighten > 1 ? transform.lighten / 100 : transform.lighten;
      value = adjustPresentationLightness(value, amount);
    }
    if (transform.darken !== undefined) {
      const amount = transform.darken > 1 ? transform.darken / 100 : transform.darken;
      value = adjustPresentationLightness(value, -amount);
    }
    if (transform.opacity !== undefined) opacity = Math.min(1, Math.max(0, transform.opacity > 1 ? transform.opacity / 100 : transform.opacity));
    return { color: value, opacity };
  }
  if (typeof color !== "string") throw new ArtifactToolError("invalid_color", "presentation colors must be strings or rgb/theme color configs");
  const input = color.trim();
  const cssColor = parseCssColor(input);
  if (cssColor) return cssColor;
  const opacityMatch = /^(.*?)(?:\/(\d+(?:\.\d+)?)(%)?)$/.exec(input);
  const token = opacityMatch?.[1] ?? input;
  let modifierMatch = /^(.*?)([+-]\d+(?:\.\d+)?%?)$/.exec(token);
  if (modifierMatch && theme?.hexColorMap?.[modifierMatch[1]] === undefined &&
    presentationColorTokens[modifierMatch[1]] === undefined && !/^#?[0-9a-f]{6}$/i.test(modifierMatch[1])) modifierMatch = null;
  const base = modifierMatch?.[1] ?? token;
  const modifier = modifierMatch ? Number(modifierMatch[2].replace("%", "")) : 0;
  const lightnessDelta = Math.abs(modifier) <= 1 ? modifier : modifier / 100;
  const rawOpacity = opacityMatch ? Number(opacityMatch[2]) : 100;
  const opacity = opacityMatch ? Math.min(1, Math.max(0, rawOpacity / (opacityMatch[3] || rawOpacity > 1 ? 100 : 1))) : 1;
  const themed = theme?.hexColorMap?.[base];
  const resolved = typeof themed === "string" ? themed : presentationColorTokens[base] ?? base;
  return { color: modifierMatch ? adjustPresentationLightness(resolved, lightnessDelta) : resolved, opacity };
}

function parseCssColor(value) {
  const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(value);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3 || digits.length === 4) digits = [...digits].map((digit) => `${digit}${digit}`).join("");
    const opacity = digits.length === 8 ? Number.parseInt(digits.slice(6), 16) / 255 : 1;
    return { color: `#${digits.slice(0, 6).toUpperCase()}`, opacity };
  }
  const functionMatch = /^(rgba?)\((.*)\)$/i.exec(value);
  if (!functionMatch) return undefined;
  const body = functionMatch[2].trim();
  const slashParts = body.split("/");
  if (slashParts.length > 2) return undefined;
  const channelText = slashParts[0].trim();
  const channels = channelText.includes(",")
    ? channelText.split(",").map((part) => part.trim())
    : channelText.split(/\s+/).filter(Boolean);
  if (channels.length !== 3 && channels.length !== 4) return undefined;
  const alphaText = slashParts[1]?.trim() ?? (channels.length === 4 ? channels.pop() : undefined);
  const parsed = channels.map((channel) => {
    const percent = channel.endsWith("%");
    const number = Number.parseFloat(channel);
    if (!Number.isFinite(number)) return undefined;
    return Math.round(Math.max(0, Math.min(percent ? 100 : 255, number)) * (percent ? 2.55 : 1));
  });
  if (parsed.some((part) => part === undefined)) return undefined;
  const opacity = alphaText === undefined ? 1 : Math.max(0, Math.min(1, Number.parseFloat(alphaText) / (alphaText.endsWith("%") ? 100 : 1)));
  if (!Number.isFinite(opacity)) return undefined;
  return { color: `#${parsed.map((part) => part.toString(16).padStart(2, "0")).join("").toUpperCase()}`, opacity };
}

function adjustPresentationLightness(color, delta) {
  const match = /^#?([0-9a-f]{6})$/i.exec(color);
  if (!match || delta === 0) return color;
  const [r, g, b] = [0, 2, 4].map((offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const range = max - min;
  let hue = 0;
  let saturation = 0;
  if (range !== 0) {
    saturation = range / (1 - Math.abs(2 * lightness - 1));
    if (max === r) hue = ((g - b) / range) % 6;
    else if (max === g) hue = (b - r) / range + 2;
    else hue = (r - g) / range + 4;
    hue = ((hue * 60) % 360 + 360) % 360;
  }
  const nextLightness = Math.min(1, Math.max(0, lightness + delta));
  const chroma = (1 - Math.abs(2 * nextLightness - 1)) * saturation;
  const section = hue / 60;
  const secondary = chroma * (1 - Math.abs(section % 2 - 1));
  const [primeR, primeG, primeB] = section < 1 ? [chroma, secondary, 0]
    : section < 2 ? [secondary, chroma, 0]
      : section < 3 ? [0, chroma, secondary]
        : section < 4 ? [0, secondary, chroma]
          : section < 5 ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  const matchLightness = nextLightness - chroma / 2;
  return `#${[primeR, primeG, primeB].map((value) => Math.round((value + matchLightness) * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function registerElement(slide, element, prefix, id) {
  Object.defineProperty(element, "id", {
    value: id ?? newPresentationId(prefix),
    enumerable: false,
  });
  slide.objects.push(element);
  return element;
}

class LayoutPlaceholderCollection {
  constructor(layout) { this.layout = layout; }
  get items() { return this.layout._placeholders; }
  summary() {
    return this.items.map(({ type, index, geometry, position, text }) => ({
      type, index, geometry, position: { ...position }, hasText: Boolean(text),
    }));
  }
  add(config = {}) {
    const { type, index = 0, geometry = "textbox", position = {}, text = "", ...style } = config;
    if (typeof type !== "string" || type.trim() === "") throw new ArtifactToolError("invalid_placeholder", "layout placeholder requires a type");
    if (!Number.isInteger(index) || index < 0) throw new ArtifactToolError("invalid_placeholder", "layout placeholder index must be a non-negative integer");
    if (geometry !== "textbox" && !supportedShapes.has(geometry)) throw new ArtifactToolError("unsupported_shape", `unsupported placeholder geometry: ${geometry}`);
    if (geometry === "custom") style.customPaths = normalizeCustomPaths(style.customPaths);
    const placeholder = { type, index, geometry, position: mapPosition({ position }), text: String(text), style: structuredClone(style) };
    const previous = this.items.findIndex((item) => item.type === type && item.index === index);
    if (previous >= 0) this.items.splice(previous, 1, placeholder);
    else this.items.push(placeholder);
    return placeholder;
  }
}

class PresentationMasterHandle {
  constructor(presentation, model) {
    this.presentation = presentation;
    this.model = model;
    this.background = {};
    Object.defineProperty(this.background, "ref", {
      enumerable: true,
      get: () => model.background.ref,
      set: (value) => {
        if (typeof value !== "string" || !value.trim()) throw new ArtifactToolError("invalid_master_background", "master background ref must be a color or theme reference");
        model.background.ref = value;
      },
    });
  }
  get id() { return this.model.id; }
  get name() { return this.model.name; }
  get colorMap() { return structuredClone(this.model.colorMap); }
  setColorMap(config) {
    const keys = ["bg1", "tx1", "bg2", "tx2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];
    if (!config || typeof config !== "object" || Array.isArray(config) || Object.entries(config).some(([key, value]) => !keys.includes(key) || !keys.includes(value))) {
      throw new ArtifactToolError("invalid_master_color_map", "master color map must map supported theme color names to supported names");
    }
    this.model.colorMap = { ...this.model.colorMap, ...config };
    return this;
  }
}

class MasterCollection {
  constructor(presentation) { this.presentation = presentation; this._items = []; }
  add(name, options = {}) {
    if (typeof name !== "string" || !name.trim()) throw new ArtifactToolError("invalid_master", "master name must be a non-empty string");
    const existing = this._items.find((item) => item.id === options.id || item.name === name);
    if (existing) return new PresentationMasterHandle(this.presentation, existing);
    const model = {
      id: options.id ?? newPresentationId("ma"),
      name,
      colorMap: structuredClone(options.colorMap ?? {}),
      background: structuredClone(options.background ?? {}),
      objects: structuredClone(options.objects ?? []),
    };
    this._items.push(model);
    return new PresentationMasterHandle(this.presentation, model);
  }
  getById(id) {
    const model = this._items.find((item) => item.id === id);
    if (!model) throw new ArtifactToolError("invalid_master", `unknown presentation master: ${id}`);
    return new PresentationMasterHandle(this.presentation, model);
  }
  get items() { return this._items.map((item) => new PresentationMasterHandle(this.presentation, item)); }
}

class LayoutCollection {
  constructor(presentation) { this.presentation = presentation; this.items = []; }
  add(name, options = {}) {
    if (typeof name !== "string" || name.trim() === "") throw new ArtifactToolError("invalid_layout", "layout name must be a non-empty string");
    const existing = this.getItem(name, false);
    if (existing) {
      if (options.id) existing.id = options.id;
      if (options.parentMasterId) existing.parentMasterId = options.parentMasterId;
      return existing;
    }
    const layout = {
      id: options.id ?? newPresentationId("ly"),
      name,
      _placeholders: [],
      _masterObjects: structuredClone(options.masterObjects ?? []),
      _objects: structuredClone(options.layoutObjects ?? []),
      parentMasterId: options.parentMasterId,
    };
    layout.setParentLayoutId = (id) => {
      if (typeof id !== "string" || !this.presentation.masters._items.some((master) => master.id === id)) throw new ArtifactToolError("invalid_master", `unknown parent master: ${id}`);
      layout.parentMasterId = id;
      return layout;
    };
    layout.placeholders = new LayoutPlaceholderCollection(layout);
    layout.export = (exportOptions = {}) => renderLayoutPreview(this.presentation, layout, exportOptions);
    this.items.push(layout);
    for (const placeholder of options.placeholders ?? []) layout.placeholders.add(placeholder);
    return layout;
  }
  getItem(nameOrId, throwIfMissing = true) {
    const layout = this.items.find((item) => item.name === nameOrId || item.id === nameOrId);
    if (!layout && throwIfMissing) throw new ArtifactToolError("invalid_layout", `unknown presentation layout: ${nameOrId}`);
    return layout;
  }
  getById(id) { return this.getItem(id, false) ?? this.presentation.masters.getById(id); }
  getAll() { return [...this.items]; }
}

async function renderLayoutPreview(presentation, layout, options = {}) {
  const preview = Presentation.create({
    slideSize: { ...presentation.slideSize },
    theme: { defaultFont: presentation.theme.defaultFont, colorScheme: presentation.theme.colorScheme },
  });
  const previewLayout = preview.layouts.add(layout.name, { id: layout.id });
  for (const item of layout.placeholders.items) previewLayout.placeholders.add(structuredClone(item));
  previewLayout._masterObjects = structuredClone(layout._masterObjects);
  previewLayout._objects = structuredClone(layout._objects);
  const slide = preview.slides.add({ layout: layout.name });
  const placeholderObjects = slide.objects;
  slide.objects = [];
  for (const object of [...layout._masterObjects, ...layout._objects]) {
    if (object.kind === "text") slide.addText(object.textRuns?.length ? object.textRuns : object.text, object.options ?? {});
    else if (object.kind === "shape" && supportedShapes.has(object.shape)) {
      slide.shapes.add({ geometry: object.shape, ...(object.options ?? {}), ...(object.text ? { text: object.textRuns?.length ? object.textRuns : object.text } : {}) });
    }
  }
  slide.objects.push(...placeholderObjects);
  return preview.render({ slide: 0, format: options.format ?? "png", scale: options.scale ?? 1 });
}

class SlidePlaceholderCollection {
  constructor(slide) { this.slide = slide; }
  get items() { return this.slide.objects.filter((object) => object.options?.placeholderType).map((object) => new ShapeHandle(this.slide, object)); }
  get editable() { return this.items; }
  get unfilled() { return this.items.filter((item) => !item.text.toString()); }
  get availableFromLayout() {
    const layout = this.slide.presentation.layouts.getItem(this.slide.layout, false);
    return (layout?.placeholders.items ?? []).filter((definition) => !this.slide.objects.some((object) => object.options?.placeholderType === definition.type && object.options?.placeholderIndex === definition.index));
  }
  getItem(typeOrName) {
    const object = this.slide.objects.find((item) => item.options?.placeholderType === typeOrName || item.options?.name === typeOrName);
    if (!object) throw new ArtifactToolError("invalid_placeholder", `slide placeholder not found: ${typeOrName}`);
    return new ShapeHandle(this.slide, object);
  }
  addFromLayout() {
    const layout = this.slide.presentation.layouts.getItem(this.slide.layout, false);
    for (const item of this.availableFromLayout) {
      const options = {
        ...item.style,
        position: item.position,
        name: item.name ?? item.type,
        placeholderType: item.type,
        placeholderIndex: item.index,
      };
      this.slide.shapes.add({ geometry: item.geometry, text: item.text, ...options });
    }
    return this.items;
  }
}

class Slide {
  constructor(presentation, options = {}) {
    this.presentation = presentation;
    this.id = newPresentationId("sl");
    this.notesId = newPresentationId("nt");
    this.layout = options.layout ?? "wide";
    this.layoutId = options.layoutId ?? newPresentationId("ly");
    this.size = {
      width: options.width ?? presentation.slideSize.width,
      height: options.height ?? presentation.slideSize.height,
    };
    if (!Number.isFinite(this.size.width) || this.size.width <= 0 ||
      !Number.isFinite(this.size.height) || this.size.height <= 0) {
      throw new ArtifactToolError("invalid_slide_size", "slide width and height must be positive pixel dimensions");
    }
    this.objects = [];
    this.background = new SlideBackground();
    this.notes = "";
    this.shapes = new ShapeCollection(this);
    this.tables = new TableCollection(this);
    this.images = new ImageCollection(this);
    this.charts = new ChartCollection(this);
    this.placeholders = new SlidePlaceholderCollection(this);
    const layout = presentation.layouts.getItem(this.layout, false);
    if (layout) this.layoutId = layout.id;
  }

  setLayout(layout) {
    const name = typeof layout === "string" ? layout : layout?.name;
    if (typeof name !== "string" || name.trim() === "") throw new ArtifactToolError("invalid_layout", "slide layout must be a name or layout object");
    const definition = this.presentation.layouts.getItem(name, false);
    this.objects = this.objects.filter((object) => !object.options?.placeholderType);
    this.layout = name;
    if (definition) this.layoutId = definition.id;
    this.placeholders.addFromLayout();
    return this;
  }

  compose(tree, options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) throw new ArtifactToolError("invalid_compose_options", "compose options must be an object");
    const frame = options.frame ?? { left: 0, top: 0, width: this.size.width, height: this.size.height };
    if (![frame.left, frame.top, frame.width, frame.height].every(Number.isFinite) || frame.width < 0 || frame.height < 0) {
      throw new ArtifactToolError("invalid_compose_frame", "compose frame must have finite non-negative bounds");
    }
    return materializeComposeNode(this, tree, frame, options);
  }

  autoLayout(shapes, options = {}) {
    if (!Array.isArray(shapes) || shapes.length === 0) {
      throw new ArtifactToolError("invalid_auto_layout", "autoLayout requires a non-empty array of shapes");
    }
    const models = shapes.map((shape) => {
      const model = typeof shape === "string" ? this.objects.find((item) => item.id === shape) : shape?.model;
      if (!model || !this.objects.includes(model) || !["shape", "text"].includes(model.kind)) {
        throw new ArtifactToolError("invalid_auto_layout_shape", "autoLayout shapes must belong to this slide");
      }
      return model;
    });
    const direction = options.direction ?? "horizontal";
    if (!["horizontal", "vertical"].includes(direction)) {
      throw new ArtifactToolError("invalid_auto_layout", "autoLayout direction must be horizontal or vertical");
    }
    const frameOption = options.frame ?? "slide";
    let frame;
    if (frameOption === "slide") {
      frame = { left: 0, top: 0, width: this.size.width, height: this.size.height };
    } else if (frameOption && typeof frameOption === "object" && !Array.isArray(frameOption)) {
      const frameModel = frameOption.model;
      frame = frameModel
        ? { left: frameModel.options.x, top: frameModel.options.y, width: frameModel.options.w, height: frameModel.options.h }
        : { left: frameOption.left, top: frameOption.top, width: frameOption.width, height: frameOption.height };
    }
    if (!frame || ![frame.left, frame.top, frame.width, frame.height].every(Number.isFinite) || frame.width < 0 || frame.height < 0) {
      throw new ArtifactToolError("invalid_auto_layout_frame", "autoLayout frame must have finite bounds");
    }
    const horizontalPadding = options.horizontalPadding ?? 0;
    const verticalPadding = options.verticalPadding ?? 0;
    if (![horizontalPadding, verticalPadding].every((value) => Number.isFinite(value) && value >= 0)) {
      throw new ArtifactToolError("invalid_auto_layout_padding", "autoLayout padding must be finite non-negative pixels");
    }
    const horizontal = direction === "horizontal";
    const mainStart = horizontal ? frame.left + horizontalPadding : frame.top + verticalPadding;
    const mainSize = (horizontal ? frame.width - 2 * horizontalPadding : frame.height - 2 * verticalPadding);
    const crossStart = horizontal ? frame.top + verticalPadding : frame.left + horizontalPadding;
    const crossSize = horizontal ? frame.height - 2 * verticalPadding : frame.width - 2 * horizontalPadding;
    if (mainSize < 0 || crossSize < 0) throw new ArtifactToolError("invalid_auto_layout_padding", "autoLayout padding exceeds the frame");
    const sizes = models.map((model) => ({ width: Number(model.options.w ?? 0), height: Number(model.options.h ?? 0) }));
    const mainValues = sizes.map((size) => horizontal ? size.width : size.height);
    const gapOption = options[horizontal ? "horizontalGap" : "verticalGap"] ?? 0;
    const gap = gapOption === "auto"
      ? (models.length > 1 ? Math.max(0, (mainSize - mainValues.reduce((sum, value) => sum + value, 0)) / (models.length - 1)) : 0)
      : gapOption;
    if (!Number.isFinite(gap) || gap < 0) throw new ArtifactToolError("invalid_auto_layout_gap", "autoLayout gap must be non-negative pixels or auto");
    const align = options.align ?? "center";
    const alignment = {
      topLeft: ["start", "start"], topCenter: ["center", "start"], topRight: ["end", "start"],
      left: ["start", "center"], center: ["center", "center"], right: ["end", "center"],
      bottomLeft: ["start", "end"], bottomCenter: ["center", "end"], bottomRight: ["end", "end"],
    }[align];
    if (!alignment) throw new ArtifactToolError("invalid_auto_layout_alignment", `unsupported autoLayout alignment: ${align}`);
    const [mainAlign, crossAlign] = alignment;
    const groupSize = mainValues.reduce((sum, value) => sum + value, 0) + gap * (models.length - 1);
    let cursor = mainStart + (mainAlign === "center" ? (mainSize - groupSize) / 2 : mainAlign === "end" ? mainSize - groupSize : 0);
    const result = models.map((model, index) => {
      const size = sizes[index];
      const crossItemSize = horizontal ? size.height : size.width;
      const crossPosition = crossStart + (crossAlign === "center" ? (crossSize - crossItemSize) / 2 : crossAlign === "end" ? crossSize - crossItemSize : 0);
      const position = horizontal
        ? { left: cursor, top: crossPosition, width: size.width, height: size.height }
        : { left: crossPosition, top: cursor, width: size.width, height: size.height };
      Object.assign(model.options, mapPosition({ position }));
      cursor += mainValues[index] + gap;
      return position;
    });
    return result;
  }

  addText(text, options = {}) {
    const normalized = normalizeTextInput(text);
    const merged = { ...options };
    if (normalized.style) {
      merged.textStyle = typeof normalized.style === "string"
        ? { ...(merged.textStyle ?? {}), styleName: normalized.style }
        : { ...(merged.textStyle ?? {}), ...normalized.style };
    }
    registerElement(this, {
      kind: "text",
      text: normalized.text,
      ...(normalized.runs ? { textRuns: normalized.runs } : {}),
      ...(normalized.paragraphs ? { textParagraphs: normalized.paragraphs } : {}),
      options: merged,
    }, "sh");
    return this;
  }

  addTable(rows, options = {}) {
    validateRows(rows);
    registerElement(
      this,
      {
        kind: "table",
        rows: rows.map((row) => row.map(displayCell)),
        cellOptions: rows.map((row) => row.map(() => ({}))),
        options: { ...options },
      },
      "tb",
    );
    return this;
  }

  addShape(shape, options = {}) {
    if (!supportedShapes.has(shape)) {
      throw new ArtifactToolError("unsupported_shape", `unsupported presentation shape: ${shape}`);
    }
    options = {
      ...options,
      ...(options.fill !== undefined ? { fill: normalizeShapeFill(options.fill) } : {}),
      ...(options.line?.fill !== undefined ? { line: { ...options.line, fill: normalizeShapeFill(options.line.fill) } } : {}),
    };
    if (shape === "custom") options = { ...options, customPaths: normalizeCustomPaths(options.customPaths) };
    registerElement(this, { kind: "shape", shape, options: { ...options } }, "sh");
    return this;
  }

  addNotes(notes) {
    if (typeof notes !== "string") {
      throw new ArtifactToolError("invalid_notes", "slide notes must be a string");
    }
    this.notes = notes;
    return this;
  }

  async export(options = {}) {
    if (options.format !== "layout") {
      throw new ArtifactToolError("unsupported_export_format", "slide export currently supports only layout JSON");
    }
    const layout = slideLayoutRecord(this.presentation, this, options.detail);
    return new Blob([JSON.stringify(layout, null, 2)], { type: "application/json" });
  }
}

class SlideBackground {
  constructor(fill = "none") { this.fill = fill; }
  get fill() { return this._fill; }
  set fill(value) { this._fill = normalizeShapeFill(value) ?? "none"; }
}

function mapPosition(options = {}) {
  const { position, ...rest } = options;
  if (!position) return { ...rest };
  return {
    ...rest,
    ...(position.left !== undefined ? { x: position.left } : {}),
    ...(position.top !== undefined ? { y: position.top } : {}),
    ...(position.width !== undefined ? { w: position.width } : {}),
    ...(position.height !== undefined ? { h: position.height } : {}),
  };
}

function normalizeCustomPaths(value) {
  if (!Array.isArray(value) || value.length === 0) throw new ArtifactToolError("invalid_custom_path", "custom geometry requires one or more customPaths");
  return value.map((path) => {
    if (!path || typeof path !== "object" || !Number.isFinite(path.width) || path.width <= 0 || !Number.isFinite(path.height) || path.height <= 0 || !Array.isArray(path.commands) || path.commands.length === 0) {
      throw new ArtifactToolError("invalid_custom_path", "each custom path requires positive width and height and at least one command");
    }
    const commands = path.commands.map((command) => {
      if (command?.close && Object.keys(command).length === 1) return { close: {} };
      for (const [key, required] of [["moveTo", ["x", "y"]], ["lineTo", ["x", "y"]], ["quadBezTo", ["x1", "y1", "x", "y"]], ["cubicBezTo", ["x1", "y1", "x2", "y2", "x", "y"]]]) {
        if (!command?.[key]) continue;
        if (required.some((field) => !Number.isFinite(command[key][field]))) throw new ArtifactToolError("invalid_custom_path", `${key} coordinates must be finite numbers`);
        return { [key]: { ...command[key] } };
      }
      throw new ArtifactToolError("invalid_custom_path", "custom path commands must be moveTo, lineTo, quadBezTo, cubicBezTo, or close");
    });
    if (!commands.some((command) => command.moveTo)) throw new ArtifactToolError("invalid_custom_path", "each custom path must begin with moveTo");
    return { ...(typeof path.id === "string" ? { id: path.id } : {}), width: path.width, height: path.height, commands };
  });
}

function normalizeShapeFill(value) {
  if (typeof value === "string") return parseGradientFillString(value) ?? value;
  if (value === undefined) return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ArtifactToolError("invalid_fill", "shape fill must be a color, a supported fill object, or none");
  }
  if (value.type === "none") return "none";
  if (value.type === "solid") {
    const color = normalizeColorConfig(value.color);
    let pattern;
    if (value.pattern !== undefined) {
      const patternType = typeof value.pattern === "string" ? value.pattern : value.pattern?.type;
      if (typeof patternType !== "string" || !patternType.trim()) throw new ArtifactToolError("invalid_fill", "pattern fill requires a pattern type");
      pattern = { type: patternType, ...(value.pattern.color !== undefined ? { color: normalizeColorConfig(value.pattern.color) } : {}) };
    }
    return { type: "solid", color, ...(pattern ? { pattern } : {}) };
  }
  if (value.type === "image") {
    if (typeof value.imageReference?.id !== "string" || !value.imageReference.id) throw new ArtifactToolError("invalid_fill", "image fill requires imageReference.id");
    for (const rectName of ["srcRect", "fillRect", "stretchFillRect"]) {
      if (value[rectName] !== undefined && (!value[rectName] || typeof value[rectName] !== "object" || Array.isArray(value[rectName]) || Object.values(value[rectName]).some((entry) => !Number.isFinite(entry)))) {
        throw new ArtifactToolError("invalid_fill", `${rectName} must contain finite numeric edge offsets`);
      }
    }
    if (value.alphaModFix !== undefined && (!Number.isFinite(value.alphaModFix) || value.alphaModFix < 0 || value.alphaModFix > 100000)) throw new ArtifactToolError("invalid_fill", "image fill alphaModFix must be from 0 to 100000");
    return structuredClone(value);
  }
  if (value.type !== "gradient" || !Array.isArray(value.stops) || value.stops.length < 2) {
    throw new ArtifactToolError("invalid_fill", "gradient fill requires at least two stops");
  }
  const gradientKind = value.gradientKind ?? "linear";
  if (gradientKind !== "linear" && gradientKind !== "path") throw new ArtifactToolError("invalid_fill", "gradientKind must be linear or path");
  if (value.angleDeg !== undefined && !Number.isFinite(value.angleDeg)) throw new ArtifactToolError("invalid_fill", "gradient angleDeg must be finite");
  if (value.pathType !== undefined && !["circle", "rect", "shape"].includes(value.pathType)) throw new ArtifactToolError("invalid_fill", "pathType must be circle, rect, or shape");
  if (value.fillRect !== undefined && (!value.fillRect || typeof value.fillRect !== "object" || Array.isArray(value.fillRect) || Object.values(value.fillRect).some((entry) => !Number.isFinite(entry)))) throw new ArtifactToolError("invalid_fill", "gradient fillRect must contain finite edge offsets");
  const stops = value.stops.map((stop) => {
    if (!Number.isFinite(stop?.offset) || stop.offset < 0 || stop.offset > (value.offsetScale === 1 ? 1 : 100000)) throw new ArtifactToolError("invalid_fill", "gradient stops require an offset and color");
    return { offset: value.offsetScale === 1 ? stop.offset * 100000 : stop.offset, color: normalizeColorConfig(stop.color) };
  });
  return { type: "gradient", gradientKind, ...(value.angleDeg !== undefined ? { angleDeg: value.angleDeg } : {}), ...(value.pathType ? { pathType: value.pathType } : {}), ...(value.fillRect ? { fillRect: structuredClone(value.fillRect) } : {}), stops };
}

function parseGradientFillString(value) {
  const match = /^(linear|radial)\((.*)\)$/i.exec(value.trim());
  if (!match) return undefined;
  const parts = splitTopLevelCommaList(match[2]);
  let angleDeg;
  if (match[1].toLowerCase() === "linear" && /^-?\d+(?:\.\d+)?deg$/i.test(parts[0] ?? "")) angleDeg = Number.parseFloat(parts.shift());
  const stops = parts.map((part) => {
    const stop = /^(.*)\s+([+-]?\d+(?:\.\d+)?)%$/.exec(part);
    const color = (stop ? stop[1] : part).trim();
    const offset = stop ? Number(stop[2]) * 1000 : undefined;
    if (!color || (offset !== undefined && (offset < 0 || offset > 100000))) throw new ArtifactToolError("invalid_fill", `invalid gradient stop: ${part}`);
    return { color, offset };
  });
  if (stops.length < 2) throw new ArtifactToolError("invalid_fill", "gradient strings require at least two color stops");
  if (stops[0].offset === undefined) stops[0].offset = 0;
  if (stops.at(-1).offset === undefined) stops.at(-1).offset = 100000;
  for (let index = 0; index < stops.length;) {
    if (stops[index].offset !== undefined) { index += 1; continue; }
    const first = index - 1;
    let last = index;
    while (last < stops.length && stops[last].offset === undefined) last += 1;
    const from = stops[first].offset;
    const to = stops[last].offset;
    const steps = last - first;
    for (let offsetIndex = index; offsetIndex < last; offsetIndex += 1) {
      stops[offsetIndex].offset = from + (to - from) * (offsetIndex - first) / steps;
    }
    index = last + 1;
  }
  return normalizeShapeFill({ type: "gradient", gradientKind: match[1].toLowerCase() === "radial" ? "path" : "linear", ...(angleDeg !== undefined ? { angleDeg } : {}), stops });
}

function splitTopLevelCommaList(value) {
  const items = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "(") depth += 1;
    else if (character === ")") depth -= 1;
    else if (character === "," && depth === 0) {
      const item = value.slice(start, index).trim();
      if (!item) throw new ArtifactToolError("invalid_fill", "gradient strings cannot contain an empty stop");
      items.push(item);
      start = index + 1;
    }
    if (depth < 0) throw new ArtifactToolError("invalid_fill", "gradient string contains an unmatched parenthesis");
  }
  if (depth !== 0) throw new ArtifactToolError("invalid_fill", "gradient string contains an unmatched parenthesis");
  const tail = value.slice(start).trim();
  if (!tail) throw new ArtifactToolError("invalid_fill", "gradient strings cannot contain an empty stop");
  items.push(tail);
  return items;
}

function normalizeColorConfig(color) {
  if (typeof color === "string") return color;
  if (!color || typeof color !== "object" || Array.isArray(color) || !["rgb", "theme"].includes(color.type) || typeof color.value !== "string") {
    throw new ArtifactToolError("invalid_color", "ColorConfig requires a string or rgb/theme color object");
  }
  const value = color.value.replace(/^#/, "");
  if (color.type === "rgb" && !/^[\da-f]{6}$/i.test(value)) throw new ArtifactToolError("invalid_color", "rgb ColorConfig value must contain six hexadecimal digits");
  if (color.type === "theme" && ![...Object.keys(defaultThemeColors), "hlink", "folHlink"].includes(value)) throw new ArtifactToolError("invalid_color", `unsupported theme color: ${value}`);
  const transform = color.transform;
  if (transform !== undefined && (!transform || typeof transform !== "object" || Array.isArray(transform) || Object.entries(transform).some(([key, amount]) => !["opacity", "lighten", "darken"].includes(key) || !Number.isFinite(amount) || amount < 0 || amount > 100))) {
    throw new ArtifactToolError("invalid_color", "color transforms must be opacity, lighten, or darken values from 0 to 100");
  }
  return { type: color.type, value, ...(transform ? { transform: { ...transform } } : {}) };
}

function connectorPosition(slide, model) {
  const connector = model.options.connector;
  if (!connector) return {};
  const from = slide.objects.find((item) => item.id === connector.fromId);
  const to = slide.objects.find((item) => item.id === connector.toId);
  const position = { x: model.options.x ?? 0, y: model.options.y ?? 0, w: model.options.w ?? 0, h: model.options.h ?? 0 };
  if (!from && !to) return position;
  const anchor = (shape, side, index) => {
    const { x = 0, y = 0, w = 0, h = 0 } = shape.options;
    side ??= ["top", "right", "bottom", "left"][index];
    if (side === "top") return { x: x + w / 2, y };
    if (side === "bottom") return { x: x + w / 2, y: y + h };
    if (side === "left") return { x, y: y + h / 2 };
    return { x: x + w, y: y + h / 2 };
  };
  const start = from ? anchor(from, connector.fromIdx === undefined ? connector.fromSide ?? "right" : undefined, connector.fromIdx)
    : { x: position.x, y: position.y };
  const end = to ? anchor(to, connector.toIdx === undefined ? connector.toSide ?? "left" : undefined, connector.toIdx)
    : { x: position.x + position.w, y: position.y + position.h };
  return { x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y };
}

function normalizeConnectorOptions(options = {}, defaultKind = "straight") {
  const supportedKinds = new Set(["straight", "elbow", "elbow2", "elbow3", "elbow4", "elbow5", "curved"]);
  const kind = options.kind ?? defaultKind;
  if (!supportedKinds.has(kind)) throw new ArtifactToolError("invalid_connector", `unsupported connector kind: ${kind}`);
  for (const key of ["fromIdx", "toIdx"]) {
    if (options[key] !== undefined && (!Number.isInteger(options[key]) || options[key] < 0)) throw new ArtifactToolError("invalid_connector", `${key} must be a non-negative connection-site index`);
  }
  if (options.cap !== undefined && !["flat", "round", "square"].includes(options.cap)) throw new ArtifactToolError("invalid_connector", "connector cap must be flat, round, or square");
  if (options.join !== undefined && !["round", "bevel", "miter"].includes(options.join)) throw new ArtifactToolError("invalid_connector", "connector join must be round, bevel, or miter");
  return {
    kind,
    ...(options.fromIdx !== undefined ? { fromIdx: options.fromIdx } : {}),
    ...(options.toIdx !== undefined ? { toIdx: options.toIdx } : {}),
    ...(options.head ? { head: structuredClone(options.head) } : {}),
    ...(options.tail ? { tail: structuredClone(options.tail) } : {}),
    ...(options.cap ? { cap: options.cap } : {}),
    ...(options.join ? { join: options.join } : {}),
  };
}

function connectorRoute(slide, model) {
  const options = model.options.connector;
  const bounds = connectorPosition(slide, model);
  if (bounds.x === undefined) return [];
  const start = { x: bounds.x, y: bounds.y };
  const end = { x: bounds.x + bounds.w, y: bounds.y + bounds.h };
  const kind = options.kind ?? "straight";
  if (kind === "straight") return [start, end];
  if (kind === "curved") {
    const curve = Math.max(36, Math.abs(end.x - start.x) / 3, Math.abs(end.y - start.y) / 3);
    const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
    return [start, {
      x: start.x + (horizontal ? Math.sign(end.x - start.x) * curve : 0),
      y: start.y + (horizontal ? 0 : Math.sign(end.y - start.y) * curve),
    }, {
      x: end.x - (horizontal ? Math.sign(end.x - start.x) * curve : 0),
      y: end.y - (horizontal ? 0 : Math.sign(end.y - start.y) * curve),
    }, end];
  }
  const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
  return horizontal
    ? [start, { x: (start.x + end.x) / 2, y: start.y }, { x: (start.x + end.x) / 2, y: end.y }, end]
    : [start, { x: start.x, y: (start.y + end.y) / 2 }, { x: end.x, y: (start.y + end.y) / 2 }, end];
}

function restoreLayoutPlaceholder(collection, placeholder) {
  const { style = {}, ...definition } = placeholder;
  return collection.add({ ...definition, ...style });
}

function resolveConnectorTarget(slide, target) {
  const model = typeof target === "string" ? slide.objects.find((item) => item.id === target) : target?.model;
  if (!model || !slide.objects.includes(model) || !["shape", "text"].includes(model.kind)) {
    throw new ArtifactToolError("invalid_connector_endpoint", "connector endpoint must be a shape on the same slide");
  }
  return model;
}

class ShapeCollection {
  constructor(slide) {
    this.slide = slide;
  }

  getConnectionSiteIndex(shape, side) {
    const model = typeof shape === "string" ? this.slide.objects.find((item) => item.id === shape) : shape?.model;
    if (!model || !this.slide.objects.includes(model) || !["shape", "text"].includes(model.kind)) {
      throw new ArtifactToolError("invalid_connector_endpoint", "connection site lookup requires a shape on the same slide");
    }
    const index = { top: 0, right: 1, bottom: 2, left: 3 }[side];
    if (index === undefined) throw new ArtifactToolError("invalid_connector", "connection side must be top, right, bottom, or left");
    return index;
  }

  add(config = {}) {
    const { geometry, text, ...options } = config;
    if (geometry === "connector") {
      const { from, to, ...connectorOptions } = options;
      if (from !== undefined || to !== undefined) return this.connect(from, to, { ...connectorOptions, kind: connectorOptions.kind ?? "straight" });
      this.slide.addShape("line", { ...mapPosition(connectorOptions), line: connectorOptions.line ?? { fill: "#64748B", width: 2 }, connector: normalizeConnectorOptions(connectorOptions, "straight") });
      const model = this.slide.objects.pop();
      this.slide.objects.unshift(model);
      return new ShapeHandle(this.slide, model);
    }
    const mappedOptions = mapPosition(options);
    if (geometry === "textbox") {
      this.slide.addText(text ?? "", mappedOptions);
      return new ShapeHandle(this.slide, this.slide.objects.at(-1));
    }
    if (supportedShapes.has(geometry)) {
      this.slide.addShape(geometry, mappedOptions);
      const model = this.slide.objects.at(-1);
      if (text !== undefined) {
        const normalized = normalizeTextInput(text);
        model.text = normalized.text;
        if (normalized.runs) model.textRuns = normalized.runs;
        else delete model.textRuns;
        if (normalized.paragraphs) model.textParagraphs = normalized.paragraphs;
        else delete model.textParagraphs;
        if (normalized.style) model.options.textStyle = typeof normalized.style === "string"
          ? { styleName: normalized.style }
          : { ...normalized.style };
      }
      return new ShapeHandle(this.slide, model);
    }
    throw new ArtifactToolError(
      "unsupported_shape",
      `unsupported presentation shape: ${geometry}`,
    );
  }

  connect(from, to, options = {}) {
    const resolve = (target) => {
      const model = typeof target === "string"
        ? this.slide.objects.find((item) => item.id === target)
        : target?.model;
      if (!model || !this.slide.objects.includes(model) || model.kind !== "shape" && model.kind !== "text") {
        throw new ArtifactToolError("invalid_connector_endpoint", "connector endpoints must be shapes on the same slide");
      }
      return model;
    };
    const fromModel = from === undefined || from === null ? undefined : resolve(from);
    const toModel = to === undefined || to === null ? undefined : resolve(to);
    if (!fromModel && !toModel) throw new ArtifactToolError("invalid_connector_endpoint", "connect requires at least one attached shape");
    if (fromModel && toModel && fromModel === toModel) throw new ArtifactToolError("invalid_connector_endpoint", "a connector must connect two different shapes");
    const supportedKinds = new Set(["straight", "elbow", "elbow2", "elbow3", "elbow4", "elbow5", "curved"]);
    const kind = options.kind ?? "elbow";
    if (!supportedKinds.has(kind)) throw new ArtifactToolError("invalid_connector", `unsupported connector kind: ${kind}`);
    for (const [key, value] of [["fromIdx", options.fromIdx], ["toIdx", options.toIdx]]) {
      if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 3)) {
        throw new ArtifactToolError("invalid_connector", `${key} must be a non-negative connection-site index`);
      }
    }
    const center = (shape) => shape ? ({
      x: (shape.options.x ?? 0) + (shape.options.w ?? 0) / 2,
      y: (shape.options.y ?? 0) + (shape.options.h ?? 0) / 2,
    }) : undefined;
    const a = center(fromModel);
    const b = center(toModel);
    const fallback = { x: options.position?.left ?? 0, y: options.position?.top ?? 0, w: options.position?.width ?? 0, h: options.position?.height ?? 0 };
    const other = fromModel ? { x: fallback.x + fallback.w, y: fallback.y + fallback.h } : { x: fallback.x, y: fallback.y };
    const startCenter = a ?? other;
    const endCenter = b ?? other;
    const horizontal = Math.abs(endCenter.x - startCenter.x) >= Math.abs(endCenter.y - startCenter.y);
    const fromSide = options.fromSide ?? (fromModel && options.fromIdx === undefined ? (horizontal ? (endCenter.x >= startCenter.x ? "right" : "left") : (endCenter.y >= startCenter.y ? "bottom" : "top")) : undefined);
    const toSide = options.toSide ?? (toModel && options.toIdx === undefined ? (horizontal ? (endCenter.x >= startCenter.x ? "left" : "right") : (endCenter.y >= startCenter.y ? "top" : "bottom")) : undefined);
    if ((fromSide !== undefined && !["top", "right", "bottom", "left"].includes(fromSide)) ||
      (toSide !== undefined && !["top", "right", "bottom", "left"].includes(toSide))) {
      throw new ArtifactToolError("invalid_connector", "connector sides must be top, right, bottom, or left");
    }
    const connector = normalizeConnectorOptions(options, kind);
    if (fromModel) connector.fromId = fromModel.id;
    if (toModel) connector.toId = toModel.id;
    if (fromSide) connector.fromSide = fromSide;
    if (toSide) connector.toSide = toSide;
    const { line = { fill: "#64748B", width: 2 }, ...otherOptions } = options;
    this.slide.addShape("line", { ...mapPosition(otherOptions), line: structuredClone(line), connector });
    const model = this.slide.objects.pop();
    this.slide.objects.unshift(model);
    return new ShapeHandle(this.slide, model);
  }
}

function composeNodeRecord(input) {
  if (input === null || input === undefined || typeof input === "boolean") return [];
  if (Array.isArray(input)) return input.flatMap(composeNodeRecord);
  if (typeof input === "string" || typeof input === "number") return [{ type: "paragraph", props: {}, children: String(input) }];
  const isReactElement = typeof input === "object" && typeof input.$$typeof === "symbol";
  if (!input || typeof input !== "object" || (!isReactElement && typeof input.type !== "string")) {
    throw new ArtifactToolError("invalid_compose_node", "compose nodes must be JSX elements or nodes with a string type");
  }
  if (isReactElement && typeof input.type === "function") {
    try {
      return composeNodeRecord(input.type(input.props ?? {}));
    } catch (error) {
      throw new ArtifactToolError("invalid_compose_component", `JSX function component failed: ${error.message}`);
    }
  }
  if (input.type === Symbol.for("react.fragment")) return composeNodeRecord(input.props?.children);
  const props = input.props ?? {};
  return [{ type: input.type, props, children: props.children ?? input.children }];
}

function composePadding(value = 0) {
  if (Number.isFinite(value)) return { left: value, right: value, top: value, bottom: value };
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const x = value.x ?? value.horizontal ?? 0;
    const y = value.y ?? value.vertical ?? 0;
    const padding = { left: value.left ?? x, right: value.right ?? x, top: value.top ?? y, bottom: value.bottom ?? y };
    if (Object.values(padding).every((side) => Number.isFinite(side) && side >= 0)) return padding;
  }
  throw new ArtifactToolError("invalid_compose_padding", "compose padding must be non-negative pixels");
}

function composeTextStyle(props, inherited = {}) {
  const style = {
    ...inherited,
    ...normalizeComposeTextStyle(props.textStyle),
    ...normalizeComposeTextStyle(props.style),
  };
  for (const key of [
    "fontSize", "fontFace", "typeface", "bold", "italic", "color", "fill", "outline",
    "align", "alignment", "valign", "verticalAlignment", "breakLine", "lineSpacing", "lineSpacingMultiple", "leading",
    "wrap", "autoFit", "insets", "underline", "charSpacing",
  ]) {
    if (props[key] !== undefined) style[key] = props[key];
  }
  if (style.typeface !== undefined) {
    style.fontFace ??= style.typeface;
    delete style.typeface;
  }
  if (style.alignment !== undefined) {
    style.align ??= style.alignment;
    delete style.alignment;
  }
  if (style.verticalAlignment !== undefined) {
    style.valign ??= style.verticalAlignment;
    delete style.verticalAlignment;
  }
  if (style.leading !== undefined) {
    style.lineSpacingMultiple ??= style.leading;
    delete style.leading;
  }
  const classes = String(props.className ?? "").split(/\s+/).filter(Boolean);
  const sizes = { "text-xs": 12, "text-sm": 14, "text-base": 16, "text-lg": 18, "text-xl": 20, "text-2xl": 24, "text-3xl": 30, "text-4xl": 36, "text-5xl": 48, "text-6xl": 60 };
  const weights = { "font-normal": false, "font-medium": false, "font-semibold": true, "font-bold": true, "font-extrabold": true };
  for (const token of classes) {
    if (token.startsWith("text-") && !style.color) {
      const colorToken = token.slice(5);
      if (sizes[token] !== undefined) style.fontSize ??= sizes[token];
      else if (presentationColorTokens[colorToken] || ["white", "black"].includes(colorToken)) style.color = colorToken;
    }
    if (weights[token] !== undefined) style.bold ??= weights[token];
    if (token === "italic") style.italic ??= true;
    if (token === "not-italic") style.italic ??= false;
    if (token.startsWith("leading-")) {
      const leading = { "leading-none": 1, "leading-tight": 1.25, "leading-snug": 1.375, "leading-normal": 1.5, "leading-relaxed": 1.625, "leading-loose": 2 }[token];
      if (leading !== undefined) style.lineSpacingMultiple ??= leading;
    }
    if (token.startsWith("font-") && !weights[token]) style.fontFace ??= token.slice(5);
    if (token.startsWith("bg-")) style.fill ??= token.slice(3);
    if (token.startsWith("rounded-")) style.borderRadius ??= token;
    if (token.startsWith("shadow")) style.shadow ??= token;
  }
  if (props.fill !== undefined) style.fill = props.fill;
  if (props.line !== undefined) style.line = props.line;
  if (props.borderRadius !== undefined) style.borderRadius = props.borderRadius;
  if (props.shadow !== undefined) style.shadow = props.shadow;
  return style;
}

function parseComposeTextStyle(value) {
  if (typeof value !== "string") return {};
  const result = {};
  if (!value.includes(":") && !value.includes(";")) return value.trim() ? { styleName: value.trim() } : result;
  for (const declaration of value.split(";")) {
    const separator = declaration.indexOf(":");
    if (separator < 0) continue;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const content = declaration.slice(separator + 1).trim();
    if (!content) continue;
    if (property === "font") {
      const font = /^(?:(italic|oblique)\s+)?(?:(\d{3,}|normal|bold)\s+)?(?:(italic|oblique)\s+)?(\d+(?:\.\d+)?)px(?:\s*\/\s*(\d+(?:\.\d+)?))?\s+(.+)$/i.exec(content);
      if (font) {
        const weight = font[2];
        if (weight) result.bold = weight.toLowerCase() === "bold" || (weight !== "normal" && Number(weight) >= 600);
        if (font[1] || font[3]) result.italic = true;
        result.fontSize = Number(font[4]);
        if (font[5]) result.breakLine = Number(font[5]);
        result.fontFace = font[6].split(",")[0].trim().replace(/^['"]|['"]$/g, "");
      }
    } else if (["font-size", "size"].includes(property) && /^\d+(?:\.\d+)?px$/i.test(content)) result.fontSize = Number.parseFloat(content);
    else if (["font-family", "family", "typeface"].includes(property)) result.fontFace = content.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
    else if (["font-weight", "weight"].includes(property)) result.bold = content.toLowerCase() === "bold" || (content.toLowerCase() !== "normal" && Number(content) >= 600);
    else if (["font-style", "italic"].includes(property)) result.italic = !["normal", "false", "0"].includes(content.toLowerCase());
    else if (["color", "fill"].includes(property)) result.color = content;
    else if (["line-height", "leading"].includes(property) && Number.isFinite(Number(content))) result.lineSpacingMultiple = Number(content);
    else if (["text-align", "align", "alignment"].includes(property) && ["left", "center", "right", "justify"].includes(content)) result.align = content;
    else if (["vertical-align", "valign"].includes(property) && ["top", "middle", "bottom"].includes(content)) result.valign = content;
    else if (property === "wrap" && ["square", "none"].includes(content)) result.wrap = content;
    else if (["auto-fit", "autofit"].includes(property)) {
      const aliases = { shrink: "shrinkText", resize: "resizeShapeToFitText", "resize-shape": "resizeShapeToFitText" };
      result.autoFit = aliases[content] ?? content;
    } else if (property === "underline") result.underline = ["none", "false", "0"].includes(content.toLowerCase()) ? false : content;
    else if (["inset", "insets", "padding"].includes(property)) result.insets = parseComposeInsets(content);
  }
  return result;
}

function normalizeComposeTextStyle(value) {
  if (typeof value === "string") return parseComposeTextStyle(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...value };
}

function parseComposeInsets(value) {
  const tokens = value.trim().split(/\s+/).map((token) => {
    const match = /^(-?\d+(?:\.\d+)?)(?:px)?$/i.exec(token);
    return match ? Number(match[1]) : Number.NaN;
  });
  if (tokens.length < 1 || tokens.length > 4 || tokens.some((item) => !Number.isFinite(item) || item < 0)) return undefined;
  if (tokens.length === 1) return tokens[0];
  const [top, right = top, bottom = top, left = right] = tokens;
  return { top, right, bottom, left };
}

function composeTextContent(input, inheritedStyle = {}) {
  const runs = [];
  const rawText = (value) => {
    if (value === null || value === undefined || typeof value === "boolean") return "";
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map(rawText).join("");
    if (typeof value === "object") return rawText(value.props?.children ?? value.children);
    return "";
  };
  const visit = (value, style) => {
    const records = composeNodeRecord(value);
    for (const record of records) {
      if (record.type === "run") {
        const nextStyle = composeTextStyle(record.props, style);
        const text = rawText(record.children);
        runs.push({ run: text, style: nextStyle, ...(record.props.link ? { link: record.props.link } : {}) });
      } else if (record.type === "paragraph") {
        visit(record.children, composeTextStyle(record.props, style));
      } else if (record.children !== undefined) visit(record.children, style);
    }
  };
  const hasRun = (value) => {
    if (Array.isArray(value)) return value.some(hasRun);
    if (!value || typeof value !== "object") return false;
    const type = value.type;
    return type === "run" || hasRun(value.props?.children ?? value.children);
  };
  if (!hasRun(input)) return rawText(input);
  visit(input, inheritedStyle);
  return runs;
}

function composeMeasure(node, axis, crossSize) {
  const props = node.props ?? {};
  const explicit = props[axis === "x" ? "width" : "height"];
  if (Number.isFinite(explicit)) return explicit;
  if (explicit === "hug") {
    const text = typeof node.children === "string" ? node.children : "";
    const style = composeTextStyle(props);
    return axis === "x" ? Math.min(crossSize, Math.max(24, text.length * Number(style.fontSize ?? 16) * 0.58)) : Math.max(24, Number(style.fontSize ?? 16) * 1.4);
  }
  if (explicit === "fill") return undefined;
  return axis === "x" ? crossSize : Math.max(36, Number(composeTextStyle(props).fontSize ?? 16) * 1.5);
}

function composeChildren(slide, childInput, frame, flow, inheritedStyle, options) {
  const children = composeNodeRecord(childInput);
  if (children.length === 0) return [];
  const horizontal = flow === "row";
  const padding = composePadding(frame.padding ?? 0);
  const gap = Number(frame.gap ?? 0);
  const mainAvailable = horizontal ? frame.width - padding.left - padding.right : frame.height - padding.top - padding.bottom;
  const crossAvailable = horizontal ? frame.height - padding.top - padding.bottom : frame.width - padding.left - padding.right;
  const mainAxisName = horizontal ? "x" : "y";
  const fixedSizes = children.map((child) => composeMeasure(child, mainAxisName, crossAvailable));
  const fillCount = fixedSizes.filter((size) => size === undefined).length;
  const remainder = Math.max(0, mainAvailable - gap * (children.length - 1) - fixedSizes.filter(Number.isFinite).reduce((sum, size) => sum + size, 0));
  const sizes = fixedSizes.map((size) => size ?? (fillCount ? remainder / fillCount : 0));
  const align = frame.align ?? "start";
  const justify = frame.justify ?? "start";
  const used = sizes.reduce((sum, size) => sum + size, 0) + gap * (children.length - 1);
  const extraGap = justify === "between" && children.length > 1 ? Math.max(0, (mainAvailable - used) / (children.length - 1)) : 0;
  let cursor = (horizontal ? frame.left + padding.left : frame.top + padding.top) + (justify === "center" ? (mainAvailable - used) / 2 : justify === "end" ? mainAvailable - used : 0);
  const result = [];
  children.forEach((child, index) => {
    const childMain = sizes[index];
    const childCrossProp = child.props?.[horizontal ? "height" : "width"];
    let childCross = Number.isFinite(childCrossProp) ? childCrossProp : (childCrossProp === "hug" ? composeMeasure(child, horizontal ? "y" : "x", crossAvailable) : crossAvailable);
    if (childCrossProp === "hug") childCross = composeMeasure(child, horizontal ? "y" : "x", crossAvailable);
    const crossOffset = align === "center" ? (crossAvailable - childCross) / 2 : align === "end" ? crossAvailable - childCross : 0;
    const childFrame = horizontal
      ? { left: cursor, top: frame.top + padding.top + crossOffset, width: childMain, height: childCross }
      : { left: frame.left + padding.left + crossOffset, top: cursor, width: childCross, height: childMain };
    result.push(...materializeComposeNode(slide, child, childFrame, options, inheritedStyle));
    cursor += childMain + gap + extraGap;
  });
  return result;
}

function composeGridTrackSizes(trackInput, count, available, gap) {
  const tracks = Array.isArray(trackInput) && trackInput.length > 0
    ? trackInput
    : Array.from({ length: count }, () => ({ mode: "fr", value: 1 }));
  if (tracks.length !== count) throw new ArtifactToolError("invalid_compose_grid", "grid track count must match its column or row count");
  const normalized = tracks.map((track) => {
    if (Number.isFinite(track)) return { mode: "fixed", value: track };
    if (!track || typeof track !== "object" || !["fr", "fixed"].includes(track.mode)
      || !Number.isFinite(track.value) || track.value <= 0) {
      throw new ArtifactToolError("invalid_compose_grid", "grid tracks must be positive fixed or fr track records");
    }
    return track;
  });
  const fixedTotal = normalized.filter((track) => track.mode === "fixed").reduce((sum, track) => sum + track.value, 0);
  const frTotal = normalized.filter((track) => track.mode === "fr").reduce((sum, track) => sum + track.value, 0);
  const remaining = Math.max(0, available - gap * Math.max(0, count - 1) - fixedTotal);
  return normalized.map((track) => track.mode === "fixed" ? track.value : (frTotal ? remaining * track.value / frTotal : 0));
}

function composeChartConfig(props, children) {
  const config = { ...props };
  delete config.chartType;
  delete config.type;
  const rawNodes = composeNodeRecord(children);
  const nodes = rawNodes.flatMap((node) => supportedChartTypes.has(node.type)
    ? [{ ...node, isChartFamily: true }, ...composeNodeRecord(node.children)]
    : [node]);
  const series = [];
  for (const node of nodes) {
    if (node.isChartFamily) {
      config.chartType ??= node.type;
      Object.assign(config, node.props);
    } else if (node.type === "series") {
      const item = { ...node.props };
      const children = composeNodeRecord(node.children);
      const points = children.filter((child) => child.type === "point").map((point) => {
        const value = { ...point.props };
        for (const child of composeNodeRecord(point.children)) {
          if (child.type === "data-label" || child.type === "data-labels") {
            value.dataLabels = { ...(value.dataLabels ?? {}), ...child.props };
          } else if (child.type === "marker") {
            value.marker = { ...(value.marker ?? {}), ...child.props };
          }
        }
        return value;
      });
      if (points.length) item.points = points;
      for (const child of children) {
        if (child.type === "marker") item.marker = { ...(item.marker ?? {}), ...child.props };
        else if (child.type === "data-label" || child.type === "data-labels") item.dataLabels = { ...(item.dataLabels ?? {}), ...child.props };
        else if (child.type === "error-bars") item.errorBars = { ...(item.errorBars ?? {}), ...child.props };
        else if (child.type === "trendline") {
          const trendline = { ...child.props };
          const label = composeNodeRecord(child.children).find((entry) => entry.type === "trendline-label");
          if (label) trendline.label = { ...(trendline.label ?? {}), ...label.props };
          item.trendlines = [...(item.trendlines ?? []), trendline];
        }
      }
      series.push(item);
    } else if (node.type === "legend") config.legend = { ...(config.legend ?? {}), ...node.props };
    else if (node.type === "data-labels" || node.type === "data-label") config.dataLabels = { ...(config.dataLabels ?? {}), ...node.props };
    else if (node.type === "x-axis") config.xAxis = { ...(config.xAxis ?? {}), ...node.props };
    else if (node.type === "y-axis") config.yAxis = { ...(config.yAxis ?? {}), ...node.props };
    else if (node.type === "axis") {
      const key = node.props.axis === "y" || node.props.id === "y" ? "yAxis" : "xAxis";
      config[key] = { ...(config[key] ?? {}), ...node.props };
    } else if (node.type === "major-gridlines" || node.type === "minor-gridlines") {
      const key = node.props.axis === "x" ? "xAxis" : "yAxis";
      const gridlineKey = node.type === "major-gridlines" ? "majorGridlines" : "minorGridlines";
      config[key] = { ...(config[key] ?? {}), [gridlineKey]: { ...(config[key]?.[gridlineKey] ?? {}), ...node.props } };
    } else if (node.type === "view-3d") config.view3D = { ...(config.view3D ?? {}), ...node.props };
    else if (node.type === "data-table") config.dataTable = { ...(config.dataTable ?? {}), ...node.props };
  }
  if (series.length) config.series = series;
  return { type: config.chartType ?? "bar", config };
}

function composeAlignedItemFrame(child, frame, alignItems = "stretch", justifyItems = "stretch") {
  if (!["start", "center", "end", "stretch"].includes(alignItems)
    || !["start", "center", "end", "stretch"].includes(justifyItems)) {
    throw new ArtifactToolError("invalid_compose_alignment", "grid and layers alignment must be start, center, end, or stretch");
  }
  const props = child.props ?? {};
  const width = Number.isFinite(props.width) ? props.width
    : props.width === "hug" ? composeMeasure(child, "x", frame.height)
      : justifyItems === "stretch" || props.width === "fill" ? frame.width
        : Math.min(frame.width, composeMeasure(child, "x", frame.height) ?? frame.width);
  const height = Number.isFinite(props.height) ? props.height
    : props.height === "hug" ? composeMeasure(child, "y", frame.width)
      : alignItems === "stretch" || props.height === "fill" ? frame.height
        : Math.min(frame.height, composeMeasure(child, "y", frame.width) ?? frame.height);
  const left = justifyItems === "center" ? frame.left + (frame.width - width) / 2
    : justifyItems === "end" ? frame.left + frame.width - width : frame.left;
  const top = alignItems === "center" ? frame.top + (frame.height - height) / 2
    : alignItems === "end" ? frame.top + frame.height - height : frame.top;
  return { left, top, width, height };
}

function materializeComposeNode(slide, input, frame, options, inheritedStyle = {}) {
  const nodes = composeNodeRecord(input);
  const handles = [];
  for (const node of nodes) {
    const { type, props } = node;
    const style = composeTextStyle(props, inheritedStyle);
    const nodeFrame = {
      left: frame.left,
      top: frame.top,
      width: Number.isFinite(props.width) ? props.width : frame.width,
      height: Number.isFinite(props.height) ? props.height : frame.height,
    };
    if (type === "slide") {
      if (props.background !== undefined) slide.background.fill = props.background;
      handles.push(...materializeComposeNode(slide, node.children, nodeFrame, options, style));
    } else if (type === "background") {
      slide.background.fill = props.fill ?? props.ref ?? "none";
    } else if (type === "row" || type === "column") {
      handles.push(...composeChildren(slide, node.children, { ...nodeFrame, gap: props.gap ?? 0, align: props.align ?? "start", justify: props.justify ?? "start", padding: props.padding ?? 0 }, type, style, options));
    } else if (type === "grid") {
      const children = composeNodeRecord(node.children);
      const columnTracks = Array.isArray(props.columns) ? props.columns : undefined;
      const columns = columnTracks?.length ?? (Number.isInteger(props.columns) && props.columns > 0 ? props.columns : Math.max(1, Math.ceil(Math.sqrt(children.length))));
      const horizontalPadding = composePadding(props.padding ?? 0);
      const gapX = Number(props.columnGap ?? props.gap ?? 0);
      const gapY = Number(props.rowGap ?? props.gap ?? 0);
      const baseRows = Array.isArray(props.rows) ? props.rows : undefined;
      const estimatedRows = baseRows?.length ?? Math.max(1, Math.ceil(children.length / columns));
      const rowTracks = baseRows ?? (props.autoRows ? Array.from({ length: estimatedRows }, () => props.autoRows) : undefined);
      const widths = composeGridTrackSizes(columnTracks, columns, nodeFrame.width - horizontalPadding.left - horizontalPadding.right, gapX);
      const heights = composeGridTrackSizes(rowTracks, estimatedRows, nodeFrame.height - horizontalPadding.top - horizontalPadding.bottom, gapY);
      const placements = [];
      const occupied = [];
      const canPlace = (row, column, rowSpan, columnSpan) => {
        if (column + columnSpan > columns) return false;
        for (let y = row; y < row + rowSpan; y += 1) {
          for (let x = column; x < column + columnSpan; x += 1) if (occupied.some((cell) => cell.row === y && cell.column === x)) return false;
        }
        return true;
      };
      let cursor = 0;
      for (const child of children) {
        const rowSpan = child.props?.rowSpan ?? 1;
        const columnSpan = child.props?.columnSpan ?? 1;
        if (!Number.isInteger(rowSpan) || rowSpan < 1 || !Number.isInteger(columnSpan) || columnSpan < 1 || columnSpan > columns) {
          throw new ArtifactToolError("invalid_compose_grid", "grid rowSpan and columnSpan must be positive integers within the grid width");
        }
        let placement;
        while (!placement) {
          const row = Math.floor(cursor / columns);
          const column = cursor % columns;
          if (canPlace(row, column, rowSpan, columnSpan)) {
            placement = { row, column, rowSpan, columnSpan };
            for (let y = row; y < row + rowSpan; y += 1) for (let x = column; x < column + columnSpan; x += 1) occupied.push({ row: y, column: x });
          }
          cursor += 1;
          if (cursor > (children.length + rowSpan + columnSpan) * columns * 4) throw new ArtifactToolError("invalid_compose_grid", "grid items could not be placed in the requested tracks");
        }
        placements.push(placement);
      }
      const rowCount = Math.max(heights.length, ...placements.map((placement) => placement.row + placement.rowSpan));
      while (heights.length < rowCount) heights.push(heights.at(-1) ?? 0);
      for (const placement of placements) {
        const { row, column, rowSpan, columnSpan } = placement;
        const left = nodeFrame.left + horizontalPadding.left + widths.slice(0, column).reduce((sum, value) => sum + value + gapX, 0);
        const top = nodeFrame.top + horizontalPadding.top + heights.slice(0, row).reduce((sum, value) => sum + value + gapY, 0);
        const width = widths.slice(column, column + columnSpan).reduce((sum, value) => sum + value, 0) + gapX * (columnSpan - 1);
        const height = heights.slice(row, row + rowSpan).reduce((sum, value) => sum + value, 0) + gapY * (rowSpan - 1);
        const child = children[placements.indexOf(placement)];
        const cell = { left, top, width, height };
        const childFrame = composeAlignedItemFrame(child, cell, props.alignItems ?? "stretch", props.justifyItems ?? "stretch");
        handles.push(...materializeComposeNode(slide, child, childFrame, options, style));
      }
    } else if (type === "layers") {
      const children = composeNodeRecord(node.children);
      for (const child of children) {
        const childFrame = composeAlignedItemFrame(child, nodeFrame, props.alignItems ?? "stretch", props.justifyItems ?? "stretch");
        handles.push(...materializeComposeNode(slide, child, childFrame, options, style));
      }
    } else if (type === "box") {
      const box = slide.shapes.add({ geometry: "rect", name: props.name, position: nodeFrame, fill: style.fill ?? "none", line: style.line ?? { fill: "none", width: 0 }, borderRadius: style.borderRadius, shadow: style.shadow });
      handles.push(box);
      const padding = composePadding(props.padding ?? 0);
      const contentFrame = { left: nodeFrame.left + padding.left, top: nodeFrame.top + padding.top, width: nodeFrame.width - padding.left - padding.right, height: nodeFrame.height - padding.top - padding.bottom };
      handles.push(...materializeComposeNode(slide, node.children, contentFrame, options, style));
    } else if (type === "paragraph") {
      const text = composeTextContent(node.children, style);
      const shape = slide.shapes.add({ geometry: "textbox", name: props.name, position: nodeFrame, text, fill: style.fill ?? "none", line: style.line ?? { fill: "none", width: 0 }, textStyle: style });
      if (props.bulletCharacter !== undefined) shape.text.style = { ...shape.text.style, bulletCharacter: props.bulletCharacter, marginLeft: props.marginLeft, indent: props.indent, spaceBefore: props.spaceBefore, spaceAfter: props.spaceAfter };
      handles.push(shape);
    } else if (type === "shape" || type === "rule") {
      const geometry = type === "rule" ? "line" : props.geometry ?? "rect";
      const shape = slide.shapes.add({ geometry, name: props.name, position: nodeFrame, fill: type === "rule" ? "none" : style.fill ?? "none", line: props.line ?? (type === "rule" ? { fill: props.stroke ?? "#64748B", width: props.weight ?? 1 } : style.line ?? { fill: "none", width: 0 }), borderRadius: style.borderRadius, shadow: style.shadow });
      handles.push(shape);
    } else if (type === "image") {
      handles.push(slide.images.add({ ...props, src: props.src ?? props.path, position: nodeFrame }));
    } else if (type === "table") {
      handles.push(slide.tables.add({ ...props, position: nodeFrame }));
    } else if (type === "chart") {
      const chart = composeChartConfig(props, node.children);
      handles.push(slide.charts.add(chart.type, { ...chart.config, position: nodeFrame }));
    } else if (type === "fragment") {
      handles.push(...materializeComposeNode(slide, node.children, nodeFrame, options, style));
    } else {
      throw new ArtifactToolError("unsupported_compose_node", `unsupported presentation JSX node: ${String(type)}`);
    }
  }
  return handles;
}

class ShapeText {
  constructor(model) {
    this.model = model;
  }

  get style() {
    return { ...(this.model.options.textStyle ?? Object.fromEntries(
      ["fontSize", "fontFace", "bold", "italic", "color", "align", "valign"]
        .filter((key) => this.model.options[key] !== undefined)
        .map((key) => [key, this.model.options[key]]),
    )) };
  }

  set style(style) {
    if (!style || typeof style !== "object" || Array.isArray(style)) {
      throw new ArtifactToolError("invalid_text_style", "text style must be an object");
    }
    this.model.options.textStyle = { ...style };
  }

  get fontSize() { return this.style.fontSize; }
  set fontSize(value) { this.style = { ...this.style, fontSize: value }; }
  get color() { return this.style.color; }
  set color(value) { this.style = { ...this.style, color: value }; }
  get alignment() { return this.style.align; }
  set alignment(value) { this.style = { ...this.style, align: value }; }
  get verticalAlignment() { return this.style.valign; }
  set verticalAlignment(value) { this.style = { ...this.style, valign: value }; }
  get wrap() { return this.style.wrap; }
  set wrap(value) { this.style = { ...this.style, wrap: value }; }
  get autoFit() { return this.style.autoFit; }
  set autoFit(value) { this.style = { ...this.style, autoFit: value }; }
  get insets() { return this.style.insets; }
  set insets(value) { this.style = { ...this.style, insets: value }; }

  set(value) {
    const normalized = normalizeTextInput(value);
    this.model.text = normalized.text;
    if (normalized.runs) this.model.textRuns = normalized.runs;
    else delete this.model.textRuns;
    if (normalized.paragraphs) this.model.textParagraphs = normalized.paragraphs;
    else delete this.model.textParagraphs;
    if (normalized.style) this.model.options.textStyle = typeof normalized.style === "string"
      ? { ...(this.model.options.textStyle ?? {}), styleName: normalized.style }
      : { ...(this.model.options.textStyle ?? {}), ...normalized.style };
    return this;
  }

  get(search) {
    if (typeof search !== "string" || search.length === 0) {
      throw new ArtifactToolError("invalid_text_range", "text range search requires a non-empty string");
    }
    const start = this.toString().indexOf(search);
    return start < 0 ? undefined : new TextRange(this.model, start, start + search.length);
  }

  getRange(start, length) {
    if (!Number.isInteger(start) || !Number.isInteger(length) || start < 0 || length < 0 || start + length > this.toString().length) {
      throw new ArtifactToolError("invalid_text_range", "text range start and length are outside the text");
    }
    return new TextRange(this.model, start, start + length);
  }

  replace(search, replacement) {
    if (typeof search !== "string" || typeof replacement !== "string" || search.length === 0) {
      throw new ArtifactToolError("invalid_text_range", "text replace requires non-empty search and string replacement");
    }
    const index = this.toString().indexOf(search);
    if (index >= 0) {
      replaceTextRange(this.model, index, index + search.length, replacement);
    }
    return this;
  }

  toString() {
    return this.model.text ?? "";
  }

  valueOf() {
    return this.toString();
  }
}

class TextRange {
  constructor(model, start, end) {
    this.model = model;
    this.start = start;
    this.end = end;
  }

  get text() { return this.model.text.slice(this.start, this.end); }
  set text(value) {
    if (typeof value !== "string") throw new ArtifactToolError("invalid_text", "text range value must be a string");
    replaceTextRange(this.model, this.start, this.end, value);
    this.end = this.start + value.length;
  }
  replace(search, replacement) {
    if (typeof search !== "string" || typeof replacement !== "string" || search.length === 0) {
      throw new ArtifactToolError("invalid_text_range", "text replace requires non-empty search and string replacement");
    }
    const index = this.text.indexOf(search);
    if (index >= 0) {
      const from = this.start + index;
      replaceTextRange(this.model, from, from + search.length, replacement);
      this.end += replacement.length - search.length;
    }
    return this;
  }
  get style() {
    const run = this.model.textRuns?.find((_run, index) => {
      const before = this.model.textRuns.slice(0, index).reduce((sum, item) => sum + item.text.length, 0);
      return before < this.end && before + _run.text.length > this.start;
    });
    return { ...(run?.style ?? {}) };
  }
  set style(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new ArtifactToolError("invalid_text_style", "text range style must be an object");
    setTextRangeStyle(this.model, this.start, this.end, value);
  }
  get bold() { return this.style.bold; }
  set bold(value) { this.style = { bold: Boolean(value) }; }
  get italic() { return this.style.italic; }
  set italic(value) { this.style = { italic: Boolean(value) }; }
  get color() { return this.style.color; }
  set color(value) { this.style = { color: value }; }
  get fill() { return this.style.fill; }
  set fill(value) { this.style = { fill: value }; }
  get link() { return this.model.textRuns?.find((run) => run.link)?.link; }
  set link(value) {
    if (value !== undefined && (!value || typeof value.uri !== "string")) throw new ArtifactToolError("invalid_text_link", "text range link requires a uri");
    setTextRangeStyle(this.model, this.start, this.end, { link: value });
  }
  toString() { return this.text; }
}

class ElementHandle {
  constructor(slide, model) {
    this.slide = slide;
    this.model = model;
  }

  get id() {
    return this.model.id;
  }

  get name() {
    return this.model.options.name;
  }

  set name(value) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new ArtifactToolError("invalid_element_name", "element name must be a non-empty string");
    }
    this.model.options.name = value;
  }

  get kind() {
    return this.model.kind === "text" ? "textbox" : this.model.kind;
  }

  get position() {
    const { x, y, w, h } = this.model.options;
    return {
      ...(x !== undefined ? { left: x } : {}),
      ...(y !== undefined ? { top: y } : {}),
      ...(w !== undefined ? { width: w } : {}),
      ...(h !== undefined ? { height: h } : {}),
    };
  }

  set position(position) {
    if (!position || typeof position !== "object" || Array.isArray(position)) {
      throw new ArtifactToolError("invalid_position", "element position must be an object");
    }
    Object.assign(this.model.options, mapPosition({ position }));
  }

  bringToFront() {
    const index = this.slide.objects.indexOf(this.model);
    if (index >= 0 && index !== this.slide.objects.length - 1) {
      this.slide.objects.splice(index, 1);
      this.slide.objects.push(this.model);
    }
    return this;
  }

  get rows() {
    return this.model.rows;
  }

  set rows(rows) {
    validateRows(rows);
    const previousOptions = this.model.cellOptions ?? [];
    this.model.rows = rows.map((row) => row.map(displayCell));
    this.model.cellOptions = rows.map((row, rowIndex) => row.map((_, columnIndex) =>
      previousOptions[rowIndex]?.[columnIndex] ?? {},
    ));
  }

  get series() {
    if (!this.model.series) return undefined;
    const values = this.model.series;
    if (!Object.hasOwn(values, "getItemAt")) {
      Object.defineProperty(values, "getItemAt", {
        enumerable: false,
        value: (index) => {
          if (!Number.isInteger(index) || index < 0 || index >= values.length) {
            throw new ArtifactToolError("invalid_chart_series", `chart series index is out of range: ${index}`);
          }
          const chart = this.model;
          const item = values[index];
          const seriesHandle = {
            get name() { return item.name; },
            set name(value) { item.name = String(value); },
            get labels() { return item.labels; },
            set labels(value) {
              if (!Array.isArray(value) || value.some((label) => typeof label !== "string")) throw new ArtifactToolError("invalid_chart_series", "chart series labels must be strings");
              item.labels = [...value];
            },
            get values() { return item.values; },
            set values(next) {
              if (!Array.isArray(next) || next.some((value) => value !== null && !Number.isFinite(value)) || next.length !== item.labels.length) throw new ArtifactToolError("invalid_chart_series", "chart series values must be finite or null and match the labels");
              item.values = [...next];
            },
            get categories() { return item.labels; },
            set categories(value) { seriesHandle.labels = value; },
            get xValues() { return item.xValues ? [...item.xValues] : undefined; },
            set xValues(value) { if (!Array.isArray(value) || value.length !== item.values.length || value.some((entry) => entry !== null && !Number.isFinite(entry))) throw new ArtifactToolError("invalid_chart_series", "xValues must match the series point count"); item.xValues = [...value]; },
            get categoryPaths() { return item.categoryPaths ? structuredClone(item.categoryPaths) : undefined; },
            set categoryPaths(value) { if (!Array.isArray(value) || value.length !== item.values.length || value.some((path) => !Array.isArray(path) || path.some((part) => typeof part !== "string"))) throw new ArtifactToolError("invalid_chart_series", "categoryPaths must match the series point count"); item.categoryPaths = structuredClone(value); },
            get bubbleSizes() { return item.bubbleSizes ? [...item.bubbleSizes] : undefined; },
            set bubbleSizes(value) { if (!Array.isArray(value) || value.length !== item.values.length || value.some((entry) => entry !== null && !Number.isFinite(entry))) throw new ArtifactToolError("invalid_chart_series", "bubbleSizes must match the series point count"); item.bubbleSizes = [...value]; },
            get bubbleSizeFormula() { return item.bubbleSizeFormula; },
            set bubbleSizeFormula(value) { if (typeof value !== "string") throw new ArtifactToolError("invalid_chart_series", "bubbleSizeFormula must be a string"); item.bubbleSizeFormula = value; },
            get bubbleSizesFormatCode() { return item.bubbleSizesFormatCode; },
            set bubbleSizesFormatCode(value) { if (typeof value !== "string") throw new ArtifactToolError("invalid_chart_series", "bubbleSizesFormatCode must be a string"); item.bubbleSizesFormatCode = value; },
            get explosion() { return item.explosion; },
            set explosion(value) { if (!Number.isFinite(value) || value < 0) throw new ArtifactToolError("invalid_chart_series", "explosion must be a non-negative number"); item.explosion = value; },
            get smooth() { return item.smooth; },
            set smooth(value) { if (typeof value !== "boolean") throw new ArtifactToolError("invalid_chart_series", "smooth must be a boolean"); item.smooth = value; },
            get fill() { return item.fill; },
            set fill(value) { item.fill = value; },
            get line() { return item.line; },
            set line(value) { item.line = value; },
            get stroke() { return item.stroke; },
            set stroke(value) { item.stroke = value; },
            get marker() { return item.marker; },
            set marker(value) {
              if (!value || typeof value !== "object" || Array.isArray(value) || (value.symbol !== undefined && !["circle", "diamond", "dot", "none", "plus", "square", "star", "triangle", "x"].includes(value.symbol)) || (value.size !== undefined && (!Number.isFinite(value.size) || value.size < 0))) throw new ArtifactToolError("invalid_chart_series", "marker requires a supported symbol and a non-negative size");
              item.marker = structuredClone(value);
            },
            get points() { return structuredClone(item.points ?? []); },
            set points(value) {
              if (!Array.isArray(value) || value.some((point) => !Number.isInteger(point?.idx) || point.idx < 0 || point.idx >= item.values.length)) throw new ArtifactToolError("invalid_chart_point", "series points require valid zero-based data indexes");
              item.points = structuredClone(value);
            },
            get trendlines() { return structuredClone(item.trendlines ?? []); },
            set trendlines(value) { if (!Array.isArray(value)) throw new ArtifactToolError("invalid_chart_series", "trendlines must be an array"); item.trendlines = structuredClone(value); },
            get errorBars() { return item.errorBars ? structuredClone(item.errorBars) : undefined; },
            set errorBars(value) { item.errorBars = value === undefined ? undefined : structuredClone(value); },
            get dataLabels() { return item.dataLabels; },
            set dataLabels(value) { item.dataLabels = { ...(item.dataLabels ?? {}), ...value }; },
            get dataLabelOverrides() {
              item.dataLabelOverrides ??= [];
              if (!Object.hasOwn(item.dataLabelOverrides, "add")) Object.defineProperty(item.dataLabelOverrides, "add", {
                enumerable: false,
                value: (dataPointIdx) => {
                  if (!Number.isInteger(dataPointIdx) || dataPointIdx < 0 || dataPointIdx >= item.values.length) throw new ArtifactToolError("invalid_chart_point", "data label override index is outside the series");
                  let override = item.dataLabelOverrides.find((entry) => entry.idx === dataPointIdx);
                  if (!override) { override = { idx: dataPointIdx }; item.dataLabelOverrides.push(override); }
                  return new Proxy({}, {
                    get: (_target, key) => override[key],
                    set: (_target, key, value) => { override[key] = value; return true; },
                  });
                },
              });
              return item.dataLabelOverrides;
            },
            get chartOptions() { return chart.options; },
            apply(config = {}) {
              if (!config || typeof config !== "object" || Array.isArray(config)) throw new ArtifactToolError("invalid_chart_series", "series apply expects an object");
              for (const key of ["name", "fill", "line", "stroke", "marker", "dataLabels", "trendlines", "errorBars", "xValues", "categoryPaths", "bubbleSizes", "bubbleSizeFormula", "bubbleSizesFormatCode", "explosion", "smooth"]) {
                if (config[key] !== undefined) {
                  if (key === "name") item.name = String(config.name);
                  else if (key === "dataLabels") item.dataLabels = { ...(item.dataLabels ?? {}), ...structuredClone(config.dataLabels) };
                  else seriesHandle[key] = structuredClone(config[key]);
                }
              }
              if (config.categories !== undefined) seriesHandle.categories = config.categories;
              if (config.dataLabelOverrides !== undefined) {
                if (!Array.isArray(config.dataLabelOverrides)) throw new ArtifactToolError("invalid_chart_series", "dataLabelOverrides must be an array");
                item.dataLabelOverrides ??= [];
                for (const override of config.dataLabelOverrides) {
                  if (!Number.isInteger(override?.idx) || override.idx < 0 || override.idx >= item.values.length) throw new ArtifactToolError("invalid_chart_point", "data label override index is outside the series");
                  const prior = item.dataLabelOverrides.find((entry) => entry.idx === override.idx);
                  if (prior) Object.assign(prior, structuredClone(override));
                  else item.dataLabelOverrides.push(structuredClone(override));
                }
              }
              if (config.points !== undefined) {
                if (!Array.isArray(config.points) || config.points.some((point) => !Number.isInteger(point?.idx) || point.idx < 0 || point.idx >= item.values.length)) throw new ArtifactToolError("invalid_chart_point", "series points require valid zero-based data indexes");
                item.points ??= [];
                for (const point of config.points) {
                  const prior = item.points.find((entry) => entry.idx === point.idx);
                  if (prior) Object.assign(prior, structuredClone(point));
                  else item.points.push(structuredClone(point));
                }
              }
              return seriesHandle;
            },
          };
          return seriesHandle;
        },
      });
    }
    return values;
  }

  set series(series) {
    this.model.series = normalizeChartSeries(series, this.model.options.categories ?? []);
  }

  get categories() { return this.model.options.categories; }
  set categories(value) {
    if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string")) {
      throw new ArtifactToolError("invalid_chart_categories", "chart categories must be a non-empty array of strings");
    }
    this.model.options.categories = [...value];
    this.model.series = normalizeChartSeries(this.model.series, value);
  }

  get title() { return this.model.options.title; }
  set title(value) { this.model.options.title = value === undefined ? undefined : String(value); }

  get xAxis() { return this.model.options.xAxis; }
  set xAxis(value) { this.model.options.xAxis = mergeConfig(this.model.options.xAxis, value, "chart axis"); }
  get yAxis() { return this.model.options.yAxis; }
  set yAxis(value) { this.model.options.yAxis = mergeConfig(this.model.options.yAxis, value, "chart axis"); }
  get legend() { return this.model.options.legend; }
  set legend(value) { this.model.options.legend = mergeConfig(this.model.options.legend, value, "chart legend"); }
  get dataLabels() { return this.model.options.dataLabels; }
  set dataLabels(value) { this.model.options.dataLabels = mergeConfig(this.model.options.dataLabels, value, "chart data labels"); }

  get src() {
    return this.model.src;
  }

  set src(value) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new ArtifactToolError("invalid_image", "presentation image src must be a non-empty path");
    }
    this.model.src = value;
  }

  get altText() {
    return this.model.altText;
  }

  set altText(value) {
    if (typeof value !== "string") {
      throw new ArtifactToolError("invalid_image", "image altText must be a string");
    }
    this.model.altText = value;
  }

  get chartType() {
    return this.model.type;
  }

  set chartType(value) {
    if (!supportedChartTypes.has(value)) {
      throw new ArtifactToolError("unsupported_chart", `unsupported presentation chart type: ${value}`);
    }
    this.model.type = value;
  }

  delete() {
    this.slide.presentation.delete(this.model.id);
  }
}

class ShapeHandle extends ElementHandle {
  constructor(slide, model) {
    super(slide, model);
    this.textContent = new ShapeText(model);
  }

  get text() {
    return this.textContent;
  }

  set text(text) {
    const normalized = normalizeTextInput(text);
    this.model.text = normalized.text;
    if (normalized.runs) this.model.textRuns = normalized.runs;
    else delete this.model.textRuns;
    if (normalized.paragraphs) this.model.textParagraphs = normalized.paragraphs;
    else delete this.model.textParagraphs;
    if (normalized.style) {
      this.model.options.textStyle = typeof normalized.style === "string"
        ? { ...(this.model.options.textStyle ?? {}), styleName: normalized.style }
        : { ...(this.model.options.textStyle ?? {}), ...normalized.style };
    }
  }

  get connector() { return this.model.options.connector ? structuredClone(this.model.options.connector) : undefined; }
  get connectorLineStyle() { return this.model.options.connector ? structuredClone(this.model.options.line) : undefined; }
  get connectorHead() { return this.model.options.connector?.head ? structuredClone(this.model.options.connector.head) : undefined; }
  get connectorTail() { return this.model.options.connector?.tail ? structuredClone(this.model.options.connector.tail) : undefined; }
  setConnectorFrom(target, index) {
    if (!this.model.options.connector) throw new ArtifactToolError("invalid_connector", "shape is not a connector");
    const model = resolveConnectorTarget(this.slide, target);
    if (index !== undefined && (!Number.isInteger(index) || index < 0)) throw new ArtifactToolError("invalid_connector", "connection site index must be a non-negative integer");
    this.model.options.connector.fromId = model.id;
    if (index !== undefined) this.model.options.connector.fromIdx = index;
    else delete this.model.options.connector.fromIdx;
    return this;
  }
  setConnectorTo(target, index) {
    if (!this.model.options.connector) throw new ArtifactToolError("invalid_connector", "shape is not a connector");
    const model = resolveConnectorTarget(this.slide, target);
    if (index !== undefined && (!Number.isInteger(index) || index < 0)) throw new ArtifactToolError("invalid_connector", "connection site index must be a non-negative integer");
    this.model.options.connector.toId = model.id;
    if (index !== undefined) this.model.options.connector.toIdx = index;
    else delete this.model.options.connector.toIdx;
    return this;
  }

  get fill() {
    return this.model.options.fill;
  }

  set fill(fill) {
    this.model.options.fill = normalizeShapeFill(fill);
  }

  get line() {
    return this.model.options.line;
  }

  set line(line) {
    if (!line || typeof line !== "object" || Array.isArray(line)) throw new ArtifactToolError("invalid_line", "shape line must be a line configuration");
    this.model.options.line = { ...line, ...(line.fill !== undefined ? { fill: normalizeShapeFill(line.fill) } : {}) };
  }

  get borderRadius() { return this.model.options.borderRadius; }
  set borderRadius(value) {
    if (value !== undefined && typeof value !== "number" && typeof value !== "string") throw new ArtifactToolError("invalid_shape_border_radius", "shape borderRadius must be a pixel number or rounded token");
    if (typeof value === "number" && (!Number.isFinite(value) || value < 0)) throw new ArtifactToolError("invalid_shape_border_radius", "shape borderRadius must be a non-negative pixel number");
    this.model.options.borderRadius = value;
  }

  get shadow() { return this.model.options.shadow; }
  set shadow(value) {
    if (value !== undefined && typeof value !== "string" && (!value || typeof value !== "object" || Array.isArray(value))) throw new ArtifactToolError("invalid_shape_shadow", "shape shadow must be a token or shadow configuration");
    this.model.options.shadow = value;
  }

  get customPaths() { return this.model.options.customPaths; }
  set customPaths(value) {
    if (this.model.shape !== "custom") throw new ArtifactToolError("invalid_custom_path", "customPaths can only be set on custom geometry");
    this.model.options.customPaths = normalizeCustomPaths(value);
  }

  get connector() { return this.model.options.connector ? structuredClone(this.model.options.connector) : undefined; }
  setConnectorFrom(target, sideOrIndex = this.model.options.connector?.fromSide) {
    this.model.options.connector ??= {};
    this.model.options.connector.fromId = typeof target === "string" ? target : target?.id;
    if (Number.isInteger(sideOrIndex)) {
      this.model.options.connector.fromIdx = sideOrIndex;
      delete this.model.options.connector.fromSide;
    } else if (sideOrIndex) {
      this.model.options.connector.fromSide = sideOrIndex;
      delete this.model.options.connector.fromIdx;
    }
  }
  setConnectorTo(target, sideOrIndex = this.model.options.connector?.toSide) {
    this.model.options.connector ??= {};
    this.model.options.connector.toId = typeof target === "string" ? target : target?.id;
    if (Number.isInteger(sideOrIndex)) {
      this.model.options.connector.toIdx = sideOrIndex;
      delete this.model.options.connector.toSide;
    } else if (sideOrIndex) {
      this.model.options.connector.toSide = sideOrIndex;
      delete this.model.options.connector.toIdx;
    }
  }

  get geometry() {
    return this.model.kind === "text" ? "textbox" : this.model.shape;
  }

  set geometry(geometry) {
    if (geometry === "textbox") {
      this.model.kind = "text";
      delete this.model.shape;
    } else if (supportedShapes.has(geometry)) {
      this.model.kind = "shape";
      this.model.shape = geometry;
    } else {
      throw new ArtifactToolError("unsupported_shape", `unsupported presentation shape: ${geometry}`);
    }
  }
}

class NotesHandle {
  constructor(slide) {
    this.slide = slide;
  }

  get id() { return this.slide.notesId; }
  get kind() { return "notes"; }
  get text() { return this.slide.notes; }
  set text(value) { this.slide.addNotes(value); }
}

class TableCollection {
  constructor(slide) {
    this.slide = slide;
  }

  add(config = {}) {
    const { rows = config.values, values: _values, ...options } = config;
    this.slide.addTable(rows, mapPosition(options));
    return new TableHandle(this.slide, this.slide.objects.at(-1));
  }
}

function tableCellOptions(table, rowIndex, columnIndex) {
  if (!Number.isInteger(rowIndex) || !Number.isInteger(columnIndex) ||
    rowIndex < 0 || columnIndex < 0 || rowIndex >= table.rows.length ||
    columnIndex >= table.rows[0].length) {
    throw new ArtifactToolError("invalid_table_cell", "table cell index is outside the table bounds");
  }
  table.cellOptions ??= table.rows.map((row) => row.map(() => ({})));
  return table.cellOptions[rowIndex][columnIndex];
}

class TableCellText {
  constructor(options) {
    this.options = options;
  }

  get style() { return { ...(this.options.textStyle ?? {}) }; }

  set style(style) {
    if (!style || typeof style !== "object" || Array.isArray(style)) {
      throw new ArtifactToolError("invalid_text_style", "table cell text style must be an object");
    }
    this.options.textStyle = { ...style };
  }
}

class TableCellHandle {
  constructor(table, rowIndex, columnIndex) {
    this.table = table;
    this.rowIndex = rowIndex;
    this.columnIndex = columnIndex;
    this.options = tableCellOptions(table.model, rowIndex, columnIndex);
    this.text = new TableCellText(this.options);
  }

  get value() { return this.table.model.rows[this.rowIndex][this.columnIndex]; }
  set value(value) {
    validateCell(value);
    this.table.model.rows[this.rowIndex][this.columnIndex] = displayCell(value);
  }

  get fill() { return this.options.fill; }
  set fill(fill) { this.options.fill = fill; }
  get borders() { return structuredClone(this.options.borders ?? {}); }
  set borders(borders) {
    if (!borders || typeof borders !== "object" || Array.isArray(borders)) {
      throw new ArtifactToolError("invalid_table_borders", "table cell borders must be an object");
    }
    this.options.borders = structuredClone(borders);
  }
  get margins() { return structuredClone(this.options.margins ?? {}); }
  set margins(value) { this.options.margins = normalizeTableMargins(value); }
  get anchor() { return this.options.anchor; }
  set anchor(value) {
    if (!["top", "middle", "bottom"].includes(value)) throw new ArtifactToolError("invalid_table_anchor", "table cell anchor must be top, middle, or bottom");
    this.options.anchor = value;
  }
  get horizontalOverflow() { return this.options.horizontalOverflow; }
  set horizontalOverflow(value) {
    if (!["clip", "overflow", "wrap"].includes(value)) throw new ArtifactToolError("invalid_table_overflow", "table cell horizontalOverflow must be clip, overflow, or wrap");
    this.options.horizontalOverflow = value;
  }
}

function normalizeTableMargins(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.values(value).some((side) => !Number.isFinite(side) || side < 0)) {
    throw new ArtifactToolError("invalid_table_margins", "table margins must be non-negative pixels");
  }
  return structuredClone(value);
}

class TableHandle extends ElementHandle {
  getCell(rowIndex, columnIndex) {
    return new TableCellHandle(this, rowIndex, columnIndex);
  }

  constructor(slide, model) {
    super(slide, model);
    model.cellOptions ??= model.rows.map((row) => row.map(() => ({})));
    this.cells = {
      set: (rowIndex, columnIndex, value) => {
        const cell = this.getCell(rowIndex, columnIndex);
        cell.value = value;
        return cell;
      },
      block: ({ row, column, rowCount = 1, columnCount = 1 } = {}) => {
        const table = this;
        const cells = [];
        if (![row, column, rowCount, columnCount].every(Number.isInteger) || row < 0 || column < 0 || rowCount < 1 || columnCount < 1 || row + rowCount > model.rows.length || column + columnCount > model.rows[0].length) {
          throw new ArtifactToolError("invalid_table_range", "table cell range is outside the table bounds");
        }
        for (let r = row; r < row + rowCount; r += 1) for (let c = column; c < column + columnCount; c += 1) cells.push(table.getCell(r, c));
        const textStyle = new Proxy({}, {
          get: (_target, key) => cells[0]?.text.style[key],
          set: (_target, key, value) => {
            for (const cell of cells) cell.text.style = { ...cell.text.style, [key]: value };
            return true;
          },
          ownKeys: () => Reflect.ownKeys(cells[0]?.text.style ?? {}),
          getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
        });
        return {
          get fill() { return cells[0]?.fill; },
          set fill(value) { for (const cell of cells) cell.fill = value; },
          get textStyle() { return textStyle; },
          set textStyle(value) { for (const cell of cells) cell.text.style = value; },
          get borders() { return cells[0]?.borders ?? {}; },
          set borders(value) { for (const cell of cells) cell.borders = value; },
          get margins() { return cells[0]?.margins ?? {}; },
          set margins(value) { for (const cell of cells) cell.margins = value; },
          get anchor() { return cells[0]?.anchor; },
          set anchor(value) { for (const cell of cells) cell.anchor = value; },
          get horizontalOverflow() { return cells[0]?.horizontalOverflow; },
          set horizontalOverflow(value) { for (const cell of cells) cell.horizontalOverflow = value; },
          assign(value = {}) {
            if (value.fill !== undefined) this.fill = value.fill;
            if (value.textStyle !== undefined) this.textStyle = value.textStyle;
            if (value.borders !== undefined) this.borders = value.borders;
            if (value.margins !== undefined) this.margins = value.margins;
            if (value.anchor !== undefined) this.anchor = value.anchor;
            if (value.horizontalOverflow !== undefined) this.horizontalOverflow = value.horizontalOverflow;
            return this;
          },
        };
      },
    };
  }

  get rows() {
    return this.model.rows.map((row, index) => new Proxy(row, {
      get: (target, key, receiver) => key === "height"
        ? (this.model.options.rowHeights?.[index] ?? this.model.options.h / this.model.rows.length)
        : Reflect.get(target, key, receiver),
      set: (target, key, value, receiver) => {
        if (key !== "height") return Reflect.set(target, key, value, receiver);
        if (!Number.isFinite(value) || value <= 0) throw new ArtifactToolError("invalid_table_rows", "row height must be positive");
        const heights = this.model.options.rowHeights ?? Array(this.model.rows.length).fill(this.model.options.h / this.model.rows.length);
        heights[index] = value;
        this.model.options.rowHeights = heights;
        return true;
      },
    }));
  }

  get columns() {
    const table = this;
    return { get: (index) => {
      if (!Number.isInteger(index) || index < 0 || index >= this.model.rows[0].length) throw new ArtifactToolError("invalid_table_columns", "table column index is out of range");
      return { get width() { return table.model.options.columnWidths?.[index] ?? table.model.options.w / table.model.rows[0].length; }, set width(value) {
        if (!Number.isFinite(value) || value <= 0) throw new ArtifactToolError("invalid_table_columns", "column width must be positive");
        const widths = table.model.options.columnWidths ?? Array(table.model.rows[0].length).fill(table.model.options.w / table.model.rows[0].length);
        widths[index] = value;
        table.model.options.columnWidths = widths;
      } };
    } };
  }

  get columnTracks() { return structuredClone(this.model.options.columnTracks ?? []); }
  set columnTracks(value) {
    if (!Array.isArray(value) || value.length !== this.model.rows[0].length || value.some((entry) =>
      !(Number.isFinite(entry) && entry > 0) && !(entry && ["fr", "fixed"].includes(entry.mode) && Number.isFinite(entry.value) && entry.value > 0) && !(entry && Number.isFinite(entry.fr) && entry.fr > 0) && !(entry && Number.isFinite(entry.fixed) && entry.fixed > 0))) {
      throw new ArtifactToolError("invalid_table_columns", "columnTracks must match the table columns and contain positive widths or fixed/fr descriptors");
    }
    const trackMode = (entry) => typeof entry === "number" ? "fixed" : entry.mode ?? (entry.fixed !== undefined ? "fixed" : "fr");
    const trackValue = (entry) => typeof entry === "number" ? entry : entry.value ?? entry.fixed ?? entry.fr;
    const fixed = value.reduce((sum, entry) => sum + (trackMode(entry) === "fixed" ? trackValue(entry) : 0), 0);
    const fr = value.reduce((sum, entry) => sum + (trackMode(entry) === "fr" ? trackValue(entry) : 0), 0);
    const remainder = Math.max(0, (this.model.options.w ?? 0) - fixed);
    this.model.options.columnTracks = structuredClone(value);
    this.model.options.columnWidths = value.map((entry) => trackMode(entry) === "fixed" ? trackValue(entry) : (fr ? remainder * trackValue(entry) / fr : 0));
  }

  get style() { return this.model.options.style; }
  set style(value) {
    if (typeof value !== "string" || !value.trim()) throw new ArtifactToolError("invalid_table_style", "table style must be a non-empty string");
    if (!/^(?:\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?|[a-z0-9_.-]+)$/i.test(value.trim())) throw new ArtifactToolError("invalid_table_style", "table style must be a PowerPoint table style identifier");
    this.model.options.style = value;
  }

  get styleOptions() { return structuredClone(this.model.options.styleOptions ?? {}); }
  set styleOptions(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new ArtifactToolError("invalid_table_style", "table styleOptions must be an object");
    this.model.options.styleOptions = structuredClone(value);
  }

  get borders() {
    const table = this;
    return { assign(borderConfig) {
      for (let row = 0; row < table.model.rows.length; row += 1) {
        for (let column = 0; column < table.model.rows[row].length; column += 1) table.getCell(row, column).borders = borderConfig;
      }
    } };
  }

  merge({ startRow, endRow, startColumn, endColumn }) {
    const rowSpan = endRow - startRow + 1;
    const colSpan = endColumn - startColumn + 1;
    if (![startRow, endRow, startColumn, endColumn].every(Number.isInteger) || startRow < 0 || startColumn < 0 ||
      endRow >= this.model.rows.length || endColumn >= this.model.rows[0].length || rowSpan < 1 || colSpan < 1) {
      throw new ArtifactToolError("invalid_table_merge", "table merge range is outside the table");
    }
    for (let row = startRow; row <= endRow; row += 1) {
      for (let column = startColumn; column <= endColumn; column += 1) {
        const cell = tableCellOptions(this.model, row, column);
        if ((row !== startRow || column !== startColumn) && (cell.colspan || cell.rowspan)) {
          throw new ArtifactToolError("invalid_table_merge", "table merge ranges cannot overlap");
        }
      }
    }
    const anchor = tableCellOptions(this.model, startRow, startColumn);
    anchor.colspan = colSpan;
    anchor.rowspan = rowSpan;
    return this;
  }

  unmerge({ startRow, startColumn }) {
    const cell = tableCellOptions(this.model, startRow, startColumn);
    delete cell.colspan;
    delete cell.rowspan;
    return this;
  }

  insertRows({ index, count = 1 }) {
    if (!Number.isInteger(index) || index < 0 || index > this.model.rows.length || !Number.isInteger(count) || count < 1) {
      throw new ArtifactToolError("invalid_table_rows", "table row insertion index or count is invalid");
    }
    const width = this.model.rows[0].length;
    this.model.rows.splice(index, 0, ...Array.from({ length: count }, () => Array(width).fill("")));
    this.model.cellOptions.splice(index, 0, ...Array.from({ length: count }, () => Array.from({ length: width }, () => ({}))));
    if (this.model.options.rowHeights) this.model.options.rowHeights.splice(index, 0, ...Array(count).fill(this.model.options.h / (this.model.rows.length)));
    return this;
  }

  deleteRows({ index, count = 1 }) {
    if (!Number.isInteger(index) || index < 0 || !Number.isInteger(count) || count < 1 || index + count > this.model.rows.length || count >= this.model.rows.length) {
      throw new ArtifactToolError("invalid_table_rows", "table row deletion index or count is invalid");
    }
    this.model.rows.splice(index, count);
    this.model.cellOptions.splice(index, count);
    this.model.options.rowHeights?.splice(index, count);
    return this;
  }

  insertColumns({ index, count = 1 }) {
    const width = this.model.rows[0].length;
    if (!Number.isInteger(index) || index < 0 || index > width || !Number.isInteger(count) || count < 1) {
      throw new ArtifactToolError("invalid_table_columns", "table column insertion index or count is invalid");
    }
    for (let row = 0; row < this.model.rows.length; row += 1) {
      this.model.rows[row].splice(index, 0, ...Array(count).fill(""));
      this.model.cellOptions[row].splice(index, 0, ...Array.from({ length: count }, () => ({})));
    }
    if (this.model.options.columnWidths) this.model.options.columnWidths.splice(index, 0, ...Array(count).fill(this.model.options.w / (width + count)));
    if (this.model.options.columnTracks) this.model.options.columnTracks.splice(index, 0, ...Array(count).fill({ mode: "fr", value: 1 }));
    return this;
  }

  deleteColumns({ index, count = 1 }) {
    const width = this.model.rows[0].length;
    if (!Number.isInteger(index) || index < 0 || !Number.isInteger(count) || count < 1 || index + count > width || count >= width) {
      throw new ArtifactToolError("invalid_table_columns", "table column deletion index or count is invalid");
    }
    for (let row = 0; row < this.model.rows.length; row += 1) {
      this.model.rows[row].splice(index, count);
      this.model.cellOptions[row].splice(index, count);
    }
    this.model.options.columnWidths?.splice(index, count);
    this.model.options.columnTracks?.splice(index, count);
    return this;
  }
}

class ImageHandle extends ElementHandle {
  get fit() { return this.model.options.fit ?? "fill"; }
  set fit(value) {
    if (!["fill", "contain", "cover"].includes(value)) {
      throw new ArtifactToolError("unsupported_image_fit", `unsupported image fit mode: ${value}`);
    }
    this.model.options.fit = value;
  }

  get crop() { return this.model.options.crop ? { ...this.model.options.crop } : undefined; }
  set crop(value) {
    this.model.options.crop = value === undefined ? undefined : normalizeImageCrop(value);
  }

  get geometry() { return this.model.options.geometry ?? "rect"; }
  set geometry(value) {
    if (typeof value !== "string" || !supportedShapes.has(value)) throw new ArtifactToolError("invalid_image_geometry", `unsupported image mask geometry: ${value}`);
    this.model.options.geometry = value;
  }

  get borderRadius() { return this.model.options.borderRadius; }
  set borderRadius(value) {
    if (value !== undefined && typeof value !== "number" && typeof value !== "string") throw new ArtifactToolError("invalid_image_border_radius", "image borderRadius must be a pixel number or token");
    if (typeof value === "number" && (!Number.isFinite(value) || value < 0)) throw new ArtifactToolError("invalid_image_border_radius", "image borderRadius must be a non-negative pixel number");
    this.model.options.borderRadius = value;
  }

  get alt() { return this.model.altText; }
  set alt(value) { this.altText = value; }

  get prompt() { return this.model.prompt; }
  set prompt(value) {
    if (value !== undefined && typeof value !== "string") throw new ArtifactToolError("invalid_image", "image prompt must be a string");
    this.model.prompt = value;
  }

  get hyperlink() { return this.model.hyperlink ? { ...this.model.hyperlink } : undefined; }
  set hyperlink(value) {
    if (value !== undefined && (!value || typeof value.uri !== "string")) {
      throw new ArtifactToolError("invalid_image_link", "image hyperlink requires a uri");
    }
    this.model.hyperlink = value === undefined ? undefined : { ...value };
  }

  get rotation() { return this.model.options.rotation ?? 0; }
  set rotation(value) {
    if (!Number.isFinite(value)) throw new ArtifactToolError("invalid_image_rotation", "image rotation must be finite");
    this.model.options.rotation = value;
  }

  get flipHorizontal() { return this.model.options.flipHorizontal ?? false; }
  set flipHorizontal(value) { this.model.options.flipHorizontal = Boolean(value); }
  get flipVertical() { return this.model.options.flipVertical ?? false; }
  set flipVertical(value) { this.model.options.flipVertical = Boolean(value); }

  async regenerate(options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) throw new ArtifactToolError("invalid_image", "regenerate options must be an object");
    if (typeof this.model.prompt !== "string" || this.model.prompt.trim() === "") throw new ArtifactToolError("invalid_image", "regenerate requires an image prompt");
    const generate = this.slide.presentation.imageGenerator;
    if (typeof generate !== "function") throw new ArtifactToolError("image_generation_unavailable", "configure an imageGenerator callback to regenerate prompt-based images");
    const generated = await generate(this.model.prompt, { ...options, position: this.position });
    const src = typeof generated === "string" ? generated : generated?.src ?? generated?.dataUrl;
    if (typeof src !== "string" || src.trim() === "" || /^https?:/i.test(src)) throw new ArtifactToolError("invalid_generated_image", "imageGenerator must return local image bytes or a data URL");
    this.model.src = src;
    return this;
  }
}

class ImageCollection {
  constructor(slide) {
    this.slide = slide;
  }

  add(config = {}) {
    const { src: directSrc, path, dataUrl, svg, blob, contentType, altText, alt, prompt, hyperlink, ...options } = config;
    let src = directSrc ?? path ?? dataUrl;
    if (typeof svg === "string") src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    if (blob !== undefined) {
      const bytes = blob instanceof ArrayBuffer ? Buffer.from(blob) :
        ArrayBuffer.isView(blob) ? Buffer.from(blob.buffer, blob.byteOffset, blob.byteLength) : null;
      if (!bytes || typeof contentType !== "string" || !contentType.startsWith("image/")) {
        throw new ArtifactToolError("invalid_image", "image blob requires bytes and an image contentType");
      }
      src = `data:${contentType};base64,${bytes.toString("base64")}`;
    }
    if (prompt !== undefined && typeof prompt !== "string") {
      throw new ArtifactToolError("invalid_image", "image prompt must be a string");
    }
    if ((typeof src !== "string" || src.trim() === "") && !(typeof prompt === "string" && prompt.trim() !== "")) {
      throw new ArtifactToolError("invalid_image", "presentation image requires a source or a non-empty prompt");
    }
    if (typeof src === "string" && /^https?:/i.test(src)) {
      throw new ArtifactToolError("invalid_image", "remote image URLs are not fetched; provide local bytes or a local path");
    }
    if (hyperlink !== undefined && (!hyperlink || typeof hyperlink.uri !== "string")) {
      throw new ArtifactToolError("invalid_image_link", "image hyperlink requires a uri");
    }
    const image = {
      kind: "image",
      ...(typeof src === "string" && src.trim() !== "" ? { src } : {}),
      altText: typeof altText === "string" ? altText : typeof alt === "string" ? alt : "",
      ...(typeof prompt === "string" ? { prompt } : {}),
      ...(hyperlink ? { hyperlink: { ...hyperlink } } : {}),
      options: mapPosition(options),
    };
    registerElement(this.slide, image, "im");
    return new ImageHandle(this.slide, image);
  }
}

class ChartCollection {
  constructor(slide) {
    this.slide = slide;
  }

  add(typeOrConfig = {}, configOptions = {}) {
    const config = typeof typeOrConfig === "string" ? { ...configOptions, type: typeOrConfig } : typeOrConfig;
    const { type, series, categories, ...chartOptions } = config;
    if (!supportedChartTypes.has(type)) {
      throw new ArtifactToolError("unsupported_chart", `unsupported presentation chart type: ${type}`);
    }
    const chart = {
      kind: "chart",
      type,
      series: normalizeChartSeries(series, categories ?? []),
      options: mapPosition({ ...chartOptions, ...(categories ? { categories: [...categories] } : {}) }),
    };
    registerElement(this.slide, chart, "ch");
    return new ElementHandle(this.slide, chart);
  }
}

function createSlide(presentation, options = {}) {
  if (presentation.shallowImport) {
    throw new ArtifactToolError(
      "unsupported_operation",
      "shallow PPTX imports cannot be edited until slide content is parsed",
    );
  }
  const slide = new Slide(presentation, options);
  presentation.slides.items.push(slide);
  return slide;
}

class SlideCollection {
  constructor(presentation) {
    this.presentation = presentation;
    this.items = [];
  }

  add(options = {}) {
    const slide = createSlide(this.presentation, options);
    slide.placeholders.addFromLayout();
    if (options.background?.fill !== undefined) slide.background.fill = options.background.fill;
    return slide;
  }

  getItem(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.items.length) {
      throw new ArtifactToolError("invalid_slide_index", `slide index is out of range: ${index}`);
    }
    return this.items[index];
  }

  insert(options = {}) {
    const { after, ...slideOptions } = options;
    const slide = new Slide(this.presentation, slideOptions);
    slide.placeholders.addFromLayout();
    if (slideOptions.background?.fill !== undefined) slide.background.fill = slideOptions.background.fill;
    let index = this.items.length;
    if (after !== undefined && after !== null) {
      const afterIndex = Number.isInteger(after)
        ? after
        : this.items.findIndex((item) => item === after || item.id === after);
      if (afterIndex < 0 || afterIndex >= this.items.length) {
        throw new ArtifactToolError("invalid_slide_index", `unknown slide position: ${after}`);
      }
      index = afterIndex + 1;
    }
    this.items.splice(index, 0, slide);
    return { slide, index };
  }

  delete(selection) {
    const ids = Array.isArray(selection) ? selection : [selection];
    if (!ids.length || ids.some((id) => typeof id !== "string")) {
      throw new ArtifactToolError("invalid_presentation_id", "slide deletion requires one or more slide IDs");
    }
    const indices = ids.map((id) => this.items.findIndex((slide) => slide.id === id));
    if (indices.some((index) => index < 0)) {
      throw new ArtifactToolError("invalid_presentation_id", "one or more slide IDs are unknown");
    }
    for (const index of [...new Set(indices)].sort((a, b) => b - a)) this.items.splice(index, 1);
  }

  keep(selection) {
    const ids = Array.isArray(selection) ? selection : [selection];
    if (ids.some((id) => !(Number.isInteger(id) && id >= 0 && id < this.items.length) &&
      !(typeof id === "string" && this.items.some((slide) => slide.id === id)))) {
      throw new ArtifactToolError("invalid_presentation_id", "slide keep requires valid slide indexes or IDs");
    }
    const wanted = new Set(ids.map((id) => Number.isInteger(id) ? this.items[id]?.id : id));
    this.items = this.items.filter((slide) => wanted.has(slide.id));
  }

  addCopy(copy) {
    if (!(copy instanceof Slide) || copy.presentation !== this.presentation) {
      throw new ArtifactToolError("invalid_slide_copy", "addCopy requires a Slide from this presentation");
    }
    const slide = new Slide(this.presentation, {
      layout: copy.layout,
      layoutId: copy.layoutId,
      width: copy.size.width,
      height: copy.size.height,
    });
    slide.background.fill = copy.background.fill;
    slide.notes = copy.notes;
    for (const object of copy.objects) {
      const clone = structuredClone(object);
      delete clone.id;
      registerElement(slide, clone, object.id.split("/")[0]);
    }
    this.items.push(slide);
    return slide;
  }

  reorder(ids) {
    if (!Array.isArray(ids) || ids.length !== this.items.length || new Set(ids).size !== ids.length) {
      throw new ArtifactToolError("invalid_slide_order", "reorder requires each slide ID exactly once");
    }
    const byId = new Map(this.items.map((slide) => [slide.id, slide]));
    if (ids.some((id) => !byId.has(id))) {
      throw new ArtifactToolError("invalid_slide_order", "reorder contains an unknown slide ID");
    }
    this.items = ids.map((id) => byId.get(id));
  }

  get length() {
    return this.items.length;
  }

  [Symbol.iterator]() {
    return this.items[Symbol.iterator]();
  }
}

class PresentationView {
  constructor(proto = {}) {
    this.gridlinesVisible = proto.gridlinesVisible ?? false;
    this.guidesVisible = proto.guidesVisible ?? false;
    this.placeholdersVisible = proto.placeholdersVisible ?? true;
    this.gridSpacingCxEmu = proto.gridSpacingCxEmu ?? 76200;
    this.gridSpacingCyEmu = proto.gridSpacingCyEmu ?? 76200;
  }

  showGridlines() { this.gridlinesVisible = true; return this.gridlinesVisible; }
  hideGridlines() { this.gridlinesVisible = false; return this.gridlinesVisible; }
  toggleGridlines() { this.gridlinesVisible = !this.gridlinesVisible; return this.gridlinesVisible; }
  showGuides() { this.guidesVisible = true; return this.guidesVisible; }
  hideGuides() { this.guidesVisible = false; return this.guidesVisible; }
  toggleGuides() { this.guidesVisible = !this.guidesVisible; return this.guidesVisible; }
  showPlaceholders() { this.placeholdersVisible = true; return this.placeholdersVisible; }
  hidePlaceholders() { this.placeholdersVisible = false; return this.placeholdersVisible; }
  togglePlaceholders() { this.placeholdersVisible = !this.placeholdersVisible; return this.placeholdersVisible; }
}

async function addSlideObjects(presentation, slideModel, presentationModel, masterNames) {
  const layoutMaster = masterNames.get(slideModel.layoutId);
  const slide = presentation.addSlide(layoutMaster);
  if (slideModel.background.fill !== "none") {
    slide.background = pptxFill(slideModel.background.fill, presentationModel.theme);
  }
  if (slideModel.notes) slide.addNotes(slideModel.notes);
  for (const object of slideModel.objects) {
    if (!presentationModel.view.placeholdersVisible && object.options?.placeholderType && !object.text) continue;
    if (object.kind === "text") {
      const options = textOptions(object.options);
      const { fill, line, ...textProps } = options;
      const placeholderOptions = pptxSlidePlaceholder(slideModel, object, presentationModel);
        slide.addText(pptxTextValue(object, presentationModel.theme), {
        ...mapPptxPosition(textProps),
        ...pptxParagraphOptions(object),
          objectName: `ruxex_text_${object.id}`,
          ...placeholderOptions,
        fontSize: textProps.fontSize * 0.75,
          ...(textProps.color !== undefined ? pptxTextColor(textProps.color, presentationModel.theme) : {}),
          ...(fill !== undefined ? { fill: pptxFill(fill, presentationModel.theme) } : {}),
          ...(line !== undefined ? { line: pptxLine(line, presentationModel.theme) } : {}),
      });
    }
    if (object.kind === "table") {
      slide.addTable(pptxTableRows(object, presentationModel.theme), pptxTableOptions(object));
    }
    if (object.kind === "image") {
      if (typeof object.src !== "string" || object.src.length === 0) throw new ArtifactToolError("image_generation_pending", "regenerate the prompt-based image before exporting the presentation");
      const imageSource = await exportedImageSource(object.src, object.options);
      const imageOptions = await imagePlacement(object.src, object.options);
      slide.addImage({
        ...(imageSource.src.startsWith("data:") ? { data: imageSource.src } : { path: imageSource.src }),
        ...(object.altText ? { altText: object.altText } : {}),
        ...pptxImageOptions({ ...imageOptions, hyperlink: object.hyperlink }),
      });
    }
    if (object.kind === "chart") {
      const chartOptions = mapPptxPosition(object.options);
      if (object.options.title !== undefined) chartOptions.showTitle = true;
      if (object.options.hasLegend !== undefined) chartOptions.showLegend = Boolean(object.options.hasLegend);
      if (!chartOptions.chartColors && object.series.some((series) => typeof series.fill === "string")) {
        chartOptions.chartColors = object.series.map((series, index) =>
          typeof series.fill === "string" ? pptxColor(series.fill, presentationModel.theme) : defaultThemeColors[`accent${index % 6 + 1}`].slice(1),
        );
      }
      slide.addChart(
        presentation.ChartType[object.type],
        object.series,
        chartOptions,
      );
    }
    if (object.kind === "shape") {
      const shapeTextMarker = `ruxex_shape_${object.id}`;
      const shapeGeometry = object.shape === "custom" || object.shape === "connector" ? (object.shape === "connector" ? "line" : "rect") : object.options.borderRadius !== undefined && object.shape === "rect" ? "roundRect" : object.shape;
      const connector = object.options.connector;
      const shapeOptions = {
        ...object.options,
        ...(connector ? connectorPosition(slideModel, object) : {}),
        ...(connector ? { line: {
          ...(object.options.line ?? {}),
          ...(connector.tail?.type ? { beginArrowType: connector.tail.type === "arrow" ? "triangle" : connector.tail.type } : {}),
          ...(connector.head?.type ? { endArrowType: connector.head.type === "arrow" ? "triangle" : connector.head.type } : {}),
        } } : {}),
        objectName: shapeTextMarker,
      };
      slide.addShape(presentation.ShapeType[shapeGeometry], mapPptxShapeOptions({
        ...shapeOptions,
      }, presentationModel.theme));
      if (object.text !== undefined) {
        const { textStyle = {}, ...textOptions } = object.options;
        const pptxTextStyle = pptxTextStyleOptions(textStyle);
        delete textOptions.fill;
        delete textOptions.line;
        slide.addText(pptxTextValue(object, presentationModel.theme), {
          ...mapPptxPosition(textOptions),
          ...pptxParagraphOptions(object),
          objectName: `${shapeTextMarker}_text`,
          ...pptxTextStyle,
          ...(Number.isFinite(textStyle.fontSize) ? { fontSize: textStyle.fontSize * 0.75 } : {}),
          ...(textStyle.color !== undefined ? pptxTextColor(textStyle.color, presentationModel.theme) : {}),
        });
      }
    }
  }
}

function mapPptxPosition(options = {}) {
  const mapped = { ...options };
  for (const key of ["x", "y", "w", "h"]) {
    if (Number.isFinite(mapped[key])) mapped[key] /= pixelsPerInch;
  }
  return mapped;
}

function pptxTableRows(object, theme) {
  return object.rows.map((row, rowIndex) => row.map((value, columnIndex) => {
    const cell = object.cellOptions?.[rowIndex]?.[columnIndex] ?? {};
    const options = {};
    const styleFill = tableStyleFill(object, rowIndex, columnIndex);
    const fill = cell.fill ?? styleFill;
    if (fill !== undefined && fill !== "none") options.fill = pptxColor(fill, theme);
    if (cell.borders !== undefined) options.border = pptxTableBorder(cell.borders, theme);
    if (cell.margins !== undefined) options.margin = pptxMargins(cell.margins);
    if (cell.anchor !== undefined) options.valign = cell.anchor;
    if (cell.horizontalOverflow !== undefined) options.wrap = cell.horizontalOverflow === "wrap";
    const textStyle = cell.textStyle ?? {};
    if (Number.isInteger(cell.colspan) && cell.colspan > 1) options.colspan = cell.colspan;
    if (Number.isInteger(cell.rowspan) && cell.rowspan > 1) options.rowspan = cell.rowspan;
    for (const key of ["bold", "italic", "align", "valign", "fontFace"]) {
      if (textStyle[key] !== undefined) options[key] = textStyle[key];
    }
    if (Number.isFinite(textStyle.fontSize)) options.fontSize = textStyle.fontSize * 0.75;
    if (textStyle.color !== undefined) Object.assign(options, pptxTextColor(textStyle.color, theme));
    return Object.keys(options).length > 0 ? { text: value, options } : value;
  }));
}

function tableStyleFill(object, rowIndex, columnIndex) {
  const options = object.options.styleOptions ?? {};
  if (options.headerRow && rowIndex === 0) return object.options.headerFill ?? "accent1";
  if (options.totalRow && rowIndex === object.rows.length - 1) return object.options.totalFill ?? "#E8EEF7";
  if (options.firstColumn && columnIndex === 0) return object.options.firstColumnFill ?? "#E8EEF7";
  if (options.lastColumn && columnIndex === object.rows[rowIndex].length - 1) return object.options.lastColumnFill ?? "#E8EEF7";
  if (options.bandedRows && rowIndex % 2 === 1) return object.options.bandedRowFill ?? "#F1F5F9";
  if (options.bandedColumns && columnIndex % 2 === 1) return object.options.bandedColumnFill ?? "#F8FAFC";
  return undefined;
}

function pptxMargins(value) {
  const sides = typeof value === "number"
    ? { top: value, right: value, bottom: value, left: value }
    : { top: value.top ?? 0, right: value.right ?? 0, bottom: value.bottom ?? 0, left: value.left ?? 0 };
  return [sides.top, sides.right, sides.bottom, sides.left].map((side) => side / pixelsPerInch);
}

function pptxTableOptions(object) {
  const options = mapPptxPosition(object.options);
  if (Array.isArray(object.options.columnWidths)) options.colW = object.options.columnWidths.map((width) => width / pixelsPerInch);
  if (Array.isArray(object.options.rowHeights)) options.rowH = object.options.rowHeights.map((height) => height / pixelsPerInch);
  if (object.options.margins !== undefined) options.margin = pptxMargins(object.options.margins);
  if (object.options.anchor !== undefined) options.valign = object.options.anchor;
  delete options.columnWidths;
  delete options.rowHeights;
  delete options.columnTracks;
  delete options.styleOptions;
  delete options.style;
  return options;
}

function pptxTableBorder(borders, theme) {
  const edge = (value) => {
    if (value === undefined || value === null || value === "none") return { color: "FFFFFF", transparency: 100, pt: 0 };
    const config = typeof value === "string" ? { fill: value } : value;
    const fill = config.fill;
    const color = typeof fill === "string" ? pptxColor(fill, theme) : fill?.color ? pptxColor(fill.color, theme) : "000000";
    return { color, pt: Number.isFinite(config.width) ? config.width * 0.75 : 0.75 };
  };
  if (["top", "right", "bottom", "left"].some((key) => borders[key] !== undefined)) {
    return [edge(borders.top), edge(borders.right), edge(borders.bottom), edge(borders.left)];
  }
  return edge(borders);
}

function pptxColor(color, theme) {
  if (typeof color !== "string") {
    throw new ArtifactToolError("invalid_color", "presentation colors must be strings");
  }
  const input = color.trim();
  const value = resolvePresentationColor(input, theme);
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.slice(1).toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(value)) return value.toUpperCase();
  throw new ArtifactToolError("invalid_color", `unsupported presentation color: ${color}`);
}

function pptxTextColor(color, theme) {
  const resolved = resolveColorSpec(color, theme);
  return {
    color: pptxColor(resolved.color, theme),
    ...(resolved.opacity < 1 ? { transparency: Math.round((1 - resolved.opacity) * 100) } : {}),
  };
}

function pptxFill(fill, theme) {
  if (fill === "none") return { color: "FFFFFF", transparency: 100 };
  if (fill?.type === "image") return { color: "FFFFFF", transparency: 100 };
  if (fill?.type === "gradient") return { color: pptxColor(fill.stops[0].color, theme) };
  if (fill?.type === "solid") {
    const resolved = resolveColorSpec(fill.color, theme);
    return { color: pptxColor(resolved.color, theme), ...(resolved.opacity < 1 ? { transparency: Math.round((1 - resolved.opacity) * 100) } : {}) };
  }
  const resolved = resolveColorSpec(fill, theme);
  return { color: pptxColor(resolved.color, theme), ...(resolved.opacity < 1 ? { transparency: Math.round((1 - resolved.opacity) * 100) } : {}) };
}

function pptxLine(line, theme) {
  if (line === "none" || line.fill === "none" || line.width === 0) {
    return { color: "FFFFFF", transparency: 100, width: 0 };
  }
  const lineFill = line.fill?.type === "gradient" ? line.fill.stops[0].color
    : line.fill?.type === "solid" ? line.fill.color
      : line.fill?.type === "image" ? "#FFFFFF"
        : line.fill;
  const resolvedFill = resolveColorSpec(lineFill, theme);
  return {
    color: pptxColor(resolvedFill.color, theme),
    width: Number.isFinite(line.width) ? line.width * 0.75 : 1,
    ...((line.transparency !== undefined || resolvedFill.opacity < 1) ? { transparency: Math.round(100 - (100 - Number(line.transparency ?? 0)) * resolvedFill.opacity) } : {}),
    ...(line.beginArrowType ? { beginArrowType: line.beginArrowType } : {}),
    ...(line.endArrowType ? { endArrowType: line.endArrowType } : {}),
  };
}

function pptxImageOptions(options = {}) {
  const mapped = mapPptxPosition(options);
  const { rotation, flipHorizontal, flipVertical, hyperlink, ...rest } = mapped;
  return {
    ...rest,
    ...(hyperlink ? { hyperlink: { url: hyperlink.uri, ...(hyperlink.tooltip ? { tooltip: hyperlink.tooltip } : {}) } } : {}),
    ...(Number.isFinite(rotation) ? { rotate: rotation } : {}),
    ...(flipHorizontal ? { flipH: true } : {}),
    ...(flipVertical ? { flipV: true } : {}),
  };
}

function mapPptxShapeOptions(options = {}, theme) {
  const mapped = mapPptxPosition(options);
  const { borderRadius, shadow, rotation, horizontalFlip, verticalFlip, ...shapeOptions } = mapped;
  Object.assign(mapped, shapeOptions);
  delete mapped.borderRadius;
  delete mapped.rotation;
  delete mapped.horizontalFlip;
  delete mapped.verticalFlip;
  if (Number.isFinite(rotation)) mapped.rotate = rotation;
  if (horizontalFlip) mapped.flipH = true;
  if (verticalFlip) mapped.flipV = true;
  if (mapped.fill !== undefined) mapped.fill = pptxFill(mapped.fill, theme);
  if (mapped.line !== undefined) mapped.line = pptxLine(mapped.line, theme);
  if (borderRadius !== undefined && Number.isFinite(options.w) && Number.isFinite(options.h) && Math.min(options.w, options.h) > 0) {
    mapped.rectRadius = Math.min(1, resolveImageBorderRadius(borderRadius, Math.min(options.w, options.h)) * 2 / Math.min(options.w, options.h));
  }
  if (typeof shadow === "string") {
    const shadows = {
      "shadow-none": { type: "none" },
      "shadow-sm": { type: "outer", color: "000000", opacity: 0.12, blur: 2, offset: 1, angle: 45 },
      shadow: { type: "outer", color: "000000", opacity: 0.16, blur: 4, offset: 2, angle: 45 },
      "shadow-md": { type: "outer", color: "000000", opacity: 0.18, blur: 8, offset: 4, angle: 45 },
      "shadow-lg": { type: "outer", color: "000000", opacity: 0.2, blur: 14, offset: 7, angle: 45 },
      "shadow-xl": { type: "outer", color: "000000", opacity: 0.22, blur: 20, offset: 10, angle: 45 },
      "shadow-2xl": { type: "outer", color: "000000", opacity: 0.26, blur: 30, offset: 15, angle: 45 },
    };
    const custom = /^(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px\s+(#[0-9a-f]{6})(?:\/(\d{1,3}))?$/i.exec(shadow.trim());
    if (shadows[shadow]) mapped.shadow = shadows[shadow];
    else if (custom) {
      const [, dx, dy, blur, color, opacity = "17"] = custom;
      const x = Number(dx);
      const y = Number(dy);
      mapped.shadow = {
        type: "outer",
        color: color.slice(1).toUpperCase(),
        opacity: Math.min(1, Number(opacity) / 100),
        blur: Number(blur) * 0.75,
        offset: Math.hypot(x, y) * 0.75,
        angle: (Math.atan2(-y, x) * 180 / Math.PI + 360) % 360,
      };
    } else throw new ArtifactToolError("invalid_shape_shadow", `unsupported shape shadow token: ${shadow}`);
  } else if (shadow !== undefined) mapped.shadow = structuredClone(shadow);
  return mapped;
}

function inspectionElement(object, slideIndex, elementIndex) {
  const kind = object.kind === "text" ? "textbox" : object.kind;
  const element = {
    id: object.id,
    kind,
  };
  if (object.options?.name !== undefined) element.name = object.options.name;
  if (object.kind === "shape") element.geometry = object.shape;
  if (object.kind === "text") element.geometry = "textbox";
  if (object.kind === "shape") {
    if (object.options?.fill !== undefined) element.fill = object.options.fill;
    if (object.options?.line !== undefined) element.line = structuredClone(object.options.line);
    if (object.options?.shadow !== undefined) element.shadow = structuredClone(object.options.shadow);
    if (object.options?.borderRadius !== undefined) element.borderRadius = object.options.borderRadius;
  }
  if (object.text !== undefined) element.text = object.text;
  if (object.src !== undefined) {
    element.src = object.src;
    element.altText = object.altText;
    element.alt = object.altText;
    if (object.prompt !== undefined) element.prompt = object.prompt;
    if (object.hyperlink !== undefined) element.hyperlink = { ...object.hyperlink };
    if (object.options?.geometry !== undefined) element.geometry = object.options.geometry;
    if (object.options?.borderRadius !== undefined) element.borderRadius = object.options.borderRadius;
    if (object.options?.crop !== undefined) element.crop = structuredClone(object.options.crop);
    if (object.options?.fit !== undefined) element.fit = object.options.fit;
  }
  if (object.options?.title !== undefined) element.title = object.options.title;
  if (object.textRuns !== undefined) element.textRuns = structuredClone(object.textRuns);
  if (object.rows !== undefined) {
    element.rows = object.rows.map((row) => [...row]);
    element.cells = object.rows.map((row, rowIndex) => row.map((value, columnIndex) => {
      const cell = object.cellOptions?.[rowIndex]?.[columnIndex] ?? {};
      return {
        value,
        ...(cell.fill !== undefined ? { fill: cell.fill } : {}),
        ...(cell.colspan !== undefined ? { colspan: cell.colspan } : {}),
        ...(cell.rowspan !== undefined ? { rowspan: cell.rowspan } : {}),
        ...(cell.textStyle ? { style: { ...cell.textStyle } } : {}),
        ...(cell.borders ? { borders: structuredClone(cell.borders) } : {}),
        ...(cell.margins !== undefined ? { margins: structuredClone(cell.margins) } : {}),
        ...(cell.anchor !== undefined ? { anchor: cell.anchor } : {}),
        ...(cell.horizontalOverflow !== undefined ? { horizontalOverflow: cell.horizontalOverflow } : {}),
      };
    }));
  }
  if (object.series !== undefined) {
    element.chartType = object.type;
    element.chartOptions = Object.fromEntries(Object.entries(object.options ?? {})
      .filter(([key]) => !["x", "y", "w", "h"].includes(key)));
    element.series = object.series.map((series) => ({
      name: series.name,
      labels: [...series.labels],
      values: [...series.values],
    }));
  }
  const options = object.options ?? {};
  if (["x", "y", "w", "h"].some((key) => Number.isFinite(options[key]))) {
    element.position = {
      ...(Number.isFinite(options.x) ? { left: options.x } : {}),
      ...(Number.isFinite(options.y) ? { top: options.y } : {}),
      ...(Number.isFinite(options.w) ? { width: options.w } : {}),
      ...(Number.isFinite(options.h) ? { height: options.h } : {}),
    };
  }
  const style = options.textStyle ?? Object.fromEntries(
    ["fontSize", "fontFace", "bold", "italic", "color", "align", "valign"]
      .filter((key) => options[key] !== undefined)
      .map((key) => [key, options[key]]),
  );
  if (Object.keys(style).length > 0) element.style = { ...style };
  return element;
}

function inspectionTree(presentation) {
  return {
    schema: "openai.presentation.inspection/v1",
    unit: "px",
    kind: "presentation",
    id: presentation.id,
    title: presentation.title,
    comments: presentation._commentThreads.map((thread) => ({
      id: thread.id,
      kind: "thread",
      body: thread.body,
      author: structuredClone(thread.author),
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      target: structuredClone(thread.target),
      ...(thread.position ? { position: structuredClone(thread.position) } : {}),
      resolved: thread.resolved,
      replies: structuredClone(thread.replies),
    })),
    slides: presentation.slides.items.map((slide, index) => {
      const titleObject = slide.objects.find(
        (object) => object.kind === "text" && object.options.role === "title",
      );
      return {
        id: slide.id,
        kind: "slide",
        index,
        layout: { id: slide.layoutId, name: slide.layout },
        ...(titleObject ? { title: titleObject.text } : {}),
        background: { fill: slide.background.fill },
        elements: slide.objects.filter((object) => !object.fillSourceOnly).map((object, elementIndex) =>
          inspectionElement(object, index, elementIndex),
        ),
        notes: { id: slide.notesId, kind: "notes", text: slide.notes },
      };
    }),
  };
}

function xmlEscape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function slideLayoutRecord(presentation, slide, detail = "compact") {
  if (detail !== "compact" && detail !== "full" && detail !== undefined) throw new ArtifactToolError("invalid_layout_detail", "layout detail must be compact or full");
  const index = presentation.slides.items.indexOf(slide);
  const record = {
    schema: "openai.presentation.layout/v5",
    unit: "px",
    slide: {
      id: slide.id,
      kind: "slide",
      index,
      position: { left: 0, top: 0, width: slide.size.width, height: slide.size.height },
      layout: { id: slide.layoutId, name: slide.layout },
      background: { fill: slide.background.fill },
    },
    elements: slide.objects.filter((object) => !object.fillSourceOnly).map((object, elementIndex) => {
      const element = inspectionElement(object, index, elementIndex);
      if (detail === "full" && object.textParagraphs) element.paragraphs = structuredClone(object.textParagraphs);
      return { ...element, scope: "slide", editable: true };
    }),
  };
  if (detail === "full") {
    const layout = presentation.layouts.getItem(slide.layout, false);
    if (layout) {
      record.inheritedLayers = [{
        id: layout.id,
        kind: "layout",
        name: layout.name,
        scope: "layout",
        editable: false,
        elements: [
          ...layout._objects.map((object, objectIndex) => ({
            ...inspectionElement({ ...object, id: `${layout.id}/master-${objectIndex}` }, index, objectIndex),
            scope: "layout",
            editable: false,
            order: objectIndex,
          })),
          ...layout.placeholders.items.map((placeholder, placeholderIndex) => ({
          id: `${layout.id}/ph-${placeholder.type}-${placeholder.index}`,
          kind: placeholder.geometry === "textbox" ? "textbox" : "shape",
          geometry: placeholder.geometry,
          placeholderType: placeholder.type,
          placeholderIndex: placeholder.index,
          name: placeholder.name ?? `${placeholder.type}-${placeholder.index}`,
          position: {
            left: placeholder.position.x ?? 0,
            top: placeholder.position.y ?? 0,
            width: placeholder.position.w ?? 0,
            height: placeholder.position.h ?? 0,
          },
          ...(placeholder.text ? { text: placeholder.text } : {}),
          scope: "layout",
          editable: false,
          order: layout._masterObjects.length + layout._objects.length + placeholderIndex,
        })),
        ],
      }];
      record.inheritedLayers.unshift({
        id: `${layout.id}/master`,
        kind: "master",
        name: `${layout.name} master`,
        scope: "master",
        editable: false,
        elements: layout._masterObjects.map((object, objectIndex) => ({
          ...inspectionElement({ ...object, id: `${layout.id}/master-${objectIndex}` }, index, objectIndex),
          scope: "master",
          editable: false,
          order: objectIndex,
        })),
      });
    }
  }
  return record;
}

function presetShapePath(shape) {
  const paths = {
    triangle: "M 50 0 L 100 100 L 0 100 Z",
    rtTriangle: "M 0 0 L 0 100 L 100 100 Z",
    diamond: "M 50 0 L 100 50 L 50 100 L 0 50 Z",
    parallelogram: "M 24 0 L 100 0 L 76 100 L 0 100 Z",
    trapezoid: "M 20 0 L 80 0 L 100 100 L 0 100 Z",
    pentagon: "M 50 0 L 100 38 L 81 100 L 19 100 L 0 38 Z",
    hexagon: "M 25 0 L 75 0 L 100 50 L 75 100 L 25 100 L 0 50 Z",
    chevron: "M 0 0 L 62 0 L 100 50 L 62 100 L 0 100 L 38 50 Z",
    rightArrow: "M 0 25 L 65 25 L 65 0 L 100 50 L 65 100 L 65 75 L 0 75 Z",
    leftArrow: "M 100 25 L 35 25 L 35 0 L 0 50 L 35 100 L 35 75 L 100 75 Z",
    upArrow: "M 25 100 L 25 35 L 0 35 L 50 0 L 100 35 L 75 35 L 75 100 Z",
    downArrow: "M 25 0 L 25 65 L 0 65 L 50 100 L 100 65 L 75 65 L 75 0 Z",
    star5: "M 50 0 L 62 35 L 100 38 L 71 61 L 81 100 L 50 78 L 19 100 L 29 61 L 0 38 L 38 35 Z",
  };
  return paths[shape];
}

function customPathSvg(paths, x, y, w, h) {
  return paths.map((path) => {
    const commands = path.commands.map((command) => {
      if (command.moveTo) return `M ${command.moveTo.x} ${command.moveTo.y}`;
      if (command.lineTo) return `L ${command.lineTo.x} ${command.lineTo.y}`;
      if (command.quadBezTo) return `Q ${command.quadBezTo.x1} ${command.quadBezTo.y1} ${command.quadBezTo.x} ${command.quadBezTo.y}`;
      if (command.cubicBezTo) return `C ${command.cubicBezTo.x1} ${command.cubicBezTo.y1} ${command.cubicBezTo.x2} ${command.cubicBezTo.y2} ${command.cubicBezTo.x} ${command.cubicBezTo.y}`;
      return "Z";
    }).join(" ");
    return `<path d="${commands}" transform="translate(${x} ${y}) scale(${w / path.width} ${h / path.height})"`;
  });
}

async function svgShapeFill(fill, presentation, id, slide, position, geometry) {
  if (fill?.type === "solid") {
    const base = renderedThemeColor(fill.color, presentation);
    if (!fill.pattern) return { value: base, defs: "" };
    const patternId = `pattern-${id.replaceAll(/[^\w-]/g, "")}`;
    const foreground = renderedThemeColor(fill.pattern.color ?? "#000000", presentation);
    const patternType = fill.pattern.type.toLowerCase();
    const size = ["smallgrid", "dotgrid", "percent5", "percent10", "percent20"].includes(patternType) ? 4 : 8;
    const patterns = {
      horizontal: `path d="M 0 4 H 8"`,
      lighthorizontal: `path d="M 0 4 H 8"`,
      darkhorizontal: `path d="M 0 2 H 8 M 0 5 H 8"`,
      vertical: `path d="M 4 0 V 8"`,
      lightvertical: `path d="M 4 0 V 8"`,
      darkvertical: `path d="M 2 0 V 8 M 5 0 V 8"`,
      cross: `path d="M 0 4 H 8 M 4 0 V 8"`,
      smallgrid: `path d="M 0 0 H 4 M 0 0 V 4"`,
      largegrid: `path d="M 0 0 H 8 M 0 0 V 8"`,
      dotgrid: `circle cx="1" cy="1" r="0.8"`,
      downwarddiagonal: `path d="M -2 2 L 2 -2 M 2 10 L 10 2"`,
      upwarddiagonal: `path d="M -2 6 L 2 10 M 2 -2 L 10 6"`,
      diagonalcross: `path d="M -2 2 L 2 -2 M 2 10 L 10 2 M -2 6 L 2 10 M 2 -2 L 10 6"`,
      narrowvertical: `path d="M 2 0 V 8 M 6 0 V 8"`,
      narrowhorizontal: `path d="M 0 2 H 8 M 0 6 H 8"`,
    };
    const mark = patterns[patternType] ?? patterns.diagonalcross;
    const element = mark.startsWith("circle")
      ? `<${mark} fill="${xmlEscape(foreground)}"/>`
      : `<${mark} stroke="${xmlEscape(foreground)}" stroke-width="1"/>`;
    const defs = `<defs><pattern id="${patternId}" width="${size}" height="${size}" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${xmlEscape(base)}"/>${element}</pattern></defs>`;
    return { value: `url(#${patternId})`, defs };
  }
  if (fill?.type === "image") {
    const image = slide.objects.find((object) => object.kind === "image" && object.id === fill.imageReference.id);
    if (!image || typeof image.src !== "string") throw new ArtifactToolError("invalid_fill_reference", `image fill reference not found on this slide: ${fill.imageReference.id}`);
    const rendered = await renderedImageSource(image.src, image.options);
    const bytes = await imageSourceBytes(rendered.src);
    const metadata = await sharp(bytes).metadata();
    const mime = metadata.format === "svg" ? "image/svg+xml" : `image/${metadata.format === "jpeg" ? "jpeg" : metadata.format}`;
    const data = `data:${mime};base64,${bytes.toString("base64")}`;
    const patternId = `image-fill-${id.replaceAll(/[^\w-]/g, "")}`;
    const opacity = fill.alphaModFix === undefined ? 1 : fill.alphaModFix / 100000;
    const defs = `<defs><pattern id="${patternId}" width="${position.w}" height="${position.h}" patternUnits="userSpaceOnUse"><image x="0" y="0" width="${position.w}" height="${position.h}" preserveAspectRatio="none" href="${xmlEscape(data)}" opacity="${opacity}"/></pattern></defs>`;
    return { value: `url(#${patternId})`, defs };
  }
  if (fill?.type !== "gradient") return { value: fill === "none" || fill === undefined ? "none" : renderedThemeColor(fill, presentation), defs: "" };
  const gradientId = `fill-${id.replaceAll(/[^\w-]/g, "")}`;
  const stops = fill.stops.map((stop) => {
    const resolved = resolveColorSpec(stop.color, presentation.theme);
    return `<stop offset="${stop.offset / 1000}%" stop-color="${xmlEscape(resolved.color)}"${resolved.opacity < 1 ? ` stop-opacity="${resolved.opacity}"` : ""}/>`;
  }).join("");
  const angle = ((fill.angleDeg ?? 0) % 360 + 360) % 360;
  let defs;
  if (fill.gradientKind === "path") {
    const rect = fill.fillRect ?? {};
    const left = (rect.l ?? 0) / 100000;
    const top = (rect.t ?? 0) / 100000;
    const right = (rect.r ?? 0) / 100000;
    const bottom = (rect.b ?? 0) / 100000;
    const width = Math.max(0.00001, 1 - left - right);
    const height = Math.max(0.00001, 1 - top - bottom);
    const cx = position.x + position.w * (left + width / 2);
    const cy = position.y + position.h * (top + height / 2);
    const radiusX = position.w * width / 2;
    const radiusY = position.h * height / 2;
    const circleRadius = Math.min(radiusX, radiusY);
    const circlePath = fill.pathType === "circle"
      || (fill.pathType === "shape" && ["ellipse", "circle"].includes(geometry));
    const scaleX = Number((circlePath ? circleRadius * 2 : radiusX * 2).toFixed(6));
    const scaleY = Number((circlePath ? circleRadius * 2 : radiusY * 2).toFixed(6));
    defs = `<radialGradient id="${gradientId}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="0.5" gradientTransform="translate(${cx} ${cy}) scale(${scaleX} ${scaleY})">${stops}</radialGradient>`;
  } else {
    defs = `<linearGradient id="${gradientId}" gradientTransform="rotate(${angle} .5 .5)">${stops}</linearGradient>`;
  }
  return { value: `url(#${gradientId})`, defs: `<defs>${defs}</defs>` };
}

function formatChartAxisValue(value, formatCode) {
  if (typeof formatCode !== "string" || !formatCode) return Number(value.toPrecision(4)).toString();
  const percent = formatCode.includes("%");
  const decimals = Math.min(6, (formatCode.match(/\.([0#]+)/)?.[1]?.length ?? 0));
  const formatted = new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(percent ? value * 100 : value);
  const currency = formatCode.match(/[$€£¥]/)?.[0] ?? "";
  return `${currency}${formatted}${percent ? "%" : ""}`;
}

async function svgForSlide(presentation, slide) {
  const slideLayout = presentation.layouts.getItem(slide.layout, false);
  const master = slideLayout && presentation.masters._items.find((item) => item.id === slideLayout.parentMasterId);
  if (master?.colorMap && Object.keys(master.colorMap).length > 0) {
    const colorScheme = presentation.theme.colorScheme;
    for (const [source, target] of Object.entries(master.colorMap)) colorScheme.themeColors[source] = structuredClone(colorScheme.themeColors[target]);
    presentation = { ...presentation, theme: new PresentationTheme({ defaultFont: presentation.theme.defaultFont, colorScheme }) };
  }
  const { width, height } = slide.size;
  const backgroundFill = slide.background.fill === "none" ? master?.background?.ref ?? "none" : slide.background.fill;
  const backgroundRender = await svgShapeFill(backgroundFill, presentation, `background-${slide.id}`, slide, { x: 0, y: 0, w: width, h: height });
  const background = backgroundRender.value;
  const nodes = backgroundRender.defs ? [backgroundRender.defs] : [];
  const slideObjects = presentation.view.placeholdersVisible ? slide.objects : slide.objects.filter((object) =>
    !object.options?.placeholderType || Boolean(object.text),
  );
  const layout = slideLayout;
  const inheritedObjects = [...(layout?._masterObjects ?? []), ...(layout?._objects ?? [])];
  const visibleObjects = [...inheritedObjects, ...slideObjects];
  if (presentation.view.gridlinesVisible) {
    const spacingX = Math.max(1, presentation.view.gridSpacingCxEmu / 9525);
    const spacingY = Math.max(1, presentation.view.gridSpacingCyEmu / 9525);
    nodes.push(`<defs><pattern id="ruxex-grid" width="${spacingX}" height="${spacingY}" patternUnits="userSpaceOnUse"><path d="M ${spacingX} 0 L 0 0 0 ${spacingY}" fill="none" stroke="#94A3B8" stroke-opacity="0.22" stroke-width="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#ruxex-grid)"/>`);
  }
  for (const object of visibleObjects) {
    const baseOptions = object.options ?? {};
    const options = object.kind === "shape" && baseOptions.connector
      ? { ...baseOptions, ...connectorPosition(slide, object) }
      : object.kind === "text" ? textOptions(baseOptions) : baseOptions;
    const x = Number(options.x ?? 0);
    const y = Number(options.y ?? 0);
    const w = Number(options.w ?? 0);
    const h = Number(options.h ?? 0);
    if (object.kind === "text") {
      const style = options.textStyle ?? options;
      const size = Number(style.fontSize ?? 24);
      const fill = style.color ?? "#000000";
      const lines = String(object.text ?? "").split("\n");
      nodes.push(`<text x="${x}" y="${y}" fill="${xmlEscape(renderedThemeColor(fill, presentation))}" font-size="${size}" font-family="${xmlEscape(style.fontFace ?? presentation.theme.defaultFont)}" font-weight="${style.bold ? "700" : "400"}" font-style="${style.italic ? "italic" : "normal"}" dominant-baseline="hanging">${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : size * 1.25}">${xmlEscape(line)}</tspan>`).join("")}</text>`);
    } else if (object.kind === "shape") {
      const shapeFill = await svgShapeFill(object.options.fill, presentation, object.id, slide, options, object.shape);
      const fill = shapeFill.value;
      if (shapeFill.defs) nodes.push(shapeFill.defs);
      const lineFill = await svgShapeFill(object.options.line?.fill ?? "none", presentation, `${object.id}-stroke`, slide, options, object.shape);
      const stroke = lineFill.value;
      if (lineFill.defs) nodes.push(lineFill.defs);
      const strokeWidth = Number(object.options.line?.width ?? 1);
      if (object.shape === "ellipse") nodes.push(`<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${xmlEscape(fill)}" stroke="${xmlEscape(stroke)}" stroke-width="${strokeWidth}"/>`);
      else if (object.shape === "line") {
        const route = baseOptions.connector ? connectorRoute(slide, object) : [];
        if (route.length === 4 && baseOptions.connector.kind === "curved") {
          nodes.push(`<path d="M ${route[0].x} ${route[0].y} C ${route[1].x} ${route[1].y}, ${route[2].x} ${route[2].y}, ${route[3].x} ${route[3].y}" fill="none" stroke="${xmlEscape(stroke === "none" ? "#000000" : stroke)}" stroke-width="${strokeWidth}"/>`);
        } else if (route.length > 2) {
          nodes.push(`<polyline points="${route.map((point) => `${point.x},${point.y}`).join(" ")}" fill="none" stroke="${xmlEscape(stroke === "none" ? "#000000" : stroke)}" stroke-width="${strokeWidth}"/>`);
        } else {
          nodes.push(`<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y + h}" stroke="${xmlEscape(stroke === "none" ? "#000000" : stroke)}" stroke-width="${strokeWidth}"/>`);
        }
      }
      else if (object.shape === "custom" && options.customPaths) {
        for (const path of customPathSvg(options.customPaths, x, y, w, h)) nodes.push(`${path} fill="${xmlEscape(fill)}" stroke="${xmlEscape(stroke)}" stroke-width="${strokeWidth}"/>`);
      }
      else if (presetShapePath(object.shape)) nodes.push(`<path d="${presetShapePath(object.shape)}" transform="translate(${x} ${y}) scale(${w / 100} ${h / 100})" fill="${xmlEscape(fill)}" stroke="${xmlEscape(stroke)}" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke"/>`);
      else {
        const radius = object.options.borderRadius === undefined
          ? (object.shape === "roundRect" ? Math.min(12, h / 8) : 0)
          : resolveImageBorderRadius(object.options.borderRadius, Math.min(w, h));
        nodes.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${xmlEscape(fill)}" stroke="${xmlEscape(stroke)}" stroke-width="${strokeWidth}"/>`);
      }
      if (object.text !== undefined) {
        const style = options.textStyle ?? options;
        nodes.push(`<text x="${x + 8}" y="${y + 8}" fill="${xmlEscape(renderedThemeColor(style.color ?? "#000000", presentation))}" font-size="${Number(style.fontSize ?? 24)}" font-family="${xmlEscape(style.fontFace ?? presentation.theme.defaultFont)}" dominant-baseline="hanging">${xmlEscape(object.text)}</text>`);
      }
    } else if (object.kind === "image") {
      if (typeof object.src !== "string" || object.src.length === 0) throw new ArtifactToolError("image_generation_pending", "regenerate the prompt-based image before rendering the presentation");
      const imageSource = await renderedImageSource(object.src, options);
      const bytes = await imageSourceBytes(imageSource.src);
      const metadata = await sharp(bytes).metadata();
      const mime = metadata.format === "svg" ? "image/svg+xml" : `image/${metadata.format === "jpeg" ? "jpeg" : metadata.format}`;
      const data = `data:${mime};base64,${bytes.toString("base64")}`;
      const placement = await imagePlacement(object.src, options);
      const mask = object.options.geometry ?? "rect";
      const clipId = `clip-${object.id.replaceAll(/[^\w-]/g, "")}`;
      const radius = resolveImageBorderRadius(object.options.borderRadius, Math.min(placement.w, placement.h));
      const clipShape = mask === "ellipse"
        ? `<ellipse cx="${placement.x + placement.w / 2}" cy="${placement.y + placement.h / 2}" rx="${placement.w / 2}" ry="${placement.h / 2}"/>`
        : `<rect x="${placement.x}" y="${placement.y}" width="${placement.w}" height="${placement.h}" rx="${mask === "roundRect" ? radius : 0}"/>`;
      if (mask !== "rect" || radius > 0) nodes.push(`<defs><clipPath id="${clipId}">${clipShape}</clipPath></defs>`);
      nodes.push(`<image x="${placement.x}" y="${placement.y}" width="${placement.w}" height="${placement.h}" preserveAspectRatio="none" href="${xmlEscape(data)}"${mask !== "rect" || radius > 0 ? ` clip-path="url(#${clipId})"` : ""}/>`);
    } else if (object.kind === "table") {
      const rows = object.rows;
      const columnCount = Math.max(1, rows[0]?.length ?? 1);
      const columnWidths = object.options.columnWidths?.length === columnCount
        ? object.options.columnWidths
        : Array(columnCount).fill(w / columnCount);
      const rowHeights = object.options.rowHeights?.length === rows.length
        ? object.options.rowHeights
        : Array(rows.length).fill(h / Math.max(1, rows.length));
      const covered = new Set();
      rows.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
        const key = `${rowIndex}:${columnIndex}`;
        if (covered.has(key)) return;
        const left = x + columnWidths.slice(0, columnIndex).reduce((sum, width) => sum + width, 0);
        const top = y + rowHeights.slice(0, rowIndex).reduce((sum, height) => sum + height, 0);
        const cell = object.cellOptions?.[rowIndex]?.[columnIndex] ?? {};
        const colSpan = Math.max(1, cell.colspan ?? 1);
        const rowSpan = Math.max(1, cell.rowspan ?? 1);
        for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
          for (let columnOffset = 0; columnOffset < colSpan; columnOffset += 1) {
            if (rowOffset || columnOffset) covered.add(`${rowIndex + rowOffset}:${columnIndex + columnOffset}`);
          }
        }
        const textStyle = cell.textStyle ?? {};
        const cellFill = renderedThemeColor(cell.fill ?? tableStyleFill(object, rowIndex, columnIndex) ?? (rowIndex === 0 ? "#E8EEF7" : "#FFFFFF"), presentation);
        const cellW = columnWidths.slice(columnIndex, columnIndex + colSpan).reduce((sum, width) => sum + width, 0);
        const cellH = rowHeights.slice(rowIndex, rowIndex + rowSpan).reduce((sum, height) => sum + height, 0);
        nodes.push(`<rect x="${left}" y="${top}" width="${cellW}" height="${cellH}" fill="${xmlEscape(cellFill)}" stroke="#CBD5E1"/>`);
        const borderSides = { left: [left, top, left, top + cellH], top: [left, top, left + cellW, top], right: [left + cellW, top, left + cellW, top + cellH], bottom: [left, top + cellH, left + cellW, top + cellH] };
        for (const [side, [x1, y1, x2, y2]] of Object.entries(borderSides)) {
          const border = cell.borders?.[side];
          if (!border) continue;
          const config = typeof border === "string" ? { fill: border } : border;
          const color = renderedThemeColor(config.fill ?? "#CBD5E1", presentation);
          nodes.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${xmlEscape(color)}" stroke-width="${Number(config.width ?? 1)}"/>`);
        }
        const margin = cell.margins ?? object.options.margins ?? {};
        const leftMargin = typeof margin === "number" ? margin : margin.left ?? 8;
        const topMargin = typeof margin === "number" ? margin : margin.top ?? 6;
        const textY = cell.anchor === "middle" ? top + cellH / 2 : cell.anchor === "bottom" ? top + cellH - topMargin : top + topMargin;
        const baseline = cell.anchor === "middle" ? "central" : cell.anchor === "bottom" ? "auto" : "hanging";
        nodes.push(`<text x="${left + leftMargin}" y="${textY}" font-size="${Number(textStyle.fontSize ?? 16)}" font-family="${xmlEscape(textStyle.fontFace ?? presentation.theme.defaultFont)}" font-weight="${textStyle.bold ? "700" : "400"}" fill="${xmlEscape(renderedThemeColor(textStyle.color ?? "#172033", presentation))}" dominant-baseline="${baseline}">${xmlEscape(value)}</text>`);
      }));
    } else if (object.kind === "chart") {
      const palette = ["#3B82F6", "#F97316", "#10B981", "#8B5CF6", "#EF4444", "#14B8A6"];
      if (object.type === "line") {
        const values = object.series.flatMap((series) => series.values);
        const min = Math.min(0, ...values);
        const max = Math.max(1, ...values);
        const plotHeight = h * 0.86;
        const plotTop = y + h * 0.05;
        object.series.forEach((series, seriesIndex) => {
          const points = series.values.map((value, index) => {
            const pointX = x + (series.values.length === 1 ? w / 2 : index * w / (series.values.length - 1));
            const pointY = plotTop + (max - value) / (max - min || 1) * plotHeight;
            return [pointX, pointY];
          });
          const color = palette[seriesIndex % palette.length];
          nodes.push(`<polyline points="${points.map(([pointX, pointY]) => `${pointX},${pointY}`).join(" ")}" fill="none" stroke="${color}" stroke-width="3"/>`);
          for (const [pointIndex, [pointX, pointY]] of points.entries()) {
            nodes.push(`<circle cx="${pointX}" cy="${pointY}" r="4" fill="${color}"/>`);
            const pointOverride = series.dataLabelOverrides?.find((item) => item.idx === pointIndex) ?? {};
            const labels = { ...(object.options.dataLabels ?? {}), ...(series.dataLabels ?? {}), ...pointOverride };
            if (labels.showValue || labels.showCategoryName || labels.showSeriesName) {
              const parts = [];
              if (labels.showSeriesName && series.name) parts.push(series.name);
              if (labels.showCategoryName) parts.push(series.labels?.[pointIndex] ?? object.options.categories?.[pointIndex] ?? "");
              if (labels.showValue) parts.push(String(series.values[pointIndex]));
              nodes.push(`<text x="${pointX}" y="${pointY - 7}" text-anchor="middle" font-size="12" fill="#334155">${xmlEscape(pointOverride.text ?? parts.filter(Boolean).join(pointOverride.separator ?? " "))}</text>`);
            }
          }
        });
      } else if (object.type === "pie") {
        const values = object.series[0]?.values.map((value) => Math.max(0, value)) ?? [];
        const total = values.reduce((sum, value) => sum + value, 0);
        const radius = Math.max(0, Math.min(w, h) / 2 - 2);
        const centerX = x + w / 2;
        const centerY = y + h / 2;
        if (total > 0 && values.length === 1) {
          nodes.push(`<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="${palette[0]}"/>`);
        } else if (total > 0) {
          let startAngle = -Math.PI / 2;
          values.forEach((value, index) => {
            if (value === 0) return;
            const endAngle = startAngle + value / total * Math.PI * 2;
            const startX = centerX + radius * Math.cos(startAngle);
            const startY = centerY + radius * Math.sin(startAngle);
            const endX = centerX + radius * Math.cos(endAngle);
            const endY = centerY + radius * Math.sin(endAngle);
            const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
            nodes.push(`<path d="M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z" fill="${palette[index % palette.length]}"/>`);
            startAngle = endAngle;
          });
        }
      } else {
        const values = object.series.flatMap((series) => series.values);
        const maximum = Math.max(1, ...values);
        const categoryCount = Math.max(1, ...object.series.map((series) => series.values.length));
        const categoryWidth = w / categoryCount;
        const barWidth = categoryWidth * 0.72 / Math.max(1, object.series.length);
        object.series.forEach((series, seriesIndex) => series.values.forEach((value, categoryIndex) => {
          const barHeight = h * 0.78 * Math.max(0, value) / maximum;
          const barX = x + categoryIndex * categoryWidth + categoryWidth * 0.14 + seriesIndex * barWidth;
          const barY = y + h - barHeight;
          const color = series.fill ?? palette[seriesIndex % palette.length];
          nodes.push(`<rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" fill="${xmlEscape(renderedThemeColor(color, presentation))}"/>`);
          const pointOverride = series.dataLabelOverrides?.find((item) => item.idx === categoryIndex) ?? {};
          const labels = { ...(object.options.dataLabels ?? {}), ...(series.dataLabels ?? {}), ...pointOverride };
          if (labels.showValue || labels.showCategoryName || labels.showSeriesName) {
            const parts = [];
            if (labels.showSeriesName && series.name) parts.push(series.name);
            if (labels.showCategoryName) parts.push(series.labels?.[categoryIndex] ?? object.options.categories?.[categoryIndex] ?? "");
            if (labels.showValue) parts.push(String(value));
            nodes.push(`<text x="${barX + barWidth / 2}" y="${Math.max(y, barY - 4)}" text-anchor="middle" font-size="12" fill="#334155" dominant-baseline="auto">${xmlEscape(pointOverride.text ?? parts.filter(Boolean).join(pointOverride.separator ?? " "))}</text>`);
          }
        }));
      }
      const chartOptions = object.options ?? {};
      const titleStyle = chartOptions.titleTextStyle ?? {};
      if (chartOptions.title) nodes.push(`<text x="${x + w / 2}" y="${y + Number(titleStyle.fontSize ?? 18)}" text-anchor="middle" font-size="${Number(titleStyle.fontSize ?? 18)}" font-weight="${titleStyle.bold === false ? "400" : "700"}" fill="${xmlEscape(renderedThemeColor(titleStyle.fill ?? "#172033", presentation))}">${xmlEscape(chartOptions.title)}</text>`);
      const cartesian = !["pie", "doughnut", "ofPie", "pie3D"].includes(object.type);
      const categories = chartOptions.categories ?? object.series[0]?.labels ?? [];
      if (cartesian && categories.length > 0) {
        const values = object.series.flatMap((series) => series.values.filter((value) => Number.isFinite(value)));
        const min = Number.isFinite(chartOptions.yAxis?.min) ? chartOptions.yAxis.min : Math.min(0, ...values);
        const max = Number.isFinite(chartOptions.yAxis?.max) ? chartOptions.yAxis.max : Math.max(1, ...values);
        const range = max - min || 1;
        const axisStartY = y + h * 0.9;
        const axisEndY = y + h * 0.16;
        const tickCount = Number.isFinite(chartOptions.yAxis?.majorUnit) && chartOptions.yAxis.majorUnit > 0
          ? Math.min(8, Math.max(1, Math.floor(range / chartOptions.yAxis.majorUnit)))
          : 4;
        const grid = chartOptions.yAxis?.majorGridlines;
        const gridColor = grid ? renderedThemeColor(grid.fill ?? grid.color ?? "#CBD5E1", presentation) : "#E2E8F0";
        const gridWidth = Number(grid?.width ?? grid?.weight ?? 1);
        if (chartOptions.yAxis?.visible !== false) {
          for (let tick = 0; tick <= tickCount; tick += 1) {
            const value = min + range * tick / tickCount;
            const tickY = axisStartY - (axisStartY - axisEndY) * tick / tickCount;
            if (grid !== null) nodes.push(`<line x1="${x + w * 0.1}" y1="${tickY}" x2="${x + w * 0.98}" y2="${tickY}" stroke="${xmlEscape(gridColor)}" stroke-width="${gridWidth}"/>`);
            nodes.push(`<text x="${x + w * 0.08}" y="${tickY}" text-anchor="end" dominant-baseline="central" font-size="11" fill="#64748B">${xmlEscape(formatChartAxisValue(value, chartOptions.yAxis?.numberFormatCode))}</text>`);
          }
        }
        categories.forEach((category, index) => {
          const categoryX = x + w * 0.1 + (index + 0.5) * w * 0.88 / categories.length;
          nodes.push(`<text x="${categoryX}" y="${y + h * 0.94}" text-anchor="middle" font-size="11" fill="#64748B">${xmlEscape(category)}</text>`);
        });
        const xTitle = typeof chartOptions.xAxis?.title === "string" ? chartOptions.xAxis.title : chartOptions.xAxis?.title?.text;
        const yTitle = typeof chartOptions.yAxis?.title === "string" ? chartOptions.yAxis.title : chartOptions.yAxis?.title?.text;
        if (xTitle) nodes.push(`<text x="${x + w / 2}" y="${y + h - 1}" text-anchor="middle" font-size="12" fill="#475569">${xmlEscape(xTitle)}</text>`);
        if (yTitle) nodes.push(`<text x="${x + 10}" y="${y + h / 2}" text-anchor="middle" font-size="12" fill="#475569" transform="rotate(-90 ${x + 10} ${y + h / 2})">${xmlEscape(yTitle)}</text>`);
      }
      const showLegend = chartOptions.hasLegend !== false && (chartOptions.legend !== undefined || chartOptions.hasLegend === true);
      if (showLegend) {
        const legend = chartOptions.legend ?? {};
        const position = legend.position ?? "bottom";
        const right = position === "right" || position === "left";
        const startX = right ? x + w - 88 : x + 12;
        const startY = right ? y + 24 : position === "top" ? y + 14 : y + h - 13;
        object.series.forEach((series, index) => {
          const lx = right ? startX : startX + index * Math.max(80, w / object.series.length);
          const ly = startY + (right ? index * 20 : 0);
          const color = series.fill ?? palette[index % palette.length];
          nodes.push(`<rect x="${lx}" y="${ly - 8}" width="10" height="10" fill="${xmlEscape(renderedThemeColor(color, presentation))}"/><text x="${lx + 14}" y="${ly}" font-size="11" fill="#475569">${xmlEscape(series.name)}</text>`);
        });
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${xmlEscape(background)}"/>${nodes.join("")}</svg>`;
}

function svgBlob(svg) {
  return new Blob([svg], { type: "image/svg+xml" });
}

async function renderBlob(svg, format) {
  if (format === "svg") return svgBlob(svg);
  const output = format === "jpg" ? "jpeg" : format;
  if (!["png", "jpeg", "webp"].includes(output)) {
    throw new ArtifactToolError("unsupported_render_format", `unsupported presentation render format: ${format}`);
  }
  const bytes = await sharp(Buffer.from(svg)).toFormat(output).toBuffer();
  const mime = output === "jpeg" ? "image/jpeg" : `image/${output}`;
  return new Blob([bytes], { type: mime });
}

function resizeSvg(svg, options = {}) {
  const root = /<svg\b([^>]*)>/.exec(svg);
  if (!root) return svg;
  const widthMatch = /\bwidth="([\d.]+)"/.exec(root[1]);
  const heightMatch = /\bheight="([\d.]+)"/.exec(root[1]);
  const scale = options.scale ?? 1;
  const width = options.width ?? (Number(widthMatch?.[1] ?? 0) * scale);
  const height = options.height ?? (Number(heightMatch?.[1] ?? 0) * scale);
  if (![width, height].every((value) => Number.isFinite(value) && value > 0)) {
    throw new ArtifactToolError("invalid_render_options", "render width, height, and scale must be positive finite values");
  }
  const tag = `<svg${root[1].replace(/\bwidth="[\d.]+"/, `width="${width}"`).replace(/\bheight="[\d.]+"/, `height="${height}"`)}>`;
  return svg.replace(root[0], tag);
}

function splitExpression(expression, operator) {
  let depth = 0;
  let quote = "";
  for (let index = 0; index <= expression.length - operator.length; index += 1) {
    const character = expression[index];
    if (quote) {
      if (character === quote && expression[index - 1] !== "\\") quote = "";
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (character === "(" || character === "[") depth += 1;
    else if (character === ")" || character === "]") depth -= 1;
    else if (depth === 0 && expression.slice(index, index + operator.length) === operator) {
      return [expression.slice(0, index).trim(), expression.slice(index + operator.length).trim()];
    }
  }
  return undefined;
}

function jsonPathValue(node, expression) {
  const path = expression.trim().replace(/^@/, "$");
  if (path === "@" || path === "$" || path === "$." || path === "@.") return node;
  try {
    const result = JSONPath({ path, json: node, resultType: "value", wrap: false, eval: "safe" });
    return result;
  } catch {
    return path.replace(/^\$\.?/, "").split(".").filter(Boolean).reduce((value, key) => {
      if (Array.isArray(value) && /^\d+$/.test(key)) return value[Number(key)];
      return value?.[key];
    }, node);
  }
}

function jsonPathLiteral(value, node) {
  const expression = value.trim();
  if ((expression.startsWith("'") && expression.endsWith("'")) ||
      (expression.startsWith('"') && expression.endsWith('"'))) return expression.slice(1, -1);
  if (expression === "true") return true;
  if (expression === "false") return false;
  if (expression === "null") return null;
  if (/^-?\d+(?:\.\d+)?$/.test(expression)) return Number(expression);
  const fn = /^(search|match|length|count|value)\((.*)\)$/.exec(expression);
  if (fn) {
    const splitArgs = splitExpression(fn[2], ",");
    const args = splitArgs ? [splitArgs[0], splitArgs[1]] : [fn[2].trim()];
    const selected = jsonPathValue(node, args[0]);
    if (fn[1] === "length") return typeof selected === "string" ? [...selected].length : Array.isArray(selected) ? selected.length : 0;
    if (fn[1] === "count") return Array.isArray(selected) ? selected.length : selected === undefined ? 0 : 1;
    if (fn[1] === "value") return Array.isArray(selected) && selected.length === 1 ? selected[0] : selected;
    if (typeof selected !== "string") return false;
    try {
      const regex = new RegExp(String(args[1] ?? "").replace(/^(['"])(.*)\1$/, "$2"), "u");
      return fn[1] === "search" ? regex.test(selected) : new RegExp(`^(?:${regex.source})$`, "u").test(selected);
    } catch {
      throw new ArtifactToolError("invalid_inspect_query", "invalid I-Regexp pattern in JSONPath filter");
    }
  }
  if (expression.startsWith("@.")) return jsonPathValue(node, expression);
  return undefined;
}

function evaluateJsonPathFilter(node, expression) {
  let value = expression.trim();
  while (value.startsWith("(") && value.endsWith(")")) value = value.slice(1, -1).trim();
  const or = splitExpression(value, "||");
  if (or) return evaluateJsonPathFilter(node, or[0]) || evaluateJsonPathFilter(node, or[1]);
  const and = splitExpression(value, "&&");
  if (and) return evaluateJsonPathFilter(node, and[0]) && evaluateJsonPathFilter(node, and[1]);
  if (value.startsWith("!")) return !evaluateJsonPathFilter(node, value.slice(1));
  const comparison = /^(.*?)\s*(==|!=|<=|>=|<|>)\s*(.*?)$/.exec(value);
  if (comparison) {
    const left = jsonPathLiteral(comparison[1], node);
    const right = jsonPathLiteral(comparison[3], node);
    switch (comparison[2]) {
      case "==": return left === right;
      case "!=": return left !== right;
      case "<": return left < right;
      case ">": return left > right;
      case "<=": return left <= right;
      case ">=": return left >= right;
      default: return false;
    }
  }
  const operand = jsonPathLiteral(value, node);
  return Boolean(operand);
}

function matchingBracket(select, start) {
  let depth = 0;
  let quote = "";
  for (let index = start; index < select.length; index += 1) {
    const character = select[index];
    if (quote) {
      if (character === quote && select[index - 1] !== "\\") quote = "";
    } else if (character === "'" || character === '"') quote = character;
    else if (character === "[") depth += 1;
    else if (character === "]" && --depth === 0) return index;
  }
  return -1;
}

function descendants(node) {
  const found = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) { found.push(item); visit(item); }
    } else if (value && typeof value === "object") {
      for (const item of Object.values(value)) { found.push(item); visit(item); }
    }
  };
  visit(node);
  return found;
}

function selectInspectionRecordsLocal(tree, select) {
  if (typeof select !== "string" || !select.startsWith("$")) {
    throw new ArtifactToolError("invalid_inspect_query", "select must be a JSONPath expression rooted at $");
  }
  let cursor = 1;
  let nodes = [tree];
  while (cursor < select.length) {
    if (select.startsWith("..", cursor)) {
      cursor += 2;
      const start = cursor;
      while (cursor < select.length && /[\w$*]/.test(select[cursor])) cursor += 1;
      const key = select.slice(start, cursor);
      nodes = nodes.flatMap((node) => descendants(node).flatMap((child) =>
        key === "*" ? (Array.isArray(child) ? child : child && typeof child === "object" ? Object.values(child) : []) :
          child && typeof child === "object" && child[key] !== undefined ? [child[key]] : []));
      continue;
    }
    if (select[cursor] === ".") {
      cursor += 1;
      const start = cursor;
      while (cursor < select.length && /[\w$-]/.test(select[cursor])) cursor += 1;
      const key = select.slice(start, cursor);
      if (!key) throw new ArtifactToolError("invalid_inspect_query", `invalid JSONPath at character ${cursor}`);
      nodes = nodes.flatMap((node) => key === "*"
        ? Array.isArray(node) ? [...node] : node && typeof node === "object" ? Object.values(node) : []
        : node?.[key] === undefined ? [] : [node[key]]);
      continue;
    }
    if (select[cursor] === "[") {
      const end = matchingBracket(select, cursor);
      if (end < 0) throw new ArtifactToolError("invalid_inspect_query", `unterminated JSONPath selector at character ${cursor}`);
      const selector = select.slice(cursor + 1, end).trim();
      if (selector === "*") nodes = nodes.flatMap((node) => Array.isArray(node) ? [...node] : node && typeof node === "object" ? Object.values(node) : []);
      else if (selector.startsWith("?(") && selector.endsWith(")")) {
        const predicate = selector.slice(2, -1);
        nodes = nodes.flatMap((node) => {
          const candidates = Array.isArray(node) ? node : node && typeof node === "object" ? Object.values(node) : [];
          return candidates.filter((candidate) => evaluateJsonPathFilter(candidate, predicate));
        });
      } else if (/^-?\d+$/.test(selector)) {
        const index = Number(selector);
        nodes = nodes.flatMap((node) => {
          if (!Array.isArray(node)) return [];
          const value = node[index < 0 ? node.length + index : index];
          return value === undefined ? [] : [value];
        });
      } else if (/^-?\d*(?::-?\d*){1,2}$/.test(selector)) {
        const [rawStart = "", rawEnd = "", rawStep = "1"] = selector.split(":");
        const step = Number(rawStep || 1);
        if (step === 0) throw new ArtifactToolError("invalid_inspect_query", "JSONPath slice step cannot be zero");
        nodes = nodes.flatMap((node) => {
          if (!Array.isArray(node)) return [];
          let start = rawStart ? Number(rawStart) : step > 0 ? 0 : node.length - 1;
          let end = rawEnd ? Number(rawEnd) : step > 0 ? node.length : -1;
          if (start < 0) start += node.length;
          if (end < 0 && rawEnd) end += node.length;
          const slice = [];
          for (let index = start; step > 0 ? index < end : index > end; index += step) if (node[index] !== undefined) slice.push(node[index]);
          return slice;
        });
      } else if (/^(?:'[^']*'|"[^"]*")(?:\s*,\s*(?:'[^']*'|"[^"]*"))+$/.test(selector)) {
        const keys = [...selector.matchAll(/'([^']*)'|"([^"]*)"/g)].map((match) => match[1] ?? match[2]);
        nodes = nodes.flatMap((node) => keys.flatMap((key) => node?.[key] === undefined ? [] : [node[key]]));
      } else if ((selector.startsWith("'") && selector.endsWith("'")) || (selector.startsWith('"') && selector.endsWith('"'))) {
        const key = selector.slice(1, -1);
        nodes = nodes.flatMap((node) => node?.[key] === undefined ? [] : [node[key]]);
      } else if (selector.includes(",")) {
        if (!/^-?\d+(?:\s*,\s*-?\d+)*$/.test(selector)) {
          throw new ArtifactToolError("invalid_inspect_query", `invalid array index union at character ${cursor}`);
        }
        const indexes = selector.split(",").map((item) => Number(item.trim()));
        nodes = nodes.flatMap((node) => Array.isArray(node) ? indexes.map((index) => node[index < 0 ? node.length + index : index]).filter((item) => item !== undefined) : []);
      } else {
        throw new ArtifactToolError("invalid_inspect_query", `unsupported JSONPath selector at character ${cursor}`);
      }
      cursor = end + 1;
      continue;
    }
    throw new ArtifactToolError("invalid_inspect_query", `invalid JSONPath at character ${cursor}`);
  }
  return nodes;
}

function selectInspectionRecords(tree, select) {
  if (typeof select !== "string" || !select.startsWith("$")) {
    throw new ArtifactToolError("invalid_inspect_query", "select must be a JSONPath expression rooted at $");
  }
  let quote = "";
  const delimiters = [];
  for (let index = 0; index < select.length; index += 1) {
    const character = select[index];
    if (quote) {
      if (character === quote && select[index - 1] !== "\\") quote = "";
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (character === "[" || character === "(") delimiters.push(character);
    else if (character === "]" || character === ")") {
      const expected = character === "]" ? "[" : "(";
      if (delimiters.pop() !== expected) throw new ArtifactToolError("invalid_inspect_query", `unmatched ${character} in JSONPath`);
    }
  }
  if (quote || delimiters.length) throw new ArtifactToolError("invalid_inspect_query", "unterminated quote or selector in JSONPath");
  try {
    if (/\b(?:search|match|length|count|value)\s*\(/.test(select) || /\[["'][^\]]*,\s*["']/.test(select)) {
      return selectInspectionRecordsLocal(tree, select);
    }
    return JSONPath({ path: select, json: tree, resultType: "value", wrap: true, eval: "safe" });
  } catch (error) {
    throw new ArtifactToolError(
      "invalid_inspect_query",
      `JSONPath query is invalid or unsupported: ${error.message}`,
    );
  }
}

function projectInspectionRecord(record, include) {
  if (!include) return record;
  const result = {};
  for (const fieldPath of include) {
    if (typeof fieldPath !== "string" || fieldPath.length === 0) {
      throw new ArtifactToolError("invalid_inspect_field", "inspection fields must be non-empty strings");
    }
    const parts = fieldPath.split(".");
    const first = parts[0];
    if (record[first] === undefined) continue;
    if (parts.length === 1) {
      result[first] = record[first];
      continue;
    }
    if (Array.isArray(record[first])) {
      const nested = parts.slice(1).join(".");
      const projected = record[first]
        .map((item) => projectInspectionRecord(item, [nested]));
      if (Array.isArray(result[first])) {
        result[first] = result[first].map((item, index) => ({
          ...item,
          ...(projected[index] ?? {}),
        }));
      } else {
        result[first] = projected;
      }
      continue;
    }
    const value = parts.slice(1).reduce((current, key) => current?.[key], record[first]);
    if (value !== undefined) result[first] = { ...(result[first] ?? {}), [parts.at(-1)]: value };
  }
  return result;
}

async function queryInspection(presentation, options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new ArtifactToolError("invalid_inspect_query", "inspection options must be an object");
  }
  const { select, include, fileName, kind, search, maxChars, target } = options;
  if (select !== undefined && (typeof select !== "string" || select.length === 0)) {
    throw new ArtifactToolError("invalid_inspect_query", "inspection select must be a non-empty string");
  }
  if (select === undefined && [kind, search, maxChars].every((value) => value === undefined)) {
    throw new ArtifactToolError("invalid_inspect_query", "inspection requires select or a kind, search, or maxChars option");
  }
  if (kind !== undefined && (typeof kind !== "string" || kind.trim() === "")) {
    throw new ArtifactToolError("invalid_inspect_kind", "inspection kind must be a comma-separated string");
  }
  if (search !== undefined && (typeof search !== "string" || search.length === 0)) {
    throw new ArtifactToolError("invalid_inspect_search", "inspection search must be a non-empty string");
  }
  if (maxChars !== undefined && (!Number.isSafeInteger(maxChars) || maxChars < 1)) {
    throw new ArtifactToolError("invalid_inspect_limit", "inspection maxChars must be a positive integer");
  }
  if (include !== undefined && (!Array.isArray(include) || include.some((field) => typeof field !== "string"))) {
    throw new ArtifactToolError("invalid_inspect_field", "inspection include must be an array of field paths");
  }
  const beforeLines = target?.beforeLines ?? 0;
  const afterLines = target?.afterLines ?? 0;
  if (target !== undefined && (!target || typeof target !== "object" || Array.isArray(target)
    || !Number.isSafeInteger(beforeLines) || beforeLines < 0
    || !Number.isSafeInteger(afterLines) || afterLines < 0)) {
    throw new ArtifactToolError("invalid_inspect_target", "inspection target context line counts must be non-negative integers");
  }
  const tree = inspectionTree(presentation);
  const kinds = kind === undefined ? undefined : new Set(kind.split(",").map((value) => value.trim()).filter(Boolean)
    .map((value) => value === "text" ? "textbox" : value));
  const candidates = select === undefined
    ? [
      ...(!kinds || kinds.has("thread") ? tree.comments : []),
      ...tree.slides.flatMap((slide) => [
      ...(!kinds || kinds.has("slide") ? [slide] : []),
      ...(!kinds || kinds.has("layout") ? [{ id: slide.layout.id, kind: "layout", name: slide.layout.name, slideId: slide.id }] : []),
      ...(!kinds || kinds.has("notes") ? [slide.notes] : []),
      ...slide.elements,
      ]),
    ]
    : selectInspectionRecords(tree, select);
  const records = candidates
    .filter((record) => target === undefined || (record?.kind === "thread" && (!target?.id || record.id === target.id || record.target?.slideId === target.id || record.target?.elementId === target.id)))
    .filter((record) => !kinds || kinds.has(record?.kind))
    .filter((record) => search === undefined || JSON.stringify(record).toLowerCase().includes(search.toLowerCase()))
    .map((record) => {
      if (record?.kind !== "thread" || (beforeLines === 0 && afterLines === 0) || !record.target?.elementId) return record;
      const slide = presentation.slides.items.find((item) => item.id === record.target.slideId);
      const element = slide?.objects.find((item) => item.id === record.target.elementId);
      if (typeof element?.text !== "string") return record;
      const lines = element.text.split("\n");
      const startOffset = Math.max(0, record.target.start ?? 0);
      const endOffset = Math.max(startOffset, record.target.end ?? startOffset);
      let cursor = 0;
      let firstLine = 0;
      let lastLine = 0;
      for (let index = 0; index < lines.length; index += 1) {
        const lineEnd = cursor + lines[index].length;
        if (cursor <= startOffset && startOffset <= lineEnd && firstLine === 0) firstLine = index;
        if (cursor <= endOffset && endOffset <= lineEnd) { lastLine = index; break; }
        cursor = lineEnd + 1;
      }
      const contextStart = Math.max(0, firstLine - beforeLines);
      const contextEnd = Math.min(lines.length, lastLine + afterLines + 1);
      return { ...record, context: { before: lines.slice(contextStart, firstLine), match: lines.slice(firstLine, lastLine + 1), after: lines.slice(lastLine + 1, contextEnd) } };
    })
    .map((record) => record && typeof record === "object"
      ? projectInspectionRecord(record, include)
      : record);
  let ndjson = records.map((record) => JSON.stringify(record)).join("\n");
  const truncated = maxChars !== undefined && ndjson.length > maxChars;
  if (truncated) ndjson = `${ndjson.slice(0, Math.max(0, maxChars - 1))}…`;
  const result = { records, recordCount: records.length, ndjson, ...(truncated ? { truncated: true } : {}) };
  if (presentation.sourcePath) {
    result.sourcePath = presentation.sourcePath;
    result.diagnostics = [...presentation.lossDiagnostics];
    result.editable = presentation.lossDiagnostics.length === 0;
  }
  if (fileName !== undefined) {
    if (typeof fileName !== "string" || fileName.trim() === "") {
      throw new ArtifactToolError("invalid_inspect_path", "inspection fileName must be a non-empty path");
    }
    const path = resolve(fileName);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, ndjson.length > 0 ? `${ndjson}\n` : "", "utf8");
    result.path = path;
    result.status = "saved";
  }
  return result;
}

const presentationHelpIndex = [
  {
    name: "Presentation.create",
    category: "presentation",
    summary: "Create an editable local PowerPoint presentation model.",
    examples: [{ summary: "Create a deck", code: 'const presentation = Presentation.create({ title: "Review" });' }],
    notes: "The local exporter writes PPTX files through PptxGenJS.",
  },
  {
    name: "presentation.inspect",
    category: "presentation",
    summary: "Inspect source-model content and geometry with selectors or kind/search filters.",
    examples: [{ summary: "Select slide elements", code: 'await presentation.inspect({ select: "$.slides[*].elements[*]", include: ["id", "kind", "text"] });' }],
    notes: "Inspection does not measure rendered text overflow.",
  },
  {
    name: "presentation.resolve",
    category: "presentation",
    summary: "Resolve stable presentation, slide, or element IDs to editable facades.",
    examples: [{ summary: "Resolve an element", code: "const shape = presentation.resolve(elementId);" }],
    notes: "IDs remain stable for the lifetime of the in-memory model.",
  },
  {
    name: "presentation.render",
    category: "presentation",
    summary: "Render supported local slide elements to PNG, SVG, JPEG, or WebP with layout JSON metadata.",
    examples: [{ summary: "Preview one slide", code: "const preview = await presentation.render({ slide: 0 });" }],
    notes: "Unsupported imported PowerPoint objects are not reproduced in this preview.",
  },
  {
    name: "presentation.export",
    category: "presentation",
    summary: "Export an editable PPTX, raster or vector preview, PDF, or local layout JSON.",
    examples: [{ summary: "Export PPTX", code: 'const file = await presentation.export({ format: "pptx" });' }],
    notes: "PDF pages contain rasterized slide previews; use PPTX for editable presentation content.",
  },
  {
    name: "presentation.theme",
    category: "theme",
    summary: "Set the deck font and named theme colors.",
    examples: [{ summary: "Use a theme token", code: 'presentation.theme.colorScheme = { name: "Review", themeColors }; shape.fill = "accent1";' }],
    notes: "Named colors resolve in PPTX output and local preview; imported theme inheritance is not reconstructed.",
  },
  {
    name: "presentation.template",
    category: "templates",
    summary: "Get a cloned named template patch from the local presentation catalog.",
    examples: [{ summary: "Select a template", code: 'const template = presentation.template("agenda");' }],
    notes: "The local catalog contains title-slide, two-up, and agenda starter slides.",
  },
  {
    name: "presentation.apply",
    category: "templates",
    summary: "Apply a local template patch and append its editable slide content.",
    examples: [{ summary: "Apply a template", code: 'presentation.apply(presentation.template("agenda"));' }],
    notes: "The local patch format creates one editable slide from its text elements.",
  },
  {
    name: "presentation.layouts.add",
    category: "layouts",
    summary: "Create a named local layout with editable placeholders.",
    examples: [{ summary: "Define a title placeholder", code: 'presentation.layouts.add("Title Body").placeholders.add({ type: "title", index: 0, geometry: "textbox", position });' }],
    notes: "Placeholders are slide-owned content in exported PPTX, not master-inherited elements.",
  },
  {
    name: "slides.add",
    category: "slides",
    summary: "Append a slide to the presentation.",
    examples: [{ summary: "Add a slide", code: "const slide = presentation.slides.add({ layout: \"wide\" });" }],
    notes: "Custom placeholders and imported supported inherited artwork are written through the local layout/master hierarchy.",
  },
  {
    name: "slides.insert",
    category: "slides",
    summary: "Insert a slide after an index or slide facade.",
    examples: [{ summary: "Insert after the first slide", code: "const { slide, index } = presentation.slides.insert({ after: 0 });" }],
    notes: "Returns the new slide and its zero-based index.",
  },
  {
    name: "slide.shapes.add",
    category: "shapes",
    summary: "Add an editable textbox or preset shape with pixel geometry and optional text.",
    examples: [{ summary: "Add a labeled shape", code: 'slide.shapes.add({ geometry: "roundRect", text: "Status", position: { left: 24, top: 24, width: 180, height: 64 } });' }],
    notes: "Shape text is embedded in its PPTX shape. Only the local preset geometry set is supported.",
  },
  {
    name: "slide.shapes.getConnectionSiteIndex",
    category: "shapes",
    summary: "Get one of four cardinal connector sites for a shape.",
    examples: [{ summary: "Find the right-side connection site", code: 'const fromIdx = slide.shapes.getConnectionSiteIndex(source, "right");' }],
    notes: "The local model uses top, right, bottom, and left sites for every geometry.",
  },
  {
    name: "slide.tables.add",
    category: "tables",
    summary: "Add an editable rectangular table.",
    examples: [{ summary: "Add a table", code: 'slide.tables.add({ rows: [["Area", "Status"], ["Schedule", "On track"]], position });' }],
    notes: "Cells support fill/text style, range block assignment, per-edge borders, merge/unmerge, and row or column insertion/deletion.",
  },
  {
    name: "table.getCell",
    category: "tables",
    summary: "Read or update a table cell value, fill, and basic text style.",
    examples: [{ summary: "Update a cell", code: 'table.getCell(1, 1).value = "At risk"; table.getCell(0, 1).fill = "#DCEAFE";' }],
    notes: "Row and column indexes are zero-based. Use table.cells.block() for range styling and table.merge() for rectangular merges.",
  },
  {
    name: "slide.images.add",
    category: "images",
    summary: "Add a local image file to a slide.",
    examples: [{ summary: "Add an image", code: 'slide.images.add({ src: "/absolute/path/logo.png", position, altText: "Logo" });' }],
    notes: "Choose a box matching the image aspect ratio to avoid distortion.",
  },
  {
    name: "slide.charts.add",
    category: "charts",
    summary: "Add an editable native PowerPoint chart from series data.",
    examples: [{ summary: "Add a chart", code: 'slide.charts.add({ type: "bar", series: [{ name: "Revenue", labels: ["Q1", "Q2"], values: [12, 18] }], position });' }],
    notes: "The SVG preview simplifies native chart styling.",
  },
];

const presentationTemplates = [
  {
    name: "title-slide",
    summary: "Title and subtitle slide with centered text boxes.",
    elements: [
      { kind: "text", text: "Presentation title", position: { left: 120, top: 250, width: 1040, height: 100 }, style: { fontSize: 56, bold: true, align: "center" } },
      { kind: "text", text: "Subtitle", position: { left: 160, top: 370, width: 960, height: 56 }, style: { fontSize: 28, align: "center" } },
    ],
  },
  {
    name: "two-up",
    summary: "Two-column slide with left and right content areas.",
    elements: [
      { kind: "text", text: "Slide title", position: { left: 72, top: 48, width: 1136, height: 72 }, style: { fontSize: 42, bold: true } },
      { kind: "text", text: "Left column", position: { left: 72, top: 160, width: 520, height: 440 }, style: { fontSize: 24 } },
      { kind: "text", text: "Right column", position: { left: 688, top: 160, width: 520, height: 440 }, style: { fontSize: 24 } },
    ],
  },
  {
    name: "agenda",
    summary: "Agenda slide with a title and list body.",
    elements: [
      { kind: "text", text: "Agenda", position: { left: 72, top: 48, width: 1136, height: 72 }, style: { fontSize: 42, bold: true } },
      { kind: "text", text: "Topic one\nTopic two\nTopic three", position: { left: 96, top: 170, width: 1088, height: 430 }, style: { fontSize: 30 } },
    ],
  },
].map((template) => ({ kind: "template", ...template }));

const presentationTemplateHelpIndex = presentationTemplates.map(({ name, summary }) => ({
  kind: "template",
  name,
  summary,
  examples: [{ summary: `Apply the ${name} template`, code: `presentation.apply(presentation.template("${name}"));` }],
}));

function queryPresentationHelp(query = "*", options = {}) {
  if (typeof query !== "string" || !options || typeof options !== "object" || Array.isArray(options)) {
    throw new ArtifactToolError("invalid_help_query", "presentation help expects a query string and options object");
  }
  const include = options.include ?? ["category", "summary", "examples", "notes"];
  if (!Array.isArray(include) || include.some((field) => typeof field !== "string")) {
    throw new ArtifactToolError("invalid_help_query", "presentation help include must be an array of field names");
  }
  if (options.maxChars !== undefined && (!Number.isSafeInteger(options.maxChars) || options.maxChars < 1)) {
    throw new ArtifactToolError("invalid_help_query", "presentation help maxChars must be a positive integer");
  }
  if (options.search !== undefined && (typeof options.search !== "string" || options.search.length === 0)) {
    throw new ArtifactToolError("invalid_help_query", "presentation help search must be a non-empty string");
  }
  const patternSource = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll("\\*", ".*").replaceAll("\\?", ".");
  const pattern = new RegExp(`^${patternSource}$`, "i");
  const templateListingQuery = query.toLowerCase() === "template*";
  const records = [...presentationHelpIndex.map((entry) => ({ kind: "api", ...entry })), ...presentationTemplateHelpIndex]
    .filter((entry) => templateListingQuery ? entry.kind === "template" : pattern.test(entry.name))
    .filter((entry) => options.search === undefined || JSON.stringify(entry).toLowerCase().includes(options.search.toLowerCase()))
    .map((entry) => {
      const enriched = { ...entry, index: { kind: entry.kind, name: entry.name, category: entry.category, summary: entry.summary } };
      return {
        name: entry.name,
        kind: entry.kind,
        ...Object.fromEntries(include.filter((field) => field in enriched).map((field) => [field, enriched[field]])),
      };
    });
  let ndjson = records.map((record) => JSON.stringify(record)).join("\n");
  const truncated = options.maxChars !== undefined && ndjson.length > options.maxChars;
  if (truncated) ndjson = `${ndjson.slice(0, Math.max(0, options.maxChars - 1))}…`;
  return { records, recordCount: records.length, ndjson, ...(truncated ? { truncated: true } : {}) };
}

function normalizeCommentPerson(person = {}) {
  if (!person || typeof person !== "object" || Array.isArray(person) || typeof person.displayName !== "string" || !person.displayName.trim()) {
    throw new ArtifactToolError("invalid_comment_author", "comment author requires a displayName");
  }
  return {
    id: typeof person.id === "string" && person.id ? person.id : newPresentationId("person"),
    displayName: person.displayName,
    ...(typeof person.initials === "string" ? { initials: person.initials } : {}),
    ...(typeof person.email === "string" ? { email: person.email } : {}),
    ...(typeof person.avatarUrl === "string" ? { avatarUrl: person.avatarUrl } : {}),
    ...(typeof person.userId === "string" ? { userId: person.userId } : {}),
    ...(typeof person.providerId === "string" ? { providerId: person.providerId } : {}),
  };
}

class CommentReplyHandle {
  constructor(thread, model) { this.thread = thread; this.model = model; }
  get id() { return this.model.id; }
  get body() { return this.model.body; }
  get author() { return structuredClone(this.model.author); }
  get createdAt() { return this.model.createdAt; }
  get reactions() { return structuredClone(this.model.reactions); }
  toggleReaction(reactionText) {
    if (typeof reactionText !== "string" || !reactionText.trim()) throw new ArtifactToolError("invalid_comment_reaction", "reaction must be non-empty text");
    const author = this.thread.presentation.comments.self ?? this.model.author;
    const existing = this.model.reactions.find((item) => item.emoji === reactionText);
    if (!existing) this.model.reactions.push({ emoji: reactionText, people: [structuredClone(author)] });
    else {
      const index = existing.people.findIndex((person) => person.id === author.id);
      if (index < 0) existing.people.push(structuredClone(author));
      else existing.people.splice(index, 1);
      if (existing.people.length === 0) this.model.reactions.splice(this.model.reactions.indexOf(existing), 1);
    }
    return this;
  }
}

class CommentThreadHandle {
  constructor(presentation, model) { this.presentation = presentation; this.model = model; }
  get id() { return this.model.id; }
  get body() { return this.model.body; }
  get author() { return structuredClone(this.model.author); }
  get createdAt() { return this.model.createdAt; }
  get updatedAt() { return this.model.updatedAt; }
  get target() { return structuredClone(this.model.target); }
  get position() { return this.model.position ? { ...this.model.position } : undefined; }
  get resolved() { return Boolean(this.model.resolved); }
  get replies() { return this.model.replies.map((reply) => new CommentReplyHandle(this, reply)); }
  addReply(bodyText, options = {}) {
    if (typeof bodyText !== "string" || !bodyText.trim()) throw new ArtifactToolError("invalid_comment", "comment reply must be non-empty text");
    const author = options.author ? resolveCommentAuthor(options.author) : this.presentation.comments.self ?? this.model.author;
    const reply = { id: newPresentationId("reply"), body: bodyText, author: structuredClone(author), createdAt: options.createdAt ?? new Date().toISOString(), reactions: [] };
    this.model.replies.push(reply);
    this.model.updatedAt = reply.createdAt;
    return new CommentReplyHandle(this, reply);
  }
  resolve(author) {
    this.model.resolved = true;
    this.model.resolvedBy = author ? resolveCommentAuthor(author) : structuredClone(this.presentation.comments.self ?? this.model.author);
    this.model.updatedAt = new Date().toISOString();
    return this;
  }
  reopen(author) {
    this.model.resolved = false;
    delete this.model.resolvedBy;
    this.model.updatedAt = new Date().toISOString();
    if (author) this.model.updatedBy = resolveCommentAuthor(author);
    return this;
  }
}

function resolveCommentAuthor(author) {
  if (typeof author === "string") return { id: author, displayName: author };
  if (author && typeof author === "object" && typeof author.id === "string" && author.displayName === undefined) return { id: author.id, displayName: author.id };
  return normalizeCommentPerson(author);
}

class PresentationComments {
  constructor(presentation) { this.presentation = presentation; this.self = undefined; }
  setSelf(person) {
    this.self = normalizeCommentPerson(person);
    return structuredClone(this.self);
  }
  addThread(target, bodyText, options = {}) {
    if (typeof bodyText !== "string" || !bodyText.trim()) throw new ArtifactToolError("invalid_comment", "comment body must be non-empty text");
    if (!target || typeof target !== "object" || Array.isArray(target)) throw new ArtifactToolError("invalid_comment_target", "comment target must identify a slide, element, textRange, or textMatch");
    let resolvedTarget;
    let position = options.position;
    const slideTarget = target.slide;
    if (slideTarget) {
      const slide = typeof slideTarget === "string" ? this.presentation.slides.items.find((item) => item.id === slideTarget) : slideTarget;
      if (!slide || !this.presentation.slides.items.includes(slide)) throw new ArtifactToolError("invalid_comment_target", "comment slide target must belong to this presentation");
      resolvedTarget = { type: "slide", slideId: slide.id };
    } else {
      let element;
      let textRange;
      if (target.element) element = typeof target.element === "string" ? findElement(this.presentation, target.element) : target.element;
      else if (target.textRange) { textRange = target.textRange; element = { model: textRange.model }; }
      else if (target.textMatch) {
        const candidate = target.textMatch;
        element = typeof candidate.element === "string" ? findElement(this.presentation, candidate.element) : candidate.element;
        const query = candidate.query;
        if (typeof query !== "string" || !query) throw new ArtifactToolError("invalid_comment_target", "textMatch requires non-empty query text");
        const text = String(element?.model?.text ?? "");
        const occurrence = candidate.occurrence ?? 0;
        if (!Number.isInteger(occurrence) || occurrence < 0) throw new ArtifactToolError("invalid_comment_target", "textMatch occurrence must be a non-negative integer");
        let start = -1;
        let cursor = 0;
        for (let index = 0; index <= occurrence; index += 1) {
          start = text.indexOf(query, cursor);
          if (start < 0) break;
          cursor = start + query.length;
        }
        if (start < 0) throw new ArtifactToolError("invalid_comment_target", "textMatch query was not found on the target shape");
        textRange = { model: element.model, start, end: start + query.length };
      }
      if (!element?.model || !this.presentation.slides.items.some((slide) => slide.objects.includes(element.model))) throw new ArtifactToolError("invalid_comment_target", "comment element target must belong to this presentation");
      const slide = this.presentation.slides.items.find((item) => item.objects.includes(element.model));
      if (textRange) {
        if (textRange.model !== element.model || !Number.isInteger(textRange.start) || !Number.isInteger(textRange.end) || textRange.start < 0 || textRange.end < textRange.start || textRange.end > String(element.model.text ?? "").length) throw new ArtifactToolError("invalid_comment_target", "textRange must refer to text on its target element");
        resolvedTarget = { type: "textRange", slideId: slide.id, elementId: element.model.id, start: textRange.start, end: textRange.end };
      } else resolvedTarget = { type: "element", slideId: slide.id, elementId: element.model.id };
    }
    if (position !== undefined && (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y) || ![undefined, "px", "emu"].includes(position.unit))) throw new ArtifactToolError("invalid_comment_position", "comment position requires finite x and y and px or emu units");
    const author = options.author ? resolveCommentAuthor(options.author) : this.self ?? { id: "local-user", displayName: "Local user" };
    const createdAt = options.createdAt ?? new Date().toISOString();
    if (typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt))) throw new ArtifactToolError("invalid_comment_date", "comment createdAt must be an ISO date string");
    const model = { id: newPresentationId("thread"), body: bodyText, author: structuredClone(author), createdAt, target: resolvedTarget, ...(position ? { position: { ...position } } : {}), replies: [], reactions: [], resolved: false, updatedAt: createdAt };
    this.presentation._commentThreads.push(model);
    return new CommentThreadHandle(this.presentation, model);
  }
  getItem(id) {
    const model = this.presentation._commentThreads.find((item) => item.id === id);
    if (!model) throw new ArtifactToolError("invalid_presentation_id", `unknown comment thread: ${id}`);
    return new CommentThreadHandle(this.presentation, model);
  }
  get items() { return this.presentation._commentThreads.map((thread) => new CommentThreadHandle(this.presentation, thread)); }
}

function findElement(presentation, id) {
  const slide = presentation.slides.items.find((item) => item.objects.some((object) => object.id === id));
  const model = slide?.objects.find((object) => object.id === id);
  if (!model) return undefined;
  if (model.kind === "text" || model.kind === "shape") return new ShapeHandle(slide, model);
  if (model.kind === "table") return new TableHandle(slide, model);
  return new ElementHandle(slide, model);
}

export class Presentation {
  constructor(options = {}) {
    this.id = newPresentationId("pr");
    this.title = options.title ?? "";
    this.slideSize = options.slideSize ?? { width: 1280, height: 720 };
    if (
      !this.slideSize ||
      !Number.isFinite(this.slideSize.width) ||
      !Number.isFinite(this.slideSize.height) ||
      this.slideSize.width <= 0 ||
      this.slideSize.height <= 0
    ) {
      throw new ArtifactToolError("invalid_slide_size", "slide size must have positive pixel dimensions");
    }
    this.masters = new MasterCollection(this);
    this.layouts = new LayoutCollection(this);
    this.slides = new SlideCollection(this);
    this._commentThreads = [];
    this.comments = new PresentationComments(this);
    this.theme = new PresentationTheme(options.theme);
    this.view = new PresentationView(options.view);
    this.sourcePath = options.sourcePath;
    this.imageGenerator = typeof options.imageGenerator === "function" ? options.imageGenerator : undefined;
    this.shallowImport = options.shallowImport === true;
    this.lossDiagnostics = options.lossDiagnostics ? [...options.lossDiagnostics] : [];
  }

  static create(options = {}) {
    return new Presentation(options);
  }

  resolve(ids) {
    const multiple = Array.isArray(ids);
    const requested = multiple ? ids : [ids];
    if (requested.some((id) => typeof id !== "string" || id.length === 0)) {
      throw new ArtifactToolError("invalid_presentation_id", "resolve requires one or more presentation IDs");
    }
    const resolveOne = (id) => {
      if (id === this.id) return this;
      const master = this.masters._items.find((item) => item.id === id);
      if (master) return new PresentationMasterHandle(this, master);
      for (const slide of this.slides.items) {
        if (id === slide.id) return slide;
        if (id === slide.notesId) return new NotesHandle(slide);
        const thread = this._commentThreads.find((item) => item.id === id);
        if (thread) return new CommentThreadHandle(this, thread);
        const model = slide.objects.find((object) => object.id === id);
        if (model) {
          if (model.kind === "text" || model.kind === "shape") return new ShapeHandle(slide, model);
          if (model.kind === "table") return new TableHandle(slide, model);
          return new ElementHandle(slide, model);
        }
      }
      throw new ArtifactToolError("invalid_presentation_id", `unknown presentation ID: ${id}`);
    };
    const results = requested.map(resolveOne);
    return multiple ? results : results[0];
  }

  delete(ids) {
    const requested = Array.isArray(ids) ? ids : [ids];
    if (!requested.length || requested.some((id) => typeof id !== "string" || id === this.id)) {
      throw new ArtifactToolError("invalid_presentation_id", "delete requires one or more slide or element IDs");
    }
    const targets = requested.map((id) => {
      const slide = this.slides.items.find((item) => item.id === id);
      if (slide) return { type: "slide", slide };
      for (const item of this.slides.items) {
        const index = item.objects.findIndex((object) => object.id === id);
        if (index !== -1) return { type: "element", slide: item, index };
      }
      throw new ArtifactToolError("invalid_presentation_id", `unknown presentation ID: ${id}`);
    });
    const slideIds = new Set(targets.filter((item) => item.type === "slide").map((item) => item.slide.id));
    for (const item of this.slides.items) {
      if (slideIds.has(item.id)) continue;
      const indices = targets
        .filter((target) => target.type === "element" && target.slide === item)
        .map((target) => target.index);
      for (const index of [...new Set(indices)].sort((a, b) => b - a)) item.objects.splice(index, 1);
    }
    this.slides.items = this.slides.items.filter((slide) => !slideIds.has(slide.id));
  }

  static async load(inputPath) {
    if (inputPath && typeof inputPath === "object" && !Array.isArray(inputPath)) {
      return Presentation.fromProto(inputPath);
    }
    if (typeof inputPath !== "string") {
      throw new ArtifactToolError("invalid_input_path", "presentation input must be a path or Ruxex presentation proto");
    }
    const bytes = await readFile(inputPath);
    if (bytes.subarray(0, 2).toString() !== "PK") {
      throw new ArtifactToolError("invalid_ooxml_package", `not a PPTX package: ${inputPath}`);
    }
    const response = await runEngine({ version: 1, operation: "pptx_read", input_path: inputPath });
    const presentation = new Presentation({
      sourcePath: inputPath,
      slideSize: response.slideSize ?? { width: 1280, height: 720 },
      theme: response.theme,
      shallowImport: false,
      lossDiagnostics: response.diagnostics ?? [],
    });
    for (const layoutModel of response.layouts ?? []) {
      if (layoutModel.master?.id && !presentation.masters._items.some((master) => master.id === layoutModel.master.id)) {
        presentation.masters.add(layoutModel.master.name ?? "Imported Master", layoutModel.master);
      }
      const layout = presentation.layouts.add(layoutModel.name, {
        id: layoutModel.id,
        parentMasterId: layoutModel.parentMasterId ?? layoutModel.master?.id,
        masterObjects: layoutModel.masterObjects ?? [],
        layoutObjects: layoutModel.layoutObjects ?? [],
      });
      for (const placeholder of layoutModel.placeholders ?? []) restoreLayoutPlaceholder(layout.placeholders, placeholder);
    }
    for (const slideModel of response.slides ?? []) {
      const slide = new Slide(presentation, { layout: slideModel.layout ?? "wide" });
      presentation.slides.items.push(slide);
      slide.background.fill = slideModel.background?.fill ?? "none";
      const importedImageFillSources = new Map();
      if (typeof slideModel.notes === "string" && slideModel.notes.length > 0) {
        slide.addNotes(slideModel.notes);
      }
      for (const object of slideModel.objects ?? []) {
        if (object.kind === "text") slide.addText(object.textRuns?.length ? object.textRuns : object.text, object.options ?? {});
        if (object.kind === "table") {
          const rows = object.rows.map((row) => [...row]);
          const width = Math.max(0, ...rows.map((row) => row.length));
          if (rows.some((row) => row.length !== width)) {
            presentation.lossDiagnostics.push({
              code: "unsupported_table_merge_structure",
              message: `slide ${presentation.slides.length} contains a table with merged-cell structure that was normalized for editing`,
              slide: presentation.slides.length,
            });
          }
          const normalizedRows = rows.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill("")]);
          slide.addTable(normalizedRows, object.options ?? {});
          slide.objects.at(-1).cellOptions = normalizedRows.map((row, rowIndex) =>
            row.map((_, columnIndex) => object.cellOptions?.[rowIndex]?.[columnIndex] ?? {}),
          );
        }
        if (object.kind === "chart") {
          slide.charts.add({
            type: object.type,
            series: object.series,
            ...(object.series?.[0]?.labels ? { categories: object.series[0].labels } : {}),
            ...(object.options ?? {}),
          });
        }
        if (object.kind === "image") {
          slide.images.add({
            src: object.src,
            altText: object.altText ?? "",
            ...(object.prompt !== undefined ? { prompt: object.prompt } : {}),
            ...(object.hyperlink ? { hyperlink: object.hyperlink } : {}),
            ...(object.options ?? {}),
          });
        }
        if (object.kind === "shape" && supportedShapes.has(object.shape)) {
          const shape = {
            geometry: object.shape,
            ...(object.options ?? {}),
          };
          if (shape.fill?.type === "image" && typeof shape.fill.imageReference?.src === "string") {
            const sourceKey = shape.fill.imageReference.id;
            let source = importedImageFillSources.get(sourceKey);
            if (!source) {
              source = slide.images.add({
                src: shape.fill.imageReference.src,
                altText: "Imported shape fill image",
                position: { left: -5000, top: -5000, width: 1, height: 1 },
              });
              source.model.fillSourceOnly = true;
              importedImageFillSources.set(sourceKey, source.id);
            }
            shape.fill.imageReference.id = source.id;
            delete shape.fill.imageReference.src;
          }
          if (object.text !== undefined) {
            shape.text = {
              text: object.textRuns?.length ? object.textRuns : object.text,
              ...(object.options?.textStyle ? { style: object.options.textStyle } : {}),
            };
          }
          slide.shapes.add(shape);
        }
        if (object.kind === "shape" && !supportedShapes.has(object.shape)) {
          presentation.lossDiagnostics.push({
            code: "unsupported_shapes",
            message: `slide ${presentation.slides.length} contains an unsupported shape: ${object.shape}`,
            slide: presentation.slides.length,
          });
        }
      }
      const importedShapeIds = new Map(slide.objects
        .filter((object) => Number.isFinite(object.options?.pptxShapeId))
        .map((object) => [object.options.pptxShapeId, object.id]));
      for (const object of slide.objects) {
        const connector = object.options?.connector;
        if (connector?.fromPptxId != null || connector?.toPptxId != null) {
          if (connector.fromPptxId != null) connector.fromId = importedShapeIds.get(connector.fromPptxId);
          if (connector.toPptxId != null) connector.toId = importedShapeIds.get(connector.toPptxId);
          const unresolvedFrom = connector.fromPptxId != null && !connector.fromId;
          const unresolvedTo = connector.toPptxId != null && !connector.toId;
          delete connector.fromPptxId;
          delete connector.toPptxId;
          if (unresolvedFrom || unresolvedTo) {
            presentation.lossDiagnostics.push({
              code: "unsupported_connector_attachment",
              message: `slide ${presentation.slides.length} contains a connector whose endpoints could not be resolved`,
              slide: presentation.slides.length,
            });
            delete object.options.connector;
          }
        }
        delete object.options?.pptxShapeId;
      }
    }
    return presentation;
  }

  static fromProto(proto) {
    if (proto?.schema !== "ruxex.presentation.proto/v1" || !Array.isArray(proto.slides)) {
      throw new ArtifactToolError("invalid_presentation_proto", "unsupported presentation proto schema");
    }
    const presentation = new Presentation({ title: proto.title, slideSize: proto.slideSize, theme: proto.theme });
    presentation.view = new PresentationView(proto.view);
    if (typeof proto.id === "string") presentation.id = proto.id;
    presentation._commentThreads = Array.isArray(proto.comments) ? structuredClone(proto.comments) : [];
    presentation.comments.self = proto.commentSelf ? structuredClone(proto.commentSelf) : undefined;
    for (const master of proto.masters ?? []) presentation.masters.add(master.name, master);
    for (const layout of proto.layouts ?? []) {
      const added = presentation.layouts.add(layout.name, {
        id: layout.id,
        masterObjects: layout.masterObjects ?? [],
        layoutObjects: layout.layoutObjects ?? [],
        parentMasterId: layout.parentMasterId,
      });
      for (const placeholder of layout.placeholders ?? []) restoreLayoutPlaceholder(added.placeholders, placeholder);
    }
    for (const slideProto of proto.slides) {
      const slide = new Slide(presentation, {
        layout: slideProto.layout?.name ?? slideProto.layout,
        layoutId: slideProto.layout?.id ?? slideProto.layoutId,
        width: slideProto.size?.width,
        height: slideProto.size?.height,
      });
      if (typeof slideProto.id === "string") slide.id = slideProto.id;
      if (typeof slideProto.notesId === "string") slide.notesId = slideProto.notesId;
      slide.background.fill = slideProto.background?.fill ?? "none";
      slide.notes = typeof slideProto.notes === "string" ? slideProto.notes : "";
      for (const rawObject of slideProto.objects ?? []) {
        const object = structuredClone(rawObject);
        if (object.kind === "table") {
          object.cellOptions ??= object.rows.map((row) => row.map(() => ({})));
        }
        const id = object.id;
        delete object.id;
        const prefix = object.kind === "image" ? "im" : object.kind === "chart" ? "ch" : object.kind === "table" ? "tb" : "sh";
        registerElement(slide, object, prefix, id);
      }
      presentation.slides.items.push(slide);
    }
    return presentation;
  }

  toProto() {
    return {
      schema: "ruxex.presentation.proto/v1",
      id: this.id,
      title: this.title,
      slideSize: { ...this.slideSize },
      theme: { defaultFont: this.theme.defaultFont, colorScheme: this.theme.colorScheme },
      masters: this.masters._items.map((master) => structuredClone(master)),
      layouts: this.layouts.items.map((layout) => ({
        id: layout.id,
        name: layout.name,
        parentMasterId: layout.parentMasterId,
        placeholders: layout.placeholders.items.map((placeholder) => structuredClone(placeholder)),
        masterObjects: structuredClone(layout._masterObjects),
        layoutObjects: structuredClone(layout._objects),
      })),
      comments: structuredClone(this._commentThreads),
      ...(this.comments.self ? { commentSelf: structuredClone(this.comments.self) } : {}),
      view: {
        gridlinesVisible: this.view.gridlinesVisible,
        guidesVisible: this.view.guidesVisible,
        placeholdersVisible: this.view.placeholdersVisible,
        gridSpacingCxEmu: this.view.gridSpacingCxEmu,
        gridSpacingCyEmu: this.view.gridSpacingCyEmu,
      },
      slides: this.slides.items.map((slide) => ({
        id: slide.id,
        notesId: slide.notesId,
        layout: { id: slide.layoutId, name: slide.layout },
        size: { ...slide.size },
        background: { fill: slide.background.fill },
        notes: slide.notes,
        objects: slide.objects.map((object) => ({ ...structuredClone(object), id: object.id })),
      })),
    };
  }

  async inspect(options) {
    if (options !== undefined) return queryInspection(this, options);
    const inspection = {
      ok: true,
      valid: true,
      slides: this.slides.length,
      objects: this.slides.items.reduce((total, slide) => total + slide.objects.length, 0),
    };
    if (this.sourcePath) {
      return {
        ...inspection,
        diagnostics: this.lossDiagnostics,
        editable: this.lossDiagnostics.length === 0,
        sourcePath: this.sourcePath,
      };
    }
    return inspection;
  }

  help(query = "*", options = {}) {
    return queryPresentationHelp(query, options);
  }

  template(name) {
    const template = presentationTemplates.find((item) => item.name === name);
    if (!template) throw new ArtifactToolError("invalid_template", `unknown presentation template: ${name}`);
    return structuredClone(template);
  }

  apply(template) {
    const name = typeof template === "string" ? template : template?.name;
    const definition = presentationTemplates.find((item) => item.name === name);
    if (!definition || (typeof template !== "string" && (template?.kind !== "template" || !Array.isArray(template.elements)))) {
      throw new ArtifactToolError("invalid_template", "apply requires a template returned by presentation.template()");
    }
    const slide = this.slides.add();
    for (const element of typeof template === "string" ? definition.elements : template.elements) {
      slide.addText(element.text, {
        ...element.position,
        textStyle: structuredClone(element.style),
      });
    }
    return slide;
  }

  async render(options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new ArtifactToolError("invalid_render_options", "render options must be an object");
    }
    const renderFormat = options.format ?? (options.montage && typeof options.montage === "object" ? options.montage.format : undefined) ?? "png";
    if (!["svg", "png", "jpeg", "jpg", "webp"].includes(renderFormat)) {
      throw new ArtifactToolError("unsupported_render_format", `unsupported presentation render format: ${renderFormat}`);
    }
    if (options.montage) {
      if (options.slide !== undefined) {
        throw new ArtifactToolError("invalid_render_options", "montage cannot be combined with slide selection");
      }
      const config = typeof options.montage === "object" ? options.montage : {};
      const columns = config.columns ?? Math.max(1, Math.ceil(Math.sqrt(this.slides.length)));
      const slideWidth = config.slideWidth ?? 320;
      const gap = config.gap ?? 16;
      const padding = config.padding ?? 16;
      if (!Number.isInteger(columns) || columns < 1 || !Number.isFinite(slideWidth) || slideWidth <= 0 ||
        ![gap, padding].every((value) => Number.isFinite(value) && value >= 0)) {
        throw new ArtifactToolError("invalid_render_options", "montage dimensions and columns are invalid");
      }
      const scale = slideWidth / this.slideSize.width;
      const slideHeight = this.slideSize.height * scale;
      const rows = Math.ceil(this.slides.length / columns);
      const width = padding * 2 + columns * slideWidth + Math.max(0, columns - 1) * gap;
      const height = padding * 2 + rows * slideHeight + Math.max(0, rows - 1) * gap;
      const items = await Promise.all(this.slides.items.map(async (slide, index) => {
        const svg = await svgForSlide(this, slide);
        const data = Buffer.from(svg).toString("base64");
        const left = padding + (index % columns) * (slideWidth + gap);
        const top = padding + Math.floor(index / columns) * (slideHeight + gap);
        return `<image x="${left}" y="${top}" width="${slideWidth}" height="${slideHeight}" href="data:image/svg+xml;base64,${data}"/>`;
      }));
      const montage = resizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${xmlEscape(config.background ?? "#E5E7EB")}"/>${items.join("")}</svg>`, {
        width: config.width,
        height: config.height,
        scale: options.scale ?? 1,
      });
      const blob = await renderBlob(montage, renderFormat);
      if (options.fileName !== undefined) {
        const path = resolve(options.fileName);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, Buffer.from(await blob.arrayBuffer()));
      }
      return blob;
    }
    const requested = options.slide;
    const single = requested instanceof Slide || Number.isInteger(requested);
    const selection = requested === undefined
      ? this.slides.items
      : (Array.isArray(requested) ? requested : [requested]).map((item) => {
        if (item instanceof Slide && item.presentation === this) return item;
        if (Number.isInteger(item) && item >= 0 && item < this.slides.length) return this.slides.items[item];
        throw new ArtifactToolError("invalid_slide_index", `render slide selection is invalid: ${item}`);
      });
    if (options.fileName !== undefined && !single) {
      throw new ArtifactToolError("invalid_render_options", "fileName requires one selected slide");
    }
    const renders = await Promise.all(selection.map(async (slide) => {
      const svg = resizeSvg(await svgForSlide(this, slide), options);
      const blob = await renderBlob(svg, renderFormat);
      const layout = slideLayoutRecord(this, slide);
      Object.defineProperty(blob, "layout", {
        value: new Blob([JSON.stringify(layout)], { type: "application/json" }),
        enumerable: true,
      });
      if (options.fileName !== undefined) {
        const path = resolve(options.fileName);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, Buffer.from(await blob.arrayBuffer()));
        await writeFile(path.replace(/\.(svg|png|jpe?g|webp)$/i, ".layout.json"), JSON.stringify(layout, null, 2), "utf8");
      }
      return blob;
    }));
    if (requested instanceof Slide || Number.isInteger(requested)) return renders[0];
    return renders;
  }

  async export(options = {}) {
    const format = options.format ?? "pptx";
    if (["svg", "png", "jpeg", "jpg", "webp"].includes(format)) return this.render({ ...options, format });
    if (format === "pdf") {
      const requested = options.slide;
      const selection = requested === undefined ? this.slides.items :
        (Array.isArray(requested) ? requested : [requested]).map((item) =>
          item instanceof Slide && item.presentation === this
            ? item
            : Number.isInteger(item) && item >= 0 && item < this.slides.length
              ? this.slides.items[item]
              : (() => { throw new ArtifactToolError("invalid_slide_index", `export slide selection is invalid: ${item}`); })(),
        );
      const pdf = await PDFDocument.create();
      for (const slide of selection) {
        const svg = await svgForSlide(this, slide);
        const png = await sharp(Buffer.from(svg)).png().toBuffer();
        const image = await pdf.embedPng(png);
        const page = pdf.addPage([slide.size.width * 0.75, slide.size.height * 0.75]);
        page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
      }
      const bytes = await pdf.save();
      if (options.fileName !== undefined) {
        const path = resolve(options.fileName);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, bytes);
      }
      return new Blob([bytes], { type: "application/pdf" });
    }
    if (format === "layout") {
      if (options.slide instanceof Slide && options.slide.presentation !== this) {
        throw new ArtifactToolError("invalid_slide_index", "slide does not belong to this presentation");
      }
      const selected = options.slide === undefined ? this.slides.items :
        [options.slide instanceof Slide ? options.slide : this.slides.getItem(options.slide)];
      const layouts = selected.map((slide) => slideLayoutRecord(this, slide, options.detail));
      const data = JSON.stringify(options.slide === undefined ? layouts : layouts[0], null, 2);
      if (options.fileName !== undefined) {
        const path = resolve(options.fileName);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, data, "utf8");
      }
      return new Blob([data], { type: "application/json" });
    }
    if (format !== "pptx") {
      throw new ArtifactToolError("unsupported_export_format", `local presentation export does not support ${format}`);
    }
    const bytes = await exportPresentationPptxBytes(this, options);
    if (options.fileName !== undefined) {
      const path = resolve(options.fileName);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes);
    }
    return new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
  }

}

async function createPptxGenerator(presentationModel, options = {}) {
  if (presentationModel.shallowImport) {
    throw new ArtifactToolError(
      "unsupported_operation",
      "shallow PPTX imports cannot be exported until slide content is parsed",
    );
  }
  if (presentationModel.lossDiagnostics.length > 0 && options.acceptDiagnostics !== true) {
    throw new ArtifactToolError(
      "lossy_import",
      "loaded PPTX contains unsupported content; pass acceptDiagnostics to export",
    );
  }
  if (presentationModel.slides.items.some((slide) =>
    slide.size.width !== presentationModel.slideSize.width ||
    slide.size.height !== presentationModel.slideSize.height)) {
    throw new ArtifactToolError(
      "unsupported_slide_size",
      "PPTX export requires every slide to use the presentation slide size",
    );
  }
  const presentation = new PptxGenJS();
  presentation.theme = {
    headFontFace: presentationModel.theme.defaultFont,
    bodyFontFace: presentationModel.theme.defaultFont,
    lang: "en-US",
  };
  const { width, height } = presentationModel.slideSize;
  if (width !== 1280 || height !== 720) {
    presentation.defineLayout({
      name: "RUXEX_CUSTOM",
      width: width / pixelsPerInch,
      height: height / pixelsPerInch,
    });
    presentation.layout = "RUXEX_CUSTOM";
  } else {
    presentation.layout = "LAYOUT_WIDE";
  }
  const masterNames = new Map();
  for (const [index, layout] of presentationModel.layouts.items.entries()) {
    const nameToken = layout.name.replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/^_+|_+$/g, "") || "Layout";
    const masterName = `RUXEX_${nameToken}_${index + 1}`;
    const parentMaster = presentationModel.masters._items.find((master) => master.id === layout.parentMasterId);
    const masterBackground = parentMaster?.background?.ref
      ? [{ rect: { x: 0, y: 0, w: width, h: height, fill: pptxFill(parentMaster.background.ref, presentationModel.theme), line: { color: "FFFFFF", transparency: 100, width: 0 } } }]
      : [];
    const inheritedObjects = [...(parentMaster?.objects ?? []), ...layout._masterObjects, ...layout._objects].flatMap((object) => {
      const options = mapPptxShapeOptions(object.options ?? {}, presentationModel.theme);
      if (object.kind === "text") {
        const textOptions = mapPptxPosition(object.options ?? {});
        const textStyle = object.options?.textStyle ?? {};
        if (textStyle.fontSize !== undefined) textOptions.fontSize = Number(textStyle.fontSize) * 0.75;
        if (textStyle.color !== undefined) Object.assign(textOptions, pptxTextColor(textStyle.color, presentationModel.theme));
        if (textStyle.fontFace !== undefined) textOptions.fontFace = textStyle.fontFace;
        if (textStyle.bold !== undefined) textOptions.bold = textStyle.bold;
        if (textStyle.italic !== undefined) textOptions.italic = textStyle.italic;
        return [{ text: { text: object.text ?? "", options: textOptions } }];
      }
      const shapeType = object.shape === "line" ? "line" : "rect";
      return [{ [shapeType]: options }];
    });
    const objects = [...masterBackground, ...inheritedObjects, ...layout._placeholders.flatMap((item) => {
      const position = mapPptxPosition(item.position);
      const style = { ...item.style };
      if (Number.isFinite(style.fontSize)) style.fontSize *= 0.75;
      if (style.color !== undefined) style.color = pptxColor(style.color, presentationModel.theme);
      if (style.fill !== undefined) style.fill = pptxFill(style.fill, presentationModel.theme);
      if (style.line !== undefined) style.line = pptxLine(style.line, presentationModel.theme);
      delete style.customPaths;
      const type = pptxPlaceholderType(item.type);
      return [{
        placeholder: {
          text: item.text || "",
          options: {
            name: item.name ?? `${item.type}-${item.index}`,
            type,
            _placeholderIdx: item.index,
            ...position,
            ...style,
          },
        },
      }];
    })];
    presentation.defineSlideMaster({ title: masterName, objects });
    masterNames.set(layout.id, masterName);
  }
  presentation.author = "Ruxex";
  presentation.subject = presentationModel.title;
  for (const slide of presentationModel.slides.items) await addSlideObjects(presentation, slide, presentationModel, masterNames);
  return presentation;
}

function pptxPlaceholderType(type) {
  const types = { title: "title", subtitle: "subTitle", body: "body", content: "body", picture: "pic", chart: "chart", table: "tbl" };
  return types[type] ?? "body";
}

function pptxSlidePlaceholder(slideModel, object, presentationModel) {
  if (!presentationModel.layouts.getItem(slideModel.layout, false) || !object.options.placeholderType) return {};
  const layout = presentationModel.layouts.getItem(slideModel.layout, false);
  const placeholders = layout?._placeholders ?? [];
  const index = placeholders.findIndex((item) =>
    item.type === object.options.placeholderType && item.index === (object.options.placeholderIndex ?? 0),
  );
  return index < 0 ? {} : {
    placeholder: pptxPlaceholderType(object.options.placeholderType),
    _placeholderType: pptxPlaceholderType(object.options.placeholderType),
    _placeholderIdx: placeholders[index].index,
  };
}

function normalizePlaceholderIndexes(xml, layout) {
  if (!layout) return xml;
  return xml.replace(/<p:ph\b[^>]*>/g, (tag) => {
    const nativeType = /\btype="([^"]+)"/.exec(tag)?.[1];
    const encodedIndex = Number(/\bidx="(\d+)"/.exec(tag)?.[1]);
    const encodedPlaceholder = Number.isInteger(encodedIndex) && encodedIndex >= 100
      ? layout._placeholders[encodedIndex - 100]
      : undefined;
    const placeholder = encodedPlaceholder && (!nativeType || pptxPlaceholderType(encodedPlaceholder.type) === nativeType)
      ? encodedPlaceholder
      : layout._placeholders.find((item) => pptxPlaceholderType(item.type) === nativeType && item.index === encodedIndex);
    if (!placeholder) return tag;
    let updated = /\bidx="[^"]*"/.test(tag)
      ? tag.replace(/\bidx="[^"]*"/, `idx="${placeholder.index}"`)
      : tag.replace(/<p:ph\b/, `<p:ph idx="${placeholder.index}"`);
    const expectedType = pptxPlaceholderType(placeholder.type);
    updated = /\btype="[^"]*"/.test(updated)
      ? updated.replace(/\btype="[^"]*"/, `type="${expectedType}"`)
      : updated.replace(/<p:ph\b/, `<p:ph type="${expectedType}"`);
    return updated;
  });
}

export async function exportPresentationPptxBytes(presentationModel, options = {}) {
  const presentation = await createPptxGenerator(presentationModel, options);
  const bytes = Buffer.from(await presentation.write({ outputType: "nodebuffer" }));
  return mergePresetShapeText(await applyPresentationTheme(bytes, presentationModel.theme), presentationModel);
}

function applyParagraphMetadata(textBody, paragraphs = []) {
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) return textBody;
  let index = -1;
  return textBody.replace(/<a:p(?:\s[^>]*)?>[\s\S]*?<\/a:p>/g, (paragraph) => {
    index += 1;
    const metadata = paragraphs[index] ?? {};
    const existing = paragraph.match(/<a:pPr\b([^>]*)>([\s\S]*?)<\/a:pPr>|<a:pPr\b([^>]*)\/>/);
    const attrs = existing?.[1] ?? existing?.[3] ?? "";
    let children = existing?.[2] ?? "";
    let updatedAttrs = attrs.replace(/\s+(?:marL|indent)="[^"]*"/g, "");
    if (Number.isFinite(metadata.marginLeft)) updatedAttrs += ` marL="${Math.round(metadata.marginLeft * 9525)}"`;
    if (Number.isFinite(metadata.indent)) updatedAttrs += ` indent="${Math.round(metadata.indent * 9525)}"`;
    children = children.replace(/<a:bu(?:None|Char|AutoNum)\b[^>]*\/>/g, "");
    const bullet = typeof metadata.bulletCharacter === "string" && metadata.bulletCharacter.length > 0
      ? `<a:buChar char="${xmlEscape(metadata.bulletCharacter)}"/>`
      : "<a:buNone/>";
    const spacing = (tag, key) => {
      children = children.replace(new RegExp(`<a:${tag}\\b[^>]*>[\\s\\S]*?<\\/a:${tag}>|<a:${tag}\\b[^>]*/>`, "g"), "");
      return Number.isFinite(metadata[key]) ? `<a:${tag}><a:spcPts val="${Math.round(metadata[key] * 75)}"/></a:${tag}>` : "";
    };
    children = children.replace(/<a:spcBef\b[^>]*>[\s\S]*?<\/a:spcBef>|<a:spcBef\b[^>]*\/>/g, "");
    children = children.replace(/<a:spcAft\b[^>]*>[\s\S]*?<\/a:spcAft>|<a:spcAft\b[^>]*\/>/g, "");
    children = bullet + spacing("spcBef", "spaceBefore") + spacing("spcAft", "spaceAfter") + children;
    const pPr = existing
      ? `<a:pPr${updatedAttrs}>${children}</a:pPr>`
      : `<a:pPr${updatedAttrs}>${bullet}${spacing("spcBef", "spaceBefore")}${spacing("spcAft", "spaceAfter")}</a:pPr>`;
    return existing ? paragraph.replace(existing[0], pPr) : paragraph.replace(/(<a:p(?:\s[^>]*)?>)/, `$1${pPr}`);
  });
}

function customPathsDrawingMl(paths) {
  const emu = (value) => Math.round(value * 9525);
  const pathXml = paths.map((path) => {
    const commands = path.commands.map((command) => {
      if (command.moveTo) return `<a:moveTo><a:pt x="${emu(command.moveTo.x)}" y="${emu(command.moveTo.y)}"/></a:moveTo>`;
      if (command.lineTo) return `<a:lnTo><a:pt x="${emu(command.lineTo.x)}" y="${emu(command.lineTo.y)}"/></a:lnTo>`;
      if (command.quadBezTo) return `<a:quadBezTo><a:pt x="${emu(command.quadBezTo.x1)}" y="${emu(command.quadBezTo.y1)}"/><a:pt x="${emu(command.quadBezTo.x)}" y="${emu(command.quadBezTo.y)}"/></a:quadBezTo>`;
      if (command.cubicBezTo) return `<a:cubicBezTo><a:pt x="${emu(command.cubicBezTo.x1)}" y="${emu(command.cubicBezTo.y1)}"/><a:pt x="${emu(command.cubicBezTo.x2)}" y="${emu(command.cubicBezTo.y2)}"/><a:pt x="${emu(command.cubicBezTo.x)}" y="${emu(command.cubicBezTo.y)}"/></a:cubicBezTo>`;
      return "<a:close/>";
    }).join("");
    return `<a:path w="${emu(path.width)}" h="${emu(path.height)}" fill="norm" stroke="1">${commands}</a:path>`;
  }).join("");
  return `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/><a:pathLst>${pathXml}</a:pathLst></a:custGeom>`;
}

function gradientFillDrawingMl(fill, theme) {
  const stops = fill.stops.map((stop) => {
    const color = resolveColorSpec(stop.color, theme);
    const alpha = color.opacity < 1 ? `<a:alpha val="${Math.round(color.opacity * 100000)}"/>` : "";
    return `<a:gs pos="${Math.round(stop.offset)}"><a:srgbClr val="${pptxColor(color.color, theme)}">${alpha}</a:srgbClr></a:gs>`;
  }).join("");
  const kind = fill.gradientKind === "path"
    ? `<a:path path="${xmlEscape(fill.pathType ?? "circle")}"/>${fill.fillRect ? `<a:fillToRect${Object.entries(fill.fillRect).map(([key, value]) => ` ${key}="${Math.round(value)}"`).join("")}/>` : ""}`
    : `<a:lin ang="${Math.round(((fill.angleDeg ?? 0) % 360 + 360) % 360 * 60000)}" scaled="1"/>`;
  return `<a:gradFill rotWithShape="1"><a:gsLst>${stops}</a:gsLst>${kind}<a:tileRect/></a:gradFill>`;
}

function patternFillDrawingMl(fill, theme) {
  const aliases = { diagonalCross: "diagCross", downwardDiagonal: "dnDiag", upwardDiagonal: "upDiag", lightDown: "ltDnDiag", lightUp: "ltUpDiag", darkDown: "dkDnDiag", darkUp: "dkUpDiag" };
  const pattern = aliases[fill.pattern.type] ?? fill.pattern.type;
  const foreground = resolveColorSpec(fill.pattern.color ?? "#000000", theme);
  const background = resolveColorSpec(fill.color, theme);
  const colorXml = (resolved) => `<a:srgbClr val="${pptxColor(resolved.color, theme)}">${resolved.opacity < 1 ? `<a:alpha val="${Math.round(resolved.opacity * 100000)}"/>` : ""}</a:srgbClr>`;
  return `<a:pattFill prst="${xmlEscape(pattern)}"><a:fgClr>${colorXml(foreground)}</a:fgClr><a:bgClr>${colorXml(background)}</a:bgClr></a:pattFill>`;
}

function imageFillDrawingMl(fill, relationshipId) {
  const attrs = (values = {}) => Object.entries(values).map(([key, value]) => ` ${key}="${Math.round(value)}"`).join("");
  const alpha = fill.alphaModFix === undefined ? "" : `<a:alphaModFix amt="${Math.round(fill.alphaModFix)}"/>`;
  const sourceRect = fill.srcRect ? `<a:srcRect${attrs(fill.srcRect)}/>` : "";
  const fillRect = fill.fillRect ? `<a:fillRect${attrs(fill.fillRect)}/>` : "<a:fillRect/>";
  const stretchRect = fill.stretchFillRect ? `<a:fillRect${attrs(fill.stretchFillRect)}/>` : "";
  return `<a:blipFill>${sourceRect}<a:blip r:embed="${xmlEscape(relationshipId)}">${alpha}</a:blip><a:stretch>${fillRect}${stretchRect}</a:stretch></a:blipFill>`;
}

async function applyPresentationTheme(bytes, theme) {
  const zip = await JSZip.loadAsync(bytes);
  const part = zip.file("ppt/theme/theme1.xml");
  if (!part) return bytes;
  let xml = await part.async("string");
  const colors = theme._colorScheme.themeColors;
  const name = xmlEscape(theme._colorScheme.name);
  xml = xml.replace(/<a:clrScheme\b([^>]*)>/, (_tag, attributes) =>
    "<a:clrScheme" + attributes.replace(/\s+name="[^"]*"/, "") + " name=\"" + name + "\">");
  const themeEntries = [
    ["dk1", "tx1"], ["dk2", "tx2"], ["lt1", "bg1"], ["lt2", "bg2"],
    ...["accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"].map((key) => [key, key]),
  ];
  for (const [tag, key] of themeEntries) {
    const raw = colors[key];
    const color = typeof raw === "string" ? raw : raw?.color;
    if (typeof color !== "string") continue;
    const value = color.replace(/^#/, "").toUpperCase();
    if (!/^[0-9A-F]{6}$/.test(value)) continue;
    const expression = new RegExp(`<a:${tag}\\b[^>]*>[\\s\\S]*?<\\/a:${tag}>|<a:${tag}\\b[^>]*/>`);
    xml = xml.replace(expression, `<a:${tag}><a:srgbClr val="${value}"/></a:${tag}>`);
  }
  zip.file("ppt/theme/theme1.xml", xml);
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

function findPptxShapeForModel(xml, object) {
  const shapes = [...xml.matchAll(/<p:sp(?:\s[^>]*)?>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape);
  const marker = `ruxex_shape_${object.id}`;
  const marked = shapes.find((shape) => shape.includes(`name="${marker}"`));
  if (marked) return marked;
  const xfrm = object.options ?? {};
  const expected = [xfrm.x, xfrm.y, xfrm.w, xfrm.h].map((value) => Number.isFinite(value) ? Math.round(value * 9525) : undefined);
  if (expected.some((value) => value === undefined)) return undefined;
  const geometry = object.shape === "rect" && xfrm.borderRadius !== undefined ? "roundRect" : object.shape;
  return shapes.find((shape) => {
    const transform = /<a:xfrm\b[^>]*>([\s\S]*?)<\/a:xfrm>/.exec(shape)?.[1];
    const off = transform && /<a:off\b([^>]*)\/?\s*>/.exec(transform)?.[1];
    const ext = transform && /<a:ext\b([^>]*)\/?\s*>/.exec(transform)?.[1];
    if (!off || !ext) return false;
    const actual = ["x", "y"].map((key) => Number(new RegExp(`\\b${key}="(-?\\d+)"`).exec(off)?.[1]))
      .concat(["cx", "cy"].map((key) => Number(new RegExp(`\\b${key}="(\\d+)"`).exec(ext)?.[1])));
    if (actual.some((value, index) => !Number.isFinite(value) || Math.abs(value - expected[index]) > 2)) return false;
    if (!geometry) return true;
    const actualGeometry = /<a:prstGeom\b[^>]*\bprst="([^"]+)"/.exec(shape)?.[1];
    return actualGeometry === geometry || (geometry === "custom" && actualGeometry === "rect");
  });
}

async function mergePresetShapeText(bytes, presentationModel) {
  const zip = await JSZip.loadAsync(bytes);
  let changed = false;
  for (const [slideIndex, slide] of presentationModel.slides.items.entries()) {
    const part = zip.file(`ppt/slides/slide${slideIndex + 1}.xml`);
    if (!part) continue;
    let xml = await part.async("string");
    const backgroundFill = slide.background.fill;
    const customBackgroundFill = backgroundFill?.type === "gradient"
      ? gradientFillDrawingMl(backgroundFill, presentationModel.theme)
      : backgroundFill?.type === "solid" && backgroundFill.pattern
        ? patternFillDrawingMl(backgroundFill, presentationModel.theme)
        : undefined;
    if (customBackgroundFill) {
      const backgroundPart = /<p:bg(?:\s[^>]*)?>[\s\S]*?<\/p:bg>/.exec(xml)?.[0];
      if (backgroundPart) {
        const updatedBackground = backgroundPart.replace(/<p:bgPr\b([^>]*)>([\s\S]*?)<\/p:bgPr>/, (_match, attributes, children) => {
          const retained = children.replace(/<a:solidFill\b[^>]*>[\s\S]*?<\/a:solidFill>|<a:solidFill\b[^>]*\/>|<a:gradFill\b[^>]*>[\s\S]*?<\/a:gradFill>|<a:pattFill\b[^>]*>[\s\S]*?<\/a:pattFill>/g, "");
          return `<p:bgPr${attributes}>${customBackgroundFill}${retained}</p:bgPr>`;
        });
        if (updatedBackground !== backgroundPart) {
          xml = xml.replace(backgroundPart, updatedBackground);
          changed = true;
        }
      } else {
        xml = xml.replace("<p:spTree>", `<p:bg><p:bgPr>${customBackgroundFill}<a:effectLst/></p:bgPr></p:bg><p:spTree>`);
        changed = true;
      }
    }
    xml = normalizePlaceholderIndexes(xml, presentationModel.layouts.getItem(slide.layout, false));
    const shapeIds = new Map([...xml.matchAll(/<p:sp(?:\s[^>]*)?>[\s\S]*?<\/p:sp>/g)].map(([shape]) => {
      const id = /<p:cNvPr\b[^>]*\bid="(\d+)"/.exec(shape)?.[1];
      const name = /<p:cNvPr\b[^>]*\bname="([^"]*)"/.exec(shape)?.[1];
      return [name, id];
    }).filter(([name, id]) => name && id));
    for (const object of slide.objects.filter((candidate) => candidate.options.connector?.fromId || candidate.options.connector?.toId)) {
      const marker = `ruxex_shape_${object.id}`;
      const shape = [...xml.matchAll(/<p:sp(?:\s[^>]*)?>[\s\S]*?<\/p:sp>/g)].map(([item]) => item).find((item) => item.includes(`name="${marker}"`));
      const from = object.options.connector.fromId ? shapeIds.get(`ruxex_shape_${object.options.connector.fromId}`) ?? shapeIds.get(`ruxex_text_${object.options.connector.fromId}`) : undefined;
      const to = object.options.connector.toId ? shapeIds.get(`ruxex_shape_${object.options.connector.toId}`) ?? shapeIds.get(`ruxex_text_${object.options.connector.toId}`) : undefined;
      if (!shape || (object.options.connector.fromId && !from) || (object.options.connector.toId && !to)) continue;
      const connector = object.options.connector;
      const site = (index, side, fallback) => index ?? ({ top: 0, right: 1, bottom: 2, left: 3 }[side] ?? fallback);
      const startSite = site(connector.fromIdx, connector.fromSide, 1);
      const endSite = site(connector.toIdx, connector.toSide, 3);
      const kind = connector.kind ?? "straight";
      const geometry = kind === "curved" ? "curvedConnector3"
        : kind.startsWith("elbow") ? `bentConnector${kind.slice(5) || "3"}`
          : "straightConnector1";
      const updated = shape
        .replace(/<p:nvSpPr\b([^>]*)>/, "<p:nvCxnSpPr$1>")
        .replace("</p:nvSpPr>", "</p:nvCxnSpPr>")
        .replace(/<p:cNvSpPr\s*\/>/, `<p:cNvCxnSpPr>${from ? `<a:stCxn id="${from}" idx="${startSite}"/>` : ""}${to ? `<a:endCxn id="${to}" idx="${endSite}"/>` : ""}</p:cNvCxnSpPr>`)
        .replace(/<p:cNvSpPr\b([^>]*)>([\s\S]*?)<\/p:cNvSpPr>/, `<p:cNvCxnSpPr$1>${from ? `<a:stCxn id="${from}" idx="${startSite}"/>` : ""}${to ? `<a:endCxn id="${to}" idx="${endSite}"/>` : ""}$2</p:cNvCxnSpPr>`)
        .replace(/<a:prstGeom\b([^>]*)\bprst="[^"]*"/, `<a:prstGeom$1prst="${geometry}"`)
        .replace(/<a:ln\b([^>]*)>/, (_tag, attributes) => `<a:ln${attributes.replace(/\s+cap="[^"]*"/g, "")}${connector.cap ? ` cap="${connector.cap === "round" ? "rnd" : connector.cap === "square" ? "sq" : "flat"}"` : ""}>`)
        .replace(/<a:ln\b[^>]*>[\s\S]*?<\/a:ln>/, (line) => connector.join ? line.replace(/(<\/a:ln>)/, `${connector.join === "round" ? "<a:round/>" : connector.join === "bevel" ? "<a:bevel/>" : "<a:miter lim=\"800000\"/>"}$1`) : line)
        .replace(/^<p:sp\b/, "<p:cxnSp")
        .replace(/<\/p:sp>$/, "</p:cxnSp>");
      if (updated !== shape) {
        xml = xml.replace(shape, updated);
        changed = true;
      }
    }
    for (const [objectIndex, object] of slide.objects.entries()) {
      if (object.kind !== "shape" || object.text === undefined) continue;
      const marker = `ruxex_shape_${object.id}`;
      const textMarker = `${marker}_text`;
      const shapes = [...xml.matchAll(/<p:sp(?:\s[^>]*)?>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape);
      const shapeXml = shapes.find((shape) => shape.includes(`name="${marker}"`));
      const textXml = shapes.find((shape) => shape.includes(`name="${textMarker}"`));
      let textBody = textXml?.match(/<p:txBody(?:\s[^>]*)?>[\s\S]*?<\/p:txBody>/)?.[0];
      if (!shapeXml || !textXml || !textBody) continue;
      textBody = applyParagraphMetadata(textBody, object.textParagraphs);
      const visibleName = object.options?.name ?? `Shape ${objectIndex + 1}`;
      const mergedShape = shapeXml
        .replace(`name="${marker}"`, `name="${xmlEscape(visibleName)}"`)
        .replace("</p:sp>", `${textBody}</p:sp>`);
      xml = xml.replace(shapeXml, mergedShape).replace(textXml, "");
      changed = true;
    }
    for (const object of slide.objects.filter((candidate) => candidate.kind === "text" && candidate.textParagraphs?.length)) {
      const marker = `ruxex_text_${object.id}`;
      const shapes = [...xml.matchAll(/<p:sp(?:\s[^>]*)?>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape);
      const shape = shapes.find((item) => item.includes(`name="${marker}"`));
      if (!shape) continue;
      const body = shape.match(/<p:txBody(?:\s[^>]*)?>[\s\S]*?<\/p:txBody>/)?.[0];
      if (!body) continue;
      const updatedBody = applyParagraphMetadata(body, object.textParagraphs);
      if (updatedBody !== body) {
        xml = xml.replace(shape, shape.replace(body, updatedBody));
        changed = true;
      }
    }
    for (const object of slide.objects.filter((candidate) => candidate.kind === "shape" && candidate.shape === "custom" && candidate.options.customPaths)) {
      const marker = `ruxex_shape_${object.id}`;
      const shape = [...xml.matchAll(/<p:sp(?:\s[^>]*)?>[\s\S]*?<\/p:sp>/g)].map(([item]) => item).find((item) => item.includes(`name="${marker}"`));
      if (!shape) continue;
      const updated = shape.replace(/<a:prstGeom\b[^>]*>[\s\S]*?<\/a:prstGeom>|<a:prstGeom\b[^>]*\/>/, customPathsDrawingMl(object.options.customPaths));
      if (updated !== shape) {
        xml = xml.replace(shape, updated);
        changed = true;
      }
    }
    for (const object of slide.objects.filter((candidate) => candidate.kind === "shape" && candidate.options.fill?.type === "gradient")) {
      const shape = findPptxShapeForModel(xml, object);
      if (!shape) continue;
      const properties = shape.match(/<p:spPr(?:\s[^>]*)?>[\s\S]*?<\/p:spPr>/)?.[0];
      if (!properties) continue;
      const updatedProperties = properties.replace(/<a:solidFill\b[^>]*>[\s\S]*?<\/a:solidFill>|<a:solidFill\b[^>]*\/>/, gradientFillDrawingMl(object.options.fill, presentationModel.theme));
      if (updatedProperties !== properties) {
        xml = xml.replace(shape, shape.replace(properties, updatedProperties));
        changed = true;
      }
    }
    for (const object of slide.objects.filter((candidate) => candidate.kind === "shape" && candidate.options.fill?.type === "solid" && candidate.options.fill.pattern)) {
      const shape = findPptxShapeForModel(xml, object);
      const properties = shape?.match(/<p:spPr(?:\s[^>]*)?>[\s\S]*?<\/p:spPr>/)?.[0];
      if (!shape || !properties) continue;
      const updatedProperties = properties.replace(/<a:solidFill\b[^>]*>[\s\S]*?<\/a:solidFill>|<a:solidFill\b[^>]*\/>/, patternFillDrawingMl(object.options.fill, presentationModel.theme));
      if (updatedProperties !== properties) {
        xml = xml.replace(shape, shape.replace(properties, updatedProperties));
        changed = true;
      }
    }
    for (const object of slide.objects.filter((candidate) => candidate.kind === "shape" && (candidate.options.line?.fill?.type === "gradient" || (candidate.options.line?.fill?.type === "solid" && candidate.options.line.fill.pattern)))) {
      const shape = findPptxShapeForModel(xml, object);
      const properties = shape?.match(/<p:spPr(?:\s[^>]*)?>[\s\S]*?<\/p:spPr>/)?.[0];
      const line = properties?.match(/<a:ln\b[^>]*>[\s\S]*?<\/a:ln>|<a:ln\b[^>]*\/>/)?.[0];
      if (!shape || !properties || !line) continue;
      const fill = object.options.line.fill.type === "gradient"
        ? gradientFillDrawingMl(object.options.line.fill, presentationModel.theme)
        : patternFillDrawingMl(object.options.line.fill, presentationModel.theme);
      const updatedLine = /<a:solidFill\b[^>]*>[\s\S]*?<\/a:solidFill>|<a:solidFill\b[^>]*\/>/.test(line)
        ? line.replace(/<a:solidFill\b[^>]*>[\s\S]*?<\/a:solidFill>|<a:solidFill\b[^>]*\/>/, fill)
        : line.replace(/(<a:ln\b[^>]*>)/, `$1${fill}`);
      if (updatedLine !== line) {
        xml = xml.replace(shape, shape.replace(line, updatedLine));
        changed = true;
      }
    }
    const imageFills = slide.objects.filter((candidate) => candidate.kind === "shape" && candidate.options.fill?.type === "image");
    if (imageFills.length > 0) {
      const rels = zip.file(`ppt/slides/_rels/slide${slideIndex + 1}.xml.rels`);
      const relationXml = rels ? await rels.async("string") : "";
      const pictureEmbeds = [...xml.matchAll(/<p:pic\b[^>]*>[\s\S]*?<\/p:pic>/g)].map(([picture]) => /<a:blip\b[^>]*\br:embed="([^"]+)"/.exec(picture)?.[1]);
      const images = slide.objects.filter((candidate) => candidate.kind === "image");
      for (const object of imageFills) {
        const imageIndex = images.findIndex((image) => image.id === object.options.fill.imageReference.id);
        const relationshipId = imageIndex >= 0 ? pictureEmbeds[imageIndex] : undefined;
        if (!relationshipId || !relationXml.includes(`Id="${relationshipId}"`)) throw new ArtifactToolError("invalid_fill_reference", `image fill reference cannot be resolved in PPTX output: ${object.options.fill.imageReference.id}`);
        const shape = findPptxShapeForModel(xml, object);
        const properties = shape?.match(/<p:spPr(?:\s[^>]*)?>[\s\S]*?<\/p:spPr>/)?.[0];
        if (!shape || !properties) continue;
        const drawingMl = imageFillDrawingMl(object.options.fill, relationshipId);
        const updatedProperties = properties.replace(/<a:solidFill\b[^>]*>[\s\S]*?<\/a:solidFill>|<a:solidFill\b[^>]*\/>|<a:noFill\s*\/>/, drawingMl);
        if (updatedProperties !== properties) {
          xml = xml.replace(shape, shape.replace(properties, updatedProperties));
          changed = true;
        }
      }
    }
    const images = slide.objects.filter((object) => object.kind === "image");
    for (let imageIndex = 0; imageIndex < images.length; imageIndex += 1) {
      const object = images[imageIndex];
      const crop = await pptxImageCrop(object.src, object.options);
      const pictures = [...xml.matchAll(/<p:pic(?:\s[^>]*)?>[\s\S]*?<\/p:pic>/g)].map(([picture]) => picture);
      const picture = pictures[imageIndex];
      if (!picture) continue;
      const attributes = Object.entries(crop)
        .map(([edge, value]) => `${edge === "left" ? "l" : edge === "right" ? "r" : edge === "top" ? "t" : "b"}="${Math.round(value * 100000)}"`)
        .join(" ");
      let croppedPicture = picture;
      if (Object.values(crop).some((value) => value !== 0)) {
        croppedPicture = croppedPicture.replace(/<p:blipFill(?:\s[^>]*)?>[\s\S]*?<\/p:blipFill>/, (fill) => {
          const srcRect = `<a:srcRect ${attributes}/>`;
          if (/<a:srcRect\b[^>]*\/>/.test(fill)) return fill.replace(/<a:srcRect\b[^>]*\/>/, srcRect);
          return fill.replace(/(<a:stretch\b)/, `${srcRect}$1`);
        });
      }
      const geometry = object.options.geometry ?? (object.options.borderRadius ? "roundRect" : "rect");
      if (geometry !== "rect") {
        croppedPicture = croppedPicture.replace(/<a:prstGeom\b([^>]*)\bprst="[^"]*"/, `<a:prstGeom$1prst="${xmlEscape(geometry)}"`);
      }
      if (geometry === "roundRect" && object.options.borderRadius !== undefined) {
        const { w, h } = object.options;
        if (Number.isFinite(w) && Number.isFinite(h) && Math.min(w, h) > 0) {
          const radius = resolveImageBorderRadius(object.options.borderRadius, Math.min(w, h));
          const adjustment = Math.round(Math.min(0.5, radius / Math.min(w, h)) * 100000);
          croppedPicture = croppedPicture.replace(/(<a:prstGeom\b[^>]*prst="roundRect"[^>]*>)<a:avLst\s*(?:\/>|>\s*<\/a:avLst>)/, `$1<a:avLst><a:gd name="adj" fmla="val ${adjustment}"/></a:avLst>`);
        }
      }
      if (croppedPicture !== picture) {
        xml = xml.replace(picture, croppedPicture);
        changed = true;
      }
    }
    const styledTables = slide.objects.filter((object) => object.kind === "table" && object.options.style);
    if (styledTables.length > 0) {
      const tables = [...xml.matchAll(/<a:tbl(?:\s[^>]*)?>[\s\S]*?<\/a:tbl>/g)].map(([table]) => table);
      for (const [index, object] of styledTables.entries()) {
        const table = tables[index];
        if (!table) continue;
        const rawId = object.options.style.trim();
        const styleId = /^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?$/i.test(rawId)
          ? rawId.replace(/^\{?/, "{").replace(/\}?$/, "}").toUpperCase()
          : rawId;
        const styled = table.includes("<a:tblPr/>")
          ? table.replace("<a:tblPr/>", `<a:tblPr><a:tableStyleId val="${xmlEscape(styleId)}"/></a:tblPr>`)
          : table.replace(/<a:tblPr\b([^>]*)>/, `<a:tblPr$1><a:tableStyleId val="${xmlEscape(styleId)}"/>`);
        xml = xml.replace(table, styled);
        changed ||= styled !== table;
      }
    }
    if (xml !== await part.async("string")) zip.file(`ppt/slides/slide${slideIndex + 1}.xml`, xml);
  }
  const viewPart = zip.file("ppt/viewProps.xml");
  if (viewPart) {
    let viewXml = await viewPart.async("string");
    const guides = presentationModel.view.guidesVisible ? "1" : "0";
    viewXml = viewXml.replace(/<p:cSldViewPr\b([^>]*)>/, (_tag, attributes) => {
      const updated = attributes.replace(/\s+showGuides="[^"]*"/, "");
      return `<p:cSldViewPr${updated} showGuides="${guides}">`;
    });
    viewXml = viewXml.replace(/<p:gridSpacing\b[^>]*\/>/, `<p:gridSpacing cx="${presentationModel.view.gridSpacingCxEmu}" cy="${presentationModel.view.gridSpacingCyEmu}"/>`);
    if (viewXml !== await viewPart.async("string")) {
      zip.file("ppt/viewProps.xml", viewXml);
      changed = true;
    }
  }
  const patchedLayouts = new Set();
  for (const [index, slide] of presentationModel.slides.items.entries()) {
    const layout = presentationModel.layouts.getItem(slide.layout, false);
    if (!layout) continue;
    const rels = zip.file(`ppt/slides/_rels/slide${index + 1}.xml.rels`);
    if (!rels) continue;
    const relsXml = await rels.async("string");
    const relationship = [...relsXml.matchAll(/<Relationship\b[^>]*>/g)]
      .map(([tag]) => tag)
      .find((tag) => /\/slideLayout$/.test(/\bType="([^"]+)"/.exec(tag)?.[1] ?? ""));
    const target = relationship && /\bTarget="([^"]+)"/.exec(relationship)?.[1];
    if (!target) continue;
    const layoutPartName = resolvePackageTarget(target, "ppt/slides");
    if (patchedLayouts.has(layoutPartName)) continue;
    const layoutPart = zip.file(layoutPartName);
    if (!layoutPart) continue;
    let layoutXml = await layoutPart.async("string");
    layoutXml = normalizePlaceholderIndexes(layoutXml, layout);
    for (const item of layout._placeholders) {
      const nativeType = pptxPlaceholderType(item.type);
      const shape = [...layoutXml.matchAll(/<p:sp(?:\s[^>]*)?>[\s\S]*?<\/p:sp>/g)]
        .map(([entry]) => entry)
        .find((entry) => {
          const match = /<p:ph\b([^>]*)>/.exec(entry);
          return match && /\btype="([^"]+)"/.exec(match[1])?.[1] === nativeType && Number(/\bidx="(\d+)"/.exec(match[1])?.[1]) === item.index;
        });
      if (!shape) continue;
      let updated = shape;
      if (item.geometry === "custom" && item.style.customPaths) {
        updated = updated.replace(/<a:prstGeom\b[^>]*>[\s\S]*?<\/a:prstGeom>|<a:prstGeom\b[^>]*\/>/, customPathsDrawingMl(item.style.customPaths));
      } else if (item.geometry !== "textbox") {
        updated = updated.replace(/(<a:prstGeom\b[^>]*\bprst=")[^"]+"/, `$1${xmlEscape(item.geometry)}"`);
      }
      if (updated !== shape) layoutXml = layoutXml.replace(shape, updated);
    }
    const marker = `RUXEX_LAYOUT - ${layout.name}`;
    layoutXml = layoutXml.replace(/<p:cSld\b([^>]*)>/, (_tag, attributes) => {
      const updated = attributes.replace(/\s+name="[^"]*"/, "");
      return `<p:cSld${updated} name="${xmlEscape(marker)}">`;
    });
    zip.file(layoutPartName, layoutXml);
    patchedLayouts.add(layoutPartName);
    changed = true;
  }
  const patchedMasterParts = new Set();
  for (const [slideIndex, slide] of presentationModel.slides.items.entries()) {
    const layout = presentationModel.layouts.getItem(slide.layout, false);
    const masterModel = layout && presentationModel.masters._items.find((item) => item.id === layout.parentMasterId);
    if (!layout || !masterModel || patchedMasterParts.has(masterModel.id)) continue;
    const slideRels = zip.file(`ppt/slides/_rels/slide${slideIndex + 1}.xml.rels`);
    if (!slideRels) continue;
    const slideRelsXml = await slideRels.async("string");
    const layoutTarget = [...slideRelsXml.matchAll(/<Relationship\b[^>]*>/g)].map(([tag]) => tag)
      .find((tag) => /\/slideLayout$/.test(/\bType="([^"]+)"/.exec(tag)?.[1] ?? ""));
    const layoutPath = layoutTarget && resolvePackageTarget(/\bTarget="([^"]+)"/.exec(layoutTarget)?.[1] ?? "", "ppt/slides");
    if (!layoutPath) continue;
    const layoutRelsPath = `${layoutPath.slice(0, layoutPath.lastIndexOf("/"))}/_rels/${layoutPath.slice(layoutPath.lastIndexOf("/") + 1)}.rels`;
    const layoutRels = zip.file(layoutRelsPath);
    if (!layoutRels) continue;
    const layoutRelsXml = await layoutRels.async("string");
    const masterRelationship = [...layoutRelsXml.matchAll(/<Relationship\b[^>]*>/g)].map(([tag]) => tag)
      .find((tag) => /\/slideMaster$/.test(/\bType="([^"]+)"/.exec(tag)?.[1] ?? ""));
    const masterTarget = masterRelationship && /\bTarget="([^"]+)"/.exec(masterRelationship)?.[1];
    const masterPath = masterTarget && resolvePackageTarget(masterTarget, "ppt/slideLayouts");
    const masterPart = masterPath && zip.file(masterPath);
    if (!masterPart) continue;
    let masterXml = await masterPart.async("string");
    const colorMap = masterModel.colorMap ?? {};
    masterXml = masterXml.replace(/<p:clrMap\b([^>]*?)(\s*\/?>)/, (_tag, rawAttributes, close) => {
      let attributes = rawAttributes;
      for (const [key, value] of Object.entries(colorMap)) {
        const matcher = new RegExp(`\\s${key}="[^"]*"`);
        attributes = matcher.test(attributes) ? attributes.replace(matcher, ` ${key}="${xmlEscape(value)}"`) : `${attributes} ${key}="${xmlEscape(value)}"`;
      }
      return `<p:clrMap${attributes}${close}`;
    });
    if (masterXml !== await masterPart.async("string")) {
      zip.file(masterPath, masterXml);
      changed = true;
    }
    patchedMasterParts.add(masterModel.id);
  }
  return changed ? zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }) : bytes;
}

function resolvePackageTarget(target, base) {
  const parts = target.startsWith("/") ? [] : base.split("/");
  for (const part of target.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

export async function exportPresentationPptx(presentationModel, outputPath, options = {}) {
  const presentation = await createPptxGenerator(presentationModel, options);
  await mkdir(dirname(outputPath), { recursive: true });
  await presentation.writeFile({ fileName: outputPath });
  return { ok: true, format: "pptx", output: outputPath };
}
