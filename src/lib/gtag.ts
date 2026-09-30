declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
  }
}

let isGaInitialized = false;
let currentGa4Id = "";
let lastTrackedPath = "";

/**
 * Dynamically initializes GA4 script tag if enabled and Measurement ID is valid.
 */
export function initGA4(measurementId?: string, enabled: boolean = true) {
  if (typeof window === "undefined") return;

  const cleanId = (measurementId || "").trim().toUpperCase();
  if (!enabled || !cleanId || !/^G-[A-Z0-9]+$/i.test(cleanId)) {
    return;
  }

  if (isGaInitialized && currentGa4Id === cleanId) {
    return;
  }

  currentGa4Id = cleanId;
  lastTrackedPath = ""; // Reset path deduplication on GA4 re-initialization
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
  }

  const existingScript = document.getElementById("ga4-gtag-script");
  if (!existingScript) {
    const script = document.createElement("script");
    script.id = "ga4-gtag-script";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cleanId)}`;
    document.head.appendChild(script);

    window.gtag("js", new Date());
    window.gtag("config", cleanId, { send_page_view: false });
  }

  isGaInitialized = true;
}

/**
 * Normalizes path for page_view tracking matching canonical route normalization
 */
export function normalizeTrackPath(rawPath: string): string {
  if (!rawPath) return "/";
  let clean = rawPath.trim().toLowerCase();
  clean = clean.split("?")[0].split("#")[0];
  if (!clean.startsWith("/")) clean = `/${clean}`;
  if (clean.length > 1 && clean.endsWith("/")) {
    clean = clean.slice(0, -1);
  }
  return clean;
}

/**
 * Tracks SPA Page View in GA4 with route-aware deduplication
 */
export function trackPageView(pagePath: string, pageTitle?: string) {
  if (typeof window === "undefined" || !window.gtag || !currentGa4Id) return;

  const normalized = normalizeTrackPath(pagePath);

  // Suppress duplicate page_view events on the same route
  if (normalized === lastTrackedPath) {
    return;
  }

  try {
    window.gtag("event", "page_view", {
      page_path: normalized,
      page_title: pageTitle || document.title,
      send_to: currentGa4Id
    });
    lastTrackedPath = normalized;
  } catch (err) {
    console.warn("[GA4] Failed to track page view:", err);
  }
}

/**
 * Track e-commerce view_item
 */
export function trackViewItem(item: { id: string; name: string; category?: string; price?: number }) {
  if (typeof window === "undefined" || !window.gtag || !currentGa4Id) return;

  try {
    window.gtag("event", "view_item", {
      currency: "IDR",
      value: item.price || 0,
      items: [
        {
          item_id: item.id,
          item_name: item.name,
          item_category: item.category || "Game Voucher",
          price: item.price || 0
        }
      ]
    });
  } catch (err) {
    console.warn("[GA4] Failed to track view_item:", err);
  }
}

/**
 * Track e-commerce begin_checkout
 */
export function trackBeginCheckout(items: Array<{ id: string; name: string; price?: number; quantity?: number }>, value?: number) {
  if (typeof window === "undefined" || !window.gtag || !currentGa4Id) return;

  try {
    const formattedItems = items.map(item => ({
      item_id: item.id,
      item_name: item.name,
      price: item.price || 0,
      quantity: item.quantity || 1
    }));

    const totalValue = value || formattedItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);

    window.gtag("event", "begin_checkout", {
      currency: "IDR",
      value: totalValue,
      items: formattedItems
    });
  } catch (err) {
    console.warn("[GA4] Failed to track begin_checkout:", err);
  }
}

const trackedPurchases = new Set<string>();

/**
 * Track e-commerce purchase (deduplicated per transaction ID)
 */
export function trackPurchase(transactionId: string, value: number, items: Array<{ id: string; name: string; price?: number; quantity?: number }>) {
  if (typeof window === "undefined" || !window.gtag || !currentGa4Id) return;
  if (!transactionId) return;

  if (trackedPurchases.has(transactionId)) {
    return;
  }

  try {
    const sessionKey = `ga4_p_${transactionId}`;
    if (sessionStorage.getItem(sessionKey)) {
      trackedPurchases.add(transactionId);
      return;
    }

    const formattedItems = items.map(item => ({
      item_id: item.id,
      item_name: item.name,
      price: item.price || 0,
      quantity: item.quantity || 1
    }));

    window.gtag("event", "purchase", {
      transaction_id: transactionId,
      currency: "IDR",
      value: value,
      items: formattedItems
    });

    trackedPurchases.add(transactionId);
    sessionStorage.setItem(sessionKey, "1");
  } catch (err) {
    console.warn("[GA4] Failed to track purchase:", err);
  }
}
