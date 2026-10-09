import { describe, it, expect } from "vitest";
import { AIEngine } from "./aiEngine";

describe("AIEngine.decodeStreamOrText", () => {
  it("decodes plain text unchanged", () => {
    expect(AIEngine.decodeStreamOrText("Photosynthesis is the process...")).toBe(
      "Photosynthesis is the process..."
    );
  });

  it("extracts text from JSON payloads", () => {
    expect(AIEngine.decodeStreamOrText('{"text":"Hello from model"}')).toBe("Hello from model");
    expect(AIEngine.decodeStreamOrText('{"response":"Summary notes here"}')).toBe(
      "Summary notes here"
    );
  });

  it("parses raw SSE data stream lines into clean text", () => {
    const rawSSE = `data: {"type":"text-delta","textDelta":"Step 1: "}
data: {"type":"text-delta","textDelta":"Observe phenomenon."}
data: [DONE]`;

    expect(AIEngine.decodeStreamOrText(rawSSE)).toBe("Step 1: Observe phenomenon.");
  });

  it("parses Vercel AI SDK 0: stream chunks", () => {
    const rawVercelStream = `0:"Here is "
0:"the explanation."`;

    expect(AIEngine.decodeStreamOrText(rawVercelStream)).toBe("Here is the explanation.");
  });
});
