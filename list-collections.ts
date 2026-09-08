
import { adminDb, ISTORE_FIRESTORE_DATABASE_ID } from "./src/server/firebase-admin";

async function listAllCollections() {
  console.log(`Checking Database: ${ISTORE_FIRESTORE_DATABASE_ID}`);
  const collections = await adminDb.listCollections();
  console.log("--- COLLECTIONS ---");
  for (const col of collections) {
    const snap = await col.limit(1).get();
    console.log(`- ${col.id} (${snap.size} docs)`);
  }
}

listAllCollections().catch(console.error);
