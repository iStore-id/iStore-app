import { SupabaseCMSRepository } from "./supabase/cms-repository.js";
import { SupabaseCatalogRepository } from "./supabase/catalog-repository.js";
import { 
  LandingPage, 
  LandingStatus, 
  LandingBlock
} from "../types/landing.js";

const RESERVED_SLUGS = [
  "admin", "api", "login", "register", "games", "transactions",
  "checkout", "cart", "landing", "promo", "p", "auth", "home", "settings"
];

export function validateSafeUrl(url?: string): void {
  if (!url) return;
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    throw new Error("Target URL mengandung skema yang tidak aman.");
  }
  if (!trimmed.startsWith("/") && !trimmed.startsWith("https://") && !trimmed.startsWith("http://")) {
    throw new Error("Target URL harus diawali dengan '/' untuk route internal atau 'https://' untuk URL eksternal.");
  }
}

export function computeLandingStatus(landing: {
  published: boolean;
  enabled: boolean;
  isArchived?: boolean;
  startAt?: string;
  endAt?: string;
}): LandingStatus {
  if (landing.isArchived) return 'ARCHIVED';
  if (!landing.published) return 'DRAFT';
  if (!landing.enabled) return 'INACTIVE';

  const now = new Date().toISOString();
  if (landing.startAt && now < landing.startAt) {
    return 'SCHEDULED';
  }
  if (landing.endAt && now > landing.endAt) {
    return 'ENDED';
  }
  return 'ACTIVE';
}

export class LandingService {
  private static instance: LandingService;
  private cmsRepo: SupabaseCMSRepository;
  private catalogRepo: SupabaseCatalogRepository;

  private constructor() {
    this.cmsRepo = SupabaseCMSRepository.getInstance();
    this.catalogRepo = SupabaseCatalogRepository.getInstance();
  }

  public static getInstance(): LandingService {
    if (!LandingService.instance) {
      LandingService.instance = new LandingService();
    }
    return LandingService.instance;
  }

  async validateSlug(slug: string, excludeId?: string): Promise<string> {
    const formatted = slug.trim().toLowerCase();
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(formatted)) {
      throw new Error("Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung (-) tanpa spasi.");
    }
    if (formatted.length < 2 || formatted.length > 80) {
      throw new Error("Panjang slug harus antara 2 hingga 80 karakter.");
    }
    if (RESERVED_SLUGS.includes(formatted)) {
      throw new Error(`Slug '${formatted}' merupakan kata cadangan sistem dan tidak dapat digunakan.`);
    }

