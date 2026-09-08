import { adminDb } from "./firebase-admin";
import { checkMidtransStatus } from "./midtrans";
import { transitionOrderState } from "./state-machine";
import { dispatchFulfillment } from "./fulfillment-dispatcher";
import { IncidentService } from "./incident-service";
import crypto from "crypto";

export interface ReconcileResult {
  orderId: string;
  localState: string;
  providerState: string | null;
  resultType: 'MATCHED' | 'STATUS_MISMATCH' | 'AMOUNT_MISMATCH';
  resolution: 'NO_OP' | 'AUTO_RESOLVED' | 'MANUAL_REVIEW';
  message: string;
  recordId?: string;
}

export async function reconcileOrder(
  orderId: string, 
  actorUid: string | null = null, 
  runId: string | null = null
): Promise<ReconcileResult> {
  // 1. Load Order
  const orderRef = adminDb.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    throw new Error(`ORDER_NOT_FOUND: ${orderId}`);
  }
  const order = orderSnap.data()!;

  // Determine local logical state (consistent with state-machine.ts)
  let localState = 'UNKNOWN';
  if (order.paymentStatus === 'pending') localState = 'PENDING_PAYMENT';
  else if (order.paymentStatus === 'paid' && order.transactionStatus === 'pending') localState = 'PAID';
  else if (order.transactionStatus === 'processing') localState = 'PROCESSING';
  else if (order.transactionStatus === 'success') localState = 'SUCCESS';
  else if (order.transactionStatus === 'failed' || order.paymentStatus === 'failed') localState = 'FAILED';
  else if (order.paymentStatus === 'expired') localState = 'EXPIRED';

  // 2. Fetch Midtrans Status (Outside transaction)
  let midtransData: any = null;
  try {
    midtransData = await checkMidtransStatus(orderId);
  } catch (err) {
    console.error(`[Reconciliation] Error fetching Midtrans status for ${orderId}:`, err);
  }

  const providerState = midtransData ? midtransData.transaction_status : null;
  const expectedAmount = order.totalAmount || 0;
  const actualAmount = midtransData ? parseFloat(midtransData.gross_amount) : 0;

  let resultType: 'MATCHED' | 'STATUS_MISMATCH' | 'AMOUNT_MISMATCH' = 'MATCHED';
  let resolution: 'NO_OP' | 'AUTO_RESOLVED' | 'MANUAL_REVIEW' = 'NO_OP';
  let message = "Order is in sync.";

  // 3. Evaluate Status & Amount
  if (midtransData) {
    // Check Amount Mismatch
    if (actualAmount !== expectedAmount) {
      resultType = 'AMOUNT_MISMATCH';
      resolution = 'MANUAL_REVIEW';
      message = `Nominal tidak cocok. iStore: ${expectedAmount}, Midtrans: ${actualAmount}`;
    } else {
      // Evaluate Status Match
      if (localState === 'PENDING_PAYMENT') {
        if (providerState === 'settlement' || providerState === 'capture') {
          // Verify fraud status accept if capture
          const isAccepted = providerState !== 'capture' || midtransData.fraud_status === 'accept';
          if (isAccepted) {
            resultType = 'STATUS_MISMATCH';
            resolution = 'AUTO_RESOLVED';
            message = "Transaksi lunas di Midtrans, memerlukan Auto-Resolve ke PAID.";
          } else {
            resultType = 'STATUS_MISMATCH';
            resolution = 'MANUAL_REVIEW';
            message = "Transaksi capture menantang (fraud challenge). Perlu tinjauan manual.";
          }
        } else if (providerState === 'expire') {
          resultType = 'STATUS_MISMATCH';
          resolution = 'AUTO_RESOLVED';
          message = "Transaksi kedaluwarsa di Midtrans, memerlukan Auto-Resolve ke EXPIRED.";
        } else if (providerState === 'cancel' || providerState === 'deny') {
          resultType = 'STATUS_MISMATCH';
          resolution = 'MANUAL_REVIEW';
          message = `Transaksi dibatalkan/ditolak di Midtrans (${providerState}). Perlu resolusi manual.`;
        }
      } else if (localState === 'PAID') {
        if (providerState !== 'settlement' && providerState !== 'capture') {
          resultType = 'STATUS_MISMATCH';
          resolution = 'MANUAL_REVIEW';
          message = `Anomali status: Lokal PAID, Midtrans ${providerState}.`;
        }
      } else if (localState === 'PROCESSING') {
        if (providerState === 'failed' || providerState === 'cancel' || providerState === 'deny') {
          resultType = 'STATUS_MISMATCH';
          resolution = 'MANUAL_REVIEW';
          message = `Transaksi dibatalkan di Midtrans (${providerState}) saat sedang PROCESSING.`;
        }
      } else if (localState === 'SUCCESS' || localState === 'FAILED' || localState === 'EXPIRED') {
        // Terminal states should generally match or stay terminal
        if (localState === 'FAILED' && (providerState === 'settlement' || providerState === 'capture')) {
          resultType = 'STATUS_MISMATCH';
          resolution = 'MANUAL_REVIEW';
          message = "Celah finansial: Pesanan FAILED tetapi Midtrans lunas (settlement).";
        } else if (localState === 'EXPIRED' && (providerState === 'settlement' || providerState === 'capture')) {
          resultType = 'STATUS_MISMATCH';
          resolution = 'MANUAL_REVIEW';
          message = "Celah finansial: Pesanan EXPIRED tetapi Midtrans lunas (settlement).";
        }
      }
    }
  } else {
    // Midtrans returns null (Not found)
    if (localState !== 'PENDING_PAYMENT') {
      resultType = 'STATUS_MISMATCH';
      resolution = 'MANUAL_REVIEW';
      message = "Transaksi lunas di iStore tetapi tidak ditemukan di Midtrans.";
    }
  }

  // 4. Handle Persisted Incidents & Deterministic Idempotency Key
  let recordId: string | undefined;

  if (resultType !== 'MATCHED') {
    // Generate deterministic incident ID: sha256(orderId + "_" + mismatchType)
    recordId = crypto.createHash("sha256")
      .update(`${orderId}_${resultType}`)
      .digest("hex");

    const recordRef = adminDb.collection("reconciliationRecords").doc(recordId);
    const recordSnap = await recordRef.get();
    const now = new Date().toISOString();

    if (recordSnap.exists) {
      // Update lastCheckedAt to keep single incident track
      await recordRef.update({
        runId: runId || "manual",
        localState,
        providerState,
        expectedAmount,
        actualAmount,
        lastCheckedAt: now,
        updatedAt: now
      });
    } else {
      // Create a new OPEN incident
      await recordRef.set({
        id: recordId,
        runId: runId || "manual",
        orderId,
        type: resultType,
        resolutionStatus: 'OPEN',
        localState,
        providerState,
        expectedAmount,
        actualAmount,
        firstDetectedAt: now,
        lastCheckedAt: now,
        createdAt: now,
        updatedAt: now
      });
    }

    // Also report to centralized IncidentService if it's a critical mismatch
    if (resolution === 'MANUAL_REVIEW') {
      const incidentService = IncidentService.getInstance();
      incidentService.reportIncident({
        title: `Reconciliation Mismatch: ${orderId}`,
        description: `Mismatch detected for order ${orderId}. Type: ${resultType}. Message: ${message}`,
        severity: 'MEDIUM',
        category: 'RECONCILIATION',
        source: 'RECONCILIATION_SERVICE',
        sourceKey: `recon:${orderId}:${resultType}`,
        component: 'reconciliation',
        metadataSafe: { orderId, resultType, message, localState, providerState, expectedAmount, actualAmount }
      }).catch(err => console.error("[ReconService] Incident report error:", err));
    }

    // Write detection log
    const auditLogRef = adminDb.collection("auditLogs").doc();
    await auditLogRef.set({
      id: auditLogRef.id,
      action: "RECONCILIATION_DETECTION",
      resource: "orders",
      resourceId: orderId,
      payload: {
        reconciliationType: resultType,
        localState,
        providerState,
        expectedAmount,
        actualAmount,
        runId: runId || "manual",
        recordId
      },
      createdAt: now
    });
  }

  // 5. Auto-Resolution Implementation (Only approved safe transitions)
  if (resolution === 'AUTO_RESOLVED' && resultType === 'STATUS_MISMATCH') {
    let newState: 'PAID' | 'EXPIRED' | null = null;
    if (providerState === 'settlement' || providerState === 'capture') {
      newState = 'PAID';
    } else if (providerState === 'expire') {
      newState = 'EXPIRED';
    }

    if (newState) {
      try {
        const resolutionReason = `System Auto-Reconciliation: resolved ${localState} to ${newState} based on Midtrans status (${providerState})`;
        
        // Execute state transition atomically
        await transitionOrderState(orderId, newState, {}, resolutionReason);

        if (newState === 'PAID') {
          console.log(`[Reconciliation Auto-Resolve] Enqueueing fulfillment job for order ${orderId}`);
          try {
             const { JobService } = await import("./job-service");
             await JobService.getInstance().enqueue({
                type: 'FULFILLMENT',
                payload: { orderId },
                priority: 'NORMAL',
                referenceId: orderId,
                idempotencyKey: `fulfillment_${orderId}`
             });
          } catch (e) {
             console.error("[Queue] Failed to enqueue fulfillment job during reconciliation", e);
          }
        }

        resolution = 'AUTO_RESOLVED';
        message += ` [AUTOMATICALLY RESOLVED TO ${newState}]`;

        // Update reconciliation record to RESOLVED
        if (recordId) {
          const now = new Date().toISOString();
          const recordRef = adminDb.collection("reconciliationRecords").doc(recordId);
          await recordRef.update({
            resolutionStatus: 'RESOLVED',
            resolutionAction: 'AUTO_RESOLVE',
            resolutionReason,
            actorUid: 'system',
            resolvedAt: now,
            updatedAt: now
          });
        }
      } catch (transitionErr: any) {
        console.error(`[Reconciliation Auto-Resolve Error] Failed to transition ${orderId} to ${newState}:`, transitionErr);
        resolution = 'MANUAL_REVIEW';
        message += ` [Auto-Resolve Failed: ${transitionErr.message}]`;
      }
    }
  }

  // 6. If previously open incident is now MATCHED (e.g. solved manually or via webhook afterward), mark it RESOLVED
  if (resultType === 'MATCHED') {
    // Check both potential mismatch records for this order to mark them RESOLVED if they exist and are OPEN
    const statusRecordId = crypto.createHash("sha256").update(`${orderId}_STATUS_MISMATCH`).digest("hex");
    const amountRecordId = crypto.createHash("sha256").update(`${orderId}_AMOUNT_MISMATCH`).digest("hex");

    for (const recId of [statusRecordId, amountRecordId]) {
      const recordRef = adminDb.collection("reconciliationRecords").doc(recId);
      const recordSnap = await recordRef.get();
      if (recordSnap.exists && recordSnap.data()?.resolutionStatus === 'OPEN') {
        const now = new Date().toISOString();
        await recordRef.update({
          resolutionStatus: 'RESOLVED',
          resolutionAction: 'AUTO_RESOLVE',
          resolutionReason: "Order reconciled successfully: status is now in sync",
          actorUid: 'system',
          resolvedAt: now,
          updatedAt: now
        });
      }
    }
  }

  // Crash Recovery: If order is already PAID but pending fulfillment (e.g. server crashed after PAID in previous execution)
  if (localState === 'PAID' && (order.transactionStatus || 'pending') === 'pending') {
    console.log(`[Reconciliation Recovery] Found PAID order ${orderId} with pending fulfillment. Enqueueing job...`);
    try {
       const { JobService } = await import("./job-service");
       await JobService.getInstance().enqueue({
          type: 'FULFILLMENT',
          payload: { orderId },
          priority: 'NORMAL',
          referenceId: orderId,
          idempotencyKey: `fulfillment_${orderId}`
       });
    } catch (e) {
       console.error("[Queue] Failed to enqueue fulfillment job during recovery", e);
    }
    resolution = 'AUTO_RESOLVED';
    message = "Pesanan lunas terdeteksi menggantung. Pekerjaan pemenuhan telah dijadwalkan ulang.";
  }

  return {
    orderId,
    localState,
    providerState,
    resultType,
    resolution,
    message,
    recordId
  };
}

