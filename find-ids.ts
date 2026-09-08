
import { adminDb } from "./src/server/firebase-admin";

async function findIds() {
  const skus = ["MLBB_5_DM", "MLBB_10_DM", "PUBGM_60_UC"];
  const variantNames = ["Mobile Legends 5 Diamonds", "Mobile Legends 10 Diamonds", "PUBG Mobile 60 UC"];

  console.log("--- SEARCHING SKUs ---");
  for (const skuCode of skus) {
    const snap = await adminDb.collection("providerSkus")
      .where("providerId", "==", "tokovoucher")
      .where("providerSku", "==", skuCode)
      .limit(1)
      .get();
    
    if (snap.empty) {
      console.log(`SKU NOT FOUND: ${skuCode}`);
    } else {
      console.log(`SKU FOUND: ${skuCode} | ID: ${snap.docs[0].id}`);
    }
  }

  console.log("\n--- SEARCHING VARIANTS ---");
  const variantsSnap = await adminDb.collection("variants").get();
  variantsSnap.forEach(doc => {
    const data = doc.data();
    if (variantNames.includes(data.name)) {
      console.log(`VARIANT FOUND: ${data.name} | ID: ${doc.id}`);
    }
  });
}

findIds().catch(console.error);
