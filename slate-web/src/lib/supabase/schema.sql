-- ==============================================================================
-- SLATE WHITEBOARD & EDUCATIONAL CANVAS - SUPABASE DATABASE SCHEMA
-- ==============================================================================

-- 1. BOARDS TABLE (Canvas drawings, strokes, shapes, and widgets)
CREATE TABLE IF NOT EXISTS public.boards (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled Board',
    thumbnail TEXT,
    folder_id TEXT,
    is_starred BOOLEAN DEFAULT FALSE,
    background TEXT DEFAULT 'white',
    pages JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. NOTES TABLE (Block-based document notes with AI summaries)
CREATE TABLE IF NOT EXISTS public.notes (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled Note',
    content TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    blocks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. STUDY DECKS TABLE (AI-generated flashcards, mind maps, quizzes)
CREATE TABLE IF NOT EXISTS public.study_decks (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    cards JSONB DEFAULT '[]'::jsonb,
    quizzes JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_decks ENABLE ROW LEVEL SECURITY;

-- 5. POLICIES (Users manage their own items; allows anonymous/public boards if user_id is null)
CREATE POLICY "Users can manage own boards" ON public.boards
    FOR ALL
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can manage own notes" ON public.notes
    FOR ALL
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can manage own study decks" ON public.study_decks
    FOR ALL
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 6. AUTOMATIC UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS update_boards_updated_at ON public.boards;
CREATE TRIGGER update_boards_updated_at BEFORE UPDATE ON public.boards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notes_updated_at ON public.notes;
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_study_decks_updated_at ON public.study_decks;
CREATE TRIGGER update_study_decks_updated_at BEFORE UPDATE ON public.study_decks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
