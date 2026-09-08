
import { adminDb, ISTORE_PROJECT_ID, ISTORE_FIRESTORE_DATABASE_ID } from "./src/server/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

async function reconcile() {
  console.log("--- RUNTIME CONFIG ---");
  console.log(`Project ID: ${ISTORE_PROJECT_ID}`);
  console.log(`Database ID (Named): ${ISTORE_FIRESTORE_DATABASE_ID}`);

  const dbDefault = getFirestore(); // Check (default) database too
  const dbNamed = adminDb;

  async function checkDb(db: any, label: string) {
    console.log(`\n=== CHECKING DATABASE: ${label} ===`);
    try {
      const collections = ["providerSkus", "products", "productVariants", "providerMappings"];
      for (const col of collections) {
        const snap = await db.collection(col).count().get();
        console.log(`${col} count: ${snap.data().count}`);
      }

      const skus = ["MLBB_5_DM", "MLBB_10_DM", "PUBGM_60_UC"];
      console.log("\n--- SKU LOOKUP ---");
      for (const s of skus) {
        const snap = await db.collection("providerSkus").where("providerSku", "==", s).limit(1).get();
        if (snap.empty) {
          console.log(`SKU ${s}: NOT FOUND`);
        } else {
          const data = snap.docs[0].data();
          console.log(`SKU ${s}: FOUND | ID: ${snap.docs[0].id} | Provider: ${data.providerId} | Name: ${data.name} | Category: ${data.metadata?.category} | Cost: ${data.metadata?.baseCost} | Status: ${data.status}`);
        }
      }

      const variants = ["Mobile Legends 5 Diamonds", "Mobile Legends 10 Diamonds", "PUBG Mobile 60 UC"];
      console.log("\n--- VARIANT LOOKUP ---");
      for (const v of variants) {
        const snap = await db.collection("productVariants").where("name", "==", v).limit(1).get();
        if (snap.empty) {
          console.log(`VARIANT ${v}: NOT FOUND`);
        } else {
          console.log(`VARIANT ${v}: FOUND | ID: ${snap.docs[0].id}`);
        }
      }
    } catch (error: any) {
      console.error(`Error checking database ${label}:`, error.message);
    }
  }

  await checkDb(dbNamed, `Named (${ISTORE_FIRESTORE_DATABASE_ID})`);
  await checkDb(dbDefault, "(default)");
}

reconcile().catch(console.error);
