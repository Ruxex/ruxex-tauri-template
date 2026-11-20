export class FormulaEvaluationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "FormulaEvaluationError";
    this.code = code;
  }
}

function tokenize(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (/[0-9.]/.test(character)) {
      const match = /^\d+(?:\.\d+)?/.exec(source.slice(index));
      if (!match) throw new FormulaEvaluationError("invalid_formula", "invalid number in formula");
      tokens.push({ type: "number", value: Number(match[0]) });
      index += match[0].length;
      continue;
    }
    if (character === '"') {
      const end = source.indexOf('"', index + 1);
      if (end < 0) throw new FormulaEvaluationError("invalid_formula", "unterminated string in formula");
      tokens.push({ type: "string", value: source.slice(index + 1, end) });
      index = end + 1;
      continue;
    }
    if (character === "'") {
      let cursor = index + 1;
      let sheetName = "";
      while (cursor < source.length) {
        if (source[cursor] === "'" && source[cursor + 1] === "'") {
          sheetName += "'";
          cursor += 2;
        } else if (source[cursor] === "'") break;
        else sheetName += source[cursor++];
      }
      if (source[cursor] !== "'" || source[cursor + 1] !== "!") throw new FormulaEvaluationError("invalid_formula", "quoted sheet reference must end with '!'");
      const cell = /^\$?[A-Za-z]{1,3}\$?[1-9][0-9]*/.exec(source.slice(cursor + 2));
      if (!cell) throw new FormulaEvaluationError("invalid_formula", "quoted sheet reference requires a cell address");
      tokens.push({ type: "identifier", value: `'${sheetName}'!${cell[0]}` });
      index = cursor + 2 + cell[0].length;
      continue;
    }
    if (character === "$" || /[A-Za-z_]/.test(character)) {
      const cell = /^\$?[A-Za-z]{1,3}\$?[1-9][0-9]*/.exec(source.slice(index));
      if (cell) {
        tokens.push({ type: "identifier", value: cell[0] });
        index += cell[0].length;
        continue;
      }
    }
    if (/[A-Za-z_]/.test(character)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(index));
      tokens.push({ type: "identifier", value: match[0] });
      index += match[0].length;
      continue;
    }
    const twoCharacter = source.slice(index, index + 2);
    if ([">=", "<=", "<>"].includes(twoCharacter)) {
      tokens.push({ type: "operator", value: twoCharacter });
      index += 2;
      continue;
    }
    if ("+-*/(),:<>=!\\".includes(character)) {
      tokens.push({
        type: character === "(" || character === ")" || character === "," || character === ":" ? character : "operator",
        value: character,
      });
      index += 1;
      continue;
    }
    throw new FormulaEvaluationError("invalid_formula", "unsupported token in formula: " + character);
  }
  tokens.push({ type: "eof", value: "" });
  return tokens;
}

function isCellReference(value) {
  return /^\$?[A-Za-z]{1,3}\$?[1-9][0-9]*$/.test(value);
}

function flatten(value) {
  return Array.isArray(value) ? value.flatMap(flatten) : [value];
}

function numberValue(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  throw new FormulaEvaluationError("unsupported_formula", "value is not numeric: " + value);
}

function truthy(value) {
  return Boolean(value) && value !== 0 && value !== "";
}

function criterionMatches(value, criterion) {
  if (typeof criterion !== "string") return value === criterion;
  const operator = /^(<=|>=|<>|=|<|>)(.*)$/.exec(criterion);
  const compare = operator?.[2] ?? criterion;
  const expected = compare !== "" && Number.isFinite(Number(compare)) ? Number(compare) : compare;
  if (!operator || operator[1] === "=") return value === expected;
  switch (operator[1]) {
    case "<>": return value !== expected;
    case "<": return value < expected;
    case "<=": return value <= expected;
    case ">": return value > expected;
    case ">=": return value >= expected;
    default: return false;
  }
}

