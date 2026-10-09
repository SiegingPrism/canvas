import { useState, useEffect, useRef } from "react";
import { useWhiteboard } from "@/lib/whiteboard/store";
import type { ToolId, ShapeType } from "@/lib/whiteboard/types";
import {
  MousePointer2,
  LassoSelect,
  Hand,
  Pen,
  PenTool,
  Flame,
  Paintbrush,
  Highlighter,
  Sparkles,
  Minus,
  Shapes,
  Eraser,
  Trash2,
  Type,
  Palette,
  Check,
  Square,
  Circle,
  Triangle,
  Diamond,
  Star,
  Hexagon,
  Pentagon,
  Octagon,
  Heart,
  Cloud,
  MessageSquare,
  MessageCircle,
  Plus,
  ArrowRight,
  MoveHorizontal,
  Box,
  Package,
  Cylinder,
  Disc,
  Cone,
  Pyramid,
  Layers,
  Columns3,
  CircleDot,
  Pill,
  Axis3d,
  Brush,
  PenLine,
  Pencil,
  Moon,
  Zap,
  Cog,
  Shield,
  Bookmark,
  CornerDownRight,
  Code2,
  Gem,
  Activity,
  EyeOff,
  MonitorPlay,
  Sigma,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SwipeConfirmDialog } from "./SwipeConfirmDialog";
import { MathFormulaDialog } from "./MathFormulaDialog";

const SHAPES_2D = [
  { id: "rect", label: "Rectangle", icon: Square },
  { id: "circle", label: "Circle", icon: Circle },
  { id: "ellipse", label: "Ellipse", icon: Disc },
  { id: "triangle", label: "Triangle", icon: Triangle },
  { id: "right-triangle", label: "Right △", icon: Triangle },
  { id: "diamond", label: "Diamond", icon: Diamond },
  { id: "star", label: "Star", icon: Star },
  { id: "pentagon", label: "Pentagon", icon: Pentagon },
  { id: "hexagon", label: "Hexagon", icon: Hexagon },
  { id: "heptagon", label: "Heptagon", icon: Hexagon },
  { id: "octagon", label: "Octagon", icon: Octagon },
  { id: "decagon", label: "Decagon", icon: CircleDot },
  { id: "heart", label: "Heart", icon: Heart },
  { id: "cloud", label: "Cloud", icon: Cloud },
  { id: "crescent", label: "Crescent", icon: Moon },
  { id: "ring", label: "Ring Donut", icon: CircleDot },
  { id: "shield", label: "Shield Badge", icon: Shield },
  { id: "banner", label: "Banner", icon: Bookmark },
  { id: "speech-bubble", label: "Speech Bubble", icon: MessageSquare },
  { id: "thought-bubble", label: "Thought Bubble", icon: MessageCircle },
  { id: "parallelogram", label: "Parallelogram", icon: Square },
  { id: "trapezoid", label: "Trapezoid", icon: Square },
  { id: "cross", label: "Cross", icon: Plus },
  { id: "lightning", label: "Lightning", icon: Zap },
  { id: "gear", label: "Gear Cog", icon: Cog },
  { id: "bracket", label: "Curly Brace", icon: Code2 },
  { id: "line", label: "Line", icon: Minus },
  { id: "arrow", label: "Arrow", icon: ArrowRight },
  { id: "double-arrow", label: "Double Arrow", icon: MoveHorizontal },
  { id: "curved-arrow", label: "Curved Arrow", icon: CornerDownRight },
] as const;

const DIAGRAMS_3D = [
  { id: "cube", label: "Cube", icon: Box },
  { id: "cuboid", label: "Cuboid", icon: Package },
  { id: "cylinder", label: "Cylinder", icon: Cylinder },
  { id: "sphere", label: "Sphere", icon: Circle },
  { id: "hemisphere", label: "Hemisphere", icon: Disc },
  { id: "cone", label: "Cone", icon: Cone },
  { id: "frustum", label: "Frustum", icon: Cone },
  { id: "pyramid", label: "Pyramid", icon: Pyramid },
  { id: "truncated-pyramid", label: "Trunc. Pyramid", icon: Layers },
  { id: "tetrahedron", label: "Tetrahedron", icon: Shapes },
  { id: "octahedron", label: "Octahedron", icon: Diamond },
  { id: "dodecahedron", label: "Dodecahedron", icon: Hexagon },
  { id: "prism", label: "Prism", icon: Layers },
  { id: "hex-prism", label: "Hex Prism", icon: Columns3 },
  { id: "pipe", label: "Hollow Pipe", icon: CircleDot },
  { id: "wedge", label: "3D Wedge", icon: Triangle },
  { id: "gem", label: "Brilliant Gem", icon: Gem },
  { id: "torus", label: "Torus Ring", icon: CircleDot },
  { id: "capsule", label: "Capsule", icon: Pill },
  { id: "helix", label: "3D Helix", icon: Activity },
  { id: "axes3d", label: "3D Axes", icon: Axis3d },
] as const;

function DottedLineIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="4" cy="12" r="2.2" />
      <circle cx="10" cy="12" r="2.2" />
      <circle cx="16" cy="12" r="2.2" />
      <circle cx="22" cy="12" r="2.2" />
    </svg>
  );
}

const PEN_STYLES: {
  id: ToolId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "pen", label: "Fine Pen", icon: Pen },
  { id: "fountain", label: "Calligraphy", icon: PenTool },
  { id: "brush", label: "Watercolor", icon: Brush },
  { id: "marker", label: "Chisel Marker", icon: PenLine },
  { id: "pencil", label: "Pencil", icon: Pencil },
  { id: "neon", label: "Neon Glow", icon: Flame },
  { id: "crayon", label: "Chalk Crayon", icon: Paintbrush },
  { id: "glitter", label: "Glitter & Shine", icon: Sparkles },
  { id: "rainbow", label: "Rainbow Ink", icon: Sparkles },
  { id: "dashed", label: "Dashed Line", icon: Minus },
  { id: "dotted", label: "Dotted Line", icon: DottedLineIcon },
  { id: "parallel", label: "Dual Ribbon", icon: MoveHorizontal },
  { id: "tape", label: "Study Tape", icon: EyeOff },
  { id: "frame", label: "Slide Frame", icon: MonitorPlay },
];

const COLOR_CATEGORIES = {
  vivid: [
    "#000000",
    "#334155",
    "#64748b",
    "#ffffff",
    "#ef4444",
    "#dc2626",
    "#f97316",
    "#f59e0b",
    "#eab308",
    "#84cc16",
    "#22c55e",
    "#10b981",
    "#14b8a6",
    "#06b6d4",
    "#0ea5e9",
    "#3b82f6",
    "#6366f1",
    "#8b5cf6",
    "#a855f7",
    "#d946ef",
    "#ec4899",
    "#f43f5e",
    "#78350f",
    "#b45309",
    "#4d7c0f",
  ],
  pastel: [
    "#fee2e2",
    "#ffedd5",
    "#fef3c7",
    "#fef9c3",
    "#ecfccb",
    "#dcfce7",
    "#d1fae5",
    "#ccfbf1",
    "#cffafe",
    "#e0f2fe",
    "#e0e7ff",
    "#ede9fe",
    "#fae8ff",
    "#fce7f3",
    "#ffe4e6",
  ],
  earthy: [
    "#09090b",
    "#1c1917",
    "#292524",
    "#44403c",
    "#78716c",
    "#451a03",
    "#78350f",
    "#9a3412",
    "#7c2d12",
    "#713f12",
    "#365314",
    "#14532d",
    "#064e3b",
    "#164e63",
    "#1e3a8a",
    "#312e81",
    "#581c87",
    "#701a75",
    "#831843",
    "#881337",
  ],
  chalk: [
    "#ffffff",
    "#fef08a",
    "#67e8f9",
    "#86efac",
    "#fda4af",
    "#c4b5fd",
    "#fdba74",
    "#38bdf8",
    "#f43f5e",
    "#a7f3d0",
    "#fde047",
    "#cbd5e1",
  ],
};

const PALETTE = COLOR_CATEGORIES.vivid;

const SIZE_PRESETS = [
  { label: "Fine", val: 2 },
  { label: "Med", val: 5 },
  { label: "Bold", val: 10 },
  { label: "Chisel", val: 18 },
];

