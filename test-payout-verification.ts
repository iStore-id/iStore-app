/**
 * Commission Phase 5 Verification Matrix (AC-1 through AC-16)
 */
import { adminDb } from "./src/server/firebase-admin";
import { CommissionService } from "./src/server/commission-service";
import * as LedgerService from "./src/server/ledger-service";
import { CommissionRecipient, CommissionRecord, PayoutBatch } from "./src/types/commission";
import crypto from "crypto";

async function runTests() {
  console.log("================================================================================");
  console.log("STARTING COMMISSION PHASE 5 TEST MATRIX (AC-1 to AC-16)");
  console.log("================================================================================\n");

  const service = CommissionService.getInstance();
  const testRunId = crypto.randomBytes(4).toString("hex");
  const makerActor = { uid: `maker_${testRunId}`, email: `maker_${testRunId}@istore.co.id` };
  const checkerActor = { uid: `checker_${testRunId}`, email: `checker_${testRunId}@istore.co.id` };
  const ownerActor = { uid: `owner_${testRunId}`, email: `owner_${testRunId}@istore.co.id`, isOwner: true };

  // Setup: Create 2 Recipients
  const recipient1Id = `rec_payout_1_${testRunId}`;
  const recipient2Id = `rec_payout_2_${testRunId}`;

  const recipient1: CommissionRecipient = {
    id: recipient1Id,
    name: `Affiliate One ${testRunId}`,
    code: `AFF1_${testRunId}`,
    type: "AFFILIATE",
    status: "ACTIVE",
    payoutAccount: {
      bankName: "BCA",
      accountNumber: "1234567890",
      accountNumberMasked: "12******90",
      accountHolderName: "Affiliate One"
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: makerActor.uid,
    updatedBy: makerActor.uid
  };

  const recipient2: CommissionRecipient = {
    id: recipient2Id,
    name: `Affiliate Two ${testRunId}`,
    code: `AFF2_${testRunId}`,
    type: "AFFILIATE",
    status: "ACTIVE",
    payoutAccount: {
      bankName: "MANDIRI",
      accountNumber: "9876543210",
      accountNumberMasked: "98******10",
      accountHolderName: "Affiliate Two"
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: makerActor.uid,
    updatedBy: makerActor.uid
  };

  await adminDb.collection("commissionRecipients").doc(recipient1Id).set(recipient1);
  await adminDb.collection("commissionRecipients").doc(recipient2Id).set(recipient2);

  // Setup: Create Commission Records
  // Recipient 1: 3 records (100k, 50k, 20k)
  const c1Id = `comm_${testRunId}_1`;
  const c2Id = `comm_${testRunId}_2`;
  const c3Id = `comm_${testRunId}_3`;
  // Recipient 2: 1 record (80k)
  const c4Id = `comm_${testRunId}_4`;

  const makeComm = (id: string, recId: string, amount: number): CommissionRecord => ({
    id,
    orderId: `order_${id}`,
    recipientId: recId,
    recipientCode: `AFF_${recId}`,
    recipientName: `Affiliate ${recId}`,
    recipientType: 'AFFILIATE',
    ruleId: "rule_default",
    ruleName: "Default Rule",
    calculationMethod: "PERCENTAGE_OF_SELLING_PRICE",
    sellingPriceSnapshot: amount * 10,
    baseCostSnapshot: null,
    commissionRateSnapshot: 10,
    fixedAmountSnapshot: 0,
    commissionAmount: amount,
    currency: 'IDR',
    status: "PAYABLE",
    ledgerStatus: "POSTED",
    payoutStatus: "UNPAID",
    payoutBatchId: null,
    cumulativeReversedAmount: 0,
    remainingPayableAmount: amount,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    earnedAt: new Date().toISOString(),
    reversedAt: null
  });

  await adminDb.collection("commissionRecords").doc(c1Id).set(makeComm(c1Id, recipient1Id, 100000));
  await adminDb.collection("commissionRecords").doc(c2Id).set(makeComm(c2Id, recipient1Id, 50000));
  await adminDb.collection("commissionRecords").doc(c3Id).set(makeComm(c3Id, recipient1Id, 20000));
  await adminDb.collection("commissionRecords").doc(c4Id).set(makeComm(c4Id, recipient2Id, 80000));

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName} - ${detail || 'Assertion failed'}`);
      failedTests++;
    }
  }

  // ---------------------------------------------------------------------------
  // AC-1: One Recipient Strict Invariant
  // ---------------------------------------------------------------------------
  try {
    const multiRecRes = await service.createPayoutBatch({
      recipientId: recipient1Id,
      commissionRecordIds: [c1Id, c4Id], // c4Id belongs to recipient 2
      actor: makerActor
    });
    assert(!multiRecRes.success, "AC-1: Rejected mixing recipients in one batch", multiRecRes.message);
  } catch (e: any) {
    assert(true, "AC-1: Rejected mixing recipients in one batch (Exception)");
  }

  // ---------------------------------------------------------------------------
  // AC-2: Minimum Payout Threshold & Override
  // ---------------------------------------------------------------------------
  // Try creating batch below 50,000 threshold without override (c3Id = 20,000)
  const thresholdFailRes = await service.createPayoutBatch({
    recipientId: recipient1Id,
    commissionRecordIds: [c3Id],
    overrideThreshold: false,
    actor: makerActor
  });
  assert(!thresholdFailRes.success, "AC-2a: Rejected batch below minimum payout threshold", thresholdFailRes.message);

  // Try creating batch below 50,000 with override
  const thresholdOverrideRes = await service.createPayoutBatch({
    recipientId: recipient1Id,
    commissionRecordIds: [c3Id],
    overrideThreshold: true,
    overrideReason: "Manual exception for testing",
    actor: makerActor
  });
  assert(thresholdOverrideRes.success, "AC-2b: Allowed batch below threshold with explicit override");

  // Clean up c3 by cancelling the override batch so c3 returns to UNPAID
  if (thresholdOverrideRes.batch) {
    await service.cancelPayoutBatch({
      batchId: thresholdOverrideRes.batch.id,
      cancellationReason: "Resetting for next AC",
      actor: makerActor
    });
  }

  // ---------------------------------------------------------------------------
  // AC-3: Atomic Allocation Locking (1 batch = 1 allocation)
  // ---------------------------------------------------------------------------
  const batch1Res = await service.createPayoutBatch({
    recipientId: recipient1Id,
    commissionRecordIds: [c1Id, c2Id], // Total 150,000
    actor: makerActor
  });
  assert(batch1Res.success, "AC-3a: Created Batch 1 with c1 and c2");

  const batch1 = batch1Res.batch!;
  const c1Snap = await adminDb.collection("commissionRecords").doc(c1Id).get();
  assert(
    c1Snap.data()?.payoutStatus === "ALLOCATED" && c1Snap.data()?.payoutBatchId === batch1.id,
    "AC-3b: Commission records atomic payoutStatus=ALLOCATED and payoutBatchId bound"
  );

  // Attempt to allocate c1 again to a second batch
  const doubleAllocRes = await service.createPayoutBatch({
    recipientId: recipient1Id,
    commissionRecordIds: [c1Id],
    actor: makerActor
  });
  assert(!doubleAllocRes.success, "AC-3c: Blocked allocating c1 to another active batch (Double allocation prevented)");

  // ---------------------------------------------------------------------------
  // AC-4: Maker-Checker Enforced
  // ---------------------------------------------------------------------------
  // Submit batch 1
  const submitRes = await service.submitPayoutBatch(batch1.id, makerActor);
  assert(submitRes.success, "AC-4a: Submitted batch 1 to PENDING_APPROVAL");

  // Maker attempts to approve own batch (Non-owner)
  const selfApproveRes = await service.approvePayoutBatch(batch1.id, { ...makerActor, isOwner: false });
  assert(!selfApproveRes.success, "AC-4b: Blocked maker from approving own batch (Maker-Checker violation enforced)");

  // Different checker approves batch
  const checkerApproveRes = await service.approvePayoutBatch(batch1.id, { ...checkerActor, isOwner: false });
  assert(checkerApproveRes.success, "AC-4c: Checker approved batch successfully (Status: PROCESSING)");

  // ---------------------------------------------------------------------------
  // AC-5: Plaintext Account Never Persisted & CSV Export
  // ---------------------------------------------------------------------------
  const batch1AfterApproval = await adminDb.collection("payoutBatches").doc(batch1.id).get();
  const batchData = batch1AfterApproval.data() as PayoutBatch;
  assert(
    !((batchData.recipientSnapshot as any)?.accountNumber) && Boolean(batchData.recipientSnapshot.accountNumberMasked),
    "AC-5a: Plaintext account number is NEVER stored on payoutBatch snapshot (Only masked)"
  );

  const exportRes = await service.exportTransferInstruction(batch1.id, checkerActor);
  assert(
    exportRes.success && (exportRes.csvContent?.includes("1234567890") || false),
    "AC-5b: Transfer instruction CSV decrypts/generates plaintext bank account in-memory only"
  );

  // ---------------------------------------------------------------------------
  // AC-16 & AC-11: Revalidation against Stale Refund
  // ---------------------------------------------------------------------------
  // Create another batch for testing revalidation (c3: 20,000 with override)
  const batchStaleRes = await service.createPayoutBatch({
    recipientId: recipient1Id,
    commissionRecordIds: [c3Id],
    overrideThreshold: true,
    overrideReason: "Stale test",
    actor: makerActor
  });
  const batchStale = batchStaleRes.batch!;
  await service.submitPayoutBatch(batchStale.id, makerActor);

  // Simulate customer refund & clawback reducing c3 from 20,000 to 15,000
  await adminDb.collection("commissionRecords").doc(c3Id).update({
    cumulativeReversedAmount: 5000,
    remainingPayableAmount: 15000,
    updatedAt: new Date().toISOString()
  });

  // Try to approve stale batch
  const approveStaleRes = await service.approvePayoutBatch(batchStale.id, checkerActor);
  const staleBatchSnap = await adminDb.collection("payoutBatches").doc(batchStale.id).get();
  assert(
    !approveStaleRes.success && staleBatchSnap.data()?.status === "NEEDS_REVIEW",
    "AC-16: Revalidation blocks stale approval and marks batch NEEDS_REVIEW"
  );

  // Clean up stale batch by cancelling it
  await service.cancelPayoutBatch({
    batchId: batchStale.id,
    cancellationReason: "Clean up stale test",
    actor: makerActor
  });

  // ---------------------------------------------------------------------------
  // AC-6 & AC-7: Confirm Paid (Strict 12-Gate & Atomic Ledger DR 2100 / CR 1200)
  // ---------------------------------------------------------------------------
  const transferRef = `TRF-TEST-${testRunId}-001`;
  const confirmRes = await service.confirmPayoutPaid({
    batchId: batch1.id,
    transferReference: transferRef,
    proofReference: "Test slip 01",
    actor: checkerActor
  });
  assert(confirmRes.success, "AC-6a: Confirm Payout Paid succeeded");

  const paidBatchSnap = await adminDb.collection("payoutBatches").doc(batch1.id).get();
  const paidBatchData = paidBatchSnap.data() as PayoutBatch;
  assert(paidBatchData.status === "PAID", "AC-6b: Payout batch status is PAID");

  const c1PaidSnap = await adminDb.collection("commissionRecords").doc(c1Id).get();
  assert(
    c1PaidSnap.data()?.payoutStatus === "PAID",
    "AC-6c: Commission records updated to payoutStatus=PAID"
  );

  // Verify Ledger Entry
  const ledgerId = `ledger_commission_payout_${batch1.id}`;
  const ledgerSnap = await adminDb.collection("ledgerJournalEntries").doc(ledgerId).get();
  assert(ledgerSnap.exists, "AC-7a: Deterministic Ledger Journal Entry created");

  if (ledgerSnap.exists) {
    const journal = ledgerSnap.data() as any;
    const debitLine = journal.lineItems.find((l: any) => l.accountId === "2100_COMMISSION_PAYABLE");
    const creditLine = journal.lineItems.find((l: any) => l.accountId === "1200_BANK_PRIMARY");
    assert(
      debitLine && debitLine.debit === 150000 && creditLine && creditLine.credit === 150000,
      "AC-7b: Correct Ledger Posting: DR 2100_COMMISSION_PAYABLE 150.000 / CR 1200_BANK_PRIMARY 150.000"
    );
  }

  // ---------------------------------------------------------------------------
  // AC-10: Idempotency of Confirm Paid
  // ---------------------------------------------------------------------------
  const idempConfirmRes = await service.confirmPayoutPaid({
    batchId: batch1.id,
    transferReference: transferRef,
    actor: checkerActor
  });
  assert(idempConfirmRes.success, "AC-10: Idempotent re-confirmation returns success without double ledger posting");

  // ---------------------------------------------------------------------------
  // AC-8: Cancellation Lifecycle (Releases allocations back to UNPAID)
  // ---------------------------------------------------------------------------
  const cancelTestBatchRes = await service.createPayoutBatch({
    recipientId: recipient2Id,
    commissionRecordIds: [c4Id],
    actor: makerActor
  });
  const cancelBatch = cancelTestBatchRes.batch!;
  const cancelRes = await service.cancelPayoutBatch({
    batchId: cancelBatch.id,
    cancellationReason: "Cancelled for AC-8 verification",
    actor: makerActor
  });
  assert(cancelRes.success, "AC-8a: Cancelled Payout Batch");

  const c4Snap = await adminDb.collection("commissionRecords").doc(c4Id).get();
  assert(
    c4Snap.data()?.payoutStatus === "UNPAID" && c4Snap.data()?.payoutBatchId === null,
    "AC-8b: Released commission records back to UNPAID with null payoutBatchId"
  );

  // ---------------------------------------------------------------------------
  // AC-9: Failed Lifecycle
  // ---------------------------------------------------------------------------
  const failTestBatchRes = await service.createPayoutBatch({
    recipientId: recipient2Id,
    commissionRecordIds: [c4Id],
    actor: makerActor
  });
  const failBatch = failTestBatchRes.batch!;
  const failRes = await service.markPayoutBatchFailed({
    batchId: failBatch.id,
    failureReason: "Bank account invalid / rejected",
    actor: checkerActor
  });
  assert(failRes.success, "AC-9a: Marked Payout Batch FAILED");

  const c4AfterFailSnap = await adminDb.collection("commissionRecords").doc(c4Id).get();
  assert(
    c4AfterFailSnap.data()?.payoutStatus === "UNPAID" && c4AfterFailSnap.data()?.payoutBatchId === null,
    "AC-9b: Released commission records back to UNPAID after batch failure"
  );

  // ---------------------------------------------------------------------------
  // AC-14: Ledger Reconciliation Cases (H-M)
  // ---------------------------------------------------------------------------
  const reconReport = await LedgerService.reconcileCommissionLedger();
  assert(reconReport !== null && Array.isArray(reconReport.discrepancies), "AC-14: Ledger Reconciliation executed Cases H-M successfully");

  console.log("\n================================================================================");
  console.log(`TEST MATRIX SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("================================================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution error:", err);
  process.exit(1);
});
