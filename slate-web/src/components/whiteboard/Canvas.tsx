import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useWhiteboard } from "@/lib/whiteboard/store";
import type {
  CanvasObject,
  Point,
  ShapeStroke,
  StrokeBase,
  TextObject,
  StickyNoteObject,
  ImageObject,
  FlashcardObject,
  QuizObject,
  RoadmapObject,
  FormulaObject,
  DiagramNodeObject,
  MindMapNodeObject,
  TapeObject,
  GraphObject,
  FrameObject,
  TableObject,
  PeriodicTableObject,
  PageBackground,
} from "@/lib/whiteboard/types";
import {
  ALL_118_ELEMENTS,
  getElementGridPosition,
  CATEGORY_COLORS,
  type ChemicalElement,
} from "@/lib/whiteboard/periodicTableData";
import { recognizeShape, isPointInPolygon } from "@/lib/whiteboard/shapeRecognition";
import {
  Copy,
  Trash2,
  Palette,
  Move,
  Check,
  Plus,
  Minus,
  RotateCcw,
  Type,
  Sigma,
  Workflow,
  Sparkles,
  Compass,
  Eye,
  EyeOff,
  MonitorPlay,
  ChevronLeft,
  ChevronRight,
  X,
  Maximize2,
  Minimize2,
  PenTool,
  MousePointer2,
  LineChart,
  Layers,
  Calculator,
  Wand2,
  GitBranch,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AIEngine } from "@/lib/ai/aiEngine";
import { compileMathFunction } from "@/lib/whiteboard/safeMath";
import type { MindMapNode } from "@/lib/ai/offlineAssistant";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

type Handle = { type: "move" } | { type: "resize"; corner: "nw" | "ne" | "sw" | "se" };

