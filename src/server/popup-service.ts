import { adminDb } from "./firebase-admin";

export interface Popup {
  id: string;
  name: string;
  title: string;
  content: string;
  mediaId?: string;
  mediaUrl?: string;
  placement: 'homepage' | 'all_pages' | 'checkout';
  trigger: 'immediate' | 'delay_3s' | 'exit_intent';
  target?: string;
  priority: number;
  enabled: boolean;
  published: boolean;
  startAt?: string;
  endAt?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export class PopupService {
  private static instance: PopupService;

  public static getInstance(): PopupService {
    if (!PopupService.instance) {
      PopupService.instance = new PopupService();
    }
    return PopupService.instance;
  }

  async getPopups(placement?: string): Promise<Popup[]> {
    let query: FirebaseFirestore.Query = adminDb.collection("popups");
    if (placement) {
      query = query.where("placement", "==", placement);
    }
    const snap = await query.get();
    let popups = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Popup));
    
    // Sort deterministically by priority asc, then createdAt desc
    popups.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return popups;
  }

  async getPublicEligiblePopups(placement: string): Promise<Popup[]> {
    const now = new Date().toISOString();
    // Query popups matching placement or all_pages
    const snap = await adminDb.collection("popups")
      .where("enabled", "==", true)
      .where("published", "==", true)
      .get();

    let popups = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Popup));

    // Filter by placement (matching requested placement or 'all_pages')
    popups = popups.filter(p => p.placement === placement || p.placement === 'all_pages');

    // Filter by startAt and endAt schedule server-side
    popups = popups.filter(p => {
      if (p.startAt && p.startAt > now) return false;
      if (p.endAt && p.endAt < now) return false;
      return true;
    });

    // Sort deterministically by priority asc
    popups.sort((a, b) => a.priority - b.priority);
    return popups;
  }

  async createPopup(data: Omit<Popup, 'id' | 'createdAt' | 'updatedAt'>, uid: string): Promise<Popup> {
    if (!data.name || !data.title || !data.content) {
      throw new Error("Nama, judul, dan konten popup wajib diisi.");
    }

    if (data.target) {
      const t = data.target.trim();
      if (!t.startsWith("/") && !t.startsWith("http://") && !t.startsWith("https://")) {
        throw new Error("Target link harus berformat URL valid (diawali / atau https://).");
      }
    }

    const ref = adminDb.collection("popups").doc();
    const now = new Date().toISOString();
    const popup: Popup = {
      id: ref.id,
      name: data.name,
      title: data.title,
      content: data.content,
      mediaId: data.mediaId || '',
      mediaUrl: data.mediaUrl || '',
      placement: data.placement || 'homepage',
      trigger: data.trigger || 'immediate',
      target: data.target || '',
      priority: typeof data.priority === 'number' ? data.priority : 0,
      enabled: !!data.enabled,
      published: !!data.published,
      startAt: data.startAt || '',
      endAt: data.endAt || '',
      createdBy: uid,
      createdAt: now,
      updatedAt: now
    };

    await ref.set(popup);
    return popup;
  }

  async updatePopup(id: string, data: Partial<Popup>, uid: string): Promise<Popup> {
    const ref = adminDb.collection("popups").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Popup tidak ditemukan.");

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
    return { id: updatedSnap.id, ...updatedSnap.data() } as Popup;
  }

  async deletePopup(id: string): Promise<void> {
    const ref = adminDb.collection("popups").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Popup tidak ditemukan.");
    await ref.delete();
  }
}
