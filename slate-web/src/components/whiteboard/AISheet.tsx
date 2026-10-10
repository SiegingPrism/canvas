import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Send,
  Wand2,
  HelpCircle,
  BookOpen,
  Lightbulb,
  Loader2,
  Copy,
  StickyNote,
  Layers,
  Calculator,
  Check,
  Square,
  RotateCcw,
  WifiOff,
  AlertCircle,
  Trash2,
  BookMarked,
} from "lucide-react";
import { toast } from "sonner";
import { useWhiteboard } from "@/lib/whiteboard/store";
import { useAISettings } from "@/lib/ai/aiSettingsStore";
import { AIEngine, AIError, aiErrorMessage, type ChatSource } from "@/lib/ai/aiEngine";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: string;
  sources?: ChatSource[];
};

const QUICK = [
  { label: "Solve step-by-step", icon: Calculator, prompt: "Solve step-by-step: " },
  { label: "Explain simply", icon: BookOpen, prompt: "Explain simply, with an example: " },
  {
    label: "Make flashcards",
    icon: Layers,
    prompt: "Make 5 flashcards (question and answer) about: ",
  },
  {
    label: "Practice questions",
    icon: HelpCircle,
    prompt: "Give me 5 practice questions with answers on: ",
  },
  { label: "Lesson plan", icon: Wand2, prompt: "Create a 45-minute lesson plan for: " },
  { label: "Activity ideas", icon: Lightbulb, prompt: "Suggest 4 whiteboard activities about: " },
];

/** Markdown styling without the typography plugin (Tailwind preflight resets headings and lists). */
const MD_CLASS =
  "max-w-none break-words leading-relaxed text-foreground " +
  "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 " +
  "[&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1.5 " +
  "[&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5 " +
  "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 " +
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-0.5 " +
  "[&_strong]:font-semibold [&_a]:text-primary [&_a]:underline " +
  "[&_code]:font-mono [&_code]:text-[0.85em] [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded " +
  "[&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-2 [&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground " +
  "[&_table]:w-full [&_table]:text-xs [&_table]:my-2 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted [&_td]:border [&_td]:px-2 [&_td]:py-1 " +
  "[&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** Converts Markdown/LaTeX to plain readable text for sticky notes and flashcards. */
function toPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*/g, ""))
    .replace(/\$\$([\s\S]+?)\$\$/g, "$1")
    .replace(/\$([^$\n]+?)\$/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)\*(.+?)\*(?=\s|$)/g, "$1$2")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractFormula(md: string): string | null {
  const m = md.match(/\$\$([\s\S]+?)\$\$/) || md.match(/\$([^$\n]+?)\$/);
  return m ? m[1].trim() : null;
}

