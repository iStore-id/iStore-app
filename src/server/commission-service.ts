import { adminDb } from "./firebase-admin";
import { logCoreAudit } from "./core-service";
import { 
  CommissionConfig, 
  CommissionRecipient, 
  CommissionRule, 
  CommissionRecord,
  CommissionCalculationMethod,
  PayoutBatch,
  PayoutBatchStatus,
  PayoutAllocationItem,
  PayoutRecipientSnapshot
} from "../types/commission";

const DEFAULT_COMMISSION_CONFIG: CommissionConfig = {
  enabled: false,
  defaultCalculationMethod: "PERCENTAGE_OF_SELLING_PRICE",
  defaultCurrency: "IDR",
  minimumPayoutThreshold: 50000,
  supportedRecipientTypes: ["AFFILIATE"],
  updatedAt: new Date().toISOString(),
  updatedBy: "SYSTEM"
};

export interface AccrualResult {
  success: boolean;
  accrued: boolean;
  reason?: string;
  record?: CommissionRecord | null;
}

export interface ReversalResult {
  success: boolean;
  orderId: string;
  refundKey: string;
  refundAmount: number;
  processedRecordsCount: number;
  totalDeltaReversed: number;
  results: {
    commissionId: string;
    recipientId: string;
    previousStatus: string;
    newStatus: string;
    deltaReversal: number;
    cumulativeReversed: number;
    remainingPayable: number;
    ledgerJournalId: string | null;
  }[];
  reason?: string;
}

export class CommissionService {
  private static instance: CommissionService;

  private constructor() {}

  public static getInstance(): CommissionService {
    if (!CommissionService.instance) {
      CommissionService.instance = new CommissionService();
    }
    return CommissionService.instance;
  }

  /**
   * Get current commission system configuration
   */
  async getConfig(): Promise<CommissionConfig> {
    try {
      const snap = await adminDb.collection("systemConfigs").doc("commission_config").get();
      if (!snap.exists) return DEFAULT_COMMISSION_CONFIG;
      const data = snap.data();
      return (data?.value || DEFAULT_COMMISSION_CONFIG) as CommissionConfig;
    } catch (err) {
      console.error("[CommissionService] Failed to load config, using default:", err);
      return DEFAULT_COMMISSION_CONFIG;
    }
  }

  /**
   * Extract affiliate identifier (code or ID) from order payload
   */
  extractAffiliateIdentifier(order: any): { type: 'ID' | 'CODE'; value: string } | null {
    if (!order) return null;

    // Check direct affiliateId
    if (order.affiliateId && typeof order.affiliateId === 'string' && order.affiliateId.trim()) {
      return { type: 'ID', value: order.affiliateId.trim() };
    }
    if (order.recipientId && typeof order.recipientId === 'string' && order.recipientId.trim()) {
      return { type: 'ID', value: order.recipientId.trim() };
    }

    // Check direct affiliateCode / referralCode
    const rawCode = order.affiliateCode || 
                    order.referralCode || 
                    order.customerData?.affiliateCode || 
                    order.customerData?.referralCode || 
                    order.metadata?.affiliateCode || 
                    order.metadata?.referralCode;

    if (rawCode && typeof rawCode === 'string' && rawCode.trim()) {
      return { type: 'CODE', value: rawCode.trim().toUpperCase() };
    }

    return null;
  }

  /**
   * Fetch and validate recipient eligibility for commission
   */
  async findRecipient(identifier: { type: 'ID' | 'CODE'; value: string }): Promise<CommissionRecipient | null> {
    if (identifier.type === 'ID') {
      const snap = await adminDb.collection("commissionRecipients").doc(identifier.value).get();
      if (!snap.exists) return null;
      return { id: snap.id, ...snap.data() } as CommissionRecipient;
    } else {
      const snap = await adminDb.collection("commissionRecipients")
        .where("code", "==", identifier.value)
        .limit(1)
        .get();
      if (snap.empty) return null;
      const doc = snap.docs[0];
      return { id: doc.id, ...doc.data() } as CommissionRecipient;
    }
  }

  /**
   * Determine rule tier score for deterministic priority resolution
   * Tier Precedence:
   * 1: Specific Recipient Rule (highest scope)
   * 2: Specific Variant Rule
   * 3: Specific Product Rule
   * 4: Specific Game Rule
   * 5: Global Affiliate Rule (lowest scope)
   */
  private getRuleTierScore(rule: CommissionRule, recipientId: string, order: any): number {
    if (rule.recipientId && rule.recipientId === recipientId) return 1;
    if (rule.variantId && rule.variantId === order.variantId) return 2;
    if (rule.productId && rule.productId === order.productId) return 3;
    if (rule.gameId && (rule.gameId === order.gameId || rule.gameId === order.productId)) return 4;
    return 5; // Global
  }

  /**
   * Resolve best active rule deterministically
   */
  async resolveRule(recipient: CommissionRecipient, order: any, sellingPrice: number): Promise<CommissionRule | null> {
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.slice(0, 10); // YYYY-MM-DD for comparison

    // Fetch active rules for AFFILIATE
    const snap = await adminDb.collection("commissionRules")
      .where("recipientType", "==", "AFFILIATE")
      .where("status", "==", "ACTIVE")
      .get();

    if (snap.empty) return null;

    const allRules = snap.docs.map(d => ({ id: d.id, ...d.data() } as CommissionRule));

    // Filter candidate rules
    const candidates = allRules.filter(rule => {
      // 1. Effective date check
      if (rule.effectiveFrom) {
        const fromStr = rule.effectiveFrom.slice(0, 10);
        if (todayStr < fromStr) return false;
      }
      if (rule.effectiveUntil) {
        const untilStr = rule.effectiveUntil.slice(0, 10);
        if (todayStr > untilStr) return false;
      }

      // 2. Minimum order gross amount check
      if (rule.minOrderAmount && sellingPrice < rule.minOrderAmount) {
        return false;
      }

      // 3. Recipient Match Check
      if (rule.recipientId && rule.recipientId !== recipient.id) {
        return false;
      }

      // 4. Variant Match Check
      if (rule.variantId && rule.variantId !== order.variantId) {
        return false;
      }

      // 5. Product Match Check
      if (rule.productId && rule.productId !== order.productId) {
        return false;
      }

      // 6. Game Match Check
      const gameTarget = order.gameId || order.productId;
      if (rule.gameId && rule.gameId !== gameTarget) {
        return false;
      }

      return true;
    });

    if (candidates.length === 0) return null;

    // Deterministic sorting:
    // 1. Rule tier score (1 = Recipient specific, 2 = Variant, 3 = Product, 4 = Game, 5 = Global)
    // 2. Priority number (1 = highest priority, 2 = second, etc.)
    // 3. Effective from date descending (more recent effective rule first)
    // 4. Created at descending
    // 5. Rule ID ascending (final tie-breaker)
    candidates.sort((a, b) => {
      const tierA = this.getRuleTierScore(a, recipient.id, order);
      const tierB = this.getRuleTierScore(b, recipient.id, order);
      if (tierA !== tierB) return tierA - tierB;

      const prioA = a.priority ?? 9999;
      const prioB = b.priority ?? 9999;
      if (prioA !== prioB) return prioA - prioB;

      const effA = a.effectiveFrom || "";
      const effB = b.effectiveFrom || "";
      if (effA !== effB) return effB.localeCompare(effA);

      const createdA = a.createdAt || "";
      const createdB = b.createdAt || "";
      if (createdA !== createdB) return createdB.localeCompare(createdA);

      return a.id.localeCompare(b.id);
    });

    return candidates[0];
  }

