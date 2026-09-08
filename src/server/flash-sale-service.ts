import { adminDb } from "./firebase-admin";

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

  public static getInstance(): FlashSaleService {
    if (!FlashSaleService.instance) {
      FlashSaleService.instance = new FlashSaleService();
    }
    return FlashSaleService.instance;
  }

  async getFlashSales(): Promise<FlashSaleData[]> {
    const snap = await adminDb.collection("flashSales").orderBy("createdAt", "desc").get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FlashSaleData));
  }

  async getActiveFlashSaleForVariant(variantId: string): Promise<FlashSaleData | null> {
    const now = new Date();
    const snap = await adminDb.collection("flashSales")
      .where("variantId", "==", variantId)
      .where("status", "==", "active")
      .get();

    for (const doc of snap.docs) {
      const data = { id: doc.id, ...doc.data() } as FlashSaleData;
      const start = new Date(data.startAt);
      const end = new Date(data.endAt);
      if (now >= start && now <= end) {
        if (data.remainingQuota === null || data.remainingQuota === undefined || data.remainingQuota > 0) {
          return data;
        }
      }
    }
    return null;
  }

  async createFlashSale(data: Omit<FlashSaleData, 'id' | 'usageCount' | 'remainingQuota' | 'createdAt' | 'updatedAt'>, actorUid: string): Promise<FlashSaleData> {
    const flashSaleRef = adminDb.collection("flashSales").doc();
    const now = new Date().toISOString();
    const totalQuota = data.totalQuota !== undefined ? data.totalQuota : null;
    const flashSaleData: FlashSaleData = {
      id: flashSaleRef.id,
      ...data,
      totalQuota,
      remainingQuota: totalQuota,
      usageCount: 0,
      createdAt: now,
      updatedAt: now
    };

    await flashSaleRef.set(flashSaleData);
    return flashSaleData;
  }

  async updateFlashSale(id: string, data: Partial<FlashSaleData>, actorUid: string): Promise<FlashSaleData> {
    const ref = adminDb.collection("flashSales").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new Error("Flash sale tidak ditemukan.");
    }

    const updatePayload: any = {
      ...data,
      updatedAt: new Date().toISOString()
    };

    await ref.update(updatePayload);
    const updatedSnap = await ref.get();
    return { id: updatedSnap.id, ...updatedSnap.data() } as FlashSaleData;
  }

  async deleteFlashSale(id: string, actorUid: string): Promise<void> {
    const ref = adminDb.collection("flashSales").doc(id);
    await ref.update({
      status: 'inactive',
      updatedAt: new Date().toISOString()
    });
  }

  async consumeQuotaAndLimit(flashSaleId: string, userId: string): Promise<FlashSaleData> {
    const ref = adminDb.collection("flashSales").doc(flashSaleId);
    
    return await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) {
        throw new Error("Flash sale tidak ditemukan.");
      }

      const fsData = { id: snap.id, ...snap.data() } as FlashSaleData;
      const now = new Date();
      if (fsData.status !== 'active' || now < new Date(fsData.startAt) || now > new Date(fsData.endAt)) {
        throw new Error("Flash sale sudah berakhir atau tidak aktif.");
      }

      if (fsData.remainingQuota !== null && fsData.remainingQuota !== undefined) {
        if (fsData.remainingQuota <= 0) {
          throw new Error("Kuota flash sale telah habis.");
        }
      }

      if (fsData.perCustomerLimit && userId && userId !== 'guest') {
        const orderSnap = await adminDb.collection("orders")
          .where("userId", "==", userId)
          .where("flashSaleSnapshot.id", "==", fsData.id)
          .where("paymentStatus", "in", ["paid", "pending"])
          .get();

        if (orderSnap.size >= fsData.perCustomerLimit) {
          throw new Error(`Anda telah mencapai batas maksimal pembelian flash sale ini (${fsData.perCustomerLimit}x).`);
        }
      }

      const newRemaining = fsData.remainingQuota !== null && fsData.remainingQuota !== undefined 
        ? fsData.remainingQuota - 1 
        : null;
      const newUsageCount = (fsData.usageCount || 0) + 1;

      transaction.update(ref, {
        remainingQuota: newRemaining,
        usageCount: newUsageCount,
        updatedAt: new Date().toISOString()
      });

      return {
        ...fsData,
        remainingQuota: newRemaining,
        usageCount: newUsageCount
      };
    });
  }
}
