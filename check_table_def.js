import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from("information_schema.check_constraints")
    .select("constraint_name, check_clause")
    .eq("table_name", "pricing_rules");
  
  if (error) {
    console.log("Error fetching check constraints:", error);
  } else {
    console.log("Check constraints:", data);
  }
}
check();
