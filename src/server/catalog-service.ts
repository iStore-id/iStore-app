import { SupabaseCatalogRepository } from "./supabase/catalog-repository.js";
import { supabaseAdmin } from "./supabase-admin.js";
import { Game, Category, Product, ProductVariant, ProviderMapping, CatalogStatus, AvailabilityStatus, PricingMethod } from "../types/core.js";
import { PricingService } from "./pricing-service.js";
import { v4 as uuidv4 } from "uuid";

const pricingService = PricingService.getInstance();
const catalogRepo = SupabaseCatalogRepository.getInstance();

export class CatalogService {
  private static instance: CatalogService;

  private constructor() {}

  public static getInstance(): CatalogService {
    if (!CatalogService.instance) {
      CatalogService.instance = new CatalogService();
    }
    return CatalogService.instance;
  }

  // ===================
  // GAME MANAGEMENT
  // ===================

  async createGame(data: Partial<Game>, userId: string): Promise<Game> {
    // Check slug uniqueness
    if (data.slug) {
      const existing = await catalogRepo.getGameBySlug(data.slug);
      if (existing) {
        throw new Error(`Game with slug '${data.slug}' already exists`);
      }
    }

    const gameId = data.id || uuidv4();
    const game: Game = {
      id: gameId,
      name: data.name || "",
      slug: data.slug || "",
      description: data.description || "",
      image: data.image || "",
      icon: data.icon || "",
      categoryIds: data.categoryIds || [],
      labels: data.labels || [],
      status: data.status || "inactive",
      availability: data.availability || "available",
      sortOrder: data.sortOrder ?? 0,
      searchKeywords: data.searchKeywords || [],
      metadata: data.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId,
      updatedBy: userId,
      ...data,
    };

    await catalogRepo.upsertGame(game as any);
    return game;
  }

  async updateGame(id: string, data: Partial<Game>, userId: string): Promise<void> {
    const game = await catalogRepo.getGame(id);
    if (!game) throw new Error("Game not found");

    if (data.slug && data.slug !== game.slug) {
      const existing = await catalogRepo.getGameBySlug(data.slug);
      if (existing) throw new Error(`Game with slug '${data.slug}' already exists`);
    }

    await catalogRepo.upsertGame({
      ...game,
      ...data,
      id,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    } as any);
  }

  // ===================
  // CATEGORY MANAGEMENT
  // ===================

  async createCategory(data: Partial<Category>, userId: string): Promise<Category> {
    if (data.slug) {
      const existing = await catalogRepo.getCategoryBySlug(data.slug);
      if (existing) throw new Error(`Category with slug '${data.slug}' already exists`);
    }

    const categoryId = data.id || uuidv4();
    const category: Category = {
      id: categoryId,
      name: data.name || "",
      slug: data.slug || "",
      description: data.description || "",
      icon: data.icon || "",
      status: data.status || "inactive",
      sortOrder: data.sortOrder ?? 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId,
      updatedBy: userId,
      ...data,
    };

    await catalogRepo.upsertCategory(category as any);
    return category;
  }

  async updateCategory(id: string, data: Partial<Category>, userId: string): Promise<void> {
    const cat = await catalogRepo.getCategory(id);
    if (!cat) throw new Error("Category not found");

    if (data.slug && data.slug !== cat.slug) {
      const existing = await catalogRepo.getCategoryBySlug(data.slug);
      if (existing) throw new Error(`Category with slug '${data.slug}' already exists`);
    }

    await catalogRepo.upsertCategory({
      ...cat,
      ...data,
      id,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    } as any);
  }

  async deleteGame(id: string, userId: string): Promise<void> {
    const doc = await catalogRepo.getGame(id);
    if (!doc) throw new Error("Game not found");
    await catalogRepo.deleteGame(id);
  }

  async deleteCategory(id: string, userId: string): Promise<void> {
    const doc = await catalogRepo.getCategory(id);
    if (!doc) throw new Error("Category not found");
    await catalogRepo.deleteCategory(id);
  }

