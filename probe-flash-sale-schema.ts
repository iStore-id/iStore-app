
import { supabaseAdmin } from "./src/server/supabase-admin";
import dotenv from "dotenv";

dotenv.config();

async function probe() {
  console.log("Probing flash_sales table...");

  // 1. Get a real product ID
  const { data: products } = await supabaseAdmin.from('products').select('id').limit(1);
  const realProductId = products?.[0]?.id;
  console.log("Real Product ID:", realProductId);

  // 2. Get a real variant ID
  const { data: variants } = await supabaseAdmin.from('product_variants').select('id, product_id').limit(1);
  const realVariantId = variants?.[0]?.id;
  const associatedProductId = variants?.[0]?.product_id;
  console.log("Real Variant ID:", realVariantId, "associated with Product:", associatedProductId);

  // 3. Try a dry run insert with real IDs to see if it works (but we don't want to actually insert)
  // Actually, I can use a transaction or just rollback if I had a raw client, 
  // but with supabase I'll just try an ID that doesn't exist to see the error message detail.

  const fakeUuid = "00000000-0000-0000-0000-000000000000";
  
  console.log("\nAttempting insert with non-existent UUIDs to see FK error...");
  const { error: err1 } = await supabaseAdmin.from('flash_sales').insert({
    name: "Probe Test",
    product_id: associatedProductId || realProductId,
    variant_id: fakeUuid,
    sale_price: 1000,
    start_at: new Date().toISOString(),
    end_at: new Date().toISOString(),
    status: "inactive"
  });
  
  if (err1) console.log("Insert Variant Fake Error:", err1.message);

  const { error: err2 } = await supabaseAdmin.from('flash_sales').insert({
    name: "Probe Test",
    product_id: fakeUuid,
    variant_id: realVariantId,
    sale_price: 1000,
    start_at: new Date().toISOString(),
    end_at: new Date().toISOString(),
    status: "inactive"
  });

  if (err2) console.log("Insert Product Fake Error:", err2.message);

  // 4. Try virtual ID format
  console.log("\nAttempting insert with virtual-variant- format...");
  const { error: err3 } = await supabaseAdmin.from('flash_sales').insert({
    name: "Probe Test",
    product_id: realProductId,
    variant_id: "virtual-variant-some-id",
    sale_price: 1000,
    start_at: new Date().toISOString(),
    end_at: new Date().toISOString(),
    status: "inactive"
  });

  if (err3) console.log("Insert Virtual Variant Error:", err3.message);
}

probe();
