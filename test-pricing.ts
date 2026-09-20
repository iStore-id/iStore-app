
import { DynamicCatalogService } from "./src/server/dynamic-catalog-service";
import { PricingService } from "./src/server/pricing-service";

async function main() {
  const service = DynamicCatalogService.getInstance();
  const pricingService = PricingService.getInstance();
  
  console.log("--- REAL DATA TEST (Integrated with PricingService) ---");
  const games = await service.getMergedGames(true);
  const targetGames = ["Mobile Legends", "Token PLN", "Free Fire"];
  
  for (const name of targetGames) {
    const game = games.find(g => g.name.toLowerCase().includes(name.toLowerCase()));
    if (game) {
      console.log(`\nGAME: ${game.name} (${game.slug})`);
      console.log(`- Min Price: ${game.minPrice}`);
      console.log(`- Max Price: ${game.maxPrice}`);
      
      const detail = await service.getMergedGameDetail(game.slug);
      if (detail?.products[0]) {
        const variants = await service.getMergedVariants(detail.products[0].id!);
        console.log(`- Variants found: ${variants.length}`);
        if (variants.length > 0) {
          // Find first virtual variant
          const virtual = variants.find(v => v.id.startsWith("virtual-variant-"));
          if (virtual) {
            console.log(`- Sample Virtual Variant: ${virtual.name}`);
            console.log(`  - SKU: ${virtual.sku}`);
            console.log(`  - Cost: ${virtual.pricing.baseCost}`);
            console.log(`  - Resolved Selling Price: ${virtual.pricing.sellingPrice}`);
            console.log(`  - Applied Rule: ${virtual.pricing.appliedRuleId || "None (Fallback to Cost)"}`);
          }
          
          // Find first manual variant if exists
          const manual = variants.find(v => !v.id.startsWith("virtual-variant-"));
          if (manual) {
            console.log(`- Sample Manual Variant: ${manual.name}`);
            console.log(`  - Selling Price: ${manual.pricing.sellingPrice}`);
          }
        }
      }
    }
  }
}

main();
