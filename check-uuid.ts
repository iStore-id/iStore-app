
import { supabaseAdmin } from "./src/server/supabase-admin";
import dotenv from "dotenv";

dotenv.config();

async function checkUuid() {
  console.log("Checking if product_id is UUID type...");
  const { error } = await supabaseAdmin.from('flash_sales').insert({
    name: "UUID Check",
    product_id: "not-a-uuid",
    variant_id: "73f06c77-7dd3-5984-b35f-1a6ab1191b9f", // valid variant
    sale_price: 1000,
    start_at: new Date().toISOString(),
    end_at: new Date().toISOString()
  });
  
  if (error) {
    console.log("Error Message:", error.message);
    console.log("Error Code:", error.code);
  }
}

checkUuid();
