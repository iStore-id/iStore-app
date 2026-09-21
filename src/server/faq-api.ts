import { Request, Response } from "express";
import { AuthenticatedRequest } from "./middleware.js";
import { FAQService } from "./faq-service.js";
import { AuditLogRepository } from "./supabase/audit-log-repository.js";

const faqService = FAQService.getInstance();

async function logFaqAudit(
  req: AuthenticatedRequest,
  action: string,
  resourceId: string,
  payload: any
) {
  try {
    await AuditLogRepository.getInstance().createLog({
      actor: { uid: req.user?.uid || "system", email: req.user?.email || "system" },
      role: req.user?.role || "admin",
      action,
      target: `faq/${resourceId}`,
      after: payload,
      reason: payload?.reason || "FAQ operation",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[FAQ API] Audit log error:", error);
  }
}

// ==========================================
// PUBLIC ENDPOINTS
// ==========================================

export async function getPublicFaqsApi(req: Request, res: Response) {
  try {
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    const { category, search } = req.query;
    const result = await faqService.getPublicFaqs({
      category: category as string,
      search: search as string
    });

    return res.status(200).json({
      success: true,
      data: result.items,
      total: result.total,
      categories: result.categories
    });
  } catch (error: any) {
    console.error("[Public FAQ API Error]:", error);
    return res.status(500).json({ success: false, message: "Gagal memuat FAQ publik." });
  }
}

export async function getPublicFaqByIdApi(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: "ID FAQ diperlukan." });
    }

    const faq = await faqService.getPublicFaqById(id);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ tidak ditemukan atau belum dipublikasikan."
      });
    }

    return res.status(200).json({
      success: true,
      data: faq
    });
  } catch (error: any) {
    console.error("[Public FAQ Detail Error]:", error);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
}

// ==========================================
// ADMIN ENDPOINTS
// ==========================================

export async function getAdminFaqsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { page, limit, search, status, category, includeArchived } = req.query;
    const result = await faqService.getAdminFaqs({
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 15,
      search: search as string,
      status: status as string,
      category: category as string,
      includeArchived: includeArchived === "true" || includeArchived === undefined
    });

    return res.status(200).json({
      success: true,
      data: result.items,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      categories: result.categories
    });
  } catch (error: any) {
    console.error("[Admin FAQ List Error]:", error);
    return res.status(500).json({ success: false, message: error.message || "Gagal memuat daftar FAQ." });
  }
}

export async function getAdminFaqComponentsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await faqService.getAvailableComponents();
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error("[Admin FAQ Components Error]:", error);
    return res.status(500).json({ success: false, message: "Gagal memuat data referensi komponen." });
  }
}

export async function getAdminFaqByIdApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const faq = await faqService.getAdminFaqById(id);
    if (!faq) {
      return res.status(404).json({ success: false, message: "FAQ tidak ditemukan." });
    }
    return res.status(200).json({ success: true, data: faq });
  } catch (error: any) {
    console.error("[Admin FAQ By Id Error]:", error);
    return res.status(500).json({ success: false, message: error.message || "Gagal memuat detail FAQ." });
  }
}

export async function createFaqApi(req: AuthenticatedRequest, res: Response) {
  try {
    const uid = req.user?.uid || "system";
    const newFaq = await faqService.createFaq(req.body, uid);

    await logFaqAudit(req, "CREATE_FAQ", newFaq.id, {
      question: newFaq.question,
      category: newFaq.category,
      sortOrder: newFaq.sortOrder,
      published: newFaq.published,
      enabled: newFaq.enabled
    });

    return res.status(201).json({
      success: true,
      message: "FAQ berhasil ditambahkan.",
      data: newFaq
    });
  } catch (error: any) {
    console.error("[Admin Create FAQ Error]:", error);
    return res.status(400).json({ success: false, message: error.message || "Gagal membuat FAQ." });
  }
}

