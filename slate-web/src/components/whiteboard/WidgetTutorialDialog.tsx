import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Timer,
  Clock,
  Dices,
  Trophy,
  Calculator,
  StickyNote,
  ImagePlus,
  Ruler,
  Table as TableIcon,
  Mic,
  LineChart,
  Sigma,
  Sparkles,
  Search,
  Check,
  Play,
  HelpCircle,
  ExternalLink,
  Atom,
  Layers,
} from "lucide-react";
import type { WidgetKind } from "./WidgetsSheet";
import { cn } from "@/lib/utils";

export interface WidgetGuideItem {
  id: string;
  kind?:
    | WidgetKind
    | "sticky"
    | "math-formula"
    | "image-search"
    | "table"
    | "solve-math"
    | "periodic-table"
    | "flashcards";
  label: string;
  category: "Classroom" | "Canvas Tools";
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  summary: string;
  howToUse: string;
  actionLabel: string;
}

export const WIDGET_GUIDE_ITEMS: WidgetGuideItem[] = [
  {
    id: "timer",
    kind: "timer",
    label: "Countdown Timer",
    category: "Classroom",
    icon: Timer,
    color: "text-orange-500",
    bgColor: "bg-orange-500/15",
    summary: "Sets a timed countdown with audio chimes and visual progress rings.",
    howToUse: "Use for time-boxed student quizzes, speaking rounds, group sprints, or study intervals.",
    actionLabel: "Launch Timer",
  },
  {
    id: "stopwatch",
    kind: "stopwatch",
    label: "Stopwatch",
    category: "Classroom",
    icon: Clock,
    color: "text-blue-500",
    bgColor: "bg-blue-500/15",
    summary: "Precision elapsed stopwatch with split laps and millisecond accuracy.",
    howToUse: "Ideal for timing science experiments, physics speed runs, and presentation rehearsals.",
    actionLabel: "Launch Stopwatch",
  },
  {
    id: "dice",
    kind: "dice",
    label: "Random Dice",
    category: "Classroom",
    icon: Dices,
    color: "text-purple-500",
    bgColor: "bg-purple-500/15",
    summary: "Interactive 3D/2D dice roller with randomized bounce physics.",
    howToUse: "Great for probability lessons, board games, turn-taking, and generating random numbers.",
    actionLabel: "Roll Dice",
  },
  {
    id: "score",
    kind: "score",
    label: "Scoreboard",
    category: "Classroom",
    icon: Trophy,
    color: "text-amber-500",
    bgColor: "bg-amber-500/15",
    summary: "Live dual-team scoreboard with points incrementer and editable team names.",
    howToUse: "Keep score during classroom trivia, debate tournaments, or student challenge games.",
    actionLabel: "Open Scoreboard",
  },
  {
    id: "calculator",
    kind: "calculator",
    label: "Scientific Calculator",
    category: "Classroom",
    icon: Calculator,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/15",
    summary: "Movable floating calculator for quick arithmetic and mathematical expressions.",
    howToUse: "Perform calculations right alongside your notes without switching between apps.",
    actionLabel: "Launch Calculator",
  },
  {
    id: "voice",
    kind: "voice",
    label: "Voice Notes",
    category: "Classroom",
    icon: Mic,
    color: "text-rose-500",
    bgColor: "bg-rose-500/15",
    summary: "Records audio notes and reflections directly onto the whiteboard canvas.",
    howToUse: "Record student voice memos, pronunciation checks, or teacher explanations that stay pinned on the board.",
    actionLabel: "Record Voice",
  },
  {
    id: "graph",
    kind: "graph",
    label: "MathPad 2D Graph",
    category: "Classroom",
    icon: LineChart,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/15",
    summary: "Interactive 2D Cartesian graphing utility for functions, coordinates, and curves.",
    howToUse: "Plot mathematical functions like f(x) = sin(x) or quadratic curves with interactive axes.",
    actionLabel: "Plot Graph",
  },
  {
    id: "sticky",
    kind: "sticky",
    label: "Sticky Note",
    category: "Canvas Tools",
    icon: StickyNote,
    color: "text-yellow-500",
    bgColor: "bg-yellow-400/20",
    summary: "Colorful post-it style note (5 pastel colors) with editable multi-line text.",
    howToUse: "Pin reminders, brainstorming ideas, task callouts, or key definitions anywhere on the board.",
    actionLabel: "Add Sticky Note",
  },
  {
    id: "math-formula",
    kind: "math-formula",
    label: "LaTeX Math Formula",
    category: "Canvas Tools",
    icon: Sigma,
    color: "text-violet-500",
    bgColor: "bg-violet-500/15",
    summary: "Typeset elegant LaTeX equations with fractions, integrals, matrices, and roots.",
    howToUse: "Insert high-resolution formatted math formulas directly into your lesson boards.",
    actionLabel: "Insert Formula",
  },
  {
    id: "image-search",
    kind: "image-search",
    label: "Image Search",
    category: "Canvas Tools",
    icon: ImagePlus,
    color: "text-pink-500",
    bgColor: "bg-pink-500/15",
    summary: "Search royalty-free stock diagrams, photos, and visual illustrations online.",
    howToUse: "Drop diagrams, anatomy illustrations, or visual aids straight onto your canvas.",
    actionLabel: "Search Images",
  },
  {
    id: "ruler",
    kind: "ruler",
    label: "Precision Ruler",
    category: "Canvas Tools",
    icon: Ruler,
    color: "text-amber-500",
    bgColor: "bg-amber-500/15",
    summary: "Virtual on-screen measuring ruler with pixel/cm scales and angle rotation.",
    howToUse: "Measure distances, draw clean straight lines, and demonstrate geometric scales.",
    actionLabel: "Use Ruler",
  },
  {
    id: "table",
    kind: "table",
    label: "Data Table",
    category: "Canvas Tools",
    icon: TableIcon,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/15",
    summary: "Customizable grid table generator with editable rows, columns, and headers.",
    howToUse: "Structure comparisons, experiment results, schedules, or vocabulary matrices.",
    actionLabel: "Insert Table",
  },
  {
    id: "solve-math",
    kind: "solve-math",
    label: "Solve Written Math (AI)",
    category: "Canvas Tools",
    icon: Sparkles,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-600/15",
    summary: "AI vision recognition that scans handwritten formulas and calculates solutions.",
    howToUse: "Draw any math equation with the pen, tap Solve Math, and AI computes step-by-step answers!",
    actionLabel: "Solve Math",
  },
  {
    id: "flashcards",
    kind: "flashcards",
    label: "Study Flashcards",
    category: "Classroom",
    icon: Layers,
    color: "text-amber-500",
    bgColor: "bg-amber-500/15",
    summary: "Interactive 3D flip cards for rapid memorization, physics constants, formulas & custom notes.",
    howToUse: "Flip cards to reveal answers, test comprehension, and insert question/answer cards onto the whiteboard.",
    actionLabel: "Open Flashcards",
  },
  {
    id: "periodic-table",
    kind: "periodic-table",
    label: "Periodic Table",
    category: "Canvas Tools",
    icon: Atom,
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-500/15",
    summary: "Full chemical elements directory with atomic numbers, masses, electron configurations & phases.",
    howToUse: "Search elements by symbol, name, or number, and insert chemistry element badges directly onto the canvas.",
    actionLabel: "Explore Elements",
  },
];

