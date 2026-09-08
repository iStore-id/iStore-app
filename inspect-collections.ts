
import { adminDb } from "./src/server/firebase-admin";

async function inspectCollections() {
  const collections = ["providerSkus", "variants", "productVariants", "products"];
  for (const col of collections) {
    const snap = await adminDb.collection(col).limit(5).get();
    console.log(`\n--- COLLECTION: ${col} (${snap.size} docs) ---`);
    snap.forEach(doc => {
      console.log(`ID: ${doc.id} | Data: ${JSON.stringify(doc.data()).substring(0, 200)}`);
    });
  }
}

inspectCollections().catch(console.error);
