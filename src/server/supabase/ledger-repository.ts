import { supabaseAdmin } from "../supabase-admin.js";
import { 
  LedgerJournalEntry, 
  LedgerLineItem, 
  LedgerAccount, 
  LEDGER_ACCOUNT_NAMES, 
  LedgerEventType,
  ILedgerRepository,
  LedgerListOptions,
  LedgerOverview
} from "../../types/ledger.js";
import { mapCanonicalToLegacyAccount, mapLegacyAccountToCanonical } from "../ledger-mapping.js";

/**
 * Validates financial amounts for the Integer IDR domain.
 * Ensures data from DB fits JS safe integer range and domain constraints.
 * REJECTS any fractional or unsafe values.
 */
function validateReadAmount(amount: number, context: string): number {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new Error(`LEDGER_PRECISION_ERROR: ${context} is not a finite number: ${amount}`);
  }
  if (!Number.isInteger(amount)) {
    throw new Error(`LEDGER_PRECISION_ERROR: ${context} [${amount}] contains invalid decimals for Integer IDR.`);
  }
  if (!Number.isSafeInteger(amount)) {
    throw new Error(`LEDGER_PRECISION_ERROR: ${context} [${amount}] exceeds MAX_SAFE_INTEGER.`);
  }
  return amount;
}

export class SupabaseLedgerRepository implements ILedgerRepository {
  private static instance: SupabaseLedgerRepository;

  private constructor() {}

  public static getInstance(): SupabaseLedgerRepository {
    if (!SupabaseLedgerRepository.instance) {
      SupabaseLedgerRepository.instance = new SupabaseLedgerRepository();
    }
    return SupabaseLedgerRepository.instance;
  }

  private get client() {
    if (!supabaseAdmin) {
      throw new Error("Supabase Admin is not configured.");
    }
    return supabaseAdmin;
  }

  private mapRowToJournal(row: any, entries: any[] = []): LedgerJournalEntry {
    const lineItems: LedgerLineItem[] = entries.map(e => {
      const legacyAccountId = mapCanonicalToLegacyAccount(e.account_id);
      return {
        accountId: legacyAccountId,
        accountName: LEDGER_ACCOUNT_NAMES[legacyAccountId as LedgerAccount] || `Account ${e.account_id}`,
        debit: validateReadAmount(Number(e.debit), `ledger_entry[${e.id}].debit`),
        credit: validateReadAmount(Number(e.credit), `ledger_entry[${e.id}].credit`)
      };
    });

    return {
      id: row.id, // UUID
      idempotencyKey: row.idempotency_key,
      eventType: row.event_type as LedgerEventType,
      source: {
        collection: row.source_type,
        documentId: row.source_id,
        eventId: row.metadata?.source_event_id
      },
      lineItems,
      totalAmount: validateReadAmount(Number(row.total_amount), `ledger_journal[${row.id}].total_amount`),
      currency: (row.currency as 'IDR') || 'IDR',
      reversalOf: row.reversal_of,
      createdBy: row.metadata?.created_by || 'SYSTEM',
      createdAt: row.created_at,
      metadata: row.metadata
    };
  }

  async getJournalEntryById(id: string): Promise<LedgerJournalEntry | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    let query = this.client.from("ledger_journals").select("*");
    
    if (isUuid) {
      query = query.eq("id", id);
    } else {
      // Legacy ID handling: Firestore used ledger_${idempotencyKey} as doc ID
      // In Supabase, this mapping is preserved in the idempotency_key column.
      // We must strip the "ledger_" prefix if it exists to match the idempotency_key pattern.
      const idempotencyKey = id.startsWith("ledger_") ? id.substring(7) : id;
      query = query.eq("idempotency_key", idempotencyKey);
    }

    const { data: journal, error: journalError } = await query.maybeSingle();

    if (journalError) throw new Error(`DATABASE_ERROR: ${journalError.message}`);
    if (!journal) return null;

    const { data: entries, error: entriesError } = await this.client
      .from("ledger_entries")
      .select("*")
      .eq("journal_id", journal.id);

    if (entriesError) throw new Error(`DATABASE_ERROR: ${entriesError.message}`);

