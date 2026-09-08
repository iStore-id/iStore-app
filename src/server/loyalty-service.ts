import { adminDb } from "./firebase-admin";

export interface PointTransaction {
  id: string;
  customerId: string;
  type: 'EARN' | 'REDEEM' | 'REFUND_REVERSAL' | 'ADMIN_ADJUSTMENT' | 'REFERRAL_EARN';
  points: number; // positive or negative
  reference: string;
  orderId?: string;
  reason?: string;
  createdAt: string;
  createdBy: string;
}

export interface LoyaltyConfig {
  earnRateRp: number; // e.g. Rp 10.000 spent = 1 point (earnRateRp = 10000)
  redeemRateIdr: number; // e.g. 1 point = Rp 100 discount (redeemRateIdr = 100)
  minRedeemPoints: number; // minimum points to redeem in a single checkout
  maxRedeemPercent: number; // max percentage of order total payable by points e.g. 50
  enabled: boolean;
}

const DEFAULT_CONFIG: LoyaltyConfig = {
  earnRateRp: 10000,
  redeemRateIdr: 100,
  minRedeemPoints: 10,
  maxRedeemPercent: 50,
  enabled: true
};

export class LoyaltyService {
  private static instance: LoyaltyService;

  public static getInstance(): LoyaltyService {
    if (!LoyaltyService.instance) {
      LoyaltyService.instance = new LoyaltyService();
    }
    return LoyaltyService.instance;
  }

  async getConfig(): Promise<LoyaltyConfig> {
    const doc = await adminDb.collection("loyaltyConfigs").doc("main").get();
    if (!doc.exists) {
      return DEFAULT_CONFIG;
    }
    return { ...DEFAULT_CONFIG, ...doc.data() } as LoyaltyConfig;
  }

  async updateConfig(newConfig: Partial<LoyaltyConfig>, actorUid: string): Promise<LoyaltyConfig> {
    const current = await this.getConfig();
    const updated = { ...current, ...newConfig };
    await adminDb.collection("loyaltyConfigs").doc("main").set(updated);
    return updated;
  }

  async getCustomerBalance(customerId: string): Promise<number> {
    if (!customerId || customerId === 'guest') return 0;
    const snap = await adminDb.collection("pointTransactions")
      .where("customerId", "==", customerId)
      .get();

    let balance = 0;
    snap.forEach(doc => {
      const data = doc.data() as PointTransaction;
      balance += (data.points || 0);
    });
    return Math.max(0, balance);
  }

  async getBalance(customerId: string): Promise<number> {
    return this.getCustomerBalance(customerId);
  }

