
import { SupabaseCatalogRepository } from "./src/server/supabase/catalog-repository";
import dotenv from "dotenv";

dotenv.config();

async function test() {
  const repo = SupabaseCatalogRepository.getInstance();
  try {
    const variants = await repo.listVariantsByProduct("c67f7cb4-c333-4d18-8c55-6489fcf1e046", true);
    console.log("Number of variants:", variants.length);
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

test();