export function Toolbar() {
  const {
    tool,
    setTool,
    color,
    setColor,
    size,
    setSize,
    autoSnapEnabled,
    setAutoSnapEnabled,
    camera,
    addObject,
    clearPage,
    eraseStrokes,
    deleteSelected,
    selectedId,
    selectedIds,
    pushHistory,
  } = useWhiteboard();

  const [activeFlyout, setActiveFlyout] = useState<"select" | "pen" | "shapes" | "color" | null>(null);
  const [shapesTab, setShapesTab] = useState<"2d" | "3d">("2d");
  const [eraseDialogOpen, setEraseDialogOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [mathDialogOpen, setMathDialogOpen] = useState(false);
  const [colorCategory, setColorCategory] = useState<"vivid" | "chalk" | "pastel" | "earthy">("vivid");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const lastEraserPressRef = useRef(0);
  const lastBinPressRef = useRef(0);

  const handleEraserClick = () => {
    setActiveFlyout(null);
    const now = Date.now();
    if (now - lastEraserPressRef.current < 500) {
      // Double press!
      setEraseDialogOpen(true);
      lastEraserPressRef.current = 0;
    } else {
      // Single press
      lastEraserPressRef.current = now;
      if (tool === "eraser-pixel") {
        setTool("eraser-object");
      } else {
        setTool("eraser-pixel");
      }
    }
  };

  const handleBinClick = () => {
    setActiveFlyout(null);
    const now = Date.now();
    if (now - lastBinPressRef.current < 500) {
      // Double press!
      setClearDialogOpen(true);
      lastBinPressRef.current = 0;
    } else {
      // Single press
      lastBinPressRef.current = now;
      if (selectedId || selectedIds.length > 0) {
        deleteSelected();
        pushHistory();
        toast.success("Deleted selection");
      } else {
        toast.info("Double-press bin to clear the board", { duration: 2000 });
      }
    }
  };

  const insertShape = (shapeType: ShapeType) => {
    const isLineLike =
      shapeType === "line" ||
      shapeType === "arrow" ||
      shapeType === "double-arrow" ||
      shapeType === "curved-arrow";
    const w = isLineLike
      ? 180
      : shapeType === "cuboid" || shapeType === "banner"
        ? 170
        : shapeType === "speech-bubble" || shapeType === "thought-bubble"
          ? 180
          : 150;
    const h = isLineLike
      ? 60
      : shapeType === "axes3d"
        ? 180
        : shapeType === "cuboid"
          ? 130
          : shapeType === "speech-bubble" || shapeType === "thought-bubble"
            ? 130
            : 150;
    const cx = (-camera.x + window.innerWidth / 2) / camera.zoom;
    const cy = (-camera.y + window.innerHeight / 2) / camera.zoom;
    addObject({
      id: Math.random().toString(36).slice(2, 10),
      kind: "shape",
      shape: shapeType,
      color,
      size: Math.max(2, size),
      x: Math.round(cx - w / 2),
      y: Math.round(cy - h / 2),
      w,
      h,
    });
    pushHistory();
    setActiveFlyout(null);
  };

  // Active pen icon
  const activePenStyle = PEN_STYLES.find((p) => p.id === tool) ?? PEN_STYLES[0];
  const ActivePenIcon = activePenStyle.icon;
  const isPenToolActive = PEN_STYLES.some((p) => p.id === tool);
  const isSelectActive = tool === "select" || tool === "lasso";

  const btnClass = (active: boolean) =>
    cn(
      "relative grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full transition active:scale-90 shrink-0",
      active
        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md"
        : "text-foreground/80 hover:bg-accent/80",
    );

  return (
    <>
      <div className="relative flex flex-col items-center">
      {/* Backdrop for active flyout to close on tap outside */}
      {activeFlyout && (
        <div
          className="fixed inset-0 z-40 bg-black/10 pointer-events-auto"
          onPointerDown={(e) => {
            e.stopPropagation();
            setActiveFlyout(null);
          }}
          onClick={() => setActiveFlyout(null)}
        />
      )}

      {/* Flyout 1: Select / Lasso */}
      {activeFlyout === "select" && (
        <div
          className="pointer-events-auto absolute bottom-full mb-3 w-44 p-1.5 space-y-0.5 shadow-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 select-none z-50"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              setTool("select");
              setActiveFlyout(null);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
              tool === "select"
                ? "bg-slate-100 dark:bg-slate-800 text-foreground font-semibold"
                : "hover:bg-slate-50 dark:hover:bg-slate-800/60 text-muted-foreground",
            )}
          >
            <MousePointer2 className="h-3.5 w-3.5" />
            <span>Pointer</span>
            {tool === "select" && <Check className="ml-auto h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setTool("lasso");
              setActiveFlyout(null);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
              tool === "lasso"
                ? "bg-slate-100 dark:bg-slate-800 text-foreground font-semibold"
                : "hover:bg-slate-50 dark:hover:bg-slate-800/60 text-muted-foreground",
            )}
          >
            <LassoSelect className="h-3.5 w-3.5" />
            <span>Freehand Lasso</span>
            {tool === "lasso" && <Check className="ml-auto h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {/* Flyout 2: Pen Styles */}
      {activeFlyout === "pen" && (
        <div
          className="pointer-events-auto absolute bottom-full mb-3 w-[356px] max-w-[calc(100vw-24px)] p-3 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 select-none z-50"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
            <span>Pen Styles ({PEN_STYLES.length})</span>
            <span className="text-[10px] lowercase font-normal text-slate-400 dark:text-slate-500">
              tap to select
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            {PEN_STYLES.map((p) => {
              const Icon = p.icon;
              const active = tool === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  title={p.label}
                  onClick={() => {
                    setTool(p.id);
                    setActiveFlyout(null);
                  }}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium active:opacity-80 text-left min-w-0 border",
                    active
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold border-slate-900 dark:border-white"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-lg shrink-0",
                      active
                        ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                        : "bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-600",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate text-xs font-medium leading-none whitespace-nowrap text-inherit flex-1 min-w-0">
                    {p.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Flyout 3: Shapes & 3D */}
      {activeFlyout === "shapes" && (
        <div
          className="pointer-events-auto absolute bottom-full mb-3 w-[360px] max-w-[calc(100vw-24px)] p-3 shadow-2xl space-y-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 select-none z-50"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-border">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setShapesTab("2d")}
                className={cn(
                  "px-2.5 py-1 rounded-md transition text-xs",
                  shapesTab === "2d"
                    ? "bg-white dark:bg-slate-900 text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                2D Shapes ({SHAPES_2D.length})
              </button>
              <button
                type="button"
                onClick={() => setShapesTab("3d")}
                className={cn(
                  "px-2.5 py-1 rounded-md transition text-xs",
                  shapesTab === "3d"
                    ? "bg-white dark:bg-slate-900 text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                3D Solids ({DIAGRAMS_3D.length})
              </button>
            </div>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              Tap to insert
            </span>
          </div>

          <div className="max-h-68 overflow-y-auto overscroll-contain pr-1">
            {shapesTab === "2d" ? (
              <div className="grid grid-cols-4 gap-1.5">
                {SHAPES_2D.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        insertShape(s.id as ShapeType);
                        setActiveFlyout(null);
                      }}
                      className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-border transition group active:scale-95"
                      title={s.label}
                    >
                      <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition" />
                      <span className="text-[10px] text-muted-foreground group-hover:text-foreground truncate w-full text-center">
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {DIAGRAMS_3D.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        insertShape(s.id as ShapeType);
                        setActiveFlyout(null);
                      }}
                      className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-border transition group active:scale-95"
                      title={s.label}
                    >
                      <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition" />
                      <span className="text-[10px] text-muted-foreground group-hover:text-foreground text-center truncate w-full">
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-2">
            <div className="space-y-0.5">
              <div className="text-xs font-medium">Smart Auto-Snap</div>
              <div className="text-[10px] text-muted-foreground">
                Recognizes & snaps drawn shapes
              </div>
            </div>
            <Switch
              checked={autoSnapEnabled}
              onCheckedChange={(checked) => setAutoSnapEnabled(checked)}
            />
          </div>
        </div>
      )}

      {/* Flyout 4: Color & Stroke Size */}
      {activeFlyout === "color" && (
        <div
          className="pointer-events-auto absolute bottom-full mb-3 w-72 max-w-[calc(100vw-24px)] space-y-3 p-3 shadow-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 select-none z-50"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5" /> Color
              </span>
              <div className="flex rounded-lg bg-muted p-0.5 text-[10px] font-medium">
                {(["vivid", "chalk", "pastel", "earthy"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setColorCategory(cat)}
                    className={cn(
                      "px-1.5 py-0.5 rounded capitalize transition",
                      colorCategory === cat
                        ? "bg-background text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-5 gap-1.5 max-h-36 overflow-y-auto pr-0.5">
              {COLOR_CATEGORIES[colorCategory].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-8 w-8 rounded-full ring-2 transition flex items-center justify-center shadow-sm active:scale-95",
                    color.toLowerCase() === c.toLowerCase()
                      ? "ring-primary scale-105"
                      : "ring-border",
                  )}
                  style={{ backgroundColor: c }}
                >
                  {color.toLowerCase() === c.toLowerCase() && (
                    <Check
                      className={cn(
                        "h-3.5 w-3.5",
                        c === "#ffffff" ||
                          c.startsWith("#fe") ||
                          c.startsWith("#ff") ||
                          c.startsWith("#ec") ||
                          c.startsWith("#dc") ||
                          c.startsWith("#d1") ||
                          c.startsWith("#cc") ||
                          c.startsWith("#cf") ||
                          c.startsWith("#e0") ||
                          c.startsWith("#ed") ||
                          c.startsWith("#fa")
                          ? "text-slate-900"
                          : "text-white",
                      )}
                    />
                  )}
                </button>
              ))}
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
              />
              <span className="text-[11px] text-muted-foreground font-mono">
                {color.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 border-t border-border pt-2.5">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Stroke Size</span>
              <span className="font-semibold text-foreground">{size}px</span>
            </div>
            <div className="flex gap-1 pb-1">
              {SIZE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setSize(p.val)}
                  className={cn(
                    "flex-1 py-1 rounded text-[11px] font-medium border transition",
                    size === p.val
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Slider
              value={[size]}
              min={1}
              max={36}
              step={1}
              onValueChange={(v) => setSize(v[0])}
            />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-2.5">
            <div className="space-y-0.5">
              <div className="text-xs font-medium">Smart Hold-to-Snap</div>
              <div className="text-[10px] text-muted-foreground">
                Auto-straightens lines & shapes
              </div>
            </div>
            <Switch
              checked={autoSnapEnabled}
              onCheckedChange={(checked) => setAutoSnapEnabled(checked)}
            />
          </div>
        </div>
      )}

      {/* Main Scrollable Toolbar Bar */}
      <div className="pointer-events-auto relative flex items-center gap-1 sm:gap-1.5 rounded-full bg-white dark:bg-slate-900 px-2.5 py-1.5 shadow-lg ring-1 ring-border max-w-[calc(100vw-16px)] overflow-x-auto scrollbar-none touch-pan-x shrink-0">
        {/* 1. Select / Lasso Menu */}
        <button
          type="button"
          onClick={() => {
            if (!isSelectActive) setTool("select");
            setActiveFlyout(activeFlyout === "select" ? null : "select");
          }}
          className={btnClass(isSelectActive)}
          title={tool === "lasso" ? "Lasso Select" : "Object Select"}
        >
          {tool === "lasso" ? (
            <LassoSelect className="h-4 w-4" />
          ) : (
            <MousePointer2 className="h-4 w-4" />
          )}
        </button>

        {/* 2. Pan / Hand */}
        <button
          type="button"
          onClick={() => {
            setTool("pan");
            setActiveFlyout(null);
          }}
          className={btnClass(tool === "pan")}
          title="Move & Pan Canvas"
        >
          <Hand className="h-4 w-4" />
        </button>

        {/* 3. Pen Button & Flyout */}
        <button
          type="button"
          onClick={() => {
            if (!isPenToolActive) setTool(activePenStyle.id);
            setActiveFlyout(activeFlyout === "pen" ? null : "pen");
          }}
          className={btnClass(isPenToolActive)}
          title={activePenStyle.label}
        >
          <ActivePenIcon className="h-4 w-4" />
        </button>

        {/* 4. Highlighter */}
        <button
          type="button"
          onClick={() => {
            setTool("highlighter");
            setActiveFlyout(null);
          }}
          className={btnClass(tool === "highlighter")}
          title="Highlighter"
        >
          <Highlighter className="h-4 w-4" />
        </button>

        {/* 5. Eraser (Pixel vs Object Toggle, Double-tap to swipe erase board) */}
        <button
          type="button"
          onClick={handleEraserClick}
          onDoubleClick={() => setEraseDialogOpen(true)}
          className={btnClass(tool === "eraser-pixel" || tool === "eraser-object")}
          title={
            tool === "eraser-object"
              ? "Object Eraser (Double-tap to erase board)"
              : "Pixel Eraser (Double-tap to erase board)"
          }
        >
          <Eraser className="h-4 w-4" />
        </button>

        {/* 6. Bin / Trash (Single tap: delete selection; Double tap: Swipe to clear board) */}
        <button
          type="button"
          onClick={handleBinClick}
          onDoubleClick={() => setClearDialogOpen(true)}
          className={btnClass(false)}
          title="Bin (Double-tap to clear board)"
        >
          <Trash2 className="h-4 w-4 hover:text-rose-500 transition-colors" />
        </button>

        {/* 7. Shape & 3D Diagrams Button & Flyout */}
        <button
          type="button"
          onClick={() => {
            setTool("shape");
            setActiveFlyout(activeFlyout === "shapes" ? null : "shapes");
          }}
          className={btnClass(tool === "shape")}
          title="Shapes & 3D Diagrams"
        >
          <Shapes className="h-4 w-4" />
        </button>

        {/* 8. Text Note */}
        <button
          type="button"
          onClick={() => {
            setTool("text");
            setActiveFlyout(null);
          }}
          className={btnClass(tool === "text")}
          title="Text Box"
        >
          <Type className="h-4 w-4" />
        </button>

        {/* 9. Math Formula (LaTeX) */}
        <button
          type="button"
          onClick={() => {
            setMathDialogOpen(true);
            setActiveFlyout(null);
          }}
          className={btnClass(false)}
          title="Insert Math Formula & Equation (LaTeX)"
        >
          <Sigma className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        </button>

        {/* 10. Solve Written Math (Handwriting -> Answer) */}
        <button
          type="button"
          onClick={() => {
            setActiveFlyout(null);
            window.dispatchEvent(new CustomEvent("slate:solve-math"));
          }}
          className={btnClass(false)}
          title="Solve Written Math on Board (Calculates handwriting & inserts answer directly)"
        >
          <Sparkles className="h-4 w-4 text-amber-500 hover:text-amber-600 transition-colors" />
        </button>

        {/* 11. Widgets & Classroom Tools */}
        <button
          type="button"
          onClick={() => {
            setActiveFlyout(null);
            window.dispatchEvent(new CustomEvent("slate:open-widgets"));
          }}
          className={btnClass(false)}
          title="Widgets, Periodic Table & Classroom Tools"
        >
          <Package className="h-4 w-4 text-teal-600 dark:text-teal-400" />
        </button>

        <div className="h-4 w-px bg-border/60 mx-1 shrink-0" />

        {/* 11. Color Dot & Thickness Slider */}
        <button
          type="button"
          onClick={() => setActiveFlyout(activeFlyout === "color" ? null : "color")}
          className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full hover:bg-accent/80 transition active:scale-95 shrink-0"
          title="Color & Nib Size"
        >
          <span
            className="h-5 w-5 rounded-full ring-2 ring-border shadow-inner"
            style={{ backgroundColor: color }}
          />
        </button>
      </div>
    </div>

      {/* Swipe to Erase Dialog */}
      <SwipeConfirmDialog
        open={eraseDialogOpen}
        onOpenChange={setEraseDialogOpen}
        title="swipe to erase the board"
        description="This will erase all drawn strokes and handwriting from this board."
        variant="erase"
        onConfirm={() => {
          eraseStrokes();
          pushHistory();
          toast.success("Board erased");
        }}
      />

      {/* Swipe to Clear Dialog */}
      <SwipeConfirmDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        title="Swipe to clear the board"
        description="This will permanently clear all objects, drawings, and notes from this page."
        variant="clear"
        onConfirm={() => {
          clearPage();
          pushHistory();
          toast.success("Board cleared");
        }}
      />

      {/* Math Formula Dialog */}
      <MathFormulaDialog
        open={mathDialogOpen}
        onOpenChange={setMathDialogOpen}
      />
    </>
  );
}
