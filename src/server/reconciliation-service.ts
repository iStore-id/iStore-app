import { OrderRepository } from "./supabase/order-repository.js";
import { ReconciliationRepository } from "./supabase/reconciliation-repository.js";
import { checkMidtransStatus } from "./midtrans.js";
import { transitionOrderState } from "./state-machine.js";
import { dispatchFulfillment } from "./fulfillment-dispatcher.js";
import { IncidentService } from "./incident-service.js";
import { AuditLogRepository } from "./supabase/audit-log-repository.js";
import * as crypto from "crypto";

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
  const orderRepo = OrderRepository.getInstance();
  const order = await orderRepo.getOrderById(orderId);
  if (!order) {
    throw new Error(`ORDER_NOT_FOUND: ${orderId}`);
  }

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
    // Generate deterministic incident ID: sha256(orderId + "_" + mismatchType) (We take first 32 chars to make a mock UUID if needed, but wait: recordId is uuid too!)
    // If it requires UUID format, we should use uuid version 5 or just standard uuid. 
    // Let's generate a proper UUID v5 based on the deterministic string, or just use crypto.randomUUID() if deterministic is strictly required...
    // The previous implementation used hex string from sha256 which is 64 chars. A standard UUID is 36 chars.
    // Let's use crypto.randomUUID() but try to look it up by orderId and type instead.
    
    const reconRepo = ReconciliationRepository.getInstance();
    // Since we need to look up an open incident, let's just create a new record if we don't have a good deterministic ID that is a UUID, or we can use UUIDv5.
    // However, since recordId was just for lookup, let's use UUIDv5 with a fixed namespace.
    const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';
    // If UUIDv5 isn't available easily without a library, we can just hash it and format as UUID:
    const hash = crypto.createHash("md5").update(`${orderId}_${resultType}`).digest("hex");
    recordId = `${hash.substring(0,8)}-${hash.substring(8,12)}-4${hash.substring(13,16)}-a${hash.substring(17,20)}-${hash.substring(20,32)}`;

    const recordData = await reconRepo.getRecordById(recordId);
    const now = new Date().toISOString();
    
    let currentRunId = runId;
    if (!currentRunId) {
      currentRunId = crypto.randomUUID();
      await reconRepo.createRun({
        id: currentRunId,
        executedBy: actorUid || 'system',
        startedAt: now,
        status: 'COMPLETED',
        totalOrdersScanned: 1,
        mismatchCount: 1
      });
    }

    if (recordData) {
      // Update incident
      await reconRepo.updateRecord(recordId, {
        runId: currentRunId,
        localState,
        providerState,
        expectedAmount,
        actualAmount
      });
    } else {
      // Create a new OPEN incident
      await reconRepo.createRecord({
        id: recordId,
        runId: currentRunId,
        orderId,
        type: resultType,
        resolutionStatus: 'OPEN',
        localState,
        providerState,
        expectedAmount,
        actualAmount,
        resolutionReason: message,
        createdAt: now
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
    await AuditLogRepository.getInstance().createLog({
      actor: { uid: "system", email: "system@reconciliation" },
      role: "system",
      action: "RECONCILIATION_DETECTION",
      target: `orders/${orderId}`,
      after: {
        reconciliationType: resultType,
        localState,
        providerState,
        expectedAmount,
        actualAmount,
        runId: runId || "manual",
        recordId
      },
      reason: `Reconciliation detection: ${resultType}`,
      timestamp: now
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
          const reconRepo = ReconciliationRepository.getInstance();
          await reconRepo.updateRecord(recordId, {
            resolutionStatus: 'RESOLVED',
            resolutionReason,
            resolvedAt: now
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
    const hashStatus = crypto.createHash("md5").update(`${orderId}_STATUS_MISMATCH`).digest("hex");
    const statusRecordId = `${hashStatus.substring(0,8)}-${hashStatus.substring(8,12)}-4${hashStatus.substring(13,16)}-a${hashStatus.substring(17,20)}-${hashStatus.substring(20,32)}`;
    
    const hashAmount = crypto.createHash("md5").update(`${orderId}_AMOUNT_MISMATCH`).digest("hex");
    const amountRecordId = `${hashAmount.substring(0,8)}-${hashAmount.substring(8,12)}-4${hashAmount.substring(13,16)}-a${hashAmount.substring(17,20)}-${hashAmount.substring(20,32)}`;

    const reconRepo = ReconciliationRepository.getInstance();
    for (const recId of [statusRecordId, amountRecordId]) {
      const recordData = await reconRepo.getRecordById(recId);
      if (recordData && recordData.resolutionStatus === 'OPEN') {
        const now = new Date().toISOString();
        await reconRepo.updateRecord(recId, {
          resolutionStatus: 'RESOLVED',
          resolutionReason: "Order reconciled successfully: status is now in sync",
          resolvedAt: now
        });
      }
    }
  }

  // Crash Recovery & TokoVoucher Reconciliation Check:
  // If order is PAID and in PROCESSING state, check TokoVoucher provider status if applicable
  const providerCode = order.providerId || "";
  if (localState === 'PROCESSING' && (providerCode === 'tokovoucher' || providerCode.toLowerCase().includes('tokovoucher'))) {
    try {
       const { getProvider } = await import("./providers");
       const tokoVoucherProvider = getProvider('tokovoucher');
       // Check status at TokoVoucher using orderId (ref_id)
       const checkResult = await tokoVoucherProvider.checkTransaction(orderId);
       
       if (checkResult.status === 'success') {
         console.log(`[Reconciliation TokoVoucher] Order ${orderId} confirmed SUCCESS at TokoVoucher. Transitioning...`);
         const payload: Record<string, any> = {};
         if (checkResult.serialNumber && checkResult.serialNumber !== "SN-FOUND" && checkResult.serialNumber !== "SN-RESOLVED") {
            payload.serialNumber = checkResult.serialNumber;
            payload.providerReference = checkResult.serialNumber;
         }
         await transitionOrderState(orderId, 'SUCCESS', payload, "Reconciliation: Confirmed success at TokoVoucher");
         resolution = 'AUTO_RESOLVED';
         message = "Transaksi TokoVoucher dikonfirmasi sukses oleh provider.";
       } else if (checkResult.status === 'failed') {
         console.log(`[Reconciliation TokoVoucher] Order ${orderId} confirmed FAILED at TokoVoucher. Transitioning...`);
         const reason = checkResult.message || "Provider reported failure";
         await transitionOrderState(orderId, 'FAILED', { reason }, "Reconciliation: Confirmed failure at TokoVoucher");
         resolution = 'AUTO_RESOLVED';
         message = "Transaksi TokoVoucher dikonfirmasi gagal oleh provider.";
       } else {
         console.log(`[Reconciliation TokoVoucher] Order ${orderId} remains PROCESSING at TokoVoucher.`);
       }
    } catch (tvErr: any) {
       console.error(`[Reconciliation TokoVoucher Error] Error checking status for ${orderId}:`, tvErr?.message || tvErr);
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
  const runId = crypto.randomUUID();
  const reconRepo = ReconciliationRepository.getInstance();
  
  await reconRepo.createRun({
    id: runId,
    executedBy: actorUid,
    startedAt,
    status: "RUNNING",
    totalOrdersScanned: 0,
    mismatchCount: 0
  });
  
  try {
    // Query recent pending orders to scan
    const orderRepo = OrderRepository.getInstance();
    const recentOrders = await orderRepo.getRecentOrders(100);
      
    let totalOrdersScanned = 0;
    
    const { JobService } = await import("./job-service");
    const jobService = JobService.getInstance();

    for (const order of recentOrders) {
      totalOrdersScanned++;
      const orderId = order.id;
      
      await jobService.enqueue({
        type: 'RECONCILIATION',
        payload: { orderId, runId },
        priority: 'LOW',
        referenceId: orderId,
        idempotencyKey: `reconciliation_${orderId}_${runId}`
      });
    }
    
    const completedAt = new Date().toISOString();
    await reconRepo.updateRun(runId, {
      status: "COMPLETED",
      completedAt,
      totalOrdersScanned,
      mismatchCount: 0 // Will be determined by individual jobs
    });
    
    return { runId, totalOrdersScanned, status: "ENQUEUED" };
  } catch (err: any) {
    console.error("[Reconciliation Batch Error]", err);
    await reconRepo.updateRun(runId, {
      status: "FAILED",
      completedAt: new Date().toISOString()
    });
    throw err;
  }
}