function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function AISheet({
  open,
  onOpenChange,
  contextText,
  boardId,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  contextText?: string;
  boardId?: string;
}) {
  const addRecentAI = useWhiteboard((s) => s.addRecentAI);
  const addObject = useWhiteboard((s) => s.addObject);
  const pushHistory = useWhiteboard((s) => s.pushHistory);
  const pages = useWhiteboard((s) => s.pages);
  const activePageId = useWhiteboard((s) => s.activePageId);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const online = useOnlineStatus();
  const configured = useAISettings((s) => Boolean(s.getApiKey()));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Stop any running request when the sheet unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  function getInsertionCoords() {
    const p = pages.find((page) => page.id === activePageId) || pages[0];
    const offset = p ? (p.objects.length % 8) * 24 : 0;
    return { x: 380 + offset, y: 280 + offset };
  }

  function handleAddSticky(content: string) {
    const { x, y } = getInsertionCoords();
    addObject({
      id: uid(),
      kind: "sticky",
      x,
      y,
      w: 260,
      h: 200,
      text: toPlainText(content).slice(0, 600),
      color: "#fef08a",
    });
    pushHistory();
    toast.success("Added to the board as a sticky note");
  }

  function handleAddFlashcard(content: string, question: string) {
    const { x, y } = getInsertionCoords();
    addObject({
      id: uid(),
      kind: "flashcard",
      x,
      y,
      w: 260,
      h: 150,
      front: question.slice(0, 140),
      back: toPlainText(content).slice(0, 300),
      flipped: false,
    });
    pushHistory();
    toast.success("Added to the board as a flashcard");
  }

  function handleInsertMath(latex: string) {
    const { x, y } = getInsertionCoords();
    addObject({
      id: uid(),
      kind: "formula",
      x,
      y,
      w: 280,
      h: 110,
      latex,
      label: "AI",
    });
    pushHistory();
    toast.success("Formula added to the board");
  }

  async function handleCopy(id: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  async function runChat(history: Msg[]) {
    const assistantId = uid();
    setMessages([...history, { id: assistantId, role: "assistant", content: "" }]);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const update = (patch: Partial<Msg>) =>
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)));

    try {
      const { text, sources } = await AIEngine.chat(
        history.map((m) => ({ role: m.role, content: m.content })),
        {
          contextText,
          signal: controller.signal,
          onText: (full) => update({ content: full }),
        },
      );
      update({ content: text, sources });
      const lastUser = [...history].reverse().find((m) => m.role === "user");
      addRecentAI({ prompt: lastUser?.content || "", response: text, boardId: boardId ?? null });
    } catch (err) {
      const partial = (err as AIError & { partialText?: string })?.partialText || "";
      if (err instanceof AIError && err.code === "aborted") {
        update({ content: partial, error: partial ? undefined : "Stopped." });
      } else {
        update({ content: partial, error: aiErrorMessage(err) });
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  }

  function send(text: string) {
    const clean = text.trim();
    if (!clean || loading) return;
    // Drop failed/empty assistant turns from the history sent to the model.
    const history = messages.filter(
      (m) => !(m.role === "assistant" && (m.error || !m.content.trim())),
    );
    setInput("");
    void runChat([...history, { id: uid(), role: "user", content: clean }]);
  }

  function retry() {
    if (loading) return;
    // Remove the failed assistant reply and resend the conversation up to the last user message.
    const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
    if (lastUserIdx === -1) return;
    const history = messages
      .slice(0, lastUserIdx + 1)
      .filter((m) => !(m.role === "assistant" && (m.error || !m.content.trim())));
    void runChat(history);
  }

  function stop() {
    abortRef.current?.abort();
  }

  function clearChat() {
    abortRef.current?.abort();
    setMessages([]);
  }

  const canSend = online && configured && !loading && input.trim().length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Slate AI
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="ml-auto mr-8 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-normal text-muted-foreground hover:bg-accent"
                title="Start a new chat"
              >
                <Trash2 className="h-3.5 w-3.5" /> New chat
              </button>
            )}
          </SheetTitle>
        </SheetHeader>

        {!online && (
          <div className="flex items-center gap-2 border-b bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
            <WifiOff className="h-4 w-4 shrink-0" />
            You're offline. Slate AI needs an internet connection.
          </div>
        )}
        {online && !configured && (
          <div className="flex items-center gap-2 border-b bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            AI isn't set up yet. Add a Gemini API key in AI Settings.
          </div>
        )}

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {contextText && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
              <span className="font-semibold">Using your selection: </span>
              <span className="italic">
                "{contextText.slice(0, 100)}
                {contextText.length > 100 ? "…" : ""}"
              </span>
            </div>
          )}

          {messages.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-4 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-2 text-sm font-medium">Ask anything</p>
              <p className="text-xs text-muted-foreground">
                Solve problems, explain topics, make flashcards, or plan a lesson. Answers can use
                your selected board content and your notes.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {QUICK.map((q) => (
                  <button
                    key={q.label}
                    className="flex items-center gap-2 rounded-lg border border-border px-2 py-2 text-left text-xs transition hover:bg-accent hover:border-primary/40"
                    onClick={() => {
                      setInput(q.prompt);
                      inputRef.current?.focus();
                    }}
                  >
                    <q.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="line-clamp-1">{q.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, idx) => {
            const isLast = idx === messages.length - 1;
            const streaming = loading && isLast && m.role === "assistant";
            const formula = m.role === "assistant" && m.content ? extractFormula(m.content) : null;
            const question =
              m.role === "assistant"
                ? [...messages.slice(0, idx)].reverse().find((x) => x.role === "user")?.content ||
                  "Question"
                : "";
            return (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : "space-y-1.5"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground shadow-sm"
                      : "max-w-[96%] rounded-2xl border border-border bg-card/70 px-4 py-3 text-sm text-foreground shadow-sm"
                  }
                >
                  {m.role === "user" ? (
                    <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                  ) : (
                    <>
                      {m.content && (
                        <div className={MD_CLASS}>
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {m.content}
                          </ReactMarkdown>
                        </div>
                      )}

                      {streaming && !m.content && (
                        <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span>Thinking…</span>
                        </div>
                      )}

                      {m.error && (
                        <div
                          className={`flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive ${m.content ? "mt-3" : ""}`}
                        >
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p>{m.error}</p>
                            {isLast && !loading && (
                              <button
                                onClick={retry}
                                className="mt-1.5 inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
                              >
                                <RotateCcw className="h-3 w-3" /> Try again
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {m.sources && m.sources.length > 0 && !streaming && (
                        <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                          <BookMarked className="h-3 w-3" />
                          From your workspace:
                          {m.sources.map((s, i) => (
                            <span key={i} className="rounded bg-muted px-1.5 py-0.5">
                              {s.title}
                            </span>
                          ))}
                        </div>
                      )}

                      {m.content && !streaming && (
                        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2 text-xs">
                          <button
                            onClick={() => handleAddSticky(m.content)}
                            className="inline-flex items-center gap-1 rounded-md bg-accent/60 px-2 py-1 font-medium text-foreground hover:bg-accent transition"
                            title="Add to board as a sticky note"
                          >
                            <StickyNote className="h-3.5 w-3.5 text-amber-500" />
                            Sticky
                          </button>
                          <button
                            onClick={() => handleAddFlashcard(m.content, question)}
                            className="inline-flex items-center gap-1 rounded-md bg-accent/60 px-2 py-1 font-medium text-foreground hover:bg-accent transition"
                            title="Add to board as a flashcard (your question on the front)"
                          >
                            <Layers className="h-3.5 w-3.5 text-emerald-500" />
                            Flashcard
                          </button>
                          {formula && (
                            <button
                              onClick={() => handleInsertMath(formula)}
                              className="inline-flex items-center gap-1 rounded-md bg-accent/60 px-2 py-1 font-medium text-foreground hover:bg-accent transition"
                              title="Add the first formula to the board"
                            >
                              <Calculator className="h-3.5 w-3.5 text-purple-500" />
                              Formula
                            </button>
                          )}
                          <button
                            onClick={() => handleCopy(m.id, m.content)}
                            className="inline-flex items-center gap-1 rounded-md bg-accent/60 px-2 py-1 font-medium text-foreground hover:bg-accent transition ml-auto"
                            title="Copy text"
                          >
                            {copiedId === m.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-green-500" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2 border-t p-3 bg-card"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={2}
            disabled={!online || !configured}
            placeholder={
              !online
                ? "You're offline"
                : !configured
                  ? "Add a Gemini API key in AI Settings"
                  : "Ask a question, paste a problem…"
            }
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          />
          {loading ? (
            <Button size="icon" type="button" variant="secondary" onClick={stop} title="Stop">
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="icon" type="submit" disabled={!canSend} title="Send">
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}
