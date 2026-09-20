import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.rpc('get_table_constraints', { table_name: 'pricing_rules' });
  
  if (error) {
    console.log("Error fetching constraints:", error);
  } else {
    console.log("Constraints:", data);
  }
}
check();
