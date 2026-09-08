import { Request, Response } from "express";
import { AuthenticatedRequest } from "./middleware";
import { PopupService } from "./popup-service";
import { adminDb } from "./firebase-admin";

const popupService = PopupService.getInstance();

async function logAudit(req: AuthenticatedRequest, action: string, resourceId: string, payload: any) {
  const auditRef = adminDb.collection("auditLogs").doc();
  await auditRef.set({
    id: auditRef.id,
    actorUid: req.user?.uid || "system",
    actorEmail: req.user?.email || "system",
    action,
    resource: "popups",
    resourceId,
    payload,
    timestamp: new Date().toISOString()
  });
}

export async function getPublicPopupsApi(req: Request, res: Response) {
  try {
    const { placement } = req.query;
    if (!placement || typeof placement !== 'string') {
      return res.status(400).json({ success: false, message: "Parameter placement wajib diisi." });
    }
    const popups = await popupService.getPublicEligiblePopups(placement);
    // Sanitize public response (exclude audit info, createdBy, etc.)
    const sanitized = popups.map(p => ({
      id: p.id,
      name: p.name,
      title: p.title,
      content: p.content,
      mediaUrl: p.mediaUrl,
      placement: p.placement,
      trigger: p.trigger,
      target: p.target,
      priority: p.priority
    }));
    return res.status(200).json({ success: true, data: sanitized });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAdminPopupsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { placement } = req.query;
    const popups = await popupService.getPopups(placement as string);
    return res.status(200).json({ success: true, data: popups });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function createPopupApi(req: AuthenticatedRequest, res: Response) {
  try {
    const popup = await popupService.createPopup(req.body, req.user.uid);
    await logAudit(req, "POPUP_CREATE", popup.id, { name: popup.name, placement: popup.placement });
    return res.status(201).json({ success: true, data: popup });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function updatePopupApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const updated = await popupService.updatePopup(id, req.body, req.user.uid);
    await logAudit(req, "POPUP_UPDATE", id, req.body);
    return res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function deletePopupApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await popupService.deletePopup(id);
    await logAudit(req, "POPUP_DELETE", id, {});
    return res.status(200).json({ success: true, message: "Popup berhasil dihapus." });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}
