import { SupabaseMediaRepository } from "./supabase/media-repository.js";
import { MediaItem } from "../types/cms.js";
import { v2 as cloudinary } from "cloudinary";

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml'
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function getCloudinary() {
  let cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName || cloudName === "istore") {
    cloudName = "azfwgjng";
  }
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudinaryUrl = process.env.CLOUDINARY_URL;

  if (!cloudinaryUrl && (!apiKey || !apiSecret)) {
    throw new Error("Storage backend Cloudinary belum dikonfigurasi. Harap atur environment variables CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, dan CLOUDINARY_API_SECRET pada platform settings.");
  }

  if (cloudinaryUrl) {
    cloudinary.config({ cloudinary_url: cloudinaryUrl });
  } else {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }

  return cloudinary;
}

export class MediaService {
  private static instance: MediaService;
  private mediaRepo: SupabaseMediaRepository;

  private constructor() {
    this.mediaRepo = SupabaseMediaRepository.getInstance();
  }

  public static getInstance(): MediaService {
    if (!MediaService.instance) {
      MediaService.instance = new MediaService();
    }
    return MediaService.instance;
  }

  async getMediaItems(options?: { folder?: string; mimeType?: string; search?: string; limit?: number; startAfter?: string }): Promise<{ items: MediaItem[]; total: number }> {
    const { items, total } = await this.mediaRepo.listMediaItems({
      folder: options?.folder,
      limit: options?.limit || 50
    });

    return { items, total };
  }

  async uploadMedia(file: { buffer: Buffer; originalname: string; mimetype: string; size: number }, uploadedBy: string, folder = 'general', altText = ''): Promise<MediaItem> {
    if (!file) {
      throw new Error("File tidak ditemukan.");
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new Error(`Format file tidak didukung (${file.mimetype}). Hanya mengizinkan gambar (JPEG, PNG, WEBP, GIF, SVG).`);
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`Ukuran file terlalu besar (${(file.size / 1024 / 1024).toFixed(2)}MB). Maksimal 5MB.`);
    }

    const c = getCloudinary();

    // Sanitize filename
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fileName = `${uniqueSuffix}_${sanitizedOriginalName}`;
    const folderPath = `istore/${folder}`;
    const publicIdWithoutExt = fileName.replace(/\.[^/.]+$/, "");

    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = c.uploader.upload_stream(
        {
          folder: folderPath,
          public_id: publicIdWithoutExt,
          resource_type: "auto",
          overwrite: true
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary Upload Error:", error);
            return reject(new Error(`Gagal mengunggah gambar ke Cloudinary: ${error.message || 'Unknown error'}`));
          }
          resolve(result);
        }
      );

      uploadStream.end(file.buffer);
    });

    const mediaItem = await this.mediaRepo.createMediaItem({
      fileName,
      originalName: file.originalname,
      storagePath: uploadResult.public_id,
      cloudinaryPublicId: uploadResult.public_id,
      url: uploadResult.secure_url,
      mimeType: file.mimetype,
      size: uploadResult.bytes || file.size,
      width: uploadResult.width,
      height: uploadResult.height,
      altText: altText || file.originalname,
      folder,
      uploadedBy,
      status: 'active'
    });

    return mediaItem;
  }

  async updateMediaMetadata(mediaId: string, data: { altText?: string; folder?: string }): Promise<MediaItem> {
    await this.mediaRepo.updateMediaMetadata(mediaId, data);
    const updated = await this.mediaRepo.getMediaItem(mediaId);
    if (!updated) throw new Error("Asset media tidak ditemukan.");
    return updated;
  }

  async deleteMedia(mediaId: string): Promise<void> {
    const media = await this.mediaRepo.getMediaItem(mediaId);
    if (!media) throw new Error("Asset media tidak ditemukan.");

    // Delete from Cloudinary if public_id exists
    const publicId = media.cloudinaryPublicId || media.storagePath;
    if (publicId && !publicId.startsWith('marketing/') && !publicId.startsWith('http')) {
      try {
        const c = getCloudinary();
        await c.uploader.destroy(publicId);
      } catch (e) {
        console.error("Gagal menghapus file dari Cloudinary:", e);
      }
    }

    await this.mediaRepo.deleteMediaItem(mediaId, true);
  }
}
