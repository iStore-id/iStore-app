import { supabaseAdmin } from "./supabase-admin.js";
import { 
  CommissionRecipient, 
  CommissionRule, 
  CommissionRecord,
  RecipientType,
  CommissionCalculationMethod,
  RecipientStatus,
  CommissionRuleStatus,
  CommissionRecordStatus,
  PayoutBatch,
  PayoutBatchStatus
} from "../types/commission.js";

function getSupabase() {
  if (!supabaseAdmin) {
    throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED: Supabase service role client is not available.");
  }
  return supabaseAdmin;
}

// ==========================================
// MAPPERS
// ==========================================

export function mapRecipientToApp(dbRecipient: any): CommissionRecipient {
  return {
    id: dbRecipient.id,
    userId: dbRecipient.user_id || null,
    code: dbRecipient.code,
    name: dbRecipient.name,
    type: dbRecipient.type as RecipientType,
    status: dbRecipient.status as RecipientStatus,
    notes: dbRecipient.notes || "",
    createdAt: new Date(dbRecipient.created_at).toISOString(),
    updatedAt: new Date(dbRecipient.updated_at).toISOString(),
    createdBy: dbRecipient.created_by,
    updatedBy: dbRecipient.updated_by,
    payoutAccount: dbRecipient.payout_bank_name ? {
      bankName: dbRecipient.payout_bank_name,
      accountNumberMasked: dbRecipient.payout_account_number_masked || "",
      accountHolderName: dbRecipient.payout_account_holder_name || "",
      encryptedAccountNumber: dbRecipient.payout_account_number_encrypted || undefined,
    } : null
  };
}

export function mapRecipientToDb(appRecipient: Partial<CommissionRecipient>): any {
  const dbData: any = {};
  if (appRecipient.id !== undefined) dbData.id = appRecipient.id;
  if (appRecipient.userId !== undefined) dbData.user_id = appRecipient.userId;
  if (appRecipient.code !== undefined) dbData.code = appRecipient.code;
  if (appRecipient.name !== undefined) dbData.name = appRecipient.name;
  if (appRecipient.type !== undefined) dbData.type = appRecipient.type;
  if (appRecipient.status !== undefined) dbData.status = appRecipient.status;
  if (appRecipient.notes !== undefined) dbData.notes = appRecipient.notes;
  if (appRecipient.createdBy !== undefined) dbData.created_by = appRecipient.createdBy;
  if (appRecipient.updatedBy !== undefined) dbData.updated_by = appRecipient.updatedBy;
  if (appRecipient.createdAt !== undefined) dbData.created_at = appRecipient.createdAt;
  if (appRecipient.updatedAt !== undefined) dbData.updated_at = appRecipient.updatedAt;

  if (appRecipient.payoutAccount) {
    dbData.payout_bank_name = appRecipient.payoutAccount.bankName;
    dbData.payout_account_number_masked = appRecipient.payoutAccount.accountNumberMasked;
    dbData.payout_account_holder_name = appRecipient.payoutAccount.accountHolderName;
    dbData.payout_account_number_encrypted = (appRecipient.payoutAccount as any).encryptedAccountNumber || null;
  } else if (appRecipient.payoutAccount === null) {
    dbData.payout_bank_name = null;
    dbData.payout_account_number_masked = null;
    dbData.payout_account_holder_name = null;
    dbData.payout_account_number_encrypted = null;
  }

  // Schema-mandated legacy/default fields
  dbData.role = "AFFILIATE";
  dbData.bank_details = {};

  return dbData;
}

export function mapRuleToApp(dbRule: any): CommissionRule {
  return {
    id: dbRule.id,
    name: dbRule.name,
    recipientType: dbRule.recipient_type as RecipientType,
    recipientId: dbRule.recipient_id || null,
    gameId: dbRule.game_id || null,
    productId: dbRule.product_id || null,
    variantId: dbRule.variant_id || null,
    calculationMethod: dbRule.calculation_method as CommissionCalculationMethod,
    rate: Number(dbRule.rate) || 0,
    minOrderAmount: Number(dbRule.min_order_amount) || 0,
    maxCommissionAmount: dbRule.max_commission_amount !== null ? Number(dbRule.max_commission_amount) : null,
    priority: Number(dbRule.priority) || 10,
    effectiveFrom: dbRule.effective_from,
    effectiveUntil: dbRule.effective_until || null,
    status: dbRule.status as CommissionRuleStatus,
    createdAt: new Date(dbRule.created_at).toISOString(),
    updatedAt: new Date(dbRule.updated_at).toISOString(),
    createdBy: dbRule.created_by,
    updatedBy: dbRule.updated_by
  };
}

