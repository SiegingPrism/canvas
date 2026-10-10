import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Minus,
  Mic,
  MicOff,
  LineChart,
  StickyNote,
  Sparkles,
} from "lucide-react";
import { useWhiteboard } from "@/lib/whiteboard/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AIEngine, aiErrorMessage } from "@/lib/ai/aiEngine";
import { compileMathFunction } from "@/lib/whiteboard/safeMath";

export function TimerWidget() {
  const [total, setTotal] = useState(60);
  const [remaining, setRemaining] = useState(60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="space-y-3 text-center">
      <div className="text-5xl font-bold tabular-nums">
        {mm}:{ss}
      </div>
      <div className="flex items-center justify-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            setTotal((t) => Math.max(10, t - 30));
            setRemaining((r) => Math.max(0, r - 30));
          }}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="default" onClick={() => setRunning((r) => !r)}>
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            setRunning(false);
            setRemaining(total);
          }}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            setTotal((t) => t + 30);
            setRemaining((r) => r + 30);
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function StopwatchWidget() {
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const start = Date.now() - ms;
    const t = setInterval(() => setMs(Date.now() - start), 50);
    return () => clearInterval(t);
  }, [running, ms]);

  const total = Math.floor(ms / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  const cs = String(Math.floor((ms % 1000) / 10)).padStart(2, "0");

  return (
    <div className="space-y-3 text-center">
      <div className="text-4xl font-bold tabular-nums">
        {mm}:{ss}
        <span className="text-2xl text-muted-foreground">.{cs}</span>
      </div>
      <div className="flex items-center justify-center gap-1">
        <Button size="icon" variant="default" onClick={() => setRunning((r) => !r)}>
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            setRunning(false);
            setMs(0);
          }}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
export function DiceWidget() {
  const [val, setVal] = useState(3);
  const [rolling, setRolling] = useState(false);
  function roll() {
    setRolling(true);
    let i = 0;
    const tick = setInterval(() => {
      setVal(1 + Math.floor(Math.random() * 6));
      if (++i > 8) {
        clearInterval(tick);
        setRolling(false);
      }
    }, 60);
  }
  return (
    <div className="space-y-3 text-center">
      <div className={`text-7xl leading-none transition-transform ${rolling ? "rotate-12" : ""}`}>
        {DICE_FACES[val - 1]}
      </div>
      <Button onClick={roll} disabled={rolling}>
        Roll
      </Button>
    </div>
  );
}

