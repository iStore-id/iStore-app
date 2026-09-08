
import { ReferralService } from "../src/server/referral-service";
import { adminDb } from "../src/server/firebase-admin";
import { LoyaltyService } from "../src/server/loyalty-service";
import { CommissionService } from "../src/server/commission-service";

async function runTests() {
  console.log("🚀 Starting CUSTOMER PHASE C3 - REFERRAL VERIFICATION...");
  
  const referralService = ReferralService.getInstance();
  const loyaltyService = LoyaltyService.getInstance();
  const commissionService = CommissionService.getInstance();

  const testReferrerId = "test-referrer-" + Date.now();
  const testReferredId = "test-referred-" + Date.now();
  const actor = { uid: "system", email: "test@istore.id" };

  try {
    // 1. Setup Test Users & Config
    console.log("Setting up test users and config...");
    await adminDb.collection("systemConfigs").doc("referral_config").set({
      enabled: true,
      referrerRewardType: 'POINTS',
      referrerRewardPoints: 500,
      referredRewardType: 'POINTS',
      referredRewardPoints: 100,
      minQualifyingOrderAmount: 50000,
      allowSelfReferral: false,
      requireOrderSuccess: true,
      updatedAt: new Date().toISOString(),
      updatedBy: "TEST_RUNNER"
    });

    await adminDb.collection("users").doc(testReferrerId).set({
      uid: testReferrerId,
      email: "referrer@test.com",
      name: "Test Referrer",
      role: "customer",
      status: "ACTIVE",
      createdAt: new Date().toISOString()
    });

    await adminDb.collection("users").doc(testReferredId).set({
      uid: testReferredId,
      email: "referred@test.com",
      name: "Test Referred",
      role: "customer",
      status: "ACTIVE",
      createdAt: new Date().toISOString()
    });

    // 2. Generate Referral Code
    console.log("Test: Referral Code Generation...");
    const code = await referralService.generateReferralCode(testReferrerId, actor);
    console.log(`✅ Code generated: ${code}`);

    const userSnap = await adminDb.collection("users").doc(testReferrerId).get();
    if (userSnap.data()?.referralCode !== code) throw new Error("Referral code not saved to user");

    // 3. Self-Referral Check
    console.log("Test: Self-referral Rejection...");
    const selfRes = await referralService.attributeCustomer(testReferrerId, code, 'MANUAL_INPUT');
    if (selfRes.success) throw new Error("Self-referral should be rejected");
    console.log(`✅ Self-referral rejected: ${selfRes.message}`);

    // 4. Attribution
    console.log("Test: Attribution...");
    const attrRes = await referralService.attributeCustomer(testReferredId, code, 'URL');
    if (!attrRes.success) throw new Error("Attribution failed: " + attrRes.message);
    console.log(`✅ Attribution successful: ${attrRes.relationship?.id}`);

    const relId = `REF_${testReferrerId}_${testReferredId}`;
    if (attrRes.relationship?.id !== relId) throw new Error("Relationship ID is not deterministic");

    // 5. Duplicate Attribution Check
    console.log("Test: Duplicate Attribution Prevention...");
    const attrRes2 = await referralService.attributeCustomer(testReferredId, code, 'MANUAL_INPUT');
    if (attrRes2.success) throw new Error("Duplicate attribution should be rejected");
    console.log(`✅ Duplicate attribution rejected: ${attrRes2.message}`);

    // 7. Qualification - Non-SUCCESS order
    console.log("Test: Non-SUCCESS order should not grant rewards...");
    const orderId = "test-order-" + Date.now();
    const orderData = {
      id: orderId,
      userId: testReferredId,
      totalAmount: 100000,
      transactionStatus: 'pending',
      referralCode: code
    };
    
    // Simulate order success but call qualification (logic check)
    // Note: In real app, this is called from state-machine on SUCCESS transition
    await referralService.qualifyReferral(orderId, orderData);
    
    const relSnap = await adminDb.collection("referralRelationships").doc(relId).get();
    if (relSnap.data()?.status !== 'PENDING') throw new Error("Relationship status should remain PENDING for non-success order");
    console.log("✅ Non-SUCCESS order ignored correctly.");

    // 8. Qualification - SUCCESS order below min amount
    console.log("Test: Order below min amount should not qualify...");
    const smallOrderData = { ...orderData, totalAmount: 10000, transactionStatus: 'success' };
    await referralService.qualifyReferral(orderId, smallOrderData);
    const relSnap2 = await adminDb.collection("referralRelationships").doc(relId).get();
    if (relSnap2.data()?.status !== 'PENDING') throw new Error("Relationship status should remain PENDING for small order");
    console.log("✅ Small order ignored correctly.");

    // 9. Qualification - VALID SUCCESS order
    console.log("Test: Valid SUCCESS order qualifies and grants rewards...");
    const validOrderData = { ...orderData, totalAmount: 75000, transactionStatus: 'success' };
    await referralService.qualifyReferral(orderId, validOrderData);
    
    const relSnap3 = await adminDb.collection("referralRelationships").doc(relId).get();
    if (relSnap3.data()?.status !== 'CONVERTED') throw new Error("Relationship status should be CONVERTED");
    if (relSnap3.data()?.rewardStatus !== 'GRANTED') throw new Error("Reward status should be GRANTED");
    console.log("✅ Referral qualified successfully.");

    // 10. Loyalty Integration Verification
    console.log("Test: Loyalty Integration (Points)...");
    const referrerBalance = await loyaltyService.getCustomerBalance(testReferrerId);
    const referredBalance = await loyaltyService.getCustomerBalance(testReferredId);
    
    console.log(`Referrer Balance: ${referrerBalance} points`);
    console.log(`Referred Balance: ${referredBalance} points`);

    if (referrerBalance < 500) throw new Error("Referrer points not awarded correctly");
    if (referredBalance < 100) throw new Error("Referred points not awarded correctly");
    console.log("✅ Loyalty points awarded successfully.");

    // 11. Idempotency - Duplicate SUCCESS event
    console.log("Test: Idempotency (Duplicate SUCCESS event)...");
    await referralService.qualifyReferral(orderId, validOrderData);
    const referrerBalanceFinal = await loyaltyService.getCustomerBalance(testReferrerId);
    if (referrerBalanceFinal !== referrerBalance) throw new Error("Duplicate rewards awarded!");
    console.log("✅ Idempotency verified.");

    // 12. Commission Integration Verification
    console.log("Test: Commission Integration...");
    // Setup Commission Recipient for Referrer
    await adminDb.collection("commissionRecipients").doc(testReferrerId).set({
      id: testReferrerId,
      code: code,
      name: "Test Referrer Affiliate",
      type: "AFFILIATE",
      status: "ACTIVE",
      createdAt: new Date().toISOString()
    });
    // Setup Commission Rule
    await adminDb.collection("commissionRules").doc("test-referral-rule").set({
      id: "test-referral-rule",
      name: "Referral Rule",
      recipientType: "AFFILIATE",
      status: "ACTIVE",
      calculationMethod: "FIXED_AMOUNT",
      rate: 10000,
      createdAt: new Date().toISOString()
    });
    // Enable Commission in config
    await adminDb.collection("systemConfigs").doc("commission_config").set({
      value: { enabled: true }
    });
    // Update referral config to BOTH
    await adminDb.collection("systemConfigs").doc("referral_config").update({
      referrerRewardType: 'BOTH'
    });

    // Reset relationship for commission test
    await adminDb.collection("referralRelationships").doc(relId).update({
      status: 'PENDING',
      rewardStatus: 'PENDING'
    });

    const commissionOrderId = "comm-order-" + Date.now();
    const commOrderData = { ...validOrderData, id: commissionOrderId, invoice: commissionOrderId };
    await referralService.qualifyReferral(commissionOrderId, commOrderData);

    const commSnap = await adminDb.collection("commissionRecords")
      .where("orderId", "==", commissionOrderId)
      .limit(1)
      .get();
    
    if (commSnap.empty) throw new Error("Commission record not created for referral");
    console.log(`✅ Commission accrued: Rp ${commSnap.docs[0].data().commissionAmount}`);

    // 13. Audit Trail Verification
    console.log("Test: Audit Trail...");
    const auditSnap = await adminDb.collection("auditLogs")
      .where("target", "==", `referralRelationships/${relId}`)
      .get();
    if (auditSnap.empty) throw new Error("No audit logs found for relationship");
    console.log(`✅ Audit trail verified (${auditSnap.size} logs found).`);

    console.log("\n✨ CUSTOMER PHASE C3 - ALL TESTS PASSED! ✨");

  } catch (error: any) {
    console.error("\n❌ TEST FAILED:", error);
    process.exit(1);
  } finally {
    // Cleanup
    console.log("Cleaning up test data...");
    await Promise.all([
      adminDb.collection("users").doc(testReferrerId).delete(),
      adminDb.collection("users").doc(testReferredId).delete(),
      adminDb.collection("referralRelationships").doc(`REF_${testReferrerId}_${testReferredId}`).delete(),
      adminDb.collection("systemConfigs").doc("referral_config").delete(),
      adminDb.collection("commissionRecipients").doc(testReferrerId).delete(),
      adminDb.collection("commissionRules").doc("test-referral-rule").delete(),
      adminDb.collection("systemConfigs").doc("commission_config").delete()
    ]);
  }
}

runTests();