export function mapRuleToDb(appRule: Partial<CommissionRule>): any {
  const dbData: any = {};
  if (appRule.id !== undefined) dbData.id = appRule.id;
  if (appRule.name !== undefined) dbData.name = appRule.name;
  if (appRule.recipientType !== undefined) dbData.recipient_type = appRule.recipientType;
  if (appRule.recipientId !== undefined) dbData.recipient_id = appRule.recipientId;
  if (appRule.gameId !== undefined) dbData.game_id = appRule.gameId;
  if (appRule.productId !== undefined) dbData.product_id = appRule.productId;
  if (appRule.variantId !== undefined) dbData.variant_id = appRule.variantId;
  if (appRule.calculationMethod !== undefined) dbData.calculation_method = appRule.calculationMethod;
  if (appRule.rate !== undefined) dbData.rate = appRule.rate;
  if (appRule.minOrderAmount !== undefined) dbData.min_order_amount = appRule.minOrderAmount;
  if (appRule.maxCommissionAmount !== undefined) dbData.max_commission_amount = appRule.maxCommissionAmount;
  if (appRule.priority !== undefined) dbData.priority = appRule.priority;
  if (appRule.effectiveFrom !== undefined) dbData.effective_from = appRule.effectiveFrom;
  if (appRule.effectiveUntil !== undefined) dbData.effective_until = appRule.effectiveUntil;
  if (appRule.status !== undefined) dbData.status = appRule.status;
  if (appRule.createdAt !== undefined) dbData.created_at = appRule.createdAt;
  if (appRule.updatedAt !== undefined) dbData.updated_at = appRule.updatedAt;
  if (appRule.createdBy !== undefined) dbData.created_by = appRule.createdBy;
  if (appRule.updatedBy !== undefined) dbData.updated_by = appRule.updatedBy;

  // Schema-mandated legacy/default fields
  dbData.percentage = 0;
  dbData.fixed_amount = 0;

  return dbData;
}

export function mapRecordToApp(dbRecord: any): CommissionRecord {
  return {
    id: dbRecord.id,
    orderId: dbRecord.order_id,
    recipientId: dbRecord.recipient_id,
    recipientCode: dbRecord.recipient_code,
    recipientName: dbRecord.recipient_name,
    recipientType: dbRecord.recipient_type as RecipientType,
    ruleId: dbRecord.rule_id,
    ruleName: dbRecord.rule_name,
    calculationMethod: dbRecord.calculation_method as CommissionCalculationMethod,
    sellingPriceSnapshot: Number(dbRecord.selling_price_snapshot) || 0,
    baseCostSnapshot: dbRecord.base_cost_snapshot !== null ? Number(dbRecord.base_cost_snapshot) : null,
    commissionRateSnapshot: Number(dbRecord.commission_rate_snapshot) || 0,
    fixedAmountSnapshot: Number(dbRecord.fixed_amount_snapshot) || 0,
    commissionAmount: Number(dbRecord.commission_amount) || 0,
    currency: dbRecord.currency,
    status: dbRecord.status as CommissionRecordStatus,
    createdAt: new Date(dbRecord.created_at).toISOString(),
    updatedAt: new Date(dbRecord.updated_at).toISOString(),
    earnedAt: new Date(dbRecord.earned_at).toISOString(),
    reversedAt: dbRecord.reversed_at ? new Date(dbRecord.reversed_at).toISOString() : null,
    cancelReason: dbRecord.cancel_reason || "",
    cumulativeReversedAmount: Number(dbRecord.cumulative_reversed_amount) || 0,
    remainingPayableAmount: Number(dbRecord.remaining_payable_amount) || 0,
    reversalSnapshots: dbRecord.reversal_snapshots || [],
    payoutStatus: dbRecord.payout_status as 'UNPAID' | 'ALLOCATED' | 'PAID',
    payoutBatchId: dbRecord.payout_batch_id || null,
    paidAt: dbRecord.paid_at ? new Date(dbRecord.paid_at).toISOString() : null,
    ledgerStatus: dbRecord.ledger_status as 'POSTED' | 'FAILED' | 'PENDING' | null,
    ledgerJournalId: dbRecord.ledger_journal_id || null,
    ledgerPostedAt: dbRecord.ledger_posted_at ? new Date(dbRecord.ledger_posted_at).toISOString() : null,
    metadata: dbRecord.metadata || {}
  };
}

