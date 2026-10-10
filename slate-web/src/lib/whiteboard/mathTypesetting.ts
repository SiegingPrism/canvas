/**
 * Math typesetting & LaTeX cleaning utilities for whiteboard rendering.
 */

/**
 * Extracts a balanced braced group `{...}` starting at or after `startIndex`.
 * Returns `{ content, start, end }` or null if no balanced brace is found.
 */
export function extractBracedGroup(
  str: string,
  startIndex: number,
): { content: string; start: number; end: number } | null {
  const firstBrace = str.indexOf("{", startIndex);
  if (firstBrace === -1) return null;

  let depth = 0;
  for (let i = firstBrace; i < str.length; i++) {
    if (str[i] === "{") depth++;
    else if (str[i] === "}") {
      depth--;
      if (depth === 0) {
        return {
          content: str.slice(firstBrace + 1, i),
          start: firstBrace,
          end: i,
        };
      }
    }
  }
  return null;
}

/**
 * Recursively replaces `\frac{numerator}{denominator}` using balanced brace matching.
 */
export function replaceFractions(str: string): string {
  const fracIdx = str.indexOf("\\frac");
  if (fracIdx === -1) return str;

  const numGroup = extractBracedGroup(str, fracIdx);
  if (!numGroup) return str;

  const denGroup = extractBracedGroup(str, numGroup.end + 1);
  if (!denGroup) return str;

  // Verify that only whitespace or nothing separates numGroup.end and denGroup.start
  const inBetween = str.slice(numGroup.end + 1, denGroup.start).trim();
  if (inBetween !== "") return str;

  const num = replaceFractions(numGroup.content.trim());
  const den = replaceFractions(denGroup.content.trim());

  const before = str.slice(0, fracIdx);
  const after = str.slice(denGroup.end + 1);

  return before + `(${num} / ${den})` + replaceFractions(after);
}

/**
 * Recursively replaces `\sqrt[n]{radicand}` or `\sqrt{radicand}` using balanced brace matching.
 */
export function replaceSquareRoots(str: string): string {
  const sqrtIdx = str.indexOf("\\sqrt");
  if (sqrtIdx === -1) return str;

  let afterSqrtIdx = sqrtIdx + 5;
  let rootDegree = "";

  // Check for optional `[n]`
  if (str[afterSqrtIdx] === "[") {
    const closeBracket = str.indexOf("]", afterSqrtIdx);
    if (closeBracket !== -1) {
      rootDegree = str.slice(afterSqrtIdx + 1, closeBracket).trim();
      afterSqrtIdx = closeBracket + 1;
    }
  }

  const group = extractBracedGroup(str, afterSqrtIdx);
  if (!group) return str;

  const inner = replaceSquareRoots(group.content.trim());
  const before = str.slice(0, sqrtIdx);
  const after = str.slice(group.end + 1);

  const prefix = rootDegree ? `${rootDegree}√` : "√";
  return before + `${prefix}(${inner})` + replaceSquareRoots(after);
}

/**
 * Converts superscripts like `x^2`, `b^2`, `(4a)^2` into clean Unicode superscripts where appropriate,
 * or standard readable mathematical notation.
 */
export function formatSuperscripts(str: string): string {
  const superscripts: Record<string, string> = {
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
    "+": "⁺",
    "-": "⁻",
    "=": "⁼",
    "(": "⁽",
    ")": "⁾",
    n: "ⁿ",
    i: "ⁱ",
    x: "ˣ",
  };

  return str.replace(/\^\{([0-9+\-nix]+)\}|\^([0-9+\-nix])/g, (_, p1, p2) => {
    const exp = p1 || p2;
    return exp
      .split("")
      .map((c: string) => superscripts[c] || `^${c}`)
      .join("");
  });
}

/**
 * Converts LaTeX formulas and math expressions into clean, human-readable mathematical text.
 */
