import { adminDb } from "./firebase-admin";
import { LoyaltyService } from "./loyalty-service";

const loyaltyService = LoyaltyService.getInstance();

export interface RewardItem {
  id: string;
  name: string;
  description: string;
  image?: string;
  pointsCost: number;
  status: 'active' | 'inactive';
  quota?: number | null;
  remainingQuota?: number | null;
  perCustomerLimit?: number | null;
  rewardType: 'voucher' | 'item' | 'benefit';
  voucherCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RewardRedemption {
  id: string;
  rewardId: string;
  rewardName: string;
  customerId: string;
  pointsCost: number;
  rewardType: string;
  voucherCode?: string;
  status: 'SUCCESS' | 'FAILED';
  createdAt: string;
}

export class RewardService {
  private static instance: RewardService;

  public static getInstance(): RewardService {
    if (!RewardService.instance) {
      RewardService.instance = new RewardService();
    }
    return RewardService.instance;
  }

  async getAllRewards(includeInactive = false): Promise<RewardItem[]> {
    let query: FirebaseFirestore.Query = adminDb.collection("rewards");
    if (!includeInactive) {
      query = query.where("status", "==", "active");
    }
    const snap = await query.get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RewardItem));
  }

  async getRewardById(rewardId: string): Promise<RewardItem | null> {
    const doc = await adminDb.collection("rewards").doc(rewardId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as RewardItem;
  }

  async createReward(data: Omit<RewardItem, 'id' | 'createdAt' | 'updatedAt' | 'remainingQuota'>): Promise<RewardItem> {
    const ref = adminDb.collection("rewards").doc();
    const item: RewardItem = {
      id: ref.id,
      ...data,
      remainingQuota: data.quota !== undefined && data.quota !== null ? data.quota : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await ref.set(item);
    return item;
  }

  async updateReward(rewardId: string, data: Partial<RewardItem>): Promise<RewardItem> {
    const ref = adminDb.collection("rewards").doc(rewardId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Reward tidak ditemukan");
    
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    await ref.update(updateData);
    const updatedSnap = await ref.get();
    return { id: updatedSnap.id, ...updatedSnap.data() } as RewardItem;
  }

  async deleteReward(rewardId: string): Promise<void> {
    const ref = adminDb.collection("rewards").doc(rewardId);
    await ref.update({ status: 'inactive', updatedAt: new Date().toISOString() });
  }

  async redeemReward(customerId: string, rewardId: string): Promise<RewardRedemption> {
    if (!customerId || customerId === 'guest') {
      throw new Error("Silakan login untuk menukar reward.");
    }

    const redemptionRef = adminDb.collection("rewardRedemptions").doc();
    const redemptionId = redemptionRef.id;

    return await adminDb.runTransaction(async (transaction) => {
      const rewardRef = adminDb.collection("rewards").doc(rewardId);
      const rewardSnap = await transaction.get(rewardRef);

      if (!rewardSnap.exists) {
        throw new Error("Reward tidak ditemukan.");
      }

      const reward = rewardSnap.data() as RewardItem;
      if (reward.status !== 'active') {
        throw new Error("Reward sudah tidak aktif.");
      }

      if (reward.remainingQuota !== null && reward.remainingQuota !== undefined && reward.remainingQuota <= 0) {
        throw new Error("Maaf, kuota reward ini telah habis.");
      }

      if (reward.perCustomerLimit && reward.perCustomerLimit > 0) {
        const userRedemptionsSnap = await transaction.get(
          adminDb.collection("rewardRedemptions")
            .where("customerId", "==", customerId)
            .where("rewardId", "==", rewardId)
            .where("status", "==", "SUCCESS")
        );
        if (userRedemptionsSnap.size >= reward.perCustomerLimit) {
          throw new Error(`Anda telah mencapai batas maksimal penukaran (${reward.perCustomerLimit}x) untuk reward ini.`);
        }
      }

      const pointsCost = reward.pointsCost;

      // Check customer balance
      const txsSnap = await transaction.get(
        adminDb.collection("pointTransactions").where("customerId", "==", customerId)
      );

      let currentBalance = 0;
      txsSnap.forEach(doc => {
        currentBalance += (doc.data().points || 0);
      });

      if (currentBalance < pointsCost) {
        throw new Error(`Poin Anda tidak cukup (${currentBalance} poin). Diperlukan ${pointsCost} poin.`);
      }

      // Create point transaction for redemption
      const pointTxRef = adminDb.collection("pointTransactions").doc();
      transaction.set(pointTxRef, {
        id: pointTxRef.id,
        customerId,
        type: 'REDEEM',
        points: -pointsCost,
        reference: `reward_redeem_${redemptionId}`,
        reason: `Penukaran reward: ${reward.name}`,
        createdAt: new Date().toISOString(),
        createdBy: customerId
      });

      // Decrement remaining quota if applicable
      if (reward.remainingQuota !== null && reward.remainingQuota !== undefined) {
        transaction.update(rewardRef, {
          remainingQuota: reward.remainingQuota - 1,
          updatedAt: new Date().toISOString()
        });
      }

      const redemption: RewardRedemption = {
        id: redemptionId,
        rewardId,
        rewardName: reward.name,
        customerId,
        pointsCost,
        rewardType: reward.rewardType,
        voucherCode: reward.voucherCode || undefined,
        status: 'SUCCESS',
        createdAt: new Date().toISOString()
      };

      transaction.set(redemptionRef, redemption);
      return redemption;
    });
  }

  async getAllRedemptions(): Promise<RewardRedemption[]> {
    const snap = await adminDb.collection("rewardRedemptions").orderBy("createdAt", "desc").limit(100).get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RewardRedemption));
  }

  async getCustomerRedemptions(customerId: string): Promise<RewardRedemption[]> {
    if (!customerId || customerId === 'guest') return [];
    const snap = await adminDb.collection("rewardRedemptions")
      .where("customerId", "==", customerId)
      .orderBy("createdAt", "desc")
      .get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RewardRedemption));
  }
}
