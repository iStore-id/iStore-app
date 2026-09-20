import re

with open("src/server/reconciliation-api.ts", "r") as f:
    content = f.read()

content = content.replace(
    'import { adminDb } from "./firebase-admin";',
    'import { supabaseAdmin } from "./supabase-admin";'
)

# Fix dashboard stats
dashboard_stats = '''    const [
      totalRuns,
      totalRecords,
      openRecords,
      resolvedRecords,
      statusMismatches,
      amountMismatches,
      providerPending,
      lastRunResult
    ] = await Promise.all([
      supabaseAdmin!.from("reconciliation_runs").select("id", { count: "exact", head: true }),
      supabaseAdmin!.from("reconciliation_records").select("id", { count: "exact", head: true }),
      supabaseAdmin!.from("reconciliation_records").select("id", { count: "exact", head: true }).eq("resolution_status", "OPEN"),
      supabaseAdmin!.from("reconciliation_records").select("id", { count: "exact", head: true }).eq("resolution_status", "RESOLVED"),
      supabaseAdmin!.from("reconciliation_records").select("id", { count: "exact", head: true }).eq("type", "STATUS_MISMATCH"),
      supabaseAdmin!.from("reconciliation_records").select("id", { count: "exact", head: true }).eq("type", "AMOUNT_MISMATCH"),
      supabaseAdmin!.from("reconciliation_records").select("id", { count: "exact", head: true }).eq("type", "PROVIDER_PENDING"),
      supabaseAdmin!.from("reconciliation_runs").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle()
    ]);'''

content = re.sub(
    r'const \[[\s\S]*?adminDb\.collection\("reconciliationRuns"\)\.orderBy\("createdAt", "desc"\)\.limit\(1\)\.get\(\)\n    \];',
    dashboard_stats,
    content
)

# Extract counts properly
content = re.sub(
    r'totalRuns,\s*totalRecords,\s*openRecords,\s*resolvedRecords,\s*statusMismatches,\s*amountMismatches,\s*providerPending,\s*lastRunSnap\s*\] = \s*await Promise\.all\(\[\n\s*//\s*Wait,\s*we\s*did\s*this\s*above',
    '',
    content
) # just in case

# Fix the returns
content = content.replace(
    'const lastRun = lastRunSnap.empty ? null : { id: lastRunSnap.docs[0].id, ...lastRunSnap.docs[0].data() };',
    'const lastRun = lastRunResult.data ? { id: lastRunResult.data.id, status: lastRunResult.data.status, createdAt: lastRunResult.data.created_at, executedBy: lastRunResult.data.executed_by } : null;'
)

content = content.replace('totalRuns,', 'totalRuns: totalRuns.count || 0,')
content = content.replace('totalRecords,', 'totalRecords: totalRecords.count || 0,')
content = content.replace('openRecords,', 'openRecords: openRecords.count || 0,')
content = content.replace('resolvedRecords,', 'resolvedRecords: resolvedRecords.count || 0,')
content = content.replace('statusMismatches,', 'statusMismatches: statusMismatches.count || 0,')
content = content.replace('amountMismatches,', 'amountMismatches: amountMismatches.count || 0,')
content = content.replace('providerPending,', 'providerPending: providerPending.count || 0,')

# Fix listReconciliationRuns
content = re.sub(
    r'const snapshot = await adminDb\.collection\("reconciliationRuns"\)\.orderBy\("createdAt", "desc"\)\.limit\(50\)\.get\(\);\n\s*const runs = snapshot\.docs\.map\(doc => \(\{\n\s*id: doc\.id,\n\s*\.\.\.doc\.data\(\)\n\s*\}\)\);',
    r'''const { data } = await supabaseAdmin!.from("reconciliation_runs").select("*").order("created_at", { ascending: false }).limit(50);
    const runs = (data || []).map(row => ({
      id: row.id,
      executedBy: row.executed_by,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      status: row.status,
      totalOrdersScanned: row.total_orders_scanned,
      mismatchCount: row.mismatch_count,
      createdAt: row.created_at
    }));''',
    content
)

# Fix getReconciliationRunDetails
content = re.sub(
    r'const doc = await adminDb\.collection\("reconciliationRuns"\)\.doc\(id\)\.get\(\);\n\s*if \(\!doc\.exists\) \{\n\s*return res\.status\(404\)\.json\(\{ success: false, message: "Run not found" \}\);\n\s*\}',
    r'''const { data: runData } = await supabaseAdmin!.from("reconciliation_runs").select("*").eq("id", id).maybeSingle();
    if (!runData) {
      return res.status(404).json({ success: false, message: "Run not found" });
    }''',
    content
)

content = re.sub(
    r'const recordsSnap = await adminDb\.collection\("reconciliationRecords"\)\.where\("runId", "==", id\)\.get\(\);\n\s*const records = recordsSnap\.docs\.map\(d => \(\{\n\s*id: d\.id,\n\s*\.\.\.d\.data\(\)\n\s*\}\)\);',
    r'''const { data: recordsData } = await supabaseAdmin!.from("reconciliation_records").select("*").eq("run_id", id);
    const records = (recordsData || []).map(row => ({
      id: row.id,
      runId: row.run_id,
      orderId: row.order_id,
      mismatchType: row.type,
      resolution: row.resolution_status,
      localState: row.local_state,
      providerState: row.provider_state,
      expectedAmount: row.expected_amount,
      actualAmount: row.actual_amount,
      resolutionReason: row.resolution_reason,
      createdAt: row.created_at
    }));''',
    content
)

content = content.replace('doc.data()', 'runData')

# Fix listReconciliationRecords
records_query = '''    let query = supabaseAdmin!.from("reconciliation_records").select("*");
    
    if (runId) query = query.eq("run_id", runId);
    if (resolution) query = query.eq("resolution_status", resolution);
    if (mismatchType) query = query.eq("type", mismatchType);
    if (orderId) query = query.eq("order_id", orderId);
    
    const { data: recordsData } = await query.order("created_at", { ascending: false }).limit(50);
    
    const records = (recordsData || []).map(row => ({
      id: row.id,
      runId: row.run_id,
      orderId: row.order_id,
      mismatchType: row.type,
      resolution: row.resolution_status,
      localState: row.local_state,
      providerState: row.provider_state,
      expectedAmount: row.expected_amount,
      actualAmount: row.actual_amount,
      resolutionReason: row.resolution_reason,
      createdAt: row.created_at
    }));'''

content = re.sub(
    r'let query: FirebaseFirestore\.Query = adminDb\.collection\("reconciliationRecords"\);[\s\S]*?\}\)\);',
    records_query,
    content
)


with open("src/server/reconciliation-api.ts", "w") as f:
    f.write(content)
