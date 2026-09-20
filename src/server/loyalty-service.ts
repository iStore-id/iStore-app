import { supabaseAdmin } from "./supabase-admin";

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

  private mapRowToPointTransaction(row: any): PointTransaction {
    return {
      id: String(row.id),
      customerId: String(row.customer_id),
      type: row.type,
      points: Number(row.points),
      reference: String(row.reference),
      orderId: row.order_id ? String(row.order_id) : undefined,
      reason: row.reason ? String(row.reason) : undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      createdBy: row.created_by ? String(row.created_by) : 'system'
    };
  }

  async getConfig(): Promise<LoyaltyConfig> {
    const { data, error } = await supabaseAdmin
      .from("loyalty_configs")
      .select("*")
      .eq("id", "main")
      .maybeSingle();

    if (error) {
      console.error("[LoyaltyService] Error getting loyalty config:", error.message);
      return DEFAULT_CONFIG;
    }

    if (!data) {
      return DEFAULT_CONFIG;
    }

    return {
      earnRateRp: Number(data.earn_rate_rp ?? DEFAULT_CONFIG.earnRateRp),
      redeemRateIdr: Number(data.redeem_rate_idr ?? DEFAULT_CONFIG.redeemRateIdr),
      minRedeemPoints: Number(data.min_redeem_points ?? DEFAULT_CONFIG.minRedeemPoints),
      maxRedeemPercent: Number(data.max_redemption_percent ?? DEFAULT_CONFIG.maxRedeemPercent),
      enabled: Boolean(data.enabled ?? DEFAULT_CONFIG.enabled),
    };
  }

  async updateConfig(newConfig: Partial<LoyaltyConfig>, actorUid: string): Promise<LoyaltyConfig> {
    const current = await this.getConfig();
    const updated: LoyaltyConfig = {
      earnRateRp: newConfig.earnRateRp !== undefined ? Number(newConfig.earnRateRp) : current.earnRateRp,
      redeemRateIdr: newConfig.redeemRateIdr !== undefined ? Number(newConfig.redeemRateIdr) : current.redeemRateIdr,
      minRedeemPoints: newConfig.minRedeemPoints !== undefined ? Number(newConfig.minRedeemPoints) : current.minRedeemPoints,
      maxRedeemPercent: (newConfig as any).maxRedeemPercent !== undefined
        ? Number((newConfig as any).maxRedeemPercent)
        : ((newConfig as any).maxRedemptionPercent !== undefined ? Number((newConfig as any).maxRedemptionPercent) : current.maxRedeemPercent),
      enabled: newConfig.enabled !== undefined ? Boolean(newConfig.enabled) : current.enabled,
    };

    const row = {
      id: "main",
      earn_rate_rp: updated.earnRateRp,
      redeem_rate_idr: updated.redeemRateIdr,
      min_redeem_points: updated.minRedeemPoints,
      max_redemption_percent: updated.maxRedeemPercent,
      enabled: updated.enabled,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabaseAdmin
      .from("loyalty_configs")
      .upsert(row);

    if (error) {
      console.error("[LoyaltyService] Error updating loyalty config:", error.message);
      throw new Error(`Gagal menyimpan konfigurasi loyalty: ${error.message}`);
    }

    return updated;
  }

  async getCustomerBalance(customerId: string): Promise<number> {
    if (!customerId || customerId === 'guest') return 0;
    const { data, error } = await supabaseAdmin
      .from("point_transactions")
      .select("points")
      .eq("customer_id", customerId);

    if (error) {
      console.error(`[LoyaltyService] Error getting customer balance for ${customerId}:`, error.message);
      return 0;
    }

    let balance = 0;
    if (data) {
      for (const row of data) {
        balance += (Number(row.points) || 0);
      }
    }
    return Math.max(0, balance);
  }

  async getBalance(customerId: string): Promise<number> {
    return this.getCustomerBalance(customerId);
  }

  async getCustomerTransactions(customerId: string): Promise<PointTransaction[]> {
    if (!customerId || customerId === 'guest') return [];
    const { data, error } = await supabaseAdmin
      .from("point_transactions")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(`[LoyaltyService] Error getting transactions for ${customerId}:`, error.message);
      return [];
    }

    return (data || []).map(row => this.mapRowToPointTransaction(row));
  }

  async getAllTransactions(): Promise<PointTransaction[]> {
    const { data, error } = await supabaseAdmin
      .from("point_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[LoyaltyService] Error getting all transactions:", error.message);
      return [];
    }

    return (data || []).map(row => this.mapRowToPointTransaction(row));
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

    // Check idempotency
    const { data: existing, error: checkError } = await supabaseAdmin
      .from("point_transactions")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();

    if (checkError) {
      console.error(`[LoyaltyService] Error checking existing reference ${reference}:`, checkError.message);
    }

    if (existing) {
      return null; // Already awarded
    }

    const row = {
      customer_id: customerId,
      type,
      points,
      reference,
      order_id: orderId || null,
      reason: reason || null,
      created_by: 'system',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from("point_transactions")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      if (error.code === '23505' || error.message.includes('unique') || error.message.includes('duplicate key')) {
        return null; // Idempotent guard against concurrent awards
      }
      console.error("[LoyaltyService] Error awarding points:", error.message);
      throw new Error(`Gagal memberikan poin: ${error.message}`);
    }

    return this.mapRowToPointTransaction(data);
  }

  async redeemPoints(customerId: string, pointsToUse: number, orderId: string): Promise<{ discountAmount: number; txId: string }> {
    if (!customerId || customerId === 'guest' || pointsToUse <= 0) {
      throw new Error("Poin tidak valid atau user belum login.");
    }

    const reference = `points_redeem_${orderId}`;
    const reason = `Penukaran poin untuk pesanan ${orderId}`;

    const { data, error } = await supabaseAdmin.rpc("redeem_points_atomic", {
      p_customer_id: customerId,
      p_points_to_use: pointsToUse,
      p_order_id: orderId,
      p_reference: reference,
      p_reason: reason,
      p_created_by: customerId
    });

    if (error) {
      throw new Error(error.message);
    }

    const res = data as {
      success: boolean;
      idempotent: boolean;
      tx_id: string;
      discount_amount: number;
      points_redeemed: number;
      remaining_balance: number;
      message?: string;
    };

    if (!res || !res.tx_id) {
      throw new Error("Gagal memproses penukaran poin.");
    }

    return {
      discountAmount: Number(res.discount_amount),
      txId: String(res.tx_id)
    };
  }

  async reverseOrderPoints(orderId: string, customerId: string): Promise<void> {
    if (!customerId || customerId === 'guest') return;

    const reference = `points_reversal_${orderId}`;
    const earnReference = `points_earn_${orderId}`;

    // 1. Check if reversal already exists
    const { data: existingRev, error: revErr } = await supabaseAdmin
      .from("point_transactions")
      .select("id")
      .eq("reference", reference)
      .maybeSingle();

    if (revErr) {
      console.error(`[LoyaltyService] Error checking reversal for order ${orderId}:`, revErr.message);
      return;
    }
    if (existingRev) return;

    // 2. Find original earn transaction
    const { data: earnTx, error: earnErr } = await supabaseAdmin
      .from("point_transactions")
      .select("*")
      .eq("reference", earnReference)
      .maybeSingle();

    if (earnErr) {
      console.error(`[LoyaltyService] Error finding earn tx for order ${orderId}:`, earnErr.message);
      return;
    }
    if (!earnTx) return; // Never earned

    const pointsToReverse = Number(earnTx.points);
    if (!pointsToReverse || pointsToReverse <= 0) return;

    // 3. Insert reversal transaction
    const row = {
      customer_id: customerId,
      type: "REFUND_REVERSAL" as const,
      points: -pointsToReverse,
      reference,
      order_id: orderId,
      reason: `Reversal poin karena refund pesanan ${orderId}`,
      created_by: "system",
      created_at: new Date().toISOString()
    };

    const { error: insertErr } = await supabaseAdmin
      .from("point_transactions")
      .insert(row);

    if (insertErr) {
      if (insertErr.code === "23505" || insertErr.message.includes("unique") || insertErr.message.includes("duplicate key")) {
        return; // Idempotent race condition caught by UNIQUE constraint
      }
      console.error(`[LoyaltyService] Error reversing points for order ${orderId}:`, insertErr.message);
    }
  }

  async adminAdjustPoints(customerId: string, points: number, reason: string, actorUid: string): Promise<PointTransaction> {
    if (!customerId) throw new Error("Customer ID wajib diisi.");
    if (points === 0) throw new Error("Jumlah poin adjustment tidak boleh 0.");
    if (!reason) throw new Error("Alasan adjustment wajib diisi.");

    const reference = `admin_adjust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const row = {
      customer_id: customerId,
      type: 'ADMIN_ADJUSTMENT' as const,
      points,
      reference,
      reason,
      created_by: actorUid,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from("point_transactions")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      console.error("[LoyaltyService] Error in adminAdjustPoints:", error.message);
      throw new Error(`Gagal melakukan adjustment poin: ${error.message}`);
    }

    return this.mapRowToPointTransaction(data);
  }
}
