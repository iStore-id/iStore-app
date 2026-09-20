import "dotenv/config";
import { SupabaseCatalogRepository } from "./src/server/supabase/catalog-repository";
import { SupabaseProviderRepository } from "./src/server/supabase/provider-repository";
import { ProviderMappingService } from "./src/server/provider-mapping-service";
import { supabaseAdmin } from "./src/server/supabase-admin";
import { v4 as uuidv4 } from "uuid";

async function runE2ETest() {
  console.log("==================================================");
  console.log("   TOKOVOUCHER LIMITED END-TO-END MAPPING TEST   ");
  console.log("==================================================");

  if (!supabaseAdmin) {
    console.error("Supabase Admin is not configured.");
    return;
  }

  const catalogRepo = SupabaseCatalogRepository.getInstance();
  const providerRepo = SupabaseProviderRepository.getInstance();
  const mappingService = ProviderMappingService.getInstance();

  const actor = { uid: "test-admin-uid", email: "admin@istore.id" };

  try {
    // --------------------------------------------------
    // TAHAP 1 — PRODUCT & VARIANT PROVISIONING/SELECTION
    // --------------------------------------------------
    console.log("\n>>> [TAHAP 1] Checking existing Catalog for Category, Game, Product, and Variant...");

    // Find or create Category "Topup Game"
    let category = await catalogRepo.getCategoryBySlug("topup-game");
    if (!category) {
      console.log("- Creating Category 'Topup Game'...");
      const catId = uuidv4();
      await catalogRepo.upsertCategory({
        id: catId,
        name: "Topup Game",
        slug: "topup-game",
        status: "active",
        sortOrder: 1,
      });
      category = await catalogRepo.getCategory(catId);
    }
    console.log(`- Category: ${category?.name} (ID: ${category?.id})`);

    // Find or create Game "Free Fire"
    let game = await catalogRepo.getGameBySlug("free-fire");
    if (!game) {
      console.log("- Creating Game 'Free Fire'...");
      const gameId = uuidv4();
      await catalogRepo.upsertGame({
        id: gameId,
        name: "Free Fire",
        slug: "free-fire",
        image: "https://placehold.co/600x400",
        status: "active",
        availability: "available",
        sortOrder: 1,
        categoryIds: [category!.id],
      });
      game = await catalogRepo.getGame(gameId);
    }
    console.log(`- Game: ${game?.name} (ID: ${game?.id})`);

    // Find or create Product "Free Fire Diamonds"
    let product = await catalogRepo.getProductBySlug("free-fire-diamonds");
    if (!product) {
      console.log("- Creating Product 'Free Fire Diamonds'...");
      const prodId = uuidv4();
      await catalogRepo.upsertProduct({
        id: prodId,
        gameId: game!.id,
        name: "Free Fire Diamonds",
        slug: "free-fire-diamonds",
        status: "active",
        availability: "available",
        sortOrder: 1,
      });
      product = await catalogRepo.getProduct(prodId);
    }
    console.log(`- Product: ${product?.name} (ID: ${product?.id})`);

    // Find or create Variant "100 Diamonds"
    let variant = await catalogRepo.getVariantBySku("FF-DIAMOND-100");
    if (!variant) {
      console.log("- Creating Variant 'FF-DIAMOND-100'...");
      const varId = uuidv4();
      await catalogRepo.upsertVariant({
        id: varId,
        productId: product!.id,
        name: "100 Diamonds",
        displayName: "100 Diamonds",
        sku: "FF-DIAMOND-100",
        status: "active",
        availability: "available",
        sortOrder: 1,
        pricing: {
          baseCost: 12000,
          sellingPrice: 15000,
          currency: "IDR",
          margin: 3000,
          marginPercentage: 25,
          pricingMethod: "fixed",
          status: "active",
        },
      });
      variant = await catalogRepo.getVariant(varId);
    }
    console.log(`- Variant: ${variant?.name} (ID: ${variant?.id}, SKU: ${variant?.sku}, Selling Price: Rp ${variant?.pricing.sellingPrice})`);

    // --------------------------------------------------
    // TAHAP 2 — PROVIDER SKU (FF100)
    // --------------------------------------------------
    console.log("\n>>> [TAHAP 2] Finding existing Provider SKU for TokoVoucher (FF100)...");
    
    // Ensure TokoVoucher is registered as an active provider in the 'providers' table
    let providerObj = await providerRepo.getProvider("tokovoucher");
    if (!providerObj) {
      console.log("- Registering TokoVoucher provider in 'providers' table...");
      await supabaseAdmin.from("providers").insert({
        id: "tokovoucher",
        code: "tokovoucher",
        name: "TokoVoucher",
        status: "active",
        health_state: "active",
        priority: 10,
        settings: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      providerObj = await providerRepo.getProvider("tokovoucher");
    } else if (providerObj.status !== "active") {
      console.log("- Activating TokoVoucher provider...");
      await supabaseAdmin.from("providers").update({ status: "active" }).eq("id", "tokovoucher");
      providerObj = await providerRepo.getProvider("tokovoucher");
    }
    console.log(`- Provider: ${providerObj?.name} (Status: ${providerObj?.status})`);

    const skus = await providerRepo.listProviderSkus("tokovoucher");
    const skuFF100 = skus.find(s => s.providerSku === "FF100");

    if (!skuFF100) {
      console.error("FAIL: TokoVoucher SKU FF100 was not found in provider_skus! Run the discovery first.");
      return;
    }
    console.log(`- Found Provider SKU: ${skuFF100.name} (Code: ${skuFF100.providerSku}, UUID: ${skuFF100.id}, Base Cost: Rp ${skuFF100.metadata?.baseCost})`);

    // --------------------------------------------------
    // TAHAP 3 — EXISTING MAPPING CREATION
    // --------------------------------------------------
    console.log("\n>>> [TAHAP 3] Creating Provider Mapping for FF100 -> Free Fire Variant...");

    // Check if there are any existing mappings for this SKU to clean up before mapping
    const existingMap = await supabaseAdmin
      .from("provider_mappings")
      .select("*")
      .eq("provider_sku_id", skuFF100.id);

    if (existingMap.data && existingMap.data.length > 0) {
      console.log(`- Cleaning up ${existingMap.data.length} existing mapping(s) for a clean test run.`);
      await supabaseAdmin.from("provider_mappings").delete().eq("provider_sku_id", skuFF100.id);
    }

    // Map using service
    const mappingId = await mappingService.mapSku(skuFF100.id, variant!.id, actor);
    console.log(`- Mapping created with ID: ${mappingId}`);

    let mapping = await mappingService.getMapping(mappingId);
    console.log(`- Initial Mapping status: ${mapping?.status}`);
    console.log(`- Initial Routing eligibility: ${mapping?.routingEligibility}`);

    // --------------------------------------------------
    // TAHAP 4 — APPROVAL & ELIGIBILITY
    // --------------------------------------------------
    console.log("\n>>> [TAHAP 4] Approving Mapping and activating Routing Eligibility...");
    
    // In order for Routing Decision to succeed, mapping needs:
    // 1. Status = 'APPROVED'
    // 2. routingEligibility = true
    
    // First, approve the mapping
    await mappingService.approveMapping(mappingId, actor);
    
    // Update routing eligibility to true (since mapSku creates it as false)
    await providerRepo.upsertMapping({
      ...mapping!,
      status: "APPROVED",
      routingEligibility: true,
    } as any);

    mapping = await mappingService.getMapping(mappingId);
    console.log(`- Updated Mapping status: ${mapping?.status}`);
    console.log(`- Updated Routing eligibility: ${mapping?.routingEligibility}`);

    // --------------------------------------------------
    // TAHAP 5 — DETERMINISTIC ROUTING
    // --------------------------------------------------
    console.log("\n>>> [TAHAP 5] Resolving Routing Decision for Free Fire Variant...");
    const decision = await providerRepo.resolveRoutingDecision(variant!.id);
    console.log("- Routing Engine Result:");
    console.log(JSON.stringify(decision, null, 2));

    const isRoutingCorrect = 
      decision.code === "SUCCESS" && 
      decision.selectedProviderId === "tokovoucher" &&
      decision.selectedProviderSku === "FF100";

    console.log(`- Routing check: ${isRoutingCorrect ? "PASS" : "FAIL"}`);

    // --------------------------------------------------
    // TAHAP 6 — DUPLICATE SAFETY (Uniqueness constraints)
    // --------------------------------------------------
    console.log("\n>>> [TAHAP 6] Testing duplicate APPROVED mapping prevention...");
    
    let duplicatePrevented = false;
    try {
      // Try to create a second approved mapping for the same provider SKU (FF100)
      // This should fail because of unique constraint checks
      await mappingService.createMapping({
        productId: product!.id,
        variantId: variant!.id,
        sku: variant!.sku,
        providerId: "tokovoucher",
        providerSkuId: skuFF100.id,
        providerSku: "FF100",
        status: "APPROVED",
        priority: 2,
        routingEligibility: true,
        metadata: {},
        notes: "Attempted duplicate approved mapping",
        updatedBy: actor.uid,
      }, actor);
    } catch (err: any) {
      console.log(`- Duplicate creation successfully BLOCKED with expected error: "${err.message}"`);
      duplicatePrevented = true;
    }

    // --------------------------------------------------
    // TAHAP 7 — DATA INTEGRITY
    // --------------------------------------------------
    console.log("\n>>> [TAHAP 7] Performing final Data Integrity checks...");

    // Ensure no duplicates in products/variants/skus
    const { count: productCount } = await supabaseAdmin
      .from("products")
      .select("id", { count: "exact" })
      .eq("slug", "free-fire-diamonds");

    const { count: variantCount } = await supabaseAdmin
      .from("product_variants")
      .select("id", { count: "exact" })
      .eq("sku", "FF-DIAMOND-100");

    const { count: approvedMappingCount } = await supabaseAdmin
      .from("provider_mappings")
      .select("id", { count: "exact" })
      .eq("provider_sku_id", skuFF100.id)
      .eq("status", "APPROVED");

    // Re-verify that variant prices weren't overwritten
    const freshVariant = await catalogRepo.getVariant(variant!.id);
    const pricesUntouched = 
      freshVariant?.pricing.sellingPrice === 15000 &&
      skuFF100.metadata?.baseCost === 13557;

    const isProductUnique = productCount === 1;
    const isVariantUnique = variantCount === 1;
    const isApprovedMappingUnique = approvedMappingCount === 1;

    console.log(`- Product Unique (count === 1): ${isProductUnique ? "PASS" : "FAIL"} (Count: ${productCount})`);
    console.log(`- Variant Unique (count === 1): ${isVariantUnique ? "PASS" : "FAIL"} (Count: ${variantCount})`);
    console.log(`- Approved Mapping Unique (count === 1): ${isApprovedMappingUnique ? "PASS" : "FAIL"} (Count: ${approvedMappingCount})`);
    console.log(`- Duplicate Mapping Blocked: ${duplicatePrevented ? "PASS" : "FAIL"}`);
    console.log(`- Selling Price Untouched (remains 15000): ${freshVariant?.pricing.sellingPrice === 15000 ? "PASS" : "FAIL"}`);
    console.log(`- Base Cost Preserved in SKU (remains 13557): ${skuFF100.metadata?.baseCost === 13557 ? "PASS" : "FAIL"}`);

    const isAllPass = 
      isRoutingCorrect && 
      duplicatePrevented && 
      isProductUnique && 
      isVariantUnique && 
      isApprovedMappingUnique && 
      pricesUntouched;

    console.log("\n==================================================");
    if (isAllPass) {
      console.log("   E2E MAPPING VERIFICATION: ALL TESTS PASS   ");
    } else {
      console.log("   E2E MAPPING VERIFICATION: FAILURE DETECTED ");
    }
    console.log("==================================================");

  } catch (error: any) {
    console.error("\nE2E Mapping Test encountered an unexpected error:", error);
  }
}

runE2ETest();
