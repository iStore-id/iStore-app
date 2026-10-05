import { logCoreAudit } from "./core-service.js";
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
} from "../types/commission.js";
import { supabaseAdmin } from "./supabase-admin.js";
import * as repo from "./commission-repository.js";
import { SystemConfigRepository } from "./supabase/system-config-repository.js";
import { OrderRepository } from "./supabase/order-repository.js";
import { SupabaseCatalogRepository } from "./supabase/catalog-repository.js";
import { SupabaseRefundRepository } from "./supabase/refund-repository.js";

function getSupabase() {
  if (!supabaseAdmin) {
    throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED: Supabase service role client is not available.");
  }
  return supabaseAdmin;
}

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
      const data = await SystemConfigRepository.getInstance().getConfig("commission_config");
      if (!data) return DEFAULT_COMMISSION_CONFIG;
      return (data.value || data || DEFAULT_COMMISSION_CONFIG) as CommissionConfig;
    } catch (err) {
      console.error("[CommissionService] Failed to load config from Supabase, using default:", err);
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
      return repo.getRecipientById(identifier.value);
    } else {
      return repo.getRecipientByCode(identifier.value);
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
    const allRules = await repo.getRules({ status: "ACTIVE", recipientType: "AFFILIATE" });

    if (!allRules || allRules.length === 0) return null;

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

    // 2. Check variant doc if variantId exists (from Supabase Catalog Repository)
    if (order.variantId) {
      try {
        const variant = await SupabaseCatalogRepository.getInstance().getVariant(order.variantId);
        if (variant && variant.pricing) {
          const cost = variant.pricing.baseCost;
          if (typeof cost === 'number' && !isNaN(cost) && cost >= 0) {
            return cost;
          }
        }
      } catch (err) {
        console.warn(`[CommissionService] Failed to fetch variant ${order.variantId} baseCost from Supabase:`, err);
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
      // 1. Fetch order data if not provided (from Supabase OrderRepository)
      let order = orderData;
      if (!order) {
        const dbOrder = await OrderRepository.getInstance().getOrderById(orderId);
        if (!dbOrder) {
          return { success: false, accrued: false, reason: "ORDER_NOT_FOUND" };
        }
        order = dbOrder;
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

      // Check if already exists in Supabase
      const existingRecord = await repo.getRecordById(commissionId);
      if (existingRecord) {
        console.log(`[Commission Idempotency] Record ${commissionId} already exists for order ${actualOrderId}`);
        // Self-healing check: if commission is PAYABLE but ledger was not posted yet, attempt idempotent post
        if (existingRecord.status === "PAYABLE" && existingRecord.ledgerStatus !== "POSTED") {
          try {
            const { recordCommissionAccrual } = await import("./ledger-service.js");
            const ledgerResult = await recordCommissionAccrual(existingRecord, actor.uid || "SYSTEM");
            await repo.updateRecord(commissionId, {
              ledgerStatus: "POSTED",
              ledgerJournalId: ledgerResult.docId,
              ledgerPostedAt: new Date().toISOString()
            });
            existingRecord.ledgerStatus = "POSTED";
            existingRecord.ledgerJournalId = ledgerResult.docId;
          } catch (retryErr: any) {
            console.error(`[Commission Ledger Retry Error] Failed to post ledger for ${commissionId} on duplicate invocation. Enqueueing durable retry.`, retryErr?.message || retryErr);
            
            try {
              const { JobService } = await import("./job-service.js");
              await JobService.getInstance().enqueue('PROCESS_COMMISSION', {
                type: "COMMISSION_LEDGER_POST",
                payload: { commissionId },
                idempotencyKey: `comm_ledger_job_${commissionId}`,
                priority: "HIGH"
              });
            } catch (queueErr: any) {
              console.error(`[Commission Ledger Critical] Failed to enqueue retry job for ${commissionId} on duplicate path:`, queueErr.message);
            }
          }
        }

        return { 
          success: true, 
          accrued: false, 
          reason: "ALREADY_ACCRUED", 
          record: existingRecord 
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

      // 10. Thread-safe Insert into Supabase
      let createdRecord: CommissionRecord;
      try {
        createdRecord = await repo.createRecord(newRecord);
      } catch (insertErr: any) {
        if (insertErr.code === "23505") {
          // Unique key violation -> Concurrent write won. Fetch existing
          const existing = await repo.getRecordById(commissionId);
          if (!existing) {
            throw new Error("CONCURRENT_ACCRUE_CONFLICT: Record insert failed but existing was not found.");
          }
          return {
            success: true,
            accrued: false,
            reason: "ALREADY_ACCRUED",
            record: existing
          };
        } else {
          console.error("[accrueCommissionForOrder Insert Error]", insertErr);
          throw insertErr;
        }
      }

      // 11. Core Audit Log
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

      // 12. Double-Entry Ledger Posting
      try {
        const { recordCommissionAccrual } = await import("./ledger-service.js");
        const ledgerResult = await recordCommissionAccrual(createdRecord, actor.uid || "SYSTEM");

        await repo.updateRecord(commissionId, {
          ledgerStatus: "POSTED",
          ledgerJournalId: ledgerResult.docId,
          ledgerPostedAt: new Date().toISOString()
        });

        createdRecord.ledgerStatus = "POSTED";
        createdRecord.ledgerJournalId = ledgerResult.docId;
        createdRecord.ledgerPostedAt = new Date().toISOString();
      } catch (ledgerErr: any) {
        console.error(`[Commission Ledger Error] Failed to post commission ${commissionId} to ledger. Enqueueing durable retry.`, ledgerErr?.message || ledgerErr);

        try {
          await repo.updateRecord(commissionId, {
            ledgerStatus: "FAILED"
          });
          createdRecord.ledgerStatus = "FAILED";
        } catch (updateErr: any) {
          console.error(`[Commission Ledger Error] Failed to set ledgerStatus to FAILED for ${commissionId}:`, updateErr.message);
        }

        try {
          const { JobService } = await import("./job-service.js");
          await JobService.getInstance().enqueue('PROCESS_COMMISSION', {
            type: "COMMISSION_LEDGER_POST",
            payload: { commissionId },
            idempotencyKey: `comm_ledger_job_${commissionId}`,
            priority: "HIGH"
          });
        } catch (queueErr: any) {
          // Requirement 3: Surface/log the failure clearly if enqueueing fails
          console.error(`[Commission Ledger Critical] CRITICAL: Failed to enqueue durable retry for ${commissionId}. This record requires manual recovery.`, queueErr.message);
        }
      }

      return {
        success: true,
        accrued: true,
        record: createdRecord
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
      // 1. Authoritative check: verify refund exists and is SUCCEEDED in Supabase
      const refundData: any = await SupabaseRefundRepository.getInstance().getRefundById(cleanRefundKey);

      if (!refundData) {
        console.warn(`[Commission Refund Reversal] Refund ${cleanRefundKey} not found in Supabase.`);
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

      // 2. Execute RPC atomic procedure in Supabase
      const supabase = getSupabase();
      const { data: rpcRes, error: rpcErr } = await supabase.rpc(
        "handle_commission_refund_atomic",
        {
          p_order_id: cleanOrderId,
          p_refund_key: cleanRefundKey,
          p_refund_amount: refundAmount
        }
      );

      if (rpcErr) {
        console.error("[RPC Error handle_commission_refund_atomic]", rpcErr);
        throw rpcErr;
      }

      if (!rpcRes || !rpcRes.success) {
        return {
          success: false,
          orderId: cleanOrderId,
          refundKey: cleanRefundKey,
          refundAmount,
          processedRecordsCount: 0,
          totalDeltaReversed: 0,
          results: [],
          reason: rpcRes?.message || "RPC_EXECUTION_FAILED"
        };
      }

      const rpcResults = Array.isArray(rpcRes.results) ? rpcRes.results : [];
      const reversalResults: ReversalResult["results"] = [];
      let totalDeltaReversed = Number(rpcRes.totalDeltaReversed) || 0;

      for (const resItem of rpcResults) {
        const delta = Number(resItem.deltaReversal) || 0;
        let ledgerJournalId = resItem.ledgerJournalId || null;

        // Fetch full updated record from Supabase for audit and ledger
        const fullRecord = await repo.getRecordById(resItem.commissionId);

        if (delta > 0 && fullRecord && !resItem.alreadyProcessed) {
          // Double-Entry Ledger Posting
          try {
            const { safeRecordCommissionAccrualReversal } = await import("./ledger-service.js");
            const ledgerRes = await safeRecordCommissionAccrualReversal(
              fullRecord,
              cleanRefundKey,
              delta,
              actor.uid || "SYSTEM",
              { orderId: cleanOrderId, refundAmount }
            );

            if (ledgerRes) {
              ledgerJournalId = ledgerRes.docId;
            }
          } catch (ledgerError: any) {
            console.error(`[Commission Reversal Ledger Error] Failed for ${resItem.commissionId}:`, ledgerError);

            // Enqueue retry job for resilient ledger posting
            try {
              const { JobService } = await import("./job-service.js");
              await JobService.getInstance().enqueue('PROCESS_COMMISSION', {
                type: "COMMISSION_LEDGER_REVERSAL_POST",
                payload: {
                  commissionId: resItem.commissionId,
                  refundKey: cleanRefundKey,
                  deltaReversal: delta
                },
                idempotencyKey: `comm_rev_ledger_${resItem.commissionId}_${cleanRefundKey}`,
                priority: "HIGH"
              });
            } catch (jobErr) {
              console.error(`[Commission Reversal Ledger Error] Failed to enqueue retry job:`, jobErr);
            }
          }
        }

        // Log Core Audit event if not already processed in this step
        if (!resItem.alreadyProcessed && fullRecord) {
          await logCoreAudit(
            actor,
            "system",
            fullRecord.status === "CANCELLED" ? "COMMISSION_CANCELLED_BY_REFUND" : "COMMISSION_PARTIAL_REVERSED",
            `commissionRecords/${resItem.commissionId}`,
            null,
            {
              commissionId: resItem.commissionId,
              orderId: cleanOrderId,
              refundKey: cleanRefundKey,
              refundAmount,
              deltaReversal: delta,
              cumulativeReversed: resItem.cumulativeReversed,
              remainingPayable: resItem.remainingPayable,
              previousStatus: resItem.previousStatus,
              newStatus: resItem.newStatus,
              ledgerJournalId
            },
            `Commission ${resItem.commissionId} ${fullRecord.status === "CANCELLED" ? "fully cancelled" : "partially clawed back"} by refund ${cleanRefundKey} (Delta: Rp ${delta.toLocaleString('id-ID')})`
          );
        }

        reversalResults.push({
          commissionId: resItem.commissionId,
          recipientId: resItem.recipientId,
          previousStatus: resItem.previousStatus,
          newStatus: resItem.newStatus,
          deltaReversal: delta,
          cumulativeReversed: resItem.cumulativeReversed,
          remainingPayable: resItem.remainingPayable,
          ledgerJournalId
        });
      }

      return {
        success: true,
        orderId: cleanOrderId,
        refundKey: cleanRefundKey,
        refundAmount,
        processedRecordsCount: rpcRes.processedRecordsCount || reversalResults.length,
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
      const rec = await repo.getRecordById(item.commissionId);
      if (!rec) {
        return {
          valid: false,
          staleReason: `Commission record '${item.commissionId}' not found in database.`
        };
      }

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

    // 1. Verify recipient and payout account in Supabase
    const recipient = await repo.getRecipientById(cleanRecipientId);
    if (!recipient) {
      return { success: false, message: `Penerima komisi '${cleanRecipientId}' tidak ditemukan.` };
    }
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

    // 3. Atomically update commission records in Supabase to ALLOCATED and calculate sum
    const now = new Date().toISOString();
    try {
      const allocations: PayoutAllocationItem[] = [];
      let totalAmount = 0;

      // Lock records atomically to prevent double allocation
      const supabase = getSupabase();
      
      // Fetch and validate
      for (const commId of commissionRecordIds) {
        const rec = await repo.getRecordById(commId);
        if (!rec) {
          throw new Error(`Commission record '${commId}' tidak ditemukan.`);
        }

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

      // Try to acquire the payout locks atomically in Supabase using RPC
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('create_payout_batch_atomic', {
        p_batch_id: batchId,
        p_batch_number: batchNumber,
        p_recipient_id: cleanRecipientId,
        p_recipient_snapshot: {
          recipientId: cleanRecipientId,
          name: recipient.name,
          bankName: recipient.payoutAccount!.bankName,
          accountHolderName: recipient.payoutAccount!.accountHolderName,
          accountNumberMasked: recipient.payoutAccount!.accountNumberMasked
        },
        p_allocations: allocations,
        p_total_amount: totalAmount,
        p_created_by: actor.uid
      });

      if (rpcErr) {
        throw rpcErr;
      }

      if (!rpcRes?.success) {
        throw new Error(`Gagal membuat batch payout: ${rpcRes?.reason || 'Unknown error'}`);
      }

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
          totalCommissionAmount: totalAmount,
          recordsCount: commissionRecordIds.length,
          overrideThreshold: !!overrideThreshold,
          overrideReason: overrideReason || null
        },
        `Payout batch ${batchNumber} created for ${recipient.name} (Rp ${totalAmount.toLocaleString('id-ID')})`
      );

      return { success: true, batch: batchDocData };
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
    const batch = await repo.getPayoutBatchById(batchId);
    if (!batch) {
      return { success: false, message: `Batch '${batchId}' tidak ditemukan.` };
    }

    if (batch.status !== "DRAFT") {
      return { success: false, message: `Batch berstatus '${batch.status}', hanya batch DRAFT yang dapat diajukan.` };
    }

    // Fresh Revalidation
    const reval = await this.revalidateBatchAllocations(batch);
    if (!reval.valid) {
      await repo.updatePayoutBatchStatus(batchId, {
        status: "NEEDS_REVIEW",
        review_reason: reval.staleReason,
        updated_at: new Date().toISOString()
      });
      return {
        success: false,
        message: `Pengajuan ditolak karena perubahan saldo: ${reval.staleReason}. Batch telah ditandai NEEDS_REVIEW.`
      };
    }

    const now = new Date().toISOString();
    await repo.updatePayoutBatchStatus(batchId, {
      status: "PENDING_APPROVAL",
      submitted_by: actor.uid,
      submitted_at: now,
      updated_at: now
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
    const batch = await repo.getPayoutBatchById(batchId);
    if (!batch) {
      return { success: false, message: `Batch '${batchId}' tidak ditemukan.` };
    }

    if (batch.status !== "PENDING_APPROVAL") {
      return { success: false, message: `Batch berstatus '${batch.status}', only PENDING_APPROVAL can be approved.` };
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
      await repo.updatePayoutBatchStatus(batchId, {
        status: "NEEDS_REVIEW",
        review_reason: reval.staleReason,
        updated_at: new Date().toISOString()
      });
      return {
        success: false,
        message: `Persetujuan ditolak karena perubahan saldo: ${reval.staleReason}. Batch telah ditandai NEEDS_REVIEW.`
      };
    }

    const now = new Date().toISOString();
    await repo.updatePayoutBatchStatus(batchId, {
      status: "PROCESSING",
      approved_by: actor.uid,
      approved_at: now,
      updated_at: now
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

    const currentBatchData = await repo.getPayoutBatchById(batchId);
    if (!currentBatchData) {
      return { success: false, message: `Batch '${batchId}' tidak ditemukan.` };
    }

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

    // Gate 1: Batch must be in PROCESSING/PENDING_APPROVAL/NEEDS_REVIEW status (per RPC whitelist)
    const allowedStatuses = ['PROCESSING', 'PENDING_APPROVAL', 'NEEDS_REVIEW'];
    if (!allowedStatuses.includes(currentBatchData.status)) {
      return { success: false, message: `Batch berstatus '${currentBatchData.status}', tidak dapat dikonfirmasi lunas.` };
    }

    try {
      const supabase = getSupabase();
      
      // Execute strict atomic logic via RPC
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('confirm_payout_paid_atomic', {
        p_batch_id: batchId,
        p_transfer_reference: cleanTransferRef,
        p_proof_reference: proofReference || null,
        p_paid_by: actor.uid,
        p_ledger_journal_id: null // Will be updated after ledger posting
      });

      if (rpcErr) {
        throw rpcErr;
      }

      if (!rpcRes?.success) {
        if (rpcRes?.alreadyPaid) {
          return { success: true, message: "Batch sudah dikonfirmasi lunas (Idempotent)." };
        }
        throw new Error(`Gagal konfirmasi pembayaran: ${rpcRes?.reason || 'SQL_ERROR'}`);
      }

    } catch (err: any) {
      console.error("[Confirm Payout Paid Logic Aborted]", err);

      // If stale detected via RAISE EXCEPTION in RPC, handle message
      if (err.message && err.message.includes("Refund Race Detected")) {
        await repo.updatePayoutBatchStatus(batchId, {
          status: "NEEDS_REVIEW",
          review_reason: err.message,
          updated_at: new Date().toISOString()
        });
      }

      return { success: false, message: err.message || "Gagal mengonfirmasi pembayaran payout." };
    }

    // Post Double-Entry Ledger
    const updatedBatch = await repo.getPayoutBatchById(batchId);
    if (!updatedBatch) {
       return { success: false, message: "Gagal mengambil data batch setelah konfirmasi." };
    }

    let ledgerJournalId: string | null = null;
    try {
      const { recordCommissionPayout } = await import("./ledger-service.js");
      const ledgerResult = await recordCommissionPayout(updatedBatch, actor.email);
      ledgerJournalId = ledgerResult.docId;

      // Update journal ID in Supabase
      await repo.updatePayoutBatchStatus(batchId, {
        ledger_journal_id: ledgerResult.docId,
        updated_at: new Date().toISOString()
      });
    } catch (ledgerErr: any) {
      console.error("[Ledger Payout Posting Failed - Enqueueing Retry]", ledgerErr);
      try {
        const { JobService } = await import("./job-service.js");
        await JobService.getInstance().enqueue('PROCESS_COMMISSION', {
          type: "COMMISSION_PAYOUT_LEDGER_POST" as any,
          payload: { payoutBatchId: batchId },
          priority: "HIGH",
          idempotencyKey: `retry_payout_ledger_${batchId}`
        });
      } catch (queueErr: any) {
        console.error(`[CRITICAL] Payout Ledger Recovery Lost for Batch ${batchId}`, {
          batchId,
          transferReference: cleanTransferRef,
          ledgerError: ledgerErr?.message || ledgerErr,
          queueError: queueErr?.message || queueErr
        });
        return { 
          success: false, 
          message: `Payout berhasil dikonfirmasi PAID, namun posting ledger gagal dan antrian retry gagal dijadwalkan. Batch ${batchId} memerlukan pemulihan manual.` 
        };
      }
    }

    // Audit Log
    await logCoreAudit(
      actor,
      "admin",
      "COMMISSION_PAYOUT_CONFIRMED_PAID",
      `payoutBatches/${batchId}`,
      { status: currentBatchData.status },
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

    const batch = await repo.getPayoutBatchById(batchId);
    if (!batch) {
      return { success: false, message: `Batch '${batchId}' tidak ditemukan.` };
    }

    if (batch.status === "PAID") {
      return { success: false, message: "Batch yang sudah PAID tidak dapat dibatalkan." };
    }

    if (batch.status === "CANCELLED") {
      return { success: true, message: "Batch sudah berstatus CANCELLED." };
    }

    try {
      const supabase = getSupabase();
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('cancel_payout_batch_atomic', {
        p_batch_id: batchId,
        p_cancelled_by: actor.uid,
        p_cancellation_reason: cancellationReason || "Dibatalkan oleh admin"
      });

      if (rpcErr) {
        throw rpcErr;
      }

      if (!rpcRes?.success) {
        if (rpcRes?.alreadyCancelled) {
          return { success: true, message: "Batch sudah berstatus CANCELLED." };
        }
        throw new Error(`Gagal membatalkan batch: ${rpcRes?.reason || 'SQL_ERROR'}`);
      }

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

    const batch = await repo.getPayoutBatchById(batchId);
    if (!batch) {
      return { success: false, message: `Batch '${batchId}' tidak ditemukan.` };
    }

    if (batch.status === "PAID") {
      return { success: false, message: "Batch yang sudah PAID tidak dapat ditandai FAILED." };
    }

    const now = new Date().toISOString();

    try {
      // Unlock all commission records in Supabase back to UNPAID
      const supabase = getSupabase();
      const { error: updateErr } = await supabase
        .from("commission_records")
        .update({
          payout_status: "UNPAID",
          payout_batch_id: null,
          updated_at: now
        })
        .eq("payout_batch_id", batchId);

      if (updateErr) {
        throw updateErr;
      }

      // Update batch status to FAILED in Supabase
      await repo.updatePayoutBatchStatus(batchId, {
        status: "FAILED",
        failure_reason: failureReason || "Transfer bank gagal",
        updated_at: now
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
    const batch = await repo.getPayoutBatchById(batchId);
    if (!batch) {
      return { success: false, message: `Batch '${batchId}' tidak ditemukan.` };
    }

    // AC-16: Revalidate against stale refund before generating transfer instruction
    const reval = await this.revalidateBatchAllocations(batch);
    if (!reval.valid) {
      await repo.updatePayoutBatchStatus(batchId, {
        status: "NEEDS_REVIEW",
        review_reason: reval.staleReason,
        updated_at: new Date().toISOString()
      });
      return {
        success: false,
        message: `Ekspor instruksi transfer ditolak karena perubahan saldo: ${reval.staleReason}. Batch telah ditandai NEEDS_REVIEW.`
      };
    }

    // Fetch recipient from Supabase to decrypt bank account in memory
    const recipient = await repo.getRecipientById(batch.recipientId);
    if (!recipient) {
      return { success: false, message: `Penerima '${batch.recipientId}' tidak ditemukan.` };
    }

    let plaintextAccountNumber = "";
    if (recipient.payoutAccount?.encryptedAccountNumber) {
      try {
        const { decryptSecret } = await import("./midtrans");
        plaintextAccountNumber = decryptSecret(recipient.payoutAccount.encryptedAccountNumber);
      } catch (err) {
        plaintextAccountNumber = recipient.payoutAccount.accountNumberMasked || "";
      }
    } else {
      plaintextAccountNumber = recipient.payoutAccount?.accountNumberMasked || "";
    }

    // Generate Generic Bank Transfer CSV
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
