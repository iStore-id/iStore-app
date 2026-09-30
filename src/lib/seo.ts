import { useEffect, useState } from "react";
import { PageMetadataInput, PublicSEOSettings } from "../types/seo";
import { initGA4, trackPageView } from "./gtag";

export const FALLBACK_SEO_SETTINGS: PublicSEOSettings = {
  siteName: "iStore.id",
  titleSeparator: " | ",
  defaultTitle: "Solusi Top Up Game & Voucher Digital Terpercaya",
  defaultDescription: "Platform top up game dan voucher digital terpercaya di Indonesia. Proses kilat instan 24 jam, harga termurah, dan metode pembayaran terlengkap.",
  defaultKeywords: [
    "top up game",
    "voucher game",
    "top up mlbb",
    "voucher ff",
    "istore indonesia"
  ],
  canonicalBaseUrl: "https://ist.web.id",
  defaultOgImage: {
    url: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop",
    altText: "iStore.id - Top Up Game & Voucher Digital Terpercaya",
    width: 1200,
    height: 630
  },
  socialMetadata: {
    twitterHandle: "@istore_id",
    twitterCreator: "@istore_id",
    twitterCardType: "summary_large_image",
    facebookAppId: ""
  }
};

let cachedPublicSettings: PublicSEOSettings | null = null;
let settingsPromise: Promise<PublicSEOSettings> | null = null;

export async function fetchPublicSEOSettings(): Promise<PublicSEOSettings> {
  if (cachedPublicSettings) return cachedPublicSettings;
  if (settingsPromise) return settingsPromise;

  settingsPromise = fetch("/api/public/seo")
    .then(res => res.json())
    .then(json => {
      if (json.success && json.data) {
        cachedPublicSettings = json.data;
        return json.data as PublicSEOSettings;
      }
      return FALLBACK_SEO_SETTINGS;
    })
    .catch(err => {
      console.warn("[SEO] Failed to fetch public SEO config, using fallbacks:", err);
      return FALLBACK_SEO_SETTINGS;
    })
    .finally(() => {
      settingsPromise = null;
    });

  return settingsPromise;
}

/**
 * Normalizes and formats canonical URL
 */
export function buildCanonicalUrl(baseUrl: string, path: string = "/"): string {
  const cleanBase = (baseUrl || "").trim().replace(/\/+$/, "");
  if (!cleanBase) {
    if (typeof window !== "undefined" && window.location.origin) {
      const origin = window.location.origin;
      let cleanPath = path.trim().toLowerCase();
      if (!cleanPath.startsWith("/")) cleanPath = `/${cleanPath}`;
      cleanPath = cleanPath.split("?")[0].split("#")[0];
      if (cleanPath.length > 1 && cleanPath.endsWith("/")) {
        cleanPath = cleanPath.slice(0, -1);
      }
      return `${origin}${cleanPath}`;
    }
    return "";
  }
  let cleanPath = path.trim().toLowerCase();
  if (!cleanPath.startsWith("/")) cleanPath = `/${cleanPath}`;
  
  // Remove query params and hashes for canonical URLs
  cleanPath = cleanPath.split("?")[0].split("#")[0];

  // Remove trailing slash unless it's root
  if (cleanPath.length > 1 && cleanPath.endsWith("/")) {
    cleanPath = cleanPath.slice(0, -1);
  }

  return `${cleanBase}${cleanPath}`;
}

/**
 * Sanitizes plain text for meta tags (strips html, converts quotes, normalizes spaces)
 */
export function sanitizeMetaText(text?: string): string {
  if (!text) return "";
  return text
    .replace(/<[^>]*>/g, "") // strip html tags
    .replace(/[\r\n\t]+/g, " ") // normalize whitespace
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Helper to update or inject meta tag
 */
function updateMetaTag(attributeName: "name" | "property", attributeValue: string, content: string | null) {
  if (typeof document === "undefined") return;

  const selector = `meta[${attributeName}="${attributeValue}"]`;
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;

  if (content === null || content === undefined || content === "") {
    if (element) element.remove();
    return;
  }

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attributeName, attributeValue);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

/**
 * Helper to update or inject canonical link
 */
function updateCanonicalLink(url: string | null) {
  if (typeof document === "undefined") return;

  let element = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!url) {
    if (element) element.remove();
    return;
  }

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  element.setAttribute("href", url);
}

/**
 * Helper to update or inject JSON-LD structured data script
 */
function updateJsonLdScript(data: Record<string, any> | Array<Record<string, any>> | null | undefined) {
  if (typeof document === "undefined") return;

  const SCRIPT_ID = "istore-seo-jsonld";
  let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

  if (!data) {
    if (script) script.remove();
    return;
  }

  if (!script) {
    script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }

  try {
    script.textContent = JSON.stringify(data);
  } catch (err) {
    console.error("[SEO] Failed to serialize JSON-LD:", err);
    if (script) script.remove();
  }
}

/**
 * Hook to retrieve active public SEO settings
 */
