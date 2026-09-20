import { supabaseAdmin, isSupabaseAdminConfigured } from "../supabase-admin";
import { WishlistItem } from "../wishlist-service";

export class SupabaseWishlistRepository {
  private static instance: SupabaseWishlistRepository;

  private constructor() {}

  public static getInstance(): SupabaseWishlistRepository {
    if (!SupabaseWishlistRepository.instance) {
      SupabaseWishlistRepository.instance = new SupabaseWishlistRepository();
    }
    return SupabaseWishlistRepository.instance;
  }

  private ensureClient() {
    if (!supabaseAdmin || !isSupabaseAdminConfigured) {
      throw new Error("Supabase Admin is not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    }
    return supabaseAdmin;
  }

  async getWishlist(customerId: string): Promise<WishlistItem[]> {
    if (!customerId || customerId === "guest") return [];
    const client = this.ensureClient();

    const { data, error } = await client
      .from("wishlists")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Supabase getWishlist error: ${error.message}`);
    return (data || []).map(row => this.mapRowToWishlistItem(row));
  }

  async getWishlistItem(customerId: string, productId: string, variantId?: string): Promise<WishlistItem | null> {
    const client = this.ensureClient();
    let query = client
      .from("wishlists")
      .select("*")
      .eq("customer_id", customerId)
      .eq("product_id", productId);

    if (variantId) {
      query = query.eq("variant_id", variantId);
    } else {
      query = query.is("variant_id", null);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`Supabase getWishlistItem error: ${error.message}`);
    return data ? this.mapRowToWishlistItem(data) : null;
  }

  async getWishlistItemById(id: string): Promise<WishlistItem | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("wishlists")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Supabase getWishlistItemById error: ${error.message}`);
    return data ? this.mapRowToWishlistItem(data) : null;
  }

  async addToWishlist(customerId: string, productId: string, variantId?: string): Promise<WishlistItem> {
    const client = this.ensureClient();
    const now = new Date().toISOString();

    const { data, error } = await client
      .from("wishlists")
      .insert({
        customer_id: customerId,
        product_id: productId,
        variant_id: variantId || null,
        created_at: now
      })
      .select()
      .single();

    if (error) throw new Error(`Supabase addToWishlist error: ${error.message}`);
    return this.mapRowToWishlistItem(data);
  }

  async removeFromWishlist(id: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client
      .from("wishlists")
      .delete()
      .eq("id", id);

    if (error) throw new Error(`Supabase removeFromWishlist error: ${error.message}`);
  }

  async clearWishlist(customerId: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client
      .from("wishlists")
      .delete()
      .eq("customer_id", customerId);

    if (error) throw new Error(`Supabase clearWishlist error: ${error.message}`);
  }

  private mapRowToWishlistItem(row: any): WishlistItem {
    return {
      id: String(row.id),
      customerId: row.customer_id,
      productId: row.product_id,
      variantId: row.variant_id || undefined,
      createdAt: row.created_at
    };
  }
}
