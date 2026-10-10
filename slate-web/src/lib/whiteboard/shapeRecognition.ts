import type { Point, ShapeStroke } from "./types";

// ---- Arc-Length Resampling ----
export function resampleStroke(points: Point[], n = 64): Point[] {
  if (points.length <= 1) return points;
  let totalLen = 0;
  for (let i = 1; i < points.length; i++) {
    totalLen += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  if (totalLen === 0) return Array.from({ length: n }, () => ({ ...points[0] }));

  const step = totalLen / (n - 1);
  const resampled: Point[] = [{ ...points[0] }];
  let curDist = 0;
  let segIdx = 0;
  let distToNext = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);

  for (let i = 1; i < n - 1; i++) {
    const targetDist = i * step;
    while (curDist + distToNext < targetDist && segIdx < points.length - 2) {
      curDist += distToNext;
      segIdx++;
      distToNext = Math.hypot(
        points[segIdx + 1].x - points[segIdx].x,
        points[segIdx + 1].y - points[segIdx].y,
      );
    }
    const t = distToNext > 0 ? (targetDist - curDist) / distToNext : 0;
    resampled.push({
      x: points[segIdx].x + t * (points[segIdx + 1].x - points[segIdx].x),
      y: points[segIdx].y + t * (points[segIdx + 1].y - points[segIdx].y),
      p: points[segIdx].p ?? 0.5,
    });
  }
  resampled.push({ ...points[points.length - 1] });
  return resampled;
}

// ---- Polygon Area & Convex Hull ----
function polygonArea(pts: Point[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a) / 2;
}

function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function convexHull(pts: Point[]): Point[] {
  const sorted = pts.slice().sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

// ---- Ramer-Douglas-Peucker Simplification ----
function perpendicularDistance(p: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(p.x - lineStart.x, p.y - lineStart.y);
  return Math.abs(dy * p.x - dx * p.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / mag;
}

function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;
  let dmax = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const rec1 = rdp(points.slice(0, index + 1), epsilon);
    const rec2 = rdp(points.slice(index), epsilon);
    return rec1.slice(0, rec1.length - 1).concat(rec2);
  } else {
    return [first, last];
  }
}

// ---- Sharp Corner Detection ----
function countCorners(points: Point[], isClosed = false): { count: number; corners: Point[] } {
  if (points.length < 9) return { count: 0, corners: [] };
  const step = Math.max(2, Math.floor(points.length / 24));
  const corners: Point[] = [];
  const minAngleThresh = 40 * (Math.PI / 180);

  for (let i = step; i < points.length - step; i += 2) {
    const pPrev = points[i - step];
    const pCur = points[i];
    const pNext = points[i + step];

    const v1 = { x: pPrev.x - pCur.x, y: pPrev.y - pCur.y };
    const v2 = { x: pNext.x - pCur.x, y: pNext.y - pCur.y };
    const mag1 = Math.hypot(v1.x, v1.y);
    const mag2 = Math.hypot(v2.x, v2.y);
    if (mag1 < 1e-4 || mag2 < 1e-4) continue;

    const dot = (v1.x * v2.x + v1.y * v2.y) / (mag1 * mag2);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

    // Sharp directional deviation
    if (angle < Math.PI - minAngleThresh) {
      const isLocalMax =
        corners.length === 0 ||
        Math.hypot(pCur.x - corners[corners.length - 1].x, pCur.y - corners[corners.length - 1].y) >
          16;
      if (isLocalMax) corners.push(pCur);
    }
  }

  // Check closure corner where the stroke starts and ends
  if (isClosed && points.length >= step * 2) {
    const pStart = points[0];
    const pNext = points[step];
    const pPrev = points[points.length - 1 - step];

    const v1 = { x: pPrev.x - pStart.x, y: pPrev.y - pStart.y };
    const v2 = { x: pNext.x - pStart.x, y: pNext.y - pStart.y };
    const mag1 = Math.hypot(v1.x, v1.y);
    const mag2 = Math.hypot(v2.x, v2.y);
    if (mag1 >= 1e-4 && mag2 >= 1e-4) {
      const dot = (v1.x * v2.x + v1.y * v2.y) / (mag1 * mag2);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (angle < Math.PI - minAngleThresh) {
        const isFarFromExisting = corners.every(
          (c) => Math.hypot(pStart.x - c.x, pStart.y - c.y) > 16
        );
        if (isFarFromExisting) {
          corners.unshift(pStart);
        }
      }
    }
  }

  return { count: corners.length, corners };
}

