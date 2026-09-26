import { Request, Response } from "express";
import { AuthenticatedRequest } from "./middleware.js";
import { BannerService } from "./banner-service.js";
import { AuditLogRepository } from "./supabase/audit-log-repository.js";

const bannerService = BannerService.getInstance();

async function logAudit(req: AuthenticatedRequest, action: string, resourceId: string, payload: any) {
  await AuditLogRepository.getInstance().createLog({
    actor: { uid: req.user?.uid || "system", email: req.user?.email || "system" },
    role: req.user?.role || "admin",
    action,
    target: `banners/${resourceId}`,
    after: payload,
    reason: payload?.reason || "Banner operation",
    timestamp: new Date().toISOString()
  });
}

export async function getPublicBannersApi(req: Request, res: Response) {
  try {
    const { placement } = req.query;
    if (!placement || typeof placement !== 'string') {
      return res.status(400).json({ success: false, message: "Parameter placement wajib diisi." });
    }
    const banners = await bannerService.getPublicBanners(placement);
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    // Sanitize public response (exclude audit info, createdBy, etc.)
    const sanitized = banners.map(b => ({
      id: b.id,
      name: b.name,
      mediaUrl: b.mediaUrl,
      mediaWidth: b.mediaWidth,
      mediaHeight: b.mediaHeight,
      displayMode: b.displayMode || 'fit',
      placement: b.placement,
      title: b.title,
      altText: b.altText,
      target: b.target,
      sortOrder: b.sortOrder
    }));
    return res.status(200).json({ success: true, data: sanitized });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAdminBannersApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { placement } = req.query;
    const banners = await bannerService.getBanners(placement as string);
    return res.status(200).json({ success: true, data: banners });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function createBannerApi(req: AuthenticatedRequest, res: Response) {
  try {
    const banner = await bannerService.createBanner(req.body, req.user.uid);
    await logAudit(req, "BANNER_CREATE", banner.id, { name: banner.name, placement: banner.placement });
    return res.status(201).json({ success: true, data: banner });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function updateBannerApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const updated = await bannerService.updateBanner(id, req.body, req.user.uid);
    await logAudit(req, "BANNER_UPDATE", id, req.body);
    return res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function deleteBannerApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await bannerService.deleteBanner(id);
    await logAudit(req, "BANNER_DELETE", id, {});
    return res.status(200).json({ success: true, message: "Banner berhasil dihapus." });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}
