import { adminDb } from "./firebase-admin";

export interface Banner {
  id: string;
  name: string;
  mediaId: string;
  mediaUrl: string;
  placement: 'homepage_hero' | 'homepage_promo' | 'game_promo';
  title?: string;
  altText?: string;
  target?: string;
  sortOrder: number;
  enabled: boolean;
  published: boolean;
  startAt?: string;
  endAt?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export class BannerService {
  private static instance: BannerService;

  public static getInstance(): BannerService {
    if (!BannerService.instance) {
      BannerService.instance = new BannerService();
    }
    return BannerService.instance;
  }

  async getBanners(placement?: string): Promise<Banner[]> {
    let query: FirebaseFirestore.Query = adminDb.collection("banners");
    if (placement) {
      query = query.where("placement", "==", placement);
    }
    const snap = await query.get();
    let banners = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
    
    // Sort deterministically by sortOrder asc, then createdAt desc
    banners.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return banners;
  }

  async getPublicBanners(placement: string): Promise<Banner[]> {
    const now = new Date().toISOString();
    const snap = await adminDb.collection("banners")
      .where("placement", "==", placement)
      .where("enabled", "==", true)
      .where("published", "==", true)
      .get();

    let banners = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));

    // Filter by startAt and endAt schedule server-side
    banners = banners.filter(b => {
      if (b.startAt && b.startAt > now) return false;
      if (b.endAt && b.endAt < now) return false;
      return true;
    });

    // Sort deterministically by sortOrder asc
    banners.sort((a, b) => a.sortOrder - b.sortOrder);
    return banners;
  }

  async createBanner(data: Omit<Banner, 'id' | 'createdAt' | 'updatedAt'>, uid: string): Promise<Banner> {
    if (!data.name || !data.mediaUrl || !data.placement) {
      throw new Error("Nama banner, URL media, dan placement wajib diisi.");
    }

    // Target validation
    if (data.target) {
      const t = data.target.trim();
      if (!t.startsWith("/") && !t.startsWith("http://") && !t.startsWith("https://")) {
        throw new Error("Target link harus berformat URL valid (diawali / atau https://).");
      }
    }

    const ref = adminDb.collection("banners").doc();
    const now = new Date().toISOString();
    const banner: Banner = {
      id: ref.id,
      name: data.name,
      mediaId: data.mediaId || '',
      mediaUrl: data.mediaUrl,
      placement: data.placement,
      title: data.title || '',
      altText: data.altText || data.name,
      target: data.target || '',
      sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
      enabled: !!data.enabled,
      published: !!data.published,
      startAt: data.startAt || '',
      endAt: data.endAt || '',
      createdBy: uid,
      createdAt: now,
      updatedAt: now
    };

    await ref.set(banner);
    return banner;
  }

  async updateBanner(id: string, data: Partial<Banner>, uid: string): Promise<Banner> {
    const ref = adminDb.collection("banners").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Banner tidak ditemukan.");

    if (data.target) {
      const t = data.target.trim();
      if (!t.startsWith("/") && !t.startsWith("http://") && !t.startsWith("https://")) {
        throw new Error("Target link harus berformat URL valid.");
      }
    }

    const updateData: any = {
      ...data,
      updatedBy: uid,
      updatedAt: new Date().toISOString()
    };
    delete updateData.id;
    delete updateData.createdBy;
    delete updateData.createdAt;

    await ref.update(updateData);
    const updatedSnap = await ref.get();
    return { id: updatedSnap.id, ...updatedSnap.data() } as Banner;
  }

  async deleteBanner(id: string): Promise<void> {
    const ref = adminDb.collection("banners").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Banner tidak ditemukan.");
    await ref.delete();
  }
}
