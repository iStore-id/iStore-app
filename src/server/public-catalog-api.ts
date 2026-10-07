import { Request, Response } from "express";
import { SupabaseCatalogRepository } from "./supabase/catalog-repository.js";
import { DynamicCatalogService } from "./dynamic-catalog-service.js";
import { FlashSaleService } from "./flash-sale-service.js";
import { PricingService } from "./pricing-service.js";

const supabaseCatalogRepo = SupabaseCatalogRepository.getInstance();
const dynamicCatalogService = DynamicCatalogService.getInstance();
const flashSaleService = FlashSaleService.getInstance();
const pricingService = PricingService.getInstance();

export async function getPublicGames(req: Request, res: Response) {
  try {
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    const games = await dynamicCatalogService.getMergedGames(true);
    const sanitizedGames = games.map((game) => ({
      id: game.id,
      name: game.name,
      slug: game.slug,
      description: game.description,
      image: game.image,
      icon: game.icon,
      categoryIds: game.categoryIds,
      labels: game.labels,
      status: game.status,
      availability: game.availability,
      sortOrder: game.sortOrder,
      minPrice: game.minPrice,
      maxPrice: game.maxPrice
    }));
    return res.status(200).json({ success: true, data: sanitizedGames });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function resolveEnrichedVariants(productId: string, userId?: string) {
  const variants = await dynamicCatalogService.getMergedVariants(productId);
  
  const formattedVariants = await Promise.all(variants.map(async (v) => {
    const { finalPrice } = await pricingService.resolveEffectivePrice(v, { userId });
    return {
      id: v.id,
      productId: v.productId,
      name: v.name,
      displayName: v.displayName,
      sku: v.sku,
      status: v.status,
      availability: v.availability,
      sortOrder: v.sortOrder,
      sellingPrice: finalPrice
    };
  }));

  // Fail-safe and optimized bulk flash sale fetching
  let activeFlashSales: any[] = [];
  try {
    const variantIds = formattedVariants.map(v => v.id);
    activeFlashSales = await flashSaleService.getActiveFlashSalesForVariants(variantIds);
  } catch (fsError) {
    console.error("[resolveEnrichedVariants] Flash Sale fetch failed, proceeding without flash sales:", fsError);
    // We continue with empty flash sales instead of 500 error
  }

  const enriched = formattedVariants.map((v: any) => {
    const activeFs = activeFlashSales.find(fs => fs.variantId === v.id);
    if (activeFs) {
      return {
        ...v,
        flashSale: {
          id: activeFs.id,
          name: activeFs.name,
          salePrice: activeFs.salePrice,
          endAt: activeFs.endAt,
          remainingQuota: activeFs.remainingQuota,
          totalQuota: activeFs.totalQuota
        },
        sellingPrice: activeFs.salePrice
      };
    }
    return v;
  });

  return enriched;
}

export async function getPublicGameDetail(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const merged = await dynamicCatalogService.getMergedGameDetail(slug);
    
    if (!merged || merged.game.status !== "active") {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    const { game, products } = merged;

    const sanitizedGame = {
      id: game.id,
      name: game.name,
      slug: game.slug,
      description: game.description,
      image: game.image,
      icon: game.icon,
      categoryIds: game.categoryIds,
      labels: game.labels,
      status: game.status,
      availability: game.availability,
      minPrice: game.minPrice,
      maxPrice: game.maxPrice,
      metadata: game.metadata || {}
    };

    const sanitizedProducts = products.map((p) => ({
      id: p.id,
      gameId: p.gameId,
      categoryIds: p.categoryIds,
      name: p.name,
      slug: p.slug,
      description: p.description,
      type: p.type,
      image: p.image,
      status: p.status,
      availability: p.availability,
      metadata: p.metadata || {}
    }));

    return res.status(200).json({ 
      success: true, 
      data: { 
        game: sanitizedGame, 
        products: sanitizedProducts
      } 
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getPublicVariants(req: Request, res: Response) {
  try {
    const { productId } = req.params;
    const userId = (req as any).user?.uid;
    const enriched = await resolveEnrichedVariants(productId, userId);
    return res.status(200).json({ success: true, data: enriched });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getPublicCategories(req: Request, res: Response) {
  try {
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    const categories = await supabaseCatalogRepo.listCategories(true);
    const sanitizedCategories = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      icon: cat.icon,
      status: cat.status,
      sortOrder: cat.sortOrder
    }));
    return res.status(200).json({ success: true, data: sanitizedCategories });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getPublicFlashSales(req: Request, res: Response) {
  try {
    const allFlashSales = await flashSaleService.getFlashSales();
    const now = new Date();
    
    // Filter active flash sales
    const activeSales = allFlashSales.filter(fs => {
      if (fs.status !== 'active') return false;
      if (fs.startAt && new Date(fs.startAt) > now) return false;
      if (fs.endAt && new Date(fs.endAt) <= now) return false;
      if (fs.remainingQuota !== null && fs.remainingQuota !== undefined && fs.remainingQuota <= 0) return false;
      return true;
    });

    const enrichedSales = [];
    for (const fs of activeSales) {
      const variant = await supabaseCatalogRepo.getVariant(fs.variantId);
      if (!variant || variant.status !== "active") continue;
      
      const product = await supabaseCatalogRepo.getProduct(fs.productId);
      if (!product || product.status !== "active") continue;
      
      const game = await supabaseCatalogRepo.getGame(product.gameId);
      if (!game || game.status !== "active") continue;

      const { finalPrice } = await pricingService.resolveEffectivePrice(variant);
      const normalPrice = finalPrice;
      const discount = normalPrice > 0 ? Math.round(((normalPrice - fs.salePrice) / normalPrice) * 100) : 0;

      enrichedSales.push({
        id: fs.id,
        name: fs.name,
        salePrice: fs.salePrice,
        startAt: fs.startAt,
        endAt: fs.endAt,
        remainingQuota: fs.remainingQuota,
        totalQuota: fs.totalQuota,
        variantId: fs.variantId,
        productId: fs.productId,
        gameSlug: game.slug,
        gameName: game.name,
        productName: product.name,
        variantName: variant.name,
        image: product.image || game.image || "",
        normalPrice: normalPrice,
        discount: discount > 0 ? discount : undefined
      });
    }

    return res.status(200).json({ success: true, data: enrichedSales });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

