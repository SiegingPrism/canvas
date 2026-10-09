import { describe, it, expect } from "vitest";
import { safeEvaluateMath, compileMathFunction } from "./safeMath";

describe("safeMath evaluator and compiler", () => {
  it("evaluates basic arithmetic expressions", () => {
    expect(safeEvaluateMath("2 + 3 * 4")).toBe(14);
    expect(safeEvaluateMath("(2 + 3) * 4")).toBe(20);
    expect(safeEvaluateMath("10 / 2 - 1")).toBe(4);
    expect(safeEvaluateMath("2^3")).toBe(8);
    expect(safeEvaluateMath("2**3")).toBe(8);
  });

  it("handles mathematical functions and constants", () => {
    expect(safeEvaluateMath("sin(0)")).toBe(0);
    expect(safeEvaluateMath("cos(0)")).toBe(1);
    expect(safeEvaluateMath("sqrt(16)")).toBe(4);
    expect(safeEvaluateMath("abs(-42)")).toBe(42);
    expect(safeEvaluateMath("pi")).toBeCloseTo(Math.PI);
    expect(safeEvaluateMath("e")).toBeCloseTo(Math.E);
  });

  it("supports implicit multiplication and variables", () => {
    expect(safeEvaluateMath("2x", 5)).toBe(10);
    expect(safeEvaluateMath("3(x + 2)", 4)).toBe(18);
    expect(safeEvaluateMath("x^2 + 2x + 1", 3)).toBe(16);
  });

  it("precompiles functions efficiently", () => {
    const fn = compileMathFunction("sin(x) * 2");
    expect(fn(0)).toBe(0);
    expect(fn(Math.PI / 2)).toBeCloseTo(2);
    expect(fn(Math.PI)).toBeCloseTo(0);
  });

  it("correctly handles unary minus precedence (-x^2 and -2^2)", () => {
    // -x^2 at x=1 should be -1, so -x^2 + 4 at x=1 must be 3
    expect(safeEvaluateMath("-x^2 + 4", 1)).toBe(3);
    expect(safeEvaluateMath("-x^2 + 4", 2)).toBe(0);
    // -2^2 should be -(2^2) = -4
    expect(safeEvaluateMath("-2^2")).toBe(-4);
    // (-2)^2 should be 4
    expect(safeEvaluateMath("(-2)^2")).toBe(4);
    // Negative exponent 2^-3 = 0.125
    expect(safeEvaluateMath("2^-3")).toBe(0.125);
  });

  it("handles log10 and scientific notation without splitting", () => {
    // log10(x) should not be split into log10*(x)
    expect(safeEvaluateMath("log10(100)")).toBe(2);
    expect(safeEvaluateMath("log10(x)", 1000)).toBe(3);
    // 1e-3 should be 0.001, not 1*e - 3
    expect(safeEvaluateMath("1e-3")).toBe(0.001);
    expect(safeEvaluateMath("2.5e2")).toBe(250);
  });

  it("strictly prevents code injection attempts", () => {
    // Malicious injection strings should evaluate to null without executing any code
    expect(safeEvaluateMath("console.log('attack')")).toBeNull();
    expect(safeEvaluateMath("process.exit(1)")).toBeNull();
    expect(safeEvaluateMath("function() { return 1; }()")).toBeNull();
    expect(safeEvaluateMath("window.location = 'evil'")).toBeNull();
  });
});
