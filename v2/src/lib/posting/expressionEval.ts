import Decimal from "decimal.js";

/**
 * Safely evaluates a math expression string using variables from a payload.
 * Supports basic arithmetic (+, -, *, /), parentheses, and comparison operators (>, <, >=, <=, ==, !=).
 * Returns a Decimal instance.
 */
export function evaluate(expression: string, payload: Record<string, unknown>): Decimal {
  // Normalize payload: convert numeric and boolean values to Decimal
  const scope: Record<string, Decimal> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value instanceof Decimal) {
      scope[key] = value;
    } else if (typeof value === "number") {
      scope[key] = new Decimal(value);
    } else if (typeof value === "string" && !isNaN(Number(value))) {
      scope[key] = new Decimal(value);
    } else if (typeof value === "boolean") {
      scope[key] = new Decimal(value ? 1 : 0);
    }
  }

  const tokens = tokenize(expression);
  let index = 0;

  function peek() {
    return tokens[index];
  }

  function consume() {
    return tokens[index++];
  }

  function parseExpr(): Decimal {
    return parseComp();
  }

  function parseComp(): Decimal {
    let val = parseTerm();
    while (index < tokens.length) {
      const op = peek();
      if (op === ">" || op === "<" || op === ">=" || op === "<=" || op === "==" || op === "!=") {
        consume();
        const right = parseTerm();
        let condition = false;
        if (op === ">") condition = val.gt(right);
        else if (op === "<") condition = val.lt(right);
        else if (op === ">=") condition = val.gte(right);
        else if (op === "<=") condition = val.lte(right);
        else if (op === "==") condition = val.equals(right);
        else if (op === "!=") condition = !val.equals(right);
        val = new Decimal(condition ? 1 : 0);
      } else {
        break;
      }
    }
    return val;
  }

  function parseTerm(): Decimal {
    let val = parseFactor();
    while (index < tokens.length) {
      const op = peek();
      if (op === "+" || op === "-") {
        consume();
        const right = parseFactor();
        if (op === "+") val = val.plus(right);
        else val = val.minus(right);
      } else {
        break;
      }
    }
    return val;
  }

  function parseFactor(): Decimal {
    let val = parsePrimary();
    while (index < tokens.length) {
      const op = peek();
      if (op === "*" || op === "/") {
        consume();
        const right = parsePrimary();
        if (op === "*") val = val.mul(right);
        else {
          if (right.isZero()) throw new Error("Division by zero in expression evaluation");
          val = val.div(right);
        }
      } else {
        break;
      }
    }
    return val;
  }

  function parsePrimary(): Decimal {
    const token = consume();
    if (!token) throw new Error("Unexpected end of expression");

    if (token === "(") {
      const val = parseExpr();
      const next = consume();
      if (next !== ")") throw new Error("Expected ')' in expression");
      return val;
    }

    if (token === "-") {
      return parsePrimary().negated();
    }

    // Number literal
    if (!isNaN(Number(token))) {
      return new Decimal(token);
    }

    // Variable lookup
    if (scope[token] !== undefined) {
      return scope[token];
    }

    // Fallback/Default to zero for optional or omitted variables
    return new Decimal(0);
  }

  const result = parseExpr();
  if (index < tokens.length) {
    throw new Error(`Unexpected token at position ${index}: ${tokens[index]}`);
  }
  return result;
}

function tokenize(expression: string): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < expression.length) {
    const char = expression[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    if (char === "+" || char === "-" || char === "*" || char === "/" || char === "(" || char === ")") {
      result.push(char);
      i++;
      continue;
    }

    // Multi-char operators: >=, <=, ==, !=
    if (
      (char === ">" && expression[i + 1] === "=") ||
      (char === "<" && expression[i + 1] === "=") ||
      (char === "=" && expression[i + 1] === "=") ||
      (char === "!" && expression[i + 1] === "=")
    ) {
      result.push(char + "=");
      i += 2;
      continue;
    }

    // Single-char comparisons: >, <
    if (char === ">" || char === "<") {
      result.push(char);
      i++;
      continue;
    }

    // Numeric literals
    if (/[0-9]/.test(char) || char === ".") {
      let numStr = "";
      while (i < expression.length && (/[0-9]/.test(expression[i]) || expression[i] === ".")) {
        numStr += expression[i];
        i++;
      }
      result.push(numStr);
      continue;
    }

    // Identifiers/Variables
    if (/[a-zA-Z_]/.test(char)) {
      let varStr = "";
      while (i < expression.length && /[a-zA-Z0-9_]/.test(expression[i])) {
        varStr += expression[i];
        i++;
      }
      result.push(varStr);
      continue;
    }

    throw new Error(`Unknown character in expression: ${char}`);
  }
  return result;
}