export function WidgetTutorialDialog({
  open,
  onOpenChange,
  onSelectAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAction?: (item: WidgetGuideItem) => void;
}) {
  const [tab, setTab] = useState<"all" | "Classroom" | "Canvas Tools">("all");
  const [search, setSearch] = useState("");
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const filtered = useMemo(() => {
    return WIDGET_GUIDE_ITEMS.filter((item) => {
      const matchTab = tab === "all" || item.category === tab;
      const matchSearch =
        !search.trim() ||
        item.label.toLowerCase().includes(search.toLowerCase()) ||
        item.summary.toLowerCase().includes(search.toLowerCase()) ||
        item.howToUse.toLowerCase().includes(search.toLowerCase());
      return matchTab && matchSearch;
    });
  }, [tab, search]);

  const handleClose = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem("slate_widget_tutorial_dismissed", "true");
      } catch (e) {}
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl border border-border bg-card">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-muted/30">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </span>
                <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight">
                  Widgets & Tools Guide
                </DialogTitle>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  13 Features
                </span>
              </div>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
                Learn what each icon does and how to launch tools to make your whiteboard dynamic.
              </DialogDescription>
            </div>
          </div>

          {/* Search & Filter bar */}
          <div className="mt-3.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tools (e.g. dice, timer, math, sticky, table)..."
                className="h-8 pl-8 text-xs bg-background"
              />
            </div>
            <div className="flex rounded-lg bg-muted p-0.5 text-xs font-medium shrink-0">
              {(["all", "Classroom", "Canvas Tools"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    "px-2.5 py-1 rounded-md transition text-xs capitalize",
                    tab === t
                      ? "bg-card text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t === "all" ? "All Tools" : t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable list of widgets */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 overscroll-contain">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              No widgets found matching &ldquo;{search}&rdquo;.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filtered.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between rounded-xl border border-border bg-background p-3 hover:border-primary/50 hover:shadow-xs transition space-y-2.5"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "grid h-8 w-8 place-items-center rounded-lg shrink-0",
                              item.bgColor,
                              item.color,
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <div>
                            <div className="text-xs font-semibold text-foreground leading-tight">
                              {item.label}
                            </div>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {item.category}
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="mt-2 text-[11px] font-medium text-foreground/90 leading-snug">
                        {item.summary}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground leading-snug">
                        💡 {item.howToUse}
                      </p>
                    </div>

                    {onSelectAction && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-7 text-[11px] gap-1.5 font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={() => {
                          onSelectAction(item);
                          handleClose();
                        }}
                      >
                        <Play className="h-3 w-3" />
                        {item.actionLabel}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:px-5 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
            />
            <span>Don&apos;t pop up automatically (open anytime via &ldquo;?&rdquo;)</span>
          </label>

          <Button size="sm" onClick={handleClose} className="px-5 text-xs font-semibold h-8 w-full sm:w-auto">
            Got it, Let&apos;s Draw!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
