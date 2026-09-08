import { adminDb } from "./firebase-admin";
import { FAQItem, FAQAdminItem, FAQStatus, PublicFAQItem, FAQAdminListResponse } from "../types/faq";

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

  private constructor() {}

  public static getInstance(): FAQService {
    if (!FAQService.instance) {
      FAQService.instance = new FAQService();
    }
    return FAQService.instance;
  }

  // =========================================================================
  // SEED INITIAL FAQS IF EMPTY
  // =========================================================================
  async seedInitialFaqsIfEmpty(): Promise<void> {
    try {
      const existing = await adminDb.collection("faqs").limit(1).get();
      if (!existing.empty) return;

      const now = new Date().toISOString();

      const initialSamples: Array<Omit<FAQItem, "id">> = [
        {
          question: "Berapa lama proses pengiriman diamond setelah pembayaran?",
          answer: "Semua pesanan di iStore.id diproses secara otomatis 24 jam nonstop oleh sistem engine kami. Diamond atau voucher umumnya langsung masuk ke akun game Anda dalam waktu **5 hingga 60 detik** setelah pembayaran berhasil dikonfirmasi oleh payment gateway.",
          category: "Transaksi & Pengiriman",
          sortOrder: 1,
          published: true,
          enabled: true,
          archived: false,
          createdBy: "system",
          updatedBy: "system",
          createdAt: now,
          updatedAt: now,
          publishedAt: now
        },
        {
          question: "Metode pembayaran apa saja yang didukung di iStore.id?",
          answer: "Kami mendukung berbagai metode pembayaran terpercaya untuk kemudahan Anda:\n- **QRIS Real-time** (Semua e-wallet & Mobile Banking: BCA, Mandiri, BRI, BNI, GoPay, OVO, DANA, ShopeePay, LinkAja)\n- **Virtual Account Bank** (BCA, Mandiri, BNI, BRI, Permata, Danamon, CIMB)\n- **E-Wallet Langsung** (GoPay, ShopeePay)\n- **Convenience Store** (Indomaret & Alfamart)",
          category: "Pembayaran",
          sortOrder: 2,
          published: true,
          enabled: true,
          archived: false,
          createdBy: "system",
          updatedBy: "system",
          createdAt: now,
          updatedAt: now,
          publishedAt: now
        },
        {
          question: "Apakah top up game di iStore.id 100% legal dan bergaransi?",
          answer: "Ya, 100% legal dan bergaransi resmi. iStore.id hanya terhubung langsung dengan distributor dan publisher resmi. Diamond dan item dijamin **anti-minus**, aman dari banned, dan memiliki bukti invoice sah yang tersimpan di sistem kami.",
          category: "Akun & Keamanan",
          sortOrder: 3,
          published: true,
          enabled: true,
          archived: false,
          createdBy: "system",
          updatedBy: "system",
          createdAt: now,
          updatedAt: now,
          publishedAt: now
        },
        {
          question: "Bagaimana cara mengecek status transaksi saya?",
          answer: "Anda dapat mengecek status transaksi kapan saja melalui menu **Cek Transaksi** pada navigasi atas atau footer. Cukup masukkan nomor invoice pesanan Anda (contoh: `INV-20260904-XXXX`) untuk melihat rincian pembayaran dan progres fulfillment secara real-time.",
          category: "Transaksi & Pengiriman",
          sortOrder: 4,
          published: true,
          enabled: true,
          archived: false,
          createdBy: "system",
          updatedBy: "system",
          createdAt: now,
          updatedAt: now,
          publishedAt: now
        },
        {
          question: "Bagaimana jika salah memasukkan User ID atau Zone ID game?",
          answer: "Harap periksa kembali User ID dan Zone ID Anda sebelum menekan tombol pembayaran. Jika pesanan sudah terlanjur diproses otomatis ke ID tujuan yang salah namun ID tersebut valid di server game, pesanan tidak dapat ditarik kembali. Namun jika transaksi gagal karena ID tidak ditemukan, sistem akan membatalkan pesanan atau Anda dapat menghubungi Customer Service kami untuk bantuan investigasi.",
          category: "Akun & Keamanan",
          sortOrder: 5,
          published: true,
          enabled: true,
          archived: false,
          createdBy: "system",
          updatedBy: "system",
          createdAt: now,
          updatedAt: now,
          publishedAt: now
        },
        {
          question: "Bagaimana cara menggunakan voucher promo atau kode diskon?",
          answer: "Pada langkah pemesanan di halaman game, Anda akan menemukan kolom **Kode Voucher / Promo**. Masukkan kode promo yang masih berlaku lalu klik tombol **Terapkan**. Potongan harga akan otomatis mengurangi total tagihan Anda sebelum pembayaran.",
          category: "Promo & Voucher",
          sortOrder: 6,
          published: true,
          enabled: true,
          archived: false,
          createdBy: "system",
          updatedBy: "system",
          createdAt: now,
          updatedAt: now,
          publishedAt: now
        }
      ];

      const batch = adminDb.batch();
      for (const item of initialSamples) {
        const docRef = adminDb.collection("faqs").doc();
        batch.set(docRef, item);
      }
      await batch.commit();
    } catch (e) {
      console.warn("Notice: seedInitialFaqsIfEmpty warning:", e);
    }
  }

  // =========================================================================
  // PUBLIC QUERIES (STRICT ELIGIBILITY: published=true, enabled=true, archived=false)
  // =========================================================================
  async getPublicFaqs(options: {
    category?: string;
    search?: string;
  } = {}): Promise<{ items: PublicFAQItem[]; total: number; categories: string[] }> {
    let snap = await adminDb
      .collection("faqs")
      .where("archived", "==", false)
      .where("published", "==", true)
      .where("enabled", "==", true)
      .get();

    if (snap.empty) {
      await this.seedInitialFaqsIfEmpty();
      snap = await adminDb
        .collection("faqs")
        .where("archived", "==", false)
        .where("published", "==", true)
        .where("enabled", "==", true)
        .get();
    }

    const distinctCategories = new Set<string>();
    const eligibleItems: FAQItem[] = [];

    for (const doc of snap.docs) {
      const data = doc.data() as Omit<FAQItem, "id">;
      const faqItem: FAQItem = {
        id: doc.id,
        ...data,
        sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
        published: Boolean(data.published),
        enabled: Boolean(data.enabled),
        archived: Boolean(data.archived)
      };

      if (faqItem.category) {
        distinctCategories.add(faqItem.category);
      }
      eligibleItems.push(faqItem);
    }

    // In-memory filter for search & category
    let filtered = eligibleItems;
    if (options.category && options.category !== "ALL") {
      const targetCat = options.category.trim().toLowerCase();
      filtered = filtered.filter((f) => f.category.toLowerCase() === targetCat);
    }

    if (options.search && options.search.trim()) {
      const term = options.search.trim().toLowerCase();
      filtered = filtered.filter(
        (f) =>
          f.question.toLowerCase().includes(term) ||
          f.answer.toLowerCase().includes(term) ||
          f.category.toLowerCase().includes(term)
      );
    }

    // Deterministic sorting: sortOrder ASC, createdAt DESC
    filtered.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Hydrate lightweight references (Reference safety: IDs only in DB, hydrated at runtime)
    const publicItems: PublicFAQItem[] = await Promise.all(
      filtered.map(async (item) => {
        let relatedGame = null;
        let relatedPromo = null;

        if (item.relatedGameId) {
          try {
            const gDoc = await adminDb.collection("games").doc(item.relatedGameId).get();
            if (gDoc.exists) {
              const gData = gDoc.data() || {};
              relatedGame = {
                id: gDoc.id,
                name: gData.name || "Game",
                slug: gData.slug || gDoc.id,
                image: gData.image || ""
              };
            }
          } catch (e) {
            // Non-blocking
          }
        }

        if (item.relatedPromoId) {
          try {
            const pDoc = await adminDb.collection("promos").doc(item.relatedPromoId).get();
            if (pDoc.exists) {
              const pData = pDoc.data() || {};
              relatedPromo = {
                id: pDoc.id,
                name: pData.name || "Promo",
                code: pData.code || "",
                discountType: pData.discountType || "fixed",
                discountValue: pData.discountValue || 0
              };
            }
          } catch (e) {
            // Non-blocking
          }
        }

        return {
          id: item.id,
          question: item.question,
          answer: item.answer,
          category: item.category,
          sortOrder: item.sortOrder,
          relatedGame,
          relatedPromo
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
    const doc = await adminDb.collection("faqs").doc(id).get();
    if (!doc.exists) return null;

    const data = doc.data() as Omit<FAQItem, "id">;
    // Strict server-side eligibility check
    if (data.archived || !data.published || !data.enabled) {
      return null;
    }

    let relatedGame = null;
    let relatedPromo = null;

    if (data.relatedGameId) {
      try {
        const gDoc = await adminDb.collection("games").doc(data.relatedGameId).get();
        if (gDoc.exists) {
          const gData = gDoc.data() || {};
          relatedGame = {
            id: gDoc.id,
            name: gData.name || "Game",
            slug: gData.slug || gDoc.id,
            image: gData.image || ""
          };
        }
      } catch (e) {
        // Safe failover
      }
    }

    if (data.relatedPromoId) {
      try {
        const pDoc = await adminDb.collection("promos").doc(data.relatedPromoId).get();
        if (pDoc.exists) {
          const pData = pDoc.data() || {};
          relatedPromo = {
            id: pDoc.id,
            name: pData.name || "Promo",
            code: pData.code || "",
            discountType: pData.discountType || "fixed",
            discountValue: pData.discountValue || 0
          };
        }
      } catch (e) {
        // Safe failover
      }
    }

    return {
      id: doc.id,
      question: data.question,
      answer: data.answer,
      category: data.category,
      sortOrder: data.sortOrder || 0,
      relatedGame,
      relatedPromo
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

    let snap = await adminDb.collection("faqs").get();
    if (snap.empty) {
      await this.seedInitialFaqsIfEmpty();
      snap = await adminDb.collection("faqs").get();
    }

    const distinctCategories = new Set<string>();

    let allItems: FAQAdminItem[] = snap.docs.map((doc) => {
      const data = doc.data() as Omit<FAQItem, "id">;
      const status = computeFaqStatus(data);
      if (data.category) {
        distinctCategories.add(data.category);
      }
      return {
        id: doc.id,
        ...data,
        sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
        published: Boolean(data.published),
        enabled: Boolean(data.enabled),
        archived: Boolean(data.archived),
        status
      };
    });

    // Filter Archived
    if (!options.includeArchived) {
      allItems = allItems.filter((i) => !i.archived);
    }

    // Filter Status
    if (options.status && options.status !== "ALL") {
      allItems = allItems.filter((i) => i.status === options.status);
    }

    // Filter Category
    if (options.category && options.category !== "ALL") {
      const cat = options.category.trim().toLowerCase();
      allItems = allItems.filter((i) => i.category.toLowerCase() === cat);
    }

    // Search
    if (options.search && options.search.trim()) {
      const term = options.search.trim().toLowerCase();
      allItems = allItems.filter(
        (i) =>
          i.question.toLowerCase().includes(term) ||
          i.answer.toLowerCase().includes(term) ||
          i.category.toLowerCase().includes(term)
      );
    }

    // Sort order: sortOrder ASC, createdAt DESC
    allItems.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const total = allItems.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedItems = allItems.slice(startIndex, startIndex + limit);

    return {
      items: paginatedItems,
      total,
      page,
      totalPages,
      categories: Array.from(distinctCategories).sort()
    };
  }

  async getAdminFaqById(id: string): Promise<FAQAdminItem | null> {
    const doc = await adminDb.collection("faqs").doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data() as Omit<FAQItem, "id">;
    return {
      id: doc.id,
      ...data,
      sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
      published: Boolean(data.published),
      enabled: Boolean(data.enabled),
      archived: Boolean(data.archived),
      status: computeFaqStatus(data)
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
    if (!question) {
      throw new Error("Pertanyaan FAQ wajib diisi.");
    }
    if (question.length < 5) {
      throw new Error("Pertanyaan terlalu pendek (minimal 5 karakter).");
    }

    const answer = sanitizeFaqContent(payload.answer || "");
    if (!answer) {
      throw new Error("Jawaban FAQ wajib diisi.");
    }

    const category = (payload.category || "Umum").trim();
    const sortOrder = typeof payload.sortOrder === "number" ? payload.sortOrder : 0;
    const published = payload.published !== undefined ? Boolean(payload.published) : true;
    const enabled = payload.enabled !== undefined ? Boolean(payload.enabled) : true;
    const now = new Date().toISOString();

    const faqData: Omit<FAQItem, "id"> = {
      question,
      answer,
      category,
      sortOrder,
      published,
      enabled,
      archived: false,
      relatedGameId: payload.relatedGameId || "",
      relatedPromoId: payload.relatedPromoId || "",
      relatedBlogId: payload.relatedBlogId || "",
      createdBy: uid,
      updatedBy: uid,
      createdAt: now,
      updatedAt: now,
      publishedAt: published ? now : ""
    };

    const docRef = await adminDb.collection("faqs").add(faqData);
    return {
      id: docRef.id,
      ...faqData,
      status: computeFaqStatus(faqData)
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
    const docRef = adminDb.collection("faqs").doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      throw new Error("FAQ tidak ditemukan.");
    }

    const existingData = existing.data() as FAQItem;
    const now = new Date().toISOString();

    const updates: Partial<FAQItem> = {
      updatedBy: uid,
      updatedAt: now
    };

    if (payload.question !== undefined) {
      const q = payload.question.trim();
      if (!q || q.length < 5) {
        throw new Error("Pertanyaan wajib diisi minimal 5 karakter.");
      }
      updates.question = q;
    }

    if (payload.answer !== undefined) {
      const ans = sanitizeFaqContent(payload.answer);
      if (!ans) {
        throw new Error("Jawaban FAQ tidak boleh kosong.");
      }
      updates.answer = ans;
    }

    if (payload.category !== undefined) {
      updates.category = payload.category.trim() || "Umum";
    }

    if (payload.sortOrder !== undefined) {
      updates.sortOrder = Number(payload.sortOrder) || 0;
    }

    if (payload.published !== undefined) {
      updates.published = Boolean(payload.published);
      if (updates.published && !existingData.publishedAt) {
        updates.publishedAt = now;
      }
    }

    if (payload.enabled !== undefined) {
      updates.enabled = Boolean(payload.enabled);
    }

    if (payload.relatedGameId !== undefined) {
      updates.relatedGameId = payload.relatedGameId || "";
    }

    if (payload.relatedPromoId !== undefined) {
      updates.relatedPromoId = payload.relatedPromoId || "";
    }

    if (payload.relatedBlogId !== undefined) {
      updates.relatedBlogId = payload.relatedBlogId || "";
    }

    await docRef.update(updates);
    const updatedDoc = await docRef.get();
    const updatedData = updatedDoc.data() as FAQItem;

    return {
      id: updatedDoc.id,
      ...updatedData,
      status: computeFaqStatus(updatedData)
    };
  }

  async publishFaq(id: string, published: boolean, uid: string): Promise<FAQAdminItem> {
    const docRef = adminDb.collection("faqs").doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      throw new Error("FAQ tidak ditemukan.");
    }

    const now = new Date().toISOString();
    const updates: any = {
      published: Boolean(published),
      updatedBy: uid,
      updatedAt: now
    };
    if (published && !existing.data()?.publishedAt) {
      updates.publishedAt = now;
    }

    await docRef.update(updates);
    const updated = await docRef.get();
    const data = updated.data() as FAQItem;

    return {
      id: updated.id,
      ...data,
      status: computeFaqStatus(data)
    };
  }

  async toggleEnableFaq(id: string, enabled: boolean, uid: string): Promise<FAQAdminItem> {
    const docRef = adminDb.collection("faqs").doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      throw new Error("FAQ tidak ditemukan.");
    }

    const now = new Date().toISOString();
    await docRef.update({
      enabled: Boolean(enabled),
      updatedBy: uid,
      updatedAt: now
    });

    const updated = await docRef.get();
    const data = updated.data() as FAQItem;
    return {
      id: updated.id,
      ...data,
      status: computeFaqStatus(data)
    };
  }

  async archiveFaq(id: string, uid: string): Promise<FAQAdminItem> {
    const docRef = adminDb.collection("faqs").doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      throw new Error("FAQ tidak ditemukan.");
    }

    const now = new Date().toISOString();
    await docRef.update({
      archived: true,
      enabled: false,
      updatedBy: uid,
      updatedAt: now
    });

    const updated = await docRef.get();
    const data = updated.data() as FAQItem;
    return {
      id: updated.id,
      ...data,
      status: computeFaqStatus(data)
    };
  }

  async reorderFaqs(
    items: Array<{ id: string; sortOrder: number }>,
    uid: string
  ): Promise<void> {
    if (!items || !Array.isArray(items) || items.length === 0) return;

    const batch = adminDb.batch();
    const now = new Date().toISOString();

    for (const item of items) {
      if (!item.id) continue;
      const ref = adminDb.collection("faqs").doc(item.id);
      batch.update(ref, {
        sortOrder: Number(item.sortOrder) || 0,
        updatedBy: uid,
        updatedAt: now
      });
    }

    await batch.commit();
  }

  // Reference safety: Only deletes the FAQ document itself.
  // Referenced games, promos, or media are NEVER deleted.
  async deleteFaq(id: string): Promise<void> {
    const docRef = adminDb.collection("faqs").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error("FAQ tidak ditemukan.");
    }

    await docRef.delete();
  }

  // Reusable lightweight components reference data for Admin editor
  async getAvailableComponents(): Promise<{
    games: Array<{ id: string; name: string; slug: string; image: string }>;
    promos: Array<{ id: string; name: string; code: string; discountType: string; discountValue: number }>;
    blogs: Array<{ id: string; title: string; slug: string }>;
  }> {
    const [gamesSnap, promosSnap, blogsSnap] = await Promise.all([
      adminDb.collection("games").limit(50).get(),
      adminDb.collection("promos").limit(50).get(),
      adminDb.collection("blogs").where("isArchived", "==", false).limit(30).get()
    ]);

    const games = gamesSnap.docs.map((d) => ({
      id: d.id,
      name: d.data().name || "Game",
      slug: d.data().slug || d.id,
      image: d.data().image || ""
    }));

    const promos = promosSnap.docs.map((d) => ({
      id: d.id,
      name: d.data().name || "Promo",
      code: d.data().code || "",
      discountType: d.data().discountType || "fixed",
      discountValue: d.data().discountValue || 0
    }));

    const blogs = blogsSnap.docs.map((d) => ({
      id: d.id,
      title: d.data().title || "Artikel",
      slug: d.data().slug || d.id
    }));

    return { games, promos, blogs };
  }
}
