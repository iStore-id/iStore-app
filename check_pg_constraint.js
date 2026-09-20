import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.rpc('get_constraint_definition', { conname: 'pricing_rules_priority_check' });
  
  if (error) {
    console.log("Error fetching constraint definition:", error);
  } else {
    console.log("Constraint definition:", data);
  }
}
check();
