import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  PenTool,
  Shapes,
  Sparkles,
  Package,
  FileText,
  MousePointer2,
  BrainCircuit,
  GraduationCap,
  Layers,
  CheckCircle2,
  ChevronRight,
  Palette,
  BookOpen,
  MonitorPlay,
  Compass,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TourCategory {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  features: {
    name: string;
    description: string;
    badge?: string;
  }[];
}

const TOUR_CATEGORIES: TourCategory[] = [
  {
    id: "pens",
    title: "12 Expressive Ink Styles",
    subtitle: "Tactile handwriting & drawing brushes tailored for notes and art.",
    icon: PenTool,
    color: "text-blue-500",
    bgColor: "bg-blue-500/15",
    features: [
      {
        name: "Fine Pen & Calligraphy",
        description: "Velocity-responsive ink stroke with tapered tips for neat note-taking and headings.",
        badge: "Writing",
      },
      {
        name: "Watercolor Brush & Chisel Marker",
        description: "Layered blending and chisel angles for high-impact highlighting and sketches.",
        badge: "Art",
      },
      {
        name: "Neon Glow, Rainbow & Glitter",
        description: "Electrifying glowing strokes, multi-hue gradient inks, and sparkling particle lines.",
        badge: "Creative",
      },
      {
        name: "Classic Blackboard & Neon Chalk",
        description: "Switch to authentic chalkboard green or pitch-black OLED with luminous neon chalk palettes.",
        badge: "Blackboard",
      },
      {
        name: "Dashed, Dotted & Dual Ribbon",
        description: "Geometric diagramming lines and parallel ribbon tracks for architectural planning.",
        badge: "Technical",
      },
    ],
  },
  {
    id: "shapes",
    title: "Shapes & Smart Snap",
    subtitle: "Intelligent geometry recognition and 3D architectural solids.",
    icon: Shapes,
    color: "text-purple-500",
    bgColor: "bg-purple-500/15",
    features: [
      {
        name: "Smart Hold-to-Snap",
        description: "Draw any freehand circle, triangle, or rectangle—hold your pen still at the end and it instantly straightens!",
        badge: "Smart AI",
      },
      {
        name: "2D Polygon Library",
        description: "Insert 30+ clean geometric shapes including speech bubbles, stars, banners, and arrows.",
        badge: "2D",
      },
      {
        name: "3D Geometric Solids",
        description: "Drop isometric cubes, cylinders, cones, pyramids, and 3D coordinate axes onto your board.",
        badge: "3D",
      },
    ],
  },
  {
    id: "widgets",
    title: "Interactive Widgets",
    subtitle: "Floating utilities and classroom tools for engagement.",
    icon: Package,
    color: "text-amber-500",
    bgColor: "bg-amber-500/15",
    features: [
      {
        name: "Timer & Stopwatch",
        description: "Countdown timers with audio chimes and lap stopwatches for timed student activities.",
        badge: "Classroom",
      },
      {
        name: "Periodic Table & Flashcards",
        description: "Interactive chemistry elements directory and 3D study quiz flashcards with 1-click board insertion.",
        badge: "Science & Quiz",
      },
      {
        name: "Dice & Scoreboard",
        description: "Roll 3D dice for probability games and track live points between competing teams.",
        badge: "Games",
      },
      {
        name: "Calculator & MathPad 2D",
        description: "Floating pocket scientific calculator and interactive 2D function curve plotting.",
        badge: "STEM",
      },
      {
        name: "Sticky Notes, Tables & Ruler",
        description: "Pin colorful memos, build custom data grid tables, and measure with on-screen rulers.",
        badge: "Productivity",
      },
    ],
  },
  {
    id: "ai",
    title: "AI Teaching Assistant",
    subtitle: "On-demand tutoring, handwriting math solver, and mind mapping.",
    icon: Sparkles,
    color: "text-rose-500",
    bgColor: "bg-rose-500/15",
    features: [
      {
        name: "Solve Written Math",
        description: "Handwrite any algebraic equation on the board, click Solve Math, and AI computes step-by-step solutions.",
        badge: "Vision AI",
      },
      {
        name: "Explain Board Overview",
        description: "AI analyzes everything drawn and written on your current canvas and provides a structured lesson summary.",
        badge: "Analysis",
      },
      {
        name: "Generate AI Mind-Map",
        description: "Automatically converts topics and board notes into branching, color-coded node diagrams.",
        badge: "Generative",
      },
      {
        name: "Ask AI Assistant",
        description: "Chat with an AI tutor that has full context of your whiteboard strokes and active notes.",
        badge: "Chat",
      },
    ],
  },
  {
    id: "study",
    title: "Notes & Learning Hub",
    subtitle: "Structured knowledge management and spaced repetition.",
    icon: GraduationCap,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/15",
    features: [
      {
        name: "AI Block Notes",
        description: "Organized markdown notes with AI summarization, semantic tagging, and quick conversion to whiteboard boards.",
        badge: "Notes",
      },
      {
        name: "Learning Hub Flashcards",
        description: "Interactive flashcard decks with smart flip reviews, retention tracking, and practice quizzes.",
        badge: "Study",
      },
      {
        name: "Document & PDF Intelligence",
        description: "Import textbooks and lecture PDFs, highlight key excerpts, and study side-by-side with your canvas.",
        badge: "PDF",
      },
    ],
  },
  {
    id: "presentation",
    title: "Presentation & Radar Minimap",
    subtitle: "Dynamic keynote slide delivery and real-time spatial navigation.",
    icon: MonitorPlay,
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/15",
    features: [
      {
        name: "Lecture Presentation (Slides Mode)",
        description: "Deliver whiteboard content like dynamic slides with smooth camera panning, slide drawer, and fullscreen mode.",
        badge: "Presentation",
      },
      {
        name: "Live Laser Pointer & Annotations",
        description: "Spotlight important formulas and live-draw notes during your presentation without leaving slide mode.",
        badge: "Lectures",
      },
      {
        name: "Auto-Frame Slides from Content",
        description: "1-click auto detection groups your whiteboard clusters and handwritten notes into sequential 16:9 slides.",
        badge: "Smart Frames",
      },
      {
        name: "Interactive Radar Minimap",
        description: "Collapsible bird's-eye radar view showing live strokes and objects. Click or drag the viewport rectangle to navigate instantly.",
        badge: "Spatial Radar",
      },
    ],
  },
];