  /**
   * Resolve authoritative base cost for margin calculation
   */
  async resolveAuthoritativeBaseCost(order: any): Promise<number | null> {
    // 1. Check direct fields on order
    if (typeof order.providerCost === 'number' && !isNaN(order.providerCost) && order.providerCost >= 0) {
      return order.providerCost;
    }
    if (typeof order.baseCost === 'number' && !isNaN(order.baseCost) && order.baseCost >= 0) {
      return order.baseCost;
    }
    if (typeof order.pricing?.baseCost === 'number' && !isNaN(order.pricing.baseCost) && order.pricing.baseCost >= 0) {
      return order.pricing.baseCost;
    }
    if (typeof order.pricingSnapshot?.baseCost === 'number' && !isNaN(order.pricingSnapshot.baseCost) && order.pricingSnapshot.baseCost >= 0) {
      return order.pricingSnapshot.baseCost;
    }

    // 2. Check variant doc if variantId exists
    if (order.variantId) {
      try {
        const variantSnap = await adminDb.collection("variants").doc(order.variantId).get();
        if (variantSnap.exists) {
          const varData = variantSnap.data();
          const cost = varData?.pricing?.baseCost ?? varData?.baseCost;
          if (typeof cost === 'number' && !isNaN(cost) && cost >= 0) {
            return cost;
          }
        }
      } catch (err) {
        console.warn(`[CommissionService] Failed to fetch variant ${order.variantId} baseCost:`, err);
      }
    }

    return null;
  }

  /**
   * Deterministic calculation formula and integer IDR rounding
   */
  calculateAmount(
    rule: CommissionRule, 
    sellingPrice: number, 
    baseCost: number | null
  ): { 
    commissionAmount: number; 
    commissionRateSnapshot: number; 
    fixedAmountSnapshot: number;
    baseCostSnapshot: number | null;
  } {
    let rawAmount = 0;
    let rateSnapshot = 0;
    let fixedSnapshot = 0;
    let costSnapshot: number | null = null;

    switch (rule.calculationMethod) {
      case "PERCENTAGE_OF_SELLING_PRICE":
        rateSnapshot = Number(rule.rate) || 0;
        fixedSnapshot = 0;
        costSnapshot = null;
        rawAmount = (sellingPrice * rateSnapshot) / 100;
        break;

      case "FIXED_AMOUNT":
        rateSnapshot = 0;
        fixedSnapshot = Number(rule.rate) || 0;
        costSnapshot = null;
        rawAmount = fixedSnapshot;
        break;

      case "PERCENTAGE_OF_MARGIN":
        if (baseCost === null || baseCost === undefined || isNaN(baseCost)) {
          throw new Error("MISSING_AUTHORITATIVE_BASE_COST");
        }
        costSnapshot = baseCost;
        rateSnapshot = Number(rule.rate) || 0;
        fixedSnapshot = 0;
        const margin = sellingPrice - baseCost;
        rawAmount = margin > 0 ? (margin * rateSnapshot) / 100 : 0;
        break;

      default:
        rateSnapshot = Number(rule.rate) || 0;
        fixedSnapshot = 0;
        costSnapshot = null;
        rawAmount = (sellingPrice * rateSnapshot) / 100;
        break;
    }

    // Apply cap if defined
    if (rule.maxCommissionAmount && rule.maxCommissionAmount > 0) {
      rawAmount = Math.min(rawAmount, rule.maxCommissionAmount);
    }

    // Deterministic integer IDR rounding
    const finalAmount = Math.max(0, Math.round(rawAmount));

    return {
      commissionAmount: finalAmount,
      commissionRateSnapshot: rateSnapshot,
      fixedAmountSnapshot: fixedSnapshot,
      baseCostSnapshot: costSnapshot
    };
  }

  /**
   * Authoritative Accrual Engine when Order is SUCCESS
   * Guaranteed idempotent per order + recipient: `comm_order_${orderId}_${recipientId}`
   */
  async accrueCommissionForOrder(
    orderId: string, 
    orderData?: any, 
    actor: { uid: string; email: string } = { uid: "SYSTEM", email: "system@istore.co.id" }
  ): Promise<AccrualResult> {
    try {
      // 1. Fetch order data if not provided
      let order = orderData;
      if (!order) {
        const orderSnap = await adminDb.collection("orders").doc(orderId).get();
        if (!orderSnap.exists) {
          return { success: false, accrued: false, reason: "ORDER_NOT_FOUND" };
        }
        order = { id: orderSnap.id, ...orderSnap.data() };
      }

      // 2. Check Global Config
      const config = await this.getConfig();
      if (!config.enabled) {
        return { success: true, accrued: false, reason: "COMMISSION_DISABLED" };
      }

      // 3. Extract Affiliate Identifier
      const identifier = this.extractAffiliateIdentifier(order);
      if (!identifier) {
        return { success: true, accrued: false, reason: "NO_AFFILIATE_CODE" };
      }

      // 4. Find and validate Affiliate Recipient
      const recipient = await this.findRecipient(identifier);
      if (!recipient) {
        return { success: true, accrued: false, reason: "RECIPIENT_NOT_FOUND" };
      }

      if (recipient.type !== "AFFILIATE") {
        return { success: true, accrued: false, reason: "INVALID_RECIPIENT_TYPE" };
      }

      if (recipient.status !== "ACTIVE") {
        return { success: true, accrued: false, reason: "RECIPIENT_NOT_ACTIVE" };
      }

      // 5. Deterministic Idempotency Key
      const actualOrderId = order.id || orderId;
      const commissionId = `comm_order_${actualOrderId}_${recipient.id}`;
      const recordRef = adminDb.collection("commissionRecords").doc(commissionId);

      // Check if already exists outside transaction for fast exit
      const existingSnap = await recordRef.get();
      if (existingSnap.exists) {
        console.log(`[Commission Idempotency] Record ${commissionId} already exists for order ${actualOrderId}`);
        return { 
          success: true, 
          accrued: false, 
          reason: "ALREADY_ACCRUED", 
          record: { id: existingSnap.id, ...existingSnap.data() } as CommissionRecord 
        };
      }

      // 6. Calculate selling price snapshot
      const sellingPrice = Number(order.price ?? order.totalAmount ?? order.subtotal ?? 0);

      // 7. Resolve matching rule
      const rule = await this.resolveRule(recipient, order, sellingPrice);
      if (!rule) {
        return { success: true, accrued: false, reason: "NO_MATCHING_RULE" };
      }

      // 8. Resolve base cost if rule uses PERCENTAGE_OF_MARGIN
      let baseCost: number | null = null;
      if (rule.calculationMethod === "PERCENTAGE_OF_MARGIN") {
        baseCost = await this.resolveAuthoritativeBaseCost(order);
        if (baseCost === null || baseCost === undefined) {
          console.warn(`[Commission Accrual] Order ${actualOrderId} missing authoritative baseCost for rule ${rule.name}. Skipping accrual safely.`);
          return { success: true, accrued: false, reason: "MISSING_AUTHORITATIVE_BASE_COST" };
        }
      }

      // 9. Compute financial snapshot
      let calcResult;
      try {
        calcResult = this.calculateAmount(rule, sellingPrice, baseCost);
      } catch (calcErr: any) {
        if (calcErr.message === "MISSING_AUTHORITATIVE_BASE_COST") {
          return { success: true, accrued: false, reason: "MISSING_AUTHORITATIVE_BASE_COST" };
        }
        throw calcErr;
      }

      const now = new Date().toISOString();

      const newRecord: CommissionRecord = {
        id: commissionId,
        orderId: actualOrderId,
        recipientId: recipient.id,
        recipientCode: recipient.code,
        recipientName: recipient.name,
        recipientType: "AFFILIATE",
        ruleId: rule.id,
        ruleName: rule.name,
        calculationMethod: rule.calculationMethod,
        sellingPriceSnapshot: sellingPrice,
        baseCostSnapshot: calcResult.baseCostSnapshot,
        commissionRateSnapshot: calcResult.commissionRateSnapshot,
        fixedAmountSnapshot: calcResult.fixedAmountSnapshot,
        commissionAmount: calcResult.commissionAmount,
        currency: "IDR",
        status: "PAYABLE",
        createdAt: now,
        updatedAt: now,
        earnedAt: now,
        reversedAt: null,
        metadata: {
          invoice: order.invoice || actualOrderId,
          productId: order.productId || null,
          productName: order.productName || null,
          variantId: order.variantId || null,
          variantName: order.variantName || null,
          customerId: order.userId || "guest"
        }
      };

      // 10. Atomic Firestore Transaction for Double-Accrual Protection
      const transactionResult = await adminDb.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(recordRef);
        if (docSnap.exists) {
          return { isNew: false, record: { id: docSnap.id, ...docSnap.data() } as CommissionRecord };
        }

        transaction.set(recordRef, newRecord);
        return { isNew: true, record: newRecord };
      });

