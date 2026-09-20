import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Dummy PricingService.calculatePrice logic for audit purposes
function calculatePrice(cost, method, value) {
  let sellingPrice = 0;
  switch (method) {
    case 'fixed': sellingPrice = value; break;
    case 'markup_percentage': sellingPrice = cost * (1 + (value / 100)); break;
    default: sellingPrice = value;
  }
  return Math.round(sellingPrice);
}

async function audit() {
  // 1. Get 3 active static variants
  const { data: staticVariants, error: svError } = await supabase
    .from("product_variants")
    .select("*, products(*)")
    .eq("status", "active")
    .limit(3);

  // 2. Get 3 provider skus (virtual)
  const { data: virtualVariants, error: vvError } = await supabase
    .from("provider_skus")
    .select("*")
    .limit(3);

  // 3. Get all active global rules
  const { data: rules } = await supabase
    .from("pricing_rules")
    .select("*")
    .eq("scope", "global")
    .eq("status", "active");

  const globalRule = rules?.find(r => r.name === "Global 2.5 margin");

  console.log("Audit Results:");
  
  // Audit Static
  for (const v of staticVariants || []) {
    const cost = v.base_cost || 0;
    const rule = globalRule; // Simplified check
    const effectivePrice = calculatePrice(cost, 'markup_percentage', 2.5);
    
    console.log({
      source: "STATIC",
      name: v.products?.name || "Unknown",
      variant: v.name,
      baseCost: cost,
      oldPrice: v.selling_price,
      appliedRule: rule ? rule.name : "None",
      effectivePrice: effectivePrice,
      isApplied: v.selling_price === effectivePrice ? "YES" : "NO" // Simple check
    });
  }

  // Audit Virtual (provider_skus)
  for (const v of virtualVariants || []) {
    const cost = v.base_price || 0;
    const rule = globalRule;
    const effectivePrice = calculatePrice(cost, 'markup_percentage', 2.5);
    
    console.log({
      source: "VIRTUAL",
      name: v.name,
      variant: v.sku,
      baseCost: cost,
      oldPrice: v.selling_price,
      appliedRule: rule ? rule.name : "None",
      effectivePrice: effectivePrice,
      isApplied: v.selling_price === effectivePrice ? "YES" : "NO"
    });
  }
}
audit();
