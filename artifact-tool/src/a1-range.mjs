export class ArtifactToolError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ArtifactToolError";
    this.code = code;
    this.details = details;
  }
}

function columnNumber(label) {
  let value = 0;
  for (const character of label) {
    value = value * 26 + character.charCodeAt(0) - 64;
  }
  return value - 1;
}

function parseCell(address) {
  const match = /^([A-Za-z]+)([1-9][0-9]*)$/.exec(address);
  if (!match) {
    throw new ArtifactToolError("invalid_range", `unsupported cell address: ${address}`);
  }
  return {
    row: Number(match[2]) - 1,
    column: columnNumber(match[1].toUpperCase()),
  };
}

export function parseRange(reference) {
  if (typeof reference !== "string") {
    throw new ArtifactToolError("invalid_range", "range must be a string");
  }
  const parts = reference.replaceAll("$", "").split(":");
  if (parts.length > 2 || parts.length === 0) {
    throw new ArtifactToolError("invalid_range", `unsupported range: ${reference}`);
  }
  const start = parseCell(parts[0]);
  const end = parseCell(parts[1] ?? parts[0]);
  if (end.row < start.row || end.column < start.column) {
    throw new ArtifactToolError("invalid_range", `range has reversed bounds: ${reference}`);
  }
  return {
    reference,
    start,
    end,
    rows: end.row - start.row + 1,
    columns: end.column - start.column + 1,
  };
}