export function WhiteboardCanvas({
  onOpenAI,
  onPresentationChange,
}: {
  onOpenAI?: (context?: string) => void;
  onPresentationChange?: (presenting: boolean) => void;
} = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const {
    pages,
    activePageId,
    tool,
    setTool,
    color,
    size,
    camera,
    selectedId,
    selectedIds,
    autoSnapEnabled,
    addObject,
    updateObject,
    deleteObject,
    toggleTapeReveal,
    setAllTapeReveal,
    setSelected,
    setSelectedIds,
    moveSelected,
    duplicateSelected,
    deleteSelected,
    recolorSelected,
    setCamera,
    pushHistory,
  } = useWhiteboard();

  const page = pages.find((p) => p.id === activePageId) ||
    pages[0] || { id: "default", objects: [], background: "white" as const };
  const [dpr, setDpr] = useState(1);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  // Keep cameraRef and pageRef synced so event listeners always access latest state without re-binding
  const cameraRef = useRef(camera);
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  const pageRef = useRef(page);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  // Zoom control helpers
  const zoomIn = () => {
    const wrap = wrapRef.current;
    const cx = (wrap ? wrap.clientWidth : window.innerWidth) / 2;
    const cy = (wrap ? wrap.clientHeight : window.innerHeight) / 2;
    const newZoom = Math.min(5, Math.round(camera.zoom * 1.25 * 100) / 100);
    const wx = (cx - camera.x) / camera.zoom;
    const wy = (cy - camera.y) / camera.zoom;
    setCamera({ x: cx - wx * newZoom, y: cy - wy * newZoom, zoom: newZoom });
  };

  const zoomOut = () => {
    const wrap = wrapRef.current;
    const cx = (wrap ? wrap.clientWidth : window.innerWidth) / 2;
    const cy = (wrap ? wrap.clientHeight : window.innerHeight) / 2;
    const newZoom = Math.max(0.15, Math.round((camera.zoom / 1.25) * 100) / 100);
    const wx = (cx - camera.x) / camera.zoom;
    const wy = (cy - camera.y) / camera.zoom;
    setCamera({ x: cx - wx * newZoom, y: cy - wy * newZoom, zoom: newZoom });
  };

  const resetZoom = () => {
    setCamera({ x: 0, y: 0, zoom: 1 });
  };

  // Drawing state
  const drawingRef = useRef<{
    points: Point[];
    color: string;
    startedAt: number;
    lastMoveAt: number;
    holdTimer?: number;
    snappedShape?: Omit<ShapeStroke, "id"> | null;
  } | null>(null);

  const laserRef = useRef<Point[]>([]);
  const panRef = useRef<{ x: number; y: number; cam: typeof camera } | null>(null);
  const dragRef = useRef<{
    id: string;
    handle: Handle;
    start: Point;
    obj: CanvasObject;
  } | null>(null);
  const multiDragRef = useRef<{
    start: Point;
    initialCamera: typeof camera;
  } | null>(null);

  // Lasso polygon
  const lassoRef = useRef<Point[] | null>(null);

  // Touch tracking for pinch-to-zoom & pan
  const touchMapRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const isPenActiveRef = useRef<boolean>(false);
  const wasPinchingRef = useRef<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [editingText, setEditingText] = useState<{ id: string } | null>(null);
  const [editingTextValue, setEditingTextValue] = useState<string>("");
  const [recolorPickerOpen, setRecolorPickerOpen] = useState(false);

  // Focus textarea when text editing starts
  useEffect(() => {
    if (editingText && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editingText]);

  // Spatial Minimap & Radar State
  const [minimapOpen, setMinimapOpen] = useState(false);
  const [minimapExpanded, setMinimapExpanded] = useState(false);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingMinimapRef = useRef(false);

  // Presentation Mode State
  const [isPresenting, setIsPresenting] = useState(false);
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [slidePickerOpen, setSlidePickerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    onPresentationChange?.(isPresenting);
  }, [isPresenting, onPresentationChange]);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const presentationFrames = useMemo(() => {
    return (page.objects.filter((o) => o.kind === "frame") as FrameObject[]).sort(
      (a, b) => a.order - b.order,
    );
  }, [page.objects]);

  const hasTape = useMemo(() => page.objects.some((o) => o.kind === "tape"), [page.objects]);
  const allTapeRevealed = useMemo(
    () => hasTape && page.objects.filter((o) => o.kind === "tape").every((o) => (o as TapeObject).revealed),
    [page.objects, hasTape],
  );

  const fitToContent = useCallback(() => {
    if (!page.objects.length) {
      setCamera({ x: 0, y: 0, zoom: 1 });
      return;
    }
    const boxes = page.objects.map(objectBounds);
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w));
    const maxY = Math.max(...boxes.map((b) => b.y + b.h));
    const contentW = Math.max(100, maxX - minX);
    const contentH = Math.max(100, maxY - minY);

    const wrap = wrapRef.current;
    const screenW = wrap ? wrap.clientWidth : window.innerWidth;
    const screenH = wrap ? wrap.clientHeight : window.innerHeight;

    const pad = 100;
    const scaleX = (screenW - pad * 2) / contentW;
    const scaleY = (screenH - pad * 2) / contentH;
    const targetZoom = Math.max(0.15, Math.min(2.5, Math.min(scaleX, scaleY)));

    const centerX = minX + contentW / 2;
    const centerY = minY + contentH / 2;

    const newX = screenW / 2 - centerX * targetZoom;
    const newY = screenH / 2 - centerY * targetZoom;

    setCamera({ x: newX, y: newY, zoom: Math.round(targetZoom * 100) / 100 });
    toast.success("Fitted all content to view");
  }, [page.objects, setCamera]);

  const autoGenerateSlides = useCallback(() => {
    if (!page.objects.length) {
      toast.error("Board is empty! Add drawings or notes first to create presentation slides.");
      return false;
    }
    const existingFrames = page.objects.filter((o) => o.kind === "frame");
    if (existingFrames.length > 0) {
      return true;
    }

    // Cluster non-frame objects by spatial proximity
    const nonFrames = page.objects.filter((o) => o.kind !== "frame");
    const boxes = nonFrames.map((obj) => ({ obj, ...objectBounds(obj) }));

    const clusters: Array<typeof boxes> = [];
    boxes.forEach((b) => {
      let matched = false;
      for (const cl of clusters) {
        if (
          cl.some((item) => {
            const dx = Math.abs(item.x + item.w / 2 - (b.x + b.w / 2));
            const dy = Math.abs(item.y + item.h / 2 - (b.y + b.h / 2));
            return dx < 550 && dy < 450;
          })
        ) {
          cl.push(b);
          matched = true;
          break;
        }
      }
      if (!matched) clusters.push([b]);
    });

    // Sort clusters from top-to-bottom, left-to-right
    clusters.sort((a, b) => {
      const minYa = Math.min(...a.map((i) => i.y));
      const minYb = Math.min(...b.map((i) => i.y));
      if (Math.abs(minYa - minYb) > 250) return minYa - minYb;
      const minXa = Math.min(...a.map((i) => i.x));
      const minXb = Math.min(...b.map((i) => i.x));
      return minXa - minXb;
    });

    clusters.forEach((cl, idx) => {
      const minX = Math.min(...cl.map((i) => i.x));
      const minY = Math.min(...cl.map((i) => i.y));
      const maxX = Math.max(...cl.map((i) => i.x + i.w));
      const maxY = Math.max(...cl.map((i) => i.y + i.h));

      const pad = 60;
      const rawW = Math.max(540, maxX - minX + pad * 2);
      const rawH = Math.max(340, maxY - minY + pad * 2);
      const slideW = Math.max(rawW, Math.round(rawH * (16 / 9)));
      const slideH = Math.round(slideW * (9 / 16));

      addObject({
        id: uid(),
        kind: "frame",
        x: Math.round(minX - (slideW - (maxX - minX)) / 2),
        y: Math.round(minY - (slideH - (maxY - minY)) / 2),
        w: slideW,
        h: slideH,
        title: `Slide ${idx + 1}`,
        order: idx + 1,
        color: "#6366f1",
      });
    });

    pushHistory();
    toast.success(`Generated ${clusters.length} presentation slides!`);
    return true;
  }, [page.objects, addObject, pushHistory]);

  const captureCurrentViewAsSlide = useCallback(() => {
    const wrap = wrapRef.current;
    const screenW = wrap ? wrap.clientWidth : window.innerWidth;
    const screenH = wrap ? wrap.clientHeight : window.innerHeight;
    const viewWorldX = -camera.x / camera.zoom;
    const viewWorldY = -camera.y / camera.zoom;
    const viewWorldW = screenW / camera.zoom;
    const viewWorldH = screenH / camera.zoom;

    const existingFrames = page.objects.filter((o) => o.kind === "frame");
    const newIdx = existingFrames.length + 1;
    addObject({
      id: uid(),
      kind: "frame",
      x: Math.round(viewWorldX + 24),
      y: Math.round(viewWorldY + 24),
      w: Math.round(viewWorldW - 48),
      h: Math.round(viewWorldH - 48),
      title: `Slide ${newIdx}`,
      order: newIdx,
      color: "#6366f1",
    });
    pushHistory();
    toast.success(`Captured Slide ${newIdx} from current view!`);
  }, [camera, page.objects, addObject, pushHistory]);

  const goToSlide = useCallback(
    (idx: number) => {
      const frames = (page.objects.filter((o) => o.kind === "frame") as FrameObject[]).sort(
        (a, b) => a.order - b.order,
      );
      if (!frames.length) return;
      const safeIdx = Math.max(0, Math.min(frames.length - 1, idx));
      setCurrentSlideIdx(safeIdx);
      const frame = frames[safeIdx];
      if (!frame) return;

      const wrap = wrapRef.current;
      const screenW = wrap ? wrap.clientWidth : window.innerWidth;
      const screenH = wrap ? wrap.clientHeight : window.innerHeight;

      const pad = 60;
      const scaleX = (screenW - pad * 2) / Math.max(100, frame.w);
      const scaleY = (screenH - pad * 2) / Math.max(100, frame.h);
      const targetZoom = Math.max(0.25, Math.min(2.5, Math.min(scaleX, scaleY)));

      const centerX = frame.x + frame.w / 2;
      const centerY = frame.y + frame.h / 2;

      const targetX = screenW / 2 - centerX * targetZoom;
      const targetY = screenH / 2 - centerY * targetZoom;

      const startCam = { ...cameraRef.current };
      const startTime = performance.now();
      const duration = 650;

      function animateCam(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const ease =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        setCamera({
          x: startCam.x + (targetX - startCam.x) * ease,
          y: startCam.y + (targetY - startCam.y) * ease,
          zoom: Math.round((startCam.zoom + (targetZoom - startCam.zoom) * ease) * 100) / 100,
        });

        if (progress < 1) {
          requestAnimationFrame(animateCam);
        }
      }

      requestAnimationFrame(animateCam);
    },
    [page.objects, setCamera],
  );

  const startPresentation = useCallback(() => {
    const frames = (page.objects.filter((o) => o.kind === "frame") as FrameObject[]).sort(
      (a, b) => a.order - b.order,
    );
    if (!frames.length) {
      const generated = autoGenerateSlides();
      if (!generated) return;
    }
    setIsPresenting(true);
    goToSlide(0);
  }, [page.objects, autoGenerateSlides, goToSlide]);

  // Global events for presentation & radar
  useEffect(() => {
    const onStartPres = () => startPresentation();
    const onToggleMinimap = () => setMinimapOpen((prev) => !prev);
    const onAutoFrame = () => autoGenerateSlides();
    const onCaptureSlide = () => captureCurrentViewAsSlide();

    window.addEventListener("slate:start-presentation", onStartPres);
    window.addEventListener("slate:toggle-minimap", onToggleMinimap);
    window.addEventListener("slate:auto-frame-slides", onAutoFrame);
    window.addEventListener("slate:capture-current-slide", onCaptureSlide);

    return () => {
      window.removeEventListener("slate:start-presentation", onStartPres);
      window.removeEventListener("slate:toggle-minimap", onToggleMinimap);
      window.removeEventListener("slate:auto-frame-slides", onAutoFrame);
      window.removeEventListener("slate:capture-current-slide", onCaptureSlide);
    };
  }, [startPresentation, autoGenerateSlides, captureCurrentViewAsSlide]);

  // Keyboard navigation for presentation mode
  useEffect(() => {
    if (!isPresenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsPresenting(false);
      } else if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        goToSlide(currentSlideIdx + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goToSlide(currentSlideIdx - 1);
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPresenting, currentSlideIdx, goToSlide]);

  // Minimap interactive camera updater
  const updateCameraFromMinimapPointer = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = minimapCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = Math.max(0, Math.min(canvas.width, ((clientX - rect.left) / rect.width) * canvas.width));
      const my = Math.max(0, Math.min(canvas.height, ((clientY - rect.top) / rect.height) * canvas.height));

      const boxes = page.objects.map(objectBounds);
      const wrap = wrapRef.current;
      const screenW = wrap ? wrap.clientWidth : window.innerWidth;
      const screenH = wrap ? wrap.clientHeight : window.innerHeight;

      const viewWorldW = screenW / camera.zoom;
      const viewWorldH = screenH / camera.zoom;

      const allMinX = Math.min(-camera.x / camera.zoom, ...boxes.map((b) => b.x), 0);
      const allMinY = Math.min(-camera.y / camera.zoom, ...boxes.map((b) => b.y), 0);
      const allMaxX = Math.max(-camera.x / camera.zoom + viewWorldW, ...boxes.map((b) => b.x + b.w), 1000);
      const allMaxY = Math.max(-camera.y / camera.zoom + viewWorldH, ...boxes.map((b) => b.y + b.h), 800);

      const worldW = Math.max(200, allMaxX - allMinX);
      const worldH = Math.max(200, allMaxY - allMinY);

      const targetWorldX = allMinX + ((mx - 8) / (canvas.width - 16)) * worldW;
      const targetWorldY = allMinY + ((my - 8) / (canvas.height - 16)) * worldH;

      const newX = screenW / 2 - targetWorldX * camera.zoom;
      const newY = screenH / 2 - targetWorldY * camera.zoom;
      setCamera({ x: newX, y: newY, zoom: camera.zoom });
    },
    [page.objects, camera, setCamera],
  );

  const handleMinimapPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
    isDraggingMinimapRef.current = true;
    updateCameraFromMinimapPointer(e.clientX, e.clientY);
  };

  const handleMinimapPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingMinimapRef.current) return;
    updateCameraFromMinimapPointer(e.clientX, e.clientY);
  };

  const handleMinimapPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingMinimapRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  // High-fidelity radar minimap render effect
  useEffect(() => {
    if (!minimapOpen) return;
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mw = canvas.width;
    const mh = canvas.height;
    ctx.clearRect(0, 0, mw, mh);

    // Sleek space radar slate
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, mw, mh);

    // Faint radar concentric range rings & coordinate crosshair
    ctx.strokeStyle = "rgba(56, 189, 248, 0.08)";
    ctx.lineWidth = 1;
    const cx = mw / 2;
    const cy = mh / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(mw, mh) * 0.28, 0, Math.PI * 2);
    ctx.arc(cx, cy, Math.min(mw, mh) * 0.52, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx, mh);
    ctx.moveTo(0, cy); ctx.lineTo(mw, cy);
    ctx.stroke();

    const boxes = page.objects.map(objectBounds);
    const wrap = wrapRef.current;
    const screenW = wrap ? wrap.clientWidth : window.innerWidth;
    const screenH = wrap ? wrap.clientHeight : window.innerHeight;

    const viewWorldX = -camera.x / camera.zoom;
    const viewWorldY = -camera.y / camera.zoom;
    const viewWorldW = screenW / camera.zoom;
    const viewWorldH = screenH / camera.zoom;

    const allMinX = Math.min(viewWorldX, ...boxes.map((b) => b.x), 0);
    const allMinY = Math.min(viewWorldY, ...boxes.map((b) => b.y), 0);
    const allMaxX = Math.max(viewWorldX + viewWorldW, ...boxes.map((b) => b.x + b.w), 1000);
    const allMaxY = Math.max(viewWorldY + viewWorldH, ...boxes.map((b) => b.y + b.h), 800);

    const worldW = Math.max(200, allMaxX - allMinX);
    const worldH = Math.max(200, allMaxY - allMinY);

    const toMx = (x: number) => ((x - allMinX) / worldW) * (mw - 16) + 8;
    const toMy = (y: number) => ((y - allMinY) / worldH) * (mh - 16) + 8;
    const toMw = (w: number) => Math.max(2, (w / worldW) * (mw - 16));
    const toMh = (h: number) => Math.max(2, (h / worldH) * (mh - 16));

    // Render live objects with color-coded paths & shapes
    for (const obj of page.objects) {
      const b = objectBounds(obj);
      if ("points" in obj) {
        const stroke = obj as StrokeBase;
        if (stroke.points && stroke.points.length > 1) {
          ctx.strokeStyle = stroke.color || "#60a5fa";
          ctx.lineWidth = Math.max(1, (stroke.size || 2) * 0.35);
          ctx.beginPath();
          ctx.moveTo(toMx(stroke.points[0].x), toMy(stroke.points[0].y));
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(toMx(stroke.points[i].x), toMy(stroke.points[i].y));
          }
          ctx.stroke();
        }
      } else if (obj.kind === "sticky") {
        ctx.fillStyle = (obj as StickyNoteObject).color || "#fed7aa";
        ctx.fillRect(toMx(b.x), toMy(b.y), toMw(b.w), toMh(b.h));
      } else if (obj.kind === "frame") {
        ctx.strokeStyle = (obj as FrameObject).color || "#6366f1";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        ctx.strokeRect(toMx(b.x), toMy(b.y), toMw(b.w), toMh(b.h));
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(99, 102, 241, 0.25)";
        ctx.fillRect(toMx(b.x), toMy(b.y), toMw(b.w), toMh(b.h));
      } else if (obj.kind === "tape") {
        ctx.fillStyle = "#f59e0b";
        ctx.fillRect(toMx(b.x), toMy(b.y), toMw(b.w), toMh(b.h));
      } else if (obj.kind === "shape") {
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1;
        ctx.strokeRect(toMx(b.x), toMy(b.y), toMw(b.w), toMh(b.h));
      } else {
        ctx.fillStyle = "#64748b";
        ctx.fillRect(toMx(b.x), toMy(b.y), toMw(b.w), toMh(b.h));
      }
    }

    // Viewport camera rectangle with glowing accent
    const vx = toMx(viewWorldX);
    const vy = toMy(viewWorldY);
    const vw = toMw(viewWorldW);
    const vh = toMh(viewWorldH);

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, vy, vw, vh);
    ctx.fillStyle = "rgba(56, 189, 248, 0.18)";
    ctx.fillRect(vx, vy, vw, vh);

    // Corner reticle accents
    const reticle = Math.min(5, vw / 3, vh / 3);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    // top-left
    ctx.beginPath();
    ctx.moveTo(vx, vy + reticle); ctx.lineTo(vx, vy); ctx.lineTo(vx + reticle, vy);
    // top-right
    ctx.moveTo(vx + vw - reticle, vy); ctx.lineTo(vx + vw, vy); ctx.lineTo(vx + vw, vy + reticle);
    // bottom-left
    ctx.moveTo(vx, vy + vh - reticle); ctx.lineTo(vx, vy + vh); ctx.lineTo(vx + reticle, vy + vh);
    // bottom-right
    ctx.moveTo(vx + vw - reticle, vy + vh); ctx.lineTo(vx + vw, vy + vh); ctx.lineTo(vx + vw, vy + vh - reticle);
    ctx.stroke();
  }, [minimapOpen, minimapExpanded, page.objects, camera]);

  // Native touch pinch-to-zoom listener on canvas/wrapper container
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    let startDist = 0;
    let startZoom = 1;
    let startCam = { x: 0, y: 0, zoom: 1 };
    let startCenter = { x: 0, y: 0 };
    let isPinching = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        isPinching = true;
        wasPinchingRef.current = true;
        if (drawingRef.current) {
          if (drawingRef.current.holdTimer) clearTimeout(drawingRef.current.holdTimer);
          drawingRef.current = null;
          clearOverlay();
        }
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        startDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        startZoom = cameraRef.current.zoom;
        startCam = { ...cameraRef.current };
        startCenter = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        if (!isPinching || startDist === 0) {
          isPinching = true;
          wasPinchingRef.current = true;
          if (drawingRef.current) {
            if (drawingRef.current.holdTimer) clearTimeout(drawingRef.current.holdTimer);
            drawingRef.current = null;
            clearOverlay();
          }
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          startDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          startZoom = cameraRef.current.zoom;
          startCam = { ...cameraRef.current };
          startCenter = {
            x: (t1.clientX + t2.clientX) / 2,
            y: (t1.clientY + t2.clientY) / 2,
          };
          return;
        }

        if (e.cancelable) e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const curDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        if (curDist < 4 || startDist < 4) return;
        const curCenter = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
        const scale = curDist / startDist;
        const targetZoom = Math.min(5, Math.max(0.15, startZoom * scale));

        const rect = canvas.getBoundingClientRect();
        const sx = startCenter.x - rect.left;
        const sy = startCenter.y - rect.top;
        const wx = (sx - startCam.x) / startCam.zoom;
        const wy = (sy - startCam.y) / startCam.zoom;

        const curSx = curCenter.x - rect.left;
        const curSy = curCenter.y - rect.top;
        const newX = curSx - wx * targetZoom;
        const newY = curSy - wy * targetZoom;

        setCamera({ x: newX, y: newY, zoom: targetZoom });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        isPinching = false;
        startDist = 0;
        setTimeout(() => {
          wasPinchingRef.current = false;
        }, 250);
      }
    };

    wrap.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);

    return () => {
      wrap.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [setCamera]);

  useEffect(() => {
    setDpr(window.devicePixelRatio || 1);
    const onResize = () => setDpr(window.devicePixelRatio || 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Listen for Solve Written Math event triggered from Toolbar, TopBar or WidgetsSheet
  useEffect(() => {
    const handleSolveEvent = () => {
      handleSolveBoardMath();
    };
    window.addEventListener("slate:solve-math", handleSolveEvent);
    return () => window.removeEventListener("slate:solve-math", handleSolveEvent);
  }, [page, selectedId, selectedIds, camera]);

  // Resize canvas
  useEffect(() => {
    const wrap = wrapRef.current;
    const c = canvasRef.current;
    const o = overlayRef.current;
    if (!wrap || !c || !o) return;
    const updateSize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w === 0 || h === 0) return;
      for (const cv of [c, o]) {
        cv.width = w * dpr;
        cv.height = h * dpr;
        cv.style.width = `${w}px`;
        cv.style.height = `${h}px`;
      }
      redraw();
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dpr]);

  // Redraw when state changes
  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, camera, selectedId, selectedIds, dpr]);

  function toWorld(x: number, y: number): Point {
    return { x: (x - camera.x) / camera.zoom, y: (y - camera.y) / camera.zoom };
  }

  function toScreen(x: number, y: number): Point {
    return { x: x * camera.zoom + camera.x, y: y * camera.zoom + camera.y };
  }

  function isObjectInViewport(
    obj: CanvasObject,
    viewLeft: number,
    viewTop: number,
    viewRight: number,
    viewBottom: number,
  ): boolean {
    if ("points" in obj && Array.isArray(obj.points) && obj.points.length > 0) {
      let minX = obj.points[0].x;
      let maxX = obj.points[0].x;
      let minY = obj.points[0].y;
      let maxY = obj.points[0].y;
      for (let i = 1; i < obj.points.length; i++) {
        const p = obj.points[i];
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      return maxX >= viewLeft && minX <= viewRight && maxY >= viewTop && minY <= viewBottom;
    }

    const o = obj as { x?: number; y?: number; w?: number; h?: number };
    const ox = o.x ?? 0;
    const oy = o.y ?? 0;
    const ow = o.w ?? 24;
    const oh = o.h ?? 24;
    const minX = Math.min(ox, ox + ow);
    const maxX = Math.max(ox, ox + ow);
    const minY = Math.min(oy, oy + oh);
    const maxY = Math.max(oy, oy + oh);

    return maxX >= viewLeft && minX <= viewRight && maxY >= viewTop && minY <= viewBottom;
  }

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.scale(dpr, dpr);

    // Background
    drawBackground(ctx, c.width / dpr, c.height / dpr, page.background);

    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    // World viewport boundaries with safety padding for smooth panning
    const screenW = c.width / dpr;
    const screenH = c.height / dpr;
    const pad = 120 / Math.max(camera.zoom, 0.05);
    const viewLeft = (0 - camera.x) / camera.zoom - pad;
    const viewTop = (0 - camera.y) / camera.zoom - pad;
    const viewRight = (screenW - camera.x) / camera.zoom + pad;
    const viewBottom = (screenH - camera.y) / camera.zoom + pad;

    // Draw objects with high-performance viewport culling
    const selectedSet = new Set(
      selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [],
    );
    for (const obj of page.objects) {
      if (selectedSet.has(obj.id) || isObjectInViewport(obj, viewLeft, viewTop, viewRight, viewBottom)) {
        drawObject(ctx, obj, selectedSet.has(obj.id));
      }
    }
    ctx.restore();

    // Multi-selection bounding box overlay
    if (selectedSet.size > 1) {
      drawMultiSelectionBox(
        ctx,
        page.objects.filter((o) => selectedSet.has(o.id)),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, dpr, page, selectedId, selectedIds]);

  function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, bg: PageBackground) {
    if (bg === "blackboard") {
      // Authentic classroom chalkboard deep green
      ctx.fillStyle = "#1b382b";
      ctx.fillRect(0, 0, w, h);
      // Soft chalk dust micro-particles
      ctx.fillStyle = "rgba(255, 255, 255, 0.025)";
      const step = 44 * camera.zoom;
      const ox = camera.x % step;
      const oy = camera.y % step;
      for (let x = ox; x < w; x += step) {
        for (let y = oy; y < h; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return;
    }

    if (bg === "oled") {
      // True pitch-black OLED background
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, w, h);
      // Ultra-subtle stardust grid
      ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
      const step = 48 * camera.zoom;
      const ox = camera.x % step;
      const oy = camera.y % step;
      for (let x = ox; x < w; x += step) {
        for (let y = oy; y < h; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 1.0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return;
    }

    if (bg === "dark") {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, w, h);
      // Subtle chalkboard dust texture
      ctx.fillStyle = "rgba(255, 255, 255, 0.015)";
      const step = 48 * camera.zoom;
      const ox = camera.x % step;
      const oy = camera.y % step;
      for (let x = ox; x < w; x += step) {
        for (let y = oy; y < h; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    const step = 28 * camera.zoom;

    if (bg === "grid") {
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      const ox = camera.x % step;
      const oy = camera.y % step;
      for (let x = ox; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = oy; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    } else if (bg === "dots") {
      ctx.fillStyle = "#cbd5e1";
      const ox = camera.x % step;
      const oy = camera.y % step;
      for (let x = ox; x < w; x += step) {
        for (let y = oy; y < h; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (bg === "lined") {
      // College ruled notebook lines with soft red margin
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      const lineStep = 32 * camera.zoom;
      const oy = camera.y % lineStep;
      for (let y = oy; y < h; y += lineStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      // Vertical margin line at world x = 80
      const marginX = 80 * camera.zoom + camera.x;
      if (marginX > 0 && marginX < w) {
        ctx.strokeStyle = "#fca5a5";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(marginX, 0);
        ctx.lineTo(marginX, h);
        ctx.stroke();
      }
    } else if (bg === "isometric") {
      // 30-degree isometric drafting grid (crisp, clearly visible #cbd5e1 on light mode, slate-700 on dark)
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      const isoStep = 36 * camera.zoom;
      const tan30 = Math.tan((30 * Math.PI) / 180);
      const ox = camera.x % (isoStep * 2);
      // Vertical lines
      for (let x = ox; x < w; x += isoStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      // Diagonal lines 30 deg up & down
      const diagDist = isoStep / tan30;
      for (let y = -h; y < h * 2; y += diagDist) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y + w * tan30);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y - w * tan30);
        ctx.stroke();
      }
    }
  }

  function drawObject(ctx: CanvasRenderingContext2D, obj: CanvasObject, selected: boolean) {
    ctx.save();
    if (obj.kind === "pen") {
      drawPenStroke(ctx, obj);
    } else if (obj.kind === "fountain") {
      drawFountainStroke(ctx, obj);
    } else if (obj.kind === "neon") {
      drawNeonStroke(ctx, obj);
    } else if (obj.kind === "crayon") {
      drawCrayonStroke(ctx, obj);
    } else if (obj.kind === "highlighter") {
      drawHighlighterStroke(ctx, obj);
    } else if (obj.kind === "rainbow") {
      drawRainbow(ctx, obj);
    } else if (obj.kind === "dashed") {
      ctx.setLineDash([obj.size * 3, obj.size * 3]);
      drawPenStroke(ctx, obj);
    } else if (obj.kind === "brush") {
      drawBrushStroke(ctx, obj);
    } else if (obj.kind === "marker") {
      drawMarkerStroke(ctx, obj);
    } else if (obj.kind === "pencil") {
      drawPencilStroke(ctx, obj);
    } else if (obj.kind === "glitter") {
      drawGlitterStroke(ctx, obj);
    } else if (obj.kind === "dotted") {
      drawDottedStroke(ctx, obj);
    } else if (obj.kind === "parallel") {
      drawParallelStroke(ctx, obj);
    } else if (obj.kind === "shape") {
      drawShape(ctx, obj);
    } else if (obj.kind === "text") {
      drawText(ctx, obj);
    } else if (obj.kind === "sticky") {
      drawSticky(ctx, obj);
    } else if (obj.kind === "image") {
      drawImage(ctx, obj);
    } else if (obj.kind === "flashcard") {
      drawFlashcard(ctx, obj);
    } else if (obj.kind === "quiz") {
      drawQuiz(ctx, obj);
    } else if (obj.kind === "roadmap") {
      drawRoadmap(ctx, obj);
    } else if (obj.kind === "formula") {
      drawFormula(ctx, obj);
    } else if (obj.kind === "diagram-node") {
      drawDiagramNode(ctx, obj);
    } else if (obj.kind === "mindmap-node") {
      drawMindMapNode(ctx, obj);
    } else if (obj.kind === "tape") {
      drawTape(ctx, obj);
    } else if (obj.kind === "graph") {
      drawGraph(ctx, obj);
    } else if (obj.kind === "frame") {
      drawFrame(ctx, obj);
    } else if (obj.kind === "table") {
      drawTable(ctx, obj);
    } else if (obj.kind === "periodic-table") {
      drawPeriodicTable(ctx, obj);
    }
    ctx.restore();

    if (selected && selectedIds.length <= 1) {
      drawSelection(ctx, obj);
    }
  }

  // 1. FINE PEN: Smooth Bezier with pressure sensitivity
  function drawPenStroke(ctx: CanvasRenderingContext2D, s: StrokeBase) {
    const pts = s.points;
    if (pts.length < 2) return;
    ctx.strokeStyle = s.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const pressure = p1.p ?? 0.5;
      const width = Math.max(1, s.size * (0.35 + 0.85 * pressure));
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      if (i < pts.length - 1) {
        const p2 = pts[i + 1];
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
      } else {
        ctx.lineTo(p1.x, p1.y);
      }
      ctx.stroke();
    }
  }

  // 2. FOUNTAIN / CALLIGRAPHY PEN: 45-degree chisel nib dynamics
  function drawFountainStroke(ctx: CanvasRenderingContext2D, s: StrokeBase) {
    const pts = s.points;
    if (pts.length < 2) return;
    ctx.fillStyle = s.color;
    ctx.strokeStyle = s.color;

    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const angle = Math.atan2(dy, dx);
      // Chisel nib at 45 degrees: thick on downstrokes, thin on cross strokes
      const mod = Math.abs(Math.sin(angle - Math.PI / 4));
      const pressure = p1.p ?? 0.5;
      const thickness = Math.max(1.5, s.size * (0.3 + 1.4 * mod) * (0.5 + 0.5 * pressure));

      ctx.lineWidth = thickness;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
  }

  // 3. NEON GLOW PEN: Luminous halo + bright core
  function drawNeonStroke(ctx: CanvasRenderingContext2D, s: StrokeBase) {
    const pts = s.points;
    if (pts.length < 2) return;

    // Glow pass
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = s.size * 3.5;
    ctx.lineWidth = s.size * 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + cur.x) / 2, (prev.y + cur.y) / 2);
    }
    ctx.stroke();
    ctx.restore();

    // Bright inner core
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1.5, s.size * 0.7);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + cur.x) / 2, (prev.y + cur.y) / 2);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 4. CHALK / CRAYON: Textured grainy speckle
  function drawCrayonStroke(ctx: CanvasRenderingContext2D, s: StrokeBase) {
    const pts = s.points;
    if (pts.length < 2) return;
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.globalAlpha = 0.8;

    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const steps = Math.max(1, Math.floor(dist / 3));
      const radius = s.size * 1.2;

      for (let sIdx = 0; sIdx <= steps; sIdx++) {
        const t = sIdx / steps;
        const curX = p0.x + (p1.x - p0.x) * t;
        const curY = p0.y + (p1.y - p0.y) * t;

        // Scattered chalk speckles
        for (let k = 0; k < 3; k++) {
          const r = radius * Math.sqrt(Math.random());
          const theta = Math.random() * 2 * Math.PI;
          const speckleX = curX + r * Math.cos(theta);
          const speckleY = curY + r * Math.sin(theta);
          const dotSize = Math.random() * 1.5 + 0.8;
          ctx.beginPath();
          ctx.arc(speckleX, speckleY, dotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // 5. HIGHLIGHTER: Chisel tip multiply blend
  function drawHighlighterStroke(ctx: CanvasRenderingContext2D, s: StrokeBase) {
    const pts = s.points;
    if (pts.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.38;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size * 4.5;
    ctx.lineCap = "square";
    ctx.lineJoin = "bevel";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + cur.x) / 2, (prev.y + cur.y) / 2);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 6. RAINBOW PEN
  function drawRainbow(ctx: CanvasRenderingContext2D, s: StrokeBase) {
    if (s.points.length < 2) return;
    ctx.lineWidth = s.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 1; i < s.points.length; i++) {
      const h = (i * 8) % 360;
      ctx.strokeStyle = `hsl(${h}, 90%, 55%)`;
      ctx.beginPath();
      ctx.moveTo(s.points[i - 1].x, s.points[i - 1].y);
      ctx.lineTo(s.points[i].x, s.points[i].y);
      ctx.stroke();
    }
  }

  // 7. WATERCOLOR / ART BRUSH: Layered translucent wash
  function drawBrushStroke(ctx: CanvasRenderingContext2D, s: StrokeBase) {
    const pts = s.points;
    if (pts.length < 2) return;
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Soft water bleed underlay
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = s.size * 2.2;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + cur.x) / 2, (prev.y + cur.y) / 2);
    }
    ctx.stroke();

    // Saturated pigment core
    ctx.globalAlpha = 0.65;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const pressure = p1.p ?? 0.5;
      ctx.lineWidth = Math.max(1.5, s.size * (0.6 + 0.8 * pressure));
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 8. CHISEL MARKER / FELT TIP: Bold flat saturated stroke
  function drawMarkerStroke(ctx: CanvasRenderingContext2D, s: StrokeBase) {
    const pts = s.points;
    if (pts.length < 2) return;
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size * 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + cur.x) / 2, (prev.y + cur.y) / 2);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 9. GRAPHITE PENCIL: Fine textured sketch line with subtle grain
  function drawPencilStroke(ctx: CanvasRenderingContext2D, s: StrokeBase) {
    const pts = s.points;
    if (pts.length < 2) return;
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.globalAlpha = 0.78;
    ctx.lineWidth = Math.max(1, s.size * 0.9);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      ctx.lineTo(p1.x, p1.y);
      // Subtle graphite grain
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      const jitter = Math.sin(i * 997) * s.size * 0.35;
      ctx.lineTo(midX + jitter, midY - jitter);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 10. GLITTER & SHIMMER: Sparkling metallic particles
  function drawGlitterStroke(ctx: CanvasRenderingContext2D, s: StrokeBase) {
    const pts = s.points;
    if (pts.length < 2) return;
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + cur.x) / 2, (prev.y + cur.y) / 2);
    }
    ctx.stroke();

    // Glitter specks
    for (let i = 0; i < pts.length; i += 2) {
      const p = pts[i];
      const seed = (i * 1337) % 100;
      const offsetX = ((seed % 7) - 3) * (s.size * 0.45);
      const offsetY = (((seed * 3) % 7) - 3) * (s.size * 0.45);
      ctx.fillStyle = i % 4 === 0 ? "#ffffff" : s.color;
      ctx.beginPath();
      ctx.arc(p.x + offsetX, p.y + offsetY, Math.max(1, s.size * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 11. DOTTED PRECISION
  function drawDottedStroke(ctx: CanvasRenderingContext2D, s: StrokeBase) {
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash([1, Math.max(6, s.size * 2.6)]);
    ctx.beginPath();
    if (s.points.length > 0) {
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  // 12. DUAL RIBBON / PARALLEL ARCHITECTURAL
  function drawParallelStroke(ctx: CanvasRenderingContext2D, s: StrokeBase) {
    const pts = s.points;
    if (pts.length < 2) return;
    const offset = Math.max(3.5, s.size * 1.3);
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(1.2, s.size * 0.65);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Track A
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const next = pts[Math.min(i + 1, pts.length - 1)];
      const dx = next.x - p.x;
      const dy = next.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const px = p.x + nx * (offset / 2);
      const py = p.y + ny * (offset / 2);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Track B
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const next = pts[Math.min(i + 1, pts.length - 1)];
      const dx = next.x - p.x;
      const dy = next.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const px = p.x - nx * (offset / 2);
      const py = p.y - ny * (offset / 2);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawShape(ctx: CanvasRenderingContext2D, s: ShapeStroke) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    let x = s.x;
    let y = s.y;
    let w = s.w;
    let h = s.h;
    if (
      s.shape !== "line" &&
      s.shape !== "arrow" &&
      s.shape !== "double-arrow" &&
      s.shape !== "curved-arrow"
    ) {
      if (w < 0) {
        x += w;
        w = -w;
      }
      if (h < 0) {
        y += h;
        h = -h;
      }
    }

    if (s.shape === "rect") {
      ctx.strokeRect(x, y, w, h);
    } else if (s.shape === "circle") {
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.shape === "ellipse") {
      drawEllipseShape(ctx, x, y, w, h);
    } else if (s.shape === "triangle") {
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.stroke();
    } else if (s.shape === "right-triangle") {
      drawRightTriangleShape(ctx, x, y, w, h);
    } else if (s.shape === "diamond") {
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
      ctx.stroke();
    } else if (s.shape === "star") {
      drawStarShape(ctx, x + w / 2, y + h / 2, Math.min(w, h) / 2);
    } else if (s.shape === "pentagon") {
      drawPentagonShape(ctx, x, y, w, h);
    } else if (s.shape === "hexagon") {
      drawHexagonShape(ctx, x, y, w, h);
    } else if (s.shape === "heptagon") {
      drawHeptagonShape(ctx, x, y, w, h);
    } else if (s.shape === "octagon") {
      drawOctagonShape(ctx, x, y, w, h);
    } else if (s.shape === "decagon") {
      drawDecagonShape(ctx, x, y, w, h);
    } else if (s.shape === "heart") {
      drawHeartShape(ctx, x, y, w, h);
    } else if (s.shape === "cloud") {
      drawCloudShape(ctx, x, y, w, h);
    } else if (s.shape === "crescent") {
      drawCrescentShape(ctx, x, y, w, h);
    } else if (s.shape === "ring") {
      drawRingShape(ctx, x, y, w, h);
    } else if (s.shape === "shield") {
      drawShieldShape(ctx, x, y, w, h);
    } else if (s.shape === "banner") {
      drawBannerShape(ctx, x, y, w, h);
    } else if (s.shape === "speech-bubble") {
      drawSpeechBubbleShape(ctx, x, y, w, h);
    } else if (s.shape === "thought-bubble") {
      drawThoughtBubbleShape(ctx, x, y, w, h);
    } else if (s.shape === "parallelogram") {
      drawParallelogramShape(ctx, x, y, w, h);
    } else if (s.shape === "trapezoid") {
      drawTrapezoidShape(ctx, x, y, w, h);
    } else if (s.shape === "cross") {
      drawCrossShape(ctx, x, y, w, h);
    } else if (s.shape === "lightning") {
      drawLightningShape(ctx, x, y, w, h);
    } else if (s.shape === "gear") {
      drawGearShape(ctx, x, y, w, h);
    } else if (s.shape === "bracket") {
      drawBracketShape(ctx, x, y, w, h);
    } else if (s.shape === "line") {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + s.w, s.y + s.h);
      ctx.stroke();
    } else if (s.shape === "arrow") {
      drawArrowShape(ctx, s);
    } else if (s.shape === "double-arrow") {
      drawDoubleArrowShape(ctx, s);
    } else if (s.shape === "curved-arrow") {
      drawCurvedArrowShape(ctx, s);
    } else if (s.shape === "cube") {
      draw3DCube(ctx, x, y, w, h, s.color, s.size);
    } else if (s.shape === "cuboid") {
      draw3DCuboid(ctx, x, y, w, h, s.color, s.size);
    } else if (s.shape === "cylinder") {
      draw3DCylinder(ctx, x, y, w, h, s.color, s.size);
    } else if (s.shape === "sphere") {
      draw3DSphere(ctx, x, y, w, h, s.color, s.size);
    } else if (s.shape === "hemisphere") {
      draw3DHemisphere(ctx, x, y, w, h, s.color, s.size);
    } else if (s.shape === "cone") {
      draw3DCone(ctx, x, y, w, h, s.color, s.size);
    } else if (s.shape === "frustum") {
      draw3DFrustum(ctx, x, y, w, h, s.color, s.size);
    } else if (s.shape === "pyramid") {
      draw3DPyramid(ctx, x, y, w, h, s.color, s.size);
    } else if (s.shape === "truncated-pyramid") {
      draw3DTruncatedPyramid(ctx, x, y, w, h, s.color, s.size);
    } else if (s.shape === "tetrahedron") {
      draw3DTetrahedron(ctx, x, y, w, h, s.color, s.size);
    } else if (s.shape === "octahedron") {
      draw3DOctahedron(ctx, x, y, w, h, s.color, s.size);
    } else if (s.shape === "dodecahedron") {
      draw3DDodecahedron(ctx, x, y, w, h, s.color, s.size);
    } else if (s.shape === "prism") {
      draw3DPrism(ctx, x, y, w, h, s.color, s.size);
    } else if (s.shape === "hex-prism") {
      draw3DHexPrism(ctx, x, y, w, h, s.color, s.size);
    } else if (s.shape === "pipe") {
      draw3DPipe(ctx, x, y, w, h, s.color, s.size);
    } else if (s.shape === "wedge") {
      draw3DWedge(ctx, x, y, w, h, s.color, s.size);
    } else if (s.shape === "gem") {
      draw3DGem(ctx, x, y, w, h, s.color, s.size);
    } else if (s.shape === "torus") {
      draw3DTorus(ctx, x, y, w, h, s.color, s.size);
    } else if (s.shape === "capsule") {
      draw3DCapsule(ctx, x, y, w, h, s.color, s.size);
    } else if (s.shape === "helix") {
      draw3DHelix(ctx, x, y, w, h, s.color, s.size);
    } else if (s.shape === "axes3d") {
      draw3DAxes(ctx, x, y, w, h, s.color, s.size);
    }
  }

  function drawRightTriangleShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.stroke();

    const sq = Math.min(16, Math.min(Math.abs(w), Math.abs(h)) * 0.2);
    if (sq > 5) {
      ctx.beginPath();
      ctx.moveTo(x, y + h - sq);
      ctx.lineTo(x + sq, y + h - sq);
      ctx.lineTo(x + sq, y + h);
      ctx.stroke();
    }
  }

  function drawStarShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    const innerR = r * 0.45;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? r : innerR;
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const px = cx + radius * Math.cos(angle);
      const py = cy + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawPentagonShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const px = cx + rx * Math.cos(angle);
      const py = cy + ry * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawHexagonShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 6;
      const px = cx + rx * Math.cos(angle);
      const py = cy + ry * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawOctagonShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i * 2 * Math.PI) / 8 - Math.PI / 8;
      const px = cx + rx * Math.cos(angle);
      const py = cy + ry * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawHeartShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const topCleftX = x + w / 2;
    const topCleftY = y + h * 0.28;
    const bottomTipX = x + w / 2;
    const bottomTipY = y + h;

    ctx.beginPath();
    ctx.moveTo(topCleftX, topCleftY);
    ctx.bezierCurveTo(
      x + w * 0.15,
      y - h * 0.05,
      x - w * 0.05,
      y + h * 0.45,
      bottomTipX,
      bottomTipY,
    );
    ctx.bezierCurveTo(x + w * 1.05, y + h * 0.45, x + w * 0.85, y - h * 0.05, topCleftX, topCleftY);
    ctx.closePath();
    ctx.stroke();
  }

  function drawCloudShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const baseY = y + h * 0.82;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.2, baseY);
    ctx.lineTo(x + w * 0.8, baseY);
    ctx.bezierCurveTo(x + w * 1.02, baseY, x + w * 1.02, y + h * 0.45, x + w * 0.78, y + h * 0.42);
    ctx.bezierCurveTo(
      x + w * 0.82,
      y + h * 0.08,
      x + w * 0.52,
      y + h * 0.05,
      x + w * 0.48,
      y + h * 0.28,
    );
    ctx.bezierCurveTo(
      x + w * 0.38,
      y + h * 0.12,
      x + w * 0.16,
      y + h * 0.22,
      x + w * 0.2,
      y + h * 0.48,
    );
    ctx.bezierCurveTo(x - w * 0.04, y + h * 0.52, x - w * 0.02, baseY, x + w * 0.2, baseY);
    ctx.closePath();
    ctx.stroke();
  }

  function drawSpeechBubbleShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const bh = h * 0.8;
    const r = Math.min(14, bh * 0.25);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + bh - r);
    ctx.quadraticCurveTo(x + w, y + bh, x + w - r, y + bh);
    ctx.lineTo(x + w * 0.48, y + bh);
    ctx.lineTo(x + w * 0.24, y + h);
    ctx.lineTo(x + w * 0.34, y + bh);
    ctx.lineTo(x + r, y + bh);
    ctx.quadraticCurveTo(x, y + bh, x, y + bh - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.stroke();
  }

  function drawParallelogramShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const shift = w * 0.24;
    ctx.beginPath();
    ctx.moveTo(x + shift, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - shift, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.stroke();
  }

  function drawTrapezoidShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const inset = w * 0.22;
    ctx.beginPath();
    ctx.moveTo(x + inset, y);
    ctx.lineTo(x + w - inset, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.stroke();
  }

  function drawCrossShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const aw = w / 3;
    const ah = h / 3;
    ctx.beginPath();
    ctx.moveTo(x + aw, y);
    ctx.lineTo(x + aw * 2, y);
    ctx.lineTo(x + aw * 2, y + ah);
    ctx.lineTo(x + w, y + ah);
    ctx.lineTo(x + w, y + ah * 2);
    ctx.lineTo(x + aw * 2, y + ah * 2);
    ctx.lineTo(x + aw * 2, y + h);
    ctx.lineTo(x + aw, y + h);
    ctx.lineTo(x + aw, y + ah * 2);
    ctx.lineTo(x, y + ah * 2);
    ctx.lineTo(x, y + ah);
    ctx.lineTo(x + aw, y + ah);
    ctx.closePath();
    ctx.stroke();
  }

  function drawArrowShape(ctx: CanvasRenderingContext2D, s: ShapeStroke) {
    const startX = s.x;
    const startY = s.y;
    const endX = s.x + s.w;
    const endY = s.y + s.h;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    const headLen = Math.max(14, s.size * 3.5);
    drawArrowCap(ctx, startX, startY, endX, endY, headLen);
  }

  function drawDoubleArrowShape(ctx: CanvasRenderingContext2D, s: ShapeStroke) {
    const startX = s.x;
    const startY = s.y;
    const endX = s.x + s.w;
    const endY = s.y + s.h;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    const headLen = Math.max(14, s.size * 3.5);
    drawArrowCap(ctx, startX, startY, endX, endY, headLen);
    drawArrowCap(ctx, endX, endY, startX, startY, headLen);
  }

  function drawHeptagonShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const angle = (i * 2 * Math.PI) / 7 - Math.PI / 2;
      const px = cx + rx * Math.cos(angle);
      const py = cy + ry * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawDecagonShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = (i * 2 * Math.PI) / 10 - Math.PI / 2;
      const px = cx + rx * Math.cos(angle);
      const py = cy + ry * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawCrescentShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI * 0.45, Math.PI * 0.45, false);
    ctx.quadraticCurveTo(
      cx - r * 0.15,
      cy,
      cx + r * Math.cos(-Math.PI * 0.45),
      cy + r * Math.sin(-Math.PI * 0.45),
    );
    ctx.closePath();
    ctx.stroke();
  }

  function drawRingShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.58, ry * 0.58, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawEllipseShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawShieldShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h * 0.55);
    ctx.quadraticCurveTo(x + w, y + h * 0.88, x + w / 2, y + h);
    ctx.quadraticCurveTo(x, y + h * 0.88, x, y + h * 0.55);
    ctx.closePath();
    ctx.stroke();
  }

  function drawBannerShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const notch = w * 0.12;
    const fold = h * 0.25;
    ctx.beginPath();
    ctx.moveTo(x + notch, y);
    ctx.lineTo(x + w - notch, y);
    ctx.lineTo(x + w, y + fold);
    ctx.lineTo(x + w - notch, y + h);
    ctx.lineTo(x + notch, y + h);
    ctx.lineTo(x, y + fold);
    ctx.closePath();
    ctx.stroke();
  }

  function drawLightningShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x + w * 0.55, y);
    ctx.lineTo(x + w * 0.18, y + h * 0.52);
    ctx.lineTo(x + w * 0.48, y + h * 0.52);
    ctx.lineTo(x + w * 0.35, y + h);
    ctx.lineTo(x + w * 0.82, y + h * 0.42);
    ctx.lineTo(x + w * 0.52, y + h * 0.42);
    ctx.closePath();
    ctx.stroke();
  }

  function drawGearShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rOuter = Math.min(w, h) / 2;
    const rInner = rOuter * 0.76;
    const rHole = rOuter * 0.35;
    const teeth = 6;
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const angle = (i * Math.PI) / teeth;
      const r = i % 2 === 0 ? rOuter : rInner;
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, rHole, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawThoughtBubbleShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const bw = w * 0.82;
    const bh = h * 0.72;
    drawCloudShape(ctx, x + w * 0.18, y, bw, bh);
    ctx.beginPath();
    ctx.arc(x + w * 0.12, y + h * 0.82, Math.min(w, h) * 0.07, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + w * 0.05, y + h * 0.94, Math.min(w, h) * 0.04, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawBracketShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const midY = y + h / 2;
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.quadraticCurveTo(x + w * 0.4, y, x + w * 0.4, y + h * 0.25);
    ctx.lineTo(x + w * 0.4, midY - h * 0.08);
    ctx.quadraticCurveTo(x + w * 0.4, midY, x, midY);
    ctx.quadraticCurveTo(x + w * 0.4, midY, x + w * 0.4, midY + h * 0.08);
    ctx.lineTo(x + w * 0.4, y + h * 0.75);
    ctx.quadraticCurveTo(x + w * 0.4, y + h, x + w, y + h);
    ctx.stroke();
  }

  function drawCurvedArrowShape(ctx: CanvasRenderingContext2D, s: ShapeStroke) {
    const x = s.x;
    const y = s.y;
    const w = s.w;
    const h = s.h;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.2);
    ctx.quadraticCurveTo(x + w * 0.2, y, x + w * 0.7, y + h * 0.2);
    ctx.quadraticCurveTo(x + w, y + h * 0.4, x + w * 0.9, y + h * 0.85);
    ctx.stroke();
    const headLen = Math.max(12, s.size * 3);
    drawArrowCap(ctx, x + w, y + h * 0.7, x + w * 0.9, y + h * 0.85, headLen);
  }

  // ---- 3D Solids & Diagram Renderers ----
  function draw3DCube(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    size: number,
  ) {
    const fw = w * 0.72;
    const fh = h * 0.72;
    const dx = w * 0.28;
    const dy = h * 0.28;

    // Top face
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.moveTo(x, y + dy);
    ctx.lineTo(x + dx, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + fw, y + dy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Right face
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.moveTo(x + fw, y + dy);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + fh);
    ctx.lineTo(x + fw, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Front face
    ctx.strokeRect(x, y + dy, fw, fh);

    // Top edges
    ctx.beginPath();
    ctx.moveTo(x, y + dy);
    ctx.lineTo(x + dx, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + fw, y + dy);
    ctx.stroke();

    // Right edges
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w, y + fh);
    ctx.lineTo(x + fw, y + h);
    ctx.stroke();
  }

  function draw3DCylinder(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    size: number,
  ) {
    const capH = Math.max(12, h * 0.22);
    const cx = x + w / 2;
    const topY = y + capH / 2;
    const botY = y + h - capH / 2;
    const rx = w / 2;
    const ry = capH / 2;

    // Top ellipse
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Connecting side vertical lines
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, botY);
    ctx.moveTo(x + w, topY);
    ctx.lineTo(x + w, botY);
    ctx.stroke();

    // Bottom ellipse - front arc solid
    ctx.beginPath();
    ctx.ellipse(cx, botY, rx, ry, 0, 0, Math.PI);
    ctx.stroke();

    // Bottom ellipse - back arc dashed
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.ellipse(cx, botY, rx, ry, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function draw3DSphere(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    size: number,
  ) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) / 2;

    // Subtle radial shading
    ctx.save();
    const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    grad.addColorStop(0, "rgba(255, 255, 255, 0.4)");
    grad.addColorStop(0.7, "transparent");
    grad.addColorStop(1, "rgba(0, 0, 0, 0.1)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Outer contour
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Equator - front solid, back dashed
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.32, 0, 0, Math.PI);
    ctx.stroke();

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.32, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Vertical meridian
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.32, r, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function draw3DCone(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    size: number,
  ) {
    const cx = x + w / 2;
    const baseH = Math.max(12, h * 0.2);
    const baseY = y + h - baseH / 2;
    const rx = w / 2;
    const ry = baseH / 2;

    // Slant lines
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(x, baseY);
    ctx.moveTo(cx, y);
    ctx.lineTo(x + w, baseY);
    ctx.stroke();

    // Base front arc solid
    ctx.beginPath();
    ctx.ellipse(cx, baseY, rx, ry, 0, 0, Math.PI);
    ctx.stroke();

    // Base back arc dashed
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.ellipse(cx, baseY, rx, ry, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function draw3DPyramid(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    size: number,
  ) {
    const apexX = x + w / 2;
    const apexY = y;
    const frontX = x + w * 0.5;
    const frontY = y + h;
    const leftX = x + w * 0.12;
    const leftY = y + h * 0.78;
    const rightX = x + w * 0.88;
    const rightY = y + h * 0.78;
    const backX = x + w * 0.5;
    const backY = y + h * 0.58;

    // Right facet shading
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.14;
    ctx.beginPath();
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(frontX, frontY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Front visible edges
    ctx.beginPath();
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(frontX, frontY);
    ctx.lineTo(rightX, rightY);
    ctx.lineTo(apexX, apexY);
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(frontX, frontY);
    ctx.stroke();

    // Hidden back edges dashed
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(leftX, leftY);
    ctx.lineTo(backX, backY);
    ctx.lineTo(rightX, rightY);
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(backX, backY);
    ctx.stroke();
    ctx.restore();
  }

  function draw3DPrism(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    size: number,
  ) {
    const fw = w * 0.72;
    const fh = h * 0.72;
    const dx = w * 0.28;
    const dy = h * 0.28;

    // Front triangle
    const p1 = { x: x, y: y + dy + fh };
    const p2 = { x: x + fw, y: y + dy + fh };
    const p3 = { x: x + fw / 2, y: y + dy };

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.stroke();

    // Back triangle visible edges
    const b2 = { x: p2.x + dx, y: p2.y - dy };
    const b3 = { x: p3.x + dx, y: p3.y - dy };

    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(b2.x, b2.y);
    ctx.lineTo(b3.x, b3.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.stroke();
  }

  function draw3DCuboid(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    size: number,
  ) {
    const fw = w * 0.74;
    const fh = h * 0.68;
    const dx = w * 0.26;
    const dy = h * 0.32;

    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.moveTo(x, y + dy);
    ctx.lineTo(x + dx, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + fw, y + dy);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.moveTo(x + fw, y + dy);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + fh);
    ctx.lineTo(x + fw, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeRect(x, y + dy, fw, fh);

    ctx.beginPath();
    ctx.moveTo(x, y + dy);
    ctx.lineTo(x + dx, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + fw, y + dy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w, y + fh);
    ctx.lineTo(x + fw, y + h);
    ctx.stroke();

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, y + dy + fh);
    ctx.lineTo(x + dx, y + fh);
    ctx.lineTo(x + w, y + fh);
    ctx.moveTo(x + dx, y);
    ctx.lineTo(x + dx, y + fh);
    ctx.stroke();
    ctx.restore();
  }

  function draw3DHemisphere(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    size: number,
  ) {
    const cx = x + w / 2;
    const rx = w / 2;
    const ry = Math.max(10, h * 0.22);
    const baseY = y + h - ry;

    ctx.save();
    const grad = ctx.createRadialGradient(cx - rx * 0.3, y + h * 0.35, rx * 0.1, cx, baseY, rx);
    grad.addColorStop(0, "rgba(255, 255, 255, 0.35)");
    grad.addColorStop(0.7, "transparent");
    grad.addColorStop(1, "rgba(0, 0, 0, 0.08)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, baseY, rx, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, baseY, rx, Math.PI, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(cx, baseY, rx, ry, 0, 0, Math.PI);
    ctx.stroke();

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.ellipse(cx, baseY, rx, ry, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function draw3DTetrahedron(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    size: number,
  ) {
    const apex = { x: x + w / 2, y };
    const pLeft = { x: x + w * 0.08, y: y + h * 0.78 };
    const pRight = { x: x + w * 0.92, y: y + h * 0.78 };
    const pFront = { x: x + w * 0.5, y: y + h };

    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(pFront.x, pFront.y);
    ctx.lineTo(pRight.x, pRight.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(pLeft.x, pLeft.y);
    ctx.lineTo(pFront.x, pFront.y);
    ctx.lineTo(pRight.x, pRight.y);
    ctx.lineTo(apex.x, apex.y);
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(pFront.x, pFront.y);
    ctx.stroke();

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pLeft.x, pLeft.y);
    ctx.lineTo(pRight.x, pRight.y);
    ctx.stroke();
    ctx.restore();
  }

  function draw3DHexPrism(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    size: number,
  ) {
    const cx = x + w / 2;
    const rx = w * 0.46;
    const ry = Math.max(8, h * 0.14);
    const topY = y + ry + 4;
    const botY = y + h - ry - 4;

    const topPts: Point[] = [];
    const botPts: Point[] = [];
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3 - Math.PI / 6;
      topPts.push({ x: cx + rx * Math.cos(ang), y: topY + ry * Math.sin(ang) });
      botPts.push({ x: cx + rx * Math.cos(ang), y: botY + ry * Math.sin(ang) });
    }

    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    topPts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    topPts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    [0, 1, 2, 5].forEach((idx) => {
      ctx.moveTo(topPts[idx].x, topPts[idx].y);
      ctx.lineTo(botPts[idx].x, botPts[idx].y);
    });
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(botPts[5].x, botPts[5].y);
    ctx.lineTo(botPts[0].x, botPts[0].y);
    ctx.lineTo(botPts[1].x, botPts[1].y);
    ctx.lineTo(botPts[2].x, botPts[2].y);
    ctx.stroke();

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    [3, 4].forEach((idx) => {
      ctx.moveTo(topPts[idx].x, topPts[idx].y);
      ctx.lineTo(botPts[idx].x, botPts[idx].y);
    });
    ctx.moveTo(botPts[2].x, botPts[2].y);
    ctx.lineTo(botPts[3].x, botPts[3].y);
    ctx.lineTo(botPts[4].x, botPts[4].y);
    ctx.lineTo(botPts[5].x, botPts[5].y);
    ctx.stroke();
    ctx.restore();
  }

  function draw3DTorus(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    size: number,
  ) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    const tubeR = Math.min(rx, ry) * 0.28;

    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy,
      Math.max(4, rx - tubeR * 2),
      Math.max(4, ry - tubeR * 2),
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();

    const leftCX = cx - (rx - tubeR);
    ctx.beginPath();
    ctx.ellipse(leftCX, cy, tubeR, tubeR * 1.15, 0, 0, Math.PI);
    ctx.stroke();
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.ellipse(leftCX, cy, tubeR, tubeR * 1.15, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const rightCX = cx + (rx - tubeR);
    ctx.beginPath();
    ctx.ellipse(rightCX, cy, tubeR, tubeR * 1.15, 0, 0, Math.PI);
    ctx.stroke();
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.ellipse(rightCX, cy, tubeR, tubeR * 1.15, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function draw3DCapsule(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    size: number,
  ) {
    const r = w / 2;
    const cx = x + r;
    const topCapY = y + r;
    const botCapY = y + h - r;

    ctx.beginPath();
    ctx.arc(cx, topCapY, r, Math.PI, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, botCapY, r, 0, Math.PI);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, topCapY);
    ctx.lineTo(x, botCapY);
    ctx.moveTo(x + w, topCapY);
    ctx.lineTo(x + w, botCapY);
    ctx.stroke();

    const eqRy = Math.max(6, r * 0.28);
    ctx.beginPath();
    ctx.ellipse(cx, topCapY, r, eqRy, 0, 0, Math.PI);
    ctx.stroke();
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.ellipse(cx, topCapY, r, eqRy, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.ellipse(cx, botCapY, r, eqRy, 0, 0, Math.PI);
    ctx.stroke();
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.ellipse(cx, botCapY, r, eqRy, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function draw3DAxes(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    size: number,
  ) {
    const ox = x + w * 0.45;
    const oy = y + h * 0.58;
    const capSize = Math.max(12, size * 3.2);

    // Z axis (vertical up)
    const zEndX = ox;
    const zEndY = y + 8;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(zEndX, zEndY);
    ctx.stroke();
    drawArrowCap(ctx, ox, oy, zEndX, zEndY, capSize);

    // X axis (isometric down-right at ~30 deg)
    const xEndX = x + w - 6;
    const xEndY = y + h * 0.88;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(xEndX, xEndY);
    ctx.stroke();
    drawArrowCap(ctx, ox, oy, xEndX, xEndY, capSize);

    // Y axis (isometric down-left at ~30 deg)
    const yEndX = x + 6;
    const yEndY = y + h * 0.88;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(yEndX, yEndY);
    ctx.stroke();
    drawArrowCap(ctx, ox, oy, yEndX, yEndY, capSize);

    // Axis Labels
    ctx.fillStyle = color;
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText("Z", zEndX + 6, zEndY + 4);
    ctx.fillText("X", xEndX - 4, xEndY - 8);
    ctx.fillText("Y", yEndX - 10, yEndY - 8);
  }

  function draw3DFrustum(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    size: number,
  ) {
    const topW = w * 0.55;
    const topH = h * 0.18;
    const botH = h * 0.22;
    const topX = x + (w - topW) / 2;
    const topY = y;
    const botY = y + h - botH / 2;

    // Side shading
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.07;
    ctx.beginPath();
    ctx.moveTo(topX, topY + topH / 2);
    ctx.lineTo(topX + topW, topY + topH / 2);
    ctx.lineTo(x + w, botY);
    ctx.lineTo(x, botY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Top ellipse
    ctx.beginPath();
    ctx.ellipse(topX + topW / 2, topY + topH / 2, topW / 2, topH / 2, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Bottom ellipse front half
    ctx.beginPath();
    ctx.ellipse(x + w / 2, botY, w / 2, botH / 2, 0, 0, Math.PI);
    ctx.stroke();

    // Bottom ellipse back dashed half
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, botY, w / 2, botH / 2, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Connecting side lines
    ctx.beginPath();
    ctx.moveTo(topX, topY + topH / 2);
    ctx.lineTo(x, botY);
    ctx.moveTo(topX + topW, topY + topH / 2);
    ctx.lineTo(x + w, botY);
    ctx.stroke();
  }

  function draw3DTruncatedPyramid(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    size: number,
  ) {
    const topW = w * 0.5;
    const topH = h * 0.32;
    const topX = x + (w - topW) / 2;
    const topY = y + 4;
    const botY = y + h - 4;

    ctx.strokeRect(topX, topY, topW, topH);
    ctx.strokeRect(x, botY - topH, w, topH);

    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(x, botY - topH);
    ctx.moveTo(topX + topW, topY);
    ctx.lineTo(x + w, botY - topH);
    ctx.moveTo(topX + topW, topY + topH);
    ctx.lineTo(x + w, botY);
    ctx.moveTo(topX, topY + topH);
    ctx.lineTo(x, botY);
    ctx.stroke();
  }

  function draw3DOctahedron(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    size: number,
  ) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const topY = y;
    const botY = y + h;
    const leftX = x;
    const rightX = x + w;
    const midFrontX = cx;
    const midFrontY = cy + h * 0.18;
    const midBackY = cy - h * 0.18;

    // Shading
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.moveTo(cx, topY);
    ctx.lineTo(leftX, cy);
    ctx.lineTo(midFrontX, midFrontY);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.moveTo(cx, topY);
    ctx.lineTo(rightX, cy);
    ctx.lineTo(midFrontX, midFrontY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Front edges
    ctx.beginPath();
    ctx.moveTo(cx, topY);
    ctx.lineTo(leftX, cy);
    ctx.lineTo(midFrontX, midFrontY);
    ctx.lineTo(rightX, cy);
    ctx.lineTo(cx, topY);
    ctx.lineTo(midFrontX, midFrontY);

    ctx.moveTo(cx, botY);
    ctx.lineTo(leftX, cy);
    ctx.moveTo(cx, botY);
    ctx.lineTo(midFrontX, midFrontY);
    ctx.moveTo(cx, botY);
    ctx.lineTo(rightX, cy);
    ctx.stroke();

    // Back dashed edges
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(cx, topY);
    ctx.lineTo(cx, midBackY);
    ctx.lineTo(leftX, cy);
    ctx.moveTo(cx, midBackY);
    ctx.lineTo(rightX, cy);
    ctx.moveTo(cx, midBackY);
    ctx.lineTo(cx, botY);
    ctx.stroke();
    ctx.restore();
  }

  function draw3DDodecahedron(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    size: number,
  ) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rOuter = Math.min(w, h) / 2;
    const rInner = rOuter * 0.58;

    // Inner pentagon
    ctx.beginPath();
    const innerPts: [number, number][] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const px = cx + rInner * Math.cos(a);
      const py = cy + rInner * Math.sin(a);
      innerPts.push([px, py]);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    // Outer decagon and connecting facet edges
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * 2 * Math.PI) / 10 - Math.PI / 2;
      const px = cx + rOuter * Math.cos(a);
      const py = cy + rOuter * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
      if (i % 2 === 0) {
        const innerIndex = i / 2;
        ctx.lineTo(innerPts[innerIndex][0], innerPts[innerIndex][1]);
        ctx.moveTo(px, py);
      }
    }
    ctx.closePath();
    ctx.stroke();
  }

  function draw3DPipe(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    size: number,
  ) {
    const ew = w;
    const eh = h * 0.22;
    const wall = w * 0.16;
    const cyTop = y + eh / 2;
    const cyBot = y + h - eh / 2;

    // Top outer and inner ellipses
    ctx.beginPath();
    ctx.ellipse(x + w / 2, cyTop, ew / 2, eh / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + w / 2, cyTop, (ew - wall * 2) / 2, (eh - wall * 0.4) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Bottom outer ellipse front half
    ctx.beginPath();
    ctx.ellipse(x + w / 2, cyBot, ew / 2, eh / 2, 0, 0, Math.PI);
    ctx.stroke();

    // Bottom outer dashed back half
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, cyBot, ew / 2, eh / 2, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Connecting side walls
    ctx.beginPath();
    ctx.moveTo(x, cyTop);
    ctx.lineTo(x, cyBot);
    ctx.moveTo(x + w, cyTop);
    ctx.lineTo(x + w, cyBot);
    ctx.stroke();
  }

  function draw3DWedge(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    size: number,
  ) {
    const dx = w * 0.35;
    const dy = h * 0.28;
    const fw = w - dx;
    const fh = h - dy;

    // Shading on inclined ramp face
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + fw, y + dy);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + dx, y + fh);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Front triangle
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + fw, y + h);
    ctx.lineTo(x + fw, y + dy);
    ctx.closePath();
    ctx.stroke();

    // Top ramp & back edges
    ctx.beginPath();
    ctx.moveTo(x + fw, y + dy);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + dx, y);
    ctx.lineTo(x, y + h);
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w, y + fh);
    ctx.lineTo(x + fw, y + h);
    ctx.stroke();
  }

  function draw3DGem(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    size: number,
  ) {
    const tableW = w * 0.55;
    const crownH = h * 0.28;
    const tableX = x + (w - tableW) / 2;
    const tableY = y;
    const girdleY = y + crownH;
    const culetX = x + w / 2;
    const culetY = y + h;

    // Shaded facets
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.moveTo(tableX, tableY);
    ctx.lineTo(tableX + tableW, tableY);
    ctx.lineTo(x + w * 0.82, girdleY);
    ctx.lineTo(x + w * 0.18, girdleY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Table
    ctx.beginPath();
    ctx.moveTo(tableX, tableY);
    ctx.lineTo(tableX + tableW, tableY);
    ctx.lineTo(x + w, girdleY);
    ctx.lineTo(culetX, culetY);
    ctx.lineTo(x, girdleY);
    ctx.closePath();
    ctx.stroke();

    // Crown facets
    ctx.beginPath();
    ctx.moveTo(tableX, tableY);
    ctx.lineTo(x + w * 0.25, girdleY);
    ctx.lineTo(culetX, culetY);
    ctx.moveTo(tableX + tableW, tableY);
    ctx.lineTo(x + w * 0.75, girdleY);
    ctx.lineTo(culetX, culetY);
    ctx.moveTo(x + w * 0.25, girdleY);
    ctx.lineTo(x + w * 0.75, girdleY);
    ctx.stroke();
  }

  function draw3DHelix(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    size: number,
  ) {
    const turns = 4.5;
    const cx = x + w / 2;
    const rx = w * 0.45;
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const angle = t * turns * 2 * Math.PI;
      const px = cx + rx * Math.cos(angle);
      const py = y + t * h;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function drawArrowCap(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    ex: number,
    ey: number,
    len: number,
  ) {
    const ang = Math.atan2(ey - sy, ex - sx);
    const wing = Math.PI / 6;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - len * Math.cos(ang - wing), ey - len * Math.sin(ang - wing));
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - len * Math.cos(ang + wing), ey - len * Math.sin(ang + wing));
    ctx.stroke();
  }

  // ---- Interactive Canvas Diagram Objects ----
  function drawFlashcard(ctx: CanvasRenderingContext2D, o: FlashcardObject) {
    ctx.save();
    ctx.fillStyle = o.color || "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.12)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    roundRect(ctx, o.x, o.y, o.w, o.h, 16);
    ctx.fill();
    ctx.shadowColor = "transparent";

    ctx.strokeStyle = o.flipped ? "#6366f1" : "#e2e8f0";
    ctx.lineWidth = 2;
    roundRect(ctx, o.x, o.y, o.w, o.h, 16);
    ctx.stroke();

    // Card Header Badge
    ctx.fillStyle = o.flipped ? "#6366f1" : "#64748b";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.fillText(
      o.flipped ? "ANSWER (double-tap to flip)" : "QUESTION (double-tap to flip)",
      o.x + 14,
      o.y + 18,
    );

    // Card Body Text
    ctx.fillStyle = "#0f172a";
    ctx.font = "500 15px system-ui, sans-serif";
    const text = o.flipped ? o.back : o.front;
    const lines = wrapText(ctx, text, o.w - 28);
    lines.forEach((l, i) => {
      ctx.fillText(l, o.x + 14, o.y + 46 + i * 22);
    });
    ctx.restore();
  }

  function drawQuiz(ctx: CanvasRenderingContext2D, o: QuizObject) {
    ctx.save();
    ctx.fillStyle = o.revealed ? "#f0fdf4" : "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.12)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    roundRect(ctx, o.x, o.y, o.w, o.h, 16);
    ctx.fill();
    ctx.shadowColor = "transparent";

    ctx.strokeStyle = o.revealed ? "#22c55e" : "#e2e8f0";
    ctx.lineWidth = 2;
    roundRect(ctx, o.x, o.y, o.w, o.h, 16);
    ctx.stroke();

    // Quiz Header Badge
    ctx.fillStyle = o.revealed ? "#16a34a" : "#7c3aed";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.fillText(
      o.revealed ? "QUIZ · ANSWER REVEALED" : "QUIZ (double-tap to reveal)",
      o.x + 14,
      o.y + 18,
    );

    // Question
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillText(o.question, o.x + 14, o.y + 44);

    // Options
    o.options.forEach((opt, idx) => {
      const isCorrect = idx === o.answerIndex;
      const optY = o.y + 70 + idx * 26;
      ctx.fillStyle = o.revealed && isCorrect ? "#16a34a" : "#475569";
      ctx.font =
        o.revealed && isCorrect ? "bold 13px system-ui, sans-serif" : "13px system-ui, sans-serif";
      const letter = String.fromCharCode(65 + idx);
      ctx.fillText(`${letter}. ${opt} ${o.revealed && isCorrect ? "✓" : ""}`, o.x + 16, optY);
    });
    ctx.restore();
  }

  function drawRoadmap(ctx: CanvasRenderingContext2D, o: RoadmapObject) {
    ctx.save();
    const statusColors = {
      todo: { bg: "#f1f5f9", border: "#94a3b8", text: "#475569", label: "TODO" },
      doing: { bg: "#eff6ff", border: "#3b82f6", text: "#1d4ed8", label: "IN PROGRESS" },
      done: { bg: "#f0fdf4", border: "#22c55e", text: "#15803d", label: "COMPLETED" },
    }[o.status || "todo"];

    ctx.fillStyle = statusColors.bg;
    roundRect(ctx, o.x, o.y, o.w, o.h, 12);
    ctx.fill();

    ctx.strokeStyle = statusColors.border;
    ctx.lineWidth = 1.5;
    roundRect(ctx, o.x, o.y, o.w, o.h, 12);
    ctx.stroke();

    // Step & Status Tag
    ctx.fillStyle = statusColors.text;
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.fillText(
      `STEP ${o.step ?? 1} · ${statusColors.label} (double-tap to cycle)`,
      o.x + 12,
      o.y + 16,
    );

    // Title
    ctx.fillStyle = "#0f172a";
    ctx.font = "600 14px system-ui, sans-serif";
    ctx.fillText(o.title, o.x + 12, o.y + 36);
    ctx.restore();
  }

  function drawFormula(ctx: CanvasRenderingContext2D, o: FormulaObject) {
    ctx.save();
    ctx.fillStyle = o.color || "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.1)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    roundRect(ctx, o.x, o.y, o.w, o.h, 12);
    ctx.fill();
    ctx.shadowColor = "transparent";

    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 1.5;
    roundRect(ctx, o.x, o.y, o.w, o.h, 12);
    ctx.stroke();

    ctx.fillStyle = "#8b5cf6";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.fillText(o.label ? `MATH · ${o.label.toUpperCase()}` : "MATH FORMULA (LaTeX)", o.x + 12, o.y + 16);

    ctx.fillStyle = "#0f172a";
    ctx.font = "italic 16px 'Cambria Math', 'STIX Two Math', 'Times New Roman', serif";
    const cleanFormula = o.latex
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

    const lines = wrapText(ctx, cleanFormula, o.w - 24);
    lines.forEach((l, idx) => {
      ctx.fillText(l, o.x + 12, o.y + 44 + idx * 22);
    });

    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px monospace";
    ctx.fillText(o.latex.slice(0, 45) + (o.latex.length > 45 ? "..." : ""), o.x + 12, o.y + o.h - 10);
    ctx.restore();
  }

  function drawDiagramNode(ctx: CanvasRenderingContext2D, o: DiagramNodeObject) {
    ctx.save();
    ctx.fillStyle =
      o.color ||
      (o.nodeType === "start" || o.nodeType === "end"
        ? "#ecfdf5"
        : o.nodeType === "decision"
          ? "#fffbeb"
          : "#eff6ff");
    ctx.strokeStyle =
      o.nodeType === "start" || o.nodeType === "end"
        ? "#10b981"
        : o.nodeType === "decision"
          ? "#f59e0b"
          : "#3b82f6";
    ctx.lineWidth = 2;

    if (o.nodeType === "decision") {
      ctx.beginPath();
      ctx.moveTo(o.x + o.w / 2, o.y);
      ctx.lineTo(o.x + o.w, o.y + o.h / 2);
      ctx.lineTo(o.x + o.w / 2, o.y + o.h);
      ctx.lineTo(o.x, o.y + o.h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      const radius = o.nodeType === "start" || o.nodeType === "end" ? o.h / 2 : 10;
      roundRect(ctx, o.x, o.y, o.w, o.h, radius);
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(o.label, o.x + o.w / 2, o.y + o.h / 2 + 4);
    ctx.textAlign = "left";

    if (o.connectedTo && o.connectedTo.length > 0) {
      for (const targetId of o.connectedTo) {
        const target = page.objects.find((x) => x.id === targetId && "x" in x) as
          | DiagramNodeObject
          | undefined;
        if (target) {
          ctx.strokeStyle = "#94a3b8";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(o.x + o.w / 2, o.y + o.h);
          ctx.lineTo(target.x + target.w / 2, target.y);
          ctx.stroke();
          const tx = target.x + target.w / 2;
          const ty = target.y;
          ctx.fillStyle = "#94a3b8";
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx - 5, ty - 8);
          ctx.lineTo(tx + 5, ty - 8);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  function drawMindMapNode(ctx: CanvasRenderingContext2D, o: MindMapNodeObject) {
    ctx.save();
    if (o.parentId) {
      const parent = page.objects.find((x) => x.id === o.parentId && "x" in x) as
        | MindMapNodeObject
        | undefined;
      if (parent) {
        ctx.strokeStyle = o.color || "#6366f1";
        ctx.lineWidth = Math.max(1.5, 3.5 - o.level * 0.8);
        ctx.beginPath();
        const px = parent.x + (parent.w ?? 0) / 2;
        const py = parent.y + (parent.h ?? 0) / 2;
        const cx = o.x + o.w / 2;
        const cy = o.y + o.h / 2;
        ctx.moveTo(px, py);
        const midX = (px + cx) / 2;
        ctx.bezierCurveTo(midX, py, midX, cy, cx, cy);
        ctx.stroke();
      }
    }

    ctx.fillStyle = o.level === 0 ? o.color : "#ffffff";
    ctx.strokeStyle = o.color;
    ctx.lineWidth = o.level === 0 ? 3 : 2;
    ctx.shadowColor = "rgba(0,0,0,0.08)";
    ctx.shadowBlur = 6;
    roundRect(ctx, o.x, o.y, o.w, o.h, o.h / 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowColor = "transparent";

    ctx.fillStyle = o.level === 0 ? "#ffffff" : "#0f172a";
    ctx.font = o.level === 0 ? "bold 13px system-ui, sans-serif" : "500 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(o.label, o.x + o.w / 2, o.y + o.h / 2 + 4);
    ctx.textAlign = "left";
    ctx.restore();
  }

  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawText(ctx: CanvasRenderingContext2D, t: TextObject) {
    if (editingText?.id === t.id) return;
    if (t.bg) {
      ctx.fillStyle = t.bg;
      ctx.fillRect(t.x, t.y, t.w, t.h);
    }
    ctx.fillStyle = t.color;
    ctx.font = `${t.fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textBaseline = "top";
    const lines = wrapText(ctx, t.text, t.w - 8);
    lines.forEach((line, i) => {
      ctx.fillText(line, t.x + 4, t.y + 4 + i * (t.fontSize * 1.2));
    });
  }

  function drawSticky(ctx: CanvasRenderingContext2D, s: StickyNoteObject) {
    ctx.fillStyle = s.color;
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#1e293b";
    ctx.font = `16px system-ui, sans-serif`;
    ctx.textBaseline = "top";
    const lines = wrapText(ctx, s.text, s.w - 16);
    lines.forEach((line, i) => {
      ctx.fillText(line, s.x + 8, s.y + 8 + i * 20);
    });
  }

  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  function drawImage(ctx: CanvasRenderingContext2D, o: ImageObject) {
    let img = imageCache.current.get(o.src);
    if (!img) {
      img = new Image();
      img.src = o.src;
      img.onload = () => redraw();
      imageCache.current.set(o.src, img);
    }
    if (img.complete) ctx.drawImage(img, o.x, o.y, o.w, o.h);
  }

  function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
    const words = text.split(/(\s+)/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur + w;
      if (ctx.measureText(test).width > maxW && cur) {
        lines.push(cur);
        cur = w.trimStart();
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  }

  function drawTape(ctx: CanvasRenderingContext2D, t: TapeObject) {
    ctx.save();
    if (t.revealed) {
      ctx.strokeStyle = t.color || "#f59e0b";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.fillStyle = "rgba(254, 240, 138, 0.14)";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(t.x, t.y, t.w, t.h, 4);
      } else {
        ctx.rect(t.x, t.y, t.w, t.h);
      }
      ctx.fill();
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = t.color || "#f59e0b";
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.fillText("👁️ Revealed", t.x + 6, t.y + 13);
    } else {
      ctx.shadowColor = "rgba(0, 0, 0, 0.16)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;

      ctx.fillStyle = t.color || "#fed7aa";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(t.x, t.y, t.w, t.h, 4);
      } else {
        ctx.rect(t.x, t.y, t.w, t.h);
      }
      ctx.fill();

      ctx.shadowColor = "transparent";

      ctx.save();
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(t.x, t.y, t.w, t.h, 4);
      } else {
        ctx.rect(t.x, t.y, t.w, t.h);
      }
      ctx.clip();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 3;
      const step = 12;
      for (let x = t.x - t.h; x < t.x + t.w + t.h; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, t.y);
        ctx.lineTo(x + t.h, t.y + t.h);
        ctx.stroke();
      }
      ctx.restore();

      ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
      ctx.lineWidth = 1;
      ctx.strokeRect(t.x, t.y, t.w, t.h);

      ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(t.label || "Tap to reveal", t.x + t.w / 2, t.y + t.h / 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
    ctx.restore();
  }

  function evaluateMathFunction(fn: string, x: number): number | null {
    const evaluator = compileMathFunction(fn);
    return evaluator(x);
  }

  function drawGraph(ctx: CanvasRenderingContext2D, g: GraphObject) {
    ctx.save();
    const { x, y, w, h, fn, color } = g;
    const xMin = g.xMin ?? -6;
    const xMax = g.xMax ?? 6;
    const yMin = g.yMin ?? -4;
    const yMax = g.yMax ?? 4;

    ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, w, h, 12);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.fill();
    ctx.shadowColor = "transparent";

    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("MathPad 2D Plot", x + 12, y + 18);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 13px system-ui, monospace";
    ctx.fillText(`f(x) = ${fn || "x^2"}`, x + 12, y + 36);

    const padLeft = 32;
    const padRight = 16;
    const padTop = 46;
    const padBottom = 24;
    const plotX = x + padLeft;
    const plotY = y + padTop;
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    ctx.save();
    ctx.beginPath();
    ctx.rect(plotX, plotY, plotW, plotH);
    ctx.clip();

    const toScreenX = (val: number) => plotX + ((val - xMin) / (xMax - xMin)) * plotW;
    const toScreenY = (val: number) => plotY + plotH - ((val - yMin) / (yMax - yMin)) * plotH;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let gx = Math.ceil(xMin); gx <= Math.floor(xMax); gx++) {
      if (gx === 0) continue;
      const sx = toScreenX(gx);
      ctx.beginPath();
      ctx.moveTo(sx, plotY);
      ctx.lineTo(sx, plotY + plotH);
      ctx.stroke();
    }
    for (let gy = Math.ceil(yMin); gy <= Math.floor(yMax); gy++) {
      if (gy === 0) continue;
      const sy = toScreenY(gy);
      ctx.beginPath();
      ctx.moveTo(plotX, sy);
      ctx.lineTo(plotX + plotW, sy);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 1.5;
    const originX = toScreenX(0);
    const originY = toScreenY(0);

    if (originY >= plotY && originY <= plotY + plotH) {
      ctx.beginPath();
      ctx.moveTo(plotX, originY);
      ctx.lineTo(plotX + plotW, originY);
      ctx.stroke();
    }
    if (originX >= plotX && originX <= plotX + plotW) {
      ctx.beginPath();
      ctx.moveTo(originX, plotY);
      ctx.lineTo(originX, plotY + plotH);
      ctx.stroke();
    }

    const samples = Math.max(100, Math.floor(plotW));
    ctx.strokeStyle = color || "#a855f7";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let started = false;

    const evalFn = compileMathFunction(fn);
    for (let i = 0; i <= samples; i++) {
      const curX = xMin + (i / samples) * (xMax - xMin);
      const curY = evalFn(curX);
      if (curY !== null && !isNaN(curY)) {
        const sx = toScreenX(curX);
        const sy = toScreenY(curY);
        if (!started) {
          ctx.moveTo(sx, sy);
          started = true;
        } else {
          ctx.lineTo(sx, sy);
        }
      } else {
        started = false;
      }
    }
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#64748b";
    ctx.font = "9px system-ui, monospace";
    ctx.fillText(String(xMin), plotX, plotY + plotH + 14);
    ctx.fillText(String(xMax), plotX + plotW - 12, plotY + plotH + 14);
    ctx.fillText(String(yMax), x + 8, plotY + 10);
    ctx.fillText(String(yMin), x + 8, plotY + plotH);

    ctx.restore();
  }

  function drawFrame(ctx: CanvasRenderingContext2D, f: FrameObject) {
    ctx.save();
    const strokeColor = f.color || "#6366f1";
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);

    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(f.x, f.y, f.w, f.h, 8);
    } else {
      ctx.rect(f.x, f.y, f.w, f.h);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    const tabW = Math.min(f.w - 16, Math.max(110, f.title.length * 8 + 36));
    const tabH = 26;
    ctx.fillStyle = strokeColor;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(f.x + 8, f.y - tabH / 2, tabW, tabH, 6);
    } else {
      ctx.rect(f.x + 8, f.y - tabH / 2, tabW, tabH);
    }
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(f.title || `Slide ${f.order}`, f.x + 16, f.y);
    ctx.textBaseline = "alphabetic";

    ctx.restore();
  }

  function drawTable(ctx: CanvasRenderingContext2D, tbl: TableObject) {
    ctx.save();
    const x = tbl.x;
    const y = tbl.y;
    const w = tbl.w;
    const h = tbl.h;
    const rows = Math.max(1, tbl.rows || 1);
    const cols = Math.max(1, tbl.cols || 1);
    const primaryColor = tbl.color || "#0284c7";

    // Card background & soft shadow
    ctx.shadowColor = "rgba(0, 0, 0, 0.08)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, w, h, 10);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Card Border
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, w, h, 10);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.stroke();

    let contentStartY = y;
    let contentH = h;

    // Optional Title Header
    if (tbl.title) {
      const titleH = 34;
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, w, titleH, [10, 10, 0, 0]);
      } else {
        ctx.rect(x, y, w, titleH);
      }
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(tbl.title, x + 12, y + titleH / 2);

      contentStartY = y + titleH;
      contentH = h - titleH;
    }

    const rowH = contentH / rows;
    const colW = w / cols;

    // Draw row backgrounds & alternating fills
    for (let r = 0; r < rows; r++) {
      const ry = contentStartY + r * rowH;
      if (r === 0 && !tbl.title) {
        // First row header fill if no title
        ctx.fillStyle = "rgba(2, 132, 199, 0.08)";
        ctx.fillRect(x + 1, ry + 1, w - 2, rowH - 1);
      } else if (r % 2 === 1) {
        // Alternating zebra row
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(x + 1, ry, w - 2, rowH);
      }
    }

    // Grid lines
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;

    // Horizontal lines
    for (let r = 1; r < rows; r++) {
      const ry = contentStartY + r * rowH;
      ctx.beginPath();
      ctx.moveTo(x, ry);
      ctx.lineTo(x + w, ry);
      ctx.stroke();
    }

    // Vertical lines
    for (let c = 1; c < cols; c++) {
      const cx = x + c * colW;
      ctx.beginPath();
      ctx.moveTo(cx, contentStartY);
      ctx.lineTo(cx, contentStartY + contentH);
      ctx.stroke();
    }

    // Cell text rendering
    ctx.textBaseline = "middle";
    for (let r = 0; r < rows; r++) {
      const ry = contentStartY + r * rowH;
      const isHeader = r === 0;

      ctx.font = isHeader
        ? "bold 12px system-ui, sans-serif"
        : "11px system-ui, sans-serif";
      ctx.fillStyle = isHeader ? "#0f172a" : "#334155";

      for (let c = 0; c < cols; c++) {
        const cx = x + c * colW;
        const cellText = tbl.data?.[r]?.[c] ?? "";

        // Truncate if cell text is too long
        let displayText = String(cellText);
        const maxTextW = colW - 16;
        while (displayText.length > 3 && ctx.measureText(displayText).width > maxTextW) {
          displayText = displayText.slice(0, -2) + "…";
        }

        ctx.fillText(displayText, cx + 8, ry + rowH / 2);
      }
    }

    ctx.restore();
  }

  function getPeriodicElementAt(ptObj: PeriodicTableObject, worldPt: Point): ChemicalElement | null {
    const x = ptObj.x;
    const y = ptObj.y;
    const w = ptObj.w;
    const h = ptObj.h;
    const titleH = 38;
    const padX = 14;
    const padY = 10;
    const availW = w - padX * 2;
    const availH = h - titleH - padY * 2;
    const cellW = availW / 18;
    const cellH = availH / 10.2;
    const gapRowOffset = 8;

    for (const el of ALL_118_ELEMENTS) {
      const pos = getElementGridPosition(el);
      const cellX = x + padX + (pos.col - 1) * cellW;
      const cellY = y + titleH + padY + (pos.row - 1) * cellH + (pos.row >= 8 ? gapRowOffset : 0);
      const boxW = cellW - 2;
      const boxH = cellH - 2;

      if (
        worldPt.x >= cellX &&
        worldPt.x <= cellX + boxW &&
        worldPt.y >= cellY &&
        worldPt.y <= cellY + boxH
      ) {
        return el;
      }
    }
    return null;
  }

  function drawPeriodicTable(ctx: CanvasRenderingContext2D, ptObj: PeriodicTableObject) {
    ctx.save();
    const x = ptObj.x;
    const y = ptObj.y;
    const w = ptObj.w;
    const h = ptObj.h;
    const isDark =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark");

    // Card background & soft shadow
    ctx.shadowColor = "rgba(0, 0, 0, 0.12)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = isDark ? "#0f172a" : "#ffffff";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, w, h, 12);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Card border
    ctx.strokeStyle = isDark ? "#334155" : "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, w, h, 12);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.stroke();

    const titleH = 38;
    const padX = 14;
    const padY = 10;

    // Title banner
    ctx.fillStyle = isDark ? "#1e293b" : "#f1f5f9";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x + 1, y + 1, w - 2, titleH, [12, 12, 0, 0]);
    } else {
      ctx.rect(x + 1, y + 1, w - 2, titleH);
    }
    ctx.fill();

    // Title separator line
    ctx.strokeStyle = isDark ? "#334155" : "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + titleH);
    ctx.lineTo(x + w, y + titleH);
    ctx.stroke();

    // Title text
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillStyle = isDark ? "#f8fafc" : "#0f172a";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText("⚛ PERIODIC TABLE OF ELEMENTS", x + 16, y + titleH / 2);

    // Subtitle badge
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = isDark ? "#94a3b8" : "#64748b";
    ctx.textAlign = "right";
    ctx.fillText("118 Elements • Tap any element for details", x + w - 16, y + titleH / 2);

    // Lanthanide & Actinide row labels
    const availW = w - padX * 2;
    const availH = h - titleH - padY * 2;
    const cellW = availW / 18;
    const cellH = availH / 10.2;
    const gapRowOffset = 8;

    ctx.font = "bold 8px system-ui, sans-serif";
    ctx.fillStyle = isDark ? "#94a3b8" : "#64748b";
    ctx.textAlign = "right";
    const lanthY = y + titleH + padY + 7 * cellH + gapRowOffset + cellH / 2;
    const actY = y + titleH + padY + 8 * cellH + gapRowOffset + cellH / 2;
    ctx.fillText("La-Lu *", x + padX + 2.8 * cellW - 4, lanthY);
    ctx.fillText("Ac-Lr **", x + padX + 2.8 * cellW - 4, actY);

    // Draw all 118 element cells
    for (const el of ALL_118_ELEMENTS) {
      const pos = getElementGridPosition(el);
      const cellX = x + padX + (pos.col - 1) * cellW;
      const cellY = y + titleH + padY + (pos.row - 1) * cellH + (pos.row >= 8 ? gapRowOffset : 0);
      const boxW = cellW - 2;
      const boxH = cellH - 2;

      const catColor = CATEGORY_COLORS[el.category]?.solidBg || "#64748b";

      // Cell background fill
      ctx.fillStyle = catColor;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(cellX, cellY, boxW, boxH, 3);
      } else {
        ctx.rect(cellX, cellY, boxW, boxH);
      }
      ctx.fill();

      // Border around cell
      ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // High contrast text inside cell (white with subtle shadow)
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 2;
      ctx.shadowOffsetY = 1;

      // Atomic number (top-left)
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const numFont = Math.max(6, Math.min(9, Math.round(cellH * 0.22)));
      ctx.font = `bold ${numFont}px system-ui, sans-serif`;
      ctx.fillText(String(el.number), cellX + 2.5, cellY + 2);

      // Symbol (center)
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const symFont = Math.max(9, Math.min(14, Math.round(cellH * 0.36)));
      ctx.font = `bold ${symFont}px system-ui, sans-serif`;
      ctx.fillText(el.symbol, cellX + boxW / 2, cellY + boxH * 0.52);

      // Mass or Name (bottom center, if cell height is sufficient)
      if (cellH >= 34) {
        ctx.textBaseline = "bottom";
        const massFont = Math.max(6, Math.min(8, Math.round(cellH * 0.18)));
        ctx.font = `${massFont}px system-ui, sans-serif`;
        const massStr =
          typeof el.mass === "number"
            ? el.mass.toFixed(el.mass % 1 === 0 ? 0 : 1)
            : String(el.mass);
        ctx.fillText(massStr, cellX + boxW / 2, cellY + boxH - 1.5);
      }

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }

    ctx.restore();
  }

  function objectBounds(obj: CanvasObject): { x: number; y: number; w: number; h: number } {
    if ("points" in obj) {
      const xs = obj.points.map((p) => p.x);
      const ys = obj.points.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const w = maxX - minX;
      const h = maxY - minY;
      const padX = w < 16 ? (16 - w) / 2 : 4;
      const padY = h < 16 ? (16 - h) / 2 : 4;
      return { x: minX - padX, y: minY - padY, w: Math.max(16, w + 8), h: Math.max(16, h + 8) };
    }
    const minX = Math.min(obj.x, obj.x + (obj.w ?? 0));
    const maxX = Math.max(obj.x, obj.x + (obj.w ?? 0));
    const minY = Math.min(obj.y, obj.y + (obj.h ?? 0));
    const maxY = Math.max(obj.y, obj.y + (obj.h ?? 0));
    const w = maxX - minX;
    const h = maxY - minY;
    const padX = w < 16 ? (16 - w) / 2 : 0;
    const padY = h < 16 ? (16 - h) / 2 : 0;
    return { x: minX - padX, y: minY - padY, w: Math.max(16, w), h: Math.max(16, h) };
  }

  function drawSelection(ctx: CanvasRenderingContext2D, obj: CanvasObject) {
    const b = objectBounds(obj);
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5 / camera.zoom;
    ctx.setLineDash([6 / camera.zoom, 4 / camera.zoom]);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.setLineDash([]);
    // Corner handles
    const handleSize = 8 / camera.zoom;
    ctx.fillStyle = "#ffffff";
    for (const [cx, cy] of [
      [b.x, b.y],
      [b.x + b.w, b.y],
      [b.x, b.y + b.h],
      [b.x + b.w, b.y + b.h],
    ] as const) {
      ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
    }
    ctx.restore();
  }

  function drawMultiSelectionBox(ctx: CanvasRenderingContext2D, objs: CanvasObject[]) {
    if (!objs.length) return;
    const boxes = objs.map(objectBounds);
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w));
    const maxY = Math.max(...boxes.map((b) => b.y + b.h));

    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 2 / camera.zoom;
    ctx.setLineDash([8 / camera.zoom, 4 / camera.zoom]);
    ctx.strokeRect(minX - 6, minY - 6, maxX - minX + 12, maxY - minY + 12);
    ctx.fillStyle = "rgba(99, 102, 241, 0.06)";
    ctx.fillRect(minX - 6, minY - 6, maxX - minX + 12, maxY - minY + 12);
    ctx.restore();
  }

  function getMultiSelectionBounds(): { x: number; y: number; w: number; h: number } | null {
    const selectedObjs = page.objects.filter((o) =>
      selectedIds.length > 0 ? selectedIds.includes(o.id) : selectedId === o.id,
    );
    if (!selectedObjs.length) return null;
    const boxes = selectedObjs.map(objectBounds);
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w));
    const maxY = Math.max(...boxes.map((b) => b.y + b.h));
    return { x: minX - 6, y: minY - 6, w: maxX - minX + 12, h: maxY - minY + 12 };
  }

  function hitTest(pt: Point): CanvasObject | null {
    for (let i = page.objects.length - 1; i >= 0; i--) {
      const obj = page.objects[i];
      const b = objectBounds(obj);
      if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) {
        return obj;
      }
    }
    return null;
  }

  function getHandleAt(pt: Point, obj: CanvasObject): Handle {
    const b = objectBounds(obj);
    const h = 12 / camera.zoom;
    const corners: Array<[number, number, "nw" | "ne" | "sw" | "se"]> = [
      [b.x, b.y, "nw"],
      [b.x + b.w, b.y, "ne"],
      [b.x, b.y + b.h, "sw"],
      [b.x + b.w, b.y + b.h, "se"],
    ];
    for (const [cx, cy, corner] of corners) {
      if (Math.abs(pt.x - cx) < h && Math.abs(pt.y - cy) < h) return { type: "resize", corner };
    }
    return { type: "move" };
  }

  // ---- Pointer events with Stylus Palm Rejection & Multi-touch ----
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (wasPinchingRef.current) return;

    // Palm Rejection: If user is using a stylus, ignore touch events!
    if (e.pointerType === "pen") {
      isPenActiveRef.current = true;
    } else if (e.pointerType === "touch" && isPenActiveRef.current) {
      return;
    }

    touchMapRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Multi-touch pinch-to-zoom check (2 or more fingers)
    if (touchMapRef.current.size >= 2) {
      wasPinchingRef.current = true;
      if (drawingRef.current) {
        if (drawingRef.current.holdTimer) clearTimeout(drawingRef.current.holdTimer);
        drawingRef.current = null;
        clearOverlay();
      }
      return;
    }

    // Only set pointer capture for mouse or stylus. NEVER capture touch pointer!
    if (e.pointerType !== "touch") {
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // Pointer capture can fail if pointer is released or unsupported; safely ignore.
      }
    }

    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w = toWorld(sx, sy);
    const ptWithMeta: Point = { x: w.x, y: w.y, p: e.pressure || 0.5, t: Date.now() };

    // If currently editing text and clicked outside, close editor and commit text
    if (editingText) {
      const currentObj = page.objects.find((o) => o.id === editingText.id) as
        TextObject | undefined;
      if (currentObj && !currentObj.text.trim()) {
        deleteObject(editingText.id);
      }
      setEditingText(null);
      pushHistory();
    }

    // Double-tap gesture for touch screens
    const now = Date.now();
    const lastTap = lastTapRef.current;
    if (
      lastTap &&
      now - lastTap.time < 350 &&
      Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 25
    ) {
      lastTapRef.current = null;
      handleDoubleTap(w);
    } else {
      lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
    }

    // Pan
    if (e.button === 1 || tool === "pan") {
      panRef.current = { x: sx, y: sy, cam: { ...camera } };
      return;
    }

    // Lasso Selection
    if (tool === "lasso") {
      lassoRef.current = [w];
      drawLive();
      return;
    }

    // Select Tool
    if (tool === "select") {
      // Check multi-selection bounding box hit first
      const multiBounds = getMultiSelectionBounds();
      if (
        multiBounds &&
        selectedIds.length > 1 &&
        w.x >= multiBounds.x &&
        w.x <= multiBounds.x + multiBounds.w &&
        w.y >= multiBounds.y &&
        w.y <= multiBounds.y + multiBounds.h
      ) {
        multiDragRef.current = { start: w, initialCamera: { ...camera } };
        return;
      }

      const hit = hitTest(w);
      if (hit) {
        if (hit.kind === "periodic-table") {
          const clickedEl = getPeriodicElementAt(hit, w);
          if (clickedEl) {
            window.dispatchEvent(
              new CustomEvent("slate:inspect-element", { detail: { number: clickedEl.number } })
            );
          }
          const handle = selectedId === hit.id ? getHandleAt(w, hit) : { type: "move" as const };
          setSelected(hit.id);
          dragRef.current = { id: hit.id, handle, start: w, obj: structuredClone(hit) };
          return;
        }
        if (hit.kind === "tape") {
          toggleTapeReveal(hit.id);
          setSelected(hit.id);
          return;
        }
        if (hit.kind === "text") {
          setEditingText({ id: hit.id });
          setEditingTextValue(hit.text);
          setSelected(hit.id);
          return;
        }
        const handle = selectedId === hit.id ? getHandleAt(w, hit) : { type: "move" as const };
        setSelected(hit.id);
        dragRef.current = { id: hit.id, handle, start: w, obj: structuredClone(hit) };
      } else {
        setSelected(null);
        setSelectedIds([]);
      }
      return;
    }

    // Eraser object
    if (tool === "eraser-object") {
      const hit = hitTest(w);
      if (hit) {
        pushHistory();
        deleteObject(hit.id);
      }
      return;
    }

    // Eraser pixel (tap erase)
    if (tool === "eraser-pixel") {
      const eraseR = size * 4;
      let erasedAny = false;
      for (const obj of page.objects) {
        if ("points" in obj) {
          if (obj.points.some((p) => Math.hypot(p.x - w.x, p.y - w.y) < eraseR)) {
            if (!erasedAny) {
              pushHistory();
              erasedAny = true;
            }
            deleteObject(obj.id);
          }
        } else {
          const b = objectBounds(obj);
          if (
            w.x >= b.x - eraseR &&
            w.x <= b.x + b.w + eraseR &&
            w.y >= b.y - eraseR &&
            w.y <= b.y + b.h + eraseR
          ) {
            if (!erasedAny) {
              pushHistory();
              erasedAny = true;
            }
            deleteObject(obj.id);
          }
        }
      }
    }

    // Text tool
    if (tool === "text") {
      const hit = hitTest(w);
      if (hit && hit.kind === "text") {
        setEditingText({ id: hit.id });
        setEditingTextValue(hit.text);
        setSelected(hit.id);
        return;
      }
      const newId = uid();
      const t: TextObject = {
        id: newId,
        kind: "text",
        x: w.x,
        y: w.y,
        w: 240,
        h: 60,
        text: "Text",
        color,
        fontSize: 20,
      };
      addObject(t);
      setSelected(newId);
      setEditingText({ id: newId });
      setEditingTextValue("Text");
      setTool("select");
      pushHistory();
      return;
    }

    // Tap to reveal existing tape when using tape tool
    if (tool === "tape") {
      const hit = hitTest(w);
      if (hit && hit.kind === "tape") {
        toggleTapeReveal(hit.id);
        return;
      }
    }

    // Drawing tools
    const drawingSession = {
      points: [ptWithMeta],
      color,
      startedAt: Date.now(),
      lastMoveAt: Date.now(),
      snappedShape: null,
      holdTimer: undefined as number | undefined,
    };
    drawingRef.current = drawingSession;

    if (tool === "laser") laserRef.current = [ptWithMeta];
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (wasPinchingRef.current) return;
    if (e.pointerType === "touch" && isPenActiveRef.current) return;
    if (e.pointerType === "touch" && touchMapRef.current.size >= 2) return;

    touchMapRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w = toWorld(sx, sy);
    const ptWithMeta: Point = { x: w.x, y: w.y, p: e.pressure || 0.5, t: Date.now() };

    if (panRef.current) {
      setCamera({
        x: panRef.current.cam.x + (sx - panRef.current.x),
        y: panRef.current.cam.y + (sy - panRef.current.y),
        zoom: camera.zoom,
      });
      return;
    }

    if (multiDragRef.current) {
      const dx = w.x - multiDragRef.current.start.x;
      const dy = w.y - multiDragRef.current.start.y;
      moveSelected(dx, dy);
      multiDragRef.current.start = w;
      return;
    }

    if (dragRef.current) {
      const d = dragRef.current;
      const dx = w.x - d.start.x;
      const dy = w.y - d.start.y;
      const orig = d.obj;
      if (d.handle.type === "move") {
        if ("points" in orig) {
          updateObject(d.id, {
            points: orig.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
          } as Partial<CanvasObject>);
        } else {
          updateObject(d.id, { x: orig.x + dx, y: orig.y + dy } as Partial<CanvasObject>);
        }
      } else {
        if (!("points" in orig)) {
          let nx = orig.x,
            ny = orig.y,
            nw = orig.w,
            nh = orig.h;
          if (d.handle.corner === "se") {
            nw = orig.w + dx;
            nh = orig.h + dy;
          }
          if (d.handle.corner === "ne") {
            ny = orig.y + dy;
            nw = orig.w + dx;
            nh = orig.h - dy;
          }
          if (d.handle.corner === "sw") {
            nx = orig.x + dx;
            nw = orig.w - dx;
            nh = orig.h + dy;
          }
          if (d.handle.corner === "nw") {
            nx = orig.x + dx;
            ny = orig.y + dy;
            nw = orig.w - dx;
            nh = orig.h - dy;
          }
          updateObject(d.id, {
            x: nx,
            y: ny,
            w: Math.max(20, nw),
            h: Math.max(20, nh),
          } as Partial<CanvasObject>);
        }
      }
      return;
    }

    if (tool === "lasso" && lassoRef.current) {
      lassoRef.current.push(w);
      drawLive();
      return;
    }

    if (drawingRef.current) {
      const curDraw = drawingRef.current;
      curDraw.points.push(ptWithMeta);
      curDraw.lastMoveAt = Date.now();

      // Hold-to-snap detection
      const isPenDrawingTool =
        tool === "pen" ||
        tool === "fountain" ||
        tool === "crayon" ||
        tool === "highlighter" ||
        tool === "neon" ||
        tool === "rainbow" ||
        tool === "dashed";

      if ((autoSnapEnabled && isPenDrawingTool) || tool === "shape") {
        if (curDraw.holdTimer) clearTimeout(curDraw.holdTimer);
        // If pointer stops moving for > 400ms, snap to recognized shape!
        curDraw.holdTimer = window.setTimeout(() => {
          if (drawingRef.current && drawingRef.current.points.length >= 8) {
            const recognized = recognizeShape(drawingRef.current.points, color, size);
            if (recognized) {
              drawingRef.current.snappedShape = recognized;
              drawLive();
            }
          }
        }, 400);
      }

      if (tool === "eraser-pixel") {
        const eraseR = size * 4;
        for (const obj of page.objects) {
          if ("points" in obj) {
            const hit = obj.points.some((p) => Math.hypot(p.x - w.x, p.y - w.y) < eraseR);
            if (hit) deleteObject(obj.id);
          } else {
            const b = objectBounds(obj);
            const hit =
              w.x >= b.x - eraseR &&
              w.x <= b.x + b.w + eraseR &&
              w.y >= b.y - eraseR &&
              w.y <= b.y + b.h + eraseR;
            if (hit) deleteObject(obj.id);
          }
        }
      } else if (tool === "eraser-object") {
        const hit = hitTest(w);
        if (hit) deleteObject(hit.id);
      } else if (tool === "laser") {
        laserRef.current.push(ptWithMeta);
        const maxAge = 800;
        const drop =
          laserRef.current.length - Math.min(laserRef.current.length, Math.floor(maxAge / 8));
        if (drop > 0) laserRef.current.splice(0, drop);
      }
      drawLive();
    }
  }

  function commitShape(shape: Omit<ShapeStroke, "id">) {
    // If previous object was a hand-drawn stroke overlapping with this shape, remove it
    const sb = { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
    const toRemove: string[] = [];
    for (let i = page.objects.length - 1; i >= Math.max(0, page.objects.length - 3); i--) {
      const obj = page.objects[i];
      if ("points" in obj) {
        const ob = objectBounds(obj);
        const overlapW = Math.max(0, Math.min(sb.x + sb.w, ob.x + ob.w) - Math.max(sb.x, ob.x));
        const overlapH = Math.max(0, Math.min(sb.y + sb.h, ob.y + ob.h) - Math.max(sb.y, ob.y));
        const overlapArea = overlapW * overlapH;
        const minArea = Math.min(sb.w * sb.h, ob.w * ob.h);
        if (minArea > 0 && overlapArea / minArea > 0.35) {
          toRemove.push(obj.id);
        }
      }
    }
    for (const id of toRemove) {
      deleteObject(id);
    }
    addObject({ id: uid(), ...shape });
    pushHistory();
  }

  function handleDoubleTap(w: Point) {
    const hit = hitTest(w);
    if (!hit) return;

    if (hit.kind === "flashcard") {
      updateObject(hit.id, { flipped: !hit.flipped } as Partial<CanvasObject>);
    } else if (hit.kind === "quiz") {
      updateObject(hit.id, { revealed: !hit.revealed } as Partial<CanvasObject>);
    } else if (hit.kind === "tape") {
      toggleTapeReveal(hit.id);
    } else if (hit.kind === "graph") {
      const newFn = prompt("Edit mathematical function f(x):", hit.fn);
      if (newFn && newFn.trim()) {
        updateObject(hit.id, { fn: newFn.trim(), title: `f(x) = ${newFn.trim()}` } as Partial<CanvasObject>);
        pushHistory();
      }
    } else if (hit.kind === "formula") {
      const newLatex = prompt("Edit mathematical formula (LaTeX):", hit.latex);
      if (newLatex && newLatex.trim()) {
        updateObject(hit.id, { latex: newLatex.trim() } as Partial<CanvasObject>);
        pushHistory();
        toast.success("Updated math formula!");
      }
    } else if (hit.kind === "frame") {
      const newTitle = prompt("Rename presentation slide:", hit.title);
      if (newTitle && newTitle.trim()) {
        updateObject(hit.id, { title: newTitle.trim() } as Partial<CanvasObject>);
        pushHistory();
      }
    } else if (hit.kind === "roadmap") {
      const statuses: Array<RoadmapObject["status"]> = ["todo", "doing", "done"];
      const nextStatus = statuses[(statuses.indexOf(hit.status) + 1) % statuses.length];
      updateObject(hit.id, { status: nextStatus } as Partial<CanvasObject>);
    } else if (hit.kind === "table") {
      const cellInput = prompt("Edit Table Cell (Format: 'row, col, text', e.g. '1, 1, Velocity'):");
      if (cellInput) {
        const parts = cellInput.split(",").map((s) => s.trim());
        if (parts.length >= 3) {
          const r = parseInt(parts[0], 10) - 1;
          const c = parseInt(parts[1], 10) - 1;
          const val = parts.slice(2).join(",").trim();
          if (r >= 0 && r < hit.rows && c >= 0 && c < hit.cols) {
            const newData = hit.data.map((rowArr, ri) =>
              ri === r ? rowArr.map((cell, ci) => (ci === c ? val : cell)) : [...rowArr],
            );
            updateObject(hit.id, { data: newData } as Partial<CanvasObject>);
            pushHistory();
            toast.success(`Updated cell (${r + 1}, ${c + 1})!`);
          }
        }
      }
    } else if (hit.kind === "text") {
      setEditingText({ id: hit.id });
      setEditingTextValue(hit.text);
      setSelected(hit.id);
    } else if (hit.kind === "periodic-table") {
      const clickedEl = getPeriodicElementAt(hit, w);
      if (clickedEl) {
        window.dispatchEvent(
          new CustomEvent("slate:inspect-element", { detail: { number: clickedEl.number } })
        );
      }
    }
  }

  function onCanvasDoubleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w = toWorld(sx, sy);
    handleDoubleTap(w);
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    touchMapRef.current.delete(e.pointerId);
    if (wasPinchingRef.current || touchMapRef.current.size >= 1) {
      if (drawingRef.current) {
        if (drawingRef.current.holdTimer) clearTimeout(drawingRef.current.holdTimer);
        drawingRef.current = null;
        clearOverlay();
      }
      if (wasPinchingRef.current) return;
    }
    if (e.pointerType === "pen") {
      // Delay releasing pen exclusivity slightly to absorb trailing palm liftoff
      setTimeout(() => {
        isPenActiveRef.current = false;
      }, 250);
    }

    panRef.current = null;
    multiDragRef.current = null;

    if (dragRef.current) {
      pushHistory();
      dragRef.current = null;
      return;
    }

    // Lasso selection completion
    if (tool === "lasso" && lassoRef.current) {
      const polygon = lassoRef.current;
      lassoRef.current = null;
      clearOverlay();

      if (polygon.length >= 4) {
        const matchedIds: string[] = [];
        for (const obj of page.objects) {
          const b = objectBounds(obj);
          const center = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
          if (isPointInPolygon(center, polygon)) {
            matchedIds.push(obj.id);
          }
        }
        setSelectedIds(matchedIds);
      }
      return;
    }

    if (drawingRef.current) {
      const d = drawingRef.current;
      if (d.holdTimer) clearTimeout(d.holdTimer);
      drawingRef.current = null;
      clearOverlay();

      if (tool === "eraser-pixel" || tool === "eraser-object") {
        pushHistory();
        return;
      }

      if (tool === "laser") {
        fadeLaser();
        return;
      }

      if (d.points.length < 2) return;

      // Check for snapped or recognized shape (on hold OR on liftoff if autoSnap is enabled)
      let shapeToCommit: Omit<ShapeStroke, "id"> | null = d.snappedShape || null;
      if (!shapeToCommit && tool !== "tape" && tool !== "frame" && (autoSnapEnabled || tool === "shape") && d.points.length >= 6) {
        shapeToCommit = recognizeShape(d.points, color, size);
      }

      if (shapeToCommit) {
        commitShape(shapeToCommit);
        return;
      }

      const id = uid();
      if (tool === "shape") {
        addObject({ id, kind: "pen", color, size, points: d.points });
      } else if (tool === "pen") {
        addObject({ id, kind: "pen", color, size, points: d.points });
      } else if (tool === "fountain") {
        addObject({ id, kind: "fountain", color, size, points: d.points });
      } else if (tool === "neon") {
        addObject({ id, kind: "neon", color, size, points: d.points });
      } else if (tool === "crayon") {
        addObject({ id, kind: "crayon", color, size, points: d.points });
      } else if (tool === "highlighter") {
        addObject({ id, kind: "highlighter", color, size, points: d.points });
      } else if (tool === "rainbow") {
        addObject({ id, kind: "rainbow", color, size, points: d.points });
      } else if (tool === "dashed") {
        addObject({ id, kind: "dashed", color, size, points: d.points });
      } else if (tool === "brush") {
        addObject({ id, kind: "brush", color, size, points: d.points });
      } else if (tool === "marker") {
        addObject({ id, kind: "marker", color, size, points: d.points });
      } else if (tool === "pencil") {
        addObject({ id, kind: "pencil", color, size, points: d.points });
      } else if (tool === "glitter") {
        addObject({ id, kind: "glitter", color, size, points: d.points });
      } else if (tool === "dotted") {
        addObject({ id, kind: "dotted", color, size, points: d.points });
      } else if (tool === "parallel") {
        addObject({ id, kind: "parallel", color, size, points: d.points });
      } else if (tool === "tape") {
        const xs = d.points.map((p) => p.x);
        const ys = d.points.map((p) => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const tw = Math.max(50, maxX - minX);
        const th = Math.max(28, maxY - minY);
        addObject({
          id,
          kind: "tape",
          x: minX,
          y: minY,
          w: tw,
          h: th,
          color: color || "#fed7aa",
          revealed: false,
          pattern: "diagonal",
          label: "Tap to reveal",
        });
        toast.success("Study Tape placed! Tap to reveal answer.");
      } else if (tool === "frame") {
        const xs = d.points.map((p) => p.x);
        const ys = d.points.map((p) => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const fw = Math.max(220, maxX - minX);
        const fh = Math.max(140, maxY - minY);
        const existingFrames = page.objects.filter((o) => o.kind === "frame");
        addObject({
          id,
          kind: "frame",
          x: minX,
          y: minY,
          w: fw,
          h: fh,
          title: `Slide ${existingFrames.length + 1}`,
          order: existingFrames.length + 1,
          color: color || "#6366f1",
        });
        toast.success(`Presentation Slide ${existingFrames.length + 1} created!`);
      }
      pushHistory();
    }
  }

  function clearOverlay() {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
  }

  function fadeLaser() {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const fadeStart = Date.now();
    const fade = () => {
      const ctx = overlay.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.scale(dpr, dpr);
      ctx.save();
      ctx.translate(camera.x, camera.y);
      ctx.scale(camera.zoom, camera.zoom);
      const elapsed = Date.now() - fadeStart;
      const alpha = Math.max(0, 1 - elapsed / 600);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      const pts = laserRef.current;
      if (pts.length > 1) {
        ctx.moveTo(pts[0].x, pts[0].y);
        for (const p of pts) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      ctx.restore();
      if (alpha > 0) requestAnimationFrame(fade);
      else ctx.clearRect(0, 0, overlay.width, overlay.height);
    };
    fade();
  }

  function drawLive() {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.scale(dpr, dpr);
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    // Live Lasso Loop
    if (tool === "lasso" && lassoRef.current && lassoRef.current.length > 1) {
      ctx.strokeStyle = "#6366f1";
      ctx.lineWidth = 2 / camera.zoom;
      ctx.setLineDash([6 / camera.zoom, 4 / camera.zoom]);
      ctx.beginPath();
      ctx.moveTo(lassoRef.current[0].x, lassoRef.current[0].y);
      for (let i = 1; i < lassoRef.current.length; i++) {
        ctx.lineTo(lassoRef.current[i].x, lassoRef.current[i].y);
      }
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (!drawingRef.current) return ctx.restore();

    // If shape snapped live preview
    if (drawingRef.current.snappedShape) {
      drawShape(ctx, { id: "live", ...drawingRef.current.snappedShape });
      ctx.restore();
      return;
    }

    const pts = drawingRef.current.points;
    if (pts.length < 2) return ctx.restore();

    const dummyStroke: StrokeBase = { id: "", color, size, points: pts };

    if (tool === "fountain") {
      drawFountainStroke(ctx, dummyStroke);
    } else if (tool === "neon") {
      drawNeonStroke(ctx, dummyStroke);
    } else if (tool === "crayon") {
      drawCrayonStroke(ctx, dummyStroke);
    } else if (tool === "highlighter") {
      drawHighlighterStroke(ctx, dummyStroke);
    } else if (tool === "rainbow") {
      drawRainbow(ctx, dummyStroke);
    } else if (tool === "dashed") {
      ctx.setLineDash([size * 3, size * 3]);
      drawPenStroke(ctx, dummyStroke);
    } else if (tool === "brush") {
      drawBrushStroke(ctx, dummyStroke);
    } else if (tool === "marker") {
      drawMarkerStroke(ctx, dummyStroke);
    } else if (tool === "pencil") {
      drawPencilStroke(ctx, dummyStroke);
    } else if (tool === "glitter") {
      drawGlitterStroke(ctx, dummyStroke);
    } else if (tool === "dotted") {
      drawDottedStroke(ctx, dummyStroke);
    } else if (tool === "parallel") {
      drawParallelStroke(ctx, dummyStroke);
    } else if (tool === "laser") {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else if (tool === "eraser-pixel") {
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = size * 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else {
      drawPenStroke(ctx, dummyStroke);
    }
    ctx.restore();
  }

  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * 0.005);
      const newZoom = Math.min(5, Math.max(0.15, camera.zoom * factor));
      const wx = (sx - camera.x) / camera.zoom;
      const wy = (sy - camera.y) / camera.zoom;
      setCamera({ x: sx - wx * newZoom, y: sy - wy * newZoom, zoom: newZoom });
    } else {
      setCamera({ x: camera.x - e.deltaX, y: camera.y - e.deltaY, zoom: camera.zoom });
    }
  }

  const targetSelectionIds = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
  const selectionBounds = targetSelectionIds.length > 0 ? getMultiSelectionBounds() : null;
  const selectionScreenPos = selectionBounds
    ? toScreen(selectionBounds.x + selectionBounds.w / 2, selectionBounds.y - 14)
    : null;
  const clampedSelectionPos = selectionScreenPos
    ? {
        x: Math.max(160, Math.min(window.innerWidth - 160, selectionScreenPos.x)),
        y: Math.max(68, selectionScreenPos.y),
      }
    : null;

  const editing = editingText
    ? (page.objects.find((o) => o.id === editingText.id) as TextObject | undefined)
    : undefined;

  const PALETTE = [
    "#000000",
    "#334155",
    "#64748b",
    "#ffffff",
    "#ef4444",
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
  ];

  function exportSelectedRegionAsImage(targetIds: string[]): string | null {
    const selectedObjects = page.objects.filter((o) => targetIds.includes(o.id));
    if (selectedObjects.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const obj of selectedObjects) {
      const b = objectBounds(obj);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
    }

    const w = Math.max(50, maxX - minX);
    const h = Math.max(50, maxY - minY);
    const pad = 20;

    const offscreen = document.createElement("canvas");
    offscreen.width = w + pad * 2;
    offscreen.height = h + pad * 2;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return null;

    offCtx.fillStyle = "#ffffff";
    offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
    offCtx.translate(pad - minX, pad - minY);

    for (const obj of selectedObjects) {
      drawObject(offCtx, obj, false);
    }

    return offscreen.toDataURL("image/png");
  }

  async function handleConvertHandwritingToText() {
    const targetIds = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
    if (targetIds.length === 0) return;
    const img = exportSelectedRegionAsImage(targetIds);
    toast.info("Transcribing handwriting with AI...");
    const text = await AIEngine.transcribeHandwriting(img || undefined);

    let cx = 400;
    let cy = 300;
    const selectedObjects = page.objects.filter((o) => targetIds.includes(o.id));
    if (selectedObjects.length > 0) {
      const b = objectBounds(selectedObjects[0]);
      cx = b.x;
      cy = b.y;
    }

    pushHistory();
    deleteSelected();

    addObject({
      id: uid(),
      kind: "text",
      x: cx,
      y: cy,
      w: 260,
      h: 90,
      text,
      color: "#0f172a",
      fontSize: 18,
    });
    toast.success("Converted to editable text!");
  }

  async function handleConvertMath() {
    const targetIds = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
    if (targetIds.length === 0) return;
    const img = exportSelectedRegionAsImage(targetIds);
    toast.info("Recognizing math formula...");
    const latex = await AIEngine.recognizeMath(img || undefined);

    let cx = 400;
    let cy = 300;
    const selectedObjects = page.objects.filter((o) => targetIds.includes(o.id));
    if (selectedObjects.length > 0) {
      const b = objectBounds(selectedObjects[0]);
      cx = b.x;
      cy = b.y;
    }

    pushHistory();
    deleteSelected();

    addObject({
      id: uid(),
      kind: "formula",
      x: cx,
      y: cy,
      w: 280,
      h: 110,
      latex,
    });
    toast.success("Converted to math formula!");
  }

  async function handleSolveAndPlotMath() {
    const targetIds = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
    if (targetIds.length === 0) return;

    const selectedObjects = page.objects.filter((o) => targetIds.includes(o.id));
    let textHint = "";
    for (const obj of selectedObjects) {
      if (obj.kind === "formula") textHint = obj.latex;
      else if (obj.kind === "text" || obj.kind === "sticky") textHint = obj.text;
    }

    const img = exportSelectedRegionAsImage(targetIds);
    toast.info("Solving math & computing 2D plot...");
    const res = await AIEngine.solveMath(textHint || undefined, img || undefined);

    let cx = 400;
    let cy = 300;
    let maxW = 280;
    if (selectedObjects.length > 0) {
      const b = objectBounds(selectedObjects[0]);
      cx = b.x;
      cy = b.y;
      maxW = Math.max(280, b.w);
    }

    pushHistory();
    deleteSelected();

    // 1. Clean formula card
    const formulaId = uid();
    addObject({
      id: formulaId,
      kind: "formula",
      x: cx,
      y: cy,
      w: Math.max(280, maxW),
      h: 110,
      latex: res.latex,
      label: res.title || "SOLVED",
    });

    // 2. Step-by-step solution card directly beneath
    const stepsText =
      `📐 SOLUTION: ${res.solution}\n\n` +
      (res.steps?.length
        ? res.steps.map((s) => `• ${s}`).join("\n")
        : "Verified algebraic solution.");
    const solutionCardId = uid();
    addObject({
      id: solutionCardId,
      kind: "sticky",
      x: cx,
      y: cy + 124,
      w: Math.max(280, maxW),
      h: Math.min(260, Math.max(140, (res.steps?.length || 2) * 28 + 60)),
      text: stepsText,
      color: "#fef9c3",
    });

    // 3. Interactive 2D GraphObject right next to the formula if plottable
    if (res.graphableFn) {
      const graphId = uid();
      addObject({
        id: graphId,
        kind: "graph",
        x: cx + Math.max(300, maxW + 20),
        y: cy,
        w: 320,
        h: 234,
        fn: res.graphableFn,
        xMin: res.xRange?.[0] ?? -6,
        xMax: res.xRange?.[1] ?? 6,
        yMin: res.yRange?.[0] ?? -5,
        yMax: res.yRange?.[1] ?? 8,
        color: "#38bdf8",
        title: res.title || `Plot: ${res.latex}`,
      });
      toast.success("Solved, explained & 2D graph plotted on canvas!");
    } else {
      toast.success("Math solved with step-by-step reasoning!");
    }

    setSelected(formulaId);
  }

  async function handleSolveBoardMath() {
    const strokeKinds = new Set([
      "pen",
      "fountain",
      "neon",
      "crayon",
      "highlighter",
      "rainbow",
      "dashed",
      "brush",
      "marker",
      "pencil",
      "glitter",
      "dotted",
      "parallel",
      "formula",
      "text",
      "sticky",
    ]);

    const currentPage = pageRef.current || page;
    let targetObjects = currentPage.objects.filter((o) =>
      selectedIds.length > 0 ? selectedIds.includes(o.id) : selectedId ? o.id === selectedId : false,
    );

    if (targetObjects.length === 0) {
      // If no explicit selection, find all stroke & math objects on the current board
      targetObjects = currentPage.objects.filter((o) => strokeKinds.has(o.kind));
    }

    if (targetObjects.length === 0) {
      toast.info("Write a math equation on the board first (e.g. '15 * 8 =' or 'x^2 - 4 = 0')!");
      return;
    }

    const solveToastId = toast.loading("Analyzing handwriting & calculating math answer...");

    // Extract text hint if formula or text exists
    let textHint = "";
    for (const obj of targetObjects) {
      if (obj.kind === "formula") textHint = obj.latex;
      else if (obj.kind === "text" || obj.kind === "sticky") textHint = obj.text;
    }

    // Export bounding box of target objects to high-res image
    const b = targetObjects.reduce(
      (acc, obj) => {
        const ob = objectBounds(obj);
        return {
          minX: Math.min(acc.minX, ob.x),
          minY: Math.min(acc.minY, ob.y),
          maxX: Math.max(acc.maxX, ob.x + ob.w),
          maxY: Math.max(acc.maxY, ob.y + ob.h),
        };
      },
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    );

    const pad = 24;
    const w = Math.max(80, b.maxX - b.minX + pad * 2);
    const h = Math.max(80, b.maxY - b.minY + pad * 2);

    const offCanvas = document.createElement("canvas");
    offCanvas.width = Math.min(1200, Math.max(200, Math.round(w * 2)));
    offCanvas.height = Math.min(1200, Math.max(200, Math.round(h * 2)));
    const offCtx = offCanvas.getContext("2d");

    let imgDataUrl: string | undefined;
    if (offCtx) {
      offCtx.scale(offCanvas.width / w, offCanvas.height / h);
      offCtx.fillStyle = "#ffffff";
      offCtx.fillRect(0, 0, w, h);
      offCtx.translate(-b.minX + pad, -b.minY + pad);
      for (const obj of targetObjects) {
        drawObject(offCtx, obj, false);
      }
      imgDataUrl = offCanvas.toDataURL("image/png");
    }

    try {
      const res = await AIEngine.solveMath(textHint || undefined, imgDataUrl);
      toast.dismiss(solveToastId);

      if (!res || !res.solution) {
        toast.error("Could not decipher math. Please write clearly on the board.");
        return;
      }

      pushHistory();

      // Keep user's handwriting intact! Place answer directly next to the written equation
      const placeRight = b.maxX + 24;
      const placeDown = b.maxY + 20;

      const screenW = typeof window !== "undefined" ? window.innerWidth : 800;
      const rightInScreen = (placeRight - camera.x) * camera.zoom;

      const insertX = rightInScreen > screenW - 200 ? b.minX : placeRight;
      const insertY = rightInScreen > screenW - 200 ? placeDown : b.minY;

      // 1. Math Formula Answer badge
      const formulaId = uid();
      addObject({
        id: formulaId,
        kind: "formula",
        x: insertX,
        y: insertY,
        w: Math.max(180, res.solution.length * 12 + 60),
        h: 70,
        latex: `= ${res.solution}`,
        label: `SOLVED: ${res.solution}`,
        color: "#8b5cf6",
      });

      // 2. If steps exist, add sticky note solution card below
      if (res.steps && res.steps.length > 0) {
        const solutionCardId = uid();
        const stepsText =
          `📐 MATH SOLUTION\nResult: ${res.solution}\n\n` +
          res.steps.map((s) => `• ${s}`).join("\n");

        addObject({
          id: solutionCardId,
          kind: "sticky",
          x: insertX,
          y: insertY + 82,
          w: Math.max(220, Math.min(320, (res.title || "").length * 8 + 120)),
          h: Math.min(240, Math.max(120, res.steps.length * 24 + 60)),
          text: stepsText,
          color: "#fef9c3",
        });
      }

      // 3. If plottable graph, add graph alongside
      if (res.graphableFn) {
        const graphId = uid();
        addObject({
          id: graphId,
          kind: "graph",
          x: insertX + 240,
          y: insertY,
          w: 300,
          h: 220,
          fn: res.graphableFn,
          xMin: res.xRange?.[0] ?? -5,
          xMax: res.xRange?.[1] ?? 5,
          yMin: res.yRange?.[0] ?? -5,
          yMax: res.yRange?.[1] ?? 5,
          color: "#06b6d4",
          title: res.title || `Plot: ${res.latex}`,
        });
      }

      setSelected(formulaId);
      toast.success(`Calculated: ${res.solution}`);
    } catch (err) {
      toast.dismiss(solveToastId);
      console.error(err);
      toast.error("Failed to solve handwritten math.");
    }
  }

  async function handleBeautifySketch() {
    const targetIds = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
    if (targetIds.length === 0) return;

    const selectedObjects = page.objects.filter((o) => targetIds.includes(o.id));
    const strokeObjs = selectedObjects.filter(
      (o): o is CanvasObject & StrokeBase =>
        "points" in o && "color" in o && "size" in o && Array.isArray((o as any).points) && (o as any).points.length >= 4,
    );

    if (strokeObjs.length === 0) {
      toast.info("Select drawn ink strokes to beautify into crisp shapes.");
      return;
    }

    pushHistory();
    let beautifiedCount = 0;

    for (const stroke of strokeObjs) {
      const recognized = recognizeShape(stroke.points, stroke.color, stroke.size);
      if (recognized) {
        deleteObject(stroke.id);
        addObject({
          ...recognized,
          id: uid(),
        });
        beautifiedCount++;
      }
    }

    if (beautifiedCount > 0) {
      toast.success(`Beautified ${beautifiedCount} sketch(es) into geometric shapes!`);
    } else {
      // Fallback: smooth to circle or rectangle
      const b = objectBounds(strokeObjs[0]);
      deleteObject(strokeObjs[0].id);
      const isRound = Math.abs(b.w - b.h) < 30;
      addObject({
        id: uid(),
        kind: "shape",
        shape: isRound ? "circle" : "rect",
        color: strokeObjs[0].color || "#3b82f6",
        size: strokeObjs[0].size || 2,
        x: b.x,
        y: b.y,
        w: b.w,
        h: b.h,
      });
      toast.success("Smoothed and converted into geometric vector shape!");
    }
  }

  async function handleGenerateMindMapFromSelection() {
    const targetIds = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
    if (targetIds.length === 0) return;

    const selectedObjects = page.objects.filter((o) => targetIds.includes(o.id));
    let topic = "";
    for (const obj of selectedObjects) {
      if (obj.kind === "text" || obj.kind === "sticky") topic += " " + obj.text;
      else if (obj.kind === "formula") topic += " " + obj.latex;
    }

    let bounds = { x: 500, y: 400, w: 200, h: 100 };
    if (selectedObjects.length > 0) {
      bounds = objectBounds(selectedObjects[0]);
    }

    if (!topic.trim()) {
      const img = exportSelectedRegionAsImage(targetIds);
      if (img) {
        toast.info("Analyzing selected drawing with AI...");
        topic = await AIEngine.transcribeHandwriting(img);
      }
    }

    toast.info("Generating connected concept mind map...");
    const tree = await AIEngine.generateMindMap(
      topic.trim() || "Concept Architecture",
      bounds.x + bounds.w + 240,
      bounds.y,
    );

    pushHistory();
    function addTreeNodes(n: MindMapNode) {
      addObject({
        id: n.id,
        kind: "mindmap-node",
        x: n.x,
        y: n.y,
        w: Math.max(120, n.label.length * 8 + 30),
        h: 44,
        label: n.label,
        level: n.level,
        color: n.color,
        parentId: n.parentId,
      });
      if (n.children) {
        n.children.forEach(addTreeNodes);
      }
    }

    addTreeNodes(tree);
    toast.success("Concept mind map branches placed on canvas!");
  }

  async function handleCreateFlashcardsFromSelection() {
    const targetIds = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
    if (targetIds.length === 0) return;

    const selectedObjects = page.objects.filter((o) => targetIds.includes(o.id));
    let content = "";
    for (const obj of selectedObjects) {
      if (obj.kind === "text" || obj.kind === "sticky") content += "\n" + obj.text;
      else if (obj.kind === "formula") content += "\n" + obj.latex;
    }

    let bounds = { x: 400, y: 300, w: 200, h: 100 };
    if (selectedObjects.length > 0) {
      bounds = objectBounds(selectedObjects[0]);
    }

    if (!content.trim()) {
      const img = exportSelectedRegionAsImage(targetIds);
      if (img) {
        toast.info("Extracting concept terms with AI...");
        content = await AIEngine.transcribeHandwriting(img);
      }
    }

    toast.info("Generating spaced-repetition flashcards...");
    const cards = await AIEngine.generateFlashcards(content.trim() || "Whiteboard Concept");

    pushHistory();
    cards.slice(0, 3).forEach((card, idx) => {
      addObject({
        id: uid(),
        kind: "flashcard",
        x: bounds.x + (idx % 2) * 260,
        y: bounds.y + bounds.h + 24 + Math.floor(idx / 2) * 160,
        w: 240,
        h: 140,
        front: card.front,
        back: card.back,
        flipped: false,
      });
    });

    toast.success(`Generated ${Math.min(3, cards.length)} flashcard(s) on canvas!`);
  }

  async function handleConvertDiagram() {
    const targetIds = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
    if (targetIds.length === 0) return;
    const img = exportSelectedRegionAsImage(targetIds);
    toast.info("Converting diagram to flowchart...");

    let cx = 350;
    let cy = 250;
    const selectedObjects = page.objects.filter((o) => targetIds.includes(o.id));
    if (selectedObjects.length > 0) {
      const b = objectBounds(selectedObjects[0]);
      cx = b.x;
      cy = b.y;
    }

    const nodes = await AIEngine.convertDiagram(img || undefined, "Process Flow", cx, cy);

    pushHistory();
    deleteSelected();

    nodes.forEach((n) => {
      addObject({
        id: n.id,
        kind: "diagram-node",
        x: n.x,
        y: n.y,
        w: n.w,
        h: n.h,
        nodeType: n.type,
        label: n.label,
        connectedTo: n.connectedTo,
      });
    });
    toast.success("Converted to structured flowchart!");
  }

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden touch-none select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onCanvasDoubleClick}
        onWheel={onWheel}
        style={{
          cursor:
            tool === "pan"
              ? "grab"
              : tool === "select"
                ? "default"
                : tool === "lasso"
                  ? "crosshair"
                  : "crosshair",
        }}
      />
      <canvas ref={overlayRef} className="absolute inset-0 pointer-events-none" />

      {/* Minimap Popup */}
      {minimapOpen && (
        <div
          className={cn(
            "pointer-events-auto absolute bottom-28 sm:bottom-16 right-3 sm:right-4 z-20 overflow-hidden rounded-2xl bg-card/95 p-2.5 shadow-2xl ring-1 ring-border backdrop-blur-md animate-in fade-in zoom-in-95 transition-all duration-200",
            minimapExpanded ? "w-[285px]" : "w-[210px]",
          )}
        >
          <div className="flex items-center justify-between pb-1.5 px-1 border-b border-border/80 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <Compass className="h-3.5 w-3.5 text-sky-500" />
              <span>Live Radar</span>
              <span className="text-[10px] text-muted-foreground font-normal ml-0.5">({page.objects.length})</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMinimapExpanded(!minimapExpanded)}
                title={minimapExpanded ? "Compact Radar" : "Expand Radar"}
                className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground transition text-[10px]"
              >
                {minimapExpanded ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              </button>
              <button
                type="button"
                onClick={() => setMinimapOpen(false)}
                className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <canvas
            ref={minimapCanvasRef}
            width={minimapExpanded ? 260 : 190}
            height={minimapExpanded ? 160 : 115}
            onPointerDown={handleMinimapPointerDown}
            onPointerMove={handleMinimapPointerMove}
            onPointerUp={handleMinimapPointerUp}
            onPointerCancel={handleMinimapPointerUp}
            className="rounded-xl cursor-crosshair border border-sky-950/40 shadow-inner w-full touch-none select-none"
          />
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground px-1">
            <span className="flex items-center gap-1">
              <Move className="h-3 w-3 text-muted-foreground/70" /> Drag to pan
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCamera({ x: 0, y: 0, zoom: 1 })}
                className="hover:text-foreground transition"
              >
                100%
              </button>
              <button
                onClick={fitToContent}
                className="text-sky-500 hover:text-sky-400 font-semibold flex items-center gap-0.5"
              >
                <Maximize2 className="h-3 w-3" /> Fit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Zoom & Canvas Tools */}
      <div className="pointer-events-auto absolute bottom-20 right-3 sm:bottom-4 sm:right-4 z-20 flex items-center gap-1 rounded-full bg-white dark:bg-slate-900 bg-card/95 px-2 py-1 shadow-lg ring-1 ring-border backdrop-blur">
        <button
          type="button"
          onClick={zoomOut}
          title="Zoom out (-)"
          className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent text-foreground transition active:scale-90"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={resetZoom}
          title="Reset zoom to 100%"
          className="px-1.5 py-0.5 text-xs font-semibold tabular-nums text-foreground hover:bg-accent rounded-md transition active:scale-95"
        >
          {Math.round(camera.zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={zoomIn}
          title="Zoom in (+)"
          className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent text-foreground transition active:scale-90"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>

        <div className="h-3.5 w-px bg-border mx-0.5" />

        {/* Fit to Content */}
        <button
          type="button"
          onClick={fitToContent}
          title="Fit all content to view"
          className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent text-foreground transition active:scale-90"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>

        {/* Minimap Toggle */}
        <button
          type="button"
          onClick={() => setMinimapOpen(!minimapOpen)}
          title="Toggle Radar Minimap"
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full transition active:scale-90",
            minimapOpen ? "bg-sky-500 text-white shadow-sm" : "hover:bg-accent text-foreground",
          )}
        >
          <Compass className="h-3.5 w-3.5" />
        </button>

        {/* Study Tape Reveal All Toggle */}
        {hasTape && (
          <button
            type="button"
            onClick={() => setAllTapeReveal(!allTapeRevealed)}
            title={allTapeRevealed ? "Hide all study tape" : "Reveal all study tape"}
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-amber-500/10 text-amber-500 transition active:scale-90"
          >
            {allTapeRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}

        {/* Presentation Mode Toggle - ALWAYS visible to present any board */}
        <button
          type="button"
          onClick={startPresentation}
          title="Start Lecture Presentation (Slides Mode)"
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full transition active:scale-90",
            isPresenting
              ? "bg-indigo-600 text-white shadow-sm"
              : "hover:bg-indigo-500/15 text-indigo-500",
          )}
        >
          <MonitorPlay className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Presentation Mode Overlay */}
      {isPresenting && (
        <div className="pointer-events-auto fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 sm:gap-3 rounded-full bg-slate-900/95 text-white px-3 sm:px-5 py-2 sm:py-2.5 shadow-2xl ring-1 ring-white/20 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 max-w-[95vw]">
          {/* Slide Indicator & Title (click to open slide picker) */}
          <div className="relative">
            <button
              onClick={() => setSlidePickerOpen(!slidePickerOpen)}
              className="flex items-center gap-2 pr-2.5 border-r border-white/20 text-xs font-semibold hover:text-indigo-300 transition"
              title="View all presentation slides"
            >
              <MonitorPlay className="h-4 w-4 text-indigo-400 shrink-0" />
              <span className="max-w-[120px] sm:max-w-[180px] truncate text-left">
                {presentationFrames[currentSlideIdx]?.title || `Slide ${currentSlideIdx + 1}`}
              </span>
            </button>

            {/* Slide Picker Popover */}
            {slidePickerOpen && (
              <div className="absolute bottom-full left-0 mb-3 w-64 max-h-72 overflow-y-auto rounded-2xl bg-slate-900 p-2 shadow-2xl ring-1 ring-white/20 backdrop-blur-md z-50">
                <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-slate-300 border-b border-white/10 mb-1">
                  <span>Slides ({presentationFrames.length})</span>
                  <button
                    onClick={() => {
                      captureCurrentViewAsSlide();
                      setSlidePickerOpen(false);
                    }}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add Slide
                  </button>
                </div>
                <div className="space-y-1">
                  {presentationFrames.map((f, i) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        goToSlide(i);
                        setSlidePickerOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs text-left transition",
                        i === currentSlideIdx
                          ? "bg-indigo-600 text-white font-medium"
                          : "text-slate-300 hover:bg-white/10",
                      )}
                    >
                      <span className="truncate">{f.title || `Slide ${i + 1}`}</span>
                      <span className="font-mono text-[10px] opacity-75">{i + 1}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Navigation Prev / Next */}
          <div className="flex items-center gap-1 text-xs text-slate-300">
            <button
              onClick={() => goToSlide(currentSlideIdx - 1)}
              disabled={currentSlideIdx === 0}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30 transition"
              title="Previous slide (Left Arrow)"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-mono text-xs px-1 select-none tabular-nums">
              {currentSlideIdx + 1}/{Math.max(1, presentationFrames.length)}
            </span>
            <button
              onClick={() => goToSlide(currentSlideIdx + 1)}
              disabled={currentSlideIdx >= presentationFrames.length - 1}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30 transition"
              title="Next slide (Right Arrow / Space)"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="h-4 w-px bg-white/20 mx-0.5" />

          {/* Presenter Tools: Laser, Pen, Pointer */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTool("laser")}
              title="Laser Pointer (Live Spotlight)"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full transition text-xs",
                tool === "laser"
                  ? "bg-rose-600 text-white shadow-lg"
                  : "text-rose-400 hover:bg-white/10",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setTool("pen")}
              title="Live Pen Annotation"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full transition text-xs",
                tool === "pen"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-indigo-400 hover:bg-white/10",
              )}
            >
              <PenTool className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setTool("select")}
              title="Pointer / Pan"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full transition text-xs",
                tool === "select"
                  ? "bg-white/20 text-white shadow-lg"
                  : "text-slate-400 hover:bg-white/10",
              )}
            >
              <MousePointer2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-white/20 mx-0.5" />

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition"
            title={isFullscreen ? "Exit Fullscreen (F)" : "Enter Fullscreen (F)"}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>

          {/* Exit Presentation Mode */}
          <button
            onClick={() => setIsPresenting(false)}
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition ml-1"
            title="Exit Presentation Mode (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Floating Action Bar for Selection (Single & Multi Selection) */}
      {clampedSelectionPos && (
        <div
          className="pointer-events-auto absolute flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-full bg-card/95 px-2.5 py-1.5 shadow-xl ring-1 ring-border backdrop-blur z-20"
          style={{ left: clampedSelectionPos.x, top: clampedSelectionPos.y }}
        >
          <div className="flex items-center gap-1 text-xs font-semibold text-primary px-1.5 border-r border-border">
            <span>{targetSelectionIds.length}</span> {targetSelectionIds.length === 1 ? "item" : "items"}
          </div>

          {/* 1. Solve Math & Plot */}
          <button
            onClick={handleSolveAndPlotMath}
            title="Solve Math & Plot 2D Function"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-purple-500/10 text-purple-600 transition"
          >
            <Calculator className="h-4 w-4" />
          </button>

          {/* 2. Handwriting → Math Formula (LaTeX) */}
          <button
            onClick={handleConvertMath}
            title="Convert Handwriting → Math Formula (LaTeX)"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-violet-500/10 text-violet-500 transition"
          >
            <Sigma className="h-4 w-4" />
          </button>

          {/* 3. Handwriting → Text */}
          <button
            onClick={handleConvertHandwritingToText}
            title="Convert Handwriting → Text"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-primary/10 text-primary transition"
          >
            <Type className="h-4 w-4" />
          </button>

          {/* 3. Clean Up Sketch / Beautify */}
          <button
            onClick={handleBeautifySketch}
            title="Clean Up Sketch → Geometric Vector Shape"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-amber-500/10 text-amber-500 transition"
          >
            <Sparkles className="h-4 w-4" />
          </button>

          {/* 4. Mind-Map from Selection */}
          <button
            onClick={handleGenerateMindMapFromSelection}
            title="Generate Concept Mind-Map"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-indigo-500/10 text-indigo-500 transition"
          >
            <GitBranch className="h-4 w-4" />
          </button>

          {/* 5. Create Flashcards */}
          <button
            onClick={handleCreateFlashcardsFromSelection}
            title="Create Study Flashcards"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-emerald-500/10 text-emerald-500 transition"
          >
            <Layers className="h-4 w-4" />
          </button>

          {/* 6. Diagram → Flowchart */}
          <button
            onClick={handleConvertDiagram}
            title="Convert to Structured Flowchart"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-teal-500/10 text-teal-500 transition"
          >
            <Workflow className="h-4 w-4" />
          </button>

          {/* 7. Conceal with Study Tape */}
          <button
            onClick={() => {
              const bounds = selectionBounds;
              if (!bounds) return;
              const uid = Math.random().toString(36).slice(2, 10);
              addObject({
                id: uid,
                kind: "tape",
                x: bounds.x,
                y: bounds.y,
                w: bounds.w,
                h: bounds.h,
                color: "#fed7aa",
                revealed: false,
                pattern: "diagonal",
                label: "Tap to reveal",
              });
              pushHistory();
              toast.success("Masked with Study Tape!");
            }}
            title="Conceal with Study Tape"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-orange-500/10 text-orange-500 transition"
          >
            <EyeOff className="h-4 w-4" />
          </button>

          {/* 8. Ask AI Sheet */}
          {onOpenAI && (
            <button
              onClick={() => onOpenAI()}
              title="Ask AI Assistant about Selection"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-sky-500/10 text-sky-500 transition"
            >
              <Wand2 className="h-4 w-4" />
            </button>
          )}

          <div className="h-4 w-px bg-border mx-0.5" />

          <button
            onClick={() => {
              pushHistory();
              duplicateSelected();
            }}
            title="Duplicate"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent text-foreground transition"
          >
            <Copy className="h-4 w-4" />
          </button>
          <div className="relative">
            <button
              onClick={() => setRecolorPickerOpen(!recolorPickerOpen)}
              title="Recolor"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent text-foreground transition"
            >
              <Palette className="h-4 w-4" />
            </button>
            {recolorPickerOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 flex gap-1 p-2 rounded-xl bg-card shadow-xl ring-1 ring-border">
                {PALETTE.slice(0, 7).map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      pushHistory();
                      recolorSelected(c);
                      setRecolorPickerOpen(false);
                    }}
                    className="h-6 w-6 rounded-full border border-border"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              pushHistory();
              deleteSelected();
            }}
            title="Delete"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-destructive/10 text-destructive transition"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}

      {editing && (
        <div
          className="pointer-events-auto absolute z-30 flex flex-col gap-1.5 select-none"
          style={{
            left: editing.x * camera.zoom + camera.x,
            top: editing.y * camera.zoom + camera.y,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {/* Action bar with Done, font size, and delete */}
          <div className="flex items-center gap-2 self-start rounded-xl bg-card/95 px-3 py-1.5 shadow-xl ring-1 ring-border backdrop-blur">
            <button
              type="button"
              onClick={() => {
                const val = editingTextValue.trim();
                if (!val) {
                  deleteObject(editing.id);
                } else {
                  updateObject(editing.id, { text: editingTextValue } as Partial<CanvasObject>);
                  pushHistory();
                }
                setEditingText(null);
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition active:scale-95"
            >
              <Check className="h-3.5 w-3.5" /> Done
            </button>
            <div className="h-3.5 w-px bg-border" />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => {
                  const newSize = Math.max(12, (editing.fontSize || 20) - 2);
                  updateObject(editing.id, { fontSize: newSize } as Partial<CanvasObject>);
                }}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-accent text-foreground text-xs font-bold"
                title="Smaller text"
              >
                -
              </button>
              <span className="text-[11px] font-mono">{editing.fontSize || 20}</span>
              <button
                type="button"
                onClick={() => {
                  const newSize = Math.min(72, (editing.fontSize || 20) + 2);
                  updateObject(editing.id, { fontSize: newSize } as Partial<CanvasObject>);
                }}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-accent text-foreground text-xs font-bold"
                title="Larger text"
              >
                +
              </button>
            </div>
            <div className="h-3.5 w-px bg-border" />
            <button
              type="button"
              onClick={() => {
                deleteObject(editing.id);
                setEditingText(null);
                pushHistory();
              }}
              title="Delete text"
              className="text-destructive hover:opacity-80 transition active:scale-95 p-0.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <textarea
            ref={textareaRef}
            className="rounded-xl border-2 border-primary bg-card/95 p-3 text-foreground shadow-2xl outline-none resize-none backdrop-blur font-sans focus:ring-2 focus:ring-primary/20"
            style={{
              width: Math.max(240, editing.w * camera.zoom),
              minHeight: Math.max(70, editing.h * camera.zoom),
              fontSize: Math.max(14, (editing.fontSize || 20) * camera.zoom),
              color: editing.color || "inherit",
              lineHeight: 1.3,
            }}
            value={editingTextValue}
            onChange={(e) => {
              const val = e.target.value;
              setEditingTextValue(val);
              updateObject(editing.id, { text: val } as Partial<CanvasObject>);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                const val = editingTextValue.trim();
                if (!val) {
                  deleteObject(editing.id);
                } else {
                  updateObject(editing.id, { text: editingTextValue } as Partial<CanvasObject>);
                  pushHistory();
                }
                setEditingText(null);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
