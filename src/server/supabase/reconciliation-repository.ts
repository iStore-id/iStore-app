import { supabaseAdmin } from "../supabase-admin.js";

export class ReconciliationRepository {
  private static instance: ReconciliationRepository;

  private constructor() {}

  public static getInstance(): ReconciliationRepository {
    if (!ReconciliationRepository.instance) {
      ReconciliationRepository.instance = new ReconciliationRepository();
    }
    return ReconciliationRepository.instance;
  }

  private get client() {
    return supabaseAdmin;
  }

  async createRun(run: {
    id: string;
    executedBy: string;
    startedAt: string;
    status: string;
    totalOrdersScanned: number;
    mismatchCount: number;
  }): Promise<void> {
    const { error } = await this.client.from("reconciliation_runs").insert({
      id: run.id,
      executed_by: run.executedBy,
      started_at: run.startedAt,
      status: run.status,
      total_orders_scanned: run.totalOrdersScanned,
      mismatch_count: run.mismatchCount,
      created_at: new Date().toISOString()
    });
    if (error) throw new Error(`Supabase createRun error: ${error.message}`);
  }

  async updateRun(id: string, updates: {
    completedAt?: string;
    status?: string;
    totalOrdersScanned?: number;
    mismatchCount?: number;
  }): Promise<void> {
    const data: any = {};
    if (updates.completedAt !== undefined) data.completed_at = updates.completedAt;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.totalOrdersScanned !== undefined) data.total_orders_scanned = updates.totalOrdersScanned;
    if (updates.mismatchCount !== undefined) data.mismatch_count = updates.mismatchCount;

    const { error } = await this.client.from("reconciliation_runs").update(data).eq("id", id);
    if (error) throw new Error(`Supabase updateRun error: ${error.message}`);
  }

  async createRecord(record: {
    id: string;
    runId: string;
    orderId: string;
    type: string;
    resolutionStatus: string;
    localState: string;
    providerState: string | null;
    expectedAmount: number;
    actualAmount: number;
    resolutionReason: string;
    createdAt?: string;
  }): Promise<void> {
    const { error } = await this.client.from("reconciliation_records").insert({
      id: record.id,
      run_id: record.runId,
      order_id: record.orderId,
      type: record.type,
      resolution_status: record.resolutionStatus,
      local_state: record.localState,
      provider_state: record.providerState,
      expected_amount: record.expectedAmount,
      actual_amount: record.actualAmount,
      resolution_reason: record.resolutionReason,
      created_at: record.createdAt || new Date().toISOString()
    });
    if (error) throw new Error(`Supabase createRecord error: ${error.message}`);
  }

  async updateRecord(id: string, updates: {
    runId?: string;
    resolutionStatus?: string;
    localState?: string;
    providerState?: string | null;
    expectedAmount?: number;
    actualAmount?: number;
    resolutionReason?: string;
    resolvedAt?: string;
  }): Promise<void> {
    const data: any = {};
    if (updates.runId !== undefined) data.run_id = updates.runId;
    if (updates.resolutionStatus !== undefined) data.resolution_status = updates.resolutionStatus;
    if (updates.localState !== undefined) data.local_state = updates.localState;
    if (updates.providerState !== undefined) data.provider_state = updates.providerState;
    if (updates.expectedAmount !== undefined) data.expected_amount = updates.expectedAmount;
    if (updates.actualAmount !== undefined) data.actual_amount = updates.actualAmount;
    if (updates.resolutionReason !== undefined) data.resolution_reason = updates.resolutionReason;
    if (updates.resolvedAt !== undefined) data.resolved_at = updates.resolvedAt;

    const { error } = await this.client.from("reconciliation_records").update(data).eq("id", id);
    if (error) throw new Error(`Supabase updateRecord error: ${error.message}`);
  }

  async getRecordById(id: string): Promise<any | null> {
    const { data, error } = await this.client.from("reconciliation_records").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase getRecordById error: ${error.message}`);
    return data ? this.mapRowToRecord(data) : null;
  }

  private mapRowToRecord(row: any): any {
    return {
      id: row.id,
      runId: row.run_id,
      orderId: row.order_id,
      type: row.type,
      resolutionStatus: row.resolution_status,
      localState: row.local_state,
      providerState: row.provider_state,
      expectedAmount: row.expected_amount,
      actualAmount: row.actual_amount,
      resolutionReason: row.resolution_reason,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at
    };
  }
}
