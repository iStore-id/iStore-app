import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatRupiah, loadMidtransSnap } from "../lib/utils";
import { useAuthStore } from "../store/auth-store";
import { ShieldCheck, Zap, AlertCircle, AlertTriangle, ChevronRight, Clock } from "lucide-react";
import { Game, Product, ProductVariant } from "../types/core";
import { useSEO, useSEOSettings, buildCanonicalUrl } from "../lib/seo";
import { trackViewItem, trackBeginCheckout } from "../lib/gtag";
import { defaultProducts } from "../lib/seed-data";
import { ProductReviewsSection } from "../components/game/ProductReviewsSection";

declare global {
  interface Window {
    doit?: {
      open: (
        hostedUrl: string,
        options?: {
          onPaid?: () => void;
          onExpired?: () => void;
          onClose?: () => void;
          closeDelay?: number;
          [key: string]: any;
        }
      ) => void;
      [key: string]: any;
    };
  }
}

async function loadDoitEmbed(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.doit) return true;

  const scriptId = "doit-embed-script";
  const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (existingScript) {
    if (window.doit) return true;
    return new Promise((resolve) => {
      existingScript.addEventListener("load", () => resolve(!!window.doit), { once: true });
      existingScript.addEventListener("error", () => resolve(false), { once: true });
      setTimeout(() => resolve(!!window.doit), 3000);
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://doit.id/embed.js";
    script.async = true;
    script.onload = () => resolve(!!window.doit);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
    setTimeout(() => resolve(!!window.doit), 5000);
  });
}

function hexToRgba(hex: string, opacity: number) {
  let c = (hex || "#ffffff").replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(char => char + char).join('');
  }
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
}

function isHexDark(hex?: string): boolean {
  if (!hex || typeof hex !== 'string') return false;
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(char => char + char).join('');
  }
  if (c.length !== 6) return false;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

export interface AccountInputField {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}

export function getAccountInputFields(game: Game | null, selectedProduct: Product | null): AccountInputField[] {
  if (selectedProduct?.metadata) {
    if (selectedProduct.metadata.inputSchema?.fields && Array.isArray(selectedProduct.metadata.inputSchema.fields)) {
      return selectedProduct.metadata.inputSchema.fields;
    }
    if (selectedProduct.metadata.fields && Array.isArray(selectedProduct.metadata.fields)) {
      return selectedProduct.metadata.fields;
    }
    if (Array.isArray(selectedProduct.metadata.targetFields) && selectedProduct.metadata.targetFields.length > 0) {
      return selectedProduct.metadata.targetFields.map((tf: string) => ({
        name: tf,
        label: tf === "userId" ? "User ID" : tf === "zoneId" ? "Zone ID / Server" : tf,
        required: true,
        type: "text"
      }));
    }
  }

  if (game?.metadata) {
    if (game.metadata.inputSchema?.fields && Array.isArray(game.metadata.inputSchema.fields)) {
      return game.metadata.inputSchema.fields;
    }
    if (game.metadata.fields && Array.isArray(game.metadata.fields)) {
      return game.metadata.fields;
    }
    if (Array.isArray(game.metadata.targetFields) && game.metadata.targetFields.length > 0) {
      return game.metadata.targetFields.map((tf: string) => ({
        name: tf,
        label: tf === "userId" ? "User ID" : tf === "zoneId" ? "Zone ID / Server" : tf,
        required: true,
        type: "text"
      }));
    }
  }

  const targetSlug = game?.slug || selectedProduct?.slug;
  if (targetSlug) {
    const seedGame = defaultProducts.find((p) => p.slug === targetSlug || p.id === targetSlug);
    if (seedGame?.inputSchema?.fields && Array.isArray(seedGame.inputSchema.fields)) {
      return seedGame.inputSchema.fields;
    }
  }

  return [{ name: "userId", label: "User ID", required: true, type: "text" }];
}

function normalizeCheckoutErrorMessage(value: unknown, fallback: string): string {
  const visit = (candidate: unknown, depth: number): string => {
    if (depth > 4 || candidate == null) return "";
    if (typeof candidate === "string") return candidate.trim();
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const message = visit(item, depth + 1);
        if (message) return message;
      }
      return "";
    }
    if (typeof candidate === "object") {
      const record = candidate as Record<string, unknown>;
      for (const key of ["message", "error", "detail", "description", "title"]) {
        const message = visit(record[key], depth + 1);
        if (message) return message;
      }
    }
    return "";
  };
  const message = visit(value, 0);
  if (message && message !== "[object Object]" && !message.startsWith("{") && !message.startsWith("[")) return message;
  return fallback;
}


function getTripayChannelGroup(channel: { code: string; name: string; group?: string }): string {
  const code = channel.code.toUpperCase().replace(/[\s_-]+/g, "");
  const name = channel.name.toUpperCase();
  if (code.includes("QRIS") || name.includes("QRIS")) return "QRIS";
  const apiGroup = String(channel.group || "").trim();
  if (apiGroup) return apiGroup;
  if (/(SHOPEEPAY|GOPAY|DANA|OVO|LINKAJA|ASTRAPAY|JENIUSPAY|EWALLET|E-WALLET|WALLET)/.test(code + " " + name)) return "E-Wallet";
  if (/(VIRTUALACCOUNT|\bVA\b)/.test(name) || /VA$/.test(code) || code.includes("VIRTUALACCOUNT")) return "Virtual Account";
  if (/(TRANSFERBANK|BANKTRANSFER|IBANK|INTERNETBANKING|BIFAST)/.test(code + " " + name)) return "Transfer Bank";
  return "Lainnya";
}

function getTripayChannelLogo(code: string): string {
  const normalizedCode = String(code || "").trim().toUpperCase().replace(/[\\s_-]+/g, "");
  const logos: Record<string, string> = {
    QRIS: "/payment-logos/qris.svg",
    SHOPEEPAY: "/payment-logos/shopee-pay.svg",
    GOPAY: "/payment-logos/gopay.svg",
    DANA: "/payment-logos/dana.svg",
    OVO: "/payment-logos/ovo.svg",
    LINKAJA: "/payment-logos/linkaja.svg",
    BCAVA: "/payment-logos/bca.svg",
    BNIVA: "/payment-logos/bni.svg",
    BRIVA: "/payment-logos/bri.svg",
    BSIVA: "/payment-logos/bsi.svg",
    CIMBVA: "/payment-logos/cimb-niaga.svg",
    DANAMONVA: "/payment-logos/danamon.svg",
    MANDIRIVA: "/payment-logos/mandiri.svg",
    PERMATAVA: "/payment-logos/permata.svg",
    SEABANKVA: "/payment-logos/seabank.svg",
    BANKSAQUVA: "/payment-logos/bank-saqu.svg"
  };
  return logos[normalizedCode] || "/payment-logos/payment-generic.svg";
}

