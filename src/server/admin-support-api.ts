import { Router } from "express";
import { TicketService } from "./ticket-service.js";
import { SupportService } from "./support-service.js";
import { requirePermission, AuthenticatedRequest } from "./middleware.js";
import { supabaseAdmin } from "./supabase-admin.js";

const router = Router();
const ticketService = TicketService.getInstance();
const supportService = SupportService.getInstance();

// Admin Queue
router.get("/cases", requirePermission('support', 'view'), async (req: AuthenticatedRequest, res) => {
  try {
    const filters = {
      status: req.query.status as string,
      priority: req.query.priority as string,
      category: req.query.category as string,
      assignedTo: req.query.assignedTo as string
    };
    const cases = await supportService.getAdminQueue(filters);
    res.json(cases);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Case Detail (Support 360)
router.get("/cases/:id", requirePermission('support', 'view'), async (req: AuthenticatedRequest, res) => {
  try {
    const context = await supportService.getSupport360(req.params.id);
    res.json(context);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send Message / Add Internal Note
router.post("/cases/:id/messages", requirePermission('support', 'reply'), async (req: AuthenticatedRequest, res) => {
  try {
    const actor = {
      uid: req.user.uid,
      email: req.user.email,
      name: (req.user as any).displayName || req.user.email || "Agent",
      type: 'AGENT' as const
    };
    const message = await ticketService.addMessage(req.params.id, req.body, actor);
    res.status(201).json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Assign Case
router.post("/cases/:id/assign", requirePermission('support', 'assign'), async (req: AuthenticatedRequest, res) => {
  try {
    await ticketService.assignAgent(req.params.id, req.body.agentUid, {
      uid: req.user.uid,
      email: req.user.email || "admin@istore.co.id"
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update Status
router.patch("/cases/:id/status", requirePermission('support', 'edit'), async (req: AuthenticatedRequest, res) => {
  try {
    await ticketService.updateStatus(req.params.id, req.body.status, {
      uid: req.user.uid,
      email: req.user.email || "admin@istore.co.id"
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update Priority
router.patch("/cases/:id/priority", requirePermission('support', 'escalate'), async (req: AuthenticatedRequest, res) => {
  try {
    await ticketService.updatePriority(req.params.id, req.body.priority, {
      uid: req.user.uid,
      email: req.user.email || "admin@istore.co.id"
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
