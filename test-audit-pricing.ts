import { supabaseAdmin } from "./src/server/supabase-admin";

async function main() {
  const [skus, games, prods, vars, maps, rules] = await Promise.all([
    supabaseAdmin!.from("provider_skus").select("id", { count: 'exact', head: true }),
    supabaseAdmin!.from("games").select("id", { count: 'exact', head: true }),
    supabaseAdmin!.from("products").select("id", { count: 'exact', head: true }),
    supabaseAdmin!.from("product_variants").select("id", { count: 'exact', head: true }),
    supabaseAdmin!.from("provider_mappings").select("id", { count: 'exact', head: true }),
    supabaseAdmin!.from("pricing_rules").select("*")
  ]);

  console.log("=== DB COUNTS ===");
  console.log("provider_skus:", skus.count);
  console.log("games:", games.count);
  console.log("products:", prods.count);
  console.log("product_variants:", vars.count);
  console.log("provider_mappings:", maps.count);
  console.log("pricing_rules count:", rules.data?.length);

  console.log("\n=== PRICING RULES ===");
  console.log(JSON.stringify(rules.data, null, 2));
}
main().catch(console.error);
