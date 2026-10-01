import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../store/auth-store";
import { 
  Palette, 
  Save, 
  Loader2, 
  Info, 
  Eye, 
  RefreshCw, 
  Sparkles, 
  Image as ImageIcon, 
  Sliders, 
  Sun, 
  Moon, 
  Laptop,
  CheckCircle2,
  Trash2,
  FolderOpen,
  Search,
  Store,
  Layout,
  Layers,
  Compass,
  Monitor
} from "lucide-react";
import { StoreConfiguration } from "../../types/core";
import { invalidateStoreConfigCache } from "../../lib/utils";

interface MediaItem {
  id: string;
  originalName: string;
  fileName?: string;
  url: string;
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

const COLOR_PRESETS = [
  { 
    name: "iStore Default", 
    primary: "#ff4400", 
    secondary: "#0f172a", 
    brandText: "#0f172a", 
    accent: "#f59e0b",
    hover: "#e63d00",
    bg: "#f8fafc",
    surface: "#ffffff"
  },
  { 
    name: "Ocean Blue", 
    primary: "#3b82f6", 
    secondary: "#1d4ed8", 
    brandText: "#1e3a8a", 
    accent: "#f59e0b",
    hover: "#2563eb",
    bg: "#f8fafc",
    surface: "#ffffff"
  },
  { 
    name: "Emerald Green", 
    primary: "#10b981", 
    secondary: "#047857", 
    brandText: "#064e3b", 
    accent: "#f59e0b",
    hover: "#059669",
    bg: "#f0fdf4",
    surface: "#ffffff"
  },
  { 
    name: "Amber Gold", 
    primary: "#f59e0b", 
    secondary: "#b45309", 
    brandText: "#78350f", 
    accent: "#6366f1",
    hover: "#d97706",
    bg: "#fffbeb",
    surface: "#ffffff"
  },
  { 
    name: "Crimson Red", 
    primary: "#ef4444", 
    secondary: "#b91c1c", 
    brandText: "#7f1d1d", 
    accent: "#f59e0b",
    hover: "#dc2626",
    bg: "#fef2f2",
    surface: "#ffffff"
  },
  { 
    name: "Midnight Indigo", 
    primary: "#6366f1", 
    secondary: "#4338ca", 
    brandText: "#312e81", 
    accent: "#ec4899",
    hover: "#4f46e5",
    bg: "#f5f3ff",
    surface: "#ffffff"
  },
  { 
    name: "Deep Orchid", 
    primary: "#8b5cf6", 
    secondary: "#6d28d9", 
    brandText: "#4c1d95", 
    accent: "#f59e0b",
    hover: "#7c3aed",
    bg: "#faf5ff",
    surface: "#ffffff"
  },
  { 
    name: "Dark Slate", 
    primary: "#0f172a", 
    secondary: "#334155", 
    brandText: "#0f172a", 
    accent: "#38bdf8",
    hover: "#1e293b",
    bg: "#f1f5f9",
    surface: "#ffffff"
  },
  { 
    name: "Sunset Rose", 
    primary: "#ec4899", 
    secondary: "#be185d", 
    brandText: "#831843", 
    accent: "#f59e0b",
    hover: "#db2777",
    bg: "#fdf2f8",
    surface: "#ffffff"
  }
];

// Helper to determine if a hex color is dark
function isHexDark(hex: string): boolean {
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

export default function AdminBrandingPage() {
  const { user } = useAuthStore();
  const [config, setConfig] = useState<StoreConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Mobile View Switcher (Settings vs Live Preview)
  const [mobileView, setMobileView] = useState<"settings" | "preview">("settings");

  // Form Fields - Identitas Dasar
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [catalogMarqueeText, setCatalogMarqueeText] = useState("");
  const [showCatalogMarquee, setShowCatalogMarquee] = useState(true);

  // Aset Visual
  const [logo, setLogo] = useState("");
  const [favicon, setFavicon] = useState("");

  // 10 Skema Warna Custom
  const [primaryColor, setPrimaryColor] = useState("#ff4400");
  const [secondaryColor, setSecondaryColor] = useState("#0f172a");
  const [brandTextColor, setBrandTextColor] = useState("#0f172a");
  const [accentColor, setAccentColor] = useState("#f59e0b");
  const [backgroundColor, setBackgroundColor] = useState("#f8fafc");
  const [surfaceColor, setSurfaceColor] = useState("#ffffff");
  const [textColor, setTextColor] = useState("#0f172a");
  const [textSecondaryColor, setTextSecondaryColor] = useState("#64748b");
  const [borderColor, setBorderColor] = useState("#e2e8f0");
  const [hoverColor, setHoverColor] = useState("#e63d00");
  const [headerBackgroundColor, setHeaderBackgroundColor] = useState("#ffffff");
  const [headerTextColor, setHeaderTextColor] = useState("#475569");
  const [logoStyle, setLogoStyle] = useState<StoreConfiguration['logoStyle']>("natural");
  const [logoShowName, setLogoShowName] = useState(false);

  // Bentuk & Style
  const [borderRadius, setBorderRadius] = useState<StoreConfiguration['borderRadius']>("xl");
  const [buttonStyle, setButtonStyle] = useState<StoreConfiguration['buttonStyle']>("solid");
  const [themePreference, setThemePreference] = useState<StoreConfiguration['themePreference']>("light");
  const [showGlobalBorders, setShowGlobalBorders] = useState<boolean>(true);

  // Latar Belakang Khusus Homepage & Layer Transaksi
  const [homepageBackgroundColor, setHomepageBackgroundColor] = useState("");
  const [homepageBackgroundImage, setHomepageBackgroundImage] = useState("");
  const [homepageBackgroundMode, setHomepageBackgroundMode] = useState<"color" | "image">("color");
  
  // Latar Belakang Khusus Footer
  const [footerBackgroundColor, setFooterBackgroundColor] = useState("");
  const [footerBackgroundImage, setFooterBackgroundImage] = useState("");
  const [footerBackgroundMode, setFooterBackgroundMode] = useState<"color" | "image">("color");

  // Latar Belakang Khusus Auth (Login/Register)
  const [authBackgroundColor, setAuthBackgroundColor] = useState("");
  const [authBackgroundImage, setAuthBackgroundImage] = useState("");
  const [authBackgroundMode, setAuthBackgroundMode] = useState<"color" | "image">("color");
  
  // Transparansi Form Transaksi (Game Detail)
  const [transactionCardColor, setTransactionCardColor] = useState<string>("#ffffff");
  const [transactionCardOpacity, setTransactionCardOpacity] = useState<number>(85);
  const [transactionCardBlur, setTransactionCardBlur] = useState<"none" | "sm" | "md" | "lg">("md");

  // Perilaku Header & Navigasi
  const [headerScrollEffect, setHeaderScrollEffect] = useState<boolean>(true);
  const [logoHoverEffect, setLogoHoverEffect] = useState<boolean>(true);
  const [navIndicator, setNavIndicator] = useState<boolean>(true);

  // Tab Preview Kanan
  const [previewTab, setPreviewTab] = useState<"homepage" | "transaction">("homepage");

  // Media Library Picker Modal
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [activeMediaTarget, setActiveMediaTarget] = useState<"logo" | "favicon" | "homepageBg" | "footerBg" | "authBg" | null>(null);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaSearch, setMediaSearch] = useState("");

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/store-config", {
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success && data.data) {
        const cfg = data.data as StoreConfiguration;
        setConfig(cfg);
        setName(cfg.name || "");
        setTagline(cfg.basicInformation?.tagline || "");
        setDescription(cfg.description || "");
        setCatalogMarqueeText(cfg.catalogMarqueeText || "");
        setShowCatalogMarquee(cfg.showCatalogMarquee ?? true);
        setLogo(cfg.logo || "");
        setFavicon(cfg.favicon || "");
        setPrimaryColor(cfg.primaryColor || "#ff4400");
        setSecondaryColor(cfg.secondaryColor || "#0f172a");
        setBrandTextColor(cfg.brandTextColor || cfg.primaryColor || "#0f172a");
        setBackgroundColor(cfg.backgroundColor || "#f8fafc");
        setSurfaceColor(cfg.surfaceColor || "#ffffff");
        setTextColor(cfg.textColor || "#0f172a");
        setTextSecondaryColor(cfg.textSecondaryColor || "#64748b");
        setBorderColor(cfg.borderColor || "#e2e8f0");
        setAccentColor(cfg.accentColor || "#f59e0b");
        setHoverColor(cfg.hoverColor || "#e63d00");
        setHeaderBackgroundColor(cfg.headerBackgroundColor || "#ffffff");
        setHeaderTextColor(cfg.headerTextColor || "#475569");
        setLogoStyle(cfg.logoStyle || "natural");
        setLogoShowName(cfg.logoShowName || false);
        setLogoHoverEffect(cfg.logoHoverEffect ?? true);
        setHeaderScrollEffect(cfg.headerScrollEffect ?? true);
        setNavIndicator(cfg.navIndicator ?? true);
        setBorderRadius(cfg.borderRadius || "xl");
        setButtonStyle(cfg.buttonStyle || "solid");
        setThemePreference(cfg.themePreference || "light");
        setShowGlobalBorders(cfg.showGlobalBorders ?? true);
        setHomepageBackgroundColor(cfg.homepageBackgroundColor || "");
        setHomepageBackgroundImage(cfg.homepageBackgroundImage || "");
        setHomepageBackgroundMode(cfg.homepageBackgroundMode || "color");
        setFooterBackgroundColor(cfg.footerBackgroundColor || "");
        setFooterBackgroundImage(cfg.footerBackgroundImage || "");
        setFooterBackgroundMode(cfg.footerBackgroundMode || "color");
        setAuthBackgroundColor(cfg.authBackgroundColor || "");
        setAuthBackgroundImage(cfg.authBackgroundImage || "");
        setAuthBackgroundMode(cfg.authBackgroundMode || "color");
        setTransactionCardColor(cfg.transactionCardColor || "#ffffff");
        setTransactionCardOpacity(typeof cfg.transactionCardOpacity === "number" ? cfg.transactionCardOpacity : 85);
        setTransactionCardBlur(cfg.transactionCardBlur || "md");
      } else {
        setError(data.message || "Gagal memuat konfigurasi");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMediaList = async () => {
    try {
      setMediaLoading(true);
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/media?limit=100", {
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setMediaList(data.data);
      } else if (Array.isArray(data)) {
        setMediaList(data);
      }
    } catch (err) {
      console.error("Gagal memuat media library:", err);
    } finally {
      setMediaLoading(false);
    }
  };

