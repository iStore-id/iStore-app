import { Router } from "express";
import { MembershipService } from "./membership-service";
import { requireAdmin, AuthenticatedRequest } from "./middleware";
import { supabaseAdmin } from "./supabase-admin";

const router = Router();
const membershipService = MembershipService.getInstance();

// Apply admin protection to all routes
router.use(requireAdmin);

// PLANS
router.get("/plans", async (req: AuthenticatedRequest, res) => {
  try {
    const plans = await membershipService.getMembershipPlans();
    res.json(plans);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/plans", async (req: AuthenticatedRequest, res) => {
  try {
    const plan = await membershipService.createMembershipPlan(req.body);
    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/plans/:id", async (req: AuthenticatedRequest, res) => {
  try {
    await membershipService.updateMembershipPlan(req.params.id, req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// MEMBERS
router.get("/members", async (req: AuthenticatedRequest, res) => {
  try {
    const { data } = await supabaseAdmin!.from("customer_memberships").select("*");
    res.json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/stats", async (req: AuthenticatedRequest, res) => {
  try {
    const { count: activeCount } = await supabaseAdmin!.from("customer_memberships").select("*", { count: 'exact', head: true }).eq("status", "ACTIVE");
    const { count: totalCount } = await supabaseAdmin!.from("customer_memberships").select("*", { count: 'exact', head: true });
    
    res.json({
      activeMembers: activeCount || 0,
      totalMembers: totalCount || 0,
      plansCount: 0 // TODO: implement properly if needed
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ACTIONS
router.post("/members/:uid/assign", async (req: AuthenticatedRequest, res) => {
  try {
    const { planId } = req.body;
    const membership = await membershipService.assignMembership(req.params.uid, planId);
    res.json(membership);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/members/:uid/suspend", async (req: AuthenticatedRequest, res) => {
  try {
    await supabaseAdmin!
      .from("customer_memberships")
      .update({ status: 'SUSPENDED', updated_at: new Date().toISOString() })
      .eq("id", req.params.uid);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/members/:uid/resume", async (req: AuthenticatedRequest, res) => {
  try {
    await supabaseAdmin!
      .from("customer_memberships")
      .update({ status: 'ACTIVE', updated_at: new Date().toISOString() })
      .eq("id", req.params.uid);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/members/:uid/cancel", async (req: AuthenticatedRequest, res) => {
  try {
    await supabaseAdmin!
      .from("customer_memberships")
      .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
      .eq("id", req.params.uid);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
