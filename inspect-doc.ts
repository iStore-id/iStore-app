
import { adminDb } from "./src/server/firebase-admin";

async function inspectDoc() {
  const snap = await adminDb.collection("providerSkus").limit(1).get();
  if (snap.empty) {
    console.log("No docs in providerSkus");
  } else {
    console.log("Doc in providerSkus:", JSON.stringify(snap.docs[0].data(), null, 2));
  }
}

inspectDoc().catch(console.error);
