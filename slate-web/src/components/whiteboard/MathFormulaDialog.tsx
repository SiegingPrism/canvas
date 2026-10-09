import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sigma, Sparkles, Calculator, LineChart, Check } from "lucide-react";
import { useWhiteboard } from "@/lib/whiteboard/store";
import { AIEngine } from "@/lib/ai/aiEngine";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const FORMULA_PRESETS = [
  { label: "Quadratic Formula", latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}", cat: "Algebra" },
  { label: "Pythagorean Theorem", latex: "a^2 + b^2 = c^2", cat: "Geometry" },
  { label: "Parabola Function", latex: "f(x) = x^2 - 4", cat: "Algebra" },
  { label: "Euler's Identity", latex: "e^{i\\pi} + 1 = 0", cat: "Complex" },
  { label: "Calculus Derivative", latex: "\\frac{d}{dx}[x^n] = n x^{n-1}", cat: "Calculus" },
  { label: "Definite Integral", latex: "\\int_{a}^{b} f(x) \\, dx = F(b) - F(a)", cat: "Calculus" },
  { label: "Trig Identity", latex: "\\sin^2(\\theta) + \\cos^2(\\theta) = 1", cat: "Trigonometry" },
  { label: "Sine Wave", latex: "f(x) = \\sin(x)", cat: "Functions" },
  { label: "Normal Distribution", latex: "f(x) = \\frac{1}{\\sigma \\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}", cat: "Stats" },
  { label: "Einstein Energy", latex: "E = m c^2", cat: "Physics" },
  { label: "Exponential Growth", latex: "P(t) = P_0 e^{rt}", cat: "Calculus" },
  { label: "Circle Area", latex: "A = \\pi r^2", cat: "Geometry" },
];

