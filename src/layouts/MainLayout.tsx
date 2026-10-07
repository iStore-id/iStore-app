import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { supabaseSignOut } from "../lib/supabase-auth";
import { useAuthStore } from "../store/auth-store";
import { 
  LogOut, 
  Receipt, 
  Menu, 
  X, 
  Bell,
  Crown,
  Mail,
  Phone,
  MapPin,
  MessageSquare,
  Instagram,
  Facebook,
  Youtube,
  Send,
  Twitter,
  Globe,
  Search,
  Gamepad2,
  Loader2,
  User,
  Clock3,
  ShieldCheck
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { fetchStoreConfig, invalidateStoreConfigCache } from "../lib/utils";
import NotificationBell from "../components/NotificationBell";
import { PaymentMethodLogos } from "../components/PaymentLogos";
import ThemeToggle, { CustomerThemePreference } from "../components/ThemeToggle";

interface BrandingConfig {
  name: string;
  logo: string;
  favicon: string;
  description: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  brandTextColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  textColor?: string;
  textSecondaryColor?: string;
  borderColor?: string;
  accentColor?: string;
  hoverColor?: string;
  headerBackgroundColor?: string;
  headerTextColor?: string;
  headerScrollEffect?: boolean;
  logoHoverEffect?: boolean;
  navIndicator?: boolean;
  logoStyle?: 'natural' | 'circle' | 'rounded-box';
  logoShowName?: boolean;
  homepageBackgroundColor?: string;
  homepageBackgroundImage?: string;
  homepageBackgroundMode?: 'color' | 'image';
  footerBackgroundColor?: string;
  footerBackgroundImage?: string;
  footerBackgroundMode?: 'color' | 'image';
  borderRadius?: string;
  buttonStyle?: string;
  themePreference?: string;
  operationalStatus?: 'open' | 'closed' | 'maintenance';
  closedMessage?: string;
  maintenanceMessage?: string;
  contactInformation?: {
    email?: string;
    phone?: string;
    whatsapp?: string;
    address?: string;
  };
  socialMedia?: Record<string, string>;
  showGlobalBorders?: boolean;
}

function isHexDark(hex?: string): boolean {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 128;
}

function resolveRadiusTokens(r?: string) {
  switch (r) {
    case 'none':
      return {
        sm: '0px',
        md: '0px',
        lg: '0px',
        xl: '0px',
        xxl: '0px',
        xxxl: '0px'
      };
    case 'sm':
      return {
        sm: '2px',
        md: '3px',
        lg: '4px',
        xl: '6px',
        xxl: '8px',
        xxxl: '10px'
      };
    case 'md':
      return {
        sm: '2px',
        md: '4px',
        lg: '6px',
        xl: '8px',
        xxl: '12px',
        xxxl: '16px'
      };
    case 'lg':
      return {
        sm: '3px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        xxl: '16px',
        xxxl: '20px'
      };
    case '2xl':
      return {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
        xxl: '24px',
        xxxl: '32px'
      };
    case '3xl':
      return {
        sm: '8px',
        md: '12px',
        lg: '18px',
        xl: '24px',
        xxl: '32px',
        xxxl: '40px'
      };
    case 'full':
      return {
        sm: '9999px',
        md: '9999px',
        lg: '9999px',
        xl: '9999px',
        xxl: '9999px',
        xxxl: '9999px'
      };
    case 'xl':
    default:
      return {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        xxl: '16px',
        xxxl: '24px'
      };
  }
}

export default function MainLayout() {
  const { user, role, loading, setUser } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  // Customer Theme Preference (Local Override)
  const [customerTheme, setCustomerTheme] = useState<CustomerThemePreference | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("istore_customer_theme_preference");
        if (saved === "light" || saved === "dark" || saved === "system") {
          return saved;
        }
      } catch (e) {
        console.warn("Unable to read customer theme preference from localStorage:", e);
      }
    }
    return null;
  });

  const handleCustomerThemeChange = (newTheme: CustomerThemePreference) => {
    setCustomerTheme(newTheme);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("istore_customer_theme_preference", newTheme);
      } catch (e) {
        console.warn("Unable to write customer theme preference to localStorage:", e);
      }
    }
  };

  // OS / System Color Scheme Listener
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else if ((mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(handleChange);
      return () => (mediaQuery as any).removeListener(handleChange);
    }
  }, []);

  // Global Header Scroll Listener
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Global Header Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [allGames, setAllGames] = useState<any[]>([]);
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setIsMobileMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const loadConfig = () => {
      fetchStoreConfig().then(config => {
        if (config) {
          setBranding(config);
        }
      });
    };

    loadConfig();

    const handleConfigUpdate = () => {
      invalidateStoreConfigCache();
      loadConfig();
    };

    window.addEventListener("store-config-updated", handleConfigUpdate);
    return () => {
      window.removeEventListener("store-config-updated", handleConfigUpdate);
    };
  }, []);

  useEffect(() => {
    if (branding?.name) {
      document.title = `${branding.name} - ${branding.tagline || 'Top up game cepat dan aman'}`;
    }
    if (branding?.favicon) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = branding.favicon;
    }
  }, [branding]);

  // Handle click outside & ESC key for Search
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSearchOpen(false);
        setIsMobileSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Debounced Global Search Logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setIsSearchOpen(true);

    const timer = setTimeout(async () => {
      try {
        let gamesData = allGames;
        let categoriesData = allCategories;

        if (gamesData.length === 0) {
          const resG = await fetch("/api/public/catalog/games");
          const jsonG = await resG.json();
          if (jsonG.success && jsonG.data) {
            gamesData = jsonG.data;
            setAllGames(jsonG.data);
          }
        }

        if (categoriesData.length === 0) {
          const resC = await fetch("/api/public/catalog/categories");
          const jsonC = await resC.json();
          if (jsonC.success && jsonC.data) {
            categoriesData = jsonC.data;
            setAllCategories(jsonC.data);
          }
        }

        const q = searchQuery.toLowerCase().trim();

        const matchedGames = gamesData
          .filter((g: any) => g.name.toLowerCase().includes(q) || (g.slug && g.slug.toLowerCase().includes(q)))
          .map((g: any) => ({
            type: "game",
            id: g.id,
            name: g.name,
            slug: g.slug,
            image: g.image,
          }));

        const matchedCategories = categoriesData
          .filter((c: any) => c.name.toLowerCase().includes(q) || (c.slug && c.slug.toLowerCase().includes(q)))
          .map((c: any) => ({
            type: "category",
            id: c.id,
            name: c.name,
            slug: c.slug,
          }));

        setSearchResults([...matchedGames, ...matchedCategories]);
      } catch (e) {
        console.error("Global search error:", e);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, allGames, allCategories]);

  const handleSelectResult = (item: { type: string; id: string; name: string; slug: string }) => {
    setIsSearchOpen(false);
    setIsMobileSearchOpen(false);
    setSearchQuery("");
    if (item.type === "game") {
      navigate(`/games/${item.slug}`);
    } else if (item.type === "category") {
      navigate(`/?category=${item.id}#katalog`);
    }
  };

  const handleLogout = async () => {
    try {
      await supabaseSignOut();
    } catch (e) {
      console.error("Sign out error:", e);
    }
    sessionStorage.removeItem('istore_session');
    setUser(null, null);
    navigate("/login");
  };

  // Theme Resolution Hierarchy:
  // Priority: Customer Local Override -> Owner Store Config ("branding.themePreference") -> "light"
  const ownerPreference = (branding?.themePreference as CustomerThemePreference) || "light";
  const currentPreference: CustomerThemePreference = customerTheme || ownerPreference || "light";
  const isDark = currentPreference === "dark" || (currentPreference === "system" && systemPrefersDark);
  const effectiveTheme = isDark ? "dark" : "light";

  const primaryColor = branding?.primaryColor || '#ff4400';
  const secondaryColor = branding?.secondaryColor || '#0f172a';
  const hoverColor = branding?.hoverColor || '#e63d00';
  const accentColor = branding?.accentColor || '#f59e0b';
  
  const computedBg = isDark
    ? (branding?.backgroundColor && isHexDark(branding.backgroundColor) ? branding.backgroundColor : '#090d16')
    : (branding?.backgroundColor || '#f8fafc');

  const computedSurface = isDark
    ? (branding?.surfaceColor && isHexDark(branding.surfaceColor) ? branding.surfaceColor : '#0f172a')
    : (branding?.surfaceColor || '#ffffff');

  const computedText = isDark
    ? (branding?.textColor && !isHexDark(branding.textColor) ? branding.textColor : '#f8fafc')
    : (branding?.textColor || '#0f172a');

  const computedTextSecondary = isDark
    ? (branding?.textSecondaryColor && !isHexDark(branding.textSecondaryColor) ? branding.textSecondaryColor : '#94a3b8')
    : (branding?.textSecondaryColor || '#64748b');

  const computedBorder = branding?.borderColor || (isDark ? '#1e293b' : '#e2e8f0');

  const computedHeaderBg = isDark
    ? (branding?.headerBackgroundColor && isHexDark(branding.headerBackgroundColor) ? branding.headerBackgroundColor : '#0b0f19')
    : (branding?.headerBackgroundColor || '#ffffff');

  const computedHeaderText = isDark
    ? (branding?.headerTextColor && !isHexDark(branding.headerTextColor) ? branding.headerTextColor : '#f8fafc')
    : (branding?.headerTextColor || '#475569');

  const computedBrandText = isDark
    ? (branding?.brandTextColor && !isHexDark(branding.brandTextColor) ? branding.brandTextColor : primaryColor)
    : (branding?.brandTextColor || primaryColor || '#0f172a');

  const hasCustomFooterColor = branding?.footerBackgroundMode === "color" && Boolean(branding?.footerBackgroundColor);
  const hasCustomFooterImage = branding?.footerBackgroundMode === "image" && Boolean(branding?.footerBackgroundImage);
  const footerBackground = hasCustomFooterColor
    ? branding?.footerBackgroundColor
    : (hasCustomFooterImage ? "transparent" : computedSurface);
  const footerIsDark = hasCustomFooterColor && branding?.footerBackgroundColor
    ? isHexDark(branding.footerBackgroundColor)
    : isDark;
  const footerText = footerIsDark ? '#f8fafc' : computedText;
  const footerTextSecondary = footerIsDark ? '#cbd5e1' : computedTextSecondary;
  const footerTextMuted = footerIsDark ? '#94a3b8' : '#64748b';
  const footerHeading = footerIsDark ? '#ffffff' : computedText;
  const footerBorder = footerIsDark ? '#334155' : computedBorder;
  const footerHover = footerIsDark ? '#ffffff' : primaryColor;
  const footerSoftBackground = footerIsDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.06)';
  const footerSoftBorder = footerIsDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.08)';

  const hasCustomColor = branding?.homepageBackgroundMode === "color" && Boolean(branding?.homepageBackgroundColor);
  const hasCustomImage = branding?.homepageBackgroundMode === "image" && Boolean(branding?.homepageBackgroundImage);
  
  // When isDark is true, only allow custom background color if it is genuinely a dark color.
  // If owner configured a light color (like #f8fafc), fallback to computedBg (#090d16) so dark mode is not washed out.
  const effectiveCustomColor = isDark
    ? (hasCustomColor && branding?.homepageBackgroundColor && isHexDark(branding.homepageBackgroundColor)
        ? branding.homepageBackgroundColor
        : computedBg)
    : (hasCustomColor ? branding?.homepageBackgroundColor : computedBg);

  const hasCustomBg = hasCustomImage || (hasCustomColor && (!isDark || isHexDark(branding?.homepageBackgroundColor || "")));

  const customBackgroundStyle: React.CSSProperties = {};
  if (hasCustomImage) {
    customBackgroundStyle.backgroundImage = `url("${branding?.homepageBackgroundImage}")`;
    customBackgroundStyle.backgroundSize = "cover";
    customBackgroundStyle.backgroundPosition = "center";
    customBackgroundStyle.backgroundRepeat = "no-repeat";
  } else if (hasCustomBg && hasCustomColor) {
    customBackgroundStyle.backgroundColor = effectiveCustomColor;
  }

  const radiusTokens = resolveRadiusTokens(branding?.borderRadius);

  return (
    <div 
      className={`public-storefront min-h-screen flex flex-col ${!hasCustomBg ? (isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900") : ""} font-sans relative`}
      data-theme={effectiveTheme}
      data-borders={branding?.showGlobalBorders !== false ? "true" : "false"}
    >
      {/* Global Public Custom Background Layer */}
      {hasCustomBg && (
        <div 
          className="fixed inset-0 pointer-events-none z-0"
          style={customBackgroundStyle}
          aria-hidden="true"
        />
      )}

      {/* Dynamic Branding Style Injection */}
      {branding && (
        <style>{`
          .public-storefront {
            --primary-color: ${primaryColor};
            --secondary-color: ${secondaryColor};
            --brand-text-color: ${computedBrandText};
            --background-color: ${computedBg};
            --surface-color: ${computedSurface};
            --text-color: ${computedText};
            --text-secondary-color: ${computedTextSecondary};
            --border-color: ${computedBorder};
            --header-bg: ${computedHeaderBg};
            --header-text: ${computedHeaderText};
            --accent-color: ${accentColor};
            --hover-color: ${hoverColor};
            --footer-text: ${footerText};
            --footer-text-secondary: ${footerTextSecondary};
            --footer-text-muted: ${footerTextMuted};
            --footer-heading: ${footerHeading};
            --footer-border: ${footerBorder};
            --footer-hover: ${footerHover};
            --footer-soft-background: ${footerSoftBackground};
            --footer-soft-border: ${footerSoftBorder};
            --theme-border-radius-sm: ${radiusTokens.sm};
            --theme-border-radius-md: ${radiusTokens.md};
            --theme-border-radius-lg: ${radiusTokens.lg};
            --theme-border-radius-xl: ${radiusTokens.xl};
            --theme-border-radius-2xl: ${radiusTokens.xxl};
            --theme-border-radius-3xl: ${radiusTokens.xxxl};

            --theme-border-radius: ${radiusTokens.xl};
            --theme-border-radius-lg: ${radiusTokens.xxl};
            --theme-border-radius-xl: ${radiusTokens.xxxl};

            --radius-sm: ${radiusTokens.sm};
            --radius-md: ${radiusTokens.md};
            --radius-lg: ${radiusTokens.lg};
            --radius-xl: ${radiusTokens.xl};
            --radius-2xl: ${radiusTokens.xxl};
            --radius-3xl: ${radiusTokens.xxxl};
            background-color: ${hasCustomBg ? 'transparent' : 'var(--background-color)'};
            color: var(--text-color);
            color-scheme: ${effectiveTheme};
          }

          .public-storefront .istore-footer .footer-text { color: var(--footer-text) !important; }
          .public-storefront .istore-footer .footer-text-secondary { color: var(--footer-text-secondary) !important; }
          .public-storefront .istore-footer .footer-text-muted { color: var(--footer-text-muted) !important; }
          .public-storefront .istore-footer .footer-heading { color: var(--footer-heading) !important; }
          .public-storefront .istore-footer .footer-border { border-color: var(--footer-border) !important; }
          .public-storefront .istore-footer .footer-hover:hover { color: var(--footer-hover) !important; }
          .public-storefront .istore-footer .footer-soft-bg { background-color: var(--footer-soft-background) !important; }
          .public-storefront .istore-footer .footer-soft-border { border-color: var(--footer-soft-border) !important; }
          .public-storefront .istore-footer .footer-social-icon { color: #ffffff !important; }

          
          ${isDark ? `
            /* 1. Surfaces & Backgrounds (Slate & White variants) */
            .public-storefront[data-theme="dark"] .bg-white,
            .public-storefront[data-theme="dark"] .bg-white\\/95,
            .public-storefront[data-theme="dark"] .bg-white\\/90,
            .public-storefront[data-theme="dark"] .bg-white\\/85,
            .public-storefront[data-theme="dark"] .bg-white\\/80,
            .public-storefront[data-theme="dark"] .bg-white\\/70,
            .public-storefront[data-theme="dark"] .bg-white\\/60,
            .public-storefront[data-theme="dark"] .bg-white\\/50 {
              background-color: var(--surface-color) !important;
            }
            .public-storefront[data-theme="dark"] .bg-slate-50,
            .public-storefront[data-theme="dark"] .bg-slate-50\\/80,
            .public-storefront[data-theme="dark"] .bg-slate-50\\/70,
            .public-storefront[data-theme="dark"] .bg-slate-50\\/60,
            .public-storefront[data-theme="dark"] .bg-slate-50\\/50,
            .public-storefront[data-theme="dark"] .bg-slate-50\\/40,
            .public-storefront[data-theme="dark"] .bg-slate-50\\/30 {
              background-color: var(--background-color) !important;
            }
            .public-storefront[data-theme="dark"] .bg-slate-100,
            .public-storefront[data-theme="dark"] .bg-slate-100\\/80,
            .public-storefront[data-theme="dark"] .bg-slate-100\\/50 {
              background-color: #1e293b !important;
            }
            .public-storefront[data-theme="dark"] .bg-slate-200,
            .public-storefront[data-theme="dark"] .bg-slate-200\\/80,
            .public-storefront[data-theme="dark"] .bg-slate-200\\/50 {
              background-color: #334155 !important;
            }

            /* Hover states for Slate & White */
            .public-storefront[data-theme="dark"] .hover\\:bg-slate-50:hover,
            .public-storefront[data-theme="dark"] .hover\\:bg-slate-100:hover,
            .public-storefront[data-theme="dark"] .hover\\:bg-white:hover {
              background-color: #334155 !important;
            }
            .public-storefront[data-theme="dark"] .hover\\:bg-slate-200:hover {
              background-color: #475569 !important;
            }

            /* 2. Gray family (Membership, Modals, Badges) */
            .public-storefront[data-theme="dark"] .bg-gray-50,
            .public-storefront[data-theme="dark"] .bg-gray-50\\/50 {
              background-color: var(--background-color) !important;
            }
            .public-storefront[data-theme="dark"] .bg-gray-100,
            .public-storefront[data-theme="dark"] .bg-gray-100\\/80 {
              background-color: #1e293b !important;
            }
            .public-storefront[data-theme="dark"] .bg-gray-200 {
              background-color: #334155 !important;
            }
            .public-storefront[data-theme="dark"] .hover\\:bg-gray-50:hover,
            .public-storefront[data-theme="dark"] .hover\\:bg-gray-100:hover {
              background-color: #334155 !important;
            }
            .public-storefront[data-theme="dark"] .text-gray-950,
            .public-storefront[data-theme="dark"] .text-gray-900,
            .public-storefront[data-theme="dark"] .text-gray-800 {
              color: var(--text-color) !important;
            }
            .public-storefront[data-theme="dark"] .text-gray-700,
            .public-storefront[data-theme="dark"] .text-gray-600 {
              color: var(--text-secondary-color) !important;
            }
            .public-storefront[data-theme="dark"] .text-gray-500,
            .public-storefront[data-theme="dark"] .text-gray-400 {
              color: #94a3b8 !important;
            }
            .public-storefront[data-theme="dark"] .text-gray-300,
            .public-storefront[data-theme="dark"] .text-gray-200 {
              color: #64748b !important;
            }
            .public-storefront[data-theme="dark"] .border-gray-100,
            .public-storefront[data-theme="dark"] .border-gray-200,
            .public-storefront[data-theme="dark"] .border-gray-300 {
              border-color: var(--border-color) !important;
            }
            .public-storefront[data-theme="dark"] .divide-gray-100 > :not([hidden]) ~ :not([hidden]),
            .public-storefront[data-theme="dark"] .divide-gray-200 > :not([hidden]) ~ :not([hidden]) {
              border-color: var(--border-color) !important;
            }

            /* 3. Text colors (Slate) */
            .public-storefront[data-theme="dark"] .text-slate-950,
            .public-storefront[data-theme="dark"] .text-slate-900,
            .public-storefront[data-theme="dark"] .text-slate-800 {
              color: var(--text-color) !important;
            }
            .public-storefront[data-theme="dark"] .text-slate-700,
            .public-storefront[data-theme="dark"] .text-slate-600 {
              color: var(--text-secondary-color) !important;
            }
            .public-storefront[data-theme="dark"] .text-slate-500,
            .public-storefront[data-theme="dark"] .text-slate-400 {
              color: #94a3b8 !important;
            }
            .public-storefront[data-theme="dark"] .text-slate-300 {
              color: #cbd5e1 !important;
            }
            .public-storefront[data-theme="dark"] .hover\\:text-slate-900:hover {
              color: #ffffff !important;
            }
            .public-storefront[data-theme="dark"] .hover\\:text-slate-700:hover {
              color: #f1f5f9 !important;
            }

            /* 4. Borders & Dividers (Slate) */
            .public-storefront[data-theme="dark"] .border-slate-50,
            .public-storefront[data-theme="dark"] .border-slate-100,
            .public-storefront[data-theme="dark"] .border-slate-200,
            .public-storefront[data-theme="dark"] .border-slate-200\\/80,
            .public-storefront[data-theme="dark"] .border-slate-200\\/60,
            .public-storefront[data-theme="dark"] .border-slate-200\\/50,
            .public-storefront[data-theme="dark"] .border-slate-300 {
              border-color: var(--border-color) !important;
            }
            .public-storefront[data-theme="dark"] .divide-slate-50 > :not([hidden]) ~ :not([hidden]),
            .public-storefront[data-theme="dark"] .divide-slate-100 > :not([hidden]) ~ :not([hidden]),
            .public-storefront[data-theme="dark"] .divide-slate-200 > :not([hidden]) ~ :not([hidden]) {
              border-color: var(--border-color) !important;
            }

            /* 5. Status & Accent Pastel Backgrounds (maintain semantics with dark contrast) */
            /* Emerald / Green (Success / WhatsApp / Discounts) */
            .public-storefront[data-theme="dark"] .bg-emerald-50,
            .public-storefront[data-theme="dark"] .bg-emerald-100,
            .public-storefront[data-theme="dark"] .bg-emerald-50\\/80,
            .public-storefront[data-theme="dark"] .bg-emerald-50\\/50,
            .public-storefront[data-theme="dark"] .bg-green-50,
            .public-storefront[data-theme="dark"] .bg-green-100 {
              background-color: rgba(6, 78, 59, 0.45) !important;
            }
            .public-storefront[data-theme="dark"] .border-emerald-100,
            .public-storefront[data-theme="dark"] .border-emerald-200,
            .public-storefront[data-theme="dark"] .border-green-100,
            .public-storefront[data-theme="dark"] .border-green-200 {
              border-color: rgba(16, 185, 129, 0.35) !important;
            }
            .public-storefront[data-theme="dark"] .text-emerald-700,
            .public-storefront[data-theme="dark"] .text-emerald-800,
            .public-storefront[data-theme="dark"] .text-emerald-900,
            .public-storefront[data-theme="dark"] .text-green-700,
            .public-storefront[data-theme="dark"] .text-green-800 {
              color: #6ee7b7 !important;
            }

            /* Amber / Yellow (Warning / VIP / Points) */
            .public-storefront[data-theme="dark"] .bg-amber-50,
            .public-storefront[data-theme="dark"] .bg-amber-100,
            .public-storefront[data-theme="dark"] .bg-amber-50\\/80,
            .public-storefront[data-theme="dark"] .bg-amber-50\\/50,
            .public-storefront[data-theme="dark"] .bg-yellow-50,
            .public-storefront[data-theme="dark"] .bg-yellow-100 {
              background-color: rgba(120, 53, 15, 0.4) !important;
            }
            .public-storefront[data-theme="dark"] .border-amber-100,
            .public-storefront[data-theme="dark"] .border-amber-200,
            .public-storefront[data-theme="dark"] .border-amber-200\\/80 {
              border-color: rgba(245, 158, 11, 0.35) !important;
            }
            .public-storefront[data-theme="dark"] .text-amber-700,
            .public-storefront[data-theme="dark"] .text-amber-800,
            .public-storefront[data-theme="dark"] .text-amber-900 {
              color: #fcd34d !important;
            }

            /* Red (Error / Alerts / Danger) */
            .public-storefront[data-theme="dark"] .bg-red-50,
            .public-storefront[data-theme="dark"] .bg-red-100,
            .public-storefront[data-theme="dark"] .bg-red-50\\/80,
            .public-storefront[data-theme="dark"] .bg-red-50\\/50 {
              background-color: rgba(127, 29, 29, 0.4) !important;
            }
            .public-storefront[data-theme="dark"] .border-red-100,
            .public-storefront[data-theme="dark"] .border-red-200 {
              border-color: rgba(239, 68, 68, 0.35) !important;
            }
            .public-storefront[data-theme="dark"] .text-red-700,
            .public-storefront[data-theme="dark"] .text-red-800,
            .public-storefront[data-theme="dark"] .text-red-900 {
              color: #fca5a5 !important;
            }

            /* Blue (Info / Notices / Verification) */
            .public-storefront[data-theme="dark"] .bg-blue-50,
            .public-storefront[data-theme="dark"] .bg-blue-100,
            .public-storefront[data-theme="dark"] .bg-blue-50\\/80,
            .public-storefront[data-theme="dark"] .bg-blue-50\\/50 {
              background-color: rgba(30, 58, 138, 0.4) !important;
            }
            .public-storefront[data-theme="dark"] .border-blue-100,
            .public-storefront[data-theme="dark"] .border-blue-200 {
              border-color: rgba(59, 130, 246, 0.35) !important;
            }
            .public-storefront[data-theme="dark"] .text-blue-700,
            .public-storefront[data-theme="dark"] .text-blue-800,
            .public-storefront[data-theme="dark"] .text-blue-900 {
              color: #93c5fd !important;
            }

            /* Brand pastel tint */
            .public-storefront[data-theme="dark"] .bg-brand-50,
            .public-storefront[data-theme="dark"] .bg-brand-100,
            .public-storefront[data-theme="dark"] .bg-brand-50\\/80,
            .public-storefront[data-theme="dark"] .bg-brand-50\\/60,
            .public-storefront[data-theme="dark"] .bg-brand-50\\/30,
            .public-storefront[data-theme="dark"] .bg-primary\\/5,
            .public-storefront[data-theme="dark"] .bg-primary\\/10 {
              background-color: rgba(30, 41, 59, 0.8) !important;
            }
            .public-storefront[data-theme="dark"] .border-brand-100,
            .public-storefront[data-theme="dark"] .border-brand-200,
            .public-storefront[data-theme="dark"] .border-brand-200\\/50,
            .public-storefront[data-theme="dark"] .border-primary\\/10 {
              border-color: rgba(99, 102, 241, 0.3) !important;
            }
            .public-storefront[data-theme="dark"] .text-brand-700,
            .public-storefront[data-theme="dark"] .text-brand-800,
            .public-storefront[data-theme="dark"] .text-brand-900 {
              color: #a5b4fc !important;
            }
            .public-storefront[data-theme="dark"] .hover\\:bg-brand-50:hover,
            .public-storefront[data-theme="dark"] .hover\\:bg-brand-50\\/60:hover,
            .public-storefront[data-theme="dark"] .hover\\:bg-primary\\/10:hover {
              background-color: rgba(51, 65, 85, 0.7) !important;
            }

            /* 6. Flash Sale Gradients */
            .public-storefront[data-theme="dark"] .from-brand-50 {
              --tw-gradient-from: #1e1b4b !important;
              --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(30, 27, 75, 0)) !important;
            }
            .public-storefront[data-theme="dark"] .to-orange-50 {
              --tw-gradient-to: #291508 !important;
            }

            /* 7. Input, Select, Textarea */
            .public-storefront[data-theme="dark"] input:not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="range"]),
            .public-storefront[data-theme="dark"] select,
            .public-storefront[data-theme="dark"] textarea {
              background-color: #1e293b !important;
              color: #f8fafc !important;
              border-color: var(--border-color) !important;
            }
            .public-storefront[data-theme="dark"] input::placeholder,
            .public-storefront[data-theme="dark"] textarea::placeholder {
              color: #64748b !important;
            }

            /* 8. Shadows (eliminate light white glows in dark mode) */
            .public-storefront[data-theme="dark"] .shadow-slate-200\\/60,
            .public-storefront[data-theme="dark"] .shadow-slate-200,
            .public-storefront[data-theme="dark"] .shadow-brand-100,
            .public-storefront[data-theme="dark"] .shadow-brand-200,
            .public-storefront[data-theme="dark"] .shadow-brand-500\\/20,
            .public-storefront[data-theme="dark"] .shadow-brand-600\\/20 {
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5) !important;
            }
          ` : ''}

          /* Dynamic Button Corner Radius Control */
          .public-storefront .storefront-btn-primary,
          .public-storefront .storefront-btn-secondary {
            border-radius: var(--radius-xl) !important;
          }

          /* Semantically Controlled Button Style System */
          ${branding.buttonStyle === 'outline' ? `
            .public-storefront .storefront-btn-primary,
            .public-storefront button.bg-primary, 
            .public-storefront a.bg-primary {
              background-color: transparent !important;
              color: var(--primary-color) !important;
              border: 2px solid var(--primary-color) !important;
              box-shadow: none !important;
            }
            .public-storefront .storefront-btn-primary:hover,
            .public-storefront button.bg-primary:hover, 
            .public-storefront a.bg-primary:hover {
              background-color: color-mix(in srgb, var(--primary-color) 12%, transparent) !important;
              color: var(--primary-color) !important;
            }
            .public-storefront .storefront-btn-secondary {
              background-color: transparent !important;
              color: var(--text-color) !important;
              border: 2px solid var(--border-color) !important;
              box-shadow: none !important;
            }
            .public-storefront .storefront-btn-secondary:hover {
              background-color: color-mix(in srgb, var(--primary-color) 8%, transparent) !important;
              border-color: var(--primary-color) !important;
              color: var(--primary-color) !important;
            }
          ` : branding.buttonStyle === 'soft' ? `
            .public-storefront .storefront-btn-primary,
            .public-storefront button.bg-primary, 
            .public-storefront a.bg-primary {
              background-color: color-mix(in srgb, var(--primary-color) 14%, transparent) !important;
              color: var(--primary-color) !important;
              border: 1px solid color-mix(in srgb, var(--primary-color) 25%, transparent) !important;
              box-shadow: none !important;
            }
            .public-storefront .storefront-btn-primary:hover,
            .public-storefront button.bg-primary:hover, 
            .public-storefront a.bg-primary:hover {
              background-color: color-mix(in srgb, var(--primary-color) 24%, transparent) !important;
              color: var(--primary-color) !important;
            }
            .public-storefront .storefront-btn-secondary {
              background-color: color-mix(in srgb, var(--text-color) 8%, transparent) !important;
              color: var(--text-color) !important;
              border: 1px solid var(--border-color) !important;
              box-shadow: none !important;
            }
            .public-storefront .storefront-btn-secondary:hover {
              background-color: color-mix(in srgb, var(--text-color) 15%, transparent) !important;
            }
          ` : branding.buttonStyle === 'ghost' ? `
            .public-storefront .storefront-btn-primary,
            .public-storefront button.bg-primary, 
            .public-storefront a.bg-primary {
              background-color: transparent !important;
              color: var(--primary-color) !important;
              border: 1px solid transparent !important;
              box-shadow: none !important;
            }
            .public-storefront .storefront-btn-primary:hover,
            .public-storefront button.bg-primary:hover, 
            .public-storefront a.bg-primary:hover {
              background-color: color-mix(in srgb, var(--primary-color) 10%, transparent) !important;
              color: var(--primary-color) !important;
            }
            .public-storefront .storefront-btn-secondary {
              background-color: transparent !important;
              color: var(--text-secondary-color) !important;
              border: 1px solid transparent !important;
              box-shadow: none !important;
            }
            .public-storefront .storefront-btn-secondary:hover {
              background-color: color-mix(in srgb, var(--text-color) 8%, transparent) !important;
              color: var(--text-color) !important;
            }
          ` : `
            .public-storefront .storefront-btn-primary,
            .public-storefront button.bg-primary, 
            .public-storefront a.bg-primary {
              background-color: var(--primary-color) !important;
              color: #ffffff !important;
              border: 1px solid transparent !important;
            }
            .public-storefront .storefront-btn-primary:hover,
            .public-storefront button.bg-primary:hover, 
            .public-storefront a.bg-primary:hover {
              background-color: var(--hover-color) !important;
              color: #ffffff !important;
            }
          `}

          /* Global Border OFF Control (Robustly catching opacity variants & preserving functional borders) */
          .public-storefront[data-borders="false"] :where(
            .border,
            .border-t,
            .border-b,
            .border-l,
            .border-r,
            .border-x,
            .border-y,
            [class*="border-slate-"],
            [class*="border-gray-"],
            [class*="border-zinc-"],
            [class*="border-neutral-"],
            [class*="border-white/"],
            [class*="border-black/"],
            [class*="border-brand-"],
            [class*="divide-"]
          ):not(:focus):not(:focus-within):not(:focus-visible):not([aria-invalid="true"]):not([aria-checked="true"]):not([aria-selected="true"]):not(.border-red-500):not(.border-red-600):not(.border-rose-500):not(.border-emerald-500):not(.border-amber-500):not(.border-brand-500) {
            border-color: transparent !important;
          }
        `}</style>
      )}

      {/* Header */}
      {branding?.operationalStatus && branding.operationalStatus !== 'open' && (
        <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium sticky top-0 z-[60]">
          {branding.operationalStatus === 'maintenance' 
            ? (branding.maintenanceMessage?.trim() || "Sistem sedang dalam maintenance. Layanan akan kembali normal setelah proses selesai.")
            : (branding.closedMessage?.trim() || "Maaf, toko sedang tutup sementara. Silakan kembali beberapa saat lagi.")}
        </div>
      )}
      <header 
        className={`sticky top-0 z-50 border-b transition-all duration-300 ${
          branding?.headerScrollEffect && isScrolled ? "backdrop-blur-md shadow-md" : ""
        }`}
        style={{ 
          backgroundColor: branding?.headerScrollEffect && isScrolled 
            ? `color-mix(in srgb, ${computedHeaderBg} 75%, transparent)` 
            : computedHeaderBg,
          borderColor: computedBorder,
          color: 'var(--header-text)' 
        }}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16 items-center gap-2 lg:gap-4">
            {/* Logo */}
            <Link to="/" className={`flex items-center gap-2 shrink-0 group/logo transition-all duration-300 ${branding?.logoHoverEffect ? "hover:scale-[1.04] hover:brightness-110" : ""} active:scale-95`}>
              {branding?.logo ? (
                <div className={`flex items-center justify-center transition-all duration-300 ${
                  branding.logoStyle === 'circle' ? 'rounded-full aspect-square p-1.5 bg-black/5 border border-black/5' : 
                  branding.logoStyle === 'rounded-box' ? 'rounded-lg p-1.5 bg-black/5 border border-black/5' : ''
                } ${branding.logoHoverEffect ? "group-hover/logo:shadow-md group-hover/logo:bg-black/10" : ""}`}>
                  <img 
                    src={branding.logo} 
                    alt="Brand Logo" 
                    className="h-8 w-auto object-contain animate-fade-in" 
                    referrerPolicy="no-referrer" 
                  />
                </div>
              ) : branding?.name ? (
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-xl">
                  {branding.name.charAt(0).toUpperCase()}
                </div>
              ) : null}
              {(branding?.logoShowName || !branding?.logo) && branding?.name && (
                <span className="font-bold text-xl tracking-tight truncate max-w-[140px] sm:max-w-none" style={{ color: 'var(--header-text)' }}>
                  {branding.name}
                </span>
              )}
            </Link>

            {/* Desktop Global Search */}
            <div className="relative flex-1 max-w-xs lg:max-w-sm hidden md:block mx-2 lg:mx-4" ref={searchRef}>
              <div className="relative flex items-center">
                <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchQuery.trim()) setIsSearchOpen(true);
                  }}
                  placeholder="Cari game atau produk..."
                  aria-label="Cari game atau produk"
                  className="w-full pl-9 pr-8 py-1.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400"
                />
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 p-0.5"
                    aria-label="Bersihkan pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : isSearching ? (
                  <Loader2 className="w-3.5 h-3.5 absolute right-3 text-brand-600 animate-spin" />
                ) : null}
              </div>

              {/* Search Results Dropdown Panel */}
              {isSearchOpen && searchQuery.trim().length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {isSearching ? (
                    <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                      <span>Mencari katalog...</span>
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((item) => (
                      <button
                        key={`${item.type}-${item.id}`}
                        onClick={() => handleSelectResult(item)}
                        className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-brand-50/60 transition-colors cursor-pointer group"
                      >
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-9 h-9 rounded-lg object-cover shrink-0 group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                            <Gamepad2 className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 text-xs sm:text-sm truncate">{item.name}</p>
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded capitalize">
                            {item.type === 'game' ? 'Game' : 'Kategori'}
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500">
                      <p className="font-medium text-slate-700">Tidak ada hasil ditemukan.</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Coba kata kunci lain.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex space-x-6 xl:space-x-8 shrink-0 h-full items-center">
              {[
                { name: "Beranda", path: "/" },
                { name: "VIP", path: "/membership", icon: <Crown className="w-4 h-4 text-amber-500" /> },
                { name: "Blog", path: "/blog" },
                { name: "FAQ", path: "/faq" },
                { name: "Cek Transaksi", path: "/transactions" },
              ].map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link 
                    key={item.path}
                    to={item.path} 
                    className={`relative h-full font-medium transition-all duration-300 text-sm flex items-center gap-1 group/nav px-1`}
                    style={{ 
                      color: isActive ? 'var(--primary-color)' : 'var(--header-text)',
                    }}
                  >
                    {item.icon}
                    {item.name}
                    {branding?.navIndicator !== false && (
                      <span 
                        className={`absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-300 ${
                          isActive ? 'w-full' : 'w-0 group-hover/nav:w-full'
                        }`}
                        style={{ backgroundColor: 'var(--primary-color)' }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Desktop Auth & Theme Toggle */}
            <div className="hidden md:flex items-center space-x-2 shrink-0">
              <ThemeToggle 
                currentPreference={currentPreference}
                effectiveTheme={effectiveTheme}
                onSelectPreference={handleCustomerThemeChange}
                variant="header"
              />
              {!loading && user ? (
                <div className="flex items-center gap-2.5">
                  {(role === 'admin' || role === 'pemilik') && (
                    <Link to="/admin" className="text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 px-3 py-1.5 rounded-full transition-all">Panel Admin</Link>
                  )}
                  <NotificationBell />
                  <Link to="/transactions/history" className="hover:text-brand-600 p-2 hover:bg-slate-100/50 rounded-full transition-all" style={{ color: 'var(--header-text)' }} title="Riwayat Transaksi">
                    <Receipt className="w-5 h-5" />
                  </Link>
                  <Link to="/account" className="hover:text-brand-600 p-2 hover:bg-slate-100/50 rounded-full transition-all" style={{ color: 'var(--header-text)' }} title="Akun & Keamanan">
                    <User className="w-5 h-5" />
                  </Link>
                  <button onClick={handleLogout} className="hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition-all" style={{ color: 'var(--header-text)' }} title="Logout">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <>
                  <Link to="/login" className="hover:text-brand-600 font-medium text-sm transition-colors" style={{ color: 'var(--header-text)' }}>Login</Link>
                  <Link to="/register" className="storefront-btn-primary bg-brand-600 text-white px-4 py-1.5 rounded-full font-medium text-sm hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200">
                    Daftar
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Actions: Search Trigger & Menu Toggle */}
            <div className="md:hidden flex items-center gap-1">
              <button 
                onClick={() => {
                  setIsMobileSearchOpen(!isMobileSearchOpen);
                  if (isMobileMenuOpen) setIsMobileMenuOpen(false);
                }}
                aria-label="Cari game atau produk"
                className="p-2 hover:text-brand-600 rounded-lg hover:bg-slate-100/50 transition-all"
                style={{ color: 'var(--header-text)' }}
              >
                <Search className="w-5 h-5" />
              </button>
              <button 
                onClick={() => {
                  setIsMobileMenuOpen(!isMobileMenuOpen);
                  if (isMobileSearchOpen) setIsMobileSearchOpen(false);
                }}
                aria-label="Buka menu navigasi"
                className="hover:text-brand-600 focus:outline-none p-2 rounded-lg hover:bg-slate-100/50 transition-all"
                style={{ color: 'var(--header-text)' }}
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Search Bar Dropdown Overlay */}
        {isMobileSearchOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 p-3 shadow-lg absolute w-full z-50 animate-fade-in">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari game atau produk..."
                autoFocus
                aria-label="Cari game atau produk"
                className="w-full pl-9 pr-8 py-2 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50 text-sm text-slate-900"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 text-slate-400 hover:text-slate-600"
                  aria-label="Bersihkan pencarian"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search Results in Mobile Overlay */}
            {searchQuery.trim().length > 0 && (
              <div className="mt-2 bg-white rounded-xl border border-slate-200 shadow-sm max-h-72 overflow-y-auto divide-y divide-slate-100">
                {isSearching ? (
                  <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                    <span>Mencari katalog...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((item) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => handleSelectResult(item)}
                      className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-brand-50/50 transition-colors cursor-pointer"
                    >
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-9 h-9 rounded-lg object-cover shrink-0" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                          <Gamepad2 className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 text-xs sm:text-sm truncate">{item.name}</p>
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded capitalize">
                          {item.type === 'game' ? 'Game' : 'Kategori'}
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500">
                    <p className="font-medium text-slate-700">Tidak ada hasil ditemukan.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Coba kata kunci lain.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 px-4 pt-2 pb-4 space-y-1 shadow-lg absolute w-full">
            <Link to="/" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-brand-600 hover:bg-slate-50">Beranda</Link>
            <Link to="/membership" className="block px-3 py-2 rounded-md text-base font-medium text-amber-600 hover:bg-amber-50 flex items-center gap-2">
              <Crown className="w-4 h-4" />
              VIP Membership
            </Link>
            <Link to="/blog" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-brand-600 hover:bg-slate-50">Blog & Berita</Link>
            <Link to="/faq" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-brand-600 hover:bg-slate-50">FAQ</Link>
            <Link to="/transactions" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-brand-600 hover:bg-slate-50">Cek Transaksi</Link>
            
            {/* Mobile Customer Theme Preference */}
            <div className="pt-2 border-t border-slate-100">
              <ThemeToggle 
                currentPreference={currentPreference}
                effectiveTheme={effectiveTheme}
                onSelectPreference={handleCustomerThemeChange}
                variant="mobile"
              />
            </div>

            <div className="mt-3 pt-3 border-t border-slate-200">
              {!loading && user ? (
                <>
                  {(role === 'admin' || role === 'pemilik') && (
                    <Link to="/admin" className="block px-3 py-2 rounded-md text-base font-medium text-brand-600 hover:bg-brand-50">Panel Admin</Link>
                  )}
                  <Link to="/notifications" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-brand-600 hover:bg-slate-50">Notifikasi</Link>
                  <Link to="/transactions/history" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-brand-600 hover:bg-slate-50">Riwayat Transaksi</Link>
                  <Link to="/account" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-brand-600 hover:bg-slate-50">Akun & Keamanan</Link>
                  <button onClick={handleLogout} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50">Logout</button>
                </>
              ) : (
                <div className="flex flex-col gap-2 mt-2">
                  <Link to="/login" className="storefront-btn-secondary block text-center px-3 py-2 rounded-md text-base font-medium text-brand-600 bg-brand-50">Login</Link>
                  <Link to="/register" className="storefront-btn-primary block text-center px-3 py-2 rounded-md text-base font-medium text-white bg-brand-600">Daftar</Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow w-full relative z-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer 
        className="istore-footer footer-text-secondary py-8 sm:py-10 lg:py-12 mt-auto relative z-1 transition-all duration-300"
        style={{
          backgroundColor: footerBackground,
          backgroundImage: branding?.footerBackgroundMode === 'image' && branding?.footerBackgroundImage ? `url("${branding.footerBackgroundImage}")` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          ['--footer-text' as string]: footerText,
          ['--footer-text-secondary' as string]: footerTextSecondary,
          ['--footer-text-muted' as string]: footerTextMuted,
          ['--footer-heading' as string]: footerHeading,
          ['--footer-border' as string]: footerBorder,
          ['--footer-hover' as string]: footerHover,
          ['--footer-soft-background' as string]: footerSoftBackground,
          ['--footer-soft-border' as string]: footerSoftBorder
        }}
      >
        <div className="max-w-7xl mx-auto px-4">
          {/* 1. Logo & Brand Info */}
          <div className="pb-8 border-b footer-border">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="space-y-3 max-w-xl">
                {branding?.logo ? (
                  <div className={`flex items-center justify-center transition-all duration-300 w-fit ${
                    branding.logoStyle === 'circle' ? 'rounded-full aspect-square p-2 footer-soft-bg border footer-soft-border' : 
                    branding.logoStyle === 'rounded-box' ? 'rounded-lg p-2 footer-soft-bg border footer-soft-border' : ''
                  }`}>
                    <img 
                      src={branding.logo} 
                      alt="Brand Logo" 
                      className="h-10 w-auto object-contain" 
                      referrerPolicy="no-referrer" 
                    />
                  </div>
                ) : branding?.name ? (
                  <span className="font-bold text-2xl footer-heading tracking-tight block">{branding.name}</span>
                ) : null}
                <p className="text-xs sm:text-sm footer-text-secondary leading-relaxed">
                  {branding?.description || "Platform Top Up Game Terpercaya"}
                </p>

                {/* Official Contact Info */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs footer-text-secondary">
                  {branding?.contactInformation?.address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>{branding.contactInformation.address}</span>
                    </div>
                  )}
                  {branding?.contactInformation?.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <a href={`mailto:${branding.contactInformation.email}`} className="footer-hover transition-colors">
                        {branding.contactInformation.email}
                      </a>
                    </div>
                  )}
                  {branding?.contactInformation?.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                      <span>{branding.contactInformation.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Verified Social Media Links */}
              {branding?.socialMedia && Object.values(branding.socialMedia).some(url => typeof url === "string" && url.startsWith("https://")) && (
                <div className="shrink-0">
                  <div className="text-xs font-semibold footer-text mb-2">Ikuti Kami:</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {branding.socialMedia.instagram?.startsWith("https://") && (
                      <a
                        href={branding.socialMedia.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg bg-[#E1306C] hover:opacity-80 footer-social-icon flex items-center justify-center transition-all shadow-sm"
                        title="Instagram"
                      >
                        <Instagram className="w-4 h-4" />
                      </a>
                    )}
                    {branding.socialMedia.facebook?.startsWith("https://") && (
                      <a
                        href={branding.socialMedia.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg bg-[#1877F2] hover:opacity-80 footer-social-icon flex items-center justify-center transition-all shadow-sm"
                        title="Facebook"
                      >
                        <Facebook className="w-4 h-4" />
                      </a>
                    )}
                    {branding.socialMedia.tiktok?.startsWith("https://") && (
                      <a
                        href={branding.socialMedia.tiktok}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg bg-black hover:opacity-80 footer-social-icon flex items-center justify-center transition-all shadow-sm border border-white/10"
                        title="TikTok"
                      >
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.06-2.89-.35-4.2-.97-.06 3.42-.01 6.83-.02 10.25-.01 1.28-.19 2.62-.81 3.75-.55 1.05-1.45 1.93-2.51 2.45-1.07.56-2.32.8-3.53.84-1.29.03-2.6-.14-3.79-.67-1.16-.54-2.14-1.44-2.78-2.53-.61-1.04-.84-2.28-.84-3.48 0-1.27.27-2.58.96-3.66.64-1.04 1.63-1.88 2.76-2.38 1.14-.52 2.42-.69 3.66-.62v4.07c-.43-.07-.88-.06-1.31.02-.62.11-1.23.44-1.65.92-.45.54-.65 1.28-.61 1.98.02.66.24 1.33.68 1.83.47.53 1.16.83 1.85.86.74.03 1.54-.2 2.1-.71.6-.54.83-1.36.82-2.15-.02-4.14-.01-8.28-.02-12.41 1.67-.01 3.33-.01 5-.02V.02z"/>
                        </svg>
                      </a>
                    )}
                    {branding.socialMedia.youtube?.startsWith("https://") && (
                      <a
                        href={branding.socialMedia.youtube}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg bg-[#FF0000] hover:opacity-80 footer-social-icon flex items-center justify-center transition-all shadow-sm"
                        title="YouTube"
                      >
                        <Youtube className="w-4 h-4" />
                      </a>
                    )}
                    {branding.socialMedia.telegram?.startsWith("https://") && (
                      <a
                        href={branding.socialMedia.telegram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg bg-[#229ED9] hover:opacity-80 footer-social-icon flex items-center justify-center transition-all shadow-sm"
                        title="Telegram"
                      >
                        <Send className="w-4 h-4" />
                      </a>
                    )}
                    {branding.socialMedia.twitter?.startsWith("https://") && (
                      <a
                        href={branding.socialMedia.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg bg-black hover:opacity-80 footer-social-icon flex items-center justify-center transition-all shadow-sm border border-white/10"
                        title="Twitter / X"
                      >
                        <Twitter className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. Mengapa Memilih Toko Kami? - 3 Grid Horizontal */}
          <div className="py-8 border-b footer-border">
            <h3 className="text-xs font-bold uppercase tracking-wider footer-text-secondary mb-4">
              Mengapa Memilih Toko Kami?
            </h3>
            <div className="grid grid-cols-3 gap-3 sm:gap-6 lg:gap-8">
              <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3.5">
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500 shrink-0 mt-0.5 shadow-sm">
                  <Clock3 className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold footer-heading tracking-tight">Fulfillment Instan 24/7</h4>
                  <p className="text-[10px] sm:text-xs footer-text-secondary mt-0.5 sm:mt-1 leading-relaxed">
                    Pesanan diproses otomatis secara real-time.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3.5">
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0 mt-0.5 shadow-sm">
                  <ShieldCheck className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold footer-heading tracking-tight">Gerbang Pembayaran Aman</h4>
                  <p className="text-[10px] sm:text-xs footer-text-secondary mt-0.5 sm:mt-1 leading-relaxed">
                    Pembayaran diproses melalui payment gateway resmi.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3.5">
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 mt-0.5 shadow-sm">
                  <Receipt className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold footer-heading tracking-tight">Pelacakan Transaksi Terbuka</h4>
                  <p className="text-[10px] sm:text-xs footer-text-secondary mt-0.5 sm:mt-1 leading-relaxed">
                    Pantau status pesanan dalam satu halaman.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Navigation Links: Layanan | Bantuan | Legal */}
          <div className="pt-8 grid grid-cols-2 md:grid-cols-3 gap-8">
            <div>
              <h3 className="footer-heading font-semibold mb-4 text-sm">Layanan</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/" className="footer-hover transition-colors">Top Up Game</Link></li>
                <li><Link to="/blog" className="footer-hover transition-colors">Blog & Tips Gaming</Link></li>
                <li><Link to="/#cat-pulsa" className="footer-hover transition-colors">Pulsa & Data</Link></li>
                <li><Link to="/#cat-token-listrik" className="footer-hover transition-colors">Token PLN</Link></li>
                <li><Link to="/membership" className="footer-hover transition-colors">VIP Membership</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="footer-heading font-semibold mb-4 text-sm">Bantuan</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/transactions" className="footer-hover transition-colors">Cek Transaksi</Link></li>
                <li>
                  {branding?.contactInformation?.whatsapp ? (
                    <a
                      href={`https://wa.me/${branding.contactInformation.whatsapp.replace(/\D/g, "")}?text=Halo%20Admin${branding?.name ? `%20${encodeURIComponent(branding.name)}` : ""},%20saya%20butuh%20bantuan`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="footer-hover transition-colors flex items-center gap-1.5 text-emerald-500 font-semibold"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Hubungi Kami (WhatsApp)</span>
                    </a>
                  ) : branding?.contactInformation?.email ? (
                    <a
                      href={`mailto:${branding.contactInformation.email}`}
                      className="footer-hover transition-colors"
                    >
                      Hubungi Kami (Email)
                    </a>
                  ) : (
                    <Link to="/faq" className="footer-hover transition-colors">
                      Hubungi Kami
                    </Link>
                  )}
                </li>
                <li><Link to="/faq" className="footer-hover transition-colors">FAQ</Link></li>
                <li><Link to="/support" className="footer-hover transition-colors">Pusat Bantuan</Link></li>
              </ul>
            </div>

            <div className="col-span-2 md:col-span-1">
              <h3 className="footer-heading font-semibold mb-4 text-sm">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/terms" className="footer-hover transition-colors">Syarat & Ketentuan</Link></li>
                <li><Link to="/privacy" className="footer-hover transition-colors">Kebijakan Privasi</Link></li>
                <li><Link to="/refund" className="footer-hover transition-colors">Kebijakan Refund</Link></li>
              </ul>
            </div>
          </div>

          {/* 4. Metode Pembayaran */}
          <div className="mt-10 pt-8 border-t footer-border">
            <h3 className="footer-heading font-semibold mb-4 text-sm text-center md:text-left">Metode Pembayaran</h3>
            <PaymentMethodLogos />
          </div>

          {/* 5. Copyright */}
          <div className="mt-8 pt-8 border-t footer-border text-xs sm:text-sm text-center footer-text-muted">
            &copy; 2026. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