// ---- Main Shape Recognizer ----
export function recognizeShape(
  rawPoints: Point[],
  color: string,
  size: number,
): Omit<ShapeStroke, "id"> | null {
  if (rawPoints.length < 5) return null;

  // 1. Resample to standard 64 points for consistent density
  const points = resampleStroke(rawPoints, 64);

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 12 && h < 12) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const maxSpan = Math.max(w, h);
  const endpointDist = Math.hypot(first.x - last.x, first.y - last.y);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = w / 2;
  const ry = h / 2;
  const aspect = w / (h || 1);

  // Angular winding sum around centroid
  let totalAngleDelta = 0;
  let prevAngle = Math.atan2(first.y - cy, first.x - cx);
  for (let i = 1; i < points.length; i++) {
    const curAngle = Math.atan2(points[i].y - cy, points[i].x - cx);
    let diff = curAngle - prevAngle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    totalAngleDelta += diff;
    prevAngle = curAngle;
  }
  const hasFullLoop = Math.abs(totalAngleDelta) >= 4.8;
  const isDirectlyClosed = endpointDist < 0.32 * maxSpan;
  const isClosed = isDirectlyClosed || hasFullLoop;

  // ----------------------------------------------------
  // OPEN STROKES: Line, Arrow, Double Arrow
  // ----------------------------------------------------
  if (!isClosed) {
    const doubleArrow = detectDoubleArrow(rawPoints, color, size);
    if (doubleArrow) return doubleArrow;

    const arrow = detectArrow(rawPoints, color, size);
    if (arrow) return arrow;

    const line = detectLine(rawPoints, color, size, first, last);
    if (line) return line;

    return null;
  }

  // ----------------------------------------------------
  // CLOSED STROKES: Feature Extraction
  // ----------------------------------------------------
  const { count: corners, corners: cornerPts } = countCorners(points, isClosed);

  // RDP simplified vertices
  const rdpVertices = rdp(points, Math.max(6, maxSpan * 0.045));
  const rdpCount = Math.max(0, rdpVertices.length - 1);

  // Closeness to bounding box edges
  let rectEdgeDev = 0;
  for (const p of points) {
    const dLeft = Math.abs(p.x - minX);
    const dRight = Math.abs(p.x - maxX);
    const dTop = Math.abs(p.y - minY);
    const dBottom = Math.abs(p.y - maxY);
    rectEdgeDev += Math.min(dLeft, dRight, dTop, dBottom);
  }
  rectEdgeDev /= points.length;
  const normRectDev = rectEdgeDev / (maxSpan || 1);

  // Normalized radial variation from centroid
  let ellipseDev = 0;
  let maxRadRatio = 0;
  let minRadRatio = Infinity;
  const dists: number[] = [];

  for (const p of points) {
    const normX = (p.x - cx) / (rx || 1);
    const normY = (p.y - cy) / (ry || 1);
    const dist = Math.hypot(normX, normY);
    ellipseDev += Math.abs(dist - 1);
    maxRadRatio = Math.max(maxRadRatio, dist);
    minRadRatio = Math.min(minRadRatio, dist);
    dists.push(dist);
  }
  ellipseDev /= points.length;
  const cornerElongation = maxRadRatio / (minRadRatio || 1);

  // Solidity (polygon area / convex hull area)
  const polyA = polygonArea(points);
  const hullA = polygonArea(convexHull(points));
  const solidity = hullA > 0 ? polyA / hullA : 1;

  // ----------------------------------------------------
  // A. Check HEART (cleft dip at top, bottom apex)
  // ----------------------------------------------------
  if (detectHeart(points, minX, maxX, minY, maxY, cx, w, h)) {
    return {
      kind: "shape",
      shape: "heart",
      color,
      size,
      x: minX,
      y: minY,
      w,
      h,
    };
  }

  // ----------------------------------------------------
  // B. Check STAR (5 prominent points, deep valleys, low solidity)
  // ----------------------------------------------------
  if (detectStar(points, cx, cy, solidity)) {
    const diam = Math.max(w, h);
    return {
      kind: "shape",
      shape: "star",
      color,
      size,
      x: cx - diam / 2,
      y: cy - diam / 2,
      w: diam,
      h: diam,
    };
  }

  // ----------------------------------------------------
  // C. Check CLOUD (multiple convex scallops along perimeter)
  // ----------------------------------------------------
  if (detectCloud(points, cx, cy, w, h, solidity)) {
    return {
      kind: "shape",
      shape: "cloud",
      color,
      size,
      x: minX,
      y: minY,
      w,
      h,
    };
  }

  // ----------------------------------------------------
  // D. Check CROSS / PLUS (4 arms, notches)
  // ----------------------------------------------------
  if (detectCross(points, cx, cy, w, h, solidity)) {
    const diam = Math.max(w, h);
    return {
      kind: "shape",
      shape: "cross",
      color,
      size,
      x: cx - diam / 2,
      y: cy - diam / 2,
      w: diam,
      h: diam,
    };
  }

  // ----------------------------------------------------
  // E. Check CIRCLE / ELLIPSE
  // ----------------------------------------------------
  // In a circle: distance to center is near-constant (cornerElongation < 1.28, low ellipseDev).
  // A rectangle/square ALWAYS has cornerElongation ~ 1.414.
  const isCircle =
    (ellipseDev < 0.16 && cornerElongation < 1.28) ||
    (hasFullLoop && ellipseDev < 0.24 && cornerElongation < 1.3);

  if (isCircle) {
    const isNearlyRound = aspect >= 0.76 && aspect <= 1.32;
    const diam = Math.max(w, h);
    return {
      kind: "shape",
      shape: "circle",
      color,
      size,
      x: isNearlyRound ? cx - diam / 2 : minX,
      y: isNearlyRound ? cy - diam / 2 : minY,
      w: isNearlyRound ? diam : w,
      h: isNearlyRound ? diam : h,
    };
  }

  // ----------------------------------------------------
  // F. Check TRIANGLES: Right Triangle vs General Triangle
  // ----------------------------------------------------
  if (
    corners === 3 ||
    rdpCount === 3 ||
    (cornerElongation > 1.95 && normRectDev > 0.06 && ellipseDev > 0.2)
  ) {
    // Resolve 3 vertices first
    let triVertices: Point[] | undefined = cornerPts.length === 3 ? cornerPts : undefined;
    if (!triVertices) {
      for (const eps of [0.04, 0.08, 0.12, 0.16, 0.2, 0.25]) {
        const r = rdp(points, Math.max(6, maxSpan * eps));
        const unique = r.slice(0, -1);
        if (unique.length === 3) {
          triVertices = unique;
          break;
        }
      }
    }

    // Check if right-angled (one corner has ~90° angle)
    const isRight = detectRightAngleTriangle(triVertices, points, minX, maxX, minY, maxY);

    // Store vertices relative to the bounding box (0..1) so triangle can be moved and resized cleanly
    const relVertices = triVertices?.map((p) => ({
      x: w > 0 ? (p.x - minX) / w : 0.5,
      y: h > 0 ? (p.y - minY) / h : 0.5,
    }));

    return {
      kind: "shape",
      shape: isRight ? "right-triangle" : "triangle",
      color,
      size,
      x: minX,
      y: minY,
      w,
      h,
      vertices: relVertices,
    };
  }

  // ----------------------------------------------------
  // G. Check DIAMOND (rhombus: 4 corners near edge centers)
  // ----------------------------------------------------
  if (normRectDev >= 0.075 && cornerElongation >= 1.25) {
    if (detectDiamond(points, minX, maxX, minY, maxY, cx, cy)) {
      return {
        kind: "shape",
        shape: "diamond",
        color,
        size,
        x: minX,
        y: minY,
        w,
        h,
      };
    }
  }

  // ----------------------------------------------------
  // H. Check RECTANGLE / SQUARE (Checked before pentagon/hexagon to prevent 5-point closed strokes becoming pentagons)
  const fivePoints =
    rdpVertices.length >= 6
      ? rdpVertices.slice(0, 5)
      : cornerPts.length === 5
        ? cornerPts
        : [];
  const isPentagon =
    (rdpCount === 5 || corners === 5) &&
    (isPentagonLike(fivePoints) || (solidity > 0.85 && normRectDev >= 0.09 && !isRectangleAngles(fivePoints)));

  const isRectangle =
    !isPentagon &&
    ((normRectDev < 0.08 && cornerElongation > 1.2 && corners <= 4) ||
      (corners === 4 && normRectDev < 0.13) ||
      (rdpCount === 4 && normRectDev < 0.13) ||
      ((corners === 5 || rdpCount === 5) && normRectDev < 0.10 && isRectangleAngles(fivePoints)) ||
      (aspect < 0.45 && normRectDev < 0.15) ||
      (aspect > 2.2 && normRectDev < 0.15));

  if (isRectangle) {
    const isSquare = aspect >= 0.82 && aspect <= 1.22;
    let finalW = isSquare ? Math.max(w, h) : w;
    let finalH = isSquare ? Math.max(w, h) : h;
    let finalX = isSquare ? cx - finalW / 2 : minX;
    let finalY = isSquare ? cy - finalH / 2 : minY;

    let rotation: number | undefined;
    if (cornerPts.length === 4) {
      const angle = Math.atan2(cornerPts[1].y - cornerPts[0].y, cornerPts[1].x - cornerPts[0].x);
      // Mathematical positive modulo in JavaScript
      const mod = (n: number, m: number) => ((n % m) + m) % m;
      let normA = mod(angle + Math.PI / 4, Math.PI / 2) - Math.PI / 4;

      if (Math.abs(normA) > 0.08) {
        rotation = normA;

        // Project stroke points along rotated principal axes to compute unrotated width and height
        const cosA = Math.cos(-normA);
        const sinA = Math.sin(-normA);
        let rotMinX = Infinity;
        let rotMaxX = -Infinity;
        let rotMinY = Infinity;
        let rotMaxY = -Infinity;
        for (const p of points) {
          const dx = p.x - cx;
          const dy = p.y - cy;
          const rx = dx * cosA - dy * sinA;
          const ry = dx * sinA + dy * cosA;
          if (rx < rotMinX) rotMinX = rx;
          if (rx > rotMaxX) rotMaxX = rx;
          if (ry < rotMinY) rotMinY = ry;
          if (ry > rotMaxY) rotMaxY = ry;
        }

        const spanW = Math.max(10, rotMaxX - rotMinX);
        const spanH = Math.max(10, rotMaxY - rotMinY);
        finalW = isSquare ? Math.max(spanW, spanH) : spanW;
        finalH = isSquare ? Math.max(spanW, spanH) : spanH;
        finalX = cx - finalW / 2;
        finalY = cy - finalH / 2;
      }
    }

    return {
      kind: "shape",
      shape: "rect",
      color,
      size,
      x: finalX,
      y: finalY,
      w: finalW,
      h: finalH,
      rotation,
    };
  }

  // ----------------------------------------------------
  // I. Check PARALLELOGRAM & TRAPEZOID
  // ----------------------------------------------------
  if (corners === 4 || rdpCount === 4) {
    const polyType = detectQuadType(points, minX, maxX, minY, maxY, w, h);
    if (polyType === "parallelogram" || polyType === "trapezoid") {
      return {
        kind: "shape",
        shape: polyType,
        color,
        size,
        x: minX,
        y: minY,
        w,
        h,
      };
    }
  }

  // ----------------------------------------------------
  // J. Check PENTAGON (5 vertices, high solidity, but distinct from rectangle)
  // ----------------------------------------------------
  if (isPentagon || ((rdpCount === 5 || corners === 5) && solidity > 0.85 && normRectDev >= 0.09)) {
    const diam = Math.max(w, h);
    return {
      kind: "shape",
      shape: "pentagon",
      color,
      size,
      x: cx - diam / 2,
      y: cy - diam / 2,
      w: diam,
      h: diam,
    };
  }

  // ----------------------------------------------------
  // K. Check HEXAGON (6 vertices, high solidity)
  // ----------------------------------------------------
  if ((rdpCount === 6 || corners === 6) && solidity > 0.86) {
    const diam = Math.max(w, h);
    return {
      kind: "shape",
      shape: "hexagon",
      color,
      size,
      x: cx - diam / 2,
      y: cy - diam / 2,
      w: diam,
      h: diam,
    };
  }

  // ----------------------------------------------------
  // L. Check OCTAGON (8 vertices, high solidity)
  // ----------------------------------------------------
  if ((rdpCount === 8 || corners === 8) && solidity > 0.88) {
    const diam = Math.max(w, h);
    return {
      kind: "shape",
      shape: "octagon",
      color,
      size,
      x: cx - diam / 2,
      y: cy - diam / 2,
      w: diam,
      h: diam,
    };
  }

  // ----------------------------------------------------
  // M. Fallback: Closed smooth stroke -> circle/ellipse
  // ----------------------------------------------------
  if (isClosed && ellipseDev < 0.32 && cornerElongation < 1.36) {
    const isNearlyRound = aspect >= 0.76 && aspect <= 1.32;
    const diam = Math.max(w, h);
    return {
      kind: "shape",
      shape: "circle",
      color,
      size,
      x: isNearlyRound ? cx - diam / 2 : minX,
      y: isNearlyRound ? cy - diam / 2 : minY,
      w: isNearlyRound ? diam : w,
      h: isNearlyRound ? diam : h,
    };
  }

  // If 4 or more corners detected, prefer rectangle
  if (corners >= 4 && normRectDev < 0.2) {
    return {
      kind: "shape",
      shape: "rect",
      color,
      size,
      x: minX,
      y: minY,
      w,
      h,
    };
  }

  return null;
}

