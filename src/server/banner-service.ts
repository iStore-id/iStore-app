import { SupabaseCMSRepository } from "./supabase/cms-repository";
import { Banner } from "../types/cms";

export class BannerService {
  private static instance: BannerService;
  private cmsRepo: SupabaseCMSRepository;

  private constructor() {
    this.cmsRepo = SupabaseCMSRepository.getInstance();
  }

  public static getInstance(): BannerService {
    if (!BannerService.instance) {
      BannerService.instance = new BannerService();
    }
    return BannerService.instance;
  }

  async getBanners(placement?: string): Promise<Banner[]> {
    const banners = await this.cmsRepo.listBanners(false);
    if (placement) {
      return banners.filter(b => b.placement === placement);
    }
    return banners;
  }

  async getPublicBanners(placement: string): Promise<Banner[]> {
    const banners = await this.cmsRepo.listBanners(true);
    return banners.filter(b => b.placement === placement);
  }

  async createBanner(data: Omit<Banner, 'id' | 'createdAt' | 'updatedAt'>, uid: string): Promise<Banner> {
    if (!data.name || !data.mediaUrl || !data.placement) {
      throw new Error("Nama banner, URL media, dan placement wajib diisi.");
    }

    if (data.target) {
      const t = data.target.trim();
      if (!t.startsWith("/") && !t.startsWith("http://") && !t.startsWith("https://")) {
        throw new Error("Target link harus berformat URL valid (diawali / atau https://).");
      }
    }

    const now = new Date().toISOString();
    return this.cmsRepo.createBanner({
      ...data,
      mediaId: data.mediaId || '',
      title: data.title || '',
      altText: data.altText || data.name,
      target: data.target || '',
      sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
      enabled: !!data.enabled,
      published: !!data.published,
      startAt: typeof data.startAt === 'string' && data.startAt.trim() ? data.startAt.trim() : undefined,
      endAt: typeof data.endAt === 'string' && data.endAt.trim() ? data.endAt.trim() : undefined,
      createdBy: uid,
      updatedBy: uid
    });
  }

  async updateBanner(id: string, data: Partial<Banner>, uid: string): Promise<Banner> {
    const updateData: Partial<Banner> = { ...data, updatedBy: uid };
    if (data.startAt !== undefined) {
      updateData.startAt = typeof data.startAt === 'string' && data.startAt.trim() ? data.startAt.trim() : undefined;
    }
    if (data.endAt !== undefined) {
      updateData.endAt = typeof data.endAt === 'string' && data.endAt.trim() ? data.endAt.trim() : undefined;
    }
    await this.cmsRepo.updateBanner(id, updateData);
    const updated = await this.cmsRepo.getBanner(id);
    if (!updated) throw new Error("Banner tidak ditemukan.");
    return updated;
  }

  async deleteBanner(id: string): Promise<void> {
    await this.cmsRepo.deleteBanner(id);
  }
}
