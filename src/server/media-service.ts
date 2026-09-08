import { adminDb } from "./firebase-admin";
import { v2 as cloudinary } from "cloudinary";

export interface MediaItem {
  id: string;
  fileName: string;
  originalName: string;
  storagePath: string;
  cloudinaryPublicId?: string;
  url: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  altText?: string;
  folder?: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'archived';
}

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

  public static getInstance(): MediaService {
    if (!MediaService.instance) {
      MediaService.instance = new MediaService();
    }
    return MediaService.instance;
  }

  async getMediaItems(options?: { folder?: string; mimeType?: string; search?: string; limit?: number; startAfter?: string }): Promise<{ items: MediaItem[]; total: number }> {
    let query: FirebaseFirestore.Query = adminDb.collection("mediaLibrary");

    if (options?.folder) {
      query = query.where("folder", "==", options.folder);
    }
    if (options?.mimeType) {
      query = query.where("mimeType", "==", options.mimeType);
    }

    query = query.orderBy("createdAt", "desc");

    const snap = await query.get();
    let items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MediaItem));

    if (options?.search) {
      const q = options.search.toLowerCase();
      items = items.filter(item => 
        item.originalName.toLowerCase().includes(q) ||
        (item.altText && item.altText.toLowerCase().includes(q))
      );
    }

    const total = items.length;
    const limit = options?.limit || 50;
    const paginatedItems = items.slice(0, limit);

    return { items: paginatedItems, total };
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

    const mediaRef = adminDb.collection("mediaLibrary").doc();
    const mediaItem: MediaItem = {
      id: mediaRef.id,
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active'
    };

    await mediaRef.set(mediaItem);
    return mediaItem;
  }

  async updateMediaMetadata(mediaId: string, data: { altText?: string; folder?: string }): Promise<MediaItem> {
    const ref = adminDb.collection("mediaLibrary").doc(mediaId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Asset media tidak ditemukan.");

    const updateData: any = {
      updatedAt: new Date().toISOString()
    };
    if (data.altText !== undefined) updateData.altText = data.altText;
    if (data.folder !== undefined) updateData.folder = data.folder;

    await ref.update(updateData);
    const updatedSnap = await ref.get();
    return { id: updatedSnap.id, ...updatedSnap.data() } as MediaItem;
  }

  async deleteMedia(mediaId: string): Promise<void> {
    const ref = adminDb.collection("mediaLibrary").doc(mediaId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Asset media tidak ditemukan.");
    const media = snap.data() as MediaItem;

    // Reference safety check across marketing & catalog collections
    const collectionsToCheck = ['banners', 'popups', 'landingPages', 'blogPosts', 'products', 'games'];
    for (const colName of collectionsToCheck) {
      try {
        const checkSnap = await adminDb.collection(colName).where("image", "==", media.url).get();
        if (!checkSnap.empty) {
          throw new Error(`Asset sedang digunakan di modul ${colName} (${checkSnap.size} referensi). Hapus referensi terlebih dahulu sebelum menghapus asset.`);
        }
        const checkSnap2 = await adminDb.collection(colName).where("imageUrl", "==", media.url).get();
        if (!checkSnap2.empty) {
          throw new Error(`Asset sedang digunakan di modul ${colName} (${checkSnap2.size} referensi). Hapus referensi terlebih dahulu sebelum menghapus asset.`);
        }
        const checkSnap3 = await adminDb.collection(colName).where("mediaUrl", "==", media.url).get();
        if (!checkSnap3.empty) {
          throw new Error(`Asset sedang digunakan di modul ${colName} (${checkSnap3.size} referensi). Hapus referensi terlebih dahulu sebelum menghapus asset.`);
        }
      } catch (err: any) {
        if (err.message && err.message.includes("sedang digunakan")) {
          throw err;
        }
      }
    }

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

    await ref.delete();
  }
}

