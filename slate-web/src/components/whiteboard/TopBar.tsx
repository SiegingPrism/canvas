import { useRef, useState } from "react";
import { useWhiteboard } from "@/lib/whiteboard/store";
import type { ImageObject, PageBackground } from "@/lib/whiteboard/types";
import {
  Upload,
  Download,
  QrCode,
  Undo2,
  Redo2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Grid3x3,
  Layout,
  MessageSquare,
  Package,
  ArrowLeft,
  MoreHorizontal,
  Check,
  Sparkles,
  Settings,
  FileText,
  BrainCircuit,
  Loader2,
  LineChart,
  EyeOff,
  Menu,
  ScanEye,
  Bot,
  Sigma,
  BookOpen,
  MonitorPlay,
  Compass,
  LayoutGrid,
  Cloud,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { syncBoardToSupabase } from "@/lib/supabase/dbService";
import { AISettingsDialog } from "@/components/ai/AISettingsDialog";
import { DocumentViewerDialog } from "@/components/document/DocumentViewerDialog";
import { MathFormulaDialog } from "./MathFormulaDialog";
import { FeatureTourDialog } from "./FeatureTourDialog";
import { AIEngine } from "@/lib/ai/aiEngine";
import type { MindMapNodeObject } from "@/lib/whiteboard/types";

import { TEMPLATES } from "@/lib/whiteboard/templates";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const PAPER_TEMPLATES: { id: PageBackground; label: string; icon: string }[] = [
  { id: "white", label: "Blank White", icon: "🗒️" },
  { id: "blackboard", label: "Classic Chalkboard", icon: "🏫" },
  { id: "oled", label: "OLED Pitch Black", icon: "🌌" },
  { id: "dark", label: "Dark Slate", icon: "⬛" },
  { id: "grid", label: "Engineering Grid", icon: "📐" },
  { id: "dots", label: "Dot Journal", icon: "📓" },
  { id: "lined", label: "Notebook Lined", icon: "📝" },
  { id: "isometric", label: "Isometric 3D", icon: "🔺" },
];

export function TopBar({
  onOpenAI,
  onOpenWidgets,
  boardTitle,
}: {
  onOpenAI: () => void;
  onOpenWidgets: () => void;
  boardTitle?: string;
}) {
  const {
    pages,
    activePageId,
    activeBoardId,
    boards,
    prevPage,
    nextPage,
    addPage,
    undo,
    redo,
    setBackground,
    applyTemplate,
    addObject,
    pushHistory,
    setAllTapeReveal,
    syncWithCloud,
  } = useWhiteboard();

  const fileRef = useRef<HTMLInputElement>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrData, setQrData] = useState<string>("");
  const [qrUrl, setQrUrl] = useState<string>("");
  const [templateTab, setTemplateTab] = useState<"background" | "template">("background");
  const [templatePopoverOpen, setTemplatePopoverOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mathFormulaOpen, setMathFormulaOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [docViewerOpen, setDocViewerOpen] = useState(false);
  const [explainDialogOpen, setExplainDialogOpen] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainSnapshot, setExplainSnapshot] = useState<string | null>(null);
  const [explainData, setExplainData] = useState<{
    summary: string;
    breakdown: string[];
    recommendations: string[];
  } | null>(null);

  async function handleExplainBoard() {
    const c = document.querySelector<HTMLCanvasElement>("canvas");
    if (!c) return;
    const img = c.toDataURL("image/png");
    setExplainSnapshot(img);
    setExplainDialogOpen(true);
    setExplainLoading(true);
    setExplainData(null);
    try {
      const res = await AIEngine.explainBoard(img, boardTitle);
      setExplainData(res);
    } catch (e) {
      console.error(e);
      toast.error("Board explanation failed");
    } finally {
      setExplainLoading(false);
    }
  }

  async function handleGenerateMindMap() {
    const topic = prompt("Enter a topic for the AI Mind-Map:", boardTitle || "Core Concept");
    if (!topic || !topic.trim()) return;

    toast.info("Generating AI Mind-Map...");
    try {
      const tree = await AIEngine.generateMindMap(topic.trim(), 650, 450);
      pushHistory();

      function addNodes(node: typeof tree) {
        addObject({
          id: node.id,
          kind: "mindmap-node",
          x: node.x - 70,
          y: node.y - 25,
          w: Math.max(140, node.label.length * 10 + 24),
          h: 46,
          label: node.label,
          level: node.level,
          color: node.color,
          parentId: node.parentId,
        });
        (node.children || []).forEach(addNodes);
      }

      addNodes(tree);
      toast.success("AI Mind-Map generated and placed on canvas!");
    } catch (e) {
      console.error(e);
      toast.error("Mind map generation failed");
    }
  }

  function handleAddGraph() {
    const fn = prompt("Enter a function f(x) to plot on canvas:", "sin(x)");
    if (!fn || !fn.trim()) return;
    const newId = uid();
    addObject({
      id: newId,
      kind: "graph",
      x: 350 + Math.random() * 80,
      y: 250 + Math.random() * 80,
      w: 320,
      h: 220,
      fn: fn.trim(),
      xMin: -6,
      xMax: 6,
      yMin: -4,
      yMax: 4,
      color: "#a855f7",
      title: `f(x) = ${fn.trim()}`,
    });
    pushHistory();
    toast.success("Interactive 2D Graph placed on canvas!");
  }

  const idx = pages.findIndex((p) => p.id === activePageId);
  const page = pages[idx] || pages[0];
  const pad2 = (n: number) => n.toString().padStart(2, "0");

  function exportPNG() {
    const c = document.querySelector<HTMLCanvasElement>("canvas");
    if (!c) return;
    const link = document.createElement("a");
    link.download = `whiteboard-${pad2(idx + 1)}.png`;
    link.href = c.toDataURL("image/png");
    link.click();
    toast.success("PNG exported");
  }

  function exportPDF() {
    const c = document.querySelector<HTMLCanvasElement>("canvas");
    if (!c) return;
    const img = c.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: c.width > c.height ? "landscape" : "portrait",
      unit: "px",
      format: [c.width, c.height],
    });
    pdf.addImage(img, "PNG", 0, 0, c.width, c.height);
    pdf.save(`whiteboard-${pad2(idx + 1)}.pdf`);
    toast.success("PDF exported");
  }

  async function shareQR() {
    try {
      const activeMeta = activeBoardId ? boards[activeBoardId] : null;
      if (activeMeta) {
        toast.loading("Syncing board to cloud for sharing...", { id: "share-qr" });
        await syncBoardToSupabase(activeMeta, pages);
        toast.success("Board synced to cloud!", { id: "share-qr" });
      }

      const publicAppOrigin = (import.meta.env.VITE_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
      const isLocalOrApp =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.protocol === "file:" ||
        window.location.protocol === "capacitor:";

      const targetOrigin = isLocalOrApp && publicAppOrigin ? publicAppOrigin : window.location.origin;
      const targetUrl = activeBoardId ? `${targetOrigin}/board/${activeBoardId}` : window.location.href;

      const qr = await QRCode.toDataURL(targetUrl, { margin: 1, width: 320 });
      setQrData(qr);
      setQrUrl(targetUrl);
      setQrOpen(true);
    } catch (err) {
      console.error("QR generation failed:", err);
      toast.error("Could not generate shareable QR code", { id: "share-qr" });
    }
  }

  function importFile(files: FileList | null) {
    if (!files?.length) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const maxW = 400;
        const w = Math.min(maxW, img.width);
        const h = (img.height / img.width) * w;
        const obj: ImageObject = {
          id: uid(),
          kind: "image",
          x: 100,
          y: 100,
          w,
          h,
          src,
        };
        addObject(obj);
        pushHistory();
        toast.success("Image added");
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  const iconBtn =
    "grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-lg text-foreground hover:bg-accent/80 transition active:scale-95 shrink-0";
  const iconSize = "h-3.5 w-3.5 sm:h-4 sm:w-4";

  return (
    <div className="pointer-events-auto flex items-center gap-0.5 sm:gap-1.5 rounded-full bg-card px-2 py-1 sm:px-3 sm:py-1.5 shadow-lg ring-1 ring-border max-w-[calc(100vw-16px)]">
      {/* Back to Dashboard */}
      <Link
        to="/"
        className={iconBtn}
        title="Back to Dashboard"
      >
        <ArrowLeft className={iconSize} />
      </Link>

      {boardTitle && (
        <span className="hidden max-w-[140px] truncate text-xs font-semibold text-foreground/80 md:block px-1">
          {boardTitle}
        </span>
      )}

      <div className="h-3.5 sm:h-4 w-px bg-border/60 mx-0.5 shrink-0" />

      {/* Undo / Redo */}
      <button className={iconBtn} title="Undo" onClick={undo}>
        <Undo2 className={iconSize} />
      </button>
      <button className={iconBtn} title="Redo" onClick={redo}>
        <Redo2 className={iconSize} />
      </button>

      <div className="h-3.5 sm:h-4 w-px bg-border/60 mx-0.5 shrink-0" />

      {/* Page Navigation */}
      <button className={iconBtn} onClick={prevPage} title="Previous page">
        <ChevronLeft className={iconSize} />
      </button>
      <span className="min-w-8 sm:min-w-10 text-center text-[11px] sm:text-xs font-medium tabular-nums text-foreground/80 shrink-0 select-none">
        {pad2(idx + 1)}/{pad2(pages.length)}
      </span>
      <button className={iconBtn} onClick={nextPage} title="Next page">
        <ChevronRight className={iconSize} />
      </button>
      <button className={iconBtn} onClick={addPage} title="Add page">
        <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
      </button>

      <div className="h-3.5 sm:h-4 w-px bg-border/60 mx-0.5 shrink-0" />

      {/* Background & Templates Picker */}
      <Popover modal={false} open={templatePopoverOpen} onOpenChange={setTemplatePopoverOpen}>
        <PopoverTrigger asChild>
          <button className={iconBtn} title="Backgrounds & Templates">
            <Grid3x3 className={iconSize} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          className="w-80 p-2.5 space-y-2 shadow-xl rounded-2xl border bg-card text-card-foreground"
        >
          {/* Segmented Switch */}
          <div className="flex rounded-xl bg-muted/60 p-1 text-xs">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTemplateTab("background");
              }}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-center font-medium transition",
                templateTab === "background"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Backgrounds
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTemplateTab("template");
              }}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-center font-medium transition",
                templateTab === "template"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Templates
            </button>
          </div>

          {templateTab === "background" ? (
            <div className="space-y-1">
              <div className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Paper Background
              </div>
              <div className="grid grid-cols-1 gap-1">
                {PAPER_TEMPLATES.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => {
                      setBackground(bg.id);
                      setTemplatePopoverOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition active:scale-95 text-left",
                      page.background === bg.id
                        ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/20"
                        : "hover:bg-accent text-foreground",
                    )}
                  >
                    <span className="text-base leading-none">{bg.icon}</span>
                    <span className="flex-1">{bg.label}</span>
                    {page.background === bg.id && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Canvas Templates</span>
                <span className="text-[10px] lowercase font-normal text-muted-foreground/70">
                  tap to apply
                </span>
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => {
                      applyTemplate(t.key);
                      toast.success(`Applied ${t.title} template`);
                      setTemplatePopoverOpen(false);
                    }}
                    className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-accent active:scale-95 group"
                  >
                    <span className="text-xl leading-none mt-0.5">{t.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground">{t.title}</span>
                        <span className="rounded-full bg-muted px-1.5 py-0.2 text-[9px] font-medium text-muted-foreground">
                          {t.category}
                        </span>
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground mt-0.5">
                        {t.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Lecture Presentation Mode */}
      <button
        className={cn(iconBtn, "text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30")}
        title="Start Lecture Presentation (Slides Mode)"
        onClick={() => window.dispatchEvent(new CustomEvent("slate:start-presentation"))}
      >
        <MonitorPlay className={iconSize} />
      </button>

      {/* Radar Minimap */}
      <button
        className={cn(iconBtn, "text-sky-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/30")}
        title="Toggle Radar Minimap"
        onClick={() => window.dispatchEvent(new CustomEvent("slate:toggle-minimap"))}
      >
        <Compass className={iconSize} />
      </button>

      {/* Burger Menu */}
      <Popover modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button className={iconBtn} title="Menu">
            <Menu className={iconSize} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-1.5 space-y-1 shadow-xl">
          {/* AI Features */}
          <button
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold hover:bg-accent text-primary transition"
            onClick={() => {
              setMenuOpen(false);
              onOpenAI();
            }}
          >
            <Bot className="h-3.5 w-3.5 text-primary" />
            <span>AI Assistant</span>
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent text-foreground transition"
            onClick={() => {
              setMenuOpen(false);
              handleExplainBoard();
            }}
          >
            <ScanEye className="h-3.5 w-3.5 text-amber-500" />
            <span>Explain Board</span>
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent text-foreground transition"
            onClick={() => {
              setMenuOpen(false);
              handleGenerateMindMap();
            }}
          >
            <BrainCircuit className="h-3.5 w-3.5 text-purple-500" />
            <span>Generate AI Mind-Map</span>
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent text-foreground transition"
            onClick={() => {
              setMenuOpen(false);
              setDocViewerOpen(true);
            }}
          >
            <FileText className="h-3.5 w-3.5 text-blue-500" />
            <span>PDF & Docs Intelligence</span>
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent text-foreground transition"
            onClick={() => {
              setMenuOpen(false);
              handleAddGraph();
            }}
          >
            <LineChart className="h-3.5 w-3.5 text-cyan-500" />
            <span>Plot 2D Math Function</span>
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent text-foreground transition"
            onClick={() => {
              setMenuOpen(false);
              setMathFormulaOpen(true);
            }}
          >
            <Sigma className="h-3.5 w-3.5 text-violet-500" />
            <span>Math Formula (LaTeX)</span>
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent text-foreground transition"
            onClick={() => {
              setMenuOpen(false);
              window.dispatchEvent(new CustomEvent("slate:solve-math"));
            }}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Solve Written Math</span>
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent text-foreground transition"
            onClick={() => {
              setMenuOpen(false);
              setAiSettingsOpen(true);
            }}
          >
            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            <span>AI & Offline Settings</span>
          </button>

          <div className="h-px w-full bg-border/60 my-1" />

          {/* Tools & Files */}
          <button
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent text-foreground transition"
            onClick={() => {
              setMenuOpen(false);
              onOpenWidgets();
            }}
          >
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Widgets</span>
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent text-foreground transition"
            onClick={() => {
              setMenuOpen(false);
              setTourOpen(true);
            }}
          >
            <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
            <span>Feature Guide & Tutorial</span>
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent text-indigo-500 transition"
            onClick={() => {
              setMenuOpen(false);
              window.dispatchEvent(new CustomEvent("slate:start-presentation"));
            }}
          >
            <MonitorPlay className="h-3.5 w-3.5 text-indigo-500" />
            <span>Lecture Presentation</span>
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent text-sky-500 transition"
            onClick={() => {
              setMenuOpen(false);
              window.dispatchEvent(new CustomEvent("slate:toggle-minimap"));
            }}
          >
            <Compass className="h-3.5 w-3.5 text-sky-500" />
            <span>Radar Minimap</span>
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent text-foreground transition"
            onClick={() => {
              setMenuOpen(false);
              window.dispatchEvent(new CustomEvent("slate:auto-frame-slides"));
            }}
          >
            <LayoutGrid className="h-3.5 w-3.5 text-indigo-400" />
            <span>Auto-Frame Slides</span>
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent text-foreground transition"
            onClick={() => {
              setMenuOpen(false);
              fileRef.current?.click();
            }}
          >
            <Upload className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Import Image</span>
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent text-foreground transition"
            onClick={() => {
              setMenuOpen(false);
              exportPNG();
            }}
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Export PNG</span>
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent text-foreground transition"
            onClick={() => {
              setMenuOpen(false);
              exportPDF();
            }}
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Export PDF</span>
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent text-foreground transition"
            onClick={async () => {
              setMenuOpen(false);
              toast.info("Syncing whiteboard with Supabase cloud...");
              await syncWithCloud();
              toast.success("Whiteboard synced with Supabase cloud");
            }}
          >
            <Cloud className="h-3.5 w-3.5 text-blue-500" />
            <span>Sync with Cloud</span>
          </button>
        </PopoverContent>
      </Popover>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => importFile(e.target.files)}
      />

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-sm font-semibold flex items-center justify-center gap-1.5">
              <Cloud className="h-4 w-4 text-emerald-500" />
              Scan to open board
            </DialogTitle>
          </DialogHeader>
          {qrData && (
            <div className="flex flex-col items-center gap-3 pt-2">
              <div className="rounded-xl border bg-white p-2 shadow-sm">
                <img
                  src={qrData}
                  alt="QR code"
                  className="rounded-lg max-w-[210px] w-full aspect-square"
                />
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                Scan with any phone or camera to open this live board. Synced to Supabase Cloud.
              </p>
              {qrUrl && (
                <div className="flex items-center gap-2 w-full pt-1">
                  <input
                    readOnly
                    value={qrUrl}
                    className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border bg-muted/40 font-mono text-muted-foreground truncate select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(qrUrl);
                      toast.success("Board link copied!");
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition shrink-0"
                  >
                    Copy
                  </button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Explain This Board Dialog */}
      <Dialog open={explainDialogOpen} onOpenChange={setExplainDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ScanEye className="h-5 w-5 text-amber-500" />
              AI Visual Board Explanation
            </DialogTitle>
            <DialogDescription>
              Multimodal vision analysis of all strokes, geometric diagrams, equations, and elements on canvas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {explainSnapshot && (
              <div className="rounded-xl border overflow-hidden max-h-48 bg-muted/20 flex items-center justify-center p-2">
                <img
                  src={explainSnapshot}
                  alt="Board snapshot"
                  className="max-h-44 object-contain rounded shadow-2xs"
                />
              </div>
            )}

            {explainLoading ? (
              <div className="flex flex-col items-center justify-center p-8 space-y-2">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-xs text-muted-foreground font-medium">
                  Analyzing visual strokes, layout, and concepts...
                </p>
              </div>
            ) : explainData ? (
              <div className="space-y-3 animate-in fade-in">
                <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Overview</h4>
                  <p className="text-xs text-foreground mt-1 leading-relaxed">{explainData.summary}</p>
                </div>

                {explainData.breakdown.length > 0 && (
                  <div className="p-3.5 rounded-xl border bg-card space-y-1.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Key Concepts Illustrated
                    </h4>
                    <ul className="space-y-1">
                      {explainData.breakdown.map((item, idx) => (
                        <li key={idx} className="text-xs text-foreground/90 flex items-start gap-1.5">
                          <span className="text-primary font-bold">•</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {explainData.recommendations.length > 0 && (
                  <div className="p-3.5 rounded-xl border bg-card space-y-1.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Recommended Next Actions
                    </h4>
                    <ul className="space-y-1">
                      {explainData.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-xs text-foreground/90 flex items-start gap-1.5">
                          <span className="text-emerald-500 font-bold">✓</span> {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Settings Dialog */}
      <AISettingsDialog open={aiSettingsOpen} onOpenChange={setAiSettingsOpen} />

      {/* PDF & Document Intelligence Dialog */}
      <DocumentViewerDialog
        open={docViewerOpen}
        onOpenChange={setDocViewerOpen}
        boardId={page.id}
      />

      {/* Math Formula Dialog */}
      <MathFormulaDialog
        open={mathFormulaOpen}
        onOpenChange={setMathFormulaOpen}
      />

      {/* Feature Guide & Tutorial Tour */}
      <FeatureTourDialog
        open={tourOpen}
        onOpenChange={setTourOpen}
      />
    </div>
  );
}
