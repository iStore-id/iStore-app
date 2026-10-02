import { supabaseAdmin } from "./src/server/supabase-admin.js";

async function audit() {
  if (!supabaseAdmin) {
    console.error("Supabase Admin not configured");
    return;
  }
  
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, invoice, payment_status, transaction_status, snap_token, created_at, updated_at")
    .eq("payment_gateway_code", "ipaymu")
    .is("payment_url", null);

  if (error) {
    console.error("Error querying orders:", error);
    return;
  }

  const grouped = data?.reduce((acc: any, row: any) => {
    const key = `${row.payment_status}|${row.transaction_status}|${row.snap_token ? 'has_snap' : 'no_snap'}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({ grouped, total: data?.length, samples: data?.slice(0, 5) }));
}

audit();
