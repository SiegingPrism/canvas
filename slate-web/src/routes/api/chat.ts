import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { getAIModel } from "@/lib/ai-provider.server";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            messages?: UIMessage[];
            system?: string;
            apiKey?: string;
            provider?: "gemini" | "openai" | "custom";
            baseURL?: string;
          };

          if (!Array.isArray(body.messages)) {
            return new Response("messages required", { status: 400 });
          }

          const modelConfig = getAIModel({
            apiKey: body.apiKey,
            provider: body.provider,
            baseURL: body.baseURL,
          });

          if (!modelConfig) {
            return new Response(
              JSON.stringify({
                error: "Missing API Key. Please provide a GEMINI_API_KEY or configure one in AI Settings.",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const result = streamText({
            model: modelConfig.model,
            system:
              body.system ??
              "You are an intelligent educational whiteboard assistant. Provide clear, well-structured, formatted responses with headings, bullet points, formulas, and actionable practice steps.",
            messages: await convertToModelMessages(body.messages),
          });

          return result.toUIMessageStreamResponse();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Internal AI service error";
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