export function mapRecordToDb(appRecord: Partial<CommissionRecord>): any {
  const dbData: any = {};
  if (appRecord.id !== undefined) dbData.id = appRecord.id;
  if (appRecord.orderId !== undefined) dbData.order_id = appRecord.orderId;
  if (appRecord.recipientId !== undefined) dbData.recipient_id = appRecord.recipientId;
  if (appRecord.recipientCode !== undefined) dbData.recipient_code = appRecord.recipientCode;
  if (appRecord.recipientName !== undefined) dbData.recipient_name = appRecord.recipientName;
  if (appRecord.recipientType !== undefined) dbData.recipient_type = appRecord.recipientType;
  if (appRecord.ruleId !== undefined) dbData.rule_id = appRecord.ruleId;
  if (appRecord.ruleName !== undefined) dbData.rule_name = appRecord.ruleName;
  if (appRecord.calculationMethod !== undefined) dbData.calculation_method = appRecord.calculationMethod;
  if (appRecord.sellingPriceSnapshot !== undefined) dbData.selling_price_snapshot = appRecord.sellingPriceSnapshot;
  if (appRecord.baseCostSnapshot !== undefined) dbData.base_cost_snapshot = appRecord.baseCostSnapshot;
  if (appRecord.commissionRateSnapshot !== undefined) dbData.commission_rate_snapshot = appRecord.commissionRateSnapshot;
  if (appRecord.fixedAmountSnapshot !== undefined) dbData.fixed_amount_snapshot = appRecord.fixedAmountSnapshot;
  if (appRecord.commissionAmount !== undefined) dbData.commission_amount = appRecord.commissionAmount;
  if (appRecord.currency !== undefined) dbData.currency = appRecord.currency;
  if (appRecord.status !== undefined) dbData.status = appRecord.status;
  if (appRecord.createdAt !== undefined) dbData.created_at = appRecord.createdAt;
  if (appRecord.updatedAt !== undefined) dbData.updated_at = appRecord.updatedAt;
  if (appRecord.earnedAt !== undefined) dbData.earned_at = appRecord.earnedAt;
  if (appRecord.reversedAt !== undefined) dbData.reversed_at = appRecord.reversedAt;
  if (appRecord.cancelReason !== undefined) dbData.cancel_reason = appRecord.cancelReason;
  if (appRecord.cumulativeReversedAmount !== undefined) dbData.cumulative_reversed_amount = appRecord.cumulativeReversedAmount;
  if (appRecord.remainingPayableAmount !== undefined) dbData.remaining_payable_amount = appRecord.remainingPayableAmount;
  if (appRecord.reversalSnapshots !== undefined) dbData.reversal_snapshots = appRecord.reversalSnapshots;
  if (appRecord.payoutStatus !== undefined) dbData.payout_status = appRecord.payoutStatus;
  if (appRecord.payoutBatchId !== undefined) dbData.payout_batch_id = appRecord.payoutBatchId;
  if (appRecord.paidAt !== undefined) dbData.paid_at = appRecord.paidAt;
  if (appRecord.ledgerStatus !== undefined) dbData.ledger_status = appRecord.ledgerStatus;
  if (appRecord.ledgerJournalId !== undefined) dbData.ledger_journal_id = appRecord.ledgerJournalId;
  if (appRecord.ledgerPostedAt !== undefined) dbData.ledger_posted_at = appRecord.ledgerPostedAt;
  if (appRecord.metadata !== undefined) dbData.metadata = appRecord.metadata;

  // Schema-mandated legacy/default fields
  dbData.amount = appRecord.commissionAmount || 0;

  return dbData;
}

