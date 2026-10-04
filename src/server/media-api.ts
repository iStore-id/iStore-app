import { Response } from "express";
import { AuthenticatedRequest } from "./middleware.js";
import { MediaService } from "./media-service.js";
import { AuditLogRepository } from "./supabase/audit-log-repository.js";
import multer from "multer";

const mediaService = MediaService.getInstance();
const upload = multer({ storage: multer.memoryStorage() });

export const uploadMiddleware: any = upload.single("file");

async function logAudit(req: AuthenticatedRequest, action: string, resource: string, resourceId: string, payload: any) {
  await AuditLogRepository.getInstance().createLog({
    actor: { uid: req.user?.uid || "system", email: req.user?.email || "system" },
    role: req.user?.role || "admin",
    action,
    target: `${resource}/${resourceId}`,
    after: payload,
    reason: payload?.reason || "Media operation",
    timestamp: new Date().toISOString()
  });
}

export async function getMediaLibraryApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { folder, mimeType, search, limit } = req.query;
    const result = await mediaService.getMediaItems({
      folder: folder as string,
      mimeType: mimeType as string,
      search: search as string,
      limit: limit ? Number(limit) : 50
    });
    return res.status(200).json({ success: true, data: result.items, total: result.total });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function uploadMediaApi(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "File gambar wajib diunggah." });
    }
    const { folder, altText } = req.body;
    const mediaItem = await mediaService.uploadMedia(
      {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      },
      req.user.uid,
      folder || 'general',
      altText || ''
    );

    await logAudit(req, "MEDIA_UPLOAD", "mediaLibrary", mediaItem.id, { fileName: mediaItem.fileName, folder: mediaItem.folder });
    return res.status(201).json({ success: true, data: mediaItem });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function updateMediaMetadataApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { altText, folder } = req.body;
    const updated = await mediaService.updateMediaMetadata(id, { altText, folder });
    await logAudit(req, "MEDIA_UPDATE", "mediaLibrary", id, { altText, folder });
    return res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function deleteMediaApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await mediaService.deleteMedia(id);
    await logAudit(req, "MEDIA_DELETE", "mediaLibrary", id, {});
    return res.status(200).json({ success: true, message: "Asset berhasil dihapus." });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}
