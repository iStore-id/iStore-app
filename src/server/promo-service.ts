import { adminDb } from "./firebase-admin";

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

  public static getInstance(): PromoService {
    if (!PromoService.instance) {
      PromoService.instance = new PromoService();
    }
    return PromoService.instance;
  }

  async getPromos(): Promise<PromoData[]> {
    const snapshot = await adminDb.collection("promos").orderBy("createdAt", "desc").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PromoData));
  }

  async getPromoByCode(code: string): Promise<PromoData | null> {
    const normalizedCode = code.trim().toUpperCase();
    const snapshot = await adminDb.collection("promos").where("code", "==", normalizedCode).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as PromoData;
  }

  async createPromo(data: Omit<PromoData, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>, actorUid: string): Promise<PromoData> {
    const normalizedCode = data.code.trim().toUpperCase();
    const existing = await this.getPromoByCode(normalizedCode);
    if (existing) {
      throw new Error(`Promo dengan kode ${normalizedCode} sudah ada.`);
    }

    const promoRef = adminDb.collection("promos").doc();
    const now = new Date().toISOString();
    const promoData: PromoData = {
      id: promoRef.id,
      ...data,
      code: normalizedCode,
      usageCount: 0,
      createdAt: now,
      updatedAt: now
    };

    await promoRef.set(promoData);
    return promoData;
  }

  async updatePromo(id: string, data: Partial<PromoData>, actorUid: string): Promise<PromoData> {
    const promoRef = adminDb.collection("promos").doc(id);
    const snap = await promoRef.get();
    if (!snap.exists) {
      throw new Error("Promo tidak ditemukan.");
    }

    const updatePayload: any = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    if (updatePayload.code) {
      updatePayload.code = updatePayload.code.trim().toUpperCase();
    }

    await promoRef.update(updatePayload);
    const updatedSnap = await promoRef.get();
    return { id: updatedSnap.id, ...updatedSnap.data() } as PromoData;
  }

  async deletePromo(id: string, actorUid: string): Promise<void> {
    const promoRef = adminDb.collection("promos").doc(id);
    const snap = await promoRef.get();
    if (!snap.exists) {
      throw new Error("Promo tidak ditemukan.");
    }
    // Soft archive / deactivate or delete
    await promoRef.update({
      status: 'inactive',
      updatedAt: new Date().toISOString()
    });
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
      const usageSnap = await adminDb.collection("orders")
        .where("userId", "==", userId)
        .where("promoId", "==", promo.id)
        .where("paymentStatus", "in", ["paid", "pending"])
        .get();
      
      if (usageSnap.size >= promo.perCustomerUsageLimit) {
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
    const promoRef = adminDb.collection("promos").doc(promoId);
    await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(promoRef);
      if (!snap.exists) return;
      const data = snap.data()!;
      const currentCount = data.usageCount || 0;
      transaction.update(promoRef, {
        usageCount: currentCount + 1,
        updatedAt: new Date().toISOString()
      });
    });
  }
}
