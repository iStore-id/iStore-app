import { SupabaseCMSRepository } from "./supabase/cms-repository.js";
import { SupabaseCatalogRepository } from "./supabase/catalog-repository.js";
import { SupabaseMediaRepository } from "./supabase/media-repository.js";
import { BlogPost, BlogStatus, PublicBlogItem, PublicBlogDetail } from "../types/blog.js";

const RESERVED_SLUGS = [
  "admin", "api", "login", "register", "games", "transactions",
  "checkout", "cart", "landing", "promo", "p", "auth", "home", "settings", "blog", "faq"
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

/**
 * Strips script tags, unsafe event handlers, and malicious HTML constructs.
 */
export function sanitizeBlogContent(content: string): string {
  if (!content) return "";
  let sanitized = content;
  // Remove script, iframe, object, embed, form tags
  sanitized = sanitized.replace(/<\s*(script|iframe|object|embed|applet|form|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  sanitized = sanitized.replace(/<\s*(script|iframe|object|embed|applet|form|style)[^>]*\/?\s*>/gi, "");
  // Remove inline event handlers (onload, onclick, onerror, etc.)
  sanitized = sanitized.replace(/\s+on[a-z]+\s*=\s*(['"]).*?\1/gi, "");
  sanitized = sanitized.replace(/\s+on[a-z]+\s*=\s*[^ >]+/gi, "");
  // Remove javascript: and data: pseudo-protocols
  sanitized = sanitized.replace(/href\s*=\s*(['"])\s*(javascript|data|vbscript):/gi, 'href=$1#blocked-');
  sanitized = sanitized.replace(/src\s*=\s*(['"])\s*(javascript|data|vbscript):/gi, 'src=$1#blocked-');
  return sanitized.trim();
}

export function computeBlogStatus(blog: {
  published: boolean;
  enabled: boolean;
  isArchived?: boolean;
  startAt?: string | null;
  endAt?: string | null;
}): BlogStatus {
  if (blog.isArchived) return 'ARCHIVED';
  if (!blog.published) return 'DRAFT';
  if (!blog.enabled) return 'INACTIVE';

  const now = new Date().toISOString();
  if (blog.startAt && now < blog.startAt) {
    return 'SCHEDULED';
  }
  if (blog.endAt && now > blog.endAt) {
    return 'ENDED';
  }
  return 'PUBLISHED';
}

export function calculateReadingTime(text: string): number {
  if (!text) return 1;
  // Count words roughly by splitting whitespace
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function formatCleanExcerpt(rawExcerpt?: string): string {
  if (rawExcerpt && rawExcerpt.trim()) {
    const cleaned = rawExcerpt
      .replace(/<[^>]+>/g, " ")
      .replace(/[#*`_~[\]()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned.length > 140) {
      return cleaned.slice(0, 137) + "...";
    }
    if (cleaned.length > 0) return cleaned;
  }
  return "Baca selengkapnya pembahasan dan ulasan artikel ini.";
}

export class BlogService {
  private static instance: BlogService;
  private cmsRepo: SupabaseCMSRepository;
  private catalogRepo: SupabaseCatalogRepository;
  private mediaRepo: SupabaseMediaRepository;

  private constructor() {
    this.cmsRepo = SupabaseCMSRepository.getInstance();
    this.catalogRepo = SupabaseCatalogRepository.getInstance();
    this.mediaRepo = SupabaseMediaRepository.getInstance();
  }

  public static getInstance(): BlogService {
    if (!BlogService.instance) {
      BlogService.instance = new BlogService();
    }
    return BlogService.instance;
  }

  async validateSlug(slug: string, excludeId?: string): Promise<string> {
    const formatted = slug.trim().toLowerCase();
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(formatted)) {
      throw new Error("Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung (-) tanpa spasi.");
    }
    if (formatted.length < 2 || formatted.length > 100) {
      throw new Error("Panjang slug harus antara 2 hingga 100 karakter.");
    }
    if (RESERVED_SLUGS.includes(formatted)) {
      throw new Error(`Slug '${formatted}' merupakan kata cadangan sistem dan tidak dapat digunakan.`);
    }

    const existing = await this.cmsRepo.getBlogBySlug(formatted);
    if (existing && existing.id !== excludeId) {
      throw new Error(`Slug '${formatted}' sudah digunakan oleh artikel Blog lain.`);
    }
    return formatted;
  }

  async validateReferences(data: Partial<BlogPost>): Promise<void> {
    if (data.coverMediaId) {
      const media = await this.mediaRepo.getMediaItem(data.coverMediaId);
      if (!media) throw new Error(`Asset gambar cover '${data.coverMediaId}' tidak ditemukan.`);
    }

    if (data.relatedGameId) {
      const game = await this.catalogRepo.getGame(data.relatedGameId);
      if (!game) throw new Error(`Game referensi '${data.relatedGameId}' tidak ditemukan.`);
    }

    // Related Promo/FlashSale validation skipped as they remain in Firestore

    if (data.relatedCampaignId) {
      const camp = await this.cmsRepo.getCampaign(data.relatedCampaignId);
      if (!camp) throw new Error(`Campaign referensi '${data.relatedCampaignId}' tidak ditemukan.`);
    }

    if (data.relatedLandingId) {
      const land = await this.cmsRepo.getLanding(data.relatedLandingId);
      if (!land) throw new Error(`Landing page referensi '${data.relatedLandingId}' tidak ditemukan.`);
    }
  }

  async resolveRelatedEntities(data: {
    relatedGameId?: string;
    relatedPromoId?: string;
    relatedCampaignId?: string;
    relatedLandingId?: string;
  }): Promise<{
    relatedGame?: { id: string; name: string; slug: string; image: string };
    relatedPromo?: { id: string; name: string; code: string; discountType: string; discountValue: number };
    relatedCampaign?: { id: string; title: string; slug?: string; mediaUrl?: string };
    relatedLanding?: { id: string; title: string; slug: string; mediaUrl?: string };
  }> {
    const result: any = {};

    if (data.relatedGameId) {
      try {
        const game = await this.catalogRepo.getGame(data.relatedGameId);
        if (game) {
          result.relatedGame = {
            id: game.id,
            name: game.name,
            slug: game.slug,
            image: game.image || ""
          };
        }
      } catch (e) {}
    }

    // Promos still in Firestore, skipping resolution for Firebase-free audit

    if (data.relatedCampaignId) {
      try {
        const camp = await this.cmsRepo.getCampaign(data.relatedCampaignId);
        if (camp) {
          result.relatedCampaign = {
            id: camp.id,
            title: camp.title,
            slug: camp.slug,
            mediaUrl: camp.mediaUrl
          };
        }
      } catch (e) {}
    }

    if (data.relatedLandingId) {
      try {
        const land = await this.cmsRepo.getLanding(data.relatedLandingId);
        if (land) {
          result.relatedLanding = {
            id: land.id,
            title: land.title,
            slug: land.slug,
            mediaUrl: land.mediaUrl
          };
        }
      } catch (e) {}
    }

    return result;
  }

  // =========================================================================
  // PUBLIC QUERY METHODS
  // =========================================================================

  async getPublicBlogs(options: {
    page?: number;
    limit?: number;
    category?: string;
    tag?: string;
    search?: string;
  }): Promise<{ items: PublicBlogItem[]; total: number; page: number; totalPages: number; categories: string[] }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(30, Math.max(1, options.limit || 9));
    const offset = (page - 1) * limit;

    const result = await this.cmsRepo.listBlogs({
      onlyActive: true,
      category: options.category === "ALL" ? undefined : options.category,
      limit,
      offset
    });

    const categoriesRes = await this.cmsRepo.listBlogs({ onlyActive: false });
    const distinctCategories = new Set<string>();
    categoriesRes.items.forEach(b => {
      if (b.category) distinctCategories.add(b.category);
    });

    let items: PublicBlogItem[] = result.items.map(b => ({
      id: b.id,
      title: b.title,
      slug: b.slug,
      excerpt: formatCleanExcerpt(b.excerpt),
      coverMediaUrl: b.coverMediaUrl || "",
      category: b.category || "Berita",
      tags: b.tags || [],
      author: b.author || "Tim Editorial iStore",
      readTime: b.readTime || 1,
      publishedAt: b.publishedAt || b.createdAt,
      status: b.status
    }));

    if (options.tag) {
      const tag = options.tag.toLowerCase();
      items = items.filter(i => i.tags.some(t => t.toLowerCase() === tag));
    }

    if (options.search) {
      const q = options.search.toLowerCase();
      items = items.filter(i => 
        i.title.toLowerCase().includes(q) || 
        i.excerpt.toLowerCase().includes(q) ||
        i.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    return {
      items,
      total: result.total,
      page,
      totalPages: Math.ceil(result.total / limit) || 1,
      categories: Array.from(distinctCategories).sort()
    };
  }

  async getPublicBlogBySlug(slug: string): Promise<PublicBlogDetail | null> {
    const blog = await this.cmsRepo.getBlogBySlug(slug);
    if (!blog || blog.status !== 'PUBLISHED') return null;

    const [resolved, allPublishedRes] = await Promise.all([
      this.resolveRelatedEntities({
        relatedGameId: blog.relatedGameId,
        relatedPromoId: blog.relatedPromoId,
        relatedCampaignId: blog.relatedCampaignId,
        relatedLandingId: blog.relatedLandingId
      }),
      this.cmsRepo.listBlogs({ onlyActive: true })
    ]);

    // Ordered chronologically (published_at DESC)
    const publishedList = allPublishedRes.items;
    const currentIndex = publishedList.findIndex(b => b.id === blog.id || b.slug === blog.slug);

    let previousBlog: {
      slug: string;
      title: string;
      coverMediaUrl?: string;
      excerpt?: string;
      category?: string;
      readTime?: number;
      author?: string;
      publishedAt?: string;
    } | null = null;

    let nextBlog: {
      slug: string;
      title: string;
      coverMediaUrl?: string;
      excerpt?: string;
      category?: string;
      readTime?: number;
      author?: string;
      publishedAt?: string;
    } | null = null;

    if (currentIndex !== -1) {
      if (currentIndex > 0) {
        const prevItem = publishedList[currentIndex - 1];
        previousBlog = {
          slug: prevItem.slug,
          title: prevItem.title,
          coverMediaUrl: prevItem.coverMediaUrl || "",
          excerpt: formatCleanExcerpt(prevItem.excerpt),
          category: prevItem.category || "Berita",
          readTime: prevItem.readTime || 1,
          author: prevItem.author || "Tim Editorial iStore",
          publishedAt: prevItem.publishedAt || prevItem.createdAt
        };
      }
      if (currentIndex < publishedList.length - 1) {
        const nextItem = publishedList[currentIndex + 1];
        nextBlog = {
          slug: nextItem.slug,
          title: nextItem.title,
          coverMediaUrl: nextItem.coverMediaUrl || "",
          excerpt: formatCleanExcerpt(nextItem.excerpt),
          category: nextItem.category || "Berita",
          readTime: nextItem.readTime || 1,
          author: nextItem.author || "Tim Editorial iStore",
          publishedAt: nextItem.publishedAt || nextItem.createdAt
        };
      }
    }

    return {
      id: blog.id,
      title: blog.title,
      slug: blog.slug,
      excerpt: blog.excerpt,
      content: sanitizeBlogContent(blog.content || ""),
      coverMediaUrl: blog.coverMediaUrl || "",
      category: blog.category || "Berita",
      tags: blog.tags || [],
      author: blog.author || "Tim Editorial iStore",
      readTime: blog.readTime || 1,
      publishedAt: blog.publishedAt || blog.createdAt,
      seoTitle: blog.seoTitle || blog.title,
      seoDescription: blog.seoDescription || blog.excerpt,
      status: blog.status,
      previousBlog,
      nextBlog,
      ...resolved
    };
  }

  // =========================================================================
  // ADMIN & PREVIEW METHODS
  // =========================================================================

  async getAdminBlogs(options: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    category?: string;
    includeArchived?: boolean;
  }): Promise<{ items: BlogPost[]; total: number; page: number; totalPages: number; categories: string[] }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(50, Math.max(1, options.limit || 10));
    const offset = (page - 1) * limit;

    const result = await this.cmsRepo.listBlogs({
      onlyActive: false,
      category: options.category === "ALL" ? undefined : options.category,
      limit,
      offset
    });

    let filtered = result.items;
    if (!options.includeArchived) filtered = filtered.filter(b => !b.isArchived);
    if (options.status && options.status !== "ALL") filtered = filtered.filter(b => b.status === options.status);
    if (options.search) {
      const q = options.search.toLowerCase();
      filtered = filtered.filter(b => 
        b.title.toLowerCase().includes(q) || 
        b.slug.toLowerCase().includes(q) ||
        b.excerpt.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q)
      );
    }

    const categoriesRes = await this.cmsRepo.listBlogs({ onlyActive: false });
    const distinctCategories = new Set<string>();
    categoriesRes.items.forEach(b => {
      if (b.category) distinctCategories.add(b.category);
    });

    return {
      items: filtered,
      total: result.total,
      page,
      totalPages: Math.ceil(result.total / limit) || 1,
      categories: Array.from(distinctCategories).sort()
    };
  }

  async getAdminBlogById(id: string): Promise<BlogPost | null> {
    return this.cmsRepo.getBlog(id);
  }

  async getPreviewBlog(idOrSlug: string): Promise<any | null> {
    let blog = await this.cmsRepo.getBlog(idOrSlug);
    if (!blog) blog = await this.cmsRepo.getBlogBySlug(idOrSlug);
    if (!blog) return null;

    const resolved = await this.resolveRelatedEntities({
      relatedGameId: blog.relatedGameId,
      relatedPromoId: blog.relatedPromoId,
      relatedCampaignId: blog.relatedCampaignId,
      relatedLandingId: blog.relatedLandingId
    });

    return {
      ...blog,
      content: sanitizeBlogContent(blog.content || ""),
      isPreview: true,
      ...resolved
    };
  }

  async createBlog(
    data: Omit<BlogPost, "id" | "status" | "createdAt" | "updatedAt">,
    uid: string
  ): Promise<BlogPost> {
    if (!data.title || !data.excerpt || !data.content) {
      throw new Error("Judul artikel, ringkasan (excerpt), dan konten artikel wajib diisi.");
    }

    let rawSlug = data.slug ? data.slug.trim().toLowerCase() : "";
    if (!rawSlug && data.title) {
      rawSlug = data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }
    if (!rawSlug) {
      rawSlug = `blog-${Date.now()}`;
    }

    const validatedSlug = await this.validateSlug(rawSlug);
    await this.validateReferences(data);

    const sanitizedContent = sanitizeBlogContent(data.content);
    const readTime = calculateReadingTime(sanitizedContent);
    const now = new Date().toISOString();

    const published = typeof data.published === "boolean" ? data.published : false;
    const startAt = typeof data.startAt === "string" && data.startAt.trim() ? data.startAt.trim() : null;
    const endAt = typeof data.endAt === "string" && data.endAt.trim() ? data.endAt.trim() : null;
    
    let publishedAt: string | null = null;
    if (published) {
      publishedAt = typeof data.publishedAt === "string" && data.publishedAt.trim() ? data.publishedAt.trim() : now;
    }

    return this.cmsRepo.createBlog({
      ...data,
      title: data.title.trim(),
      slug: validatedSlug,
      excerpt: data.excerpt.trim(),
      content: sanitizedContent,
      category: data.category?.trim() || "Berita",
      author: data.author?.trim() || "Tim Editorial iStore",
      readTime,
      published,
      publishedAt,
      startAt,
      endAt,
      coverMediaId: typeof data.coverMediaId === "string" && data.coverMediaId.trim() ? data.coverMediaId.trim() : undefined,
      coverMediaUrl: typeof data.coverMediaUrl === "string" && data.coverMediaUrl.trim() ? data.coverMediaUrl.trim() : undefined,
      isArchived: false,
      createdBy: uid,
      updatedBy: uid,
      status: computeBlogStatus({ ...data, published, isArchived: false, startAt, endAt })
    });
  }

  async updateBlog(
    id: string,
    data: Partial<BlogPost>,
    uid: string
  ): Promise<BlogPost> {
    const existing = await this.cmsRepo.getBlog(id);
    if (!existing) throw new Error("Artikel Blog tidak ditemukan.");

    let validatedSlug = existing.slug;
    if (data.slug && data.slug !== existing.slug) {
      validatedSlug = await this.validateSlug(data.slug, id);
    }

    await this.validateReferences(data);

    const updates: Partial<BlogPost> = {
      ...data,
      slug: validatedSlug,
      updatedBy: uid
    };

    if (data.startAt !== undefined) {
      updates.startAt = typeof data.startAt === "string" && data.startAt.trim() ? data.startAt.trim() : null;
    }
    if (data.endAt !== undefined) {
      updates.endAt = typeof data.endAt === "string" && data.endAt.trim() ? data.endAt.trim() : null;
    }
    if (data.coverMediaId !== undefined) {
      updates.coverMediaId = typeof data.coverMediaId === "string" && data.coverMediaId.trim() ? data.coverMediaId.trim() : undefined;
    }
    if (data.coverMediaUrl !== undefined) {
      updates.coverMediaUrl = typeof data.coverMediaUrl === "string" && data.coverMediaUrl.trim() ? data.coverMediaUrl.trim() : undefined;
    }

    if (data.content !== undefined) {
      updates.content = sanitizeBlogContent(data.content);
      updates.readTime = calculateReadingTime(updates.content);
    }

    if (data.published === true && !existing.published) {
      updates.publishedAt = existing.publishedAt || new Date().toISOString();
    } else if (data.published === false) {
      updates.publishedAt = null;
    }

    await this.cmsRepo.updateBlog(id, updates);
    const updated = await this.cmsRepo.getBlog(id);
    return updated!;
  }

  async publishBlog(id: string, published: boolean, uid: string): Promise<BlogPost> {
    return this.updateBlog(id, { published }, uid);
  }

  async archiveBlog(id: string, uid: string): Promise<BlogPost> {
    return this.updateBlog(id, { isArchived: true, enabled: false }, uid);
  }

  async deleteBlog(id: string): Promise<void> {
    await this.cmsRepo.deleteBlog(id);
  }

  async getAvailableComponents(): Promise<{
    games: Array<{ id: string; name: string; slug: string; image: string }>;
    promos: Array<{ id: string; name: string; code: string; discountType: string; discountValue: number }>;
    campaigns: Array<{ id: string; title: string; slug?: string }>;
    landings: Array<{ id: string; title: string; slug: string }>;
  }> {
    const [games, campaigns, landings] = await Promise.all([
      this.catalogRepo.listGames(false),
      this.cmsRepo.listCampaigns(false),
      this.cmsRepo.listLandings(false)
    ]);

    return {
      games: games.map(g => ({ id: g.id, name: g.name, slug: g.slug, image: g.image || "" })),
      promos: [], // Promos in Firestore, skipping for Firebase-free audit
      campaigns: campaigns.map(c => ({ id: c.id, title: c.title, slug: c.slug })),
      landings: landings.map(l => ({ id: l.id, title: l.title, slug: l.slug }))
    };
  }
}
