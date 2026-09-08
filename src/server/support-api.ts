import { Router } from "express";
import { TicketService } from "./ticket-service";
import { SupportService } from "./support-service";
import { requireAuth, AuthenticatedRequest } from "./middleware";
import { adminDb } from "./firebase-admin";

const router = Router();
const ticketService = TicketService.getInstance();
const supportService = SupportService.getInstance();

// Create Case
router.post("/cases", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const actor = {
      uid: req.user.uid,
      email: req.user.email,
      name: req.user.name || req.user.email.split('@')[0]
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
    const cases = await supportService.getCustomerCases(req.user.uid);
    res.json(cases);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Case Detail
router.get("/cases/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const caseRef = adminDb.collection("supportCases").doc(req.params.id);
    const snap = await caseRef.get();
    
    if (!snap.exists) return res.status(404).json({ error: "Case not found" });
    const data = snap.data();
    
    if (data?.customerUid !== req.user.uid) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const messagesSnap = await caseRef.collection("messages")
      .where("isInternal", "==", false)
      .orderBy("createdAt", "asc")
      .get();
    
    const messages = messagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json({
      ...data,
      id: snap.id,
      messages
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send Message
router.post("/cases/:id/messages", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const caseRef = adminDb.collection("supportCases").doc(req.params.id);
    const snap = await caseRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Case not found" });
    if (snap.data()?.customerUid !== req.user.uid) return res.status(403).json({ error: "Forbidden" });

    const actor = {
      uid: req.user.uid,
      email: req.user.email,
      name: req.user.name || req.user.email.split('@')[0],
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
    const caseRef = adminDb.collection("supportCases").doc(req.params.id);
    const snap = await caseRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Case not found" });
    if (snap.data()?.customerUid !== req.user.uid) return res.status(403).json({ error: "Forbidden" });

    await ticketService.updateStatus(req.params.id, 'CLOSED', {
      uid: req.user.uid,
      email: req.user.email
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
