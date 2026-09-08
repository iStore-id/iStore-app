import { Router } from "express";
import { ReferralService } from "./referral-service";
import { AuthenticatedRequest, requireAuth, requireAdmin } from "./middleware";
import { adminDb } from "./firebase-admin";
import { logCoreAudit } from "./core-service";

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

    await adminDb.collection("systemConfigs").doc("referral_config").set(updatedConfig);
    
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
    let query: FirebaseFirestore.Query = adminDb.collection("referralRelationships");

    if (status && status !== 'ALL') {
      query = query.where("status", "==", status);
    }

    const snap = await query.orderBy("createdAt", "desc").get();
    const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Manual pagination for simplicity in MVP
    const total = items.length;
    const startIndex = (Number(page) - 1) * Number(limit);
    const paginatedItems = items.slice(startIndex, startIndex + Number(limit));

    res.json({
      success: true,
      data: paginatedItems,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
