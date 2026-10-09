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

  it("strictly prevents code injection attempts", () => {
    // Malicious injection strings should evaluate to null without executing any code
    expect(safeEvaluateMath("console.log('attack')")).toBeNull();
    expect(safeEvaluateMath("process.exit(1)")).toBeNull();
    expect(safeEvaluateMath("function() { return 1; }()")).toBeNull();
    expect(safeEvaluateMath("window.location = 'evil'")).toBeNull();
  });
});
