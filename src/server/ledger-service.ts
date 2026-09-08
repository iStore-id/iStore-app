import { adminDb } from "./firebase-admin";
import { 
  LedgerAccount, 
  LEDGER_ACCOUNT_NAMES, 
  LedgerEventType, 
  LedgerLineItem, 
  LedgerJournalEntry 
} from "../types/ledger";
import { SettlementAdjustmentType } from "../types/core";

// Audit logger helper for Ledger operations
export async function logLedgerAudit(
  userId: string, 
  action: string, 
  resourceId: string, 
  payload: any
) {
  try {
    const auditRef = adminDb.collection("auditLogs").doc();
    await auditRef.set({
      id: auditRef.id,
      adminUid: userId || "SYSTEM",
      action,
      resource: "ledgerJournalEntries",
      resourceId,
      payload,
      details: payload,
      createdAt: new Date().toISOString()
    });
  } catch (e) {
    console.warn("Notice: Failed to write ledger audit log", e);
  }
}

/**
 * Validates double-entry accounting integrity:
 * 1. Amounts must be non-negative integers (Integer IDR).
 * 2. Sum of Debits MUST equal Sum of Credits.
 * 3. Total amount must be strictly positive (> 0).
 */
export function validateJournalEntry(lineItems: LedgerLineItem[]): { 
  isValid: boolean; 
  totalDebit: number; 
  totalCredit: number; 
  error?: string 
} {
  if (!lineItems || lineItems.length === 0) {
    return { isValid: false, totalDebit: 0, totalCredit: 0, error: "Line items cannot be empty." };
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const item of lineItems) {
    if (typeof item.debit !== "number" || typeof item.credit !== "number") {
      return { isValid: false, totalDebit, totalCredit, error: "Debit and Credit amounts must be numbers." };
    }

    if (!Number.isInteger(item.debit) || item.debit < 0) {
      return { isValid: false, totalDebit, totalCredit, error: `Invalid debit amount [${item.debit}]. Must be a non-negative integer.` };
    }

    if (!Number.isInteger(item.credit) || item.credit < 0) {
      return { isValid: false, totalDebit, totalCredit, error: `Invalid credit amount [${item.credit}]. Must be a non-negative integer.` };
    }

    if ((item.debit > 0 && item.credit > 0) || (item.debit === 0 && item.credit === 0)) {
      return { isValid: false, totalDebit, totalCredit, error: `Line item for account ${item.accountId} must have strictly debit > 0 XOR credit > 0.` };
    }

    totalDebit += item.debit;
    totalCredit += item.credit;
  }

  if (totalDebit !== totalCredit) {
    return { 
      isValid: false, 
      totalDebit, 
      totalCredit, 
      error: `Double-entry imbalance: Total Debit (${totalDebit}) does not equal Total Credit (${totalCredit}).` 
    };
  }

  if (totalDebit <= 0) {
    return { isValid: false, totalDebit, totalCredit, error: "Total transaction amount must be greater than zero." };
  }

  return { isValid: true, totalDebit, totalCredit };
}

export interface CreateJournalEntryParams {
  idempotencyKey: string;
  eventType: LedgerEventType;
  source: {
    collection: string;
    documentId: string;
    eventId?: string;
  };
  lineItems: LedgerLineItem[];
  createdBy?: string;
  reversalOf?: string | null;
  metadata?: Record<string, any>;
}

export interface CreateJournalEntryResult {
  success: boolean;
  duplicate: boolean;
  docId: string;
  idempotencyKey: string;
  entry?: LedgerJournalEntry;
  error?: string;
}

/**
 * Creates an append-only, immutable double-entry ledger record.
 * Uses atomic document creation docRef.create() to enforce deterministic idempotency.
 */
export async function createJournalEntry(
  params: CreateJournalEntryParams
): Promise<CreateJournalEntryResult> {
  const {
    idempotencyKey,
    eventType,
    source,
    lineItems,
    createdBy = "SYSTEM",
    reversalOf = null,
    metadata = {}
  } = params;

  if (!idempotencyKey || typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
    throw new Error("LEDGER_ERROR: Idempotency key is required.");
  }

  // 1. Validate double-entry accounting integrity
  const validation = validateJournalEntry(lineItems);
  if (!validation.isValid) {
    throw new Error(`LEDGER_VALIDATION_ERROR: ${validation.error}`);
  }

  const docId = `ledger_${idempotencyKey}`;
  const docRef = adminDb.collection("ledgerJournalEntries").doc(docId);
  const now = new Date().toISOString();

  const entryData: LedgerJournalEntry = {
    id: docId,
    idempotencyKey,
    eventType,
    source,
    lineItems,
    totalAmount: validation.totalDebit,
    currency: "IDR",
    reversalOf,
    createdBy,
    createdAt: now,
    metadata
  };

  try {
    // Atomic document creation — throws error if document already exists
    await docRef.create(entryData);

    // Audit log for new entry creation
    await logLedgerAudit(createdBy, "CREATE_LEDGER_ENTRY", docId, {
      idempotencyKey,
      eventType,
      totalAmount: validation.totalDebit,
      source
    });

    return {
      success: true,
      duplicate: false,
      docId,
      idempotencyKey,
      entry: entryData
    };
  } catch (error: any) {
    // Code 6 in gRPC / Firestore indicates ALREADY_EXISTS
    const isAlreadyExists = 
      error.code === 6 || 
      error.code === "already-exists" || 
      (error.message && error.message.includes("ALREADY_EXISTS")) ||
      (error.message && error.message.includes("Document already exists"));

    if (isAlreadyExists) {
      // Fetch existing document to return deterministic response
      const existingDoc = await docRef.get();
      const existingData = existingDoc.data() as LedgerJournalEntry;

      return {
        success: true,
        duplicate: true,
        docId,
        idempotencyKey,
        entry: existingData
      };
    }

    throw new Error(`LEDGER_PERSISTENCE_ERROR: ${error.message}`);
  }
}

// ============================================================================
// APPROVED DOMAIN EVENT RECORDERS
// ============================================================================

/**
 * 1. Record Customer Payment Receipt
 * Idempotency Key: ledger_pay_${orderId}
 * Debit: 1000_GATEWAY_RECEIVABLE
 * Credit: 2000_CUSTOMER_UNEARNED_REVENUE
 */
export async function recordPaymentReceived(
  orderId: string,
  grossAmount: number,
  createdBy: string = "SYSTEM",
  metadata?: Record<string, any>
): Promise<CreateJournalEntryResult> {
  const idempotencyKey = `ledger_pay_${orderId}`;

  return createJournalEntry({
    idempotencyKey,
    eventType: "PAYMENT_RECEIVED",
    source: {
      collection: "orders",
      documentId: orderId,
      eventId: orderId
    },
    lineItems: [
      {
        accountId: LedgerAccount.GATEWAY_RECEIVABLE,
        accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.GATEWAY_RECEIVABLE],
        debit: grossAmount,
        credit: 0
      },
      {
        accountId: LedgerAccount.CUSTOMER_UNEARNED_REVENUE,
        accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.CUSTOMER_UNEARNED_REVENUE],
        debit: 0,
        credit: grossAmount
      }
    ],
    createdBy,
    metadata
  });
}

/**
 * Safely records PAYMENT_RECEIVED for a PAID order without throwing errors or breaking state transitions.
 * Uses server-trusted grossAmount from the order data and deterministic key ledger_pay_${orderId}.
 */
export async function safeRecordPaymentReceived(
  orderId: string,
  orderData: Record<string, any>,
  createdBy: string = "SYSTEM",
  metadata?: Record<string, any>
): Promise<CreateJournalEntryResult | null> {
  try {
    const grossAmount = orderData.totalAmount || orderData.totalPrice || orderData.price || 0;

    if (!grossAmount || grossAmount <= 0) {
      console.warn(`[Ledger Warning] Cannot record PAYMENT_RECEIVED for order ${orderId}: invalid grossAmount (${grossAmount})`);
      return null;
    }

    const result = await recordPaymentReceived(orderId, grossAmount, createdBy, metadata);
    if (result.duplicate) {
      console.log(`[Ledger Idempotency] PAYMENT_RECEIVED already recorded for order ${orderId}`);
    } else {
      console.log(`[Ledger Success] PAYMENT_RECEIVED recorded for order ${orderId} (Gross IDR ${grossAmount})`);
    }
    return result;
  } catch (error: any) {
    // Non-blocking error handling: Preserve PAID state, log error safely for retry
    console.error(`[Ledger Error] Failed to record PAYMENT_RECEIVED for order ${orderId}:`, error?.message || error);
    return null;
  }
}

