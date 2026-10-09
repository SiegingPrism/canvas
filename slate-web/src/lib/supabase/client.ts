import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_SUPABASE_URL = "https://ksjcuwkvxisiaubljbtj.supabase.co";
export const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzamN1d2t2eGlzaWF1YmxqYnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MDc3NTQsImV4cCI6MjEwNzA4Mzc1NH0.R2JEGRm4bP7abfOS5RdlYvOeZmokEW8LjBwKkUkxRrA";

const supabaseUrl =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== "undefined" && process.env?.SUPABASE_URL) ||
  DEFAULT_SUPABASE_URL;

const supabaseAnonKey =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== "undefined" && process.env?.SUPABASE_ANON_KEY) ||
  DEFAULT_SUPABASE_ANON_KEY;

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const url = (supabaseUrl || DEFAULT_SUPABASE_URL).trim();
  const key = (supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY).trim();

  if (!url || !key) {
    return null;
  }

  supabaseInstance = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return supabaseInstance;
}

export const isSupabaseConfigured = (): boolean => {
  return true;
};