export default function GameDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [game, setGame] = useState<Game | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  const seoSettings = useSEOSettings();
  const canonicalBase = seoSettings.canonicalBaseUrl || (typeof window !== "undefined" ? window.location.origin : "https://ist.web.id");

  useSEO({
    title: game ? `${game.name} - Top Up Murah & Instan` : undefined,
    description: game
      ? `Top up ${game.name} resmi murah, aman, dan instan 24 jam. Pilihan item terlengkap dengan berbagai metode pembayaran di Toko Kami.`
      : undefined,
    keywords: game ? [game.name.toLowerCase(), `top up ${game.name.toLowerCase()}`, `voucher ${game.name.toLowerCase()}`, "istore id"] : undefined,
    canonicalPath: slug ? `/games/${slug}` : undefined,
    ogImage: game?.image || undefined,
    ogType: "product",
    jsonLd: game ? [
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
          "offerCount": variants.length || 1,
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
            "item": buildCanonicalUrl(canonicalBase, "/")
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Games",
            "item": buildCanonicalUrl(canonicalBase, "/games")
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": game.name,
            "item": buildCanonicalUrl(canonicalBase, `/games/${slug}`)
          }
        ]
      }
    ] : undefined
  });
  
  const [loading, setLoading] = useState(true);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantsError, setVariantsError] = useState<string | null>(null);
  const activeProductRequestIdRef = useRef<string | null>(null);
  const [error, setError] = useState("");
  const [errorState, setErrorState] = useState<string | null>(null);
  const [hasCustomBg, setHasCustomBg] = useState(false);
  const [cardColor, setCardColor] = useState("#ffffff");
  const [cardOpacity, setCardOpacity] = useState(85);
  const [cardBlur, setCardBlur] = useState<"none" | "sm" | "md" | "lg">("md");

  const [productBannerConfig, setProductBannerConfig] = useState({
    enabled: true,
    imageUrl: "",
    height: "medium" as "compact" | "medium" | "large",
    showName: true,
    showAutomaticBadge: true,
    showSafetyBadge: true
  });

  useEffect(() => {
    let active = true;
    const loadProductBannerConfig = async () => {
      try {
        const res = await fetch("/api/public/store-config", { cache: "no-store" });
        const data = await res.json();
        if (!active || !data.success || !data.data) return;
        setProductBannerConfig({
          enabled: data.data.productBannerEnabled ?? true,
          imageUrl: typeof data.data.productBannerImageUrl === "string" ? data.data.productBannerImageUrl : "",
          height: ["compact", "medium", "large"].includes(data.data.productBannerHeight) ? data.data.productBannerHeight : "medium",
          showName: data.data.productBannerShowName ?? true,
          showAutomaticBadge: data.data.productBannerShowAutomaticBadge ?? true,
          showSafetyBadge: data.data.productBannerShowSafetyBadge ?? true
        });
      } catch (error) {
        console.warn("[GameDetail] Gagal memuat pengaturan banner produk:", error);
      }
    };
    void loadProductBannerConfig();
    const handleConfigUpdated = () => { void loadProductBannerConfig(); };
    window.addEventListener("store-config-updated", handleConfigUpdated);
    return () => {
      active = false;
      window.removeEventListener("store-config-updated", handleConfigUpdated);
    };
  }, []);

  // Track active theme from .public-storefront[data-theme]
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof document !== "undefined") {
      const storefront = document.querySelector(".public-storefront");
      if (storefront) {
        return storefront.getAttribute("data-theme") === "dark";
      }
    }
    return false;
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const storefront = document.querySelector(".public-storefront");
    if (!storefront) return;

    const checkTheme = () => {
      setIsDarkMode(storefront.getAttribute("data-theme") === "dark");
    };

    checkTheme();

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "data-theme") {
          checkTheme();
        }
      }
    });

    observer.observe(storefront, { attributes: true, attributeFilter: ["data-theme"] });
    window.addEventListener("store-config-updated", checkTheme);

    return () => {
      observer.disconnect();
      window.removeEventListener("store-config-updated", checkTheme);
    };
  }, []);

  const effectiveCardColor = isDarkMode
    ? (isHexDark(cardColor) ? cardColor : "#0f172a")
    : cardColor;
  
  const [customerInput, setCustomerInput] = useState<Record<string, string>>({});
  const [buyerName, setBuyerName] = useState("");
  const [buyerWhatsapp, setBuyerWhatsapp] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [activeGateway, setActiveGateway] = useState<"doit" | "midtrans" | "omqris" | "tripay" | null>(null);
  const [tripayAvailableChannels, setTripayAvailableChannels] = useState<Array<{ code: string; name: string; group?: string; type?: string; iconUrl?: string }>>([]);
  const [tripayChannelsError, setTripayChannelsError] = useState("");
  const [tripayChannelsLoading, setTripayChannelsLoading] = useState(false);
  const [expandedPaymentGroups, setExpandedPaymentGroups] = useState<Record<string, boolean>>({});
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    fetch("/api/public/payment-gateway")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.gatewayCode) {
          setActiveGateway(data.gatewayCode);
        } else {
          setActiveGateway(null);
        }
      })
      .catch(() => {
        setActiveGateway(null);
      });
  }, []);

  useEffect(() => {
    if (activeGateway !== "tripay") {
      setTripayAvailableChannels([]);
      setTripayChannelsLoading(false);
      return;
    }
    let cancelled = false;
    setTripayAvailableChannels([]);
    setTripayChannelsLoading(true);
    setTripayChannelsError("");
    fetch("/api/public/tripay/channels", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success || !Array.isArray(data.channels)) throw new Error(data.message || "Metode pembayaran TriPay tidak dapat dimuat.");
        return data;
      })
      .then((data) => {
        if (!cancelled) {
          const channels = data.channels.filter((channel: any) => channel && typeof channel.code === "string" && channel.code.trim())
            .map((channel: any) => ({
              code: String(channel.code).trim().toUpperCase(),
              name: String(channel.name || channel.code).trim(),
              group: String(channel.group || "").trim(),
              type: String(channel.type || "").trim(),
              iconUrl: typeof channel.iconUrl === "string" && channel.iconUrl.trim().toLowerCase().startsWith("https://") ? channel.iconUrl.trim() : ""
            }));
          setTripayAvailableChannels(channels);
          setTripayChannelsLoading(false);
          setSelectedPaymentMethod((current) => channels.some((channel: { code: string }) => channel.code === current) ? current : "");
          if (!channels.length) setTripayChannelsError("Tidak ada kanal pembayaran TriPay yang tersedia saat ini.");
        }
      })
      .catch((error) => { if (!cancelled) { setTripayAvailableChannels([]); setTripayChannelsLoading(false); setSelectedPaymentMethod(""); setTripayChannelsError(error?.message || "Metode pembayaran TriPay tidak dapat dimuat."); } });
    return () => { cancelled = true; };
  }, [activeGateway]);

  useEffect(() => {
    if (user?.email && !buyerEmail) {
      setBuyerEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    fetch("/api/public/store-config")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          const isColor = data.data.homepageBackgroundMode === "color" && Boolean(data.data.homepageBackgroundColor);
          const isImage = data.data.homepageBackgroundMode === "image" && Boolean(data.data.homepageBackgroundImage);
          setHasCustomBg(isColor || isImage);
          if (data.data.transactionCardColor) {
            setCardColor(data.data.transactionCardColor);
          }
          if (typeof data.data.transactionCardOpacity === "number") {
            setCardOpacity(Math.max(50, Math.min(100, data.data.transactionCardOpacity)));
          }
          if (data.data.transactionCardBlur) {
            setCardBlur(data.data.transactionCardBlur);
          }
        }
      })
      .catch(() => {});
  }, []);
  const [promoCode, setPromoCode] = useState("");
  const [pointsToUse, setPointsToUse] = useState(0);
  const [loyaltyData, setLoyaltyData] = useState<{ balance: number, config: { redeemRateIdr: number, minRedeemPoints: number, maxRedeemPercent: number } } | null>(null);

  // Checkout preview only: the server remains authoritative and revalidates promo,
  // flash-sale, balance, redemption limits, admin fee, and the final payable amount.
  const selectedSellingPrice = Math.max(0, Number((selectedVariant as any)?.sellingPrice) || 0);
  const selectedAdminFee = Math.max(0, Math.round(Number((selectedVariant as any)?.adminFee) || 0));
  const requestedLoyaltyPoints = Math.max(0, Math.floor(Number(pointsToUse) || 0));
  const loyaltyRedeemRate = Number(loyaltyData?.config.redeemRateIdr) || 0;
  const loyaltyMaxPercent = Math.max(0, Math.min(100, Number(loyaltyData?.config.maxRedeemPercent) || 0));
  const loyaltyMaxDiscount = Math.floor((selectedSellingPrice * loyaltyMaxPercent) / 100);
  const minimumLoyaltyPoints = Math.max(0, Math.floor(Number(loyaltyData?.config.minRedeemPoints) || 0));
  const estimatedLoyaltyPointsCandidate = loyaltyData && loyaltyRedeemRate > 0 &&
    requestedLoyaltyPoints >= minimumLoyaltyPoints &&
    requestedLoyaltyPoints <= loyaltyData.balance
      ? Math.min(requestedLoyaltyPoints, Math.floor(loyaltyMaxDiscount / loyaltyRedeemRate))
      : 0;
  const estimatedLoyaltyPoints = estimatedLoyaltyPointsCandidate >= minimumLoyaltyPoints
    ? estimatedLoyaltyPointsCandidate
    : 0;
  const estimatedLoyaltyDiscount = estimatedLoyaltyPoints * loyaltyRedeemRate;
  const estimatedCheckoutTotal = Math.max(0, selectedSellingPrice - estimatedLoyaltyDiscount) + selectedAdminFee;

  useEffect(() => {
    if (user) {
      const fetchLoyalty = async () => {
        try {
          const token = await (user as any).getIdToken();
          const response = await fetch("/api/customer/loyalty/info", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setLoyaltyData(data.data);
            }
          }
        } catch (err) {
          console.error("Failed to fetch loyalty info:", err);
        }
      };
      fetchLoyalty();
    }
  }, [user]);
  const [processing, setProcessing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkingInquiry, setCheckingInquiry] = useState(false);
  const [inquiryResult, setInquiryResult] = useState<{ isValid: boolean; username: string | null; message?: string } | null>(null);

  const [snapToken, setSnapToken] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const hasEmbeddedRef = useRef(false);
  const snapContainerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const embedTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (embedTimerRef.current) {
        clearTimeout(embedTimerRef.current);
      }
      if (snapContainerRef.current) {
        snapContainerRef.current.innerHTML = "";
      }
      hasEmbeddedRef.current = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (embedTimerRef.current) {
        clearTimeout(embedTimerRef.current);
      }
      if (snapContainerRef.current) {
        snapContainerRef.current.innerHTML = "";
      }
      if (checkoutStep !== 3) {
        hasEmbeddedRef.current = false;
      }
    };
  }, [checkoutStep]);

  useEffect(() => {
    const initSnap = async () => {
      if (checkoutStep === 3 && snapToken && snapContainerRef.current && !hasEmbeddedRef.current) {
        let snapReady = !!window.snap;
        if (!snapReady) {
          snapReady = await loadMidtransSnap();
        }

        if (!isMountedRef.current) return;

        if (snapReady && window.snap) {
          try {
            hasEmbeddedRef.current = true;
            window.snap.embed(snapToken, {
              embedId: "snap-container",
              onSuccess: () => navigate(`/transactions/${orderId}`),
              onPending: () => navigate(`/transactions/${orderId}`),
              onError: () => {
                setCheckoutError("Pembayaran gagal. Silakan coba lagi.");
                hasEmbeddedRef.current = false;
              },
              onClose: () => {
                hasEmbeddedRef.current = false;
              }
            });
          } catch (err) {
            console.error("Snap embed error:", err);
            setCheckoutError("Gagal memuat form pembayaran.");
            hasEmbeddedRef.current = false;
          }
        } else {
          setCheckoutError("SDK Pembayaran gagal dimuat. Silakan muat ulang halaman.");
        }
      }
    };

    initSnap();
  }, [checkoutStep, snapToken, orderId]);

  useEffect(() => {
    loadMidtransSnap();
    loadDoitEmbed();
  }, []);

  useEffect(() => {
    const userIdVal = customerInput["userId"]?.trim();
    if (!userIdVal || userIdVal.length < 3) {
      setInquiryResult(null);
      return;
    }
    const timer = setTimeout(() => {
      const targetSlug = (slug || game?.slug || "").toLowerCase();
      let gameCode = "";
      if (targetSlug.includes("free-fire") || targetSlug.includes("freefire") || game?.name?.toLowerCase().includes("free fire")) {
        gameCode = "freefire";
      } else if (targetSlug.includes("mobile-legend") || targetSlug.includes("mlbb") || game?.name?.toLowerCase().includes("mobile legend")) {
        gameCode = "mobilelegend";
      } else if (targetSlug.includes("zenless") || targetSlug === "zzz") {
        gameCode = "zzz";
      } else if (targetSlug.includes("valorant")) {
        gameCode = "valo";
      } else if (targetSlug.includes("arena-of-valor") || targetSlug.includes("aov")) {
        gameCode = "aov";
      } else if (targetSlug.includes("point-blank") || targetSlug === "pb") {
        gameCode = "pb";
      } else if (targetSlug.includes("sausage-man")) {
        gameCode = "sm";
      } else if (targetSlug.includes("super-sus")) {
        gameCode = "sus";
      } else if (targetSlug.includes("punishing-gray-raven") || targetSlug === "pgr") {
        gameCode = "pgr";
      } else if (targetSlug.includes("magic-chess") || targetSlug === "mcgg") {
        gameCode = "mcgg";
      } else {
        return;
      }

      setCheckingInquiry(true);
      fetch("/api/customer/games/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameCode, userId: userIdVal, zoneId: customerInput["zoneId"] })
      })
        .then((res) => res.json())
        .then((data) => setInquiryResult(data))
        .catch(() => setInquiryResult(null))
        .finally(() => setCheckingInquiry(false));
    }, 600);

    return () => clearTimeout(timer);
  }, [customerInput["userId"], customerInput["zoneId"], slug, game]);

  useEffect(() => {
    if (game) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [slug, game]);

  const fetchVariantsForProduct = async (productId: string) => {
    if (!productId) return;
    activeProductRequestIdRef.current = productId;
    setVariantsLoading(true);
    setVariantsError(null);
    try {
      const vResp = await fetch(`/api/public/catalog/products/${productId}/variants`);
      const vData = await vResp.json();
      
      // Guard against race condition if user rapidly switched products
      if (activeProductRequestIdRef.current === productId) {
        if (vData.success && Array.isArray(vData.data)) {
          setVariants(vData.data);
          setVariantsError(null);
        } else {
          setVariants([]);
          setVariantsError(vData.message || "Gagal memuat nominal.");
        }
      }
    } catch (err) {
      if (activeProductRequestIdRef.current === productId) {
        console.error("Error fetching variants:", err);
        setVariants([]);
        setVariantsError("Gagal memuat nominal. Silakan coba lagi.");
      }
    } finally {
      if (activeProductRequestIdRef.current === productId) {
        setVariantsLoading(false);
      }
    }
  };

  useEffect(() => {
    const fetchGameData = async () => {
      try {
        setLoading(true);
        setError("");
        setErrorState(null);
        setVariants([]);
        setSelectedProduct(null);
        setSelectedVariant(null);
        setVariantsError(null);
        const response = await fetch(`/api/public/catalog/games/${slug}`);
        const data = await response.json();
        
        if (!data.success) {
          setError(data.message || "Game tidak ditemukan.");
          setLoading(false);
          return;
        }

        const { game, products } = data.data;
        setGame(game);
        setProducts(products || []);
        setLoading(false); // Game detail shell appears immediately!

        if (game) {
          trackViewItem({
            id: game.id || game.slug,
            name: game.name,
            category: (game as any).category || "Game Voucher"
          });
        }

        if (products && products.length > 0) {
          const firstProd = products[0];
          setSelectedProduct(firstProd);
          // Asynchronously fetch variants without blocking the game shell
          fetchVariantsForProduct(firstProd.id);
        } else {
          setVariantsLoading(false);
        }
      } catch (err) {
        console.error("Error fetching game data:", err);
        setErrorState("service_error");
        setLoading(false);
      }
    };
    fetchGameData();
  }, [slug]);

  const handleProductChange = async (prod: Product) => {
    setSelectedProduct(prod);
    setSelectedVariant(null);
    fetchVariantsForProduct(prod.id);
  };

  const handleInputChange = (name: string, value: string) => {
    setCustomerInput(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckout = async () => {
    if (!selectedPaymentMethod) {
      setCheckoutError("Pilih metode pembayaran terlebih dahulu.");
      return;
    }

    if (!selectedProduct || !selectedVariant) {
      setCheckoutError("Pilih produk dan nominal terlebih dahulu.");
      return;
    }

    const activeFields = getAccountInputFields(game, selectedProduct);
    const payloadCustomerInput: Record<string, string> = {};

    for (const field of activeFields) {
      const val = (customerInput[field.name] || "").trim();
      if (field.required && !val) {
        setCheckoutError(`Harap isi ${field.label}.`);
        return;
      }
      payloadCustomerInput[field.name] = val;
    }

    if (buyerEmail.trim() && !/^\S+@\S+\.\S+$/.test(buyerEmail.trim())) {
      setCheckoutError("Format email pembeli tidak valid.");
      return;
    }

    if (buyerName.trim()) payloadCustomerInput.buyerName = buyerName.trim();
    if (buyerWhatsapp.trim()) payloadCustomerInput.whatsapp = buyerWhatsapp.trim();
    if (buyerEmail.trim()) payloadCustomerInput.email = buyerEmail.trim();

    setProcessing(true);
    setCheckoutError(null);

    // Track begin_checkout event in GA4
    if (selectedVariant) {
      const rawVariantPrice = (selectedVariant as any).sellingPrice ?? selectedVariant.pricing?.sellingPrice ?? (selectedVariant as any).price ?? 0;
      const parsedVariantPrice = Number(rawVariantPrice);
      const variantPrice = Number.isFinite(parsedVariantPrice) ? parsedVariantPrice : 0;
      trackBeginCheckout([
        {
          id: selectedVariant.id || selectedVariant.sku,
          name: selectedVariant.name || game?.name || "Voucher Game",
          price: variantPrice,
          quantity: 1
        }
      ], variantPrice);
    }
    try {
      let token = "";
      if ((user as any)?.getIdToken) {
        token = await (user as any).getIdToken();
      } else {
        const { data } = await supabase.auth.getSession();
        token = data?.session?.access_token || "";
      }

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          productId: selectedProduct.id,
          variantId: selectedVariant.id,
          customerInput: payloadCustomerInput,
          promoCode: promoCode.trim() || undefined,
          paymentMethod: selectedPaymentMethod,
          pointsToUse: pointsToUse
        }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
          // If response is not JSON, it might be an HTML error page
          const text = await response.text();
          console.error("Response not JSON:", text);
          throw new Error("Server error: received non-JSON response");
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Gagal membuat pesanan");

      setOrderId(data.orderId);
      setSnapToken(data.snapToken);
      setQrImage(data.qrImage);

      // For Doit: navigate directly to transaction page for native presentation
      if (data.gatewayCode === "doit" || data.gatewayCode === "omqris") {
        navigate(`/transactions/${data.orderId}`);
        return;
      }

      // If we have a QR image, we show it in-page (step 3)
      if (data.qrImage) {
        setCheckoutStep(3);
        return;
      }

      // Fallback: If we have a paymentUrl but NO snapToken and NO qrImage, it's a Redirect provider
      if (!data.snapToken && data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }
      
      setCheckoutStep(3);
      hasEmbeddedRef.current = false;
    } catch (err: any) {
      console.error(err);
      setCheckoutError(normalizeCheckoutErrorMessage(err, "Terjadi kesalahan saat checkout"));
    } finally {
      setProcessing(false);
    }
  };

  if (errorState === "configuration_error") return <div className="p-12 text-center">Konfigurasi layanan belum lengkap. Silakan coba lagi nanti.</div>;
  if (errorState === "service_error") return <div className="p-12 text-center text-red-500">Gagal memuat data. Silakan coba lagi.</div>;
  if (error) return <div className="p-12 text-center text-slate-500">{error}</div>;
  if (!game) {
    return (
      <div className="max-w-7xl mx-auto py-8 md:py-12 min-h-[80vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Memuat data game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 md:py-12">
      {/* Keep a semantic page title even when the visual banner or its name is hidden. */}
      {(!productBannerConfig.enabled || checkoutStep !== 1 || !productBannerConfig.showName) && (
        <h1 className="sr-only">{game.name}</h1>
      )}
      {/* Keep the image banner separate from all text and badges. */}
      {checkoutStep === 1 && productBannerConfig.enabled && (
        <>
          <section
            aria-label={game.name + " banner"}
            className={`relative isolate mb-3 ${productBannerConfig.height === "compact" ? "h-28 sm:h-36 md:h-40" : productBannerConfig.height === "large" ? "h-44 sm:h-56 md:h-64" : "h-36 sm:h-44 md:h-52"} overflow-hidden rounded-2xl border shadow-sm`}
            style={{ borderColor: "var(--border-color)" }}
          >
            <img
              src={productBannerConfig.imageUrl || game.image || "https://placehold.co/1200x400/172554/e2e8f0?text=iStore"}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          </section>

          {(productBannerConfig.showName || productBannerConfig.showAutomaticBadge || productBannerConfig.showSafetyBadge) && (
            <section
              aria-label="Informasi produk"
              className="mb-5 flex min-w-0 items-center gap-3 rounded-xl border px-4 py-3 sm:gap-4 sm:px-5 sm:py-4"
              style={{
                backgroundColor: "var(--surface-color)",
                borderColor: "var(--border-color)"
              }}
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border shadow-sm sm:h-16 sm:w-16" style={{ borderColor: "var(--border-color)" }}>
                <img
                  src={game.icon || game.image || "https://placehold.co/400x400/172554/e2e8f0?text=Game"}
                  alt={game.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {productBannerConfig.showName && (
                  <h1 id="game-title" className="min-w-0 break-words text-lg font-extrabold leading-tight text-slate-900 sm:text-2xl">
                    {game.name}
                  </h1>
                )}
                {(productBannerConfig.showAutomaticBadge || productBannerConfig.showSafetyBadge) && (
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {productBannerConfig.showAutomaticBadge && (
                      <span className="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-300/40 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">
                        <Zap className="h-3.5 w-3.5 shrink-0" />
                        Otomatis
                      </span>
                    )}
                    {productBannerConfig.showSafetyBadge && (
                      <span className="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700">
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                        Legal & Aman
                      </span>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {checkoutStep === 1 && (
        <details
          className="mb-5 overflow-hidden rounded-xl border text-sm"
          style={{
            backgroundColor: "var(--surface-color)",
            borderColor: "var(--border-color)"
          }}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
            <span>Petunjuk Pembelian{game.description?.trim() ? " & Deskripsi Produk" : ""}</span>
            <span className="text-xs font-medium text-slate-500">Lihat panduan</span>
          </summary>
          <div className="border-t px-4 py-4" style={{ borderColor: "var(--border-color)" }}>
            {game.description?.trim() && (
              <div className="mb-4">
                <h2 className="mb-1 font-bold text-slate-900">Deskripsi Produk</h2>
                <p className="whitespace-pre-line break-words leading-5 text-slate-600">{game.description.trim()}</p>
              </div>
            )}
            <ol className="grid gap-3 sm:grid-cols-3">
              <li className="flex items-start gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">1</span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">Pilih nominal</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">Pilih layanan dan nominal yang ingin dibeli.</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">2</span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">Isi data akun</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">Pastikan ID akun sudah benar sebelum lanjut.</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">3</span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">Bayar transaksi</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">Pilih metode pembayaran dan ikuti instruksinya.</p>
                </div>
              </li>
            </ol>
          </div>
        </details>
      )}

      {/* Purchase Container */}
      <div 
        className={
          checkoutStep === 3
            ? "bg-transparent shadow-none border-0 p-0"
            : `${
                cardBlur === "none" ? "" : cardBlur === "sm" ? "backdrop-blur-sm" : cardBlur === "lg" ? "backdrop-blur-lg" : "backdrop-blur-md"
              } rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm border space-y-6 sm:space-y-8 transition-all`
        }
        style={checkoutStep === 3 ? {} : {
          backgroundColor: hexToRgba(effectiveCardColor, cardOpacity),
          backdropFilter: cardBlur === "none" ? "none" : cardBlur === "sm" ? "blur(4px)" : cardBlur === "lg" ? "blur(16px)" : "blur(12px)",
          WebkitBackdropFilter: cardBlur === "none" ? "none" : cardBlur === "sm" ? "blur(4px)" : cardBlur === "lg" ? "blur(16px)" : "blur(12px)",
          borderColor: isDarkMode 
            ? "var(--border-color)" 
            : (cardOpacity < 100 
                ? (effectiveCardColor === "#ffffff" ? "rgba(226, 232, 240, 0.85)" : hexToRgba(effectiveCardColor, Math.min(100, cardOpacity + 20))) 
                : "#f1f5f9"),
          boxShadow: cardOpacity < 100 
            ? "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)" 
            : "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)"
        }}
      >
        {checkoutStep === 1 && (
          <>
            {/* LAYOUT 1: Pilih Layanan, Data Akun, Data Pembeli, Pilih Nominal */}

            {/* 1. Pilih Layanan (if multiple products available) */}
            {products.length > 1 && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold">1</span>
                  Pilih Layanan
                </h2>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2.5">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleProductChange(p)}
                      className={`px-5 py-2.5 rounded-xl border-2 text-sm font-bold transition-all text-center ${
                        selectedProduct?.id === p.id 
                          ? "border-brand-600 bg-brand-600 text-white shadow-md shadow-brand-100" 
                          : "border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Login / Data Akun */}
            <div className="space-y-2.5">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {products.length > 1 ? "2" : "1"}
                </span>
                Login / Data Akun
              </h2>
              {(() => {
                const accountFields = getAccountInputFields(game, selectedProduct);
                return (
                  <div className="space-y-3">
                    <div className={`grid ${accountFields.length > 1 ? "grid-cols-2" : "grid-cols-1"} gap-2.5 sm:gap-4`}>
                      {accountFields.map((field) => (
                        <div key={field.name}>
                          <label className="block text-xs font-medium text-slate-600 mb-1.5">{field.label}</label>
                          <div className="flex gap-2">
                            <input
                              type={field.type || "text"}
                              placeholder={field.placeholder || `Masukkan ${field.label}`}
                              value={customerInput[field.name] || ""}
                              onChange={(e) => {
                                handleInputChange(field.name, e.target.value);
                                if (field.name === "userId") setInquiryResult(null);
                              }}
                              className="w-full min-w-0 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    {inquiryResult && (
                      <div className={`p-3 rounded-xl border text-xs ${inquiryResult.isValid ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
                        {inquiryResult.isValid ? (
                          <div className="flex items-center gap-1.5 font-medium">
                            <span>✓ Nama Akun:</span>
                            <span className="font-bold">{inquiryResult.username}</span>
                          </div>
                        ) : (
                          <div>{inquiryResult.message || "✕ ID akun tidak ditemukan"}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* 3. Data Pembeli */}
            <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 sm:p-4">
              <div className="space-y-1">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 shrink-0 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold">
                    {products.length > 1 ? "3" : "2"}
                  </span>
                  <span>Data Pembeli</span>
                  <span className="text-[11px] font-medium text-slate-500 rounded-full bg-white border border-slate-200 px-2 py-0.5">Opsional</span>
                </h2>
                <p className="pl-8 text-[11px] leading-4 text-slate-500">Untuk konfirmasi dan bukti transaksi via WhatsApp atau email.</p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Pembeli</label>
                  <input
                    type="text"
                    placeholder="Nama Anda (opsional)"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="w-full min-w-0 px-3 py-2.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">No. WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="0812xxxxxxx (opsional)"
                    value={buyerWhatsapp}
                    onChange={(e) => setBuyerWhatsapp(e.target.value)}
                    className="w-full min-w-0 px-3 py-2.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Bukti Transaksi</label>
                  <input
                    type="email"
                    placeholder="email@domain.com (opsional)"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    className="w-full min-w-0 px-3 py-2.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
            </div>

            {/* 4. Pilih Nominal Top-Up */}
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold">
                  {products.length > 1 ? "4" : "3"}
                </span>
                Pilih Nominal Top-Up
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
                {variantsLoading ? (
                  Array.from({ length: 8 }).map((_, idx) => (
                    <div
                      key={`var-skel-${idx}`}
                      className="w-full h-20 rounded-xl bg-slate-200/60 animate-pulse p-3 flex flex-col justify-between"
                    >
                      <div className="h-3 bg-slate-300/70 rounded w-3/4"></div>
                      <div className="h-4 bg-slate-300/70 rounded w-1/2"></div>
                    </div>
                  ))
                ) : variantsError ? (
                  <div className="col-span-full py-6 text-center text-slate-500 text-xs sm:text-sm bg-red-50/50 rounded-xl border border-red-100 p-4 space-y-2">
                    <AlertCircle className="w-6 h-6 mx-auto text-red-500 opacity-80" />
                    <p className="text-red-700 font-medium">{variantsError}</p>
                    {selectedProduct && (
                      <button
                        type="button"
                        onClick={() => fetchVariantsForProduct(selectedProduct.id)}
                        className="px-3 py-1 bg-white border border-red-200 text-red-700 font-semibold rounded-lg text-xs hover:bg-red-50 transition-colors shadow-sm"
                      >
                        Coba Lagi
                      </button>
                    )}
                  </div>
                ) : variants.length > 0 ? (
                  variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        const activeFields = getAccountInputFields(game, selectedProduct);
                        for (const field of activeFields) {
                          const val = (customerInput[field.name] || "").trim();
                          if (field.required && !val) {
                            setCheckoutError(`Harap isi ${field.label} terlebih dahulu.`);
                            return;
                          }
                        }
                        setCheckoutError(null);
                        setSelectedVariant(v);
                        setCheckoutStep(2);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={`w-full min-w-0 text-left p-2.5 sm:p-3 rounded-xl border ${
                        selectedVariant?.id === v.id
                          ? "border-brand-600 bg-brand-500/15"
                          : "border-slate-200/80 hover:border-brand-500 bg-transparent hover:bg-brand-500/10"
                      } transition-all relative overflow-hidden group flex flex-col justify-between`}
                    >
                      <div className="font-bold text-slate-900 text-xs sm:text-sm mb-1.5 line-clamp-2 leading-snug group-hover:text-brand-700">{v.displayName}</div>
                      <div className="text-brand-600 font-extrabold text-xs shrink-0">{formatRupiah((v as any).sellingPrice || 0)}</div>
                    </button>
                  ))
                ) : (
                  <div className="col-span-full py-6 text-center text-slate-400 text-sm">
                    <AlertCircle className="w-6 h-6 mx-auto mb-1 opacity-20" />
                    Belum ada nominal tersedia untuk layanan ini.
                  </div>
                )}
              </div>
            </div>

            {checkoutError && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span className="font-medium">{checkoutError}</span>
              </div>
            )}
          </>
        )}

        {checkoutStep === 2 && (
          <>
            {/* LAYOUT 2: Rincian Lengkap, Metode Pembayaran, Promo, Total, Bayar */}
            <div className="flex items-center justify-between pb-2">
              <button
                type="button"
                onClick={() => {
                  setCheckoutStep(1);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-xl transition-colors"
              >
                ← Ganti Nominal / Pilihan
              </button>
              <span className="text-xs font-semibold text-slate-400">Konfirmasi Pembayaran</span>
            </div>

            {/* Ringkasan Pesanan */}
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-brand-600 rounded-full"></span>
                Rincian Pesanan & Akun
              </h2>
              <div className="text-sm bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-solid relative z-10 space-y-3" style={{ borderColor: "var(--border-color)" }}>
                <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-3 sm:p-4">
                  <div className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <img src={game?.icon || game?.image || "/images/game-placeholder.png"} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-slate-500">Ringkasan pesanan</p>
                    <p className="mt-0.5 break-words font-extrabold leading-snug text-slate-900 text-sm sm:text-base">{selectedProduct?.name || game?.name || "-"}</p>
                    <p className="mt-1 break-words text-xs sm:text-sm text-slate-600">{selectedVariant?.displayName || "-"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] text-slate-500">Harga item</p>
                    <p className="font-extrabold text-brand-700 text-xs sm:text-sm">{selectedVariant ? formatRupiah(selectedSellingPrice) : "-"}</p>
                  </div>
                </div>
                <div className="space-y-2.5 pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-xs">Player ID</span>
                  <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm">{customerInput["userId"] || "-"}</span>
                </div>
                {customerInput["zoneId"] && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-xs">Zone / Server ID</span>
                    <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm">{customerInput["zoneId"]}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-xs">Nama Akun</span>
                  <span className="font-bold text-green-600 text-xs sm:text-sm">{inquiryResult?.isValid ? inquiryResult.username : "-"}</span>
                </div>
                {buyerName.trim() && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-xs">Nama Pembeli</span>
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">{buyerName.trim()}</span>
                  </div>
                )}
                {buyerWhatsapp.trim() && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-xs">No. WhatsApp</span>
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">{buyerWhatsapp.trim()}</span>
                  </div>
                )}
                {buyerEmail.trim() && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-xs">Email</span>
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">{buyerEmail.trim()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-xs">Metode Pembayaran</span>
                  <span className="text-right font-bold text-xs sm:text-sm">
                    {selectedPaymentMethod ? (
                      <span className="text-brand-600 uppercase">
                        {activeGateway === "doit" || activeGateway === "omqris"
                          ? ({
                              qris: "QRIS",
                              mandiri_va: "Mandiri VA",
                              bni_va: "BNI VA",
                              bri_va: "BRI VA",
                              bsi_va: "BSI VA",
                              cimb_va: "CIMB Niaga VA",
                              permata_va: "Permata VA",
                              maybank_va: "Maybank VA",
                              danamon_va: "Danamon VA"
                            }[selectedPaymentMethod] || selectedPaymentMethod.toUpperCase())
                          : ({
                              qris: "QRIS",
                              gopay: "GoPay",
                              shopeepay: "ShopeePay",
                              bca_va: "BCA VA",
                              bni_va: "BNI VA",
                              bri_va: "BRI VA",
                              echannel: "Mandiri",
                              permata_va: "Permata VA",
                              other_va: "Virtual Account"
                            }[selectedPaymentMethod] || selectedPaymentMethod.toUpperCase())}
                      </span>
                    ) : <span className="font-medium text-amber-700">Belum dipilih</span>}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-xs">Estimasi Total</span>
                  <span className="font-bold text-slate-900 text-xs sm:text-sm">{selectedVariant ? formatRupiah(estimatedCheckoutTotal) : "-"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-xs">Estimasi Diskon Poin</span>
                  <span className="font-bold text-emerald-600 text-xs sm:text-sm">{formatRupiah(estimatedLoyaltyDiscount)}</span>
                </div>
                </div>
                <p className="border-t border-slate-200 pt-3 text-[10px] sm:text-[11px] leading-relaxed text-slate-500">Periksa kembali data akun dan nominal sebelum melanjutkan. Harga akhir akan divalidasi oleh server saat checkout.</p>
              </div>
            </div>

            {/* Kode Promo / Voucher */}
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-brand-600 rounded-full"></span>
                Kode Promo / Voucher
              </h2>
              <div className="flex gap-2 max-w-sm">
                <input
                  type="text"
                  placeholder="KODE PROMO"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-2.5 text-xs uppercase border border-solid rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 m-px"
                  style={{ borderColor: "var(--border-color)", backgroundColor: hexToRgba(effectiveCardColor, Math.min(100, cardOpacity + 5)) }}
                />
              </div>
            </div>

            {/* Loyalty Points */}
            {loyaltyData && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-brand-600 rounded-full"></span>
                  Poin Loyalty
                </h2>
                <div className="space-y-3 p-4 rounded-xl border" style={{ borderColor: "var(--border-color)", backgroundColor: hexToRgba(effectiveCardColor, Math.min(100, cardOpacity + 5)) }}>
                  <p className="text-xs text-slate-600">Saldo: <span className="font-bold text-brand-700">{loyaltyData.balance} poin</span></p>
                  <input
                    type="number"
                    placeholder="Masukkan jumlah poin"
                    value={pointsToUse || ""}
                    onChange={(e) => setPointsToUse(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                  {pointsToUse > 0 && (
                    <div className="text-xs space-y-1">
                      <p>Estimasi diskon poin: Rp {estimatedLoyaltyDiscount.toLocaleString("id-ID")}</p>
                      <p className="font-bold">Estimasi total setelah poin + biaya admin: Rp {estimatedCheckoutTotal.toLocaleString("id-ID")}</p>
                      <p className="text-slate-500">Estimasi sebelum validasi promo/flash sale. Total final ditetapkan server saat checkout.</p>
                      {requestedLoyaltyPoints > loyaltyData.balance && (
                        <p className="text-amber-700">Saldo poin tidak mencukupi.</p>
                      )}
                      {requestedLoyaltyPoints > 0 && requestedLoyaltyPoints < loyaltyData.config.minRedeemPoints && (
                        <p className="text-amber-700">Minimal penukaran {loyaltyData.config.minRedeemPoints} poin.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. Metode Pembayaran */}
            <div className="space-y-4">
              <h2 className={`text-base font-bold flex items-center gap-2 text-slate-100`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isDarkMode ? "bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/30" : "bg-brand-100 text-brand-600"}`}>3</span>
                Pilih Metode Pembayaran
              </h2>
              {activeGateway === "doit" || activeGateway === "omqris" ? (
                <div className="space-y-4">
                  {/* Kelompok QRIS */}
                  <div>
                    <h3 className={`mb-2 text-xs font-bold uppercase tracking-[0.16em] ${isDarkMode ? "text-violet-300" : "text-slate-500"}`}>QRIS</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {[
                        { id: "qris", name: "QRIS", desc: "Scan & bayar dengan QRIS", tag: "Instant", logo: "/payment-logos/qris.svg" }
                      ].map((method) => {
                        const isSelected = selectedPaymentMethod === method.id;
                        return (
                          <button
                            key={method.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => setSelectedPaymentMethod(method.id)}
                            className={`group relative flex h-auto min-h-[112px] w-full min-w-0 flex-col justify-between overflow-hidden rounded-2xl border p-3.5 text-left shadow-sm transition-all duration-200 ease-out sm:min-h-[120px] sm:p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 active:scale-[0.98] ${
                              isSelected
                                ? "border-violet-400 bg-violet-500/10 shadow-[0_0_0_1px_rgba(139,92,246,0.18),0_8px_24px_rgba(139,92,246,0.12)]"
                                : "border-slate-700/80 bg-slate-900/90 hover:-translate-y-0.5 hover:border-cyan-400/60 hover:bg-slate-800/95 hover:shadow-[0_8px_24px_rgba(34,211,238,0.08)]
                            }`}
                            style={{ backgroundColor: isSelected ? "rgba(35, 28, 54, 0.98)" : "rgba(25, 29, 39, 0.96)", borderColor: isSelected ? "rgba(167, 139, 250, 0.95)" : "rgba(148, 163, 184, 0.22)" }}
                          >
                            <div className="flex items-center justify-between w-full mb-1">
                              <div className="h-10 w-full flex items-center justify-center rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-sm transition-transform duration-200 group-hover:scale-[1.02]">
                                <img
                                  src={method.logo}
                                  alt={method.name}
                                  className="max-h-full max-w-full object-contain"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              {method.tag && (
                                <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold leading-none border-violet-400/30 bg-violet-500/15 text-violet-200`}>
                                  {method.tag}
                                </span>
                              )}
                            </div>
                            <div className="mt-1">
                              <div className={`line-clamp-1 text-xs font-bold leading-tight sm:text-sm text-slate-100`}>{method.name}</div>
                              {method.desc && <div className={`mt-0.5 line-clamp-1 text-[10px] leading-tight sm:text-xs text-slate-400`}>{method.desc}</div>}
                            </div>
                            {isSelected && (
                              <div className="absolute top-0 right-0">
                                <div className={`bg-violet-500 rounded-bl-xl p-1.5 text-white`}>
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Kelompok Virtual Account */}
                  <div>
                    <h3 className={`mb-2 text-xs font-bold uppercase tracking-[0.16em] ${isDarkMode ? "text-slate-300" : "text-slate-500"}`}>Virtual Account</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {[
                        { id: "mandiri_va", name: "Mandiri VA", logo: "/payment-logos/mandiri.svg" },
                        { id: "bni_va", name: "BNI VA", logo: "/payment-logos/bni.svg" },
                        { id: "bri_va", name: "BRI VA", logo: "/payment-logos/bri.svg" },
                        { id: "bsi_va", name: "BSI VA", logo: "/payment-logos/bsi.svg" },
                        { id: "cimb_va", name: "CIMB Niaga VA", logo: "/payment-logos/cimb-niaga.svg" },
                        { id: "permata_va", name: "Permata VA", logo: "/payment-logos/permata.svg" },
                        { id: "maybank_va", name: "Maybank VA", logo: "/payment-logos/bi-fast.svg" },
                        { id: "danamon_va", name: "Danamon VA", logo: "/payment-logos/danamon.svg" }
                      ].map((method) => {
                        const isSelected = selectedPaymentMethod === method.id;
                        return (
                          <button
                            key={method.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => setSelectedPaymentMethod(method.id)}
                            className={`group relative flex h-auto min-h-[112px] w-full min-w-0 flex-col justify-between overflow-hidden rounded-2xl border p-3.5 text-left shadow-sm transition-all duration-200 ease-out sm:min-h-[120px] sm:p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 active:scale-[0.98] ${
                              isSelected
                                ? "border-violet-400 bg-violet-500/10 shadow-[0_0_0_1px_rgba(139,92,246,0.18),0_8px_24px_rgba(139,92,246,0.12)]"
                                : "border-slate-700/80 bg-slate-900/90 hover:-translate-y-0.5 hover:border-cyan-400/60 hover:bg-slate-800/95 hover:shadow-[0_8px_24px_rgba(34,211,238,0.08)]
                            }`}
                            style={{ backgroundColor: isSelected ? "rgba(35, 28, 54, 0.98)" : "rgba(25, 29, 39, 0.96)", borderColor: isSelected ? "rgba(167, 139, 250, 0.95)" : "rgba(148, 163, 184, 0.22)" }}
                          >
                            <div className="flex items-center justify-between w-full mb-1">
                              <div className="h-10 w-full flex items-center justify-center rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-sm transition-transform duration-200 group-hover:scale-[1.02]">
                                <img
                                  src={method.logo}
                                  alt={method.name}
                                  className="max-h-full max-w-full object-contain"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            </div>
                            <div className="mt-1">
                              <div className={`line-clamp-1 text-xs font-bold leading-tight sm:text-sm text-slate-100`}>{method.name}</div>
                            </div>
                            {isSelected && (
                              <div className="absolute top-0 right-0">
                                <div className={`bg-violet-500 rounded-bl-xl p-1.5 text-white`}>
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : activeGateway === "tripay" ? (
                <div className="space-y-3">
                  {tripayChannelsLoading ? (
                    <div className="flex items-center gap-3 rounded-xl border p-4 text-sm text-slate-500" style={{ borderColor: "var(--border-color)" }} role="status">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                      Memuat metode pembayaran yang tersedia...
                    </div>
                  ) : (
                    (["QRIS", "E-Wallet", "BANK", ...Array.from(new Set(tripayAvailableChannels.map((channel) => getTripayChannelGroup(channel)).filter((group) => !["QRIS", "E-Wallet", "Virtual Account", "Transfer Bank", "Lainnya"].includes(group)))), "Lainnya"]).map((group) => {
                      const channels = group === "BANK"
                        ? tripayAvailableChannels.filter((channel) => ["Virtual Account", "Transfer Bank"].includes(getTripayChannelGroup(channel)))
                        : group === "QRIS"
                          ? (() => {
                              const qrisChannels = tripayAvailableChannels.filter((channel) => getTripayChannelGroup(channel) === "QRIS");
                              const standardQris = qrisChannels.find((channel) => channel.code.toUpperCase() === "QRIS");
                              return standardQris ? [standardQris] : qrisChannels.slice(0, 1);
                            })()
                          : tripayAvailableChannels.filter((channel) => getTripayChannelGroup(channel) === group);
                      if (!channels.length) return null;
                      const isPrimary = group === "QRIS";
                      const isExpanded = isPrimary || Boolean(expandedPaymentGroups[group]);
                      const groupLabel = group === "E-Wallet" ? "E-WALLET" : group;
                      return (
                        <section key={group} className="space-y-2" aria-label={group}>
                          <button
                            type="button"
                            className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 ${isPrimary ? "border-violet-400/50 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.08)]" : "border-slate-700/80 hover:border-cyan-400/50"}`}
                            style={isPrimary ? {} : { backgroundColor: "rgba(25, 29, 39, 0.96)", borderColor: "rgba(148, 163, 184, 0.22)" }}
                            aria-expanded={isExpanded}
                            onClick={() => {
                              if (isPrimary) return;
                              setExpandedPaymentGroups((current) => ({ ...current, [group]: !current[group] }));
                            }}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className={`text-xs font-bold tracking-wide text-slate-100`}>{groupLabel}</span>
                              {!isPrimary && <span className="text-[11px] text-slate-500">{isExpanded ? "SEMBUNYIKAN" : "TAMPILKAN"}</span>}
                            </span>
                            {!isPrimary && <ChevronRight className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isExpanded ? "rotate-90" : ""}`} />}
                          </button>
                          {isExpanded && (
                            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                              {channels.map((channel) => {
                                const isSelected = selectedPaymentMethod === channel.code;
                                return (
                                  <button
                                    key={channel.code}
                                    type="button"
                                    aria-pressed={isSelected}
                                    aria-label={`Pilih metode pembayaran ${channel.name}`}
                                    onClick={() => { setSelectedPaymentMethod(channel.code); setCheckoutError(null); }}
                                    className={`group flex min-h-[64px] w-full min-w-0 items-center gap-2 rounded-xl border p-2.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 active:scale-[0.98] ${
                                      isSelected
                                        ? "border-violet-400 bg-violet-500/10 shadow-[0_0_0_1px_rgba(139,92,246,0.18),0_6px_18px_rgba(139,92,246,0.10)]"
                                        : "border-slate-700/80 bg-slate-900/90 hover:-translate-y-0.5 hover:border-cyan-400/60 hover:bg-slate-800/95"
                                    }`}
                                    style={{ backgroundColor: isSelected ? "rgba(35, 28, 54, 0.98)" : "rgba(25, 29, 39, 0.96)", borderColor: isSelected ? "rgba(167, 139, 250, 0.95)" : "rgba(148, 163, 184, 0.22)" }}
                                  >
                                    <span className="flex h-8 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white p-1.5 shadow-sm transition-transform duration-200 group-hover:scale-[1.03]">
                                      <img src={channel.iconUrl || getTripayChannelLogo(channel.code)} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className={`block line-clamp-2 break-words text-xs font-semibold leading-snug text-slate-100`}>{channel.name}</span>
                                    </span>
                                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                      isSelected ? "border-violet-400 bg-violet-500 text-white" : "border-slate-600 bg-slate-800"
                                    }`}>
                                      {isSelected && <ShieldCheck className="h-3.5 w-3.5" />}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </section>
                      );
                    })
                  )}
                  {!tripayChannelsLoading && !tripayChannelsError && tripayAvailableChannels.length === 0 && (
                    <div className="rounded-xl border p-4 text-sm text-slate-500" style={{ borderColor: "var(--border-color)" }}>
                      Metode pembayaran belum tersedia. Silakan coba beberapa saat lagi.
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {([
                        { id: "qris", name: "QRIS", desc: "Scan & bayar dengan QRIS", tag: "Hot", logo: "/payment-logos/qris.svg" },
                        { id: "gopay", name: "GoPay", desc: "Pembayaran digital", logo: "/payment-logos/gopay.svg" },
                        { id: "shopeepay", name: "ShopeePay", desc: "Pembayaran digital", tag: "Hot", logo: "/payment-logos/shopee-pay.svg" },
                        { id: "bca_va", name: "BCA VA", logo: "/payment-logos/bca.svg" },
                        { id: "bni_va", name: "BNI VA", logo: "/payment-logos/bni.svg" },
                        { id: "bri_va", name: "BRI VA", logo: "/payment-logos/bri.svg" },
                        { id: "bsi_va", name: "BSI VA", logo: "/payment-logos/bsi.svg" },
                        { id: "cimb_va", name: "CIMB Niaga VA", logo: "/payment-logos/cimb-niaga.svg" },
                        { id: "danamon_va", name: "Danamon VA", logo: "/payment-logos/danamon.svg" },
                        { id: "echannel", name: "Mandiri", logo: "/payment-logos/mandiri.svg" },
                        { id: "permata_va", name: "Permata VA", logo: "/payment-logos/permata.svg" },
                        { id: "other_va", name: "VA", logo: "/payment-logos/bi-fast.svg" }
                      ].filter((method) => !["bsi_va", "cimb_va", "danamon_va"].includes(method.id)) as Array<{ id: string; name: string; desc?: string; tag?: string; logo: string }>
                  ).map((method) => {
                    const isSelected = selectedPaymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setSelectedPaymentMethod(method.id)}
                        aria-pressed={isSelected}
                        className={`group relative flex h-auto min-h-[112px] w-full min-w-0 flex-col justify-between overflow-hidden rounded-2xl border p-3.5 text-left shadow-sm transition-all duration-200 ease-out sm:min-h-[120px] sm:p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 active:scale-[0.98] ${
                          isSelected
                            ? (isDarkMode ? "border-violet-400 bg-violet-500/10 shadow-[0_0_0_1px_rgba(139,92,246,0.18),0_8px_24px_rgba(139,92,246,0.12)]" : "border-brand-600 bg-brand-50/70 shadow-md ring-2 ring-brand-500/20")
                            : (isDarkMode ? "border-slate-700/80 bg-slate-900/90 hover:-translate-y-0.5 hover:border-cyan-400/60 hover:bg-slate-800/95 hover:shadow-[0_8px_24px_rgba(34,211,238,0.08)]" : "border-slate-200/80 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md")
                        }`}
                        style={{ backgroundColor: isSelected ? "rgba(35, 28, 54, 0.98)" : "rgba(25, 29, 39, 0.96)", borderColor: isSelected ? "rgba(167, 139, 250, 0.95)" : "rgba(148, 163, 184, 0.22)" }}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <div className="h-10 w-full flex items-center justify-center rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-sm transition-transform duration-200 group-hover:scale-[1.02]">
                            <img
                              src={method.logo}
                              alt={method.name}
                              className="max-h-full max-w-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          {method.tag && (
                            <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold leading-none border-violet-400/30 bg-violet-500/15 text-violet-200`}>
                              {method.tag}
                            </span>
                          )}
                        </div>
                        <div className="mt-1">
                          <div className={`line-clamp-1 text-xs font-bold leading-tight sm:text-sm text-slate-100`}>{method.name}</div>
                          {method.desc && <div className="text-[10px] sm:text-xs text-slate-500 leading-tight mt-0.5 line-clamp-1">{method.desc}</div>}
                        </div>
                        {isSelected && (
                          <div className="absolute top-0 right-0">
                            <div className={`bg-violet-500 rounded-bl-xl p-1.5 text-white`}>
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {activeGateway === "tripay" && tripayChannelsError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800" role="status">{tripayChannelsError}</div>
              )}
            </div>

            <div className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed text-slate-600" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface-color)" }}>
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{selectedPaymentMethod
                ? `Metode dipilih: ${activeGateway === "tripay" ? tripayAvailableChannels.find((channel) => channel.code === selectedPaymentMethod)?.name || selectedPaymentMethod : selectedPaymentMethod.toUpperCase()}. Instruksi pembayaran akan ditampilkan setelah Anda melanjutkan.`
                : "Pilih satu metode pembayaran yang tersedia. iStore tidak memilih metode secara otomatis agar Anda tetap memegang kendali."}</span>
            </div>

            {/* Total Pembayaran */}
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-brand-600 rounded-full"></span>
                Total Pembayaran
              </h2>
              <div className="flex justify-between items-center py-2 px-1">
                <span className="font-bold text-sm text-slate-700">Total Akhir</span>
                <span className="font-black text-2xl md:text-3xl text-brand-600">
                  {selectedVariant ? formatRupiah(estimatedCheckoutTotal) : "-"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Total ini merupakan estimasi berdasarkan harga katalog, poin, dan biaya admin. Validasi promo/flash sale dan jumlah akhir dilakukan server saat checkout.</p>
            </div>

            {/* Bayar Sekarang */}
            <div className="pt-2 space-y-3">
              {checkoutError && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span className="font-medium">{checkoutError}</span>
                </div>
              )}

              <button
                onClick={handleCheckout}
                disabled={!selectedVariant || !selectedPaymentMethod || processing}
                className="w-full bg-brand-600 text-white font-bold py-4 rounded-2xl hover:bg-brand-700 transition-all shadow-xl shadow-brand-200 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 group text-base"
              >
                {processing ? "Memproses..." : (
                  <>
                    Lanjutkan ke pembayaran
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
              <p className="text-[11px] text-center text-slate-400 leading-relaxed">
                Dengan melanjutkan, Anda menyetujui <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline hover:text-brand-700">Syarat & Ketentuan</Link> Toko Kami
              </p>
            </div>
          </>
        )}

        {checkoutStep === 3 && (
          <div className="space-y-4">
            {qrImage ? (
              <div className="flex flex-col items-center justify-center p-8 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-6">
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">Scan QRIS Untuk Membayar</h3>
                  <p className="text-sm text-slate-500">Silakan scan kode QR di bawah ini menggunakan aplikasi pembayaran Anda</p>
                </div>
                
                <div className="bg-white p-4 rounded-2xl border-2 border-brand-100 shadow-inner">
                  <img 
                    src={qrImage.startsWith('data:') || qrImage.startsWith('http://') || qrImage.startsWith('https://') || qrImage.startsWith('/') ? qrImage : `data:image/png;base64,${qrImage}`} 
                    alt="QRIS" 
                    className="w-64 h-64 md:w-80 md:h-80 object-contain" 
                  />
                </div>

                <div className="flex items-center gap-2 text-xs text-brand-600 font-bold bg-brand-50 px-4 py-2 rounded-full animate-pulse">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Menunggu Pembayaran...</span>
                </div>

                <p className="text-[11px] text-slate-400 text-center max-w-xs">
                  Sistem akan mendeteksi pembayaran Anda secara otomatis. Mohon jangan menutup halaman ini sampai transaksi selesai.
                </p>
              </div>
            ) : checkoutError ? (
              <div className="min-h-[400px] flex flex-col items-center justify-center text-center p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Pembayaran Terkendala</h3>
                <p className="text-slate-500 text-sm mb-6 max-w-xs">
                  {checkoutError}
                </p>
                <div className="flex flex-col w-full gap-3">
                  <button
                    onClick={() => {
                      setCheckoutError(null);
                      hasEmbeddedRef.current = false;
                      // Trigger re-render to re-run effect
                      setSnapToken(prev => prev ? `${prev} ` : null);
                      setTimeout(() => setSnapToken(prev => prev?.trim() || null), 10);
                    }}
                    className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl hover:bg-brand-700 transition-all"
                  >
                    Coba Muat Ulang Snap
                  </button>
                  <button
                    onClick={() => setCheckoutStep(2)}
                    className="w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition-all"
                  >
                    Kembali ke Metode Pembayaran
                  </button>
                </div>
              </div>
            ) : (
              <div
                ref={snapContainerRef}
                id="snap-container"
                className="w-full min-h-[500px] rounded-2xl overflow-hidden border border-slate-100 bg-white"
              ></div>
            )}
          </div>
        )}
      </div>

      {/* Section Review Pelanggan */}
      {selectedProduct?.id && (
        <ProductReviewsSection
          productId={selectedProduct.id}
          productName={game?.name || selectedProduct.name}
          variantId={selectedVariant?.id}
          cardColor={cardColor}
          cardOpacity={cardOpacity}
          cardBlur={cardBlur}
        />
      )}
    </div>
  );
}