/**
 * 2. Record Order Fulfillment Success
 * Idempotency Key: ledger_ful_${orderId}
 * Debit: 2000_CUSTOMER_UNEARNED_REVENUE
 * Credit: 4000_SALES_REVENUE
 */
export async function recordFulfillmentSuccess(
  orderId: string,
  amount: number,
  createdBy: string = "SYSTEM",
  metadata?: Record<string, any>
): Promise<CreateJournalEntryResult> {
  const idempotencyKey = `ledger_ful_${orderId}`;

  return createJournalEntry({
    idempotencyKey,
    eventType: "FULFILLMENT_SUCCESS",
    source: {
      collection: "orders",
      documentId: orderId,
      eventId: orderId
    },
    lineItems: [
      {
        accountId: LedgerAccount.CUSTOMER_UNEARNED_REVENUE,
        accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.CUSTOMER_UNEARNED_REVENUE],
        debit: amount,
        credit: 0
      },
      {
        accountId: LedgerAccount.SALES_REVENUE,
        accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.SALES_REVENUE],
        debit: 0,
        credit: amount
      }
    ],
    createdBy,
    metadata
  });
}

/**
 * Safely records FULFILLMENT_SUCCESS for a SUCCESS order without throwing errors or breaking state transitions.
 * Uses orderData.totalAmount strictly as the canonical server-trusted amount and deterministic key ledger_ful_${orderId}.
 */
export async function safeRecordFulfillmentSuccess(
  orderId: string,
  orderData: Record<string, any>,
  createdBy: string = "SYSTEM",
  metadata?: Record<string, any>
): Promise<CreateJournalEntryResult | null> {
  try {
    const amount = orderData.totalAmount;

    if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
      console.warn(`[Ledger Warning] Cannot record FULFILLMENT_SUCCESS for order ${orderId}: invalid totalAmount [${amount}]`);
      return null;
    }

    const result = await recordFulfillmentSuccess(orderId, amount, createdBy, metadata);
    if (result.duplicate) {
      console.log(`[Ledger Idempotency] FULFILLMENT_SUCCESS already recorded for order ${orderId}`);
    } else {
      console.log(`[Ledger Success] FULFILLMENT_SUCCESS recorded for order ${orderId} (Amount IDR ${amount})`);
    }
    return result;
  } catch (error: any) {
    // Non-blocking error handling: Preserve SUCCESS state, log error safely for retry
    console.error(`[Ledger Error] Failed to record FULFILLMENT_SUCCESS for order ${orderId}:`, error?.message || error);
    return null;
  }
}

/**
 * 3. Record Order Refund Execution
 * Idempotency Key: ledger_ref_${orderId}_${refundId}
 * BEFORE_SETTLEMENT: Debit 4100_SALES_REFUND_CONTRA, Credit 1000_GATEWAY_RECEIVABLE
 * AFTER_SETTLEMENT:  Debit 4100_SALES_REFUND_CONTRA, Credit 1100_BANK_CLEARING
 */
export async function recordRefundExecuted(
  orderId: string,
  refundId: string,
  amount: number,
  settlementContext: 'BEFORE_SETTLEMENT' | 'AFTER_SETTLEMENT',
  createdBy: string = "SYSTEM",
  metadata?: Record<string, any>
): Promise<CreateJournalEntryResult> {
  if (!settlementContext || (settlementContext !== "BEFORE_SETTLEMENT" && settlementContext !== "AFTER_SETTLEMENT")) {
    throw new Error("LEDGER_VALIDATION_ERROR: settlementContext ('BEFORE_SETTLEMENT' | 'AFTER_SETTLEMENT') is strictly required.");
  }

  const idempotencyKey = `ledger_ref_${orderId}_${refundId}`;
  const creditAccount = settlementContext === "BEFORE_SETTLEMENT"
    ? LedgerAccount.GATEWAY_RECEIVABLE
    : LedgerAccount.BANK_CLEARING;

  return createJournalEntry({
    idempotencyKey,
    eventType: "REFUND_EXECUTED",
    source: {
      collection: "orders",
      documentId: orderId,
      eventId: refundId
    },
    lineItems: [
      {
        accountId: LedgerAccount.SALES_REFUND_CONTRA,
        accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.SALES_REFUND_CONTRA],
        debit: amount,
        credit: 0
      },
      {
        accountId: creditAccount,
        accountName: LEDGER_ACCOUNT_NAMES[creditAccount],
        debit: 0,
        credit: amount
      }
    ],
    createdBy,
    metadata: {
      ...metadata,
      settlementContext
    }
  });
}

/**
 * Derives server-trusted settlement context for an order without client input.
 * Returns 'AFTER_SETTLEMENT' ONLY IF settlementRecord exists AND parent settlementBatch.status === 'SETTLED'.
 */
export async function getOrderSettlementContext(orderId: string): Promise<'BEFORE_SETTLEMENT' | 'AFTER_SETTLEMENT'> {
  try {
    const recordRef = adminDb.collection("settlementRecords").doc(`sett_rec_${orderId}`);
    const recordSnap = await recordRef.get();

    if (!recordSnap.exists) {
      return 'BEFORE_SETTLEMENT';
    }

    const batchId = recordSnap.data()?.batchId;
    if (!batchId) {
      return 'BEFORE_SETTLEMENT';
    }

    const batchRef = adminDb.collection("settlementBatches").doc(batchId);
    const batchSnap = await batchRef.get();

    if (batchSnap.exists && batchSnap.data()?.status === "SETTLED") {
      return 'AFTER_SETTLEMENT';
    }

    return 'BEFORE_SETTLEMENT';
  } catch (err) {
    console.warn(`[Settlement Context Check Error] Defaulting to BEFORE_SETTLEMENT for order ${orderId}:`, err);
    return 'BEFORE_SETTLEMENT';
  }
}

/**
 * Safely records REFUND_EXECUTED without throwing errors or interrupting HTTP responses.
 */
export async function safeRecordRefundExecuted(
  orderId: string,
  refundId: string,
  amount: number,
  settlementContext: 'BEFORE_SETTLEMENT' | 'AFTER_SETTLEMENT',
  createdBy: string = "SYSTEM",
  metadata?: Record<string, any>
): Promise<CreateJournalEntryResult | null> {
  try {
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
      console.warn(`[Ledger Warning] Cannot record REFUND_EXECUTED for order ${orderId}, refund ${refundId}: invalid amount [${amount}]`);
      return null;
    }

    if (settlementContext !== "BEFORE_SETTLEMENT" && settlementContext !== "AFTER_SETTLEMENT") {
      console.warn(`[Ledger Warning] Cannot record REFUND_EXECUTED for order ${orderId}, refund ${refundId}: invalid settlementContext [${settlementContext}]`);
      return null;
    }

    const result = await recordRefundExecuted(orderId, refundId, amount, settlementContext, createdBy, metadata);
    if (result.duplicate) {
      console.log(`[Ledger Idempotency] REFUND_EXECUTED already recorded for refund ${refundId}`);
    } else {
      console.log(`[Ledger Success] REFUND_EXECUTED recorded for refund ${refundId} (Amount IDR ${amount}, Context: ${settlementContext})`);
    }
    return result;
  } catch (error: any) {
    console.error(`[Ledger Error] Failed to record REFUND_EXECUTED for refund ${refundId}:`, error?.message || error);
    return null;
  }
}

/**
 * 4. Record Gateway Settlement Batch Closing
 * Idempotency Key: ledger_stl_${batchId}
 * Debit: 1100_BANK_CLEARING (netAmount)
 * Debit: 5000_GATEWAY_MDR_FEE (mdrFeeAmount) [omitted if mdrFeeAmount === 0]
 * Credit: 1000_GATEWAY_RECEIVABLE (grossAmount)
 */
