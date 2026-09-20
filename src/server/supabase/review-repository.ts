import { supabaseAdmin, isSupabaseAdminConfigured } from "../supabase-admin.js";
import { ReviewItem } from "../review-service.js";

export class SupabaseReviewRepository {
  private static instance: SupabaseReviewRepository;

  private constructor() {}

  public static getInstance(): SupabaseReviewRepository {
    if (!SupabaseReviewRepository.instance) {
      SupabaseReviewRepository.instance = new SupabaseReviewRepository();
    }
    return SupabaseReviewRepository.instance;
  }

  private ensureClient() {
    if (!supabaseAdmin || !isSupabaseAdminConfigured) {
      throw new Error("Supabase Admin is not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    }
    return supabaseAdmin;
  }

  async getPublicReviewsForProduct(productId: string): Promise<ReviewItem[]> {
    if (!productId) return [];
    const client = this.ensureClient();

    const { data, error } = await client
      .from("reviews")
      .select("*")
      .eq("product_id", productId)
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Supabase getPublicReviewsForProduct error: ${error.message}`);
    return (data || []).map(row => this.mapRowToReviewItem(row));
  }

  async getProductRatingSummary(productId: string): Promise<{ averageRating: number; reviewCount: number }> {
    const reviews = await this.getPublicReviewsForProduct(productId);
    if (reviews.length === 0) return { averageRating: 0, reviewCount: 0 };
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const averageRating = Number((sum / reviews.length).toFixed(1));
    return { averageRating, reviewCount: reviews.length };
  }

  async getReviewById(id: string): Promise<ReviewItem | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("reviews")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Supabase getReviewById error: ${error.message}`);
    return data ? this.mapRowToReviewItem(data) : null;
  }

  async getReviewByCustomerAndProduct(customerId: string, productId: string): Promise<ReviewItem | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("reviews")
      .select("*")
      .eq("customer_id", customerId)
      .eq("product_id", productId)
      .maybeSingle();

    if (error) throw new Error(`Supabase getReviewByCustomerAndProduct error: ${error.message}`);
    return data ? this.mapRowToReviewItem(data) : null;
  }

  async getReviewsByCustomer(customerId: string): Promise<ReviewItem[]> {
    if (!customerId || customerId === "guest") return [];
    const client = this.ensureClient();

    const { data, error } = await client
      .from("reviews")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Supabase getReviewsByCustomer error: ${error.message}`);
    return (data || []).map(row => this.mapRowToReviewItem(row));
  }

  async getAdminReviews(limit = 200): Promise<ReviewItem[]> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Supabase getAdminReviews error: ${error.message}`);
    return (data || []).map(row => this.mapRowToReviewItem(row));
  }

  async createReview(data: Omit<ReviewItem, "id" | "createdAt" | "updatedAt">): Promise<ReviewItem> {
    const client = this.ensureClient();
    const now = new Date().toISOString();

    const { data: row, error } = await client
      .from("reviews")
      .insert({
        customer_id: data.customerId,
        customer_name: data.customerName || null,
        product_id: data.productId,
        variant_id: data.variantId || null,
        order_id: data.orderId || null,
        rating: data.rating,
        content: data.content,
        status: data.status || "published",
        verified_purchase: !!data.verifiedPurchase,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (error) throw new Error(`Supabase createReview error: ${error.message}`);
    return this.mapRowToReviewItem(row);
  }

  async updateReview(id: string, data: Partial<ReviewItem>): Promise<ReviewItem> {
    const client = this.ensureClient();
    const payload: any = {
      updated_at: new Date().toISOString()
    };

    if (data.rating !== undefined) payload.rating = data.rating;
    if (data.content !== undefined) payload.content = data.content;
    if (data.status !== undefined) payload.status = data.status;
    if (data.customerName !== undefined) payload.customer_name = data.customerName;
    if (data.verifiedPurchase !== undefined) payload.verified_purchase = data.verifiedPurchase;

    const { data: row, error } = await client
      .from("reviews")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(`Supabase updateReview error: ${error.message}`);
    return this.mapRowToReviewItem(row);
  }

  async updateReviewStatus(id: string, status: "published" | "hidden" | "rejected"): Promise<ReviewItem> {
    return this.updateReview(id, { status });
  }

  async deleteReview(id: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client
      .from("reviews")
      .delete()
      .eq("id", id);

    if (error) throw new Error(`Supabase deleteReview error: ${error.message}`);
  }

  private mapRowToReviewItem(row: any): ReviewItem {
    return {
      id: String(row.id),
      customerId: row.customer_id,
      customerName: row.customer_name || undefined,
      productId: row.product_id,
      variantId: row.variant_id || undefined,
      orderId: row.order_id || undefined,
      rating: Number(row.rating),
      content: row.content,
      status: row.status,
      verifiedPurchase: !!row.verified_purchase,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
