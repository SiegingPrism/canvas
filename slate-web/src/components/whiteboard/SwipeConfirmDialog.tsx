import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ChevronsRight, Eraser, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  variant?: "erase" | "clear";
  onConfirm: () => void;
}

export function SwipeConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  variant = "erase",
  onConfirm,
}: SwipeConfirmDialogProps) {
  const [thumbX, setThumbX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);

  // Reset when dialog opens/closes
  useEffect(() => {
    if (open) {
      setThumbX(0);
      setIsDragging(false);
      setIsCompleted(false);
    }
  }, [open]);

  const maxTravel = useCallback(() => {
    if (!trackRef.current) return 200;
    return Math.max(80, trackRef.current.clientWidth - 56);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isCompleted) return;
    setIsDragging(true);
    startXRef.current = e.clientX - thumbX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || isCompleted) return;
    const max = maxTravel();
    const newX = Math.max(0, Math.min(max, e.clientX - startXRef.current));
    setThumbX(newX);

    // If swiped 85% or more, complete action!
    if (newX >= max * 0.85) {
      setIsCompleted(true);
      setIsDragging(false);
      setThumbX(max);

      // Trigger action after brief micro-animation
      setTimeout(() => {
        onConfirm();
        onOpenChange(false);
      }, 250);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging || isCompleted) return;
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    // Snap back if released before completion
    setThumbX(0);
  };

  const isClear = variant === "clear";
  const progressRatio = trackRef.current ? Math.min(1, thumbX / Math.max(1, maxTravel())) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[92vw] p-5 sm:p-6 rounded-3xl border border-border shadow-2xl bg-card text-card-foreground">
        <DialogHeader className="text-center sm:text-center space-y-2">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted/80 ring-1 ring-border/80 shadow-sm">
            {isClear ? (
              <Trash2 className="h-6 w-6 text-rose-500 animate-pulse" />
            ) : (
              <Eraser className="h-6 w-6 text-amber-500" />
            )}
          </div>
          <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto">
            {description ||
              (isClear
                ? "This will permanently clear everything from this whiteboard page."
                : "This will erase all ink and drawings from this board.")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Swipe Track */}
          <div
            ref={trackRef}
            className={cn(
              "relative h-14 w-full rounded-2xl overflow-hidden select-none border transition-colors flex items-center p-1 cursor-pointer",
              isClear
                ? "bg-rose-950/20 border-rose-500/30 dark:bg-rose-950/40"
                : "bg-amber-950/20 border-amber-500/30 dark:bg-amber-950/40",
            )}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* Progress Fill */}
            <div
              className={cn(
                "absolute inset-y-0 left-0 transition-all rounded-xl",
                isClear
                  ? "bg-gradient-to-r from-rose-500/20 to-rose-500/40"
                  : "bg-gradient-to-r from-amber-500/20 to-amber-500/40",
              )}
              style={{
                width: `${Math.max(48, thumbX + 48)}px`,
                transition: isDragging ? "none" : "width 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
              }}
            />

            {/* Hint text / Chevrons */}
            <div
              className={cn(
                "pointer-events-none absolute inset-0 flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wider transition-opacity duration-200",
                isClear ? "text-rose-500 dark:text-rose-400" : "text-amber-500 dark:text-amber-400",
              )}
              style={{
                opacity: Math.max(0, 1 - progressRatio * 1.5),
              }}
            >
              <span>{isClear ? "Swipe to clear" : "Swipe to erase"}</span>
              <ChevronsRight className="h-4 w-4 animate-bounce" />
            </div>

            {/* Draggable Thumb */}
            <div
              onPointerDown={handlePointerDown}
              className={cn(
                "relative z-10 grid h-12 w-12 place-items-center rounded-xl font-bold shadow-md cursor-grab active:cursor-grabbing transition-transform touch-none",
                isClear
                  ? "bg-rose-500 text-white shadow-rose-500/30 hover:bg-rose-600 active:scale-95"
                  : "bg-amber-500 text-white shadow-amber-500/30 hover:bg-amber-600 active:scale-95",
                isCompleted && "bg-emerald-500 shadow-emerald-500/30",
              )}
              style={{
                transform: `translateX(${thumbX}px)`,
                transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
              }}
            >
              {isCompleted ? (
                <Check className="h-5 w-5 text-white animate-in zoom-in-50" />
              ) : isClear ? (
                <Trash2 className="h-5 w-5 text-white" />
              ) : (
                <Eraser className="h-5 w-5 text-white" />
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
