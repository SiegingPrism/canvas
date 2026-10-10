import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AIEngine, AIError, aiErrorMessage } from "./aiEngine";
import { useAISettings } from "./aiSettingsStore";

function geminiResponse(text: string) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AIEngine (online-only)", () => {
  beforeEach(() => {
    useAISettings.setState({ geminiKey: "test-key" });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("throws a no_key error when no API key is configured", async () => {
    useAISettings.setState({ geminiKey: "", getApiKey: () => "" });
    await expect(AIEngine.askAssistant("hi")).rejects.toMatchObject({ code: "no_key" });
    useAISettings.setState({ getApiKey: () => useAISettings.getState().geminiKey });
  });

  it("sends the key in a header, never in the URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse("Hello"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(AIEngine.askAssistant("hi")).resolves.toBe("Hello");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain("key=");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
  });

  it("maps HTTP 429 to a friendly quota error and does not retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Quota", status: "RESOURCE_EXHAUSTED" } }),
        { status: 429 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const err = await AIEngine.askAssistant("hi").catch((e) => e);
    expect(err).toBeInstanceOf(AIError);
    expect(err.code).toBe("quota");
    expect(aiErrorMessage(err)).toMatch(/limit/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps a rejected key to invalid_key", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              error: {
                message: "API key not valid. Please pass a valid API key.",
                status: "INVALID_ARGUMENT",
              },
            }),
            { status: 400 },
          ),
        ),
    );
    await expect(AIEngine.askAssistant("hi")).rejects.toMatchObject({ code: "invalid_key" });
  });

  it("validates quiz output and keeps the correct answer after shuffling", async () => {
    const quiz = [
      {
        question: "2 + 2 = ?",
        options: ["4", "3", "5", "22"],
        answerIndex: 0,
        explanation: "Basic addition.",
      },
      { question: "Broken", options: ["a"], answerIndex: 3, explanation: "" },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiResponse(JSON.stringify(quiz))));
    const out = await AIEngine.generateQuiz("Some study material about arithmetic and numbers.");
    expect(out).toHaveLength(1);
    expect(out[0].options[out[0].answerIndex]).toBe("4");
  });

  it("drops graph functions that cannot be plotted", async () => {
    const res = {
      latex: "x^2=9",
      solution: "x = 3, -3",
      steps: ["Take square roots: x = \\pm 3"],
      graphableFn: "Math.pow(x)",
      xRange: [-6, 6],
      yRange: [-5, 8],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiResponse(JSON.stringify(res))));
    const out = await AIEngine.solveMath("x^2 = 9");
    expect(out.solution).toBe("x = 3, -3");
    expect(out.graphableFn).toBeUndefined();
  });

  it("keeps a valid graph function and strips Math. prefixes", async () => {
    const res = {
      latex: "y=sin(x)",
      solution: "periodic",
      steps: ["a"],
      graphableFn: "Math.sin(x)",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiResponse(JSON.stringify(res))));
    const out = await AIEngine.solveMath("y = sin(x)");
    expect(out.graphableFn).toBe("sin(x)");
  });

  it("streams chat text and returns the full answer", async () => {
    const sse =
      'data: {"candidates":[{"content":{"parts":[{"text":"Hel"}]}}]}\r\n\r\n' +
      'data: {"candidates":[{"content":{"parts":[{"text":"lo!"}]}}]}\r\n\r\n';
    const body = new ReadableStream({
      start(c) {
        const enc = new TextEncoder();
        // Split in the middle of a line to test buffering across chunks.
        c.enqueue(enc.encode(sse.slice(0, 30)));
        c.enqueue(enc.encode(sse.slice(30)));
        c.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    const seen: string[] = [];
    const { text } = await AIEngine.chat([{ role: "user", content: "hi" }], {
      onText: (t) => seen.push(t),
    });
    expect(text).toBe("Hello!");
    expect(seen.at(-1)).toBe("Hello!");
  });
});