    const existing = await this.cmsRepo.getLandingBySlug(formatted);
    if (existing && existing.id !== excludeId) {
      throw new Error(`Slug '${formatted}' sudah digunakan oleh Landing Page lain.`);
    }
    return formatted;
  }

  async validateReferences(data: Partial<LandingPage>): Promise<void> {
    if (data.ctaUrl) {
      validateSafeUrl(data.ctaUrl);
    }

    if (data.campaignId) {
      const camp = await this.cmsRepo.getCampaign(data.campaignId);
      if (!camp) throw new Error(`Campaign '${data.campaignId}' tidak ditemukan.`);
    }

    if (data.gameId) {
      const game = await this.catalogRepo.getGame(data.gameId);
      if (!game) throw new Error(`Game '${data.gameId}' tidak ditemukan.`);
    }

    if (data.sections && Array.isArray(data.sections)) {
      for (let i = 0; i < data.sections.length; i++) {
        const sec = data.sections[i] as any;
        if (!sec.id || !sec.type) {
          throw new Error(`Section pada urutan ${i + 1} tidak memiliki konfigurasi yang valid.`);
        }
        if (sec.type === "HERO" && sec.data?.ctaUrl) {
          validateSafeUrl(sec.data.ctaUrl);
        }
        if (sec.type === "CTA" && sec.data?.targetUrl) {
          validateSafeUrl(sec.data.targetUrl);
        }
      }
    }
  }

  async resolveBlockReferences(sections: LandingBlock[]): Promise<LandingBlock[]> {
    if (!sections || !Array.isArray(sections)) return [];

    const resolved: LandingBlock[] = JSON.parse(JSON.stringify(sections));

    await Promise.all(
      resolved.map(async (block) => {
        if (block.type === "PRODUCT_HIGHLIGHT" && block.data?.gameId) {
          try {
            const gData = await this.catalogRepo.getGame(block.data.gameId);
            if (gData) {
              block.data.resolvedGame = {
                id: gData.id,
                name: gData.name || "",
                slug: gData.slug || "",
                image: gData.image || "",
                description: gData.description || ""
              };
            }
          } catch (e) {}
        } else if (block.type === "PROMO_HIGHLIGHT") {
          // Promos / FlashSales skipped as they are in Firestore
          if (block.data?.campaignId) {
            try {
              const cData = await this.cmsRepo.getCampaign(block.data.campaignId);
              if (cData) {
                block.data.resolvedCampaign = {
                  id: cData.id,
                  title: cData.title,
                  description: cData.description,
                  mediaUrl: cData.mediaUrl,
                  slug: cData.slug
                };
              }
            } catch (e) {}
          }
        }
      })
    );

    return resolved;
  }

  async getAdminLandingPages(options: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    includeArchived?: boolean;
  }): Promise<{ items: LandingPage[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(50, Math.max(1, options.limit || 10));
    
    const result = await this.cmsRepo.listLandings(false);
    let allLandings: LandingPage[] = result.map(l => ({
      ...l,
      status: computeLandingStatus(l)
    } as LandingPage));

    if (!options.includeArchived) {
      allLandings = allLandings.filter(l => !l.isArchived);
    }

    if (options.search) {
      const s = options.search.toLowerCase();
      allLandings = allLandings.filter(l => 
        l.name.toLowerCase().includes(s) || 
        l.title.toLowerCase().includes(s) || 
        l.slug.toLowerCase().includes(s)
      );
    }

    if (options.status && options.status !== "ALL") {
      allLandings = allLandings.filter(l => l.status === options.status);
    }

    const total = allLandings.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const items = allLandings.slice(startIndex, startIndex + limit);

    return { items, total, page, totalPages };
  }

  async getLandingPageById(id: string): Promise<LandingPage | null> {
    const landing = await this.cmsRepo.getLanding(id);
    if (!landing) return null;
    return {
      ...landing,
      status: computeLandingStatus(landing)
    } as LandingPage;
  }

  async getPublicLandingPage(slug: string): Promise<any | null> {
    const landing = await this.cmsRepo.getLandingBySlug(slug);
    if (!landing) return null;
    
    const status = computeLandingStatus(landing);
    if (status !== "ACTIVE") return null;

    const resolvedSections = await this.resolveBlockReferences(landing.sections || []);

    return {
      id: landing.id,
      title: landing.title,
      slug: landing.slug,
      description: landing.description,
      seoTitle: landing.seoTitle || landing.title,
      seoDescription: landing.seoDescription || landing.description,
      mediaUrl: landing.mediaUrl,
      sections: resolvedSections,
      ctaText: landing.ctaText,
      ctaUrl: landing.ctaUrl,
      campaignId: landing.campaignId,
      gameId: landing.gameId,
      categoryId: landing.categoryId,
      productId: landing.productId,
      startAt: landing.startAt,
      endAt: landing.endAt,
      status
    };
  }

  async getPublicLandings(): Promise<LandingPage[]> {
    const result = await this.cmsRepo.listLandings(false);
    const now = new Date().toISOString();
    
    return result
      .filter(l => l.published && l.enabled && !l.isArchived)
      .filter(l => {
        if (l.startAt && now < l.startAt) return false;
        if (l.endAt && now > l.endAt) return false;
        return true;
      })
      .map(l => ({
        ...l,
        status: computeLandingStatus(l)
      } as LandingPage));
  }

  async getPreviewLandingPage(idOrSlug: string): Promise<any | null> {
    let landing = await this.cmsRepo.getLanding(idOrSlug);
    if (!landing) landing = await this.cmsRepo.getLandingBySlug(idOrSlug);
    if (!landing) return null;

    const status = computeLandingStatus(landing);
    const resolvedSections = await this.resolveBlockReferences(landing.sections || []);

    return {
      ...landing,
      sections: resolvedSections,
      status,
      isPreview: true
    };
  }

  async createLandingPage(
    data: Omit<LandingPage, "id" | "status" | "createdAt" | "updatedAt">,
    uid: string
  ): Promise<LandingPage> {
    if (!data.name || !data.title || !data.slug || !data.description) {
      throw new Error("Nama internal, judul publik, slug, dan deskripsi wajib diisi.");
    }

    const validatedSlug = await this.validateSlug(data.slug);
    await this.validateReferences(data);

    const now = new Date().toISOString();
    const item = await this.cmsRepo.createLanding({
      ...data,
      name: data.name.trim(),
      title: data.title.trim(),
      slug: validatedSlug,
      description: data.description.trim(),
      isArchived: false,
      createdBy: uid,
      updatedBy: uid,
      status: computeLandingStatus({ ...data, isArchived: false })
    });

    return item as LandingPage;
  }

  async updateLandingPage(
    id: string,
    data: Partial<LandingPage>,
    uid: string
  ): Promise<LandingPage> {
    const existing = await this.cmsRepo.getLanding(id);
    if (!existing) throw new Error("Landing Page tidak ditemukan.");

    let validatedSlug = existing.slug;
    if (data.slug && data.slug !== existing.slug) {
      validatedSlug = await this.validateSlug(data.slug, id);
    }

    await this.validateReferences(data);

    await this.cmsRepo.updateLanding(id, {
      ...data,
      slug: validatedSlug,
      updatedBy: uid,
      updatedAt: new Date().toISOString()
    });

    const updated = await this.cmsRepo.getLanding(id);
    return {
      ...updated!,
      status: computeLandingStatus(updated!)
    } as LandingPage;
  }

  async publishLandingPage(id: string, published: boolean, uid: string): Promise<LandingPage> {
    return this.updateLandingPage(id, { published }, uid);
  }

  async archiveLandingPage(id: string, uid: string): Promise<LandingPage> {
    return this.updateLandingPage(id, { isArchived: true, enabled: false }, uid);
  }

  async deleteLandingPage(id: string): Promise<void> {
    await this.cmsRepo.deleteLanding(id);
  }

  async getAvailableComponents(): Promise<{
    games: Array<{ id: string; name: string; slug: string; image: string }>;
    promos: Array<{ id: string; name: string; code: string; discountType: string; discountValue: number }>;
    flashSales: Array<{ id: string; name: string; salePrice: number; startAt: string; endAt: string }>;
    campaigns: Array<{ id: string; title: string; slug?: string }>;
  }> {
    const [games, campaigns] = await Promise.all([
      this.catalogRepo.listGames(false),
      this.cmsRepo.listCampaigns(false)
    ]);

    return {
      games: games.map(g => ({ id: g.id, name: g.name, slug: g.slug, image: g.image || "" })),
      promos: [],
      flashSales: [],
      campaigns: campaigns.map(c => ({ id: c.id, title: c.title, slug: c.slug }))
    };
  }
}
