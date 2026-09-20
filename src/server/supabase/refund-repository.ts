import { supabaseAdmin } from "../supabase-admin";

export interface RefundRecord {
  id: string;
  orderId: string;
  refundKey: string;
  amount: number;
  currency: string;
  reason?: string;
  status: string;
  provider?: string;
  providerRefundId?: string;
  requestedBy?: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export class SupabaseRefundRepository {
  private static instance: SupabaseRefundRepository;

  public static getInstance(): SupabaseRefundRepository {
    if (!SupabaseRefundRepository.instance) {
      SupabaseRefundRepository.instance = new SupabaseRefundRepository();
    }
    return SupabaseRefundRepository.instance;
  }

  private getClient() {
    if (!supabaseAdmin) {
      throw new Error("supabaseAdmin is not initialized");
    }
    return supabaseAdmin;
  }

  async getRefundById(refundKey: string): Promise<RefundRecord | null> {
    try {
      const supabase = this.getClient();
      const { data, error } = await supabase
        .from("refunds")
        .select("*")
        .eq("refund_key", refundKey)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        orderId: data.order_id,
        refundKey: data.refund_key,
        amount: Number(data.amount),
        currency: data.currency || "IDR",
        reason: data.reason || undefined,
        status: data.status,
        provider: data.provider || undefined,
        providerRefundId: data.provider_refund_id || undefined,
        requestedBy: data.requested_by || undefined,
        processedAt: data.processed_at || undefined,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err) {
      console.error(`[SupabaseRefundRepository] Failed to get refund ${refundKey}:`, err);
      return null;
    }
  }

  async getRefundsByOrderId(orderId: string): Promise<RefundRecord[]> {
    try {
      const supabase = this.getClient();
      const { data, error } = await supabase
        .from("refunds")
        .select("*")
        .eq("order_id", orderId);

      if (error || !data) {
        return [];
      }

      return data.map((item: any) => ({
        id: item.id,
        orderId: item.order_id,
        refundKey: item.refund_key,
        amount: Number(item.amount),
        currency: item.currency || "IDR",
        reason: item.reason || undefined,
        status: item.status,
        provider: item.provider || undefined,
        providerRefundId: item.provider_refund_id || undefined,
        requestedBy: item.requested_by || undefined,
        processedAt: item.processed_at || undefined,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));
    } catch (err) {
      console.error(`[SupabaseRefundRepository] Failed to get refunds for order ${orderId}:`, err);
      return [];
    }
  }

  async createRefund(record: RefundRecord): Promise<RefundRecord> {
    const supabase = this.getClient();
    const row = {
      id: record.id,
      order_id: record.orderId,
      refund_key: record.refundKey,
      amount: record.amount,
      currency: record.currency || "IDR",
      reason: record.reason || null,
      status: record.status,
      provider: record.provider || "midtrans",
      provider_refund_id: record.providerRefundId || null,
      requested_by: record.requestedBy || null,
      processed_at: record.processedAt || null,
      created_at: record.createdAt,
      updated_at: record.updatedAt
    };

    const { data, error } = await supabase
      .from("refunds")
      .upsert(row)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to create refund: ${error.message}`);
    }

    return {
      id: data.id,
      orderId: data.order_id,
      refundKey: data.refund_key,
      amount: Number(data.amount),
      currency: data.currency || "IDR",
      reason: data.reason || undefined,
      status: data.status,
      provider: data.provider || undefined,
      providerRefundId: data.provider_refund_id || undefined,
      requestedBy: data.requested_by || undefined,
      processedAt: data.processed_at || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async updateRefund(refundKey: string, updates: Partial<RefundRecord>): Promise<void> {
    const supabase = this.getClient();
    const row: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.status !== undefined) row.status = updates.status;
    if (updates.providerRefundId !== undefined) row.provider_refund_id = updates.providerRefundId;
    if (updates.processedAt !== undefined) row.processed_at = updates.processedAt;
    if (updates.reason !== undefined) row.reason = updates.reason;

    const { error } = await supabase
      .from("refunds")
      .update(row)
      .eq("refund_key", refundKey);

    if (error) {
      throw new Error(`Failed to update refund ${refundKey}: ${error.message}`);
    }
  }
}
