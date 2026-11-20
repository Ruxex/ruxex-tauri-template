import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  AlignmentType,
  Bookmark,
  BorderStyle,
  CommentRangeEnd,
  CommentRangeStart,
  CommentReference,
  DeletedTextRun,
  Document as DocxDocument,
  DocumentProtectionType,
  EndnoteReferenceRun,
  ExternalHyperlink,
  FootnoteReferenceRun,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  InsertedTextRun,
  InternalHyperlink,
  LevelFormat,
  PageOrientation,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  SectionType,
  SimpleField,
  TableLayoutType,
  WidthType,
} from "docx";
import { TextWatermark } from "docx/watermarks";

import { ArtifactToolError } from "./a1-range.mjs";
import { runEngine } from "./engine-client.mjs";

const TWIPS_PER_INCH = 1440;
const TWIPS_PER_POINT = 20;
const PAGE_SIZES = {
  letter: { width: 12240, height: 15840 },
  a4: { width: 11906, height: 16838 },
};
const ALIGNMENTS = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};
const PAGE_ORIENTATIONS = {
  portrait: PageOrientation.PORTRAIT,
  landscape: PageOrientation.LANDSCAPE,
};
const SECTION_TYPES = {
  nextPage: SectionType.NEXT_PAGE,
  nextColumn: SectionType.NEXT_COLUMN,
  continuous: SectionType.CONTINUOUS,
  evenPage: SectionType.EVEN_PAGE,
  oddPage: SectionType.ODD_PAGE,
};
const LIST_NUMBERING = {
  config: [
    {
      reference: "ruxex-bullets",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT }],
    },
    {
      reference: "ruxex-numbered",
      levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT }],
    },
  ],
};
const DOCX_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
};

