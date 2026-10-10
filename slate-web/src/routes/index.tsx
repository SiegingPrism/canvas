import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useWhiteboard } from "@/lib/whiteboard/store";
import type { TemplateKey } from "@/lib/whiteboard/templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Plus,
  FolderOpen,
  Sparkles,
  ArrowRight,
  Clock,
  Star,
  Wand2,
  FileText,
  GraduationCap,
  Menu,
  X,
  BookOpen,
  Folder,
  FolderPlus,
  Search,
  Check,
  Tag,
  Cloud,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FeatureTourDialog } from "@/components/whiteboard/FeatureTourDialog";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { useAuth } from "@/lib/supabase/authStore";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Slate — Dashboard" },
      { name: "description", content: "Your smart whiteboards, notes, and study hub." },
    ],
  }),
  component: Dashboard,
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

function Dashboard() {
  const navigate = useNavigate();
  const {
    boards,
    boardOrder,
    folders,
    recentAI,
    createBoard,
    toggleFavorite,
    setBoardFolder,
    createFolder,
    syncWithCloud,
  } = useWhiteboard();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string>("all");
  const [boardSearch, setBoardSearch] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const allBoards = useMemo(
    () =>
      boardOrder
        .map((id) => boards[id])
        .filter((b) => b && !b.archived)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [boards, boardOrder],
  );
  const continueBoard = allBoards[0];
  const starredBoards = useMemo(() => allBoards.filter((b) => b.favorite), [allBoards]);

  const filteredBoards = useMemo(() => {
    let list = allBoards;
    if (activeFolderId === "starred") {
      list = list.filter((b) => b.favorite);
    } else if (activeFolderId !== "all") {
      list = list.filter((b) => b.folderId === activeFolderId);
    }
    if (boardSearch.trim()) {
      const q = boardSearch.toLowerCase().trim();
      list = list.filter(
        (b) => b.title.toLowerCase().includes(q) || b.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [allBoards, activeFolderId, boardSearch]);

  function openNew(templateKey?: TemplateKey, folderId?: string | null) {
    const id = createBoard({
      templateKey,
      folderId: folderId ?? (activeFolderId !== "all" && activeFolderId !== "starred" ? activeFolderId : null),
    });
    navigate({ to: "/board/$boardId", params: { boardId: id } });
  }

  function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const fId = createFolder(newFolderName.trim());
    setNewFolderName("");
    setNewFolderOpen(false);
    setActiveFolderId(fId);
  }

  return (
    <div className="min-h-dvh w-full bg-background overscroll-y-contain">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 font-semibold group">
            <img
              src="/sti-logo.png"
              alt="STI Logo"
              className="h-9 w-9 rounded-xl object-cover shadow-xs transition group-hover:scale-105 ring-1 ring-border/50"
            />
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-foreground tracking-tight text-base">Slate</span>
              <span className="text-[9px] font-bold tracking-wider text-[#B48528] uppercase -mt-0.5">
                SNANS TECH
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-2">
            <Link
              to="/library"
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition"
            >
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <span>Library</span>
            </Link>
            <Link
              to="/notes"
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition"
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>Notes</span>
            </Link>
            <Link
              to="/learn"
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition"
            >
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <span>Learn</span>
            </Link>
            <button
              type="button"
              onClick={() => setTourOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 transition"
              title="Feature Tour & Tutorial"
            >
              <BookOpen className="h-4 w-4" />
              <span>Tutorial</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!user) {
                  setAuthOpen(true);
                  toast.info("Sign in to sync your boards privately to the cloud.");
                  return;
                }
                toast.info("Syncing boards & notes with your cloud account...");
                await syncWithCloud();
                toast.success("Cloud database sync complete!");
              }}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition"
              title="Sync with Cloud"
            >
              <Cloud className={cn("h-4 w-4", user ? "text-emerald-500" : "text-blue-500")} />
              <span className="hidden lg:inline text-xs">{user ? "Cloud Sync" : "Sign In / Sync"}</span>
            </button>
            <Button size="sm" onClick={() => openNew()} className="ml-1">
              <Plus className="h-4 w-4" /> New board
            </Button>
          </nav>

          {/* Mobile Right Bar: Quick New + Burger Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <Button size="sm" onClick={() => openNew()} className="h-8 px-3 text-xs gap-1">
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-foreground hover:bg-accent active:scale-95 transition"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Slide-down Drawer */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 top-[57px] z-30 bg-background/60 backdrop-blur-sm md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="absolute top-full left-0 right-0 z-40 border-b border-border bg-card p-4 shadow-xl md:hidden space-y-3 animate-in slide-in-from-top duration-200">
              <div className="space-y-1">
                <Link
                  to="/library"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition"
                >
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <FolderOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold">Library</div>
                    <div className="text-xs text-muted-foreground">
                      All your boards and archives
                    </div>
                  </div>
                </Link>
                <Link
                  to="/notes"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition"
                >
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500/10 text-blue-500">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold">Notes</div>
                    <div className="text-xs text-muted-foreground">AI-assisted block notes</div>
                  </div>
                </Link>
                <Link
                  to="/learn"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition"
                >
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-500">
                    <GraduationCap className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold">Learning Hub</div>
                    <div className="text-xs text-muted-foreground">
                      Flashcards and smart quizzes
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setTourOpen(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition"
                >
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold">Feature Guide & Tutorial</div>
                    <div className="text-xs text-muted-foreground">
                      Inks, widgets, snap & AI overview
                    </div>
                  </div>
                </button>
              </div>

              <div className="pt-2 border-t border-border">
                <Button
                  className="w-full justify-center gap-2 py-2"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openNew();
                  }}
                >
                  <Plus className="h-4 w-4" /> Create New Board
                </Button>
              </div>
            </div>
          </>
        )}
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        {/* Welcome */}
        <section>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-muted-foreground">
            Pick up where you left off, or start something new.
          </p>
        </section>

        {/* Continue Working - ONLY the most recent board */}
        {continueBoard ? (
          <section>
            <SectionHeader
              title="Continue working"
              icon={<Clock className="h-4 w-4" />}
              action={
                <Link
                  to="/library"
                  className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  View library <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <button
              onClick={() =>
                navigate({ to: "/board/$boardId", params: { boardId: continueBoard.id } })
              }
              className="group flex w-full items-center justify-between gap-4 rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:border-primary hover:shadow-md"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-foreground">{continueBoard.title}</h3>
                  {continueBoard.favorite && (
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Last edited {relTime(continueBoard.updatedAt)}
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
            </button>
          </section>
        ) : (
          <section>
            <SectionHeader title="Recent board" icon={<Clock className="h-4 w-4" />} />
            <EmptyState
              title="No boards created yet"
              subtitle="Create your first board to start drawing and sketching."
              action={
                <Button size="sm" onClick={() => openNew()}>
                  <Plus className="h-4 w-4" /> Create new board
                </Button>
              }
            />
          </section>
        )}

        {/* Quick Actions (with New Note and Learning Hub restored) */}
        <section>
          <SectionHeader title="Quick actions" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <QuickCard
              icon={<Plus className="h-5 w-5" />}
              title="Blank board"
              subtitle="Start with a clean canvas"
              onClick={() => openNew("blank")}
            />
            <QuickCard
              icon={<FolderOpen className="h-5 w-5" />}
              title="Open library"
              subtitle="Browse, sort, and organize"
              onClick={() => navigate({ to: "/library" })}
            />
            <QuickCard
              icon={<Sparkles className="h-5 w-5" />}
              title="AI-assisted board"
              subtitle="Start blank and open the AI helper"
              onClick={() => openNew("blank")}
            />
            <QuickCard
              icon={<FileText className="h-5 w-5" />}
              title="New note"
              subtitle="Block-based notes with AI actions"
              onClick={() => navigate({ to: "/notes" })}
            />
            <QuickCard
              icon={<GraduationCap className="h-5 w-5" />}
              title="Learning Hub"
              subtitle="Study flashcards & take quizzes"
              onClick={() => navigate({ to: "/learn" })}
            />
            <QuickCard
              icon={<BookOpen className="h-5 w-5 text-primary" />}
              title="Feature Guide & Tutorial"
              subtitle="Inks, widgets, snap & AI overview"
              onClick={() => setTourOpen(true)}
            />
          </div>
        </section>

        {/* My Boards & Folders (Organization & Starred Favorites) - Scrollable list */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <SectionHeader
                title="My Boards & Folders"
                icon={<Folder className="h-4 w-4 text-primary" />}
              />
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {filteredBoards.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-40 sm:w-52">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search boards..."
                  value={boardSearch}
                  onChange={(e) => setBoardSearch(e.target.value)}
                  className="pl-8 h-8 text-xs rounded-xl"
                />
              </div>

              {/* New Folder Popover */}
              <Popover open={newFolderOpen} onOpenChange={setNewFolderOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs rounded-xl">
                    <FolderPlus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">New Folder</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-3">
                  <form onSubmit={handleCreateFolder} className="space-y-2">
                    <div className="text-xs font-semibold text-foreground">Create Folder</div>
                    <Input
                      placeholder="Folder name (e.g. Physics)"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      className="h-8 text-xs"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1.5 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setNewFolderOpen(false)}
                        className="h-7 text-xs px-2"
                      >
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" className="h-7 text-xs px-2.5">
                        Create
                      </Button>
                    </div>
                  </form>
                </PopoverContent>
              </Popover>

              <Button size="sm" onClick={() => openNew()} className="h-8 gap-1.5 text-xs rounded-xl shadow-xs">
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New Board</span>
              </Button>
            </div>
          </div>

          {/* Folder Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveFolderId("all")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                activeFolderId === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card border text-muted-foreground hover:text-foreground"
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>All ({allBoards.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFolderId("starred")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                activeFolderId === "starred"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-card border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Star className={`h-3.5 w-3.5 ${activeFolderId === "starred" ? "fill-white" : "fill-amber-400 text-amber-400"}`} />
              <span>Starred ({starredBoards.length})</span>
            </button>

            {folders.map((f) => {
              const count = allBoards.filter((b) => b.folderId === f.id).length;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFolderId(f.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    activeFolderId === f.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-card border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Folder className="h-3.5 w-3.5" />
                  <span>{f.name} ({count})</span>
                </button>
              );
            })}
          </div>

          {/* Scrollable Boards Grid (Showing 3-4 visible initially, scroll to reveal rest) */}
          {filteredBoards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-card/50">
              <p className="text-sm font-semibold text-foreground">No boards found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {activeFolderId === "starred"
                  ? "Star your favorite boards to access them quickly here."
                  : "Create a new board in this folder to get started."}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openNew()}
                className="mt-3 gap-1.5 text-xs rounded-xl"
              >
                <Plus className="h-3.5 w-3.5" /> Create Board
              </Button>
            </div>
          ) : (
            <div className="relative">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[360px] overflow-y-auto pr-1 sm:pr-2 overscroll-contain rounded-2xl">
                {filteredBoards.map((b) => {
                  const folderObj = folders.find((f) => f.id === b.folderId);
                  return (
                    <div
                      key={b.id}
                      className="group relative flex flex-col justify-between rounded-2xl border bg-card p-4 shadow-2xs transition hover:border-primary/60 hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to="/board/$boardId"
                            params={{ boardId: b.id }}
                            className="font-semibold text-foreground text-sm hover:underline line-clamp-1"
                          >
                            {b.title}
                          </Link>
                          {/* Star Favorite Toggle */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleFavorite(b.id);
                            }}
                            className="shrink-0 p-1 rounded-lg hover:bg-muted text-muted-foreground transition active:scale-90"
                            title={b.favorite ? "Unstar board" : "Star board"}
                          >
                            <Star
                              className={`h-4 w-4 ${
                                b.favorite
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-muted-foreground/60 hover:text-foreground"
                              }`}
                            />
                          </button>
                        </div>

                        {/* Folder & Tags Bar */}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {/* Folder Picker Popover */}
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition"
                              >
                                <Folder className="h-3 w-3" />
                                <span className="truncate max-w-[90px]">{folderObj ? folderObj.name : "No folder"}</span>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-48 p-2">
                              <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
                                Move to folder
                              </div>
                              <button
                                type="button"
                                onClick={() => setBoardFolder(b.id, null)}
                                className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs hover:bg-accent text-left"
                              >
                                <span>None</span>
                                {!b.folderId && <Check className="h-3.5 w-3.5 text-primary" />}
                              </button>
                              {folders.map((f) => (
                                <button
                                  key={f.id}
                                  type="button"
                                  onClick={() => setBoardFolder(b.id, f.id)}
                                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs hover:bg-accent text-left"
                                >
                                  <span className="truncate">{f.name}</span>
                                  {b.folderId === f.id && <Check className="h-3.5 w-3.5 text-primary" />}
                                </button>
                              ))}
                            </PopoverContent>
                          </Popover>

                          {b.tags.slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-muted text-muted-foreground"
                            >
                              <Tag className="h-2.5 w-2.5" /> {t}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-2.5 text-xs text-muted-foreground">
                        <span className="text-[11px]">{relTime(b.updatedAt)}</span>
                        <Link
                          to="/board/$boardId"
                          params={{ boardId: b.id }}
                          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline text-xs"
                        >
                          Open <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredBoards.length > 3 && (
                <div className="mt-2 text-center">
                  <span className="text-[11px] text-muted-foreground">
                    Showing {Math.min(3, filteredBoards.length)} of {filteredBoards.length} boards • Scroll inside box to view more
                  </span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Recent AI Creations */}
        <section className="pb-16">
          <SectionHeader title="Recent AI creations" icon={<Wand2 className="h-4 w-4" />} />
          {recentAI.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              subtitle="Ask the AI assistant inside a board and your prompts will appear here."
            />
          ) : (
            <div className="space-y-2">
              {recentAI.slice(0, 6).map((r) => (
                <div key={r.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{r.prompt}</div>
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {r.response}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground">
                      {relTime(r.createdAt)}
                    </div>
                  </div>
                  {r.boardId && boards[r.boardId] && (
                    <Link
                      to="/board/$boardId"
                      params={{ boardId: r.boardId }}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Open {boards[r.boardId].title} <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <FeatureTourDialog open={tourOpen} onOpenChange={setTourOpen} />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}

function SectionHeader({
  title,
  icon,
  action,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}

function QuickCard({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition hover:border-primary hover:shadow-sm"
    >
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </button>
  );
}

function EmptyState({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
