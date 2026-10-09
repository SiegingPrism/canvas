import { create } from "zustand";

export type NoteType = "standard" | "quick" | "lecture" | "research" | "code" | "meeting";

export type NoteBlock = {
  id: string;
  type: "text" | "h1" | "h2" | "h3" | "checklist" | "bullet" | "code" | "table" | "callout";
  content: string;
  checked?: boolean;
};

export type Note = {
  id: string;
  title: string;
  type: NoteType;
  tags: string[];
  blocks: NoteBlock[];
  boardId: string | null;
  favorite: boolean;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
};

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  standard: "Standard",
  quick: "Quick note",
  lecture: "Lecture",
  research: "Research",
  code: "Code",
  meeting: "Meeting",
};

const STORAGE_KEY = "notes.v1";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function createEmptyBlock(type: NoteBlock["type"] = "text"): NoteBlock {
  return {
    id: uid(),
    type,
    content: "",
    ...(type === "checklist" ? { checked: false } : {}),
  };
}

type NotesState = {
  notes: Record<string, Note>;
  noteOrder: string[];
  hydrated: boolean;
};

type NotesActions = {
  createNote: (opts?: { title?: string; type?: NoteType; boardId?: string | null }) => string;
  deleteNote: (id: string) => void;
  duplicateNote: (id: string) => string | null;
  renameNote: (id: string, title: string) => void;
  setNoteType: (id: string, type: NoteType) => void;
  setNoteTags: (id: string, tags: string[]) => void;
  toggleFavorite: (id: string) => void;
  toggleArchive: (id: string) => void;
  setNoteBoardId: (id: string, boardId: string | null) => void;
  addNoteTag: (id: string, tag: string) => void;
  removeNoteTag: (id: string, tag: string) => void;
  addBlock: (noteId: string, type?: NoteBlock["type"], afterId?: string, content?: string) => string;
  updateBlock: (noteId: string, blockId: string, patch: Partial<NoteBlock>) => void;
  deleteBlock: (noteId: string, blockId: string) => void;
  moveBlock: (noteId: string, fromIndex: number, toIndex: number) => void;
};

function loadStorage(): { notes: Record<string, Note>; noteOrder: string[] } {
  if (typeof window === "undefined") return { notes: {}, noteOrder: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { notes: parsed.notes || {}, noteOrder: parsed.noteOrder || [] };
    }
  } catch {
    /* ignore */
  }
  return { notes: {}, noteOrder: [] };
}

function saveStorage(notes: Record<string, Note>, noteOrder: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ notes, noteOrder }));
  } catch {
    /* ignore */
  }
}

export function getNoteSearchText(note: Note): string {
  return `${note.title || ""} ${note.tags.join(" ")} ${note.blocks.map((b) => b.content).join(" ")}`;
}

const initialStorage = typeof window !== "undefined" ? loadStorage() : { notes: {}, noteOrder: [] };

