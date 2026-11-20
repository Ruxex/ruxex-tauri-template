import { ArtifactToolError } from "./a1-range.mjs";

function parseRows(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && field === "") {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (character === "\r" && text[index + 1] === "\n") index += 1;
    } else {
      field += character;
    }
  }
  if (quoted) throw new ArtifactToolError("invalid_csv", "CSV contains an unterminated quoted field");
  if (field !== "" || row.length > 0 || !/(?:\r|\n)$/.test(text)) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length && rows[0][0]?.startsWith("\uFEFF")) rows[0][0] = rows[0][0].slice(1);
  const width = Math.max(0, ...rows.map((item) => item.length));
  return rows.map((item) => [...item, ...Array(Math.max(0, width - item.length)).fill("")]);
}

function safeValue(value, inferTypes) {
  if (!inferTypes) return value;
  if (value === "TRUE") return true;
  if (value === "FALSE") return false;
  if (/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(value)) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return value;
}

export function parseCsv(text, options = {}) {
  if (typeof text !== "string") throw new ArtifactToolError("invalid_csv", "CSV input must be text");
  const delimiter = options.delimiter ?? (text.split("\n", 1)[0].includes("\t") ? "\t" : ",");
  if (typeof delimiter !== "string" || delimiter.length !== 1 || delimiter === '"' || delimiter === "\r" || delimiter === "\n") {
    throw new ArtifactToolError("invalid_csv", "CSV delimiter must be one non-quote character");
  }
  const rows = parseRows(text, delimiter);
  if (rows.length === 1 && rows[0].length === 1 && rows[0][0] === "") return [];
  const inferTypes = options.inferTypes ?? true;
  return rows.map((row) => row.map((value) => safeValue(value, inferTypes)));
}
