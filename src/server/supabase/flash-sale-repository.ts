import { supabaseAdmin, isSupabaseAdminConfigured } from "../supabase-admin";
import { FlashSaleData } from "../flash-sale-service";

export class SupabaseFlashSaleRepository {
  private static instance: SupabaseFlashSaleRepository;

  private constructor() {}

  public static getInstance(): SupabaseFlashSaleRepository {
    if (!SupabaseFlashSaleRepository.instance) {
      SupabaseFlashSaleRepository.instance = new SupabaseFlashSaleRepository();
    }
    return SupabaseFlashSaleRepository.instance;
  }

  private ensureClient() {
    if (!supabaseAdmin || !isSupabaseAdminConfigured) {
      throw new Error("Supabase Admin is not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    }
    return supabaseAdmin;
  }

  async getFlashSales(): Promise<FlashSaleData[]> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("flash_sales")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Supabase getFlashSales error: ${error.message}`);
    return (data || []).map(row => this.mapRowToFlashSale(row));
  }

  async getFlashSale(id: string): Promise<FlashSaleData | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("flash_sales")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Supabase getFlashSale error: ${error.message}`);
    return data ? this.mapRowToFlashSale(data) : null;
  }

  async getActiveFlashSaleForVariant(variantId: string): Promise<FlashSaleData | null> {
    const client = this.ensureClient();
    const now = new Date().toISOString();

    const { data, error } = await client
      .from("flash_sales")
      .select("*")
      .eq("variant_id", variantId)
      .eq("status", "active")
      .lte("start_at", now)
      .gte("end_at", now);

    if (error) throw new Error(`Supabase getActiveFlashSaleForVariant error: ${error.message}`);

    const activeList = (data || []).map(row => this.mapRowToFlashSale(row));
    for (const fs of activeList) {
      if (fs.remainingQuota === null || fs.remainingQuota === undefined || fs.remainingQuota > 0) {
        return fs;
      }
    }
    return null;
  }

  async getActiveFlashSalesForVariants(variantIds: string[]): Promise<FlashSaleData[]> {
    if (!variantIds || variantIds.length === 0) return [];
    const client = this.ensureClient();
    const now = new Date().toISOString();

    const { data, error } = await client
      .from("flash_sales")
      .select("*")
      .in("variant_id", variantIds)
      .eq("status", "active")
      .lte("start_at", now)
      .gte("end_at", now);

    if (error) throw new Error(`Supabase getActiveFlashSalesForVariants error: ${error.message}`);

    const allActive = (data || []).map(row => this.mapRowToFlashSale(row));
    
    // Filter out items with no remaining quota
    return allActive.filter(fs => fs.remainingQuota === null || fs.remainingQuota === undefined || fs.remainingQuota > 0);
  }

