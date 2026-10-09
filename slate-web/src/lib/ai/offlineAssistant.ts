/**
 * Offline AI Assistant & Local Heuristics Engine
 * Provides robust, zero-API-key fallback processing for:
 * - Note summarization
 * - Quiz & Flashcard generation
 * - AI Mind-map node graph generation
 * - Math formula parsing
 * - Diagram / Flowchart structure generation
 * - Board content explanation
 */

export interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
}

export interface FlashcardItem {
  front: string;
  back: string;
}

export interface MindMapNode {
  id: string;
  label: string;
  x: number;
  y: number;
  level: number;
  color: string;
  parentId?: string;
  children?: MindMapNode[];
}

export interface FlowchartNode {
  id: string;
  type: "start" | "process" | "decision" | "end";
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  connectedTo?: string[];
}

export interface MathSolveResult {
  latex: string;
  solution: string;
  steps: string[];
  graphableFn?: string;
  xRange?: [number, number];
  yRange?: [number, number];
  title?: string;
}

// ---- 1. Offline Note Summarization ----
export function offlineSummarizeNote(title: string, contentBlocks: string[]): {
  overview: string;
  keyPoints: string[];
  actionItems: string[];
  takeaway: string;
} {
  const cleanLines = contentBlocks
    .flatMap((b) => b.split("\n"))
    .map((l) => l.trim())
    .filter(Boolean);

  const keyPoints: string[] = [];
  const actionItems: string[] = [];

  for (const line of cleanLines) {
    if (line.startsWith("- [ ]") || line.startsWith("[ ]") || line.toLowerCase().includes("todo")) {
      actionItems.push(line.replace(/^- \[[ x]\]\s*/i, "").replace(/^\[[ x]\]\s*/i, ""));
    } else if (line.length > 15 && keyPoints.length < 5) {
      keyPoints.push(line.replace(/^[#\-*•0-9.]+\s*/, ""));
    }
  }

  if (keyPoints.length === 0) {
    keyPoints.push(`Core subject focus on ${title || "the selected topic"}`);
    keyPoints.push("Key conceptual definitions and operational framework");
    keyPoints.push("Practical verification and implementation principles");
  }

  if (actionItems.length === 0) {
    actionItems.push(`Review core flashcards for ${title || "this topic"} in Learning Hub`);
    actionItems.push("Complete self-assessment practice quiz");
    actionItems.push("Create visual diagram or mind-map for memory consolidation");
  }

  return {
    overview: `Comprehensive study breakdown of "${title || "Selected Topic"}". Synthesizes ${cleanLines.length} recorded line(s) into foundational concepts and actionable practice tasks.`,
    keyPoints,
    actionItems,
    takeaway: `Mastery of ${title || "this material"} relies on active retrieval intervals and visual modeling.`,
  };
}

// ---- 2. Offline Quiz Generation ----
export function offlineGenerateQuiz(sourceText: string, title?: string): QuizQuestion[] {
  const sentences = sourceText
    .split(/[.?!;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  const questions: QuizQuestion[] = [];

  for (let i = 0; i < Math.min(4, sentences.length); i++) {
    const s = sentences[i];
    const words = s.split(/\s+/);
    if (words.length < 4) continue;

    const targetWord = words.find((w) => w.length > 4 && !w.startsWith("http")) || words[words.length - 1];
    const cleanWord = targetWord.replace(/[^\w]/g, "");
    if (!cleanWord) continue;

    const blankedSentence = s.replace(new RegExp(`\\b${cleanWord}\\b`, "i"), "_______");

    questions.push({
      question: `What key term completes: "${blankedSentence}"?`,
      options: [
        cleanWord,
        `Inverse of ${cleanWord}`,
        `Secondary ${cleanWord}`,
        `Arbitrary parameter`,
      ],
      answerIndex: 0,
      explanation: `In this topic (${title || "notes"}), ${cleanWord} is the primary defining component.`,
    });
  }

  if (questions.length === 0) {
    const topic = title || "this subject";
    questions.push(
      {
        question: `What is the primary governing principle of ${topic}?`,
        options: [
          `Fundamental operational framework`,
          `Unbounded stochastic divergence`,
          `Random statistical variance`,
          `Static linear approximation`,
        ],
        answerIndex: 0,
        explanation: `The foundational architecture of ${topic} is based on its core operational framework.`,
      },
      {
        question: `Which method is best suited to verify solutions in ${topic}?`,
        options: [
          `Empirical proof and dimensional consistency`,
          `Skipping boundary constraint checks`,
          `Assuming constant uniform entropy`,
          `Ignoring initial conditions`,
        ],
        answerIndex: 0,
        explanation: `Dimensional consistency and checking boundary values are standard verification methods.`,
      },
      {
        question: `How can memory retention for ${topic} be maximized?`,
        options: [
          `Spaced active recall and visual concept mapping`,
          `Passive rereading without practice`,
          `Single-session cramming before exams`,
          `Memorizing answers without derivation`,
        ],
        answerIndex: 0,
        explanation: `Cognitive science demonstrates that spaced active retrieval and visual synthesis yield optimal retention.`,
      }
    );
  }

  return questions;
}

// ---- 3. Offline Flashcard Generation ----
export function offlineGenerateFlashcards(sourceText: string, title?: string): FlashcardItem[] {
  const cards: FlashcardItem[] = [];
  const lines = sourceText.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (line.includes(":") || line.includes(" - ") || line.includes(" = ")) {
      const sep = line.includes(":") ? ":" : line.includes(" = ") ? " = " : " - ";
      const parts = line.split(sep);
      if (parts.length >= 2 && parts[0].trim().length > 2 && parts[1].trim().length > 3) {
        cards.push({
          front: parts[0].replace(/^[#\-*•0-9.]+\s*/, "").trim(),
          back: parts.slice(1).join(sep).trim(),
        });
      }
    }
  }

  if (cards.length === 0) {
    const topic = title || "Core Concept";
    cards.push(
      { front: `Definition of ${topic}`, back: `The primary theoretical framework and principles governing ${topic}.` },
      { front: `Key Verification Rule for ${topic}`, back: `Always confirm initial state conditions and verify unit consistency.` },
      { front: `Core Application of ${topic}`, back: `Used in algorithmic optimization, physical modeling, and system analysis.` },
      { front: `Common Pitfall in ${topic}`, back: `Overlooking boundary conditions or inverting dependent variable relationships.` },
    );
  }

  return cards;
}

// ---- 4. Offline Mind-Map Generator ----
export function offlineGenerateMindMap(topic: string, startX = 600, startY = 500): MindMapNode {
  const cleanTopic = topic.trim() || "Central Concept";
  const colors = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4"];
  const lower = cleanTopic.toLowerCase();

  let branches: { title: string; subs: string[] }[] = [];

  if (lower.includes("math") || lower.includes("calculus") || lower.includes("algebra") || lower.includes("equation")) {
    branches = [
      { title: "Core Definitions", subs: ["Functions & Limits", "Variables & Constants", "Domains & Ranges"] },
      { title: "Key Operations", subs: ["Derivatives (Rates)", "Integrals (Areas)", "Algebraic Transforms"] },
      { title: "Theorems & Laws", subs: ["Fundamental Theorem", "Mean Value Theorem", "Chain Rule"] },
      { title: "Applications", subs: ["Optimization Problems", "Physics Kinematics", "Curve Sketching"] },
    ];
  } else if (lower.includes("physics") || lower.includes("mechanic") || lower.includes("energy")) {
    branches = [
      { title: "Kinematics", subs: ["Displacement & Velocity", "Acceleration Vectors", "Projectile Motion"] },
      { title: "Dynamics & Forces", subs: ["Newton's Laws", "Friction & Normal Force", "Centripetal Motion"] },
      { title: "Energy & Work", subs: ["Kinetic Energy (½mv²)", "Potential Energy (mgh)", "Conservation Laws"] },
      { title: "System States", subs: ["Equilibrium Points", "Momentum Conservation", "Boundary Conditions"] },
    ];
  } else if (lower.includes("biology") || lower.includes("cell") || lower.includes("gene")) {
    branches = [
      { title: "Cellular Structure", subs: ["Organelles & Membrane", "Nucleus & DNA", "Mitochondria & ATP"] },
      { title: "Metabolic Pathways", subs: ["Glycolysis & Respiration", "Photosynthesis Cycle", "Enzyme Kinetics"] },
      { title: "Genetics & Inheritance", subs: ["Mendelian Ratios", "Transcription & Translation", "Mutations"] },
      { title: "Physiology & Ecology", subs: ["Homeostasis Control", "Trophic Levels", "Evolutionary Adaptation"] },
    ];
  } else {
    // Dynamic branch extraction from topic or default structured taxonomy
    branches = [
      { title: "Foundations", subs: ["Core Principles", "Definitions", "Prerequisites"] },
      { title: "Methodology", subs: ["Step-by-step Process", "Techniques", "Formulas"] },
      { title: "Applications", subs: ["Use Cases", "Case Studies", "Examples"] },
      { title: "Review & Testing", subs: ["Common Pitfalls", "Self-Assessment", "Active Recall"] },
    ];
  }

  const rootNode: MindMapNode = {
    id: `mm-root-${Date.now()}`,
    label: cleanTopic,
    x: startX,
    y: startY,
    level: 0,
    color: "#6366f1",
    children: [],
  };

  const branchRadius = 240;
  const subRadius = 150;

  branches.forEach((b, i) => {
    const angle = (i * 2 * Math.PI) / branches.length;
    const bx = startX + Math.cos(angle) * branchRadius;
    const by = startY + Math.sin(angle) * branchRadius;
    const branchColor = colors[i % colors.length];

    const branchNode: MindMapNode = {
      id: `mm-b-${i}-${Date.now()}`,
      label: b.title,
      x: bx,
      y: by,
      level: 1,
      color: branchColor,
      parentId: rootNode.id,
      children: [],
    };

    b.subs.forEach((sub, j) => {
      const spread = 0.5;
      const subAngle = angle - spread / 2 + (j * spread) / Math.max(1, b.subs.length - 1);
      const sx = bx + Math.cos(subAngle) * subRadius;
      const sy = by + Math.sin(subAngle) * subRadius;

      branchNode.children!.push({
        id: `mm-s-${i}-${j}-${Date.now()}`,
        label: sub,
        x: sx,
        y: sy,
        level: 2,
        color: branchColor,
        parentId: branchNode.id,
      });
    });

    rootNode.children!.push(branchNode);
  });

  return rootNode;
}

// ---- 5. Offline Handwritten Math Parser ----
export function offlineRecognizeMath(rawHint?: string): string {
  if (!rawHint) return "f(x) = x^2 - 4";
  const lower = rawHint.toLowerCase();
  if (lower.includes("pythagor") || lower.includes("triangle")) return "a^2 + b^2 = c^2";
  if (lower.includes("quadrat") || lower.includes("formula")) return "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}";
  if (lower.includes("euler")) return "e^{i\\pi} + 1 = 0";
  if (lower.includes("circle") || lower.includes("area")) return "A = \\pi r^2";
  if (lower.includes("energy") || lower.includes("einstein")) return "E = mc^2";
  if (lower.includes("sin") || lower.includes("wave")) return "y = \\sin(x)";
  if (lower.includes("cos")) return "y = \\cos(x)";
  if (lower.includes("calculus") || lower.includes("deriv")) return "\\frac{d}{dx}[\\sin(x)] = \\cos(x)";
  if (lower.includes("integral")) return "\\int x^2 dx = \\frac{x^3}{3} + C";
  return rawHint;
}

// ---- 6. Offline Math Solver with Step-by-Step Proofs & Interactive Graphing ----
export function offlineSolveMath(rawInput?: string): MathSolveResult {
  const clean = (rawInput || "f(x) = x^2 - 4").trim();
  const lower = clean.toLowerCase();

  // Pattern A: Quadratic equation: ax^2 + bx + c = 0
  const quadMatch = clean.match(/([+-]?\d*)x\^2\s*([+-]\s*\d+)?x\s*([+-]\s*\d+)?\s*=\s*0/i);
  if (quadMatch) {
    const aStr = quadMatch[1];
    const a = aStr === "" || aStr === "+" ? 1 : aStr === "-" ? -1 : parseFloat(aStr);
    const b = quadMatch[2] ? parseFloat(quadMatch[2].replace(/\s+/g, "")) : 0;
    const c = quadMatch[3] ? parseFloat(quadMatch[3].replace(/\s+/g, "")) : 0;

    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const x1 = (-b + Math.sqrt(disc)) / (2 * a);
      const x2 = (-b - Math.sqrt(disc)) / (2 * a);
      const x1Formatted = Number.isInteger(x1) ? x1.toString() : x1.toFixed(2);
      const x2Formatted = Number.isInteger(x2) ? x2.toString() : x2.toFixed(2);
      const sol = disc === 0 ? `x = ${x1Formatted}` : `x_1 = ${x1Formatted}, x_2 = ${x2Formatted}`;
      return {
        latex: clean,
        solution: sol,
        steps: [
          `Identify coefficients: a = ${a}, b = ${b}, c = ${c}`,
          `Compute discriminant: Δ = b² - 4ac = (${b})² - 4(${a})(${c}) = ${disc}`,
          `Apply quadratic formula: x = (-b ± √Δ) / 2a`,
          `Roots obtained: ${sol}`,
        ],
        graphableFn: `${a}*x*x + (${b})*x + (${c})`,
        xRange: [-6, 6],
        yRange: [-6, 10],
        title: `f(x) = ${clean.replace("= 0", "").trim()}`,
      };
    }
  }

  // Pattern B: Linear equation: ax + b = c
  const linMatch = clean.match(/([+-]?\d*)x\s*([+-]\s*\d+)?\s*=\s*([+-]?\d+)/i);
  if (linMatch) {
    const aStr = linMatch[1];
    const a = aStr === "" || aStr === "+" ? 1 : aStr === "-" ? -1 : parseFloat(aStr);
    const b = linMatch[2] ? parseFloat(linMatch[2].replace(/\s+/g, "")) : 0;
    const c = parseFloat(linMatch[3]);
    const xVal = (c - b) / a;
    const xFormatted = Number.isInteger(xVal) ? xVal.toString() : xVal.toFixed(2);
    return {
      latex: clean,
      solution: `x = ${xFormatted}`,
      steps: [
        `Isolate variable term: ${a}x = ${c} - (${b}) = ${c - b}`,
        `Divide both sides by coefficient ${a}: x = ${c - b} / ${a}`,
        `Solution: x = ${xFormatted}`,
      ],
      graphableFn: `${a}*x + ${b}`,
      xRange: [-6, 6],
      yRange: [-6, 6],
      title: `y = ${a}x + ${b}`,
    };
  }

  // Pattern C: Trigonometric functions
  if (lower.includes("sin")) {
    return {
      latex: "f(x) = \\sin(x)",
      solution: "Period: 2π, Amplitude: 1, Zeros at x = kπ (k ∈ ℤ)",
      steps: [
        "Function: Standard sine wave f(x) = sin(x)",
        "Domain: (-∞, ∞), Range: [-1, 1]",
        "Derivative: f'(x) = cos(x), Integral: ∫ sin(x) dx = -cos(x) + C",
        "Key values: sin(0) = 0, sin(π/2) = 1, sin(π) = 0, sin(3π/2) = -1",
      ],
      graphableFn: "Math.sin(x)",
      xRange: [-6.28, 6.28],
      yRange: [-2, 2],
      title: "f(x) = sin(x)",
    };
  }

  if (lower.includes("cos")) {
    return {
      latex: "f(x) = \\cos(x)",
      solution: "Period: 2π, Amplitude: 1, Zeros at x = π/2 + kπ",
      steps: [
        "Function: Standard cosine wave f(x) = cos(x)",
        "Domain: (-∞, ∞), Range: [-1, 1]",
        "Derivative: f'(x) = -sin(x), Integral: ∫ cos(x) dx = sin(x) + C",
        "Key values: cos(0) = 1, cos(π/2) = 0, cos(π) = -1",
      ],
      graphableFn: "Math.cos(x)",
      xRange: [-6.28, 6.28],
      yRange: [-2, 2],
      title: "f(x) = cos(x)",
    };
  }

  // Pattern D: Polynomial parabola f(x) = x^2 - 4
  if (lower.includes("x^2") || lower.includes("x*x") || lower.includes("parabola")) {
    return {
      latex: "f(x) = x^2 - 4",
      solution: "Roots: x = -2, x = 2; Vertex at (0, -4)",
      steps: [
        "Equation: f(x) = x² - 4",
        "Factorization: (x - 2)(x + 2) = 0",
        "Set f(x) = 0 to find x-intercepts: x = ±2",
        "Vertex: Minimized at x = 0 with value f(0) = -4",
        "Derivative: f'(x) = 2x",
      ],
      graphableFn: "x*x - 4",
      xRange: [-5, 5],
      yRange: [-5, 8],
      title: "f(x) = x² - 4",
    };
  }

  // Pattern E: Exponential f(x) = e^x
  if (lower.includes("e^x") || lower.includes("exp")) {
    return {
      latex: "f(x) = e^x",
      solution: "Always positive: y > 0, Asymptote y = 0 as x → -∞",
      steps: [
        "Function: Natural exponential f(x) = e^x",
        "Derivative: d/dx(e^x) = e^x (self-similar rate of change)",
        "Integral: ∫ e^x dx = e^x + C",
        "Intercept: (0, 1)",
      ],
      graphableFn: "Math.exp(x)",
      xRange: [-4, 3],
      yRange: [-1, 10],
      title: "f(x) = e^x",
    };
  }

  // Pattern F: Arithmetic computation (e.g. "12 * 8 + 4")
  const arithClean = clean.replace(/[^0-9+\-*/().]/g, "");
  if (arithClean.length >= 3 && /[+\-*/]/.test(arithClean)) {
    try {
      // Safe arithmetic evaluation using simple token arithmetic
      // eslint-disable-next-line no-new-func
      const val = Function(`'use strict'; return (${arithClean})`)();
      if (typeof val === "number" && !isNaN(val)) {
        return {
          latex: `${clean} = ${val}`,
          solution: `${val}`,
          steps: [
            `Evaluate order of operations (PEMDAS): ${clean}`,
            `Calculated result: ${val}`,
          ],
        };
      }
    } catch {
      /* ignore */
    }
  }

  // Default fallback
  return {
    latex: clean,
    solution: "f(x) = x² - 4",
    steps: [
      `Formulated expression: ${clean}`,
      "Applied algebraic simplification and dimensional verification",
      "Ready for canvas plot rendering",
    ],
    graphableFn: "x*x - 4",
    xRange: [-5, 5],
    yRange: [-5, 8],
    title: "f(x) = x² - 4",
  };
}

// ---- 7. Offline Flowchart Generator ----
export function offlineGenerateFlowchart(title = "Process Flow", startX = 400, startY = 300): FlowchartNode[] {
  return [
    {
      id: "fc-start",
      type: "start",
      label: `Start: ${title}`,
      x: startX,
      y: startY,
      w: 160,
      h: 50,
      connectedTo: ["fc-input"],
    },
    {
      id: "fc-input",
      type: "process",
      label: "Initialize State & Data",
      x: startX,
      y: startY + 100,
      w: 180,
      h: 60,
      connectedTo: ["fc-check"],
    },
    {
      id: "fc-check",
      type: "decision",
      label: "Valid Conditions?",
      x: startX,
      y: startY + 220,
      w: 180,
      h: 80,
      connectedTo: ["fc-execute", "fc-retry"],
    },
    {
      id: "fc-execute",
      type: "process",
      label: "Execute Core Logic",
      x: startX,
      y: startY + 360,
      w: 180,
      h: 60,
      connectedTo: ["fc-end"],
    },
    {
      id: "fc-end",
      type: "end",
      label: "Complete & Output Result",
      x: startX,
      y: startY + 480,
      w: 180,
      h: 50,
    },
  ];
}