  const openMediaPicker = (target: "logo" | "favicon" | "homepageBg" | "footerBg" | "authBg") => {
    setActiveMediaTarget(target);
    setIsMediaPickerOpen(true);
    fetchMediaList();
  };

  // Live system preference detection
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const sanitizeHex = (color: string, fallback: string): string => {
    if (!color) return fallback;
    const clean = color.startsWith("#") ? color : `#${color}`;
    const hex6Regex = /^#([0-9a-fA-F]{6})$/;
    if (hex6Regex.test(clean)) {
      return clean.toLowerCase();
    }
    return fallback;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const payload = {
      name: name.trim(),
      logo: logo.trim(),
      favicon: favicon.trim(),
      description: description.trim(),
      catalogMarqueeText: catalogMarqueeText.trim(),
      showCatalogMarquee,
      primaryColor: sanitizeHex(primaryColor, config.primaryColor || "#ff4400"),
      secondaryColor: sanitizeHex(secondaryColor, config.secondaryColor || "#0f172a"),
      brandTextColor: sanitizeHex(brandTextColor, config.brandTextColor || "#0f172a"),
      backgroundColor: sanitizeHex(backgroundColor, config.backgroundColor || "#f8fafc"),
      surfaceColor: sanitizeHex(surfaceColor, config.surfaceColor || "#ffffff"),
      textColor: sanitizeHex(textColor, config.textColor || "#0f172a"),
      textSecondaryColor: sanitizeHex(textSecondaryColor, config.textSecondaryColor || "#64748b"),
      borderColor: sanitizeHex(borderColor, config.borderColor || "#e2e8f0"),
      accentColor: sanitizeHex(accentColor, config.accentColor || "#f59e0b"),
      hoverColor: sanitizeHex(hoverColor, config.hoverColor || "#e63d00"),
      headerBackgroundColor: sanitizeHex(headerBackgroundColor, config.headerBackgroundColor || "#ffffff"),
      headerTextColor: sanitizeHex(headerTextColor, config.headerTextColor || "#475569"),
      logoStyle,
      logoShowName,
      homepageBackgroundColor: homepageBackgroundColor.trim() ? sanitizeHex(homepageBackgroundColor, "") : "",
      homepageBackgroundImage: homepageBackgroundImage.trim(),
      homepageBackgroundMode,
      footerBackgroundColor: footerBackgroundColor.trim() ? sanitizeHex(footerBackgroundColor, "") : "",
      footerBackgroundImage: footerBackgroundImage.trim(),
      footerBackgroundMode,
      authBackgroundColor: authBackgroundColor.trim() ? sanitizeHex(authBackgroundColor, "") : "",
      authBackgroundImage: authBackgroundImage.trim(),
      authBackgroundMode,
      headerScrollEffect,
      logoHoverEffect,
      navIndicator,
      transactionCardColor: sanitizeHex(transactionCardColor, config.transactionCardColor || "#ffffff"),
      transactionCardOpacity: Number(transactionCardOpacity) || 85,
      transactionCardBlur,
      borderRadius,
      buttonStyle,
      themePreference,
      showGlobalBorders,
      basicInformation: {
        ...config.basicInformation,
        tagline: tagline.trim()
      }
    };

    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/store-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        invalidateStoreConfigCache();
        window.dispatchEvent(new CustomEvent("store-config-updated"));
        setConfig(data.data);
        setSuccessMsg("Branding toko berhasil diperbarui!");
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(data.message || "Gagal menyimpan konfigurasi branding");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Helper display values for live preview
  const displayName = name.trim() || "Nama Toko Anda";
  const displayTagline = tagline.trim() || "Top up game terpercaya, cepat, dan otomatis 24 jam";
  const displayDesc = description.trim() || "Platform top up voucher & game resmi paling murah dan terpercaya di Indonesia.";

  // Dynamic Theme Evaluation for Live Preview
  const isPreviewDark = themePreference === "dark" || (themePreference === "system" && systemPrefersDark);

  const previewBg = isPreviewDark
    ? ((homepageBackgroundMode === "color" && homepageBackgroundColor && isHexDark(homepageBackgroundColor))
        ? homepageBackgroundColor
        : (isHexDark(backgroundColor) ? backgroundColor : "#090d16"))
    : ((homepageBackgroundMode === "color" && homepageBackgroundColor) ? homepageBackgroundColor : backgroundColor);

  const previewSurface = isPreviewDark
    ? (isHexDark(surfaceColor) ? surfaceColor : "#0f172a")
    : surfaceColor;

  const previewText = isPreviewDark
    ? (!isHexDark(textColor) ? textColor : "#f8fafc")
    : textColor;

  const previewTextSecondary = isPreviewDark
    ? (!isHexDark(textSecondaryColor) ? textSecondaryColor : "#94a3b8")
    : textSecondaryColor;

  const previewBorder = isPreviewDark
    ? (isHexDark(borderColor) ? borderColor : "#1e293b")
    : borderColor;

  const previewBrandText = isPreviewDark
    ? (!isHexDark(brandTextColor) ? brandTextColor : primaryColor)
    : brandTextColor;

  const previewHeaderBg = isPreviewDark
    ? (isHexDark(headerBackgroundColor) ? headerBackgroundColor : "#0b0f19")
    : headerBackgroundColor;

  const previewHeaderText = isPreviewDark
    ? (!isHexDark(headerTextColor) ? headerTextColor : "#f8fafc")
    : headerTextColor;

  const previewTransactionCardColor = isPreviewDark
    ? (isHexDark(transactionCardColor) ? transactionCardColor : "#0f172a")
    : transactionCardColor;

  // Dynamic Radius Resolver
  const getRadiusStyle = (element: 'container' | 'button' | 'badge' = 'container') => {
    switch (borderRadius) {
      case 'none': return '0px';
      case 'sm': return element === 'badge' ? '2px' : '4px';
      case 'md': return element === 'badge' ? '4px' : '8px';
      case 'lg': return element === 'badge' ? '6px' : '10px';
      case 'xl': return element === 'badge' ? '8px' : '14px';
      case '2xl': return element === 'badge' ? '10px' : '18px';
      case '3xl': return element === 'badge' ? '12px' : '22px';
      case 'full': return '9999px';
      default: return '12px';
    }
  };

  // Uniform Toggle Switch Component
  const ToggleSwitch = ({
    id,
    checked,
    onChange,
    disabled = false,
    label
  }: {
    id?: string;
    checked: boolean;
    onChange: (val: boolean) => void;
    disabled?: boolean;
    label?: string;
  }) => (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
        checked ? "bg-indigo-600" : "bg-slate-200"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      title={label}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );

  const ColorPickerField = ({ 
    id,
    label, 
    desc, 
    value, 
    onChange, 
    placeholder,
    onSyncWithPrimary 
  }: { 
    id: string;
    label: string; 
    desc: string; 
    value: string; 
    onChange: (v: string) => void; 
    placeholder: string;
    onSyncWithPrimary?: () => void;
  }) => {
    const currentColor = value.length === 7 ? value : placeholder;

    return (
      <div className="bg-slate-50/70 hover:bg-white border border-slate-200/90 rounded-xl p-3 flex flex-col justify-between gap-2.5 transition-all hover:border-slate-300 hover:shadow-2xs group">
        <div>
          <div className="flex items-center justify-between gap-1 mb-1">
            <label htmlFor={id} className="text-[11px] font-bold text-slate-800 tracking-wide uppercase truncate" title={label}>
              {label}
            </label>
            {onSyncWithPrimary && (
              <button 
                type="button" 
                onClick={onSyncWithPrimary}
                className="text-[9px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer shrink-0"
                title="Samakan dengan warna Primary"
              >
                Sync
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-500 leading-tight line-clamp-2 min-h-[24px]">{desc}</p>
        </div>

        <label 
          htmlFor={id} 
          className="relative h-11 w-full rounded-lg border border-slate-200/80 shadow-inner flex items-center justify-center cursor-pointer transition-all active:scale-[0.99] overflow-hidden group/swatch"
          style={{ backgroundColor: currentColor }}
          title={`Pilih warna untuk ${label}`}
        >
          <div className="absolute inset-0 bg-black/0 group-hover/swatch:bg-black/10 transition-colors" />
          
          <input
            id={id}
            type="color"
            value={currentColor}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />

          <span 
            className="px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider shadow-xs backdrop-blur-xs transition-opacity opacity-0 group-hover/swatch:opacity-100 bg-white/95 text-slate-900"
          >
            PILIH
          </span>
        </label>

        <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
          <div 
            className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-2xs shrink-0"
            style={{ backgroundColor: currentColor }}
          />
          <div className="flex-1 min-w-0">
            <input
              type="text"
              maxLength={7}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="w-full px-2 py-1 text-xs font-mono font-bold text-slate-800 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase tracking-wider"
            />
          </div>
        </div>
      </div>
    );
  };

  const filteredMediaList = mediaList.filter(m => 
    (m.originalName || m.fileName || (m as any).name || "").toLowerCase().includes((mediaSearch || "").trim().toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] gap-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-medium text-slate-600">Memuat preferensi branding toko...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs shrink-0">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <h1 className="ui-page-title text-slate-900">
              Pengaturan Branding & Tema Toko
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola identitas visual, palet warna, logo, dan style tampilan toko publik Anda.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={fetchConfig}
            title="Muat ulang konfigurasi"
            className="p-2.5 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Simpan Perubahan
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 text-xs font-medium rounded-xl border border-red-200 flex items-start gap-2.5">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-xl border border-emerald-200 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Mobile View Switcher (Pengaturan vs Pratinjau) */}
      <div className="lg:hidden flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
        <button
          type="button"
          onClick={() => setMobileView("settings")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
            mobileView === "settings"
              ? "bg-white text-indigo-700 shadow-xs border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Pengaturan</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileView("preview")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
            mobileView === "preview"
              ? "bg-white text-indigo-700 shadow-xs border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Pratinjau Langsung</span>
        </button>
      </div>

      {/* Main 2-Column Responsive Layout: Form (Left) & Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: 6 Consolidated Sections (7 cols on desktop) */}
        <div className={`lg:col-span-7 space-y-6 ${mobileView === "settings" ? "block" : "hidden lg:block"}`}>
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* KELOMPOK 1: IDENTITAS & BRANDING TOKO */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Identitas & Branding Toko</h2>
                  <p className="text-[11px] text-slate-500">Nama resmi, slogan, aset logo, favicon, dan teks pengumuman katalog toko.</p>
                </div>
              </div>

              {/* Subsection 1.1: Identitas Toko */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Identitas Toko</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="store-name" className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Toko
                    </label>
                    <input
                      id="store-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Contoh: TokoGame ID"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-slate-50/50"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Tampil di header navbar dan tab browser.</p>
                  </div>

                  <div>
                    <label htmlFor="store-tagline" className="block text-xs font-bold text-slate-700 mb-1">
                      Tagline Toko
                    </label>
                    <input
                      id="store-tagline"
                      type="text"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder="Contoh: Top Up Game Cepat & Terpercaya"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-slate-50/50"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Slogan singkat di bawah nama toko / hero.</p>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="store-desc" className="block text-xs font-bold text-slate-700 mb-1">
                      Deskripsi Toko
                    </label>
                    <textarea
                      id="store-desc"
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Tuliskan deskripsi lengkap tentang layanan toko Anda..."
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-slate-50/50"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Digunakan untuk SEO metadata dan deskripsi footer.</p>
                  </div>
                </div>
              </div>

              {/* Subsection 1.2: Aset Visual & Logo */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Aset Visual & Logo</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Logo Toko */}
                  <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/40 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                          Logo Toko (Navbar)
                        </label>
                        {logo && (
                          <button
                            type="button"
                            onClick={() => setLogo("")}
                            className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" /> Hapus
                          </button>
                        )}
                      </div>

                      <div className="h-20 w-full rounded-lg border border-dashed border-slate-300 bg-white flex items-center justify-center p-2 overflow-hidden relative">
                        {logo ? (
                          <div className={`flex items-center justify-center transition-all duration-300 ${
                            logoStyle === 'circle' ? 'rounded-full aspect-square p-2 bg-slate-50 border border-slate-100' : 
                            logoStyle === 'rounded-box' ? 'rounded-xl p-2 bg-slate-50 border border-slate-100' : ''
                          }`}>
                            <img 
                              src={logo} 
                              alt="Logo Toko" 
                              className="max-h-16 max-w-full object-contain" 
                              referrerPolicy="no-referrer" 
                            />
                          </div>
                        ) : (
                          <div className="text-center text-slate-400">
                            <ImageIcon className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                            <span className="text-[10px]">Belum ada logo dipilih</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => openMediaPicker("logo")}
                        className="w-full py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Pilih dari Media Library
                      </button>
                      <p className="text-[10px] text-slate-500 mt-1.5 leading-tight">Recommended: 1200 × 400 px · Rasio 3:1 · PNG transparan · Tanpa padding vertikal berlebih</p>
                    </div>
                  </div>

                  {/* Favicon Toko */}
                  <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/40 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Laptop className="w-3.5 h-3.5 text-slate-500" />
                          Favicon (Tab Browser)
                        </label>
                        {favicon && (
                          <button
                            type="button"
                            onClick={() => setFavicon("")}
                            className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" /> Hapus
                          </button>
                        )}
                      </div>

                      <div className="h-20 w-full rounded-lg border border-dashed border-slate-300 bg-white flex items-center justify-center p-2 overflow-hidden">
                        {favicon ? (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-100 border border-slate-200">
                            <img 
                              src={favicon} 
                              alt="Favicon" 
                              className="w-6 h-6 object-contain" 
                              referrerPolicy="no-referrer" 
                            />
                            <span className="text-[11px] font-medium text-slate-600 max-w-[100px] truncate">{displayName}</span>
                          </div>
                        ) : (
                          <div className="text-center text-slate-400">
                            <Laptop className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                            <span className="text-[10px]">Rekomendasi ikon 64x64px</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => openMediaPicker("favicon")}
                        className="w-full py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Pilih dari Media Library
                      </button>
                      <p className="text-[10px] text-slate-500 mt-1.5 leading-tight">Recommended: 512 × 512 px · Rasio 1:1 · PNG / ICO</p>
                    </div>
                  </div>

                  {/* Gaya Bentuk Logo & Perilaku Visual Logo */}
                  <div className="sm:col-span-2 space-y-3 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                          Gaya Bentuk Logo
                        </label>
                        <div className="flex gap-1.5">
                          {(['natural', 'circle', 'rounded-box'] as const).map((style) => (
                            <button
                              key={style}
                              type="button"
                              onClick={() => setLogoStyle(style)}
                              className={`flex-1 py-1.5 px-1 rounded-xl border text-[10px] font-bold transition capitalize cursor-pointer ${
                                logoStyle === style
                                  ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {style === 'rounded-box' ? 'Box' : style}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-200/60">
                        <div>
                          <h4 className="text-[11px] font-bold text-slate-900">Nama Brand</h4>
                          <p className="text-[9px] text-slate-500">Tampilkan teks di samping logo.</p>
                        </div>
                        <ToggleSwitch
                          checked={logoShowName}
                          onChange={setLogoShowName}
                          label="Tampilkan nama brand"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-200/60">
                        <div>
                          <h4 className="text-[11px] font-bold text-slate-900">Efek Hover Logo</h4>
                          <p className="text-[9px] text-slate-500">Animasi zoom halus saat hover.</p>
                        </div>
                        <ToggleSwitch
                          checked={logoHoverEffect}
                          onChange={setLogoHoverEffect}
                          label="Efek hover logo"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subsection 1.3: Pengumuman Katalog (Marquee) */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Pengumuman Katalog (Teks Berjalan)</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Teks berjalan dinamis di bagian atas grid katalog Beranda.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-600 hidden sm:inline">Aktifkan Marquee</span>
                    <ToggleSwitch
                      checked={showCatalogMarquee}
                      onChange={setShowCatalogMarquee}
                      label="Aktifkan teks berjalan"
                    />
                  </div>
                </div>

                <input
                  type="text"
                  value={catalogMarqueeText}
                  onChange={(e) => setCatalogMarqueeText(e.target.value)}
                  placeholder="Pilih game favorit atau layanan digital Anda untuk memulai proses top up otomatis."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-slate-50/50"
                />
              </div>
            </div>

            {/* KELOMPOK 2: HEADER & NAVIGASI */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
                  <Layout className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Header & Navigasi</h2>
                  <p className="text-[11px] text-slate-500">Kustomisasi skema warna bar navigasi atas serta perilaku interaksi saat pengunjung berselancar.</p>
                </div>
              </div>

              {/* Tampilan Header */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Tampilan Warna Header</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ColorPickerField 
                    id="header-bg-color"
                    label="Background Header"
                    desc="Warna latar belakang bar navigasi utama."
                    value={headerBackgroundColor}
                    onChange={setHeaderBackgroundColor}
                    placeholder="#ffffff"
                  />
                  <ColorPickerField 
                    id="header-text-color"
                    label="Warna Teks & Ikon"
                    desc="Warna untuk menu navigasi dan ikon di header."
                    value={headerTextColor}
                    onChange={setHeaderTextColor}
                    placeholder="#475569"
                  />
                </div>
              </div>

              {/* Perilaku Header & Navigasi */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Perilaku Header & Navigasi</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-200/60">
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-900">Header saat Scroll</h4>
                      <p className="text-[9px] text-slate-500">Efek kaca buram (blur) dan bayangan saat halaman digulir.</p>
                    </div>
                    <ToggleSwitch
                      checked={headerScrollEffect}
                      onChange={setHeaderScrollEffect}
                      label="Header saat scroll"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-200/60">
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-900">Indikator Navigasi Aktif</h4>
                      <p className="text-[9px] text-slate-500">Garis bawah aksen pada menu navigasi yang sedang aktif.</p>
                    </div>
                    <ToggleSwitch
                      checked={navIndicator}
                      onChange={setNavIndicator}
                      label="Indikator navigasi"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* KELOMPOK 3: LATAR BELAKANG STOREFRONT */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Latar Belakang Storefront</h2>
                  <p className="text-[11px] text-slate-500">Konfigurasi kanvas visual toko untuk wallpaper utama beranda (Layer 1), halaman autentikasi, dan area footer.</p>
                </div>
              </div>

              {/* Subsection 3.1: Latar Belakang Utama Beranda (Layer 1) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Latar Belakang Utama Beranda</h3>
                    <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 uppercase tracking-wide">
                      Layer 1 Global
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">Mengontrol kanvas visual paling dasar (wallpaper/warna) di seluruh halaman toko publik.</p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setHomepageBackgroundMode("color")}
                    className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      homepageBackgroundMode === "color"
                        ? "border-sky-600 bg-sky-50 text-sky-700 shadow-xs"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>Warna</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHomepageBackgroundMode("image")}
                    className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      homepageBackgroundMode === "image"
                        ? "border-sky-600 bg-sky-50 text-sky-700 shadow-xs"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Wallpaper (Gambar)</span>
                  </button>
                </div>

                {homepageBackgroundMode === "color" ? (
                  <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">Warna Latar Beranda</span>
                      {homepageBackgroundColor && (
                        <button
                          type="button"
                          onClick={() => setHomepageBackgroundColor("")}
                          className="text-[10px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Reset
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-slate-300 shrink-0">
                        <input
                          type="color"
                          value={homepageBackgroundColor || "#ffffff"}
                          onChange={(e) => setHomepageBackgroundColor(e.target.value)}
                          className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
                        />
                      </div>
                      <input
                        type="text"
                        value={homepageBackgroundColor}
                        onChange={(e) => setHomepageBackgroundColor(e.target.value)}
                        placeholder="#FFFFFF (Default)"
                        className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 uppercase font-mono font-bold bg-white"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-3">
                    <div className="h-28 w-full rounded-lg border border-dashed border-slate-300 bg-white overflow-hidden relative flex items-center justify-center">
                      {homepageBackgroundImage ? (
                        <img
                          src={homepageBackgroundImage}
                          alt="Wallpaper Preview"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="text-center text-slate-400 p-2">
                          <ImageIcon className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                          <span className="text-[11px] font-medium">Belum ada wallpaper Beranda dipilih</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => openMediaPicker("homepageBg")}
                        className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs shrink-0"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Pilih dari Media Library
                      </button>
                      <input
                        type="text"
                        placeholder="Atau tempel URL gambar wallpaper (https://...)"
                        value={homepageBackgroundImage}
                        onChange={(e) => {
                          setHomepageBackgroundImage(e.target.value);
                          if (e.target.value.trim()) setHomepageBackgroundMode("image");
                        }}
                        className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white"
                      />
                      {homepageBackgroundImage && (
                        <button
                          type="button"
                          onClick={() => setHomepageBackgroundImage("")}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold shrink-0"
                          title="Hapus wallpaper"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Recommended: 1920 × 1080 px · Rasio 16:9 · JPG atau WebP</p>
                  </div>
                )}
              </div>

              {/* Subsection 3.2: Latar Belakang Khusus Auth */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Latar Belakang Halaman Login & Daftar</h3>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAuthBackgroundMode("color")}
                      className={`py-1 px-2.5 rounded-lg border text-[10px] font-bold transition ${
                        authBackgroundMode === "color"
                          ? "border-orange-600 bg-orange-50 text-orange-700"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      Warna
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthBackgroundMode("image")}
                      className={`py-1 px-2.5 rounded-lg border text-[10px] font-bold transition ${
                        authBackgroundMode === "image"
                          ? "border-orange-600 bg-orange-50 text-orange-700"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      Wallpaper
                    </button>
                  </div>
                </div>

                {authBackgroundMode === "color" ? (
                  <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200/80 flex items-center gap-3">
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-300 shrink-0">
                      <input
                        type="color"
                        value={authBackgroundColor || "#f8fafc"}
                        onChange={(e) => setAuthBackgroundColor(e.target.value)}
                        className="absolute -top-2 -left-2 w-14 h-14 cursor-pointer"
                      />
                    </div>
                    <input
                      type="text"
                      value={authBackgroundColor}
                      onChange={(e) => setAuthBackgroundColor(e.target.value)}
                      placeholder="#F8FAFC (Default)"
                      className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 uppercase font-mono font-bold bg-white"
                    />
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => openMediaPicker("authBg")}
                        className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shrink-0"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Pilih Wallpaper Auth
                      </button>
                      <input
                        type="text"
                        placeholder="Atau tempel URL gambar (https://...)"
                        value={authBackgroundImage}
                        onChange={(e) => {
                          setAuthBackgroundImage(e.target.value);
                          if (e.target.value.trim()) setAuthBackgroundMode("image");
                        }}
                        className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Recommended: 1920 × 1080 px · Rasio 16:9 · JPG atau WebP</p>
                  </div>
                )}
              </div>

              {/* Subsection 3.3: Latar Belakang Khusus Footer */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Latar Belakang Khusus Footer</h3>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFooterBackgroundMode("color")}
                      className={`py-1 px-2.5 rounded-lg border text-[10px] font-bold transition ${
                        footerBackgroundMode === "color"
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      Warna
                    </button>
                    <button
                      type="button"
                      onClick={() => setFooterBackgroundMode("image")}
                      className={`py-1 px-2.5 rounded-lg border text-[10px] font-bold transition ${
                        footerBackgroundMode === "image"
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      Wallpaper
                    </button>
                  </div>
                </div>

                {footerBackgroundMode === "color" ? (
                  <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200/80 flex items-center gap-3">
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-300 shrink-0">
                      <input
                        type="color"
                        value={footerBackgroundColor || "#0f172a"}
                        onChange={(e) => setFooterBackgroundColor(e.target.value)}
                        className="absolute -top-2 -left-2 w-14 h-14 cursor-pointer"
                      />
                    </div>
                    <input
                      type="text"
                      value={footerBackgroundColor}
                      onChange={(e) => setFooterBackgroundColor(e.target.value)}
                      placeholder="#0F172A (Default)"
                      className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 uppercase font-mono font-bold bg-white"
                    />
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => openMediaPicker("footerBg")}
                        className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shrink-0"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Pilih Wallpaper Footer
                      </button>
                      <input
                        type="text"
                        placeholder="Atau tempel URL gambar (https://...)"
                        value={footerBackgroundImage}
                        onChange={(e) => {
                          setFooterBackgroundImage(e.target.value);
                          if (e.target.value.trim()) setFooterBackgroundMode("image");
                        }}
                        className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Recommended: 1920 × 600 px · Rasio 3:1 · JPG atau WebP</p>
                  </div>
                )}
              </div>
            </div>

            {/* KELOMPOK 4: DESAIN SISTEM & PALET WARNA */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Desain Sistem & Palet Warna</h2>
                  <p className="text-[11px] text-slate-500">Preferensi tema, preset skema warna siap pakai, dan 10 token palet warna desain sistem.</p>
                </div>
              </div>

              {/* Subsection 4.1: Preferensi Tema */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Preferensi Tema Toko</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'light', label: 'Terang (Light)', desc: 'Tampilan bersih bernuansa terang', icon: Sun },
                    { id: 'dark', label: 'Gelap (Dark)', desc: 'Tampilan elegan bernuansa gelap', icon: Moon },
                    { id: 'system', label: 'Ikuti Sistem (System)', desc: 'Otomatis mengikuti preferensi perangkat', icon: Laptop }
                  ].map((theme) => {
                    const Icon = theme.icon;
                    const isSelected = themePreference === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setThemePreference(theme.id as any)}
                        className={`p-3 rounded-xl border text-left transition flex items-start gap-3 cursor-pointer ${
                          isSelected 
                            ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-2xs" 
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white"
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">{theme.label}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{theme.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subsection 4.2: Preset Skema Warna Siap Pakai */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Preset Skema Warna Siap Pakai</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Pilih kombinasi warna harmonis yang dirancang secara proporsional.</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {COLOR_PRESETS.map((p) => {
                    const isSelected =
                      primaryColor.toLowerCase() === p.primary.toLowerCase() &&
                      secondaryColor.toLowerCase() === p.secondary.toLowerCase() &&
                      brandTextColor.toLowerCase() === p.brandText.toLowerCase();

                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => {
                          setPrimaryColor(p.primary);
                          setSecondaryColor(p.secondary);
                          setBrandTextColor(p.brandText);
                          setAccentColor(p.accent);
                          setHoverColor(p.hover);
                          setBackgroundColor(p.bg);
                          setSurfaceColor(p.surface);

                          if (p.name === "iStore Default") {
                            setTextColor("#0f172a");
                            setTextSecondaryColor("#64748b");
                            setBorderColor("#e2e8f0");
                            setHeaderBackgroundColor("#ffffff");
                            setHeaderTextColor("#475569");
                          }
                        }}
                        className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between gap-2.5 cursor-pointer ${
                          isSelected 
                            ? "border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-xs" 
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold text-slate-800 truncate">{p.name}</span>
                          {isSelected && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          )}
                        </div>

                        {/* Swatches Bar */}
                        <div className="flex h-3.5 w-full rounded-md overflow-hidden border border-slate-200/80 shadow-2xs">
                          <div className="flex-1" style={{ backgroundColor: p.primary }} title={`Primary: ${p.primary}`} />
                          <div className="flex-1" style={{ backgroundColor: p.secondary }} title={`Secondary: ${p.secondary}`} />
                          <div className="flex-1" style={{ backgroundColor: p.brandText }} title={`Brand: ${p.brandText}`} />
                          <div className="w-2.5" style={{ backgroundColor: p.accent }} title={`Accent: ${p.accent}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subsection 4.3: Kustomisasi Palet Warna (10 Token) */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Kustomisasi Palet Warna (10 Token Desain)</h3>
                  <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl text-[11px] text-indigo-900 mt-2 space-y-1">
                    <p><span className="font-bold">Background Utama:</span> Token canvas dasar fallback saat wallpaper tidak aktif.</p>
                    <p><span className="font-bold">Surface / Card:</span> Token Layer 2 standar untuk kartu produk katalog, form, modal, dan invoice.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                  <ColorPickerField 
                    id="color-primary"
                    label="1. Primary" 
                    desc="Warna utama tombol & badge." 
                    value={primaryColor} 
                    onChange={setPrimaryColor} 
                    placeholder="#3B82F6" 
                  />
                  
                  <ColorPickerField 
                    id="color-secondary"
                    label="2. Secondary" 
                    desc="Warna pendukung & gradien." 
                    value={secondaryColor} 
                    onChange={setSecondaryColor} 
                    placeholder="#1D4ED8" 
                  />

                  <ColorPickerField 
                    id="color-brand-text"
                    label="3. Teks Brand" 
                    desc="Warna teks judul toko." 
                    value={brandTextColor} 
                    onChange={setBrandTextColor} 
                    placeholder="#1E3A8A"
                    onSyncWithPrimary={() => setBrandTextColor(primaryColor)}
                  />

                  <ColorPickerField 
                    id="color-accent"
                    label="4. Aksen" 
                    desc="Badge promo & diskon." 
                    value={accentColor} 
                    onChange={setAccentColor} 
                    placeholder="#F59E0B" 
                  />

                  <ColorPickerField 
                    id="color-bg"
                    label="5. Background" 
                    desc="Canvas fallback dasar." 
                    value={backgroundColor} 
                    onChange={setBackgroundColor} 
                    placeholder="#FFFFFF" 
                  />

                  <ColorPickerField 
                    id="color-surface"
                    label="6. Surface (L2)" 
                    desc="Kartu produk & modal." 
                    value={surfaceColor} 
                    onChange={setSurfaceColor} 
                    placeholder="#FFFFFF" 
                  />

                  <ColorPickerField 
                    id="color-text-main"
                    label="7. Teks Utama" 
                    desc="Warna judul & heading." 
                    value={textColor} 
                    onChange={setTextColor} 
                    placeholder="#0F172A" 
                  />

                  <ColorPickerField 
                    id="color-text-sec"
                    label="8. Teks Sekunder" 
                    desc="Subtitle & deskripsi." 
                    value={textSecondaryColor} 
                    onChange={setTextSecondaryColor} 
                    placeholder="#64748B" 
                  />

                  <ColorPickerField 
                    id="color-border"
                    label="9. Border" 
                    desc="Garis pemisah card." 
                    value={borderColor} 
                    onChange={setBorderColor} 
                    placeholder="#E2E8F0" 
                  />

                  <ColorPickerField 
                    id="color-hover"
                    label="10. Hover" 
                    desc="Warna kursor di tombol." 
                    value={hoverColor} 
                    onChange={setHoverColor} 
                    placeholder="#2563EB" 
                  />
                </div>
              </div>
            </div>

            {/* KELOMPOK 5: GAYA KOMPONEN & FORM TRANSAKSI */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Gaya Komponen & Form Transaksi</h2>
                  <p className="text-[11px] text-slate-500">Bentuk sudut kartu dan tombol, border dekoratif global, serta efek kaca khusus formulir pembelian.</p>
                </div>
              </div>

              {/* Subsection 5.1: Corner Radius & Button Style */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Corner Radius (Kelengkungan Sudut)
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {(['none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full'] as const).map((r) => {
                      const isSelected = borderRadius === r;
                      const labelName = r === 'none' ? 'None' : r === 'full' ? 'Pill' : r.toUpperCase();
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setBorderRadius(r)}
                          className={`p-2 rounded-xl border text-center transition flex flex-col items-center gap-1.5 cursor-pointer min-h-[48px] justify-center ${
                            isSelected 
                              ? "border-indigo-600 bg-indigo-50/70 font-bold text-indigo-900 ring-2 ring-indigo-500/20 shadow-2xs" 
                              : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                          }`}
                        >
                          <div 
                            className="w-4 h-4 border-2 border-indigo-600 bg-indigo-100/50"
                            style={{
                              borderRadius: r === 'none' ? '0' : r === 'full' ? '9999px' : r === '3xl' ? '10px' : r === '2xl' ? '8px' : r === 'xl' ? '6px' : r === 'lg' ? '4px' : r === 'md' ? '3px' : '2px'
                            }}
                          />
                          <span className="text-[10px] font-semibold">{labelName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Gaya Tombol (Button Style)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {(['solid', 'outline', 'soft', 'ghost'] as const).map((style) => {
                      const isSelected = buttonStyle === style;
                      return (
                        <button
                          key={style}
                          type="button"
                          onClick={() => setButtonStyle(style)}
                          className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1.5 cursor-pointer ${
                            isSelected 
                              ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-2xs" 
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <div 
                            className="w-full py-1 text-[11px] font-bold transition shadow-2xs"
                            style={{
                              backgroundColor: style === 'solid' ? primaryColor : style === 'soft' ? `${primaryColor}20` : 'transparent',
                              color: style === 'solid' ? '#ffffff' : primaryColor,
                              border: style === 'outline' ? `1px solid ${primaryColor}` : 'none',
                              borderRadius: getRadiusStyle('button')
                            }}
                          >
                            {style.toUpperCase()}
                          </div>
                          <span className="text-[10px] font-semibold text-slate-600 capitalize">{style}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Subsection 5.2: Border UI Global */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/40">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Border UI Global</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Menampilkan atau menyembunyikan garis border visual dekoratif secara global di seluruh storefront.</p>
                  </div>
                  <ToggleSwitch
                    checked={showGlobalBorders}
                    onChange={setShowGlobalBorders}
                    label="Tampilkan border UI"
                  />
                </div>
              </div>

              {/* Subsection 5.3: Tampilan Kaca Khusus Form Transaksi */}
              <div className="space-y-4 pt-3 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Tampilan Kaca Form Transaksi (Game Detail)</h3>
                    <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 uppercase">
                      Khusus Checkout
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTransactionCardColor("#ffffff");
                      setTransactionCardOpacity(85);
                      setTransactionCardBlur("md");
                    }}
                    className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
                  >
                    <RefreshCw className="w-3 h-3 text-slate-500" />
                    Reset ke Default
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Efek frosted glass pada kartu transaksi di halaman pembelian game detail. Tidak memengaruhi Layer 2 Surface global toko.
                </p>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-slate-700 w-32 shrink-0">
                      Warna Lapisan Kaca:
                    </label>
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                      <input
                        type="color"
                        value={transactionCardColor}
                        onChange={(e) => setTransactionCardColor(e.target.value)}
                        className="absolute -top-2 -left-2 w-14 h-14 cursor-pointer"
                      />
                    </div>
                    <input
                      type="text"
                      value={transactionCardColor}
                      onChange={(e) => setTransactionCardColor(e.target.value)}
                      placeholder="#FFFFFF"
                      className="w-32 px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 uppercase bg-white font-bold"
                    />
                  </div>

                  {/* Slider Opacity */}
                  <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-800">
                        Tingkat Opacity Kartu Transaksi: <span className="text-sky-600 font-extrabold">{transactionCardOpacity}%</span>
                      </label>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                        {transactionCardOpacity === 100 ? "100% (Solid)" :
                         transactionCardOpacity >= 80 ? `${transactionCardOpacity}% (Standar)` :
                         `${transactionCardOpacity}% (Transparan)`}
                      </span>
                    </div>

                    <input
                      type="range"
                      min="50"
                      max="100"
                      step="1"
                      value={transactionCardOpacity}
                      onChange={(e) => setTransactionCardOpacity(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                    />

                    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                      <span>50% (Transparan)</span>
                      <span>85% (Rekomendasi)</span>
                      <span>100% (Solid)</span>
                    </div>
                  </div>

                  {/* Selector Blur */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Intensitas Efek Blur (Frosted Glass)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: "none", label: "Tanpa Blur", desc: "0px" },
                        { id: "sm", label: "Kecil (sm)", desc: "4px" },
                        { id: "md", label: "Sedang (md)", desc: "12px" },
                        { id: "lg", label: "Besar (lg)", desc: "16px" }
                      ].map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setTransactionCardBlur(b.id as any)}
                          className={`p-2 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                            transactionCardBlur === b.id
                              ? "border-sky-600 bg-sky-50 text-sky-900 ring-2 ring-sky-500/20 shadow-xs"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <span className="text-xs font-bold">{b.label}</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">{b.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="sticky bottom-4 z-40 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-lg flex items-center justify-between gap-4">
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                Perubahan langsung diterapkan ke pratinjau di samping kanan.
              </span>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Simpan Perubahan
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: Live Interactive Website Preview (5 cols on desktop, sticky) */}
        <div className={`lg:col-span-5 lg:sticky lg:top-6 space-y-4 ${mobileView === "preview" ? "block" : "hidden lg:block"}`}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm font-bold text-slate-900">Live Preview Website Publik</h2>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Interaktif
              </span>
            </div>

            {/* Tab Selector: Beranda vs Form Transaksi */}
            <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold gap-1">
              <button
                type="button"
                onClick={() => setPreviewTab("homepage")}
                className={`flex-1 py-1.5 px-3 rounded-lg transition text-center cursor-pointer ${
                  previewTab === "homepage"
                    ? "bg-white text-indigo-700 shadow-xs border border-slate-200/60"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                🏠 Pratinjau Beranda
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab("transaction")}
                className={`flex-1 py-1.5 px-3 rounded-lg transition text-center cursor-pointer ${
                  previewTab === "transaction"
                    ? "bg-white text-indigo-700 shadow-xs border border-slate-200/60"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                💎 Form Transaksi (Game Detail)
              </button>
            </div>

            {/* Browser Frame Mockup */}
            <div className="rounded-xl border border-slate-300/80 shadow-md overflow-hidden bg-slate-900 flex flex-col">
              {/* Browser Window Bar */}
              <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 max-w-[200px] mx-auto bg-white border border-slate-200 rounded-md px-2 py-0.5 text-[10px] text-slate-500 font-mono truncate text-center">
                  {previewTab === "homepage" ? "tokogame.id" : "tokogame.id/game/mobile-legends"}
                </div>
              </div>

              {/* Dynamic Web Canvas with Background Image/Color Support */}
              <div 
                className="p-3 space-y-3 transition-all duration-200 relative bg-cover bg-center"
                style={{ 
                  backgroundColor: previewBg,
                  backgroundImage: (homepageBackgroundMode === "image" && homepageBackgroundImage) ? `url("${homepageBackgroundImage}")` : "none",
                  color: previewText 
                }}
              >
                {/* Navbar Mockup - accurately reflects previewHeaderBg */}
                <div 
                  className="px-3 py-2.5 flex items-center justify-between border shadow-2xs transition-all relative z-10"
                  style={{ 
                    backgroundColor: previewHeaderBg, 
                    borderColor: previewBorder,
                    borderRadius: getRadiusStyle('container')
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {logo ? (
                      <img 
                        src={logo} 
                        alt="Logo Toko" 
                        className="h-5 max-w-[90px] object-contain shrink-0" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <div 
                        className="h-5 w-5 flex items-center justify-center text-white font-black text-[10px] shrink-0"
                        style={{ 
                          backgroundColor: primaryColor, 
                          borderRadius: getRadiusStyle('badge') 
                        }}
                      >
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span 
                      className="font-extrabold text-xs tracking-tight truncate max-w-[110px]"
                      style={{ color: previewBrandText }}
                    >
                      {displayName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span 
                      className="px-2 py-0.5 text-[10px] font-bold border transition shadow-2xs"
                      style={{ 
                        backgroundColor: buttonStyle === 'solid' ? primaryColor : buttonStyle === 'soft' ? `${primaryColor}20` : 'transparent',
                        color: buttonStyle === 'solid' ? '#ffffff' : primaryColor,
                        borderColor: buttonStyle === 'outline' ? primaryColor : 'transparent',
                        borderRadius: getRadiusStyle('button')
                      }}
                    >
                      Masuk
                    </span>
                  </div>
                </div>

                {/* Content View 1: HOMEPAGE PREVIEW */}
                {previewTab === "homepage" && (
                  <div className="space-y-2.5 animate-fade-in relative z-10">
                    {/* Marquee Banner Mockup */}
                    {showCatalogMarquee && (
                      <div 
                        className="px-2.5 py-1 text-[9px] font-semibold border flex items-center gap-2 overflow-hidden truncate"
                        style={{ 
                          backgroundColor: `${accentColor}15`, 
                          color: previewText,
                          borderColor: `${accentColor}40`,
                          borderRadius: getRadiusStyle('badge')
                        }}
                      >
                        <span className="px-1 py-0.2 rounded font-bold uppercase text-[8px]" style={{ backgroundColor: accentColor, color: '#ffffff' }}>
                          INFO
                        </span>
                        <span className="truncate">{catalogMarqueeText || "Pilih game favorit atau layanan digital Anda untuk memulai proses top up otomatis."}</span>
                      </div>
                    )}

                    {/* Hero Banner Mockup */}
                    <div 
                      className="p-3.5 border shadow-2xs text-left relative overflow-hidden"
                      style={{ 
                        backgroundColor: previewSurface, 
                        borderColor: previewBorder,
                        borderRadius: getRadiusStyle('container')
                      }}
                    >
                      <div className="relative z-10 space-y-1">
                        <span 
                          className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider inline-block"
                          style={{ 
                            backgroundColor: `${primaryColor}15`, 
                            color: primaryColor,
                            borderRadius: getRadiusStyle('badge')
                          }}
                        >
                          PROMO SPESIAL
                        </span>
                        <h4 className="text-xs font-black leading-tight" style={{ color: previewText }}>
                          {displayTagline}
                        </h4>
                        <p className="text-[10px] leading-tight line-clamp-2" style={{ color: previewTextSecondary }}>
                          {displayDesc}
                        </p>
                      </div>
                    </div>

                    {/* Catalog Grid Mockup (Layer 2 Surface) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold" style={{ color: previewText }}>
                        <span>Katalog Game Populer</span>
                        <span className="text-[9px]" style={{ color: primaryColor }}>Lihat Semua →</span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { title: "Mobile Legends", cat: "MOBA", diamond: "86 💎" },
                          { title: "Free Fire", cat: "Battle Royale", diamond: "140 💎" },
                          { title: "Genshin Impact", cat: "RPG", diamond: "60 💎" }
                        ].map((item, idx) => (
                          <div 
                            key={idx}
                            className="p-2 border shadow-2xs flex flex-col justify-between transition-all"
                            style={{ 
                              backgroundColor: previewSurface, 
                              borderColor: previewBorder,
                              borderRadius: getRadiusStyle('container')
                            }}
                          >
                            <div className="w-full aspect-[4/3] rounded-md bg-slate-200/70 mb-1 flex items-center justify-center font-black text-slate-400 text-xs">
                              {item.title.charAt(0)}
                            </div>
                            <span className="font-bold text-[10px] truncate leading-tight" style={{ color: previewText }}>{item.title}</span>
                            <span className="text-[8px] truncate" style={{ color: previewTextSecondary }}>{item.cat}</span>
                            <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between">
                              <span className="text-[9px] font-bold" style={{ color: primaryColor }}>{item.diamond}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Content View 2: TRANSACTION FORM PREVIEW (Game Detail) */}
                {previewTab === "transaction" && (
                  <div className="space-y-2.5 animate-fade-in relative z-10">
                    {/* Header Breadcrumb */}
                    <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
                      <span>Beranda</span>
                      <span>›</span>
                      <span>Mobile Legends</span>
                      <span>›</span>
                      <span className="font-bold text-indigo-400">Top Up</span>
                    </div>

                    {/* Simulated Game Header Card */}
                    <div 
                      className="p-3 border shadow-xs flex items-center gap-2.5"
                      style={{ 
                        backgroundColor: hexToRgba(previewTransactionCardColor, transactionCardOpacity),
                        backdropFilter: transactionCardBlur === "none" ? "none" : transactionCardBlur === "sm" ? "blur(4px)" : transactionCardBlur === "lg" ? "blur(16px)" : "blur(12px)",
                        WebkitBackdropFilter: transactionCardBlur === "none" ? "none" : transactionCardBlur === "sm" ? "blur(4px)" : transactionCardBlur === "lg" ? "blur(16px)" : "blur(12px)",
                        borderColor: previewBorder,
                        borderRadius: getRadiusStyle('container')
                      }}
                    >
                      <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-base shadow-xs shrink-0">
                        ML
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black truncate" style={{ color: previewText }}>Mobile Legends: Bang Bang</h4>
                        <p className="text-[9px]" style={{ color: previewTextSecondary }}>Moonton • Top Up Cepat Otomatis</p>
                      </div>
                    </div>

                    {/* Transaction Form Card with Frosted Glass Effect */}
                    <div 
                      className="p-3 border shadow-sm space-y-2.5 relative transition-all"
                      style={{ 
                        backgroundColor: hexToRgba(previewTransactionCardColor, transactionCardOpacity),
                        backdropFilter: transactionCardBlur === "none" ? "none" : transactionCardBlur === "sm" ? "blur(4px)" : transactionCardBlur === "lg" ? "blur(16px)" : "blur(12px)",
                        WebkitBackdropFilter: transactionCardBlur === "none" ? "none" : transactionCardBlur === "sm" ? "blur(4px)" : transactionCardBlur === "lg" ? "blur(16px)" : "blur(12px)",
                        borderColor: previewBorder,
                        borderRadius: getRadiusStyle('container')
                      }}
                    >
                      <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: `${previewBorder}80` }}>
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-bold">1</span>
                          <span className="text-[10px] font-bold" style={{ color: previewText }}>Masukkan User ID</span>
                        </div>
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                          Layer: {transactionCardOpacity}%
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="px-2 py-1.5 text-[9px] rounded-lg border bg-white/60" style={{ borderColor: previewBorder, color: previewText }}>
                          12345678
                        </div>
                        <div className="px-2 py-1.5 text-[9px] rounded-lg border bg-white/60" style={{ borderColor: previewBorder, color: previewText }}>
                          (2026)
                        </div>
                      </div>

                      <div className="border-t pt-1.5 space-y-1.5" style={{ borderColor: `${previewBorder}80` }}>
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-bold">2</span>
                          <span className="text-[10px] font-bold" style={{ color: previewText }}>Pilih Nominal Top Up</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { nominal: "86 Diamonds", price: "Rp 21.000", active: true },
                            { nominal: "172 Diamonds", price: "Rp 42.000", active: false }
                          ].map((item, idx) => (
                            <div 
                              key={idx}
                              className={`p-1.5 rounded-lg border text-left cursor-pointer transition ${
                                item.active ? 'ring-1 ring-indigo-500 bg-indigo-50/80 font-bold' : 'bg-white/50'
                              }`}
                              style={{ 
                                borderColor: item.active ? primaryColor : previewBorder,
                                color: previewText
                              }}
                            >
                              <div className="text-[9px] font-extrabold">{item.nominal}</div>
                              <div className="text-[8px]" style={{ color: primaryColor }}>{item.price}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Checkout Button */}
                      <button
                        type="button"
                        className="w-full py-2 text-center text-[10px] font-black transition cursor-pointer shadow-xs"
                        style={{ 
                          backgroundColor: buttonStyle === 'solid' ? primaryColor : buttonStyle === 'soft' ? `${primaryColor}20` : 'transparent',
                          color: buttonStyle === 'solid' ? '#ffffff' : primaryColor,
                          border: buttonStyle === 'outline' ? `1px solid ${primaryColor}` : 'none',
                          borderRadius: getRadiusStyle('button')
                        }}
                      >
                        Beli Sekarang →
                      </button>
                    </div>
                  </div>
                )}

                {/* Footer Mockup */}
                <div 
                  className="p-2.5 rounded-lg text-center text-[9px] transition-all relative z-10"
                  style={{ 
                    backgroundColor: footerBackgroundMode === 'color' && footerBackgroundColor ? footerBackgroundColor : (footerBackgroundMode === 'image' ? 'transparent' : '#0f172a'),
                    backgroundImage: footerBackgroundMode === 'image' && footerBackgroundImage ? `url("${footerBackgroundImage}")` : 'none',
                    color: '#94a3b8',
                    borderRadius: getRadiusStyle('container')
                  }}
                >
                  <p className="font-bold text-white text-[10px]">{displayName}</p>
                  <p className="text-[8px] mt-0.5">© 2026 {displayName}. All rights reserved.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Media Picker Modal */}
      {isMediaPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Pilih Aset untuk {activeMediaTarget === "logo" ? "Logo Toko" : activeMediaTarget === "favicon" ? "Favicon Toko" : activeMediaTarget === "homepageBg" ? "Wallpaper Beranda" : activeMediaTarget === "authBg" ? "Wallpaper Auth" : "Background Footer"}
                </h3>
                <p className="text-[11px] text-slate-500">Pilih dari aset yang sudah diunggah di Media Library Anda.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMediaPickerOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 font-bold flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama aset media..."
                  value={mediaSearch}
                  onChange={(e) => setMediaSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            
            {mediaLoading ? (
              <div className="flex flex-col items-center justify-center p-12 flex-1 gap-2">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                <span className="text-xs text-slate-500 font-medium">Memuat media library...</span>
              </div>
            ) : filteredMediaList.length === 0 ? (
              <div className="p-10 text-center flex-1 text-slate-500 text-xs">
                {mediaSearch ? "Tidak ada aset yang cocok dengan kata kunci pencarian." : "Tidak ada aset media yang ditemukan. Silakan unggah aset terlebih dahulu di menu Media Library."}
              </div>
            ) : (
              <div className="p-4 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-3 flex-1 max-h-[400px]">
                {filteredMediaList.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      if (activeMediaTarget === "logo") {
                        setLogo(m.url);
                      } else if (activeMediaTarget === "favicon") {
                        setFavicon(m.url);
                      } else if (activeMediaTarget === "homepageBg") {
                        setHomepageBackgroundImage(m.url);
                        setHomepageBackgroundMode("image");
                      } else if (activeMediaTarget === "authBg") {
                        setAuthBackgroundImage(m.url);
                        setAuthBackgroundMode("image");
                      } else if (activeMediaTarget === "footerBg") {
                        setFooterBackgroundImage(m.url);
                        setFooterBackgroundMode("image");
                      }
                      setIsMediaPickerOpen(false);
                    }}
                    className="cursor-pointer group bg-white border border-slate-200 rounded-xl overflow-hidden hover:ring-2 hover:ring-indigo-500 hover:border-indigo-500 transition shadow-2xs flex flex-col"
                  >
                    <div className="aspect-square bg-slate-50 overflow-hidden flex items-center justify-center p-2">
                      <img 
                        src={m.url} 
                        alt={m.originalName} 
                        className="max-w-full max-h-full object-contain group-hover:scale-105 transition" 
                        referrerPolicy="no-referrer" 
                      />
                    </div>
                    <p className="p-2 text-[10px] truncate text-slate-700 font-semibold border-t border-slate-100 bg-white">{m.originalName}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsMediaPickerOpen(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-xs transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