export function ScoreWidget() {
  const [teams, setTeams] = useState([
    { name: "Team A", score: 0 },
    { name: "Team B", score: 0 },
  ]);
  return (
    <div className="space-y-2">
      {teams.map((t, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/60 p-2">
          <input
            className="flex-1 bg-transparent text-sm font-medium outline-none"
            value={t.name}
            onChange={(e) =>
              setTeams(teams.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
            }
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={() =>
              setTeams(
                teams.map((x, j) => (j === i ? { ...x, score: Math.max(0, x.score - 1) } : x)),
              )
            }
          >
            <Minus className="h-4 w-4" />
          </Button>
          <div className="w-10 text-center text-lg font-bold tabular-nums">{t.score}</div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() =>
              setTeams(teams.map((x, j) => (j === i ? { ...x, score: x.score + 1 } : x)))
            }
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        variant="ghost"
        className="w-full"
        onClick={() =>
          setTeams([...teams, { name: `Team ${String.fromCharCode(65 + teams.length)}`, score: 0 }])
        }
      >
        <Plus className="h-4 w-4" /> Add team
      </Button>
    </div>
  );
}

export function CalculatorWidget() {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState("");
  function press(k: string) {
    if (k === "=") {
      try {
        const val = Function(
          `"use strict"; return (${expr.replace(/×/g, "*").replace(/÷/g, "/")})`,
        )();
        setResult(String(val));
      } catch {
        setResult("Error");
      }
    } else if (k === "C") {
      setExpr("");
      setResult("");
    } else if (k === "⌫") {
      setExpr((e) => e.slice(0, -1));
    } else {
      setExpr((e) => e + k);
    }
  }
  const keys = [
    "C",
    "⌫",
    "(",
    ")",
    "7",
    "8",
    "9",
    "÷",
    "4",
    "5",
    "6",
    "×",
    "1",
    "2",
    "3",
    "-",
    "0",
    ".",
    "=",
    "+",
  ];
  return (
    <div className="w-56 space-y-2">
      <div className="rounded-lg bg-muted p-2 text-right">
        <div className="text-xs text-muted-foreground truncate">{expr || "0"}</div>
        <div className="text-2xl font-bold tabular-nums">{result || "0"}</div>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {keys.map((k) => (
          <Button
            key={k}
            variant={k === "=" ? "default" : "ghost"}
            className="h-10"
            onClick={() => press(k)}
          >
            {k}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function VoiceNoteWidget() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const { addObject, pushHistory, camera } = useWhiteboard();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }
    const recog = new SpeechRecognition();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = "en-US";

    recog.onresult = (event: any) => {
      let finalStr = "";
      let interimStr = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalStr += event.results[i][0].transcript + " ";
        } else {
          interimStr += event.results[i][0].transcript;
        }
      }
      if (finalStr) setTranscript((prev) => (prev ? prev + " " + finalStr.trim() : finalStr.trim()));
      setInterim(interimStr);
    };

    recog.onerror = (e: any) => {
      console.warn("Speech recognition error:", e);
      setIsListening(false);
    };

    recog.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recog;
    return () => {
      try {
        recog.stop();
      } catch {}
    };
  }, []);

  const toggleListen = () => {
    if (!recognitionRef.current) {
      if (!isSupported) {
        toast.info("Voice recognition isn't natively supported in this browser; you can type in the note.");
      }
      return;
    }
    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const dropAsSticky = () => {
    const fullText = (transcript + (interim ? " " + interim : "")).trim();
    if (!fullText) {
      toast.error("Speak or type something first to capture a sticky note!");
      return;
    }
    const uid = Math.random().toString(36).slice(2, 10);
    const cx = (window.innerWidth / 2 - camera.x) / camera.zoom;
    const cy = (window.innerHeight / 2 - camera.y) / camera.zoom;
    addObject({
      id: uid,
      kind: "sticky",
      x: cx - 90,
      y: cy - 90,
      w: 190,
      h: 190,
      text: fullText,
      color: "#fed7aa",
    });
    pushHistory();
    toast.success("Voice note placed as Sticky Note on canvas!");
  };

  const createMindMap = async () => {
    const fullText = (transcript + (interim ? " " + interim : "")).trim();
    if (!fullText) {
      toast.error("Speak first to generate a mind map!");
      return;
    }
    toast.info("Generating mind map from spoken ideas...");
    try {
      const cx = (window.innerWidth / 2 - camera.x) / camera.zoom;
      const cy = (window.innerHeight / 2 - camera.y) / camera.zoom;
      const tree = await AIEngine.generateMindMap(fullText.slice(0, 1500), cx, cy);
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
      toast.success("AI Mind-Map generated from your speech!");
    } catch (err) {
      toast.error(aiErrorMessage(err, "Could not generate mind map"));
    }
  };

  return (
    <div className="w-72 space-y-3 p-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Voice Transcriber
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full",
            isListening ? "bg-red-500/10 text-red-500 animate-pulse" : "bg-muted text-muted-foreground",
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", isListening ? "bg-red-500" : "bg-muted-foreground")} />
          {isListening ? "Listening..." : "Idle"}
        </span>
      </div>

      <div className="min-h-24 max-h-36 overflow-y-auto rounded-xl border border-border bg-muted/40 p-2.5 text-xs leading-relaxed text-foreground select-text">
        {transcript || interim ? (
          <>
            <span>{transcript}</span>
            {interim && <span className="text-muted-foreground italic"> {interim}</span>}
          </>
        ) : (
          <span className="text-muted-foreground italic">
            {isSupported
              ? "Tap the microphone and start speaking..."
              : "Speech recognition not supported in this browser. Try Chrome/Edge or Safari."}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant={isListening ? "destructive" : "default"}
          className="flex-1 gap-1.5"
          onClick={toggleListen}
        >
          {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          {isListening ? "Stop Mic" : "Start Mic"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setTranscript("");
            setInterim("");
          }}
          title="Clear text"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-border">
        <Button size="sm" variant="secondary" className="gap-1 text-xs" onClick={dropAsSticky}>
          <StickyNote className="h-3.5 w-3.5 text-amber-500" /> Drop Sticky
        </Button>
        <Button size="sm" variant="secondary" className="gap-1 text-xs" onClick={createMindMap}>
          <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Mind Map
        </Button>
      </div>
    </div>
  );
}

export function MathGraphWidget() {
  const [fn, setFn] = useState("sin(x)");
  const [xMin] = useState(-6);
  const [xMax] = useState(6);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { addObject, pushHistory, camera } = useWhiteboard();

  // Evaluate curve on inline preview canvas
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);

    const w = c.width;
    const h = c.height;

    // Background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);

    // Axes
    const toSx = (x: number) => ((x - xMin) / (xMax - xMin)) * w;
    const toSy = (y: number) => h - ((y + 4) / 8) * h;

    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    const originX = toSx(0);
    const originY = toSy(0);
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(w, originY);
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, h);
    ctx.stroke();

    // Plot
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    const evalFn = compileMathFunction(fn);
    for (let px = 0; px < w; px++) {
      const curX = xMin + (px / w) * (xMax - xMin);
      const val = evalFn(curX);
      if (val !== null && isFinite(val)) {
        const py = toSy(val);
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      } else {
        started = false;
      }
    }
    ctx.stroke();
  }, [fn, xMin, xMax]);

  const pinToCanvas = () => {
    const uid = Math.random().toString(36).slice(2, 10);
    const cx = (window.innerWidth / 2 - camera.x) / camera.zoom;
    const cy = (window.innerHeight / 2 - camera.y) / camera.zoom;
    addObject({
      id: uid,
      kind: "graph",
      x: cx - 160,
      y: cy - 110,
      w: 320,
      h: 220,
      fn: fn || "sin(x)",
      xMin,
      xMax,
      yMin: -4,
      yMax: 4,
      color: "#a855f7",
      title: `f(x) = ${fn}`,
    });
    pushHistory();
    toast.success("Interactive 2D Graph pinned to canvas!");
  };

  const presets = ["sin(x)", "x^2 - 4", "cos(x)*x", "2*x + 1", "1/x", "exp(-0.2*x)*sin(2*x)"];

  return (
    <div className="w-72 space-y-3 p-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          MathPad Grapher
        </span>
        <span className="text-[11px] font-mono text-primary font-bold">f(x)</span>
      </div>

      <div className="rounded-xl overflow-hidden border border-border shadow-inner">
        <canvas ref={canvasRef} width={280} height={120} className="w-full h-28 block" />
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono font-bold text-muted-foreground">f(x) =</span>
          <input
            type="text"
            className="flex-1 rounded-md border border-input bg-card px-2 py-1 text-xs font-mono font-bold text-foreground outline-none focus:ring-1 focus:ring-primary"
            value={fn}
            onChange={(e) => setFn(e.target.value)}
            placeholder="e.g. sin(x), x^2 - 3"
          />
        </div>
        <div className="flex flex-wrap gap-1 pt-1">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => setFn(p)}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono hover:bg-accent text-foreground transition"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <Button size="sm" className="w-full gap-1.5" onClick={pinToCanvas}>
        <LineChart className="h-3.5 w-3.5" /> Pin Graph to Canvas
      </Button>
    </div>
  );
}
