
import { adminDb } from "./src/server/firebase-admin";

async function auditMappingEngine() {
  console.log("--- AUDIT: MAPPING COLLECTIONS ---");
  const collections = await adminDb.listCollections();
  for (const coll of collections) {
    console.log(`- Collection: ${coll.id}`);
  }

  // Look for a mapping collection
  const mappingColl = collections.find(c => c.id.toLowerCase().includes('mapping') || c.id.toLowerCase().includes('product'));
  if (mappingColl) {
    console.log(`\nFound potential mapping collection: ${mappingColl.id}`);
    const sample = await mappingColl.limit(1).get();
    if (!sample.empty) {
      console.log("Sample document structure:");
      console.log(JSON.stringify(sample.docs[0].data(), null, 2));
    }
  } else {
    console.log("\nNo obvious mapping collection found.");
  }
}

auditMappingEngine();