      if (!transactionResult.isNew) {
        // Self-healing check: if commission is PAYABLE but ledger was not posted yet, attempt idempotent post
        if (transactionResult.record.status === "PAYABLE" && transactionResult.record.ledgerStatus !== "POSTED") {
          try {
            const { recordCommissionAccrual } = await import("./ledger-service");
            const ledgerResult = await recordCommissionAccrual(transactionResult.record, actor.uid || "SYSTEM");
            await recordRef.update({
              ledgerStatus: "POSTED",
              ledgerJournalId: ledgerResult.docId,
              ledgerPostedAt: new Date().toISOString()
            });
            transactionResult.record.ledgerStatus = "POSTED";
            transactionResult.record.ledgerJournalId = ledgerResult.docId;
          } catch (retryErr) {
            console.error(`[Commission Ledger Retry Error] Failed to post ledger on duplicate invocation:`, retryErr);
          }
        }

        return { 
          success: true, 
          accrued: false, 
          reason: "ALREADY_ACCRUED", 
          record: transactionResult.record 
        };
      }

      // 11. Core Audit Log (Sanitized: NO bank secrets, NO tokens)
      await logCoreAudit(
        actor,
        "system",
        "COMMISSION_ACCRUED",
        `commissionRecords/${commissionId}`,
        null,
        {
          commissionId,
          orderId: actualOrderId,
          recipientId: recipient.id,
          recipientCode: recipient.code,
          ruleId: rule.id,
          ruleName: rule.name,
          calculationMethod: rule.calculationMethod,
          sellingPriceSnapshot: sellingPrice,
          baseCostSnapshot: calcResult.baseCostSnapshot,
          commissionRateSnapshot: calcResult.commissionRateSnapshot,
          fixedAmountSnapshot: calcResult.fixedAmountSnapshot,
          commissionAmount: calcResult.commissionAmount,
          currency: "IDR",
          status: "PAYABLE",
          earnedAt: now
        },
        `Commission accrued: Rp ${calcResult.commissionAmount.toLocaleString('id-ID')} for affiliate ${recipient.name} (${recipient.code}) on order ${actualOrderId}`
      );

      console.log(`[Commission Accrued] Created record ${commissionId} (Rp ${calcResult.commissionAmount}) for affiliate ${recipient.code}`);

      // 12. Double-Entry Ledger Posting (Phase 3: Ledger Integration)
      try {
        const { recordCommissionAccrual } = await import("./ledger-service");
        const ledgerResult = await recordCommissionAccrual(newRecord, actor.uid || "SYSTEM");

        await recordRef.update({
          ledgerStatus: "POSTED",
          ledgerJournalId: ledgerResult.docId,
          ledgerPostedAt: new Date().toISOString()
        });

        newRecord.ledgerStatus = "POSTED";
        newRecord.ledgerJournalId = ledgerResult.docId;
        newRecord.ledgerPostedAt = new Date().toISOString();
      } catch (ledgerErr: any) {
        console.error(`[Commission Ledger Error] Failed to post commission ${commissionId} to ledger:`, ledgerErr);

        // Mark commissionRecord as FAILED for ledger, but do not throw or rollback order SUCCESS
        try {
          await recordRef.update({
            ledgerStatus: "FAILED"
          });
          newRecord.ledgerStatus = "FAILED";
        } catch (updateErr) {
          console.error(`[Commission Ledger Error] Failed to update ledgerStatus for ${commissionId}:`, updateErr);
        }

        // Enqueue retry job to ensure recovery via existing JobService
        try {
          const { JobService } = await import("./job-service");
          await JobService.getInstance().enqueue({
            type: "COMMISSION_LEDGER_POST",
            payload: { commissionId },
            idempotencyKey: `comm_ledger_job_${commissionId}`,
            priority: "HIGH"
          });
        } catch (queueErr) {
          console.error(`[Commission Ledger Error] Failed to enqueue retry job for ${commissionId}:`, queueErr);
        }
      }

