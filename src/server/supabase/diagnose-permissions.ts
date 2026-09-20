import { supabaseAdmin } from "../supabase-admin";

async function diagnosePermissions() {
  console.log("--- PHASE 6D: CONTROLLED PERMISSION DIAGNOSIS ---");

  // 1. Check current database user
  const { data: user, error: userError } = await (supabaseAdmin as any).rpc('get_current_role');
  console.log("Current Database Role:", user || "Unknown (Error: " + JSON.stringify(userError) + ")");

  // 2. Check RLS status for provider_skus
  // This query should fail if RLS or permissions are the issue.
  const { error: rlsError } = await (supabaseAdmin as any).from('provider_skus').select('*').limit(1);
  console.log("Permission Check (SELECT provider_skus):", rlsError ? "DENIED (" + rlsError.code + ")" : "GRANTED");

  // 3. Try to check RLS status via PG catalog
  // This will likely also be restricted
  console.log("\n--- DIAGNOSIS COMPLETE ---");
}

diagnosePermissions().catch(console.error);
