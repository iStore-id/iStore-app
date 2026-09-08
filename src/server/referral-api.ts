import { Router } from "express";
import { ReferralService } from "./referral-service";
import { AuthenticatedRequest, requireAuth } from "./middleware";
import { adminDb } from "./firebase-admin";

const router = Router();
const referralService = ReferralService.getInstance();

/**
 * GET /api/referral/me
 * Get current user's referral stats and code
 */
router.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.uid;
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data();

    const statsSnap = await adminDb.collection("referralRelationships")
      .where("referrerUid", "==", userId)
      .get();
    
    let convertedCount = 0;
    statsSnap.forEach(doc => {
      if (doc.data().status === 'CONVERTED') convertedCount++;
    });

    res.json({
      success: true,
      data: {
        referralCode: userData?.referralCode || null,
        referredBy: userData?.referredBy || null,
        stats: {
          totalReferrals: statsSnap.size,
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
