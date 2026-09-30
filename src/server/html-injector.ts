import fs from "fs";
import path from "path";
import { Request, Response, NextFunction } from "express";
import { DynamicCatalogService } from "./dynamic-catalog-service.js";
import { BlogService } from "./blog-service.js";
import { seoService } from "./seo-service.js";

function getIndexHtmlTemplate(): string {
  try {
    const isProd = process.env.NODE_ENV === "production";
    const indexPath = isProd
      ? path.join(process.cwd(), "dist", "index.html")
      : path.join(process.cwd(), "index.html");

    if (fs.existsSync(indexPath)) {
      return fs.readFileSync(indexPath, "utf-8");
    }
  } catch (err) {
    console.error("[HTML Injector] Failed to read index.html template:", err);
  }
  return "";
}

function sanitizeText(str?: string): string {
  if (!str) return "";
  return str
    .replace(/<[^>]*>/g, "")
    .replace(/["\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function escapeHtml(str?: string): string {
  if (!str) return "";
  return sanitizeText(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeJsonLd(data: any): string {
  try {
    return JSON.stringify(data).replace(/</g, "\\u003c");
  } catch {
    return "";
  }
}

interface MetaInjectionParams {
  title: string;
  description: string;
  canonicalUrl: string;
  ogImage?: string;
  ogType?: string;
  jsonLd?: any;
  googleSiteVerification?: string;
  ga4Enabled?: boolean;
  ga4MeasurementId?: string;
}

function injectMetaToHtml(template: string, meta: MetaInjectionParams): string {
  let html = template;

  const safeTitle = escapeHtml(meta.title);
  const safeDesc = escapeHtml(meta.description);
  const safeUrl = escapeHtml(meta.canonicalUrl);
  const safeImage = meta.ogImage ? escapeHtml(meta.ogImage) : "";
  const safeType = escapeHtml(meta.ogType || "website");

  // Replace existing title
  if (html.includes("<title>")) {
    html = html.replace(/<title>.*?<\/title>/i, `<title>${safeTitle}</title>`);
  } else {
    html = html.replace("</head>", `<title>${safeTitle}</title>\n</head>`);
  }

  // Replace description
  if (html.includes('name="description"')) {
    html = html.replace(
      /<meta\s+name="description"\s+content=".*?"\s*\/?>/i,
      `<meta name="description" content="${safeDesc}" />`
    );
  }

  // Replace og:title
  if (html.includes('property="og:title"')) {
    html = html.replace(
      /<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i,
      `<meta property="og:title" content="${safeTitle}" />`
    );
  }

  // Replace og:description
  if (html.includes('property="og:description"')) {
    html = html.replace(
      /<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i,
      `<meta property="og:description" content="${safeDesc}" />`
    );
  }

  // Inject additional tags before </head>
  let injectedHead = `\n    <link rel="canonical" href="${safeUrl}" />\n`;
  injectedHead += `    <meta property="og:url" content="${safeUrl}" />\n`;
  injectedHead += `    <meta property="og:type" content="${safeType}" />\n`;
  if (safeImage) {
    injectedHead += `    <meta property="og:image" content="${safeImage}" />\n`;
    injectedHead += `    <meta name="twitter:image" content="${safeImage}" />\n`;
  }
  injectedHead += `    <meta name="twitter:card" content="summary_large_image" />\n`;
  injectedHead += `    <meta name="twitter:title" content="${safeTitle}" />\n`;
  injectedHead += `    <meta name="twitter:description" content="${safeDesc}" />\n`;

  if (meta.googleSiteVerification && meta.googleSiteVerification.trim()) {
    const safeGsc = escapeHtml(meta.googleSiteVerification.trim());
    injectedHead += `    <meta name="google-site-verification" content="${safeGsc}" />\n`;
  }

  if (meta.ga4Enabled && meta.ga4MeasurementId && /^G-[A-Z0-9]+$/i.test(meta.ga4MeasurementId.trim())) {
    const safeGa4Id = escapeHtml(meta.ga4MeasurementId.trim());
    injectedHead += `    <script async src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(safeGa4Id)}"></script>\n`;
    injectedHead += `    <script id="ga4-gtag-init">window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${safeGa4Id}',{send_page_view:true});</script>\n`;
  }

  if (meta.jsonLd) {
    const jsonLdStr = escapeJsonLd(meta.jsonLd);
    if (jsonLdStr) {
      injectedHead += `    <script type="application/ld+json" id="istore-seo-jsonld">${jsonLdStr}</script>\n`;
    }
  }

  return html.replace("</head>", `${injectedHead}</head>`);
}

/**
  SSR Handler for GET /games/:slug
 */
export async function serveGameDetailHtml(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params;
    const template = getIndexHtmlTemplate();

    if (!template || !slug) {
      return next();
    }

    const dynamicCatalogService = DynamicCatalogService.getInstance();
    const merged = await dynamicCatalogService.getMergedGameDetail(slug);

    if (!merged || merged.game?.status !== "active") {
      return next();
    }

    const seoSettings = await seoService.getPublicSettings();
    const game = merged.game;

    const hostHeader = req.get("host") || "";
    const protocol = req.protocol || "https";
    const baseUrl = seoSettings.canonicalBaseUrl || (hostHeader ? `${protocol}://${hostHeader}` : "https://ist.web.id");
    const siteName = seoSettings.siteName || "iStore.id";
    const separator = seoSettings.titleSeparator || " | ";

    const rawTitle = `${game.name} - Top Up Murah & Instan`;
    const title = rawTitle.includes(siteName) ? rawTitle : `${rawTitle}${separator}${siteName}`;
    const description = `Top up ${game.name} resmi murah, aman, dan instan 24 jam. Pilihan item terlengkap dengan berbagai metode pembayaran di ${siteName}.`;
    const canonicalUrl = `${baseUrl.replace(/\/+$/, "")}/games/${slug}`;
    const ogImage = game.image || seoSettings.defaultOgImage?.url;

    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": `Top Up ${game.name}`,
        "image": game.image || undefined,
        "description": `Layanan top up resmi untuk ${game.name} dengan pengiriman instan.`,
        "brand": {
          "@type": "Brand",
          "name": (game as any).publisher || game.name
        },
        "offers": {
          "@type": "AggregateOffer",
          "priceCurrency": "IDR",
          "offerCount": (merged.products?.[0] as any)?.variants?.length || 1,
          "availability": "https://schema.org/InStock"
        }
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Beranda",
            "item": `${baseUrl.replace(/\/+$/, "")}/`
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Games",
            "item": `${baseUrl.replace(/\/+$/, "")}/games`
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": game.name,
            "item": canonicalUrl
          }
        ]
      }
    ];

    const injectedHtml = injectMetaToHtml(template, {
      title,
      description,
      canonicalUrl,
      ogImage,
      ogType: "product",
      jsonLd,
      googleSiteVerification: seoSettings.googleSiteVerification,
      ga4Enabled: seoSettings.ga4Enabled,
      ga4MeasurementId: seoSettings.ga4MeasurementId
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return res.status(200).send(injectedHtml);
  } catch (error) {
    console.warn("[HTML Injector] Game detail render fallback to SPA:", error);
    return next();
  }
}

/**
  SSR Handler for GET /blog/:slug
 */
export async function serveBlogDetailHtml(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params;
    const template = getIndexHtmlTemplate();

    if (!template || !slug) {
      return next();
    }

    const blogService = BlogService.getInstance();
    const blog = await blogService.getPublicBlogBySlug(slug);

    if (!blog) {
      return next();
    }

    const seoSettings = await seoService.getPublicSettings();
    const hostHeader = req.get("host") || "";
    const protocol = req.protocol || "https";
    const baseUrl = seoSettings.canonicalBaseUrl || (hostHeader ? `${protocol}://${hostHeader}` : "https://ist.web.id");
    const siteName = seoSettings.siteName || "iStore.id";
    const separator = seoSettings.titleSeparator || " | ";

    const articleTitle = blog.seoTitle || blog.title;
    const title = articleTitle.includes(siteName) ? articleTitle : `${articleTitle}${separator}${siteName}`;
    const description = blog.seoDescription || blog.excerpt || seoSettings.defaultDescription;
    const canonicalUrl = `${baseUrl.replace(/\/+$/, "")}/blog/${blog.slug}`;
    const ogImage = blog.coverMediaUrl || seoSettings.defaultOgImage?.url;

    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": blog.title,
        "description": blog.excerpt || blog.seoDescription,
        "image": blog.coverMediaUrl ? [blog.coverMediaUrl] : undefined,
        "datePublished": blog.publishedAt || blog.createdAt,
        "dateModified": blog.updatedAt || blog.publishedAt,
        "author": {
          "@type": "Person",
          "name": blog.author || `Tim Redaksi ${siteName}`
        },
        "publisher": {
          "@type": "Organization",
          "name": siteName,
          "url": baseUrl
        }
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Beranda",
            "item": `${baseUrl.replace(/\/+$/, "")}/`
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Blog",
            "item": `${baseUrl.replace(/\/+$/, "")}/blog`
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": blog.title,
            "item": canonicalUrl
          }
        ]
      }
    ];

    const injectedHtml = injectMetaToHtml(template, {
      title,
      description,
      canonicalUrl,
      ogImage,
      ogType: "article",
      jsonLd,
      googleSiteVerification: seoSettings.googleSiteVerification,
      ga4Enabled: seoSettings.ga4Enabled,
      ga4MeasurementId: seoSettings.ga4MeasurementId
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return res.status(200).send(injectedHtml);
  } catch (error) {
    console.warn("[HTML Injector] Blog detail render fallback to SPA:", error);
    return next();
  }
}

