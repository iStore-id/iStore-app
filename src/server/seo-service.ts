import { supabaseAdmin, isSupabaseAdminConfigured } from "./supabase-admin.js";
import { SystemConfigRepository } from "./supabase/system-config-repository.js";
import { SupabaseCatalogRepository } from "./supabase/catalog-repository.js";
import { SupabaseCMSRepository } from "./supabase/cms-repository.js";
import { SEOSettings, PublicSEOSettings } from "../types/seo.js";
import { logCoreAudit } from "./core-service.js";

const SEO_DOC_PATH = "system_configs/seo_settings";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const DEFAULT_SEO_SETTINGS: SEOSettings = {
  id: "global",
  siteName: "iStore.id",
  titleSeparator: " | ",
  defaultTitle: "Solusi Top Up Game & Voucher Digital Terpercaya",
  defaultDescription: "Platform top up game dan voucher digital terpercaya di Indonesia. Proses kilat instan 24 jam, harga termurah, dan metode pembayaran terlengkap.",
  defaultKeywords: [
    "top up game",
    "voucher game",
    "top up mlbb",
    "voucher ff",
    "beli diamond game",
    "istore indonesia"
  ],
  canonicalBaseUrl: "https://ist.web.id",
  favicon: "",
  googleSiteVerification: "",
  ga4Enabled: false,
  ga4MeasurementId: "",
  defaultOgImage: {
    url: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop",
    altText: "iStore.id - Top Up Game & Voucher Digital Terpercaya",
    width: 1200,
    height: 630
  },
  robotsPolicy: {
    allowIndexing: true,
    disallowPaths: [
      "/admin/",
      "/api/",
      "/transactions/",
      "/login",
      "/register"
    ],
    crawlDelay: undefined,
    customDirectives: ""
  },
  sitemapPolicy: {
    enabled: true,
    includeHomepage: true,
    includeGames: true,
    includeBlog: true,
    includeLandings: true,
    includeFaq: true,
    changefreqDefault: "daily",
    customPaths: []
  },
  socialMetadata: {
    twitterHandle: "@istore_id",
    twitterCreator: "@istore_id",
    twitterCardType: "summary_large_image",
    facebookAppId: ""
  },
  updatedAt: new Date().toISOString(),
  updatedBy: "system"
};

class SEOService {
  private static instance: SEOService;
  private cachedSettings: SEOSettings | null = null;
  private cacheExpiresAt = 0;
  private sitemapCacheXml: string | null = null;
  private sitemapCacheExpiresAt = 0;

  public static getInstance(): SEOService {
    if (!SEOService.instance) {
      SEOService.instance = new SEOService();
    }
    return SEOService.instance;
  }

  public invalidateCache(): void {
    this.cachedSettings = null;
    this.cacheExpiresAt = 0;
    this.sitemapCacheXml = null;
    this.sitemapCacheExpiresAt = 0;
  }

