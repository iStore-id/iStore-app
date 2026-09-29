import { Request, Response } from "express";
import { AuthenticatedRequest } from "./middleware.js";
import { BlogService } from "./blog-service.js";
import { AuditLogRepository } from "./supabase/audit-log-repository.js";

const blogService = BlogService.getInstance();

async function logAudit(
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
      target: `blog/${resourceId}`,
      after: payload,
      reason: payload?.reason || "Blog operation",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[Blog API] Audit log error:", error);
  }
}

// ==========================================
// PUBLIC ENDPOINTS
// ==========================================

export async function getPublicBlogsApi(req: Request, res: Response) {
  try {
    const { page, limit, category, tag, search } = req.query;
    const result = await blogService.getPublicBlogs({
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 9,
      category: category as string,
      tag: tag as string,
      search: search as string
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
    console.error("[Public Blog API Error]:", error);
    return res.status(500).json({ success: false, message: "Gagal memuat artikel blog." });
  }
}

export async function getPublicBlogBySlugApi(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({ success: false, message: "Slug artikel diperlukan." });
    }

    const blog = await blogService.getPublicBlogBySlug(slug);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Artikel tidak ditemukan atau belum aktif."
      });
    }

    return res.status(200).json({
      success: true,
      data: blog
    });
  } catch (error: any) {
    console.error("[Public Blog Detail API Error]:", error);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
}

// ==========================================
// ADMIN ENDPOINTS
// ==========================================

export async function getAdminBlogsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { page, limit, search, status, category, includeArchived } = req.query;
    const result = await blogService.getAdminBlogs({
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
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
    console.error("[Admin Blog List Error]:", error);
    return res.status(500).json({ success: false, message: error.message || "Gagal memuat daftar artikel." });
  }
}

export async function getAdminBlogComponentsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await blogService.getAvailableComponents();
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error("[Admin Blog Components Error]:", error);
    return res.status(500).json({ success: false, message: "Gagal memuat data komponen." });
  }
}

export async function getAdminBlogByIdApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const blog = await blogService.getAdminBlogById(id);
    if (!blog) {
      return res.status(404).json({ success: false, message: "Artikel tidak ditemukan." });
    }
    return res.status(200).json({ success: true, data: blog });
  } catch (error: any) {
    console.error("[Admin Blog By Id Error]:", error);
    return res.status(500).json({ success: false, message: error.message || "Gagal memuat artikel." });
  }
}

export async function getAdminBlogPreviewApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const blog = await blogService.getPreviewBlog(id);
    if (!blog) {
      return res.status(404).json({ success: false, message: "Artikel tidak ditemukan untuk pratinjau." });
    }
    return res.status(200).json({ success: true, data: blog });
  } catch (error: any) {
    console.error("[Admin Blog Preview Error]:", error);
    return res.status(500).json({ success: false, message: error.message || "Gagal memuat pratinjau artikel." });
  }
}

export async function createBlogApi(req: AuthenticatedRequest, res: Response) {
  try {
    const uid = req.user?.uid || "system";
    const newBlog = await blogService.createBlog(req.body, uid);

    await logAudit(req, "CREATE_BLOG", newBlog.id, {
      title: newBlog.title,
      slug: newBlog.slug,
      category: newBlog.category,
      published: newBlog.published,
      enabled: newBlog.enabled
    });

    return res.status(201).json({
      success: true,
      message: "Artikel Blog berhasil dibuat.",
      data: newBlog
    });
  } catch (error: any) {
    console.error("[Admin Create Blog Error]:", error);
    return res.status(400).json({ success: false, message: error.message || "Gagal membuat artikel blog." });
  }
}

export async function updateBlogApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const uid = req.user?.uid || "system";
    const existing = await blogService.getAdminBlogById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Artikel Blog tidak ditemukan." });
    }

    const updatedBlog = await blogService.updateBlog(id, req.body, uid);

    const auditPayload: any = {
      title: updatedBlog.title,
      category: updatedBlog.category,
      published: updatedBlog.published,
      enabled: updatedBlog.enabled
    };

    if (existing.slug !== updatedBlog.slug) {
      auditPayload.previousSlug = existing.slug;
      auditPayload.newSlug = updatedBlog.slug;
    }

    await logAudit(req, "UPDATE_BLOG", id, auditPayload);

    return res.status(200).json({
      success: true,
      message: "Artikel Blog berhasil diperbarui.",
      data: updatedBlog
    });
  } catch (error: any) {
    console.error("[Admin Update Blog Error]:", error);
    return res.status(400).json({ success: false, message: error.message || "Gagal memperbarui artikel blog." });
  }
}

export async function publishBlogApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { published } = req.body;
    const uid = req.user?.uid || "system";

    const blog = await blogService.publishBlog(id, Boolean(published), uid);
    await logAudit(req, published ? "PUBLISH_BLOG" : "UNPUBLISH_BLOG", id, { published });

    return res.status(200).json({
      success: true,
      message: published ? "Artikel berhasil dipublikasikan." : "Artikel ditarik ke draft.",
      data: blog
    });
  } catch (error: any) {
    console.error("[Admin Publish Blog Error]:", error);
    return res.status(400).json({ success: false, message: error.message || "Gagal mengubah status publikasi." });
  }
}

export async function archiveBlogApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const uid = req.user?.uid || "system";

    const blog = await blogService.archiveBlog(id, uid);
    await logAudit(req, "ARCHIVE_BLOG", id, { isArchived: true });

    return res.status(200).json({
      success: true,
      message: "Artikel berhasil diarsipkan.",
      data: blog
    });
  } catch (error: any) {
    console.error("[Admin Archive Blog Error]:", error);
    return res.status(400).json({ success: false, message: error.message || "Gagal mengarsipkan artikel." });
  }
}

export async function restoreBlogApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const uid = req.user?.uid || "system";

    const blog = await blogService.restoreBlog(id, uid);
    await logAudit(req, "RESTORE_BLOG", id, { isArchived: false });

    return res.status(200).json({
      success: true,
      message: "Artikel berhasil dipulihkan dari arsip.",
      data: blog
    });
  } catch (error: any) {
    console.error("[Admin Restore Blog Error]:", error);
    return res.status(400).json({ success: false, message: error.message || "Gagal memulihkan artikel." });
  }
}

export async function deleteBlogApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const blog = await blogService.getAdminBlogById(id);
    if (!blog) {
      return res.status(404).json({ success: false, message: "Artikel tidak ditemukan." });
    }

    await blogService.deleteBlog(id);
    await logAudit(req, "DELETE_BLOG", id, { title: blog.title, slug: blog.slug });

    return res.status(200).json({
      success: true,
      message: "Artikel berhasil dihapus permanen. Asset referensi tetap aman."
    });
  } catch (error: any) {
    console.error("[Admin Delete Blog Error]:", error);
    return res.status(400).json({ success: false, message: error.message || "Gagal menghapus artikel." });
  }
}