    return this.mapRowToJournal(journal, entries || []);
  }

  async getJournalEntryByIdempotencyKey(key: string): Promise<LedgerJournalEntry | null> {
    const { data: journal, error: journalError } = await this.client
      .from("ledger_journals")
      .select("*")
      .eq("idempotency_key", key)
      .maybeSingle();

    if (journalError) throw new Error(`DATABASE_ERROR: ${journalError.message}`);
    if (!journal) return null;

    const { data: entries, error: entriesError } = await this.client
      .from("ledger_entries")
      .select("*")
      .eq("journal_id", journal.id);

    if (entriesError) throw new Error(`DATABASE_ERROR: ${entriesError.message}`);

    return this.mapRowToJournal(journal, entries || []);
  }

  async listJournalEntries(options: LedgerListOptions = {}): Promise<{ entries: LedgerJournalEntry[], total: number }> {
    const {
      limit = 25,
      offset = 0,
      eventType,
      startDate,
      endDate,
      accountId,
      sourceType,
      sourceId,
      search
    } = options;

    let query = this.client
      .from("ledger_journals")
      .select("*, ledger_entries(*)", { count: 'exact' });

    if (eventType && eventType !== "ALL") {
      query = query.eq("event_type", eventType);
    }

    if (startDate) {
      query = query.gte("created_at", startDate);
    }

    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    if (sourceType) {
      query = query.eq("source_type", sourceType);
    }

    if (sourceId) {
      query = query.eq("source_id", sourceId);
    }

    if (search) {
      query = query.or(`idempotency_key.ilike.%${search}%,source_id.ilike.%${search}%`);
    }

    // Handle account filter if specified
    // Note: Filtering by child table column in a join requires a specific PostgREST syntax
    // We'll apply it via filter if accountId is present
    if (accountId) {
      // map legacy to canonical for DB query
      try {
        const canonicalId = mapLegacyAccountToCanonical(accountId);
        // This is a join filter
        query = query.eq("ledger_entries.account_id", canonicalId);
      } catch (e) {
        // if it's not a legacy account, try as is
        query = query.eq("ledger_entries.account_id", accountId);
      }
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`DATABASE_ERROR: ${error.message}`);

    const entries = (data || []).map(row => this.mapRowToJournal(row, row.ledger_entries));

    return {
      entries,
      total: count || 0
    };
  }

  async getLedgerOverview(): Promise<any> {
    // Aggregating from authoritative ledger_entries (ledger_lines)
    const { data: summary, error: summaryError } = await this.client
      .from("ledger_entries")
      .select("account_id, debit, credit, ledger_accounts(name, normal_balance)");

    if (summaryError) throw new Error(`DATABASE_ERROR: ${summaryError.message}`);

    const { count, error: countError } = await this.client
      .from("ledger_journals")
      .select("*", { count: 'exact', head: true });

    if (countError) throw new Error(`DATABASE_ERROR: ${countError.message}`);

    const accountSummary: Record<string, any> = {};
    let totalDebitSum = 0;
    let totalCreditSum = 0;

    // Aggregate by account
    for (const row of (summary || [])) {
      const canonicalId = row.account_id;
      const legacyId = mapCanonicalToLegacyAccount(canonicalId);
      const debit = validateReadAmount(Number(row.debit), `ledger_entry_debit[${canonicalId}]`);
      const credit = validateReadAmount(Number(row.credit), `ledger_entry_credit[${canonicalId}]`);
      
      if (!accountSummary[legacyId]) {
        const accountName = LEDGER_ACCOUNT_NAMES[legacyId as LedgerAccount] || (row.ledger_accounts as any)?.name || legacyId;
        accountSummary[legacyId] = {
          debit: 0,
          credit: 0,
          net: 0,
          name: accountName
        };
      }

      accountSummary[legacyId].debit += debit;
      accountSummary[legacyId].credit += credit;
    }

    // Calculate net balances based on normality
    for (const legacyId in accountSummary) {
      const acc = accountSummary[legacyId];
      // Note: net is standardized (Debit - Credit) for trial balance math, 
      // but we calculate total global debit/credit by summing the components
      acc.net = acc.debit - acc.credit;
      
      totalDebitSum += acc.debit;
      totalCreditSum += acc.credit;
    }

    return {
        totalEntries: count || 0,
        totalDebit: totalDebitSum,
        totalCredit: totalCreditSum,
        accountSummary
    };
  }

  async getFinancialMetrics(startTime: string, endTime: string): Promise<any> {
    const { data: journals, error } = await this.client
      .from("ledger_journals")
      .select("*, ledger_entries(*)")
      .gte("created_at", startTime)
      .lt("created_at", endTime);

    if (error) throw new Error(`DATABASE_ERROR: ${error.message}`);

    let grossRevenue = 0;
    let realizedRevenue = 0;
    let refundTotal = 0;
    let totalSettled = 0;
    let totalMdr = 0;

    for (const j of (journals || [])) {
      if (j.event_type === "PAYMENT_RECEIVED") {
        grossRevenue += Number(j.total_amount);
      } else if (j.event_type === "FULFILLMENT_SUCCESS") {
        realizedRevenue += Number(j.total_amount);
      } else if (j.event_type === "REFUND_EXECUTED") {
        refundTotal += Number(j.total_amount);
      } else if (j.event_type === "SETTLEMENT_CLOSED") {
        const entries = j.ledger_entries || [];
        // Canonical IDs: 1100 (Bank Clearing), 5000 (Gateway MDR Fee)
        const netItem = entries.find((l: any) => l.account_id === "1100");
        const mdrItem = entries.find((l: any) => l.account_id === "5000");
        if (netItem) totalSettled += Number(netItem.debit);
        if (mdrItem) totalMdr += Number(mdrItem.debit);
      }
    }

    return {
      grossRevenue,
      realizedRevenue,
      refundTotal,
      totalSettled,
      totalMdr
    };
  }
}