  /**
   * Fetch current SEO settings, initializing from safe defaults if not found.
   */
  async getSettings(): Promise<SEOSettings> {
    const now = Date.now();
    if (this.cachedSettings && this.cacheExpiresAt > now) {
      return this.cachedSettings;
    }

    try {
      const data = (await SystemConfigRepository.getInstance().getConfig("seo_settings")) as Partial<SEOSettings> | null;

      if (!data) {
        this.cachedSettings = DEFAULT_SEO_SETTINGS;
        this.cacheExpiresAt = now + CACHE_TTL_MS;
        return DEFAULT_SEO_SETTINGS;
      }
      // Deep merge with defaults to ensure complete structure
      const resolved: SEOSettings = {
        id: "global",
        siteName: data.siteName?.trim() || DEFAULT_SEO_SETTINGS.siteName,
        titleSeparator: data.titleSeparator || DEFAULT_SEO_SETTINGS.titleSeparator,
        defaultTitle: data.defaultTitle?.trim() || DEFAULT_SEO_SETTINGS.defaultTitle,
        defaultDescription: data.defaultDescription?.trim() || DEFAULT_SEO_SETTINGS.defaultDescription,
        defaultKeywords: Array.isArray(data.defaultKeywords) && data.defaultKeywords.length > 0 
          ? data.defaultKeywords 
          : DEFAULT_SEO_SETTINGS.defaultKeywords,
        canonicalBaseUrl: this.sanitizeBaseUrl(data.canonicalBaseUrl || DEFAULT_SEO_SETTINGS.canonicalBaseUrl),
        favicon: typeof data.favicon === "string" ? data.favicon.trim() : "",
        googleSiteVerification: typeof data.googleSiteVerification === "string" ? data.googleSiteVerification.trim() : "",
        ga4Enabled: typeof data.ga4Enabled === "boolean" ? data.ga4Enabled : false,
        ga4MeasurementId: typeof data.ga4MeasurementId === "string" ? data.ga4MeasurementId.trim().toUpperCase() : "",
        defaultOgImage: {
          mediaId: data.defaultOgImage?.mediaId || "",
          url: data.defaultOgImage?.url || DEFAULT_SEO_SETTINGS.defaultOgImage.url,
          altText: data.defaultOgImage?.altText || DEFAULT_SEO_SETTINGS.defaultOgImage.altText,
          width: data.defaultOgImage?.width || 1200,
          height: data.defaultOgImage?.height || 630
        },
        robotsPolicy: {
          allowIndexing: data.robotsPolicy?.allowIndexing ?? DEFAULT_SEO_SETTINGS.robotsPolicy.allowIndexing,
          disallowPaths: Array.isArray(data.robotsPolicy?.disallowPaths) 
            ? data.robotsPolicy.disallowPaths 
            : DEFAULT_SEO_SETTINGS.robotsPolicy.disallowPaths,
          crawlDelay: data.robotsPolicy?.crawlDelay,
          customDirectives: data.robotsPolicy?.customDirectives || ""
        },
        sitemapPolicy: {
          enabled: data.sitemapPolicy?.enabled ?? DEFAULT_SEO_SETTINGS.sitemapPolicy.enabled,
          includeHomepage: data.sitemapPolicy?.includeHomepage ?? DEFAULT_SEO_SETTINGS.sitemapPolicy.includeHomepage,
          includeGames: data.sitemapPolicy?.includeGames ?? DEFAULT_SEO_SETTINGS.sitemapPolicy.includeGames,
          includeBlog: data.sitemapPolicy?.includeBlog ?? DEFAULT_SEO_SETTINGS.sitemapPolicy.includeBlog,
          includeLandings: data.sitemapPolicy?.includeLandings ?? DEFAULT_SEO_SETTINGS.sitemapPolicy.includeLandings,
          includeFaq: data.sitemapPolicy?.includeFaq ?? DEFAULT_SEO_SETTINGS.sitemapPolicy.includeFaq,
          changefreqDefault: data.sitemapPolicy?.changefreqDefault || DEFAULT_SEO_SETTINGS.sitemapPolicy.changefreqDefault,
          customPaths: Array.isArray(data.sitemapPolicy?.customPaths) ? data.sitemapPolicy.customPaths : []
        },
        socialMetadata: {
          twitterHandle: data.socialMetadata?.twitterHandle || DEFAULT_SEO_SETTINGS.socialMetadata.twitterHandle,
          twitterCreator: data.socialMetadata?.twitterCreator || DEFAULT_SEO_SETTINGS.socialMetadata.twitterCreator,
          twitterCardType: data.socialMetadata?.twitterCardType || DEFAULT_SEO_SETTINGS.socialMetadata.twitterCardType,
          facebookAppId: data.socialMetadata?.facebookAppId || ""
        },
        updatedAt: data.updatedAt || new Date().toISOString(),
        updatedBy: data.updatedBy || "system"
      };

      this.cachedSettings = resolved;
      this.cacheExpiresAt = now + CACHE_TTL_MS;
      return resolved;
    } catch (err) {
      console.error("[SEOService] Failed to fetch SEO settings from Supabase, fallback to defaults:", err);
      return DEFAULT_SEO_SETTINGS;
    }
  }

