import { SupabaseCMSRepository } from "./supabase/cms-repository";
import { Campaign, CampaignStatus, computeCampaignStatus } from "../types/cms";
import { PromoService } from "./promo-service";
import { FlashSaleService } from "./flash-sale-service";

export { computeCampaignStatus };

export class CampaignService {
  private static instance: CampaignService;
  private cmsRepo: SupabaseCMSRepository;

  private constructor() {
    this.cmsRepo = SupabaseCMSRepository.getInstance();
  }

  public static getInstance(): CampaignService {
    if (!CampaignService.instance) {
      CampaignService.instance = new CampaignService();
    }
    return CampaignService.instance;
  }

  async getCampaigns(includeArchived: boolean = true): Promise<Campaign[]> {
    const result = await this.cmsRepo.listCampaigns(false);
    let campaigns = result.map(c => ({
      ...c,
      status: computeCampaignStatus(c)
    } as Campaign));

    if (!includeArchived) {
      campaigns = campaigns.filter(c => !c.isArchived);
    }

    return campaigns;
  }

  async getCampaignById(id: string): Promise<Campaign | null> {
    const campaign = await this.cmsRepo.getCampaign(id);
    if (!campaign) return null;
    return {
      ...campaign,
      status: computeCampaignStatus(campaign)
    } as Campaign;
  }

  async getPublicCampaigns(): Promise<Campaign[]> {
    const result = await this.cmsRepo.listCampaigns(true);
    return result.map(c => ({
      ...c,
      status: computeCampaignStatus(c)
    } as Campaign));
  }

  async validateReferences(data: Partial<Campaign>): Promise<void> {
    if (data.targetUrl) {
      const t = data.targetUrl.trim();
      if (!t.startsWith("/") && !t.startsWith("http://") && !t.startsWith("https://")) {
        throw new Error("Target URL harus berformat valid (diawali / atau https://).");
      }
    }
  }

  async createCampaign(data: Omit<Campaign, 'id' | 'status' | 'createdAt' | 'updatedAt'>, uid: string): Promise<Campaign> {
    if (!data.name || !data.title || !data.description) {
      throw new Error("Nama internal, judul, dan deskripsi kampanye wajib diisi.");
    }

    let validStartAt = data.startAt;
    if (!validStartAt) {
      validStartAt = new Date().toISOString();
    } else {
      const parsedStart = new Date(validStartAt);
      if (isNaN(parsedStart.getTime())) {
        throw new Error("Format waktu mulai (startAt) tidak valid.");
      }
      validStartAt = parsedStart.toISOString();
    }

    let validEndAt: string | undefined = undefined;
    if (data.endAt && typeof data.endAt === 'string' && data.endAt.trim()) {
      const parsedEnd = new Date(data.endAt);
      if (isNaN(parsedEnd.getTime())) {
        throw new Error("Format waktu selesai (endAt) tidak valid.");
      }
      validEndAt = parsedEnd.toISOString();
      if (new Date(validEndAt) < new Date(validStartAt)) {
        throw new Error("Waktu selesai (endAt) tidak boleh lebih awal dari waktu mulai (startAt).");
      }
    }

    await this.validateReferences(data);

    let slug = data.slug && data.slug.trim()
      ? data.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      : data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!slug) {
      slug = `campaign-${Date.now()}`;
    }
    const existingSlug = await this.cmsRepo.getCampaignBySlug(slug);
    if (existingSlug) {
      slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    const item = await this.cmsRepo.createCampaign({
      ...data,
      slug,
      mediaId: data.mediaId && data.mediaId.trim() ? data.mediaId.trim() : undefined,
      mediaUrl: data.mediaUrl && data.mediaUrl.trim() ? data.mediaUrl.trim() : undefined,
      promoIds: Array.isArray(data.promoIds) ? data.promoIds : [],
      flashSaleIds: Array.isArray(data.flashSaleIds) ? data.flashSaleIds : [],
      bannerIds: Array.isArray(data.bannerIds) ? data.bannerIds : [],
      popupIds: Array.isArray(data.popupIds) ? data.popupIds : [],
      targetType: data.targetType || 'all',
      targetId: data.targetId && data.targetId.trim() ? data.targetId.trim() : undefined,
      targetUrl: data.targetUrl && data.targetUrl.trim() ? data.targetUrl.trim() : undefined,
      priority: typeof data.priority === 'number' ? data.priority : 0,
      enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
      published: typeof data.published === 'boolean' ? data.published : false,
      isArchived: typeof data.isArchived === 'boolean' ? data.isArchived : false,
      startAt: validStartAt,
      endAt: validEndAt,
      createdBy: uid,
      updatedBy: uid,
      status: computeCampaignStatus({
        published: typeof data.published === 'boolean' ? data.published : false,
        enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
        isArchived: !!data.isArchived,
        startAt: validStartAt,
        endAt: validEndAt
      })
    });

    return item as Campaign;
  }

