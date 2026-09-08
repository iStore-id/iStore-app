import { adminDb } from "./firebase-admin";
import { logCoreAudit } from "./core-service";
import { LoyaltyService } from "./loyalty-service";
import { CommissionService } from "./commission-service";
import { 
  ReferralConfig, 
  ReferralRelationship, 
  ReferralRelationshipStatus,
  ReferralRewardStatus
} from "../types/referral";
import { CustomerUser } from "../types/customer";

const DEFAULT_REFERRAL_CONFIG: ReferralConfig = {
  enabled: false,
  referrerRewardType: 'NONE',
  referrerRewardPoints: 0,
  referredRewardType: 'NONE',
  referredRewardPoints: 0,
  minQualifyingOrderAmount: 0,
  allowSelfReferral: false,
  requireOrderSuccess: true,
  updatedAt: new Date().toISOString(),
  updatedBy: 'SYSTEM'
};

export class ReferralService {
  private static instance: ReferralService;
  private loyaltyService: LoyaltyService;
  private commissionService: CommissionService;

  private constructor() {
    this.loyaltyService = LoyaltyService.getInstance();
    this.commissionService = CommissionService.getInstance();
  }

  public static getInstance(): ReferralService {
    if (!ReferralService.instance) {
      ReferralService.instance = new ReferralService();
    }
    return ReferralService.instance;
  }

  /**
   * Get Referral System Configuration
   */
  async getConfig(): Promise<ReferralConfig> {
    const doc = await adminDb.collection("systemConfigs").doc("referral_config").get();
    if (!doc.exists) return DEFAULT_REFERRAL_CONFIG;
    return { ...DEFAULT_REFERRAL_CONFIG, ...doc.data() } as ReferralConfig;
  }

  /**
   * Generate a unique referral code for a user atomically
   */
  async generateReferralCode(userId: string, actor: { uid: string; email: string }): Promise<string> {
    return await adminDb.runTransaction(async (transaction) => {
      const userRef = adminDb.collection("users").doc(userId);
      const userSnap = await transaction.get(userRef);
      
      if (!userSnap.exists) throw new Error("USER_NOT_FOUND");
      const userData = userSnap.data() as CustomerUser;
      
      if (userData.referralCode) return userData.referralCode;

      // Generate a simple normalized code: FIRSTNAME-RANDOM
      const namePart = (userData.name || userData.displayName || "USER").split(" ")[0].toUpperCase().replace(/[^A-Z0-9]/g, "");
      let isUnique = false;
      let code = "";
      let attempts = 0;

      while (!isUnique && attempts < 5) {
        const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
        code = `${namePart}${randomPart}`;
        
        // Check uniqueness in users collection
        const existingSnap = await adminDb.collection("users").where("referralCode", "==", code).get();
        if (existingSnap.empty) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) throw new Error("FAILED_TO_GENERATE_UNIQUE_CODE");

      transaction.update(userRef, { 
        referralCode: code,
        updatedAt: new Date().toISOString()
      });

      await logCoreAudit(
        actor,
        userData.role || "customer",
        "REFERRAL_CODE_CREATED",
        `users/${userId}`,
        null,
        { userId, referralCode: code }
      );

      return code;
    });
  }

  async getReferralStatus(userId: string): Promise<any> {
    const snap = await adminDb.collection("referralRelationships")
      .where("referrerUid", "==", userId)
      .get();
    
    return {
      successfulReferrals: snap.size,
      relationships: snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    };
  }

  /**
   * Attribute a new customer to a referrer via code
   * Establishes the PENDING relationship
   */
  async attributeCustomer(
    referredUid: string, 
    referralCode: string, 
    source: 'URL' | 'MANUAL_INPUT' | 'API'
  ): Promise<{ success: boolean; message: string; relationship?: ReferralRelationship }> {
    const cleanCode = referralCode.trim().toUpperCase();
    if (!cleanCode) return { success: false, message: "Kode referral tidak valid." };

    const config = await this.getConfig();
    if (!config.enabled) return { success: false, message: "Program referral sedang tidak aktif." };

    // 1. Find Referrer by code
    const referrerSnap = await adminDb.collection("users").where("referralCode", "==", cleanCode).limit(1).get();
    if (referrerSnap.empty) {
      return { success: false, message: "Kode referral tidak ditemukan." };
    }
    const referrerDoc = referrerSnap.docs[0];
    const referrerUid = referrerDoc.id;

    // 2. Self-referral check
    if (referrerUid === referredUid && !config.allowSelfReferral) {
      return { success: false, message: "Anda tidak dapat menggunakan kode referral milik sendiri." };
    }

    // 3. Existing relationship check (First-Referrer wins)
    const relationshipId = `REF_${referrerUid}_${referredUid}`;
    const relRef = adminDb.collection("referralRelationships").doc(relationshipId);
    
    // Also check if referred user already has ANY referrer
    const existingRef = await adminDb.collection("referralRelationships")
      .where("referredUid", "==", referredUid)
      .limit(1)
      .get();
    
    if (!existingRef.empty) {
      return { success: false, message: "Pelanggan sudah teratribusi ke referrer lain." };
    }

    const now = new Date().toISOString();
    const relationship: ReferralRelationship = {
      id: relationshipId,
      referrerUid,
      referredUid,
      status: 'PENDING',
      referralCode: cleanCode,
      source,
      rewardStatus: 'PENDING',
      rewardType: 'NONE', // Will be determined at qualification
      createdAt: now,
      updatedAt: now
    };

    await adminDb.runTransaction(async (transaction) => {
      // Set relationship
      transaction.set(relRef, relationship);
      
      // Update referred user profile
      const userRef = adminDb.collection("users").doc(referredUid);
      transaction.update(userRef, { 
        referredBy: referrerUid,
        updatedAt: now
      });
    });

    await logCoreAudit(
      { uid: referredUid, email: "system@istore.co.id" }, // Actor is the referred user (or system)
      "customer",
      "REFERRAL_RELATIONSHIP_CREATED",
      `referralRelationships/${relationshipId}`,
      null,
      { referrerUid, referredUid, referralCode: cleanCode, source }
    );

    return { success: true, message: "Referral berhasil dikaitkan.", relationship };
  }