function roundExcel(value, digits = 0, mode = "nearest") {
  const number = numberValue(value);
  const precision = Math.trunc(numberValue(digits));
  const factor = 10 ** Math.min(308, Math.abs(precision));
  const scaled = precision >= 0 ? number * factor : number / factor;
  const rounded = mode === "up"
    ? Math.ceil(Math.abs(scaled)) * Math.sign(scaled)
    : mode === "down"
      ? Math.trunc(scaled)
      : Math.sign(scaled) * Math.floor(Math.abs(scaled) + 0.5 + 1e-10 * Math.max(1, Math.abs(scaled)));
  return precision >= 0 ? rounded / factor : rounded * factor;
}

function columnIndex(label) {
  let value = 0;
  for (const character of label.toUpperCase()) value = value * 26 + character.charCodeAt(0) - 64;
  return value - 1;
}

function columnName(index) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

const CELL_REFERENCE = /(?<![A-Za-z0-9_.])(?:(?:'[^']+'|[A-Za-z_][A-Za-z0-9_.]*)!)?(\$?)([A-Za-z]{1,3})(\$?)([1-9][0-9]*)(?![A-Za-z0-9_(])/g;

export function translateFormula(formula, rowDelta, columnDelta) {
  if (typeof formula !== "string" || !Number.isInteger(rowDelta) || !Number.isInteger(columnDelta)) {
    throw new FormulaEvaluationError("invalid_formula", "formula translation requires a formula and integer offsets");
  }
  let output = "";
  let index = 0;
  while (index < formula.length) {
    if (formula[index] === '"') {
      const start = index;
      index += 1;
      while (index < formula.length) {
        if (formula[index] === '"' && formula[index + 1] === '"') index += 2;
        else if (formula[index++] === '"') break;
      }
      output += formula.slice(start, index);
      continue;
    }
    const nextQuote = formula.indexOf('"', index);
    const end = nextQuote < 0 ? formula.length : nextQuote;
    const unquoted = formula.slice(index, end).replace(CELL_REFERENCE, (match, absoluteColumn, letters, absoluteRow, rowText) => {
      let row = Number(rowText) - 1;
      let column = columnIndex(letters);
      if (!absoluteRow) row += rowDelta;
      if (!absoluteColumn) column += columnDelta;
      if (row < 0 || row >= 1_048_576 || column < 0 || column >= 16_384) return "#REF!";
      return `${absoluteColumn}${columnName(column)}${absoluteRow}${row + 1}`;
    });
    output += unquoted;
    index = end;
  }
  return output;
}

class FormulaParser {
  constructor(tokens, context) {
    this.tokens = tokens;
    this.context = context;
    this.index = 0;
  }

  current() {
    return this.tokens[this.index];
  }

  consume(type, value = undefined) {
    const token = this.current();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new FormulaEvaluationError("invalid_formula", "expected " + (value ?? type));
    }
    this.index += 1;
    return token;
  }

  parse() {
    const result = this.parseComparison();
    if (this.current().type !== "eof") {
      throw new FormulaEvaluationError("invalid_formula", "unexpected token at end of formula");
    }
    return result;
  }

  parseComparison() {
    let left = this.parseAdditive();
    while (this.current().type === "operator" && ["=", ">", "<", ">=", "<=", "<>"].includes(this.current().value)) {
      const operator = this.consume("operator").value;
      const right = this.parseAdditive();
      if (operator === "=") left = left === right;
      if (operator === "<>") left = left !== right;
      if (operator === ">") left = left > right;
      if (operator === "<") left = left < right;
      if (operator === ">=") left = left >= right;
      if (operator === "<=") left = left <= right;
    }
    return left;
  }

  parseAdditive() {
    let left = this.parseMultiplicative();
    while (this.current().type === "operator" && ["+", "-"].includes(this.current().value)) {
      const operator = this.consume("operator").value;
      const right = this.parseMultiplicative();
      left = operator === "+" ? numberValue(left) + numberValue(right) : numberValue(left) - numberValue(right);
    }
    return left;
  }

  parseMultiplicative() {
    let left = this.parseUnary();
    while (this.current().type === "operator" && ["*", "/"].includes(this.current().value)) {
      const operator = this.consume("operator").value;
      const right = this.parseUnary();
      if (operator === "/" && numberValue(right) === 0) {
        throw new FormulaEvaluationError("unsupported_formula", "formula divides by zero");
      }
      left = operator === "*" ? numberValue(left) * numberValue(right) : numberValue(left) / numberValue(right);
    }
    return left;
  }

  parseUnary() {
    if (this.current().type === "operator" && ["+", "-"].includes(this.current().value)) {
      const operator = this.consume("operator").value;
      const value = numberValue(this.parseUnary());
      return operator === "-" ? -value : value;
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const token = this.current();
    if (token.type === "number" || token.type === "string") {
      this.index += 1;
      return token.value;
    }
    if (token.type === "(") {
      this.consume("(");
      const value = this.parseComparison();
      this.consume(")");
      return value;
    }
    if (token.type !== "identifier") {
      throw new FormulaEvaluationError("invalid_formula", "expected a value");
    }
    let identifier = this.consume("identifier").value;
    if (this.current().type === "(") {
      return this.parseFunction(identifier);
    }
    if (identifier.toUpperCase() === "TRUE") return true;
    if (identifier.toUpperCase() === "FALSE") return false;
    let sheetName;
    if (identifier.includes("!")) {
      const separator = identifier.lastIndexOf("!");
      sheetName = identifier.slice(0, separator).replace(/^'|'$/g, "").replaceAll("''", "'");
      identifier = identifier.slice(separator + 1);
    } else if (this.current().type === "operator" && this.current().value === "!") {
      sheetName = identifier;
      this.consume("operator", "!");
      identifier = this.consume("identifier").value;
    }
    if (!isCellReference(identifier)) {
      throw new FormulaEvaluationError("unsupported_formula", "unsupported identifier: " + identifier);
    }
    if (this.current().type === ":") {
      this.consume(":");
      const end = this.consume("identifier").value;
      if (!isCellReference(end)) throw new FormulaEvaluationError("invalid_formula", "range endpoint must be a cell");
      return this.context.getRange(identifier, end, sheetName);
    }
    return this.context.getCell(identifier, sheetName);
  }

  parseFunction(name) {
    this.consume("(");
    const args = [];
    if (this.current().type !== ")") {
      args.push(this.parseComparison());
      while (this.current().type === ",") {
        this.consume(",");
        args.push(this.parseComparison());
      }
    }
    this.consume(")");
    const values = args.flatMap(flatten);
    switch (name.toUpperCase()) {
      case "SUM":
        return values.reduce((total, value) => total + numberValue(value), 0);
      case "AVERAGE": {
        const numeric = values.filter((value) => typeof value === "number");
        if (!numeric.length) throw new FormulaEvaluationError("unsupported_formula", "AVERAGE has no numeric values");
        return numeric.reduce((total, value) => total + value, 0) / numeric.length;
      }
      case "MIN":
        return Math.min(...values.map(numberValue));
      case "MAX":
        return Math.max(...values.map(numberValue));
      case "COUNT":
        return values.filter((value) => typeof value === "number" && Number.isFinite(value)).length;
      case "COUNTA":
        return values.filter((value) => value !== null && value !== undefined && value !== "").length;
      case "AND": return values.every(truthy);
      case "OR": return values.some(truthy);
      case "NOT":
        if (args.length !== 1) throw new FormulaEvaluationError("invalid_formula", "NOT requires one argument");
        return !truthy(args[0]);
      case "IF":
        if (args.length !== 3) throw new FormulaEvaluationError("invalid_formula", "IF requires three arguments");
        return truthy(args[0]) ? args[1] : args[2];
      case "ABS": return Math.abs(numberValue(args[0]));
      case "INT": return Math.floor(numberValue(args[0]));
      case "TRUNC": return Math.trunc(numberValue(args[0]));
      case "ROUND": return roundExcel(args[0], args[1] ?? 0);
      case "ROUNDUP": return roundExcel(args[0], args[1] ?? 0, "up");
      case "ROUNDDOWN": return roundExcel(args[0], args[1] ?? 0, "down");
      case "MOD": return numberValue(args[0]) - numberValue(args[1]) * Math.floor(numberValue(args[0]) / numberValue(args[1]));
      case "POWER": return numberValue(args[0]) ** numberValue(args[1]);
      case "SQRT": return Math.sqrt(numberValue(args[0]));
      case "LEFT": return String(args[0] ?? "").slice(0, Math.max(0, Math.trunc(numberValue(args[1] ?? 1))));
      case "RIGHT": {
        const text = String(args[0] ?? "");
        const count = Math.max(0, Math.trunc(numberValue(args[1] ?? 1)));
        return text.slice(Math.max(0, text.length - count));
      }
      case "MID": {
        const text = String(args[0] ?? "");
        const start = Math.max(0, Math.trunc(numberValue(args[1])) - 1);
        const count = Math.max(0, Math.trunc(numberValue(args[2])));
        return text.slice(start, start + count);
      }
      case "LEN": return String(args[0] ?? "").length;
      case "LOWER": return String(args[0] ?? "").toLowerCase();
      case "UPPER": return String(args[0] ?? "").toUpperCase();
      case "TRIM": return String(args[0] ?? "").trim().replace(/\s+/g, " ");
      case "CONCAT": return values.map((value) => value ?? "").join("");
      case "COUNTIF": {
        if (args.length !== 2) throw new FormulaEvaluationError("invalid_formula", "COUNTIF requires two arguments");
        return flatten(args[0]).filter((value) => criterionMatches(value, args[1])).length;
      }
      case "SUMIF": {
        if (args.length < 2 || args.length > 3) throw new FormulaEvaluationError("invalid_formula", "SUMIF requires two or three arguments");
        const criteria = flatten(args[0]);
        const sumRange = flatten(args[2] ?? args[0]);
        return criteria.reduce((total, value, index) => criterionMatches(value, args[1]) ? total + numberValue(sumRange[index]) : total, 0);
      }
      case "MATCH": {
        const list = flatten(args[0] ?? []);
        const matchType = numberValue(args[2] ?? 0);
        const exact = list.findIndex((value) => value === args[1]);
        if (exact >= 0) return exact + 1;
        if (matchType === 0) throw new FormulaEvaluationError("unsupported_formula", "MATCH value not found");
        const candidates = list.map((value, index) => ({ value, index })).filter(({ value }) => matchType > 0 ? value <= args[1] : value >= args[1]);
        const found = matchType > 0 ? candidates.at(-1) : candidates[0];
        if (!found) throw new FormulaEvaluationError("unsupported_formula", "MATCH value not found");
        return found.index + 1;
      }
      case "INDEX": {
        const matrix = args[0];
        if (!Array.isArray(matrix)) throw new FormulaEvaluationError("invalid_formula", "INDEX requires a range");
        const row = Math.trunc(numberValue(args[1] ?? 1)) - 1;
        const column = Math.trunc(numberValue(args[2] ?? 1)) - 1;
        const result = Array.isArray(matrix[row]) ? matrix[row][column] : flatten(matrix)[row];
        if (result === undefined) throw new FormulaEvaluationError("unsupported_formula", "INDEX is outside the supplied range");
        return result;
      }
      case "VLOOKUP": {
        const matrix = args[1];
        if (!Array.isArray(matrix) || !matrix.every(Array.isArray)) throw new FormulaEvaluationError("invalid_formula", "VLOOKUP requires a rectangular range");
        const exact = args[3] === false || args[3] === 0;
        let found = matrix.find((row) => row[0] === args[0]);
        if (!found && !exact) found = matrix.filter((row) => row[0] <= args[0]).at(-1);
        const column = Math.trunc(numberValue(args[2] ?? 1)) - 1;
        if (!found || column < 0 || column >= found.length) throw new FormulaEvaluationError("unsupported_formula", "VLOOKUP value or column not found");
        return found[column];
      }
      default:
        throw new FormulaEvaluationError("unsupported_formula", "unsupported function: " + name);
    }
  }
}

export function evaluateFormula(formula, context) {
  if (typeof formula !== "string" || !formula.trim().startsWith("=")) {
    throw new FormulaEvaluationError("invalid_formula", "formula must start with '='");
  }
  return new FormulaParser(tokenize(formula.trim().slice(1)), context).parse();
}
