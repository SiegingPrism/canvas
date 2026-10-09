import { create } from "zustand";

export type AIProvider = "gemini" | "openai" | "offline";

interface AISettingsState {
  provider: AIProvider;
  geminiKey: string;
  openAiKey: string;
  customBaseURL: string;
  forceOffline: boolean;
  setProvider: (p: AIProvider) => void;
  setGeminiKey: (k: string) => void;
  setOpenAiKey: (k: string) => void;
  setCustomBaseURL: (url: string) => void;
  setForceOffline: (offline: boolean) => void;
  getActiveKey: () => string;
}

const STORAGE_KEY = "slate_ai_settings_v1";

function decodeKey(b64: string): string {
  try {
    if (typeof atob === "function") return atob(b64);
    if (typeof Buffer !== "undefined") return Buffer.from(b64, "base64").toString("utf-8");
  } catch {
    /* ignore */
  }
  return "";
}

export const DEFAULT_GEMINI_API_KEY = decodeKey(
  "QVEuQWI4Uk42TFVfc05BNHNmcEg4d1pRRHZGcno2ZWlRak5xTm5YV01uTmExU3NlWjU0c3c="
);

function getEffectiveGeminiKey(): string {
  try {
    if (typeof import.meta !== "undefined") {
      if (import.meta.env?.VITE_GEMINI_API_KEY_B64) {
        return decodeKey(import.meta.env.VITE_GEMINI_API_KEY_B64);
      }
      if (import.meta.env?.VITE_GEMINI_API_KEY) {
        return import.meta.env.VITE_GEMINI_API_KEY;
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_GEMINI_API_KEY;
}

function loadSettings() {
  const defaultKey = getEffectiveGeminiKey();
  if (typeof window === "undefined") {
    return {
      provider: "gemini" as AIProvider,
      geminiKey: defaultKey,
      openAiKey: "",
      customBaseURL: "",
      forceOffline: false,
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        provider: parsed.provider || "gemini",
        geminiKey: parsed.geminiKey?.trim() ? parsed.geminiKey : defaultKey,
        openAiKey: parsed.openAiKey || "",
        customBaseURL: parsed.customBaseURL || "",
        forceOffline: Boolean(parsed.forceOffline),
      };
    }
  } catch {
    /* ignore */
  }
  return {
    provider: "gemini" as AIProvider,
    geminiKey: defaultKey,
    openAiKey: "",
    customBaseURL: "",
    forceOffline: false,
  };
}

function saveSettings(data: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export const useAISettings = create<AISettingsState>((set, get) => {
  const initial = loadSettings();
  return {
    ...initial,
    setProvider: (provider) => {
      set({ provider });
      saveSettings({ ...get(), provider });
    },
    setGeminiKey: (geminiKey) => {
      set({ geminiKey });
      saveSettings({ ...get(), geminiKey });
    },
    setOpenAiKey: (openAiKey) => {
      set({ openAiKey });
      saveSettings({ ...get(), openAiKey });
    },
    setCustomBaseURL: (customBaseURL) => {
      set({ customBaseURL });
      saveSettings({ ...get(), customBaseURL });
    },
    setForceOffline: (forceOffline) => {
      set({ forceOffline });
      saveSettings({ ...get(), forceOffline });
    },
    getActiveKey: () => {
      const state = get();
      if (state.forceOffline) return "";
      const defaultKey = getEffectiveGeminiKey();
      if (state.provider === "gemini") return state.geminiKey || defaultKey;
      if (state.provider === "openai") return state.openAiKey;
      return state.geminiKey || defaultKey || state.openAiKey;
    },
  };
});
