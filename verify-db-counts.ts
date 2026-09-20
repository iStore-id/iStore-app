
import { SupabaseCatalogRepository } from "./src/server/supabase/catalog-repository";
import dotenv from "dotenv";

dotenv.config();

async function test() {
  const repo = SupabaseCatalogRepository.getInstance();
  const products = [
    { name: "Mobile Legends", id: "c67f7cb4-c333-4d18-8c55-6489fcf1e046" },
    { name: "TikTok", id: "e0318310-87b5-4048-81c5-9a79fbe99d0f" },
    { name: "Honkai Star Rail", id: "9cddc4e8-7dc2-482c-8754-bb8e33d23e38" }
  ];

  for (const p of products) {
    try {
      const variants = await repo.listVariantsByProduct(p.id, true);
      console.log(`${p.name} Source Count: ${variants.length}`);
    } catch (error: any) {
      console.error(`Error for ${p.name}:`, error.message);
    }
  }
}

test();
