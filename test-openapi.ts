import { supabaseAdmin } from "./src/server/supabase-admin";

async function main() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${url}/rest/v1/?apikey=${key}`);
  const spec = await res.json();
  const paths = Object.keys(spec.paths);
  const rpcs = paths.filter(p => p.startsWith('/rpc/'));
  rpcs.forEach(r => console.log(r));
}
main();