export async function recordSettlementClosed(
  batchId: string,
  grossAmount: number,
  mdrFeeAmount: number,
  netAmount: number,
  createdBy: string = "SYSTEM",
  metadata?: Record<string, any>
): Promise<CreateJournalEntryResult> {
  if (!Number.isInteger(grossAmount) || grossAmount <= 0) {
    throw new Error(`LEDGER_VALIDATION_ERROR: grossAmount [${grossAmount}] must be a positive integer IDR.`);
  }
  if (!Number.isInteger(netAmount) || netAmount < 0) {
    throw new Error(`LEDGER_VALIDATION_ERROR: netAmount [${netAmount}] must be a non-negative integer IDR.`);
  }
  if (!Number.isInteger(mdrFeeAmount) || mdrFeeAmount < 0) {
    throw new Error(`LEDGER_VALIDATION_ERROR: mdrFeeAmount [${mdrFeeAmount}] must be a non-negative integer IDR.`);
  }

  if (grossAmount !== netAmount + mdrFeeAmount) {
    throw new Error(`LEDGER_VALIDATION_ERROR: Settlement arithmetic imbalance: grossAmount (${grossAmount}) !== netAmount (${netAmount}) + mdrFeeAmount (${mdrFeeAmount}).`);
  }

  const idempotencyKey = `ledger_stl_${batchId}`;

  const lineItems: LedgerLineItem[] = [
    {
      accountId: LedgerAccount.BANK_CLEARING,
      accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.BANK_CLEARING],
      debit: netAmount,
      credit: 0
    }
  ];

  if (mdrFeeAmount > 0) {
    lineItems.push({
      accountId: LedgerAccount.GATEWAY_MDR_FEE,
      accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.GATEWAY_MDR_FEE],
      debit: mdrFeeAmount,
      credit: 0
    });
  }

  lineItems.push({
    accountId: LedgerAccount.GATEWAY_RECEIVABLE,
    accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.GATEWAY_RECEIVABLE],
    debit: 0,
    credit: grossAmount
  });

  return createJournalEntry({
    idempotencyKey,
    eventType: "SETTLEMENT_CLOSED",
    source: {
      collection: "settlementBatches",
      documentId: batchId,
      eventId: batchId
    },
    lineItems,
    createdBy,
    metadata
  });
}

/**
 * Safely records SETTLEMENT_CLOSED without throwing errors or interrupting HTTP responses.
 */
export async function safeRecordSettlementClosed(
  batchId: string,
  grossAmount: number,
  mdrFeeAmount: number,
  netAmount: number,
  createdBy: string = "SYSTEM",
  metadata?: Record<string, any>
): Promise<CreateJournalEntryResult | null> {
  try {
    if (grossAmount !== netAmount + mdrFeeAmount) {
      console.warn(`[Ledger Warning] Settlement arithmetic imbalance for batch ${batchId}: grossAmount (${grossAmount}) !== netAmount (${netAmount}) + mdrFeeAmount (${mdrFeeAmount})`);
      return null;
    }

    const result = await recordSettlementClosed(batchId, grossAmount, mdrFeeAmount, netAmount, createdBy, metadata);
    if (result.duplicate) {
      console.log(`[Ledger Idempotency] SETTLEMENT_CLOSED already recorded for batch ${batchId}`);
    } else {
      console.log(`[Ledger Success] SETTLEMENT_CLOSED recorded for batch ${batchId} (Gross: ${grossAmount}, MDR: ${mdrFeeAmount}, Net: ${netAmount})`);
    }
    return result;
  } catch (error: any) {
    console.error(`[Ledger Error] Failed to record SETTLEMENT_CLOSED for batch ${batchId}:`, error?.message || error);
    return null;
  }
}

/**
 * 5. Record Settlement Adjustment
 * Idempotency Key: ledger_adj_${batchId}_${adjustmentId}
 * Positive Adjustment: Debit 1100_BANK_CLEARING, Credit 5100_SETTLEMENT_ADJUSTMENT
 * Negative Adjustment: Debit 5100_SETTLEMENT_ADJUSTMENT, Credit 1100_BANK_CLEARING
 */
export async function recordSettlementAdjustment(
  batchId: string,
  adjustmentId: string,
  amount: number,
  direction: 'POSITIVE' | 'NEGATIVE',
  reason: string,
  createdBy: string = "SYSTEM",
  metadata?: Record<string, any>
): Promise<CreateJournalEntryResult> {
  const idempotencyKey = `ledger_adj_${batchId}_${adjustmentId}`;

  const isPositive = direction === "POSITIVE";
  const lineItems: LedgerLineItem[] = isPositive
    ? [
        {
          accountId: LedgerAccount.BANK_CLEARING,
          accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.BANK_CLEARING],
          debit: amount,
          credit: 0
        },
        {
          accountId: LedgerAccount.SETTLEMENT_ADJUSTMENT,
          accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.SETTLEMENT_ADJUSTMENT],
          debit: 0,
          credit: amount
        }
      ]
    : [
        {
          accountId: LedgerAccount.SETTLEMENT_ADJUSTMENT,
          accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.SETTLEMENT_ADJUSTMENT],
          debit: amount,
          credit: 0
        },
        {
          accountId: LedgerAccount.BANK_CLEARING,
          accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.BANK_CLEARING],
          debit: 0,
          credit: amount
        }
      ];

  return createJournalEntry({
    idempotencyKey,
    eventType: "SETTLEMENT_ADJUSTMENT",
    source: {
      collection: "settlementBatches",
      documentId: batchId,
      eventId: adjustmentId
    },
    lineItems,
    createdBy,
    metadata: {
      ...metadata,
      reason,
      direction
    }
  });
}

/**
 * Maps typed adjustments to explicit double-entry GL account line items.
 * Returns null for unsupported or ambiguous types (e.g. 'OTHER').
 */
export function getAdjustmentLineItems(
  amount: number,
  type: SettlementAdjustmentType,
  direction: 'POSITIVE' | 'NEGATIVE'
): LedgerLineItem[] | null {
  if (type === "OTHER") {
    return null; // Reject ambiguous accounting
  }

  const isPositive = direction === "POSITIVE";

  switch (type) {
    case "MDR_CORRECTION":
      return isPositive
        ? [
            { accountId: LedgerAccount.BANK_CLEARING, accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.BANK_CLEARING], debit: amount, credit: 0 },
            { accountId: LedgerAccount.GATEWAY_MDR_FEE, accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.GATEWAY_MDR_FEE], debit: 0, credit: amount }
          ]
        : [
            { accountId: LedgerAccount.GATEWAY_MDR_FEE, accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.GATEWAY_MDR_FEE], debit: amount, credit: 0 },
            { accountId: LedgerAccount.BANK_CLEARING, accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.BANK_CLEARING], debit: 0, credit: amount }
          ];

    case "BANK_FEE":
      // Bank fee charge / deduction vs fee waiver / refund
      return isPositive
        ? [
            { accountId: LedgerAccount.SETTLEMENT_ADJUSTMENT, accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.SETTLEMENT_ADJUSTMENT], debit: amount, credit: 0 },
            { accountId: LedgerAccount.BANK_CLEARING, accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.BANK_CLEARING], debit: 0, credit: amount }
          ]
        : [
            { accountId: LedgerAccount.BANK_CLEARING, accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.BANK_CLEARING], debit: amount, credit: 0 },
            { accountId: LedgerAccount.SETTLEMENT_ADJUSTMENT, accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.SETTLEMENT_ADJUSTMENT], debit: 0, credit: amount }
          ];

    case "REVENUE_ADJUSTMENT":
      return isPositive
        ? [
            { accountId: LedgerAccount.BANK_CLEARING, accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.BANK_CLEARING], debit: amount, credit: 0 },
            { accountId: LedgerAccount.SALES_REVENUE, accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.SALES_REVENUE], debit: 0, credit: amount }
          ]
        : [
            { accountId: LedgerAccount.SALES_REVENUE, accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.SALES_REVENUE], debit: 0, credit: amount },
            { accountId: LedgerAccount.BANK_CLEARING, accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.BANK_CLEARING], debit: 0, credit: amount }
          ];

    case "RECEIVABLE_WRITE_OFF":
      // Writing off uncollectible gateway receivable vs write-off recovery
      return isPositive
        ? [
            { accountId: LedgerAccount.SETTLEMENT_ADJUSTMENT, accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.SETTLEMENT_ADJUSTMENT], debit: amount, credit: 0 },
            { accountId: LedgerAccount.GATEWAY_RECEIVABLE, accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.GATEWAY_RECEIVABLE], debit: 0, credit: amount }
          ]
        : [
            { accountId: LedgerAccount.GATEWAY_RECEIVABLE, accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.GATEWAY_RECEIVABLE], debit: amount, credit: 0 },
            { accountId: LedgerAccount.SETTLEMENT_ADJUSTMENT, accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.SETTLEMENT_ADJUSTMENT], debit: 0, credit: amount }
          ];

    default:
      return null;
  }
}

/**
 * Safely records SETTLEMENT_ADJUSTMENT with explicit GL classification without throwing or interrupting responses.
 * Idempotency Key: ledger_adj_${batchId}_${adjustmentId}
 */
