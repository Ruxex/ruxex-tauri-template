import { ArtifactToolError } from "./a1-range.mjs";
import { ArtifactOutput, FileBlob } from "./file-blob.mjs";
import { exportPresentationPptx, Presentation } from "./presentation.mjs";

async function inputPath(input) {
  if (input instanceof FileBlob) return input.path;
  return (await FileBlob.load(input)).path;
}

export class PresentationFile {
  static async importPptx(input) {
    const path = await inputPath(input);
    const { Presentation } = await import("./presentation.mjs");
    return Presentation.load(path);
  }

  static exportPptx(presentation, options = {}) {
    if (!(presentation instanceof Presentation)) {
      throw new ArtifactToolError(
        "invalid_presentation",
        "PresentationFile.exportPptx requires a Presentation",
      );
    }
    return ArtifactOutput.fromSaver("pptx", (outputPath) => exportPresentationPptx(presentation, outputPath, options));
  }
}
