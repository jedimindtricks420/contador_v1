import Decimal from "decimal.js";

type Value = Decimal | string;

/**
 * Safely evaluates a math/logic expression string using variables from a payload.
 * Supports basic arithmetic (+, -, *, /), parentheses, comparison operators
 * (>, <, >=, <=, ==, !=), logical operators (&&, ||), and single/double-quoted
 * string literals (for comparisons against payload fields like `type == 'monthly'`).
 * Returns a Decimal instance (1/0 for boolean results).
 */
export function evaluate(expression: string, payload: Record<string, unknown>): Decimal {
  // Normalize payload: convert numeric/boolean values to Decimal, keep strings as strings.
  const scope: Record<string, Value> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value instanceof Decimal) {
      scope[key] = value;
    } else if (typeof value === "number") {
      scope[key] = new Decimal(value);
    } else if (typeof value === "string" && value.trim() !== "" && !isNaN(Number(value))) {
      scope[key] = new Decimal(value);
    } else if (typeof value === "boolean") {
      scope[key] = new Decimal(value ? 1 : 0);
    } else if (typeof value === "string") {
      scope[key] = value;
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

  function asDecimal(val: Value, context: string): Decimal {
    if (typeof val === "string") {
      throw new Error(`Expected a number in ${context}, got string "${val}"`);
    }
    return val;
  }

  function parseExpr(): Value {
    return parseLogicalOr();
  }

  function parseLogicalOr(): Value {
    let val = parseLogicalAnd();
    while (peek() === "||") {
      consume();
      const right = parseLogicalAnd();
      const truthy = !asDecimal(val, "'||'").isZero() || !asDecimal(right, "'||'").isZero();
      val = new Decimal(truthy ? 1 : 0);
    }
    return val;
  }

  function parseLogicalAnd(): Value {
    let val = parseComp();
    while (peek() === "&&") {
      consume();
      const right = parseComp();
      const truthy = !asDecimal(val, "'&&'").isZero() && !asDecimal(right, "'&&'").isZero();
      val = new Decimal(truthy ? 1 : 0);
    }
    return val;
  }

  function parseComp(): Value {
    let val = parseTerm();
    while (index < tokens.length) {
      const op = peek();
      if (op === ">" || op === "<" || op === ">=" || op === "<=" || op === "==" || op === "!=") {
        consume();
        const right = parseTerm();
        let condition: boolean;
        if (op === "==" || op === "!=") {
          const equal = typeof val === "string" || typeof right === "string"
            ? String(val instanceof Decimal ? val.toString() : val) === String(right instanceof Decimal ? right.toString() : right)
            : val.equals(right);
          condition = op === "==" ? equal : !equal;
        } else {
          const l = asDecimal(val, `'${op}'`);
          const r = asDecimal(right, `'${op}'`);
          if (op === ">") condition = l.gt(r);
          else if (op === "<") condition = l.lt(r);
          else if (op === ">=") condition = l.gte(r);
          else condition = l.lte(r);
        }
        val = new Decimal(condition ? 1 : 0);
      } else {
        break;
      }
    }
    return val;
  }

  function parseTerm(): Value {
    let val = parseFactor();
    while (index < tokens.length) {
      const op = peek();
      if (op === "+" || op === "-") {
        consume();
        const right = parseFactor();
        const l = asDecimal(val, `'${op}'`);
        const r = asDecimal(right, `'${op}'`);
        val = op === "+" ? l.plus(r) : l.minus(r);
      } else {
        break;
      }
    }
    return val;
  }

  function parseFactor(): Value {
    let val = parseUnary();
    while (index < tokens.length) {
      const op = peek();
      if (op === "*" || op === "/") {
        consume();
        const right = parseUnary();
        const l = asDecimal(val, `'${op}'`);
        const r = asDecimal(right, `'${op}'`);
        if (op === "*") val = l.mul(r);
        else {
          if (r.isZero()) throw new Error("Division by zero in expression evaluation");
          val = l.div(r);
        }
      } else {
        break;
      }
    }
    return val;
  }

  function parseUnary(): Value {
    if (peek() === "-") {
      consume();
      return asDecimal(parseUnary(), "unary '-'").negated();
    }
    if (peek() === "!") {
      consume();
      const val = asDecimal(parseUnary(), "unary '!'");
      return new Decimal(val.isZero() ? 1 : 0);
    }
    return parsePrimary();
  }

  function parsePrimary(): Value {
    const token = consume();
    if (token === undefined) throw new Error("Unexpected end of expression");

    if (token === "(") {
      const val = parseExpr();
      const next = consume();
      if (next !== ")") throw new Error("Expected ')' in expression");
      return val;
    }

    // String literal (quotes preserved by the tokenizer to disambiguate from identifiers)
    if (token.length >= 2 && (token[0] === "'" || token[0] === '"') && token[token.length - 1] === token[0]) {
      return token.slice(1, -1);
    }

    // Number literal
    if (!isNaN(Number(token))) {
      return new Decimal(token);
    }

    // Variable lookup
    if (scope[token] !== undefined) {
      return scope[token];
    }

    // Unknown variable — warn loudly so typos are diagnosable; return 0 so balance check catches it
    console.warn(`[expressionEval] unknown variable "${token}" in expression — check document payload`);
    return new Decimal(0);
  }

  const result = parseExpr();
  if (index < tokens.length) {
    throw new Error(`Unexpected token at position ${index}: ${tokens[index]}`);
  }
  return asDecimal(result, "expression result");
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

    // Logical operators: &&, ||
    if (char === "&" && expression[i + 1] === "&") {
      result.push("&&");
      i += 2;
      continue;
    }
    if (char === "|" && expression[i + 1] === "|") {
      result.push("||");
      i += 2;
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

    // Single-char comparisons/unary: >, <, !
    if (char === ">" || char === "<" || char === "!") {
      result.push(char);
      i++;
      continue;
    }

    // String literals: 'value' or "value"
    if (char === "'" || char === '"') {
      const quote = char;
      let str = quote;
      i++;
      while (i < expression.length && expression[i] !== quote) {
        str += expression[i];
        i++;
      }
      if (expression[i] !== quote) {
        throw new Error(`Unterminated string literal in expression: ${expression}`);
      }
      str += quote;
      i++;
      result.push(str);
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
