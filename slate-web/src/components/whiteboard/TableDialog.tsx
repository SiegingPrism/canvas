import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Table as TableIcon, Plus, Minus, Check } from "lucide-react";
import { useWhiteboard } from "@/lib/whiteboard/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { TableObject } from "@/lib/whiteboard/types";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function TableDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addObject, pushHistory, camera } = useWhiteboard();
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [title, setTitle] = useState("Comparison Table");
  const [hasHeaders, setHasHeaders] = useState(true);

  // Initialize sample data
  function generateData(r: number, c: number) {
    const d: string[][] = [];
    for (let i = 0; i < r; i++) {
      const row: string[] = [];
      for (let j = 0; j < c; j++) {
        row.push(i === 0 && hasHeaders ? `Header ${j + 1}` : `R${i + 1}C${j + 1}`);
      }
      d.push(row);
    }
    return d;
  }

  function handleInsert() {
    const screenW = typeof window !== "undefined" ? window.innerWidth : 400;
    const screenH = typeof window !== "undefined" ? window.innerHeight : 600;

    const cellW = 100;
    const cellH = 38;
    const w = Math.max(260, cols * cellW);
    const h = (rows + (title ? 1 : 0)) * cellH + 20;

    const cx = (screenW / 2 - camera.x) / camera.zoom - w / 2;
    const cy = (screenH / 2 - camera.y) / camera.zoom - h / 2;

    const initialData = generateData(rows, cols);

    const tbl: TableObject = {
      id: uid(),
      kind: "table",
      x: cx,
      y: cy,
      w,
      h,
      rows,
      cols,
      data: initialData,
      title: title.trim() || undefined,
      color: "#0284c7",
    };

    addObject(tbl);
    pushHistory();
    toast.success(`Inserted ${rows}×${cols} Table onto whiteboard!`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <TableIcon className="h-5 w-5 text-sky-500" />
            Insert Table on Canvas
          </DialogTitle>
          <DialogDescription className="text-xs">
            Create a structured grid table with customizable rows, columns, and headers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Table Title (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Experiment Results, Vocabulary, Comparison..."
              className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          {/* Grid Size Selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Rows: {rows}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRows((r) => Math.max(1, r - 1))}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-foreground hover:bg-accent active:scale-90"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="flex-1 text-center font-mono font-semibold text-sm">
                  {rows}
                </span>
                <button
                  type="button"
                  onClick={() => setRows((r) => Math.min(8, r + 1))}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-foreground hover:bg-accent active:scale-90"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Columns: {cols}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCols((c) => Math.max(1, c - 1))}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-foreground hover:bg-accent active:scale-90"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="flex-1 text-center font-mono font-semibold text-sm">
                  {cols}
                </span>
                <button
                  type="button"
                  onClick={() => setCols((c) => Math.min(6, c + 1))}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-foreground hover:bg-accent active:scale-90"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Sizes
            </label>
            <div className="flex gap-2">
              {[
                { r: 2, c: 2, label: "2 × 2" },
                { r: 3, c: 3, label: "3 × 3" },
                { r: 4, c: 3, label: "4 × 3" },
                { r: 5, c: 4, label: "5 × 4" },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setRows(p.r);
                    setCols(p.c);
                  }}
                  className={cn(
                    "flex-1 rounded-lg border py-1.5 text-xs font-medium transition active:scale-95",
                    rows === p.r && cols === p.c
                      ? "border-sky-500 bg-sky-500/10 text-sky-600 font-semibold"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview Grid */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Table Preview
            </label>
            <div className="rounded-xl border border-sky-500/30 bg-card p-3 shadow-inner overflow-hidden">
              {title.trim() && (
                <div className="pb-1.5 text-xs font-bold text-sky-600 truncate border-b border-border mb-1.5">
                  {title}
                </div>
              )}
              <div
                className="grid gap-1 text-[10px]"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: rows * cols }).map((_, idx) => {
                  const r = Math.floor(idx / cols);
                  const isHeader = r === 0 && hasHeaders;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "rounded px-1.5 py-1 text-center truncate border",
                        isHeader
                          ? "bg-sky-500/10 border-sky-500/20 font-bold text-sky-700 dark:text-sky-300"
                          : "bg-muted/40 border-border text-foreground",
                      )}
                    >
                      {isHeader ? `Col ${(idx % cols) + 1}` : `—`}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-xl border border-input py-2 text-xs font-medium text-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleInsert}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white py-2 text-xs font-semibold transition active:scale-95 shadow-sm"
            >
              <TableIcon className="h-4 w-4" />
              <span>Insert Table</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
