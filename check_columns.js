import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from("pricing_rules")
    .select("*")
    .limit(1);
  
  if (error) {
    console.log("Error details:", error);
  } else {
    if (data && data.length > 0) {
      console.log("Columns:", Object.keys(data[0]));
    } else {
      console.log("Table empty, checking schema...");
      // fallback to metadata check
      const { data: meta, error: metaError } = await supabase.rpc('get_columns', { table_name: 'pricing_rules' });
      if (metaError) console.log("Meta check error:", metaError);
      else console.log("Columns (meta):", meta);
    }
  }
}
check();