export async function safeRecordTypedSettlementAdjustment(
  batchId: string,
  adjustmentId: string,
  amount: number,
  type: SettlementAdjustmentType,
  direction: 'POSITIVE' | 'NEGATIVE',
  reason: string,
  createdBy: string = "SYSTEM",
  metadata?: Record<string, any>
): Promise<CreateJournalEntryResult | null> {
  try {
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
      console.warn(`[Ledger Warning] Cannot record SETTLEMENT_ADJUSTMENT for batch ${batchId}, adjustment ${adjustmentId}: invalid amount [${amount}]`);
      return null;
    }

    const lineItems = getAdjustmentLineItems(amount, type, direction);
    if (!lineItems) {
      console.warn(`[Ledger Warning] Cannot record SETTLEMENT_ADJUSTMENT for batch ${batchId}, adjustment ${adjustmentId}: type '${type}' has no explicit GL accounting mapping.`);
      return null;
    }

    const idempotencyKey = `ledger_adj_${batchId}_${adjustmentId}`;

    const result = await createJournalEntry({
      idempotencyKey,
      eventType: "SETTLEMENT_ADJUSTMENT",
      source: {
        collection: "settlementBatches",
        documentId: batchId,
        eventId: adjustmentId
      },
      lineItems,
      createdBy,
      metadata: {
        batchId,
        adjustmentId,
        adjustmentType: type,
        direction,
        reason,
        ...metadata
      }
    });

    if (result.duplicate) {
      console.log(`[Ledger Idempotency] SETTLEMENT_ADJUSTMENT already recorded for adjustment ${adjustmentId}`);
    } else {
      console.log(`[Ledger Success] SETTLEMENT_ADJUSTMENT recorded for adjustment ${adjustmentId} (Type: ${type}, Direction: ${direction}, Amount: IDR ${amount})`);
    }
    return result;
  } catch (error: any) {
    console.error(`[Ledger Error] Failed to record SETTLEMENT_ADJUSTMENT for adjustment ${adjustmentId}:`, error?.message || error);
    return null;
  }
}

/**
 * 6. Create Compensating Reversal Entry
 * Idempotency Key: ledger_rev_${originalIdempotencyKey}
 * Reverses Debits and Credits of the original entry. Never modifies the original.
 */
export async function createReversalEntry(
  originalIdempotencyKey: string,
  reason: string,
  createdBy: string = "SYSTEM"
): Promise<CreateJournalEntryResult> {
  const originalDocId = `ledger_${originalIdempotencyKey}`;
  const originalDoc = await adminDb.collection("ledgerJournalEntries").doc(originalDocId).get();

  if (!originalDoc.exists) {
    throw new Error(`LEDGER_ERROR: Original entry with idempotencyKey [${originalIdempotencyKey}] not found.`);
  }

  const originalData = originalDoc.data() as LedgerJournalEntry;

  if (originalData.eventType === "MANUAL_REVERSAL") {
    throw new Error(`LEDGER_VALIDATION_ERROR: Cannot reverse a reversal entry [${originalIdempotencyKey}].`);
  }

  // Swap Debits and Credits
  const reversedLineItems: LedgerLineItem[] = originalData.lineItems.map(item => ({
    accountId: item.accountId,
    accountName: item.accountName,
    debit: item.credit, // Swap
    credit: item.debit  // Swap
  }));

  const idempotencyKey = `ledger_rev_${originalIdempotencyKey}`;

  return createJournalEntry({
    idempotencyKey,
    eventType: "MANUAL_REVERSAL",
    source: {
      collection: "ledgerJournalEntries",
      documentId: originalDocId,
      eventId: originalIdempotencyKey
    },
    lineItems: reversedLineItems,
    createdBy,
    reversalOf: originalIdempotencyKey,
    metadata: {
      reversalReason: reason,
      originalEventType: originalData.eventType
    }
  });
}

/**
 * Fetch a journal entry by its idempotency key.
 */
export async function getJournalEntryByIdempotencyKey(
  idempotencyKey: string
): Promise<LedgerJournalEntry | null> {
  const docId = `ledger_${idempotencyKey}`;
  const doc = await adminDb.collection("ledgerJournalEntries").doc(docId).get();
  if (!doc.exists) return null;
  return doc.data() as LedgerJournalEntry;
}

/**
 * List ledger journal entries with optional filtering.
 */
export async function listJournalEntries(options?: {
  limit?: number;
  eventType?: LedgerEventType;
}): Promise<LedgerJournalEntry[]> {
  const limitCount = options?.limit || 50;
  let query: FirebaseFirestore.Query = adminDb.collection("ledgerJournalEntries");

  if (options?.eventType) {
    query = query.where("eventType", "==", options.eventType);
  }

  query = query.orderBy("createdAt", "desc").limit(limitCount);
  const snapshot = await query.get();

  return snapshot.docs.map(doc => doc.data() as LedgerJournalEntry);
}

// ============================================================================
// COMMISSION ACCRUAL RECORDER (Phase 3: Ledger Integration)
// ============================================================================

export interface CommissionAccrualInput {
  id: string;
  orderId: string;
  recipientId: string;
  ruleId: string;
  calculationMethod: string;
  commissionAmount: number;
  status: string;
  [key: string]: any;
}

/**
 * 7. Record Commission Accrual into Double-Entry Ledger (Phase 3)
 * Trigger: When commissionRecord.status is PAYABLE.
 * Idempotency Key: commission_accrual_${commissionId}
 * Doc ID: ledger_commission_accrual_${commissionId}
 *
 * Accounting Entry:
 *   Debit:  5200_COMMISSION_EXPENSE (commissionAmount)
 *   Credit: 2100_COMMISSION_PAYABLE (commissionAmount)
 *
 * Immutability: Append-only, never modifies historical balances or entries.
 * Scope constraint: Strictly removes any bank/payout credentials from metadata.
 */
export async function recordCommissionAccrual(
  commissionRecord: CommissionAccrualInput,
  createdBy: string = "SYSTEM",
  extraMetadata?: Record<string, any>
): Promise<CreateJournalEntryResult> {
  if (!commissionRecord || !commissionRecord.id) {
    throw new Error("LEDGER_VALIDATION_ERROR: Invalid commission record.");
  }

  // Strictly Phase 3 constraint: only process commission with status PAYABLE
  if (commissionRecord.status !== "PAYABLE") {
    throw new Error(`LEDGER_VALIDATION_ERROR: Commission status must be 'PAYABLE' to accrue into ledger. Received: '${commissionRecord.status}'`);
  }

  const amount = commissionRecord.commissionAmount;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    throw new Error(`LEDGER_VALIDATION_ERROR: commissionAmount [${amount}] must be a positive integer IDR.`);
  }

  const idempotencyKey = `commission_accrual_${commissionRecord.id}`;

  // Minimal metadata - strictly NO bank, payout, or secret information
  const sanitizedMetadata: Record<string, any> = {
    commissionId: commissionRecord.id,
    orderId: commissionRecord.orderId,
    recipientId: commissionRecord.recipientId,
    ruleId: commissionRecord.ruleId,
    calculationMethod: commissionRecord.calculationMethod
  };

  const lineItems: LedgerLineItem[] = [
    {
      accountId: LedgerAccount.COMMISSION_EXPENSE,
      accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.COMMISSION_EXPENSE],
      debit: amount,
      credit: 0
    },
    {
      accountId: LedgerAccount.COMMISSION_PAYABLE,
      accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.COMMISSION_PAYABLE],
      debit: 0,
      credit: amount
    }
  ];

  const result = await createJournalEntry({
    idempotencyKey,
    eventType: "COMMISSION_ACCRUAL",
    source: {
      collection: "commissionRecords",
      documentId: commissionRecord.id,
      eventId: commissionRecord.orderId
    },
    lineItems,
    createdBy,
    metadata: sanitizedMetadata
  });

  // Log dedicated audit event: COMMISSION_LEDGER_POSTED
  if (!result.duplicate) {
    await logLedgerAudit(createdBy, "COMMISSION_LEDGER_POSTED", result.docId, {
      commissionId: commissionRecord.id,
      orderId: commissionRecord.orderId,
      ledgerJournalId: result.docId,
      amount,
      debitAccount: LedgerAccount.COMMISSION_EXPENSE,
      creditAccount: LedgerAccount.COMMISSION_PAYABLE,
      actor: createdBy,
      timestamp: new Date().toISOString()
    });
  }

  return result;
}

/**
 * Safely records commission accrual without breaking order SUCCESS or payment flow.
 */
export async function safeRecordCommissionAccrual(
  commissionRecord: any,
  createdBy: string = "SYSTEM",
  extraMetadata?: Record<string, any>
): Promise<CreateJournalEntryResult | null> {
  try {
    if (!commissionRecord || commissionRecord.status !== "PAYABLE") {
      console.warn(`[Ledger Commission Warning] Skipping commission accrual: status is '${commissionRecord?.status}'`);
      return null;
    }

    const amount = commissionRecord.commissionAmount;
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
      console.warn(`[Ledger Commission Warning] Cannot record commission accrual for ${commissionRecord.id}: invalid amount [${amount}]`);
      return null;
    }

    const result = await recordCommissionAccrual(commissionRecord, createdBy, extraMetadata);
    if (result.duplicate) {
      console.log(`[Ledger Idempotency] Commission accrual already posted for commission ${commissionRecord.id} (Doc ID: ${result.docId})`);
    } else {
      console.log(`[Ledger Success] Commission accrual posted for commission ${commissionRecord.id} (Doc ID: ${result.docId}, IDR ${amount})`);
    }
    return result;
  } catch (error: any) {
    console.error(`[Ledger Error] Failed to record commission accrual for ${commissionRecord?.id}:`, error?.message || error);
    return null;
  }
}

