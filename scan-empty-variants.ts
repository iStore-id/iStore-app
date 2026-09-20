
import { SupabaseCatalogRepository } from "./src/server/supabase/catalog-repository";
import dotenv from "dotenv";

dotenv.config();

async function test() {
  const repo = SupabaseCatalogRepository.getInstance();
  try {
    const games = await repo.listGames();
    console.log(`Scanning ${games.length} games...`);
    for (const g of games) {
      const products = await repo.listProductsByGame(g.id);
      if (products.length === 0) {
        console.log(`Game: ${g.name} (${g.slug}) - NO PRODUCTS`);
        continue;
      }
      for (const p of products) {
        const variants = await repo.listVariantsByProduct(p.id, true);
        if (variants.length === 0) {
          console.log(`Product: ${p.name} (${p.slug}) in ${g.name} - 0 VARIANTS`);
        }
      }
    }
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

test();
