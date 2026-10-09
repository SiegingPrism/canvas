import { create } from "zustand";
import type { CanvasObject, Page, ToolId, WhiteboardState } from "./types";
import { pagesForTemplate, type TemplateKey } from "./templates";
import {
  syncBoardToSupabase,
  fetchBoardsFromSupabase,
  deleteBoardFromSupabase,
} from "../supabase/dbService";

const STORAGE_KEY = "whiteboard.multi.v1";
const LEGACY_KEY = "whiteboard.v1";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function nowMs() {
  return Date.now();
}

function emptyPage(background: Page["background"] = "white"): Page {
  return { id: uid(), objects: [], background };
}

export type BoardMeta = {
  id: string;
  title: string;
  tags: string[];
  folderId: string | null;
  favorite: boolean;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  templateKey?: TemplateKey;
};
export type Folder = { id: string; name: string };
export type RecentAI = {
  id: string;
  prompt: string;
  response: string;
  boardId: string | null;
  createdAt: number;
};
type BoardData = { pages: Page[]; activePageId: string };

type PersistShape = {
  boards: Record<string, BoardMeta>;
  boardOrder: string[];
  boardData: Record<string, BoardData>;
  folders: Folder[];
  recentAI: RecentAI[];
};

function emptyPersist(): PersistShape {
  return { boards: {}, boardOrder: [], boardData: {}, folders: [], recentAI: [] };
}

function load(): PersistShape {
  if (typeof window === "undefined") return emptyPersist();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...emptyPersist(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const data = JSON.parse(legacy);
      const id = uid();
      const pages: Page[] = data.pages?.length ? data.pages : [emptyPage()];
      const meta: BoardMeta = {
        id,
        title: "Untitled board",
        tags: [],
        folderId: null,
        favorite: false,
        archived: false,
        createdAt: nowMs(),
        updatedAt: nowMs(),
      };
      return {
        boards: { [id]: meta },
        boardOrder: [id],
        boardData: { [id]: { pages, activePageId: data.activePageId ?? pages[0].id } },
        folders: [],
        recentAI: [],
      };
    }
  } catch {
    /* ignore */
  }
  return emptyPersist();
}

function savePersist(s: PersistShape) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

type Actions = {
  // Runtime tool state
  setTool: (tool: ToolId) => void;
  setColor: (color: string) => void;
  setSize: (size: number) => void;
  setSelected: (id: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
  setAutoSnapEnabled: (enabled: boolean) => void;
  moveSelected: (dx: number, dy: number) => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  recolorSelected: (color: string) => void;
  setCamera: (c: { x: number; y: number; zoom: number }) => void;
  // Active board content
  addObject: (obj: CanvasObject) => void;
  addObjectsToBoard: (boardId: string, objects: CanvasObject[]) => void;
  updateObject: (id: string, patch: Partial<CanvasObject>) => void;
  deleteObject: (id: string) => void;
  toggleTapeReveal: (id: string) => void;
  setAllTapeReveal: (revealed: boolean) => void;
  clearPage: () => void;
  eraseStrokes: () => void;
  addPage: () => void;
  removePage: (id: string) => void;
  setActivePage: (id: string) => void;
  nextPage: () => void;
  prevPage: () => void;
  setBackground: (bg: Page["background"]) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  // Board CRUD
  applyTemplate: (key: TemplateKey) => void;
  createBoard: (opts?: {
    title?: string;
    templateKey?: TemplateKey;
    folderId?: string | null;
  }) => string;
  openBoard: (id: string) => void;
  renameBoard: (id: string, title: string) => void;
  deleteBoard: (id: string) => void;
  duplicateBoard: (id: string) => string;
  toggleFavorite: (id: string) => void;
  toggleArchive: (id: string) => void;
  setBoardTags: (id: string, tags: string[]) => void;
  setBoardFolder: (id: string, folderId: string | null) => void;
  // Folders
  createFolder: (name: string) => string;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  // AI history
  addRecentAI: (item: Omit<RecentAI, "id" | "createdAt">) => void;
  clearRecentAI: () => void;
  // Supabase Cloud Sync
  syncWithCloud: () => Promise<void>;
};

type State = WhiteboardState & PersistShape & { activeBoardId: string | null; hydrated: boolean };

let cloudSyncTimer: ReturnType<typeof setTimeout> | null = null;
function triggerCloudSync(meta: BoardMeta, pages: Page[]) {
  if (typeof window === "undefined") return;
  if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    syncBoardToSupabase(meta, pages).catch(() => {});
  }, 1200);
}

