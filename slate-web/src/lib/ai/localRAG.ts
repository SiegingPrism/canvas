import { useNotes, type Note } from "@/lib/notesStore";
import { useWhiteboard } from "@/lib/whiteboard/store";

export interface SearchResult {
  id: string;
  sourceType: "note" | "board" | "flashcard";
  title: string;
  snippet: string;
  score: number;
  url: string;
}

export interface RAGChunk {
  id: string;
  source: string;
  text: string;
  score: number;
}

// Tokenize text into words and lowercased trigrams for fast client semantic similarity
function tokenize(text: string): { words: Set<string>; ngrams: Set<string> } {
  const clean = text.toLowerCase().replace(/[^\w\s]/g, " ");
  const rawWords = clean.split(/\s+/).filter((w) => w.length > 2);
  const words = new Set<string>(rawWords);
  const ngrams = new Set<string>();

  // Build character 3-grams to match synonyms, typos, and morphologically related words
  for (const w of rawWords) {
    if (w.length < 3) continue;
    for (let i = 0; i <= w.length - 3; i++) {
      ngrams.add(w.slice(i, i + 3));
    }
  }

  return { words, ngrams };
}

// Jaccard similarity across both word stems and character ngrams
function computeSemanticScore(
  queryTokens: { words: Set<string>; ngrams: Set<string> },
  docTokens: { words: Set<string>; ngrams: Set<string> },
): number {
  if (queryTokens.words.size === 0 || docTokens.words.size === 0) return 0;

  let wordIntersect = 0;
  for (const w of queryTokens.words) {
    if (docTokens.words.has(w)) wordIntersect++;
  }
  const wordScore = wordIntersect / Math.max(1, queryTokens.words.size);

  let ngramIntersect = 0;
  for (const ng of queryTokens.ngrams) {
    if (docTokens.ngrams.has(ng)) ngramIntersect++;
  }
  const ngramScore = ngramIntersect / Math.max(1, queryTokens.ngrams.size);

  // 60% word match + 40% character ngram semantic overlap
  return wordScore * 0.6 + ngramScore * 0.4;
}

/**
 * Searches across all Notes and Whiteboards using local semantic scoring.
 */
export function semanticSearch(query: string, limit = 10): SearchResult[] {
  const q = query.trim();
  if (!q) return [];
  const queryTokens = tokenize(q);

  const results: SearchResult[] = [];

  // 1. Index and score all Notes
  try {
    const notesStore = useNotes.getState();
    const notes = Object.values(notesStore.notes || {});
    for (const n of notes) {
      if (n.archived) continue;
      const fullText = `${n.title || ""} ${n.tags?.join(" ") || ""} ${n.blocks?.map((b) => b.content).join(" ") || ""}`;
      const docTokens = tokenize(fullText);
      const score = computeSemanticScore(queryTokens, docTokens);

      if (score > 0.08) {
        // Find best snippet
        const matchingBlock = n.blocks.find((b) =>
          queryTokens.words.size > 0 && Array.from(queryTokens.words).some((w) => b.content.toLowerCase().includes(w)),
        );
        const snippet = matchingBlock?.content?.slice(0, 140) || n.blocks[0]?.content?.slice(0, 140) || n.title;

        results.push({
          id: n.id,
          sourceType: "note",
          title: n.title || "Untitled Note",
          snippet,
          score: Math.min(1, score * 1.5),
          url: `/note/${n.id}`,
        });
      }
    }
  } catch (e) {
    console.warn("Semantic search failed to index notes:", e);
  }

  // 2. Index and score all Whiteboard boards
  try {
    const wbStore = useWhiteboard.getState();
    const boards = Object.values(wbStore.boards || {});
    for (const b of boards) {
      if (b.archived) continue;
      const bData = wbStore.boardData[b.id];
      let boardText = b.title || "";
      if (bData?.pages) {
        for (const p of bData.pages) {
          for (const obj of p.objects || []) {
            if ("text" in obj && typeof obj.text === "string") boardText += " " + obj.text;
            if ("front" in obj && typeof obj.front === "string") boardText += " " + obj.front;
            if ("question" in obj && typeof obj.question === "string") boardText += " " + obj.question;
          }
        }
      }

      const docTokens = tokenize(boardText);
      const score = computeSemanticScore(queryTokens, docTokens);

      if (score > 0.08) {
        results.push({
          id: b.id,
          sourceType: "board",
          title: b.title || "Untitled Board",
          snippet: boardText.slice(0, 140),
          score: Math.min(1, score * 1.5),
          url: `/board/${b.id}`,
        });
      }
    }
  } catch (e) {
    console.warn("Semantic search failed to index boards:", e);
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Retrieves relevant context chunks across notes and boards for RAG (Retrieval Augmented Generation).
 */
export function retrieveRAGContext(query: string, topK = 3): RAGChunk[] {
  const matches = semanticSearch(query, topK);
  return matches.map((m) => ({
    id: m.id,
    source: `${m.sourceType.toUpperCase()}: ${m.title}`,
    text: m.snippet,
    score: m.score,
  }));
}

/**
 * Builds an augmented prompt with local RAG retrieval citations.
 */
export function buildRAGPrompt(userPrompt: string): { prompt: string; contextCount: number } {
  const chunks = retrieveRAGContext(userPrompt, 3);
  if (chunks.length === 0) return { prompt: userPrompt, contextCount: 0 };

  const contextText = chunks
    .map((c, i) => `[Source ${i + 1}: ${c.source}]\n"${c.text}"`)
    .join("\n\n");

  const promptWithContext = `User Question: "${userPrompt}"

Relevant Context Retrieved from Local Notes & Boards:
${contextText}

Instructions: Answer the user's question clearly. Incorporate the retrieved context when relevant.`;

  return { prompt: promptWithContext, contextCount: chunks.length };
}
