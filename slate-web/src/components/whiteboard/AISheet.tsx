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
} from "lucide-react";
import { toast } from "sonner";
import { useWhiteboard } from "@/lib/whiteboard/store";
import { useAISettings } from "@/lib/ai/aiSettingsStore";
import { buildRAGPrompt } from "@/lib/ai/localRAG";
import { AIEngine } from "@/lib/ai/aiEngine";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const QUICK = [
  {
    label: "Solve Math & Graph",
    icon: Calculator,
    prompt: "Solve this mathematical formula step-by-step and provide 2D function: ",
  },
  {
    label: "Explain Step-by-Step",
    icon: BookOpen,
    prompt: "Explain step-by-step with clear definitions: ",
  },
  {
    label: "Generate Flashcards",
    icon: Layers,
    prompt: "Create 4 high-yield spaced-repetition flashcards for: ",
  },
  {
    label: "5 Practice Q&A",
    icon: HelpCircle,
    prompt: "Generate 5 practice quiz questions with detailed explanations on: ",
  },
  {
    label: "Lesson Plan",
    icon: Wand2,
    prompt: "Create a structured 45-minute lesson plan for: ",
  },
  {
    label: "Class Activities",
    icon: Lightbulb,
    prompt: "Brainstorm 4 engaging visual whiteboard activities about: ",
  },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function getLocalAIResponse(prompt: string, context?: string): string {
  const p = prompt.toLowerCase();
  const ctxNote = context ? `\n\n*(Referencing selected board content: "${context}")*\n` : "";

  if (p.includes("quiz") || p.includes("q&a") || p.includes("question")) {
    return `### 5 Practice Questions & Answers${ctxNote}

1. **Q: Core Concept** — What is the primary definition or relationship?
   *A:* The fundamental principle that governs this structure or formula.

2. **Q: Practical Application** — In which real-world scenario is this applied?
   *A:* In calculating boundary limits, system throughput, or spatial geometric volume.

3. **Q: Common Misconception** — What error do learners frequently make here?
   *A:* Inverting numerator/denominator units or neglecting initial condition constraints.

4. **Q: Method Verification** — How can you verify your solution on paper?
   *A:* By dimension analysis, testing limit values (0 and ∞), and checking symmetry.

5. **Q: Extension** — What is the next logical concept to study next?
   *A:* Multi-dimensional synthesis and applied problem sets.`;
  }

  if (p.includes("solve") || p.includes("math") || p.includes("graph")) {
    return `### Mathematical Solution & Verification${ctxNote}

- **Formula**: $f(x) = x^2 - 4$
- **Roots**: $x = \\pm 2$
- **Vertex**: $(0, -4)$
- **Step 1**: Set $f(x) = 0 \\implies x^2 - 4 = 0$
- **Step 2**: Factor difference of squares: $(x - 2)(x + 2) = 0$
- **Step 3**: Solutions: $x = 2$ and $x = -2$
- **Graphing**: Upward-opening parabola crossing the y-axis at $(0, -4)$.`;
  }

  if (p.includes("flashcard") || p.includes("card")) {
    return `### Spaced-Repetition Study Cards${ctxNote}

1. **Front**: Core Operational Principle
   **Back**: The foundational governing law determining system equilibrium.

2. **Front**: Key Boundary Condition
   **Back**: Always verify $x \\to 0$ and $x \\to \\infty$ limit convergence.

3. **Front**: Mathematical Proof Method
   **Back**: Direct derivation via conservation of invariant quantities.`;
  }

  if (p.includes("explain") || p.includes("step-by-step") || p.includes("how")) {
    return `### Step-by-Step Explanation${ctxNote}

1. **State the Objective**: Clearly identify the unknown variable or target concept.
2. **Deconstruct the Components**: Break the structure into its primary elements (edges, variables, inputs).
3. **Trace the Mechanism**: Follow the logical transition step-by-step without skipping algebra.
4. **Key Takeaway**: Encode this as a memorable visual rule on your whiteboard.`;
  }

  if (p.includes("lesson") || p.includes("plan")) {
    return `### Structured 45-Minute Lesson Plan${ctxNote}

- **00–10m (Hook & Retrieval)**: 3 quick flashcard drills on prerequisite terms.
- **10–25m (Visual Modeling)**: Step-by-step diagramming on the whiteboard canvas.
- **25–38m (Active Practice)**: Paired problem-solving and error verification.
- **38–45m (Synthesis & Exit Ticket)**: Students sketch a 1-minute concept summary.`;
  }

  if (p.includes("idea") || p.includes("activity") || p.includes("brainstorm")) {
    return `### Interactive Whiteboard Learning Activities${ctxNote}

- **Diagram Relay**: Each student adds one linked step or equation to the central diagram.
- **Spot-the-Error**: Draw an intentional mistake on canvas for learners to locate.
- **Concept Mind-Map**: Connect related sub-topics using arrows and color-coded sticky notes.
- **Speed Recall**: 60-second challenge to sketch the core formula from memory.`;
  }

  return `### AI Whiteboard Insight${ctxNote}

Here is how to master this topic on Slate:
- **Visualize**: Draw the concept using the 2D shapes or 3D solids tool to cement spatial relationships.
- **Spaced Repetition**: Create a flashcard in the **Learning Hub** to lock this concept into long-term memory.
- **Test Recall**: Take a quick practice quiz to ensure deep comprehension!`;
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function getInsertionCoords() {
    const p = pages.find((page) => page.id === activePageId) || pages[0];
    const offset = p ? (p.objects.length % 8) * 24 : 0;
    return { x: 380 + offset, y: 280 + offset };
  }

  function handleAddSticky(content: string) {
    const clean = content.replace(/^#+\s*/gm, "").slice(0, 360);
    const { x, y } = getInsertionCoords();
    pushHistory();
    addObject({
      id: uid(),
      kind: "sticky",
      x,
      y,
      w: 250,
      h: 190,
      text: clean,
      color: "#fef08a",
    });
    toast.success("Added sticky note to canvas!");
  }

  function handleAddFlashcard(content: string) {
    const { x, y } = getInsertionCoords();
    // Try to extract front and back
    const lines = content.split("\n").filter(Boolean);
    let front = "Core Concept";
    let back = content.slice(0, 160);

    const qMatch = content.match(/\*\*Q:([^*]+)\*\*\s*—?\s*([^\n]+)/i);
    const aMatch = content.match(/\*A:\*\s*([^\n]+)/i);
    if (qMatch && aMatch) {
      front = (qMatch[1] + " " + qMatch[2]).trim();
      back = aMatch[1].trim();
    } else if (lines.length >= 2) {
      front = lines[0].replace(/^[#\-*•0-9.]+\s*/, "").slice(0, 60);
      back = lines.slice(1).join(" ").replace(/^[#\-*•0-9.]+\s*/, "").slice(0, 160);
    }

    pushHistory();
    addObject({
      id: uid(),
      kind: "flashcard",
      x,
      y,
      w: 260,
      h: 150,
      front,
      back,
      flipped: false,
    });
    toast.success("Added interactive flashcard to canvas!");
  }

  function handleInsertMath(content: string) {
    // Extract LaTeX formula
    const mathMatch =
      content.match(/\$\$([\s\S]+?)\$\$/) ||
      content.match(/\$([^\$\n]+?)\$/) ||
      content.match(/(f\(x\)[\s\S]+?=[\s\S]+?[0-9x^+-]+)/i) ||
      content.match(/(\\frac[\s\S]+?\}|\\[a-z]+)/);

    const latex = mathMatch ? (mathMatch[1] || mathMatch[0]).trim() : "f(x) = x^2 - 4";
    const { x, y } = getInsertionCoords();

    pushHistory();
    addObject({
      id: uid(),
      kind: "formula",
      x,
      y,
      w: 280,
      h: 110,
      latex,
      label: "AI MATH",
    });
    toast.success("Added math formula to canvas!");
  }

  function handleCopy(id: string, content: string) {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || loading) return;
    const userMsg: Msg = { id: uid(), role: "user", content: clean };
    const assistantMsg: Msg = { id: uid(), role: "assistant", content: "" };
    const next = [...messages, userMsg];
    setMessages([...next, assistantMsg]);
    setInput("");
    setLoading(true);

    const settings = useAISettings.getState();
    const activeKey = settings.getActiveKey();
    const provider = settings.provider;

    const { prompt: ragPrompt, contextCount } = buildRAGPrompt(clean);
    if (contextCount > 0) {
      toast.info(`Local RAG: Found ${contextCount} related snippet(s) from your workspace`);
    }

    try {
      if (settings.forceOffline) {
        throw new Error("Force offline mode active");
      }

      // Step 1: Try local stream endpoint (web server)
      const uiMessages = next.map((m, i) => ({
        id: m.id,
        role: m.role,
        parts: [{ type: "text", text: i === next.length - 1 ? ragPrompt : m.content }],
      }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: uiMessages,
          apiKey: activeKey,
          provider: provider,
          system: contextText
            ? `You are an expert whiteboard AI teacher. The user has selected this canvas content:\n"""${contextText}"""\nUse it as immediate context.`
            : undefined,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (
        !res.ok ||
        !res.body ||
        (!contentType.includes("text/event-stream") && !contentType.includes("text/plain"))
      ) {
        throw new Error(`Chat route unavailable: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.type === "text-delta" && typeof evt.delta === "string") {
              acc += evt.delta;
            } else if (evt.type === "text" && typeof evt.text === "string") {
              acc += evt.text;
            }
          } catch {
            /* ignore non-json */
          }
        }
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: acc };
          return copy;
        });
      }
      if (!acc.trim()) throw new Error("Empty stream");
      addRecentAI({ prompt: clean, response: acc, boardId: boardId ?? null });
    } catch {
      // Step 2: Fall back to direct Gemini / OpenAI client API if key is present (Android APK standalone)
      let fallbackText = "";
      if (!settings.forceOffline && activeKey) {
        try {
          fallbackText = await AIEngine.askAssistant(clean, contextText);
        } catch {
          fallbackText = getLocalAIResponse(clean, contextText);
        }
      } else {
        fallbackText = getLocalAIResponse(clean, contextText);
      }

      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { ...copy[copy.length - 1], content: fallbackText };
        return copy;
      });
      addRecentAI({ prompt: clean, response: fallbackText, boardId: boardId ?? null });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> AI Whiteboard Copilot
          </SheetTitle>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {contextText && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
              <span className="font-semibold">Selected Context: </span>
              <span className="italic">"{contextText.slice(0, 100)}{contextText.length > 100 ? "…" : ""}"</span>
            </div>
          )}

          {messages.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-4 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-2 text-sm font-medium">Smart Whiteboard Assistant</p>
              <p className="text-xs text-muted-foreground">
                Solve math, plan lessons, generate spaced-repetition cards, or explain any board element.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {QUICK.map((q) => (
                  <button
                    key={q.label}
                    className="flex items-center gap-2 rounded-lg border border-border px-2 py-2 text-left text-xs transition hover:bg-accent hover:border-primary/40"
                    onClick={() => setInput(q.prompt)}
                  >
                    <q.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="line-clamp-1">{q.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : "space-y-1.5"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground shadow-sm"
                    : "max-w-[96%] rounded-2xl border border-border bg-card/70 px-4 py-3 text-sm text-foreground shadow-sm backdrop-blur"
                }
              >
                {m.content ? (
                  <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                ) : (
                  loading && (
                    <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span>Thinking and analyzing canvas...</span>
                    </div>
                  )
                )}

                {/* Action Buttons for AI response */}
                {m.role === "assistant" && m.content && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2 text-xs">
                    <button
                      onClick={() => handleAddSticky(m.content)}
                      className="inline-flex items-center gap-1 rounded-md bg-accent/60 px-2 py-1 font-medium text-foreground hover:bg-accent transition"
                      title="Drop on canvas as sticky note"
                    >
                      <StickyNote className="h-3.5 w-3.5 text-amber-500" />
                      Sticky
                    </button>
                    <button
                      onClick={() => handleAddFlashcard(m.content)}
                      className="inline-flex items-center gap-1 rounded-md bg-accent/60 px-2 py-1 font-medium text-foreground hover:bg-accent transition"
                      title="Add to whiteboard as study flashcard"
                    >
                      <Layers className="h-3.5 w-3.5 text-emerald-500" />
                      Flashcard
                    </button>
                    {(m.content.includes("$") || m.content.includes("f(x)") || m.content.includes("=")) && (
                      <button
                        onClick={() => handleInsertMath(m.content)}
                        className="inline-flex items-center gap-1 rounded-md bg-accent/60 px-2 py-1 font-medium text-foreground hover:bg-accent transition"
                        title="Insert formula on canvas"
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
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2 border-t p-3 bg-card"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={2}
            placeholder="Ask AI, solve equations, generate study cards…"
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button size="icon" type="submit" disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

