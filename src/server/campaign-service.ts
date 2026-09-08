import { adminDb } from "./firebase-admin";

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'INACTIVE' | 'ARCHIVED';

export interface Campaign {
  id: string;
  name: string; // Internal name
  title: string; // Display title
  description: string;
  slug?: string;
  mediaId?: string; // Reference to MediaLibrary
  mediaUrl?: string; // Visual asset URL
  promoIds?: string[]; // References to PromoData IDs
  flashSaleIds?: string[]; // References to FlashSaleData IDs
  bannerIds?: string[]; // References to Banner IDs
  popupIds?: string[]; // References to Popup IDs
  targetType?: 'all' | 'game' | 'category' | 'product' | 'custom_url';
  targetId?: string;
  targetUrl?: string;
  priority: number;
  enabled: boolean;
  published: boolean;
  isArchived: boolean;
  startAt: string; // ISO datetime
  endAt?: string; // ISO datetime
  status: CampaignStatus;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export function computeCampaignStatus(campaign: {
  published: boolean;
  enabled: boolean;
  isArchived?: boolean;
  startAt: string;
  endAt?: string;
}): CampaignStatus {
  if (campaign.isArchived) return 'ARCHIVED';
  if (!campaign.published) return 'DRAFT';
  if (!campaign.enabled) return 'INACTIVE';

  const now = new Date().toISOString();
  if (campaign.startAt && now < campaign.startAt) {
    return 'SCHEDULED';
  }
  if (campaign.endAt && now > campaign.endAt) {
    return 'ENDED';
  }
  return 'ACTIVE';
}

export class CampaignService {
  private static instance: CampaignService;

  public static getInstance(): CampaignService {
    if (!CampaignService.instance) {
      CampaignService.instance = new CampaignService();
    }
    return CampaignService.instance;
  }

  async getCampaigns(includeArchived: boolean = true): Promise<Campaign[]> {
    let query: FirebaseFirestore.Query = adminDb.collection("campaigns");
    if (!includeArchived) {
      query = query.where("isArchived", "==", false);
    }
    const snap = await query.get();
    let campaigns = snap.docs.map(doc => {
      const data = doc.data();
      const status = computeCampaignStatus({
        published: !!data.published,
        enabled: !!data.enabled,
        isArchived: !!data.isArchived,
        startAt: data.startAt,
        endAt: data.endAt
      });
      return { id: doc.id, ...data, status } as Campaign;
    });

    // Deterministic sort: priority asc, createdAt desc
    campaigns.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return campaigns;
  }

  async getCampaignById(id: string): Promise<Campaign | null> {
    const doc = await adminDb.collection("campaigns").doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data()!;
    const status = computeCampaignStatus({
      published: !!data.published,
      enabled: !!data.enabled,
      isArchived: !!data.isArchived,
      startAt: data.startAt,
      endAt: data.endAt
    });
    return { id: doc.id, ...data, status } as Campaign;
  }

  async getPublicCampaigns(): Promise<Campaign[]> {
    const snap = await adminDb.collection("campaigns")
      .where("published", "==", true)
      .where("enabled", "==", true)
      .where("isArchived", "==", false)
      .get();

    const now = new Date().toISOString();
    let campaigns = snap.docs.map(doc => {
      const data = doc.data();
      const status = computeCampaignStatus({
        published: true,
        enabled: true,
        isArchived: false,
        startAt: data.startAt,
        endAt: data.endAt
      });
      return { id: doc.id, ...data, status } as Campaign;
    });

    // Filter server-side strictly for ACTIVE
    campaigns = campaigns.filter(c => {
      if (c.startAt && c.startAt > now) return false;
      if (c.endAt && c.endAt < now) return false;
      return true;
    });

    campaigns.sort((a, b) => a.priority - b.priority);
    return campaigns;
  }

  async validateReferences(data: Partial<Campaign>): Promise<void> {
    // Validate target url if custom_url
    if (data.targetUrl) {
      const t = data.targetUrl.trim();
      if (!t.startsWith("/") && !t.startsWith("http://") && !t.startsWith("https://")) {
        throw new Error("Target URL harus berformat valid (diawali / atau https://).");
      }
    }

    // Validate mediaId if provided
    if (data.mediaId) {
      const mediaDoc = await adminDb.collection("mediaLibrary").doc(data.mediaId).get();
      if (!mediaDoc.exists) {
        throw new Error(`Media asset dengan ID '${data.mediaId}' tidak ditemukan di Media Library.`);
      }
    }

    // Validate promoIds if provided
    if (data.promoIds && data.promoIds.length > 0) {
      for (const promoId of data.promoIds) {
        const pDoc = await adminDb.collection("promos").doc(promoId).get();
        if (!pDoc.exists) {
          throw new Error(`Promo dengan ID '${promoId}' tidak ditemukan.`);
        }
      }
    }

    // Validate flashSaleIds if provided
    if (data.flashSaleIds && data.flashSaleIds.length > 0) {
      for (const fsId of data.flashSaleIds) {
        const fsDoc = await adminDb.collection("flashSales").doc(fsId).get();
        if (!fsDoc.exists) {
          throw new Error(`Flash Sale dengan ID '${fsId}' tidak ditemukan.`);
        }
      }
    }

    // Validate bannerIds if provided
    if (data.bannerIds && data.bannerIds.length > 0) {
      for (const bId of data.bannerIds) {
        const bDoc = await adminDb.collection("banners").doc(bId).get();
        if (!bDoc.exists) {
          throw new Error(`Banner dengan ID '${bId}' tidak ditemukan.`);
        }
      }
    }

    // Validate popupIds if provided
    if (data.popupIds && data.popupIds.length > 0) {
      for (const pId of data.popupIds) {
        const pDoc = await adminDb.collection("popups").doc(pId).get();
        if (!pDoc.exists) {
          throw new Error(`Popup dengan ID '${pId}' tidak ditemukan.`);
        }
      }
    }
  }

