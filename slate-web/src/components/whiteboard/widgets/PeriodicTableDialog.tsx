import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Plus,
  Atom,
  Sparkles,
  Layers,
  LayoutGrid,
  Info,
  Thermometer,
  Zap,
  BookOpen,
} from "lucide-react";
import {
  ALL_118_ELEMENTS,
  CATEGORY_COLORS,
  getElementGridPosition,
  getElement,
  type ElementData,
  type ElementCategory,
} from "@/lib/whiteboard/periodicTableData";
import { cn } from "@/lib/utils";

export type { ElementData, ElementCategory };
export const ELEMENTS = ALL_118_ELEMENTS;

const CATEGORY_LIST: { id: ElementCategory | "all"; label: string }[] = [
  { id: "all", label: "All Elements (118)" },
  { id: "alkali", label: "Alkali" },
  { id: "alkaline", label: "Alkaline Earth" },
  { id: "transition", label: "Transition" },
  { id: "post-transition", label: "Post-Transition" },
  { id: "metalloid", label: "Metalloids" },
  { id: "nonmetal", label: "Nonmetals" },
  { id: "halogen", label: "Halogens" },
  { id: "noble", label: "Noble Gases" },
  { id: "lanthanide", label: "Lanthanides" },
  { id: "actinide", label: "Actinides" },
];