export function mapPayoutBatchToApp(dbBatch: any): PayoutBatch {
  return {
    id: dbBatch.id,
    batchNumber: dbBatch.batch_number,
    recipientId: dbBatch.recipient_id,
    recipientSnapshot: dbBatch.recipient_snapshot,
    allocations: dbBatch.allocations,
    commissionRecordIds: (dbBatch.allocations || []).map((a: any) => a.commissionId),
    totalCommissionAmount: Number(dbBatch.total_commission_amount) || 0,
    payoutFee: Number(dbBatch.payout_fee) || 0,
    netPayoutAmount: Number(dbBatch.net_payout_amount) || 0,
    status: dbBatch.status as PayoutBatchStatus,
    payoutMethod: dbBatch.payout_method as 'MANUAL_BANK_TRANSFER',
    transferReference: dbBatch.transfer_reference,
    proofReference: dbBatch.proof_reference,
    ledgerJournalId: dbBatch.ledger_journal_id,
    createdBy: dbBatch.created_by,
    createdAt: new Date(dbBatch.created_at).toISOString(),
    submittedBy: dbBatch.submitted_by,
    submittedAt: dbBatch.submitted_at ? new Date(dbBatch.submitted_at).toISOString() : null,
    approvedBy: dbBatch.approved_by,
    approvedAt: dbBatch.approved_at ? new Date(dbBatch.approved_at).toISOString() : null,
    paidBy: dbBatch.paid_by,
    paidAt: dbBatch.paid_at ? new Date(dbBatch.paid_at).toISOString() : null,
    failureReason: dbBatch.failure_reason,
    cancelledBy: dbBatch.cancelled_by,
    cancelledAt: dbBatch.cancelled_at ? new Date(dbBatch.cancelled_at).toISOString() : null,
    cancellationReason: dbBatch.cancellation_reason,
    reviewReason: dbBatch.review_reason
  };
}

// ==========================================
// RECIPIENT REPOSITORY METHODS
// ==========================================

export async function getRecipients(filters: { status?: string; type?: string; search?: string }): Promise<CommissionRecipient[]> {
  const supabase = getSupabase();
  let query = supabase.from("commission_recipients").select("*");
  
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.type) {
    query = query.eq("type", filters.type);
  }

  const { data, error } = await query;
  if (error) throw error;

  let recipients = (data || []).map(mapRecipientToApp);
  
  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    recipients = recipients.filter(r => 
      r.name?.toLowerCase().includes(q) || 
      r.code?.toLowerCase().includes(q) ||
      r.id?.toLowerCase().includes(q)
    );
  }

  // Default Sort: createdAt desc
  recipients.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return recipients;
}

export async function getRecipientById(id: string): Promise<CommissionRecipient | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("commission_recipients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRecipientToApp(data) : null;
}

export async function getRecipientByCode(code: string): Promise<CommissionRecipient | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("commission_recipients")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .maybeSingle();

  if (error) throw error;
  return data ? mapRecipientToApp(data) : null;
}

export async function createRecipient(recipient: CommissionRecipient): Promise<CommissionRecipient> {
  const supabase = getSupabase();
  const dbData = mapRecipientToDb(recipient);
  
  const { data, error } = await supabase
    .from("commission_recipients")
    .insert(dbData)
    .select()
    .single();

  if (error) throw error;
  return mapRecipientToApp(data);
}

