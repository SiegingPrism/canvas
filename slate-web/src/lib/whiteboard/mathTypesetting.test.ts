import { describe, it, expect } from "vitest";
import {
  formatLatexForDisplay,
  parseStepText,
  replaceFractions,
  replaceSquareRoots,
} from "./mathTypesetting";

describe("mathTypesetting", () => {
  it("formats quadratic formula with nested square root in fraction", () => {
    const raw = "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}";
    const formatted = formatLatexForDisplay(raw);
    expect(formatted).toContain("(-b ± √(b² - 4ac) / 2a)");
    expect(formatted).not.toContain("\\frac");
    expect(formatted).not.toContain("\\sqrt");
    expect(formatted).not.toContain("\\pm");
  });

  it("cleans duplicate = x = prefixes", () => {
    const raw = "= x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}";
    const formatted = formatLatexForDisplay(raw);
    expect(formatted.startsWith("x =")).toBe(true);
    expect(formatted.startsWith("= x =")).toBe(false);
  });

  it("formats fractions with multiple terms", () => {
    const raw = "x^2 + \\frac{b}{a}x + \\frac{c}{a} = 0";
    const formatted = formatLatexForDisplay(raw);
    expect(formatted).toBe("x² + (b / a)x + (c / a) = 0");
  });

  it("formats completing the square step with powers and fractions", () => {
    const raw =
      "\\left(x + \\frac{b}{2a}\\right)^2 = \\frac{b^2 - 4ac}{4a^2}";
    const formatted = formatLatexForDisplay(raw);
    expect(formatted).toContain("(x + (b / 2a))² = (b² - 4ac / 4a²)");
  });

  it("strips dollar signs and cleans text wrappers", () => {
    const raw = "Solve for $x$: $x = \\pm \\sqrt{4}$.";
    const formatted = formatLatexForDisplay(raw);
    expect(formatted).not.toContain("$");
    expect(formatted).toContain("x = ± √(4)");
  });

  it("parses step strings with colon and equations", () => {
    const step =
      "Step 2: Divide all terms by the leading coefficient a: x^2 + \\frac{b}{a}x + \\frac{c}{a} = 0";
    const parsed = parseStepText(step);
    expect(parsed.stepNum).toBe(2);
    expect(parsed.title).toBe("Divide all terms by the leading coefficient a");
    expect(parsed.equation).toBe("x² + (b / a)x + (c / a) = 0");
  });

  it("parses step strings with inline dollar math", () => {
    const step =
      "Add 4 to both sides of the equation to isolate the squared term: $x^2 = 4$.";
    const parsed = parseStepText(step, 1);
    expect(parsed.stepNum).toBe(1);
    expect(parsed.title).toBe(
      "Add 4 to both sides of the equation to isolate the squared term",
    );
    expect(parsed.equation).toBe("x² = 4");
  });

  it("parses linear equation steps cleanly", () => {
    const step = "Subtract 6 from both sides of the equation: 2x = 14 - 6";
    const parsed = parseStepText(step, 1);
    expect(parsed.stepNum).toBe(1);
    expect(parsed.title).toBe("Subtract 6 from both sides of the equation");
    expect(parsed.equation).toBe("2x = 14 - 6");
  });

  it("formats trigonometric and set notation cleanly without backslashes", () => {
    const raw = "x = k\\pi, \\quad k \\in \\mathbb{Z}";
    const formatted = formatLatexForDisplay(raw);
    expect(formatted).toBe("x = kπ, k ∈ ℤ");
    expect(formatted).not.toContain("\\");
  });

  it("formats sine and cosine functions cleanly", () => {
    const raw = "\\sin(x) = \\cos\\left(x + \\frac{\\pi}{2}\\right)";
    const formatted = formatLatexForDisplay(raw);
    expect(formatted).toBe("sin(x) = cos(x + (π / 2))");
    expect(formatted).not.toContain("\\sin");
    expect(formatted).not.toContain("\\cos");
  });
});
