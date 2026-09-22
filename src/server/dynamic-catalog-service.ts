import { SupabaseCatalogRepository } from "./supabase/catalog-repository.js";
import { supabaseAdmin } from "./supabase-admin.js";
import { Game, Product, ProductVariant, CatalogStatus, AvailabilityStatus } from "../types/core.js";
import slugify from "slugify";
import { PricingService } from "./pricing-service.js";

const catalogRepo = SupabaseCatalogRepository.getInstance();
const pricingService = PricingService.getInstance();

export const POPULAR_TOPUP_GAME_SLUGS: string[] = [
  "mobile-legends",
  "free-fire-ffmax",
  "pubg-mobile",
  "valorant",
  "genshin-impact",
  "honor-of-kings",
  "call-of-duty-mobile",
  "arena-of-valor-aov",
  "point-blank",
  "garena-undawn",
  "clash-of-clans",
  "brawl-stars",
  "ragnarok-origin",
  "ragnarok-m-eternal-love",
  "ragnarok-x-next-generation",
  "honkai-star-rail",
  "zenless-zone-zero",
  "ea-sports-fc-mobile"
];

export class DynamicCatalogService {
  private static instance: DynamicCatalogService;
  private mergedGamesCache: { data: Game[]; timestamp: number } | null = null;
  private mergedVariantsCache: Map<string, { data: ProductVariant[]; timestamp: number }> = new Map();
  private cacheTtlMs = 45000; // 45 seconds TTL

  private constructor() {}

  public static getInstance(): DynamicCatalogService {
    if (!DynamicCatalogService.instance) {
      DynamicCatalogService.instance = new DynamicCatalogService();
    }
    return DynamicCatalogService.instance;
  }

  private slugToOperatorsMap: Map<string, Set<string>> = new Map();

