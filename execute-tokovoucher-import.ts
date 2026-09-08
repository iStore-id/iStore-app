
import { TokoVoucherDiscoveryAdapter } from "./src/server/adapters/tokovoucher-discovery-adapter";
import { adminDb } from "./src/server/firebase-admin";
import { importDiscoveryItems } from "./src/server/provider-import";

async function executeImport() {
  console.log("--- STARTING TOKOVOUCHER BULK IMPORT ---");
  
  const providerId = "tokovoucher";
  const adapter = new TokoVoucherDiscoveryAdapter();
  
  console.log("1. Discovering TokoVoucher products...");
  const discoveredItems = await adapter.discoverProducts();
  console.log(`Discovered: ${discoveredItems.length} SKUs`);
  
  // Ensure all items are inactive and formatted correctly
  const itemsToImport = discoveredItems.map(item => ({
    ...item,
    status: 'inactive',
    isActive: false
  }));
  
  console.log(`2. Executing import for ${itemsToImport.length} items (Default: Inactive)...`);
  
  // Mock Request and Response for the Express handler
  const mockReq: any = {
    body: {
      providerId,
      items: itemsToImport,
      mode: "SKIP_DUPLICATES"
    },
    user: {
      uid: "system-importer",
      email: "system@istore.id",
      role: "pemilik"
    },
    ip: "127.0.0.1",
    headers: {}
  };
  
  let resultData: any = null;
  const mockRes: any = {
    status: (code: number) => ({
      json: (data: any) => {
        resultData = data;
        return mockRes;
      }
    })
  };
  
  await importDiscoveryItems(mockReq, mockRes);
  
  console.log("3. Import Results:");
  console.log(JSON.stringify(resultData, null, 2));
  
  // Verification Read-Only
  console.log("\n4. Verifying imported data (Read-Only)...");
  const skusSnap = await adminDb.collection("providerSkus")
    .where("providerId", "==", providerId)
    .limit(10)
    .get();
    
  console.log("Sample Imported SKUs:");
  skusSnap.forEach(doc => {
    const data = doc.data();
    console.log(`- ${data.name} (${data.providerSku}) | Provider: ${data.providerId} | Status: ${data.status}`);
  });
  
  const totalInDb = (await adminDb.collection("providerSkus").where("providerId", "==", providerId).get()).size;
  console.log(`\nTotal ${providerId} SKUs in DB: ${totalInDb}`);
  
  const inactiveCount = (await adminDb.collection("providerSkus")
    .where("providerId", "==", providerId)
    .where("status", "==", "inactive")
    .get()).size;
  console.log(`Total Inactive SKUs: ${inactiveCount}`);
  
  const auditLogs = await adminDb.collection("auditLogs")
    .where("action", "==", "PROVIDER_CATALOG_DISCOVERY_IMPORT_COMPLETED")
    .where("targetId", "==", providerId)
    .orderBy("timestamp", "desc")
    .limit(1)
    .get();
    
  console.log(`Audit Log recorded: ${!auditLogs.empty}`);
}

executeImport().catch(err => {
  console.error("Execution failed:", err);
  process.exit(1);
});
