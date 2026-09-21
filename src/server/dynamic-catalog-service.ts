import { SupabaseCatalogRepository } from "./supabase/catalog-repository.js";
import { supabaseAdmin } from "./supabase-admin.js";
import { Game, Product, ProductVariant, CatalogStatus, AvailabilityStatus } from "../types/core.js";
import slugify from "slugify";
import { PricingService } from "./pricing-service.js";

const catalogRepo = SupabaseCatalogRepository.getInstance();
const pricingService = PricingService.getInstance();

export class DynamicCatalogService {
  private static instance: DynamicCatalogService;
  private mergedGamesCache: { data: Game[]; timestamp: number } | null = null;
  private cacheTtlMs = 45000; // 45 seconds TTL

  private constructor() {}

  public static getInstance(): DynamicCatalogService {
    if (!DynamicCatalogService.instance) {
      DynamicCatalogService.instance = new DynamicCatalogService();
    }
    return DynamicCatalogService.instance;
  }

  public invalidateCache(): void {
    this.mergedGamesCache = null;
  }

  private categoryMap: Record<string, string> = {
    "Topup Game": "15b131f7-ef27-4df4-a788-e8d87fa4a5e6", // TOP UP
    "GAMES": "15b131f7-ef27-4df4-a788-e8d87fa4a5e6",      // TOP UP
    "PLN": "d458112f-9ec0-4508-8072-92f300ecf2bd",        // Token Listrik
    "Token PLN": "d458112f-9ec0-4508-8072-92f300ecf2bd",  // Token Listrik
    "E-Wallet": "934a2b92-2d94-478f-9477-e20c01382383",   // E-Money
    "E-MONEY": "934a2b92-2d94-478f-9477-e20c01382383",    // E-Money
    "Pulsa": "b51b89f8-5dfd-4411-a66c-e2cbaa55f401",      // PULSA
    "PULSA": "b51b89f8-5dfd-4411-a66c-e2cbaa55f401",      // PULSA
    "Data": "dccd2fa4-51bc-49a4-9cba-5aef7ea51b92",       // Paket Data
    "PAKET DATA": "dccd2fa4-51bc-49a4-9cba-5aef7ea51b92", // Paket Data
    "Voucher Data": "800a75d1-6e35-4755-aeba-4f5f72dcdbfb", // Voucher Data
    "VOUCHER DATA": "800a75d1-6e35-4755-aeba-4f5f72dcdbfb", // Voucher Data
    "Voucher": "35d65b30-7c0c-40f0-9314-2362f3117419",    // VOUCHER
    "VOUCHER": "35d65b30-7c0c-40f0-9314-2362f3117419",    // VOUCHER
    "Voucher Game": "35d65b30-7c0c-40f0-9314-2362f3117419", // VOUCHER
    "GAME": "15b131f7-ef27-4df4-a788-e8d87fa4a5e6",       // TOP UP
  };

  private getCategoryId(providerCategory: string, meta?: any, skuName?: string): string | null {
    const context = `${providerCategory || ""} ${meta?.operator || ""} ${meta?.type || ""} ${meta?.brand || ""} ${skuName || ""}`.toLowerCase();
    
    // Specific detection for Telpon & SMS
    if (context.includes("telpon") || context.includes("sms") || context.includes("telepon") || context.includes("voice")) {
      // Exclude data and transfer to avoid misclassification
      if (!context.includes("data") && !context.includes("internet") && !context.includes("transfer")) {
        return "513dde75-1122-4689-9323-06fa815c4f89"; // Telpon & SMS
      }
    }

    if (context.includes("pln") && (context.includes("pascabayar") || context.includes("token") || context.includes("listrik"))) {
      return "d458112f-9ec0-4508-8072-92f300ecf2bd"; // Token Listrik
    }

    if (!providerCategory) return null;
    const cat = providerCategory.trim();
    const upperCat = cat.toUpperCase();

    // Specific check for generic supplier label "DIGITAL" to prevent misclassifying non-e-money
    if (upperCat === "DIGITAL") {
      const context = `${meta?.operator || ""} ${meta?.type || ""} ${meta?.brand || ""} ${skuName || ""}`.toLowerCase();
      if (context.includes("dana") || context.includes("ovo") || context.includes("gopay") || context.includes("shopee") || context.includes("linkaja") || context.includes("wallet") || context.includes("emoney") || context.includes("e-money")) {
        return "934a2b92-2d94-478f-9477-e20c01382383"; // E-Money
      }
      if (context.includes("voucher data")) {
        return "800a75d1-6e35-4755-aeba-4f5f72dcdbfb"; // Voucher Data
      }
      if (context.includes("data") || context.includes("internet") || context.includes("kuota")) {
        return "dccd2fa4-51bc-49a4-9cba-5aef7ea51b92"; // Paket Data
      }
      if (context.includes("pulsa")) {
        return "b51b89f8-5dfd-4411-a66c-e2cbaa55f401"; // PULSA
      }
      if (context.includes("pln") || context.includes("listrik")) {
        return "d458112f-9ec0-4508-8072-92f300ecf2bd"; // Token Listrik
      }
      if (context.includes("voucher")) {
        return "35d65b30-7c0c-40f0-9314-2362f3117419"; // VOUCHER
      }
      if (context.includes("game") || context.includes("diamond") || context.includes("free fire") || context.includes("mobile legend")) {
        return "15b131f7-ef27-4df4-a788-e8d87fa4a5e6"; // TOP UP
      }
      // Ambiguous digital item without explicit e-money indicators: do NOT misclassify as e-money
      return null;
    }

    return this.categoryMap[cat] || this.categoryMap[upperCat] || null;
  }

