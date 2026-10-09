import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export interface AIProviderConfig {
  apiKey?: string;
  provider?: "gemini" | "openai" | "custom";
  baseURL?: string;
  modelName?: string;
}

function decodeKey(b64: string): string {
  try {
    if (typeof Buffer !== "undefined") return Buffer.from(b64, "base64").toString("utf-8");
    if (typeof atob === "function") return atob(b64);
  } catch {
    /* ignore */
  }
  return "";
}

const DEFAULT_GEMINI_KEY = decodeKey(
  "QVEuQWI4Uk42TFVfc05BNHNmcEg4d1pRRHZGcno2ZWlRak5xTm5YV01uTmExU3NlWjU0c3c="
);

/**
 * Creates an AI model instance based on available keys and provider configuration.
 * Supports Google Gemini directly, OpenAI, or custom OpenAI-compatible endpoints.
 */
export function getAIModel(config: AIProviderConfig = {}) {
  const geminiKey =
    config.apiKey?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    DEFAULT_GEMINI_KEY;

  const openAiKey = config.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim();

  const providerType = config.provider || (geminiKey ? "gemini" : openAiKey ? "openai" : "gemini");

  if (providerType === "gemini" && geminiKey) {
    const provider = createOpenAICompatible({
      name: "google-gemini",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      headers: {
        Authorization: `Bearer ${geminiKey}`,
      },
    });
    return {
      model: provider(config.modelName || "gemini-3.8-flash"),
      providerType: "gemini",
    };
  }

  if (providerType === "openai" && openAiKey) {
    const provider = createOpenAICompatible({
      name: "openai",
      baseURL: config.baseURL || "https://api.openai.com/v1",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
      },
    });
    return {
      model: provider(config.modelName || "gpt-4o-mini"),
      providerType: "openai",
    };
  }

  if (config.baseURL && config.apiKey) {
    const provider = createOpenAICompatible({
      name: "custom",
      baseURL: config.baseURL,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });
    return {
      model: provider(config.modelName || "default"),
      providerType: "custom",
    };
  }

  return null;
}
