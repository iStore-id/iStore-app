import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Client-side environment variables (Vite)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let supabaseInstance: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (error) {
    console.error("[Supabase Client] Initialization error:", error);
  }
} else {
  // Graceful warning for preview environments prior to setting variables
  if (import.meta.env.DEV) {
    console.info("[Supabase Client] Running in deferred mode: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY not set yet.");
  }
}

export const supabase = supabaseInstance;