// ----------------------------------------------------
// Specific Shape Detectors
// ----------------------------------------------------

function detectHeart(
  pts: Point[],
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  cx: number,
  w: number,
  h: number,
): boolean {
  if (w < 24 || h < 24) return false;
  // Left lobe, right lobe, and center top dip
  const leftPts = pts.filter((p) => p.x < cx - w * 0.1 && p.y < minY + h * 0.6);
  const rightPts = pts.filter((p) => p.x > cx + w * 0.1 && p.y < minY + h * 0.6);
  const centerTopPts = pts.filter((p) => Math.abs(p.x - cx) <= w * 0.1 && p.y < minY + h * 0.6);

  if (leftPts.length < 2 || rightPts.length < 2 || centerTopPts.length === 0) return false;

  const leftLobeY = Math.min(...leftPts.map((p) => p.y));
  const rightLobeY = Math.min(...rightPts.map((p) => p.y));
  const centerTopY = Math.min(...centerTopPts.map((p) => p.y));

  const dip = centerTopY - Math.max(leftLobeY, rightLobeY);

  // Bottom point near centerline
  const lowestPt = pts.reduce((lowest, p) => (p.y > lowest.y ? p : lowest), pts[0]);
  const isBottomCentered = Math.abs(lowestPt.x - cx) < w * 0.25;

  return dip > h * 0.07 && isBottomCentered;
}