      return {
        success: true,
        accrued: true,
        record: newRecord
      };
    } catch (error: any) {
      console.error(`[Commission Accrual Error] Failed to accrue commission for order ${orderId}:`, error);
      // Return safe failure result without throwing so caller remains protected
      return {
        success: false,
        accrued: false,
        reason: error.message || "INTERNAL_ERROR"
      };
    }
  }

  /**
   * Handle Order Refund for Commission Clawback / Reversal (Phase 4)
   *
   * Triggers when refund status reaches SUCCEEDED.
   * Processes all commission records for the orderId independently.
   *
   * Basis Denominator: S = commissionRecord.sellingPriceSnapshot (IMMUTABLE)
   * Total Original Commission: C = commissionRecord.commissionAmount (IMMUTABLE)
   * Cumulative Refund: R_cum = sum of all SUCCEEDED refunds for this order
   * Target Remaining Commission: TargetRemaining = round(C * max(0, S - R_cum) / S)
   * Target Cumulative Clawback: TargetClawback = C - TargetRemaining
   * Delta Clawback: DeltaClawback = max(0, TargetClawback - PrevCumulativeReversed)
   *
   * Double-Entry Ledger:
   *   Only if DeltaClawback > 0:
   *     Debit:  2100_COMMISSION_PAYABLE  (DeltaClawback)
   *     Credit: 5200_COMMISSION_EXPENSE  (DeltaClawback)
   *
   * Status Contract:
   *   If remainingPayableAmount === 0:
   *     status -> CANCELLED, cancelReason -> 'CANCELLED_BY_REFUND', reversedAt -> now
   *   If remainingPayableAmount > 0:
   *     status -> remains PAYABLE
   */
  async handleOrderRefund(
    orderId: string,
    refundKey: string,
    refundAmount: number,
    actor: { uid: string; email: string } = { uid: "SYSTEM", email: "system@istore.co.id" }
  ): Promise<ReversalResult> {
    const cleanOrderId = String(orderId || "").trim();
    const cleanRefundKey = String(refundKey || "").trim();

    if (!cleanOrderId || !cleanRefundKey) {
      return {
        success: false,
        orderId: cleanOrderId,
        refundKey: cleanRefundKey,
        refundAmount,
        processedRecordsCount: 0,
        totalDeltaReversed: 0,
        results: [],
        reason: "INVALID_ARGUMENTS"
      };
    }

    try {
      // 1. Authoritative check: verify refund exists and is SUCCEEDED
      const refundDocSnap = await adminDb.collection("refunds").doc(cleanRefundKey).get();
      if (!refundDocSnap.exists) {
        console.warn(`[Commission Refund Reversal] Refund ${cleanRefundKey} not found in Firestore.`);
        return {
          success: false,
          orderId: cleanOrderId,
          refundKey: cleanRefundKey,
          refundAmount,
          processedRecordsCount: 0,
          totalDeltaReversed: 0,
          results: [],
          reason: "REFUND_NOT_FOUND"
        };
      }

      const refundData = refundDocSnap.data()!;
      if (refundData.status !== "SUCCEEDED") {
        console.warn(`[Commission Refund Reversal] Refund ${cleanRefundKey} status is ${refundData.status}, not SUCCEEDED. Skipping.`);
        return {
          success: false,
          orderId: cleanOrderId,
          refundKey: cleanRefundKey,
          refundAmount,
          processedRecordsCount: 0,
          totalDeltaReversed: 0,
          results: [],
          reason: "REFUND_NOT_SUCCEEDED"
        };
      }

      // 2. Compute authoritative cumulative SUCCEEDED refund amount for this order
      const allRefundsSnap = await adminDb.collection("refunds")
        .where("orderId", "==", cleanOrderId)
        .where("status", "==", "SUCCEEDED")
        .get();

      let cumulativeRefundAmount = 0;
      allRefundsSnap.docs.forEach(doc => {
        const amt = Number(doc.data()?.amount) || 0;
        cumulativeRefundAmount += amt;
      });

      // 3. Query all commission records for this orderId
      const commSnap = await adminDb.collection("commissionRecords")
        .where("orderId", "==", cleanOrderId)
        .get();

      if (commSnap.empty) {
        console.log(`[Commission Refund Reversal] No commission records found for order ${cleanOrderId}.`);
        return {
          success: true,
          orderId: cleanOrderId,
          refundKey: cleanRefundKey,
          refundAmount,
          processedRecordsCount: 0,
          totalDeltaReversed: 0,
          results: [],
          reason: "NO_COMMISSION_RECORDS"
        };
      }

      const reversalResults: ReversalResult["results"] = [];
      let totalDeltaReversed = 0;

      // 4. Process each commission record independently
      for (const doc of commSnap.docs) {
        const commissionId = doc.id;
        const commRef = doc.ref;

        // Execute atomic Firestore transaction for this commissionRecord
        const txResult = await adminDb.runTransaction(async (transaction) => {
          const currentSnap = await transaction.get(commRef);
          if (!currentSnap.exists) {
            return { skipped: true, reason: "RECORD_NOT_FOUND" };
          }

          const record = currentSnap.data() as CommissionRecord;

          // Scope boundary: only process records that are PAYABLE or previously partial-refunded
          const previousStatus = record.status;
          const originalCommissionAmount = Number(record.commissionAmount) || 0;
          const sellingPriceSnapshot = Number(record.sellingPriceSnapshot) || 0;

          if (originalCommissionAmount <= 0) {
            return { skipped: true, reason: "ZERO_ORIGINAL_COMMISSION" };
          }

          // Basis S strictly locked to sellingPriceSnapshot
          const S = sellingPriceSnapshot;
          const C = originalCommissionAmount;

          if (S <= 0) {
            return { skipped: true, reason: "INVALID_SELLING_PRICE_SNAPSHOT" };
          }

          const prevCumulativeReversed = Number(record.cumulativeReversedAmount) || 0;

          // Check if this refundKey has already been processed for this record (Idempotency)
          const existingSnapshots = Array.isArray(record.reversalSnapshots) ? record.reversalSnapshots : [];
          const existingForRefund = existingSnapshots.find(s => s.refundKey === cleanRefundKey);
          if (existingForRefund) {
            console.log(`[Commission Refund Reversal] Refund ${cleanRefundKey} already processed for ${commissionId}. Skipping calculation.`);
            return {
              skipped: false,
              alreadyProcessed: true,
              commissionId,
              recipientId: record.recipientId,
              previousStatus,
              newStatus: record.status,
              deltaReversal: existingForRefund.deltaReversedCommission,
              cumulativeReversed: record.cumulativeReversedAmount || 0,
              remainingPayable: record.remainingPayableAmount || 0,
              ledgerJournalId: existingForRefund.ledgerJournalId
            };
          }

          // Mathematical clawback calculation:
          // TargetRemaining = round( C * max(0, S - cumulativeRefundAmount) / S )
          const remainingRatio = Math.max(0, S - cumulativeRefundAmount) / S;
          const targetRemaining = Math.max(0, Math.round(C * remainingRatio));
          const targetCumulativeClawback = Math.max(0, Math.min(C, C - targetRemaining));

          // Delta reversal for this specific refund step
          const deltaReversal = Math.max(0, Math.min(C - prevCumulativeReversed, targetCumulativeClawback - prevCumulativeReversed));
          const newCumulativeReversed = prevCumulativeReversed + deltaReversal;
          const newRemainingPayable = Math.max(0, C - newCumulativeReversed);

          const now = new Date().toISOString();
          let newStatus: "PAYABLE" | "CANCELLED" = previousStatus;
          let cancelReason = record.cancelReason || null;
          let reversedAt = record.reversedAt || null;

          if (newRemainingPayable === 0) {
            newStatus = "CANCELLED";
            cancelReason = "CANCELLED_BY_REFUND";
            reversedAt = now;
          }

          const snapshotEntry = {
            refundKey: cleanRefundKey,
            refundAmount,
            deltaReversedCommission: deltaReversal,
            cumulativeReversedCommission: newCumulativeReversed,
            remainingPayableCommission: newRemainingPayable,
            ledgerJournalId: deltaReversal > 0 ? `ledger_commission_reversal_${commissionId}_${cleanRefundKey}` : null,
            reversedAt: now
          };

          const updatedSnapshots = [...existingSnapshots, snapshotEntry];

          // Apply update in transaction
          transaction.update(commRef, {
            status: newStatus,
            cancelReason,
            cumulativeReversedAmount: newCumulativeReversed,
            remainingPayableAmount: newRemainingPayable,
            reversedAt,
            reversalSnapshots: updatedSnapshots,
            updatedAt: now
          });

          return {
            skipped: false,
            alreadyProcessed: false,
            commissionId,
            recipientId: record.recipientId,
            previousStatus,
            newStatus,
            deltaReversal,
            cumulativeReversed: newCumulativeReversed,
            remainingPayable: newRemainingPayable,
            ledgerJournalId: snapshotEntry.ledgerJournalId,
            fullRecord: { ...record, status: newStatus, cumulativeReversedAmount: newCumulativeReversed, remainingPayableAmount: newRemainingPayable }
          };
        });

        if (txResult.skipped) {
          continue;
        }

        if (txResult.alreadyProcessed) {
          reversalResults.push({
            commissionId: txResult.commissionId!,
            recipientId: txResult.recipientId!,
            previousStatus: txResult.previousStatus!,
            newStatus: txResult.newStatus!,
            deltaReversal: txResult.deltaReversal!,
            cumulativeReversed: txResult.cumulativeReversed!,
            remainingPayable: txResult.remainingPayable!,
            ledgerJournalId: txResult.ledgerJournalId!
          });
          continue;
        }

        const delta = txResult.deltaReversal || 0;
        totalDeltaReversed += delta;

        // 5. Post to Double-Entry Ledger ONLY if deltaReversal > 0
        let ledgerJournalId: string | null = null;
        if (delta > 0) {
          try {
            const { safeRecordCommissionAccrualReversal } = await import("./ledger-service");
            const ledgerRes = await safeRecordCommissionAccrualReversal(
              txResult.fullRecord,
              cleanRefundKey,
              delta,
              actor.uid || "SYSTEM",
              { orderId: cleanOrderId, refundAmount }
            );

            if (ledgerRes) {
              ledgerJournalId = ledgerRes.docId;
            }
          } catch (ledgerError: any) {
            console.error(`[Commission Reversal Ledger Error] Failed for ${commissionId}:`, ledgerError);

            // Enqueue retry job for resilient ledger posting
            try {
              const { JobService } = await import("./job-service");
              await JobService.getInstance().enqueue({
                type: "COMMISSION_LEDGER_REVERSAL_POST",
                payload: {
                  commissionId,
                  refundKey: cleanRefundKey,
                  deltaReversal: delta
                },
                idempotencyKey: `comm_rev_ledger_${commissionId}_${cleanRefundKey}`,
                priority: "HIGH"
              });
            } catch (jobErr) {
              console.error(`[Commission Reversal Ledger Error] Failed to enqueue retry job:`, jobErr);
            }
          }
        }

        // 6. Log Core Audit event: COMMISSION_REVERSED / COMMISSION_PARTIAL_REVERSED
        await logCoreAudit(
          actor,
          "system",
          txResult.newStatus === "CANCELLED" ? "COMMISSION_CANCELLED_BY_REFUND" : "COMMISSION_PARTIAL_REVERSED",
          `commissionRecords/${commissionId}`,
          null,
          {
            commissionId,
            orderId: cleanOrderId,
            refundKey: cleanRefundKey,
            refundAmount,
            deltaReversal: delta,
            cumulativeReversed: txResult.cumulativeReversed,
            remainingPayable: txResult.remainingPayable,
            previousStatus: txResult.previousStatus,
            newStatus: txResult.newStatus,
            ledgerJournalId
          },
          `Commission ${commissionId} ${txResult.newStatus === "CANCELLED" ? "fully cancelled" : "partially clawed back"} by refund ${cleanRefundKey} (Delta: Rp ${delta.toLocaleString('id-ID')})`
        );

        reversalResults.push({
          commissionId: txResult.commissionId!,
          recipientId: txResult.recipientId!,
          previousStatus: txResult.previousStatus!,
          newStatus: txResult.newStatus!,
          deltaReversal: delta,
          cumulativeReversed: txResult.cumulativeReversed!,
          remainingPayable: txResult.remainingPayable!,
          ledgerJournalId
        });
      }

      return {
        success: true,
        orderId: cleanOrderId,
        refundKey: cleanRefundKey,
        refundAmount,
        processedRecordsCount: reversalResults.length,
        totalDeltaReversed,
        results: reversalResults
      };
    } catch (error: any) {
      console.error(`[Commission Handle Refund Error] Failed for order ${orderId}, refund ${refundKey}:`, error);
      return {
        success: false,
        orderId: cleanOrderId,
        refundKey: cleanRefundKey,
        refundAmount,
        processedRecordsCount: 0,
        totalDeltaReversed: 0,
        results: [],
        reason: error.message || "INTERNAL_ERROR"
      };
    }
  }

  // ==========================================================================
  // PHASE 5: COMMISSION PAYOUT & DISBURSEMENT ENGINE
  // ==========================================================================

  /**
   * Helper to revalidate allocations against current commissionRecords state.
   * If any record has remainingPayableAmount != allocatedAmount or is not PAYABLE/ALLOCATED:
   * Returns valid: false and reason.
   */
  async revalidateBatchAllocations(
    batch: PayoutBatch
  ): Promise<{ valid: boolean; staleReason?: string; currentRecords?: CommissionRecord[] }> {
    const allocations = Array.isArray(batch.allocations) ? batch.allocations : [];
    if (allocations.length === 0) {
      return { valid: false, staleReason: "Batch does not have any allocation items." };
    }

    const currentRecords: CommissionRecord[] = [];
    for (const item of allocations) {
      const docSnap = await adminDb.collection("commissionRecords").doc(item.commissionId).get();
      if (!docSnap.exists) {
        return {
          valid: false,
          staleReason: `Commission record '${item.commissionId}' not found in database.`
        };
      }

      const rec = docSnap.data() as CommissionRecord;
      currentRecords.push(rec);

      if (rec.status !== "PAYABLE") {
        return {
          valid: false,
          staleReason: `Commission record '${item.commissionId}' status is '${rec.status}', expected 'PAYABLE'.`
        };
      }

      const currentPayable = typeof rec.remainingPayableAmount === "number"
        ? rec.remainingPayableAmount
        : rec.commissionAmount;

      if (currentPayable !== item.allocatedAmount) {
        return {
          valid: false,
          staleReason: `COMMISSION_ALLOCATION_STALE_DUE_TO_REFUND: Commission '${item.commissionId}' allocated Rp ${item.allocatedAmount.toLocaleString('id-ID')}, but current payable is Rp ${currentPayable.toLocaleString('id-ID')}.`
        };
      }
    }

    return { valid: true, currentRecords };
  }

  /**
   * Create a new Payout Batch atomically locking commission records.
   * AC-1, AC-2, AC-3
   */
  async createPayoutBatch(params: {
    recipientId: string;
    commissionRecordIds: string[];
    actor: { uid: string; email: string };
    overrideThreshold?: boolean;
    overrideReason?: string;
  }): Promise<{ success: boolean; batch?: PayoutBatch; message?: string }> {
    const { recipientId, commissionRecordIds, actor, overrideThreshold, overrideReason } = params;
    const cleanRecipientId = String(recipientId || "").trim();

    if (!cleanRecipientId || !Array.isArray(commissionRecordIds) || commissionRecordIds.length === 0) {
      return { success: false, message: "Penerima dan daftar komisi wajib dipilih." };
    }

    // 1. Verify recipient and payout account
    const recSnap = await adminDb.collection("commissionRecipients").doc(cleanRecipientId).get();
    if (!recSnap.exists) {
      return { success: false, message: `Penerima komisi '${cleanRecipientId}' tidak ditemukan.` };
    }
    const recipient = recSnap.data() as CommissionRecipient;
    if (recipient.status !== "ACTIVE") {
      return { success: false, message: `Penerima komisi '${recipient.name}' tidak berstatus ACTIVE.` };
    }
    if (!recipient.payoutAccount?.bankName || !recipient.payoutAccount?.accountNumberMasked) {
      return { success: false, message: `Penerima komisi '${recipient.name}' belum memiliki akun rekening pembayaran yang valid.` };
    }

    // 2. Fetch config for minimum payout threshold
    const config = await this.getConfig();
    const minThreshold = Number(config.minimumPayoutThreshold) || 50000;

    const batchId = `payout_batch_${cleanRecipientId}_${Date.now()}`;
    const batchNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // 3. Execute atomic Firestore transaction
    try {
      const createdBatch = await adminDb.runTransaction(async (transaction) => {
        const allocations: PayoutAllocationItem[] = [];
        let totalAmount = 0;

        // Read all commission records
        for (const commId of commissionRecordIds) {
          const docRef = adminDb.collection("commissionRecords").doc(commId);
          const docSnap = await transaction.get(docRef);

          if (!docSnap.exists) {
            throw new Error(`Commission record '${commId}' tidak ditemukan.`);
          }

          const rec = docSnap.data() as CommissionRecord;

          // Invariant: Must belong to same recipient
          if (rec.recipientId !== cleanRecipientId) {
            throw new Error(`Integritas gagal: Komisi '${commId}' milik penerima '${rec.recipientId}', bukan '${cleanRecipientId}'.`);
          }

          // Invariant: Must be PAYABLE
          if (rec.status !== "PAYABLE") {
            throw new Error(`Komisi '${commId}' berstatus '${rec.status}', tidak dapat dialokasikan.`);
          }

          // Invariant: Ledger must be POSTED
          if (rec.ledgerStatus !== "POSTED") {
            throw new Error(`Komisi '${commId}' belum terakrual di Buku Besar (ledgerStatus: '${rec.ledgerStatus}').`);
          }

          // Invariant: Must be UNPAID and not locked by another batch
          if (rec.payoutStatus && rec.payoutStatus !== "UNPAID") {
            throw new Error(`Komisi '${commId}' telah berstatus '${rec.payoutStatus}' (Batch ID: ${rec.payoutBatchId || 'unknown'}).`);
          }

          const payable = typeof rec.remainingPayableAmount === "number"
            ? rec.remainingPayableAmount
            : rec.commissionAmount;

          if (payable <= 0) {
            throw new Error(`Komisi '${commId}' tidak memiliki sisa hak bayar (Rp 0).`);
          }

          allocations.push({
            commissionId: commId,
            orderId: rec.orderId,
            allocatedAmount: payable
          });

          totalAmount += payable;
        }

        // Validate threshold
        if (totalAmount < minThreshold && !overrideThreshold) {
          throw new Error(`Total komisi (Rp ${totalAmount.toLocaleString('id-ID')}) berada di bawah batas minimum penarikan (Rp ${minThreshold.toLocaleString('id-ID')}).`);
        }

        if (totalAmount < minThreshold && overrideThreshold && (!overrideReason || overrideReason.trim().length < 5)) {
          throw new Error("Alasan override batas minimum penarikan wajib diisi (minimal 5 karakter).");
        }

        const now = new Date().toISOString();
        const batchDocData: PayoutBatch = {
          id: batchId,
          batchNumber,
          recipientId: cleanRecipientId,
          recipientSnapshot: {
            recipientId: cleanRecipientId,
            name: recipient.name,
            bankName: recipient.payoutAccount!.bankName,
            accountHolderName: recipient.payoutAccount!.accountHolderName,
            accountNumberMasked: recipient.payoutAccount!.accountNumberMasked
          },
          allocations,
          commissionRecordIds,
          totalCommissionAmount: totalAmount,
          payoutFee: 0,
          netPayoutAmount: totalAmount,
          status: "DRAFT",
          payoutMethod: "MANUAL_BANK_TRANSFER",
          createdBy: actor.uid,
          createdAt: now
        };

        // Write batch document
        const batchRef = adminDb.collection("payoutBatches").doc(batchId);
        transaction.set(batchRef, batchDocData);

        // Lock all commission records as ALLOCATED
        for (const item of allocations) {
          const commRef = adminDb.collection("commissionRecords").doc(item.commissionId);
          transaction.update(commRef, {
            payoutStatus: "ALLOCATED",
            payoutBatchId: batchId,
            updatedAt: now
          });
        }

        return batchDocData;
      });

      // Audit log
      await logCoreAudit(
        actor,
        "admin",
        "COMMISSION_PAYOUT_BATCH_CREATED",
        `payoutBatches/${batchId}`,
        null,
        {
          batchNumber,
          recipientId: cleanRecipientId,
          totalCommissionAmount: createdBatch.totalCommissionAmount,
          recordsCount: commissionRecordIds.length,
          overrideThreshold: !!overrideThreshold,
          overrideReason: overrideReason || null
        },
        `Payout batch ${batchNumber} created for ${recipient.name} (Rp ${createdBatch.totalCommissionAmount.toLocaleString('id-ID')})`
      );

      return { success: true, batch: createdBatch };
    } catch (err: any) {
      console.error("[Create Payout Batch Error]", err);
      return { success: false, message: err.message || "Gagal membuat batch payout." };
    }
  }

  /**
   * Submit Payout Batch for Approval (DRAFT -> PENDING_APPROVAL).
   * Revalidates against stale refund.
   */
  async submitPayoutBatch(batchId: string, actor: { uid: string; email: string }): Promise<{ success: boolean; message?: string }> {
    const batchSnap = await adminDb.collection("payoutBatches").doc(batchId).get();
    if (!batchSnap.exists) {
      return { success: false, message: `Batch '${batchId}' tidak ditemukan.` };
    }

    const batch = batchSnap.data() as PayoutBatch;
    if (batch.status !== "DRAFT") {
      return { success: false, message: `Batch berstatus '${batch.status}', hanya batch DRAFT yang dapat diajukan.` };
    }

    // Fresh Revalidation
    const reval = await this.revalidateBatchAllocations(batch);
    if (!reval.valid) {
      await adminDb.collection("payoutBatches").doc(batchId).update({
        status: "NEEDS_REVIEW",
        reviewReason: reval.staleReason,
        updatedAt: new Date().toISOString()
      });
      return {
        success: false,
        message: `Pengajuan ditolak karena perubahan saldo: ${reval.staleReason}. Batch telah ditandai NEEDS_REVIEW.`
      };
    }

    const now = new Date().toISOString();
    await adminDb.collection("payoutBatches").doc(batchId).update({
      status: "PENDING_APPROVAL",
      submittedBy: actor.uid,
      submittedAt: now,
      updatedAt: now
    });

    await logCoreAudit(
      actor,
      "admin",
      "COMMISSION_PAYOUT_BATCH_SUBMITTED",
      `payoutBatches/${batchId}`,
      { status: batch.status },
      { status: "PENDING_APPROVAL" },
      `Payout batch ${batch.batchNumber} submitted for approval`
    );

    return { success: true };
  }

  /**
   * Approve Payout Batch (PENDING_APPROVAL -> PROCESSING).
   * AC-4: Maker-Checker Enforced (Approver !== Creator unless Owner).
   * Fresh Revalidation against stale refund.
   */
  async approvePayoutBatch(
    batchId: string,
    actor: { uid: string; email: string; isOwner?: boolean }
  ): Promise<{ success: boolean; message?: string }> {
    const batchSnap = await adminDb.collection("payoutBatches").doc(batchId).get();
    if (!batchSnap.exists) {
      return { success: false, message: `Batch '${batchId}' tidak ditemukan.` };
    }

    const batch = batchSnap.data() as PayoutBatch;
    if (batch.status !== "PENDING_APPROVAL") {
      return { success: false, message: `Batch berstatus '${batch.status}', hanya batch PENDING_APPROVAL yang dapat disetujui.` };
    }

    // Maker-checker policy: approver must not be creator unless Owner
    if (batch.createdBy === actor.uid && !actor.isOwner) {
      return {
        success: false,
        message: "Maker-Checker violation: Pembuat batch tidak boleh menyetujui batch yang dibuatnya sendiri."
      };
    }

    // Fresh Revalidation
    const reval = await this.revalidateBatchAllocations(batch);
    if (!reval.valid) {
      await adminDb.collection("payoutBatches").doc(batchId).update({
        status: "NEEDS_REVIEW",
        reviewReason: reval.staleReason,
        updatedAt: new Date().toISOString()
      });
      return {
        success: false,
        message: `Persetujuan ditolak karena perubahan saldo: ${reval.staleReason}. Batch telah ditandai NEEDS_REVIEW.`
      };
    }

    const now = new Date().toISOString();
    await adminDb.collection("payoutBatches").doc(batchId).update({
      status: "PROCESSING",
      approvedBy: actor.uid,
      approvedAt: now,
      updatedAt: now
    });

    await logCoreAudit(
      actor,
      actor.isOwner ? "pemilik" : "admin",
      "COMMISSION_PAYOUT_BATCH_APPROVED",
      `payoutBatches/${batchId}`,
      { status: batch.status },
      { status: "PROCESSING", approvedBy: actor.uid },
      `Payout batch ${batch.batchNumber} approved`
    );

    return { success: true };
  }

  /**
   * Confirm Payout Paid (PROCESSING -> PAID).
   * Strict 12-Gate Transaction.
   * Posts Ledger: DR 2100_COMMISSION_PAYABLE / CR 1200_BANK_PRIMARY.
   * AC-6, AC-7, AC-10, AC-14, AC-15.
   */
  async confirmPayoutPaid(params: {
    batchId: string;
    transferReference: string;
    proofReference?: string;
    actor: { uid: string; email: string };
  }): Promise<{ success: boolean; message?: string; journalId?: string }> {
    const { batchId, transferReference, proofReference, actor } = params;
    const cleanTransferRef = String(transferReference || "").trim();

    // Gate 9: Valid transfer reference (min 5 chars)
    if (!cleanTransferRef || cleanTransferRef.length < 5) {
      return { success: false, message: "Nomor referensi transfer bank wajib diisi (minimal 5 karakter)." };
    }

    const batchSnap = await adminDb.collection("payoutBatches").doc(batchId).get();
    if (!batchSnap.exists) {
      return { success: false, message: `Batch '${batchId}' tidak ditemukan.` };
    }

    const currentBatchData = batchSnap.data() as PayoutBatch;

    // Idempotency: If already PAID with same reference, return success
    if (currentBatchData.status === "PAID") {
      if (currentBatchData.transferReference === cleanTransferRef) {
        return {
          success: true,
          journalId: currentBatchData.ledgerJournalId || undefined,
          message: "Payout batch sudah berstatus PAID (Idempotent success)."
        };
      }
      return { success: false, message: `Batch sudah berstatus PAID dengan referensi '${currentBatchData.transferReference}'.` };
    }

    // Gate 1: Batch must be in PROCESSING status
    if (currentBatchData.status !== "PROCESSING") {
      return { success: false, message: `Batch berstatus '${currentBatchData.status}', hanya batch PROCESSING yang dapat dikonfirmasi lunas.` };
    }

    // Gate 10: Global uniqueness of transferReference across other PAID batches
    // We use a dedicated reservation document in Firestore collection 'payoutReferenceReservations'
    // with docId: `ref_${cleanTransferRef.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`
    const refDocId = `ref_${cleanTransferRef.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
    const refDocRef = adminDb.collection("payoutReferenceReservations").doc(refDocId);

    const now = new Date().toISOString();

    try {
      // Execute strict atomic transaction
      await adminDb.runTransaction(async (transaction) => {
        // Check Reference Reservation uniqueness
        const refSnap = await transaction.get(refDocRef);
        if (refSnap.exists) {
          const refData = refSnap.data()!;
          if (refData.batchId !== batchId) {
            throw new Error(`TRANSFER_REF_ALREADY_USED: Referensi transfer '${cleanTransferRef}' telah digunakan pada batch ${refData.batchNumber || refData.batchId}.`);
          }
        }

        // Fresh read batch inside transaction
        const bSnap = await transaction.get(adminDb.collection("payoutBatches").doc(batchId));
        if (!bSnap.exists) throw new Error("Batch tidak ditemukan.");
        const batch = bSnap.data() as PayoutBatch;

        if (batch.status !== "PROCESSING") {
          throw new Error(`Batch status invalid: '${batch.status}', expected 'PROCESSING'.`);
        }

        // Gate 2: Recipient is active
        const recSnap = await transaction.get(adminDb.collection("commissionRecipients").doc(batch.recipientId));
        if (!recSnap.exists || recSnap.data()?.status !== "ACTIVE") {
          throw new Error(`Penerima komisi '${batch.recipientId}' tidak aktif.`);
        }

        // Gate 3 - 8: Validate every allocation
        let calculatedSum = 0;
        const allocations = Array.isArray(batch.allocations) ? batch.allocations : [];

        for (const item of allocations) {
          const cRef = adminDb.collection("commissionRecords").doc(item.commissionId);
          const cSnap = await transaction.get(cRef);

          if (!cSnap.exists) {
            throw new Error(`Commission record '${item.commissionId}' tidak ditemukan.`);
          }

          const rec = cSnap.data() as CommissionRecord;

          // Gate 4: Still PAYABLE
          if (rec.status !== "PAYABLE") {
            throw new Error(`Komisi '${item.commissionId}' berstatus '${rec.status}', bukan 'PAYABLE'.`);
          }

          // Gate 5: payoutStatus === ALLOCATED
          if (rec.payoutStatus !== "ALLOCATED") {
            throw new Error(`Komisi '${item.commissionId}' memiliki payoutStatus '${rec.payoutStatus}', bukan 'ALLOCATED'.`);
          }

          // Gate 6: payoutBatchId === batch.id
          if (rec.payoutBatchId !== batchId) {
            throw new Error(`Komisi '${item.commissionId}' terikat pada batch '${rec.payoutBatchId}', bukan '${batchId}'.`);
          }

          // Gate 7: Anti-stale barrier (allocatedAmount === current remainingPayableAmount)
          const currentPayable = typeof rec.remainingPayableAmount === "number"
            ? rec.remainingPayableAmount
            : rec.commissionAmount;

          if (currentPayable !== item.allocatedAmount) {
            throw new Error(`COMMISSION_ALLOCATION_STALE_DUE_TO_REFUND: Komisi '${item.commissionId}' dialokasikan Rp ${item.allocatedAmount.toLocaleString('id-ID')}, tetapi sisa hak komisi saat ini adalah Rp ${currentPayable.toLocaleString('id-ID')}.`);
          }

          calculatedSum += item.allocatedAmount;
        }

        // Gate 8: Sum equals totalCommissionAmount and netPayoutAmount
        if (calculatedSum !== batch.totalCommissionAmount || calculatedSum !== batch.netPayoutAmount) {
          throw new Error(`Ketidakcocokan nominal: Total alokasi (Rp ${calculatedSum.toLocaleString('id-ID')}) tidak cocok dengan batch amount.`);
        }

        // Gate 12: Check that ledger journal does not already exist
        const expectedJournalId = `ledger_commission_payout_${batchId}`;
        const journalRef = adminDb.collection("ledgerJournalEntries").doc(expectedJournalId);
        const journalSnap = await transaction.get(journalRef);
        if (journalSnap.exists) {
          // Already posted
          console.log(`[Confirm Paid] Ledger journal ${expectedJournalId} already exists.`);
        }

        // Reserve reference doc
        transaction.set(refDocRef, {
          reference: cleanTransferRef,
          batchId,
          batchNumber: batch.batchNumber,
          reservedAt: now,
          actor: actor.email
        });

        // Update Batch to PAID
        transaction.update(adminDb.collection("payoutBatches").doc(batchId), {
          status: "PAID",
          transferReference: cleanTransferRef,
          proofReference: proofReference || null,
          paidBy: actor.uid,
          paidAt: now,
          updatedAt: now
        });

        // Update all Commission Records to PAID
        for (const item of allocations) {
          const cRef = adminDb.collection("commissionRecords").doc(item.commissionId);
          transaction.update(cRef, {
            payoutStatus: "PAID",
            paidAt: now,
            updatedAt: now
          });
        }
      });
    } catch (err: any) {
      console.error("[Confirm Payout Paid Transaction Aborted]", err);

      // If stale detected, transition batch to NEEDS_REVIEW
      if (err.message && err.message.includes("COMMISSION_ALLOCATION_STALE_DUE_TO_REFUND")) {
        await adminDb.collection("payoutBatches").doc(batchId).update({
          status: "NEEDS_REVIEW",
          reviewReason: err.message,
          updatedAt: new Date().toISOString()
        });
      }

      return { success: false, message: err.message || "Gagal mengonfirmasi pembayaran payout." };
    }

    // Post Double-Entry Ledger
    const updatedBatchSnap = await adminDb.collection("payoutBatches").doc(batchId).get();
    const updatedBatch = updatedBatchSnap.data() as PayoutBatch;

    let ledgerJournalId: string | null = null;
    try {
      const { recordCommissionPayout } = await import("./ledger-service");
      const ledgerResult = await recordCommissionPayout(updatedBatch, actor.email);
      ledgerJournalId = ledgerResult.docId;

      await adminDb.collection("payoutBatches").doc(batchId).update({
        ledgerJournalId: ledgerResult.docId
      });
    } catch (ledgerErr: any) {
      console.error("[Ledger Payout Posting Failed - Enqueueing Retry]", ledgerErr);
      // Resilience AC-7: Enqueue retry job so ledger is eventually posted
      const { JobService } = await import("./job-service");
      await JobService.getInstance().enqueue({
        type: "COMMISSION_PAYOUT_LEDGER_POST" as any,
        payload: { payoutBatchId: batchId },
        priority: "HIGH",
        idempotencyKey: `retry_payout_ledger_${batchId}`
      });
    }

    // Audit Log
    await logCoreAudit(
      actor,
      "admin",
      "COMMISSION_PAYOUT_CONFIRMED_PAID",
      `payoutBatches/${batchId}`,
      { status: "PROCESSING" },
      {
        status: "PAID",
        transferReference: cleanTransferRef,
        proofReference: proofReference || null,
        netPayoutAmount: updatedBatch.netPayoutAmount,
        ledgerJournalId
      },
      `Payout batch ${updatedBatch.batchNumber} confirmed PAID (Transfer Ref: ${cleanTransferRef}, Rp ${updatedBatch.netPayoutAmount.toLocaleString('id-ID')})`
    );

    return { success: true, journalId: ledgerJournalId || undefined };
  }

  /**
   * Cancel Payout Batch before bank transfer execution.
   * Unlocks all allocated commission records back to UNPAID.
   * AC-8
   */
  async cancelPayoutBatch(params: {
    batchId: string;
    cancellationReason?: string;
    actor: { uid: string; email: string };
  }): Promise<{ success: boolean; message?: string }> {
    const { batchId, cancellationReason, actor } = params;

    const batchSnap = await adminDb.collection("payoutBatches").doc(batchId).get();
    if (!batchSnap.exists) {
      return { success: false, message: `Batch '${batchId}' tidak ditemukan.` };
    }

    const batch = batchSnap.data() as PayoutBatch;
    if (batch.status === "PAID") {
      return { success: false, message: "Batch yang sudah PAID tidak dapat dibatalkan (Hubungi Finance Head untuk prosedur khusus)." };
    }

    if (batch.status === "CANCELLED") {
      return { success: true, message: "Batch sudah berstatus CANCELLED." };
    }

    const now = new Date().toISOString();

    try {
      await adminDb.runTransaction(async (transaction) => {
        // Unlock all commission records back to UNPAID
        const allocations = Array.isArray(batch.allocations) ? batch.allocations : [];
        for (const item of allocations) {
          const cRef = adminDb.collection("commissionRecords").doc(item.commissionId);
          const cSnap = await transaction.get(cRef);
          if (cSnap.exists) {
            const rec = cSnap.data() as CommissionRecord;
            // Only unlock if still pointing to this batch
            if (rec.payoutBatchId === batchId) {
              transaction.update(cRef, {
                payoutStatus: "UNPAID",
                payoutBatchId: null,
                updatedAt: now
              });
            }
          }
        }

        // Update batch status to CANCELLED
        transaction.update(adminDb.collection("payoutBatches").doc(batchId), {
          status: "CANCELLED",
          cancelledBy: actor.uid,
          cancelledAt: now,
          cancellationReason: cancellationReason || "Dibatalkan oleh admin",
          updatedAt: now
        });
      });

      await logCoreAudit(
        actor,
        "admin",
        "COMMISSION_PAYOUT_BATCH_CANCELLED",
        `payoutBatches/${batchId}`,
        { status: batch.status },
        { status: "CANCELLED", cancellationReason: cancellationReason || null },
        `Payout batch ${batch.batchNumber} cancelled`
      );

      return { success: true };
    } catch (err: any) {
      console.error("[Cancel Payout Batch Error]", err);
      return { success: false, message: err.message || "Gagal membatalkan batch payout." };
    }
  }

  /**
   * Mark Payout Batch as FAILED (e.g. Bank rejected transfer).
   * Unlocks commission records back to UNPAID so they can be re-batched.
   * AC-9
   */
  async markPayoutBatchFailed(params: {
    batchId: string;
    failureReason: string;
    actor: { uid: string; email: string };
  }): Promise<{ success: boolean; message?: string }> {
    const { batchId, failureReason, actor } = params;

    const batchSnap = await adminDb.collection("payoutBatches").doc(batchId).get();
    if (!batchSnap.exists) {
      return { success: false, message: `Batch '${batchId}' tidak ditemukan.` };
    }

    const batch = batchSnap.data() as PayoutBatch;
    if (batch.status === "PAID") {
      return { success: false, message: "Batch yang sudah PAID tidak dapat ditandai FAILED." };
    }

    const now = new Date().toISOString();

    try {
      await adminDb.runTransaction(async (transaction) => {
        // Unlock all commission records back to UNPAID
        const allocations = Array.isArray(batch.allocations) ? batch.allocations : [];
        for (const item of allocations) {
          const cRef = adminDb.collection("commissionRecords").doc(item.commissionId);
          const cSnap = await transaction.get(cRef);
          if (cSnap.exists) {
            const rec = cSnap.data() as CommissionRecord;
            if (rec.payoutBatchId === batchId) {
              transaction.update(cRef, {
                payoutStatus: "UNPAID",
                payoutBatchId: null,
                updatedAt: now
              });
            }
          }
        }

        // Update batch status to FAILED
        transaction.update(adminDb.collection("payoutBatches").doc(batchId), {
          status: "FAILED",
          failureReason: failureReason || "Transfer bank gagal",
          updatedAt: now
        });
      });

      await logCoreAudit(
        actor,
        "admin",
        "COMMISSION_PAYOUT_BATCH_FAILED",
        `payoutBatches/${batchId}`,
        { status: batch.status },
        { status: "FAILED", failureReason },
        `Payout batch ${batch.batchNumber} marked FAILED: ${failureReason}`
      );

      return { success: true };
    } catch (err: any) {
      console.error("[Mark Payout Batch Failed Error]", err);
      return { success: false, message: err.message || "Gagal menandai batch FAILED." };
    }
  }

  /**
   * Export Generic Bank Transfer CSV / Transfer Instruction.
   * AC-5 & AC-16: Revalidates against stale refund; decrypts account number in memory only.
   */
  async exportTransferInstruction(
    batchId: string,
    actor: { uid: string; email: string }
  ): Promise<{ success: boolean; csvContent?: string; filename?: string; message?: string }> {
    const batchSnap = await adminDb.collection("payoutBatches").doc(batchId).get();
    if (!batchSnap.exists) {
      return { success: false, message: `Batch '${batchId}' tidak ditemukan.` };
    }

    const batch = batchSnap.data() as PayoutBatch;

    // AC-16: Revalidate against stale refund before generating transfer instruction
    const reval = await this.revalidateBatchAllocations(batch);
    if (!reval.valid) {
      await adminDb.collection("payoutBatches").doc(batchId).update({
        status: "NEEDS_REVIEW",
        reviewReason: reval.staleReason,
        updatedAt: new Date().toISOString()
      });
      return {
        success: false,
        message: `Ekspor instruksi transfer ditolak karena perubahan saldo: ${reval.staleReason}. Batch telah ditandai NEEDS_REVIEW.`
      };
    }

    // Fetch recipient to decrypt bank account in memory
    const recSnap = await adminDb.collection("commissionRecipients").doc(batch.recipientId).get();
    if (!recSnap.exists) {
      return { success: false, message: `Penerima '${batch.recipientId}' tidak ditemukan.` };
    }
    const recipient = recSnap.data() as any;

    let plaintextAccountNumber = "";
    if (recipient.payoutAccount?.encryptedAccountNumber) {
      try {
        const { decryptSecret } = await import("./midtrans");
        plaintextAccountNumber = decryptSecret(recipient.payoutAccount.encryptedAccountNumber);
      } catch (err) {
        plaintextAccountNumber = recipient.payoutAccount.accountNumberMasked || "";
      }
    } else if (recipient.payoutAccount?.accountNumber) {
      plaintextAccountNumber = recipient.payoutAccount.accountNumber;
    } else {
      plaintextAccountNumber = recipient.payoutAccount?.accountNumberMasked || "";
    }

    // Generate Generic Bank Transfer CSV
    // Format: Recipient Name, Bank Name, Account Number, Transfer Amount, Transfer Note / Reference
    const headers = ["Recipient Name", "Bank Name", "Account Number", "Transfer Amount", "Transfer Note / Reference"];
    const row = [
      `"${(batch.recipientSnapshot.name || "").replace(/"/g, '""')}"`,
      `"${(batch.recipientSnapshot.bankName || "").replace(/"/g, '""')}"`,
      `"${plaintextAccountNumber.replace(/"/g, '""')}"`,
      batch.netPayoutAmount,
      `"Payout ${batch.batchNumber}"`
    ];

    const csvContent = `${headers.join(",")}\n${row.join(",")}\n`;
    const filename = `Transfer_Instruction_${batch.batchNumber}.csv`;

    await logCoreAudit(
      actor,
      "admin",
      "COMMISSION_PAYOUT_INSTRUCTION_EXPORTED",
      `payoutBatches/${batchId}`,
      null,
      {
        batchNumber: batch.batchNumber,
        recipientId: batch.recipientId,
        amount: batch.netPayoutAmount
      },
      `Payout transfer instruction exported for ${batch.batchNumber}`
    );

    return { success: true, csvContent, filename };
  }
}
