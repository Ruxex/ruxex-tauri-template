import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

import { ArtifactToolError } from "./a1-range.mjs";
import { exportWorkbookXlsx, Workbook } from "./workbook.mjs";

function run(binary, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.on("error", (error) => reject(new ArtifactToolError("render_runtime_error", `${label} could not start: ${error.message}`)));
    child.on("close", (code) => code === 0
      ? resolve(output)
      : reject(new ArtifactToolError("render_runtime_error", `${label} exited with status ${code}: ${output.slice(-4000)}`)));
  });
}

function sheetInput(sheet) {
  return {
    name: sheet.name,
    rows: sheet.rows,
    formulas: sheet.formulaRows,
    formats: [...sheet.formats.values()],
    merges: sheet.merges,
    columnWidths: [...sheet.columnWidths.entries()].map(([column, width]) => ({ column, width })),
    tables: sheet._tableData,
    charts: sheet._chartData,
    images: sheet._imageData,
    notes: sheet._noteData,
  };
}

export async function renderWorkbook(workbook, options = {}) {
  const binaryDirectory = process.env.RUXEX_RUNTIME_BIN_DIR;
  if (!binaryDirectory) {
    throw new ArtifactToolError("missing_runtime_resource", "RUXEX_RUNTIME_BIN_DIR is not configured for local workbook rendering");
  }
  const office = join(binaryDirectory, "soffice");
  const pdfToPpm = join(binaryDirectory, "pdftoppm");
  const officeStats = await stat(office).catch(() => null);
  const rendererStats = await stat(pdfToPpm).catch(() => null);
  if (!officeStats?.isFile() || !rendererStats?.isFile()) {
    throw new ArtifactToolError("missing_runtime_resource", "bundled LibreOffice and Poppler renderers are required");
  }
  const sheetName = options.sheetName ?? workbook.worksheets.getActiveWorksheet().name;
  const sheet = workbook.worksheets.getItem(sheetName);
  const scale = options.scale ?? 1;
  if (!Number.isFinite(scale) || scale < 0.5 || scale > 2) {
    throw new ArtifactToolError("invalid_render_options", "render scale must be between 0.5 and 2");
  }

  const directory = await mkdtemp(join(tmpdir(), "ruxex-spreadsheet-render-"));
  const inputPath = join(directory, "preview.xlsx");
  const pdfPath = join(directory, "preview.pdf");
  const imagePrefix = join(directory, "preview");
  const imagePath = `${imagePrefix}.png`;
  try {
    const selected = new Workbook([sheetInput(sheet)]);
    await exportWorkbookXlsx(selected, inputPath);
    await run(office, ["--headless", `-env:UserInstallation=file://${join(directory, "profile")}`, "--convert-to", "pdf", "--outdir", directory, inputPath], "LibreOffice");
    await run(pdfToPpm, ["-singlefile", "-png", "-r", String(Math.round(96 * scale)), "-f", "1", "-l", "1", pdfPath, imagePrefix], "Poppler");
    const image = await readFile(imagePath);
    if (image.length > 24 * 1024 * 1024) throw new ArtifactToolError("render_output_limit", "rendered workbook preview exceeds 24 MiB");
    return new Blob([image], { type: "image/png" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
