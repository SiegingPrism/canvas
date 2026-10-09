import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Ruler, RotateCw, Pencil, Stamp, Compass } from "lucide-react";
import { useWhiteboard } from "@/lib/whiteboard/store";
import { toast } from "sonner";
import type { PenStroke } from "@/lib/whiteboard/types";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function RulerWidget() {
  const { addObject, pushHistory, camera, color, size, setTool } = useWhiteboard();
  const [angle, setAngle] = useState(0);
  const [lengthCm, setLengthCm] = useState(15); // in cm (1 cm = ~20px on board)

  const lengthPx = lengthCm * 20;

  function handleDrawLine() {
    const screenW = typeof window !== "undefined" ? window.innerWidth : 400;
    const screenH = typeof window !== "undefined" ? window.innerHeight : 600;

    const cx = (screenW / 2 - camera.x) / camera.zoom;
    const cy = (screenH / 2 - camera.y) / camera.zoom;

    const rad = (angle * Math.PI) / 180;
    const half = lengthPx / 2;

    const x1 = Math.round(cx - half * Math.cos(rad));
    const y1 = Math.round(cy - half * Math.sin(rad));
    const x2 = Math.round(cx + half * Math.cos(rad));
    const y2 = Math.round(cy + half * Math.sin(rad));

    // Generate smooth line points
    const points = [];
    const steps = Math.max(10, Math.floor(lengthPx / 10));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      points.push({
        x: x1 + (x2 - x1) * t,
        y: y1 + (y2 - y1) * t,
        p: 0.6,
      });
    }

    const stroke: PenStroke = {
      id: uid(),
      kind: "pen",
      color: color || "#2563eb",
      size: Math.max(2, size || 3),
      points,
    };

    addObject(stroke);
    pushHistory();
    toast.success(`Drew ${lengthCm}cm line at ${angle}°!`);
  }

  function handleStampRuler() {
    const screenW = typeof window !== "undefined" ? window.innerWidth : 400;
    const screenH = typeof window !== "undefined" ? window.innerHeight : 600;

    const cx = (screenW / 2 - camera.x) / camera.zoom - lengthPx / 2;
    const cy = (screenH / 2 - camera.y) / camera.zoom - 25;

    // Stamp a sticky ruler badge or frame
    addObject({
      id: uid(),
      kind: "sticky",
      x: cx,
      y: cy,
      w: lengthPx,
      h: 50,
      text: `📏 RULER: ${lengthCm} cm (Scale: 1cm = 20px)\n|···|···|···|···|···|···|···|···|`,
      color: "#fef08a",
    });
    pushHistory();
    toast.success(`Stamped ${lengthCm}cm ruler to canvas!`);
  }

  return (
    <div className="space-y-3 p-1 text-slate-800 dark:text-slate-100 select-none">
      {/* Visual Ruler Graphic with dynamic rotation */}
      <div className="flex justify-center items-center py-2 h-24 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-border">
        <div
          className="relative h-12 rounded shadow-md border border-amber-300 dark:border-amber-500/40 bg-amber-100/90 dark:bg-amber-950/70 flex flex-col justify-between px-2 transition-transform duration-150"
          style={{
            width: `${Math.min(260, lengthPx)}px`,
            transform: `rotate(${angle}deg)`,
          }}
        >
          {/* Top Ticks */}
          <div className="flex justify-between items-start pt-0.5">
            {Array.from({ length: Math.min(16, lengthCm + 1) }).map((_, i) => (
              <div key={i} className="flex flex-col items-center">
                <div
                  className={`w-0.5 bg-amber-900/60 dark:bg-amber-300/80 ${
                    i % 5 === 0 ? "h-3" : "h-1.5"
                  }`}
                />
                {i % 5 === 0 && (
                  <span className="text-[8px] font-mono text-amber-950 dark:text-amber-200 leading-none mt-0.5">
                    {i}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Center Label */}
          <div className="text-[9px] font-medium tracking-wide text-center text-amber-900/70 dark:text-amber-300/70">
            {lengthCm} cm • {angle}°
          </div>

          {/* Bottom Ticks */}
          <div className="flex justify-between items-end pb-0.5">
            {Array.from({ length: Math.min(16, lengthCm + 1) }).map((_, i) => (
              <div
                key={i}
                className={`w-0.5 bg-amber-900/40 dark:bg-amber-300/50 ${
                  i % 2 === 0 ? "h-2" : "h-1"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Angle Controller */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <RotateCw className="h-3.5 w-3.5 text-sky-500" /> Angle
          </span>
          <span className="font-mono font-semibold text-foreground">{angle}°</span>
        </div>
        <Slider
          value={[angle]}
          min={-180}
          max={180}
          step={5}
          onValueChange={(v) => setAngle(v[0])}
        />
        {/* Quick Angle Presets */}
        <div className="flex gap-1 pt-1">
          {[0, 30, 45, 90, 180].map((deg) => (
            <button
              key={deg}
              type="button"
              onClick={() => setAngle(deg)}
              className={`flex-1 py-1 rounded text-[10px] font-mono font-medium border transition ${
                angle === deg
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:bg-accent text-muted-foreground"
              }`}
            >
              {deg}°
            </button>
          ))}
        </div>
      </div>

      {/* Length Controller */}
      <div className="space-y-1.5 border-t border-border pt-2">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Ruler className="h-3.5 w-3.5 text-amber-500" /> Length
          </span>
          <span className="font-mono font-semibold text-foreground">
            {lengthCm} cm ({(lengthCm * 0.3937).toFixed(1)} in)
          </span>
        </div>
        <Slider
          value={[lengthCm]}
          min={5}
          max={30}
          step={1}
          onValueChange={(v) => setLengthCm(v[0])}
        />
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
        <Button
          size="sm"
          onClick={handleDrawLine}
          className="flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Pencil className="h-3.5 w-3.5" />
          Draw Line
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleStampRuler}
          className="flex items-center gap-1.5 text-xs font-medium"
        >
          <Stamp className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          Stamp Ruler
        </Button>
      </div>
    </div>
  );
}
