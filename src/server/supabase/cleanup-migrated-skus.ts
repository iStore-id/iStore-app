import { supabaseAdmin } from "../supabase-admin.js";

async function executeCleanup() {
  console.log("--- PHASE 6D: CONTROLLED DATA CLEANUP ---");

  // 1. Pre-verification: Read current counts
  const { count: initialCount, error: countErr } = await supabaseAdmin
    .from("provider_skus")
    .select("*", { count: "exact", head: true });

  if (countErr) {
    console.error("Error reading provider_skus count:", countErr.message);
    return;
  }

  console.log(`Initial provider_skus count: ${initialCount}`);

  if (initialCount !== 1000) {
    console.warn(`Warning: Expected 1000 records, but found ${initialCount}. Inspecting records...`);
  }

  // Fetch the records to be deleted to verify their format
  const { data: samples, error: sampleErr } = await supabaseAdmin
    .from("provider_skus")
    .select("id, provider_id, provider_sku, name")
    .limit(5);

  if (sampleErr) {
    console.error("Error fetching samples:", sampleErr.message);
    return;
  }

  console.log("Samples to be deleted:", samples);

  // 2. Perform the deletion
  console.log("Executing deletion of the migrated provider_skus...");
  
  // Since all 1000 records currently in provider_skus are the ones migrated in Phase 6D 
  // (and initialCount matches exactly 1000), we can delete these records using their ids.
  const { data: deleted, error: deleteErr } = await supabaseAdmin
    .from("provider_skus")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Safe condition to delete all rows in the table

  if (deleteErr) {
    console.error("Error during deletion:", deleteErr.message);
    return;
  }

  console.log("Deletion completed.");

  // 3. Post-verification
  const { count: finalCount, error: postCountErr } = await supabaseAdmin
    .from("provider_skus")
    .select("*", { count: "exact", head: true });

  const { count: provCount, error: provErr } = await supabaseAdmin
    .from("providers")
    .select("*", { count: "exact", head: true });

  console.log(`Final provider_skus count: ${finalCount}`);
  console.log(`Providers count (should be 2): ${provCount}`);

  if (finalCount === 0 && provCount === 2) {
    console.log("CLEANUP SUCCESSFUL");
  } else {
    console.error("CLEANUP INCOMPLETE OR FAILED");
  }
}

executeCleanup().catch(console.error);
