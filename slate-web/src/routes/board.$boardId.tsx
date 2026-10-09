import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { WhiteboardCanvas } from "@/components/whiteboard/Canvas";
import { Toolbar } from "@/components/whiteboard/Toolbar";
import { TopBar } from "@/components/whiteboard/TopBar";
import { WidgetsSheet, useWidgetLauncher } from "@/components/whiteboard/WidgetsSheet";
import { AISheet } from "@/components/whiteboard/AISheet";
import { FloatingWidget } from "@/components/whiteboard/FloatingWidget";
import {
  CalculatorWidget,
  DiceWidget,
  ScoreWidget,
  StopwatchWidget,
  TimerWidget,
  VoiceNoteWidget,
  MathGraphWidget,
} from "@/components/whiteboard/widgets/BasicWidgets";
import { RulerWidget } from "@/components/whiteboard/widgets/RulerWidget";
import { useWhiteboard } from "@/lib/whiteboard/store";
import { fetchBoardById } from "@/lib/supabase/dbService";
import { Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/board/$boardId")({
  head: () => ({
    meta: [{ title: "Board — Slate" }, { name: "robots", content: "noindex" }],
  }),
  component: BoardPage,
  errorComponent: ({ error }) => (
    <div className="grid min-h-dvh place-items-center bg-background p-6 text-center">
      <div>
        <h1 className="text-lg font-semibold">Couldn't open this board</h1>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        <a href="/" className="mt-4 inline-block text-sm text-primary underline">
          Back to dashboard
        </a>
      </div>
    </div>
  ),
});

function BoardPage() {
  const { boardId } = Route.useParams();
  const navigate = useNavigate();
  const [widgetsOpen, setWidgetsOpen] = useState(false);
  const [aiOpen, setAIOpen] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);
  const { openWidgets, launch, close } = useWidgetLauncher();
  const { selectedId, pages, activePageId, activeBoardId, boards, boardData, openBoard, hydrated } =
    useWhiteboard();

  useEffect(() => {
    if (!hydrated) return;
    if (!boardData[boardId]) {
      fetchBoardById(boardId).then((cb) => {
        if (cb) {
          const pages = Array.isArray(cb.pages) && cb.pages.length
            ? cb.pages
            : [{ id: Math.random().toString(36).slice(2, 10), objects: [], background: (cb.background as any) || "white" }];
          const meta = {
            id: cb.id,
            title: cb.title || "Untitled board",
            tags: [],
            folderId: cb.folder_id || null,
            favorite: Boolean(cb.is_starred),
            archived: false,
            createdAt: cb.created_at ? new Date(cb.created_at).getTime() : Date.now(),
            updatedAt: cb.updated_at ? new Date(cb.updated_at).getTime() : Date.now(),
          };
          useWhiteboard.setState((prev) => ({
            ...prev,
            boards: { ...prev.boards, [cb.id]: meta },
            boardOrder: prev.boardOrder.includes(cb.id) ? prev.boardOrder : [cb.id, ...prev.boardOrder],
            boardData: { ...prev.boardData, [cb.id]: { pages, activePageId: pages[0].id } },
            activeBoardId: cb.id,
            pages,
            activePageId: pages[0].id,
          }));
        } else {
          navigate({ to: "/", replace: true });
        }
      });
      return;
    }
    if (activeBoardId !== boardId) openBoard(boardId);
  }, [boardId, boardData, activeBoardId, openBoard, navigate, hydrated]);

  useEffect(() => {
    const handleOpenWidgets = () => setWidgetsOpen(true);
    window.addEventListener("slate:open-widgets", handleOpenWidgets);
    return () => window.removeEventListener("slate:open-widgets", handleOpenWidgets);
  }, []);

  const board = boards[boardId];
  const ready = activeBoardId === boardId && pages.length > 0;
  const page = ready ? pages.find((p) => p.id === activePageId) : undefined;
  const selected = page?.objects.find((o) => o.id === selectedId);
  const contextText =
    selected && "text" in selected && typeof selected.text === "string" ? selected.text : undefined;

  if (!ready) {
    return (
      <div className="grid h-dvh w-screen place-items-center bg-background text-sm text-muted-foreground">
        Loading board…
      </div>
    );
  }

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-background">
      <WhiteboardCanvas onOpenAI={() => setAIOpen(true)} onPresentationChange={setIsPresenting} />

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 flex justify-center p-2 sm:p-3 transition-opacity duration-300 z-30",
          isPresenting ? "opacity-0 pointer-events-none" : "opacity-100",
        )}
      >
        <TopBar
          onOpenAI={() => setAIOpen(true)}
          onOpenWidgets={() => setWidgetsOpen(true)}
          boardTitle={board?.title ?? "Untitled board"}
        />
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-2 sm:bottom-3 flex justify-center px-2 z-30 transition-opacity duration-300",
          isPresenting ? "opacity-0 pointer-events-none" : "opacity-100",
        )}
      >
        <Toolbar />
      </div>

      {selectedId && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 lg:bottom-4 lg:left-auto lg:right-4 lg:translate-x-0">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-card px-2 py-1 shadow-lg ring-1 ring-border">
            <button
              onClick={() => setAIOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Ask AI
            </button>
          </div>
        </div>
      )}

      <WidgetsSheet open={widgetsOpen} onOpenChange={setWidgetsOpen} onLaunch={launch} />
      <AISheet open={aiOpen} onOpenChange={setAIOpen} contextText={contextText} boardId={boardId} />

      {openWidgets.map((w) => (
        <FloatingWidget
          key={w.id}
          title={titleFor(w.kind)}
          initial={{ x: w.x, y: w.y }}
          onClose={() => close(w.id)}
        >
          {w.kind === "timer" && <TimerWidget />}
          {w.kind === "stopwatch" && <StopwatchWidget />}
          {w.kind === "dice" && <DiceWidget />}
          {w.kind === "score" && <ScoreWidget />}
          {w.kind === "calculator" && <CalculatorWidget />}
          {w.kind === "voice" && <VoiceNoteWidget />}
          {w.kind === "graph" && <MathGraphWidget />}
          {w.kind === "ruler" && <RulerWidget />}
        </FloatingWidget>
      ))}
    </div>
  );
}

function titleFor(k: string) {
  switch (k) {
    case "timer":
      return "Timer";
    case "stopwatch":
      return "Stopwatch";
    case "dice":
      return "Dice";
    case "score":
      return "Scoreboard";
    case "calculator":
      return "Calculator";
    case "voice":
      return "Voice Notes & Transcriber";
    case "graph":
      return "MathPad 2D Grapher";
    case "ruler":
      return "Interactive Ruler";
    default:
      return k;
  }
}
