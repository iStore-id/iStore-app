import { logCoreAudit } from "./core-service.js";
import { LoyaltyService } from "./loyalty-service.js";
import { CommissionService } from "./commission-service.js";
import { 
  ReferralConfig, 
  ReferralRelationship, 
  ReferralRelationshipStatus,
  ReferralRewardStatus
} from "../types/referral.js";
import { CustomerUser } from "../types/customer.js";
import { supabaseAdmin } from "./supabase-admin.js";
import { SystemConfigRepository } from "./supabase/system-config-repository.js";

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
    try {
      const data = await SystemConfigRepository.getInstance().getConfig("referral_config");
      if (!data) return DEFAULT_REFERRAL_CONFIG;
      return { ...DEFAULT_REFERRAL_CONFIG, ...data } as ReferralConfig;
    } catch (err) {
      console.error("[ReferralService] Failed to read config from Supabase, falling back to default:", err);
      return DEFAULT_REFERRAL_CONFIG;
    }
  }

  /**
   * Generate a unique referral code for a user atomically
   */
  async generateReferralCode(userId: string, actor: { uid: string; email: string }): Promise<string> {
    if (!supabaseAdmin) throw new Error("Supabase admin not configured");

    const { data: userData, error: userError } = await supabaseAdmin
      .from("profiles")
      .select("display_name, referral_code, role_id")
      .eq("id", userId)
      .maybeSingle();

    if (userError || !userData) throw new Error("USER_NOT_FOUND");
    if (userData.referral_code) return userData.referral_code;

    // Generate a simple normalized code: FIRSTNAME-RANDOM
    const namePart = (userData.display_name || "USER").split(" ")[0].toUpperCase().replace(/[^A-Z0-9]/g, "");
    let isUnique = false;
    let code = "";
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
      code = `${namePart}${randomPart}`;
      
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("referral_code", code);
        
      if (count === 0) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) throw new Error("FAILED_TO_GENERATE_UNIQUE_CODE");

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ 
        referral_code: code,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId);

    if (updateError) throw new Error("FAILED_TO_SAVE_CODE");

    await logCoreAudit(
      actor,
      userData.role_id || "customer",
      "REFERRAL_CODE_CREATED",
      `users/${userId}`,
      null,
      { userId, referralCode: code }
    );

    return code;
  }

  async getReferralStatus(userId: string): Promise<any> {
    if (!supabaseAdmin) {
      throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");
    }

    const { data, error } = await supabaseAdmin
      .from("referral_relationships")
      .select("*")
      .eq("referrer_uid", userId);

    if (error) {
      console.error(`[ReferralService] Failed to get referral status from Supabase for user ${userId}:`, error);
      return {
        successfulReferrals: 0,
        relationships: []
      };
    }

    const relationships = (data || []).map(row => ({
      id: row.id,
      referrerUid: row.referrer_uid,
      referredUid: row.referred_uid,
      status: row.status,
      referralCode: row.referral_code,
      source: row.source,
      rewardStatus: row.reward_status,
      rewardType: row.reward_type,
      qualifiedOrderId: row.qualified_order_id,
      convertedAt: row.converted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    return {
      successfulReferrals: relationships.length,
      relationships
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

    if (!supabaseAdmin) {
      return { success: false, message: "Sistem rujukan database tidak tersedia." };
    }

    // Call Supabase atomic attribution RPC
    const { data, error } = await supabaseAdmin.rpc("attribute_customer_atomic", {
      p_referred_uid: referredUid,
      p_referral_code: cleanCode,
      p_source: source
    });

    if (error) {
      console.error("[ReferralService] attribute_customer_atomic RPC failed:", error);
      const errText = error.message || String(error);
      let errorMessage = "Terjadi kesalahan saat mengaitkan referral.";
      if (errText.includes("R0001")) {
        errorMessage = "Kode referral tidak valid atau kosong.";
      } else if (errText.includes("R0002")) {
        errorMessage = "Program referral sedang tidak aktif.";
      } else if (errText.includes("R0003")) {
        errorMessage = "Anda tidak dapat menggunakan kode referral milik sendiri.";
      } else if (errText.includes("R0004")) {
        errorMessage = "Pelanggan sudah teratribusi ke referrer lain.";
      } else if (errText.includes("R0005")) {
        errorMessage = "Kode referral tidak ditemukan.";
      } else if (errText.includes("R0006")) {
        errorMessage = "Pelanggan sudah memiliki kode rujukan sendiri.";
      } else {
        errorMessage = error.message || errorMessage;
      }
      return { success: false, message: errorMessage };
    }

    const result = data as any;
    if (!result || !result.success) {
      return { success: false, message: result?.message || "Gagal mengaitkan referral." };
    }

    const relationship: ReferralRelationship = {
      id: result.relationship_id,
      referrerUid: result.referrer_uid,
      referredUid: result.referred_uid,
      status: 'PENDING',
      referralCode: cleanCode,
      source,
      rewardStatus: 'PENDING',
      rewardType: 'NONE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await logCoreAudit(
      { uid: referredUid, email: "system@istore.co.id" },
      "customer",
      "REFERRAL_RELATIONSHIP_CREATED",
      `referralRelationships/${result.relationship_id}`,
      null,
      { referrerUid: result.referrer_uid, referredUid, referralCode: cleanCode, source }
    );

    return { success: true, message: result.message || "Referral berhasil dikaitkan.", relationship };
  }

  /**
   * Qualify a referral when an order reaches SUCCESS state
   */
  async qualifyReferral(orderId: string, orderData: any): Promise<void> {
    if (!supabaseAdmin) return;

    const referredUid = orderData.userId;
    if (!referredUid || referredUid === 'guest') return;

    // Call Supabase qualify atomic RPC
    const { data, error } = await supabaseAdmin.rpc('qualify_referral_atomic', {
      p_order_id: orderId,
      p_total_amount: Number(orderData.totalAmount || 0),
      p_transaction_status: orderData.transactionStatus,
      p_referred_uid: referredUid
    });

    if (error) {
      console.error(`[ReferralService] RPC qualify_referral_atomic failed for order ${orderId}:`, error);
      return;
    }

    const result = data as any;
    if (!result || !result.success) {
      console.log(`[ReferralService] qualify_referral_atomic result not successful:`, result?.message);
      return;
    }

    if (result.already_processed && !result.needs_distribution) {
      console.log(`[ReferralService] Referral for order ${orderId} already processed and rewards distributed.`);
      return;
    }

    if (result.needs_distribution) {
      const referrerUid = result.referrer_uid;
      const referredUid = result.referred_uid;
      const referrerRewardType = result.referrer_reward_type;
      const referredRewardType = result.referred_reward_type;
      const referrerRewardPoints = Number(result.referrer_reward_points || 0);
      const referredRewardPoints = Number(result.referred_reward_points || 0);
      const relationshipId = result.relationship_id;

      let referrerPointsAwarded = true;
      let referrerCommissionAwarded = true;
      let referredPointsAwarded = true;

      // A. Referrer Points
      if (referrerRewardType === 'POINTS' || referrerRewardType === 'BOTH') {
        try {
          await this.loyaltyService.awardPointsGeneric(
            referrerUid, 
            referrerRewardPoints, 
            `referral_reward_${orderId}`,
            `Reward referral dari transaksi teman (${referredUid})`,
            'REFERRAL_EARN',
            orderId
          );
        } catch (e) {
          console.error(`[Referral] Failed to award points to referrer ${referrerUid}`, e);
          referrerPointsAwarded = false;
        }
      }

      // B. Referrer Commission
      if (referrerRewardType === 'COMMISSION' || referrerRewardType === 'BOTH') {
        try {
          await this.commissionService.accrueCommissionForOrder(orderId, {
            ...orderData,
            referralCode: orderData.referralCode || result.referral_code
          });
        } catch (e) {
          console.error(`[Referral] Failed to accrue commission for referrer ${referrerUid}`, e);
          referrerCommissionAwarded = false;
        }
      }

      // C. Referred Customer Bonus (Welcome Points)
      if (referredRewardType === 'POINTS') {
        try {
          await this.loyaltyService.awardPointsGeneric(
            referredUid,
            referredRewardPoints,
            `referral_welcome_${orderId}`,
            `Bonus selamat datang dari referral (${referrerUid})`,
            'REFERRAL_EARN',
            orderId
          );
        } catch (e) {
          console.error(`[Referral] Failed to award welcome points to referred user ${referredUid}`, e);
          referredPointsAwarded = false;
        }
      }

      // If everything succeeded, update reward_status to 'GRANTED'
      if (referrerPointsAwarded && referrerCommissionAwarded && referredPointsAwarded) {
        const { error: updateError } = await supabaseAdmin
          .from("referral_relationships")
          .update({
            reward_status: 'GRANTED',
            updated_at: new Date().toISOString()
          })
          .eq("id", relationshipId)
          .eq("qualified_order_id", orderId);

        if (updateError) {
          console.error(`[ReferralService] Failed to update reward status to GRANTED for relationship ${relationshipId}:`, updateError);
        } else {
          // Log success audit
          await logCoreAudit(
            { uid: "SYSTEM", email: "system@istore.co.id" },
            "system",
            "REFERRAL_REWARD_GRANTED",
            `referralRelationships/${relationshipId}`,
            null,
            { relationshipId, orderId, referrerUid, referredUid }
          );
        }
      } else {
        console.warn(`[ReferralService] Reward distribution was partially successful or failed. Status remains PENDING for retry.`);
      }
    }
  }

  /**
   * Handle Reversal if order is refunded
   */
  async handleReferralRefund(orderId: string, refundKey: string, refundAmount: number): Promise<void> {
    if (!supabaseAdmin) return;

    const { error } = await supabaseAdmin.rpc('handle_referral_refund_atomic', {
      p_order_id: orderId
    });

    if (error) {
      console.error(`[ReferralService] handle_referral_refund_atomic failed for order ${orderId}:`, error);
      return;
    }

    await logCoreAudit(
      { uid: "SYSTEM", email: "system@istore.co.id" },
      "system",
      "REFERRAL_REWARD_REVERSED",
      `referralRelationships/order_${orderId}`,
      null,
      { orderId, refundKey, refundAmount }
    );
  }
}

