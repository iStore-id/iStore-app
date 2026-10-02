import { supabaseAdmin } from "./src/server/supabase-admin.js";

async function audit() {
  if (!supabaseAdmin) {
    console.error("Supabase Admin not configured");
    return;
  }
  
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, invoice, payment_gateway_code, payment_url, created_at")
    .eq("payment_gateway_code", "ipaymu");

  if (error) {
    console.error("Error querying orders:", error);
    return;
  }

  let httpsCount = 0;
  let base64Count = 0;
  let otherCount = 0;
  let nullCount = 0;

  for (const row of data || []) {
    const url = row.payment_url;
    if (!url) {
      nullCount++;
    } else if (url.startsWith("https://")) {
      httpsCount++;
    } else if (url.startsWith("data:image/") || url.includes("base64")) { 
      base64Count++;
    } else {
      otherCount++;
    }
  }

  console.log(JSON.stringify({ httpsCount, base64Count, otherCount, nullCount, total: data?.length }));
}

audit();
