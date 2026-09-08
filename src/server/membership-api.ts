import { Router } from "express";
import { MembershipService } from "./membership-service";
import { requireAuth, AuthenticatedRequest } from "./middleware";

const router = Router();
const membershipService = MembershipService.getInstance();

// Customer: Get active plans
router.get("/plans", async (req, res) => {
  try {
    const plans = await membershipService.getPlans();
    res.json(plans);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Customer: Get my membership status
router.get("/status", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const membership = await membershipService.getCustomerMembership(userId);
    res.json(membership || { status: 'NONE' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
