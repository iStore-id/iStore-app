import { supabaseAdmin, isSupabaseAdminConfigured } from "../supabase-admin.js";
import { PromoData } from "../promo-service.js";

export class SupabasePromoRepository {
  private static instance: SupabasePromoRepository;

  private constructor() {}

  public static getInstance(): SupabasePromoRepository {
    if (!SupabasePromoRepository.instance) {
      SupabasePromoRepository.instance = new SupabasePromoRepository();
    }
    return SupabasePromoRepository.instance;
  }

  private ensureClient() {
    if (!supabaseAdmin || !isSupabaseAdminConfigured) {
      throw new Error("Supabase Admin is not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    }
    return supabaseAdmin;
  }

  async getPromos(onlyActive = false): Promise<PromoData[]> {
    const client = this.ensureClient();
    let query = client.from("promos").select("*").order("created_at", { ascending: false });

    if (onlyActive) {
      const now = new Date().toISOString();
      query = query
        .eq("status", "active")
        .lte("start_at", now)
        .gte("end_at", now);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Supabase getPromos error: ${error.message}`);
    return (data || []).map(row => this.mapRowToPromo(row));
  }

  async getPromo(id: string): Promise<PromoData | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("promos")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Supabase getPromo error: ${error.message}`);
    return data ? this.mapRowToPromo(data) : null;
  }

  async getPromoByCode(code: string): Promise<PromoData | null> {
    const client = this.ensureClient();
    const normalized = code.trim().toUpperCase();
    const { data, error } = await client
      .from("promos")
      .select("*")
      .eq("code", normalized)
      .maybeSingle();

    if (error) throw new Error(`Supabase getPromoByCode error: ${error.message}`);
    return data ? this.mapRowToPromo(data) : null;
  }

  async createPromo(promo: Omit<PromoData, "id" | "usageCount" | "createdAt" | "updatedAt">): Promise<PromoData> {
    const client = this.ensureClient();
    const now = new Date().toISOString();
    const normalizedCode = promo.code.trim().toUpperCase();

    const { data, error } = await client
      .from("promos")
      .insert({
        code: normalizedCode,
        name: promo.name,
        description: promo.description,
        discount_type: promo.discountType,
        discount_value: promo.discountValue,
        minimum_transaction: promo.minimumTransaction,
        maximum_discount: promo.maximumDiscount,
        usage_limit: promo.usageLimit,
        per_customer_usage_limit: promo.perCustomerUsageLimit,
        start_at: promo.startAt,
        end_at: promo.endAt,
        status: promo.status || 'active',
        applicable_games: promo.applicableGames || [],
        applicable_products: promo.applicableProducts || [],
        applicable_categories: promo.applicableCategories || [],
        usage_count: 0,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (error) throw new Error(`Supabase createPromo error: ${error.message}`);
    return this.mapRowToPromo(data);
  }

  async updatePromo(id: string, promo: Partial<PromoData>): Promise<void> {
    const client = this.ensureClient();
    const payload: any = {
      updated_at: new Date().toISOString()
    };

    if (promo.code !== undefined) payload.code = promo.code.trim().toUpperCase();
    if (promo.name !== undefined) payload.name = promo.name;
    if (promo.description !== undefined) payload.description = promo.description;
    if (promo.discountType !== undefined) payload.discount_type = promo.discountType;
    if (promo.discountValue !== undefined) payload.discount_value = promo.discountValue;
    if (promo.minimumTransaction !== undefined) payload.minimum_transaction = promo.minimumTransaction;
    if (promo.maximumDiscount !== undefined) payload.maximum_discount = promo.maximumDiscount;
    if (promo.usageLimit !== undefined) payload.usage_limit = promo.usageLimit;
    if (promo.perCustomerUsageLimit !== undefined) payload.per_customer_usage_limit = promo.perCustomerUsageLimit;
    if (promo.startAt !== undefined) payload.start_at = promo.startAt;
    if (promo.endAt !== undefined) payload.end_at = promo.endAt;
    if (promo.status !== undefined) payload.status = promo.status;
    if (promo.applicableGames !== undefined) payload.applicable_games = promo.applicableGames;
    if (promo.applicableProducts !== undefined) payload.applicable_products = promo.applicableProducts;
    if (promo.applicableCategories !== undefined) payload.applicable_categories = promo.applicableCategories;
    if (promo.usageCount !== undefined) payload.usage_count = promo.usageCount;

    const { error } = await client
      .from("promos")
      .update(payload)
      .eq("id", id);

    if (error) throw new Error(`Supabase updatePromo error: ${error.message}`);
  }

  async deletePromo(id: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client
      .from("promos")
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw new Error(`Supabase deletePromo error: ${error.message}`);
  }

  async incrementUsage(promoId: string, userId?: string, orderId?: string): Promise<void> {
    const client = this.ensureClient();
    
    const { data, error } = await client.rpc('atomic_increment_promo_usage', {
      p_promo_id: promoId,
      p_user_id: userId || null,
      p_order_id: orderId || null
    });

    if (error) throw new Error(`Supabase atomic incrementUsage error: ${error.message}`);
    
    if (data && data.success === false) {
      throw new Error(`Promo usage failed: ${data.error}`);
    }
  }

  async releaseUsage(orderId: string): Promise<void> {
    const client = this.ensureClient();
    const { data, error } = await client.rpc('atomic_release_promo_usage', {
      p_order_id: orderId
    });

    if (error) {
      console.error(`[PromoRepository] releaseUsage error for ${orderId}:`, error.message);
      return; // Non-blocking
    }
  }

  async getUserPromoUsageCount(userId: string, promoId: string): Promise<number> {
    const client = this.ensureClient();
    const { count, error } = await client
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("promo_id", promoId)
      .in("payment_status", ["paid", "pending"]);

    if (error) {
      console.error("[SupabasePromoRepository] getUserPromoUsageCount error:", error);
      return 0;
    }
    return count || 0;
  }

  private mapRowToPromo(row: any): PromoData {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      discountType: row.discount_type,
      discountValue: Number(row.discount_value),
      minimumTransaction: Number(row.minimum_transaction),
      maximumDiscount: row.maximum_discount !== null && row.maximum_discount !== undefined ? Number(row.maximum_discount) : null,
      usageLimit: row.usage_limit !== null && row.usage_limit !== undefined ? Number(row.usage_limit) : null,
      perCustomerUsageLimit: row.per_customer_usage_limit !== null && row.per_customer_usage_limit !== undefined ? Number(row.per_customer_usage_limit) : null,
      startAt: row.start_at,
      endAt: row.end_at,
      status: row.status,
      applicableGames: Array.isArray(row.applicable_games) ? row.applicable_games : [],
      applicableProducts: Array.isArray(row.applicable_products) ? row.applicable_products : [],
      applicableCategories: Array.isArray(row.applicable_categories) ? row.applicable_categories : [],
      usageCount: Number(row.usage_count || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
