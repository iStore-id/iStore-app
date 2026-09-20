import { Router } from "express";
import { TicketService } from "./ticket-service.js";
import { SupportService } from "./support-service.js";
import { requireAuth, AuthenticatedRequest } from "./middleware.js";
import { supabaseAdmin } from "./supabase-admin.js";

const router = Router();
const ticketService = TicketService.getInstance();
const supportService = SupportService.getInstance();

// Create Case
router.post("/cases", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const actor = {
      uid: req.user!.uid,
      email: req.user!.email || "unknown@istore.id",
      name: (req.user as any).displayName || req.user!.email?.split('@')[0] || "User"
    };
    const newCase = await ticketService.createCase(req.body, actor);
    res.status(201).json(newCase);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List My Cases
router.get("/cases", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const cases = await supportService.getCustomerCases(req.user!.uid);
    res.json(cases);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Case Detail
router.get("/cases/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { data: caseRow } = await supabaseAdmin!
      .from("support_cases")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();
      
    if (!caseRow) return res.status(404).json({ error: "Case not found" });
    if (caseRow.customer_uid !== req.user!.uid) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { data: messagesData } = await supabaseAdmin!
      .from("support_messages")
      .select("*")
      .eq("case_id", req.params.id)
      .eq("is_internal", false)
      .order("created_at", { ascending: true });

    const messages = (messagesData || []).map(m => ({
      id: m.id,
      caseId: m.case_id,
      authorUid: m.author_uid,
      authorName: m.author_name,
      authorType: m.author_type,
      content: m.content,
      isInternal: m.is_internal,
      createdAt: m.created_at
    }));

    res.json({
      id: caseRow.id,
      customerUid: caseRow.customer_uid,
      orderId: caseRow.order_id,
      subject: caseRow.subject,
      category: caseRow.category,
      priority: caseRow.priority,
      status: caseRow.status,
      createdAt: caseRow.created_at,
      updatedAt: caseRow.updated_at,
      messages
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send Message
router.post("/cases/:id/messages", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { data: caseRow } = await supabaseAdmin!
      .from("support_cases")
      .select("customer_uid")
      .eq("id", req.params.id)
      .maybeSingle();

    if (!caseRow) return res.status(404).json({ error: "Case not found" });
    if (caseRow.customer_uid !== req.user!.uid) return res.status(403).json({ error: "Forbidden" });

    const actor = {
      uid: req.user!.uid,
      email: req.user!.email || "unknown@istore.id",
      name: (req.user as any).displayName || req.user!.email?.split('@')[0] || "User",
      type: 'USER' as const
    };

    const message = await ticketService.addMessage(req.params.id, {
      ...req.body,
      isInternal: false
    }, actor);
    res.status(201).json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Close Case
router.post("/cases/:id/close", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { data: caseRow } = await supabaseAdmin!
      .from("support_cases")
      .select("customer_uid")
      .eq("id", req.params.id)
      .maybeSingle();

    if (!caseRow) return res.status(404).json({ error: "Case not found" });
    if (caseRow.customer_uid !== req.user!.uid) return res.status(403).json({ error: "Forbidden" });

    await ticketService.updateStatus(req.params.id, 'CLOSED', {
      uid: req.user!.uid,
      email: req.user!.email || "unknown@istore.id"
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
