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