function optionObject(value, field, allowed) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ArtifactToolError("invalid_document_options", `${field} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new ArtifactToolError(
        "invalid_document_options",
        `unsupported ${field} option: ${key}`,
      );
    }
  }
  return value;
}

function boundedNumber(value, field, minimum, maximum) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new ArtifactToolError(
      "invalid_document_options",
      `${field} must be a finite number from ${minimum} to ${maximum}`,
    );
  }
  return value;
}

function normalizeDocumentOptions(options = {}) {
  const normalized = optionObject(
    options,
    "document",
    ["title", "pageSize", "orientation", "margins", "items", "sourcePath", "lossDiagnostics"],
  );
  if (normalized.title !== undefined && typeof normalized.title !== "string") {
    throw new ArtifactToolError("invalid_document_options", "title must be a string");
  }
  if (normalized.pageSize !== undefined && !Object.hasOwn(PAGE_SIZES, normalized.pageSize)) {
    throw new ArtifactToolError("invalid_document_options", "pageSize must be 'letter' or 'a4'");
  }
  if (normalized.orientation !== undefined && !Object.hasOwn(PAGE_ORIENTATIONS, normalized.orientation)) {
    throw new ArtifactToolError(
      "invalid_document_options",
      "orientation must be 'portrait' or 'landscape'",
    );
  }
  const margins = optionObject(normalized.margins, "margins", ["top", "right", "bottom", "left"]);
  for (const [side, value] of Object.entries(margins)) {
    boundedNumber(value, `margins.${side}`, 0, 3);
  }
  return { ...normalized, margins: Object.keys(margins).length ? { ...margins } : undefined };
}

function normalizeSectionOptions(options = {}) {
  const normalized = optionObject(options, "section", ["pageSize", "orientation", "margins", "type"]);
  const layout = normalizeDocumentOptions({
    pageSize: normalized.pageSize,
    orientation: normalized.orientation,
    margins: normalized.margins,
  });
  if (normalized.type !== undefined && !Object.hasOwn(SECTION_TYPES, normalized.type)) {
    throw new ArtifactToolError("invalid_document_options", "section type is not supported");
  }
  return {
    ...layout,
    type: normalized.type ?? "nextPage",
    header: null,
    footer: null,
    watermark: null,
  };
}

function normalizeParagraphOptions(options = {}) {
  const normalized = optionObject(
    options,
    "paragraph",
    [
      "alignment",
      "spacingBefore",
      "spacingAfter",
      "bold",
      "italic",
      "fontFace",
      "fontSize",
      "color",
      "keepWithNext",
      "pageBreakBefore",
    ],
  );
  if (normalized.alignment !== undefined && !Object.hasOwn(ALIGNMENTS, normalized.alignment)) {
    throw new ArtifactToolError(
      "invalid_document_options",
      "alignment must be left, center, right, or justify",
    );
  }
  for (const key of ["spacingBefore", "spacingAfter"]) {
    if (normalized[key] !== undefined) boundedNumber(normalized[key], key, 0, 1000);
  }
  for (const key of ["bold", "italic"]) {
    if (normalized[key] !== undefined && typeof normalized[key] !== "boolean") {
      throw new ArtifactToolError("invalid_document_options", `${key} must be a boolean`);
    }
  }
  if (normalized.fontFace !== undefined && typeof normalized.fontFace !== "string") {
    throw new ArtifactToolError("invalid_document_options", "fontFace must be a string");
  }
  if (normalized.fontSize !== undefined) boundedNumber(normalized.fontSize, "fontSize", 1, 96);
  if (normalized.color !== undefined) {
    if (typeof normalized.color !== "string" || !/^#?[0-9a-f]{6}$/i.test(normalized.color)) {
      throw new ArtifactToolError("invalid_document_options", "color must be a six-digit hex value");
    }
    normalized.color = normalized.color.replace(/^#/, "").toUpperCase();
  }
  for (const key of ["keepWithNext", "pageBreakBefore"]) {
    if (normalized[key] !== undefined && typeof normalized[key] !== "boolean") {
      throw new ArtifactToolError("invalid_document_options", `${key} must be a boolean`);
    }
  }
  return { ...normalized };
}

function normalizeTableOptions(options = {}) {
  const normalized = optionObject(
    options,
    "table",
    ["headerRow", "borders", "cellPadding", "columnWidths", "width", "indent", "layout"],
  );
  for (const key of ["headerRow", "borders"]) {
    if (normalized[key] !== undefined && typeof normalized[key] !== "boolean") {
      throw new ArtifactToolError("invalid_document_options", `${key} must be a boolean`);
    }
  }
  if (normalized.cellPadding !== undefined) {
    boundedNumber(normalized.cellPadding, "cellPadding", 0, 72);
  }
  if (normalized.columnWidths !== undefined) {
    if (!Array.isArray(normalized.columnWidths) || normalized.columnWidths.length === 0) {
      throw new ArtifactToolError("invalid_document_options", "columnWidths must be a non-empty array of widths in inches");
    }
    normalized.columnWidths.forEach((value, index) => boundedNumber(value, `columnWidths[${index}]`, 0.1, 20));
  }
  for (const key of ["width", "indent"]) {
    if (normalized[key] !== undefined) boundedNumber(normalized[key], key, 0, 30);
  }
  if (normalized.layout !== undefined && !["fixed", "autofit"].includes(normalized.layout)) {
    throw new ArtifactToolError("invalid_document_options", "table layout must be fixed or autofit");
  }
  return { ...normalized };
}

function normalizeImageOptions(data, options = {}) {
  const normalized = optionObject(options, "image", ["type", "width", "height", "altText", "decorative"]);
  if (!(data instanceof Uint8Array || data instanceof ArrayBuffer || typeof data === "string")) {
    throw new ArtifactToolError("invalid_document_options", "image data must be bytes or a data URI");
  }
  const byteLength = typeof data === "string"
    ? Math.ceil(data.length * 0.75)
    : data.byteLength;
  if (byteLength === 0 || byteLength > 16 * 1024 * 1024) {
    throw new ArtifactToolError("invalid_document_options", "image data must be 1 byte to 16 MiB");
  }
  if (!Object.hasOwn({ png: true, jpg: true, gif: true, bmp: true }, normalized.type)) {
    throw new ArtifactToolError("invalid_document_options", "image type must be png, jpg, gif, or bmp");
  }
  for (const dimension of ["width", "height"]) {
    boundedNumber(normalized[dimension], dimension, 1, 4000);
  }
  if (normalized.decorative !== undefined && typeof normalized.decorative !== "boolean") {
    throw new ArtifactToolError("invalid_document_options", "decorative must be a boolean");
  }
  if (normalized.altText !== undefined && typeof normalized.altText !== "string") {
    throw new ArtifactToolError("invalid_document_options", "altText must be a string");
  }
  if (normalized.decorative !== true && !normalized.altText?.trim()) {
    throw new ArtifactToolError(
      "invalid_document_options",
      "informative images require non-empty altText; mark decorative images explicitly",
    );
  }
  return { ...normalized };
}

function validateCell(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  throw new ArtifactToolError(
    "unsupported_cell_value",
    "document tables support strings, numbers, booleans, and null",
  );
}

function validateRows(rows) {
  if (!Array.isArray(rows) || !rows.every(Array.isArray) || rows.length === 0) {
    throw new ArtifactToolError("invalid_table", "document tables must be a non-empty matrix");
  }
  const width = rows[0].length;
  if (width === 0 || rows.some((row) => row.length !== width)) {
    throw new ArtifactToolError("invalid_table", "document tables must be rectangular");
  }
  rows.flat().forEach(validateCell);
}

function displayCell(value) {
  return value === null ? "" : String(value);
}

function headingLevel(level) {
  const normalized = Number(level ?? 1);
  const heading = HeadingLevel[`HEADING_${normalized}`];
  if (!heading) {
    throw new ArtifactToolError("invalid_heading_level", "document heading level must be 1-9");
  }
  return heading;
}

function paragraphFor(item) {
  if (item.kind === "pageBreak") return new Paragraph({ pageBreakBefore: true });
  if (item.kind === "field") {
    return new Paragraph({ children: [new SimpleField(item.instruction, item.display)] });
  }
  if (item.kind === "bookmark") {
    return new Paragraph({
      children: [new Bookmark({ id: item.name, children: [new TextRun(item.text)] })],
    });
  }
  if (item.kind === "internalLink") {
    return new Paragraph({
      children: [
        new InternalHyperlink({ children: [new TextRun({ text: item.text, style: "Hyperlink" })], anchor: item.anchor }),
      ],
    });
  }
  if (item.kind === "externalLink") {
    return new Paragraph({
      children: [
        new ExternalHyperlink({ children: [new TextRun({ text: item.text, style: "Hyperlink" })], link: item.url }),
      ],
    });
  }
  if (item.kind === "image") {
    return new Paragraph({
      children: [
        new ImageRun({
          data: item.data,
          type: item.options.type,
          transformation: { width: item.options.width, height: item.options.height },
          altText: { description: item.options.decorative ? "" : item.options.altText },
        }),
      ],
    });
  }
  if (item.kind === "listItem") {
    return new Paragraph({
      numbering: {
        reference: item.type === "numbered" ? "ruxex-numbered" : "ruxex-bullets",
        level: 0,
      },
      children: [new TextRun({ text: item.text })],
    });
  }
  if (item.kind === "trackedReplacement") {
    return new Paragraph({
      children: [
        new DeletedTextRun({
          id: item.deletionId,
          author: item.author,
          date: item.date,
          text: item.oldText,
        }),
        new InsertedTextRun({
          id: item.insertionId,
          author: item.author,
          date: item.date,
          text: item.newText,
        }),
      ],
    });
  }
  if (item.kind === "title" || item.kind === "subtitle" || item.kind === "heading") {
    const heading = item.kind === "title"
      ? HeadingLevel.TITLE
      : item.kind === "heading"
        ? headingLevel(item.level)
        : undefined;
    return new Paragraph({
      ...(heading ? { heading } : { style: "Subtitle" }),
      children: [new TextRun({ text: item.text, color: "000000" })],
    });
  }
  const options = item.options ?? {};
  const paragraph = {};
  if (options.alignment) paragraph.alignment = ALIGNMENTS[options.alignment];
  if (options.spacingBefore !== undefined || options.spacingAfter !== undefined) {
    paragraph.spacing = {
      ...(options.spacingBefore === undefined
        ? {}
        : { before: options.spacingBefore * TWIPS_PER_POINT }),
      ...(options.spacingAfter === undefined
        ? {}
        : { after: options.spacingAfter * TWIPS_PER_POINT }),
    };
  }
  if (options.keepWithNext !== undefined) paragraph.keepNext = options.keepWithNext;
  if (options.pageBreakBefore !== undefined) paragraph.pageBreakBefore = options.pageBreakBefore;
  const comments = item.comments ?? [];
  const children = [
    ...comments.map((comment) => new CommentRangeStart(comment.id)),
    new TextRun({
      text: item.text,
      ...(options.bold === undefined ? {} : { bold: options.bold }),
      ...(options.italic === undefined ? {} : { italics: options.italic }),
      ...(options.fontFace === undefined ? {} : { font: options.fontFace }),
      ...(options.fontSize === undefined ? {} : { size: options.fontSize * 2 }),
      ...(options.color === undefined ? {} : { color: options.color }),
    }),
    ...(item.footnotes ?? []).map((note) =>
      new FootnoteReferenceRun({ children: [new Paragraph(note.text)] }),
    ),
    ...(item.endnotes ?? []).map((note) =>
      new EndnoteReferenceRun({ children: [new Paragraph(note.text)] }),
    ),
    ...comments.flatMap((comment) => [
      new CommentRangeEnd(comment.id),
      new TextRun({ children: [new CommentReference(comment.id)] }),
    ]),
  ];
  return new Paragraph({
    ...paragraph,
    children,
  });
}

function tableFor(item) {
  const { rows, options = {} } = item;
  if (options.columnWidths && options.columnWidths.length !== rows[0].length) {
    throw new ArtifactToolError("invalid_document_options", "columnWidths length must match the table column count");
  }
  const cellMargins = options.cellPadding === undefined
    ? undefined
    : Object.fromEntries(
        ["top", "right", "bottom", "left"].map((side) => [
          side,
          options.cellPadding * TWIPS_PER_POINT,
        ]),
      );
  return new Table({
    ...(options.columnWidths ? { columnWidths: options.columnWidths.map((inches) => inches * TWIPS_PER_INCH) } : {}),
    ...(options.width === undefined ? {} : { width: { size: options.width * TWIPS_PER_INCH, type: WidthType.DXA } }),
    ...(options.indent === undefined ? {} : { indent: { size: options.indent * TWIPS_PER_INCH, type: WidthType.DXA } }),
    ...(options.layout ? { layout: options.layout === "fixed" ? TableLayoutType.FIXED : TableLayoutType.AUTOFIT } : {}),
    rows: rows.map(
      (row, rowIndex) =>
        new TableRow({
          ...(options.headerRow && rowIndex === 0 ? { tableHeader: true } : {}),
          children: row.map(
            (value) =>
              new TableCell({
                ...(options.headerRow && rowIndex === 0
                  ? { shading: { fill: "EAF0F6", color: "auto" } }
                  : {}),
                ...(cellMargins ? { margins: cellMargins } : {}),
                ...(options.borders ? { borders: DOCX_BORDERS } : {}),
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: displayCell(value),
                        ...(options.headerRow && rowIndex === 0 ? { bold: true } : {}),
                      }),
                    ],
                  }),
                ],
              }),
          ),
        }),
    ),
    ...(options.borders ? { borders: DOCX_BORDERS } : {}),
  });
}

export class Document {
  constructor(options = {}) {
    const normalized = normalizeDocumentOptions(options);
    this.title = normalized.title ?? "";
    this.pageSize = normalized.pageSize;
    this.orientation = normalized.orientation ?? "portrait";
    this.margins = normalized.margins;
    this.items = normalized.items ? [...normalized.items] : [];
    this.sourcePath = normalized.sourcePath;
    this.lossDiagnostics = normalized.lossDiagnostics ? [...normalized.lossDiagnostics] : [];
    this.comments = [];
    this.protection = null;
    this.nextRevisionId = 0;
    this.bookmarks = new Set();
    this.sections = [{
      pageSize: this.pageSize ?? "letter",
      orientation: this.orientation,
      margins: this.margins,
      type: "nextPage",
      header: null,
      footer: null,
      watermark: null,
    }];
    this.currentSection = 0;
  }

  pushItem(item) {
    this.items.push({ ...item, sectionIndex: this.currentSection });
    return this;
  }

  static async create(options = {}) {
    return new Document(options);
  }

  static async load(inputPath) {
    const bytes = await readFile(inputPath);
    if (bytes.subarray(0, 2).toString() !== "PK") {
      throw new ArtifactToolError("invalid_ooxml_package", `not a DOCX package: ${inputPath}`);
    }
    const response = await runEngine({ version: 1, operation: "docx_read", input_path: inputPath });
    return new Document({
      sourcePath: inputPath,
      items: response.items ?? [],
      lossDiagnostics: response.diagnostics ?? [],
    });
  }

  addParagraph(text, options = {}) {
    if (typeof text !== "string") {
      throw new ArtifactToolError("invalid_text", "document paragraph text must be a string");
    }
    return this.pushItem({ kind: "paragraph", text, options: normalizeParagraphOptions(options) });
  }

  addHeading(text, level = 1) {
    if (typeof text !== "string") {
      throw new ArtifactToolError("invalid_text", "document heading text must be a string");
    }
    headingLevel(level);
    return this.pushItem({ kind: "heading", text, level: Number(level) });
  }

  addTitle(text) {
    if (typeof text !== "string") {
      throw new ArtifactToolError("invalid_text", "document title text must be a string");
    }
    return this.pushItem({ kind: "title", text });
  }

  addSubtitle(text) {
    if (typeof text !== "string") {
      throw new ArtifactToolError("invalid_text", "document subtitle text must be a string");
    }
    return this.pushItem({ kind: "subtitle", text });
  }

  addListItem(text, options = {}) {
    if (typeof text !== "string") {
      throw new ArtifactToolError("invalid_text", "document list item text must be a string");
    }
    const normalized = optionObject(options, "list item", ["type"]);
    if (normalized.type !== "bullet" && normalized.type !== "numbered") {
      throw new ArtifactToolError("invalid_document_options", "list item type must be bullet or numbered");
    }
    return this.pushItem({ kind: "listItem", text, type: normalized.type });
  }

  addPageBreak() {
    return this.pushItem({ kind: "pageBreak" });
  }

  addTableOfContents(options = {}) {
    const normalized = optionObject(options, "table of contents", ["title", "headingStyleRange", "hyperlink"]);
    if (normalized.title !== undefined && typeof normalized.title !== "string") {
      throw new ArtifactToolError("invalid_document_options", "table of contents title must be a string");
    }
    const headingStyleRange = normalized.headingStyleRange ?? "1-3";
    if (typeof headingStyleRange !== "string" || !/^[1-9]-[1-9]$/.test(headingStyleRange)
      || Number(headingStyleRange[0]) > Number(headingStyleRange[2])) {
      throw new ArtifactToolError("invalid_document_options", "headingStyleRange must be a valid heading range from 1 to 9");
    }
    if (normalized.hyperlink !== undefined && typeof normalized.hyperlink !== "boolean") {
      throw new ArtifactToolError("invalid_document_options", "table of contents hyperlink must be a boolean");
    }
    if (normalized.title) this.addHeading(normalized.title, 1);
    return this.pushItem({
      kind: "tableOfContents",
      options: { headingStyleRange, hyperlink: normalized.hyperlink ?? true },
    });
  }

  addBookmark(name, text = name) {
    if (typeof name !== "string" || !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(name)) {
      throw new ArtifactToolError("invalid_document_options", "bookmark names must be 1-40 letters, digits, or underscores and start with a letter");
    }
    if (this.bookmarks.has(name)) {
      throw new ArtifactToolError("invalid_document_options", `bookmark already exists: ${name}`);
    }
    if (typeof text !== "string" || !text) {
      throw new ArtifactToolError("invalid_text", "bookmark text must be a non-empty string");
    }
    this.bookmarks.add(name);
    return this.pushItem({ kind: "bookmark", name, text });
  }

  addInternalLink(text, anchor) {
    if (typeof text !== "string" || !text) {
      throw new ArtifactToolError("invalid_text", "link text must be a non-empty string");
    }
    if (!this.bookmarks.has(anchor)) {
      throw new ArtifactToolError("invalid_document_options", `bookmark does not exist: ${anchor}`);
    }
    return this.pushItem({ kind: "internalLink", text, anchor });
  }

  addReferenceField(bookmark, options = {}) {
    const normalized = optionObject(options, "reference field", ["pageNumber", "cachedText"]);
    if (!this.bookmarks.has(bookmark)) {
      throw new ArtifactToolError("invalid_document_options", `bookmark does not exist: ${bookmark}`);
    }
    if (normalized.pageNumber !== undefined && typeof normalized.pageNumber !== "boolean") {
      throw new ArtifactToolError("invalid_document_options", "reference field pageNumber must be a boolean");
    }
    if (normalized.cachedText !== undefined && typeof normalized.cachedText !== "string") {
      throw new ArtifactToolError("invalid_document_options", "reference field cachedText must be a string");
    }
    const instruction = normalized.pageNumber ? `PAGEREF ${bookmark} \\h` : `REF ${bookmark} \\h`;
    return this.pushItem({
      kind: "field",
      instruction,
      display: normalized.cachedText ?? "",
    });
  }

  addSequenceField(label, options = {}) {
    const normalized = optionObject(options, "sequence field", ["cachedText"]);
    if (typeof label !== "string" || !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(label)) {
      throw new ArtifactToolError("invalid_document_options", "sequence label must be a 1-40 character identifier");
    }
    if (normalized.cachedText !== undefined && typeof normalized.cachedText !== "string") {
      throw new ArtifactToolError("invalid_document_options", "sequence field cachedText must be a string");
    }
    return this.pushItem({
      kind: "field",
      instruction: `SEQ ${label} \\* ARABIC`,
      display: normalized.cachedText ?? "1",
    });
  }

  addExternalLink(text, url) {
    if (typeof text !== "string" || !text) {
      throw new ArtifactToolError("invalid_text", "link text must be a non-empty string");
    }
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new ArtifactToolError("invalid_document_options", "link URL must be a valid absolute URL");
    }
    if (!new Set(["http:", "https:", "mailto:"]).has(parsed.protocol)) {
      throw new ArtifactToolError("invalid_document_options", "link URL must use http, https, or mailto");
    }
    return this.pushItem({ kind: "externalLink", text, url });
  }

  addFootnote(paragraphIndex, text) {
    return this.addNote(paragraphIndex, text, "footnotes");
  }

  addEndnote(paragraphIndex, text) {
    return this.addNote(paragraphIndex, text, "endnotes");
  }

  addNote(paragraphIndex, text, noteKind) {
    const item = this.items[paragraphIndex];
    if (!Number.isInteger(paragraphIndex) || !item || item.kind !== "paragraph") {
      throw new ArtifactToolError("invalid_note_anchor", "note anchor must be a paragraph index");
    }
    if (typeof text !== "string" || !text.trim()) {
      throw new ArtifactToolError("invalid_text", "note text must be a non-empty string");
    }
    item[noteKind] = [...(item[noteKind] ?? []), { text }];
    return this;
  }

  addImage(data, options = {}) {
    return this.pushItem({ kind: "image", data, options: normalizeImageOptions(data, options) });
  }

  addComment(paragraphIndex, text, options = {}) {
    const normalized = optionObject(options, "comment", ["author", "initials", "date"]);
    const item = this.items[paragraphIndex];
    if (!Number.isInteger(paragraphIndex) || !item || item.kind !== "paragraph") {
      throw new ArtifactToolError("invalid_comment_anchor", "comment anchor must be a paragraph index");
    }
    if (typeof text !== "string" || !text.trim()) {
      throw new ArtifactToolError("invalid_text", "comment text must be a non-empty string");
    }
    const author = normalized.author ?? "Ruxex";
    if (typeof author !== "string" || !author.trim()) {
      throw new ArtifactToolError("invalid_document_options", "comment author must be a non-empty string");
    }
    const id = this.comments.length;
    const comment = {
      id,
      author,
      initials: normalized.initials ?? author.slice(0, 2).toUpperCase(),
      date: normalized.date ?? new Date(),
      children: [new Paragraph(text)],
    };
    if (!(comment.date instanceof Date) || Number.isNaN(comment.date.valueOf())) {
      throw new ArtifactToolError("invalid_document_options", "comment date must be a valid Date");
    }
    item.comments = [...(item.comments ?? []), comment];
    this.comments.push(comment);
    return this;
  }

  addTrackedReplacement(oldText, newText, options = {}) {
    const normalized = optionObject(options, "tracked replacement", ["author", "date"]);
    for (const [field, value] of [["oldText", oldText], ["newText", newText]]) {
      if (typeof value !== "string" || !value) {
        throw new ArtifactToolError("invalid_text", `${field} must be a non-empty string`);
      }
    }
    const author = normalized.author ?? "Ruxex";
    const date = normalized.date ?? new Date();
    if (typeof author !== "string" || !author.trim()) {
      throw new ArtifactToolError("invalid_document_options", "revision author must be a non-empty string");
    }
    if (!(date instanceof Date) || Number.isNaN(date.valueOf())) {
      throw new ArtifactToolError("invalid_document_options", "revision date must be a valid Date");
    }
    return this.pushItem({
      kind: "trackedReplacement",
      oldText,
      newText,
      author,
      date,
      deletionId: this.nextRevisionId++,
      insertionId: this.nextRevisionId++,
    });
  }

  addTable(rows, options = {}) {
    validateRows(rows);
    return this.pushItem({
      kind: "table",
      rows: rows.map((row) => [...row]),
      options: normalizeTableOptions(options),
    });
  }

  addSection(options = {}) {
    const section = normalizeSectionOptions(options);
    const previous = this.sections[this.currentSection];
    this.sections.push({
      pageSize: section.pageSize ?? previous.pageSize,
      orientation: section.orientation ?? previous.orientation,
      margins: section.margins ?? previous.margins,
      type: section.type,
      header: previous.header,
      footer: previous.footer,
      watermark: previous.watermark,
    });
    this.currentSection = this.sections.length - 1;
    return this;
  }

  setHeader(text) {
    if (typeof text !== "string") throw new ArtifactToolError("invalid_text", "header text must be a string");
    this.sections[this.currentSection].header = text;
    return this;
  }

  setFooter(text, options = {}) {
    const normalized = optionObject(options, "footer", ["pageNumber"]);
    if (typeof text !== "string") throw new ArtifactToolError("invalid_text", "footer text must be a string");
    if (normalized.pageNumber !== undefined && typeof normalized.pageNumber !== "boolean") {
      throw new ArtifactToolError("invalid_document_options", "footer pageNumber must be a boolean");
    }
    this.sections[this.currentSection].footer = { text, pageNumber: normalized.pageNumber === true };
    return this;
  }

  setWatermark(text, options = {}) {
    const normalized = optionObject(options, "watermark", [
      "font", "fontSize", "bold", "italics", "color", "opacity", "layout", "rotation", "width", "height",
    ]);
    if (typeof text !== "string" || !text.trim()) {
      throw new ArtifactToolError("invalid_text", "watermark text must be a non-empty string");
    }
    if (normalized.font !== undefined && typeof normalized.font !== "string") {
      throw new ArtifactToolError("invalid_document_options", "watermark font must be a string");
    }
    for (const key of ["fontSize", "rotation", "width", "height"]) {
      if (normalized[key] !== undefined) boundedNumber(normalized[key], `watermark.${key}`, 1, 1000);
    }
    for (const key of ["bold", "italics"]) {
      if (normalized[key] !== undefined && typeof normalized[key] !== "boolean") {
        throw new ArtifactToolError("invalid_document_options", `watermark.${key} must be a boolean`);
      }
    }
    if (normalized.color !== undefined && !/^(?:[0-9a-f]{6}|silver|gray|grey|black|white|red|blue)$/i.test(normalized.color)) {
      throw new ArtifactToolError("invalid_document_options", "watermark color must be a six-digit hex value or a supported color name");
    }
    if (normalized.opacity !== undefined) boundedNumber(normalized.opacity, "watermark.opacity", 0, 1);
    if (normalized.layout !== undefined && !["diagonal", "horizontal"].includes(normalized.layout)) {
      throw new ArtifactToolError("invalid_document_options", "watermark layout must be diagonal or horizontal");
    }
    this.sections[this.currentSection].watermark = { text, ...normalized };
    return this;
  }

  setProtection(options = {}) {
    const normalized = optionObject(options, "protection", ["type", "password"]);
    const allowedTypes = new Set(Object.values(DocumentProtectionType));
    if (!allowedTypes.has(normalized.type)) {
      throw new ArtifactToolError(
        "invalid_document_options",
        "protection type must be readOnly, comments, trackedChanges, or forms",
      );
    }
    if (normalized.password !== undefined && typeof normalized.password !== "string") {
      throw new ArtifactToolError("invalid_document_options", "protection password must be a string");
    }
    if (normalized.password?.length > 15) {
      throw new ArtifactToolError("invalid_document_options", "Word reads only the first 15 protection password characters");
    }
    this.protection = { ...normalized };
    return this;
  }

  async inspect() {
    const inspection = {
      ok: true,
      valid: true,
      paragraphs: this.items.filter((item) =>
        ["paragraph", "heading", "title", "subtitle", "listItem", "trackedReplacement"].includes(item.kind),
      ).length,
      tables: this.items.filter((item) => item.kind === "table").length,
      images: this.items.filter((item) => item.kind === "image").length,
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

  async exportDocx(outputPath, options = {}) {
    if (this.lossDiagnostics.length > 0 && options.acceptDiagnostics !== true) {
      throw new ArtifactToolError(
        "lossy_import",
        "loaded DOCX contains unsupported content; pass acceptDiagnostics to export",
      );
    }
    const sections = this.sections.map((section, sectionIndex) => {
      const sectionItems = this.items.filter((item) => (item.sectionIndex ?? 0) === sectionIndex);
      const children = sectionItems.length
        ? sectionItems.map((item) => item.kind === "table"
          ? tableFor(item)
          : item.kind === "tableOfContents"
            ? new TableOfContents("Contents", item.options)
            : paragraphFor(item))
        : [new Paragraph("")];
      const pageSize = PAGE_SIZES[section.pageSize];
      const landscape = section.orientation === "landscape";
      const page = {
        size: {
          width: pageSize.width,
          height: pageSize.height,
          orientation: PAGE_ORIENTATIONS[section.orientation],
        },
      };
      if (section.margins) {
        page.margin = Object.fromEntries(Object.entries(section.margins).map(([side, inches]) => [
          side,
          inches * TWIPS_PER_INCH,
        ]));
      }
      const headers = section.header === null && section.watermark === null ? undefined : {
        default: new Header({
          children: [
            ...(section.header === null ? [] : [new Paragraph(section.header)]),
            ...(section.watermark === null ? [] : [
              new Paragraph({ children: [new TextWatermark(section.watermark)] }),
            ]),
          ],
        }),
      };
      const footers = section.footer === null ? undefined : {
        default: new Footer({
          children: [new Paragraph({
            children: [
              new TextRun(section.footer.text),
              ...(section.footer.pageNumber ? [new TextRun({ children: [PageNumber.CURRENT] })] : []),
            ],
          })],
        }),
      };
      return {
        properties: {
          page,
          ...(sectionIndex > 0 ? { type: SECTION_TYPES[section.type] } : {}),
        },
        children,
        ...(headers ? { headers } : {}),
        ...(footers ? { footers } : {}),
      };
    });
    const document = new DocxDocument({
      title: this.title,
      ...(this.items.some((item) => item.kind === "listItem") ? { numbering: LIST_NUMBERING } : {}),
      ...(this.comments.length ? { comments: { children: this.comments } } : {}),
      ...(this.protection ? { protection: this.protection } : {}),
      ...(this.items.some((item) => item.kind === "trackedReplacement")
        ? { features: { trackRevisions: true } }
        : {}),
      sections,
    });
    const buffer = await Packer.toBuffer(document);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, buffer);
    return { ok: true, format: "docx", output: outputPath };
  }
}