export function formatLatexForDisplay(latex: string): string {
  if (!latex) return "";
  let s = latex.trim();

  // Strip duplicate `= x =` or leading `= `
  s = s.replace(/^=\s*(?=[a-z]\s*=)/i, "");
  s = s.replace(/^=\s*/, "");

  // Strip enclosing or inline dollar signs ($...$ or $$...$$)
  s = s.replace(/\$+/g, "");

  // Replace recursive fractions and square roots
  s = replaceFractions(s);
  s = replaceSquareRoots(s);

  // Clean \\left and \\right before \\le/\\ge replacement
  s = s.replace(/\\left|\\right/g, "");

  // Greek letters and standard symbols
  s = s
    .replace(/\\pm/g, "±")
    .replace(/\\mp/g, "∓")
    .replace(/\\neq/g, "≠")
    .replace(/\\approx/g, "≈")
    .replace(/\\le(q)?\b/g, "≤")
    .replace(/\\ge(q)?\b/g, "≥")
    .replace(/\\times/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\cdot/g, "·")
    .replace(/\\pi/g, "π")
    .replace(/\\alpha/g, "α")
    .replace(/\\beta/g, "β")
    .replace(/\\gamma/g, "γ")
    .replace(/\\theta/g, "θ")
    .replace(/\\lambda/g, "λ")
    .replace(/\\mu/g, "μ")
    .replace(/\\sigma/g, "σ")
    .replace(/\\phi/g, "φ")
    .replace(/\\Delta/g, "Δ")
    .replace(/\\infty/g, "∞")
    .replace(/\\int/g, "∫")
    .replace(/\\sum/g, "∑")
    .replace(/\\partial/g, "∂")
    .replace(/\\nabla/g, "∇")
    .replace(/\\to/g, "→")
    .replace(/\\rightarrow/g, "→")
    .replace(/\\leftarrow/g, "←")
    .replace(/\\implies/g, "⟹")
    .replace(/\\left|\\right/g, "")
    .replace(/\\,/g, " ")
    .replace(/\\;/g, " ")
    .replace(/\\quad/g, "  ")
    .replace(/\\qquad/g, "    ")
    .replace(/\\(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh|arcsin|arccos|arctan|ln|log|exp|det|dim|ker)\b/g, "$1")
    .replace(/\\deg\b/g, "°")
    .replace(/\\in\b/g, "∈")
    .replace(/\\notin\b/g, "∉")
    .replace(/\\subset(eq)?\b/g, "⊆")
    .replace(/\\cup\b/g, "∪")
    .replace(/\\cap\b/g, "∩")
    .replace(/\\forall\b/g, "∀")
    .replace(/\\exists\b/g, "∃")
    .replace(/\\mathbb\{Z\}|\b\\mathbb\s*Z\b/g, "ℤ")
    .replace(/\\mathbb\{R\}|\b\\mathbb\s*R\b/g, "ℝ")
    .replace(/\\mathbb\{N\}|\b\\mathbb\s*N\b/g, "ℕ")
    .replace(/\\mathbb\{Q\}|\b\\mathbb\s*Q\b/g, "ℚ")
    .replace(/\\mathbb\{C\}|\b\\mathbb\s*C\b/g, "ℂ")
    .replace(/\\mathbb\{([^}]+)\}/g, "$1")
    .replace(/\\text\{([^}]+)\}/g, "$1")
    .replace(/\\mathbf\{([^}]+)\}/g, "$1")
    .replace(/\\mathrm\{([^}]+)\}/g, "$1")
    .replace(/\\operatorname\{([^}]+)\}/g, "$1")
    .replace(/\\math[a-z]+\{([^}]+)\}/g, "$1")
    .replace(/\\([a-zA-Z]+)/g, "$1")
    .replace(/[{}]/g, "");

  // Format superscripts cleanly
  s = formatSuperscripts(s);

  // Clean extra spaces
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

export interface ParsedStep {
  stepNum?: number;
  title: string;
  equation?: string;
  rawText: string;
}

/**
 * Parses a step string (such as "Step 2: Divide all terms by leading coefficient a: x^2 + b/a*x + c/a = 0")
 * into a step number, readable explanation title, and mathematical equation.
 */
export function parseStepText(step: string, fallbackIndex = 1): ParsedStep {
  let clean = step.trim().replace(/^[•*\-–—]\s*/, "");

  // Match "Step 1: ...", "Step 2. ...", "1. ..."
  let stepNum = fallbackIndex;
  let remaining = clean;

  const stepMatch = clean.match(/^step\s*(\d+)[:.\-]?\s*/i);
  if (stepMatch) {
    stepNum = parseInt(stepMatch[1], 10);
    remaining = clean.slice(stepMatch[0].length).trim();
  } else {
    const numMatch = clean.match(/^(\d+)[:.)]\s*/);
    if (numMatch) {
      stepNum = parseInt(numMatch[1], 10);
      remaining = clean.slice(numMatch[0].length).trim();
    }
  }

  let title = remaining;
  let equation: string | undefined = undefined;

  // Case 1: Title and equation separated by colon: "Action explanation: x^2 + ... = 0"
  const colonIdx = remaining.indexOf(":");
  if (colonIdx !== -1 && colonIdx < remaining.length - 2) {
    const candidateTitle = remaining.slice(0, colonIdx).trim();
    const candidateEq = remaining.slice(colonIdx + 1).trim();

    if (/[=+\-*/\\^<>~±√(]/.test(candidateEq) || /\b[a-zA-Z]\b/.test(candidateEq) || /\d/.test(candidateEq)) {
      title = candidateTitle;
      equation = candidateEq.replace(/\.$/, "").trim();
    }
  } else {
    // Case 2: Equation wrapped in $...$ at end: "Explanation $x = 4$."
    const inlineMath = remaining.match(/^(.*?)(?:[:\s]+)?\$([^$]+)\$\.?$/);
    if (inlineMath) {
      title = inlineMath[1].replace(/[:\s]+$/, "").trim();
      equation = inlineMath[2].trim();
    }
  }

  // Clean title trailing colons or dots
  title = title.replace(/[:\s]+$/, "").trim();
  if (!title) title = `Step ${stepNum}`;

  return {
    stepNum,
    title,
    equation: equation ? formatLatexForDisplay(equation) : undefined,
    rawText: clean,
  };
}