export function PeriodicTableDialog({
  open,
  onOpenChange,
  onInsertElement,
  onInsertWholeTable,
  initialElementNumber,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsertElement?: (element: ElementData) => void;
  onInsertWholeTable?: () => void;
  initialElementNumber?: number;
}) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ElementCategory | "all">("all");
  const [viewMode, setViewMode] = useState<"table" | "list">("table");
  const [selectedElement, setSelectedElement] = useState<ElementData>(
    initialElementNumber ? getElement(initialElementNumber) || ALL_118_ELEMENTS[0] : ALL_118_ELEMENTS[0]
  );

  useEffect(() => {
    if (initialElementNumber) {
      const el = getElement(initialElementNumber);
      if (el) setSelectedElement(el);
    }
  }, [initialElementNumber]);

  const filteredElements = useMemo(() => {
    let list = ALL_118_ELEMENTS;
    if (selectedCategory !== "all") {
      list = list.filter((el) => el.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (el) =>
          el.name.toLowerCase().includes(q) ||
          el.symbol.toLowerCase().includes(q) ||
          el.number.toString() === q ||
          el.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [search, selectedCategory]);

  const handleInsert = (el: ElementData) => {
    onInsertElement?.(el);
    onOpenChange(false);
  };

  const handleInsertFullTable = () => {
    onInsertWholeTable?.();
    onOpenChange(false);
  };

  // Map element coordinates for the 18x10 standard periodic table grid
  const gridMatrix = useMemo(() => {
    const map = new Map<string, ElementData>();
    ALL_118_ELEMENTS.forEach((el) => {
      const pos = getElementGridPosition(el);
      map.set(`${pos.row}-${pos.col}`, el);
    });
    return map;
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col p-3 sm:p-5 border-border bg-card">
        {/* Header with Search and Full Table Insertion */}
        <DialogHeader className="pb-2 border-b border-border/70 shrink-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 shadow-xs">
                <Atom className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
                  <span>Interactive Periodic Table</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 font-mono font-semibold">
                    118 Elements
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Full IUPAC chemical series, atomic masses, electron shells, and educational properties.
                </DialogDescription>
              </div>
            </div>

            {/* Quick Actions Header */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                onClick={handleInsertFullTable}
                className="bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white font-semibold shadow-md text-xs h-8 px-3 gap-1.5"
                title="Add the complete periodic table layout onto the whiteboard"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Add Whole Periodic Table to Board</span>
              </Button>

              <div className="flex rounded-lg bg-muted/60 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-medium transition",
                    viewMode === "table"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5 inline mr-1" />
                  Table
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-medium transition",
                    viewMode === "list"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Layers className="h-3.5 w-3.5 inline mr-1" />
                  Cards
                </button>
              </div>
            </div>
          </div>

          {/* Search & Category Filter Pills */}
          <div className="flex flex-col sm:flex-row items-center gap-2 mt-2 pt-2 border-t border-border/40">
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search element (e.g. Fe, Gold, 26, Gas)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs rounded-lg bg-background"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto w-full py-0.5 text-[11px] no-scrollbar">
              {CATEGORY_LIST.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-full whitespace-nowrap transition border text-[11px] font-medium",
                    selectedCategory === cat.id
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground border-transparent"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>

        {/* Content Area: Table / Grid View + Selected Element Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0 pt-2 overflow-hidden">
          {/* Main Display: 18-Column Periodic Table OR Card Grid */}
          <div className="lg:col-span-8 flex flex-col min-h-0 overflow-hidden rounded-xl border border-border/60 bg-muted/10 p-2">
            {viewMode === "table" ? (
              <div className="flex-1 overflow-auto p-1">
                <div className="min-w-[760px] select-none">
                  {/* Column numbers 1 to 18 */}
                  <div className="grid grid-cols-18 gap-1 mb-1 text-[9px] text-center text-muted-foreground font-mono">
                    {Array.from({ length: 18 }, (_, i) => (
                      <span key={i + 1}>{i + 1}</span>
                    ))}
                  </div>

                  {/* Main Table: Rows 1 to 7 */}
                  <div className="space-y-1">
                    {[1, 2, 3, 4, 5, 6, 7].map((row) => (
                      <div key={row} className="grid grid-cols-18 gap-1">
                        {Array.from({ length: 18 }, (_, colIdx) => {
                          const col = colIdx + 1;
                          // Placeholder labels for Lanthanide / Actinide splits in Row 6 & 7 col 3
                          if (row === 6 && col === 3) {
                            return (
                              <div
                                key={`${row}-${col}`}
                                className="h-11 rounded-lg border border-dashed border-rose-400/50 bg-rose-500/10 flex flex-col items-center justify-center text-[9px] font-semibold text-rose-500"
                              >
                                <span>57-71</span>
                                <span className="text-[7px]">La-Lu</span>
                              </div>
                            );
                          }
                          if (row === 7 && col === 3) {
                            return (
                              <div
                                key={`${row}-${col}`}
                                className="h-11 rounded-lg border border-dashed border-fuchsia-400/50 bg-fuchsia-500/10 flex flex-col items-center justify-center text-[9px] font-semibold text-fuchsia-500"
                              >
                                <span>89-103</span>
                                <span className="text-[7px]">Ac-Lr</span>
                              </div>
                            );
                          }

                          const el = gridMatrix.get(`${row}-${col}`);
                          if (!el) {
                            return <div key={`${row}-${col}`} className="h-11" />;
                          }

                          const catStyle = CATEGORY_COLORS[el.category] || CATEGORY_COLORS.nonmetal;
                          const isSelected = selectedElement?.number === el.number;
                          const isMatched = filteredElements.some((fe) => fe.number === el.number);

                          return (
                            <button
                              key={el.number}
                              type="button"
                              onClick={() => setSelectedElement(el)}
                              className={cn(
                                "h-11 rounded-lg border text-left p-1 flex flex-col justify-between transition-all duration-150 cursor-pointer",
                                catStyle.bg,
                                catStyle.border,
                                isSelected && "ring-2 ring-primary shadow-md scale-105 z-10",
                                !isMatched && "opacity-25 grayscale-[60%]"
                              )}
                              title={`${el.number}: ${el.name} (${el.symbol})\nCategory: ${el.category}\nMass: ${el.mass} u`}
                            >
                              <div className="flex items-center justify-between text-[8px] text-muted-foreground font-mono leading-none">
                                <span>{el.number}</span>
                                <span className="hidden sm:inline text-[7px] truncate max-w-[22px]">{el.mass.toFixed(0)}</span>
                              </div>
                              <div className={cn("text-xs font-black tracking-tight leading-none text-center", catStyle.text)}>
                                {el.symbol}
                              </div>
                              <div className="text-[7px] font-semibold truncate text-foreground/80 leading-none text-center">
                                {el.name}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Spacer between main table and f-block */}
                  <div className="h-3" />

                  {/* Lanthanide & Actinide Series Rows 9 & 10 */}
                  <div className="space-y-1">
                    {[9, 10].map((row) => (
                      <div key={row} className="grid grid-cols-18 gap-1">
                        {/* 3 label spacer columns on the left */}
                        <div className="col-span-3 flex items-center justify-end pr-2 text-[9px] font-bold text-muted-foreground tracking-wider uppercase">
                          {row === 9 ? "* Lanthanides" : "** Actinides"}
                        </div>

                        {/* 15 elements (cols 4..18) */}
                        {Array.from({ length: 15 }, (_, idx) => {
                          const col = idx + 4;
                          const el = gridMatrix.get(`${row}-${col}`);
                          if (!el) return <div key={`${row}-${col}`} className="h-11" />;

                          const catStyle = CATEGORY_COLORS[el.category] || CATEGORY_COLORS.lanthanide;
                          const isSelected = selectedElement?.number === el.number;
                          const isMatched = filteredElements.some((fe) => fe.number === el.number);

                          return (
                            <button
                              key={el.number}
                              type="button"
                              onClick={() => setSelectedElement(el)}
                              className={cn(
                                "h-11 rounded-lg border text-left p-1 flex flex-col justify-between transition-all duration-150 cursor-pointer",
                                catStyle.bg,
                                catStyle.border,
                                isSelected && "ring-2 ring-primary shadow-md scale-105 z-10",
                                !isMatched && "opacity-25 grayscale-[60%]"
                              )}
                              title={`${el.number}: ${el.name} (${el.symbol})\nCategory: ${el.category}\nMass: ${el.mass} u`}
                            >
                              <div className="flex items-center justify-between text-[8px] text-muted-foreground font-mono leading-none">
                                <span>{el.number}</span>
                                <span className="hidden sm:inline text-[7px] truncate max-w-[22px]">{el.mass.toFixed(0)}</span>
                              </div>
                              <div className={cn("text-xs font-black tracking-tight leading-none text-center", catStyle.text)}>
                                {el.symbol}
                              </div>
                              <div className="text-[7px] font-semibold truncate text-foreground/80 leading-none text-center">
                                {el.name}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Card Grid List View */
              <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 content-start p-1">
                {filteredElements.map((el) => {
                  const catStyle = CATEGORY_COLORS[el.category] || CATEGORY_COLORS.nonmetal;
                  const isSelected = selectedElement?.number === el.number;
                  return (
                    <button
                      key={el.number}
                      type="button"
                      onClick={() => setSelectedElement(el)}
                      className={cn(
                        "flex flex-col p-2 rounded-xl border text-left transition hover:scale-105 active:scale-95",
                        catStyle.bg,
                        catStyle.border,
                        isSelected ? "ring-2 ring-primary shadow-md scale-105" : "shadow-xs"
                      )}
                    >
                      <div className="flex items-center justify-between w-full text-[10px] text-muted-foreground font-mono">
                        <span>{el.number}</span>
                        <span>{el.mass.toFixed(1)}</span>
                      </div>
                      <div className={cn("text-lg font-black mt-0.5 tracking-tight", catStyle.text)}>
                        {el.symbol}
                      </div>
                      <div className="text-[11px] font-semibold truncate text-foreground/90">
                        {el.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Full Detailed Element Inspector */}
          <div className="lg:col-span-4 flex flex-col justify-between rounded-xl border border-border bg-card p-3 sm:p-4 shadow-sm min-h-0 overflow-y-auto">
            {selectedElement ? (
              <div className="space-y-3">
                {/* Element Header Card */}
                <div className="flex items-start justify-between pb-3 border-b border-border/60">
                  <div>
                    <span className="text-xs font-mono font-semibold text-muted-foreground">
                      Atomic No. {selectedElement.number}
                    </span>
                    <h3 className="text-2xl font-black text-foreground tracking-tight">
                      {selectedElement.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary">
                        {CATEGORY_COLORS[selectedElement.category]?.name || selectedElement.category}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        Period {selectedElement.period} • Group {selectedElement.group}
                      </span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "grid h-16 w-16 place-items-center rounded-2xl border-2 text-2xl font-black shadow-inner",
                      CATEGORY_COLORS[selectedElement.category]?.bg,
                      CATEGORY_COLORS[selectedElement.category]?.border,
                      CATEGORY_COLORS[selectedElement.category]?.text
                    )}
                  >
                    {selectedElement.symbol}
                  </div>
                </div>

                {/* Key Chemical Metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-muted/40 p-2.5 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-medium">Standard Atomic Weight</span>
                    <span className="font-semibold text-foreground text-sm">{selectedElement.mass} u</span>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-2.5 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-medium">Phase at STP</span>
                    <span className="font-semibold text-foreground text-sm">{selectedElement.phase}</span>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-2.5 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-medium">Electronegativity</span>
                    <span className="font-semibold text-foreground">
                      {selectedElement.electronegativity ? `${selectedElement.electronegativity} (Pauling)` : "N/A"}
                    </span>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-2.5 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-medium">Melting / Boiling Point</span>
                    <span className="font-semibold text-foreground text-[11px]">
                      {selectedElement.melt !== undefined ? `${selectedElement.melt}°C` : "N/A"} /{" "}
                      {selectedElement.boil !== undefined ? `${selectedElement.boil}°C` : "N/A"}
                    </span>
                  </div>
                </div>

                {/* Electron Configuration */}
                <div className="rounded-xl bg-muted/30 p-2.5 border border-border/50">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1 font-medium">
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-amber-500" /> Electron Configuration
                    </span>
                  </div>
                  <div className="font-mono text-xs font-semibold text-foreground">
                    {selectedElement.config || "Unknown shell configuration"}
                  </div>
                </div>

                {/* Discovery History */}
                {selectedElement.discoveredBy && (
                  <div className="rounded-xl bg-muted/30 p-2 border border-border/50 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">Discovered by: </span>
                    {selectedElement.discoveredBy}
                  </div>
                )}

                {/* Educational Summary & Applications */}
                {selectedElement.summary && (
                  <div className="text-xs text-muted-foreground leading-relaxed bg-muted/30 p-2.5 rounded-xl border border-border/50">
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-foreground uppercase tracking-wider mb-1">
                      <BookOpen className="h-3 w-3 text-primary" /> Properties & Real-World Uses
                    </div>
                    <p className="italic">"{selectedElement.summary}"</p>
                  </div>
                )}
              </div>
            ) : null}

            {/* Action Buttons */}
            <div className="space-y-2 pt-3 border-t border-border/60 mt-3">
              <Button
                className="w-full gap-2 font-semibold shadow-sm text-xs h-9 bg-primary hover:bg-primary/90"
                onClick={() => selectedElement && handleInsert(selectedElement)}
              >
                <Plus className="h-4 w-4" /> Insert {selectedElement?.symbol} Element Badge to Board
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2 font-medium text-xs h-8 border-border text-foreground hover:bg-accent"
                onClick={handleInsertFullTable}
              >
                <Sparkles className="h-3.5 w-3.5 text-teal-500" /> Place Entire Periodic Table (118)
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