  private async getCandidateOperators(gameSlug: string, gameName?: string): Promise<string[]> {
    const ops = new Set<string>();
    
    // 1. Check in-memory slug to operator map
    const mappedOps = this.slugToOperatorsMap.get(gameSlug);
    if (mappedOps && mappedOps.size > 0) {
      mappedOps.forEach(op => ops.add(op));
      return Array.from(ops);
    }
    
    // 2. Check cached merged games
    if (this.mergedGamesCache) {
      const cachedGame = this.mergedGamesCache.data.find(
        g => g.slug === gameSlug || this.generateSlug(g.name) === gameSlug
      );
      if (cachedGame) {
        if (cachedGame.name) ops.add(cachedGame.name);
        if (cachedGame.searchKeywords) {
          cachedGame.searchKeywords.forEach(kw => ops.add(kw));
        }
      }
    }
    
    // 3. Include gameName and slug variations
    if (gameName) {
      ops.add(gameName);
      ops.add(gameName.trim());
      const nameSlug = this.generateSlug(gameName);
      const nameMappedOps = this.slugToOperatorsMap.get(nameSlug);
      if (nameMappedOps && nameMappedOps.size > 0) {
        nameMappedOps.forEach(op => ops.add(op));
        return Array.from(ops);
      }
    }
    
    // 4. Structural permutations
    const words = gameSlug.split('-').filter(Boolean);
    const spaced = words.join(' ');
    ops.add(spaced);
    ops.add(spaced.toLowerCase());
    ops.add(spaced.toUpperCase());

    const titleCase = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    ops.add(titleCase);

    const connectives = new Set(['of', 'and', 'for', 'the', 'by', 'in', 'to', 'pascabayar']);
    const titleWithConnectives = words.map((w, idx) => {
      if (idx > 0 && connectives.has(w.toLowerCase())) return w.toLowerCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
    ops.add(titleWithConnectives);

    const knownAcronyms = new Set(['id', 'my', 'sg', 'th', 'ph', 'sr', 'sea', 'fps', 'cn', 'pc', 'ea', 'fc', 'go', 'tv', 'hd', 'mu', 'au', 'xl', 'cd', 'ai', 'pln', 'hbo', 'gpt', 'aov', 'ff', 'ffmax', 'mlbb', 'pubgm', 'imo', 'gol', 'nt', 'link', 'kvision', 'viu', 'mola', '3d', '2m', 'sms']);
    const titleWithAcronyms = words.map((w, idx) => {
      const low = w.toLowerCase();
      if (knownAcronyms.has(low)) return low.toUpperCase();
      if (idx > 0 && connectives.has(low)) return low;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
    ops.add(titleWithAcronyms);

    if (spaced.includes(' and ')) {
      ops.add(titleCase.replace(' And ', ' & '));
      ops.add(titleWithConnectives.replace(' and ', ' & '));
      ops.add(titleWithAcronyms.replace(' and ', ' & '));
    }

    // Free Fire & FFMAX format (both direct and voucher)
    if (gameSlug === "free-fire-ffmax" || gameSlug.includes("free-fire-ffmax") || gameSlug.includes("ffmax")) {
      ops.add("Free Fire & FFMAX");
      ops.add("Voucher Free Fire & FFMAX");
    }

    // Injek V.<Provider> format (dots stripped by slug generation)
    if (gameSlug.startsWith("injek-v")) {
      const prov = gameSlug.substring(7); // e.g. "byu", "telkomsel", "xl", etc.
      ops.add(`Injek V.${prov.charAt(0).toUpperCase()}${prov.slice(1).toLowerCase()}`);
      ops.add(`Injek V.${prov.toUpperCase()}`);
      if (prov === "byu") {
        ops.add("Injek V.By.U");
      }
    }

    // 5. Fallback targeted DB lookup on cold start (using metadata->>'operator' ilike filter)
    const searchTokens: string[] = [];
    for (const w of words) {
      if (['voucher', 'injek', 'top', 'up'].includes(w)) continue;
      searchTokens.push(w);
      if (w.startsWith('i') && w.length > 3) searchTokens.push(w.slice(1));
      if (w.startsWith('v') && w.length > 3 && !['viu', 'valorant'].includes(w)) searchTokens.push(w.slice(1));
      if (w.includes('apple')) searchTokens.push('apple', 'itunes');
      if (w.includes('byu')) searchTokens.push('by');
    }

    const patterns: string[] = [];
    if (searchTokens.length >= 2) {
      patterns.push('%' + searchTokens.slice(0, 2).join('%') + '%');
    }
    for (const token of searchTokens.filter(t => t.length >= 3)) {
      patterns.push('%' + token + '%');
    }
    if (words.length > 0) {
      patterns.push('%' + words[0] + '%');
    }

    for (const pattern of patterns) {
      const { data } = await supabaseAdmin!
        .from('provider_skus')
        .select('metadata')
        .eq('status', 'active')
        .ilike('metadata->>operator', pattern)
        .limit(100);

      if (data) {
        for (const item of data) {
          const op = item.metadata?.operator;
          if (op && this.generateSlug(op) === gameSlug) {
            ops.add(op);
            if (!this.slugToOperatorsMap.has(gameSlug)) {
              this.slugToOperatorsMap.set(gameSlug, new Set());
            }
            this.slugToOperatorsMap.get(gameSlug)!.add(op);
          }
        }
      }
      if (this.slugToOperatorsMap.has(gameSlug) && this.slugToOperatorsMap.get(gameSlug)!.size > 0) {
        break;
      }
    }

    return Array.from(ops);
  }

  public invalidateCache(): void {
    this.mergedGamesCache = null;
    this.mergedVariantsCache.clear();
    this.slugToOperatorsMap.clear();
  }

  private categoryMap: Record<string, string> = {
    "Topup Game": "15b131f7-ef27-4df4-a788-e8d87fa4a5e6", // TOP UP
    "GAMES": "15b131f7-ef27-4df4-a788-e8d87fa4a5e6",      // TOP UP
    "GAME": "15b131f7-ef27-4df4-a788-e8d87fa4a5e6",       // TOP UP
    "Voucher": "35d65b30-7c0c-40f0-9314-2362f3117419",    // VOUCHER
    "VOUCHER": "35d65b30-7c0c-40f0-9314-2362f3117419",    // VOUCHER
    "Voucher Game": "35d65b30-7c0c-40f0-9314-2362f3117419", // VOUCHER
    "Pulsa": "b51b89f8-5dfd-4411-a66c-e2cbaa55f401",      // PULSA
    "PULSA": "b51b89f8-5dfd-4411-a66c-e2cbaa55f401",      // PULSA
    "Pulsa Transfer": "b51b89f8-5dfd-4411-a66c-e2cbaa55f401", // PULSA
    "PLN": "d458112f-9ec0-4508-8072-92f300ecf2bd",        // Token Listrik
    "Token PLN": "d458112f-9ec0-4508-8072-92f300ecf2bd",  // Token Listrik
    "Data": "dccd2fa4-51bc-49a4-9cba-5aef7ea51b92",       // Paket Data
    "PAKET DATA": "dccd2fa4-51bc-49a4-9cba-5aef7ea51b92", // Paket Data
    "Voucher Data": "800a75d1-6e35-4755-aeba-4f5f72dcdbfb", // Voucher Data
    "VOUCHER DATA": "800a75d1-6e35-4755-aeba-4f5f72dcdbfb", // Voucher Data
    "Telpon": "513dde75-1122-4689-9323-06fa815c4f89",     // Telpon & SMS
    "SMS": "513dde75-1122-4689-9323-06fa815c4f89",        // Telpon & SMS
    "Telpon & SMS": "513dde75-1122-4689-9323-06fa815c4f89", // Telpon & SMS
    "TV": "109963d7-da7a-4534-84db-cfc8a239f326",         // TV
    "TV Prabayar": "109963d7-da7a-4534-84db-cfc8a239f326", // TV
    "E-Toll": "fe05e8c5-09ae-4c88-84e1-1a4e639f53b6",     // E-Toll
    "Hiburan": "62683c87-75aa-4b50-afff-f261babfc46e",    // Hiburan
    "Streaming": "62683c87-75aa-4b50-afff-f261babfc46e",  // Hiburan
    "E-Wallet": "934a2b92-2d94-478f-9477-e20c01382383",   // E-Money
    "E-MONEY": "934a2b92-2d94-478f-9477-e20c01382383",    // E-Money
  };

  private getCategoryId(providerCategory: string, meta?: any, skuName?: string): string | null {
    // 0. Official Provider Category Guard
    // TokoVoucher Category ID 1 = "Topup Game" (Valid for Homepage TOP UP)
    // TokoVoucher Category ID 16 = "Thailand Topup" (Non-game international telco - MUST NOT map to TOP UP or domestic PULSA)
    // TokoVoucher Category ID 17 = "Malaysia Topup" (Non-game international telco - MUST NOT map to TOP UP or domestic PULSA)
    const officialCategoryId = meta?.category_id ?? meta?.categoryId ?? meta?.originalData?.category_id;
    if (officialCategoryId === 16 || officialCategoryId === "16" || officialCategoryId === 17 || officialCategoryId === "17") {
      return null;
    }

    const rawCategory = (providerCategory || meta?.category || "").toString().trim();
    const upperCat = rawCategory.toUpperCase();

    if (
      upperCat === "THAILAND TOPUP" ||
      upperCat === "MALAYSIA TOPUP" ||
      upperCat.startsWith("THAILAND") ||
      upperCat.startsWith("MALAYSIA")
    ) {
      return null;
    }

    const context = `${rawCategory} ${meta?.operator || ""} ${meta?.type || ""} ${meta?.brand || ""} ${skuName || ""}`.toLowerCase();
    
    // Explicit guard against international telco leaking into domestic categories
    if (context.includes("thailand") || context.includes("malaysia")) {
      return null;
    }
    
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

    if (!providerCategory && !meta?.category) return null;
    const cat = rawCategory;

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

    // 1. Get real games from catalog repository
    const realGames = await catalogRepo.listGames(onlyActive);

    // Populate candidate operators map for targeted variant lookups without global scanning
    for (const game of realGames) {
      if (!this.slugToOperatorsMap.has(game.slug)) {
        this.slugToOperatorsMap.set(game.slug, new Set());
      }
      this.slugToOperatorsMap.get(game.slug)!.add(game.name);
      if (game.searchKeywords) {
        game.searchKeywords.forEach(kw => this.slugToOperatorsMap.get(game.slug)!.add(kw));
      }
    }

    const TOP_UP_CAT_ID = "15b131f7-ef27-4df4-a788-e8d87fa4a5e6";

    // Strictly ensure only TokoVoucher Category ID 1 (Topup Game) is included in Homepage TOP UP.
    // Thailand/Malaysia non-game telco items must never have TOP_UP_CAT_ID.
    const sanitizedGames = realGames.map(game => {
      if (game.categoryIds?.includes(TOP_UP_CAT_ID)) {
        const isExcluded = 
          game.slug === "ais" || 
          game.slug === "truemove-h" || 
          game.slug === "dtac" || 
          game.slug === "my-by-nt" ||
          (game.metadata as any)?.category_id === 16 ||
          (game.metadata as any)?.category_id === "16" ||
          (game.metadata as any)?.category_id === 17 ||
          (game.metadata as any)?.category_id === "17" ||
          (game.metadata as any)?.category === "Thailand Topup" ||
          (game.metadata as any)?.category === "Malaysia Topup";
        if (isExcluded) {
          return {
            ...game,
            categoryIds: game.categoryIds.filter(id => id !== TOP_UP_CAT_ID)
          };
        }
      }
      return game;
    });

    // 2. Sort games adhering to the business rules:
    // For TOP UP: Popular games are placed at the very top, followed by all other Category 1 games.
    const sortedGames = [...sanitizedGames].sort((a, b) => {
      const aIsTopUp = a.categoryIds?.includes(TOP_UP_CAT_ID);
      const bIsTopUp = b.categoryIds?.includes(TOP_UP_CAT_ID);

      if (aIsTopUp && bIsTopUp) {
        const idxA = POPULAR_TOPUP_GAME_SLUGS.indexOf(a.slug);
        const idxB = POPULAR_TOPUP_GAME_SLUGS.indexOf(b.slug);
        const rankA = idxA !== -1 ? idxA : 1000 + (a.sortOrder || 0);
        const rankB = idxB !== -1 ? idxB : 1000 + (b.sortOrder || 0);
        if (rankA !== rankB) return rankA - rankB;
        return a.name.localeCompare(b.name);
      }

      if (aIsTopUp && !bIsTopUp) return -1;
      if (!aIsTopUp && bIsTopUp) return 1;

      const orderA = a.sortOrder || 0;
      const orderB = b.sortOrder || 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

    if (onlyActive) {
      this.mergedGamesCache = {
        data: sortedGames,
        timestamp: Date.now()
      };
    }

    return sortedGames;
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
    const now = Date.now();
    const cached = this.mergedVariantsCache.get(productId);
    if (cached && (now - cached.timestamp < this.cacheTtlMs)) {
      return cached.data;
    }

    // 1. Get real variants
    const realVariants = await catalogRepo.listVariantsByProduct(productId, true);
    
    // 2. Identify the game slug to find virtual variants
    let gameSlug = "";
    let gameName = "";
    let productObj: Product | null = null;
    if (this.isVirtualProduct(productId)) {
      gameSlug = productId.replace("virtual-product-", "");
    } else {
      // Look up real product to get game slug
      productObj = await catalogRepo.getProduct(productId);
      if (productObj) {
        const game = await catalogRepo.getGame(productObj.gameId);
        if (game) {
          gameSlug = game.slug;
          gameName = game.name;
        }
      }
    }

    if (!gameSlug) {
      this.mergedVariantsCache.set(productId, {
        data: realVariants,
        timestamp: Date.now()
      });
      return realVariants;
    }

    // 3. Get virtual variants matching this game slug via targeted server-side filtering
    const candidateOperators = await this.getCandidateOperators(gameSlug, gameName);
    if (candidateOperators.length === 0) {
      this.mergedVariantsCache.set(productId, {
        data: realVariants,
        timestamp: Date.now()
      });
      return realVariants;
    }

    const { data: skus } = await supabaseAdmin!
      .from("provider_skus")
      .select("id, provider_id, provider_sku, name, type, status, metadata, created_at, updated_at")
      .eq("status", "active")
      .in("metadata->>operator", candidateOperators);

    if (!skus || skus.length === 0) {
      this.mergedVariantsCache.set(productId, {
        data: realVariants,
        timestamp: Date.now()
      });
      return realVariants;
    }

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

      const { finalPrice, ruleId } = await pricingService.resolveEffectivePrice(skeleton, {}, productObj);

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

    const finalVariants = [...realVariants, ...resolvedVirtualVariants];
    this.mergedVariantsCache.set(productId, {
      data: finalVariants,
      timestamp: Date.now()
    });

    return finalVariants;
  }
}
