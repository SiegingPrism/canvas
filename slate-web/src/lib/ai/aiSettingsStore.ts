import { create } from "zustand";

/**
 * AI settings. Slate's AI is online-only and powered by Google Gemini.
 *
 * Key resolution order:
 *  1. A personal key the user typed in AI Settings (stored on this device only)
 *  2. The app's built-in key from the build environment:
 *     VITE_GEMINI_API_KEY (plain) or VITE_GEMINI_API_KEY_B64 (base64) in .env
 *
 * No key is ever hardcoded in source code.
 */
interface AISettingsState {
  geminiKey: string;
  setGeminiKey: (k: string) => void;
  /** The key that will actually be used for requests ("" when none is configured). */
  getApiKey: () => string;
  /** True when the app ships with a built-in key from the build environment. */
  hasBuiltInKey: () => boolean;
}

const STORAGE_KEY = "slate_ai_settings_v2";
const LEGACY_STORAGE_KEY = "slate_ai_settings_v1";

function builtInKey(): string {
  try {
    const plain = (import.meta.env?.VITE_GEMINI_API_KEY as string | undefined)?.trim();
    if (plain) return plain;
  } catch {
    /* ignore */
  }
  return "";
}

function loadUserKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return String(JSON.parse(raw)?.geminiKey || "").trim();

    // One-time migration from the old settings format (keep only a personal key).
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const key = String(parsed?.geminiKey || "").trim();
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      if (key && key !== builtInKey()) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ geminiKey: key }));
        return key;
      }
    }
  } catch {
    /* ignore */
  }
  return "";
}

export const useAISettings = create<AISettingsState>((set, get) => ({
  geminiKey: loadUserKey(),
  setGeminiKey: (geminiKey) => {
    const clean = geminiKey.trim();
    set({ geminiKey: clean });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ geminiKey: clean }));
    } catch {
      /* ignore */
    }
  },
  getApiKey: () => get().geminiKey || builtInKey(),
  hasBuiltInKey: () => Boolean(builtInKey()),
}));