/**
 * Worker processor for asynchronous retry queue when ledger posting was delayed.
 */
export async function processCommissionLedgerJob(commissionId: string): Promise<void> {
  const commSnap = await adminDb.collection("commissionRecords").doc(commissionId).get();
  if (!commSnap.exists) {
    throw new Error(`COMMISSION_NOT_FOUND: ${commissionId}`);
  }
  const record = commSnap.data()!;
  if (record.status !== "PAYABLE") {
    console.log(`[Commission Ledger Worker] Record ${commissionId} is not PAYABLE (status: ${record.status}). Skipping.`);
    return;
  }

  const result = await recordCommissionAccrual(record as any, "SYSTEM_QUEUE");
  await adminDb.collection("commissionRecords").doc(commissionId).update({
    ledgerStatus: "POSTED",
    ledgerJournalId: result.docId,
    ledgerPostedAt: new Date().toISOString()
  });
}

/**
 * Record Commission Accrual Reversal into Double-Entry Ledger (Phase 4: Refund & Clawback)
 *
 * Deterministic document ID: `ledger_commission_reversal_${commissionRecord.id}_${refundKey}`
 * Deterministic idempotency key: `commission_reversal_${commissionRecord.id}_${refundKey}`
 *
 * Event: COMMISSION_ACCRUAL_REVERSAL
 * Accounts:
 *   Debit:  2100_COMMISSION_PAYABLE  (Mengurangi utang komisi afiliasi)
 *   Credit: 5200_COMMISSION_EXPENSE  (Membalikkan beban komisi afiliasi)
 *
 * Amount: deltaReversal (Positive integer IDR, non-zero)
 */
export async function recordCommissionAccrualReversal(
  commissionRecord: any,
  refundKey: string,
  deltaReversal: number,
  createdBy: string = "SYSTEM",
  extraMetadata?: Record<string, any>
): Promise<CreateJournalEntryResult> {
  if (!commissionRecord || !commissionRecord.id) {
    throw new Error("LEDGER_VALIDATION_ERROR: Invalid commission record.");
  }

  if (!refundKey || typeof refundKey !== "string") {
    throw new Error("LEDGER_VALIDATION_ERROR: refundKey is required.");
  }

  if (typeof deltaReversal !== "number" || !Number.isInteger(deltaReversal) || deltaReversal <= 0) {
    throw new Error(`LEDGER_VALIDATION_ERROR: deltaReversal [${deltaReversal}] must be a positive integer IDR.`);
  }

  const idempotencyKey = `commission_reversal_${commissionRecord.id}_${refundKey}`;
  const originalAccrualJournalId = commissionRecord.ledgerJournalId || `ledger_commission_accrual_${commissionRecord.id}`;

  const sanitizedMetadata: Record<string, any> = {
    commissionId: commissionRecord.id,
    orderId: commissionRecord.orderId,
    recipientId: commissionRecord.recipientId,
    refundKey,
    deltaReversal,
    ...extraMetadata
  };

  const lineItems: LedgerLineItem[] = [
    {
      accountId: LedgerAccount.COMMISSION_PAYABLE,
      accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.COMMISSION_PAYABLE],
      debit: deltaReversal,
      credit: 0
    },
    {
      accountId: LedgerAccount.COMMISSION_EXPENSE,
      accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.COMMISSION_EXPENSE],
      debit: 0,
      credit: deltaReversal
    }
  ];

  const result = await createJournalEntry({
    idempotencyKey,
    eventType: "COMMISSION_ACCRUAL_REVERSAL",
    reversalOf: originalAccrualJournalId,
    source: {
      collection: "refunds",
      documentId: refundKey,
      eventId: commissionRecord.id
    },
    lineItems,
    createdBy,
    metadata: sanitizedMetadata
  });

  // Log dedicated audit event: COMMISSION_LEDGER_REVERSED
  if (!result.duplicate) {
    await logLedgerAudit(createdBy, "COMMISSION_LEDGER_REVERSED", result.docId, {
      commissionId: commissionRecord.id,
      orderId: commissionRecord.orderId,
      refundKey,
      ledgerJournalId: result.docId,
      deltaReversal,
      debitAccount: LedgerAccount.COMMISSION_PAYABLE,
      creditAccount: LedgerAccount.COMMISSION_EXPENSE,
      actor: createdBy,
      timestamp: new Date().toISOString()
    });
  }

  return result;
}

/**
 * Safely records commission accrual reversal without breaking refund flow.
 */
export async function safeRecordCommissionAccrualReversal(
  commissionRecord: any,
  refundKey: string,
  deltaReversal: number,
  createdBy: string = "SYSTEM",
  extraMetadata?: Record<string, any>
): Promise<CreateJournalEntryResult | null> {
  try {
    if (!commissionRecord || !commissionRecord.id) {
      console.warn(`[Ledger Commission Reversal Warning] Invalid commissionRecord provided.`);
      return null;
    }

    if (typeof deltaReversal !== "number" || !Number.isInteger(deltaReversal) || deltaReversal <= 0) {
      console.warn(`[Ledger Commission Reversal Warning] Skipping reversal for ${commissionRecord.id}: deltaReversal is not positive integer [${deltaReversal}]`);
      return null;
    }

    const result = await recordCommissionAccrualReversal(
      commissionRecord,
      refundKey,
      deltaReversal,
      createdBy,
      extraMetadata
    );

    if (result.duplicate) {
      console.log(`[Ledger Idempotency] Commission reversal already posted for commission ${commissionRecord.id}, refund ${refundKey} (Doc ID: ${result.docId})`);
    } else {
      console.log(`[Ledger Success] Commission reversal posted for commission ${commissionRecord.id}, refund ${refundKey} (Doc ID: ${result.docId}, IDR ${deltaReversal})`);
    }
    return result;
  } catch (error: any) {
    console.error(`[Ledger Error] Failed to record commission accrual reversal for ${commissionRecord?.id}:`, error?.message || error);
    return null;
  }
}

/**
 * Worker processor for asynchronous retry queue for commission ledger reversal (Phase 4).
 */
export async function processCommissionLedgerReversalJob(payload: {
  commissionId: string;
  refundKey: string;
  deltaReversal: number;
}): Promise<void> {
  const { commissionId, refundKey, deltaReversal } = payload;
  const commSnap = await adminDb.collection("commissionRecords").doc(commissionId).get();
  if (!commSnap.exists) {
    throw new Error(`COMMISSION_NOT_FOUND: ${commissionId}`);
  }
  const record = commSnap.data()!;

  // Execute idempotent reversal journal posting
  await recordCommissionAccrualReversal(
    { id: commSnap.id, ...record },
    refundKey,
    deltaReversal,
    "SYSTEM_QUEUE"
  );
}

/**
 * Record Commission Payout Journal into Double-Entry Ledger (Phase 5: Payout & Disbursement)
 *
 * Deterministic document ID: `ledger_commission_payout_${batch.id}`
 * Deterministic idempotency key: `commission_payout_${batch.id}`
 *
 * Event: COMMISSION_PAYOUT
 * Accounts:
 *   Debit:  2100_COMMISSION_PAYABLE  (Mengurangi utang komisi afiliasi)
 *   Credit: 1200_BANK_PRIMARY        (Mengurangi kas/rekening bank operasional perusahaan)
 *
 * Amount: batch.netPayoutAmount (Positive integer IDR, non-zero)
 */
