import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-side environment variables (Never expose SUPABASE_SERVICE_ROLE_KEY to client)
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const isSupabaseAdminConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey);

let supabaseAdminInstance: SupabaseClient | null = null;

if (isSupabaseAdminConfigured) {
  try {
    supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log("[Supabase Admin] Initialized successfully with service_role privileges.");
  } catch (error) {
    console.error("[Supabase Admin] Initialization error:", error);
  }
} else {
  if (process.env.NODE_ENV !== "production") {
    console.info("[Supabase Admin] Deferred mode: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY not yet configured in server environment.");
  }
}

export const supabaseAdmin = supabaseAdminInstance;
