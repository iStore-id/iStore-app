
import { adminDb } from "./src/server/firebase-admin";

async function classifyTokoVoucher() {
  const providerId = "tokovoucher";
  const snap = await adminDb.collection("providerSkus").where("providerId", "==", providerId).get();
  
  const categories: Record<string, number> = {
    "TOPUP GAME": 0,
    "NON-GAME DIGITAL": 0,
    "PASCABAYAR": 0,
    "PULSA/DATA": 0,
    "E-MONEY": 0,
    "STREAMING/ENTERTAINMENT": 0,
    "LAINNYA": 0,
    "AMBIGUOUS": 0
  };

  const topupGameSamples: any[] = [];
  const ambiguousSamples: any[] = [];

  snap.forEach(doc => {
    const data = doc.data();
    const cat = data.metadata?.category || "";
    const op = data.metadata?.operator || "";
    
    // Simple classification logic based on metadata
    if (cat === "Topup Game") {
        categories["TOPUP GAME"]++;
        if (topupGameSamples.length < 20) topupGameSamples.push({sku: data.providerSku, name: data.name});
    } else if (["E-Money", "Transfer Dana"].includes(cat)) {
        categories["E-MONEY"]++;
    } else if (["Pascabayar", "PLN"].includes(cat)) {
        categories["PASCABAYAR"]++;
    } else if (["Pulsa", "Paket Data", "Voucher Data", "Pulsa Transfer", "Masa Aktif"].includes(cat)) {
        categories["PULSA/DATA"]++;
    } else if (["Hiburan", "TV"].includes(cat)) {
        categories["STREAMING/ENTERTAINMENT"]++;
    } else if (cat === "Digital") {
        categories["NON-GAME DIGITAL"]++;
    } else {
        categories["LAINNYA"]++;
        if (ambiguousSamples.length < 10) ambiguousSamples.push({sku: data.providerSku, name: data.name, cat: cat});
    }
  });

  console.log("Classification Results:", categories);
  console.log("\nTopup Game Samples:", topupGameSamples);
  console.log("\nAmbiguous Samples:", ambiguousSamples);
}

classifyTokoVoucher();
