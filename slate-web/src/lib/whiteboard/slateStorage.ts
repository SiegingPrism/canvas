import { toast } from "sonner";
import type { Page, CanvasObject } from "./types";

export type Folder = { id: string; name: string };
export type RecentAI = {
  id: string;
  prompt: string;
  response: string;
  boardId: string | null;
  createdAt: number;
};

export type BoardMeta = {
  id: string;
  title: string;
  tags: string[];
  folderId: string | null;
  favorite: boolean;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  isCloudSynced?: boolean;
};

export type BoardData = {
  pages: Page[];
  activePageId: string;
};

export type PersistMetaShape = {
  boards: Record<string, BoardMeta>;
  boardOrder: string[];
  folders: Folder[];
  recentAI: RecentAI[];
};

export type FullPersistShape = PersistMetaShape & {
  boardData: Record<string, BoardData>;
};

const DB_NAME = "slate_whiteboard_db";
const DB_VERSION = 1;
const STORE_BOARDS = "boards";
const STORE_META = "meta";

const LS_LEGACY_KEY = "whiteboard.pages.v1";
const LS_MULTI_KEY = "whiteboard.multi.v1";
const LS_META_KEY = "slate_whiteboard_meta_v2";

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

function getIndexedDB(): IDBFactory | null {
  if (typeof window === "undefined") return null;
  return window.indexedDB || (window as unknown as { mozIndexedDB?: IDBFactory; webkitIndexedDB?: IDBFactory }).webkitIndexedDB || null;
}

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  const idb = getIndexedDB();
  if (!idb) {
    return Promise.reject(new Error("IndexedDB not supported"));
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = idb.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_BOARDS)) {
        db.createObjectStore(STORE_BOARDS);
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    };

    req.onsuccess = () => {
      dbInstance = req.result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    req.onerror = () => {
      console.error("[SlateStorage] Failed to open IndexedDB:", req.error);
      reject(req.error);
    };
  });

  return dbPromise;
}

function notifyStorageError(err: unknown) {
  console.error("[SlateStorage] Save failure:", err);
  if (typeof window !== "undefined") {
    toast.error("Storage quota full! Please sync to Cloud or remove unused images to avoid data loss.", {
      id: "slate-storage-quota-error",
      duration: 6000,
    });
  }
}

/**
 * Empty shape helpers
 */
export function emptyMetaShape(): PersistMetaShape {
  return { boards: {}, boardOrder: [], folders: [], recentAI: [] };
}

export function emptyFullPersist(): FullPersistShape {
  return { ...emptyMetaShape(), boardData: {} };
}

/**
 * Synchronous initial loader (reads metadata from localStorage for fast initial paint)
 */
export function loadInitialSync(): FullPersistShape {
  if (typeof window === "undefined") return emptyFullPersist();

  // 1. Try modern lightweight meta key
  try {
    const metaRaw = localStorage.getItem(LS_META_KEY);
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw);
      return {
        boards: parsed.boards || {},
        boardOrder: parsed.boardOrder || [],
        folders: parsed.folders || [],
        recentAI: parsed.recentAI || [],
        boardData: {},
      };
    }
  } catch (err) {
    console.warn("[SlateStorage] Error parsing meta storage:", err);
  }

  // 2. Try legacy multi key if meta key doesn't exist yet
  try {
    const multiRaw = localStorage.getItem(LS_MULTI_KEY);
    if (multiRaw) {
      const parsed = JSON.parse(multiRaw);
      return {
        boards: parsed.boards || {},
        boardOrder: parsed.boardOrder || [],
        folders: parsed.folders || [],
        recentAI: parsed.recentAI || [],
        boardData: parsed.boardData || {},
      };
    }
  } catch {
    /* ignore */
  }

  return emptyFullPersist();
}

/**
 * Loads all data asynchronously from IndexedDB, migrating legacy localStorage blobs if present.
 */