export async function runReconciliationBatch(actorUid: string): Promise<any> {
  const startedAt = new Date().toISOString();
  const runId = `run_${crypto.randomBytes(8).toString("hex")}`;
  
  const runRef = adminDb.collection("reconciliationRuns").doc(runId);
  await runRef.set({
    id: runId,
    executedBy: actorUid,
    startedAt,
    completedAt: "",
    status: "RUNNING",
    totalOrdersScanned: 0,
    mismatchCount: 0,
    createdAt: startedAt
  });
  
  try {
    // Query recent pending orders to scan
    const ordersSnap = await adminDb.collection("orders")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
      
    let totalOrdersScanned = 0;
    let mismatchCount = 0;
    
    const { JobService } = await import("./job-service");
    const jobService = JobService.getInstance();

    for (const doc of ordersSnap.docs) {
      totalOrdersScanned++;
      const orderId = doc.id;
      
      await jobService.enqueue({
        type: 'RECONCILIATION',
        payload: { orderId, runId },
        priority: 'LOW',
        referenceId: orderId,
        idempotencyKey: `reconciliation_${orderId}_${runId}`
      });
    }
    
    const completedAt = new Date().toISOString();
    await runRef.update({
      status: "COMPLETED",
      completedAt,
      totalOrdersScanned,
      mismatchCount: 0 // Will be determined by individual jobs
    });
    
    return { runId, totalOrdersScanned, status: "ENQUEUED" };
  } catch (err: any) {
    console.error("[Reconciliation Batch Error]", err);
    await runRef.update({
      status: "FAILED",
      completedAt: new Date().toISOString()
    });
    throw err;
  }
}
