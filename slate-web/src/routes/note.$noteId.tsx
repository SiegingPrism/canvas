import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import { useNotes, NOTE_TYPE_LABELS, type NoteType, type NoteBlock } from "@/lib/notesStore";
import { fetchNoteById } from "@/lib/supabase/dbService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ArrowLeft,
  Star,
  Trash2,
  Heading1,
  Heading2,
  Heading3,
  CheckSquare,
  List,
  Code,
  Type,
  X,
  Sparkles,
  HelpCircle,
  Layers,
  BrainCircuit,
  Loader2,
  ChevronUp,
  ChevronDown,
  Tag as TagIcon,
  Copy,
  Check,
  RotateCcw,
  PenTool,
} from "lucide-react";
import { toast } from "sonner";
import { AIEngine } from "@/lib/ai/aiEngine";
import { useWhiteboard } from "@/lib/whiteboard/store";
import type { CanvasObject } from "@/lib/whiteboard/types";

export const Route = createFileRoute("/note/$noteId")({
  head: () => ({
    meta: [
      { title: "Note Editor — Slate" },
      { name: "description", content: "Block-based note editor with visual & AI study tools." },
    ],
  }),
  component: NoteEditorPage,
});

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function NoteEditorPage() {
  const { noteId } = Route.useParams();
  const navigate = useNavigate();
  const {
    notes,
    hydrated,
    renameNote,
    setNoteType,
    toggleFavorite,
    deleteNote,
    addBlock,
    updateBlock,
    deleteBlock,
    moveBlock,
    setNoteBoardId,
    addNoteTag,
    removeNoteTag,
  } = useNotes();

  const note = notes[noteId];
  const [aiLoading, setAiLoading] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [copied, setCopied] = useState(false);

  // In-Note Interactive Flashcard Deck
  const [activeDeck, setActiveDeck] = useState<{ front: string; back: string }[] | null>(null);
  const [deckCardIdx, setDeckCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // In-Note Interactive Quiz Modal
  const [activeQuiz, setActiveQuiz] = useState<
    { question: string; options: string[]; answerIndex: number; explanation?: string }[] | null
  >(null);
  const [quizIdx, setQuizIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // Input ref map for keyboard navigation
  const blockInputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});

  // Compute word and character count
  const stats = useMemo(() => {
    if (!note) return { words: 0, chars: 0 };
    let text = note.title + " ";
    for (const b of note.blocks) {
      text += (b.content || "") + " ";
    }
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    return { words, chars };
  }, [note]);

  // Handle store hydration and non-existent note
  useEffect(() => {
    if (hydrated && !note) {
      fetchNoteById(noteId).then((cn) => {
        if (cn) {
          const blocks = Array.isArray(cn.blocks) && cn.blocks.length
            ? cn.blocks
            : [{ id: uid(), type: "text" as const, content: cn.content || "" }];
          const loadedNote = {
            id: cn.id,
            title: cn.title || "Untitled Note",
            type: "standard" as const,
            tags: [],
            blocks,
            boardId: null,
            favorite: false,
            archived: false,
            createdAt: cn.created_at ? new Date(cn.created_at).getTime() : Date.now(),
            updatedAt: cn.updated_at ? new Date(cn.updated_at).getTime() : Date.now(),
          };
          useNotes.setState((prev) => ({
            ...prev,
            notes: { ...prev.notes, [cn.id]: loadedNote },
            noteOrder: prev.noteOrder.includes(cn.id) ? prev.noteOrder : [cn.id, ...prev.noteOrder],
          }));
        } else {
          toast.error("Note not found");
          navigate({ to: "/notes" });
        }
      });
    }
  }, [hydrated, note, noteId, navigate]);

  function focusBlock(blockId: string) {
    setTimeout(() => {
      const el = blockInputRefs.current[blockId];
      if (el) {
        el.focus();
      }
    }, 50);
  }

  function handleAddBlockAfter(afterId: string, type: NoteBlock["type"] = "text") {
    if (!note) return;
    const newId = addBlock(note.id, type, afterId, "");
    focusBlock(newId);
  }

  function handleBlockKeyDown(
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    b: NoteBlock,
    index: number,
  ) {
    if (!note) return;

    if (e.key === "Enter" && !e.shiftKey) {
      // In code blocks, Enter adds newline
      if (b.type === "code") return;

      e.preventDefault();
      // Keep list style or default to text
      const nextType = b.type === "checklist" || b.type === "bullet" ? b.type : "text";
      const newId = addBlock(note.id, nextType, b.id, "");
      focusBlock(newId);
    } else if (e.key === "Backspace" && b.content === "") {
      if (note.blocks.length > 1) {
        e.preventDefault();
        const prevBlock = note.blocks[index - 1];
        deleteBlock(note.id, b.id);
        if (prevBlock) {
          focusBlock(prevBlock.id);
        }
      }
    } else if (e.key === "ArrowUp" && index > 0) {
      const el = e.currentTarget;
      if ("selectionStart" in el && el.selectionStart === 0) {
        const prevBlock = note.blocks[index - 1];
        if (prevBlock) focusBlock(prevBlock.id);
      }
    } else if (e.key === "ArrowDown" && index < note.blocks.length - 1) {
      const el = e.currentTarget;
      if ("selectionEnd" in el && el.selectionEnd === el.value.length) {
        const nextBlock = note.blocks[index + 1];
        if (nextBlock) focusBlock(nextBlock.id);
      }
    }
  }

  // --- 1. AI Summarization ---
  async function handleSummarizeNote() {
    if (!note) return;
    const textContent = note.blocks.map((b) => b.content.trim()).filter(Boolean);
    if (textContent.length === 0) {
      toast.error("Type some content in your note first!");
      return;
    }
    setAiLoading(true);
    toast.info("Generating AI summary & action items...");
    try {
      const summary = await AIEngine.summarizeNote(note.title, textContent);

      addBlock(note.id, "h2", undefined, "Executive Summary & Key Takeaways");
      addBlock(note.id, "callout", undefined, summary.overview);

      if (summary.keyPoints && summary.keyPoints.length > 0) {
        summary.keyPoints.forEach((kp) => {
          addBlock(note.id, "bullet", undefined, kp);
        });
      }

      if (summary.actionItems && summary.actionItems.length > 0) {
        summary.actionItems.forEach((act) => {
          addBlock(note.id, "checklist", undefined, act);
        });
      }

      if (summary.takeaway) {
        addBlock(note.id, "callout", undefined, `💡 Key Insight: ${summary.takeaway}`);
      }

      toast.success("AI Summary added directly to your note!");
    } catch (e) {
      console.error(e);
      toast.error("Summarization failed");
    } finally {
      setAiLoading(false);
    }
  }

  // --- 2. AI Quiz Generation ---
  async function handleGenerateQuizFromNote() {
    if (!note) return;
    const textContent = note.blocks
      .map((b) => b.content.trim())
      .filter(Boolean)
      .join("\n");
    if (!textContent) {
      toast.error("Type some content in your note first!");
      return;
    }
    setAiLoading(true);
    toast.info("Synthesizing quiz questions...");
    try {
      const questions = await AIEngine.generateQuiz(textContent, note.title);

      // Save to whiteboard if available
      const wb = useWhiteboard.getState();
      let bId = note.boardId;
      if (!bId) {
        bId = wb.createBoard({ title: `${note.title || "Study"} Board` });
        setNoteBoardId(note.id, bId);
      }

      const canvasQuizzes: CanvasObject[] = questions.map((q, idx) => ({
        id: uid(),
        kind: "quiz",
        x: 240 + (idx % 2) * 320,
        y: 200 + Math.floor(idx / 2) * 200,
        w: 280,
        h: 180,
        question: q.question,
        options: q.options,
        answerIndex: q.answerIndex,
      }));

      wb.addObjectsToBoard(bId, canvasQuizzes);

      // Set up in-note quiz modal
      setActiveQuiz(questions);
      setQuizIdx(0);
      setSelectedOption(null);
      setQuizScore(0);
      setQuizFinished(false);

      toast.success(`Generated ${questions.length} quiz questions!`);
    } catch (e) {
      console.error(e);
      toast.error("Quiz generation failed");
    } finally {
      setAiLoading(false);
    }
  }

  // --- 3. AI Flashcard Generation ---
  async function handleGenerateFlashcardsFromNote() {
    if (!note) return;
    const textContent = note.blocks
      .map((b) => b.content.trim())
      .filter(Boolean)
      .join("\n");
    if (!textContent) {
      toast.error("Type some content in your note first!");
      return;
    }
    setAiLoading(true);
    toast.info("Extracting spaced-repetition flashcards...");
    try {
      const cards = await AIEngine.generateFlashcards(textContent, note.title);

      // Save to whiteboard if available
      const wb = useWhiteboard.getState();
      let bId = note.boardId;
      if (!bId) {
        bId = wb.createBoard({ title: `${note.title || "Study"} Board` });
        setNoteBoardId(note.id, bId);
      }

      const canvasCards: CanvasObject[] = cards.map((c, idx) => ({
        id: uid(),
        kind: "flashcard",
        x: 200 + (idx % 3) * 220,
        y: 200 + Math.floor(idx / 3) * 160,
        w: 200,
        h: 130,
        front: c.front,
        back: c.back,
        color: "#fef08a",
      }));

      wb.addObjectsToBoard(bId, canvasCards);

      // Set up in-note flashcards review
      setActiveDeck(cards);
      setDeckCardIdx(0);
      setIsFlipped(false);

      toast.success(`Generated ${cards.length} flashcards!`);
    } catch (e) {
      console.error(e);
      toast.error("Flashcard generation failed");
    } finally {
      setAiLoading(false);
    }
  }

  // --- 4. AI Mind-Map Generation ---
  async function handleGenerateMindMapFromNote() {
    if (!note) return;
    const topic = note.title || "Note Concept";
    setAiLoading(true);
    toast.info("Generating Mind-Map from Note...");
    try {
      const tree = await AIEngine.generateMindMap(topic, 650, 450);
      const wb = useWhiteboard.getState();
      const newBoardId = wb.createBoard({ title: `${topic} Mind Map` });

      const canvasNodes: CanvasObject[] = [];
      function collectNodes(node: typeof tree) {
        canvasNodes.push({
          id: node.id || uid(),
          kind: "mindmap-node",
          x: node.x - 70,
          y: node.y - 25,
          w: Math.max(140, node.label.length * 10 + 24),
          h: 46,
          label: node.label,
          level: node.level,
          color: node.color,
          parentId: node.parentId,
        });
        (node.children || []).forEach(collectNodes);
      }
      collectNodes(tree);

      wb.addObjectsToBoard(newBoardId, canvasNodes);
      setNoteBoardId(note.id, newBoardId);

      toast.success("Mind-Map created on linked whiteboard!", {
        action: {
          label: "Open Board",
          onClick: () => navigate({ to: "/board/$boardId", params: { boardId: newBoardId } }),
        },
      });
    } catch (e) {
      console.error(e);
      toast.error("Mind map generation failed");
    } finally {
      setAiLoading(false);
    }
  }

  // Copy Note as Markdown
  function handleCopyMarkdown() {
    if (!note) return;
    let md = `# ${note.title || "Untitled Note"}\n\n`;
    for (const b of note.blocks) {
      if (b.type === "h1") md += `# ${b.content}\n\n`;
      else if (b.type === "h2") md += `## ${b.content}\n\n`;
      else if (b.type === "h3") md += `### ${b.content}\n\n`;
      else if (b.type === "checklist") md += `- [${b.checked ? "x" : " "}] ${b.content}\n`;
      else if (b.type === "bullet") md += `- ${b.content}\n`;
      else if (b.type === "callout") md += `> 💡 ${b.content}\n\n`;
      else if (b.type === "code") md += `\`\`\`\n${b.content}\n\`\`\`\n\n`;
      else md += `${b.content}\n\n`;
    }

    navigator.clipboard.writeText(md.trim());
    setCopied(true);
    toast.success("Copied note as Markdown!");
    setTimeout(() => setCopied(false), 2000);
  }

  // Link or Create Whiteboard
  function handleCreateOrOpenWhiteboard() {
    if (!note) return;
    const wb = useWhiteboard.getState();
    if (note.boardId && wb.boards[note.boardId]) {
      navigate({ to: "/board/$boardId", params: { boardId: note.boardId } });
    } else {
      const newBoardId = wb.createBoard({ title: `${note.title || "Note"} Canvas` });
      setNoteBoardId(note.id, newBoardId);
      toast.success("Linked new whiteboard to this note!");
      navigate({ to: "/board/$boardId", params: { boardId: newBoardId } });
    }
  }

  if (!note) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground animate-pulse">Loading note...</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-28">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Link
              to="/notes"
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent text-foreground transition"
              title="Back to notes"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <select
              value={note.type}
              onChange={(e) => setNoteType(note.id, e.target.value as NoteType)}
              className="rounded-lg border bg-card px-2.5 py-1 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary"
            >
              {Object.entries(NOTE_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>

            <span className="hidden text-xs text-muted-foreground sm:inline">
              {stats.words} words
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {note.boardId ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10"
                onClick={handleCreateOrOpenWhiteboard}
                title="Open associated whiteboard"
              >
                <PenTool className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Whiteboard</span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-muted-foreground"
                onClick={handleCreateOrOpenWhiteboard}
                title="Create a linked whiteboard for drawing & diagrams"
              >
                <PenTool className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Add Canvas</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyMarkdown}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              title="Copy as Markdown"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleFavorite(note.id)}
              className={`h-8 w-8 p-0 ${note.favorite ? "text-yellow-400" : "text-muted-foreground"}`}
              title="Favorite"
            >
              <Star className={`h-4 w-4 ${note.favorite ? "fill-yellow-400" : ""}`} />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("Delete this note? This cannot be undone.")) {
                  deleteNote(note.id);
                  navigate({ to: "/notes" });
                }
              }}
              className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
              title="Delete note"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Editor Main */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        {/* Title */}
        <input
          type="text"
          value={note.title}
          onChange={(e) => renameNote(note.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (note.blocks.length > 0) {
                focusBlock(note.blocks[0].id);
              }
            }
          }}
          placeholder="Untitled Note"
          className="w-full bg-transparent text-3xl font-bold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40"
        />

        {/* Tags Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {note.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground group"
            >
              <span>#{tag}</span>
              <button
                type="button"
                onClick={() => removeNoteTag(note.id, tag)}
                className="opacity-60 hover:opacity-100 hover:text-destructive transition"
                title={`Remove tag #${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}

          {showTagInput ? (
            <div className="flex items-center gap-1">
              <Input
                type="text"
                autoFocus
                placeholder="tag name..."
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTagInput.trim()) {
                    e.preventDefault();
                    addNoteTag(note.id, newTagInput);
                    setNewTagInput("");
                    setShowTagInput(false);
                  } else if (e.key === "Escape") {
                    setShowTagInput(false);
                  }
                }}
                onBlur={() => {
                  if (newTagInput.trim()) {
                    addNoteTag(note.id, newTagInput);
                    setNewTagInput("");
                  }
                  setShowTagInput(false);
                }}
                className="h-6 w-24 px-2 text-xs"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowTagInput(true)}
              className="flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary hover:text-primary transition"
            >
              <TagIcon className="h-2.5 w-2.5" />
              <span>+ Tag</span>
            </button>
          )}
        </div>

        {/* Blocks list */}
        <div className="space-y-3 pt-2">
          {note.blocks.map((b, idx) => (
            <div key={b.id} className="group relative flex items-start gap-2">
              {/* Block reorder / action controls on hover */}
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 absolute -left-8 top-1 transition">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => moveBlock(note.id, idx, idx - 1)}
                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                  title="Move block up"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === note.blocks.length - 1}
                  onClick={() => moveBlock(note.id, idx, idx + 1)}
                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                  title="Move block down"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Checklist block */}
              {b.type === "checklist" && (
                <input
                  type="checkbox"
                  checked={!!b.checked}
                  onChange={(e) => updateBlock(note.id, b.id, { checked: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer shrink-0"
                />
              )}

              {/* Bullet block */}
              {b.type === "bullet" && (
                <span className="mt-1 text-primary text-base select-none shrink-0">•</span>
              )}

              {/* Callout block */}
              {b.type === "callout" && (
                <div className="w-full flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                  <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <textarea
                    ref={(el) => {
                      blockInputRefs.current[b.id] = el;
                    }}
                    value={b.content}
                    onChange={(e) => updateBlock(note.id, b.id, { content: e.target.value })}
                    onKeyDown={(e) => handleBlockKeyDown(e, b, idx)}
                    placeholder="Key note or highlight..."
                    rows={Math.max(1, (b.content || "").split("\n").length)}
                    className="w-full bg-transparent text-sm leading-relaxed text-foreground outline-none resize-none font-medium"
                  />
                </div>
              )}

              {/* Code block */}
              {b.type === "code" && (
                <div className="w-full relative">
                  <textarea
                    ref={(el) => {
                      blockInputRefs.current[b.id] = el;
                    }}
                    value={b.content}
                    onChange={(e) => updateBlock(note.id, b.id, { content: e.target.value })}
                    placeholder="// Code snippet..."
                    rows={Math.max(3, (b.content || "").split("\n").length)}
                    className="w-full font-mono text-xs rounded-xl bg-muted/80 p-3.5 text-foreground outline-none focus:ring-1 focus:ring-primary resize-y"
                  />
                </div>
              )}

              {/* H1 Heading */}
              {b.type === "h1" && (
                <input
                  ref={(el) => {
                    blockInputRefs.current[b.id] = el;
                  }}
                  type="text"
                  value={b.content}
                  onChange={(e) => updateBlock(note.id, b.id, { content: e.target.value })}
                  onKeyDown={(e) => handleBlockKeyDown(e, b, idx)}
                  placeholder="Heading 1"
                  className="w-full bg-transparent text-2xl font-bold text-foreground outline-none tracking-tight"
                />
              )}

              {/* H2 Heading */}
              {b.type === "h2" && (
                <input
                  ref={(el) => {
                    blockInputRefs.current[b.id] = el;
                  }}
                  type="text"
                  value={b.content}
                  onChange={(e) => updateBlock(note.id, b.id, { content: e.target.value })}
                  onKeyDown={(e) => handleBlockKeyDown(e, b, idx)}
                  placeholder="Heading 2"
                  className="w-full bg-transparent text-xl font-semibold text-foreground outline-none"
                />
              )}

              {/* H3 Heading */}
              {b.type === "h3" && (
                <input
                  ref={(el) => {
                    blockInputRefs.current[b.id] = el;
                  }}
                  type="text"
                  value={b.content}
                  onChange={(e) => updateBlock(note.id, b.id, { content: e.target.value })}
                  onKeyDown={(e) => handleBlockKeyDown(e, b, idx)}
                  placeholder="Heading 3"
                  className="w-full bg-transparent text-base font-semibold text-foreground outline-none"
                />
              )}

              {/* Standard text, checklist text, or bullet text */}
              {b.type !== "callout" &&
                b.type !== "code" &&
                b.type !== "h1" &&
                b.type !== "h2" &&
                b.type !== "h3" && (
                  <textarea
                    ref={(el) => {
                      blockInputRefs.current[b.id] = el;
                    }}
                    value={b.content}
                    onChange={(e) => updateBlock(note.id, b.id, { content: e.target.value })}
                    onKeyDown={(e) => handleBlockKeyDown(e, b, idx)}
                    placeholder={b.type === "checklist" ? "Checklist item..." : "Start typing..."}
                    rows={Math.max(1, (b.content || "").split("\n").length)}
                    className={`w-full bg-transparent text-sm leading-relaxed text-foreground outline-none resize-none ${
                      b.type === "checklist" && b.checked ? "line-through text-muted-foreground" : ""
                    }`}
                  />
                )}

              {/* Delete block button */}
              {note.blocks.length > 1 && (
                <button
                  type="button"
                  onClick={() => deleteBlock(note.id, b.id)}
                  className="opacity-0 group-hover:opacity-80 hover:!opacity-100 p-1 text-muted-foreground hover:text-destructive transition rounded shrink-0"
                  title="Delete block"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add Block Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-4 border-t">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1.5">
            Add:
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => handleAddBlockAfter(note.blocks[note.blocks.length - 1].id, "text")}
          >
            <Type className="h-3.5 w-3.5" /> Text
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => handleAddBlockAfter(note.blocks[note.blocks.length - 1].id, "h1")}
          >
            <Heading1 className="h-3.5 w-3.5" /> H1
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => handleAddBlockAfter(note.blocks[note.blocks.length - 1].id, "h2")}
          >
            <Heading2 className="h-3.5 w-3.5" /> H2
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => handleAddBlockAfter(note.blocks[note.blocks.length - 1].id, "h3")}
          >
            <Heading3 className="h-3.5 w-3.5" /> H3
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => handleAddBlockAfter(note.blocks[note.blocks.length - 1].id, "checklist")}
          >
            <CheckSquare className="h-3.5 w-3.5" /> Checklist
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => handleAddBlockAfter(note.blocks[note.blocks.length - 1].id, "bullet")}
          >
            <List className="h-3.5 w-3.5" /> Bullet
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => handleAddBlockAfter(note.blocks[note.blocks.length - 1].id, "callout")}
          >
            <Sparkles className="h-3.5 w-3.5" /> Callout
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => handleAddBlockAfter(note.blocks[note.blocks.length - 1].id, "code")}
          >
            <Code className="h-3.5 w-3.5" /> Code
          </Button>

          <div className="h-4 w-px bg-border mx-1" />

          {/* AI Tools */}
          <Button
            variant="outline"
            size="sm"
            disabled={aiLoading}
            className="h-7 gap-1 text-xs text-primary border-primary/30 hover:bg-primary/10"
            onClick={handleSummarizeNote}
          >
            {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            AI Summary
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={aiLoading}
            className="h-7 gap-1 text-xs text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
            onClick={handleGenerateFlashcardsFromNote}
          >
            <Layers className="h-3.5 w-3.5" />
            Flashcards
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={aiLoading}
            className="h-7 gap-1 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
            onClick={handleGenerateQuizFromNote}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Quiz
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={aiLoading}
            className="h-7 gap-1 text-xs text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
            onClick={handleGenerateMindMapFromNote}
          >
            <BrainCircuit className="h-3.5 w-3.5" />
            Mind-Map
          </Button>
        </div>
      </main>

      {/* Interactive Flashcard Modal */}
      {activeDeck && (
        <Dialog open={!!activeDeck} onOpenChange={() => setActiveDeck(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-blue-500" />
                Note Flashcards ({deckCardIdx + 1}/{activeDeck.length})
              </DialogTitle>
              <DialogDescription>
                Test your active recall. Click the card to flip between question and answer.
              </DialogDescription>
            </DialogHeader>

            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className="mt-2 min-h-48 cursor-pointer rounded-2xl border-2 border-primary/20 bg-card p-6 shadow-sm flex flex-col justify-between hover:border-primary/40 transition select-none"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                <span>{isFlipped ? "ANSWER / EXPLANATION" : "FRONT / PROMPT"}</span>
                <span className="text-[11px] text-primary">Tap to flip ↺</span>
              </div>
              <p className="my-auto text-center text-base font-semibold leading-relaxed text-foreground">
                {isFlipped ? activeDeck[deckCardIdx].back : activeDeck[deckCardIdx].front}
              </p>
              <div className="text-center text-[11px] text-muted-foreground">
                Card {deckCardIdx + 1} of {activeDeck.length}
              </div>
            </div>

            <div className="flex items-center justify-between mt-3">
              <Button
                variant="outline"
                size="sm"
                disabled={deckCardIdx === 0}
                onClick={() => {
                  setDeckCardIdx((prev) => Math.max(0, prev - 1));
                  setIsFlipped(false);
                }}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (deckCardIdx < activeDeck.length - 1) {
                    setDeckCardIdx((prev) => prev + 1);
                    setIsFlipped(false);
                  } else {
                    toast.success("Deck completed! Great practice.");
                    setActiveDeck(null);
                  }
                }}
              >
                {deckCardIdx === activeDeck.length - 1 ? "Finish Deck" : "Next Card"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Interactive Quiz Modal */}
      {activeQuiz && (
        <Dialog open={!!activeQuiz} onOpenChange={() => setActiveQuiz(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-emerald-500" />
                Note Practice Quiz
              </DialogTitle>
              <DialogDescription>
                {!quizFinished
                  ? `Question ${quizIdx + 1} of ${activeQuiz.length}`
                  : "Quiz Complete! Review your score below."}
              </DialogDescription>
            </DialogHeader>

            {!quizFinished ? (
              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-semibold leading-relaxed">
                  {activeQuiz[quizIdx].question}
                </h3>

                <div className="space-y-2">
                  {activeQuiz[quizIdx].options.map((opt, oIdx) => {
                    const isSelected = selectedOption === oIdx;
                    const isCorrect = oIdx === activeQuiz[quizIdx].answerIndex;
                    const showFeedback = selectedOption !== null;

                    let btnClass = "border-border hover:bg-accent";
                    if (showFeedback) {
                      if (isCorrect) btnClass = "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold";
                      else if (isSelected) btnClass = "border-destructive bg-destructive/10 text-destructive";
                    }

                    return (
                      <button
                        key={oIdx}
                        disabled={showFeedback}
                        onClick={() => {
                          setSelectedOption(oIdx);
                          if (isCorrect) setQuizScore((s) => s + 1);
                        }}
                        className={`w-full rounded-xl border p-3 text-left text-xs transition flex items-center justify-between ${btnClass}`}
                      >
                        <span>{opt}</span>
                        {showFeedback && isCorrect && <Check className="h-4 w-4 text-emerald-500" />}
                      </button>
                    );
                  })}
                </div>

                {selectedOption !== null && activeQuiz[quizIdx].explanation && (
                  <p className="rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">
                    ℹ️ {activeQuiz[quizIdx].explanation}
                  </p>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    disabled={selectedOption === null}
                    onClick={() => {
                      if (quizIdx < activeQuiz.length - 1) {
                        setQuizIdx((q) => q + 1);
                        setSelectedOption(null);
                      } else {
                        setQuizFinished(true);
                      }
                    }}
                  >
                    {quizIdx === activeQuiz.length - 1 ? "See Final Score" : "Next Question"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-4 text-center">
                <div className="text-3xl font-extrabold text-primary">
                  {quizScore} / {activeQuiz.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {quizScore === activeQuiz.length
                    ? "Perfect score! You mastered the key concepts in this note."
                    : "Good effort! Practice more to retain everything."}
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQuizIdx(0);
                      setSelectedOption(null);
                      setQuizScore(0);
                      setQuizFinished(false);
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Retry
                  </Button>
                  <Button size="sm" onClick={() => setActiveQuiz(null)}>
                    Done
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
export default NoteEditorPage;