  async updateCampaign(id: string, data: Partial<Campaign>, uid: string): Promise<Campaign> {
    const existing = await this.cmsRepo.getCampaign(id);
    if (!existing) throw new Error("Campaign tidak ditemukan.");

    await this.validateReferences(data);

    let validStartAt = data.startAt;
    if (validStartAt !== undefined) {
      const parsedStart = new Date(validStartAt);
      if (isNaN(parsedStart.getTime())) {
        throw new Error("Format waktu mulai (startAt) tidak valid.");
      }
      validStartAt = parsedStart.toISOString();
    }

    let validEndAt = data.endAt;
    if (validEndAt !== undefined) {
      if (validEndAt && typeof validEndAt === 'string' && validEndAt.trim()) {
        const parsedEnd = new Date(validEndAt);
        if (isNaN(parsedEnd.getTime())) {
          throw new Error("Format waktu selesai (endAt) tidak valid.");
        }
        validEndAt = parsedEnd.toISOString();
        const startToCheck = validStartAt || existing.startAt;
        if (startToCheck && new Date(validEndAt) < new Date(startToCheck)) {
          throw new Error("Waktu selesai (endAt) tidak boleh lebih awal dari waktu mulai (startAt).");
        }
      } else {
        validEndAt = undefined;
      }
    }

    let formattedSlug = data.slug;
    if (formattedSlug && formattedSlug.trim()) {
      formattedSlug = formattedSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const existingSlug = await this.cmsRepo.getCampaignBySlug(formattedSlug);
      if (existingSlug && existingSlug.id !== id) {
        throw new Error(`Slug "${formattedSlug}" sudah digunakan oleh campaign lain.`);
      }
    }

    await this.cmsRepo.updateCampaign(id, {
      ...data,
      slug: formattedSlug !== undefined ? formattedSlug : undefined,
      startAt: validStartAt,
      endAt: validEndAt,
      mediaId: data.mediaId !== undefined ? (data.mediaId && data.mediaId.trim() ? data.mediaId.trim() : undefined) : undefined,
      mediaUrl: data.mediaUrl !== undefined ? (data.mediaUrl && data.mediaUrl.trim() ? data.mediaUrl.trim() : undefined) : undefined,
      targetId: data.targetId !== undefined ? (data.targetId && data.targetId.trim() ? data.targetId.trim() : undefined) : undefined,
      targetUrl: data.targetUrl !== undefined ? (data.targetUrl && data.targetUrl.trim() ? data.targetUrl.trim() : undefined) : undefined,
      updatedBy: uid,
      updatedAt: new Date().toISOString()
    });

    const updated = await this.cmsRepo.getCampaign(id);
    return {
      ...updated!,
      status: computeCampaignStatus(updated!)
    } as Campaign;
  }

  async archiveCampaign(id: string, uid: string): Promise<Campaign> {
    return this.updateCampaign(id, { isArchived: true }, uid);
  }

  async deleteCampaign(id: string): Promise<void> {
    await this.cmsRepo.deleteCampaign(id);
  }

  async getAvailableComponents(): Promise<{
    promos: Array<{ id: string; name: string; code: string; discountType: string; discountValue: number }>;
    flashSales: Array<{ id: string; name: string; salePrice: number; startAt: string; endAt: string }>;
    banners: Array<{ id: string; name: string; title?: string; mediaUrl: string; placement: string }>;
    popups: Array<{ id: string; name: string; title: string; placement: string; trigger: string }>;
  }> {
    const [banners, popups, promos, flashSales] = await Promise.all([
      this.cmsRepo.listBanners(false),
      this.cmsRepo.listPopups(false),
      PromoService.getInstance().getPromos(),
      FlashSaleService.getInstance().getFlashSales()
    ]);

    return {
      promos: promos.map(p => ({
        id: p.id || "",
        name: p.name,
        code: p.code,
        discountType: p.discountType,
        discountValue: p.discountValue
      })),
      flashSales: flashSales.map(fs => ({
        id: fs.id || "",
        name: fs.name,
        salePrice: fs.salePrice,
        startAt: fs.startAt,
        endAt: fs.endAt
      })),
      banners: banners.map(b => ({
        id: b.id,
        name: b.name,
        title: b.title,
        mediaUrl: b.mediaUrl,
        placement: b.placement
      })),
      popups: popups.map(p => ({
        id: p.id,
        name: p.name,
        title: p.title,
        placement: p.placement,
        trigger: p.trigger
      }))
    };
  }
}