function detectStar(pts: Point[], cx: number, cy: number, solidity: number): boolean {
  if (solidity > 0.72) return false;
  const dists = pts.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const maxD = Math.max(...dists);
  const minD = Math.min(...dists);
  const depthRatio = minD / (maxD || 1);

  let peaks = 0;
  const n = dists.length;
  for (let i = 0; i < n; i++) {
    const prev = dists[(i - 1 + n) % n];
    const cur = dists[i];
    const next = dists[(i + 1) % n];
    if (cur > prev && cur > next && cur > maxD * 0.72) {
      peaks++;
    }
  }

  return (peaks >= 4 && peaks <= 6 && depthRatio < 0.68) || (depthRatio < 0.58 && solidity < 0.66);
}

function detectCloud(
  pts: Point[],
  cx: number,
  cy: number,
  w: number,
  h: number,
  solidity: number,
): boolean {
  if (solidity < 0.75 || solidity > 0.94) return false;
  const aspect = w / (h || 1);
  if (aspect < 1.05 || aspect > 2.4) return false;

  // Count bumps (radial oscillations)
  const dists = pts.map((p) => Math.hypot((p.x - cx) / (w / 2), (p.y - cy) / (h / 2)));
  let localPeaks = 0;
  const n = dists.length;
  for (let i = 0; i < n; i++) {
    const prev = dists[(i - 1 + n) % n];
    const cur = dists[i];
    const next = dists[(i + 1) % n];
    if (cur > prev && cur > next && cur > 1.02) {
      localPeaks++;
    }
  }
  return localPeaks >= 4 && localPeaks <= 8;
}

