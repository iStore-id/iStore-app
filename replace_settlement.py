import re

with open("src/server/settlement-api.ts", "r") as f:
    content = f.read()

content = content.replace(
    'import { adminDb } from "./firebase-admin";',
    'import { supabaseAdmin } from "./supabase-admin";'
)

# getSettlementOverviewApi
content = re.sub(
    r'const snapshot = await adminDb\.collection\("settlementBatches"\)[\s\S]*?\}\)\);',
    r'''const { data: snapshot } = await supabaseAdmin!.from("settlement_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
      
    const recentBatches = (snapshot || []).map((doc: any) => ({
      id: doc.id,
      providerId: doc.provider_id,
      periodStart: doc.period_start,
      periodEnd: doc.period_end,
      totalAmount: doc.total_amount,
      totalCount: doc.total_count,
      status: doc.status,
      settledAt: doc.settled_at,
      createdAt: doc.created_at
    }));''',
    content
)

# getSettlementBatchDetailApi
content = re.sub(
    r'const batchSnap = await adminDb\.collection\("settlementBatches"\)\.doc\(id\)\.get\(\);\n\s*if \(\!batchSnap\.exists\) \{\n\s*return res\.status\(404\)\.json\(\{ success: false, message: "Batch not found" \}\);\n\s*\}',
    r'''const { data: batchData } = await supabaseAdmin!.from("settlement_batches").select("*").eq("id", id).maybeSingle();
    if (!batchData) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }''',
    content
)

content = content.replace('batchSnap.data()', 'batchData')

content = re.sub(
    r'const recordsSnap = await adminDb\.collection\("settlementRecords"\)[\s\S]*?\}\)\);',
    r'''const { data: recordsData } = await supabaseAdmin!.from("settlement_records")
      .select("*")
      .eq("batch_id", id)
      .order("created_at", { ascending: false });
      
    const records = (recordsData || []).map((doc: any) => ({
      id: doc.id,
      batchId: doc.batch_id,
      orderId: doc.order_id,
      providerId: doc.provider_id,
      amount: doc.amount,
      fee: doc.fee,
      netAmount: doc.net_amount,
      status: doc.status,
      createdAt: doc.created_at
    }));''',
    content
)

# processSettlementBatchApi
content = re.sub(
    r'const result = await adminDb\.runTransaction\(async \(transaction\) => \{[\s\S]*?return \{ id, status: "PROCESSING" \};\n\s*\}\);',
    r'''const { data: batchData } = await supabaseAdmin!.from("settlement_batches").select("status").eq("id", id).maybeSingle();
    if (!batchData) throw new Error("Batch not found");
    if (batchData.status !== "PENDING" && batchData.status !== "FAILED") {
      throw new Error("Only PENDING or FAILED batches can be processed");
    }
    
    await supabaseAdmin!.from("settlement_batches").update({
      status: "PROCESSING",
      updated_at: new Date().toISOString()
    }).eq("id", id);
    
    const result = { id, status: "PROCESSING" };''',
    content
)

# completeSettlementBatchApi
content = re.sub(
    r'const result = await adminDb\.runTransaction\(async \(transaction\) => \{[\s\S]*?return \{ id, status: "SETTLED" \};\n\s*\}\);',
    r'''const { data: batchData } = await supabaseAdmin!.from("settlement_batches").select("status").eq("id", id).maybeSingle();
    if (!batchData) throw new Error("Batch not found");
    if (batchData.status !== "PROCESSING") {
      throw new Error("Only PROCESSING batches can be completed");
    }
    
    await supabaseAdmin!.from("settlement_batches").update({
      status: "SETTLED",
      settled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      reference_id: referenceId,
      notes
    }).eq("id", id);
    
    const result = { id, status: "SETTLED" };''',
    content
)

# failSettlementBatchApi
content = re.sub(
    r'const result = await adminDb\.runTransaction\(async \(transaction\) => \{[\s\S]*?return \{ id, status: "FAILED" \};\n\s*\}\);',
    r'''const { data: batchData } = await supabaseAdmin!.from("settlement_batches").select("status").eq("id", id).maybeSingle();
    if (!batchData) throw new Error("Batch not found");
    if (batchData.status === "SETTLED") {
      throw new Error("Cannot fail an already settled batch");
    }
    
    await supabaseAdmin!.from("settlement_batches").update({
      status: "FAILED",
      updated_at: new Date().toISOString(),
      notes: reason
    }).eq("id", id);
    
    const result = { id, status: "FAILED" };''',
    content
)

# generateSettlementReportApi
content = re.sub(
    r'const result = await adminDb\.runTransaction\(async \(transaction\) => \{[\s\S]*?return \{ id, status: "DISPUTED" \};\n\s*\}\);',
    r'''const { data: batchData } = await supabaseAdmin!.from("settlement_batches").select("status").eq("id", id).maybeSingle();
    if (!batchData) throw new Error("Batch not found");
    if (batchData.status === "SETTLED") {
      throw new Error("Cannot dispute an already settled batch");
    }
    
    await supabaseAdmin!.from("settlement_batches").update({
      status: "DISPUTED",
      updated_at: new Date().toISOString(),
      notes: reason
    }).eq("id", id);
    
    const result = { id, status: "DISPUTED" };''',
    content
)

# generateSettlementReportApi batchesSnap
content = re.sub(
    r'const batchesSnap = await adminDb\.collection\("settlementBatches"\)\.get\(\);\n\s*const batches = batchesSnap\.docs\.map\(d => \(\{\n\s*id: d\.id,\n\s*\.\.\.d\.data\(\)\n\s*\}\)\);',
    r'''const { data: batchesData } = await supabaseAdmin!.from("settlement_batches").select("*");
    const batches = (batchesData || []).map(row => ({
      id: row.id,
      providerId: row.provider_id,
      status: row.status,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      totalAmount: row.total_amount,
      totalCount: row.total_count,
      createdAt: row.created_at,
      settledAt: row.settled_at
    }));''',
    content
)

content = re.sub(
    r'const adjsSnap = await adminDb\.collection\("settlementBatches"\)\.doc\(batchId\)\.collection\("adjustments"\)\.get\(\);\n\s*const adjustments = adjsSnap\.docs\.map\(d => \(\{\n\s*id: d\.id,\n\s*\.\.\.d\.data\(\)\n\s*\}\)\);',
    r'''const { data: adjsData } = await supabaseAdmin!.from("settlement_adjustments").select("*").eq("batch_id", batchId);
    const adjustments = (adjsData || []).map(row => ({
      id: row.id,
      amount: row.amount,
      type: row.type,
      description: row.description
    }));''',
    content
)

with open("src/server/settlement-api.ts", "w") as f:
    f.write(content)

