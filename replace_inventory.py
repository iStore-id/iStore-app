import re

with open("src/server/inventory-service.ts", "r") as f:
    content = f.read()

content = content.replace('import { adminDb } from "./firebase-admin";', 'import { supabaseAdmin } from "./supabase-admin";')

# Sync quotas
content = re.sub(
    r'const snap = await adminDb\.collection\("quotas"\)\.get\(\);\n\s*return snap\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \}\)\) as any\[\];',
    r'''const { data } = await supabaseAdmin!.from("quotas").select("*");
    return (data || []).map((d: any) => ({ id: d.id, ...d })) as any[];''',
    content
)

content = re.sub(
    r'const ref = data\.id \? adminDb\.collection\("quotas"\)\.doc\(data\.id\) \: adminDb\.collection\("quotas"\)\.doc\(\);\n\s*await ref\.set\(data, \{ merge: true \}\);',
    r'''if (data.id) {
      await supabaseAdmin!.from("quotas").update(data).eq("id", data.id);
    } else {
      data.id = require("crypto").randomUUID();
      await supabaseAdmin!.from("quotas").insert(data);
    }''',
    content
)

# getStock
content = re.sub(
    r'const snap = await adminDb\.collection\("stocks"\)\.where\("variantId", "==", variantId\)\.limit\(1\)\.get\(\);\n\s*if \(snap\.empty\) return null;\n\s*const doc = snap\.docs\[0\];\n\s*return \{ id: doc\.id, \.\.\.doc\.data\(\) \} as any;',
    r'''const { data } = await supabaseAdmin!.from("stocks").select("*").eq("variant_id", variantId).limit(1).maybeSingle();
    if (!data) return null;
    return { id: data.id, ...data } as any;''',
    content
)

# adjustStock
content = re.sub(
    r'return await adminDb\.runTransaction\(async \(t\) => \{[\s\S]*?return newStock;\n\s*\}\);',
    r'''// Mocking transaction with sequential awaits for now
    const { data: stockData } = await supabaseAdmin!.from("stocks").select("*").eq("variant_id", variantId).limit(1).maybeSingle();
    
    let currentQty = 0;
    let stockId = null;
    
    if (stockData) {
      currentQty = stockData.quantity || 0;
      stockId = stockData.id;
    } else {
      stockId = require("crypto").randomUUID();
    }
    
    const newQty = currentQty + delta;
    if (newQty < 0) throw new Error("Stok tidak mencukupi");
    
    const payload = {
      variant_id: variantId,
      quantity: newQty,
      updated_at: new Date().toISOString()
    };
    
    if (stockData) {
      await supabaseAdmin!.from("stocks").update(payload).eq("id", stockId);
    } else {
      await supabaseAdmin!.from("stocks").insert({ id: stockId, ...payload });
    }
    
    await supabaseAdmin!.from("stock_movements").insert({
      id: require("crypto").randomUUID(),
      stock_id: stockId,
      variant_id: variantId,
      delta,
      reason,
      created_at: new Date().toISOString()
    });
    
    return { id: stockId, ...payload } as any;''',
    content
)

# checkAndReserve
content = re.sub(
    r'return await adminDb\.runTransaction\(async \(t\) => \{[\s\S]*?\}\);',
    r'''const { data: stockData } = await supabaseAdmin!.from("stocks").select("*").eq("variant_id", variantId).limit(1).maybeSingle();
    if (!stockData) return false;
    
    const currentQty = stockData.quantity || 0;
    if (currentQty < quantity) return false;
    
    const newQty = currentQty - quantity;
    
    await supabaseAdmin!.from("stocks").update({
      quantity: newQty,
      updated_at: new Date().toISOString()
    }).eq("id", stockData.id);
    
    await supabaseAdmin!.from("reservations").insert({
      id: orderId,
      variant_id: variantId,
      quantity,
      expires_at: new Date(Date.now() + 15 * 60000).toISOString(),
      created_at: new Date().toISOString()
    });
    
    await supabaseAdmin!.from("stock_movements").insert({
      id: require("crypto").randomUUID(),
      stock_id: stockData.id,
      variant_id: variantId,
      delta: -quantity,
      reason: "RESERVE",
      reference_id: orderId,
      created_at: new Date().toISOString()
    });
    
    return true;''',
    content,
    count=1
)

# commitReservation
content = re.sub(
    r'await adminDb\.runTransaction\(async \(t\) => \{[\s\S]*?\}\);',
    r'''const { data: resData } = await supabaseAdmin!.from("reservations").select("*").eq("id", orderId).maybeSingle();
    if (!resData) return;
    
    await supabaseAdmin!.from("reservations").delete().eq("id", orderId);
    
    const { data: stockData } = await supabaseAdmin!.from("stocks").select("*").eq("variant_id", resData.variant_id).limit(1).maybeSingle();
    if (stockData) {
      await supabaseAdmin!.from("stock_movements").insert({
        id: require("crypto").randomUUID(),
        stock_id: stockData.id,
        variant_id: resData.variant_id,
        delta: 0,
        reason: "COMMIT_RESERVATION",
        reference_id: orderId,
        created_at: new Date().toISOString()
      });
    }''',
    content,
    count=1
)

# cancelReservation
content = re.sub(
    r'await adminDb\.runTransaction\(async \(t\) => \{[\s\S]*?\}\);',
    r'''const { data: resData } = await supabaseAdmin!.from("reservations").select("*").eq("id", orderId).maybeSingle();
    if (!resData) return;
    
    await supabaseAdmin!.from("reservations").delete().eq("id", orderId);
    
    const { data: stockData } = await supabaseAdmin!.from("stocks").select("*").eq("variant_id", resData.variant_id).limit(1).maybeSingle();
    if (stockData) {
      await supabaseAdmin!.from("stocks").update({
        quantity: (stockData.quantity || 0) + resData.quantity,
        updated_at: new Date().toISOString()
      }).eq("id", stockData.id);
      
      await supabaseAdmin!.from("stock_movements").insert({
        id: require("crypto").randomUUID(),
        stock_id: stockData.id,
        variant_id: resData.variant_id,
        delta: resData.quantity,
        reason: "CANCEL_RESERVATION",
        reference_id: orderId,
        created_at: new Date().toISOString()
      });
    }''',
    content,
    count=1
)

with open("src/server/inventory-service.ts", "w") as f:
    f.write(content)

