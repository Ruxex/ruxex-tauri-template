import { readFile } from "node:fs/promises";

import { ArtifactToolError } from "./a1-range.mjs";
import { ArtifactOutput, FileBlob } from "./file-blob.mjs";
import { exportWorkbookXlsx, loadWorkbook, Workbook } from "./workbook.mjs";

async function inputPath(input) {
  if (input instanceof FileBlob) return input.path;
  return (await FileBlob.load(input)).path;
}

function isWorkbook(value) {
  return value instanceof Workbook;
}

export class SpreadsheetFile {
  static async importXlsx(input) {
    const path = await inputPath(input);
    return loadWorkbook(path);
  }

  static async importCSV(input, options = {}) {
    const blob = input instanceof FileBlob ? input : await FileBlob.load(input);
    if (blob.type !== "csv" && blob.type !== "tsv") {
      throw new ArtifactToolError("unsupported_input_type", `CSV import requires .csv or .tsv: ${blob.name}`);
    }
    const text = await readFile(blob.path, "utf8");
    return Workbook.fromCSV(text, { ...options, delimiter: options.delimiter ?? (blob.type === "tsv" ? "\t" : undefined) });
  }

  static async import(input, options = {}) {
    const blob = input instanceof FileBlob ? input : await FileBlob.load(input);
    if (blob.type === "xlsx") return loadWorkbook(blob.path);
    if (blob.type === "csv" || blob.type === "tsv") return SpreadsheetFile.importCSV(blob, options);
    if (blob.type === "xls") return loadWorkbook(blob.path);
    throw new ArtifactToolError("unsupported_input_type", `unsupported spreadsheet source type: ${blob.type}`);
  }

  static exportXlsx(workbook) {
    if (!isWorkbook(workbook)) {
      throw new ArtifactToolError(
        "invalid_workbook",
        "SpreadsheetFile.exportXlsx requires a Workbook",
      );
    }
    return ArtifactOutput.fromSaver("xlsx", (outputPath) => exportWorkbookXlsx(workbook, outputPath));
  }
}
