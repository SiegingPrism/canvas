import { create } from "zustand";
import type { User, Session } from "@supabase/supabase-js";
import { getSupabase } from "./client";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<User | null>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,

  signIn: async (email, password) => {
    const supabase = getSupabase();
    if (!supabase) return { error: new Error("Supabase is not configured") };
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) return { error };
      set({ user: data.user, session: data.session, loading: false });
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  },

  signUp: async (email, password) => {
    const supabase = getSupabase();
    if (!supabase) return { error: new Error("Supabase is not configured") };
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) return { error };
      set({ user: data.user, session: data.session, loading: false });
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  },

  signOut: async () => {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }
    set({ user: null, session: null, loading: false });
  },

  checkSession: async () => {
    const supabase = getSupabase();
    if (!supabase) {
      set({ user: null, session: null, loading: false, initialized: true });
      return null;
    }
    try {
      const { data } = await supabase.auth.getSession();
      set({
        user: data.session?.user ?? null,
        session: data.session,
        loading: false,
        initialized: true,
      });
      return data.session?.user ?? null;
    } catch {
      set({ user: null, session: null, loading: false, initialized: true });
      return null;
    }
  },
}));

if (typeof window !== "undefined") {
  const supabase = getSupabase();
  if (supabase) {
    supabase.auth.getSession().then(({ data }) => {
      useAuth.setState({
        user: data.session?.user ?? null,
        session: data.session,
        loading: false,
        initialized: true,
      });
    }).catch(() => {
      useAuth.setState({ user: null, session: null, loading: false, initialized: true });
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      useAuth.setState({
        user: session?.user ?? null,
        session,
        loading: false,
        initialized: true,
      });
    });
  } else {
    useAuth.setState({ user: null, session: null, loading: false, initialized: true });
  }
}
