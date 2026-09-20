import { SupabaseCMSRepository } from "./supabase/cms-repository.js";
import { SupabaseCatalogRepository } from "./supabase/catalog-repository.js";
import { FAQItem, FAQAdminItem, FAQStatus, PublicFAQItem, FAQAdminListResponse } from "../types/faq.js";

// Content Sanitizer to ensure Zero XSS and Zero Dangerous Executable Code
export function sanitizeFaqContent(text: string): string {
  if (!text) return "";
  let sanitized = text;

  // Block scripts, iframes, objects, embeds, forms
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "");
  sanitized = sanitized.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "");
  sanitized = sanitized.replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, "");
  sanitized = sanitized.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, "");

  // Strip dangerous inline event handlers like onclick, onerror, onload, onmouseover
  sanitized = sanitized.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "");
  sanitized = sanitized.replace(/\son\w+\s*=\s*[^>\s]+/gi, "");

  // Strip javascript: or data: pseudo-protocols
  sanitized = sanitized.replace(/href\s*=\s*(['"])\s*(javascript|data|vbscript):.*?\1/gi, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*(['"])\s*(javascript|data|vbscript):.*?\1/gi, 'src=""');

  return sanitized.trim();
}

export function computeFaqStatus(faq: Partial<FAQItem>): FAQStatus {
  if (faq.archived === true) return "ARCHIVED";
  if (!faq.published) return "DRAFT";
  if (!faq.enabled) return "INACTIVE";
  return "PUBLISHED";
}

export class FAQService {
  private static instance: FAQService;
  private cmsRepo: SupabaseCMSRepository;
  private catalogRepo: SupabaseCatalogRepository;

  private constructor() {
    this.cmsRepo = SupabaseCMSRepository.getInstance();
    this.catalogRepo = SupabaseCatalogRepository.getInstance();
  }

  public static getInstance(): FAQService {
    if (!FAQService.instance) {
      FAQService.instance = new FAQService();
    }
    return FAQService.instance;
  }

  // =========================================================================
  // PUBLIC QUERIES (STRICT ELIGIBILITY: published=true, enabled=true, archived=false)
  // =========================================================================
  async getPublicFaqs(options: {
    category?: string;
    search?: string;
  } = {}): Promise<{ items: PublicFAQItem[]; total: number; categories: string[] }> {
    const items = await this.cmsRepo.listFAQs({
      onlyActive: true,
      category: options.category === "ALL" ? undefined : options.category
    });

    const distinctCategories = new Set<string>();
    items.forEach(i => {
      if (i.category) distinctCategories.add(i.category);
    });

    let filtered = items;
    if (options.search && options.search.trim()) {
      const term = options.search.trim().toLowerCase();
      filtered = filtered.filter(
        (f) =>
          f.question.toLowerCase().includes(term) ||
          f.answer.toLowerCase().includes(term) ||
          f.category.toLowerCase().includes(term)
      );
    }

    // Hydrate lightweight references
    const publicItems: PublicFAQItem[] = await Promise.all(
      filtered.map(async (item) => {
        let relatedGame = null;

        if (item.relatedGameId) {
          try {
            const game = await this.catalogRepo.getGame(item.relatedGameId);
            if (game) {
              relatedGame = {
                id: game.id,
                name: game.name,
                slug: game.slug,
                image: game.image || ""
              };
            }
          } catch (e) {
            // Non-blocking
          }
        }

        // NOTE: relatedPromo resolution skipped as Promos are still in Firestore
        // and we are strictly Firebase-free in this service.

        return {
          id: item.id,
          question: item.question,
          answer: item.answer,
          category: item.category,
          sortOrder: item.sortOrder,
          relatedGame,
          relatedPromo: null
        };
      })
    );

    return {
      items: publicItems,
      total: publicItems.length,
      categories: Array.from(distinctCategories).sort()
    };
  }

  async getPublicFaqById(id: string): Promise<PublicFAQItem | null> {
    const item = await this.cmsRepo.getFAQ(id);
    if (!item || item.archived || !item.published || !item.enabled) return null;

    let relatedGame = null;
    if (item.relatedGameId) {
      try {
        const game = await this.catalogRepo.getGame(item.relatedGameId);
        if (game) {
          relatedGame = {
            id: game.id,
            name: game.name,
            slug: game.slug,
            image: game.image || ""
          };
        }
      } catch (e) {
        // Safe failover
      }
    }

    return {
      id: item.id,
      question: item.question,
      answer: item.answer,
      category: item.category,
      sortOrder: item.sortOrder || 0,
      relatedGame,
      relatedPromo: null
    };
  }

  // =========================================================================
  // ADMIN QUERIES & CRUD
  // =========================================================================
  async getAdminFaqs(options: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    category?: string;
    includeArchived?: boolean;
  } = {}): Promise<FAQAdminListResponse> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 15));

    const items = await this.cmsRepo.listFAQs({
      onlyActive: false,
      category: options.category === "ALL" ? undefined : options.category
    });

    const distinctCategories = new Set<string>();
    items.forEach(i => {
      if (i.category) distinctCategories.add(i.category);
    });

    let filtered: FAQAdminItem[] = items.map(i => ({
      ...i,
      status: computeFaqStatus(i)
    }));

    // Filter Archived
    if (!options.includeArchived) {
      filtered = filtered.filter((i) => !i.archived);
    }

    // Filter Status
    if (options.status && options.status !== "ALL") {
      filtered = filtered.filter((i) => i.status === options.status);
    }

    // Search
    if (options.search && options.search.trim()) {
      const term = options.search.trim().toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.question.toLowerCase().includes(term) ||
          i.answer.toLowerCase().includes(term) ||
          i.category.toLowerCase().includes(term)
      );
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedItems = filtered.slice(startIndex, startIndex + limit);

    return {
      items: paginatedItems,
      total,
      page,
      totalPages,
      categories: Array.from(distinctCategories).sort()
    };
  }

  async getAdminFaqById(id: string): Promise<FAQAdminItem | null> {
    const item = await this.cmsRepo.getFAQ(id);
    if (!item) return null;
    return {
      ...item,
      status: computeFaqStatus(item)
    };
  }

  async createFaq(
    payload: {
      question: string;
      answer: string;
      category?: string;
      sortOrder?: number;
      published?: boolean;
      enabled?: boolean;
      relatedGameId?: string;
      relatedPromoId?: string;
      relatedBlogId?: string;
    },
    uid: string
  ): Promise<FAQAdminItem> {
    const question = (payload.question || "").trim();
    if (!question || question.length < 5) {
      throw new Error("Pertanyaan FAQ wajib diisi minimal 5 karakter.");
    }

    const answer = sanitizeFaqContent(payload.answer || "");
    if (!answer) {
      throw new Error("Jawaban FAQ wajib diisi.");
    }

    const now = new Date().toISOString();
    const item = await this.cmsRepo.createFAQ({
      question,
      answer,
      category: (payload.category || "Umum").trim(),
      sortOrder: typeof payload.sortOrder === "number" ? payload.sortOrder : 0,
      published: payload.published !== undefined ? Boolean(payload.published) : true,
      enabled: payload.enabled !== undefined ? Boolean(payload.enabled) : true,
      archived: false,
      relatedGameId: payload.relatedGameId || "",
      relatedPromoId: payload.relatedPromoId || "",
      relatedBlogId: payload.relatedBlogId || "",
      createdBy: uid,
      updatedBy: uid,
      publishedAt: payload.published ? now : ""
    });

    return {
      ...item,
      status: computeFaqStatus(item)
    };
  }

  async updateFaq(
    id: string,
    payload: {
      question?: string;
      answer?: string;
      category?: string;
      sortOrder?: number;
      published?: boolean;
      enabled?: boolean;
      relatedGameId?: string;
      relatedPromoId?: string;
      relatedBlogId?: string;
    },
    uid: string
  ): Promise<FAQAdminItem> {
    const existing = await this.cmsRepo.getFAQ(id);
    if (!existing) throw new Error("FAQ tidak ditemukan.");

    const updates: Partial<FAQItem> = {
      updatedBy: uid
    };

    if (payload.question !== undefined) {
      const q = payload.question.trim();
      if (!q || q.length < 5) throw new Error("Pertanyaan wajib diisi minimal 5 karakter.");
      updates.question = q;
    }

    if (payload.answer !== undefined) {
      const ans = sanitizeFaqContent(payload.answer);
      if (!ans) throw new Error("Jawaban FAQ tidak boleh kosong.");
      updates.answer = ans;
    }

    if (payload.category !== undefined) updates.category = payload.category.trim() || "Umum";
    if (payload.sortOrder !== undefined) updates.sortOrder = Number(payload.sortOrder) || 0;
    if (payload.published !== undefined) {
      updates.published = Boolean(payload.published);
      if (updates.published && !existing.publishedAt) {
        updates.publishedAt = new Date().toISOString();
      }
    }
    if (payload.enabled !== undefined) updates.enabled = Boolean(payload.enabled);
    if (payload.relatedGameId !== undefined) updates.relatedGameId = payload.relatedGameId || "";
    if (payload.relatedPromoId !== undefined) updates.relatedPromoId = payload.relatedPromoId || "";
    if (payload.relatedBlogId !== undefined) updates.relatedBlogId = payload.relatedBlogId || "";

    await this.cmsRepo.updateFAQ(id, updates);
    const updated = await this.cmsRepo.getFAQ(id);
    return {
      ...updated!,
      status: computeFaqStatus(updated!)
    };
  }

  async publishFaq(id: string, published: boolean, uid: string): Promise<FAQAdminItem> {
    return this.updateFaq(id, { published }, uid);
  }

  async toggleEnableFaq(id: string, enabled: boolean, uid: string): Promise<FAQAdminItem> {
    return this.updateFaq(id, { enabled }, uid);
  }

  async archiveFaq(id: string, uid: string): Promise<FAQAdminItem> {
    await this.cmsRepo.updateFAQ(id, { archived: true, enabled: false, updatedBy: uid });
    const updated = await this.cmsRepo.getFAQ(id);
    return {
      ...updated!,
      status: computeFaqStatus(updated!)
    };
  }

  async reorderFaqs(
    items: Array<{ id: string; sortOrder: number }>,
    uid: string
  ): Promise<void> {
    if (!items || !Array.isArray(items) || items.length === 0) return;
    for (const item of items) {
      await this.cmsRepo.updateFAQ(item.id, { sortOrder: item.sortOrder, updatedBy: uid });
    }
  }

  async deleteFaq(id: string): Promise<void> {
    await this.cmsRepo.deleteFAQ(id);
  }

  async getAvailableComponents(): Promise<{
    games: Array<{ id: string; name: string; slug: string; image: string }>;
    promos: Array<{ id: string; name: string; code: string; discountType: string; discountValue: number }>;
    blogs: Array<{ id: string; title: string; slug: string }>;
  }> {
    const [games, blogs] = await Promise.all([
      this.catalogRepo.listGames(false),
      this.cmsRepo.listBlogs({ onlyActive: false })
    ]);

    return {
      games: games.map(g => ({ id: g.id, name: g.name, slug: g.slug, image: g.image || "" })),
      promos: [], // Promos still in Firestore, skipping for Firebase-free audit
      blogs: blogs.items.map(b => ({ id: b.id, title: b.title, slug: b.slug }))
    };
  }
}
