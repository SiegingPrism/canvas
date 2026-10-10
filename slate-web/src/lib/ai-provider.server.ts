import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export interface AIProviderConfig {
  apiKey?: string;
  provider?: "gemini" | "openai" | "custom";
  baseURL?: string;
  modelName?: string;
}

/**
 * Creates an AI model instance based on available keys and provider configuration.
 * Supports Google Gemini directly, OpenAI, or custom OpenAI-compatible endpoints.
 */
export function getAIModel(config: AIProviderConfig = {}) {
  const geminiKey =
    config.apiKey?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();

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
      model: provider(config.modelName || "gemini-3.5-flash"),
      providerType: "gemini",
    };
  }

  if (providerType === "openai" && openAiKey) {
    const isServerKey = !config.apiKey && Boolean(process.env.OPENAI_API_KEY);
    const ALLOWED_OPENAI_BASES = ["https://api.openai.com/v1", "https://api.openai.com"];
    let effectiveBaseURL = config.baseURL || "https://api.openai.com/v1";
    if (isServerKey && config.baseURL) {
      const normalized = config.baseURL.replace(/\/+$/, "");
      if (!ALLOWED_OPENAI_BASES.includes(normalized)) {
        console.warn(`Untrusted OpenAI baseURL rejected for server API key: ${config.baseURL}`);
        effectiveBaseURL = "https://api.openai.com/v1";
      }
    }

    const provider = createOpenAICompatible({
      name: "openai",
      baseURL: effectiveBaseURL,
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