/**
  SSR Handler for GET / (Homepage)
 */
export async function serveHomepageHtml(req: Request, res: Response, next: NextFunction) {
  try {
    const template = getIndexHtmlTemplate();

    if (!template) {
      return next();
    }

    const seoSettings = await seoService.getPublicSettings();
    const hostHeader = req.get("host") || "";
    const protocol = req.protocol || "https";
    const baseUrl = seoSettings.canonicalBaseUrl || (hostHeader ? `${protocol}://${hostHeader}` : "https://ist.web.id");
    const siteName = seoSettings.siteName || "iStore.id";
    const title = seoSettings.defaultTitle || "Solusi Top Up Game & Voucher Digital Terpercaya";
    const description = seoSettings.defaultDescription || "Platform top up game dan voucher digital terpercaya di Indonesia.";
    const canonicalUrl = `${baseUrl.replace(/\/+$/, "")}/`;
    const ogImage = seoSettings.defaultOgImage?.url;

    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": siteName,
        "url": canonicalUrl,
        "description": description
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": siteName,
        "url": canonicalUrl,
        "logo": ogImage
      }
    ];

    const injectedHtml = injectMetaToHtml(template, {
      title,
      description,
      canonicalUrl,
      ogImage,
      ogType: "website",
      jsonLd,
      googleSiteVerification: seoSettings.googleSiteVerification,
      ga4Enabled: seoSettings.ga4Enabled,
      ga4MeasurementId: seoSettings.ga4MeasurementId
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return res.status(200).send(injectedHtml);
  } catch (error) {
    console.warn("[HTML Injector] Homepage render fallback to SPA:", error);
    return next();
  }
}
