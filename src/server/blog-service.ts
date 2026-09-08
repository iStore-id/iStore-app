import { adminDb } from "./firebase-admin";
import { BlogPost, BlogStatus, PublicBlogItem, PublicBlogDetail } from "../types/blog";

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

export class BlogService {
  private static instance: BlogService;

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

    const snap = await adminDb.collection("blogs").where("slug", "==", formatted).get();
    for (const doc of snap.docs) {
      if (doc.id !== excludeId) {
        throw new Error(`Slug '${formatted}' sudah digunakan oleh artikel Blog lain.`);
      }
    }
    return formatted;
  }

  async validateReferences(data: Partial<BlogPost>): Promise<void> {
    if (data.coverMediaId) {
      const mDoc = await adminDb.collection("mediaLibrary").doc(data.coverMediaId).get();
      if (!mDoc.exists) {
        throw new Error(`Asset gambar cover '${data.coverMediaId}' tidak ditemukan di Media Library.`);
      }
    }

    if (data.relatedGameId) {
      const gDoc = await adminDb.collection("games").doc(data.relatedGameId).get();
      if (!gDoc.exists) {
        throw new Error(`Game referensi '${data.relatedGameId}' tidak ditemukan.`);
      }
    }

    if (data.relatedPromoId) {
      const pDoc = await adminDb.collection("promos").doc(data.relatedPromoId).get();
      if (!pDoc.exists) {
        throw new Error(`Promo referensi '${data.relatedPromoId}' tidak ditemukan.`);
      }
    }

    if (data.relatedCampaignId) {
      const cDoc = await adminDb.collection("campaigns").doc(data.relatedCampaignId).get();
      if (!cDoc.exists) {
        throw new Error(`Campaign referensi '${data.relatedCampaignId}' tidak ditemukan.`);
      }
    }

    if (data.relatedLandingId) {
      const lDoc = await adminDb.collection("landings").doc(data.relatedLandingId).get();
      if (!lDoc.exists) {
        throw new Error(`Landing page referensi '${data.relatedLandingId}' tidak ditemukan.`);
      }
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
        const doc = await adminDb.collection("games").doc(data.relatedGameId).get();
        if (doc.exists) {
          const d = doc.data()!;
          result.relatedGame = {
            id: doc.id,
            name: d.name,
            slug: d.slug,
            image: d.image || d.thumbnail || ""
          };
        }
      } catch (e) {
        console.error("Failed to resolve related game:", e);
      }
    }

    if (data.relatedPromoId) {
      try {
        const doc = await adminDb.collection("promos").doc(data.relatedPromoId).get();
        if (doc.exists) {
          const d = doc.data()!;
          result.relatedPromo = {
            id: doc.id,
            name: d.name || d.code,
            code: d.code,
            discountType: d.discountType,
            discountValue: d.discountValue
          };
        }
      } catch (e) {
        console.error("Failed to resolve related promo:", e);
      }
    }

    if (data.relatedCampaignId) {
      try {
        const doc = await adminDb.collection("campaigns").doc(data.relatedCampaignId).get();
        if (doc.exists) {
          const d = doc.data()!;
          result.relatedCampaign = {
            id: doc.id,
            title: d.title,
            slug: d.slug,
            mediaUrl: d.mediaUrl
          };
        }
      } catch (e) {
        console.error("Failed to resolve related campaign:", e);
      }
    }

    if (data.relatedLandingId) {
      try {
        const doc = await adminDb.collection("landings").doc(data.relatedLandingId).get();
        if (doc.exists) {
          const d = doc.data()!;
          result.relatedLanding = {
            id: doc.id,
            title: d.title,
            slug: d.slug,
            mediaUrl: d.mediaUrl
          };
        }
      } catch (e) {
        console.error("Failed to resolve related landing:", e);
      }
    }

    return result;
  }

  // =========================================================================
  // SEED INITIAL SAMPLES IF EMPTY
  // =========================================================================

  async seedInitialBlogsIfEmpty(): Promise<void> {
    try {
      const existing = await adminDb.collection("blogs").limit(1).get();
      if (!existing.empty) return;

      // Find an existing game for reference linking if available
      let sampleGameId = "";
      const gamesSnap = await adminDb.collection("games").limit(1).get();
      if (!gamesSnap.empty) {
        sampleGameId = gamesSnap.docs[0].id;
      }

      const now = new Date().toISOString();

      const sample1: Omit<BlogPost, "id" | "status"> = {
        title: "Panduan Lengkap Cara Top Up Diamond Mobile Legends Cepat dan Bergaransi",
        slug: "panduan-lengkap-top-up-diamond-mobile-legends-2026",
        excerpt: "Simak cara mudah dan aman top up diamond Mobile Legends Bang Bang di iStore.id dengan proses instan hitungan detik dan garansi 100% aman.",
        content: `## Mengapa Memilih Top Up Resmi di iStore.id?

Bagi para pemain setia **Mobile Legends: Bang Bang**, memiliki diamond yang cukup sangat penting untuk membeli *Skin Collector*, *Starlight Member*, hingga *Battle Emote*. Namun, maraknya kasus diamond minus dan penipuan pihak ketiga mengharuskan pemain berhati-hati dalam memilih platform top up.

Di **iStore.id**, seluruh transaksi menggunakan jalur resmi langsung ke publisher game. 

### Langkah Mudah Melakukan Top Up

Berikut langkah-langkah mudah yang bisa Anda ikuti:

1. Buka katalog game dan pilih **Mobile Legends: Bang Bang**.
2. Masukkan **User ID** dan **Zone ID** akun Anda (contoh: 12345678 (2020)).
3. Pilih nominal Diamond yang Anda butuhkan, mulai dari paket hemat harian hingga paket ribuan Diamond.
4. Tentukan metode pembayaran favorit (QRIS, GoPay, OVO, DANA, ShopeePay, atau Virtual Account Bank).
5. Masukkan nomor WhatsApp untuk notifikasi resi instan dan klik **Beli Sekarang**.

:::tip
Pastikan User ID dan Zone ID Anda sudah diperiksa kembali dengan cermat sebelum menekan tombol bayar agar diamond langsung masuk tanpa kendala.
:::

## Keunggulan Berbelanja di iStore.id

- **Pengiriman Instan:** Sistem pemrosesan otomatis bekerja 24 jam nonstop tanpa jeda.
- **Garansi 100% Legal:** Diamond dijamin anti-minus dan aman untuk akun utama Anda.
- **Harga Paling Kompetitif:** Selalu ada diskon voucher dan cashback poin loyalitas bagi member setia.

> Kepuasan dan keamanan akun gaming Anda adalah prioritas nomor satu di iStore.id. Jangan ragu menghubungi tim customer service kami jika membutuhkan bantuan.`,
        coverMediaId: "",
        coverMediaUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
        category: "Tips & Tutorial",
        tags: ["mobile-legends", "top-up", "diamond", "tutorial"],
        author: "Tim Editorial iStore",
        readTime: 3,
        seoTitle: "Panduan Lengkap Top Up Diamond Mobile Legends Murah & Cepat",
        seoDescription: "Pelajari cara top up diamond MLBB instan dan aman bergaransi resmi di platform iStore.id.",
        relatedGameId: sampleGameId,
        relatedPromoId: "",
        relatedCampaignId: "",
        relatedLandingId: "",
        startAt: "",
        endAt: "",
        enabled: true,
        published: true,
        publishedAt: now,
        isArchived: false,
        createdBy: "system",
        createdAt: now,
        updatedAt: now
      };

      const sample2: Omit<BlogPost, "id" | "status"> = {
        title: "Tips Push Rank Season Baru: Rekomendasi Hero Meta dan Strategi Rotasi",
        slug: "tips-push-rank-season-baru-hero-meta-strategi-rotasi",
        excerpt: "Ingin tembus rank Mythical Immortal lebih cepat? Pelajari hero tier S di patch terkini serta rotasi objektif jungle yang wajib Anda kuasai.",
        content: `## Strategi Utama Memulai Season Baru

Awal season rank selalu menjadi momen paling menantang bagi para pemain kompetitif. Bertemu mantan pemain rank tinggi membutuhkan koordinasi tim yang rapi dan penguasaan hero yang sedang berada di puncak **Meta**.

### 1. Kuasai Hero Tier S (Meta Terkuat)

Dalam patch terbaru, hero dengan mobilitas tinggi dan kemampuan burst damage di early game mendominasi permainan:

- **Jungler:** Prioritaskan hero assassin dengan clear speed cepat agar dapat mengamankan Lithowanderer dan Turtle pertama.
- **Mid Laner:** Pilih mage dengan crowd control area untuk menahan inisiasi lawan saat teamfight kontes objektif.
- **Roamer:** Tank dengan kemampuan inisiasi mendadak tetap menjadi kunci kemenangan tim.

:::tip
Jangan memaksakan hero yang belum Anda kuasai di mode Ranked. Latih setidaknya 10 pertandingan di mode Classic terlebih dahulu untuk membiasakan mikro mekanik skill.
:::

### 2. Disiplin Rotasi Objektif

Kemenangan di tier tinggi ditentukan oleh objektif, bukan semata-mata jumlah kill:

1. **Turtle Kontes:** Pastikan roamer membuka semak di sekitar area Turtle minimal 20 detik sebelum spawn.
2. **Push Turret Outer:** Menghancurkan turret luar musuh mempersempit visi lawan dan membuka jalur invasi jungle.
3. **Lord Timing:** Jangan mengambil Lord tanpa keunggulan jumlah pemain (misal setelah musuh ter-pick off).

> Ingat, rank Mythic bukan sekadar adu mekanik, melainkan perpaduan antara ketenangan mental dan kedisiplinan membaca peta (macro gameplay).`,
        coverMediaId: "",
        coverMediaUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80",
        category: "Update Game",
        tags: ["push-rank", "tips-gaming", "meta", "esports"],
        author: "Tim Editorial iStore",
        readTime: 4,
        seoTitle: "Tips Push Rank Season Baru: Hero Meta & Rotasi Objektif",
        seoDescription: "Pelajari strategi push rank Mythic tercepat dengan rekomendasi hero tier S dan macro gameplay.",
        relatedGameId: sampleGameId,
        relatedPromoId: "",
        relatedCampaignId: "",
        relatedLandingId: "",
        startAt: "",
        endAt: "",
        enabled: true,
        published: true,
        publishedAt: now,
        isArchived: false,
        createdBy: "system",
        createdAt: now,
        updatedAt: now
      };

      await adminDb.collection("blogs").add(sample1);
      await adminDb.collection("blogs").add(sample2);
    } catch (e) {
      console.warn("Notice: seedInitialBlogsIfEmpty encountered:", e);
    }
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
    const search = options.search?.trim().toLowerCase() || "";
    const categoryFilter = options.category?.trim() || "";
    const tagFilter = options.tag?.trim().toLowerCase() || "";

    // Bounded query for eligible articles only
    let snap = await adminDb
      .collection("blogs")
      .where("isArchived", "==", false)
      .where("published", "==", true)
      .where("enabled", "==", true)
      .get();

    if (snap.empty) {
      await this.seedInitialBlogsIfEmpty();
      snap = await adminDb
        .collection("blogs")
        .where("isArchived", "==", false)
        .where("published", "==", true)
        .where("enabled", "==", true)
        .get();
    }

    const distinctCategories = new Set<string>();

    let eligibleBlogs: PublicBlogItem[] = [];

    for (const doc of snap.docs) {
      const data = doc.data();
      const status = computeBlogStatus({
        published: !!data.published,
        enabled: !!data.enabled,
        isArchived: !!data.isArchived,
        startAt: data.startAt,
        endAt: data.endAt
      });

      if (data.category) {
        distinctCategories.add(data.category);
      }

      // Public listing only includes currently active PUBLISHED articles
      if (status === 'PUBLISHED') {
        eligibleBlogs.push({
          id: doc.id,
          title: data.title,
          slug: data.slug,
          excerpt: data.excerpt,
          coverMediaUrl: data.coverMediaUrl || "",
          category: data.category || "Berita",
          tags: Array.isArray(data.tags) ? data.tags : [],
          author: data.author || "Tim Editorial iStore",
          readTime: data.readTime || calculateReadingTime(data.content || data.excerpt || ""),
          publishedAt: data.publishedAt || data.createdAt,
          status
        });
      }
    }

    // Category filter
    if (categoryFilter && categoryFilter !== "ALL") {
      eligibleBlogs = eligibleBlogs.filter((b) => b.category.toLowerCase() === categoryFilter.toLowerCase());
    }

    // Tag filter
    if (tagFilter) {
      eligibleBlogs = eligibleBlogs.filter((b) => b.tags.some(t => t.toLowerCase() === tagFilter));
    }

    // Search filter
    if (search) {
      eligibleBlogs = eligibleBlogs.filter((b) =>
        b.title.toLowerCase().includes(search) ||
        b.excerpt.toLowerCase().includes(search) ||
        b.tags.some(t => t.toLowerCase().includes(search))
      );
    }

    // Sort by latest publishedAt / createdAt
    eligibleBlogs.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    const total = eligibleBlogs.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedItems = eligibleBlogs.slice(startIndex, startIndex + limit);

    return {
      items: paginatedItems,
      total,
      page,
      totalPages,
      categories: Array.from(distinctCategories).sort()
    };
  }

  async getPublicBlogBySlug(slug: string): Promise<PublicBlogDetail | null> {
    const formattedSlug = slug.trim().toLowerCase();
    const snap = await adminDb
      .collection("blogs")
      .where("slug", "==", formattedSlug)
      .limit(1)
      .get();

    if (snap.empty) return null;

    const doc = snap.docs[0];
    const data = doc.data();

    // Check publication eligibility
    const status = computeBlogStatus({
      published: !!data.published,
      enabled: !!data.enabled,
      isArchived: !!data.isArchived,
      startAt: data.startAt,
      endAt: data.endAt
    });

    if (status !== 'PUBLISHED') {
      return null;
    }

    const resolved = await this.resolveRelatedEntities({
      relatedGameId: data.relatedGameId,
      relatedPromoId: data.relatedPromoId,
      relatedCampaignId: data.relatedCampaignId,
      relatedLandingId: data.relatedLandingId
    });

    // Sanitized explicit response shape (omits createdBy, updatedBy, internal notes)
    return {
      id: doc.id,
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      content: sanitizeBlogContent(data.content || ""),
      coverMediaUrl: data.coverMediaUrl || "",
      category: data.category || "Berita",
      tags: Array.isArray(data.tags) ? data.tags : [],
      author: data.author || "Tim Editorial iStore",
      readTime: data.readTime || calculateReadingTime(data.content || data.excerpt || ""),
      publishedAt: data.publishedAt || data.createdAt,
      seoTitle: data.seoTitle || data.title,
      seoDescription: data.seoDescription || data.excerpt,
      status,
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
    const search = options.search?.trim().toLowerCase() || "";
    const statusFilter = options.status || "ALL";
    const categoryFilter = options.category?.trim() || "";
    const includeArchived = options.includeArchived !== false;

    let query: FirebaseFirestore.Query = adminDb.collection("blogs");
    if (!includeArchived) {
      query = query.where("isArchived", "==", false);
    }

    let snap = await query.get();
    if (snap.empty) {
      await this.seedInitialBlogsIfEmpty();
      snap = await query.get();
    }
    const distinctCategories = new Set<string>();

    let allBlogs: BlogPost[] = snap.docs.map((doc) => {
      const data = doc.data();
      const status = computeBlogStatus({
        published: !!data.published,
        enabled: !!data.enabled,
        isArchived: !!data.isArchived,
        startAt: data.startAt,
        endAt: data.endAt
      });
      if (data.category) distinctCategories.add(data.category);
      return { id: doc.id, ...data, status } as BlogPost;
    });

    // Search filter
    if (search) {
      allBlogs = allBlogs.filter((b) =>
        b.title.toLowerCase().includes(search) ||
        b.slug.toLowerCase().includes(search) ||
        b.excerpt.toLowerCase().includes(search) ||
        b.author.toLowerCase().includes(search)
      );
    }

    // Status filter
    if (statusFilter !== "ALL") {
      allBlogs = allBlogs.filter((b) => b.status === statusFilter);
    }

    // Category filter
    if (categoryFilter && categoryFilter !== "ALL") {
      allBlogs = allBlogs.filter((b) => b.category?.toLowerCase() === categoryFilter.toLowerCase());
    }

    // Sort: latest updated first
    allBlogs.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

    const total = allBlogs.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedItems = allBlogs.slice(startIndex, startIndex + limit);

    return {
      items: paginatedItems,
      total,
      page,
      totalPages,
      categories: Array.from(distinctCategories).sort()
    };
  }

  async getAdminBlogById(id: string): Promise<BlogPost | null> {
    const doc = await adminDb.collection("blogs").doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data()!;
    const status = computeBlogStatus({
      published: !!data.published,
      enabled: !!data.enabled,
      isArchived: !!data.isArchived,
      startAt: data.startAt,
      endAt: data.endAt
    });
    return { id: doc.id, ...data, status } as BlogPost;
  }

  async getPreviewBlog(idOrSlug: string): Promise<any | null> {
    let doc: FirebaseFirestore.DocumentSnapshot | null = null;
    const docById = await adminDb.collection("blogs").doc(idOrSlug).get();
    if (docById.exists) {
      doc = docById;
    } else {
      const snap = await adminDb.collection("blogs").where("slug", "==", idOrSlug.toLowerCase()).limit(1).get();
      if (!snap.empty) {
        doc = snap.docs[0];
      }
    }

    if (!doc || !doc.exists) return null;

    const data = doc.data()!;
    const status = computeBlogStatus({
      published: !!data.published,
      enabled: !!data.enabled,
      isArchived: !!data.isArchived,
      startAt: data.startAt,
      endAt: data.endAt
    });

    const resolved = await this.resolveRelatedEntities({
      relatedGameId: data.relatedGameId,
      relatedPromoId: data.relatedPromoId,
      relatedCampaignId: data.relatedCampaignId,
      relatedLandingId: data.relatedLandingId
    });

    return {
      id: doc.id,
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      content: sanitizeBlogContent(data.content || ""),
      coverMediaId: data.coverMediaId,
      coverMediaUrl: data.coverMediaUrl,
      category: data.category,
      tags: data.tags || [],
      author: data.author,
      readTime: data.readTime || calculateReadingTime(data.content || ""),
      published: !!data.published,
      enabled: !!data.enabled,
      isArchived: !!data.isArchived,
      publishedAt: data.publishedAt,
      startAt: data.startAt,
      endAt: data.endAt,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      status,
      isPreview: true,
      ...resolved
    };
  }

  async createBlog(
    data: Omit<BlogPost, "id" | "status" | "createdAt" | "updatedAt">,
    uid: string
  ): Promise<BlogPost> {
    if (!data.title || !data.slug || !data.excerpt || !data.content) {
      throw new Error("Judul artikel, slug, ringkasan (excerpt), dan konten artikel wajib diisi.");
    }

    const validatedSlug = await this.validateSlug(data.slug);
    await this.validateReferences(data);

    if (data.startAt && data.endAt && data.startAt > data.endAt) {
      throw new Error("Waktu berakhir tayang harus setelah waktu mulai tayang.");
    }

    const sanitizedContent = sanitizeBlogContent(data.content);
    const readTime = calculateReadingTime(sanitizedContent);
    const now = new Date().toISOString();
    const ref = adminDb.collection("blogs").doc();

    const published = typeof data.published === "boolean" ? data.published : false;
    const publishedAt = published ? (data.publishedAt || now) : null;

    const newBlog: Omit<BlogPost, "id" | "status"> = {
      title: data.title.trim(),
      slug: validatedSlug,
      excerpt: data.excerpt.trim(),
      content: sanitizedContent,
      coverMediaId: data.coverMediaId || "",
      coverMediaUrl: data.coverMediaUrl || "",
      category: data.category?.trim() || "Berita",
      tags: Array.isArray(data.tags) ? data.tags.map(t => t.trim().toLowerCase()).filter(Boolean) : [],
      author: data.author?.trim() || "Tim Editorial iStore",
      readTime,
      seoTitle: data.seoTitle?.trim() || "",
      seoDescription: data.seoDescription?.trim() || "",
      relatedGameId: data.relatedGameId || "",
      relatedPromoId: data.relatedPromoId || "",
      relatedCampaignId: data.relatedCampaignId || "",
      relatedLandingId: data.relatedLandingId || "",
      startAt: data.startAt || "",
      endAt: data.endAt || "",
      enabled: typeof data.enabled === "boolean" ? data.enabled : true,
      published,
      publishedAt,
      isArchived: false,
      createdBy: uid,
      createdAt: now,
      updatedAt: now
    };

    await ref.set(newBlog);

    const status = computeBlogStatus({
      published: newBlog.published,
      enabled: newBlog.enabled,
      isArchived: newBlog.isArchived,
      startAt: newBlog.startAt,
      endAt: newBlog.endAt
    });

    return { id: ref.id, ...newBlog, status };
  }

  async updateBlog(
    id: string,
    data: Partial<BlogPost>,
    uid: string
  ): Promise<BlogPost> {
    const ref = adminDb.collection("blogs").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Artikel Blog tidak ditemukan.");

    const existing = snap.data()!;

    let validatedSlug = existing.slug;
    if (data.slug && data.slug !== existing.slug) {
      validatedSlug = await this.validateSlug(data.slug, id);
    }

    if (data.startAt && data.endAt && data.startAt > data.endAt) {
      throw new Error("Waktu berakhir harus setelah waktu mulai tayang.");
    } else if (data.startAt && !data.endAt && existing.endAt && data.startAt > existing.endAt) {
      throw new Error("Waktu mulai tidak boleh setelah waktu berakhir yang ada.");
    } else if (!data.startAt && data.endAt && existing.startAt && existing.startAt > data.endAt) {
      throw new Error("Waktu berakhir tidak boleh sebelum waktu mulai yang ada.");
    }

    await this.validateReferences(data);

    let contentToStore = existing.content;
    let readTimeToStore = existing.readTime;
    if (data.content !== undefined) {
      contentToStore = sanitizeBlogContent(data.content);
      readTimeToStore = calculateReadingTime(contentToStore);
    }

    const now = new Date().toISOString();
    let publishedAtToStore = existing.publishedAt;
    if (data.published === true && !existing.published) {
      publishedAtToStore = existing.publishedAt || now;
    } else if (data.publishedAt !== undefined) {
      publishedAtToStore = data.publishedAt;
    }

    const updateData: any = {
      ...data,
      slug: validatedSlug,
      content: contentToStore,
      readTime: readTimeToStore,
      publishedAt: publishedAtToStore,
      updatedBy: uid,
      updatedAt: now
    };
    delete updateData.id;
    delete updateData.status;
    delete updateData.createdBy;
    delete updateData.createdAt;

    await ref.update(updateData);
    const updatedSnap = await ref.get();
    const finalData = updatedSnap.data()!;
    const status = computeBlogStatus({
      published: !!finalData.published,
      enabled: !!finalData.enabled,
      isArchived: !!finalData.isArchived,
      startAt: finalData.startAt,
      endAt: finalData.endAt
    });

    return { id: updatedSnap.id, ...finalData, status } as BlogPost;
  }

  async publishBlog(id: string, published: boolean, uid: string): Promise<BlogPost> {
    return this.updateBlog(id, { published }, uid);
  }

  async archiveBlog(id: string, uid: string): Promise<BlogPost> {
    return this.updateBlog(id, { isArchived: true, enabled: false }, uid);
  }

  async deleteBlog(id: string): Promise<void> {
    const ref = adminDb.collection("blogs").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Artikel Blog tidak ditemukan.");
    // Safe deletion: only delete blog doc, all references to media/games/promos/campaigns are completely untouched
    await ref.delete();
  }

  async getAvailableComponents(): Promise<{
    games: Array<{ id: string; name: string; slug: string; image: string }>;
    promos: Array<{ id: string; name: string; code: string; discountType: string; discountValue: number }>;
    campaigns: Array<{ id: string; title: string; slug?: string }>;
    landings: Array<{ id: string; title: string; slug: string }>;
  }> {
    const [gamesSnap, promosSnap, campaignsSnap, landingsSnap] = await Promise.all([
      adminDb.collection("games").limit(50).get(),
      adminDb.collection("promos").limit(50).get(),
      adminDb.collection("campaigns").where("isArchived", "==", false).limit(50).get(),
      adminDb.collection("landings").where("isArchived", "==", false).limit(50).get()
    ]);

    const games = gamesSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        slug: data.slug,
        image: data.image || data.thumbnail || ""
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

    const campaigns = campaignsSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title,
        slug: data.slug
      };
    });

    const landings = landingsSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title,
        slug: data.slug
      };
    });

    return { games, promos, campaigns, landings };
  }
}
