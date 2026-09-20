import "dotenv/config";
import { v4 as uuidv4 } from "uuid";
import { supabaseAdmin } from "./src/server/supabase-admin";
import { CatalogService } from "./src/server/catalog-service";
import { SupabaseCatalogRepository } from "./src/server/supabase/catalog-repository";
import { ProviderMappingService } from "./src/server/provider-mapping-service";
import { SupabaseProviderRepository } from "./src/server/supabase/provider-repository";
import { getPublicGameDetail, getPublicVariants } from "./src/server/public-catalog-api";
import { OWNER_EMAIL } from "./src/server/auth-service";

async function runOwnerE2EWorkflow() {
  console.log("=================================================");
  console.log("STARTING OWNER SELF-SERVICE CATALOG E2E WORKFLOW");
  console.log("=================================================");

  const actor = {
    uid: "owner_e2e_test_user",
    email: OWNER_EMAIL
  };

  const catalogService = CatalogService.getInstance();
  const catalogRepo = SupabaseCatalogRepository.getInstance();
  const mappingService = ProviderMappingService.getInstance();

  if (!supabaseAdmin) {
    throw new Error("Supabase Admin is not initialized.");
  }

  // 1. Ensure Game exists or create Game "Free Fire"
  console.log("\n[STEP 1] Checking/Creating Game 'Free Fire'...");
  let game = await catalogRepo.getGameBySlug("free-fire");
  if (!game) {
    const gameId = uuidv4();
    await catalogRepo.upsertGame({
      id: gameId,
      name: "Free Fire",
      slug: "free-fire",
      image: "https://images.unsplash.com/photo-1542751371-adc38448a05e",
      status: "active",
      availability: "available",
      sortOrder: 1
    });
    game = await catalogRepo.getGameBySlug("free-fire");
    console.log("- Created Game 'Free Fire' (ID:", gameId, ")");
  } else {
    console.log("- Game 'Free Fire' already exists (ID:", game?.id, ")");
  }

  // 2. Owner creates Product "Free Fire Diamonds" via Catalog Management
  console.log("\n[STEP 2] Owner Creates Product 'Free Fire'...");
  const productSlug = "free-fire-diamonds";
  let product = await catalogRepo.getProductBySlug(productSlug);
  if (!product) {
    product = await catalogService.createProduct({
      gameId: game!.id,
      name: "Free Fire Diamonds",
      slug: productSlug,
      description: "Topup Diamond Free Fire Murah & Cepat",
      type: "game_currency",
      status: "active",
      availability: "available",
      sortOrder: 1
    }, actor.uid);
    console.log("- Owner Created Product successfully (ID:", product.id, ")");
  } else {
    console.log("- Product already exists (ID:", product.id, ")");
  }

  // 3. Owner creates Variant "10 Diamond Free Fire"
  console.log("\n[STEP 3] Owner Creates Variant '10 Diamond Free Fire'...");
  const variantSku = "FF-10-DIA";
  await supabaseAdmin
    .from("product_variants")
    .delete()
    .eq("sku", variantSku);

  let variant = await catalogService.createVariant({
    productId: product.id,
    name: "10 Diamonds",
    displayName: "10 Diamond Free Fire",
    sku: variantSku,
    status: "active",
    availability: "available",
    sortOrder: 1,
    pricing: {
      baseCost: 1500,
      sellingPrice: 2000,
      currency: "IDR",
      pricingMethod: "fixed"
    }
  } as any, actor.uid);
  console.log("- Owner Created Variant '10 Diamond Free Fire' (ID:", variant.id, ")");

  // 4. Verify Pricing & Status Activation
  console.log("\n[STEP 4] Verifying Variant Pricing & Active Status...");
  console.log(`  - Base Cost: Rp ${variant.pricing.baseCost.toLocaleString()}`);
  console.log(`  - Selling Price: Rp ${variant.pricing.sellingPrice.toLocaleString()}`);
  console.log(`  - Margin: Rp ${variant.pricing.margin?.toLocaleString()}`);
  console.log(`  - Margin %: ${variant.pricing.marginPercentage}%`);
  console.log(`  - Status: ${variant.status}`);
  console.log(`  - Availability: ${variant.availability}`);
  if (variant.status !== "active" || variant.availability !== "available") {
    throw new Error("Variant is not active or available!");
  }
  if (variant.pricing.baseCost !== 1500 || variant.pricing.sellingPrice !== 2000 || variant.pricing.margin !== 500) {
    throw new Error(`Pricing calculation incorrect! BaseCost: ${variant.pricing.baseCost}, SellingPrice: ${variant.pricing.sellingPrice}, Margin: ${variant.pricing.margin}`);
  }

  // 5. Catalog Discovery Check for Provider SKU "FF10"
  console.log("\n[STEP 5] Discovering Provider SKU 'FF10' for TokoVoucher...");
  const { data: providerSkuRow } = await supabaseAdmin
    .from("provider_skus")
    .select("*")
    .eq("provider_id", "tokovoucher")
    .eq("provider_sku", "FF10")
    .maybeSingle();

  if (!providerSkuRow) {
    throw new Error("Provider SKU 'FF10' for TokoVoucher not found in provider_skus table!");
  }
  console.log("- Found Provider SKU 'FF10':", providerSkuRow.name, "(Base Cost: Rp", providerSkuRow.base_cost, ")");

  // 6. Owner Performs Manual Mapping (Hubungkan Varian Manual)
  console.log("\n[STEP 6] Owner Linking 'FF10' → Variant '10 Diamond Free Fire'...");
  // Clean up any existing mapping for this provider SKU to make test idempotent
  await supabaseAdmin
    .from("provider_mappings")
    .delete()
    .eq("provider_sku_id", providerSkuRow.id);

  const mappingId = await mappingService.mapSku(providerSkuRow.id, variant.id, actor);
  console.log("- Owner Successfully Linked Variant (Mapping ID:", mappingId, ")");

  // 7. Owner Approves Mapping & Verifies Routing Eligibility
  console.log("\n[STEP 7] Owner Approves Mapping & Verifying Routing Eligibility...");
  await mappingService.approveMapping(mappingId, actor);
  console.log("- Owner Approved Mapping (ID:", mappingId, ")");

  const approvedMapping = await mappingService.getMapping(mappingId);
  if (!approvedMapping || approvedMapping.status !== "APPROVED" || !approvedMapping.routingEligibility) {
    throw new Error("Mapping FF10 is NOT approved or routing ineligible!");
  }
  console.log("- ROUTING ELIGIBLE: Confirmed Mapping is APPROVED and routing_eligibility = true.");

  // 7.5. Invoke Actual Routing Resolver
  console.log("\n[STEP 7.5] Invoking Actual Routing Resolver (resolveRoutingDecision)...");
  const routingDecision = await SupabaseProviderRepository.getInstance().resolveRoutingDecision(variant.id);
  console.log("  - Routing Decision:", routingDecision);
  if (!routingDecision || routingDecision.selectedProviderId !== "tokovoucher" || routingDecision.selectedProviderSku !== "FF10") {
    throw new Error(`Routing decision failed to route to TokoVoucher/FF10! Result: ${JSON.stringify(routingDecision)}`);
  }
  console.log("- ROUTING ENGINE PASS: Successfully routed to TokoVoucher (SKU: FF10).");

  // 8. Public Storefront Visibility Check
  console.log("\n[STEP 8] Checking Storefront Visibility...");
  const publicGame = await catalogRepo.getGameBySlug("free-fire");
  if (!publicGame || publicGame.status !== "active") {
    throw new Error("Game 'free-fire' is not active or visible on public storefront!");
  }
  const publicVariants = await catalogRepo.listVariantsByProduct(product.id, true);
  const publicVariant = publicVariants.find(v => v.id === variant.id);

  if (!publicVariant || publicVariant.status !== "active") {
    throw new Error("Variant '10 Diamond Free Fire' is NOT active or visible on public storefront!");
  }
  console.log("- STOREFRONT VISIBLE: Product and Variant appear on storefront with price Rp", publicVariant.pricing.sellingPrice);

  // 9. Integrity Verification
  console.log("\n[STEP 9] Checking System Integrity...");
  const { count: skuCount } = await supabaseAdmin
    .from("provider_skus")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", "tokovoucher")
    .eq("provider_sku", "FF10");

  const { count: mappingCount } = await supabaseAdmin
    .from("provider_mappings")
    .select("id", { count: "exact", head: true })
    .eq("variant_id", variant.id)
    .eq("provider_sku", "FF10")
    .eq("status", "APPROVED");

  console.log(`  - Provider SKU 'FF10' Count: ${skuCount} (Expect: 1)`);
  console.log(`  - Approved Mapping Count for FF10: ${mappingCount} (Expect: 1)`);

  if (skuCount !== 1) throw new Error("Duplicate provider SKU detected!");
  if (mappingCount !== 1) throw new Error("Duplicate approved mapping detected!");

  console.log("\n=================================================");
  console.log("OWNER SELF-SERVICE CATALOG E2E WORKFLOW: VERIFIED PASS");
  console.log("=================================================");
}

runOwnerE2EWorkflow().catch((err) => {
  console.error("\n❌ E2E WORKFLOW FAILED:", err.message);
  process.exit(1);
});
