import { 
  ILedgerRepository, 
  LedgerJournalEntry, 
  LedgerListOptions, 
  LedgerOverview 
} from "../types/ledger";
import { SupabaseLedgerRepository } from "./supabase/ledger-repository";

export class DualLedgerRepository implements ILedgerRepository {
  private static instance: DualLedgerRepository;
  private primary: ILedgerRepository;

  private constructor() {
    this.primary = SupabaseLedgerRepository.getInstance();
  }

  public static getInstance(): DualLedgerRepository {
    if (!DualLedgerRepository.instance) {
      DualLedgerRepository.instance = new DualLedgerRepository();
    }
    return DualLedgerRepository.instance;
  }

  setActivationMode(mode: 'FIRESORE_ONLY' | 'DUAL_READ' | 'SUPABASE_ONLY') {
    // Phase 5B.3G-8B: Deprecated, Supabase is only source.
  }

  async getJournalEntryById(id: string): Promise<LedgerJournalEntry | null> {
    return this.primary.getJournalEntryById(id);
  }

  async getJournalEntryByIdempotencyKey(key: string): Promise<LedgerJournalEntry | null> {
    return this.primary.getJournalEntryByIdempotencyKey(key);
  }

  async listJournalEntries(options?: LedgerListOptions): Promise<{ entries: LedgerJournalEntry[], total: number }> {
    return this.primary.listJournalEntries(options);
  }

  async getLedgerOverview(): Promise<LedgerOverview> {
    return this.primary.getLedgerOverview();
  }

  async getFinancialMetrics(startTime: string, endTime: string): Promise<any> {
    return this.primary.getFinancialMetrics(startTime, endTime);
  }
}
