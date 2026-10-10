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

const STOP_WORDS = new Set([
  "is", "am", "are", "was", "were", "be", "been", "being",
  "in", "on", "at", "to", "for", "of", "with", "by", "from",
  "an", "the", "it", "as", "or", "if", "so", "do", "no", "my", "we", "he", "me", "up",
]);

const ALLOWED_SHORT = new Set(["ai", "ml", "ui", "ux", "db", "os", "id", "2d", "3d"]);

// Tokenize text into normalized words and character 3-grams
function tokenize(text: string): { words: string[]; wordCounts: Map<string, number>; ngrams: Set<string> } {
  const clean = text.toLowerCase().replace(/[^a-z0-9_\-\^\+\=\/\\]+/g, " ");
  const rawWords = clean.split(/\s+/).filter((w) => {
    if (w.length < 2) return false;
    if (w.length === 2 && !ALLOWED_SHORT.has(w)) return false;
    if (STOP_WORDS.has(w)) return false;
    return true;
  });
  const wordCounts = new Map<string, number>();
  for (const w of rawWords) {
    wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
  }

  const ngrams = new Set<string>();
  for (const w of rawWords) {
    if (w.length < 3) continue;
    for (let i = 0; i <= w.length - 3; i++) {
      ngrams.add(w.slice(i, i + 3));
    }
  }

  return { words: rawWords, wordCounts, ngrams };
}

// Extract contextual snippet window centered around matching query terms
function extractSnippetWindow(text: string, qWords: string[], maxLen = 380): string {
  if (!text || text.length <= maxLen) return text;
  const lower = text.toLowerCase();
  let firstIdx = -1;
  for (const w of qWords) {
    const idx = lower.indexOf(w);
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
      firstIdx = idx;
    }
  }
  if (firstIdx === -1) return text.slice(0, maxLen).trim() + "...";
  const start = Math.max(0, firstIdx - Math.floor(maxLen / 3));
  const end = Math.min(text.length, start + maxLen);
  return (start > 0 ? "..." : "") + text.slice(start, end).trim() + (end < text.length ? "..." : "");
}

// Extract rich searchable text from all whiteboard canvas objects
export function extractBoardSearchStrings(bData: any): string[] {
  const chunks: string[] = [];
  if (!bData?.pages) return chunks;

  for (const p of bData.pages) {
    for (const obj of p.objects || []) {
      if (!obj) continue;
      // 1. Text & Sticky Notes & Labels
      if (typeof obj.text === "string" && obj.text.trim()) chunks.push(obj.text.trim());
      if (typeof obj.label === "string" && obj.label.trim()) chunks.push(obj.label.trim());
      // 2. Flashcards
      if (typeof obj.front === "string" && obj.front.trim()) chunks.push(obj.front.trim());
      if (typeof obj.back === "string" && obj.back.trim()) chunks.push(obj.back.trim());
      // 3. Quizzes
      if (typeof obj.question === "string" && obj.question.trim()) chunks.push(obj.question.trim());
      if (Array.isArray(obj.options)) chunks.push(obj.options.filter(Boolean).join(" "));
      // 4. Mathematical Formulas & Math Cards
      if (typeof obj.latex === "string" && obj.latex.trim()) chunks.push(obj.latex.trim());
      if (typeof obj.solution === "string" && obj.solution.trim()) chunks.push(obj.solution.trim());
      if (Array.isArray(obj.steps)) chunks.push(obj.steps.filter(Boolean).join(" "));
      // 5. Graphs
      if (typeof obj.fn === "string" && obj.fn.trim()) chunks.push(`y = ${obj.fn.trim()}`);
      if (typeof obj.title === "string" && obj.title.trim()) chunks.push(obj.title.trim());
      // 6. Tables
      if (Array.isArray(obj.data)) {
        for (const row of obj.data) {
          if (Array.isArray(row)) {
            const rowStr = row.filter(Boolean).join(" ");
            if (rowStr.trim()) chunks.push(rowStr.trim());
          }
        }
      }
      // 7. Mind Maps
      if (typeof obj.topic === "string" && obj.topic.trim()) chunks.push(obj.topic.trim());
      if (obj.rootNode) {
        const visitMindMap = (node: any) => {
          if (node.title && typeof node.title === "string") chunks.push(node.title.trim());
          if (Array.isArray(node.children)) node.children.forEach(visitMindMap);
        };
        visitMindMap(obj.rootNode);
      }
      // 8. Flowcharts
      if (Array.isArray(obj.nodes)) {
        for (const n of obj.nodes) {
          if (n.label && typeof n.label === "string") chunks.push(n.label.trim());
          if (n.title && typeof n.title === "string") chunks.push(n.title.trim());
        }
      }
      // 9. Roadmaps
      if (Array.isArray(obj.items)) {
        for (const it of obj.items) {
          if (it.title) chunks.push(it.title);
          if (it.desc) chunks.push(it.desc);
        }
      }
      // 10. Handwriting OCR / ink transcription
      if (typeof obj.transcription === "string" && obj.transcription.trim()) {
        chunks.push(obj.transcription.trim());
      }
      if (typeof obj.recognizedText === "string" && obj.recognizedText.trim()) {
        chunks.push(obj.recognizedText.trim());
      }
    }
  }

  return chunks;
}

