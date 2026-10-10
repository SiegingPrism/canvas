import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useNotes, NOTE_TYPE_LABELS, getNoteSearchText } from "@/lib/notesStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft,
  FileText,
  Plus,
  Search,
  Star,
  Copy,
  Tag as TagIcon,
  Archive,
  Trash2,
  MoreVertical,
  Sparkles,
  Cloud,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { useAuth } from "@/lib/supabase/authStore";
import { semanticSearch } from "@/lib/ai/localRAG";

export const Route = createFileRoute("/notes")({
  head: () => ({
    meta: [
      { title: "Notes — Slate" },
      { name: "description", content: "Capture and organize block-based notes." },
    ],
  }),
  component: NotesPage,
});

function relTime(t: number) {
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function NotesPage() {
  const navigate = useNavigate();
  const {
    notes,
    noteOrder,
    createNote,
    deleteNote,
    duplicateNote,
    toggleFavorite,
    toggleArchive,
    setNoteTags,
    syncWithCloud,
  } = useNotes();

  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [useSemanticSearch, setUseSemanticSearch] = useState(false);
  const [filter, setFilter] = useState<"all" | "favorites" | "archived">("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const id of noteOrder) {
      notes[id]?.tags.forEach((t) => set.add(t));
    }
    return Array.from(set).sort();
  }, [notes, noteOrder]);

  const semanticScoreMap = useMemo(() => {
    if (!useSemanticSearch || !search.trim()) return null;
    const matches = semanticSearch(search, 40);
    const map = new Map<string, number>();
    matches.filter((m) => m.sourceType === "note").forEach((m) => map.set(m.id, m.score));
    return map;
  }, [useSemanticSearch, search]);

  const filteredNotes = useMemo(() => {
    const list = noteOrder
      .map((id) => notes[id])
      .filter(Boolean)
      .filter((n) => {
        if (filter === "favorites") return n.favorite && !n.archived;
        if (filter === "archived") return n.archived;
        return !n.archived;
      })
      .filter((n) => !selectedTag || n.tags.includes(selectedTag));

    if (semanticScoreMap && semanticScoreMap.size > 0) {
      return list
        .filter((n) => semanticScoreMap.has(n.id))
        .sort((a, b) => (semanticScoreMap.get(b.id) || 0) - (semanticScoreMap.get(a.id) || 0));
    }

    return list
      .filter((n) => !search || getNoteSearchText(n).toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, noteOrder, filter, selectedTag, search, semanticScoreMap]);

  function handleNewNote() {
    const id = createNote();
    navigate({ to: "/note/$noteId", params: { noteId: id } });
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent text-foreground transition"
              title="Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="flex items-center gap-2 font-semibold text-lg">
              <FileText className="h-4 w-4 text-primary" /> Notes
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (!user) {
                  setAuthOpen(true);
                  toast.info("Sign in to sync your notes privately to the cloud.");
                  return;
                }
                toast.info("Syncing notes with your cloud account...");
                await syncWithCloud();
                toast.success("Notes synced with cloud database!");
              }}
              className="gap-1.5"
            >
              <Cloud className={cn("h-4 w-4", user ? "text-emerald-500" : "text-blue-500")} />
              <span>{user ? "Cloud Sync" : "Sign In & Sync"}</span>
            </Button>
            <Button size="sm" onClick={handleNewNote}>
              <Plus className="h-4 w-4" /> New note
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-6">
        {/* Search & Status Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={useSemanticSearch ? "Semantic AI Search across concepts & notes..." : "Search notes (title & content)..."}
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              variant={useSemanticSearch ? "default" : "outline"}
              size="sm"
              onClick={() => setUseSemanticSearch(!useSemanticSearch)}
              className="gap-1.5 text-xs h-9 shrink-0"
              title="Toggle semantic concept matching vs exact keyword match"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Semantic AI</span>
            </Button>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-muted/60 p-1">
            {(["all", "favorites", "archived"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilter(mode)}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition ${
                  filter === mode
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedTag(null)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                !selectedTag
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              All tags
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                  selectedTag === tag
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* Notes Grid */}
        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed p-16 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/60" />
            <p className="mt-3 text-base font-semibold">No notes found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Capture ideas, study topics, or create meeting notes.
            </p>
            <Button size="sm" className="mt-4" onClick={handleNewNote}>
              <Plus className="h-4 w-4" /> Create note
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredNotes.map((note) => {
              const preview = note.blocks
                .map((b) => b.content)
                .filter(Boolean)
                .join(" · ")
                .slice(0, 140);

              return (
                <div
                  key={note.id}
                  className="group relative flex flex-col justify-between rounded-2xl border bg-card p-4 shadow-sm transition hover:border-primary hover:shadow-md cursor-pointer"
                  onClick={() => navigate({ to: "/note/$noteId", params: { noteId: note.id } })}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {note.favorite && (
                            <Star className="h-3.5 w-3.5 shrink-0 fill-yellow-400 text-yellow-400" />
                          )}
                          <h3 className="truncate text-sm font-semibold">
                            {note.title || "Untitled note"}
                          </h3>
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {NOTE_TYPE_LABELS[note.type] || "Standard"} · {relTime(note.updatedAt)}
                        </div>
                      </div>

                      {/* Options menu */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className="grid h-7 w-7 place-items-center rounded-lg hover:bg-accent text-muted-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-44 p-1.5 space-y-0.5 shadow-xl rounded-xl"
                          align="end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => toggleFavorite(note.id)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition"
                          >
                            <Star className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{note.favorite ? "Unfavorite" : "Favorite"}</span>
                          </button>
                          <button
                            onClick={() => duplicateNote(note.id)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition"
                          >
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Duplicate</span>
                          </button>
                          <button
                            onClick={() => {
                              const input = prompt("Tags (comma separated)", note.tags.join(", "));
                              if (input !== null) {
                                setNoteTags(
                                  note.id,
                                  input
                                    .split(",")
                                    .map((t) => t.trim())
                                    .filter(Boolean),
                                );
                              }
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition"
                          >
                            <TagIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Edit tags</span>
                          </button>
                          <button
                            onClick={() => toggleArchive(note.id)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition"
                          >
                            <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{note.archived ? "Restore" : "Archive"}</span>
                          </button>
                          <div className="h-px bg-border my-1" />
                          <button
                            onClick={() => {
                              if (confirm("Delete this note? This cannot be undone.")) {
                                deleteNote(note.id);
                              }
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete</span>
                          </button>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <p className="mt-2.5 line-clamp-3 text-xs text-muted-foreground leading-relaxed">
                      {preview || "Empty note"}
                    </p>
                  </div>

                  {note.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {note.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
