
import { adminDb } from "./src/server/firebase-admin";

async function checkProvider() {
  const snap = await adminDb.collection("providers").get();
  console.log("Providers:", snap.docs.map(d => ({ id: d.id, name: d.data().name, code: d.data().code })));
}

checkProvider().catch(console.error);
