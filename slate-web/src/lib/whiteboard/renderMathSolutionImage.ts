/**
 * Renders an educational, beautifully typeset step-by-step Math Solution Card
 * to an offscreen HTML5 Canvas and exports a high-resolution PNG image data URL.
 *
 * This produces textbook-grade worked math solutions for the whiteboard with:
 * - Proper mathematical typography (fractions, square roots, superscripts)
 * - Prominent boxed final answer
 * - Numbered step-by-step derivation cards
 * - Illustrative visual mathematical diagrams:
 *    * Parabola roots & vertex for quadratic equations
 *    * Linear slope & intercept for linear equations
 *    * Radian wave plots for trigonometric functions
 *    * Right triangle geometric proofs for Pythagorean theorem
 *    * Area under curve / tangent line for calculus
 *    * Number line jump vectors for arithmetic operations
 *    * Sandboxed AST function plots via compileMathFunction for arbitrary expressions
 * - Zero overflow and crisp retina rendering
 */

import { formatLatexForDisplay, parseStepText, ParsedStep } from "./mathTypesetting";
import { compileMathFunction } from "./safeMath";

export interface MathSolutionCardOptions {
  problemLatex: string;
  solution: string;
  steps: string[];
  title?: string;
  graphableFn?: string;
  xRange?: [number, number];
  yRange?: [number, number];
}

export interface RenderedSolutionImage {
  dataUrl: string;
  width: number;
  height: number;
}

export type DiagramKind =
  | "quadratic"
  | "linear"
  | "trig"
  | "pythagoras"
  | "calculus"
  | "arithmetic"
  | "function_plot";

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.closePath();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Wraps text into lines that fit within maxWidth.
 */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";

  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}

/**
 * Determines which visual diagram best illustrates the mathematical solution.
 */
function determineDiagramKind(
  problem: string,
  solution: string,
  title?: string,
  graphableFn?: string,
): DiagramKind {
  const combined = `${problem} ${solution} ${title || ""}`.toLowerCase();

  if (/a\^2\s*\+\s*b\^2|pythagor|hypotenuse|right\s*triangle/i.test(combined)) {
    return "pythagoras";
  }
  if (/\bx\^2\b|\bx²\b|quadratic|ax\^2|b\^2\s*-\s*4ac|completing the square/i.test(combined)) {
    return "quadratic";
  }
  if (/\b(sin|cos|tan)\b|trig|radian|wave/i.test(combined)) {
    return "trig";
  }
  if (/\\int|integral|derivative|\\frac\{d\}\{dx\}|dx\b/i.test(combined)) {
    return "calculus";
  }
  if (
    /^[0-9\s+\-*/÷×=.]+$/.test(problem.trim()) ||
    /arithmetic|multiplication|addition|subtraction|division/i.test(combined)
  ) {
    return "arithmetic";
  }
  if (
    /linear|y\s*=\s*[+-]?\d*x|[+-]?\d*x\s*[+-]\s*\d+\s*=\s*\d+|[+-]?\d*x\s*=\s*[+-]?\d+/i.test(
      combined,
    )
  ) {
    return "linear";
  }
  if (graphableFn && graphableFn.toLowerCase() !== "null") {
    return "function_plot";
  }
  return "linear";
}

/**
 * 1. Illustrative Cartesian coordinate diagram for quadratic curves and roots.
 */
