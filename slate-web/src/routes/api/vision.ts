import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { getAIModel } from "@/lib/ai-provider.server";

export const Route = createFileRoute("/api/vision")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            image?: string;
            prompt?: string;
            apiKey?: string;
            provider?: "gemini" | "openai" | "custom";
            baseURL?: string;
          };

          if (!body.image) {
            return new Response(JSON.stringify({ error: "Image data URL is required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const modelConfig = getAIModel({
            apiKey: body.apiKey,
            provider: body.provider,
            baseURL: body.baseURL,
            modelName: body.provider === "openai" ? "gpt-4o-mini" : "gemini-3.8-flash",
          });

          if (!modelConfig) {
            return new Response(
              JSON.stringify({
                error: "Missing API Key. Please provide a GEMINI_API_KEY or configure one in AI Settings.",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const promptText = body.prompt || "Analyze this whiteboard drawing or image in detail.";

          const result = await generateText({
            model: modelConfig.model,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: promptText },
                  { type: "image", image: body.image },
                ],
              },
            ],
          });

          return new Response(JSON.stringify({ text: result.text }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Vision processing error";
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
