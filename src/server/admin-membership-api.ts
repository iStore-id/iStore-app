import { Router } from "express";
import { MembershipService } from "./membership-service";
import { requireAdmin, AuthenticatedRequest } from "./middleware";
import { adminDb } from "./firebase-admin";

const router = Router();
const membershipService = MembershipService.getInstance();

// Apply admin protection to all routes
router.use(requireAdmin);

// PLANS
router.get("/plans", async (req: AuthenticatedRequest, res) => {
  try {
    const plans = await membershipService.getPlans(true);
    res.json(plans);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/plans", async (req: AuthenticatedRequest, res) => {
  try {
    const plan = await membershipService.createPlan(req.body, { 
      uid: req.user!.uid, 
      email: req.user!.email || "admin@istore.co.id" 
    });
    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/plans/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const plan = await membershipService.updatePlan(req.params.id, req.body, { 
      uid: req.user!.uid, 
      email: req.user!.email || "admin@istore.co.id" 
    });
    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// MEMBERS
router.get("/members", async (req: AuthenticatedRequest, res) => {
  try {
    const snap = await adminDb.collection("customerMemberships").get();
    const members = snap.docs.map(doc => doc.data());
    res.json(members);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/stats", async (req: AuthenticatedRequest, res) => {
  try {
    const stats = await membershipService.getStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ACTIONS
router.post("/members/:uid/assign", async (req: AuthenticatedRequest, res) => {
  try {
    const { planId, reason } = req.body;
    const membership = await membershipService.activateMembership(
      req.params.uid,
      planId,
      'MANUAL',
      undefined,
      reason,
      { uid: req.user!.uid, email: req.user!.email || "admin@istore.co.id" }
    );
    res.json(membership);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/members/:uid/suspend", async (req: AuthenticatedRequest, res) => {
  try {
    await membershipService.updateMembershipStatus(
      req.params.uid,
      'SUSPENDED',
      req.body.reason || "Manual suspension",
      { uid: req.user!.uid, email: req.user!.email || "admin@istore.co.id" }
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/members/:uid/resume", async (req: AuthenticatedRequest, res) => {
  try {
    await membershipService.updateMembershipStatus(
      req.params.uid,
      'ACTIVE',
      req.body.reason || "Manual resumption",
      { uid: req.user!.uid, email: req.user!.email || "admin@istore.co.id" }
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/members/:uid/cancel", async (req: AuthenticatedRequest, res) => {
  try {
    await membershipService.updateMembershipStatus(
      req.params.uid,
      'CANCELLED',
      req.body.reason || "Manual cancellation",
      { uid: req.user!.uid, email: req.user!.email || "admin@istore.co.id" }
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