  async createFlashSale(data: Omit<FlashSaleData, "id" | "usageCount" | "remainingQuota" | "createdAt" | "updatedAt">): Promise<FlashSaleData> {
    const client = this.ensureClient();
    const now = new Date().toISOString();
    const totalQuota = data.totalQuota !== undefined ? data.totalQuota : null;

    const { data: row, error } = await client
      .from("flash_sales")
      .insert({
        name: data.name,
        product_id: data.productId,
        variant_id: data.variantId,
        sale_price: data.salePrice,
        start_at: data.startAt,
        end_at: data.endAt,
        status: data.status || "active",
        total_quota: totalQuota,
        remaining_quota: totalQuota,
        per_customer_limit: data.perCustomerLimit !== undefined ? data.perCustomerLimit : null,
        usage_count: 0,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (error) throw new Error(`Supabase createFlashSale error: ${error.message}`);
    return this.mapRowToFlashSale(row);
  }

  async updateFlashSale(id: string, data: Partial<FlashSaleData>): Promise<void> {
    const client = this.ensureClient();
    const payload: any = {
      updated_at: new Date().toISOString()
    };

    if (data.name !== undefined) payload.name = data.name;
    if (data.productId !== undefined) payload.product_id = data.productId;
    if (data.variantId !== undefined) payload.variant_id = data.variantId;
    if (data.salePrice !== undefined) payload.sale_price = data.salePrice;
    if (data.startAt !== undefined) payload.start_at = data.startAt;
    if (data.endAt !== undefined) payload.end_at = data.endAt;
    if (data.status !== undefined) payload.status = data.status;
    if (data.totalQuota !== undefined) payload.total_quota = data.totalQuota;
    if (data.remainingQuota !== undefined) payload.remaining_quota = data.remainingQuota;
    if (data.perCustomerLimit !== undefined) payload.per_customer_limit = data.perCustomerLimit;
    if (data.usageCount !== undefined) payload.usage_count = data.usageCount;

    const { error } = await client
      .from("flash_sales")
      .update(payload)
      .eq("id", id);

    if (error) throw new Error(`Supabase updateFlashSale error: ${error.message}`);
  }

  async deleteFlashSale(id: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client
      .from("flash_sales")
      .update({
        status: "inactive",
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (error) throw new Error(`Supabase deleteFlashSale error: ${error.message}`);
  }

  async getUserFlashSaleUsageCount(userId: string, flashSaleId: string): Promise<number> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("orders")
      .select("id, flash_sale_snapshot")
      .eq("user_id", userId)
      .in("payment_status", ["paid", "pending"]);

    if (error) {
      console.error("[SupabaseFlashSaleRepository] getUserFlashSaleUsageCount error:", error);
      return 0;
    }

    if (!data) return 0;

    let count = 0;
    for (const order of data) {
      if (order.flash_sale_snapshot && typeof order.flash_sale_snapshot === "object") {
        if (order.flash_sale_snapshot.id === flashSaleId) {
          count++;
        }
      }
    }
    return count;
  }

  async consumeQuotaAndLimit(flashSaleId: string, userId: string): Promise<FlashSaleData> {
    const fsData = await this.getFlashSale(flashSaleId);
    if (!fsData) {
      throw new Error("Flash sale tidak ditemukan.");
    }

    const now = new Date();
    if (fsData.status !== "active" || now < new Date(fsData.startAt) || now > new Date(fsData.endAt)) {
      throw new Error("Flash sale sudah berakhir atau tidak aktif.");
    }

    if (fsData.remainingQuota !== null && fsData.remainingQuota !== undefined) {
      if (fsData.remainingQuota <= 0) {
        throw new Error("Kuota flash sale telah habis.");
      }
    }

    if (fsData.perCustomerLimit && userId && userId !== "guest") {
      const userUsage = await this.getUserFlashSaleUsageCount(userId, fsData.id!);
      if (userUsage >= fsData.perCustomerLimit) {
        throw new Error(`Anda telah mencapai batas maksimal pembelian flash sale ini (${fsData.perCustomerLimit}x).`);
      }
    }

    const newRemaining = fsData.remainingQuota !== null && fsData.remainingQuota !== undefined
      ? fsData.remainingQuota - 1
      : null;
    const newUsageCount = (fsData.usageCount || 0) + 1;

    await this.updateFlashSale(fsData.id!, {
      remainingQuota: newRemaining,
      usageCount: newUsageCount
    });

    return {
      ...fsData,
      remainingQuota: newRemaining,
      usageCount: newUsageCount
    };
  }

  private mapRowToFlashSale(row: any): FlashSaleData {
    return {
      id: String(row.id),
      name: row.name,
      productId: row.product_id,
      variantId: row.variant_id,
      salePrice: Number(row.sale_price),
      startAt: row.start_at,
      endAt: row.end_at,
      status: row.status,
      totalQuota: row.total_quota !== null && row.total_quota !== undefined ? Number(row.total_quota) : null,
      remainingQuota: row.remaining_quota !== null && row.remaining_quota !== undefined ? Number(row.remaining_quota) : null,
      perCustomerLimit: row.per_customer_limit !== null && row.per_customer_limit !== undefined ? Number(row.per_customer_limit) : null,
      usageCount: Number(row.usage_count || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