function detectCross(
  pts: Point[],
  cx: number,
  cy: number,
  w: number,
  h: number,
  solidity: number,
): boolean {
  if (solidity < 0.45 || solidity > 0.78) return false;
  const aspect = w / (h || 1);
  if (aspect < 0.75 || aspect > 1.33) return false;

  // Four arms: points extend far along the 4 cardinal directions
  const dists = pts.map((p) => ({
    angle: Math.atan2(p.y - cy, p.x - cx),
    dist: Math.hypot((p.x - cx) / (w / 2), (p.y - cy) / (h / 2)),
  }));

  const armAngles = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  let armsFound = 0;
  for (const armA of armAngles) {
    const nearby = dists.filter((d) => Math.abs(d.angle - armA) < 0.35);
    if (nearby.some((d) => d.dist > 0.85)) armsFound++;
  }
  return armsFound >= 3;
}

function isRectangleAngles(vertices: Point[]): boolean {
  if (vertices.length < 4) return false;
  let rightAngleCount = 0;
  for (let i = 0; i < vertices.length; i++) {
    const p1 = vertices[(i + vertices.length - 1) % vertices.length];
    const p2 = vertices[i];
    const p3 = vertices[(i + 1) % vertices.length];
    const ang = interiorAngle(p1, p2, p3);
    if (ang >= 75 && ang <= 105) rightAngleCount++;
  }
  return rightAngleCount >= 3;
}

