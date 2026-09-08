
import { adminDb } from "./src/server/firebase-admin";

async function globalSearch() {
  const collections = await adminDb.listCollections();
  for (const col of collections) {
    const snap = await col.limit(100).get();
    snap.forEach(doc => {
      const str = JSON.stringify(doc.data());
      if (str.includes("Mobile Legends")) {
        console.log(`FOUND in ${col.id} [${doc.id}]: ${str.substring(0, 200)}`);
      }
    });
  }
}

globalSearch().catch(console.error);
