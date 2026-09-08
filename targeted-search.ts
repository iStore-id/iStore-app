
import { adminDb } from "./src/server/firebase-admin";

async function targetedSearch() {
  console.log("Searching for Mobile Legends in providerSkus...");
  const snap = await adminDb.collection("providerSkus")
    .where("name", ">=", "Mobile Legends")
    .where("name", "<", "Mobile Legends\uf8ff")
    .limit(10)
    .get();
  
  if (snap.empty) {
    console.log("No MLBB found in providerSkus");
  } else {
    snap.forEach(doc => {
      console.log(`SKU: ${doc.id} | data:`, doc.data());
    });
  }
}

targetedSearch().catch(console.error);