function isPentagonLike(vertices: Point[]): boolean {
  if (vertices.length !== 5) return false;
  let rightAngleCount = 0;
  let pentagonAngleCount = 0;
  for (let i = 0; i < 5; i++) {
    const p1 = vertices[(i + 4) % 5];
    const p2 = vertices[i];
    const p3 = vertices[(i + 1) % 5];
    const ang = interiorAngle(p1, p2, p3);
    if (ang >= 75 && ang <= 105) rightAngleCount++;
    if (ang >= 95 && ang <= 125) pentagonAngleCount++;
  }
  if (rightAngleCount >= 3) return false;
  return pentagonAngleCount >= 3;
}

function detectRightAngleTriangle(
  triVertices: Point[] | undefined,
  allPts: Point[],
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): boolean {
  // If we have 3 corner points, test for ~90° angle (78° to 102°)
  if (triVertices && triVertices.length === 3) {
    const [A, B, C] = triVertices;
    const angles = [interiorAngle(B, A, C), interiorAngle(A, B, C), interiorAngle(A, C, B)];
    const hasRightAngle = angles.some((a) => a >= 78 && a <= 102);
    if (!hasRightAngle) {
      return false;
    }
    return true;
  }

  // Fallback: Check if the shape aligns with an axis-aligned right triangle.
  // An axis-aligned right triangle occupies 3 corners of its bounding box, leaving 1 empty.
  // Symmetrical upright or inverted triangles only occupy 2 corners (the base corners),
  // with their apex near the center of an edge.
  const w = maxX - minX;
  const h = maxY - minY;
  if (w <= 0 || h <= 0) return false;

  const threshold = 0.18;
  const occupiedCorners = [
    allPts.some((p) => p.x <= minX + w * threshold && p.y <= minY + h * threshold), // top-left
    allPts.some((p) => p.x >= maxX - w * threshold && p.y <= minY + h * threshold), // top-right
    allPts.some((p) => p.x >= maxX - w * threshold && p.y >= maxY - h * threshold), // bottom-right
    allPts.some((p) => p.x <= minX + w * threshold && p.y >= maxY - h * threshold), // bottom-left
  ];

  return occupiedCorners.filter(Boolean).length === 3;
}

function interiorAngle(p1: Point, p2: Point, p3: Point): number {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  return (Math.acos(Math.max(-1, Math.min(1, dot / (mag || 1)))) * 180) / Math.PI;
}

function detectQuadType(
  pts: Point[],
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  w: number,
  h: number,
): "parallelogram" | "trapezoid" | null {
  const topPts = pts.filter((p) => p.y < minY + h * 0.25);
  const bottomPts = pts.filter((p) => p.y > maxY - h * 0.25);
  if (topPts.length < 4 || bottomPts.length < 4) return null;

  const topMinX = Math.min(...topPts.map((p) => p.x));
  const topMaxX = Math.max(...topPts.map((p) => p.x));
  const botMinX = Math.min(...bottomPts.map((p) => p.x));
  const botMaxX = Math.max(...bottomPts.map((p) => p.x));

  const topW = topMaxX - topMinX;
  const botW = botMaxX - botMinX;

  // Trapezoid: top significantly narrower than bottom
  if (topW < botW * 0.75 && topMinX > botMinX + 15 && topMaxX < botMaxX - 15) {
    return "trapezoid";
  }

  // Parallelogram: top and bottom widths equal, but horizontally shifted
  if (Math.abs(topW - botW) < w * 0.25) {
    const shift = topMinX - botMinX;
    if (Math.abs(shift) > w * 0.18) {
      return "parallelogram";
    }
  }

  return null;
}

