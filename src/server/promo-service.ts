import { SupabasePromoRepository } from "./supabase/promo-repository.js";

export interface PromoData {
  id?: string;
  code: string;
  name: string;
  description?: string;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  minimumTransaction: number;
  maximumDiscount?: number | null;
  usageLimit?: number | null;
  perCustomerUsageLimit?: number | null;
  startAt: string;
  endAt: string;
  status: 'active' | 'inactive';
  applicableGames?: string[];
  applicableProducts?: string[];
  applicableCategories?: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export class PromoService {
  private static instance: PromoService;
  private promoRepo: SupabasePromoRepository;

  private constructor() {
    this.promoRepo = SupabasePromoRepository.getInstance();
  }

  public static getInstance(): PromoService {
    if (!PromoService.instance) {
      PromoService.instance = new PromoService();
    }
    return PromoService.instance;
  }

  async getPromos(): Promise<PromoData[]> {
    return this.promoRepo.getPromos(false);
  }

  async getPromoByCode(code: string): Promise<PromoData | null> {
    return this.promoRepo.getPromoByCode(code);
  }

  async createPromo(data: Omit<PromoData, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>, actorUid: string): Promise<PromoData> {
    const normalizedCode = data.code.trim().toUpperCase();
    const existing = await this.getPromoByCode(normalizedCode);
    if (existing) {
      throw new Error(`Promo dengan kode ${normalizedCode} sudah ada.`);
    }

    return this.promoRepo.createPromo({
      ...data,
      code: normalizedCode
    });
  }

  async updatePromo(id: string, data: Partial<PromoData>, actorUid: string): Promise<PromoData> {
    const existing = await this.promoRepo.getPromo(id);
    if (!existing) {
      throw new Error("Promo tidak ditemukan.");
    }

    let updatePayload: Partial<PromoData> = { ...data };
    if (data.code) {
      const normalizedCode = data.code.trim().toUpperCase();
      if (normalizedCode !== existing.code) {
        const duplicate = await this.getPromoByCode(normalizedCode);
        if (duplicate && duplicate.id !== id) {
          throw new Error(`Promo dengan kode ${normalizedCode} sudah ada.`);
        }
      }
      updatePayload.code = normalizedCode;
    }

    await this.promoRepo.updatePromo(id, updatePayload);
    const updated = await this.promoRepo.getPromo(id);
    if (!updated) {
      throw new Error("Promo tidak ditemukan.");
    }
    return updated;
  }

  async deletePromo(id: string, actorUid: string): Promise<void> {
    const existing = await this.promoRepo.getPromo(id);
    if (!existing) {
      throw new Error("Promo tidak ditemukan.");
    }
    await this.promoRepo.deletePromo(id);
  }

  async validateAndCalculateDiscount(
    code: string,
    subtotal: number,
    userId: string,
    context: { gameId?: string; productId?: string; categoryId?: string }
  ): Promise<{ promoId: string; code: string; discountAmount: number; finalAmount: number; promoSnapshot: any }> {
    const promo = await this.getPromoByCode(code);
    if (!promo) {
      throw new Error("Kode promo tidak valid atau tidak ditemukan.");
    }

    if (promo.status !== 'active') {
      throw new Error("Promo ini sedang tidak aktif.");
    }

    const now = new Date();
    const start = new Date(promo.startAt);
    const end = new Date(promo.endAt);
    if (now < start || now > end) {
      throw new Error("Promo sudah kedaluwarsa atau belum dimulai.");
    }

    if (subtotal < promo.minimumTransaction) {
      throw new Error(`Minimum transaksi untuk promo ini adalah Rp ${promo.minimumTransaction.toLocaleString("id-ID")}.`);
    }

    if (promo.usageLimit !== null && promo.usageLimit !== undefined && promo.usageCount >= promo.usageLimit) {
      throw new Error("Kuota penggunaan promo telah habis.");
    }

    // Per-customer usage check if required
    if (promo.perCustomerUsageLimit && userId && userId !== 'guest') {
      const userUsageCount = await this.promoRepo.getUserPromoUsageCount(userId, promo.id!);
      
      if (userUsageCount >= promo.perCustomerUsageLimit) {
        throw new Error(`Anda telah mencapai batas maksimal penggunaan promo ini (${promo.perCustomerUsageLimit}x).`);
      }
    }

    // Scope check
    if (promo.applicableGames && promo.applicableGames.length > 0 && context.gameId) {
      if (!promo.applicableGames.includes(context.gameId)) {
        throw new Error("Promo ini tidak berlaku untuk game tersebut.");
      }
    }

    if (promo.applicableProducts && promo.applicableProducts.length > 0 && context.productId) {
      if (!promo.applicableProducts.includes(context.productId)) {
        throw new Error("Promo ini tidak berlaku untuk produk tersebut.");
      }
    }

    if (promo.applicableCategories && promo.applicableCategories.length > 0 && context.categoryId) {
      if (!promo.applicableCategories.includes(context.categoryId)) {
        throw new Error("Promo ini tidak berlaku untuk kategori tersebut.");
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (promo.discountType === 'fixed') {
      discountAmount = promo.discountValue;
    } else if (promo.discountType === 'percentage') {
      discountAmount = Math.round((subtotal * promo.discountValue) / 100);
      if (promo.maximumDiscount && promo.maximumDiscount > 0) {
        discountAmount = Math.min(discountAmount, promo.maximumDiscount);
      }
    }

    // Ensure integer IDR and bounds
    discountAmount = Math.max(0, Math.floor(discountAmount));
    discountAmount = Math.min(discountAmount, subtotal);

    const finalAmount = Math.max(0, subtotal - discountAmount);

    return {
      promoId: promo.id!,
      code: promo.code,
      discountAmount,
      finalAmount,
      promoSnapshot: {
        id: promo.id,
        code: promo.code,
        name: promo.name,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        discountAmount
      }
    };
  }

  async incrementUsage(promoId: string): Promise<void> {
    await this.promoRepo.incrementUsage(promoId);
  }
}
