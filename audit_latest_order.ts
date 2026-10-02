import { supabaseAdmin } from "./src/server/supabase-admin.js";

async function audit() {
  if (!supabaseAdmin) {
    console.error("Supabase Admin not configured");
    return;
  }
  
  // Ambil transaksi iPaymu terbaru
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, invoice, payment_gateway_code, payment_status, transaction_status, payment_url, snap_token, created_at, updated_at")
    .eq("payment_gateway_code", "ipaymu")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error querying latest order:", error);
    return;
  }

  console.log(JSON.stringify(data?.[0] || null));
}

audit();