export function MathFormulaDialog({
  open,
  onOpenChange,
  initialLatex = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLatex?: string;
}) {
  const { addObject, pushHistory, camera } = useWhiteboard();
  const [latex, setLatex] = useState(initialLatex || "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}");
  const [label, setLabel] = useState("");
  const [isSolving, setIsSolving] = useState(false);

  useEffect(() => {
    if (open && initialLatex) {
      setLatex(initialLatex);
    }
  }, [open, initialLatex]);

  function handleInsert() {
    if (!latex.trim()) {
      toast.error("Please enter a mathematical expression or LaTeX formula");
      return;
    }

    const id = uid();
    const clean = latex.trim();
    const screenW = typeof window !== "undefined" ? window.innerWidth : 400;
    const screenH = typeof window !== "undefined" ? window.innerHeight : 600;
    const w = Math.max(280, Math.min(460, clean.length * 8 + 60));
    const h = 110;
    const cx = (screenW / 2 - camera.x) / camera.zoom - w / 2;
    const cy = (screenH / 2 - camera.y) / camera.zoom - h / 2;

    addObject({
      id,
      kind: "formula",
      x: cx,
      y: cy,
      w,
      h,
      latex: clean,
      label: label.trim() || undefined,
    });
    pushHistory();
    toast.success("Math formula placed on canvas!");
    onOpenChange(false);
  }

  async function handleSolveAndPlot() {
    if (!latex.trim()) {
      toast.error("Please enter a formula to solve");
      return;
    }

    setIsSolving(true);
    toast.info("Solving formula & computing graph...");

    try {
      const clean = latex.trim();
      const res = await AIEngine.solveMath(clean);

      const screenW = typeof window !== "undefined" ? window.innerWidth : 400;
      const screenH = typeof window !== "undefined" ? window.innerHeight : 600;
      const formulaW = Math.max(280, Math.min(460, clean.length * 8 + 60));
      const formulaH = 110;
      const cx = (screenW / 2 - camera.x) / camera.zoom - formulaW / 2;
      const cy = (screenH / 2 - camera.y) / camera.zoom - formulaH / 2 - 50;
      const formulaId = uid();

      // 1. Clean formula card
      addObject({
        id: formulaId,
        kind: "formula",
        x: cx,
        y: cy,
        w: formulaW,
        h: formulaH,
        latex: res.latex || clean,
        label: res.title || label.trim() || "SOLVED",
      });

      // 2. Step-by-step solution sticky note
      const stepsText =
        `📐 SOLUTION: ${res.solution}\n\n` +
        (res.steps?.length
          ? res.steps.map((s) => `• ${s}`).join("\n")
          : "Verified algebraic solution.");
      addObject({
        id: uid(),
        kind: "sticky",
        x: cx,
        y: cy + 124,
        w: 300,
        h: Math.min(260, Math.max(140, (res.steps?.length || 2) * 28 + 60)),
        text: stepsText,
        color: "#fef9c3",
      });

      // 3. Interactive 2D Graph if plottable
      if (res.graphableFn) {
        addObject({
          id: uid(),
          kind: "graph",
          x: cx + formulaW + 20,
          y: cy,
          w: 320,
          h: 234,
          fn: res.graphableFn,
          xMin: res.xRange?.[0] ?? -6,
          xMax: res.xRange?.[1] ?? 6,
          yMin: res.yRange?.[0] ?? -5,
          yMax: res.yRange?.[1] ?? 8,
          color: "#38bdf8",
          title: res.title || `Plot: ${clean}`,
        });
        toast.success("Solved, explained & 2D graph plotted on canvas!");
      } else {
        toast.success("Math solved with step-by-step reasoning!");
      }

      pushHistory();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to solve formula");
    } finally {
      setIsSolving(false);
    }
  }

  // Prettify LaTeX for preview display
  const previewText = latex
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1 / $2)")
    .replace(/\\sqrt\{([^}]+)\}/g, "√($1)")
    .replace(/\\pm/g, "±")
    .replace(/\\cdot/g, "·")
    .replace(/\\pi/g, "π")
    .replace(/\\int/g, "∫")
    .replace(/\\infty/g, "∞")
    .replace(/\\partial/g, "∂")
    .replace(/\\sum/g, "∑")
    .replace(/\\left|\\right/g, "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sigma className="h-5 w-5 text-violet-600" />
            Insert Math Formula & Equation
          </DialogTitle>
          <DialogDescription>
            Type LaTeX or standard math syntax to place on the canvas, or solve it step-by-step.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Formula Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Formula (LaTeX or Math expression)
            </label>
            <textarea
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              placeholder="e.g. x = (-b \pm \sqrt{b^2 - 4ac}) / (2a) or f(x) = x^2 - 4"
              rows={2}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-mono shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          {/* Optional Label */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Optional Title / Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Quadratic Formula, Kinetic Energy, etc."
              className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          {/* Live Preview Card */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Preview Card
            </div>
            <div className="rounded-xl border border-violet-500/30 bg-card p-3 shadow-sm">
              <div className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">
                {label.trim() ? `MATH · ${label.toUpperCase()}` : "MATH FORMULA (LaTeX)"}
              </div>
              <div className="mt-1 text-base italic font-serif text-foreground truncate">
                {previewText || "Formula preview..."}
              </div>
              <div className="mt-2 text-[9px] font-mono text-muted-foreground truncate">
                {latex || "LaTeX code"}
              </div>
            </div>
          </div>

          {/* Quick Preset Chips */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Common Formulas
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
              {FORMULA_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setLatex(p.latex);
                    setLabel(p.label);
                  }}
                  className={cn(
                    "rounded-lg border px-2 py-1 text-[11px] font-medium transition active:scale-95",
                    latex === p.latex
                      ? "border-violet-500 bg-violet-500/10 text-violet-600 font-semibold"
                      : "border-border bg-muted/40 hover:bg-muted text-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={handleInsert}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 text-xs font-semibold transition active:scale-95 shadow-sm"
            >
              <Sigma className="h-4 w-4" />
              <span>Insert on Canvas</span>
            </button>
            <button
              type="button"
              disabled={isSolving}
              onClick={handleSolveAndPlot}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-2 text-xs font-semibold transition active:scale-95 shadow-sm disabled:opacity-50"
            >
              <Calculator className="h-4 w-4" />
              <span>{isSolving ? "Solving..." : "Solve & Plot (AI)"}</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
