import { Response } from "express";
import { AuthenticatedRequest } from "./middleware.js";
import {
  getPrivacySettings,
  getPublicPrivacySettings,
  updatePrivacySettings,
  resetPrivacySettings
} from "./privacy-service.js";

/**
 * Public Endpoint: GET /api/public/privacy
 * Returns public-safe privacy policy, terms of service, and cookie consent config
 */
export async function getPublicPrivacyApi(req: any, res: Response) {
  try {
    const settings = await getPrivacySettings();
    const publicData = getPublicPrivacySettings(settings);
    return res.json({
      success: true,
      data: publicData
    });
  } catch (error: any) {
    console.error("[API] getPublicPrivacyApi error:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memuat informasi kebijakan privasi."
    });
  }
}

/**
 * Admin Endpoint: GET /api/admin/privacy
 * Requires settings:view permission
 */
export async function getAdminPrivacyApi(req: AuthenticatedRequest, res: Response) {
  try {
    const settings = await getPrivacySettings();
    return res.json({
      success: true,
      data: settings
    });
  } catch (error: any) {
    console.error("[API] getAdminPrivacyApi error:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memuat pengaturan privasi admin."
    });
  }
}

/**
 * Admin Endpoint: PUT /api/admin/privacy
 * Requires settings:edit permission
 */
export async function updateAdminPrivacyApi(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = {
      uid: req.user?.uid || "system",
      email: req.user?.email || "owner@istore.co.id"
    };
    const role = req.user?.role || "pemilik";
    const updates = req.body;

    if (!updates || typeof updates !== "object") {
      return res.status(400).json({
        success: false,
        message: "Payload pembaruan tidak valid."
      });
    }

    // Validation
    if (updates.dpoContact?.email) {
      const email = updates.dpoContact.email.trim();
      if (email && (!email.includes("@") || !email.includes("."))) {
        return res.status(400).json({
          success: false,
          message: "Format email kontak perlindungan data tidak valid."
        });
      }
    }

    if (updates.dataRetention?.retentionMonths !== undefined) {
      const months = Number(updates.dataRetention.retentionMonths);
      if (isNaN(months) || months < 0 || months > 120) {
        return res.status(400).json({
          success: false,
          message: "Periode retensi data harus berupa angka antara 0 hingga 120 bulan (0 = tanpa batas)."
        });
      }
    }

    const updated = await updatePrivacySettings(actor, role, updates);

    return res.json({
      success: true,
      message: "Pengaturan privasi dan ketentuan layanan berhasil disimpan.",
      data: updated
    });
  } catch (error: any) {
    console.error("[API] updateAdminPrivacyApi error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal memperbarui pengaturan privasi."
    });
  }
}

/**
 * Admin Endpoint: POST /api/admin/privacy/reset
 * Requires settings:edit permission
 */
export async function resetAdminPrivacyApi(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = {
      uid: req.user?.uid || "system",
      email: req.user?.email || "owner@istore.co.id"
    };
    const role = req.user?.role || "pemilik";

    const resetData = await resetPrivacySettings(actor, role);

    return res.json({
      success: true,
      message: "Pengaturan privasi berhasil dikembalikan ke standar awal.",
      data: resetData
    });
  } catch (error: any) {
    console.error("[API] resetAdminPrivacyApi error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal mereset pengaturan privasi."
    });
  }
}
