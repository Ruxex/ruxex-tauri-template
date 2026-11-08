import { ArtifactToolError } from "./a1-range.mjs";
import { ArtifactOutput, FileBlob } from "./file-blob.mjs";

async function inputPath(input) {
  if (input instanceof FileBlob) return input.path;
  return (await FileBlob.load(input)).path;
}

function isWorkbook(value) {
  return Boolean(
    value &&
      typeof value.exportXlsx === "function" &&
      value.worksheets &&
      typeof value.worksheets.items !== "undefined",
  );
}

export class SpreadsheetFile {
  static async importXlsx(input) {
    const path = await inputPath(input);
    const { Workbook } = await import("./index.mjs");
    return Workbook.load(path);
  }

  static exportXlsx(workbook) {
    if (!isWorkbook(workbook)) {
      throw new ArtifactToolError(
        "invalid_workbook",
        "SpreadsheetFile.exportXlsx requires a Workbook",
      );
    }
    return ArtifactOutput.fromSaver("xlsx", (outputPath) => workbook.exportXlsx(outputPath));
  }
}
