
import { SupabaseCatalogRepository } from "./src/server/supabase/catalog-repository";
import dotenv from "dotenv";

dotenv.config();

async function test() {
  const repo = SupabaseCatalogRepository.getInstance();
  try {
    const variants = await repo.listVariantsByProduct("c67f7cb4-c333-4d18-8c55-6489fcf1e046", true);
    console.log("DB Variants (First 3):");
    variants.slice(0, 3).forEach(v => {
      console.log(`- ID: ${v.id}, SKU: ${v.sku}, Price: ${v.pricing?.sellingPrice}`);
    });
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

test();
