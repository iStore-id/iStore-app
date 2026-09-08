
import { adminDb } from "./src/server/firebase-admin";

async function checkAudit() {
  const snap = await adminDb.collection("auditLogs").orderBy("createdAt", "desc").limit(5).get();
  if (snap.empty) {
    console.log("No audit logs found");
  } else {
    snap.forEach(doc => {
      console.log(`Audit: ${doc.id} | Action: ${doc.data().action} | Payload: ${JSON.stringify(doc.data().payload)}`);
    });
  }
}

checkAudit().catch(console.error);
