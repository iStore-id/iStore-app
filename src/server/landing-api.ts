import { Request, Response } from "express";
import { AuthenticatedRequest } from "./middleware";
import { LandingService } from "./landing-service";
import { adminDb } from "./firebase-admin";

const landingService = LandingService.getInstance();

async function logAudit(
  req: AuthenticatedRequest,
  action: string,
  resourceId: string,
  payload: any
) {
  try {
    const auditRef = adminDb.collection("auditLogs").doc();
    await auditRef.set({
      id: auditRef.id,
      actorUid: req.user?.uid || "system",
      actorEmail: req.user?.email || "system",
      action,
      resource: "landing",
      resourceId,
      payload,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[Landing API] Audit log error:", error);
  }
}

// ==========================================
// PUBLIC ENDPOINTS
// ==========================================

export async function getPublicLandingPageApi(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({ success: false, message: "Slug landing page diperlukan." });
    }

    const landing = await landingService.getPublicLandingPage(slug);
    if (!landing) {
      return res.status(404).json({
        success: false,
        message: "Landing page tidak ditemukan atau belum aktif."
      });
    }

    return res.status(200).json({
      success: true,
      data: landing
    });
  } catch (error: any) {
    console.error("[Public Landing API Error]:", error);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
}

// ==========================================
// ADMIN ENDPOINTS
// ==========================================

export async function getAdminLandingPagesApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { page, limit, search, status, includeArchived } = req.query;
    const result = await landingService.getAdminLandingPages({
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
      search: search as string,
      status: status as string,
      includeArchived: includeArchived === "true" || includeArchived === undefined
    });

    return res.status(200).json({
      success: true,
      data: result.items,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages
    });
  } catch (error: any) {
    console.error("[Admin Get Landings Error]:", error);
    return res.status(500).json({ success: false, message: error.message || "Gagal memuat Landing Pages." });
  }
}

export async function getAdminLandingPageByIdApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const landing = await landingService.getLandingPageById(id);
    if (!landing) {
      return res.status(404).json({ success: false, message: "Landing Page tidak ditemukan." });
    }
    return res.status(200).json({ success: true, data: landing });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAdminLandingPagePreviewApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const previewData = await landingService.getPreviewLandingPage(id);
    if (!previewData) {
      return res.status(404).json({ success: false, message: "Landing Page tidak ditemukan untuk dipratinjau." });
    }
    return res.status(200).json({ success: true, data: previewData });
  } catch (error: any) {
    console.error("[Admin Preview Landing Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAdminLandingComponentsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const components = await landingService.getAvailableComponents();
    return res.status(200).json({ success: true, data: components });
  } catch (error: any) {
    console.error("[Admin Components Data Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function createLandingPageApi(req: AuthenticatedRequest, res: Response) {
  try {
    const uid = req.user?.uid || "system";
    const newLanding = await landingService.createLandingPage(req.body, uid);
    await logAudit(req, "LANDING_CREATE", newLanding.id, {
      name: newLanding.name,
      slug: newLanding.slug,
      published: newLanding.published
    });
    return res.status(201).json({ success: true, data: newLanding });
  } catch (error: any) {
    console.error("[Create Landing Error]:", error);
    return res.status(400).json({ success: false, message: error.message || "Gagal membuat Landing Page." });
  }
}

export async function updateLandingPageApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const uid = req.user?.uid || "system";
    const updated = await landingService.updateLandingPage(id, req.body, uid);
    await logAudit(req, "LANDING_UPDATE", id, {
      name: updated.name,
      slug: updated.slug,
      published: updated.published,
      enabled: updated.enabled
    });
    return res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    console.error("[Update Landing Error]:", error);
    return res.status(400).json({ success: false, message: error.message || "Gagal memperbarui Landing Page." });
  }
}

export async function publishLandingPageApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const uid = req.user?.uid || "system";
    const { published } = req.body;
    const updated = await landingService.publishLandingPage(id, !!published, uid);
    await logAudit(req, published ? "LANDING_PUBLISH" : "LANDING_UNPUBLISH", id, {
      published: updated.published,
      status: updated.status
    });
    return res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function archiveLandingPageApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const uid = req.user?.uid || "system";
    const archived = await landingService.archiveLandingPage(id, uid);
    await logAudit(req, "LANDING_ARCHIVE", id, { isArchived: true });
    return res.status(200).json({ success: true, data: archived });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function deleteLandingPageApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await landingService.deleteLandingPage(id);
    await logAudit(req, "LANDING_DELETE", id, {});
    return res.status(200).json({ success: true, message: "Landing Page berhasil dihapus." });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}
