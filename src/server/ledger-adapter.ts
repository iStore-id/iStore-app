import { LedgerLineItem } from "../types/ledger";
import { supabaseAdmin } from "./supabase-admin";
import { mapLegacyAccountToCanonical } from "./ledger-mapping";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AdapterPostLedgerParams {
  idempotencyKey: string;
  eventType: string;
  source: { collection: string; documentId: string; eventId?: string };
  lineItems: LedgerLineItem[];
  totalAmount: number;
  currency: string;
  reversalOf?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Validates financial amounts for the Integer IDR domain.
 * Rejects values above Number.MAX_SAFE_INTEGER or fractional values.
 */
function validateFinancialAmount(amount: number, context: string) {
  if (typeof amount !== "number" || isNaN(amount)) {
    throw new Error(`LEDGER_VALIDATION_ERROR: ${context} is not a valid number: ${amount}`);
  }
  if (!Number.isInteger(amount)) {
    throw new Error(`LEDGER_VALIDATION_ERROR: ${context} [${amount}] contains invalid decimals for IDR.`);
  }
  if (!Number.isSafeInteger(amount)) {
    throw new Error(`LEDGER_VALIDATION_ERROR: ${context} [${amount}] exceeds MAX_SAFE_INTEGER.`);
  }
  if (amount < 0) {
    throw new Error(`LEDGER_VALIDATION_ERROR: ${context} [${amount}] cannot be negative.`);
  }
}

export async function adapterPostLedgerJournal(params: AdapterPostLedgerParams) {
  if (!supabaseAdmin) {
    throw new Error("Supabase Admin is not configured.");
  }

  // 0. Financial Precision Guards
  validateFinancialAmount(params.totalAmount, "totalAmount");
  params.lineItems.forEach((item, idx) => {
    validateFinancialAmount(item.debit, `lineItems[${idx}].debit`);
    validateFinancialAmount(item.credit, `lineItems[${idx}].credit`);
  });

  // 1. Map entries to canonical format
  const canonicalEntries = params.lineItems.map(item => {
    return {
      account_id: mapLegacyAccountToCanonical(item.accountId),
      debit: item.debit,
      credit: item.credit
    };
  });

  // 2. Handle metadata and eventId
  const finalMetadata = { ...(params.metadata || {}) };
  if (params.source.eventId) {
    finalMetadata.source_event_id = params.source.eventId;
  }

  // 3. Handle reversal ID resolution
  let pgReversalOf: string | null = null;
  if (params.reversalOf) {
    if (UUID_REGEX.test(params.reversalOf)) {
      pgReversalOf = params.reversalOf;
    } else {
      // Legacy Firestore string -> store in metadata
      finalMetadata.legacy_reversal_of = params.reversalOf;
      pgReversalOf = null;
    }
  }

  // 4. Execute RPC
  const { data, error } = await supabaseAdmin.rpc("post_ledger_journal", {
    p_idempotency_key: params.idempotencyKey,
    p_event_type: params.eventType,
    p_source_type: params.source.collection,
    p_source_id: params.source.documentId,
    p_currency: params.currency || "IDR",
    p_total_amount: params.totalAmount,
    p_reversal_of: pgReversalOf,
    p_metadata: finalMetadata,
    p_entries: canonicalEntries
  });

  // 5. Handle PostgreSQL errors and translate them
  if (error) {
    if (error.code === '23505') { // Postgres UNIQUE violation code
      throw new Error(`IDEMPOTENCY_CONFLICT: ${error.message}`);
    }
    if (error.code === '22023' || error.message?.includes('INVALID_') || error.message?.includes('NEGATIVE_AMOUNT') || error.message?.includes('REVERSAL_')) {
      throw new Error(`LEDGER_VALIDATION_ERROR: ${error.message}`);
    }
    throw new Error(`LEDGER_PERSISTENCE_ERROR: ${error.message}`);
  }

  return data;
}
