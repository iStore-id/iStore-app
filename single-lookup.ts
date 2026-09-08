
import { adminDb } from "./src/server/firebase-admin";

async function singleLookup() {
  try {
    const snap = await adminDb.collection("providerSkus").limit(1).get();
    if (snap.empty) {
      console.log("RESULT: COLLECTION_EMPTY");
    } else {
      console.log("RESULT: COLLECTION_HAS_DATA");
      console.log("SAMPLE_ID:", snap.docs[0].id);
    }
  } catch (error: any) {
    console.log("RESULT: QUOTA_ERROR", error.message);
  }
}

singleLookup().catch(console.error);
