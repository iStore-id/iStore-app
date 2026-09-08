
import { adminDb } from "./src/server/firebase-admin";

async function runAudit() {
  const providerId = "tokovoucher";
  console.log(`--- POST-IMPORT AUDIT: ${providerId} ---`);

  // 2. FIRESTORE COUNT & 3. KATEGORI & 4. DATA QUALITY
  const allSkusQuery = adminDb.collection("providerSkus").where("providerId", "==", providerId);
  let totalSku = 0;
  let totalInactive = 0;
  let totalActive = 0;
  let duplicateProviderSkus = 0;
  const providerSkuMap = new Set();
  const categoryStats: Record<string, { count: number; samples: any[] }> = {};
  const quality = {
    missingSku: 0,
    missingName: 0,
    missingCategory: 0,
    invalidCost: 0,
    zeroNegativeCost: 0,
    invalidStatus: 0,
    malformed: 0
  };
  let hasSellingPriceCount = 0;

  let lastDoc = null;
  const batchSize = 1000;
  let hasMore = true;

  console.log("Fetching documents in batches...");
  while (hasMore) {
    let query = allSkusQuery.limit(batchSize);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    
    const snap = await query.get();
    if (snap.empty) {
      hasMore = false;
      break;
    }

    totalSku += snap.size;
    snap.forEach(doc => {
      const data = doc.data();
      
      // Count statuses
      if (data.status === 'inactive') totalInactive++;
      else if (data.status === 'active') totalActive++;
      else quality.invalidStatus++;

      // Duplicates
      if (providerSkuMap.has(data.providerSku)) {
        duplicateProviderSkus++;
      } else {
        providerSkuMap.add(data.providerSku);
      }

      // Category
      const cat = data.metadata?.category || "Uncategorized";
      if (!categoryStats[cat]) {
        categoryStats[cat] = { count: 0, samples: [] };
      }
      categoryStats[cat].count++;
      if (categoryStats[cat].samples.length < 3) {
        categoryStats[cat].samples.push({ name: data.name, sku: data.providerSku, cost: data.metadata?.baseCost });
      }

      // Quality
      if (!data.providerSku) quality.missingSku++;
      if (!data.name) quality.missingName++;
      if (!data.metadata?.category) quality.missingCategory++;
      
      const actualCost = data.metadata?.baseCost;
      if (typeof actualCost !== 'number' || isNaN(actualCost)) quality.invalidCost++;
      else if (actualCost <= 0) quality.zeroNegativeCost++;

      // Pricing
      if (data.sellingPrice !== undefined) hasSellingPriceCount++;
    });

    lastDoc = snap.docs[snap.docs.length - 1];
    console.log(`Processed ${totalSku} items...`);
    
    if (snap.size < batchSize) {
      hasMore = false;
    }
  }

  console.log("2. FIRESTORE COUNT");
  console.log(`Total SKU: ${totalSku}`);
  console.log(`Total Inactive: ${totalInactive}`);
  console.log(`Total Active: ${totalActive}`);
  console.log(`Duplicate Provider SKUs: ${duplicateProviderSkus}`);

  console.log("\n3. KATEGORI PRODUK");
  const total = totalSku || 1;
  Object.entries(categoryStats).forEach(([cat, stats]) => {
    console.log(`${cat}: ${stats.count} (${((stats.count / total) * 100).toFixed(2)}%)`);
    stats.samples.forEach(s => console.log(`  - ${s.name} (${s.sku}) @ ${s.cost}`));
  });

  console.log("\n4. DATA QUALITY");
  console.log(JSON.stringify(quality, null, 2));

  console.log("\n5. PRICING SAFETY");
  console.log(`Items with sellingPrice: ${hasSellingPriceCount}`);

  // 7. PROVIDER ISOLATION
  const otherProviderSnap = await adminDb.collection("providerSkus").where("providerId", "!=", providerId).limit(5).get();
  console.log(`\n7. PROVIDER ISOLATION - Samples from other providers (should be untouched):`);
  otherProviderSnap.forEach(doc => {
    console.log(`- ID: ${doc.id} | Provider: ${doc.data().providerId} | SKU: ${doc.data().providerSku}`);
  });

  // 8. IMPORT AUDIT TRAIL
  const auditLogs = await adminDb.collection("auditLogs")
    .where("action", "==", "PROVIDER_CATALOG_DISCOVERY_IMPORT_COMPLETED")
    .where("targetId", "==", providerId)
    .orderBy("timestamp", "desc")
    .limit(1)
    .get();
    
  console.log(`\n8. IMPORT AUDIT TRAIL`);
  if (!auditLogs.empty) {
    console.log(JSON.stringify(auditLogs.docs[0].data(), null, 2));
  } else {
    console.log("No audit log found.");
  }
}

runAudit();
