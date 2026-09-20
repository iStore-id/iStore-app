import { supabaseAdmin, isSupabaseAdminConfigured } from "../supabase-admin.js";
import { Game, Category, Product, ProductVariant, CatalogStatus, AvailabilityStatus, PricingMethod } from "../../types/core";

export class SupabaseCatalogRepository {
  private static instance: SupabaseCatalogRepository;

  private constructor() {}

  public static getInstance(): SupabaseCatalogRepository {
    if (!SupabaseCatalogRepository.instance) {
      SupabaseCatalogRepository.instance = new SupabaseCatalogRepository();
    }
    return SupabaseCatalogRepository.instance;
  }

  private ensureClient() {
    if (!supabaseAdmin || !isSupabaseAdminConfigured) {
      throw new Error("Supabase Admin is not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    }
    return supabaseAdmin;
  }

  // ==========================================
  // CATEGORIES
  // ==========================================

  async getCategory(id: string): Promise<Category | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("categories")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Supabase getCategory error: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description || "",
      icon: data.icon || "",
      image: data.image || "",
      status: data.status,
      sortOrder: data.sort_order,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      createdBy: "system",
      updatedBy: "system",
    };
  }

  async listCategories(onlyActive = true): Promise<Category[]> {
    const client = this.ensureClient();
    let query = client.from("categories").select("*").order("sort_order", { ascending: true });

    if (onlyActive) {
      query = query.eq("status", "active");
    }

    const { data, error } = await query;
    if (error) throw new Error(`Supabase listCategories error: ${error.message}`);

    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description || "",
      icon: row.icon || "",
      image: row.image || "",
      status: row.status,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: "system",
      updatedBy: "system",
    }));
  }

  async upsertCategory(cat: Partial<Category> & { id: string; name: string; slug: string }): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.from("categories").upsert({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description || null,
      icon: cat.icon || null,
      image: cat.image || null,
      sort_order: cat.sortOrder ?? 0,
      status: cat.status || "active",
      updated_at: new Date().toISOString(),
    });

    if (error) throw new Error(`Supabase upsertCategory error: ${error.message}`);
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("categories")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw new Error(`Supabase getCategoryBySlug error: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description || "",
      icon: data.icon || "",
      image: data.image || "",
      status: data.status,
      sortOrder: data.sort_order,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      createdBy: "system",
      updatedBy: "system",
    };
  }

  // ==========================================
  // GAMES
  // ==========================================

  async getGame(id: string): Promise<Game | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("games")
      .select(`
        *,
        game_categories(category_id)
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Supabase getGame error: ${error.message}`);
    if (!data) return null;

    const categoryIds = (data.game_categories || []).map((gc: any) => gc.category_id);

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description || "",
      image: data.image,
      icon: data.icon || "",
      categoryIds,
      labels: [],
      status: data.status as CatalogStatus,
      availability: data.availability as AvailabilityStatus,
      sortOrder: data.sort_order,
      searchKeywords: data.search_keywords || [],
      metadata: data.metadata || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      createdBy: "system",
      updatedBy: "system",
    };
  }

  async getGameBySlug(slug: string): Promise<Game | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("games")
      .select(`
        *,
        game_categories(category_id)
      `)
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw new Error(`Supabase getGameBySlug error: ${error.message}`);
    if (!data) return null;

    const categoryIds = (data.game_categories || []).map((gc: any) => gc.category_id);

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description || "",
      image: data.image,
      icon: data.icon || "",
      categoryIds,
      labels: [],
      status: data.status as CatalogStatus,
      availability: data.availability as AvailabilityStatus,
      sortOrder: data.sort_order,
      searchKeywords: data.search_keywords || [],
      metadata: data.metadata || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      createdBy: "system",
      updatedBy: "system",
    };
  }

  async listGames(onlyActive = true): Promise<Game[]> {
    const client = this.ensureClient();
    let query = client
      .from("games")
      .select(`
        *,
        game_categories(category_id),
        products!game_id(
          id,
          type,
          product_variants(selling_price, status)
        )
      `)
      .order("sort_order", { ascending: true });

    if (onlyActive) {
      query = query.eq("status", "active");
    }

    const { data, error } = await query;
    if (error) throw new Error(`Supabase listGames error: ${error.message}`);

    return (data || []).map((row: any) => {
      const categoryIds = (row.game_categories || []).map((gc: any) => gc.category_id);
      
      const products = row.products || [];

      const activeVariants = products.flatMap((p: any) => (p.product_variants || []).filter((v: any) => v.status === "active"));
      const prices = activeVariants.map((v: any) => v.selling_price || 0);

      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description || "",
        image: row.image,
        icon: row.icon || "",
        categoryIds,
        labels: [],
        status: row.status as CatalogStatus,
        availability: row.availability as AvailabilityStatus,
        sortOrder: row.sort_order,
        searchKeywords: row.search_keywords || [],
        metadata: row.metadata || {},
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: "system",
        updatedBy: "system",
        productCount: products.length,
        variantCount: activeVariants.length,
        minPrice: prices.length > 0 ? Math.min(...prices) : 0,
        maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
      };
    });
  }

  async upsertGame(game: Partial<Game> & { id: string; name: string; slug: string; image: string }): Promise<void> {
    const client = this.ensureClient();
    const { error: gameError } = await client.from("games").upsert({
      id: game.id,
      name: game.name,
      slug: game.slug,
      description: game.description || null,
      image: game.image,
      icon: game.icon || null,
      status: game.status || "active",
      availability: game.availability || "available",
      sort_order: game.sortOrder ?? 0,
      search_keywords: game.searchKeywords || [],
      metadata: game.metadata || {},
      updated_at: new Date().toISOString(),
    });

    if (gameError) throw new Error(`Supabase upsertGame error: ${gameError.message}`);

    // Update game_categories pivot if categoryIds provided
    if (Array.isArray(game.categoryIds)) {
      // Remove old pivots
      await client.from("game_categories").delete().eq("game_id", game.id);
      
      if (game.categoryIds.length > 0) {
        const pivotRows = game.categoryIds.map(catId => ({
          game_id: game.id,
          category_id: catId,
        }));
        const { error: pivotError } = await client.from("game_categories").insert(pivotRows);
        if (pivotError) {
          console.warn(`[Supabase Catalog] Warning inserting game_categories: ${pivotError.message}`);
        }
      }
    }
  }

  // ==========================================
  // PRODUCTS
  // ==========================================

  async getProduct(id: string): Promise<Product | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Supabase getProduct error: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      gameId: data.game_id,
      categoryIds: [],
      name: data.name,
      slug: data.slug,
      description: data.description || "",
      type: data.type as any,
      image: data.image || "",
      status: data.status as CatalogStatus,
      availability: data.availability as AvailabilityStatus,
      sortOrder: data.sort_order,
      searchKeywords: data.search_keywords || [],
      metadata: data.metadata || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      createdBy: "system",
      updatedBy: "system",
    };
  }

  async listProductsByGame(gameId: string, onlyActive = true): Promise<Product[]> {
    const client = this.ensureClient();
    let query = client
      .from("products")
      .select("*")
      .eq("game_id", gameId)
      .order("sort_order", { ascending: true });

    if (onlyActive) {
      query = query.eq("status", "active");
    }

    const { data, error } = await query;
    if (error) throw new Error(`Supabase listProductsByGame error: ${error.message}`);

    return (data || []).map((row: any) => ({
      id: row.id,
      gameId: row.game_id,
      categoryIds: [],
      name: row.name,
      slug: row.slug,
      description: row.description || "",
      type: row.type as any,
      image: row.image || "",
      status: row.status as CatalogStatus,
      availability: row.availability as AvailabilityStatus,
      sortOrder: row.sort_order,
      searchKeywords: row.search_keywords || [],
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: "system",
      updatedBy: "system",
    }));
  }

  async listProducts(gameId?: string): Promise<Product[]> {
    const client = this.ensureClient();
    let query = client.from("products").select("*");
    
    if (gameId) {
      query = query.eq("game_id", gameId);
    }
    
    const { data, error } = await query;
    if (error) throw new Error(`Supabase listProducts error: ${error.message}`);
    return (data || []).map((row: any) => ({
      id: row.id,
      gameId: row.game_id,
      categoryIds: [],
      name: row.name,
      slug: row.slug,
      description: row.description || "",
      type: row.type as any,
      image: row.image || "",
      status: row.status as CatalogStatus,
      availability: row.availability as AvailabilityStatus,
      sortOrder: row.sort_order,
      searchKeywords: row.search_keywords || [],
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: "system",
      updatedBy: "system",
    }));
  }

  async upsertProduct(product: Partial<Product> & { id: string; gameId: string; name: string; slug: string }): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.from("products").upsert({
      id: product.id,
      game_id: product.gameId,
      name: product.name,
      slug: product.slug,
      description: product.description || null,
      type: product.type || "game_currency",
      image: product.image || null,
      status: product.status || "active",
      availability: product.availability || "available",
      sort_order: product.sortOrder ?? 0,
      search_keywords: product.searchKeywords || [],
      metadata: product.metadata || {},
      updated_at: new Date().toISOString(),
    });

    if (error) throw new Error(`Supabase upsertProduct error: ${error.message}`);
  }

  async getProductBySlug(slug: string): Promise<Product | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("products")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw new Error(`Supabase getProductBySlug error: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      gameId: data.game_id,
      categoryIds: [],
      name: data.name,
      slug: data.slug,
      description: data.description || "",
      type: data.type as any,
      image: data.image || "",
      status: data.status as CatalogStatus,
      availability: data.availability as AvailabilityStatus,
      sortOrder: data.sort_order,
      searchKeywords: data.search_keywords || [],
      metadata: data.metadata || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      createdBy: "system",
      updatedBy: "system",
    };
  }

  // ==========================================
  // PRODUCT VARIANTS
  // ==========================================

  async getVariant(id: string): Promise<ProductVariant | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("product_variants")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Supabase getVariant error: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      productId: data.product_id,
      name: data.name,
      displayName: data.display_name,
      nominalValue: data.nominal_value ? Number(data.nominal_value) : undefined,
      unit: data.unit || undefined,
      sku: data.sku,
      status: data.status as CatalogStatus,
      availability: data.availability as AvailabilityStatus,
      sortOrder: data.sort_order,
      pricing: {
        baseCost: Number(data.base_cost || 0),
        sellingPrice: Number(data.selling_price || 0),
        currency: data.currency || "IDR",
        margin: Number(data.margin || 0),
        marginPercentage: Number(data.margin_percentage || 0),
        pricingMethod: data.pricing_method as PricingMethod,
        status: "active",
      },
      metadata: data.metadata || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      createdBy: "system",
      updatedBy: "system",
    };
  }

  async listVariantsByProduct(productId: string, onlyActive = true): Promise<ProductVariant[]> {
    const client = this.ensureClient();
    let query = client
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true });

    if (onlyActive) {
      query = query.eq("status", "active");
    }

    const { data, error } = await query;
    if (error) throw new Error(`Supabase listVariantsByProduct error: ${error.message}`);

    return (data || []).map((row: any) => ({
      id: row.id,
      productId: row.product_id,
      name: row.name,
      displayName: row.display_name,
      nominalValue: row.nominal_value ? Number(row.nominal_value) : undefined,
      unit: row.unit || undefined,
      sku: row.sku,
      status: row.status as CatalogStatus,
      availability: row.availability as AvailabilityStatus,
      sortOrder: row.sort_order,
      pricing: {
        baseCost: Number(row.base_cost || 0),
        sellingPrice: Number(row.selling_price || 0),
        currency: row.currency || "IDR",
        margin: Number(row.margin || 0),
        marginPercentage: Number(row.margin_percentage || 0),
        pricingMethod: row.pricing_method as PricingMethod,
        status: "active",
      },
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: "system",
      updatedBy: "system",
    }));
  }

  async listVariants(productId?: string): Promise<ProductVariant[]> {
    const client = this.ensureClient();
    let query = client.from("product_variants").select("*");
    
    if (productId) {
      query = query.eq("product_id", productId);
    }
    
    const { data, error } = await query;
    if (error) throw new Error(`Supabase listVariants error: ${error.message}`);
    return (data || []).map((row: any) => ({
      id: row.id,
      productId: row.product_id,
      name: row.name,
      displayName: row.display_name,
      nominalValue: row.nominal_value ? Number(row.nominal_value) : undefined,
      unit: row.unit || undefined,
      sku: row.sku,
      status: row.status as CatalogStatus,
      availability: row.availability as AvailabilityStatus,
      sortOrder: row.sort_order,
      pricing: {
        baseCost: Number(row.base_cost || 0),
        sellingPrice: Number(row.selling_price || 0),
        currency: row.currency || "IDR",
        margin: Number(row.margin || 0),
        marginPercentage: Number(row.margin_percentage || 0),
        pricingMethod: row.pricing_method as PricingMethod,
        status: "active",
      },
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: "system",
      updatedBy: "system",
    }));
  }

  async upsertVariant(variant: Partial<ProductVariant> & { id: string; productId: string; name: string; displayName: string; sku: string }): Promise<void> {
    const client = this.ensureClient();
    const pricing = variant.pricing || {
      baseCost: 0,
      sellingPrice: 0,
      currency: "IDR",
      margin: 0,
      marginPercentage: 0,
      pricingMethod: "fixed" as PricingMethod,
    };

    const { error } = await client.from("product_variants").upsert({
      id: variant.id,
      product_id: variant.productId,
      name: variant.name,
      display_name: variant.displayName,
      nominal_value: variant.nominalValue ?? 0,
      unit: variant.unit || null,
      sku: variant.sku,
      base_cost: pricing.baseCost ?? 0,
      selling_price: pricing.sellingPrice ?? 0,
      admin_fee: 0,
      currency: pricing.currency || "IDR",
      margin: pricing.margin ?? 0,
      margin_percentage: pricing.marginPercentage ?? 0,
      pricing_method: pricing.pricingMethod || "fixed",
      status: variant.status || "active",
      availability: variant.availability || "available",
      sort_order: variant.sortOrder ?? 0,
      metadata: variant.metadata || {},
      updated_at: new Date().toISOString(),
    });

    if (error) throw new Error(`Supabase upsertVariant error: ${error.message}`);
  }

  async getVariantBySku(sku: string): Promise<ProductVariant | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("product_variants")
      .select("*")
      .eq("sku", sku)
      .maybeSingle();

    if (error) throw new Error(`Supabase getVariantBySku error: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      productId: data.product_id,
      name: data.name,
      displayName: data.display_name,
      nominalValue: data.nominal_value ? Number(data.nominal_value) : undefined,
      unit: data.unit || undefined,
      sku: data.sku,
      status: data.status as CatalogStatus,
      availability: data.availability as AvailabilityStatus,
      sortOrder: data.sort_order,
      pricing: {
        baseCost: Number(data.base_cost || 0),
        sellingPrice: Number(data.selling_price || 0),
        currency: data.currency || "IDR",
        margin: Number(data.margin || 0),
        marginPercentage: Number(data.margin_percentage || 0),
        pricingMethod: data.pricing_method as PricingMethod,
        status: "active",
      },
      metadata: data.metadata || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      createdBy: "system",
      updatedBy: "system",
    };
  }

  async deleteGame(id: string): Promise<void> {
    const client = this.ensureClient();

    // Check product dependency
    const { data: products, error: prodErr } = await client
      .from("products")
      .select("id")
      .eq("game_id", id);

    if (prodErr) {
      throw new Error(`Failed to check game product dependencies: ${prodErr.message}`);
    }

    if (products && products.length > 0) {
      throw new Error("Cannot delete game because it has associated products. Please deactivate or remove products first.");
    }

    // Clean up game_categories pivot associations
    await client.from("game_categories").delete().eq("game_id", id);

    const { error } = await client.from("games").delete().eq("id", id);
    if (error) throw new Error(`Supabase deleteGame error: ${error.message}`);
  }

  async deleteCategory(id: string): Promise<void> {
    const client = this.ensureClient();

    // Check game_categories dependency
    const { data: linkedGames, error: linkErr } = await client
      .from("game_categories")
      .select("game_id")
      .eq("category_id", id);

    if (linkErr) {
      throw new Error(`Failed to check category dependencies: ${linkErr.message}`);
    }

    if (linkedGames && linkedGames.length > 0) {
      throw new Error("Cannot delete category because it is still linked to games. Please unlink the category from games first.");
    }

    const { error } = await client.from("categories").delete().eq("id", id);
    if (error) throw new Error(`Supabase deleteCategory error: ${error.message}`);
  }

  async deleteProduct(id: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.from("products").delete().eq("id", id);
    if (error) throw new Error(`Supabase deleteProduct error: ${error.message}`);
  }

  async deleteVariant(id: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.from("product_variants").delete().eq("id", id);
    if (error) throw new Error(`Supabase deleteVariant error: ${error.message}`);
  }

  async importCatalogSku(params: {
    gameId: string;
    providerId: string;
    providerSkuId: string;
    providerSkuCode: string;
    skuName: string;
    brandName: string;
    cost: number;
    type?: string;
    userId?: string;
  }): Promise<any> {
    const client = this.ensureClient();
    const { data, error } = await client.rpc("import_catalog_sku_v1", {
      p_game_id: params.gameId,
      p_provider_id: params.providerId,
      p_provider_sku_id: params.providerSkuId,
      p_provider_sku_code: params.providerSkuCode,
      p_sku_name: params.skuName,
      p_brand_name: params.brandName,
      p_cost: params.cost,
      p_type: params.type || "game_currency",
      p_user_id: params.userId || null,
    });

    if (error) throw new Error(`Supabase RPC import_catalog_sku_v1 error: ${error.message}`);
    return data;
  }
}
