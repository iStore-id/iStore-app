
import { supabaseAdmin } from "./src/server/supabase-admin";
import dotenv from "dotenv";

dotenv.config();

async function checkSchema() {
  console.log("Checking foreign keys for flash_sales table...");
  const { data, error } = await supabaseAdmin.rpc('get_table_info', { table_name: 'flash_sales' });
  
  if (error) {
    // If RPC doesn't exist, try a direct query to information_schema
    const { data: fks, error: fkError } = await supabaseAdmin.raw(`
      SELECT
          tc.table_name, 
          kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='flash_sales';
    `);
    
    if (fkError) {
      console.error("Error fetching FKs:", fkError.message);
      
      // Fallback: Just query columns to see if they exist
      const { data: cols, error: colError } = await supabaseAdmin.from('flash_sales').select().limit(0);
      if (colError) console.error("Error fetching columns:", colError.message);
      else console.log("Columns exist in flash_sales.");
    } else {
      console.log("Foreign Keys:", JSON.stringify(fks, null, 2));
    }
  } else {
    console.log("Table Info:", JSON.stringify(data, null, 2));
  }
}

// Since raw/raw query might not be available on supabase client directly in all versions, 
// let's use a more standard way to check if possible or just rely on repository knowledge and manual check of AdminFlashSalePage.
checkSchema();