export async function loadFromStorage(): Promise<FullPersistShape> {
  if (typeof window === "undefined") return emptyFullPersist();

  // Check for legacy localStorage data needing migration
  let legacyData: FullPersistShape | null = null;
  try {
    const multiRaw = localStorage.getItem(LS_MULTI_KEY);
    if (multiRaw) {
      legacyData = JSON.parse(multiRaw);
    }
  } catch {
    /* ignore */
  }

  try {
    const db = await openDB();

    // Load meta
    const meta: PersistMetaShape =
      (await new Promise<PersistMetaShape | null>((resolve) => {
        const tx = db.transaction(STORE_META, "readonly");
        const store = tx.objectStore(STORE_META);
        const req = store.get("meta");
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      })) || emptyMetaShape();

    // Load all board data
    const boardDataMap: Record<string, BoardData> = {};
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_BOARDS, "readonly");
      const store = tx.objectStore(STORE_BOARDS);
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          boardDataMap[cursor.key as string] = cursor.value;
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => resolve();
    });

    // If IndexedDB had nothing but legacy localStorage has data, migrate it!
    if (Object.keys(boardDataMap).length === 0 && legacyData && Object.keys(legacyData.boards || {}).length > 0) {
      console.log("[SlateStorage] Migrating localStorage boards into IndexedDB...");
      await saveFullPersist(legacyData);
      // Clean up the massive localStorage blob to free the 5MB quota
      try {
        localStorage.removeItem(LS_MULTI_KEY);
        localStorage.removeItem(LS_LEGACY_KEY);
      } catch {
        /* ignore */
      }
      return legacyData;
    }

    return {
      boards: meta.boards || {},
      boardOrder: meta.boardOrder || [],
      folders: meta.folders || [],
      recentAI: meta.recentAI || [],
      boardData: boardDataMap,
    };
  } catch (err) {
    console.warn("[SlateStorage] IndexedDB read failed, falling back to localStorage:", err);
    if (legacyData) return legacyData;
    return loadInitialSync();
  }
}

/**
 * Save single board data into IndexedDB (debounced per board)
 */
const boardSaveDebounceTimers: Record<string, NodeJS.Timeout> = {};

export function saveBoardDataAsync(boardId: string, data: BoardData): void {
  if (typeof window === "undefined" || !boardId) return;

  if (boardSaveDebounceTimers[boardId]) {
    clearTimeout(boardSaveDebounceTimers[boardId]);
  }

  boardSaveDebounceTimers[boardId] = setTimeout(async () => {
    delete boardSaveDebounceTimers[boardId];
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_BOARDS, "readwrite");
      tx.onabort = () => notifyStorageError(tx.error);
      tx.onerror = () => notifyStorageError(tx.error);
      const store = tx.objectStore(STORE_BOARDS);
      store.put(data, boardId);
    } catch (err) {
      notifyStorageError(err);
      // Fallback: save to per-board key in localStorage if small enough
      try {
        localStorage.setItem(`slate_b_${boardId}`, JSON.stringify(data));
      } catch (lsErr) {
        notifyStorageError(lsErr);
      }
    }
  }, 250);
}

/**
 * Save meta to both IndexedDB and lightweight localStorage key
 */
let metaSaveDebounceTimer: NodeJS.Timeout | null = null;

export function saveMetaAsync(meta: PersistMetaShape): void {
  if (typeof window === "undefined") return;

  // 1. Immediately write lightweight meta to localStorage so it's synchronously available
  try {
    localStorage.setItem(LS_META_KEY, JSON.stringify(meta));
  } catch (lsErr) {
    notifyStorageError(lsErr);
  }

  // 2. Debounced IndexedDB write
  if (metaSaveDebounceTimer) clearTimeout(metaSaveDebounceTimer);
  metaSaveDebounceTimer = setTimeout(async () => {
    metaSaveDebounceTimer = null;
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_META, "readwrite");
      tx.onabort = () => notifyStorageError(tx.error);
      tx.onerror = () => notifyStorageError(tx.error);
      const store = tx.objectStore(STORE_META);
      store.put(meta, "meta");
    } catch (err) {
      notifyStorageError(err);
    }
  }, 200);
}

/**
 * Save full state (e.g. during initial cloud sync or import)
 */
export async function saveFullPersist(shape: FullPersistShape): Promise<void> {
  if (typeof window === "undefined") return;

  saveMetaAsync({
    boards: shape.boards,
    boardOrder: shape.boardOrder,
    folders: shape.folders,
    recentAI: shape.recentAI,
  });

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_BOARDS, "readwrite");
    tx.onabort = () => notifyStorageError(tx.error);
    tx.onerror = () => notifyStorageError(tx.error);
    const store = tx.objectStore(STORE_BOARDS);
    for (const [id, data] of Object.entries(shape.boardData || {})) {
      store.put(data, id);
    }
  } catch (err) {
    notifyStorageError(err);
  }
}

/**
 * Delete board from persistent storage
 */
export async function deleteBoardFromStorage(boardId: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_BOARDS, "readwrite");
    const store = tx.objectStore(STORE_BOARDS);
    store.delete(boardId);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(`slate_b_${boardId}`);
  } catch {
    /* ignore */
  }
}