  async createCampaign(data: Omit<Campaign, 'id' | 'status' | 'createdAt' | 'updatedAt'>, uid: string): Promise<Campaign> {
    if (!data.name || !data.title || !data.description) {
      throw new Error("Nama internal, judul, dan deskripsi kampanye wajib diisi.");
    }
    if (!data.startAt) {
      throw new Error("Waktu mulai (startAt) kampanye wajib diisi.");
    }
    if (data.endAt && data.startAt > data.endAt) {
      throw new Error("Waktu berakhir harus setelah waktu mulai.");
    }

    await this.validateReferences(data);

    const ref = adminDb.collection("campaigns").doc();
    const now = new Date().toISOString();

    const campaignData: Omit<Campaign, 'id' | 'status'> = {
      name: data.name.trim(),
      title: data.title.trim(),
      description: data.description.trim(),
      slug: data.slug?.trim() || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      mediaId: data.mediaId || '',
      mediaUrl: data.mediaUrl || '',
      promoIds: data.promoIds || [],
      flashSaleIds: data.flashSaleIds || [],
      bannerIds: data.bannerIds || [],
      popupIds: data.popupIds || [],
      targetType: data.targetType || 'all',
      targetId: data.targetId || '',
      targetUrl: data.targetUrl || '',
      priority: typeof data.priority === 'number' ? data.priority : 0,
      enabled: !!data.enabled,
      published: !!data.published,
      isArchived: !!data.isArchived,
      startAt: data.startAt,
      endAt: data.endAt || '',
      createdBy: uid,
      createdAt: now,
      updatedAt: now
    };

    await ref.set(campaignData);

    const status = computeCampaignStatus({
      published: campaignData.published,
      enabled: campaignData.enabled,
      isArchived: campaignData.isArchived,
      startAt: campaignData.startAt,
      endAt: campaignData.endAt
    });

    return { id: ref.id, ...campaignData, status };
  }

  async updateCampaign(id: string, data: Partial<Campaign>, uid: string): Promise<Campaign> {
    const ref = adminDb.collection("campaigns").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Campaign tidak ditemukan.");

    const existing = snap.data()!;

    if (data.startAt && data.endAt && data.startAt > data.endAt) {
      throw new Error("Waktu berakhir harus setelah waktu mulai.");
    } else if (data.startAt && !data.endAt && existing.endAt && data.startAt > existing.endAt) {
      throw new Error("Waktu mulai tidak boleh setelah waktu berakhir existing.");
    } else if (!data.startAt && data.endAt && existing.startAt && existing.startAt > data.endAt) {
      throw new Error("Waktu berakhir tidak boleh sebelum waktu mulai existing.");
    }

    await this.validateReferences(data);

    const updateData: any = {
      ...data,
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
    const status = computeCampaignStatus({
      published: !!finalData.published,
      enabled: !!finalData.enabled,
      isArchived: !!finalData.isArchived,
      startAt: finalData.startAt,
      endAt: finalData.endAt
    });

    return { id: updatedSnap.id, ...finalData, status } as Campaign;
  }

  async archiveCampaign(id: string, uid: string): Promise<Campaign> {
    return this.updateCampaign(id, { isArchived: true }, uid);
  }

  async deleteCampaign(id: string): Promise<void> {
    const ref = adminDb.collection("campaigns").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Campaign tidak ditemukan.");
    // Safe deletion: only delete campaign doc, referenced entities stay untouched
    await ref.delete();
  }

  /**
   * Helper to retrieve candidate marketing components (promos, flash sales, banners, popups)
   * for easy orchestration in the Admin Campaign management form.
   */
  async getAvailableComponents(): Promise<{
    promos: Array<{ id: string; name: string; code: string; discountType: string; discountValue: number }>;
    flashSales: Array<{ id: string; name: string; salePrice: number; startAt: string; endAt: string }>;
    banners: Array<{ id: string; name: string; title?: string; mediaUrl: string; placement: string }>;
    popups: Array<{ id: string; name: string; title: string; placement: string; trigger: string }>;
  }> {
    const [promosSnap, flashSalesSnap, bannersSnap, popupsSnap] = await Promise.all([
      adminDb.collection("promos").limit(50).get(),
      adminDb.collection("flashSales").limit(50).get(),
      adminDb.collection("banners").limit(50).get(),
      adminDb.collection("popups").limit(50).get()
    ]);

    const promos = promosSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || data.code,
        code: data.code,
        discountType: data.discountType,
        discountValue: data.discountValue
      };
    });

    const flashSales = flashSalesSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        salePrice: data.salePrice,
        startAt: data.startAt,
        endAt: data.endAt
      };
    });

    const banners = bannersSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        title: data.title,
        mediaUrl: data.mediaUrl,
        placement: data.placement
      };
    });

    const popups = popupsSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        title: data.title,
        placement: data.placement,
        trigger: data.trigger
      };
    });

    return { promos, flashSales, banners, popups };
  }
}