/**
 * Searches across all Notes and Whiteboards using BM25 length-normalized scoring.
 */
export function semanticSearch(query: string, limit = 10): SearchResult[] {
  const q = query.trim();
  if (!q) return [];
  const queryTokens = tokenize(q);
  const qWords = Array.from(queryTokens.wordCounts.keys());
  if (qWords.length === 0) return [];

  interface CandidateDoc {
    id: string;
    sourceType: "note" | "board" | "flashcard";
    title: string;
    fullText: string;
    snippet: string;
    url: string;
    tokens: ReturnType<typeof tokenize>;
    docLength: number;
  }

  const corpus: CandidateDoc[] = [];

  // 1. Gather Notes
  try {
    const notesStore = useNotes.getState();
    const notes = Object.values(notesStore.notes || {});
    for (const n of notes) {
      if (n.archived) continue;
      const textParts = [
        n.title || "",
        ...(n.tags || []),
        ...(n.blocks?.map((b) => b.content) || []),
      ];
      const fullText = textParts.join(" ").trim();
      if (!fullText) continue;

      const tokens = tokenize(fullText);
      // Snippet selection centered around query words
      const matchingBlock = n.blocks?.find((b) =>
        qWords.some((w) => b.content.toLowerCase().includes(w))
      );
      const snippet = extractSnippetWindow(matchingBlock?.content || fullText, qWords);

      corpus.push({
        id: n.id,
        sourceType: "note",
        title: n.title || "Untitled Note",
        fullText,
        snippet,
        url: `/note/${n.id}`,
        tokens,
        docLength: Math.max(1, tokens.words.length),
      });
    }
  } catch (e) {
    console.warn("Semantic search: notes index failed:", e);
  }

  // 2. Gather Whiteboard Boards
  try {
    const wbStore = useWhiteboard.getState();
    const boards = Object.values(wbStore.boards || {});
    for (const b of boards) {
      if (b.archived) continue;
      const bData = wbStore.boardData[b.id];
      const extractedChunks = extractBoardSearchStrings(bData);
      const fullText = `${b.title || ""} ${extractedChunks.join(" ")}`.trim();
      if (!fullText) continue;

      const tokens = tokenize(fullText);
      const matchingChunk = extractedChunks.find((c) =>
        qWords.some((w) => c.toLowerCase().includes(w))
      );
      const snippet = extractSnippetWindow(matchingChunk || fullText, qWords);

      corpus.push({
        id: b.id,
        sourceType: "board",
        title: b.title || "Untitled Board",
        fullText,
        snippet,
        url: `/board/${b.id}`,
        tokens,
        docLength: Math.max(1, tokens.words.length),
      });
    }
  } catch (e) {
    console.warn("Semantic search: boards index failed:", e);
  }

  if (corpus.length === 0) return [];

  // BM25 parameters
  const k1 = 1.2;
  const b = 0.75;
  const totalDocs = corpus.length;
  const avgDocLength =
    corpus.reduce((acc, d) => acc + d.docLength, 0) / totalDocs;

  // Calculate IDF for each query word
  const idf = new Map<string, number>();
  for (const qw of qWords) {
    const docCountWithTerm = corpus.filter((d) => d.tokens.wordCounts.has(qw)).length;
    // Standard Robertson-Sparck Jones IDF with smoothing
    const val = Math.log(1 + (totalDocs - docCountWithTerm + 0.5) / (docCountWithTerm + 0.5));
    idf.set(qw, Math.max(0.2, val));
  }

  // Score documents
  const results: SearchResult[] = [];
  for (const doc of corpus) {
    let bm25Score = 0;
    let matchedWordCount = 0;

    for (const qw of qWords) {
      const tf = doc.tokens.wordCounts.get(qw) || 0;
      if (tf > 0) {
        matchedWordCount++;
        const termIdf = idf.get(qw) || 0.2;
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * (doc.docLength / avgDocLength));
        bm25Score += termIdf * (numerator / denominator);
      }
    }

    // N-gram overlap boost for partial/sub-word matches
    let ngramMatches = 0;
    for (const ng of queryTokens.ngrams) {
      if (doc.tokens.ngrams.has(ng)) ngramMatches++;
    }
    const ngramBonus =
      queryTokens.ngrams.size > 0 ? (ngramMatches / queryTokens.ngrams.size) * 0.35 : 0;

    // Title match bonus using whole-word boundary matching rather than substring inclusion
    const titleLower = doc.title.toLowerCase();
    const titleBonus = qWords.some((w) =>
      new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`, "i").test(titleLower)
    )
      ? 0.4
      : 0;

    const totalScore = bm25Score + ngramBonus + titleBonus;

    if (totalScore > 0.12 && (matchedWordCount > 0 || ngramBonus > 0.25)) {
      results.push({
        id: doc.id,
        sourceType: doc.sourceType,
        title: doc.title,
        snippet: doc.snippet,
        score: Math.min(1, totalScore / (qWords.length * 2.5 + 0.5)),
        url: doc.url,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Retrieves relevant context chunks across notes and boards for RAG (Retrieval Augmented Generation).
 */
export function retrieveRAGContext(query: string, topK = 3): RAGChunk[] {
  const matches = semanticSearch(query, topK * 2);
  return matches
    .filter((m) => m.score >= 0.2)
    .slice(0, topK)
    .map((m) => ({
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
