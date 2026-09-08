
import { adminDb } from "./src/server/firebase-admin";

async function findAnyVariant() {
  const snap = await adminDb.collection("productVariants").limit(5).get();
  if (snap.empty) {
    console.log("productVariants IS COMPLETELY EMPTY");
  } else {
    snap.forEach(doc => {
      console.log(`Variant: ${doc.id} | Name: ${doc.data().name} | SKU: ${doc.data().sku}`);
    });
  }
}

findAnyVariant().catch(console.error);