  /**
   * Qualify a referral when an order reaches SUCCESS state
   */
  async qualifyReferral(orderId: string, orderData: any): Promise<void> {
    const config = await this.getConfig();
    if (!config.enabled) return;

    // Safety check: only process if order is successful
    if (orderData.transactionStatus !== 'success') return;

    const referredUid = orderData.userId;
    if (!referredUid || referredUid === 'guest') return;

    // 1. Find relationship
    const relSnap = await adminDb.collection("referralRelationships")
      .where("referredUid", "==", referredUid)
      .where("status", "==", "PENDING")
      .limit(1)
      .get();

    if (relSnap.empty) return;
    const relDoc = relSnap.docs[0];
    const relationship = relDoc.data() as ReferralRelationship;

    // 2. Validate Order Amount
    if (orderData.totalAmount < config.minQualifyingOrderAmount) {
      console.log(`[Referral] Order ${orderId} does not meet minimum amount ${config.minQualifyingOrderAmount}`);
      return;
    }

    // 3. Deterministic Reward Processing
    const now = new Date().toISOString();
    const referrerUid = relationship.referrerUid;

    await adminDb.runTransaction(async (transaction) => {
      // Update Relationship Status
      transaction.update(relDoc.ref, {
        status: 'CONVERTED',
        qualifiedOrderId: orderId,
        rewardStatus: 'GRANTED',
        rewardType: config.referrerRewardType === 'BOTH' ? 'BOTH' : 
                    (config.referrerRewardType !== 'NONE' ? config.referrerRewardType : 'NONE'),
        convertedAt: now,
        updatedAt: now
      });
    });

    // 4. Grant Rewards (Non-blocking but audited)
    
    // A. Referrer Points
    if (config.referrerRewardType === 'POINTS' || config.referrerRewardType === 'BOTH') {
      try {
        await this.loyaltyService.awardPointsGeneric(
          referrerUid, 
          config.referrerRewardPoints, 
          `referral_reward_${orderId}`,
          `Reward referral dari transaksi teman (${referredUid})`,
          'REFERRAL_EARN',
          orderId
        );
      } catch (e) {
        console.error(`[Referral] Failed to award points to referrer ${referrerUid}`, e);
      }
    }

    // B. Referrer Commission
    if (config.referrerRewardType === 'COMMISSION' || config.referrerRewardType === 'BOTH') {
      try {
        await this.commissionService.accrueCommissionForOrder(orderId, {
          ...orderData,
          referralCode: orderData.referralCode || relationship.referralCode
        });
      } catch (e) {
        console.error(`[Referral] Failed to accrue commission for referrer ${referrerUid}`, e);
      }
    }

    // C. Referred Customer Bonus (Welcome Points)
    if (config.referredRewardType === 'POINTS') {
      try {
        await this.loyaltyService.awardPointsGeneric(
          referredUid,
          config.referredRewardPoints,
          `referral_welcome_${orderId}`,
          `Bonus selamat datang dari referral (${referrerUid})`,
          'REFERRAL_EARN',
          orderId
        );
      } catch (e) {
        console.error(`[Referral] Failed to award welcome points to referred user ${referredUid}`, e);
      }
    }

    await logCoreAudit(
      { uid: "SYSTEM", email: "system@istore.co.id" },
      "system",
      "REFERRAL_REWARD_GRANTED",
      `referralRelationships/${relationship.id}`,
      null,
      { relationshipId: relationship.id, orderId, referrerUid, referredUid }
    );
  }

  /**
   * Handle Reversal if order is refunded
   */
  async handleReferralRefund(orderId: string, refundKey: string, refundAmount: number): Promise<void> {
     // Reversal for Commission is handled by CommissionService.handleOrderRefund
     // We only need to handle Poin Reversal if we want to clawback referral points.
     // For Phase C3, we rely on LoyaltyService.reverseOrderPoints if it matches the reference.
     
     // Find the relationship tied to this order
     const relSnap = await adminDb.collection("referralRelationships")
       .where("qualifiedOrderId", "==", orderId)
       .limit(1)
       .get();
     
     if (relSnap.empty) return;
     const relationship = relSnap.docs[0].data() as ReferralRelationship;

     // Update reward status to REVERSED if full refund
     // (Simplified: if any refund happens on a qualified order, we might flag it)
     await adminDb.collection("referralRelationships").doc(relationship.id).update({
       rewardStatus: 'REVERSED',
       updatedAt: new Date().toISOString()
     });

     await logCoreAudit(
       { uid: "SYSTEM", email: "system@istore.co.id" },
       "system",
       "REFERRAL_REWARD_REVERSED",
       `referralRelationships/${relationship.id}`,
       null,
       { relationshipId: relationship.id, orderId, refundKey }
     );
  }
}
