
import { adminDb } from "./src/server/firebase-admin";

async function searchSpecifics() {
  const skus = ["MLBB_5_DM", "MLBB_10_DM", "PUBGM_60_UC"];
  const variants = ["Mobile Legends 5 Diamonds", "Mobile Legends 10 Diamonds", "PUBG Mobile 60 UC"];

  console.log("--- SEARCHING providerSkus ---");
  for (const s of skus) {
    const snap = await adminDb.collection("providerSkus").where("providerSku", "==", s).get();
    if (snap.empty) {
      // Try name search
      const snap2 = await adminDb.collection("providerSkus").where("name", ">=", s).limit(5).get();
      console.log(`SKU ${s} NOT FOUND by code. Sample names:`, snap2.docs.map(d => d.data().name));
    } else {
      console.log(`SKU ${s} FOUND: ${snap.docs[0].id}`);
    }
  }

  console.log("\n--- SEARCHING productVariants ---");
  for (const v of variants) {
    const snap = await adminDb.collection("productVariants").where("name", "==", v).get();
    if (snap.empty) {
      console.log(`VARIANT ${v} NOT FOUND`);
    } else {
      console.log(`VARIANT ${v} FOUND: ${snap.docs[0].id}`);
    }
  }

  console.log("\n--- SEARCHING products ---");
  const pSnap = await adminDb.collection("products").get();
  console.log(`Total Products: ${pSnap.size}`);
}

searchSpecifics().catch(console.error);
