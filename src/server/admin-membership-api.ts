import { Router } from "express";
import { MembershipService } from "./membership-service.js";
import { requireAdmin, AuthenticatedRequest } from "./middleware.js";

const router = Router();
const membershipService = MembershipService.getInstance();

// All membership administration routes require an administrator.
router.use(requireAdmin);

router.get("/plans", async (_req: AuthenticatedRequest, res) => {
  try {
    res.json(await membershipService.getMembershipPlans());
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Gagal memuat paket membership." });
  }
});

router.post("/plans", async (req: AuthenticatedRequest, res) => {
  try {
    const plan = await membershipService.createMembershipPlan({
      ...req.body,
      updatedBy: req.user?.uid || req.user?.id || "admin"
    });
    res.status(201).json(plan);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Gagal membuat paket membership." });
  }
});

router.put("/plans/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const plan = await membershipService.updateMembershipPlan(req.params.id, {
      ...req.body,
      updatedBy: req.user?.uid || req.user?.id || "admin"
    });
    res.json(plan);
  } catch (error: any) {
    const status = /tidak ditemukan/i.test(error.message || "") ? 404 : 400;
    res.status(status).json({ error: error.message || "Gagal memperbarui paket membership." });
  }
});

router.get("/members", async (_req: AuthenticatedRequest, res) => {
  try {
    res.json(await membershipService.getCustomerMemberships());
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Gagal memuat daftar member." });
  }
});

router.get("/stats", async (_req: AuthenticatedRequest, res) => {
  try {
    res.json(await membershipService.getStats());
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Gagal memuat statistik membership." });
  }
});

router.post("/members/:uid/assign", async (req: AuthenticatedRequest, res) => {
  try {
    const { planId, reason } = req.body || {};
    if (!planId) return res.status(400).json({ error: "Pilih paket membership terlebih dahulu." });
    const membership = await membershipService.assignMembership(req.params.uid, planId, {
      source: "MANUAL",
      reason: typeof reason === "string" ? reason.trim() : "Manual action"
    });
    res.json(membership);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Gagal menetapkan membership." });
  }
});

router.post("/members/:uid/suspend", async (req: AuthenticatedRequest, res) => {
  try {
    await membershipService.updateMembershipStatus(req.params.uid, "SUSPENDED", req.body?.reason);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Gagal menangguhkan membership." });
  }
});

router.post("/members/:uid/resume", async (req: AuthenticatedRequest, res) => {
  try {
    const membership = await membershipService.getCustomerMembership(req.params.uid);
    if (!membership) return res.status(404).json({ error: "Membership pelanggan tidak ditemukan." });
    if (membership.expiryDate && new Date(membership.expiryDate).getTime() <= Date.now()) {
      await membershipService.updateMembershipStatus(req.params.uid, "EXPIRED", "Masa membership telah berakhir");
      return res.status(409).json({ error: "Membership telah kedaluwarsa dan tidak dapat dilanjutkan. Tetapkan paket baru." });
    }
    await membershipService.updateMembershipStatus(req.params.uid, "ACTIVE", req.body?.reason);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Gagal mengaktifkan kembali membership." });
  }
});

router.post("/members/:uid/cancel", async (req: AuthenticatedRequest, res) => {
  try {
    await membershipService.updateMembershipStatus(req.params.uid, "CANCELLED", req.body?.reason);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Gagal membatalkan membership." });
  }
});

export default router;