  async getCustomerTransactions(customerId: string): Promise<PointTransaction[]> {
    if (!customerId || customerId === 'guest') return [];
    const snap = await adminDb.collection("pointTransactions")
      .where("customerId", "==", customerId)
      .orderBy("createdAt", "desc")
      .get();

    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PointTransaction));
  }

  async getAllTransactions(): Promise<PointTransaction[]> {
    const snap = await adminDb.collection("pointTransactions")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PointTransaction));
  }

  async awardOrderPoints(orderId: string, customerId: string, totalAmount: number): Promise<PointTransaction | null> {
    if (!customerId || customerId === 'guest') return null;
    const config = await this.getConfig();
    if (!config.enabled) return null;

    let pointsEarned = Math.floor(totalAmount / config.earnRateRp);
    
    // Membership Multiplier Integration
    try {
      const { MembershipService } = await import("./membership-service");
      const benefit = await MembershipService.getInstance().getEffectiveBenefit(customerId);
      if (benefit && benefit.pointMultiplier > 1) {
        const multiplier = benefit.pointMultiplier;
        const originalPoints = pointsEarned;
        pointsEarned = Math.floor(pointsEarned * multiplier);
        console.log(`[Loyalty] Applied membership multiplier ${multiplier}x for user ${customerId}: ${originalPoints} -> ${pointsEarned}`);
      }
    } catch (e) {
      console.error("[Loyalty] Failed to resolve membership benefit for points", e);
    }

    if (pointsEarned <= 0) return null;

    return await this.awardPointsGeneric(
      customerId,
      pointsEarned,
      `points_earn_${orderId}`,
      `Poin dari pesanan ${orderId}`,
      'EARN',
      orderId
    );
  }

  /**
   * Helper to calculate points based on amount and membership status
   */
  async calculateExpectedPoints(customerId: string, totalAmount: number): Promise<number> {
    if (!customerId || customerId === 'guest') return 0;
    const config = await this.getConfig();
    if (!config.enabled) return 0;

    let pointsEarned = Math.floor(totalAmount / config.earnRateRp);
    
    // Membership Multiplier Integration
    try {
      const { MembershipService } = await import("./membership-service");
      const benefit = await MembershipService.getInstance().getEffectiveBenefit(customerId);
      if (benefit && benefit.pointMultiplier > 1) {
        pointsEarned = Math.floor(pointsEarned * benefit.pointMultiplier);
      }
    } catch (e) {
      console.warn("[Loyalty] Could not apply membership multiplier in calculation", e);
    }

    return pointsEarned;
  }

  /**
   * Generic point awarding with idempotency protection
   */
  async awardPointsGeneric(
    customerId: string, 
    points: number, 
    reference: string, 
    reason: string,
    type: PointTransaction['type'] = 'EARN',
    orderId?: string
  ): Promise<PointTransaction | null> {
    if (!customerId || customerId === 'guest' || points <= 0) return null;

    return await adminDb.runTransaction(async (transaction) => {
      // Check idempotency
      const existingSnap = await adminDb.collection("pointTransactions")
        .where("reference", "==", reference)
        .get();

      if (!existingSnap.empty) {
        return null; // Already awarded
      }

      const txRef = adminDb.collection("pointTransactions").doc();
      const pointTx: PointTransaction = {
        id: txRef.id,
        customerId,
        type,
        points,
        reference,
        orderId,
        reason,
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      };

      transaction.set(txRef, pointTx);
      return pointTx;
    });
  }

  async redeemPoints(customerId: string, pointsToUse: number, orderId: string): Promise<{ discountAmount: number; txId: string }> {
    if (!customerId || customerId === 'guest' || pointsToUse <= 0) {
      throw new Error("Poin tidak valid atau user belum login.");
    }

    const config = await this.getConfig();
    if (!config.enabled) {
      throw new Error("Sistem loyalty sedang tidak aktif.");
    }

    if (pointsToUse < config.minRedeemPoints) {
      throw new Error(`Minimal penukaran poin adalah ${config.minRedeemPoints} poin.`);
    }

    const reference = `points_redeem_${orderId}`;

    return await adminDb.runTransaction(async (transaction) => {
      // Check idempotency
      const existingSnap = await adminDb.collection("pointTransactions")
        .where("reference", "==", reference)
        .get();

      if (!existingSnap.empty) {
        const existing = existingSnap.docs[0].data() as PointTransaction;
        const discountAmount = Math.abs(existing.points) * config.redeemRateIdr;
        return { discountAmount, txId: existing.id };
      }

      // Calculate current balance atomically
      const txsSnap = await transaction.get(
        adminDb.collection("pointTransactions").where("customerId", "==", customerId)
      );

      let currentBalance = 0;
      txsSnap.forEach(doc => {
        currentBalance += (doc.data().points || 0);
      });

      if (currentBalance < pointsToUse) {
        throw new Error(`Poin tidak cukup. Saldo Anda saat ini: ${currentBalance} poin.`);
      }

      const discountAmount = pointsToUse * config.redeemRateIdr;
      const txRef = adminDb.collection("pointTransactions").doc();
      const pointTx: PointTransaction = {
        id: txRef.id,
        customerId,
        type: 'REDEEM',
        points: -pointsToUse,
        reference,
        orderId,
        reason: `Penukaran poin untuk pesanan ${orderId}`,
        createdAt: new Date().toISOString(),
        createdBy: customerId
      };

      transaction.set(txRef, pointTx);
      return { discountAmount, txId: txRef.id };
    });
  }

  async reverseOrderPoints(orderId: string, customerId: string): Promise<void> {
    if (!customerId || customerId === 'guest') return;

    const reference = `points_reversal_${orderId}`;
    const earnReference = `points_earn_${orderId}`;

    await adminDb.runTransaction(async (transaction) => {
      // Check if reversal already exists
      const revSnap = await adminDb.collection("pointTransactions")
        .where("reference", "==", reference)
        .get();

      if (!revSnap.empty) return;

      // Find original earn transaction
      const earnSnap = await adminDb.collection("pointTransactions")
        .where("reference", "==", earnReference)
        .get();

      if (earnSnap.empty) return; // Never earned

      const earnTx = earnSnap.docs[0].data() as PointTransaction;
      const pointsToReverse = earnTx.points; // positive points earned

      if (pointsToReverse <= 0) return;

      const txRef = adminDb.collection("pointTransactions").doc();
      const reversalTx: PointTransaction = {
        id: txRef.id,
        customerId,
        type: 'REFUND_REVERSAL',
        points: -pointsToReverse,
        reference,
        orderId,
        reason: `Reversal poin karena refund pesanan ${orderId}`,
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      };

      transaction.set(txRef, reversalTx);
    });
  }

  async adminAdjustPoints(customerId: string, points: number, reason: string, actorUid: string): Promise<PointTransaction> {
    if (!customerId) throw new Error("Customer ID wajib diisi.");
    if (points === 0) throw new Error("Jumlah poin adjustment tidak boleh 0.");
    if (!reason) throw new Error("Alasan adjustment wajib diisi.");

    const txRef = adminDb.collection("pointTransactions").doc();
    const adjustmentTx: PointTransaction = {
      id: txRef.id,
      customerId,
      type: 'ADMIN_ADJUSTMENT',
      points,
      reference: `admin_adjust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      reason,
      createdAt: new Date().toISOString(),
      createdBy: actorUid
    };

    await txRef.set(adjustmentTx);
    return adjustmentTx;
  }
}
