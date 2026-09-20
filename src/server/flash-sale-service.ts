import { SupabaseFlashSaleRepository } from "./supabase/flash-sale-repository.js";
import { CatalogService } from "./catalog-service.js";

export interface FlashSaleData {
  id?: string;
  name: string;
  productId: string;
  variantId: string;
  salePrice: number;
  startAt: string;
  endAt: string;
  status: 'active' | 'inactive';
  totalQuota?: number | null;
  remainingQuota?: number | null;
  perCustomerLimit?: number | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export class FlashSaleService {
  private static instance: FlashSaleService;
  private flashSaleRepo: SupabaseFlashSaleRepository;

  private constructor() {
    this.flashSaleRepo = SupabaseFlashSaleRepository.getInstance();
  }

  public static getInstance(): FlashSaleService {
    if (!FlashSaleService.instance) {
      FlashSaleService.instance = new FlashSaleService();
    }
    return FlashSaleService.instance;
  }

  async getFlashSales(): Promise<FlashSaleData[]> {
    return this.flashSaleRepo.getFlashSales();
  }

  async getActiveFlashSaleForVariant(variantId: string): Promise<FlashSaleData | null> {
    return this.flashSaleRepo.getActiveFlashSaleForVariant(variantId);
  }

  async getActiveFlashSalesForVariants(variantIds: string[]): Promise<FlashSaleData[]> {
    return this.flashSaleRepo.getActiveFlashSalesForVariants(variantIds);
  }

  async createFlashSale(data: Omit<FlashSaleData, 'id' | 'usageCount' | 'remainingQuota' | 'createdAt' | 'updatedAt'>, actorUid: string): Promise<FlashSaleData> {
    // 1. Detect virtual items and perform materialization if needed
    if (data.variantId.startsWith("virtual-variant-")) {
      const providerSkuId = data.variantId.replace("virtual-variant-", "");
      const catalogService = CatalogService.getInstance();
      
      // We need a gameId for bulkImportSkus. 
      // If productId is virtual (e.g. virtual-product-mobile-legends), we can use a dummy UUID
      // because bulkImportSkus will resolve the real game by brand from the provider SKU.
      const dummyGameId = "00000000-0000-0000-0000-000000000000";
      
      const results = await catalogService.bulkImportSkus(dummyGameId, [providerSkuId], { 
        uid: actorUid, 
        email: "admin@system" 
      });
      
      const result = results[0];
      if (!result || !result.success) {
        throw new Error(`Gagal melakukan materialisasi produk virtual: ${result?.message || "Terjadi kesalahan saat mengimpor katalog."}`);
      }
      
      // Update data with real physical IDs obtained from materialization
      data.productId = result.productId;
      data.variantId = result.variantId;
    }

    return this.flashSaleRepo.createFlashSale(data);
  }

  async updateFlashSale(id: string, data: Partial<FlashSaleData>, actorUid: string): Promise<FlashSaleData> {
    const existing = await this.flashSaleRepo.getFlashSale(id);
    if (!existing) {
      throw new Error("Flash sale tidak ditemukan.");
    }

    // Detect virtual items and perform materialization if needed during update
    if (data.variantId && data.variantId.startsWith("virtual-variant-")) {
      const providerSkuId = data.variantId.replace("virtual-variant-", "");
      const catalogService = CatalogService.getInstance();
      const dummyGameId = "00000000-0000-0000-0000-000000000000";
      
      const results = await catalogService.bulkImportSkus(dummyGameId, [providerSkuId], { 
        uid: actorUid, 
        email: "admin@system" 
      });
      
      const result = results[0];
      if (!result || !result.success) {
        throw new Error(`Gagal melakukan materialisasi produk virtual saat update: ${result?.message || "Terjadi kesalahan saat mengimpor katalog."}`);
      }
      
      data.productId = result.productId;
      data.variantId = result.variantId;
    }

    await this.flashSaleRepo.updateFlashSale(id, data);
    const updated = await this.flashSaleRepo.getFlashSale(id);
    if (!updated) {
      throw new Error("Flash sale tidak ditemukan.");
    }
    return updated;
  }

  async deleteFlashSale(id: string, actorUid: string): Promise<void> {
    const existing = await this.flashSaleRepo.getFlashSale(id);
    if (!existing) {
      throw new Error("Flash sale tidak ditemukan.");
    }
    await this.flashSaleRepo.deleteFlashSale(id);
  }

  async consumeQuotaAndLimit(flashSaleId: string, userId: string): Promise<FlashSaleData> {
    return this.flashSaleRepo.consumeQuotaAndLimit(flashSaleId, userId);
  }
}

