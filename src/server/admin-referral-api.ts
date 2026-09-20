import { Router } from "express";
import { ReferralService } from "./referral-service.js";
import { AuthenticatedRequest, requireAuth, requireAdmin } from "./middleware.js";
import { logCoreAudit } from "./core-service.js";
import { supabaseAdmin } from "./supabase-admin.js";
import { SystemConfigRepository } from "./supabase/system-config-repository.js";

const router = Router();
const referralService = ReferralService.getInstance();

/**
 * GET /api/admin/referral/config
 */
router.get("/config", requireAuth, requireAdmin, async (req, res) => {
  try {
    const config = await referralService.getConfig();
    res.json({ success: true, data: config });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/admin/referral/config
 */
router.put("/config", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { config } = req.body;
    const actor = { uid: req.user!.uid, email: req.user!.email || "admin@istore.co.id" };
    
    const updatedConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.email
    };

    await SystemConfigRepository.getInstance().upsertConfig("referral_config", updatedConfig);
    
    await logCoreAudit(
      actor,
      "admin",
      "REFERRAL_CONFIG_UPDATED",
      "systemConfigs/referral_config",
      null,
      updatedConfig
    );

    res.json({ success: true, data: updatedConfig });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/referral/relationships
 */
router.get("/relationships", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const p = Number(page);
    const l = Number(limit);
    const startIndex = (p - 1) * l;
    const endIndex = startIndex + l - 1;

    if (!supabaseAdmin) {
      throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");
    }

    let query = supabaseAdmin
      .from("referral_relationships")
      .select("*", { count: "exact" });

    if (status && status !== 'ALL') {
      query = query.eq("status", status);
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(startIndex, endIndex);

    if (error) {
      throw error;
    }

    const mappedItems = (data || []).map(row => ({
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

    const total = count || 0;

    res.json({
      success: true,
      data: mappedItems,
      pagination: {
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
