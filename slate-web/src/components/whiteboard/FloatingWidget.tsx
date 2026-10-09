import { useEffect, useRef, useState } from "react";
import { X, GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export function FloatingWidget({
  title,
  onClose,
  initial,
  children,
  className,
}: {
  title: string;
  onClose: () => void;
  initial: { x: number; y: number };
  children: React.ReactNode;
  className?: string;
}) {
  const [pos, setPos] = useState(initial);
  const ref = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    function move(e: PointerEvent) {
      if (!dragRef.current) return;
      setPos({ x: e.clientX - dragRef.current.dx, y: e.clientY - dragRef.current.dy });
    }
    function up() {
      dragRef.current = null;
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "pointer-events-auto absolute rounded-2xl bg-card shadow-xl ring-1 ring-border",
        className,
      )}
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className="flex cursor-move items-center justify-between rounded-t-2xl border-b border-border bg-muted/60 px-3 py-2"
        onPointerDown={(e) => {
          const rect = ref.current!.getBoundingClientRect();
          dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
        }}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <GripHorizontal className="h-4 w-4 text-muted-foreground" />
          {title}
        </div>
        <button onClick={onClose} className="rounded p-1 hover:bg-accent">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
