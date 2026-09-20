import { SupabaseCMSRepository } from "./supabase/cms-repository";
import { Popup } from "../types/cms";

export class PopupService {
  private static instance: PopupService;
  private cmsRepo: SupabaseCMSRepository;

  private constructor() {
    this.cmsRepo = SupabaseCMSRepository.getInstance();
  }

  public static getInstance(): PopupService {
    if (!PopupService.instance) {
      PopupService.instance = new PopupService();
    }
    return PopupService.instance;
  }

  async getPopups(placement?: string): Promise<Popup[]> {
    const popups = await this.cmsRepo.listPopups(false);
    if (placement) {
      return popups.filter(p => p.placement === placement);
    }
    return popups;
  }

  async getPublicEligiblePopups(placement: string): Promise<Popup[]> {
    const popups = await this.cmsRepo.listPopups(true);
    return popups.filter(p => p.placement === placement || p.placement === 'all_pages');
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

    const now = new Date().toISOString();
    return this.cmsRepo.createPopup({
      ...data,
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
      updatedBy: uid
    });
  }

  async updatePopup(id: string, data: Partial<Popup>, uid: string): Promise<Popup> {
    await this.cmsRepo.updatePopup(id, { ...data, updatedBy: uid });
    const updated = await this.cmsRepo.getPopup(id);
    if (!updated) throw new Error("Popup tidak ditemukan.");
    return updated;
  }

  async deletePopup(id: string): Promise<void> {
    await this.cmsRepo.deletePopup(id);
  }
}
