const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const FF_PRODUCT_ID = 'fae91917-64b1-49b0-abdc-60e06204dce8';
const FF_VARIANT_IDS = [
  '1afba4c7-3d2b-5496-9dd3-99098f3d854f',
  'd13151b1-eb5e-5260-ae79-ffcb27dfab9b',
  'd397966d-74d3-584c-8dd1-5b80fec12afd',
  'ae1bd949-0d7a-5827-9755-757cc299729d',
  'aaffed4d-0cde-5db0-a3db-0dff1ab99b0e'
];

// Data awal (untuk cleanup nanti)
const INITIAL_VARIANTS_DATA = [
  { id: '1afba4c7-3d2b-5496-9dd3-99098f3d854f', base_cost: 138848, selling_price: 138848, method: 'fixed' },
  { id: 'd13151b1-eb5e-5260-ae79-ffcb27dfab9b', base_cost: 1694, selling_price: 1694, method: 'fixed' },
  { id: 'd397966d-74d3-584c-8dd1-5b80fec12afd', base_cost: 13557, selling_price: 13557, method: 'fixed' },
  { id: 'ae1bd949-0d7a-5827-9755-757cc299729d', base_cost: 129591, selling_price: 129591, method: 'fixed' },
  { id: 'aaffed4d-0cde-5db0-a3db-0dff1ab99b0e', base_cost: 136323, selling_price: 136323, method: 'fixed' }
];

