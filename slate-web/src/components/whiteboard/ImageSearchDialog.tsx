import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ImagePlus,
  Search,
  Sparkles,
  Upload,
  Loader2,
  Check,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { useWhiteboard } from "@/lib/whiteboard/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

interface ImageItem {
  id: string;
  title: string;
  url: string;
  source: string;
}

const CURATED_IMAGES: Record<string, ImageItem[]> = {
  Biology: [
    {
      id: "bio-1",
      title: "Animal Cell Anatomy Diagram",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Animal_cell_structure_en.svg/600px-Animal_cell_structure_en.svg.png",
      source: "Wikimedia Commons",
    },
    {
      id: "bio-2",
      title: "Plant Cell Structure",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Plant_cell_structure-en.svg/600px-Plant_cell_structure-en.svg.png",
      source: "Wikimedia Commons",
    },
    {
      id: "bio-3",
      title: "DNA Double Helix Structure",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/DNA_chemical_structure.svg/600px-DNA_chemical_structure.svg.png",
      source: "Wikimedia Commons",
    },
    {
      id: "bio-4",
      title: "Human Heart Cross Section",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Diagram_of_the_human_heart_%28cropped%29.svg/600px-Diagram_of_the_human_heart_%28cropped%29.svg.png",
      source: "Wikimedia Commons",
    },
  ],
  Space: [
    {
      id: "space-1",
      title: "Solar System Planets to Scale",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Planets2008.jpg/600px-Planets2008.jpg",
      source: "NASA / Wikimedia",
    },
    {
      id: "space-2",
      title: "Moon Phases Diagram",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Moon_phases_en.svg/600px-Moon_phases_en.svg.png",
      source: "Wikimedia Commons",
    },
    {
      id: "space-3",
      title: "Earth from Space (Blue Marble)",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/The_Earth_seen_from_Apollo_17.jpg/600px-The_Earth_seen_from_Apollo_17.jpg",
      source: "NASA",
    },
  ],
  Math: [
    {
      id: "math-1",
      title: "Pythagorean Theorem Geometric Proof",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Pythagorean.svg/600px-Pythagorean.svg.png",
      source: "Wikimedia Commons",
    },
    {
      id: "math-2",
      title: "Normal Distribution Bell Curve",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Normal_Distribution_PDF.svg/600px-Normal_Distribution_PDF.svg.png",
      source: "Wikimedia Commons",
    },
    {
      id: "math-3",
      title: "Unit Circle Trigonometry",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Unit_circle_angles_color.svg/600px-Unit_circle_angles_color.svg.png",
      source: "Wikimedia Commons",
    },
  ],
  Geography: [
    {
      id: "geo-1",
      title: "World Map Political Projection",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/World_map_-_low_resolution.svg/600px-World_map_-_low_resolution.svg.png",
      source: "Wikimedia Commons",
    },
    {
      id: "geo-2",
      title: "Earth Tectonic Plates Diagram",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Plates_tect2_en.svg/600px-Plates_tect2_en.svg.png",
      source: "USGS / Wikimedia",
    },
  ],
};

