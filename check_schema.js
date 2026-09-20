import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_name", "pricing_rules");
  
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Columns:", data.map(c => c.column_name));
  }
}
check();