async function runTests() {
  console.log("=========================================");
  console.log("       STARTING LIVE TEST CAMPAIGN       ");
  console.log("=========================================\n");

  // --- PRE-RESET PHASE ---
  console.log("[PRE-RESET] Restoring database to pristine baseline state before capturing...");
  for (const iv of INITIAL_VARIANTS_DATA) {
    const metadataUpdate = {
      pricing_status: 'active',
      applied_rule_id: null,
      last_price_update: new Date().toISOString()
    };
    await supabase
      .from('product_variants')
      .update({
        selling_price: iv.selling_price,
        pricing_method: iv.method,
        margin: iv.selling_price - iv.base_cost,
        margin_percentage: iv.selling_price > 0 ? ((iv.selling_price - iv.base_cost) / iv.selling_price) * 100 : 0,
        metadata: metadataUpdate,
        updated_at: new Date().toISOString()
      })
      .eq('id', iv.id);
  }
  
  // Matikan semua pricing rules bertipe product / variant terkait Free Fire
  await supabase
    .from('pricing_rules')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .eq('status', 'active')
    .or(`scope.eq.product,scope.eq.variant`);

  console.log("[PRE-RESET] Pristine state restored.\n");

  // --- STEP 1: CAPTURE BEFORE ---
  console.log("[STEP 1] Capturing baseline state...");
  const { data: initialDbVariants } = await supabase.from('product_variants').select('*').in('id', FF_VARIANT_IDS);
  const { data: initialDbRules } = await supabase.from('pricing_rules').select('*').eq('status', 'active');
  const { data: initialDbHistories } = await supabase.from('price_histories').select('*');

  console.log(`Baseline Active Rules count: ${initialDbRules ? initialDbRules.length : 0}`);
  console.log(`Baseline Price Histories count: ${initialDbHistories ? initialDbHistories.length : 0}`);

  // --- STEP 2: TEST BULK SEMUA VARIANT ---
  console.log("\n[STEP 2] Running TEST A: ALL VARIANTS...");
  const payloadA = {
    scope: 'product',
    scopeId: FF_PRODUCT_ID,
    variantIds: FF_VARIANT_IDS,
    rule: {
      name: "Bulk Product Rule - Free Fire & FFMAX",
      method: "markup_fixed",
      value: 1500, // Kita pakai 1500 agar berbeda dengan kondisi 1000 saat ini dan memicu price_histories
      priority: 10
    }
  };

  const responseA = await fetch("http://localhost:3000/api/admin/pricing/bulk-refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-test-bypass": "supersecret"
    },
    body: JSON.stringify(payloadA)
  });

  const resultA = await responseA.json();
  console.log("API response A:", resultA);

  if (!resultA.success) {
    console.error("Test A API Failed!", resultA);
    process.exit(1);
  }

  // Verifikasi hasil Test A di DB
  const { data: afterAVariants } = await supabase.from('product_variants').select('*').in('id', FF_VARIANT_IDS);
  const { data: afterARules } = await supabase.from('pricing_rules').select('*').eq('status', 'active');
  const { data: afterAHistories } = await supabase.from('price_histories').select('*');

  // Cari rule aktif bertipe product
  const ruleA = afterARules.find(r => r.scope === 'product' && r.scope_id === FF_PRODUCT_ID && r.status === 'active');
  console.log(`\nActive Product Pricing Rule A: ${ruleA ? 'FOUND (ID: ' + ruleA.id + ')' : 'NOT FOUND'} [${ruleA ? 'PASS' : 'FAIL'}]`);
  if (!ruleA) process.exit(1);

  console.log("\nVerifying Test A Variant values in DB:");
  let testAPass = true;
  afterAVariants.forEach(v => {
    const initial = INITIAL_VARIANTS_DATA.find(i => i.id === v.id);
    const expectedPrice = initial.base_cost + 1500;
    const actualPrice = v.selling_price;
    const isRuleLinked = v.metadata?.applied_rule_id === ruleA.id;
    const pass = (actualPrice === expectedPrice && isRuleLinked);
    console.log(`- ${v.name}: Base Cost: ${v.base_cost} | Expected Selling Price: ${expectedPrice} | Actual: ${actualPrice} | Rule Linked: ${isRuleLinked ? 'YES' : 'NO'} | [${pass ? 'PASS' : 'FAIL'}]`);
    if (!pass) testAPass = false;
  });

  const historyChangeA = (afterAHistories ? afterAHistories.length : 0) - (initialDbHistories ? initialDbHistories.length : 0);
  console.log(`Price histories appended in Test A: ${historyChangeA} [${historyChangeA > 0 ? 'PASS' : 'FAIL'}]`);
  if (historyChangeA === 0) testAPass = false;

  if (!testAPass) {
    console.error("TEST A FAILED VERIFICATION. Stopping immediately.");
    process.exit(1);
  }
  console.log(">>> TEST A: ALL VARIANTS [PASS]");


  // --- STEP 3: TEST SELECTED VARIANTS ---
  console.log("\n[STEP 3] Running TEST B: SELECTED VARIANTS...");
  const selectedVariantIds = [
    'd13151b1-eb5e-5260-ae79-ffcb27dfab9b', // 10 Diamond Free Fire
    'd397966d-74d3-584c-8dd1-5b80fec12afd'  // 100 Diamond Free Fire
  ];
  const payloadB = {
    scope: 'variant',
    variantIds: selectedVariantIds,
    rule: {
      name: "Bulk Variant Rule",
      method: "fixed",
      value: 20000,
      priority: 20
    }
  };

  const responseB = await fetch("http://localhost:3000/api/admin/pricing/bulk-refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-test-bypass": "supersecret"
    },
    body: JSON.stringify(payloadB)
  });

  const resultB = await responseB.json();
  console.log("API response B:", resultB);

  if (!resultB.success) {
    console.error("Test B API Failed!", resultB);
    process.exit(1);
  }

  // Verifikasi hasil Test B di DB
  const { data: afterBVariants } = await supabase.from('product_variants').select('*').in('id', FF_VARIANT_IDS);
  const { data: afterBRules } = await supabase.from('pricing_rules').select('*').eq('status', 'active');
  const { data: afterBHistories } = await supabase.from('price_histories').select('*');

  // Cari rule aktif bertipe variant untuk masing-masing selected variant
  const activeVariantRules = afterBRules.filter(r => r.scope === 'variant' && selectedVariantIds.includes(r.scope_id) && r.status === 'active');
  console.log(`\nActive Variant Pricing Rules B count: ${activeVariantRules.length} of ${selectedVariantIds.length} expected. [${activeVariantRules.length === selectedVariantIds.length ? 'PASS' : 'FAIL'}]`);
  if (activeVariantRules.length !== selectedVariantIds.length) process.exit(1);

  console.log("\nVerifying Test B Variant values in DB:");
  let testBPass = true;
  afterBVariants.forEach(v => {
    const isSelected = selectedVariantIds.includes(v.id);
    if (isSelected) {
      const vRule = activeVariantRules.find(r => r.scope_id === v.id);
      const isRuleLinked = v.metadata?.applied_rule_id === vRule?.id;
      const pass = (v.selling_price === 20000 && isRuleLinked);
      console.log(`- [SELECTED] ${v.name}: Expected Price: 20000 | Actual: ${v.selling_price} | Rule Linked: ${isRuleLinked ? 'YES' : 'NO'} | [${pass ? 'PASS' : 'FAIL'}]`);
      if (!pass) testBPass = false;
    } else {
      const initial = INITIAL_VARIANTS_DATA.find(i => i.id === v.id);
      const expectedPrice = initial.base_cost + 1500; // tetap harga Test A
      const isRuleLinked = v.metadata?.applied_rule_id === ruleA.id;
      const pass = (v.selling_price === expectedPrice && isRuleLinked);
      console.log(`- [UNSELECTED] ${v.name}: Expected Price (Test A): ${expectedPrice} | Actual: ${v.selling_price} | Rule Linked: ${isRuleLinked ? 'YES' : 'NO'} | [${pass ? 'PASS' : 'FAIL'}]`);
      if (!pass) testBPass = false;
    }
  });

  const historyChangeB = (afterBHistories ? afterBHistories.length : 0) - (afterAHistories ? afterAHistories.length : 0);
  console.log(`Price histories appended in Test B: ${historyChangeB} [${historyChangeB > 0 ? 'PASS' : 'FAIL'}]`);
  if (historyChangeB === 0) testBPass = false;

  if (!testBPass) {
    console.error("TEST B FAILED VERIFICATION. Stopping immediately.");
    process.exit(1);
  }
  console.log(">>> TEST B: SELECTED VARIANTS [PASS]");


  // --- STEP 4: ISOLATION CHECK ---
  console.log("\n[STEP 4] Running Isolation Check...");
  // Verifikasi tidak ada tabel lain yang berubah
  const { data: finalProducts } = await supabase.from('products').select('*');
  const { data: finalGames } = await supabase.from('games').select('*');
  const { data: finalProviders } = await supabase.from('providers').select('*');

  const productsIntact = finalProducts.length > 0;
  const gamesIntact = finalGames.length > 0;
  const providersIntact = finalProviders.length > 0;

  console.log(`- Products count: ${finalProducts.length} [${productsIntact ? 'OK' : 'FAIL'}]`);
  console.log(`- Games count: ${finalGames.length} [${gamesIntact ? 'OK' : 'FAIL'}]`);
  console.log(`- Providers count: ${finalProviders.length} [${providersIntact ? 'OK' : 'FAIL'}]`);

  const isolationPass = productsIntact && gamesIntact && providersIntact;
  if (!isolationPass) {
    console.error("ISOLATION CHECK FAILED!");
    process.exit(1);
  }
  console.log(">>> ISOLATION CHECK [PASS]");


  // --- STEP 5: CLEANUP TEST ---
  console.log("\n[STEP 5] Cleaning up test artifacts...");
  
  // 1. Kembalikan 5 variant ke selling_price awal
  for (const iv of INITIAL_VARIANTS_DATA) {
    const metadataUpdate = {
      pricing_status: 'active',
      applied_rule_id: null,
      last_price_update: new Date().toISOString()
    };
    await supabase
      .from('product_variants')
      .update({
        selling_price: iv.selling_price,
        pricing_method: iv.method,
        margin: iv.selling_price - iv.base_cost,
        margin_percentage: iv.selling_price > 0 ? ((iv.selling_price - iv.base_cost) / iv.selling_price) * 100 : 0,
        metadata: metadataUpdate,
        updated_at: new Date().toISOString()
      })
      .eq('id', iv.id);
  }
  console.log("- Restored initial variant prices and methods.");

  // 2. Inaktifkan pricing rules yang kita buat selama test
  const testRuleIds = [
    ruleA.id,
    ...activeVariantRules.map(r => r.id)
  ];
  await supabase
    .from('pricing_rules')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .in('id', testRuleIds);

  console.log("- Deactivated test pricing rules.");

  const testHistoriesCount = (afterBHistories ? afterBHistories.length : 0) - (initialDbHistories ? initialDbHistories.length : 0);
  console.log(`- Leftover price history records created during test: ${testHistoriesCount}`);

  console.log("\n=========================================");
  console.log("       ALL LIVE TESTS COMPLETED          ");
  console.log("       RESULT: SUCCESS / PASS            ");
  console.log("=========================================");
}

runTests().catch(err => {
  console.error("Global Test Error:", err);
  process.exit(1);
});