function detectDiamond(
  points: Point[],
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  cx: number,
  cy: number,
): boolean {
  const w = maxX - minX;
  const h = maxY - minY;
  const tol = Math.max(16, Math.min(w, h) * 0.22);

  const hasTopMid = points.some((p) => Math.abs(p.x - cx) < tol && Math.abs(p.y - minY) < tol);
  const hasBotMid = points.some((p) => Math.abs(p.x - cx) < tol && Math.abs(p.y - maxY) < tol);
  const hasLeftMid = points.some((p) => Math.abs(p.x - minX) < tol && Math.abs(p.y - cy) < tol);
  const hasRightMid = points.some((p) => Math.abs(p.x - maxX) < tol && Math.abs(p.y - cy) < tol);

  return hasTopMid && hasBotMid && hasLeftMid && hasRightMid;
}

// ----------------------------------------------------
// Open Strokes: Line, Arrow, Double Arrow
// ----------------------------------------------------

function detectLine(
  points: Point[],
  color: string,
  size: number,
  first: Point,
  last: Point,
): Omit<ShapeStroke, "id"> | null {
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const chordLen = Math.hypot(dx, dy);
  if (chordLen < 16) return null;

  let maxDeviation = 0;
  for (const p of points) {
    const dist = Math.abs(dy * p.x - dx * p.y + last.x * first.y - last.y * first.x) / chordLen;
    maxDeviation = Math.max(maxDeviation, dist);
  }

  if (maxDeviation / chordLen > 0.14) return null;

  return {
    kind: "shape",
    shape: "line",
    color,
    size,
    x: first.x,
    y: first.y,
    w: dx,
    h: dy,
  };
}

function detectArrow(points: Point[], color: string, size: number): Omit<ShapeStroke, "id"> | null {
  if (points.length < 8) return null;
  const n = points.length;
  const tip = points[n - 1];

  let strokeLen = 0;
  for (let i = 1; i < n; i++) {
    strokeLen += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  if (strokeLen < 16) return null;

  const minBarb = Math.max(8, strokeLen * 0.04);
  const maxBarb = Math.min(Math.max(28, strokeLen * 0.42), 140);

  let barbFound = false;
  let barbIndex = -1;

  for (let i = n - 2; i >= Math.max(2, n - 25); i--) {
    const d = Math.hypot(points[i].x - tip.x, points[i].y - tip.y);
    if (d >= minBarb && d <= maxBarb) {
      const vBarb = { x: points[i].x - tip.x, y: points[i].y - tip.y };
      const vShaft = { x: points[0].x - tip.x, y: points[0].y - tip.y };
      const dot =
        (vBarb.x * vShaft.x + vBarb.y * vShaft.y) /
        (Math.hypot(vBarb.x, vBarb.y) * Math.hypot(vShaft.x, vShaft.y) || 1);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (angle < Math.PI / 3) {
        barbFound = true;
        barbIndex = i;
        break;
      }
    }
  }

  if (!barbFound) return null;

  const shaftEnd = points[barbIndex];
  const startPt = points[0];
  const dx = shaftEnd.x - startPt.x;
  const dy = shaftEnd.y - startPt.y;

  return {
    kind: "shape",
    shape: "arrow",
    color,
    size,
    x: startPt.x,
    y: startPt.y,
    w: dx,
    h: dy,
  };
}

function detectDoubleArrow(
  points: Point[],
  color: string,
  size: number,
): Omit<ShapeStroke, "id"> | null {
  if (points.length < 14) return null;
  const start = points[0];
  const end = points[points.length - 1];
  const totalSpan = Math.hypot(end.x - start.x, end.y - start.y);
  if (totalSpan < 30) return null;

  // Check arrowheads near both ends
  const hasEndArrow = detectArrow(points, color, size);
  if (!hasEndArrow) return null;

  const reversed = points.slice().reverse();
  const hasStartArrow = detectArrow(reversed, color, size);
  if (!hasStartArrow) return null;

  return {
    kind: "shape",
    shape: "double-arrow",
    color,
    size,
    x: start.x,
    y: start.y,
    w: end.x - start.x,
    h: end.y - start.y,
  };
}

export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