export function ImageSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addObject, pushHistory, camera } = useWhiteboard();
  const [query, setQuery] = useState("cell biology");
  const [activeCategory, setActiveCategory] = useState("Biology");
  const [results, setResults] = useState<ImageItem[]>(CURATED_IMAGES.Biology);
  const [loading, setLoading] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string>(CURATED_IMAGES.Biology[0].url);
  const [selectedTitle, setSelectedTitle] = useState<string>(CURATED_IMAGES.Biology[0].title);

  async function handleSearch(searchQuery: string) {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        searchQuery,
      )}&gsrlimit=12&prop=pageimages&pithumbsize=600&format=json&origin=*`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Search request failed");
      const data = await res.json();
      const pages = data?.query?.pages ? Object.values(data.query.pages) : [];

      const parsed: ImageItem[] = [];
      for (const p of pages as Array<{ title?: string; thumbnail?: { source: string }; pageid?: number }>) {
        if (p.thumbnail?.source) {
          parsed.push({
            id: `wiki-${p.pageid || uid()}`,
            title: p.title || searchQuery,
            url: p.thumbnail.source,
            source: "Wikipedia & Wikimedia",
          });
        }
      }

      if (parsed.length > 0) {
        setResults(parsed);
        setSelectedUrl(parsed[0].url);
        setSelectedTitle(parsed[0].title);
      } else {
        toast.info("No online photos found for this query. Showing curated collection.");
        setResults(CURATED_IMAGES[activeCategory] || CURATED_IMAGES.Biology);
      }
    } catch (e) {
      console.warn("Image search failed:", e);
      setResults(CURATED_IMAGES[activeCategory] || CURATED_IMAGES.Biology);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectCategory(cat: string) {
    setActiveCategory(cat);
    const items = CURATED_IMAGES[cat] || [];
    setResults(items);
    if (items[0]) {
      setSelectedUrl(items[0].url);
      setSelectedTitle(items[0].title);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      insertImageToCanvas(dataUrl, file.name);
    };
    reader.readAsDataURL(file);
  }

  function insertImageToCanvas(srcUrl: string, title?: string) {
    const screenW = typeof window !== "undefined" ? window.innerWidth : 400;
    const screenH = typeof window !== "undefined" ? window.innerHeight : 600;
    const w = 340;
    const h = 240;
    const cx = (screenW / 2 - camera.x) / camera.zoom - w / 2;
    const cy = (screenH / 2 - camera.y) / camera.zoom - h / 2;

    addObject({
      id: uid(),
      kind: "image",
      x: cx,
      y: cy,
      w,
      h,
      src: srcUrl,
    });
    pushHistory();
    toast.success(`Image "${title || "Selected"}" inserted on whiteboard!`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ImagePlus className="h-5 w-5 text-indigo-500" />
            Image Search & Insert
          </DialogTitle>
          <DialogDescription className="text-xs">
            Search educational diagrams, encyclopedic illustrations, or upload custom imagery to the whiteboard.
          </DialogDescription>
        </DialogHeader>

        {/* Search Bar & Upload */}
        <div className="flex gap-2 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
              placeholder="Search e.g. animal cell, solar system, heart, map..."
              className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          <button
            type="button"
            onClick={() => handleSearch(query)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3.5 py-2 text-xs font-semibold hover:bg-primary/90 transition active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="hidden sm:inline">Search</span>
          </button>
          <label className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent cursor-pointer transition active:scale-95">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="hidden sm:inline">Upload</span>
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
          {Object.keys(CURATED_IMAGES).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => handleSelectCategory(cat)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition active:scale-95",
                activeCategory === cat
                  ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-500/30"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground border border-transparent",
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Image Grid */}
        <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[340px] pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Fetching images...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs gap-2">
              <span>No images found. Try another keyword like "pythagoras" or "dna".</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {results.map((img) => {
                const isSelected = selectedUrl === img.url;
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => {
                      setSelectedUrl(img.url);
                      setSelectedTitle(img.title);
                    }}
                    className={cn(
                      "group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left transition hover:border-primary active:scale-95",
                      isSelected
                        ? "border-primary ring-2 ring-primary/40 shadow-md"
                        : "border-border",
                    )}
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-muted/30 flex items-center justify-center p-1">
                      <img
                        src={img.url}
                        alt={img.title}
                        loading="lazy"
                        className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-2">
                      <p className="line-clamp-1 text-[11px] font-semibold text-foreground">
                        {img.title}
                      </p>
                      <p className="text-[9px] text-muted-foreground">{img.source}</p>
                    </div>
                    {isSelected && (
                      <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-xs">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border mt-2">
          <span className="text-[11px] text-muted-foreground line-clamp-1 max-w-[240px]">
            {selectedTitle ? `Selected: ${selectedTitle}` : "Choose an image above"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedUrl}
              onClick={() => insertImageToCanvas(selectedUrl, selectedTitle)}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 text-xs font-semibold shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              <ImagePlus className="h-4 w-4" />
              <span>Insert on Canvas</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