function syncActive(state: State): State {
  if (!state.activeBoardId) return state;
  const boardData = {
    ...state.boardData,
    [state.activeBoardId]: { pages: state.pages, activePageId: state.activePageId },
  };
  const meta = state.boards[state.activeBoardId];
  const boards = meta
    ? { ...state.boards, [state.activeBoardId]: { ...meta, updatedAt: nowMs() } }
    : state.boards;
  const next = { ...state, boardData, boards };
  savePersist({
    boards: next.boards,
    boardOrder: next.boardOrder,
    boardData: next.boardData,
    folders: next.folders,
    recentAI: next.recentAI,
  });
  if (boards[state.activeBoardId]) {
    triggerCloudSync(boards[state.activeBoardId], state.pages);
  }
  return next;
}

function persistMeta(state: State) {
  savePersist({
    boards: state.boards,
    boardOrder: state.boardOrder,
    boardData: state.boardData,
    folders: state.folders,
    recentAI: state.recentAI,
  });
}

export const useWhiteboard = create<State & Actions>((set, get) => {
  return {
    // persist
    ...emptyPersist(),
    hydrated: false,
    activeBoardId: null,
    // whiteboard runtime
    pages: [emptyPage()],
    activePageId: "temp",
    tool: "pen",
    color: "#111827",
    size: 3,
    history: [],
    historyIndex: -1,
    selectedId: null,
    selectedIds: [],
    autoSnapEnabled: true,
    camera: { x: 0, y: 0, zoom: 1 },

    setTool: (tool) =>
      set({
        tool,
        selectedId: tool === "select" ? get().selectedId : null,
        selectedIds: tool === "lasso" || tool === "select" ? get().selectedIds : [],
      }),
    setColor: (color) => set({ color }),
    setSize: (size) => set({ size }),
    setSelected: (id) =>
      set({
        selectedId: id,
        selectedIds: id ? [id] : [],
      }),
    setSelectedIds: (ids) =>
      set({
        selectedIds: ids,
        selectedId: ids.length === 1 ? ids[0] : null,
      }),
    setAutoSnapEnabled: (autoSnapEnabled) => set({ autoSnapEnabled }),

    moveSelected: (dx, dy) => {
      const s = get();
      if (!s.selectedIds.length) return;
      const idSet = new Set(s.selectedIds);
      const pages = s.pages.map((p) => {
        if (p.id !== s.activePageId) return p;
        return {
          ...p,
          objects: p.objects.map((o) => {
            if (!idSet.has(o.id)) return o;
            if ("points" in o) {
              return {
                ...o,
                points: o.points.map((pt) => ({ ...pt, x: pt.x + dx, y: pt.y + dy })),
              } as CanvasObject;
            } else {
              return { ...o, x: o.x + dx, y: o.y + dy } as CanvasObject;
            }
          }),
        };
      });
      set(syncActive({ ...s, pages }));
    },

    duplicateSelected: () => {
      const s = get();
      const ids = s.selectedIds.length ? s.selectedIds : s.selectedId ? [s.selectedId] : [];
      if (!ids.length) return;
      const idSet = new Set(ids);
      const page = s.pages.find((p) => p.id === s.activePageId);
      if (!page) return;
      const newObjs: CanvasObject[] = [];
      const newIds: string[] = [];
      for (const o of page.objects) {
        if (idSet.has(o.id)) {
          const newId = uid();
          newIds.push(newId);
          if ("points" in o) {
            newObjs.push({
              ...o,
              id: newId,
              points: o.points.map((pt) => ({ ...pt, x: pt.x + 20, y: pt.y + 20 })),
            } as CanvasObject);
          } else {
            newObjs.push({
              ...o,
              id: newId,
              x: o.x + 20,
              y: o.y + 20,
            } as CanvasObject);
          }
        }
      }
      if (!newObjs.length) return;
      const pages = s.pages.map((p) =>
        p.id === s.activePageId ? { ...p, objects: [...p.objects, ...newObjs] } : p,
      );
      set(
        syncActive({
          ...s,
          pages,
          selectedIds: newIds,
          selectedId: newIds.length === 1 ? newIds[0] : null,
        }),
      );
    },

    deleteSelected: () => {
      const s = get();
      const ids = s.selectedIds.length ? s.selectedIds : s.selectedId ? [s.selectedId] : [];
      if (!ids.length) return;
      const idSet = new Set(ids);
      const pages = s.pages.map((p) =>
        p.id === s.activePageId ? { ...p, objects: p.objects.filter((o) => !idSet.has(o.id)) } : p,
      );
      set(syncActive({ ...s, pages, selectedId: null, selectedIds: [] }));
    },

    recolorSelected: (color: string) => {
      const s = get();
      const ids = s.selectedIds.length ? s.selectedIds : s.selectedId ? [s.selectedId] : [];
      if (!ids.length) return;
      const idSet = new Set(ids);
      const pages = s.pages.map((p) => {
        if (p.id !== s.activePageId) return p;
        return {
          ...p,
          objects: p.objects.map((o) => {
            if (!idSet.has(o.id)) return o;
            return { ...o, color } as CanvasObject;
          }),
        };
      });
      set(syncActive({ ...s, pages }));
    },

    setCamera: (camera) => set({ camera }),

    addObject: (obj) => {
      const s = get();
      const pages = s.pages.map((p) =>
        p.id === s.activePageId ? { ...p, objects: [...p.objects, obj] } : p,
      );
      set(syncActive({ ...s, pages }));
    },
    addObjectsToBoard: (boardId, objects) => {
      if (!objects || !objects.length) return;
      const s = get();
      const bd = s.boardData[boardId] || { pages: [emptyPage()], activePageId: "" };
      const targetPageId = bd.activePageId || bd.pages[0]?.id || "";
      const pages = bd.pages.map((p) =>
        p.id === targetPageId ? { ...p, objects: [...p.objects, ...objects] } : p
      );
      const boardData = { ...s.boardData, [boardId]: { ...bd, pages } };
      const meta = s.boards[boardId];
      const boards = meta ? { ...s.boards, [boardId]: { ...meta, updatedAt: nowMs() } } : s.boards;
      const next: State = {
        ...s,
        boardData,
        boards,
        pages: s.activeBoardId === boardId ? pages : s.pages,
      };
      persistMeta(next);
      set(next);
      if (boards[boardId]) {
        triggerCloudSync(boards[boardId], pages);
      }
    },
    updateObject: (id, patch) => {
      const s = get();
      const pages = s.pages.map((p) =>
        p.id === s.activePageId
          ? {
              ...p,
              objects: p.objects.map((o) =>
                o.id === id ? ({ ...o, ...patch } as CanvasObject) : o,
              ),
            }
          : p,
      );
      set(syncActive({ ...s, pages }));
    },
    deleteObject: (id: string) => {
      const s = get();
      const pages = s.pages.map((p) =>
        p.id === s.activePageId ? { ...p, objects: p.objects.filter((o) => o.id !== id) } : p,
      );
      set(
        syncActive({
          ...s,
          pages,
          selectedId: s.selectedId === id ? null : s.selectedId,
          selectedIds: s.selectedIds.filter((x) => x !== id),
        }),
      );
    },
    toggleTapeReveal: (id: string) => {
      const s = get();
      const page = s.pages.find((p) => p.id === s.activePageId);
      const obj = page?.objects.find((o) => o.id === id);
      if (obj && obj.kind === "tape") {
        s.updateObject(id, { revealed: !obj.revealed });
      }
    },
    setAllTapeReveal: (revealed: boolean) => {
      const s = get();
      const pages = s.pages.map((p) => {
        if (p.id !== s.activePageId) return p;
        return {
          ...p,
          objects: p.objects.map((o) => (o.kind === "tape" ? { ...o, revealed } : o)),
        };
      });
      set(syncActive({ ...s, pages }));
    },
    clearPage: () => {
      const s = get();
      const pages = s.pages.map((p) => (p.id === s.activePageId ? { ...p, objects: [] } : p));
      set(syncActive({ ...s, pages, selectedId: null, selectedIds: [] }));
    },
    eraseStrokes: () => {
      const s = get();
      const isStroke = (kind: string) =>
        kind === "pen" ||
        kind === "fountain" ||
        kind === "neon" ||
        kind === "crayon" ||
        kind === "highlighter" ||
        kind === "rainbow" ||
        kind === "dashed" ||
        kind === "brush" ||
        kind === "marker" ||
        kind === "pencil" ||
        kind === "glitter" ||
        kind === "dotted" ||
        kind === "parallel";
      const pages = s.pages.map((p) =>
        p.id === s.activePageId
          ? { ...p, objects: p.objects.filter((obj) => !isStroke(obj.kind)) }
          : p,
      );
      set(syncActive({ ...s, pages, selectedId: null, selectedIds: [] }));
    },
    addPage: () => {
      const s = get();
      const p = emptyPage();
      set(syncActive({ ...s, pages: [...s.pages, p], activePageId: p.id }));
    },
    removePage: (id) => {
      const s = get();
      if (s.pages.length === 1) return;
      const pages = s.pages.filter((p) => p.id !== id);
      const activePageId = s.activePageId === id ? pages[0].id : s.activePageId;
      set(syncActive({ ...s, pages, activePageId }));
    },
    setActivePage: (id) => {
      const s = get();
      set(syncActive({ ...s, activePageId: id, selectedId: null }));
    },
    nextPage: () => {
      const s = get();
      const i = s.pages.findIndex((p) => p.id === s.activePageId);
      const n = s.pages[Math.min(i + 1, s.pages.length - 1)];
      set(syncActive({ ...s, activePageId: n.id, selectedId: null }));
    },
    prevPage: () => {
      const s = get();
      const i = s.pages.findIndex((p) => p.id === s.activePageId);
      const n = s.pages[Math.max(i - 1, 0)];
      set(syncActive({ ...s, activePageId: n.id, selectedId: null }));
    },
    setBackground: (bg) => {
      const s = get();
      const pages = s.pages.map((p) => (p.id === s.activePageId ? { ...p, background: bg } : p));
      set(syncActive({ ...s, pages }));
    },
    pushHistory: () => {
      const s = get();
      const snap = structuredClone(s.pages);
      const history = [...s.history.slice(0, s.historyIndex + 1), snap].slice(-50);
      set({ history, historyIndex: history.length - 1 });
    },
    undo: () => {
      const s = get();
      if (s.historyIndex <= 0) return;
      const i = s.historyIndex - 1;
      const pages = structuredClone(s.history[i]);
      set(syncActive({ ...s, pages, historyIndex: i }));
    },
    redo: () => {
      const s = get();
      if (s.historyIndex >= s.history.length - 1) return;
      const i = s.historyIndex + 1;
      const pages = structuredClone(s.history[i]);
      set(syncActive({ ...s, pages, historyIndex: i }));
    },

    applyTemplate: (key: TemplateKey) => {
      const s = get();
      const tPages = pagesForTemplate(key);
      if (!tPages.length) return;
      const target = tPages[0];
      const active = s.pages.find((p) => p.id === s.activePageId);
      let pages: Page[];
      let activePageId = s.activePageId;
      if (active && active.objects.length === 0) {
        // Replace empty page with template
        pages = s.pages.map((p) => (p.id === s.activePageId ? { ...target, id: p.id } : p));
      } else {
        // Insert new template page and focus it
        pages = [...s.pages, target];
        activePageId = target.id;
      }
      set(syncActive({ ...s, pages, activePageId, selectedId: null, selectedIds: [] }));
      get().pushHistory();
    },

    createBoard: (opts) => {
      const s = get();
      const id = uid();
      const templateKey = opts?.templateKey;
      const pages = templateKey ? pagesForTemplate(templateKey) : [emptyPage()];
      const title = opts?.title ?? "Untitled board";
      const meta: BoardMeta = {
        id,
        title,
        tags: [],
        folderId: opts?.folderId ?? null,
        favorite: false,
        archived: false,
        createdAt: nowMs(),
        updatedAt: nowMs(),
        templateKey,
      };
      const boards = { ...s.boards, [id]: meta };
      const boardOrder = [id, ...s.boardOrder];
      const boardData = { ...s.boardData, [id]: { pages, activePageId: pages[0].id } };
      const next: State = { ...s, boards, boardOrder, boardData };
      persistMeta(next);
      set(next);
      triggerCloudSync(meta, pages);
      return id;
    },
    openBoard: (id) => {
      const s = get();
      const bd = s.boardData[id];
      if (!bd) return;
      // sync outgoing
      let boardData = s.boardData;
      let boards = s.boards;
      if (s.activeBoardId && s.boards[s.activeBoardId]) {
        boardData = {
          ...boardData,
          [s.activeBoardId]: { pages: s.pages, activePageId: s.activePageId },
        };
        boards = {
          ...boards,
          [s.activeBoardId]: { ...s.boards[s.activeBoardId], updatedAt: nowMs() },
        };
      }
      const next: State = {
        ...s,
        boardData,
        boards,
        activeBoardId: id,
        pages: bd.pages,
        activePageId: bd.activePageId,
        history: [structuredClone(bd.pages)],
        historyIndex: 0,
        selectedId: null,
        camera: { x: 0, y: 0, zoom: 1 },
      };
      persistMeta(next);
      set(next);
    },
    renameBoard: (id, title) => {
      const s = get();
      if (!s.boards[id]) return;
      const boards = { ...s.boards, [id]: { ...s.boards[id], title, updatedAt: nowMs() } };
      const next = { ...s, boards };
      persistMeta(next);
      set(next);
    },
    deleteBoard: (id) => {
      const s = get();
      const { [id]: _m, ...boards } = s.boards;
      const { [id]: _d, ...boardData } = s.boardData;
      const boardOrder = s.boardOrder.filter((b) => b !== id);
      const activeBoardId = s.activeBoardId === id ? null : s.activeBoardId;
      const next: State = { ...s, boards, boardData, boardOrder, activeBoardId };
      persistMeta(next);
      set(next);
      deleteBoardFromSupabase(id).catch(() => {});
    },
    duplicateBoard: (id) => {
      const s = get();
      const src = s.boards[id];
      const data = s.boardData[id];
      if (!src || !data) return "";
      const newId = uid();
      const meta: BoardMeta = {
        ...src,
        id: newId,
        title: `${src.title} (copy)`,
        favorite: false,
        archived: false,
        createdAt: nowMs(),
        updatedAt: nowMs(),
      };
      const clone = structuredClone(data);
      const boards = { ...s.boards, [newId]: meta };
      const boardOrder = [newId, ...s.boardOrder];
      const boardData = { ...s.boardData, [newId]: clone };
      const next = { ...s, boards, boardOrder, boardData };
      persistMeta(next);
      set(next);
      triggerCloudSync(meta, clone.pages);
      return newId;
    },
    toggleFavorite: (id) => {
      const s = get();
      if (!s.boards[id]) return;
      const boards = { ...s.boards, [id]: { ...s.boards[id], favorite: !s.boards[id].favorite } };
      const next = { ...s, boards };
      persistMeta(next);
      set(next);
      triggerCloudSync(boards[id], s.boardData[id]?.pages || []);
    },
    toggleArchive: (id) => {
      const s = get();
      if (!s.boards[id]) return;
      const boards = { ...s.boards, [id]: { ...s.boards[id], archived: !s.boards[id].archived } };
      const next = { ...s, boards };
      persistMeta(next);
      set(next);
      triggerCloudSync(boards[id], s.boardData[id]?.pages || []);
    },
    setBoardTags: (id, tags) => {
      const s = get();
      if (!s.boards[id]) return;
      const boards = { ...s.boards, [id]: { ...s.boards[id], tags } };
      const next = { ...s, boards };
      persistMeta(next);
      set(next);
      triggerCloudSync(boards[id], s.boardData[id]?.pages || []);
    },
    setBoardFolder: (id, folderId) => {
      const s = get();
      if (!s.boards[id]) return;
      const boards = { ...s.boards, [id]: { ...s.boards[id], folderId } };
      const next = { ...s, boards };
      persistMeta(next);
      set(next);
      triggerCloudSync(boards[id], s.boardData[id]?.pages || []);
    },

    createFolder: (name) => {
      const s = get();
      const id = uid();
      const folders = [...s.folders, { id, name }];
      const next = { ...s, folders };
      persistMeta(next);
      set(next);
      return id;
    },
    renameFolder: (id, name) => {
      const s = get();
      const folders = s.folders.map((f) => (f.id === id ? { ...f, name } : f));
      const next = { ...s, folders };
      persistMeta(next);
      set(next);
    },
    deleteFolder: (id) => {
      const s = get();
      const folders = s.folders.filter((f) => f.id !== id);
      const boards: Record<string, BoardMeta> = {};
      for (const [bid, b] of Object.entries(s.boards)) {
        boards[bid] = b.folderId === id ? { ...b, folderId: null } : b;
      }
      const next = { ...s, folders, boards };
      persistMeta(next);
      set(next);
    },

    addRecentAI: (item) => {
      const s = get();
      const entry: RecentAI = { id: uid(), createdAt: nowMs(), ...item };
      const recentAI = [entry, ...s.recentAI].slice(0, 20);
      const next = { ...s, recentAI };
      persistMeta(next);
      set(next);
    },
    clearRecentAI: () => {
      const s = get();
      const next = { ...s, recentAI: [] };
      persistMeta(next);
      set(next);
    },

    syncWithCloud: async () => {
      try {
        const cloudBoards = await fetchBoardsFromSupabase();
        if (!cloudBoards || !cloudBoards.length) return;
        const s = get();
        const mergedBoards = { ...s.boards };
        const mergedBoardData = { ...s.boardData };
        const mergedBoardOrder = [...s.boardOrder];

        for (const cb of cloudBoards) {
          const localMeta = mergedBoards[cb.id];
          if (!localMeta || (cb.updated_at && new Date(cb.updated_at).getTime() > localMeta.updatedAt)) {
            const updatedAt = cb.updated_at ? new Date(cb.updated_at).getTime() : nowMs();
            const createdAt = cb.created_at ? new Date(cb.created_at).getTime() : nowMs();
            mergedBoards[cb.id] = {
              id: cb.id,
              title: cb.title || "Untitled board",
              tags: [],
              folderId: cb.folder_id || null,
              favorite: Boolean(cb.is_starred),
              archived: false,
              createdAt,
              updatedAt,
            };
            const pages = Array.isArray(cb.pages) && cb.pages.length ? cb.pages : [emptyPage()];
            mergedBoardData[cb.id] = {
              pages,
              activePageId: pages[0]?.id || uid(),
            };
            if (!mergedBoardOrder.includes(cb.id)) {
              mergedBoardOrder.push(cb.id);
            }
          }
        }

        const next: State = {
          ...s,
          boards: mergedBoards,
          boardData: mergedBoardData,
          boardOrder: mergedBoardOrder,
        };
        persistMeta(next);
        set(next);
      } catch (err) {
        console.warn("[Whiteboard] Cloud sync failed:", err);
      }
    },
  };
});

if (typeof window !== "undefined") {
  setTimeout(() => {
    const loaded = load();
    useWhiteboard.setState((prev) => ({
      ...loaded,
      hydrated: true,
      // Keep any active board if already set
      activeBoardId: prev.activeBoardId || null,
      pages: prev.activeBoardId && prev.pages.length ? prev.pages : prev.pages || [emptyPage()],
    }));
    useWhiteboard.getState().syncWithCloud().catch(() => {});
  }, 0);
}
