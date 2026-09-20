
import { supabaseAdmin } from "./src/server/supabase-admin";
import dotenv from "dotenv";

dotenv.config();

async function checkFKs() {
  // Query to find all foreign keys for flash_sales table
  const sql = `
    SELECT
        conname AS constraint_name,
        conrelid::regclass AS table_name,
        a.attname AS column_name,
        confrelid::regclass AS foreign_table_name,
        af.attname AS foreign_column_name
    FROM
        pg_constraint AS c
        JOIN pg_attribute AS a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
        JOIN pg_attribute AS af ON af.attnum = ANY(c.confkey) AND af.attrelid = c.confrelid
    WHERE
        c.contype = 'f' AND c.conrelid = 'flash_sales'::regclass;
  `;

  // We can use RPC if there's a helper, or try to get column info via API and guess.
  // Since we can't run raw SQL easily, let's try to fetch a single record from flash_sales (if exists) 
  // or products and compare ID formats.
  
  console.log("Checking products table...");
  const { data: products } = await supabaseAdmin.from('products').select('id').limit(1);
  console.log("Product ID example:", products?.[0]?.id);

  console.log("Checking product_variants table...");
  const { data: variants } = await supabaseAdmin.from('product_variants').select('id').limit(1);
  console.log("Variant ID example:", variants?.[0]?.id);

  // Let's try to get table definition if possible
  // Using an RPC that might exist in common Supabase setups
  const { data: schema, error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.log("RPC exec_sql not found or failed:", error.message);
  } else {
    console.log("FK Details:", JSON.stringify(schema, null, 2));
  }
}

checkFKs();