export function FeatureTourDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedCatId, setSelectedCatId] = useState<string>("pens");

  const currentCat = TOUR_CATEGORIES.find((c) => c.id === selectedCatId) ?? TOUR_CATEGORIES[0];
  const Icon = currentCat.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl border border-border bg-card">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <BookOpen className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight">
                Slate Feature Guide & Tutorial
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
                Everything you need to know about your smart whiteboard, inks, widgets, and AI tutor.
              </DialogDescription>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="mt-3.5 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {TOUR_CATEGORIES.map((cat) => {
              const CatIcon = cat.icon;
              const isSelected = cat.id === selectedCatId;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatId(cat.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium shrink-0 transition active:scale-95",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                      : "bg-background text-muted-foreground hover:text-foreground border border-border/60",
                  )}
                >
                  <CatIcon className="h-3.5 w-3.5" />
                  <span>{cat.title.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain">
          {/* Active Category Header */}
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-muted/20">
            <span className={cn("grid h-10 w-10 place-items-center rounded-xl shrink-0", currentCat.bgColor, currentCat.color)}>
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                {currentCat.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {currentCat.subtitle}
              </p>
            </div>
          </div>

          {/* Feature List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {currentCat.features.map((feat, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-xl border border-border bg-background p-3.5 shadow-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    {feat.name}
                  </span>
                  {feat.badge && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary">
                      {feat.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {feat.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:px-5 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span>Ready for touch, stylus, and desktop.</span>
          </div>

          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="px-5 text-xs font-semibold h-8"
          >
            Got it, Let&apos;s Draw!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
