import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useWhiteboard } from "@/lib/whiteboard/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Star,
  Archive,
  Copy,
  Trash2,
  Folder,
  FolderPlus,
  MoreVertical,
  ArrowLeft,
  Tag as TagIcon,
  Pencil,
  ArrowUpDown,
  Sparkles,
} from "lucide-react";
import { semanticSearch } from "@/lib/ai/localRAG";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Board library — Slate" },
      { name: "description", content: "Search, sort, tag, and organize your whiteboards." },
    ],
  }),
  component: Library,
});

type View = "grid" | "list";
type Sort = "updated" | "created" | "title";
type Filter = "all" | "favorites" | "archived" | { folderId: string };

function Library() {
  const navigate = useNavigate();
  const {
    boards,
    boardOrder,
    folders,
    createBoard,
    deleteBoard,
    duplicateBoard,
    toggleFavorite,
    toggleArchive,
    renameBoard,
    setBoardTags,
    setBoardFolder,
    createFolder,
    deleteFolder,
    renameFolder,
  } = useWhiteboard();

  const [view, setView] = useState<View>("grid");
  const [sort, setSort] = useState<Sort>("updated");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [useSemanticSearch, setUseSemanticSearch] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newFolder, setNewFolder] = useState("");

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const id of boardOrder) boards[id]?.tags.forEach((t) => s.add(t));
    return Array.from(s).sort();
  }, [boards, boardOrder]);

  const semanticScoreMap = useMemo(() => {
    if (!useSemanticSearch || !query.trim()) return null;
    const matches = semanticSearch(query, 40);
    const map = new Map<string, number>();
    matches.filter((m) => m.sourceType === "board").forEach((m) => map.set(m.id, m.score));
    return map;
  }, [useSemanticSearch, query]);

  const visible = useMemo(() => {
    const list = boardOrder.map((id) => boards[id]).filter(Boolean);
    const base = list
      .filter((b) => {
        if (filter === "all") return !b.archived;
        if (filter === "favorites") return b.favorite && !b.archived;
        if (filter === "archived") return b.archived;
        return !b.archived && b.folderId === filter.folderId;
      })
      .filter((b) => (tagFilter ? b.tags.includes(tagFilter) : true));

    if (semanticScoreMap) {
      return base
        .filter((b) => semanticScoreMap.has(b.id))
        .sort((a, b) => (semanticScoreMap.get(b.id) || 0) - (semanticScoreMap.get(a.id) || 0));
    }

    return base
      .filter((b) => (query ? b.title.toLowerCase().includes(query.toLowerCase()) : true))
      .sort((a, b) => {
        if (sort === "title") return a.title.localeCompare(b.title);
        if (sort === "created") return b.createdAt - a.createdAt;
        return b.updatedAt - a.updatedAt;
      });
  }, [boards, boardOrder, filter, tagFilter, query, sort, semanticScoreMap]);

  function openNew() {
    const folderId = typeof filter === "object" ? filter.folderId : null;
    const id = createBoard({ folderId });
    navigate({ to: "/board/$boardId", params: { boardId: id } });
  }

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

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent"
              title="Back to dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="font-semibold">Board library</h1>
          </div>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" /> New board
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside className="space-y-6">
          <nav className="space-y-1">
            <SideItem
              active={filter === "all"}
              onClick={() => setFilter("all")}
              icon={<LayoutGrid className="h-4 w-4" />}
              label="All boards"
            />
            <SideItem
              active={filter === "favorites"}
              onClick={() => setFilter("favorites")}
              icon={<Star className="h-4 w-4" />}
              label="Favorites"
            />
            <SideItem
              active={filter === "archived"}
              onClick={() => setFilter("archived")}
              icon={<Archive className="h-4 w-4" />}
              label="Archived"
            />
          </nav>

          <div>
            <div className="mb-2 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Folders
            </div>
            <nav className="space-y-1">
              {folders.map((f) => (
                <div key={f.id} className="group flex items-center gap-1">
                  <button
                    onClick={() => setFilter({ folderId: f.id })}
                    className={`flex-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${typeof filter === "object" && filter.folderId === f.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                  >
                    <Folder className="h-4 w-4" />
                    <span className="truncate">{f.name}</span>
                  </button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="opacity-0 group-hover:opacity-100 rounded-md p-1 hover:bg-accent">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-44 p-1" align="end">
                      <button
                        onClick={() => {
                          const name = prompt("Rename folder", f.name);
                          if (name) renameFolder(f.id, name);
                        }}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Rename
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete folder "${f.name}"? Boards will be moved to All.`))
                            deleteFolder(f.id);
                        }}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </PopoverContent>
                  </Popover>
                </div>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newFolder.trim()) return;
                  createFolder(newFolder.trim());
                  setNewFolder("");
                }}
                className="flex items-center gap-1 px-1 pt-1"
              >
                <Input
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  placeholder="New folder"
                  className="h-8 text-xs"
                />
                <Button size="icon" variant="ghost" type="submit" className="h-8 w-8">
                  <FolderPlus className="h-4 w-4" />
                </Button>
              </form>
            </nav>
          </div>

          {allTags.length > 0 && (
            <div>
              <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tags
              </div>
              <div className="flex flex-wrap gap-1.5 px-2">
                <button
                  onClick={() => setTagFilter(null)}
                  className={`rounded-full px-2 py-0.5 text-xs ${!tagFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                >
                  All
                </button>
                {allTags.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTagFilter(t === tagFilter ? null : t)}
                    className={`rounded-full px-2 py-0.5 text-xs ${tagFilter === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main */}
        <main>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-56 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={useSemanticSearch ? "Semantic AI Search across boards..." : "Search boards..."}
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
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <ArrowUpDown className="h-4 w-4" />
                  {sort === "updated" ? "Recent" : sort === "created" ? "Created" : "Title"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-1" align="end">
                {(["updated", "created", "title"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm capitalize hover:bg-accent"
                  >
                    {s === "updated"
                      ? "Recently edited"
                      : s === "created"
                        ? "Recently created"
                        : "Title A→Z"}
                    {sort === s && <span className="text-primary">✓</span>}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            <div className="flex items-center rounded-md border">
              <button
                onClick={() => setView("grid")}
                className={`grid h-8 w-8 place-items-center rounded-l-md ${view === "grid" ? "bg-accent text-foreground" : "text-muted-foreground"}`}
                title="Grid"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView("list")}
                className={`grid h-8 w-8 place-items-center rounded-r-md ${view === "list" ? "bg-accent text-foreground" : "text-muted-foreground"}`}
                title="List"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed p-16 text-center">
              <p className="text-sm font-medium">No boards match</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try clearing filters or create a new board.
              </p>
              <Button size="sm" className="mt-4" onClick={openNew}>
                <Plus className="h-4 w-4" /> New board
              </Button>
            </div>
          ) : view === "grid" ? (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {visible.map((b) => (
                <div
                  key={b.id}
                  className="group relative flex aspect-[4/3] flex-col justify-end rounded-xl border bg-gradient-to-br from-muted/40 to-muted p-3 text-left transition hover:border-primary hover:shadow-sm"
                >
                  <button
                    onClick={() => navigate({ to: "/board/$boardId", params: { boardId: b.id } })}
                    className="absolute inset-0 rounded-xl"
                    aria-label={`Open ${b.title}`}
                  />
                  <div className="relative z-10 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        {b.favorite && (
                          <Star className="h-3.5 w-3.5 shrink-0 fill-yellow-400 text-yellow-400" />
                        )}
                        <span className="truncate">{b.title}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{relTime(b.updatedAt)}</div>
                      {b.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {b.tags.slice(0, 3).map((t) => (
                            <Badge key={t} variant="secondary" className="text-[10px]">
                              #{t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <BoardActions
                      board={b}
                      folders={folders}
                      onToggleFavorite={() => toggleFavorite(b.id)}
                      onToggleArchive={() => toggleArchive(b.id)}
                      onDuplicate={() => duplicateBoard(b.id)}
                      onDelete={() => setConfirmDelete(b.id)}
                      onRename={() => {
                        setRenaming(b.id);
                        setRenameValue(b.title);
                      }}
                      onSetTags={(tags) => setBoardTags(b.id, tags)}
                      onSetFolder={(fid) => setBoardFolder(b.id, fid)}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Title</th>
                    <th className="px-4 py-2">Tags</th>
                    <th className="px-4 py-2">Updated</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((b) => (
                    <tr key={b.id} className="border-t hover:bg-accent/30">
                      <td className="px-4 py-2">
                        <button
                          onClick={() =>
                            navigate({ to: "/board/$boardId", params: { boardId: b.id } })
                          }
                          className="flex items-center gap-2 font-medium"
                        >
                          {b.favorite && (
                            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          )}
                          {b.title}
                        </button>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {b.tags.map((t) => (
                            <Badge key={t} variant="secondary" className="text-[10px]">
                              #{t}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{relTime(b.updatedAt)}</td>
                      <td className="px-4 py-2 text-right">
                        <BoardActions
                          board={b}
                          folders={folders}
                          onToggleFavorite={() => toggleFavorite(b.id)}
                          onToggleArchive={() => toggleArchive(b.id)}
                          onDuplicate={() => duplicateBoard(b.id)}
                          onDelete={() => setConfirmDelete(b.id)}
                          onRename={() => {
                            setRenaming(b.id);
                            setRenameValue(b.title);
                          }}
                          onSetTags={(tags) => setBoardTags(b.id, tags)}
                          onSetFolder={(fid) => setBoardFolder(b.id, fid)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* Rename dialog */}
      <AlertDialog open={!!renaming} onOpenChange={(v) => !v && setRenaming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename board</AlertDialogTitle>
            <AlertDialogDescription>Give this board a new name.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renaming && renameValue.trim()) {
                renameBoard(renaming, renameValue.trim());
                setRenaming(null);
              }
            }}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (renaming && renameValue.trim()) renameBoard(renaming, renameValue.trim());
                setRenaming(null);
              }}
            >
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this board?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the board and its pages. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) deleteBoard(confirmDelete);
                setConfirmDelete(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SideItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm ${active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
    >
      {icon}
      {label}
    </button>
  );
}

function BoardActions({
  board,
  folders,
  onToggleFavorite,
  onToggleArchive,
  onDuplicate,
  onDelete,
  onRename,
  onSetTags,
  onSetFolder,
}: {
  board: {
    id: string;
    favorite: boolean;
    archived: boolean;
    tags: string[];
    folderId: string | null;
  };
  folders: { id: string; name: string }[];
  onToggleFavorite: () => void;
  onToggleArchive: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRename: () => void;
  onSetTags: (tags: string[]) => void;
  onSetFolder: (folderId: string | null) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative z-20 grid h-8 w-8 place-items-center rounded-md bg-background/60 hover:bg-accent"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="end" onClick={(e) => e.stopPropagation()}>
        <MenuItem icon={<Star className="h-4 w-4" />} onClick={onToggleFavorite}>
          {board.favorite ? "Unfavorite" : "Favorite"}
        </MenuItem>
        <MenuItem icon={<Pencil className="h-4 w-4" />} onClick={onRename}>
          Rename
        </MenuItem>
        <MenuItem icon={<Copy className="h-4 w-4" />} onClick={onDuplicate}>
          Duplicate
        </MenuItem>
        <MenuItem
          icon={<TagIcon className="h-4 w-4" />}
          onClick={() => {
            const t = prompt("Tags (comma separated)", board.tags.join(", "));
            if (t !== null) {
              const tags = t
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean);
              onSetTags(tags);
            }
          }}
        >
          Edit tags
        </MenuItem>
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
              <Folder className="h-4 w-4" /> Move to folder
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" side="left" align="start">
            <MenuItem icon={<span className="w-4" />} onClick={() => onSetFolder(null)}>
              No folder
            </MenuItem>
            {folders.map((f) => (
              <MenuItem
                key={f.id}
                icon={<Folder className="h-4 w-4" />}
                onClick={() => onSetFolder(f.id)}
              >
                {f.name}
              </MenuItem>
            ))}
            {folders.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">No folders yet</div>
            )}
          </PopoverContent>
        </Popover>
        <MenuItem icon={<Archive className="h-4 w-4" />} onClick={onToggleArchive}>
          {board.archived ? "Restore" : "Archive"}
        </MenuItem>
        <div className="my-1 h-px bg-border" />
        <MenuItem icon={<Trash2 className="h-4 w-4" />} destructive onClick={onDelete}>
          Delete
        </MenuItem>
      </PopoverContent>
    </Popover>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent ${destructive ? "text-destructive" : ""}`}
    >
      {icon}
      {children}
    </button>
  );
}
