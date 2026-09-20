import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from("pricing_rules")
    .select("priority")
    .limit(10);
  
  if (error) {
    console.log("Error fetching priority values:", error);
  } else {
    console.log("Sample priorities:", data.map(r => r.priority));
  }
}
check();
