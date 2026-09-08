import { adminDb } from "./firebase-admin";
import { LandingPage, LandingStatus, LandingBlock } from "../types/landing";

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

    const snap = await adminDb.collection("landings").where("slug", "==", formatted).get();
    for (const doc of snap.docs) {
      if (doc.id !== excludeId) {
        throw new Error(`Slug '${formatted}' sudah digunakan oleh Landing Page lain.`);
      }
    }
    return formatted;
  }

  async validateReferences(data: Partial<LandingPage>): Promise<void> {
    if (data.ctaUrl) {
      validateSafeUrl(data.ctaUrl);
    }

    if (data.mediaId) {
      const mDoc = await adminDb.collection("mediaLibrary").doc(data.mediaId).get();
      if (!mDoc.exists) {
        throw new Error(`Asset media '${data.mediaId}' tidak ditemukan di Media Library.`);
      }
    }

    if (data.campaignId) {
      const cDoc = await adminDb.collection("campaigns").doc(data.campaignId).get();
      if (!cDoc.exists) {
        throw new Error(`Campaign '${data.campaignId}' tidak ditemukan.`);
      }
    }

    if (data.gameId) {
      const gDoc = await adminDb.collection("games").doc(data.gameId).get();
      if (!gDoc.exists) {
        throw new Error(`Game '${data.gameId}' tidak ditemukan.`);
      }
    }

    if (data.sections && Array.isArray(data.sections)) {
      for (let i = 0; i < data.sections.length; i++) {
        const sec = data.sections[i];
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
            const gDoc = await adminDb.collection("games").doc(block.data.gameId).get();
            if (gDoc.exists) {
              const gData = gDoc.data()!;
              block.data.resolvedGame = {
                id: gDoc.id,
                name: gData.name || "",
                slug: gData.slug || "",
                image: gData.image || "",
                description: gData.description || ""
              };
            }
          } catch (e) {
            console.error(`Error resolving game ${block.data.gameId}:`, e);
          }
        } else if (block.type === "PROMO_HIGHLIGHT") {
          if (block.data?.promoId) {
            try {
              const pDoc = await adminDb.collection("promos").doc(block.data.promoId).get();
              if (pDoc.exists) {
                const pData = pDoc.data()!;
                block.data.resolvedPromo = {
                  id: pDoc.id,
                  code: pData.code,
                  name: pData.name,
                  discountType: pData.discountType,
                  discountValue: pData.discountValue,
                  minSpend: pData.minSpend,
                  maxDiscount: pData.maxDiscount
                };
              }
            } catch (e) {
              console.error(`Error resolving promo ${block.data.promoId}:`, e);
            }
          }
          if (block.data?.flashSaleId) {
            try {
              const fsDoc = await adminDb.collection("flashSales").doc(block.data.flashSaleId).get();
              if (fsDoc.exists) {
                const fsData = fsDoc.data()!;
                block.data.resolvedFlashSale = {
                  id: fsDoc.id,
                  name: fsData.name,
                  salePrice: fsData.salePrice,
                  startAt: fsData.startAt,
                  endAt: fsData.endAt
                };
              }
            } catch (e) {
              console.error(`Error resolving flash sale ${block.data.flashSaleId}:`, e);
            }
          }
          if (block.data?.campaignId) {
            try {
              const cDoc = await adminDb.collection("campaigns").doc(block.data.campaignId).get();
              if (cDoc.exists) {
                const cData = cDoc.data()!;
                block.data.resolvedCampaign = {
                  id: cDoc.id,
                  title: cData.title,
                  description: cData.description,
                  mediaUrl: cData.mediaUrl,
                  slug: cData.slug
                };
              }
            } catch (e) {
              console.error(`Error resolving campaign ${block.data.campaignId}:`, e);
            }
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
    const search = options.search?.trim().toLowerCase() || "";
    const statusFilter = options.status || "ALL";
    const includeArchived = options.includeArchived !== false;

    let query: FirebaseFirestore.Query = adminDb.collection("landings");
    if (!includeArchived) {
      query = query.where("isArchived", "==", false);
    }

    const snap = await query.get();
    let allLandings: LandingPage[] = snap.docs.map((doc) => {
      const data = doc.data();
      const status = computeLandingStatus({
        published: !!data.published,
        enabled: !!data.enabled,
        isArchived: !!data.isArchived,
        startAt: data.startAt,
        endAt: data.endAt
      });
      return { id: doc.id, ...data, status } as LandingPage;
    });

    // Search filter
    if (search) {
      allLandings = allLandings.filter((l) =>
        l.name.toLowerCase().includes(search) ||
        l.title.toLowerCase().includes(search) ||
        l.slug.toLowerCase().includes(search)
      );
    }

    // Status filter
    if (statusFilter !== "ALL") {
      allLandings = allLandings.filter((l) => l.status === statusFilter);
    }

    // Deterministic sort: latest updated first
    allLandings.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

    const total = allLandings.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const items = allLandings.slice(startIndex, startIndex + limit);

    return { items, total, page, totalPages };
  }

  async getLandingPageById(id: string): Promise<LandingPage | null> {
    const doc = await adminDb.collection("landings").doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data()!;
    const status = computeLandingStatus({
      published: !!data.published,
      enabled: !!data.enabled,
      isArchived: !!data.isArchived,
      startAt: data.startAt,
      endAt: data.endAt
    });
    return { id: doc.id, ...data, status } as LandingPage;
  }

  async getPublicLandingPage(slug: string): Promise<any | null> {
    const formatted = slug.trim().toLowerCase();
    const snap = await adminDb.collection("landings")
      .where("slug", "==", formatted)
      .limit(1)
      .get();

    if (snap.empty) return null;

    const doc = snap.docs[0];
    const data = doc.data();
    const status = computeLandingStatus({
      published: !!data.published,
      enabled: !!data.enabled,
      isArchived: !!data.isArchived,
      startAt: data.startAt,
      endAt: data.endAt
    });

    // Public eligibility: STRICTLY ACTIVE
    if (status !== "ACTIVE") {
      return null;
    }

    const resolvedSections = await this.resolveBlockReferences(data.sections || []);

    // Sanitize response: exclude createdBy, updatedBy, internal notes, etc.
    return {
      id: doc.id,
      title: data.title,
      slug: data.slug,
      description: data.description,
      seoTitle: data.seoTitle || data.title,
      seoDescription: data.seoDescription || data.description,
      mediaUrl: data.mediaUrl,
      sections: resolvedSections,
      ctaText: data.ctaText,
      ctaUrl: data.ctaUrl,
      campaignId: data.campaignId,
      gameId: data.gameId,
      categoryId: data.categoryId,
      productId: data.productId,
      startAt: data.startAt,
      endAt: data.endAt,
      status
    };
  }

  async getPreviewLandingPage(idOrSlug: string): Promise<any | null> {
    let doc: FirebaseFirestore.DocumentSnapshot | null = null;
    const docById = await adminDb.collection("landings").doc(idOrSlug).get();
    if (docById.exists) {
      doc = docById;
    } else {
      const snap = await adminDb.collection("landings").where("slug", "==", idOrSlug.toLowerCase()).limit(1).get();
      if (!snap.empty) {
        doc = snap.docs[0];
      }
    }

    if (!doc || !doc.exists) return null;

    const data = doc.data()!;
    const status = computeLandingStatus({
      published: !!data.published,
      enabled: !!data.enabled,
      isArchived: !!data.isArchived,
      startAt: data.startAt,
      endAt: data.endAt
    });

    const resolvedSections = await this.resolveBlockReferences(data.sections || []);

    return {
      id: doc.id,
      name: data.name,
      title: data.title,
      slug: data.slug,
      description: data.description,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      mediaUrl: data.mediaUrl,
      sections: resolvedSections,
      ctaText: data.ctaText,
      ctaUrl: data.ctaUrl,
      campaignId: data.campaignId,
      gameId: data.gameId,
      categoryId: data.categoryId,
      productId: data.productId,
      startAt: data.startAt,
      endAt: data.endAt,
      enabled: !!data.enabled,
      published: !!data.published,
      isArchived: !!data.isArchived,
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

    if (data.startAt && data.endAt && data.startAt > data.endAt) {
      throw new Error("Waktu berakhir harus setelah waktu mulai tayang.");
    }

    const now = new Date().toISOString();
    const ref = adminDb.collection("landings").doc();

    const newLanding: Omit<LandingPage, "id" | "status"> = {
      name: data.name.trim(),
      title: data.title.trim(),
      slug: validatedSlug,
      description: data.description.trim(),
      seoTitle: data.seoTitle?.trim() || "",
      seoDescription: data.seoDescription?.trim() || "",
      mediaId: data.mediaId || "",
      mediaUrl: data.mediaUrl || "",
      sections: data.sections || [],
      ctaText: data.ctaText?.trim() || "",
      ctaUrl: data.ctaUrl?.trim() || "",
      campaignId: data.campaignId || "",
      gameId: data.gameId || "",
      categoryId: data.categoryId || "",
      productId: data.productId || "",
      startAt: data.startAt || "",
      endAt: data.endAt || "",
      enabled: typeof data.enabled === "boolean" ? data.enabled : true,
      published: typeof data.published === "boolean" ? data.published : false,
      isArchived: false,
      createdBy: uid,
      createdAt: now,
      updatedAt: now
    };

    await ref.set(newLanding);

    const status = computeLandingStatus({
      published: newLanding.published,
      enabled: newLanding.enabled,
      isArchived: newLanding.isArchived,
      startAt: newLanding.startAt,
      endAt: newLanding.endAt
    });

    return { id: ref.id, ...newLanding, status };
  }

  async updateLandingPage(
    id: string,
    data: Partial<LandingPage>,
    uid: string
  ): Promise<LandingPage> {
    const ref = adminDb.collection("landings").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Landing Page tidak ditemukan.");

    const existing = snap.data()!;

    let validatedSlug = existing.slug;
    if (data.slug && data.slug !== existing.slug) {
      validatedSlug = await this.validateSlug(data.slug, id);
    }

    if (data.startAt && data.endAt && data.startAt > data.endAt) {
      throw new Error("Waktu berakhir harus setelah waktu mulai.");
    } else if (data.startAt && !data.endAt && existing.endAt && data.startAt > existing.endAt) {
      throw new Error("Waktu mulai tidak boleh setelah waktu berakhir yang ada.");
    } else if (!data.startAt && data.endAt && existing.startAt && existing.startAt > data.endAt) {
      throw new Error("Waktu berakhir tidak boleh sebelum waktu mulai yang ada.");
    }

    await this.validateReferences(data);

    const updateData: any = {
      ...data,
      slug: validatedSlug,
      updatedBy: uid,
      updatedAt: new Date().toISOString()
    };
    delete updateData.id;
    delete updateData.status;
    delete updateData.createdBy;
    delete updateData.createdAt;

    await ref.update(updateData);
    const updatedSnap = await ref.get();
    const finalData = updatedSnap.data()!;
    const status = computeLandingStatus({
      published: !!finalData.published,
      enabled: !!finalData.enabled,
      isArchived: !!finalData.isArchived,
      startAt: finalData.startAt,
      endAt: finalData.endAt
    });

    return { id: updatedSnap.id, ...finalData, status } as LandingPage;
  }

  async publishLandingPage(id: string, published: boolean, uid: string): Promise<LandingPage> {
    return this.updateLandingPage(id, { published }, uid);
  }

  async archiveLandingPage(id: string, uid: string): Promise<LandingPage> {
    return this.updateLandingPage(id, { isArchived: true, enabled: false }, uid);
  }

  async deleteLandingPage(id: string): Promise<void> {
    const ref = adminDb.collection("landings").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Landing Page tidak ditemukan.");
    // Safe deletion: only delete landing doc, references in media/catalog/campaign are completely untouched
    await ref.delete();
  }

  async getAvailableComponents(): Promise<{
    games: Array<{ id: string; name: string; slug: string; image: string }>;
    promos: Array<{ id: string; name: string; code: string; discountType: string; discountValue: number }>;
    flashSales: Array<{ id: string; name: string; salePrice: number; startAt: string; endAt: string }>;
    campaigns: Array<{ id: string; title: string; slug?: string }>;
  }> {
    const [gamesSnap, promosSnap, flashSalesSnap, campaignsSnap] = await Promise.all([
      adminDb.collection("games").limit(50).get(),
      adminDb.collection("promos").limit(50).get(),
      adminDb.collection("flashSales").limit(50).get(),
      adminDb.collection("campaigns").where("isArchived", "==", false).limit(50).get()
    ]);

    const games = gamesSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        slug: data.slug,
        image: data.image
      };
    });

    const promos = promosSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || data.code,
        code: data.code,
        discountType: data.discountType,
        discountValue: data.discountValue
      };
    });

    const flashSales = flashSalesSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        salePrice: data.salePrice,
        startAt: data.startAt,
        endAt: data.endAt
      };
    });

    const campaigns = campaignsSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title,
        slug: data.slug
      };
    });

    return { games, promos, flashSales, campaigns };
  }
}
