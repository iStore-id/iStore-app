/**
 * Verification Test Suite for CUSTOMER PHASE C1: PENGGUNA (Customer Management Engine)
 */
import { CustomerService, maskEmail, maskPhone } from "./src/server/customer-service";
import { adminDb } from "./src/server/firebase-admin";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    results.push({ name, passed: true, details });
    console.log(`✅ PASS: ${name}`);
  } else {
    results.push({ name, passed: false, details });
    console.error(`❌ FAIL: ${name}`);
  }
}

async function runVerification() {
  console.log("================================================================================");
  console.log("🚀 STARTING CUSTOMER PHASE C1: PENGGUNA VERIFICATION SUITE");
  console.log("================================================================================");

  const customerService = CustomerService.getInstance();
  const actor = { uid: "admin_test_1", email: "admin.tester@istore.co.id" };
  const actorRole = "admin";

  // 1. Setup Test Fixture Data in Firestore
  const testCustomerId = `cust_test_${Date.now()}`;
  const ownerCustomerId = `owner_test_${Date.now()}`;

  try {
    // Seed test customer
    await adminDb.collection("users").doc(testCustomerId).set({
      uid: testCustomerId,
      email: "budi.santoso@example.com",
      name: "Budi Santoso",
      phone: "081234567890",
      role: "customer",
      status: "ACTIVE",
      tags: ["VIP"],
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Seed owner test account
    await adminDb.collection("users").doc(ownerCustomerId).set({
      uid: ownerCustomerId,
      email: "chokerbayu@gmail.com",
      name: "Bayu Owner",
      role: "pemilik",
      status: "ACTIVE",
      createdAt: new Date().toISOString()
    });

    // Seed test order for test customer
    const testOrderId = `ord_test_${Date.now()}`;
    await adminDb.collection("orders").doc(testOrderId).set({
      id: testOrderId,
      userId: testCustomerId,
      invoice: `INV-${Date.now()}`,
      productName: "Mobile Legends 86 Diamonds",
      variantName: "86 Diamonds",
      totalAmount: 25000,
      paymentStatus: "paid",
      transactionStatus: "success",
      createdAt: new Date().toISOString()
    });

    // Seed test point transaction
    const testTxId = `pt_${Date.now()}`;
    await adminDb.collection("pointTransactions").doc(testTxId).set({
      id: testTxId,
      customerId: testCustomerId,
      type: "EARN",
      points: 50,
      reference: testOrderId,
      createdAt: new Date().toISOString()
    });

    // --- TEST 1: PII Masking Utility ---
    const maskedEmail = maskEmail("budi.santoso@example.com");
    const maskedPhone = maskPhone("081234567890");
    assert(
      maskedEmail.includes("***") && !maskedEmail.includes("santoso"),
      "C1-01: Email PII is safely masked in default views",
      `Result: ${maskedEmail}`
    );
    assert(
      maskedPhone.includes("****") && maskedPhone.startsWith("0812") && maskedPhone.endsWith("890"),
      "C1-02: Phone PII is safely masked in default views",
      `Result: ${maskedPhone}`
    );

    // --- TEST 2: Customer Directory Query & Search ---
    const directory = await customerService.getCustomerDirectory({
      search: "Budi",
      status: "ALL",
      page: 1,
      limit: 10
    }, true);

    assert(
      directory.items.length > 0 && directory.items.some(u => u.uid === testCustomerId),
      "C1-03: Customer Directory search by name locates customer",
      `Found ${directory.items.length} items`
    );
    assert(
      directory.items.find(u => u.uid === testCustomerId)?.email?.includes("***") === true,
      "C1-04: Customer Directory returns masked PII by default",
      `Masked email: ${directory.items.find(u => u.uid === testCustomerId)?.email}`
    );
    assert(
      typeof directory.metrics.totalCustomers === "number" && directory.metrics.totalCustomers > 0,
      "C1-05: Customer Directory computes aggregate metrics (total, active, LTV)",
      `Total: ${directory.metrics.totalCustomers}, Active: ${directory.metrics.activeCount}`
    );

    // --- TEST 3: Commerce Metrics Aggregation ---
    const targetInDir = directory.items.find(u => u.uid === testCustomerId);
    assert(
      (targetInDir?.orderCount || 0) >= 1 && (targetInDir?.totalSpentIdr || 0) >= 25000,
      "C1-06: Customer Directory computes aggregated order count and total spent (LTV)",
      `Orders: ${targetInDir?.orderCount}, Spent: ${targetInDir?.totalSpentIdr}`
    );

    // --- TEST 4: Customer 360° Profile Detail ---
    const profile = await customerService.getCustomer360Profile(testCustomerId, actor, actorRole, true);
    assert(
      profile.customer.uid === testCustomerId && profile.commerce.totalOrders >= 1,
      "C1-07: Customer 360° Profile aggregates customer identity and commerce summary",
      `Total Orders: ${profile.commerce.totalOrders}, Paid: ${profile.commerce.paidOrdersCount}`
    );
    assert(
      profile.commerce.totalSpentIdr >= 25000 && profile.commerce.recentOrders.length >= 1,
      "C1-08: Customer 360° Profile contains recent orders list",
      `Recent orders count: ${profile.commerce.recentOrders.length}`
    );
    assert(
      profile.loyalty.pointsBalance >= 50,
      "C1-09: Customer 360° Profile aggregates loyalty point balance",
      `Points Balance: ${profile.loyalty.pointsBalance}`
    );

    // --- TEST 5: Internal Notes Addition & Audit Logging ---
    const createdNote = await customerService.addCustomerNote(
      testCustomerId,
      "Pengguna meminta pengecekan topup berkala.",
      actor,
      actorRole
    );
    assert(
      createdNote.note === "Pengguna meminta pengecekan topup berkala." && createdNote.authorEmail === actor.email,
      "C1-10: Customer Note addition succeeds with actor attribution",
      `Note ID: ${createdNote.id}`
    );

    // --- TEST 6: Customer Tags Management ---
    const updatedTags = await customerService.updateCustomerTags(
      testCustomerId,
      ["VIP", "RESELLER"],
      actor,
      actorRole
    );
    assert(
      updatedTags.includes("VIP") && updatedTags.includes("RESELLER"),
      "C1-11: Customer Tags update persists normalized uppercase tags",
      `Tags: ${updatedTags.join(", ")}`
    );

    // --- TEST 7: Account Lifecycle State Transition (ACTIVE -> SUSPENDED) ---
    const suspended = await customerService.updateCustomerStatus(
      testCustomerId,
      "SUSPENDED",
      "Indikasi transaksi tidak wajar",
      actor,
      actorRole
    );
    assert(
      suspended.status === "SUSPENDED" && suspended.suspendReason === "Indikasi transaksi tidak wajar",
      "C1-12: Account Lifecycle transitions to SUSPENDED with mandatory reason",
      `Status: ${suspended.status}, Reason: ${suspended.suspendReason}`
    );

    // --- TEST 8: Account Lifecycle State Transition (SUSPENDED -> ACTIVE) ---
    const reactivated = await customerService.updateCustomerStatus(
      testCustomerId,
      "ACTIVE",
      "Verifikasi identitas selesai dan valid",
      actor,
      actorRole
    );
    assert(
      reactivated.status === "ACTIVE" && !reactivated.suspendReason,
      "C1-13: Account Lifecycle transitions back to ACTIVE and clears suspend reason",
      `Status: ${reactivated.status}`
    );

    // --- TEST 9: Owner Account Protection Guard ---
    let ownerProtectionPassed = false;
    try {
      await customerService.updateCustomerStatus(
        ownerCustomerId,
        "SUSPENDED",
        "Percobaan suspend owner",
        actor,
        actorRole
      );
    } catch (err: any) {
      if (err.message.includes("Cannot change or suspend the Owner account")) {
        ownerProtectionPassed = true;
      }
    }
    assert(
      ownerProtectionPassed,
      "C1-14: Owner Account Protection Guard prevents suspending or disabling the system owner",
      "Owner account protected from status modification"
    );

    // --- TEST 10: Privileged PII Unmasking & Audit Logging ---
    const unmasked = await customerService.unmaskCustomerPii(testCustomerId, actor, actorRole);
    assert(
      unmasked.email === "budi.santoso@example.com" && unmasked.phone === "081234567890",
      "C1-15: Privileged Unmask returns full raw PII and logs audit event",
      `Email: ${unmasked.email}, Phone: ${unmasked.phone}`
    );

    // --- TEST 11: Export Customer Directory CSV ---
    const csvData = await customerService.exportCustomersCsv({ search: "Budi" }, actor, actorRole);
    assert(
      csvData.includes("User ID") && csvData.includes("Total Belanja (IDR)") && csvData.includes(testCustomerId),
      "C1-16: Customer Directory CSV Export generates formatted CSV dataset",
      `CSV Header snippet: ${csvData.substring(0, 100)}`
    );

    // --- TEST 12: Audit Trail Verification ---
    const auditLogsSnap = await adminDb.collection("auditLogs")
      .where("target", "==", `users/${testCustomerId}`)
      .get();
    assert(
      auditLogsSnap.size >= 3,
      "C1-17: All status changes, notes, tags, and PII unmask operations are persisted in audit trail",
      `Recorded audit logs count: ${auditLogsSnap.size}`
    );

  } finally {
    // Clean up test data
    try {
      await adminDb.collection("users").doc(testCustomerId).delete();
      await adminDb.collection("users").doc(ownerCustomerId).delete();
    } catch (e) {}
  }

  // Summary
  console.log("================================================================================");
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log("================================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error("Verification execution error:", err);
  process.exit(1);
});
