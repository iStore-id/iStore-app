import re

with open("src/server/provider-import.ts", "r") as f:
    content = f.read()

content = content.replace('import { adminDb } from "./firebase-admin";', 'import { supabaseAdmin } from "./supabase-admin";')

# We can replace adminDb.batch() with a simple mock that collects operations and executes them.
mock_batch = '''class MockBatch {
  private ops: any[] = [];
  set(ref: any, data: any) { this.ops.push({ type: "set", ref, data }); }
  update(ref: any, data: any) { this.ops.push({ type: "update", ref, data }); }
  delete(ref: any) { this.ops.push({ type: "delete", ref }); }
  async commit() { 
    for (const op of this.ops) {
      if (op.type === "set") {
        await supabaseAdmin!.from(op.ref.table).upsert({ id: op.ref.id, ...op.data });
      } else if (op.type === "update") {
        await supabaseAdmin!.from(op.ref.table).update(op.data).eq("id", op.ref.id);
      } else if (op.type === "delete") {
        await supabaseAdmin!.from(op.ref.table).delete().eq("id", op.ref.id);
      }
    }
  }
}
const createBatch = () => new MockBatch();
'''

content = content.replace('export async function getAllProviderSkus', mock_batch + 'export async function getAllProviderSkus')

# Replace the collection logic with a mock ref
content = re.sub(
    r'adminDb\.collection\("([^"]+)"\)\.doc\(([^)]*)\)',
    r'{ table: "\1", id: \2 || require("crypto").randomUUID() }',
    content
)

content = re.sub(
    r'adminDb\.collection\("([^"]+)"\)\.doc\(\)',
    r'{ table: "\1", id: require("crypto").randomUUID() }',
    content
)

content = content.replace('adminDb.batch()', 'createBatch()')

# Other specific replacements
content = re.sub(
    r'const snapshot = await adminDb\.collection\("providerSkus"\)[\s\S]*?\}\)\);',
    r'''const { data } = await supabaseAdmin!.from("provider_skus").select("*").eq("provider_id", providerId);
    return (data || []).map(d => ({ id: d.id, ...d })) as any[];''',
    content
)

content = re.sub(
    r'const expiredSnap = await adminDb\.collection\("providerSkuImportSessions"\)[\s\S]*?\}\)',
    r'''const { data: expiredSnap } = await supabaseAdmin!.from("provider_sku_import_sessions").select("id").eq("status", "IN_PROGRESS")''',
    content
)
content = content.replace('expiredSnap.docs', '(expiredSnap || [])')

content = re.sub(
    r'const providerSnap = await adminDb\.collection\("providers"\)\.doc\(providerId\)\.get\(\);',
    r'''const { data: providerSnapData } = await supabaseAdmin!.from("providers").select("*").eq("id", providerId).maybeSingle();''',
    content
)
content = content.replace('if (!providerSnap.exists)', 'if (!providerSnapData)')

content = re.sub(
    r'const existingSessionSnap = await adminDb\.collection\("providerSkuImportSessions"\)[\s\S]*?get\(\);',
    r'''const { data: existingSessionSnapData } = await supabaseAdmin!.from("provider_sku_import_sessions").select("id").eq("provider_id", providerId).eq("status", "IN_PROGRESS").limit(1).maybeSingle();''',
    content
)
content = content.replace('if (!existingSessionSnap.empty)', 'if (existingSessionSnapData)')


# Convert sessionRef sets
content = content.replace('await sessionRef.set(', 'await supabaseAdmin!.from("provider_sku_import_sessions").insert({ id: sessionRef.id, ...')
content = content.replace('await sessionRef.update(', 'await supabaseAdmin!.from("provider_sku_import_sessions").update({ ...')

with open("src/server/provider-import.ts", "w") as f:
    f.write(content)

