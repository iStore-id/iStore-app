import { supabaseAdmin } from "./supabase-admin.js";
import * as crypto from "crypto";

export interface EnqueueJobOptions {
  type: string;
  payload?: any;
  priority?: 'HIGH' | 'NORMAL' | 'LOW';
  referenceId?: string;
  idempotencyKey?: string;
  maxAttempts?: number;
  scheduledAt?: string;
}

export class JobService {
  private static instance: JobService;
  private isProcessing = false;
  private workerTimer: NodeJS.Timeout | null = null;
  private lastHeartbeatTime: string | null = null;
  private memoryJobs = new Map<string, any>();

  private constructor() {}

  static getInstance(): JobService {
    if (!JobService.instance) {
      JobService.instance = new JobService();
    }
    return JobService.instance;
  }

  /**
   * Enqueue a durable job into public.jobs with deterministic idempotency.
   */
  async enqueue(typeOrConfig: string | EnqueueJobOptions, payload?: any): Promise<string> {
    let type: string;
    let jobPayload: any;
    let priority: 'HIGH' | 'NORMAL' | 'LOW' = 'NORMAL';
    let referenceId: string | undefined = undefined;
    let idempotencyKey: string | undefined = undefined;
    let maxAttempts = 5;
    let scheduledAt = new Date().toISOString();

    if (typeof typeOrConfig === 'string') {
      type = typeOrConfig;
      jobPayload = payload || {};
      referenceId = jobPayload?.orderId || jobPayload?.payload?.commissionId || jobPayload?.commissionId;
      idempotencyKey = jobPayload?.idempotencyKey;
      if (jobPayload?.priority) priority = jobPayload.priority;
    } else {
      type = typeOrConfig.type;
      jobPayload = typeOrConfig.payload || {};
      priority = typeOrConfig.priority || 'NORMAL';
      referenceId = typeOrConfig.referenceId || jobPayload?.orderId;
      idempotencyKey = typeOrConfig.idempotencyKey;
      if (typeOrConfig.maxAttempts) maxAttempts = typeOrConfig.maxAttempts;
      if (typeOrConfig.scheduledAt) scheduledAt = typeOrConfig.scheduledAt;
    }

    if (!idempotencyKey) {
      idempotencyKey = referenceId ? `${type}:${referenceId}` : `${type}:${crypto.randomUUID()}`;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const jobRow = {
      id,
      type,
      status: 'QUEUED',
      priority,
      attempts: 0,
      max_attempts: maxAttempts,
      payload: jobPayload,
      reference_id: referenceId || null,
      idempotency_key: idempotencyKey,
      scheduled_at: scheduledAt,
      created_at: now,
      updated_at: now
    };

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from("jobs")
        .insert(jobRow)
        .select("id")
        .maybeSingle();

      if (error) {
        // Unique constraint violation on idempotency_key (Postgres error code 23505)
        if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique') || error.message?.includes('idempotency_key')) {
          const { data: existing } = await supabaseAdmin
            .from("jobs")
            .select("id, status")
            .eq("idempotency_key", idempotencyKey)
            .maybeSingle();
          
          if (existing) {
            const terminalStates = ['FAILED', 'DEAD_LETTER', 'CANCELLED'];
            const isPeriodic = type === 'INVENTORY_CLEANUP';
            
            if (terminalStates.includes(existing.status) || (isPeriodic && existing.status === 'SUCCEEDED')) {
              console.log(`[JobService] Reviving ${isPeriodic ? 'periodic ' : ''}job '${existing.id}' with key '${idempotencyKey}' (current status: ${existing.status})`);
              // Atomic update: only update if status is still terminal/succeeded to prevent racing workers from resetting a processing job
              await supabaseAdmin
                .from("jobs")
                .update({ 
                  status: 'QUEUED', 
                  attempts: 0, 
                  last_error: null,
                  scheduled_at: now, // Run now on revival
                  updated_at: now 
                })
                .eq("id", existing.id)
                .in("status", [...terminalStates, 'SUCCEEDED']);
            } else {
              console.log(`[JobService] Job with idempotency key '${idempotencyKey}' already enqueued (status: ${existing.status}). Skipping revival.`);
            }
            return existing.id;
          }
          return id;
        }
        console.error(`[JobService] Failed to insert job '${type}':`, error.message);
        throw new Error(`Failed to enqueue job: ${error.message}`);
      }
    } else {
      if (this.memoryJobs.has(idempotencyKey)) {
        return this.memoryJobs.get(idempotencyKey).id;
      }
      this.memoryJobs.set(idempotencyKey, jobRow);
      console.warn("[JobService] Supabase admin not configured. Job enqueue running in memory/deferred.");
    }