export async function recordCommissionPayout(
  batch: any,
  createdBy: string = "SYSTEM",
  extraMetadata?: Record<string, any>
): Promise<CreateJournalEntryResult> {
  if (!batch || !batch.id) {
    throw new Error("LEDGER_VALIDATION_ERROR: Invalid payout batch.");
  }

  const amount = Number(batch.netPayoutAmount);
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    throw new Error(`LEDGER_VALIDATION_ERROR: netPayoutAmount [${amount}] must be a positive integer IDR.`);
  }

  const idempotencyKey = `commission_payout_${batch.id}`;

  const sanitizedMetadata: Record<string, any> = {
    payoutBatchId: batch.id,
    batchNumber: batch.batchNumber,
    recipientId: batch.recipientId,
    recipientName: batch.recipientSnapshot?.name || "",
    bankName: batch.recipientSnapshot?.bankName || "",
    accountNumberMasked: batch.recipientSnapshot?.accountNumberMasked || "",
    totalCommissionAmount: batch.totalCommissionAmount,
    payoutFee: batch.payoutFee || 0,
    netPayoutAmount: amount,
    transferReference: batch.transferReference || null,
    commissionRecordIds: Array.isArray(batch.commissionRecordIds) ? batch.commissionRecordIds : [],
    ...extraMetadata
  };

  const lineItems: LedgerLineItem[] = [
    {
      accountId: LedgerAccount.COMMISSION_PAYABLE,
      accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.COMMISSION_PAYABLE],
      debit: amount,
      credit: 0
    },
    {
      accountId: LedgerAccount.BANK_PRIMARY,
      accountName: LEDGER_ACCOUNT_NAMES[LedgerAccount.BANK_PRIMARY],
      debit: 0,
      credit: amount
    }
  ];

  const result = await createJournalEntry({
    idempotencyKey,
    eventType: "COMMISSION_PAYOUT",
    source: {
      collection: "payoutBatches",
      documentId: batch.id,
      eventId: batch.batchNumber
    },
    lineItems,
    createdBy,
    metadata: sanitizedMetadata
  });

  // Log dedicated audit event: COMMISSION_LEDGER_PAYOUT
  if (!result.duplicate) {
    await logLedgerAudit(createdBy, "COMMISSION_LEDGER_PAYOUT", result.docId, {
      payoutBatchId: batch.id,
      batchNumber: batch.batchNumber,
      recipientId: batch.recipientId,
      ledgerJournalId: result.docId,
      amount,
      debitAccount: LedgerAccount.COMMISSION_PAYABLE,
      creditAccount: LedgerAccount.BANK_PRIMARY,
      actor: createdBy,
      timestamp: new Date().toISOString()
    });
  }

  return result;
}

/**
 * Safely records commission payout journal without breaking UI/batch flow.
 */
export async function safeRecordCommissionPayout(
  batch: any,
  createdBy: string = "SYSTEM",
  extraMetadata?: Record<string, any>
): Promise<CreateJournalEntryResult | null> {
  try {
    if (!batch || !batch.id) {
      console.warn(`[Ledger Commission Payout Warning] Invalid batch provided.`);
      return null;
    }

    const amount = Number(batch.netPayoutAmount);
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
      console.warn(`[Ledger Commission Payout Warning] Skipping payout journal for ${batch.id}: amount is not positive integer [${amount}]`);
      return null;
    }

    const result = await recordCommissionPayout(batch, createdBy, extraMetadata);

    if (result.duplicate) {
      console.log(`[Ledger Idempotency] Commission payout already posted for batch ${batch.id} (Doc ID: ${result.docId})`);
    } else {
      console.log(`[Ledger Success] Commission payout posted for batch ${batch.id} (Doc ID: ${result.docId}, IDR ${amount})`);
    }
    return result;
  } catch (error: any) {
    console.error(`[Ledger Error] Failed to record commission payout journal for ${batch?.id}:`, error?.message || error);
    return null;
  }
}

/**
 * Worker processor for asynchronous retry queue for commission ledger payout (Phase 5).
 */
export async function processCommissionPayoutLedgerJob(payload: {
  payoutBatchId: string;
}): Promise<void> {
  const { payoutBatchId } = payload;
  const batchSnap = await adminDb.collection("payoutBatches").doc(payoutBatchId).get();
  if (!batchSnap.exists) {
    throw new Error(`PAYOUT_BATCH_NOT_FOUND: ${payoutBatchId}`);
  }
  const batch = batchSnap.data()!;

  // Execute idempotent payout journal posting
  const result = await recordCommissionPayout(
    { id: batchSnap.id, ...batch },
    "SYSTEM_QUEUE"
  );

  // Update batch ledgerJournalId if not already set
  if (result?.docId && !batch.ledgerJournalId) {
    await adminDb.collection("payoutBatches").doc(payoutBatchId).update({
      ledgerJournalId: result.docId,
      updatedAt: new Date().toISOString()
    });
  }
}

// ============================================================================
// COMMISSION - LEDGER RECONCILIATION DETECTOR (Phase 3, Phase 4 & Phase 5)
// ============================================================================

export interface CommissionDiscrepancy {
  caseType: 
    | 'CASE_A_UNACCRUED_COMMISSION' 
    | 'CASE_B_ORPHAN_LEDGER_ACCRUAL' 
    | 'CASE_C_AMOUNT_MISMATCH'
    | 'CASE_D_UNREVERSED_REFUNDED_COMMISSION'
    | 'CASE_E_ORPHAN_COMMISSION_REVERSAL'
    | 'CASE_F_MISSING_LEDGER_REVERSAL'
    | 'CASE_G_REVERSAL_AMOUNT_MISMATCH'
    | 'CASE_H_UNPAID_PAYABLE_AGING'
    | 'CASE_I_ORPHAN_PAYOUT_ALLOCATION'
    | 'CASE_J_MISSING_PAYOUT_LEDGER_JOURNAL'
    | 'CASE_K_PAYOUT_AMOUNT_MISMATCH'
    | 'CASE_L_COMMISSION_PAID_WITHOUT_BATCH'
    | 'CASE_M_DUPLICATE_ACTIVE_ALLOCATION';
  severity: 'HIGH' | 'MEDIUM';
  commissionId?: string;
  orderId?: string;
  refundKey?: string;
  payoutBatchId?: string;
  ledgerJournalId?: string;
  commissionAmount?: number;
  expectedClawback?: number;
  actualReversedAmount?: number;
  ledgerDebitAmount?: number;
  ledgerCreditAmount?: number;
  message: string;
  details?: Record<string, any>;
}

export interface CommissionReconciliationReport {
  timestamp: string;
  totalPayableCommissions: number;
  totalCancelledCommissions: number;
  totalLedgerAccruals: number;
  totalLedgerReversals: number;
  totalPayoutBatches?: number;
  totalLedgerPayouts?: number;
  matchedCount: number;
  discrepanciesCount: number;
  discrepancies: CommissionDiscrepancy[];
  status: 'HEALTHY' | 'DISCREPANCIES_FOUND';
}

/**
 * Detects discrepancies between Commission Records and the Double-Entry Ledger:
 * - Case A: Commission PAYABLE without corresponding Ledger accrual journal.
 * - Case B: Ledger accrual journal without a valid PAYABLE commissionRecord.
 * - Case C: Commission amount does not equal Ledger debit or credit amount.
 * - Case D: Refund SUCCEEDED exists but cumulative commission reversal < required clawback.
 * - Case E: cancelReason === 'CANCELLED_BY_REFUND' or reversal journal exists, but no SUCCEEDED refund found.
 * - Case F: Expected reversal recorded on commission metadata but ledger journal missing.
 * - Case G: Total ledger reversal amount differs from expected cumulative clawback.
 *
 * NOTE: Non-destructive detection and verification only. No automatic reversals.
 */