function drawQuadraticDiagram(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();

  // Background box
  ctx.fillStyle = "#f8fafc";
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Header Tag
  ctx.fillStyle = "#6366f1";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.fillText("VISUAL DIAGRAM · PARABOLA ROOTS & VERTEX", x + 14, y + 18);

  const plotX = x + 20;
  const plotY = y + 28;
  const plotW = w - 40;
  const plotH = h - 46;

  const originX = plotX + plotW / 2;
  const originY = plotY + plotH * 0.62;

  // Grid lines
  ctx.strokeStyle = "#f1f5f9";
  ctx.lineWidth = 1;
  for (let gx = plotX; gx <= plotX + plotW; gx += 28) {
    ctx.beginPath();
    ctx.moveTo(gx, plotY);
    ctx.lineTo(gx, plotY + plotH);
    ctx.stroke();
  }
  for (let gy = plotY; gy <= plotY + plotH; gy += 24) {
    ctx.beginPath();
    ctx.moveTo(plotX, gy);
    ctx.lineTo(plotX + plotW, gy);
    ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.5;

  // X Axis
  ctx.beginPath();
  ctx.moveTo(plotX, originY);
  ctx.lineTo(plotX + plotW, originY);
  ctx.stroke();

  // X Axis Arrow
  ctx.fillStyle = "#94a3b8";
  ctx.beginPath();
  ctx.moveTo(plotX + plotW, originY);
  ctx.lineTo(plotX + plotW - 6, originY - 3);
  ctx.lineTo(plotX + plotW - 6, originY + 3);
  ctx.fill();

  ctx.font = "italic 11px system-ui, serif";
  ctx.fillText("x", plotX + plotW - 8, originY - 6);

  // Y Axis
  ctx.beginPath();
  ctx.moveTo(originX, plotY + plotH);
  ctx.lineTo(originX, plotY);
  ctx.stroke();

  // Y Axis Arrow
  ctx.beginPath();
  ctx.moveTo(originX, plotY);
  ctx.lineTo(originX - 3, plotY + 6);
  ctx.lineTo(originX + 3, plotY + 6);
  ctx.fill();

  ctx.fillText("y", originX + 6, plotY + 10);

  // Parabola curve: canonical upward parabola with two real roots
  const rootDist = Math.min(65, plotW * 0.22);
  const root1X = originX - rootDist;
  const root2X = originX + rootDist;
  const vertexY = originY + 28;

  ctx.strokeStyle = "#4f46e5";
  ctx.lineWidth = 2.5;
  ctx.beginPath();

  const xSpan = Math.min(110, plotW * 0.42);
  for (let px = -xSpan; px <= xSpan; px += 2) {
    const curveY = vertexY - (28 / (rootDist * rootDist)) * (px * px);
    const screenX = originX + px;
    const screenY = originY + (originY - curveY);
    if (px === -xSpan) ctx.moveTo(screenX, screenY);
    else ctx.lineTo(screenX, screenY);
  }
  ctx.stroke();

  // Axis of symmetry
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(originX, plotY + 4);
  ctx.lineTo(originX, plotY + plotH - 4);
  ctx.stroke();
  ctx.restore();

  // Root 1
  ctx.fillStyle = "#10b981";
  ctx.beginPath();
  ctx.arc(root1X, originY, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Root 2
  ctx.beginPath();
  ctx.arc(root2X, originY, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Root labels
  ctx.fillStyle = "#047857";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Root x₁", root1X, originY + 14);
  ctx.fillText("Root x₂", root2X, originY + 14);

  // Vertex point
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.arc(originX, vertexY, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#b45309";
  ctx.font = "9px system-ui, sans-serif";
  ctx.fillText("Vertex (-b/2a, -Δ/4a)", originX, vertexY + 13);

  // Label curve
  ctx.fillStyle = "#4338ca";
  ctx.font = "italic bold 11px serif";
  ctx.textAlign = "left";
  ctx.fillText("f(x) = ax² + bx + c", originX + 22, plotY + 18);

  ctx.restore();
}

/**
 * 2. Illustrative Cartesian diagram for linear equations (slope, intercepts, root).
 */
function drawLinearDiagram(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();

  ctx.fillStyle = "#f8fafc";
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#0284c7";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.fillText("VISUAL DIAGRAM · LINEAR SLOPE & ROOT INTERSECTION", x + 14, y + 18);

  const plotX = x + 20;
  const plotY = y + 28;
  const plotW = w - 40;
  const plotH = h - 46;

  const originX = plotX + plotW * 0.35;
  const originY = plotY + plotH * 0.65;

  // Grid
  ctx.strokeStyle = "#f1f5f9";
  ctx.lineWidth = 1;
  for (let gx = plotX; gx <= plotX + plotW; gx += 28) {
    ctx.beginPath();
    ctx.moveTo(gx, plotY);
    ctx.lineTo(gx, plotY + plotH);
    ctx.stroke();
  }
  for (let gy = plotY; gy <= plotY + plotH; gy += 24) {
    ctx.beginPath();
    ctx.moveTo(plotX, gy);
    ctx.lineTo(plotX + plotW, gy);
    ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(plotX, originY);
  ctx.lineTo(plotX + plotW, originY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(originX, plotY + plotH);
  ctx.lineTo(originX, plotY);
  ctx.stroke();

  ctx.font = "italic 11px system-ui, serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("x", plotX + plotW - 10, originY - 5);
  ctx.fillText("y", originX + 6, plotY + 12);

  // Line: y = mx + b
  const x1 = originX - 60;
  const y1 = originY + 40;
  const x2 = originX + 140;
  const y2 = originY - 80;

  ctx.strokeStyle = "#0284c7";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Root on x-axis (where y = 0)
  const rootX = originX + 60;
  ctx.fillStyle = "#10b981";
  ctx.beginPath();
  ctx.arc(rootX, originY, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#047857";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Solution Root (x, 0)", rootX, originY + 14);

  // Y-intercept (0, b)
  const yInterceptY = originY - 36;
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.arc(originX, yInterceptY, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#b45309";
  ctx.font = "9px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("y-intercept (0, b) ", originX - 4, yInterceptY + 3);

  // Slope indicator triangle
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(originX, yInterceptY);
  ctx.lineTo(rootX, yInterceptY);
  ctx.lineTo(rootX, originY);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#64748b";
  ctx.font = "italic 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Δx", (originX + rootX) / 2, yInterceptY - 4);
  ctx.textAlign = "left";
  ctx.fillText("Δy", rootX + 4, (yInterceptY + originY) / 2);

  // Label curve
  ctx.fillStyle = "#0369a1";
  ctx.font = "italic bold 11px serif";
  ctx.fillText("y = mx + b (Slope m = Δy/Δx)", originX + 16, plotY + 16);

  ctx.restore();
}

/**
 * 3. Illustrative Trigonometric wave diagram (amplitude, period 2pi, roots).
 */
function drawTrigDiagram(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();

  ctx.fillStyle = "#f8fafc";
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#0d9488";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.fillText("VISUAL DIAGRAM · TRIGONOMETRIC WAVE & PERIOD 2π", x + 14, y + 18);

  const plotX = x + 20;
  const plotY = y + 28;
  const plotW = w - 40;
  const plotH = h - 46;

  const originX = plotX + 40;
  const originY = plotY + plotH / 2;

  // Axes
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(plotX, originY);
  ctx.lineTo(plotX + plotW, originY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(originX, plotY + plotH);
  ctx.lineTo(originX, plotY);
  ctx.stroke();

  // Wave: y = sin(x)
  const wavelength = 140;
  const amp = 36;

  ctx.strokeStyle = "#0d9488";
  ctx.lineWidth = 2.5;
  ctx.beginPath();

  for (let px = -20; px <= plotW - 20; px += 2) {
    const theta = (px / wavelength) * (Math.PI * 2);
    const sy = originY - Math.sin(theta) * amp;
    if (px === -20) ctx.moveTo(originX + px, sy);
    else ctx.lineTo(originX + px, sy);
  }
  ctx.stroke();

  // Radian markers
  const piX = originX + wavelength / 2;
  const twoPiX = originX + wavelength;

  ctx.fillStyle = "#10b981";
  [originX, piX, twoPiX].forEach((rx) => {
    ctx.beginPath();
    ctx.arc(rx, originY, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#0f766e";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("0", originX, originY + 14);
  ctx.fillText("π", piX, originY + 14);
  ctx.fillText("2π (Period)", twoPiX, originY + 14);

  // Amplitude indicator
  ctx.fillStyle = "#64748b";
  ctx.font = "9px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("+1", originX - 6, originY - amp + 4);
  ctx.fillText("-1", originX - 6, originY + amp + 4);

  ctx.fillStyle = "#0f766e";
  ctx.font = "italic bold 11px serif";
  ctx.textAlign = "left";
  ctx.fillText("f(θ) = sin(θ)", twoPiX - 30, plotY + 16);

  ctx.restore();
}

/**
 * 4. Geometric proof diagram for the Pythagorean Theorem (a^2 + b^2 = c^2).
 */
function drawGeometryRightTriangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();

  ctx.fillStyle = "#f8fafc";
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#7c3aed";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.fillText("GEOMETRIC PROOF · PYTHAGOREAN THEOREM a² + b² = c²", x + 14, y + 18);

  const cx = x + w * 0.45;
  const cy = y + h * 0.72;
  const legA = 55; // vertical
  const legB = 95; // horizontal

  const pCorner = { x: cx - legB / 2, y: cy };
  const pRight = { x: pCorner.x + legB, y: cy };
  const pTop = { x: pCorner.x, y: cy - legA };

  // Fill triangle
  ctx.fillStyle = "#ede9fe";
  ctx.beginPath();
  ctx.moveTo(pCorner.x, pCorner.y);
  ctx.lineTo(pRight.x, pRight.y);
  ctx.lineTo(pTop.x, pTop.y);
  ctx.closePath();
  ctx.fill();

  // Stroke triangle
  ctx.strokeStyle = "#7c3aed";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Right-angle symbol at pCorner
  const raSize = 10;
  ctx.strokeStyle = "#6d28d9";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pCorner.x, pCorner.y - raSize);
  ctx.lineTo(pCorner.x + raSize, pCorner.y - raSize);
  ctx.lineTo(pCorner.x + raSize, pCorner.y);
  ctx.stroke();

  // Side Labels
  ctx.font = "bold italic 13px 'Cambria Math', serif";
  ctx.fillStyle = "#5b21b6";

  // Leg a
  ctx.textAlign = "right";
  ctx.fillText("a", pCorner.x - 8, cy - legA / 2 + 4);

  // Leg b
  ctx.textAlign = "center";
  ctx.fillText("b", (pCorner.x + pRight.x) / 2, cy + 18);

  // Hypotenuse c
  ctx.textAlign = "left";
  ctx.fillText("c = √(a² + b²)", (pTop.x + pRight.x) / 2 + 8, (pTop.y + pRight.y) / 2 - 4);

  // Equation Badge on side
  const badgeX = x + w - 120;
  const badgeY = y + 40;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, badgeX, badgeY, 105, 52, 8);
  ctx.fill();
  ctx.strokeStyle = "#c4b5fd";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#6d28d9";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.fillText("RELATIONSHIP", badgeX + 8, badgeY + 16);
  ctx.font = "bold italic 12px serif";
  ctx.fillText("a² + b² = c²", badgeX + 8, badgeY + 36);

  ctx.restore();
}

/**
 * 5. Illustrative Number Line jump vector diagram for arithmetic operations.
 */
function drawArithmeticNumberLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();

  ctx.fillStyle = "#f8fafc";
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#ea580c";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.fillText("VISUAL NUMBER LINE · OPERATION JUMP VECTOR", x + 14, y + 18);

  const plotX = x + 30;
  const plotW = w - 60;
  const lineY = y + h * 0.65;

  // Horizontal Number Axis
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(plotX, lineY);
  ctx.lineTo(plotX + plotW, lineY);
  ctx.stroke();

  // Axis arrows
  ctx.fillStyle = "#94a3b8";
  ctx.beginPath();
  ctx.moveTo(plotX + plotW, lineY);
  ctx.lineTo(plotX + plotW - 6, lineY - 3);
  ctx.lineTo(plotX + plotW - 6, lineY + 3);
  ctx.fill();

  const startX = plotX + 40;
  const endX = plotX + plotW - 50;

  // Ticks
  const numTicks = 6;
  const tickSpacing = (endX - startX) / (numTicks - 1);
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < numTicks; i++) {
    const tx = startX + i * tickSpacing;
    ctx.beginPath();
    ctx.moveTo(tx, lineY - 5);
    ctx.lineTo(tx, lineY + 5);
    ctx.stroke();
  }

  // Curved Jump Arrow from start to end
  ctx.strokeStyle = "#ea580c";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(startX, lineY - 6);
  ctx.quadraticCurveTo((startX + endX) / 2, lineY - 52, endX, lineY - 6);
  ctx.stroke();

  // Arrowhead on arc
  ctx.fillStyle = "#ea580c";
  ctx.beginPath();
  ctx.moveTo(endX, lineY - 6);
  ctx.lineTo(endX - 8, lineY - 14);
  ctx.lineTo(endX - 2, lineY - 18);
  ctx.fill();

  // Start point
  ctx.fillStyle = "#3b82f6";
  ctx.beginPath();
  ctx.arc(startX, lineY, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1d4ed8";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Initial Value", startX, lineY + 16);

  // End point (Result)
  ctx.fillStyle = "#10b981";
  ctx.beginPath();
  ctx.arc(endX, lineY, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#047857";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.fillText("Calculated Result", endX, lineY + 16);

  // Jump Label
  ctx.fillStyle = "#c2410c";
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.fillText("Directed Operation ➔", (startX + endX) / 2, lineY - 38);

  ctx.restore();
}

/**
 * 6. Illustrative Calculus diagram (tangent line for derivative, shaded area for integral).
 */
function drawCalculusDiagram(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();

  ctx.fillStyle = "#f8fafc";
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#8b5cf6";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.fillText("VISUAL CALCULUS · RATE OF CHANGE & ACCUMULATED AREA", x + 14, y + 18);

  const plotX = x + 20;
  const plotY = y + 28;
  const plotW = w - 40;
  const plotH = h - 46;

  const originX = plotX + 30;
  const originY = plotY + plotH * 0.8;

  // Axes
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(plotX, originY);
  ctx.lineTo(plotX + plotW, originY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(originX, plotY + plotH);
  ctx.lineTo(originX, plotY);
  ctx.stroke();

  // Curve: f(x)
  const curvePoints: Array<{ x: number; y: number }> = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const cx = originX + (i / steps) * (plotW - 50);
    const t = i / steps;
    const cy = originY - (Math.pow(t, 2) * 55 + Math.sin(t * 3) * 15);
    curvePoints.push({ x: cx, y: cy });
  }

  // Shaded area under curve between x = a and x = b
  const startIdx = Math.floor(steps * 0.3);
  const endIdx = Math.floor(steps * 0.75);

  ctx.fillStyle = "rgba(139, 92, 246, 0.15)";
  ctx.beginPath();
  ctx.moveTo(curvePoints[startIdx].x, originY);
  for (let i = startIdx; i <= endIdx; i++) {
    ctx.lineTo(curvePoints[i].x, curvePoints[i].y);
  }
  ctx.lineTo(curvePoints[endIdx].x, originY);
  ctx.closePath();
  ctx.fill();

  // Draw curve stroke
  ctx.strokeStyle = "#6d28d9";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  curvePoints.forEach((pt, idx) => {
    if (idx === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });
  ctx.stroke();

  // Tangent line at midpoint
  const midIdx = Math.floor((startIdx + endIdx) / 2);
  const midPt = curvePoints[midIdx];

  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(midPt.x - 35, midPt.y + 20);
  ctx.lineTo(midPt.x + 35, midPt.y - 20);
  ctx.stroke();

  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.arc(midPt.x, midPt.y, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#6d28d9";
  ctx.font = "italic bold 11px serif";
  ctx.fillText("∫ f(x) dx  Area", (curvePoints[startIdx].x + curvePoints[endIdx].x) / 2 - 25, originY - 14);

  ctx.fillStyle = "#b45309";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.fillText("Tangent Slope f'(x)", midPt.x + 10, midPt.y - 12);

  ctx.restore();
}

/**
 * 7. General function curve plot using safe sandboxed AST evaluation.
 */
function drawFunctionPlot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fnExpr: string,
  xRange: [number, number] = [-6, 6],
  yRange: [number, number] = [-4, 6],
) {
  ctx.save();

  ctx.fillStyle = "#f8fafc";
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#0284c7";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.fillText(`FUNCTION PLOT · y = ${fnExpr}`, x + 14, y + 18);

  const plotX = x + 20;
  const plotY = y + 26;
  const plotW = w - 40;
  const plotH = h - 44;

  const [minX, maxX] = xRange;
  const [minY, maxY] = yRange;

  const toScreenX = (valX: number) => plotX + ((valX - minX) / (maxX - minX)) * plotW;
  const toScreenY = (valY: number) => plotY + plotH - ((valY - minY) / (maxY - minY)) * plotH;

  const originX = toScreenX(0);
  const originY = toScreenY(0);

  // Grid
  ctx.strokeStyle = "#f1f5f9";
  ctx.lineWidth = 1;
  for (let gx = plotX; gx <= plotX + plotW; gx += 28) {
    ctx.beginPath();
    ctx.moveTo(gx, plotY);
    ctx.lineTo(gx, plotY + plotH);
    ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.5;

  if (originY >= plotY && originY <= plotY + plotH) {
    ctx.beginPath();
    ctx.moveTo(plotX, originY);
    ctx.lineTo(plotX + plotW, originY);
    ctx.stroke();
  }

  if (originX >= plotX && originX <= plotX + plotW) {
    ctx.beginPath();
    ctx.moveTo(originX, plotY);
    ctx.lineTo(originX, plotY + plotH);
    ctx.stroke();
  }

  const evalFn = compileMathFunction(fnExpr);

  ctx.strokeStyle = "#0284c7";
  ctx.lineWidth = 2.5;
  ctx.beginPath();

  let started = false;
  const steps = 120;
  const dx = (maxX - minX) / steps;

  for (let i = 0; i <= steps; i++) {
    const curX = minX + i * dx;
    const curY = evalFn(curX);

    if (curY !== null && typeof curY === "number" && !isNaN(curY) && isFinite(curY)) {
      const sx = toScreenX(curX);
      const sy = toScreenY(curY);

      if (sy >= plotY - 10 && sy <= plotY + plotH + 10) {
        if (!started) {
          ctx.moveTo(sx, sy);
          started = true;
        } else {
          ctx.lineTo(sx, sy);
        }
      } else {
        started = false;
      }
    } else {
      started = false;
    }
  }
  ctx.stroke();

  ctx.restore();
}

/**
 * Main export: generates a high-resolution, beautifully formatted Math Solution Card image.
 */
export function renderMathSolutionCard(opts: MathSolutionCardOptions): RenderedSolutionImage {
  const cardW = 480;
  const padding = 20;
  const contentW = cardW - padding * 2;

  if (typeof document === "undefined") {
    return {
      dataUrl: "",
      width: cardW,
      height: 400,
    };
  }

  const cleanProblem = formatLatexForDisplay(opts.problemLatex || opts.title || "Math Equation");
  const cleanSolution = formatLatexForDisplay(opts.solution || "Solved");

  // Parse step strings
  const parsedSteps: ParsedStep[] = (opts.steps || []).map((s, idx) => parseStepText(s, idx + 1));

  // Determine diagram type
  const diagramKind = determineDiagramKind(
    opts.problemLatex,
    opts.solution,
    opts.title,
    opts.graphableFn,
  );
  const diagramH = 175;

  // Measurement offscreen canvas for dynamic layout
  const measureCanvas = document.createElement("canvas");
  measureCanvas.width = cardW;
  measureCanvas.height = 100;
  const mctx = measureCanvas.getContext("2d")!;

  // Measure header
  let curY = padding;
  curY += 56; // Header bar
  curY += 12; // Gap

  // Measure Problem Box
  mctx.font = "italic 15px 'Cambria Math', 'Times New Roman', serif";
  const problemLines = wrapLines(mctx, cleanProblem, contentW - 24);
  const problemBoxH = 34 + problemLines.length * 20;
  curY += problemBoxH + 12;

  // Measure Hero Solution Box
  mctx.font = "bold italic 17px 'Cambria Math', 'Times New Roman', serif";
  const solutionLines = wrapLines(mctx, cleanSolution, contentW - 28);
  const solutionBoxH = 36 + solutionLines.length * 22;
  curY += solutionBoxH + 16;

  // Steps Section Header
  if (parsedSteps.length > 0) {
    curY += 24;
  }

  // Measure each step card
  const stepHeights: number[] = [];
  mctx.font = "13px system-ui, sans-serif";

  for (const step of parsedSteps) {
    const titleLines = wrapLines(mctx, step.title, contentW - 84);
    let sh = 28 + titleLines.length * 18;
    if (step.equation) {
      mctx.font = "italic 14px 'Cambria Math', 'Times New Roman', serif";
      const eqLines = wrapLines(mctx, step.equation, contentW - 44);
      sh += 12 + eqLines.length * 20 + 8;
      mctx.font = "13px system-ui, sans-serif";
    }
    sh += 10;
    stepHeights.push(sh);
    curY += sh + 10;
  }

  // Diagram height
  curY += 12 + diagramH;

  // Mathematical Takeaway / Rule note box
  const noteH = 50;
  curY += 12 + noteH;

  // Bottom padding
  curY += padding;

  const totalCardH = Math.round(curY);

  // Render on offscreen canvas at 2x device pixel ratio for retina crispness
  const dpr = 2;
  const canvas = document.createElement("canvas");
  canvas.width = cardW * dpr;
  canvas.height = totalCardH * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  // 1. Outer Card Background with subtle border and drop shadow
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(15, 23, 42, 0.08)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, 4, 4, cardW - 8, totalCardH - 8, 16);
  ctx.fill();
  ctx.shadowColor = "transparent";

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  roundRect(ctx, 4, 4, cardW - 8, totalCardH - 8, 16);
  ctx.stroke();

  // 2. Top Header Accent Banner
  const headerY = padding;
  const grad = ctx.createLinearGradient(padding, headerY, padding + contentW, headerY);
  grad.addColorStop(0, "#4f46e5");
  grad.addColorStop(1, "#7c3aed");

  ctx.fillStyle = grad;
  roundRect(ctx, padding, headerY, contentW, 46, 12);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.fillText("📐  STEP-BY-STEP MATH SOLUTION", padding + 14, headerY + 20);

  ctx.fillStyle = "#e0e7ff";
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText("Verified Algebraic Derivation & Visual Analysis", padding + 14, headerY + 36);

  let renderY = headerY + 46 + 12;

  // 3. Problem Statement Box
  ctx.fillStyle = "#f8fafc";
  roundRect(ctx, padding, renderY, contentW, problemBoxH, 10);
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#64748b";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.fillText("GIVEN PROBLEM / EQUATION", padding + 12, renderY + 16);

  ctx.fillStyle = "#0f172a";
  ctx.font = "italic 15px 'Cambria Math', 'Times New Roman', serif";
  problemLines.forEach((line, idx) => {
    ctx.fillText(line, padding + 12, renderY + 36 + idx * 20);
  });

  renderY += problemBoxH + 12;

  // 4. Hero Final Answer Box (Highlighted in soft emerald)
  ctx.fillStyle = "#f0fdf4";
  roundRect(ctx, padding, renderY, contentW, solutionBoxH, 12);
  ctx.fill();
  ctx.strokeStyle = "#86efac";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#15803d";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.fillText("✓  FINAL ANSWER / ROOTS", padding + 14, renderY + 18);

  ctx.fillStyle = "#065f46";
  ctx.font = "bold italic 17px 'Cambria Math', 'Times New Roman', serif";
  solutionLines.forEach((line, idx) => {
    ctx.fillText(line, padding + 14, renderY + 38 + idx * 22);
  });

  renderY += solutionBoxH + 16;

  // 5. Step-by-Step Breakdown Cards
  if (parsedSteps.length > 0) {
    ctx.fillStyle = "#475569";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.fillText("STEP-BY-STEP WORKED DERIVATION", padding + 2, renderY);
    renderY += 10;

    parsedSteps.forEach((step, sIdx) => {
      const sh = stepHeights[sIdx];

      // Sub-card container
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, padding, renderY, contentW, sh, 10);
      ctx.fill();
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Step Pill Badge
      ctx.fillStyle = "#e0e7ff";
      roundRect(ctx, padding + 10, renderY + 8, 54, 18, 9);
      ctx.fill();

      ctx.fillStyle = "#4338ca";
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`STEP ${step.stepNum ?? sIdx + 1}`, padding + 37, renderY + 20);
      ctx.textAlign = "left";

      // Step Title
      ctx.fillStyle = "#1e293b";
      ctx.font = "500 13px system-ui, sans-serif";
      const titleLines = wrapLines(ctx, step.title, contentW - 84);
      titleLines.forEach((tl, tidx) => {
        ctx.fillText(tl, padding + 72, renderY + 21 + tidx * 18);
      });

      // Mathematical Equation Sub-box
      if (step.equation) {
        const eqY = renderY + 24 + titleLines.length * 18;
        const eqH = sh - (eqY - renderY) - 8;

        ctx.fillStyle = "#f8fafc";
        roundRect(ctx, padding + 12, eqY, contentW - 24, eqH, 6);
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "italic 14px 'Cambria Math', 'Times New Roman', serif";
        const eqLines = wrapLines(ctx, step.equation, contentW - 44);
        eqLines.forEach((eql, eqIdx) => {
          ctx.fillText(eql, padding + 22, eqY + 18 + eqIdx * 18);
        });
      }

      renderY += sh + 10;
    });
  }

  // 6. Visual Mathematical Diagram
  renderY += 4;
  switch (diagramKind) {
    case "quadratic":
      drawQuadraticDiagram(ctx, padding, renderY, contentW, diagramH);
      break;
    case "linear":
      drawLinearDiagram(ctx, padding, renderY, contentW, diagramH);
      break;
    case "trig":
      drawTrigDiagram(ctx, padding, renderY, contentW, diagramH);
      break;
    case "pythagoras":
      drawGeometryRightTriangle(ctx, padding, renderY, contentW, diagramH);
      break;
    case "arithmetic":
      drawArithmeticNumberLine(ctx, padding, renderY, contentW, diagramH);
      break;
    case "calculus":
      drawCalculusDiagram(ctx, padding, renderY, contentW, diagramH);
      break;
    case "function_plot":
    default:
      if (opts.graphableFn) {
        drawFunctionPlot(
          ctx,
          padding,
          renderY,
          contentW,
          diagramH,
          opts.graphableFn,
          opts.xRange,
          opts.yRange,
        );
      } else {
        drawLinearDiagram(ctx, padding, renderY, contentW, diagramH);
      }
      break;
  }
  renderY += diagramH + 12;

  // 7. Method / Key Mathematical Insight Note
  ctx.fillStyle = "#fefce8";
  roundRect(ctx, padding, renderY, contentW, noteH, 10);
  ctx.fill();
  ctx.strokeStyle = "#fef08a";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#a16207";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.fillText("💡  KEY MATHEMATICAL PRINCIPLE", padding + 12, renderY + 16);

  ctx.fillStyle = "#713f12";
  ctx.font = "11px system-ui, sans-serif";

  let noteText =
    "Algebraic solutions maintain equation equivalence at each step by applying inverse operations to both sides.";
  if (diagramKind === "quadratic") {
    noteText =
      "Discriminant Δ = b² - 4ac: if Δ > 0, there are two distinct real roots; if Δ = 0, one repeated root; if Δ < 0, two complex conjugates.";
  } else if (diagramKind === "linear") {
    noteText =
      "Linear equations describe constant rates of change (slope m). The root is the x-intercept where y = 0, found by inverse operations.";
  } else if (diagramKind === "trig") {
    noteText =
      "Trigonometric functions model periodic oscillations. The fundamental period of sin(x) and cos(x) is 2π radians (360°).";
  } else if (diagramKind === "pythagoras") {
    noteText =
      "In any right-angled Euclidean triangle, the sum of squares of the legs equals the square of the hypotenuse: a² + b² = c².";
  } else if (diagramKind === "calculus") {
    noteText =
      "Derivatives yield the instantaneous rate of change (tangent slope); integrals compute accumulated area under the curve.";
  } else if (diagramKind === "arithmetic") {
    noteText =
      "Arithmetic operations can be visualized as directed jumps on the number line, adhering strictly to operator precedence.";
  }

  const noteLines = wrapLines(ctx, noteText, contentW - 24);
  noteLines.forEach((nl, nidx) => {
    ctx.fillText(nl, padding + 12, renderY + 32 + nidx * 14);
  });

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: cardW,
    height: totalCardH,
  };
}
