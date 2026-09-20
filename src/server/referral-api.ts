import { Router } from "express";
import { ReferralService } from "./referral-service.js";
import { AuthenticatedRequest, requireAuth } from "./middleware.js";
import { supabaseAdmin } from "./supabase-admin.js";

const router = Router();
const referralService = ReferralService.getInstance();

/**
 * GET /api/referral/me
 * Get current user's referral stats and code
 */
router.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.uid;

    if (!supabaseAdmin) {
      throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");
    }

    // Read from profiles
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("referral_code, referred_by")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    // Read relationships
    const { data: statsData, error: statsError } = await supabaseAdmin
      .from("referral_relationships")
      .select("status")
      .eq("referrer_uid", userId);

    if (statsError) {
      throw statsError;
    }

    let convertedCount = 0;
    const totalReferrals = statsData ? statsData.length : 0;
    if (statsData) {
      statsData.forEach(row => {
        if (row.status === 'CONVERTED') convertedCount++;
      });
    }

    res.json({
      success: true,
      data: {
        referralCode: profileData?.referral_code || null,
        referredBy: profileData?.referred_by || null,
        stats: {
          totalReferrals,
          convertedReferrals: convertedCount
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/referral/join
 * Generate a referral code for the user
 */
router.post("/join", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.uid;
    const code = await referralService.generateReferralCode(userId, { 
      uid: userId, 
      email: req.user!.email || "" 
    });
    res.json({ success: true, referralCode: code });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/referral/attribute
 * Attribute current user to a referrer code
 */
router.post("/attribute", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.uid;
    const { referralCode, source = 'MANUAL_INPUT' } = req.body;

    if (!referralCode) {
      return res.status(400).json({ success: false, message: "Kode referral wajib diisi." });
    }

    const result = await referralService.attributeCustomer(userId, referralCode, source);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }

    res.json({ success: true, message: result.message });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
