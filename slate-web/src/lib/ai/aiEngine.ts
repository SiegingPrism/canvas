import { useAISettings, DEFAULT_GEMINI_API_KEY } from "./aiSettingsStore";
import {
  offlineSummarizeNote,
  offlineGenerateQuiz,
  offlineGenerateFlashcards,
  offlineGenerateMindMap,
  offlineRecognizeMath,
  offlineSolveMath,
  offlineGenerateFlowchart,
  type QuizQuestion,
  type FlashcardItem,
  type MindMapNode,
  type FlowchartNode,
  type MathSolveResult,
} from "./offlineAssistant";
import { buildRAGPrompt } from "./localRAG";

export interface AIResponse<T> {
  data: T;
  isOffline: boolean;
  modelUsed: string;
}

/**
 * Universal client AI Engine.
 * Handles online LLM/Vision calls (Gemini/OpenAI) directly or via proxy,
 * and falls back seamlessly to rich offline heuristics.
 */
export class AIEngine {
  private static getActiveConfig() {
    const settings = useAISettings.getState();
    return {
      apiKey: settings.getActiveKey(),
      provider: settings.provider,
      customBaseURL: settings.customBaseURL,
      forceOffline: settings.forceOffline || !navigator.onLine,
    };
  }

  /**
   * Direct client-side call to Google Gemini REST API.
   * Runs directly in browser or standalone Android WebView without needing a local backend server.
   */
  private static async directGeminiCall(prompt: string, apiKey: string, imageDataUrl?: string): Promise<string> {
    const effectiveKey = apiKey?.trim() || DEFAULT_GEMINI_API_KEY;
    const models = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-1.5-flash"];
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey}`;
        const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{ text: prompt }];
        if (imageDataUrl) {
          const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
          const mimeType = match ? match[1] : "image/png";
          const base64Data = match ? match[2] : imageDataUrl.replace(/^data:image\/[a-z]+;base64,/, "");
          parts.push({
            inlineData: {
              mimeType,
              data: base64Data,
            },
          });
        }
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: { temperature: 0.2 },
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const candidateParts = json.candidates?.[0]?.content?.parts;
          if (Array.isArray(candidateParts)) {
            const text = candidateParts
              .map((p: { text?: string }) => p.text || "")
              .filter(Boolean)
              .join("\n")
              .trim();
            if (text) return text;
          }
        }
      } catch (err) {
        console.warn(`Direct Gemini call failed on ${model}:`, err);
      }
    }
    throw new Error("Direct Gemini call failed");
  }

  /**
   * Direct client-side call to OpenAI REST API.
   */
  private static async directOpenAICall(
    prompt: string,
    apiKey: string,
    baseURL?: string,
    imageDataUrl?: string
  ): Promise<string> {
    const endpoint = (baseURL || "https://api.openai.com/v1").replace(/\/+$/, "") + "/chat/completions";
    const content: unknown = imageDataUrl
      ? [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ]
      : prompt;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content }],
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content;
    if (!text) throw new Error("Empty OpenAI response");
    return text;
  }

  /**
   * Decodes raw response text that may be plain text, a JSON payload ({ text: "..." }),
   * or an SSE / Vercel AI stream containing "data: {...}" or "0:\"...\"" chunks.
   */
  static decodeStreamOrText(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return "";

    // 1. Check if it's already a JSON object like { text: "..." }
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed.text === "string") return parsed.text.trim();
        if (typeof parsed.response === "string") return parsed.response.trim();
        if (typeof parsed.content === "string") return parsed.content.trim();
      } catch {
        // Not simple JSON, continue
      }
    }

    // 2. Check if it's an SSE / Vercel AI Stream (contains "data:" or stream line headers)
    if (trimmed.includes("data:") || /^(?:[0-9a-f]+|data):/m.test(trimmed)) {
      const lines = trimmed.split(/\r?\n/);
      let accumulated = "";
      let foundStreamPattern = false;

      for (const line of lines) {
        const l = line.trim();
        if (!l) continue;

        if (l.startsWith("data:")) {
          foundStreamPattern = true;
          const dataContent = l.slice(5).trim();
          if (dataContent === "[DONE]") continue;
          try {
            const parsed = JSON.parse(dataContent);
            if (typeof parsed === "string") {
              accumulated += parsed;
            } else if (parsed && typeof parsed === "object") {
              if (parsed.textDelta) accumulated += parsed.textDelta;
              else if (parsed.delta) accumulated += parsed.delta;
              else if (parsed.text) accumulated += parsed.text;
              else if (parsed.content) accumulated += parsed.content;
              else if (parsed.parts && Array.isArray(parsed.parts)) {
                for (const p of parsed.parts) {
                  if (typeof p === "string") accumulated += p;
                  else if (p?.text) accumulated += p.text;
                }
              }
            }
          } catch {
            accumulated += dataContent;
          }
        } else if (/^[0-9]:"/.test(l)) {
          // Vercel AI SDK text part: 0:"hello"
          foundStreamPattern = true;
          try {
            const parsed = JSON.parse(l.slice(2));
            if (typeof parsed === "string") accumulated += parsed;
          } catch {
            // ignore
          }
        }
      }

      if (foundStreamPattern && accumulated.trim()) {
        return accumulated.trim();
      }
    }

    return trimmed;
  }

  /**
   * Universal fetch: Tries local /api/... first, then falls back to direct client provider call.
   */
  private static async requestLLM(prompt: string, imageDataUrl?: string): Promise<string | null> {
    const config = this.getActiveConfig();
    const effectiveKey =
      config.apiKey?.trim() ||
      (config.provider === "gemini" ? DEFAULT_GEMINI_API_KEY : "");
    if (config.forceOffline || !effectiveKey) return null;

    // 1. Try local API proxy first (when hosted on web server)
    try {
      const endpoint = imageDataUrl ? "/api/vision" : "/api/chat";
      const payload = imageDataUrl
        ? {
            image: imageDataUrl,
            prompt,
            apiKey: effectiveKey,
            provider: config.provider,
            baseURL: config.customBaseURL,
          }
        : {
            messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: prompt }] }],
            apiKey: effectiveKey,
            provider: config.provider,
            baseURL: config.customBaseURL,
            stream: false,
          };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const rawText = await res.text();
        const decoded = this.decodeStreamOrText(rawText);
        if (decoded) return decoded;
      }
    } catch {
      // Local endpoint failed or timed out (expected in standalone Android APK)
    }

    // 2. Direct client fallback with user's API key
    try {
      if (config.provider === "openai") {
        return await this.directOpenAICall(prompt, effectiveKey, config.customBaseURL, imageDataUrl);
      } else {
        return await this.directGeminiCall(prompt, effectiveKey, imageDataUrl);
      }
    } catch (e) {
      console.warn("Direct LLM client call failed, falling back to offline heuristics:", e);
      return null;
    }
  }

  // ---- 1. Handwriting to Text ----
  static async transcribeHandwriting(imageDataUrl?: string, hint?: string): Promise<string> {
    if (imageDataUrl) {
      const res = await this.requestLLM(
        "You are an OCR and handwriting transcription engine. Transcribe every handwritten word or sentence visible in this image accurately. Output only the transcribed text without conversational filler.",
        imageDataUrl
      );
      if (res?.trim()) return res.trim();
    }
    return hint?.trim() || "Handwritten Note Captured";
  }

  // ---- 2. Handwritten Math Recognition ----
  static async recognizeMath(imageDataUrl?: string, hint?: string): Promise<string> {
    if (imageDataUrl) {
      const res = await this.requestLLM(
        "You are an expert handwritten math recognition engine. Convert the handwritten mathematical formula in this image into standard LaTeX syntax. Output only the raw LaTeX expression (e.g. \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} or f(x) = x^2 - 4) without explanation or markdown backticks.",
        imageDataUrl
      );
      if (res?.trim()) return res.trim().replace(/^`+|`+$/g, "");
    }
    return offlineRecognizeMath(hint);
  }

  // ---- 3. Interactive Math Solver & Graph Generator ----
  static async solveMath(formulaOrHint?: string, imageDataUrl?: string): Promise<MathSolveResult> {
    const prompt = `You are an expert educational math solver. Analyze this mathematical formula or drawing: "${formulaOrHint || ""}".
Solve it step-by-step with high mathematical rigor.
If it is a function of x that can be plotted on a 2D Cartesian plane (like y = x^2 - 4 or y = sin(x)), provide a JavaScript-evaluable expression of x for plotting.
Return valid JSON only in this exact format:
{
  "latex": "clean LaTeX of formula",
  "solution": "concise final answer or roots (e.g. x = 4 or Roots: x = -2, 2)",
  "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "graphableFn": "JavaScript-evaluable function of x, e.g. 'x*x - 4' or 'Math.sin(x)', or null if not plottable",
  "xRange": [-6, 6],
  "yRange": [-5, 8],
  "title": "Short title, e.g. f(x) = x² - 4"
}
Output valid JSON only.`;

    const res = await this.requestLLM(prompt, imageDataUrl);
    if (res) {
      try {
        const jsonMatch = res.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.latex && parsed.solution && Array.isArray(parsed.steps)) {
            return parsed;
          }
        }
      } catch (err) {
        console.warn("Failed to parse online math solution JSON:", err);
      }
    }

    return offlineSolveMath(formulaOrHint);
  }

  // ---- 4. Diagram & Flowchart / UML Conversion ----
  static async convertDiagram(
    imageDataUrl?: string,
    title = "Diagram Flow",
    startX = 300,
    startY = 200,
  ): Promise<FlowchartNode[]> {
    if (imageDataUrl) {
      const prompt = `Convert this hand-drawn diagram into structured flowchart nodes. Output JSON array format:
[{"id": "node1", "type": "process", "label": "Text", "x": 100, "y": 100, "w": 180, "h": 60, "connectedTo": ["node2"]}]
Valid types: "start", "process", "decision", "end". Output valid JSON only.`;
      const res = await this.requestLLM(prompt, imageDataUrl);
      if (res) {
        try {
          const cleanText = res.replace(/```json|```/g, "").trim();
          const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          }
        } catch (e) {
          console.warn("Online diagram parsing failed:", e);
        }
      }
    }
    return offlineGenerateFlowchart(title, startX, startY);
  }

  // ---- 5. Explain This Board (Multimodal Vision) ----
  static async explainBoard(
    imageDataUrl: string,
    boardContext = "",
  ): Promise<{ summary: string; breakdown: string[]; recommendations: string[] }> {
    const prompt = `You are an AI teaching assistant analyzing a whiteboard canvas.
Examine this drawing/board snapshot carefully. Context: "${boardContext}"
Provide a clear analysis in JSON:
{
  "summary": "1-2 sentence overview of what is on this board",
  "breakdown": ["Key concept 1", "Key concept 2", "Key concept 3"],
  "recommendations": ["Next study topic", "Suggested quiz question", "Missing detail to verify"]
}
Output valid JSON only.`;

    const res = await this.requestLLM(prompt, imageDataUrl);
    if (res) {
      try {
        const clean = res.replace(/```json|```/g, "").trim();
        const jsonMatch = clean.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.summary) return parsed;
        }
      } catch (e) {
        console.warn("Vision board explanation failed:", e);
      }
    }

    return {
      summary: `Whiteboard analysis based on ${boardContext ? `selected elements: "${boardContext.slice(0, 100)}..."` : "canvas visual content"}.`,
      breakdown: [
        "Identified conceptual sketch and spatial relationship structure.",
        "Contains geometric models, labels, or equations mapped on the canvas coordinate plane.",
        "Ready for structured spaced-repetition retention.",
      ],
      recommendations: [
        "Create flashcards in the Learning Hub for key terms.",
        "Test recall with an active 5-question practice quiz.",
        "Generate a structured mind map to link sub-concepts.",
      ],
    };
  }

  // ---- 6. Note Summarization ----
  static async summarizeNote(title: string, blocks: string[]): Promise<{
    overview: string;
    keyPoints: string[];
    actionItems: string[];
    takeaway: string;
  }> {
    const content = blocks.join("\n");
    const prompt = `Summarize this note titled "${title}":
${content}

Return JSON with:
{
  "overview": "Concise 2-sentence executive summary",
  "keyPoints": ["Core takeaway 1", "Core takeaway 2", "Core takeaway 3"],
  "actionItems": ["Actionable task 1", "Actionable task 2"],
  "takeaway": "One memorable final insight"
}
Output valid JSON only.`;

    const res = await this.requestLLM(prompt);
    if (res) {
      try {
        const jsonMatch = res.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.overview) return parsed;
        }
      } catch (e) {
        console.warn("Online summarization failed:", e);
      }
    }

    return offlineSummarizeNote(title, blocks);
  }

  // ---- 7. Generate Quizzes from Content ----
  static async generateQuiz(content: string, title?: string): Promise<QuizQuestion[]> {
    if (content.trim().length > 30) {
      const prompt = `Generate 3-4 multiple choice quiz questions based on this study content:
"${content}"

Return JSON format:
[
  {
    "question": "Question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answerIndex": 0,
    "explanation": "Why this answer is correct."
  }
]
Output valid JSON only.`;
      const res = await this.requestLLM(prompt);
      if (res) {
        try {
          const jsonMatch = res.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          }
        } catch (e) {
          console.warn("Online quiz parsing failed:", e);
        }
      }
    }

    return offlineGenerateQuiz(content, title);
  }

  // ---- 8. Generate Flashcards from Content ----
  static async generateFlashcards(content: string, title?: string): Promise<FlashcardItem[]> {
    if (content.trim().length > 30) {
      const prompt = `Extract 3-5 high-yield spaced-repetition flashcards from this content:
"${content}"

Return JSON array:
[
  {"front": "Key Term or Question", "back": "Clear definition or answer"}
]
Output valid JSON only.`;
      const res = await this.requestLLM(prompt);
      if (res) {
        try {
          const jsonMatch = res.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          }
        } catch (e) {
          console.warn("Online flashcard parsing failed:", e);
        }
      }
    }

    return offlineGenerateFlashcards(content, title);
  }

  // ---- 9. AI Mind-Map Generation ----
  static async generateMindMap(topic: string, startX = 600, startY = 400): Promise<MindMapNode> {
    if (topic.trim()) {
      const prompt = `Generate a concept mind-map tree for the topic: "${topic}".
Return JSON format:
{
  "label": "${topic}",
  "children": [
    {"label": "Branch 1", "children": [{"label": "Subconcept A"}, {"label": "Subconcept B"}]},
    {"label": "Branch 2", "children": [{"label": "Subconcept C"}, {"label": "Subconcept D"}]},
    {"label": "Branch 3", "children": [{"label": "Subconcept E"}, {"label": "Subconcept F"}]}
  ]
}
Output valid JSON only.`;

      const res = await this.requestLLM(prompt);
      if (res) {
        try {
          const jsonMatch = res.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.label && Array.isArray(parsed.children)) {
              const root: MindMapNode = {
                id: `mm-root-${Date.now()}`,
                label: parsed.label,
                x: startX,
                y: startY,
                level: 0,
                color: "#6366f1",
                children: [],
              };
              const colors = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4"];
              const branches = parsed.children;
              branches.forEach((b: { label: string; children?: { label: string }[] }, i: number) => {
                const angle = (i * 2 * Math.PI) / branches.length;
                const bx = startX + Math.cos(angle) * 250;
                const by = startY + Math.sin(angle) * 250;
                const col = colors[i % colors.length];
                const bNode: MindMapNode = {
                  id: `mm-b-${i}-${Date.now()}`,
                  label: b.label,
                  x: bx,
                  y: by,
                  level: 1,
                  color: col,
                  parentId: root.id,
                  children: [],
                };
                (b.children || []).forEach((c, j) => {
                  const spread = 0.5;
                  const subAngle = angle - spread / 2 + (j * spread) / Math.max(1, (b.children?.length || 1) - 1);
                  const sx = bx + Math.cos(subAngle) * 160;
                  const sy = by + Math.sin(subAngle) * 160;
                  bNode.children!.push({
                    id: `mm-s-${i}-${j}-${Date.now()}`,
                    label: c.label,
                    x: sx,
                    y: sy,
                    level: 2,
                    color: col,
                    parentId: bNode.id,
                  });
                });
                root.children!.push(bNode);
              });
              return root;
            }
          }
        } catch (e) {
          console.warn("Online mind map parsing failed:", e);
        }
      }
    }

    return offlineGenerateMindMap(topic, startX, startY);
  }

  // ---- 10. General Conversational AI Assistant ----
  static async askAssistant(prompt: string, contextText?: string, imageDataUrl?: string): Promise<string> {
    const rag = buildRAGPrompt(prompt);
    const combinedPrompt = contextText
      ? `Whiteboard Selected Context: "${contextText}"\n\n${rag.prompt}`
      : rag.prompt;

    const res = await this.requestLLM(combinedPrompt, imageDataUrl);
    if (res?.trim()) return res.trim();

    // Fallback to local heuristic assistant response
    return `### AI Whiteboard Insight\n\n` +
      (contextText ? `*(Referencing: "${contextText.slice(0, 80)}...")*\n\n` : "") +
      `Here is a structured breakdown for **${prompt}**:\n` +
      `1. **Core Concept**: The primary operational framework and relationships governing this subject.\n` +
      `2. **Key Application**: How this model functions in practical problem-solving and analysis.\n` +
      `3. **Active Practice**: Use the math grapher or flashcards to test your recall!`;
  }
}
