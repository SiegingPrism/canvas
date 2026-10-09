import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  HelpCircle,
  Atom,
  Layers,
  Grid3X3,
} from "lucide-react";
import { useWhiteboard } from "@/lib/whiteboard/store";
import type { StickyNoteObject } from "@/lib/whiteboard/types";
import { MathFormulaDialog } from "./MathFormulaDialog";
import { ImageSearchDialog } from "./ImageSearchDialog";
import { TableDialog } from "./TableDialog";
import { PeriodicTableDialog, type ElementData } from "./widgets/PeriodicTableDialog";
import { FlashcardsDialog, type Flashcard } from "./widgets/FlashcardsDialog";
import { WidgetTutorialDialog, type WidgetGuideItem } from "./WidgetTutorialDialog";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export type WidgetKind =
  | "timer"
  | "stopwatch"
  | "dice"
  | "score"
  | "calculator"
  | "voice"
  | "graph"
  | "ruler";

export function WidgetsSheet({
  open,
  onOpenChange,
  onLaunch,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onLaunch: (kind: WidgetKind) => void;
}) {
  const { addObject, pushHistory, camera, setTool } = useWhiteboard();
  const [mathDialogOpen, setMathDialogOpen] = useState(false);
  const [imageSearchOpen, setImageSearchOpen] = useState(false);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [periodicOpen, setPeriodicOpen] = useState(false);
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [inspectElementNum, setInspectElementNum] = useState<number | undefined>(undefined);

  // Automatically trigger the tutorial popup the first time widgets are opened
  useEffect(() => {
    if (open) {
      try {
        const dismissed = localStorage.getItem("slate_widget_tutorial_dismissed");
        if (dismissed !== "true") {
          setTutorialOpen(true);
        }
      } catch (e) {}
    }
  }, [open]);

  // Listen to inspect element requests from whiteboard canvas clicks
  useEffect(() => {
    const onInspect = (e: Event) => {
      const customEvent = e as CustomEvent<{ number: number }>;
      if (customEvent.detail?.number) {
        setInspectElementNum(customEvent.detail.number);
        setPeriodicOpen(true);
      }
    };
    window.addEventListener("slate:inspect-element", onInspect);
    return () => window.removeEventListener("slate:inspect-element", onInspect);
  }, []);

  function handleInsertWholePeriodicTable() {
    const screenW = typeof window !== "undefined" ? window.innerWidth : 1200;
    const screenH = typeof window !== "undefined" ? window.innerHeight : 800;
    const tableW = 1080;
    const tableH = 640;
    const cx = (screenW / 2 - camera.x) / camera.zoom - tableW / 2;
    const cy = (screenH / 2 - camera.y) / camera.zoom - tableH / 2;

    addObject({
      id: uid(),
      kind: "periodic-table",
      x: Math.round(cx),
      y: Math.round(cy),
      w: tableW,
      h: tableH,
      title: "Periodic Table of Elements (118 Elements)",
    });
    setTool("select");
    pushHistory();
    onOpenChange(false);
  }

  function addSticky() {
    const colors = ["#fef08a", "#bbf7d0", "#bae6fd", "#fbcfe8", "#fed7aa"];
    const screenW = typeof window !== "undefined" ? window.innerWidth : 400;
    const screenH = typeof window !== "undefined" ? window.innerHeight : 600;
    const cx = (screenW / 2 - camera.x) / camera.zoom - 90;
    const cy = (screenH / 2 - camera.y) / camera.zoom - 90;
    const s: StickyNoteObject = {
      id: uid(),
      kind: "sticky",
      x: cx,
      y: cy,
      w: 180,
      h: 180,
      text: "New note",
      color: colors[Math.floor(Math.random() * colors.length)],
    };
    addObject(s);
    pushHistory();
    onOpenChange(false);
  }

  function handleInsertElement(el: ElementData) {
    const screenW = typeof window !== "undefined" ? window.innerWidth : 400;
    const screenH = typeof window !== "undefined" ? window.innerHeight : 600;
    const cx = (screenW / 2 - camera.x) / camera.zoom - 95;
    const cy = (screenH / 2 - camera.y) / camera.zoom - 100;
    const s: StickyNoteObject = {
      id: uid(),
      kind: "sticky",
      x: cx,
      y: cy,
      w: 190,
      h: 200,
      text: `${el.number}  •  ${el.symbol}\n${el.name}\nMass: ${el.mass} u\n${el.category.toUpperCase()}\n${el.config || ""}`,
      color: "#ecfdf5",
    };
    addObject(s);
    pushHistory();
  }

  function handleInsertCard(card: Flashcard) {
    const screenW = typeof window !== "undefined" ? window.innerWidth : 400;
    const screenH = typeof window !== "undefined" ? window.innerHeight : 600;
    const cx = (screenW / 2 - camera.x) / camera.zoom - 110;
    const cy = (screenH / 2 - camera.y) / camera.zoom - 110;
    const s: StickyNoteObject = {
      id: uid(),
      kind: "sticky",
      x: cx,
      y: cy,
      w: 220,
      h: 220,
      text: `[${card.deck}]\n\nQ: ${card.question}\n\nA: ${card.answer}`,
      color: "#fef3c7",
    };
    addObject(s);
    pushHistory();
  }

  function handleTutorialAction(item: WidgetGuideItem) {
    setTutorialOpen(false);
    if (item.id === "sticky") {
      addSticky();
    } else if (item.id === "math-formula") {
      onOpenChange(false);
      setMathDialogOpen(true);
    } else if (item.id === "image-search") {
      onOpenChange(false);
      setImageSearchOpen(true);
    } else if (item.id === "table") {
      onOpenChange(false);
      setTableDialogOpen(true);
    } else if (item.id === "periodic-table") {
      onOpenChange(false);
      setPeriodicOpen(true);
    } else if (item.id === "flashcards") {
      onOpenChange(false);
      setFlashcardsOpen(true);
    } else if (item.id === "solve-math") {
      onOpenChange(false);
      window.dispatchEvent(new CustomEvent("slate:solve-math"));
    } else if (item.kind && typeof item.kind === "string") {
      onLaunch(item.kind as WidgetKind);
      onOpenChange(false);
    }
  }

  const items = [
    {
      kind: "timer" as const,
      label: "Timer",
      desc: "Countdown",
      icon: Timer,
      color: "bg-orange-500/10 text-orange-500",
    },
    {
      kind: "stopwatch" as const,
      label: "Stopwatch",
      desc: "Split laps",
      icon: Clock,
      color: "bg-blue-500/10 text-blue-500",
    },
    {
      kind: "dice" as const,
      label: "Dice",
      desc: "Roll 1-4",
      icon: Dices,
      color: "bg-purple-500/10 text-purple-500",
    },
    {
      kind: "score" as const,
      label: "Scoreboard",
      desc: "Team points",
      icon: Trophy,
      color: "bg-yellow-500/10 text-yellow-500",
    },
    {
      kind: "calculator" as const,
      label: "Calculator",
      desc: "Floating calc",
      icon: Calculator,
      color: "bg-emerald-500/10 text-emerald-500",
    },
    {
      kind: "voice" as const,
      label: "Voice Notes",
      desc: "Audio memos",
      icon: Mic,
      color: "bg-rose-500/10 text-rose-500",
    },
    {
      kind: "graph" as const,
      label: "MathPad 2D",
      desc: "Plot curves",
      icon: LineChart,
      color: "bg-cyan-500/10 text-cyan-500",
    },
  ];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col h-full max-h-dvh p-4 sm:p-6 overflow-hidden">
          <SheetHeader className="flex flex-row items-center justify-between space-y-0 pr-6 border-b border-border/60 pb-3 shrink-0">
            <SheetTitle className="text-base font-bold">Widgets & Tools</SheetTitle>
            <button
              type="button"
              onClick={() => setTutorialOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1 text-xs font-semibold transition active:scale-95"
              title="What does each widget do?"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Feature Guide</span>
            </button>
          </SheetHeader>
          <div className="mt-3 space-y-6 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 pb-8 touch-auto">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Classroom Widgets
                </h3>
                <span className="text-[10px] text-muted-foreground">tap to open</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {items.map((it) => {
                  const Icon = it.icon;
                  return (
                    <button
                      key={it.kind}
                      onClick={() => {
                        onLaunch(it.kind);
                        onOpenChange(false);
                      }}
                      className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-2.5 text-center transition hover:bg-accent active:scale-95 group"
                    >
                      <span className={`grid h-10 w-10 place-items-center rounded-lg ${it.color} transition-transform group-hover:scale-105`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="text-xs font-semibold leading-tight">{it.label}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 leading-none">{it.desc}</div>
                      </div>
                    </button>
                  );
                })}
                <button
                  onClick={() => {
                    onOpenChange(false);
                    setFlashcardsOpen(true);
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-2.5 text-center transition hover:bg-accent active:scale-95 group"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-amber-500/10 text-amber-500 transition-transform group-hover:scale-105">
                    <Layers className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold leading-tight">Flashcards</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-none">Study quiz</div>
                  </div>
                </button>
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Canvas Tools
                </h3>
                <span className="text-[10px] text-muted-foreground">insert to board</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={addSticky}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-2.5 text-center transition hover:bg-accent active:scale-95 group"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-yellow-400/20 text-yellow-500 transition-transform group-hover:scale-105">
                    <StickyNote className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold leading-tight">Sticky note</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-none">Colored notes</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    onOpenChange(false);
                    setPeriodicOpen(true);
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-2.5 text-center transition hover:bg-accent active:scale-95 group"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal-500/10 text-teal-500 transition-transform group-hover:scale-105">
                    <Atom className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold leading-tight">Periodic Table</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-none">Chemistry elements</div>
                  </div>
                </button>
                <button
                  onClick={handleInsertWholePeriodicTable}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-teal-500/30 bg-teal-500/5 p-2.5 text-center transition hover:bg-teal-500/10 active:scale-95 group"
                  title="Place entire 118-element periodic table on board"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal-600/15 text-teal-600 dark:text-teal-400 transition-transform group-hover:scale-105">
                    <Grid3X3 className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold leading-tight text-teal-700 dark:text-teal-300">Whole Table</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-none">All 118 on board</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    onOpenChange(false);
                    setMathDialogOpen(true);
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-2.5 text-center transition hover:bg-accent active:scale-95 group"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-violet-500/10 text-violet-500 transition-transform group-hover:scale-105">
                    <Sigma className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold leading-tight">Math Formula</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-none">LaTeX code</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    onOpenChange(false);
                    setImageSearchOpen(true);
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-2.5 text-center transition hover:bg-accent active:scale-95 group"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-pink-500/10 text-pink-500 transition-transform group-hover:scale-105">
                    <ImagePlus className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold leading-tight">Image Search</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-none">Online photos</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    onLaunch("ruler");
                    onOpenChange(false);
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-2.5 text-center transition hover:bg-accent active:scale-95 group"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-amber-500/10 text-amber-500 transition-transform group-hover:scale-105">
                    <Ruler className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold leading-tight">Ruler</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-none">Measure & align</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    onOpenChange(false);
                    setTableDialogOpen(true);
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-2.5 text-center transition hover:bg-accent active:scale-95 group"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-500 transition-transform group-hover:scale-105">
                    <TableIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold leading-tight">Table</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-none">Grid data</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    onOpenChange(false);
                    window.dispatchEvent(new CustomEvent("slate:solve-math"));
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-2.5 text-center transition hover:bg-accent active:scale-95 group"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-violet-600/15 text-violet-600 dark:text-violet-400 transition-transform group-hover:scale-105">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold leading-tight">Solve Math</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-none">AI recognition</div>
                  </div>
                </button>
              </div>
            </section>
          </div>
        </SheetContent>
      </Sheet>
      <WidgetTutorialDialog
        open={tutorialOpen}
        onOpenChange={setTutorialOpen}
        onSelectAction={handleTutorialAction}
      />
      <MathFormulaDialog open={mathDialogOpen} onOpenChange={setMathDialogOpen} />
      <ImageSearchDialog open={imageSearchOpen} onOpenChange={setImageSearchOpen} />
      <TableDialog open={tableDialogOpen} onOpenChange={setTableDialogOpen} />
      <PeriodicTableDialog
        open={periodicOpen}
        onOpenChange={(v) => {
          setPeriodicOpen(v);
          if (!v) setInspectElementNum(undefined);
        }}
        onInsertElement={handleInsertElement}
        onInsertWholeTable={handleInsertWholePeriodicTable}
        initialElementNumber={inspectElementNum}
      />
      <FlashcardsDialog
        open={flashcardsOpen}
        onOpenChange={setFlashcardsOpen}
        onInsertCard={handleInsertCard}
      />
    </>
  );
}

function DisabledCard({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-3 text-center opacity-50">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-xs">{label}</span>
    </div>
  );
}

export function useWidgetLauncher() {
  const [openWidgets, setOpenWidgets] = useState<
    Array<{ id: string; kind: WidgetKind; x: number; y: number }>
  >([]);
  function launch(kind: WidgetKind) {
    setOpenWidgets((w) => [
      ...w,
      { id: uid(), kind, x: 120 + w.length * 30, y: 120 + w.length * 30 },
    ]);
  }
  function close(id: string) {
    setOpenWidgets((w) => w.filter((x) => x.id !== id));
  }
  return { openWidgets, launch, close };
}