export async function reconcileCommissionLedger(): Promise<CommissionReconciliationReport> {
  const discrepancies: CommissionDiscrepancy[] = [];

  // 1. Fetch all commission records
  const commSnap = await adminDb.collection("commissionRecords").get();
  const allCommissions = commSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  const payableCommissions = allCommissions.filter(c => c.status === "PAYABLE");
  const cancelledCommissions = allCommissions.filter(c => c.status === "CANCELLED");

  // 2. Fetch all COMMISSION_ACCRUAL ledger journals
  const accrualSnap = await adminDb.collection("ledgerJournalEntries")
    .where("eventType", "==", "COMMISSION_ACCRUAL")
    .get();
  const allAccrualJournals = accrualSnap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerJournalEntry));

  // 3. Fetch all COMMISSION_ACCRUAL_REVERSAL ledger journals (Phase 4)
  const reversalSnap = await adminDb.collection("ledgerJournalEntries")
    .where("eventType", "==", "COMMISSION_ACCRUAL_REVERSAL")
    .get();
  const allReversalJournals = reversalSnap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerJournalEntry));

  // 4. Fetch all SUCCEEDED refund records
  const refundSnap = await adminDb.collection("refunds")
    .where("status", "==", "SUCCEEDED")
    .get();
  const allSucceededRefunds = refundSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  // Build lookup maps
  const commissionMap = new Map<string, any>(allCommissions.map(c => [c.id, c]));
  const accrualLedgerMap = new Map<string, LedgerJournalEntry>(allAccrualJournals.map(j => [j.id, j]));
  const reversalLedgerMap = new Map<string, LedgerJournalEntry>(allReversalJournals.map(j => [j.id, j]));

  // Map refunds by orderId: orderId -> list of succeeded refunds
  const refundsByOrderMap = new Map<string, any[]>();
  for (const r of allSucceededRefunds) {
    const list = refundsByOrderMap.get(r.orderId) || [];
    list.push(r);
    refundsByOrderMap.set(r.orderId, list);
  }

  // Map reversal journals by commissionId: commissionId -> list of reversal journals
  const reversalsByCommissionMap = new Map<string, LedgerJournalEntry[]>();
  for (const rev of allReversalJournals) {
    const cId = rev.metadata?.commissionId || rev.source?.eventId;
    if (cId) {
      const list = reversalsByCommissionMap.get(cId) || [];
      list.push(rev);
      reversalsByCommissionMap.set(cId, list);
    }
  }

  let matchedCount = 0;

  // --------------------------------------------------------------------------
  // Case A & Case C Verification: Iterate payable commission records
  // --------------------------------------------------------------------------
  for (const record of payableCommissions) {
    const expectedDocId = `ledger_commission_accrual_${record.id}`;
    const ledgerEntry = accrualLedgerMap.get(expectedDocId);

    if (!ledgerEntry) {
      // Case A: Commission PAYABLE tanpa Ledger accrual
      discrepancies.push({
        caseType: 'CASE_A_UNACCRUED_COMMISSION',
        severity: 'HIGH',
        commissionId: record.id,
        orderId: record.orderId,
        commissionAmount: record.commissionAmount,
        message: `Komisi '${record.id}' berstatus PAYABLE senilai Rp ${record.commissionAmount?.toLocaleString('id-ID')} belum memiliki jurnal akrual di Buku Besar.`
      });
    } else {
      // Case C: Check Amount Equality for original accrual
      const debitItem = ledgerEntry.lineItems.find(l => l.accountId === LedgerAccount.COMMISSION_EXPENSE);
      const creditItem = ledgerEntry.lineItems.find(l => l.accountId === LedgerAccount.COMMISSION_PAYABLE);

      const debitAmt = debitItem?.debit || 0;
      const creditAmt = creditItem?.credit || 0;
      const commAmt = record.commissionAmount || 0;

      if (commAmt !== debitAmt || commAmt !== creditAmt || debitAmt !== creditAmt) {
        discrepancies.push({
          caseType: 'CASE_C_AMOUNT_MISMATCH',
          severity: 'HIGH',
          commissionId: record.id,
          orderId: record.orderId,
          ledgerJournalId: ledgerEntry.id,
          commissionAmount: commAmt,
          ledgerDebitAmount: debitAmt,
          ledgerCreditAmount: creditAmt,
          message: `Ketidakcocokan nominal akrual: Komisi=${commAmt}, Debit=${debitAmt}, Kredit=${creditAmt}.`
        });
      } else {
        matchedCount++;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Case B Verification: Iterate ledger accruals to check for orphan journals
  // --------------------------------------------------------------------------
  for (const journal of allAccrualJournals) {
    const commissionId = journal.metadata?.commissionId || journal.source?.documentId;
    if (!commissionId) {
      discrepancies.push({
        caseType: 'CASE_B_ORPHAN_LEDGER_ACCRUAL',
        severity: 'HIGH',
        ledgerJournalId: journal.id,
        message: `Jurnal Buku Besar '${journal.id}' tidak memiliki metadata commissionId valid.`
      });
      continue;
    }

    const linkedComm = commissionMap.get(commissionId);
    if (!linkedComm) {
      // Case B: Ledger accrual tanpa commissionRecord
      discrepancies.push({
        caseType: 'CASE_B_ORPHAN_LEDGER_ACCRUAL',
        severity: 'HIGH',
        commissionId,
        ledgerJournalId: journal.id,
        message: `Jurnal Buku Besar '${journal.id}' mengacu pada commissionRecord '${commissionId}' yang tidak ditemukan di database.`
      });
    } else if (linkedComm.status !== "PAYABLE" && linkedComm.status !== "CANCELLED") {
      discrepancies.push({
        caseType: 'CASE_B_ORPHAN_LEDGER_ACCRUAL',
        severity: 'MEDIUM',
        commissionId,
        ledgerJournalId: journal.id,
        message: `Jurnal Buku Besar '${journal.id}' mengacu pada catatan komisi '${commissionId}' dengan status tidak valid ('${linkedComm.status}').`
      });
    }
  }

  // --------------------------------------------------------------------------
  // Phase 4: CASE D, E, F, G Verification (Refund & Clawback Reconciliation)
  // --------------------------------------------------------------------------

  // Check all commissions for refund clawback discrepancies (Case D, F, G)
  for (const record of allCommissions) {
    const orderRefunds = refundsByOrderMap.get(record.orderId) || [];
    const cumRefundAmount = orderRefunds.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const S = Number(record.sellingPriceSnapshot) || 0;
    const C = Number(record.commissionAmount) || 0;

    // Hitung expected cumulative clawback jika ada refund
    let expectedClawback = 0;
    if (cumRefundAmount > 0 && S > 0 && C > 0) {
      const remainingRatio = Math.max(0, S - cumRefundAmount) / S;
      const targetRemaining = Math.max(0, Math.round(C * remainingRatio));
      expectedClawback = Math.max(0, Math.min(C, C - targetRemaining));
    }

    const actualCommissionReversed = Number(record.cumulativeReversedAmount) || 0;
    const reversalJournals = reversalsByCommissionMap.get(record.id) || [];
    const totalLedgerReversed = reversalJournals.reduce((sum, j) => {
      const debit = j.lineItems.find(l => l.accountId === LedgerAccount.COMMISSION_PAYABLE)?.debit || 0;
      return sum + debit;
    }, 0);

    // CASE D: Refund SUCCEEDED exists but cumulative commission reversal < expected clawback
    if (expectedClawback > 0 && actualCommissionReversed < expectedClawback) {
      discrepancies.push({
        caseType: 'CASE_D_UNREVERSED_REFUNDED_COMMISSION',
        severity: 'HIGH',
        commissionId: record.id,
        orderId: record.orderId,
        commissionAmount: C,
        expectedClawback,
        actualReversedAmount: actualCommissionReversed,
        message: `Pesanan '${record.orderId}' memiliki refund SUCCEEDED (Rp ${cumRefundAmount.toLocaleString('id-ID')}), namun komisi '${record.id}' baru direverse Rp ${actualCommissionReversed.toLocaleString('id-ID')} dari seharusnya Rp ${expectedClawback.toLocaleString('id-ID')}.`
      });
    }

    // CASE F: Expected reversal recorded on commission snapshots, but ledger journal missing
    if (Array.isArray(record.reversalSnapshots)) {
      for (const snap of record.reversalSnapshots) {
        if (snap.deltaReversedCommission > 0) {
          const expectedRevDocId = `ledger_commission_reversal_${record.id}_${snap.refundKey}`;
          if (!reversalLedgerMap.has(expectedRevDocId)) {
            discrepancies.push({
              caseType: 'CASE_F_MISSING_LEDGER_REVERSAL',
              severity: 'HIGH',
              commissionId: record.id,
              orderId: record.orderId,
              refundKey: snap.refundKey,
              ledgerJournalId: expectedRevDocId,
              message: `Catatan pembalikan komisi '${record.id}' untuk refund '${snap.refundKey}' tidak memiliki jurnal reversal '${expectedRevDocId}' di Buku Besar.`
            });
          }
        }
      }
    }

    // CASE G: Total reversal ledger amount differs from expected cumulative clawback
    if (expectedClawback > 0 && totalLedgerReversed !== expectedClawback) {
      discrepancies.push({
        caseType: 'CASE_G_REVERSAL_AMOUNT_MISMATCH',
        severity: 'HIGH',
        commissionId: record.id,
        orderId: record.orderId,
        expectedClawback,
        ledgerDebitAmount: totalLedgerReversed,
        message: `Total jurnal reversal Buku Besar (Rp ${totalLedgerReversed.toLocaleString('id-ID')}) tidak cocok dengan nilai clawback yang diharapkan (Rp ${expectedClawback.toLocaleString('id-ID')}) pada komisi '${record.id}'.`
      });
    }
  }

  // CASE E: Reversal without valid SUCCEEDED refund
  // 1. Commission marked CANCELLED_BY_REFUND but no succeeded refund found for order
  for (const record of cancelledCommissions) {
    if (record.cancelReason === 'CANCELLED_BY_REFUND') {
      const orderRefunds = refundsByOrderMap.get(record.orderId) || [];
      if (orderRefunds.length === 0) {
        discrepancies.push({
          caseType: 'CASE_E_ORPHAN_COMMISSION_REVERSAL',
          severity: 'HIGH',
          commissionId: record.id,
          orderId: record.orderId,
          message: `Komisi '${record.id}' dibatalkan dengan alasan 'CANCELLED_BY_REFUND', tetapi tidak ada dokumen refund SUCCEEDED untuk pesanan '${record.orderId}'.`
        });
      }
    }
  }

  // 2. Reversal journal exists but source refundKey is not a valid SUCCEEDED refund
  const succeededRefundKeySet = new Set(allSucceededRefunds.map(r => r.id));
  for (const revJournal of allReversalJournals) {
    const refundKey = revJournal.metadata?.refundKey || revJournal.source?.documentId;
    if (refundKey && !succeededRefundKeySet.has(refundKey)) {
      discrepancies.push({
        caseType: 'CASE_E_ORPHAN_COMMISSION_REVERSAL',
        severity: 'HIGH',
        ledgerJournalId: revJournal.id,
        refundKey,
        message: `Jurnal reversal '${revJournal.id}' mengacu pada refundKey '${refundKey}' yang tidak ditemukan atau tidak berstatus SUCCEEDED.`
      });
    }
  }

  // ==========================================================================
  // PHASE 5: RECONCILIATION DETECTORS (CASES H - M)
  // ==========================================================================
  
  // 4. Fetch all payoutBatches
  const payoutBatchSnap = await adminDb.collection("payoutBatches").get();
  const allPayoutBatches = payoutBatchSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  const paidPayoutBatches = allPayoutBatches.filter(b => b.status === "PAID");
  const activePayoutBatches = allPayoutBatches.filter(b => ['DRAFT', 'PENDING_APPROVAL', 'PROCESSING', 'NEEDS_REVIEW'].includes(b.status));

  // 5. Fetch all COMMISSION_PAYOUT ledger journals
  const payoutJournalsSnap = await adminDb.collection("ledgerJournalEntries")
    .where("eventType", "==", "COMMISSION_PAYOUT")
    .get();
  const allPayoutJournals = payoutJournalsSnap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerJournalEntry));
  const payoutJournalMap = new Map<string, LedgerJournalEntry>(allPayoutJournals.map(j => [j.id, j]));

  // Index commission allocations across active batches for Case M
  const activeAllocationMap = new Map<string, string[]>(); // commissionId -> array of batchIds
  for (const batch of activePayoutBatches) {
    const recordIds: string[] = Array.isArray(batch.commissionRecordIds) 
      ? batch.commissionRecordIds 
      : (Array.isArray(batch.allocations) ? batch.allocations.map((a: any) => a.commissionId) : []);
    for (const commId of recordIds) {
      const list = activeAllocationMap.get(commId) || [];
      list.push(batch.id);
      activeAllocationMap.set(commId, list);
    }
  }

  // Check Case H: PAYABLE aging > 30 days without payout allocation
  const nowMs = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  for (const record of payableCommissions) {
    if ((!record.payoutStatus || record.payoutStatus === "UNPAID") && record.createdAt) {
      const ageMs = nowMs - new Date(record.createdAt).getTime();
      if (ageMs > thirtyDaysMs) {
        discrepancies.push({
          caseType: 'CASE_H_UNPAID_PAYABLE_AGING',
          severity: 'MEDIUM',
          commissionId: record.id,
          orderId: record.orderId,
          commissionAmount: record.remainingPayableAmount || record.commissionAmount,
          message: `Komisi '${record.id}' berstatus PAYABLE telah berumur >30 hari (Rp ${(record.remainingPayableAmount || record.commissionAmount).toLocaleString('id-ID')}) namun belum dialokasikan ke payout batch.`
        });
      }
    }

    // Check Case L: Commission marked PAID without valid payout batch
    if (record.payoutStatus === "PAID") {
      if (!record.payoutBatchId) {
        discrepancies.push({
          caseType: 'CASE_L_COMMISSION_PAID_WITHOUT_BATCH',
          severity: 'HIGH',
          commissionId: record.id,
          orderId: record.orderId,
          message: `Komisi '${record.id}' memiliki payoutStatus 'PAID' namun tidak memiliki referensi 'payoutBatchId'.`
        });
      } else {
        const batchExists = allPayoutBatches.some(b => b.id === record.payoutBatchId);
        if (!batchExists) {
          discrepancies.push({
            caseType: 'CASE_L_COMMISSION_PAID_WITHOUT_BATCH',
            severity: 'HIGH',
            commissionId: record.id,
            orderId: record.orderId,
            payoutBatchId: record.payoutBatchId,
            message: `Komisi '${record.id}' mengacu pada payoutBatchId '${record.payoutBatchId}' yang tidak ditemukan di database.`
          });
        }
      }
    }

    // Check Case M: Duplicate active allocation (commission in >1 active batch)
    const activeBatchesForComm = activeAllocationMap.get(record.id) || [];
    if (activeBatchesForComm.length > 1) {
      discrepancies.push({
        caseType: 'CASE_M_DUPLICATE_ACTIVE_ALLOCATION',
        severity: 'HIGH',
        commissionId: record.id,
        orderId: record.orderId,
        message: `Komisi '${record.id}' terdaftar di lebih dari satu batch aktif (${activeBatchesForComm.join(', ')}). Risiko double payout!`,
        details: { activeBatches: activeBatchesForComm }
      });
    }
  }

  // Check Cases for Payout Batches
  const allCommissionsMap = new Map<string, any>(allCommissions.map(c => [c.id, c]));
  for (const batch of allPayoutBatches) {
    const allocations = Array.isArray(batch.allocations) ? batch.allocations : [];
    
    // Check Case I: Orphan payout allocation (commission missing or cancelled)
    for (const alloc of allocations) {
      const commRec = allCommissionsMap.get(alloc.commissionId);
      if (!commRec) {
        discrepancies.push({
          caseType: 'CASE_I_ORPHAN_PAYOUT_ALLOCATION',
          severity: 'HIGH',
          payoutBatchId: batch.id,
          commissionId: alloc.commissionId,
          message: `Batch payout '${batch.batchNumber || batch.id}' mengalokasikan komisi '${alloc.commissionId}' yang tidak ditemukan di database.`
        });
      } else if (commRec.status === 'CANCELLED' && batch.status !== 'CANCELLED') {
        discrepancies.push({
          caseType: 'CASE_I_ORPHAN_PAYOUT_ALLOCATION',
          severity: 'HIGH',
          payoutBatchId: batch.id,
          commissionId: alloc.commissionId,
          message: `Batch payout '${batch.batchNumber || batch.id}' mengalokasikan komisi '${alloc.commissionId}' yang berstatus CANCELLED.`
        });
      }
    }

    // Check Case J: Batch PAID but ledger payout journal missing
    if (batch.status === 'PAID') {
      const expectedJournalId = `ledger_commission_payout_${batch.id}`;
      const journal = payoutJournalMap.get(expectedJournalId);
      if (!journal) {
        discrepancies.push({
          caseType: 'CASE_J_MISSING_PAYOUT_LEDGER_JOURNAL',
          severity: 'HIGH',
          payoutBatchId: batch.id,
          ledgerJournalId: expectedJournalId,
          message: `Payout batch '${batch.batchNumber || batch.id}' berstatus PAID namun jurnal Buku Besar '${expectedJournalId}' tidak ditemukan.`
        });
      } else {
        // Check Case K: Payout amount mismatch between batch and ledger
        const netAmount = Number(batch.netPayoutAmount) || 0;
        const ledgerAmount = Number(journal.totalAmount) || 0;
        if (netAmount !== ledgerAmount) {
          discrepancies.push({
            caseType: 'CASE_K_PAYOUT_AMOUNT_MISMATCH',
            severity: 'HIGH',
            payoutBatchId: batch.id,
            ledgerJournalId: journal.id,
            ledgerDebitAmount: ledgerAmount,
            message: `Nominal net payout pada batch '${batch.batchNumber || batch.id}' (Rp ${netAmount.toLocaleString('id-ID')}) tidak cocok dengan total jurnal Buku Besar (Rp ${ledgerAmount.toLocaleString('id-ID')}).`
          });
        }
      }
    }
  }

  return {
    timestamp: new Date().toISOString(),
    totalPayableCommissions: payableCommissions.length,
    totalCancelledCommissions: cancelledCommissions.length,
    totalLedgerAccruals: allAccrualJournals.length,
    totalLedgerReversals: allReversalJournals.length,
    totalPayoutBatches: allPayoutBatches.length,
    totalLedgerPayouts: allPayoutJournals.length,
    matchedCount,
    discrepanciesCount: discrepancies.length,
    discrepancies,
    status: discrepancies.length === 0 ? 'HEALTHY' : 'DISCREPANCIES_FOUND'
  };
}