    // Trigger inline execution attempt for immediate processing in current request context
    this.processNextJob().catch(err => {
      console.warn("[JobService] Inline job processing notification:", err?.message || err);
    });

    return id;
  }

  async enqueueJob(type: string, payload: any): Promise<string> {
    return this.enqueue(type, payload);
  }

  /**
   * Authoritative claim via public.claim_next_job() RPC in Postgres (FOR UPDATE SKIP LOCKED).
   * Concurrency-safe and strictly transactional.
   */
  async claimNextJob(workerId: string, staleAfterSeconds = 600): Promise<any | null> {
    if (!supabaseAdmin) return null;

    try {
      const { data, error } = await supabaseAdmin.rpc('claim_next_job', {
        p_worker_id: workerId,
        p_stale_after_seconds: staleAfterSeconds
      });

      if (error) {
        console.error("[JobService] claim_next_job RPC error:", error.message);
        return null;
      }

      if (!data) return null;

      if (Array.isArray(data)) {
        return data.length > 0 ? data[0] : null;
      }

      return (typeof data === 'object' && data.id) ? data : null;
    } catch (err: any) {
      console.error("[JobService] Exception during claim_next_job RPC:", err.message);
      return null;
    }
  }

  /**
   * Worker processes a single claimed job
   */
  async processNextJob(customWorkerId?: string): Promise<boolean> {
    if (this.isProcessing) return false;
    this.isProcessing = true;

    const workerId = customWorkerId || `worker_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    try {
      const job = await this.claimNextJob(workerId);
      if (!job) {
        return false;
      }

      this.lastHeartbeatTime = new Date().toISOString();
      const jobId = job.id;
      const jobType = job.type;
      const attempts = Number(job.attempts || 1);
      const maxAttempts = Number(job.max_attempts || job.maxAttempts || 5);

      console.log(`[JobService] Claimed job ${jobId} (type: ${jobType}, attempt: ${attempts}/${maxAttempts}) by worker ${workerId}`);

      let success = false;
      let executionError: any = null;

      try {
        if (jobType === 'FULFILLMENT') {
          const orderId = String(job.payload?.orderId || job.reference_id || job.referenceId || '').trim();
          if (!orderId) {
            throw new Error(`FULFILLMENT job ${jobId} has missing orderId in payload.`);
          }

          const { OrderRepository } = await import("./supabase/order-repository.js");
          let order = await OrderRepository.getInstance().getOrderById(orderId);
          let txStatus = (order?.transactionStatus || '').toLowerCase();

          if (txStatus === 'processing') {
            const { reconcileOrder } = await import("./reconciliation-service.js");
            await reconcileOrder(orderId, "system");
            // Re-read after reconciliation
            order = await OrderRepository.getInstance().getOrderById(orderId);
            txStatus = (order?.transactionStatus || '').toLowerCase();
          }

          if (txStatus === 'pending') {
            const { dispatchFulfillment } = await import("./fulfillment-dispatcher.js");
            await dispatchFulfillment(orderId);
            // Re-read after dispatch
            order = await OrderRepository.getInstance().getOrderById(orderId);
            txStatus = (order?.transactionStatus || '').toLowerCase();
          }

          if (txStatus === 'success') {
            success = true;
          } else if (txStatus === 'failed') {
            const failureReason = order?.failureReason || (order?.fulfillmentResponse as any)?.message || 'Permanent fulfillment failure';
            const permErr: any = new Error(`FULFILLMENT_PERMANENT_FAILED: ${failureReason}`);
            permErr.isPermanent = true;
            throw permErr;
          } else {
            // Still in PROCESSING or PENDING (e.g. pending async provider callback or transient timeout)
            const responseMsg = (order?.fulfillmentResponse as any)?.message || 'Pending provider verification';
            throw new Error(`FULFILLMENT_NOT_FINALIZED: Order ${orderId} remains in ${txStatus} (${responseMsg})`);
          }
        } else if (jobType === 'QUOTA_RELEASE') {
          const orderId = String(job.payload?.orderId || job.reference_id || job.referenceId || '').trim();
          if (!orderId) throw new Error("QUOTA_RELEASE job missing orderId");

          const { PromoService } = await import("./promo-service.js");
          const { FlashSaleService } = await import("./flash-sale-service.js");

          // Attempt both - RPCs are idempotent. Pass isWorker: true to avoid recursion.
          await PromoService.getInstance().releaseUsage(orderId, { isWorker: true });
          await FlashSaleService.getInstance().releaseQuota(orderId, { isWorker: true });

          success = true;
        } else if (jobType === 'PAYMENT_LEDGER_RETRY') {
          const orderId = job.payload?.orderId || job.reference_id;
          const orderData = job.payload?.orderData;
          const createdBy = job.payload?.createdBy || 'SYSTEM_RETRY';
          const metadata = job.payload?.metadata;
          
          if (!orderId || !orderData) {
            throw new Error(`PAYMENT_LEDGER_RETRY job ${jobId} missing orderId or orderData in payload.`);
          }

          const { safeRecordPaymentReceived } = await import("./ledger-service.js");
          await safeRecordPaymentReceived(orderId, orderData, createdBy, metadata, { isWorker: true });
          
          success = true;
        } else if (jobType === 'PROCESS_REFERRAL') {
          const orderId = job.payload?.payload?.orderId;
          if (!orderId) throw new Error("PROCESS_REFERRAL job missing orderId");
          
          const { OrderRepository } = await import("./supabase/order-repository.js");
          const orderData = await OrderRepository.getInstance().getOrderById(orderId);
          if (!orderData) throw new Error(`Order ${orderId} not found`);

          const { ReferralService } = await import("./referral-service.js");
          await ReferralService.getInstance().qualifyReferral(orderId, orderData, { isWorker: true });

          success = true;
        } else if (jobType === 'INVENTORY_CLEANUP') {
          const { InventoryService } = await import("./inventory-service.js");
          const result = await InventoryService.getInstance().releaseExpiredReservations();
          console.log(`[JobService] Inventory cleanup processed ${result.processedCount} expired reservations.`);
          success = true;
        } else if (
          jobType === 'PROCESS_COMMISSION' ||
          jobType === 'COMMISSION_LEDGER_POST' ||
          jobType === 'COMMISSION_LEDGER_REVERSAL_POST' ||
          jobType === 'COMMISSION_PAYOUT_LEDGER_POST'
        ) {
          const subType = job.payload?.type || jobType;
          const data = job.payload?.payload || job.payload || {};

          const commRepo = await import("./commission-repository.js");
          const ledgerService = await import("./ledger-service.js");

          if (subType === 'COMMISSION_LEDGER_POST') {
            const commissionId = data.commissionId;
            if (!commissionId) throw new Error("Missing commissionId in payload for COMMISSION_LEDGER_POST");
            const record = await commRepo.getRecordById(commissionId);
            if (!record) throw new Error(`Commission record ${commissionId} not found`);
            if (record.ledgerStatus !== 'POSTED') {
              const ledgerResult = await ledgerService.recordCommissionAccrual(record, "SYSTEM");
              await commRepo.updateRecord(commissionId, {
                ledgerStatus: "POSTED",
                ledgerJournalId: ledgerResult.docId,
                ledgerPostedAt: new Date().toISOString()
              });
            }
            success = true;
          } else if (subType === 'COMMISSION_LEDGER_REVERSAL_POST') {
            const { commissionId, refundKey, deltaReversal } = data;
            if (!commissionId || !refundKey) {
              throw new Error("Missing commissionId or refundKey in payload for COMMISSION_LEDGER_REVERSAL_POST");
            }
            const fullRecord = await commRepo.getRecordById(commissionId);
            if (!fullRecord) throw new Error(`Commission record ${commissionId} not found`);
            await ledgerService.safeRecordCommissionAccrualReversal(
              fullRecord,
              refundKey,
              deltaReversal,
              "SYSTEM",
              { orderId: fullRecord.orderId }
            );
            success = true;
          } else if (subType === 'COMMISSION_PAYOUT_LEDGER_POST') {
            const { payoutBatchId } = data;
            if (!payoutBatchId) throw new Error("Missing payoutBatchId in payload for COMMISSION_PAYOUT_LEDGER_POST");
            const batch = await commRepo.getPayoutBatchById(payoutBatchId);
            if (!batch) throw new Error(`Payout batch ${payoutBatchId} not found`);
            if (!batch.ledgerJournalId && !(batch as any).ledger_journal_id) {
              const ledgerResult = await ledgerService.recordCommissionPayout(batch, "system@istore.co.id");
              await commRepo.updatePayoutBatchStatus(payoutBatchId, {
                ledger_journal_id: ledgerResult.docId,
                updated_at: new Date().toISOString()
              });
            }
            success = true;
          } else {
            throw new Error(`UNKNOWN_COMMISSION_SUBTYPE: Unhandled commission job subtype '${subType}'`);
          }
        } else {
          // Strictly reject unknown/unregistered job types - NEVER mark as SUCCEEDED without execution
          throw new Error(`UNSUPPORTED_JOB_TYPE: No worker handler registered for job type '${jobType}'. Job halted.`);
        }
      } catch (err: any) {
        executionError = err;
        console.error(`[JobService] Execution failed for job ${jobId} (type: ${jobType}):`, err?.message || err);
      }

      const now = new Date().toISOString();

      if (success) {
        const isPeriodic = jobType === 'INVENTORY_CLEANUP';
        
        if (isPeriodic) {
          // Durable Rescheduling: Instead of SUCCEEDED, move back to QUEUED with future scheduled_at
          await supabaseAdmin!
            .from("jobs")
            .update({
              status: 'QUEUED',
              attempts: 0,
              scheduled_at: new Date(Date.now() + 60000).toISOString(), // 1 minute interval
              last_error: null,
              locked_at: null,
              locked_by: null,
              updated_at: now
            })
            .eq("id", jobId);
          
          console.log(`[JobService] Periodic job ${jobId} (${jobType}) rescheduled for 1 minute later.`);
        } else {
          await supabaseAdmin!
            .from("jobs")
            .update({
              status: 'SUCCEEDED',
              completed_at: now,
              locked_at: null,
              locked_by: null,
              updated_at: now
            })
            .eq("id", jobId);

          console.log(`[JobService] Job ${jobId} (type: ${jobType}) marked as SUCCEEDED.`);
        }
      } else {
        const errorMsg = executionError?.message || 'Unknown execution error';
        const isPermanent = Boolean(executionError?.isPermanent) || attempts >= maxAttempts;
        const isPeriodic = jobType === 'INVENTORY_CLEANUP';

        if (isPermanent) {
          if (isPeriodic) {
            // Periodic jobs must never truly die. Reschedule for next cycle even on permanent failure.
            await supabaseAdmin!
              .from("jobs")
              .update({
                status: 'QUEUED',
                attempts: 0,
                scheduled_at: new Date(Date.now() + 60000).toISOString(),
                last_error: `Permanent Failure: ${errorMsg}`,
                locked_at: null,
                locked_by: null,
                updated_at: now
              })
              .eq("id", jobId);
            
            console.error(`[JobService] Periodic job ${jobId} reached max attempts. Rescheduled for next cycle.`);
          } else {
            await supabaseAdmin!
              .from("jobs")
              .update({
                status: 'DEAD_LETTER',
                last_error: errorMsg,
                locked_at: null,
                locked_by: null,
                updated_at: now
              })
              .eq("id", jobId);

            console.error(`[JobService] Job ${jobId} moved to DEAD_LETTER (permanent failure or exceeded max attempts ${maxAttempts}): ${errorMsg}`);
          }
        } else {
          // Exponential backoff: 60s, 300s, 900s, 1800s
          const backoffIntervals = [60, 300, 900, 1800];
          const delaySec = backoffIntervals[Math.min(attempts - 1, backoffIntervals.length - 1)] || 60;
          const nextRetryDate = new Date(Date.now() + delaySec * 1000).toISOString();

          await supabaseAdmin!
            .from("jobs")
            .update({
              status: 'RETRYING',
              next_retry_at: nextRetryDate,
              last_error: errorMsg,
              locked_at: null,
              locked_by: null,
              updated_at: now
            })
            .eq("id", jobId);

          console.warn(`[JobService] Job ${jobId} set to RETRYING at ${nextRetryDate} (attempt ${attempts}/${maxAttempts}): ${errorMsg}`);
        }
      }

      return true;
    } finally {
      this.isProcessing = false;
    }
  }

  async processBatch(maxJobs = 5): Promise<number> {
    let processed = 0;
    for (let i = 0; i < maxJobs; i++) {
      const hasProcessed = await this.processNextJob();
      if (!hasProcessed) break;
      processed++;
    }
    return processed;
  }

  startWorkerLoop(intervalMs = 5000): void {
    if (process.env.VERCEL === "1") {
      console.log("[JobService] Vercel serverless environment detected. Long-lived worker loop skipped.");
      return;
    }

    if (this.workerTimer) return;

    console.log(`[JobService] Starting background queue worker loop (interval: ${intervalMs}ms)...`);
    
    // Durable Cleanup Bootstrapper: Ensure the periodic job exists in the queue.
    // It will self-perpetuate upon successful execution.
    this.enqueue({
      type: 'INVENTORY_CLEANUP',
      priority: 'LOW',
      idempotencyKey: 'inventory_cleanup_periodic_singleton'
    }).catch(err => {
      console.error("[JobService] Failed to bootstrap periodic inventory cleanup:", err.message);
    });

    this.workerTimer = setInterval(() => {
      this.processBatch(3).catch(err => {
        console.warn("[JobService] Periodic worker loop error:", err?.message || err);
      });
    }, intervalMs);
  }

  stopWorkerLoop(): void {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
      console.log("[JobService] Stopped background queue worker loop.");
    }
  }

  async getLastHeartbeat(): Promise<string | null> {
    return this.lastHeartbeatTime;
  }

  async getQueueStats(): Promise<Record<string, number>> {
    if (!supabaseAdmin) return {};

    try {
      const { data, error } = await supabaseAdmin
        .from("jobs")
        .select("status");

      if (error || !data) return {};

      const stats: Record<string, number> = {
        QUEUED: 0,
        PROCESSING: 0,
        SUCCEEDED: 0,
        RETRYING: 0,
        FAILED: 0,
        DEAD_LETTER: 0,
        CANCELLED: 0
      };

      for (const row of data) {
        const s = row.status || 'UNKNOWN';
        stats[s] = (stats[s] || 0) + 1;
      }

      return stats;
    } catch {
      return {};
    }
  }

  async getJobs(limit = 50): Promise<any[]> {
    if (!supabaseAdmin) return [];
    const { data } = await supabaseAdmin
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    return data || [];
  }

  async markJobFailed(id: string, reason: string): Promise<void> {
    if (!supabaseAdmin) return;
    await supabaseAdmin
      .from("jobs")
      .update({
        status: "FAILED",
        last_error: reason,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);
  }
}
