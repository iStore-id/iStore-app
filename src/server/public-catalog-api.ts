import { Request, Response } from "express";
import { CatalogService } from "./catalog-service";
import { FlashSaleService } from "./flash-sale-service";

const catalogService = CatalogService.getInstance();
const flashSaleService = FlashSaleService.getInstance();

export async function getPublicGames(req: Request, res: Response) {
  try {
    const games = await catalogService.getPublicGames();
    return res.status(200).json({ success: true, data: games });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getPublicGameDetail(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const game = await catalogService.getPublicGameBySlug(slug);
    if (!game) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    const products = await catalogService.getPublicProductsByGameId(game.id!);
    
    return res.status(200).json({ 
      success: true, 
      data: { 
        game, 
        products 
      } 
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getPublicVariants(req: Request, res: Response) {
  try {
    const { productId } = req.params;
    const variants = await catalogService.getPublicVariantsByProductId(productId);
    
    const enriched = await Promise.all(variants.map(async (v: any) => {
      const activeFs = await flashSaleService.getActiveFlashSaleForVariant(v.id);
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
    }));

    return res.status(200).json({ success: true, data: enriched });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getPublicCategories(req: Request, res: Response) {
  try {
    const categories = await catalogService.getPublicCategories();
    return res.status(200).json({ success: true, data: categories });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
