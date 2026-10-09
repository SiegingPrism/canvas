import type { CanvasObject, Page } from "./types";

export type TemplateKey =
  | "blank"
  | "grid"
  | "lined"
  | "dot"
  | "cornell"
  | "mindmap"
  | "graph"
  | "number-line"
  | "lab-report"
  | "kwl"
  | "drafting-3d";

export type Template = {
  key: TemplateKey;
  title: string;
  description: string;
  category: "Built-in" | "Math" | "Science" | "Language";
  emoji: string;
};

export const TEMPLATES: Template[] = [
  {
    key: "blank",
    title: "Blank",
    description: "Start from an empty canvas.",
    category: "Built-in",
    emoji: "🗒️",
  },
  {
    key: "grid",
    title: "Grid paper",
    description: "Square grid for tidy diagrams.",
    category: "Built-in",
    emoji: "🔳",
  },
  {
    key: "lined",
    title: "Lined paper",
    description: "Ruled lines for writing.",
    category: "Built-in",
    emoji: "📄",
  },
  {
    key: "dot",
    title: "Dot grid",
    description: "Subtle dots for sketching.",
    category: "Built-in",
    emoji: "⚫",
  },
  {
    key: "cornell",
    title: "Cornell notes",
    description: "Cues, notes and summary.",
    category: "Built-in",
    emoji: "🗂️",
  },
  {
    key: "mindmap",
    title: "Mind map",
    description: "Central idea with branches.",
    category: "Built-in",
    emoji: "🧠",
  },
  {
    key: "graph",
    title: "Math graph",
    description: "Cartesian grid with axes.",
    category: "Math",
    emoji: "📈",
  },
  {
    key: "drafting-3d",
    title: "3D Isometric Drafting",
    description: "Isometric 3D grid with 3D coordinate axes and sample solids.",
    category: "Math",
    emoji: "📐",
  },
  {
    key: "number-line",
    title: "Number line",
    description: "Horizontal number line.",
    category: "Math",
    emoji: "➖",
  },
  {
    key: "lab-report",
    title: "Science lab report",
    description: "Hypothesis, method, results.",
    category: "Science",
    emoji: "🧪",
  },
  {
    key: "kwl",
    title: "KWL chart",
    description: "Know · Want to know · Learned.",
    category: "Language",
    emoji: "📚",
  },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function text(
  x: number,
  y: number,
  str: string,
  opts: Partial<{ w: number; h: number; fontSize: number; color: string; bg: string }> = {},
): CanvasObject {
  return {
    id: uid(),
    kind: "text",
    x,
    y,
    w: opts.w ?? 240,
    h: opts.h ?? 40,
    text: str,
    color: opts.color ?? "#0f172a",
    fontSize: opts.fontSize ?? 18,
    bg: opts.bg,
  };
}

function rect(x: number, y: number, w: number, h: number, color = "#94a3b8"): CanvasObject {
  return { id: uid(), kind: "shape", shape: "rect", color, size: 2, x, y, w, h };
}

function line(x: number, y: number, w: number, h: number, color = "#94a3b8"): CanvasObject {
  return { id: uid(), kind: "shape", shape: "line", color, size: 2, x, y, w, h };
}

export function pagesForTemplate(key: TemplateKey): Page[] {
  const pid = uid();
  const base: Omit<Page, "objects"> = { id: pid, background: "white" };
  switch (key) {
    case "blank":
      return [{ ...base, objects: [] }];
    case "grid":
      return [{ ...base, background: "grid", objects: [] }];
    case "lined":
      return [{ ...base, background: "lined", objects: [] }];
    case "dot":
      return [{ ...base, background: "dots", objects: [] }];
    case "cornell":
      return [
        {
          ...base,
          objects: [
            text(40, 20, "Topic", { fontSize: 22 }),
            line(40, 60, 720, 0),
            line(220, 80, 0, 500),
            line(40, 580, 720, 0),
            text(50, 90, "Cues", { fontSize: 14, color: "#64748b" }),
            text(240, 90, "Notes", { fontSize: 14, color: "#64748b" }),
            text(50, 600, "Summary", { fontSize: 14, color: "#64748b" }),
          ],
        },
      ];
    case "mindmap":
      return [
        {
          ...base,
          objects: [
            {
              id: uid(),
              kind: "shape",
              shape: "circle",
              color: "#6366f1",
              size: 3,
              x: 340,
              y: 240,
              w: 160,
              h: 100,
            },
            text(360, 275, "Main idea", { fontSize: 18, color: "#0f172a" }),
            line(500, 290, 160, -80, "#94a3b8"),
            line(500, 290, 160, 80, "#94a3b8"),
            line(340, 290, -160, -80, "#94a3b8"),
            line(340, 290, -160, 80, "#94a3b8"),
          ],
        },
      ];
    case "graph":
      return [
        {
          ...base,
          background: "grid",
          objects: [
            line(60, 300, 720, 0, "#0f172a"),
            line(420, 40, 0, 520, "#0f172a"),
            text(760, 280, "x", { fontSize: 14, w: 20 }),
            text(430, 30, "y", { fontSize: 14, w: 20 }),
          ],
        },
      ];
    case "number-line":
      return [
        {
          ...base,
          objects: [
            line(60, 300, 720, 0, "#0f172a"),
            ...Array.from({ length: 11 }).flatMap((_, i) => {
              const x = 60 + i * 72;
              return [
                line(x, 290, 0, 20, "#0f172a"),
                text(x - 10, 315, String(i - 5), { fontSize: 14, w: 30 }),
              ];
            }),
          ],
        },
      ];
    case "lab-report":
      return [
        {
          ...base,
          objects: [
            text(40, 20, "Lab Report", { fontSize: 26 }),
            text(40, 70, "Hypothesis", { fontSize: 16, color: "#64748b" }),
            rect(40, 95, 720, 100, "#cbd5e1"),
            text(40, 210, "Materials & Method", { fontSize: 16, color: "#64748b" }),
            rect(40, 235, 720, 140, "#cbd5e1"),
            text(40, 390, "Observations", { fontSize: 16, color: "#64748b" }),
            rect(40, 415, 720, 140, "#cbd5e1"),
            text(40, 570, "Conclusion", { fontSize: 16, color: "#64748b" }),
            rect(40, 595, 720, 80, "#cbd5e1"),
          ],
        },
      ];
    case "kwl":
      return [
        {
          ...base,
          objects: [
            text(40, 20, "KWL Chart", { fontSize: 24 }),
            text(60, 70, "K — Know", { fontSize: 16, color: "#0ea5e9" }),
            text(300, 70, "W — Want to know", { fontSize: 16, color: "#a855f7" }),
            text(560, 70, "L — Learned", { fontSize: 16, color: "#22c55e" }),
            rect(40, 100, 240, 480, "#cbd5e1"),
            rect(280, 100, 240, 480, "#cbd5e1"),
            rect(520, 100, 240, 480, "#cbd5e1"),
          ],
        },
      ];
    case "drafting-3d":
      return [
        {
          ...base,
          background: "isometric",
          objects: [
            text(50, 40, "3D Isometric Drafting", { fontSize: 24, color: "#1e293b" }),
            {
              id: uid(),
              kind: "shape",
              shape: "axes3d",
              color: "#6366f1",
              size: 3,
              x: 80,
              y: 140,
              w: 220,
              h: 220,
            },
            {
              id: uid(),
              kind: "shape",
              shape: "cube",
              color: "#0ea5e9",
              size: 2.5,
              x: 360,
              y: 160,
              w: 160,
              h: 160,
            },
            {
              id: uid(),
              kind: "shape",
              shape: "cylinder",
              color: "#10b981",
              size: 2.5,
              x: 580,
              y: 160,
              w: 130,
              h: 160,
            },
          ],
        },
      ];
  }
}