export function useSEOSettings(): PublicSEOSettings {
  const [globalSettings, setGlobalSettings] = useState<PublicSEOSettings>(
    cachedPublicSettings || FALLBACK_SEO_SETTINGS
  );

  useEffect(() => {
    let isMounted = true;
    if (!cachedPublicSettings) {
      fetchPublicSEOSettings().then(settings => {
        if (isMounted) setGlobalSettings(settings);
      });
    }
    return () => {
      isMounted = false;
    };
  }, []);

  return globalSettings;
}

/**
 * Custom hook to deterministically resolve and apply page SEO metadata
 */
export function useSEO(metadata: PageMetadataInput) {
  const [globalSettings, setGlobalSettings] = useState<PublicSEOSettings>(
    cachedPublicSettings || FALLBACK_SEO_SETTINGS
  );

  useEffect(() => {
    let isMounted = true;
    if (!cachedPublicSettings) {
      fetchPublicSEOSettings().then(settings => {
        if (isMounted) setGlobalSettings(settings);
      });
    }
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const siteName = globalSettings.siteName || "";
    const separator = globalSettings.titleSeparator || " | ";

    // 1. Resolve Title
    let resolvedTitle = globalSettings.defaultTitle;
    if (metadata.title && metadata.title.trim()) {
      const cleanTitle = sanitizeMetaText(metadata.title);
      if (cleanTitle.includes(siteName)) {
        resolvedTitle = cleanTitle;
      } else {
        resolvedTitle = `${cleanTitle}${separator}${siteName}`;
      }
    }
    document.title = resolvedTitle;

    // 2. Resolve Description
    const resolvedDescription = sanitizeMetaText(
      metadata.description || globalSettings.defaultDescription
    );

    // 3. Resolve Canonical URL
    const canonicalUrl = buildCanonicalUrl(
      globalSettings.canonicalBaseUrl,
      metadata.canonicalPath || (typeof window !== "undefined" ? window.location.pathname : "/")
    );

    // 4. Resolve Image
    const resolvedImage = metadata.ogImage || globalSettings.defaultOgImage.url;

    // 5. Update Standard Meta Tags
    updateMetaTag("name", "description", resolvedDescription);
    if (metadata.keywords && metadata.keywords.length > 0) {
      updateMetaTag("name", "keywords", metadata.keywords.map(sanitizeMetaText).join(", "));
    } else if (globalSettings.defaultKeywords && globalSettings.defaultKeywords.length > 0) {
      updateMetaTag("name", "keywords", globalSettings.defaultKeywords.join(", "));
    }

    // Robots meta (indexing control)
    if (metadata.noindex) {
      updateMetaTag("name", "robots", "noindex, nofollow");
    } else {
      updateMetaTag("name", "robots", "index, follow");
    }

    // 6. Open Graph Meta Tags
    updateMetaTag("property", "og:site_name", siteName);
    updateMetaTag("property", "og:type", metadata.ogType || "website");
    updateMetaTag("property", "og:title", resolvedTitle);
    updateMetaTag("property", "og:description", resolvedDescription);
    updateMetaTag("property", "og:url", canonicalUrl);
    updateMetaTag("property", "og:image", resolvedImage);

    // 7. Twitter Meta Tags
    const twitterType = globalSettings.socialMetadata.twitterCardType || "summary_large_image";
    updateMetaTag("name", "twitter:card", twitterType);
    updateMetaTag("name", "twitter:title", resolvedTitle);
    updateMetaTag("name", "twitter:description", resolvedDescription);
    updateMetaTag("name", "twitter:image", resolvedImage);
    if (globalSettings.socialMetadata.twitterHandle) {
      updateMetaTag("name", "twitter:site", globalSettings.socialMetadata.twitterHandle);
    }
    if (globalSettings.socialMetadata.twitterCreator) {
      updateMetaTag("name", "twitter:creator", globalSettings.socialMetadata.twitterCreator);
    }

    // 8. Canonical Link
    updateCanonicalLink(canonicalUrl);

    // 9. Google Search Console Verification Meta Tag
    if (globalSettings.googleSiteVerification && globalSettings.googleSiteVerification.trim()) {
      updateMetaTag("name", "google-site-verification", globalSettings.googleSiteVerification.trim());
    } else {
      updateMetaTag("name", "google-site-verification", null);
    }

    // 10. GA4 Analytics Tracking
    if (globalSettings.ga4Enabled && globalSettings.ga4MeasurementId) {
      initGA4(globalSettings.ga4MeasurementId, globalSettings.ga4Enabled);
      const path = metadata.canonicalPath || (typeof window !== "undefined" ? window.location.pathname : "/");
      trackPageView(path, resolvedTitle);
    }

    // 11. Structured Data (JSON-LD)
    updateJsonLdScript(metadata.jsonLd);

    // Cleanup on unmount (revert to global defaults if needed)
    return () => {
      // Intentionally keep current head state until next page mounts to avoid flash
    };
  }, [
    metadata.title,
    metadata.description,
    metadata.canonicalPath,
    metadata.ogImage,
    metadata.ogType,
    metadata.noindex,
    JSON.stringify(metadata.jsonLd),
    globalSettings
  ]);
}