  async bulkImportSkus(gameId: string, providerSkuIds: string[], actor: { uid: string, email: string }): Promise<any[]> {
    // 1. Fetch Provider SKUs
    const { data: skus } = await supabaseAdmin!
      .from("provider_skus")
      .select("*, providers(*)")
      .in("id", providerSkuIds);

    if (!skus || skus.length === 0) {
      throw new Error("Data Provider SKUs tidak ditemukan.");
    }

    const results: any[] = [];
    const gameCache = new Map<string, string>(); // slug -> gameId
    const categoryCache = new Map<string, string>(); // slug -> categoryId

    // Helper to resolve category deterministically with safety rules
    const resolveCategorySlug = (skuItem: any): string | null => {
      const catMeta = (skuItem.metadata?.category || "").toString().toLowerCase();
      const typeMeta = (skuItem.metadata?.type || "").toString().toLowerCase();
      const nameLower = (skuItem.name || "").toString().toLowerCase();

      if ((catMeta.includes("pln") || typeMeta.includes("pln") || nameLower.includes("pln")) && (nameLower.includes("pascabayar") || nameLower.includes("token") || nameLower.includes("listrik"))) {
        return "token-listrik";
      }

      // Category Safety: ensure PLN/PPOB never mixes with games
      if (catMeta.includes("pln") || typeMeta.includes("pln") || nameLower.includes("token pln") || nameLower.includes("tagihan pln")) {
        return "token-listrik";
      }
      if (catMeta.includes("pulsa") || typeMeta.includes("pulsa") || nameLower.includes("pulsa reguler")) {
        return "pulsa";
      }
      if (catMeta.includes("voucher data") || typeMeta.includes("voucher data") || nameLower.includes("voucher data")) {
        return "voucher-data";
      }
      if (catMeta.includes("data") || typeMeta.includes("data") || nameLower.includes("paket data") || nameLower.includes("internet")) {
        return "paket-data";
      }
      if (catMeta.includes("e-money") || typeMeta.includes("emoney") || nameLower.includes("dana") || nameLower.includes("ovo") || nameLower.includes("gopay") || nameLower.includes("shopee") || nameLower.includes("wallet")) {
        return "e-money";
      }
      if (catMeta.includes("tv") || nameLower.includes("tv kabel")) {
        return "tv";
      }
      if (catMeta.includes("e-toll") || nameLower.includes("etoll") || nameLower.includes("toll") || nameLower.includes("e-toll")) {
        return "e-toll";
      }
      if (catMeta.includes("hiburan") || catMeta.includes("entertainment") || nameLower.includes("spotify") || nameLower.includes("netflix") || nameLower.includes("vidio") || nameLower.includes("wetv")) {
        return "hiburan";
      }
      if (catMeta.includes("telpon") || catMeta.includes("sms") || nameLower.includes("telpon") || nameLower.includes("sms")) {
        return "telpon-sms";
      }
      if (catMeta.includes("voucher") || typeMeta.includes("voucher")) {
        return "voucher";
      }
      if (catMeta.includes("game") || typeMeta.includes("game") || catMeta.includes("topup") || catMeta.includes("top-up")) {
        return "top-up";
      }
      
      // Default for unmatched
      return null;
    };

    // Helper to resolve brand image using existing infrastructure / fallback
    const resolveGameImage = (skuItem: any, brandName: string): string => {
      if (skuItem.image) return skuItem.image;
      if (skuItem.metadata?.icon) return skuItem.metadata.icon;
      if (skuItem.metadata?.image) return skuItem.metadata.image;
      
      const supplierLogo = skuItem.metadata?.logo;
      if (supplierLogo && typeof supplierLogo === 'string') {
        const trimmed = supplierLogo.trim();
        if (trimmed && trimmed !== '-' && trimmed !== 'null' && trimmed.startsWith('http')) {
          return trimmed;
        }
      }

      // Deterministic fallback image based on brand name or clean default gaming placeholder
      const cleanBrand = brandName.toLowerCase();
      if (cleanBrand.includes("free fire")) {
        return "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800&auto=format&fit=crop";
      }
      if (cleanBrand.includes("mobile legends") || cleanBrand.includes("mlbb")) {
        return "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=800&auto=format&fit=crop";
      }
      if (cleanBrand.includes("pubg")) {
        return "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=800&auto=format&fit=crop";
      }
      // General gaming fallback
      return "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop";
    };

    for (const sku of skus) {
      try {
        // Identify target game based on brand_name
        const brandName = sku.metadata?.brand || sku.metadata?.operator || "Other";
        let targetGameId = gameId;

        // Determine category slug safely
        const targetCategorySlug = resolveCategorySlug(sku);
        let targetCategoryId: string | null = null;
        
        if (targetCategorySlug) {
          targetCategoryId = categoryCache.get(targetCategorySlug) || null;
          if (!targetCategoryId) {
            const catObj = await catalogRepo.getCategoryBySlug(targetCategorySlug);
            if (catObj) {
              targetCategoryId = catObj.id;
              categoryCache.set(targetCategorySlug, targetCategoryId);
            }
          }
        }

        if (brandName && brandName !== "Other") {
          // Robust slugification utility
          const brandSlug = brandName
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_]+/g, '-')
            .replace(/^-+|-+$/g, '');

          if (gameCache.has(brandSlug)) {
            targetGameId = gameCache.get(brandSlug)!;
          } else {
            const existingGame = await catalogRepo.getGameBySlug(brandSlug);
            if (existingGame) {
              targetGameId = existingGame.id;
              gameCache.set(brandSlug, targetGameId);
              
              let needsUpdate = false;
              const updatePayload: any = { ...existingGame };

              // Ensure category association if missing, or update if targetCategoryId differs from existing category
              if (targetCategoryId) {
                const currentCatId = existingGame.categoryIds?.[0];
                if (!existingGame.categoryIds || existingGame.categoryIds.length === 0) {
                  updatePayload.categoryIds = [targetCategoryId];
                  needsUpdate = true;
                } else if (currentCatId !== targetCategoryId) {
                  updatePayload.categoryIds = [targetCategoryId];
                  needsUpdate = true;
                }
              }

              // Update image/icon if they are fallbacks and a valid supplier logo is available
              const resolvedImage = resolveGameImage(sku, brandName);
              const isFallbackImage = (img?: string) => !img || img.includes("unsplash.com") || img.includes("placehold.co") || img === '-';
              
              if (resolvedImage && !isFallbackImage(resolvedImage)) {
                if (isFallbackImage(existingGame.image)) {
                  updatePayload.image = resolvedImage;
                  needsUpdate = true;
                }
                if (isFallbackImage(existingGame.icon)) {
                  updatePayload.icon = resolvedImage;
                  needsUpdate = true;
                }
              }

              if (needsUpdate) {
                updatePayload.updatedAt = new Date().toISOString();
                await catalogRepo.upsertGame(updatePayload);
              }
            } else {
              // Create Game automatically if it doesn't exist
              const newGameId = uuidv4();
              const resolvedImage = resolveGameImage(sku, brandName);

              await catalogRepo.upsertGame({
                id: newGameId,
                name: brandName,
                slug: brandSlug,
                image: resolvedImage,
                icon: resolvedImage,
                categoryIds: targetCategoryId ? [targetCategoryId] : [],
                status: "active",
                availability: "available"
              });
              
              targetGameId = newGameId;
              gameCache.set(brandSlug, targetGameId);
            }
          }
        }

        const skuCost = typeof sku.metadata?.price === 'number' ? sku.metadata.price : (typeof sku.metadata?.baseCost === 'number' ? sku.metadata.baseCost : 0);

        const importResult = await catalogRepo.importCatalogSku({
          gameId: targetGameId,
          providerId: sku.provider_id,
          providerSkuId: sku.id,
          providerSkuCode: sku.sku_code || sku.provider_sku,
          skuName: sku.name,
          brandName: brandName,
          cost: skuCost,
          type: sku.metadata?.type || "game_currency",
          userId: actor.uid
        });

        if (importResult.success) {
          // Trigger Pricing Refresh (Atomic business decision using existing PricingService)
          await pricingService.refreshVariantPrice(importResult.variantId, actor);
          
          // Verify and Activate (Check if pricing is valid/active)
          const { data: updatedVariant } = await supabaseAdmin!
            .from("product_variants")
            .select("metadata, status")
            .eq("id", importResult.variantId)
            .maybeSingle();
            
          if (updatedVariant && updatedVariant.metadata?.pricing_status === 'active' && updatedVariant.status === 'inactive') {
            await supabaseAdmin!
              .from("product_variants")
              .update({ status: 'active' })
              .eq("id", importResult.variantId);
          }
          
          results.push({
            skuId: sku.id,
            success: true,
            productId: importResult.productId,
            variantId: importResult.variantId,
            mappingId: importResult.mappingId,
            gameId: targetGameId
          });
        } else {
          results.push({
            skuId: sku.id,
            success: false,
            message: importResult.message
          });
        }
      } catch (err: any) {
        results.push({
          skuId: sku.id,
          success: false,
          message: err.message
        });
      }
    }

    return results;
  }

  // ===================
  // PRODUCT MANAGEMENT
  // ===================

  async createProduct(data: Partial<Product>, userId: string): Promise<Product> {
    if (data.slug) {
      const existing = await catalogRepo.getProductBySlug(data.slug);
      if (existing) throw new Error(`Product with slug '${data.slug}' already exists`);
    }

    const productId = data.id || uuidv4();
    const product: Product = {
      id: productId,
      gameId: data.gameId || "",
      categoryIds: data.categoryIds || [],
      name: data.name || "",
      slug: data.slug || "",
      description: data.description || "",
      type: data.type || "other",
      image: data.image || "",
      status: data.status || "inactive",
      availability: data.availability || "available",
      sortOrder: data.sortOrder ?? 0,
      searchKeywords: data.searchKeywords || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId,
      updatedBy: userId,
      ...data,
    };

    await catalogRepo.upsertProduct(product as any);
    return product;
  }

  async updateProduct(id: string, data: Partial<Product>, userId: string): Promise<void> {
    const prod = await catalogRepo.getProduct(id);
    if (!prod) throw new Error("Product not found");

    if (data.slug && data.slug !== prod.slug) {
      const existing = await catalogRepo.getProductBySlug(data.slug);
      if (existing) throw new Error(`Product with slug '${data.slug}' already exists`);
    }

    await catalogRepo.upsertProduct({
      ...prod,
      ...data,
      id,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    } as any);
  }

  // ===================
  // VARIANT MANAGEMENT
  // ===================

  async createVariant(data: Partial<ProductVariant>, userId: string): Promise<ProductVariant> {
    // SKU Uniqueness
    if (data.sku) {
      const existing = await catalogRepo.getVariantBySku(data.sku);
      if (existing) throw new Error(`SKU '${data.sku}' already exists`);
    }

    const variantId = data.id || uuidv4();
    
    const baseCost = data.pricing?.baseCost ?? 0;
    const method = data.pricing?.pricingMethod || 'fixed';
    const value = data.pricing?.sellingPrice ?? 0;

    const calculation = pricingService.calculatePrice(baseCost, method, value);

    const inputPricing: any = data.pricing || {};
    const finalBaseCost = inputPricing.baseCost !== undefined ? inputPricing.baseCost : baseCost;
    const finalMethod = (inputPricing.pricingMethod || method) as PricingMethod;
    const finalValue = inputPricing.sellingPrice !== undefined ? inputPricing.sellingPrice : value;
    const finalCalculation = pricingService.calculatePrice(finalBaseCost, finalMethod, finalValue);

    const variant: ProductVariant = {
      id: variantId,
      productId: data.productId || "",
      name: data.name || "",
      displayName: data.displayName || data.name || "",
      sku: data.sku || "",
      status: data.status || "inactive",
      availability: data.availability || "available",
      sortOrder: data.sortOrder ?? 0,
      ...data,
      pricing: {
        baseCost: finalBaseCost,
        currency: inputPricing.currency || "IDR",
        pricingMethod: finalMethod,
        status: finalCalculation.status,
        lastPriceUpdate: new Date().toISOString(),
        lastCostUpdate: new Date().toISOString(),
        ...inputPricing,
        sellingPrice: finalCalculation.sellingPrice,
        margin: finalCalculation.margin,
        marginPercentage: finalCalculation.marginPercentage,
      },
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: data.createdBy || userId,
      updatedBy: userId,
    };

    await catalogRepo.upsertVariant(variant as any);
    
    // Log History
    await pricingService.logPriceHistory(variantId, { pricing: {} }, variant, { uid: userId, email: "" }, "Initial creation");
    
    return variant;
  }

  async updateVariant(id: string, data: Partial<ProductVariant>, userId: string): Promise<void> {
    const existingVariant = await catalogRepo.getVariant(id);
    if (!existingVariant) throw new Error("Variant not found");

    if (data.sku && data.sku !== existingVariant.sku) {
      const existing = await catalogRepo.getVariantBySku(data.sku!);
      if (existing) throw new Error(`SKU '${data.sku}' already exists`);
    }

    const currentPricing = existingVariant.pricing || {} as any;
    const updatedPricingInput = data.pricing || {} as any;
    
    const baseCost = updatedPricingInput.baseCost !== undefined ? updatedPricingInput.baseCost : (currentPricing.baseCost || 0);
    const method = (updatedPricingInput.pricingMethod || currentPricing.pricingMethod || 'fixed') as PricingMethod;
    const value = updatedPricingInput.sellingPrice !== undefined ? updatedPricingInput.sellingPrice : (currentPricing.sellingPrice || 0);

    const calculation = pricingService.calculatePrice(baseCost, method, value);

    const newPricing = {
      ...currentPricing,
      ...updatedPricingInput,
      sellingPrice: calculation.sellingPrice,
      margin: calculation.margin,
      marginPercentage: calculation.marginPercentage,
      status: calculation.status,
      lastPriceUpdate: (updatedPricingInput.sellingPrice !== undefined || updatedPricingInput.pricingMethod !== undefined) ? new Date().toISOString() : (currentPricing.lastPriceUpdate || new Date().toISOString()),
      lastCostUpdate: updatedPricingInput.baseCost !== undefined ? new Date().toISOString() : (currentPricing.lastCostUpdate || new Date().toISOString())
    };

    const updates = {
      ...existingVariant,
      ...data,
      id,
      pricing: newPricing,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };

    await catalogRepo.upsertVariant(updates as any);
    
    // Log History if price or cost changed
    if (currentPricing.sellingPrice !== newPricing.sellingPrice || currentPricing.baseCost !== newPricing.baseCost) {
      await pricingService.logPriceHistory(id, existingVariant, { pricing: newPricing }, { uid: userId, email: "" }, "Admin Update");
    }
  }

  // ===================
  // PUBLIC FETCHERS (Sanitized)
  // ===================

  async getPublicGames(): Promise<any[]> {
    return catalogRepo.listGames(true);
  }

  async getPublicGameBySlug(slug: string): Promise<any | null> {
    return catalogRepo.getGameBySlug(slug);
  }

  async getPublicProductsByGameId(gameId: string): Promise<any[]> {
    return catalogRepo.listProductsByGame(gameId, true);
  }

  async getPublicVariantsByProductId(productId: string): Promise<any[]> {
    const variants = await catalogRepo.listVariantsByProduct(productId, true);
    return variants.map(v => ({
      ...v,
      sellingPrice: v.pricing?.sellingPrice || 0
    }));
  }

  async getPublicCategories(): Promise<any[]> {
    return catalogRepo.listCategories(true);
  }

  // ===================
  // ADMIN FETCHERS
  // ===================

  async listGames(): Promise<Game[]> {
    return catalogRepo.listGames(false);
  }

  async listCategories(): Promise<Category[]> {
    return catalogRepo.listCategories(false);
  }

  async listProducts(gameId?: string): Promise<Product[]> {
    return catalogRepo.listProducts(gameId);
  }

  async listVariants(productId?: string): Promise<ProductVariant[]> {
    return catalogRepo.listVariants(productId);
  }

  async getProductResetPreview(productId: string): Promise<{
    productName: string;
    variantCount: number;
    mappingCount: number;
    hasTransactions: boolean;
    linkedOrders: string[];
  }> {
    const prod = await catalogRepo.getProduct(productId);
    if (!prod) throw new Error("Product not found");

    const variants = await catalogRepo.listVariants(productId);
    const variantIds = variants.map(v => v.id);

    // Count mappings
    let mappingCount = 0;
    if (variantIds.length > 0) {
      const { data: mappings, error: mappingErr } = await supabaseAdmin!
        .from("provider_mappings")
        .select("id")
        .in("variant_id", variantIds);
      if (!mappingErr && mappings) {
        mappingCount = mappings.length;
      }
    }

    // Check transactions (orders)
    let linkedOrders: string[] = [];
    
    // First construct query checking if orders exist with product_id or variant_ids
    let query = supabaseAdmin!.from("orders").select("invoice");
    if (variantIds.length > 0) {
      query = query.or(`product_id.eq.${productId},variant_id.in.(${variantIds.join(",")})`);
    } else {
      query = query.eq("product_id", productId);
    }
    
    const { data: orders, error: orderErr } = await query.limit(5);

    if (!orderErr && orders && orders.length > 0) {
      linkedOrders = orders.map(o => o.invoice);
    }

    return {
      productName: prod.name,
      variantCount: variants.length,
      mappingCount,
      hasTransactions: linkedOrders.length > 0,
      linkedOrders
    };
  }

  async resetProductAndMapping(productId: string, userId: string): Promise<{ deletedVariantCount: number, deletedMappingCount: number, productName: string, gameId: string }> {
    const preview = await this.getProductResetPreview(productId);
    if (preview.hasTransactions) {
      throw new Error(`Cannot reset product because it has active order transactions (Invoices: ${preview.linkedOrders.join(", ")}). Deleting this product would break transaction history.`);
    }

    const prod = await catalogRepo.getProduct(productId);
    if (!prod) throw new Error("Product not found");
    
    const variants = await catalogRepo.listVariants(productId);
    const variantIds = variants.map(v => v.id);

    // 1. Delete mappings first
    if (variantIds.length > 0) {
      const { error: mapDelErr } = await supabaseAdmin!
        .from("provider_mappings")
        .delete()
        .in("variant_id", variantIds);
      if (mapDelErr) {
        throw new Error(`Failed to delete provider mappings: ${mapDelErr.message}`);
      }
    }

    // 2. Delete variants
    if (variantIds.length > 0) {
      const { error: varDelErr } = await supabaseAdmin!
        .from("product_variants")
        .delete()
        .in("id", variantIds);
      if (varDelErr) {
        throw new Error(`Failed to delete product variants: ${varDelErr.message}`);
      }
    }

    // 3. Delete the product
    await catalogRepo.deleteProduct(productId);

    return {
      deletedVariantCount: preview.variantCount,
      deletedMappingCount: preview.mappingCount,
      productName: prod.name,
      gameId: prod.gameId
    };
  }
}