export async function updateRecipient(id: string, updates: Partial<CommissionRecipient>): Promise<CommissionRecipient> {
  const supabase = getSupabase();
  const dbData = mapRecipientToDb(updates);
  
  const { data, error } = await supabase
    .from("commission_recipients")
    .update(dbData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return mapRecipientToApp(data);
}

// ==========================================
// RULE REPOSITORY METHODS
// ==========================================

export async function getRules(filters: { status?: string; recipientType?: string; search?: string }): Promise<CommissionRule[]> {
  const supabase = getSupabase();
  let query = supabase.from("commission_rules").select("*");
  
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.recipientType) {
    query = query.eq("recipient_type", filters.recipientType);
  }

  const { data, error } = await query;
  if (error) throw error;

  let rules = (data || []).map(mapRuleToApp);

  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    rules = rules.filter(r => 
      r.name?.toLowerCase().includes(q) || 
      r.id?.toLowerCase().includes(q) ||
      r.gameId?.toLowerCase().includes(q)
    );
  }

  // Default Sort: priority asc, then createdAt desc
  rules.sort((a, b) => {
    if (a.priority !== b.priority) {
      return (a.priority || 100) - (b.priority || 100);
    }
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });

  return rules;
}

export async function getRuleById(id: string): Promise<CommissionRule | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("commission_rules")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRuleToApp(data) : null;
}

export async function createRule(rule: CommissionRule): Promise<CommissionRule> {
  const supabase = getSupabase();
  const dbData = mapRuleToDb(rule);
  
  const { data, error } = await supabase
    .from("commission_rules")
    .insert(dbData)
    .select()
    .single();

  if (error) throw error;
  return mapRuleToApp(data);
}

export async function updateRule(id: string, updates: Partial<CommissionRule>): Promise<CommissionRule> {
  const supabase = getSupabase();
  const dbData = mapRuleToDb(updates);
  
  const { data, error } = await supabase
    .from("commission_rules")
    .update(dbData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return mapRuleToApp(data);
}

export async function deleteRule(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("commission_rules")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ==========================================
// RECORD REPOSITORY METHODS
// ==========================================

export async function getRecords(filters: {
  orderId?: string;
  recipientId?: string;
  status?: string;
  calculationMethod?: string;
}): Promise<CommissionRecord[]> {
  const supabase = getSupabase();
  let query = supabase.from("commission_records").select("*");
  
  if (filters.orderId) {
    query = query.eq("order_id", filters.orderId);
  }
  if (filters.recipientId) {
    query = query.eq("recipient_id", filters.recipientId);
  }
  if (filters.status && filters.status !== "ALL") {
    query = query.eq("status", filters.status.toUpperCase());
  }
  if (filters.calculationMethod && filters.calculationMethod !== "ALL") {
    query = query.eq("calculation_method", filters.calculationMethod);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(mapRecordToApp);
}

export async function getRecordById(id: string): Promise<CommissionRecord | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("commission_records")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRecordToApp(data) : null;
}

export async function createRecord(record: CommissionRecord): Promise<CommissionRecord> {
  const supabase = getSupabase();
  const dbData = mapRecordToDb(record);
  
  const { data, error } = await supabase
    .from("commission_records")
    .insert(dbData)
    .select()
    .single();

  if (error) throw error;
  return mapRecordToApp(data);
}

export async function updateRecord(id: string, updates: Partial<CommissionRecord>): Promise<CommissionRecord> {
  const supabase = getSupabase();
  const dbData = mapRecordToDb(updates);
  
  const { data, error } = await supabase
    .from("commission_records")
    .update(dbData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return mapRecordToApp(data);
}

// ==========================================
// PAYOUT BATCH REPOSITORY METHODS
// ==========================================

export async function getPayoutBatches(filters: { status?: string; recipientId?: string }): Promise<PayoutBatch[]> {
  const supabase = getSupabase();
  let query = supabase.from("payout_batches").select("*");

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.recipientId) {
    query = query.eq("recipient_id", filters.recipientId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;

  return (data || []).map(mapPayoutBatchToApp);
}

export async function getPayoutBatchById(id: string): Promise<PayoutBatch | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("payout_batches")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapPayoutBatchToApp(data) : null;
}

export async function updatePayoutBatchStatus(id: string, updates: any): Promise<PayoutBatch> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("payout_batches")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return mapPayoutBatchToApp(data);
}

export async function updatePayoutBatchLedgerJournalId(id: string, ledgerJournalId: string): Promise<PayoutBatch> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("payout_batches")
    .update({ 
      ledger_journal_id: ledgerJournalId,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return mapPayoutBatchToApp(data);
}
