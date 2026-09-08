import { adminDb } from "./firebase-admin";
import { Job, JobStatus, JobPriority } from "../types/core";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { BusinessCalendarService } from "./business-calendar-service";
import { NotificationService } from "./notification-service";
import { IncidentService } from "./incident-service";

export class JobService {
  private static instance: JobService;
  private calendarService = BusinessCalendarService.getInstance();
  private notificationService = NotificationService.getInstance();
  private incidentService = IncidentService.getInstance();
  private lastHeartbeat: string | null = null;
  private workerTimer: NodeJS.Timeout | null = null;
  private currentIntervalMs: number = 30000;
  private readonly maxIntervalMs: number = 180000; // 3 minutes max backoff

  private constructor() {}

  static getInstance(): JobService {
    if (!JobService.instance) {
      JobService.instance = new JobService();
    }
    return JobService.instance;
  }

  async enqueue(params: {
    type: string;
    payload: any;
    priority?: JobPriority;
    maxAttempts?: number;
    referenceId?: string;
    idempotencyKey?: string;
    scheduledAt?: string;
  }): Promise<string> {
    const idempotencyKey = params.idempotencyKey || crypto.randomBytes(16).toString("hex");
    const jobId = `job_${crypto.createHash("sha256").update(idempotencyKey).digest("hex")}`;

    const jobRef = adminDb.collection("jobs").doc(jobId);
    
    await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(jobRef);
      if (snap.exists) {
        // Idempotency: Job already exists
        return;
      }

      const now = new Date().toISOString();
      const job: Job = {
        id: jobId,
        type: params.type,
        payload: params.payload,
        status: 'QUEUED',
        priority: params.priority || 'NORMAL',
        attempts: 0,
        maxAttempts: params.maxAttempts || 5,
        referenceId: params.referenceId,
        idempotencyKey,
        createdAt: now,
        updatedAt: now,
        scheduledAt: params.scheduledAt || now,
        logs: [{ timestamp: now, message: "Job enqueued" }]
      };

      transaction.set(jobRef, job);
    });

    return jobId;
  }

  async processJobs(workerId: string, limit: number = 10): Promise<number> {
    this.lastHeartbeat = new Date().toISOString();
    const now = new Date();
    const leaseTime = 5 * 60 * 1000; // 5 minutes lease
    const expiredLease = new Date(now.getTime() - leaseTime).toISOString();

    // Ensure calendar is loaded for this run
    await this.calendarService.ensureLoaded();
    const storeStatus = this.calendarService.isOpen(now);

    const jobsQuery = adminDb.collection("jobs")
      .where("status", "in", ["QUEUED", "RETRYING"])
      .where("scheduledAt", "<=", now.toISOString())
      .orderBy("scheduledAt", "asc")
      .limit(limit);

    const snap = await jobsQuery.get();
    let processedCount = 0;

    for (const doc of snap.docs) {
      const job = doc.data() as Job;

      // Skip FULFILLMENT jobs if store is closed/blackout
      if (!storeStatus.isOpen && job.type === 'FULFILLMENT') {
        continue;
      }

      // Atomic lock attempt
      const success = await adminDb.runTransaction(async (transaction) => {
        const ref = adminDb.collection("jobs").doc(job.id);
        const latestSnap = await transaction.get(ref);
        const latestJob = latestSnap.data() as Job;

        // Check if still eligible and not locked by active lease
        if (
          (latestJob.status !== 'QUEUED' && latestJob.status !== 'RETRYING') ||
          (latestJob.lockedAt && latestJob.lockedAt > expiredLease)
        ) {
          return false;
        }

        transaction.update(ref, {
          status: 'PROCESSING',
          lockedAt: now.toISOString(),
          lockedBy: workerId,
          startedAt: now.toISOString(),
          updatedAt: now.toISOString()
        });

        return true;
      });

      if (success) {
        // Execute Job (Off-transaction to avoid long locks)
        this.executeJob(job).catch(err => {
          console.error(`[JobService] Unhandled error in job ${job.id}:`, err);
        });
        processedCount++;
      }
    }

    return processedCount;
  }

  private async executeJob(job: Job) {
    const start = Date.now();
    try {
      console.log(`[JobService] Executing job ${job.id} (${job.type})`);

      switch (job.type) {
        case 'FULFILLMENT':
          const { dispatchFulfillment } = await import("./fulfillment-dispatcher");
          await dispatchFulfillment(job.payload.orderId);
          break;
        
        case 'RECONCILIATION':
          const { reconcileOrder } = await import("./reconciliation-service");
          await reconcileOrder(job.payload.orderId, "system", job.payload.runId);
          break;

        case 'DELIVERY_RECOVERY':
          const { DeliveryService } = await import("./delivery-service");
          const deliveryService = DeliveryService.getInstance();
          await deliveryService.handleFulfillmentResult(job.payload.order, true, "Queue Recovery");
          break;

        case 'COMMISSION_LEDGER_POST':
          const { processCommissionLedgerJob } = await import("./ledger-service");
          await processCommissionLedgerJob(job.payload.commissionId);
          break;

        case 'COMMISSION_LEDGER_REVERSAL_POST':
          const { processCommissionLedgerReversalJob } = await import("./ledger-service");
          await processCommissionLedgerReversalJob(job.payload);
          break;

        case 'COMMISSION_PAYOUT_LEDGER_POST':
          const { processCommissionPayoutLedgerJob } = await import("./ledger-service");
          await processCommissionPayoutLedgerJob(job.payload);
          break;

        case 'MEMBERSHIP_EXPIRY':
          const { MembershipService } = await import("./membership-service");
          await MembershipService.getInstance().runExpiryCheck();
          break;

        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      await this.markSuccess(job.id, `Completed in ${Date.now() - start}ms`);
    } catch (err: any) {
      await this.markFailure(job.id, err);
    }
  }

  private async markSuccess(jobId: string, message: string) {
    const now = new Date().toISOString();
    await adminDb.collection("jobs").doc(jobId).update({
      status: 'SUCCEEDED',
      lockedAt: null,
      lockedBy: null,
      completedAt: now,
      updatedAt: now,
      logs: FieldValue.arrayUnion({ timestamp: now, message: `Success: ${message}` })
    });
  }

  private async markFailure(jobId: string, error: any) {
    const now = new Date().toISOString();
    const errorMsg = error.message || String(error);
    
    await adminDb.runTransaction(async (transaction) => {
      const ref = adminDb.collection("jobs").doc(jobId);
      const snap = await transaction.get(ref);
      const job = snap.data() as Job;

      const newAttempts = job.attempts + 1;
      let newStatus: JobStatus = 'RETRYING';
      let nextRetryAt: string | null = null;

      if (newAttempts >= job.maxAttempts || this.isPermanentError(errorMsg)) {
        newStatus = 'DEAD_LETTER';
      } else {
        nextRetryAt = this.calculateNextRetry(newAttempts);
      }

      transaction.update(ref, {
        status: newStatus,
        attempts: newAttempts,
        lastError: errorMsg,
        nextRetryAt,
        scheduledAt: nextRetryAt || job.scheduledAt,
        lockedAt: null,
        lockedBy: null,
        completedAt: newStatus === 'DEAD_LETTER' ? now : null,
        updatedAt: now,
        logs: FieldValue.arrayUnion({ 
          timestamp: now, 
          message: `Attempt ${newAttempts} failed: ${errorMsg}. Status: ${newStatus}` 
        })
      });

      // Notify admin if dead letter
      if (newStatus === 'DEAD_LETTER') {
        this.notificationService.notifyAdmin('QUEUE_DEAD_LETTER', 'Pekerjaan Gagal (Dead Letter)', `Job ${jobId} (${job.type}) telah mencapai batas percobaan maksimal dan dipindahkan ke Dead Letter.`, {
          severity: 'CRITICAL',
          relatedEntity: { type: 'JOB', id: jobId },
          actionUrl: `/admin/queue`,
          idempotencyKey: `job_dead_${jobId}`
        }).catch(err => console.error("[JobService] Failed to notify admin of dead letter", err));

        this.incidentService.reportIncident({
          title: `Critical Queue Failure: ${job.type}`,
          description: `Job ${jobId} (${job.type}) failed after ${newAttempts} attempts. Error: ${errorMsg}`,
          severity: 'HIGH',
          category: 'QUEUE',
          source: 'JOB_SERVICE',
          sourceKey: `job_dead:${jobId}`,
          component: 'queue_worker',
          metadataSafe: { jobId, jobType: job.type, error: errorMsg, attempts: newAttempts }
        }).catch(err => console.error("[JobService] Failed to report incident for dead letter", err));
      }
    });
  }

  private isPermanentError(message: string): boolean {
    const permanents = [
      "INVALID_ORDER",
      "AUTH_FAILED",
      "INSUFFICIENT_FUNDS",
      "PROVIDER_NOT_FOUND",
      "INVALID_SKU"
    ];
    return permanents.some(p => message.includes(p));
  }

  private calculateNextRetry(attempt: number): string {
    // Exponential backoff: 30s, 2m, 10m, 30m, 1h
    const backoffs = [30, 120, 600, 1800, 3600];
    const seconds = backoffs[attempt - 1] || 3600;
    return new Date(Date.now() + seconds * 1000).toISOString();
  }

  async manualRetry(jobId: string, actorUid: string) {
    const now = new Date().toISOString();
    await adminDb.collection("jobs").doc(jobId).update({
      status: 'QUEUED',
      attempts: 0,
      scheduledAt: now,
      updatedAt: now,
      logs: FieldValue.arrayUnion({ timestamp: now, message: `Manual retry triggered by ${actorUid}` })
    });
  }

  async cancelJob(jobId: string, actorUid: string) {
    const now = new Date().toISOString();
    await adminDb.collection("jobs").doc(jobId).update({
      status: 'CANCELLED',
      updatedAt: now,
      logs: FieldValue.arrayUnion({ timestamp: now, message: `Cancelled by ${actorUid}` })
    });
  }

  getLastHeartbeat(): string | null {
    return this.lastHeartbeat;
  }

  async getQueueStats() {
    const queuedCount = await adminDb.collection("jobs").where("status", "==", "QUEUED").count().get().then(s => s.data().count);
    const deadLetterCount = await adminDb.collection("jobs").where("status", "==", "DEAD_LETTER").count().get().then(s => s.data().count);
    return { queuedCount, deadLetterCount };
  }

  startWorkerLoop(intervalMs: number = 30000): NodeJS.Timeout {
    const baseInterval = intervalMs;
    this.currentIntervalMs = baseInterval;

    if (this.workerTimer) {
      console.log("[JobService] Background worker loop already running. Skipping initialization to enforce singleton protection.");
      return this.workerTimer;
    }

    console.log(`[JobService] Starting background worker loop (base interval: ${baseInterval}ms, max backoff: ${this.maxIntervalMs}ms)`);

    const runLoop = async () => {
      try {
        const count = await this.processJobs(`auto-worker-${process.pid}`, 5);
        if (count > 0) {
          console.log(`[JobService] Auto-worker processed ${count} jobs. Resetting interval to base: ${baseInterval}ms`);
          this.currentIntervalMs = baseInterval;
        } else {
          // Adaptive backoff: increase interval by 1.5x up to max limit (180,000ms / 3 minutes)
          const nextInterval = Math.min(this.maxIntervalMs, Math.round(this.currentIntervalMs * 1.5));
          if (nextInterval !== this.currentIntervalMs) {
            console.log(`[JobService] Queue empty or jobs skipped. Backing off worker interval from ${this.currentIntervalMs}ms to ${nextInterval}ms`);
            this.currentIntervalMs = nextInterval;
          }
        }
      } catch (err) {
        console.error("[JobService] Auto-worker loop error:", err);
      } finally {
        this.workerTimer = setTimeout(runLoop, this.currentIntervalMs);
      }
    };

    this.workerTimer = setTimeout(runLoop, this.currentIntervalMs);
    return this.workerTimer;
  }
}
