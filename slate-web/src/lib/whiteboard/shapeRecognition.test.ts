import { describe, it, expect } from "vitest";
import { recognizeShape } from "./shapeRecognition";

function interpolate(p1: { x: number; y: number }, p2: { x: number; y: number }, steps = 15) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push({ x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t });
  }
  return pts;
}

function polyline(corners: { x: number; y: number }[]) {
  const pts = [];
  for (let i = 0; i < corners.length; i++) {
    const next = corners[(i + 1) % corners.length];
    pts.push(...interpolate(corners[i], next));
  }
  return pts;
}

describe("shapeRecognition", () => {
  it("recognizes a rectangle correctly and does not confuse it for a pentagon", () => {
    // 160 x 80 rectangle with slightly overlapping start/end
    const corners = [
      { x: 10, y: 10 },
      { x: 170, y: 10 },
      { x: 170, y: 90 },
      { x: 10, y: 90 },
    ];
    const pts = polyline(corners);
    const result = recognizeShape(pts, "#000000", 2);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("shape");
    if (result && result.kind === "shape") {
      expect(result.shape).toBe("rect");
    }
  });

  it("recognizes a square correctly as rect", () => {
    const corners = [
      { x: 20, y: 20 },
      { x: 120, y: 20 },
      { x: 120, y: 120 },
      { x: 20, y: 120 },
    ];
    const pts = polyline(corners);
    const result = recognizeShape(pts, "#000000", 2);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("shape");
    if (result && result.kind === "shape") {
      expect(result.shape).toBe("rect");
    }
  });

  it("recognizes a pentagon", () => {
    // 5 vertices around a circle of radius 60
    const corners = [];
    const r = 60;
    const cx = 100;
    const cy = 100;
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      corners.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    }
    const pts = polyline(corners);
    const result = recognizeShape(pts, "#000000", 2);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("shape");
    if (result && result.kind === "shape") {
      expect(result.shape).toBe("pentagon");
    }
  });

  it("recognizes a symmetrical / equilateral triangle as 'triangle' and NOT 'right-triangle'", () => {
    // Upright equilateral triangle: apex at (100, 20), base from (30, 140) to (170, 140)
    const corners = [
      { x: 100, y: 20 },
      { x: 170, y: 140 },
      { x: 30, y: 140 },
    ];
    const pts = polyline(corners);
    const result = recognizeShape(pts, "#000000", 2);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("shape");
    if (result && result.kind === "shape") {
      expect(result.shape).toBe("triangle");
    }
  });

  it("recognizes a right-angled triangle as 'right-triangle'", () => {
    // Right triangle with right angle at (20, 120): (20, 20) -> (20, 120) -> (140, 120)
    const corners = [
      { x: 20, y: 20 },
      { x: 20, y: 120 },
      { x: 140, y: 120 },
    ];
    const pts = polyline(corners);
    const result = recognizeShape(pts, "#000000", 2);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("shape");
    if (result && result.kind === "shape") {
      expect(result.shape).toBe("right-triangle");
    }
  });
});