  /**
   * Safe public representation of SEO configuration (no sensitive or internal fields)
   */
  async getPublicSettings(): Promise<PublicSEOSettings> {
    const s = await this.getSettings();
    return {
      siteName: s.siteName,
      titleSeparator: s.titleSeparator,
      defaultTitle: s.defaultTitle,
      defaultDescription: s.defaultDescription,
      defaultKeywords: s.defaultKeywords,
      canonicalBaseUrl: s.canonicalBaseUrl,
      favicon: s.favicon,
      googleSiteVerification: s.googleSiteVerification,
      ga4Enabled: s.ga4Enabled,
      ga4MeasurementId: s.ga4MeasurementId,
      defaultOgImage: s.defaultOgImage,
      socialMetadata: s.socialMetadata
    };
  }

  /**
   * Update SEO settings with validation and audit logging
   */
  async updateSettings(
    actor: { uid: string; email: string },
    actorRole: string,
    updates: Partial<SEOSettings>,
    reason?: string
  ): Promise<SEOSettings> {
    const current = await this.getSettings();

    // Validation
    const cleanSiteName = (updates.siteName || current.siteName).trim();
    if (!cleanSiteName) throw new Error("Nama situs (site name) tidak boleh kosong");

    const cleanDefaultTitle = (updates.defaultTitle || current.defaultTitle).trim();
    if (!cleanDefaultTitle) throw new Error("Default meta title tidak boleh kosong");

    const cleanDefaultDescription = (updates.defaultDescription || current.defaultDescription).trim();
    if (!cleanDefaultDescription) throw new Error("Default meta description tidak boleh kosong");

    const rawCanonical = updates.canonicalBaseUrl !== undefined ? updates.canonicalBaseUrl : current.canonicalBaseUrl;
    const cleanCanonical = this.sanitizeBaseUrl(rawCanonical);

    // Validate Google Site Verification
    const rawGscToken = updates.googleSiteVerification !== undefined ? updates.googleSiteVerification : current.googleSiteVerification;
    if (rawGscToken !== undefined && typeof rawGscToken !== "string" && rawGscToken !== null) {
      throw new Error("Token Google Site Verification harus berupa string.");
    }
    let cleanGscToken = (rawGscToken || "").trim();
    cleanGscToken = cleanGscToken.replace(/<[^>]*>/g, "").replace(/["\r\n]+/g, "").trim();

    // Validate GA4 Settings
    const cleanGa4Enabled = updates.ga4Enabled !== undefined ? Boolean(updates.ga4Enabled) : (current.ga4Enabled ?? false);
    const rawGa4Id = updates.ga4MeasurementId !== undefined ? updates.ga4MeasurementId : current.ga4MeasurementId;
    if (rawGa4Id !== undefined && typeof rawGa4Id !== "string" && rawGa4Id !== null) {
      throw new Error("GA4 Measurement ID harus berupa string.");
    }
    let cleanGa4Id = (rawGa4Id || "").trim().toUpperCase();
    cleanGa4Id = cleanGa4Id.replace(/<[^>]*>/g, "").replace(/["\r\n\s]+/g, "").trim();

    if (cleanGa4Enabled) {
      if (!cleanGa4Id) {
        throw new Error("GA4 Measurement ID wajib diisi ketika Google Analytics 4 diaktifkan (contoh: G-XXXXXXXXXX).");
      }
      if (!/^G-[A-Z0-9]+$/i.test(cleanGa4Id)) {
        throw new Error("Format GA4 Measurement ID tidak valid. Harus diawali dengan 'G-' diikuti karakter alfanumerik (contoh: G-XXXXXXXXXX).");
      }
    }

    // Validate default OG Image
    const ogImageInput = updates.defaultOgImage || current.defaultOgImage;
    if (!ogImageInput.url || !this.isValidHttpUrl(ogImageInput.url)) {
      throw new Error("URL Open Graph image default tidak valid. Harap pilih dari Media Library.");
    }

    // Prepare updated object
    const newSettings: SEOSettings = {
      id: "global",
      siteName: cleanSiteName,
      titleSeparator: updates.titleSeparator || current.titleSeparator,
      defaultTitle: cleanDefaultTitle,
      defaultDescription: cleanDefaultDescription,
      defaultKeywords: Array.isArray(updates.defaultKeywords) 
        ? updates.defaultKeywords.map(k => k.trim()).filter(Boolean)
        : current.defaultKeywords,
      canonicalBaseUrl: cleanCanonical,
      favicon: typeof updates.favicon === "string"
        ? updates.favicon.trim()
        : (current.favicon || ""),
      googleSiteVerification: cleanGscToken,
      ga4Enabled: cleanGa4Enabled,
      ga4MeasurementId: cleanGa4Id,
      defaultOgImage: {
        mediaId: ogImageInput.mediaId || "",
        url: ogImageInput.url,
        altText: (ogImageInput.altText || cleanSiteName).trim(),
        width: ogImageInput.width || 1200,
        height: ogImageInput.height || 630
      },
      robotsPolicy: {
        allowIndexing: updates.robotsPolicy?.allowIndexing ?? current.robotsPolicy.allowIndexing,
        disallowPaths: Array.isArray(updates.robotsPolicy?.disallowPaths)
          ? updates.robotsPolicy.disallowPaths.map(p => this.sanitizePath(p)).filter(Boolean)
          : current.robotsPolicy.disallowPaths,
        crawlDelay: typeof updates.robotsPolicy?.crawlDelay === "number" ? Math.max(0, updates.robotsPolicy.crawlDelay) : undefined,
        customDirectives: (updates.robotsPolicy?.customDirectives || "").trim()
      },
      sitemapPolicy: {
        enabled: updates.sitemapPolicy?.enabled ?? current.sitemapPolicy.enabled,
        includeHomepage: updates.sitemapPolicy?.includeHomepage ?? current.sitemapPolicy.includeHomepage,
        includeGames: updates.sitemapPolicy?.includeGames ?? current.sitemapPolicy.includeGames,
        includeBlog: updates.sitemapPolicy?.includeBlog ?? current.sitemapPolicy.includeBlog,
        includeLandings: updates.sitemapPolicy?.includeLandings ?? current.sitemapPolicy.includeLandings,
        includeFaq: updates.sitemapPolicy?.includeFaq ?? current.sitemapPolicy.includeFaq,
        changefreqDefault: updates.sitemapPolicy?.changefreqDefault || current.sitemapPolicy.changefreqDefault,
        customPaths: Array.isArray(updates.sitemapPolicy?.customPaths)
          ? updates.sitemapPolicy.customPaths.map(p => this.sanitizePath(p)).filter(Boolean)
          : current.sitemapPolicy.customPaths
      },
      socialMetadata: {
        twitterHandle: (updates.socialMetadata?.twitterHandle || current.socialMetadata.twitterHandle || "").trim(),
        twitterCreator: (updates.socialMetadata?.twitterCreator || current.socialMetadata.twitterCreator || "").trim(),
        twitterCardType: updates.socialMetadata?.twitterCardType || current.socialMetadata.twitterCardType,
        facebookAppId: (updates.socialMetadata?.facebookAppId || "").trim()
      },
      updatedAt: new Date().toISOString(),
      updatedBy: actor.email || actor.uid
    };

    try {
      await SystemConfigRepository.getInstance().upsertConfig("seo_settings", newSettings);
    } catch (error: any) {
      throw new Error(`Failed to save SEO settings to SystemConfigRepository: ${error.message}`);
    }

    // Audit log
    await logCoreAudit(
      actor,
      actorRole,
      "UPDATE_SEO_SETTINGS",
      SEO_DOC_PATH,
      current,
      newSettings,
      reason || "SEO configuration updated via Admin"
    );

    this.invalidateCache();
    return newSettings;
  }

  /**
   * Reset SEO settings to safe default configuration
   */
  async resetToDefaults(actor: { uid: string; email: string }, actorRole: string): Promise<SEOSettings> {
    const current = await this.getSettings();
    const resetData: SEOSettings = {
      ...DEFAULT_SEO_SETTINGS,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.email || actor.uid
    };

    try {
      await SystemConfigRepository.getInstance().upsertConfig("seo_settings", resetData);
    } catch (error: any) {
      throw new Error(`Failed to reset SEO settings in SystemConfigRepository: ${error.message}`);
    }

    await logCoreAudit(
      actor,
      actorRole,
      "RESET_SEO_SETTINGS",
      SEO_DOC_PATH,
      current,
      resetData,
      "SEO configuration reset to safe defaults"
    );

    this.invalidateCache();
    return resetData;
  }

  /**
   * Generate authoritative robots.txt content
   */
  async generateRobotsTxt(hostHeader?: string): Promise<string> {
    const settings = await this.getSettings();
    const isNonProd = this.isNonProductionHost(hostHeader);

    // Non-production or indexing disabled by owner: disallow all crawlers to prevent staging indexing
    if (isNonProd || !settings.robotsPolicy.allowIndexing) {
      return [
        "# robots.txt for  (Staging / Indexing Paused)",
        "User-agent: *",
        "Disallow: /",
        ""
      ].join("\n");
    }

    const lines: string[] = [
      "# robots.txt for ",
      "User-agent: *",
      "Allow: /"
    ];

    // Disallow paths
    for (const p of settings.robotsPolicy.disallowPaths) {
      if (p.trim()) {
        lines.push(`Disallow: ${p.trim()}`);
      }
    }

    // Crawl delay if set
    if (settings.robotsPolicy.crawlDelay && settings.robotsPolicy.crawlDelay > 0) {
      lines.push(`Crawl-delay: ${settings.robotsPolicy.crawlDelay}`);
    }

    // Custom directives
    if (settings.robotsPolicy.customDirectives) {
      lines.push(settings.robotsPolicy.customDirectives.trim());
    }

    // Sitemap link
    if (settings.sitemapPolicy.enabled && settings.canonicalBaseUrl) {
      const baseUrl = settings.canonicalBaseUrl.replace(/\/+$/, "");
      lines.push("");
      lines.push(`Sitemap: ${baseUrl}/sitemap.xml`);
    }

    return lines.join("\n") + "\n";
  }

  /**
   * Generate authoritative sitemap.xml content
   */
  async generateSitemapXml(): Promise<string> {
    const now = Date.now();
    if (this.sitemapCacheXml && this.sitemapCacheExpiresAt > now) {
      return this.sitemapCacheXml;
    }

    const settings = await this.getSettings();
    if (!settings.sitemapPolicy.enabled || !settings.canonicalBaseUrl) {
      return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>`;
    }

    const baseUrl = settings.canonicalBaseUrl.replace(/\/+$/, "");
    const urls: Array<{ loc: string; lastmod: string; changefreq: string; priority: string }> = [];
    const todayIso = new Date().toISOString().split("T")[0];

    // 1. Homepage
    if (settings.sitemapPolicy.includeHomepage) {
      urls.push({
        loc: `${baseUrl}/`,
        lastmod: todayIso,
        changefreq: "daily",
        priority: "1.0"
      });
    }

    // 2. Active, published games
    if (settings.sitemapPolicy.includeGames) {
      try {
        const games = await SupabaseCatalogRepository.getInstance().listGames(true);

        games.forEach(g => {
          if (g.slug && g.availability !== "unavailable") {
            const modDate = g.updatedAt ? g.updatedAt.split("T")[0] : todayIso;
            urls.push({
              loc: `${baseUrl}/games/${encodeURIComponent(g.slug)}`,
              lastmod: modDate,
              changefreq: "daily",
              priority: "0.9"
            });
          }
        });
      } catch (err) {
        console.error("[SEOService] Error fetching games for sitemap:", err);
      }
    }

    // 3. Blog listing & published blog posts
    if (settings.sitemapPolicy.includeBlog) {
      urls.push({
        loc: `${baseUrl}/blog`,
        lastmod: todayIso,
        changefreq: "daily",
        priority: "0.8"
      });

      try {
        const { items: blogs } = await SupabaseCMSRepository.getInstance().listBlogs({ onlyActive: true, limit: 1000 });

        blogs.forEach(b => {
          if (b.slug) {
            const modDate = b.updatedAt ? b.updatedAt.split("T")[0] : (b.publishedAt ? b.publishedAt.split("T")[0] : todayIso);
            urls.push({
              loc: `${baseUrl}/blog/${encodeURIComponent(b.slug)}`,
              lastmod: modDate,
              changefreq: "weekly",
              priority: "0.7"
            });
          }
        });
      } catch (err) {
        console.error("[SEOService] Error fetching blogs for sitemap:", err);
      }
    }

    // 4. Published landing pages
    if (settings.sitemapPolicy.includeLandings) {
      try {
        const landings = await SupabaseCMSRepository.getInstance().listLandings(true);

        landings.forEach(l => {
          if (l.slug) {
            const modDate = l.updatedAt ? l.updatedAt.split("T")[0] : todayIso;
            urls.push({
              loc: `${baseUrl}/landing/${encodeURIComponent(l.slug)}`,
              lastmod: modDate,
              changefreq: "weekly",
              priority: "0.7"
            });
          }
        });
      } catch (err) {
        console.error("[SEOService] Error fetching landings for sitemap:", err);
      }
    }

    // 5. FAQ
    if (settings.sitemapPolicy.includeFaq) {
      urls.push({
        loc: `${baseUrl}/faq`,
        lastmod: todayIso,
        changefreq: "weekly",
        priority: "0.6"
      });
    }

    // 6. Custom safe paths
    if (settings.sitemapPolicy.customPaths && settings.sitemapPolicy.customPaths.length > 0) {
      for (const p of settings.sitemapPolicy.customPaths) {
        const sanitized = this.sanitizePath(p);
        if (sanitized && !sanitized.startsWith("/admin") && !sanitized.startsWith("/api")) {
          urls.push({
            loc: `${baseUrl}${sanitized}`,
            lastmod: todayIso,
            changefreq: settings.sitemapPolicy.changefreqDefault || "weekly",
            priority: "0.5"
          });
        }
      }
    }

    // Deduplicate and sort deterministically by loc
    const uniqueMap = new Map<string, typeof urls[0]>();
    for (const item of urls) {
      if (!uniqueMap.has(item.loc)) {
        uniqueMap.set(item.loc, item);
      }
    }

    const sortedUrls = Array.from(uniqueMap.values()).sort((a, b) => a.loc.localeCompare(b.loc));

    // Construct XML
    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
      ...sortedUrls.map(u => [
        `  <url>`,
        `    <loc>${this.escapeXml(u.loc)}</loc>`,
        `    <lastmod>${u.lastmod}</lastmod>`,
        `    <changefreq>${u.changefreq}</changefreq>`,
        `    <priority>${u.priority}</priority>`,
        `  </url>`
      ].join("\n")),
      `</urlset>`
    ].join("\n");

    this.sitemapCacheXml = xml;
    this.sitemapCacheExpiresAt = now + CACHE_TTL_MS;
    return xml;
  }

  // --- Security & Sanitation Utilities ---

  private sanitizeBaseUrl(urlStr: string): string {
    let clean = (urlStr || "").trim();
    if (!clean) return "https://ist.web.id";
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = `https://${clean}`;
    }
    // In production, force HTTPS
    if (process.env.NODE_ENV === "production" && clean.startsWith("http://")) {
      clean = clean.replace(/^http:\/\//i, "https://");
    }
    // Remove trailing slash
    return clean.replace(/\/+$/, "");
  }

  private sanitizePath(pathStr: string): string {
    let p = (pathStr || "").trim();
    if (!p.startsWith("/")) p = `/${p}`;
    return p.replace(/\/{2,}/g, "/");
  }

  private isValidHttpUrl(string: string): boolean {
    try {
      const url = new URL(string);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
      return false;
    }
  }

  private isNonProductionHost(hostHeader?: string): boolean {
    if (!hostHeader) return false;
    const h = hostHeader.toLowerCase();
    return (
      h.includes("localhost") ||
      h.includes("run.app") ||
      h.includes("staging") ||
      h.includes("preview") ||
      h.includes("dev")
    );
  }

  private escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, c => {
      switch (c) {
        case "<": return "&lt;";
        case ">": return "&gt;";
        case "&": return "&amp;";
        case "'": return "&apos;";
        case '"': return "&quot;";
        default: return c;
      }
    });
  }
}

export const seoService = SEOService.getInstance();
