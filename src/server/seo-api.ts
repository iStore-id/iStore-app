import { Request, Response } from "express";
import { AuthenticatedRequest } from "./middleware";
import { seoService } from "./seo-service";
import { getUserRole } from "./auth-service";

/**
 * GET /api/public/seo
 * Public safe metadata resolution
 */
export async function getPublicSEOSettings(req: Request, res: Response) {
  try {
    const publicSettings = await seoService.getPublicSettings();
    return res.status(200).json({ success: true, data: publicSettings });
  } catch (error: any) {
    console.error("[SEO API] getPublicSEOSettings error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to load SEO configuration" });
  }
}

/**
 * GET /api/admin/seo
 * Full admin SEO settings
 */
export async function getAdminSEOSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const settings = await seoService.getSettings();
    return res.status(200).json({ success: true, data: settings });
  } catch (error: any) {
    console.error("[SEO API] getAdminSEOSettings error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to load admin SEO settings" });
  }
}

/**
 * PUT /api/admin/seo
 * Update SEO settings (Owner/Admin with permission)
 */
export async function updateAdminSEOSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = {
      uid: req.user?.uid || "unknown",
      email: req.user?.email || "unknown@istore.co.id"
    };
    const actorRole = await getUserRole(actor.uid);

    const updates = req.body;
    const updated = await seoService.updateSettings(
      actor,
      actorRole,
      updates,
      req.body.reason || "Manual update from Admin SEO panel"
    );

    return res.status(200).json({
      success: true,
      message: "Konfigurasi SEO berhasil diperbarui",
      data: updated
    });
  } catch (error: any) {
    console.error("[SEO API] updateAdminSEOSettings error:", error);
    return res.status(400).json({ success: false, message: error.message || "Gagal memperbarui konfigurasi SEO" });
  }
}

/**
 * POST /api/admin/seo/reset
 * Reset SEO settings to safe production defaults
 */
export async function resetAdminSEOSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = {
      uid: req.user?.uid || "unknown",
      email: req.user?.email || "unknown@istore.co.id"
    };
    const actorRole = await getUserRole(actor.uid);

    const resetData = await seoService.resetToDefaults(actor, actorRole);
    return res.status(200).json({
      success: true,
      message: "Konfigurasi SEO berhasil direset ke nilai default aman",
      data: resetData
    });
  } catch (error: any) {
    console.error("[SEO API] resetAdminSEOSettings error:", error);
    return res.status(500).json({ success: false, message: error.message || "Gagal mereset konfigurasi SEO" });
  }
}

/**
 * GET /robots.txt
 * Authoritative robots.txt handler
 */
export async function getRobotsTxt(req: Request, res: Response) {
  try {
    const hostHeader = req.get("host") || "";
    const robotsContent = await seoService.generateRobotsTxt(hostHeader);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600"); // 1 hour browser cache
    return res.status(200).send(robotsContent);
  } catch (error: any) {
    console.error("[SEO API] getRobotsTxt error:", error);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(200).send("User-agent: *\nDisallow: /admin/\nDisallow: /api/\n");
  }
}

/**
 * GET /sitemap.xml
 * Authoritative sitemap.xml handler
 */
export async function getSitemapXml(req: Request, res: Response) {
  try {
    const sitemapXml = await seoService.generateSitemapXml();
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=1800"); // 30 minutes browser cache
    return res.status(200).send(sitemapXml);
  } catch (error: any) {
    console.error("[SEO API] getSitemapXml error:", error);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    return res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`);
  }
}
