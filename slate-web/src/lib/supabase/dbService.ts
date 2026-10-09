import { getSupabase } from "./client";
import type { BoardMeta, Page } from "../whiteboard/store";
import type { Note } from "../notesStore";

export interface CloudBoardRecord {
  id: string;
  user_id?: string;
  title: string;
  thumbnail?: string;
  folder_id?: string | null;
  is_starred: boolean;
  background?: string;
  pages: Page[];
  created_at?: string;
  updated_at?: string;
}

export interface CloudNoteRecord {
  id: string;
  user_id?: string;
  title: string;
  content: string;
  summary: string;
  blocks: any[];
  created_at?: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// BOARDS CRUD
// ---------------------------------------------------------------------------

export async function syncBoardToSupabase(
  meta: BoardMeta,
  pages: Page[] = [],
  thumbnail?: string
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const payload = {
      id: meta.id,
      title: meta.title || "Untitled Board",
      folder_id: meta.folderId,
      is_starred: Boolean(meta.favorite),
      thumbnail: thumbnail || null,
      background: pages[0]?.background || "white",
      pages: pages,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("boards").upsert(payload, { onConflict: "id" });
    if (error) {
      console.warn("Supabase sync board warning:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Supabase syncBoard failed:", err);
    return false;
  }
}

export async function fetchBoardsFromSupabase(): Promise<CloudBoardRecord[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("boards")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.warn("Supabase fetchBoards warning:", error.message);
      return [];
    }
    return (data as CloudBoardRecord[]) || [];
  } catch (err) {
    console.warn("Supabase fetchBoards failed:", err);
    return [];
  }
}

export async function fetchBoardById(boardId: string): Promise<CloudBoardRecord | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("boards")
      .select("*")
      .eq("id", boardId)
      .maybeSingle();
    if (error || !data) return null;
    return data as CloudBoardRecord;
  } catch {
    return null;
  }
}

export async function deleteBoardFromSupabase(boardId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from("boards").delete().eq("id", boardId);
    if (error) {
      console.warn("Supabase deleteBoard warning:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Supabase deleteBoard failed:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// NOTES CRUD
// ---------------------------------------------------------------------------

export async function syncNoteToSupabase(note: Note): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const textContent = note.blocks
      ?.map((b) => b.content || "")
      .join("\n")
      .trim();

    const payload = {
      id: note.id,
      title: note.title || "Untitled Note",
      content: textContent || "",
      blocks: note.blocks || [],
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("notes").upsert(payload, { onConflict: "id" });
    if (error) {
      console.warn("Supabase sync note warning:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Supabase syncNote failed:", err);
    return false;
  }
}

export async function fetchNotesFromSupabase(): Promise<CloudNoteRecord[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.warn("Supabase fetchNotes warning:", error.message);
      return [];
    }
    return (data as CloudNoteRecord[]) || [];
  } catch (err) {
    console.warn("Supabase fetchNotes failed:", err);
    return [];
  }
}

export async function fetchNoteById(noteId: string): Promise<CloudNoteRecord | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("id", noteId)
      .maybeSingle();
    if (error || !data) return null;
    return data as CloudNoteRecord;
  } catch {
    return null;
  }
}

export async function deleteNoteFromSupabase(noteId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from("notes").delete().eq("id", noteId);
    if (error) {
      console.warn("Supabase deleteNote warning:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Supabase deleteNote failed:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// STUDY DECKS & QUIZZES
// ---------------------------------------------------------------------------

export async function syncStudyDeckToSupabase(
  deckId: string,
  title: string,
  cards: any[] = [],
  quizzes: any[] = []
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const payload = {
      id: deckId,
      title: title || "Study Deck",
      cards,
      quizzes,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("study_decks").upsert(payload, { onConflict: "id" });
    if (error) {
      console.warn("Supabase sync study deck warning:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Supabase syncStudyDeck failed:", err);
    return false;
  }
}

export async function fetchStudyDecksFromSupabase(): Promise<any[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("study_decks")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.warn("Supabase fetchStudyDecks warning:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn("Supabase fetchStudyDecks failed:", err);
    return [];
  }
}