export async function updateFaqApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const uid = req.user?.uid || "system";
    const existing = await faqService.getAdminFaqById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "FAQ tidak ditemukan." });
    }

    const updatedFaq = await faqService.updateFaq(id, req.body, uid);

    const auditPayload: any = {
      question: updatedFaq.question,
      category: updatedFaq.category,
      sortOrder: updatedFaq.sortOrder,
      published: updatedFaq.published,
      enabled: updatedFaq.enabled
    };

    if (existing.category !== updatedFaq.category) {
      auditPayload.categoryChanged = { from: existing.category, to: updatedFaq.category };
    }

    await logFaqAudit(req, "UPDATE_FAQ", id, auditPayload);

    return res.status(200).json({
      success: true,
      message: "FAQ berhasil diperbarui.",
      data: updatedFaq
    });
  } catch (error: any) {
    console.error("[Admin Update FAQ Error]:", error);
    return res.status(400).json({ success: false, message: error.message || "Gagal memperbarui FAQ." });
  }
}

export async function publishFaqApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { published } = req.body;
    const uid = req.user?.uid || "system";

    const faq = await faqService.publishFaq(id, Boolean(published), uid);
    await logFaqAudit(req, published ? "PUBLISH_FAQ" : "UNPUBLISH_FAQ", id, { published: Boolean(published) });

    return res.status(200).json({
      success: true,
      message: published ? "FAQ berhasil dipublikasikan." : "FAQ ditarik ke draft.",
      data: faq
    });
  } catch (error: any) {
    console.error("[Admin Publish FAQ Error]:", error);
    return res.status(400).json({ success: false, message: error.message || "Gagal mengubah status publikasi FAQ." });
  }
}

export async function toggleEnableFaqApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const uid = req.user?.uid || "system";

    const faq = await faqService.toggleEnableFaq(id, Boolean(enabled), uid);
    await logFaqAudit(req, enabled ? "ENABLE_FAQ" : "DISABLE_FAQ", id, { enabled: Boolean(enabled) });

    return res.status(200).json({
      success: true,
      message: enabled ? "FAQ diaktifkan." : "FAQ dinonaktifkan.",
      data: faq
    });
  } catch (error: any) {
    console.error("[Admin Toggle FAQ Error]:", error);
    return res.status(400).json({ success: false, message: error.message || "Gagal mengubah status aktif FAQ." });
  }
}

export async function archiveFaqApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const uid = req.user?.uid || "system";

    const faq = await faqService.archiveFaq(id, uid);
    await logFaqAudit(req, "ARCHIVE_FAQ", id, { archived: true });

    return res.status(200).json({
      success: true,
      message: "FAQ berhasil diarsipkan.",
      data: faq
    });
  } catch (error: any) {
    console.error("[Admin Archive FAQ Error]:", error);
    return res.status(400).json({ success: false, message: error.message || "Gagal mengarsipkan FAQ." });
  }
}

export async function reorderFaqsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { items } = req.body;
    const uid = req.user?.uid || "system";

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, message: "Daftar urutan items diperlukan." });
    }

    await faqService.reorderFaqs(items, uid);
    await logFaqAudit(req, "REORDER_FAQS", "multiple", { count: items.length });

    return res.status(200).json({
      success: true,
      message: "Urutan FAQ berhasil disimpan."
    });
  } catch (error: any) {
    console.error("[Admin Reorder FAQ Error]:", error);
    return res.status(400).json({ success: false, message: error.message || "Gagal menyimpan urutan FAQ." });
  }
}

export async function deleteFaqApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const faq = await faqService.getAdminFaqById(id);
    if (!faq) {
      return res.status(404).json({ success: false, message: "FAQ tidak ditemukan." });
    }

    await faqService.deleteFaq(id);
    await logFaqAudit(req, "DELETE_FAQ", id, {
      question: faq.question,
      category: faq.category
    });

    return res.status(200).json({
      success: true,
      message: "FAQ berhasil dihapus permanen. Asset/Entity referensi tetap aman."
    });
  } catch (error: any) {
    console.error("[Admin Delete FAQ Error]:", error);
    return res.status(400).json({ success: false, message: error.message || "Gagal menghapus FAQ." });
  }
}
