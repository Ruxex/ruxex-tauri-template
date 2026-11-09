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
    if ("+-*/(),:<>=\\".includes(character)) {
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
  return /^[A-Za-z]{1,3}[1-9][0-9]*$/.test(value);
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
    const identifier = this.consume("identifier").value;
    if (this.current().type === "(") {
      return this.parseFunction(identifier);
    }
    if (identifier.toUpperCase() === "TRUE") return true;
    if (identifier.toUpperCase() === "FALSE") return false;
    if (!isCellReference(identifier)) {
      throw new FormulaEvaluationError("unsupported_formula", "unsupported identifier: " + identifier);
    }
    if (this.current().type === ":") {
      this.consume(":");
      const end = this.consume("identifier").value;
      if (!isCellReference(end)) throw new FormulaEvaluationError("invalid_formula", "range endpoint must be a cell");
      return this.context.getRange(identifier, end);
    }
    return this.context.getCell(identifier);
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
      case "IF":
        if (args.length !== 3) throw new FormulaEvaluationError("invalid_formula", "IF requires three arguments");
        return truthy(args[0]) ? args[1] : args[2];
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
