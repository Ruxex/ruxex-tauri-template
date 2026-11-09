import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname, dirname, resolve } from "node:path";

import { ArtifactToolError } from "./a1-range.mjs";

const supportedTypes = new Map([
  [".xlsx", "xlsx"],
  [".docx", "docx"],
  [".pptx", "pptx"],
  [".pdf", "pdf"],
]);

function normalizePath(inputPath, code, message) {
  if (typeof inputPath !== "string" || inputPath.trim() === "") {
    throw new ArtifactToolError(code, message);
  }
  return resolve(inputPath);
}

function typeForPath(inputPath) {
  const type = supportedTypes.get(extname(inputPath).toLowerCase());
  if (!type) {
    throw new ArtifactToolError(
      "unsupported_input_type",
      `unsupported artifact file type: ${inputPath}`,
    );
  }
  return type;
}

export class FileBlob {
  constructor(path, type) {
    this.path = path;
    this.name = basename(path);
    this.type = type;
  }

  static async load(inputPath) {
    const path = normalizePath(inputPath, "invalid_input_path", "input path is required");
    let metadata;
    try {
      metadata = await stat(path);
    } catch (error) {
      throw new ArtifactToolError("invalid_input_path", `failed to inspect input path: ${error.message}`);
    }
    if (!metadata.isFile()) {
      throw new ArtifactToolError("invalid_input_path", `input path is not a file: ${path}`);
    }
    return new FileBlob(path, typeForPath(path));
  }

  async arrayBuffer() {
    const bytes = await readFile(this.path);
    return new Uint8Array(bytes).buffer;
  }
}

export class ArtifactOutput {
  constructor(format, saver) {
    this.format = format;
    this.#saver = saver;
  }

  #saver;

  static fromBytes(bytes, format) {
    if (!(bytes instanceof Uint8Array) && !Buffer.isBuffer(bytes)) {
      throw new ArtifactToolError("invalid_output", "artifact output bytes must be a byte array");
    }
    const copy = new Uint8Array(bytes);
    return new ArtifactOutput(format, async (outputPath) => {
      await writeOutputBytes(outputPath, copy);
      return { ok: true, format, output: outputPath };
    });
  }

  static fromSaver(format, saver) {
    if (typeof saver !== "function") {
      throw new ArtifactToolError("invalid_output", "artifact output saver must be a function");
    }
    return new ArtifactOutput(format, saver);
  }

  async save(outputPath) {
    const path = normalizePath(outputPath, "invalid_output_path", "output path is required");
    return this.#saver(path);
  }
}

async function writeOutputBytes(outputPath, bytes) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, bytes);
}
