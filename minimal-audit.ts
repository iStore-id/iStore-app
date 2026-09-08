import { adminDb, ISTORE_PROJECT_ID, ISTORE_FIRESTORE_DATABASE_ID } from "./src/server/firebase-admin";

async function minimalAudit() {
  console.log("--- RUNTIME ENVIRONMENT ---");
  console.log(`Runtime Project ID: ${ISTORE_PROJECT_ID}`);
  console.log(`Runtime Database ID: ${ISTORE_FIRESTORE_DATABASE_ID}`);

  const skusToSearch = ["MLBB_5_DM", "MLBB_10_DM", "PUBGM_60_UC"];
  const variantNamesToSearch = ["Mobile Legends 5 Diamonds", "Mobile Legends 10 Diamonds", "PUBG Mobile 60 UC"];

  console.log("\n--- SKU LOOKUP (providerSkus) ---");
  for (const skuCode of skusToSearch) {
    try {
      const snap = await adminDb.collection("providerSkus")
        .where("providerSku", "==", skuCode)
        .limit(1)
        .get();
      
      if (snap.empty) {
        console.log(`SKU: ${skuCode} | Status: NOT_FOUND`);
      } else {
        const doc = snap.docs[0];
        const data = doc.data();
        console.log(`SKU: ${skuCode} | ID: ${doc.id} | Provider: ${data.providerId} | Name: ${data.name} | Category: ${data.metadata?.category || 'N/A'} | Cost: ${data.metadata?.baseCost || 'N/A'} | Status: ${data.status}`);
      }
    } catch (error: any) {
      if (error.message.includes("RESOURCE_EXHAUSTED") || error.code === 8) {
        console.error(`QUOTA_ERROR during SKU lookup for ${skuCode}: ${error.message}`);
        process.exit(1);
      }
      console.error(`Error during SKU lookup for ${skuCode}:`, error.message);
    }
  }

  console.log("\n--- VARIANT LOOKUP (productVariants) ---");
  for (const name of variantNamesToSearch) {
    try {
      const snap = await adminDb.collection("productVariants")
        .where("name", "==", name)
        .limit(1)
        .get();
      
      if (snap.empty) {
        console.log(`VARIANT: ${name} | Status: NOT_FOUND`);
      } else {
        const doc = snap.docs[0];
        const data = doc.data();
        console.log(`VARIANT: ${name} | ID: ${doc.id} | SKU: ${data.sku} | Price: ${data.price} | Status: ${data.status}`);
      }
    } catch (error: any) {
      if (error.message.includes("RESOURCE_EXHAUSTED") || error.code === 8) {
        console.error(`QUOTA_ERROR during Variant lookup for ${name}: ${error.message}`);
        process.exit(1);
      }
      console.error(`Error during Variant lookup for ${name}:`, error.message);
    }
  }
}

minimalAudit().catch(err => {
  console.error("FATAL ERROR:", err.message);
  process.exit(1);
});