export const useNotes = create<NotesState & NotesActions>((set, get) => {
  return {
    notes: initialStorage.notes,
    noteOrder: initialStorage.noteOrder,
    hydrated: typeof window !== "undefined",

    createNote: (opts) => {
      const id = uid();
      const now = Date.now();
      const note: Note = {
        id,
        title: opts?.title ?? "",
        type: opts?.type ?? "standard",
        tags: [],
        blocks: [createEmptyBlock("text")],
        boardId: opts?.boardId ?? null,
        favorite: false,
        archived: false,
        createdAt: now,
        updatedAt: now,
      };
      const notes = { ...get().notes, [id]: note };
      const noteOrder = [id, ...get().noteOrder];
      saveStorage(notes, noteOrder);
      set({ notes, noteOrder });
      return id;
    },

    deleteNote: (id) => {
      const { [id]: _, ...notes } = get().notes;
      const noteOrder = get().noteOrder.filter((nid) => nid !== id);
      saveStorage(notes, noteOrder);
      set({ notes, noteOrder });
    },

    duplicateNote: (id) => {
      const original = get().notes[id];
      if (!original) return null;
      const newId = uid();
      const now = Date.now();
      const clone: Note = {
        ...structuredClone(original),
        id: newId,
        title: `${original.title || "Untitled note"} (copy)`,
        favorite: false,
        createdAt: now,
        updatedAt: now,
        blocks: original.blocks.map((b) => ({ ...b, id: uid() })),
      };
      const notes = { ...get().notes, [newId]: clone };
      const noteOrder = [newId, ...get().noteOrder];
      saveStorage(notes, noteOrder);
      set({ notes, noteOrder });
      return newId;
    },

    renameNote: (id, title) => {
      const note = get().notes[id];
      if (!note) return;
      const notes = { ...get().notes, [id]: { ...note, title, updatedAt: Date.now() } };
      saveStorage(notes, get().noteOrder);
      set({ notes });
    },

    setNoteType: (id, type) => {
      const note = get().notes[id];
      if (!note) return;
      const notes = { ...get().notes, [id]: { ...note, type, updatedAt: Date.now() } };
      saveStorage(notes, get().noteOrder);
      set({ notes });
    },

    setNoteTags: (id, tags) => {
      const note = get().notes[id];
      if (!note) return;
      const notes = { ...get().notes, [id]: { ...note, tags, updatedAt: Date.now() } };
      saveStorage(notes, get().noteOrder);
      set({ notes });
    },

    toggleFavorite: (id) => {
      const note = get().notes[id];
      if (!note) return;
      const notes = {
        ...get().notes,
        [id]: { ...note, favorite: !note.favorite, updatedAt: Date.now() },
      };
      saveStorage(notes, get().noteOrder);
      set({ notes });
    },

    toggleArchive: (id) => {
      const note = get().notes[id];
      if (!note) return;
      const notes = {
        ...get().notes,
        [id]: { ...note, archived: !note.archived, updatedAt: Date.now() },
      };
      saveStorage(notes, get().noteOrder);
      set({ notes });
    },

    setNoteBoardId: (id, boardId) => {
      const note = get().notes[id];
      if (!note) return;
      const notes = { ...get().notes, [id]: { ...note, boardId, updatedAt: Date.now() } };
      saveStorage(notes, get().noteOrder);
      set({ notes });
    },

    addNoteTag: (id, tag) => {
      const note = get().notes[id];
      if (!note) return;
      const cleanTag = tag.trim().replace(/^#/, "");
      if (!cleanTag || note.tags.includes(cleanTag)) return;
      const tags = [...note.tags, cleanTag];
      const notes = { ...get().notes, [id]: { ...note, tags, updatedAt: Date.now() } };
      saveStorage(notes, get().noteOrder);
      set({ notes });
    },

    removeNoteTag: (id, tag) => {
      const note = get().notes[id];
      if (!note) return;
      const tags = note.tags.filter((t) => t !== tag);
      const notes = { ...get().notes, [id]: { ...note, tags, updatedAt: Date.now() } };
      saveStorage(notes, get().noteOrder);
      set({ notes });
    },

    addBlock: (noteId, type = "text", afterId, content = "") => {
      const note = get().notes[noteId];
      if (!note) return "";
      const newBlock = { ...createEmptyBlock(type), content };
      let blocks: NoteBlock[];
      if (afterId) {
        const idx = note.blocks.findIndex((b) => b.id === afterId);
        if (idx !== -1) {
          blocks = [...note.blocks.slice(0, idx + 1), newBlock, ...note.blocks.slice(idx + 1)];
        } else {
          blocks = [...note.blocks, newBlock];
        }
      } else {
        blocks = [...note.blocks, newBlock];
      }
      const notes = { ...get().notes, [noteId]: { ...note, blocks, updatedAt: Date.now() } };
      saveStorage(notes, get().noteOrder);
      set({ notes });
      return newBlock.id;
    },

    updateBlock: (noteId, blockId, patch) => {
      const note = get().notes[noteId];
      if (!note) return;
      const blocks = note.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b));
      const notes = { ...get().notes, [noteId]: { ...note, blocks, updatedAt: Date.now() } };
      saveStorage(notes, get().noteOrder);
      set({ notes });
    },

    deleteBlock: (noteId, blockId) => {
      const note = get().notes[noteId];
      if (!note || note.blocks.length <= 1) return;
      const blocks = note.blocks.filter((b) => b.id !== blockId);
      const notes = { ...get().notes, [noteId]: { ...note, blocks, updatedAt: Date.now() } };
      saveStorage(notes, get().noteOrder);
      set({ notes });
    },

    moveBlock: (noteId, fromIndex, toIndex) => {
      const note = get().notes[noteId];
      if (
        !note ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= note.blocks.length ||
        toIndex >= note.blocks.length
      )
        return;
      const blocks = [...note.blocks];
      const [item] = blocks.splice(fromIndex, 1);
      blocks.splice(toIndex, 0, item);
      const notes = { ...get().notes, [noteId]: { ...note, blocks, updatedAt: Date.now() } };
      saveStorage(notes, get().noteOrder);
      set({ notes });
    },
  };
});

if (typeof window !== "undefined") {
  queueMicrotask(() => {
    const loaded = loadStorage();
    useNotes.setState({ ...loaded, hydrated: true });
  });
}