  isVirtualProduct(id: string): boolean {
    return id.startsWith("virtual-product-");
  }

  isVirtualVariant(id: string): boolean {
    return id.startsWith("virtual-variant-");
  }

  getProviderSkuIdFromVirtual(id: string): string {
    return id.replace("virtual-variant-", "");
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private getOperator(sku: any): string {
    const meta = sku.metadata?.originalData?.metadata || sku.metadata;
    return meta?.operator || sku.name.split(" ")[0];
  }

  private getCost(sku: any): number {
    const metadata = sku.metadata || {};
    const originalData = metadata.originalData || {};
    
    // Check various common locations for cost in metadata
    const cost = metadata.baseCost ?? 
                 originalData.baseCost ?? 
                 metadata.cost ?? 
                 originalData.cost ??
                 originalData.metadata?.baseCost ??
                 0;
    
    return parseFloat(cost as string) || 0;
  }

  async getProduct(id: string): Promise<Product | null> {
    if (this.isVirtualProduct(id)) {
      const slug = id.replace("virtual-product-", "");
      const res = await this.getMergedGameDetail(slug);
      return res?.products[0] || null;
    }
    return catalogRepo.getProduct(id);
  }

  async getVariant(id: string): Promise<ProductVariant | null> {
    if (this.isVirtualVariant(id)) {
      const skuId = this.getProviderSkuIdFromVirtual(id);
      const { data: sku } = await supabaseAdmin!
        .from("provider_skus")
        .select("*")
        .eq("id", skuId)
        .maybeSingle();

      if (!sku) return null;

      const operator = this.getOperator(sku);
      const gameSlug = this.generateSlug(operator);

      const baseCost = this.getCost(sku);
      
      const skeletonVariant: ProductVariant = {
        id,
        productId: `virtual-product-${gameSlug}`,
        name: sku.name,
        displayName: sku.name,
        sku: sku.provider_sku,
        status: "active",
        availability: "available",
        sortOrder: 0,
        pricing: {
          baseCost,
          sellingPrice: 0,
          currency: "IDR",
          margin: 0,
          marginPercentage: 0,
          pricingMethod: "markup_fixed",
          status: "active"
        },
        createdAt: sku.created_at,
        updatedAt: sku.updated_at,
        createdBy: "system",
        updatedBy: "system"
      };

      const { finalPrice, ruleId } = await pricingService.resolveEffectivePrice(skeletonVariant);

      return {
        ...skeletonVariant,
        pricing: {
          ...skeletonVariant.pricing,
          sellingPrice: finalPrice,
          margin: finalPrice - baseCost,
          marginPercentage: finalPrice > 0 ? ((finalPrice - baseCost) / finalPrice) * 100 : 0,
          appliedRuleId: ruleId
        }
      };
    }
    return catalogRepo.getVariant(id);
  }

  async getMergedGames(onlyActive = true): Promise<Game[]> {
    const now = Date.now();
    if (onlyActive && this.mergedGamesCache && (now - this.mergedGamesCache.timestamp < this.cacheTtlMs)) {
      return this.mergedGamesCache.data;
    }

    // 1. Get real games
    const realGames = await catalogRepo.listGames(onlyActive);
    
    // 2. Get provider SKUs
    const { data: skus } = await supabaseAdmin!
      .from("provider_skus")
      .select("*")
      .eq("status", "active");

    if (!skus) return realGames;

    // 3. Group virtual variants by game slug
    const virtualVariantsByGame = new Map<string, any[]>();
    skus.forEach(sku => {
      const meta = sku.metadata?.originalData?.metadata || sku.metadata;
      const operator = meta?.operator || sku.name.split(" ")[0];
      const providerCat = meta?.category;
      const catId = this.getCategoryId(providerCat, meta, sku.name);

      if (!catId) return;

      const gameSlug = this.operatorToSlug(operator);
      if (!virtualVariantsByGame.has(gameSlug)) {
        virtualVariantsByGame.set(gameSlug, []);
      }
      virtualVariantsByGame.get(gameSlug)!.push({ sku, operator, catId });
    });

    // 4. Merge or Create Games
    const finalGames: Game[] = [...realGames];
    
    for (const [gameSlug, variants] of virtualVariantsByGame.entries()) {
      const existingGameIndex = finalGames.findIndex(g => g.slug === gameSlug || this.generateSlug(g.name) === gameSlug);
      
      const virtualPrices = await Promise.all(variants.map(async v => {
        const cost = this.getCost(v.sku);
        const skeleton: ProductVariant = {
          id: `virtual-variant-${v.sku.id}`,
          productId: `virtual-product-${gameSlug}`,
          name: v.sku.name,
          displayName: v.sku.name,
          sku: v.sku.provider_sku,
          status: "active",
          availability: "available",
          sortOrder: 100,
          pricing: {
            baseCost: cost,
            sellingPrice: 0,
            currency: "IDR",
            margin: 0,
            marginPercentage: 0,
            pricingMethod: "markup_fixed",
            status: "active"
          },
          createdAt: v.sku.created_at,
          updatedAt: v.sku.updated_at,
          createdBy: "system",
          updatedBy: "system"
        };
        const { finalPrice } = await pricingService.resolveEffectivePrice(skeleton);
        return finalPrice;
      }));

      const activePrices = virtualPrices.filter(p => p > 0);
      const virtualMin = activePrices.length > 0 ? Math.min(...activePrices) : 0;
      const virtualMax = activePrices.length > 0 ? Math.max(...activePrices) : 0;

      if (existingGameIndex >= 0) {
        // Add to existing
        const game = finalGames[existingGameIndex];
        game.variantCount = (game.variantCount || 0) + variants.length;
        
        // Update price range if virtual variants are cheaper/more expensive
        if (virtualMin > 0 && (game.minPrice === 0 || virtualMin < (game.minPrice || 0))) {
          game.minPrice = virtualMin;
        }
        if (virtualMax > (game.maxPrice || 0)) {
          game.maxPrice = virtualMax;
        }
      } else {
        // Create new virtual game
        const first = variants[0];
        finalGames.push({
          id: `virtual-game-${gameSlug}`,
          name: first.operator,
          slug: gameSlug,
          description: `Top up ${first.operator} murah dan cepat.`,
          image: "", 
          categoryIds: [first.catId],
          labels: ["Otomatis"],
          status: "active",
          availability: "available",
          sortOrder: 100,
          searchKeywords: [first.operator],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: "system",
          updatedBy: "system",
          variantCount: variants.length,
          productCount: 1,
          minPrice: virtualMin,
          maxPrice: virtualMax
        });
      }
    }

    if (onlyActive) {
      this.mergedGamesCache = {
        data: finalGames,
        timestamp: Date.now()
      };
    }

    return finalGames;
  }

  async getMergedGameDetail(slug: string): Promise<{ game: Game; products: Product[] } | null> {
    const games = await this.getMergedGames(true);
    const game = games.find(g => g.slug === slug);
    if (!game) return null;

    // 1. Get real products
    let products: Product[] = [];
    if (!game.id?.startsWith("virtual-game-")) {
      products = await catalogRepo.listProductsByGame(game.id!, true);
    }

    // 2. If no real products, or even if there are, we can add a virtual product for the automatic variants
    // To keep it simple, if there are NO real products, we add one virtual product
    if (products.length === 0) {
      products.push({
        id: `virtual-product-${slug}`,
        gameId: game.id!,
        categoryIds: game.categoryIds,
        name: game.name,
        slug: slug,
        description: game.description,
        type: "game_currency",
        image: game.image,
        status: "active",
        availability: "available",
        sortOrder: 0,
        searchKeywords: [],
        createdAt: game.createdAt,
        updatedAt: game.updatedAt,
        createdBy: "system",
        updatedBy: "system"
      });
    }

    return { game, products };
  }

  private operatorToSlug(operator: string): string {
    return this.generateSlug(operator);
  }

  async getMergedVariants(productId: string): Promise<ProductVariant[]> {
    // 1. Get real variants
    const realVariants = await catalogRepo.listVariantsByProduct(productId, true);
    
    // 2. Identify the game slug to find virtual variants
    let gameSlug = "";
    if (this.isVirtualProduct(productId)) {
      gameSlug = productId.replace("virtual-product-", "");
    } else {
      // Look up real product to get game slug
      const product = await catalogRepo.getProduct(productId);
      if (product) {
        const game = await catalogRepo.getGame(product.gameId);
        if (game) {
          gameSlug = game.slug;
        }
      }
    }

    if (!gameSlug) return realVariants;

    // 3. Get virtual variants matching this game slug
    const { data: skus } = await supabaseAdmin!
      .from("provider_skus")
      .select("*")
      .eq("status", "active");

    if (!skus) return realVariants;

    const seenSkus = new Set<string>();
    const seenProviderSkuIds = new Set<string>();

    for (const v of realVariants) {
      if (v.sku) {
        const lowerSku = v.sku.toLowerCase().trim();
        seenSkus.add(lowerSku);
        // Normalize provider-prefixed SKU (e.g., "tokovoucher-FF10" -> "ff10", "apigames-sku1" -> "sku1")
        const hyphenIdx = lowerSku.indexOf("-");
        if (hyphenIdx !== -1) {
          seenSkus.add(lowerSku.substring(hyphenIdx + 1));
        }
        const underscoreIdx = lowerSku.indexOf("_");
        if (underscoreIdx !== -1) {
          seenSkus.add(lowerSku.substring(underscoreIdx + 1));
        }
      }
      if (v.id) {
        seenProviderSkuIds.add(v.id);
      }
    }

    // Retrieve provider mappings for real variants to match against provider_sku and provider_sku_id
    if (realVariants.length > 0) {
      const realVariantIds = realVariants.map(v => v.id);
      const { data: mappings } = await supabaseAdmin!
        .from("provider_mappings")
        .select("variant_id, provider_sku, provider_sku_id")
        .in("variant_id", realVariantIds);

      if (mappings) {
        for (const m of mappings) {
          if (m.provider_sku) {
            seenSkus.add(m.provider_sku.toLowerCase().trim());
          }
          if (m.provider_sku_id) {
            seenProviderSkuIds.add(m.provider_sku_id);
          }
        }
      }
    }

    const virtualVariantsPromises = skus.map(async sku => {
      const operator = this.getOperator(sku);
      const vSlug = this.operatorToSlug(operator);

      if (vSlug !== gameSlug) return null;
      if (seenProviderSkuIds.has(sku.id)) return null;
      if (seenSkus.has(sku.provider_sku.toLowerCase().trim())) return null;

      const cost = this.getCost(sku);
      const skeleton: ProductVariant = {
        id: `virtual-variant-${sku.id}`,
        productId: productId,
        name: sku.name,
        displayName: sku.name,
        sku: sku.provider_sku,
        status: "active",
        availability: "available",
        sortOrder: 100,
        pricing: {
          baseCost: cost,
          sellingPrice: 0,
          currency: "IDR",
          margin: 0,
          marginPercentage: 0,
          pricingMethod: "markup_fixed",
          status: "active"
        },
        createdAt: sku.created_at,
        updatedAt: sku.updated_at,
        createdBy: "system",
        updatedBy: "system"
      };

      const { finalPrice, ruleId } = await pricingService.resolveEffectivePrice(skeleton);

      return {
        ...skeleton,
        pricing: {
          ...skeleton.pricing,
          sellingPrice: finalPrice,
          margin: finalPrice - cost,
          marginPercentage: finalPrice > 0 ? ((finalPrice - cost) / finalPrice) * 100 : 0,
          appliedRuleId: ruleId
        }
      };
    });

    const resolvedVirtualVariants = (await Promise.all(virtualVariantsPromises)).filter(Boolean) as ProductVariant[];

    return [...realVariants, ...resolvedVirtualVariants];
  }
}
