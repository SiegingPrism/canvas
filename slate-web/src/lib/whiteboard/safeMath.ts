/**
 * Safe Mathematical Expression Evaluator
 * Replaces unsafe `new Function` / `eval` with a deterministic, sandboxed AST evaluator.
 * Pre-compiles expressions into reusable closures to eliminate per-point JIT compilation.
 */

type Token =
  | { type: "num"; value: number }
  | { type: "var"; name: "x" }
  | { type: "op"; value: "+" | "-" | "*" | "/" | "^" }
  | { type: "fn"; name: string }
  | { type: "lparen" }
  | { type: "rparen" };

type ASTNode =
  | { type: "num"; value: number }
  | { type: "var" }
  | { type: "binop"; op: "+" | "-" | "*" | "/" | "^"; left: ASTNode; right: ASTNode }
  | { type: "unary"; op: "-"; arg: ASTNode }
  | { type: "call"; name: string; arg: ASTNode };

const KNOWN_FUNCTIONS: Record<string, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  log10: Math.log10,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
};

const KNOWN_CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  π: Math.PI,
  e: Math.E,
};

function tokenize(input: string): Token[] | null {
  let expr = input.toLowerCase().trim();
  expr = expr.replace(/^y\s*=\s*/, "").replace(/^f\(x\)\s*=\s*/, "");

  // Insert implicit multiplication: e.g. 2x -> 2*x, 3( -> 3*(, )x -> )*x
  expr = expr.replace(/(\d)\s*([a-zπ(])/g, "$1*$2");
  expr = expr.replace(/(\))\s*([a-z0-9π(])/g, "$1*$2");

  const tokens: Token[] = [];
  let i = 0;
  const n = expr.length;

  while (i < n) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (/\d|\./.test(ch)) {
      let numStr = "";
      while (i < n && /[\d.]/.test(expr[i])) {
        numStr += expr[i++];
      }
      const val = parseFloat(numStr);
      if (isNaN(val)) return null;
      tokens.push({ type: "num", value: val });
      continue;
    }

    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "^") {
      // Support ** as ^
      if (ch === "*" && expr[i + 1] === "*") {
        tokens.push({ type: "op", value: "^" });
        i += 2;
        continue;
      }
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen" });
      i++;
      continue;
    }

    if (/[a-zπ]/.test(ch)) {
      let ident = "";
      while (i < n && /[a-z0-9π_]/.test(expr[i])) {
        ident += expr[i++];
      }

      if (ident === "x") {
        tokens.push({ type: "var", name: "x" });
        continue;
      }

      if (ident in KNOWN_CONSTANTS) {
        tokens.push({ type: "num", value: KNOWN_CONSTANTS[ident] });
        continue;
      }

      if (ident in KNOWN_FUNCTIONS) {
        tokens.push({ type: "fn", name: ident });
        continue;
      }

      // Unknown identifier / potentially malicious function
      return null;
    }

    // Unknown character
    return null;
  }

  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  parse(): ASTNode | null {
    try {
      const node = this.parseExpression();
      if (this.pos < this.tokens.length) return null;
      return node;
    } catch {
      return null;
    }
  }

  // Expression: additive (+, -)
  private parseExpression(): ASTNode {
    let node = this.parseTerm();
    while (this.peek()?.type === "op" && (this.peek() as any).value === "+" || (this.peek() as any)?.value === "-") {
      const op = (this.consume() as any).value as "+" | "-";
      const right = this.parseTerm();
      node = { type: "binop", op, left: node, right };
    }
    return node;
  }

  // Term: multiplicative (*, /)
  private parseTerm(): ASTNode {
    let node = this.parsePower();
    while (this.peek()?.type === "op" && (this.peek() as any).value === "*" || (this.peek() as any)?.value === "/") {
      const op = (this.consume() as any).value as "*" | "/";
      const right = this.parsePower();
      node = { type: "binop", op, left: node, right };
    }
    return node;
  }

  // Power: ^ (right-associative)
  private parsePower(): ASTNode {
    let node = this.parseFactor();
    if (this.peek()?.type === "op" && (this.peek() as any).value === "^") {
      this.consume();
      const right = this.parsePower();
      node = { type: "binop", op: "^", left: node, right };
    }
    return node;
  }

  // Factor: unary, calls, parens, literals
  private parseFactor(): ASTNode {
    const t = this.peek();
    if (!t) throw new Error("Unexpected end of tokens");

    // Unary plus/minus
    if (t.type === "op" && t.value === "-") {
      this.consume();
      const arg = this.parseFactor();
      return { type: "unary", op: "-", arg };
    }
    if (t.type === "op" && t.value === "+") {
      this.consume();
      return this.parseFactor();
    }

    if (t.type === "num") {
      this.consume();
      return { type: "num", value: t.value };
    }

    if (t.type === "var") {
      this.consume();
      return { type: "var" };
    }

    if (t.type === "fn") {
      const fnToken = this.consume() as { type: "fn"; name: string };
      if (this.peek()?.type !== "lparen") {
        throw new Error("Expected '(' after function name");
      }
      this.consume(); // (
      const arg = this.parseExpression();
      if (this.peek()?.type !== "rparen") {
        throw new Error("Expected ')' after function argument");
      }
      this.consume(); // )
      return { type: "call", name: fnToken.name, arg };
    }

    if (t.type === "lparen") {
      this.consume(); // (
      const expr = this.parseExpression();
      if (this.peek()?.type !== "rparen") {
        throw new Error("Unclosed parenthesis");
      }
      this.consume(); // )
      return expr;
    }

    throw new Error(`Unexpected token ${JSON.stringify(t)}`);
  }
}

function evaluateAST(node: ASTNode, x: number): number {
  switch (node.type) {
    case "num":
      return node.value;
    case "var":
      return x;
    case "unary":
      return -evaluateAST(node.arg, x);
    case "call": {
      const fn = KNOWN_FUNCTIONS[node.name];
      if (!fn) return NaN;
      return fn(evaluateAST(node.arg, x));
    }
    case "binop": {
      const l = evaluateAST(node.left, x);
      const r = evaluateAST(node.right, x);
      switch (node.op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          return r === 0 ? NaN : l / r;
        case "^":
          return Math.pow(l, r);
      }
    }
  }
}

// Simple compiled evaluator cache to avoid re-parsing on every frame
const astCache = new Map<string, ASTNode | null>();

/**
 * Pre-compiles a mathematical expression into a safe, sandboxed evaluation function.
 * Returns a fast function `(x: number) => number | null`.
 */
export function compileMathFunction(formula: string): (x: number) => number | null {
  if (!formula || typeof formula !== "string") {
    return () => null;
  }

  const key = formula.trim().toLowerCase();
  let ast = astCache.get(key);

  if (ast === undefined) {
    const tokens = tokenize(key);
    if (!tokens || tokens.length === 0) {
      astCache.set(key, null);
      return () => null;
    }
    const parser = new Parser(tokens);
    ast = parser.parse();
    astCache.set(key, ast);
  }

  if (!ast) {
    return () => null;
  }

  return (x: number) => {
    try {
      const res = evaluateAST(ast!, x);
      return isFinite(res) && !isNaN(res) ? res : null;
    } catch {
      return null;
    }
  };
}

/**
 * Direct evaluation helper (used for single-point checks).
 */
export function safeEvaluateMath(formula: string, x: number): number | null {
  const fn = compileMathFunction(formula);
  return fn(x);
}
