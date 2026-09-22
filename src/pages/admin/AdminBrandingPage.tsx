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
  Check, 
  ShoppingBag, 
  ShieldCheck, 
  Image as ImageIcon, 
  Sliders, 
  Sun, 
  Moon, 
  Laptop,
  CheckCircle2,
  Trash2,
  FolderOpen,
  HelpCircle,
  ExternalLink,
  Search
} from "lucide-react";
import { StoreConfiguration } from "../../types/core";

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

export default function AdminBrandingPage() {
  const { user } = useAuthStore();
  const [config, setConfig] = useState<StoreConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fields - Identitas Dasar
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [catalogMarqueeText, setCatalogMarqueeText] = useState("");

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
  
  const [transactionCardColor, setTransactionCardColor] = useState<string>("#ffffff");
  const [transactionCardOpacity, setTransactionCardOpacity] = useState<number>(85);
  const [transactionCardBlur, setTransactionCardBlur] = useState<"none" | "sm" | "md" | "lg">("md");
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
        setBorderRadius(cfg.borderRadius || "xl");
        setButtonStyle(cfg.buttonStyle || "solid");
        setThemePreference(cfg.themePreference || "light");
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
        setHeaderScrollEffect(cfg.headerScrollEffect ?? true);
        setLogoHoverEffect(cfg.logoHoverEffect ?? true);
        setNavIndicator(cfg.navIndicator ?? true);
      } else {
        setError(data.message || "Gagal memuat konfigurasi");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMediaLibrary = async () => {
    try {
      setMediaLoading(true);
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/media?limit=50", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setMediaList(data.data || []);
      }
    } catch (e) {
      console.error("Gagal memuat media library:", e);
    } finally {
      setMediaLoading(false);
    }
  };

  const openMediaPicker = (target: "logo" | "favicon" | "homepageBg" | "footerBg" | "authBg") => {
    setActiveMediaTarget(target);
    setIsMediaPickerOpen(true);
    fetchMediaLibrary();
  };

  const isHexDark = (hex?: string): boolean => {
    if (!hex || !hex.startsWith("#") || hex.length < 7) return false;
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 128;
  };

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

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

  const sanitizeHex = (hex: string, fallback: string = ""): string => {
    if (!hex) return fallback;
    let clean = hex.trim();
    if (!clean.startsWith("#")) clean = "#" + clean;
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
        {/* Card Header */}
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

        {/* Big Color Swatch / Interactive Visual Preview Block */}
        <label 
          htmlFor={id} 
          className="relative h-12 w-full rounded-lg border border-slate-200/80 shadow-inner flex items-center justify-center cursor-pointer transition-all active:scale-[0.99] overflow-hidden group/swatch"
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

        {/* HEX Input Box */}
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
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs shrink-0">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Pengaturan Branding & Tema Toko
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola identitas visual, palet warna, logo, dan style tombol untuk tampilan toko publik Anda.
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

      {/* Main 2-Column Responsive Layout: Form (Left) & Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Settings (7 cols on desktop) */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* 1. Identitas Dasar Toko (Grid 2 Kolom + Full Width Desc) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Identitas Dasar Toko</h2>
                  <p className="text-[11px] text-slate-500">Informasi nama, slogan, dan deskripsi publik toko.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
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
                  <label htmlFor="store-marquee" className="block text-xs font-bold text-slate-700 mb-1">
                    Teks Berjalan Header Katalog
                  </label>
                  <input
                    id="store-marquee"
                    type="text"
                    value={catalogMarqueeText}
                    onChange={(e) => setCatalogMarqueeText(e.target.value)}
                    placeholder="Pilih game favorit atau layanan digital Anda untuk memulai proses top up otomatis."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-slate-50/50"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Teks marquee berjalan (KANAN → KIRI) pada bagian atas katalog game di Homepage. Jika kosong, menggunakan teks default.
                  </p>
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

            {/* 2. Aset Visual Toko (Grid 2 Kolom: Logo & Favicon) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Aset Visual Toko</h2>
                  <p className="text-[11px] text-slate-500">Logo utama dan ikon tab browser (favicon) resmi toko.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
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
                  </div>
                </div>

                {/* Gaya Logo & Opsi Nama */}
                <div className="sm:col-span-2 border-t border-slate-100 pt-4 mt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Gaya Bentuk Logo
                      </label>
                      <div className="flex gap-2">
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
                        <p className="text-[9px] text-slate-500">Tampilkan teks nama di samping logo.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLogoShowName(!logoShowName)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                          logoShowName ? 'bg-indigo-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            logoShowName ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2.1 Kustomisasi Header */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                  H
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Kustomisasi Header (Navbar)</h2>
                  <p className="text-[11px] text-slate-500">Atur skema warna khusus untuk bar navigasi bagian atas.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
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
                  placeholder="#64748b"
                />
              </div>
            </div>

            {/* 3. Latar Belakang Khusus Beranda (Homepage) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Latar Belakang Beranda (Homepage)</h2>
                    <p className="text-[11px] text-slate-500">Atur warna khusus atau gambar wallpaper khusus untuk halaman utama toko.</p>
                  </div>
                </div>
              </div>

              {/* 3.1 Latar Belakang Khusus Auth (Login & Daftar) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-xs">
                      A
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Latar Belakang Login & Daftar</h2>
                      <p className="text-[11px] text-slate-500">Atur tampilan latar belakang untuk halaman Login dan Pendaftaran Akun.</p>
                    </div>
                  </div>
                </div>

                {/* Mode Selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Mode Latar Belakang Auth
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAuthBackgroundMode("color")}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                        authBackgroundMode === "color"
                          ? "border-orange-600 bg-orange-50 text-orange-700 shadow-xs"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      <Palette className="w-3.5 h-3.5" />
                      <span>Warna (Color)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthBackgroundMode("image")}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                        authBackgroundMode === "image"
                          ? "border-orange-600 bg-orange-50 text-orange-700 shadow-xs"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Wallpaper (Gambar)</span>
                    </button>
                  </div>
                </div>

                {/* Konten Mode: Warna */}
                {authBackgroundMode === "color" && (
                  <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Kustom Warna Latar Auth</h4>
                        <p className="text-[11px] text-slate-500">Pilih warna latar khusus untuk halaman Login/Daftar.</p>
                      </div>
                      {authBackgroundColor && (
                        <button
                          type="button"
                          onClick={() => setAuthBackgroundColor("")}
                          className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                        >
                          <Trash2 className="w-3 h-3" /> Reset ke Default
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-300 shrink-0 shadow-2xs">
                        <input
                          type="color"
                          value={authBackgroundColor || "#f8fafc"}
                          onChange={(e) => setAuthBackgroundColor(e.target.value)}
                          className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
                        />
                      </div>
                      <input
                        type="text"
                        value={authBackgroundColor}
                        onChange={(e) => setAuthBackgroundColor(e.target.value)}
                        placeholder="#F8FAFC (Default)"
                        className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 uppercase font-mono font-bold bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* Konten Mode: Wallpaper */}
                {authBackgroundMode === "image" && (
                  <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Wallpaper Gambar Auth</h4>
                        <p className="text-[11px] text-slate-500">Pilih gambar wallpaper untuk latar belakang Login/Daftar.</p>
                      </div>
                      {authBackgroundImage && (
                        <button
                          type="button"
                          onClick={() => setAuthBackgroundImage("")}
                          className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Hapus
                        </button>
                      )}
                    </div>

                    <div className="relative h-24 w-full rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center p-2 overflow-hidden">
                      {authBackgroundImage ? (
                        <img 
                          src={authBackgroundImage} 
                          alt="Auth Wallpaper" 
                          className="max-h-full max-w-full object-contain" 
                          referrerPolicy="no-referrer" 
                        />
                      ) : (
                        <div className="text-center text-slate-400">
                          <ImageIcon className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                          <span className="text-[10px]">Belum ada wallpaper dipilih</span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => openMediaPicker("authBg")}
                      className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      Ganti Wallpaper Auth
                    </button>
                  </div>
                )}
              </div>

              {/* Mode Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Mode Latar Belakang
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setHomepageBackgroundMode("color")}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      homepageBackgroundMode === "color"
                        ? "border-sky-600 bg-sky-50 text-sky-700 shadow-xs"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>Warna (Color)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHomepageBackgroundMode("image")}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      homepageBackgroundMode === "image"
                        ? "border-sky-600 bg-sky-50 text-sky-700 shadow-xs"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Wallpaper (Gambar)</span>
                  </button>
                </div>
              </div>

              {/* Konten Mode: Warna */}
              {homepageBackgroundMode === "color" && (
                <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Kustom Warna Latar Beranda</h4>
                      <p className="text-[11px] text-slate-500">Pilih warna latar khusus untuk kanvas Beranda.</p>
                    </div>
                    {homepageBackgroundColor && (
                      <button
                        type="button"
                        onClick={() => setHomepageBackgroundColor("")}
                        className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                      >
                        <Trash2 className="w-3 h-3" /> Reset ke Default
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-300 shrink-0 shadow-2xs">
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
                      className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 uppercase font-mono font-bold bg-white"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 italic">Kosongkan jika ingin menggunakan warna default toko (#ffffff).</p>
                </div>
              )}

              {/* Konten Mode: Wallpaper */}
              {homepageBackgroundMode === "image" && (
                <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Wallpaper Gambar Beranda</h4>
                      <p className="text-[11px] text-slate-500">Pilih gambar wallpaper berukuran penuh untuk latar belakang Beranda.</p>
                    </div>
                    {homepageBackgroundImage && (
                      <button
                        type="button"
                        onClick={() => setHomepageBackgroundImage("")}
                        className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" /> Hapus Wallpaper
                      </button>
                    )}
                  </div>

                  {/* Preview Container */}
                  <div className="h-32 w-full rounded-xl border border-dashed border-slate-300 bg-white overflow-hidden relative flex items-center justify-center">
                    {homepageBackgroundImage ? (
                      <img
                        src={homepageBackgroundImage}
                        alt="Wallpaper Preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-center text-slate-400 p-4">
                        <ImageIcon className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                        <span className="text-xs font-medium">Belum ada wallpaper dipilih</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">Pilih dari Media Library atau tempel URL gambar</p>
                      </div>
                    )}
                  </div>

                  {/* Media Picker Trigger */}
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => openMediaPicker("homepageBg")}
                      className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs shrink-0"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      Pilih dari Media Library
                    </button>
                    <input
                      type="text"
                      placeholder="Atau tempel URL gambar wallpaper (https://...)"
                      value={homepageBackgroundImage}
                      onChange={(e) => setHomepageBackgroundImage(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">Wallpaper akan otomatis ditampilkan dengan skala cover dan posisi center di halaman Beranda.</p>
                </div>
              )}

              {/* Pengaturan Background Footer */}
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Pengaturan Background Footer</h3>
                    <p className="text-[11px] text-slate-500">Atur warna khusus atau gambar wallpaper untuk bagian Footer toko.</p>
                  </div>
                </div>

                {/* Mode Selector Footer */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Mode Latar Belakang Footer
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFooterBackgroundMode("color")}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                        footerBackgroundMode === "color"
                          ? "border-sky-600 bg-sky-50 text-sky-700 shadow-xs"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      <Palette className="w-3.5 h-3.5" />
                      <span>Warna (Color)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFooterBackgroundMode("image")}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                        footerBackgroundMode === "image"
                          ? "border-sky-600 bg-sky-50 text-sky-700 shadow-xs"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Wallpaper (Gambar)</span>
                    </button>
                  </div>
                </div>

                {/* Footer Color Mode */}
                {footerBackgroundMode === "color" && (
                  <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Kustom Warna Footer</h4>
                        <p className="text-[11px] text-slate-500">Pilih warna latar khusus untuk bagian Footer.</p>
                      </div>
                      {footerBackgroundColor && (
                        <button
                          type="button"
                          onClick={() => setFooterBackgroundColor("")}
                          className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                        >
                          <Trash2 className="w-3 h-3" /> Reset ke Default
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-300 shrink-0 shadow-2xs">
                        <input
                          type="color"
                          value={footerBackgroundColor || "#0f172a"}
                          onChange={(e) => setFooterBackgroundColor(e.target.value)}
                          className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
                        />
                      </div>
                      <input
                        type="text"
                        value={footerBackgroundColor}
                        onChange={(e) => setFooterBackgroundColor(e.target.value)}
                        placeholder="#0F172A (Default Slate 900)"
                        className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 uppercase font-mono font-bold bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* Footer Image Mode */}
                {footerBackgroundMode === "image" && (
                  <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Wallpaper Gambar Footer</h4>
                        <p className="text-[11px] text-slate-500">Pilih gambar wallpaper untuk latar belakang Footer.</p>
                      </div>
                      {footerBackgroundImage && (
                        <button
                          type="button"
                          onClick={() => setFooterBackgroundImage("")}
                          className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Hapus Wallpaper
                        </button>
                      )}
                    </div>

                    <div className="h-32 w-full rounded-xl border border-dashed border-slate-300 bg-white overflow-hidden relative flex items-center justify-center">
                      {footerBackgroundImage ? (
                        <img
                          src={footerBackgroundImage}
                          alt="Footer Wallpaper Preview"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="text-center text-slate-400 p-4">
                          <ImageIcon className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                          <span className="text-xs font-medium">Belum ada wallpaper dipilih</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openMediaPicker("footerBg")}
                        className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs shrink-0"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Pilih dari Media Library
                      </button>
                      <input
                        type="text"
                        placeholder="Atau tempel URL gambar wallpaper"
                        value={footerBackgroundImage}
                        onChange={(e) => setFooterBackgroundImage(e.target.value)}
                        className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Kontrol Kustomisasi Layer Transaksi */}
              <div className="pt-3 border-t border-slate-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-sky-600" />
                      Transparansi & Efek Kaca Form Transaksi
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Tentukan seberapa kuat rona background terlihat di balik kartu form pembelian (Data Akun, Nominal, Metode Pembayaran, & Ringkasan).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setHomepageBackgroundColor("");
                      setHomepageBackgroundImage("");
                      setHomepageBackgroundMode("color");
                      setFooterBackgroundColor("");
                      setFooterBackgroundImage("");
                      setFooterBackgroundMode("color");
                      setTransactionCardOpacity(85);
                      setTransactionCardBlur("md");
                    }}
                    className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
                  >
                    <RefreshCw className="w-3 h-3 text-slate-500" />
                    Reset ke Default
                  </button>
                </div>

                {/* Warna Lapisan Form Transaksi */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-800">
                    Warna Lapisan Form Transaksi
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-slate-200 shrink-0 shadow-2xs">
                      <input
                        type="color"
                        value={transactionCardColor}
                        onChange={(e) => setTransactionCardColor(e.target.value)}
                        className="absolute -inset-2 w-14 h-14 cursor-pointer p-0 border-0"
                      />
                    </div>
                    <input
                      type="text"
                      value={transactionCardColor}
                      onChange={(e) => setTransactionCardColor(e.target.value)}
                      placeholder="#FFFFFF"
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 uppercase"
                    />
                  </div>
                </div>

                {/* Slider Opacity */}
                <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-800">
                      Tingkat Opacity Kartu Transaksi: <span className="text-sky-600 font-extrabold">{transactionCardOpacity}%</span>
                    </label>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                      {transactionCardOpacity === 100 ? "100% (Solid / Putih Pekat)" :
                       transactionCardOpacity >= 80 ? `${transactionCardOpacity}% (Halus - Standar)` :
                       transactionCardOpacity >= 65 ? `${transactionCardOpacity}% (Sedang / Elegan)` :
                       `${transactionCardOpacity}% (Transparan Kuat)`}
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
                    <span>70% (Sedang)</span>
                    <span>85% (Rekomendasi)</span>
                    <span>100% (Solid)</span>
                  </div>
                </div>

                {/* Selector Blur */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-800">
                    Intensitas Efek Blur (Frosted Glass)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: "none", label: "Tanpa Blur", desc: "0px" },
                      { id: "sm", label: "Kecil (sm)", desc: "4px" },
                      { id: "md", label: "Sedang (md)", desc: "12px - Standar" },
                      { id: "lg", label: "Besar (lg)", desc: "16px" }
                    ].map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setTransactionCardBlur(b.id as any)}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                          transactionCardBlur === b.id
                            ? "border-sky-600 bg-sky-50 text-sky-900 ring-2 ring-sky-500/20 shadow-xs"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
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

            {/* 4. Preset Skema Warna (Grid: Desktop 4x2, Tablet 2 col, Mobile 2 col) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                  4
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Preset Skema Warna Siap Pakai</h2>
                  <p className="text-[11px] text-slate-500">Pilih kombinasi warna harmonis yang dirancang secara proporsional.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
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
                          setHomepageBackgroundColor("#f8fafc");
                          setHomepageBackgroundImage("");
                          setHomepageBackgroundMode("color");
                          setFooterBackgroundColor("#0f172a");
                          setFooterBackgroundImage("");
                          setFooterBackgroundMode("color");
                          setTransactionCardColor("#ffffff");
                          setTransactionCardOpacity(85);
                          setTransactionCardBlur("lg");
                          setButtonStyle("solid");
                          setThemePreference("light");
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
                      <div className="flex h-4 w-full rounded-md overflow-hidden border border-slate-200/80 shadow-2xs">
                        <div className="flex-1" style={{ backgroundColor: p.primary }} title={`Primary: ${p.primary}`} />
                        <div className="flex-1" style={{ backgroundColor: p.secondary }} title={`Secondary: ${p.secondary}`} />
                        <div className="flex-1" style={{ backgroundColor: p.brandText }} title={`Brand: ${p.brandText}`} />
                        <div className="w-3" style={{ backgroundColor: p.accent }} title={`Accent: ${p.accent}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Warna Custom (10 Field Card Grid) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    5
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Kustomisasi Palet Warna (10 Field)</h2>
                    <p className="text-[11px] text-slate-500">Atur kode warna HEX secara presisi untuk setiap elemen antarmuka.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
                <ColorPickerField 
                  id="color-primary"
                  label="1. Primary" 
                  desc="Warna utama tombol, badge aktif, dan highlight." 
                  value={primaryColor} 
                  onChange={setPrimaryColor} 
                  placeholder="#3B82F6" 
                />
                
                <ColorPickerField 
                  id="color-secondary"
                  label="2. Secondary" 
                  desc="Warna pendukung, banner aksen, dan gradien." 
                  value={secondaryColor} 
                  onChange={setSecondaryColor} 
                  placeholder="#1D4ED8" 
                />

                <ColorPickerField 
                  id="color-brand-text"
                  label="3. Teks Brand" 
                  desc="Warna teks judul toko dan identitas brand." 
                  value={brandTextColor} 
                  onChange={setBrandTextColor} 
                  placeholder="#1E3A8A"
                  onSyncWithPrimary={() => setBrandTextColor(primaryColor)}
                />

                <ColorPickerField 
                  id="color-accent"
                  label="4. Aksen" 
                  desc="Badge promo, diskon, notifikasi khusus." 
                  value={accentColor} 
                  onChange={setAccentColor} 
                  placeholder="#F59E0B" 
                />

                <ColorPickerField 
                  id="color-bg"
                  label="5. Background Utama" 
                  desc="Latar belakang canvas dasar website." 
                  value={backgroundColor} 
                  onChange={setBackgroundColor} 
                  placeholder="#FFFFFF" 
                />

                <ColorPickerField 
                  id="color-surface"
                  label="6. Surface / Card" 
                  desc="Latar belakang card produk, form & modal." 
                  value={surfaceColor} 
                  onChange={setSurfaceColor} 
                  placeholder="#FFFFFF" 
                />

                <ColorPickerField 
                  id="color-text-main"
                  label="7. Teks Utama" 
                  desc="Warna judul produk, heading & label utama." 
                  value={textColor} 
                  onChange={setTextColor} 
                  placeholder="#0F172A" 
                />

                <ColorPickerField 
                  id="color-text-sec"
                  label="8. Teks Sekunder" 
                  desc="Warna subtitle, deskripsi, dan info kecil." 
                  value={textSecondaryColor} 
                  onChange={setTextSecondaryColor} 
                  placeholder="#64748B" 
                />

                <ColorPickerField 
                  id="color-border"
                  label="9. Garis & Border" 
                  desc="Garis pemisah card, input outline, & divider." 
                  value={borderColor} 
                  onChange={setBorderColor} 
                  placeholder="#E2E8F0" 
                />

                <ColorPickerField 
                  id="color-hover"
                  label="10. Hover / Active" 
                  desc="Warna respons saat kursor berada di atas tombol." 
                  value={hoverColor} 
                  onChange={setHoverColor} 
                  placeholder="#2563EB" 
                />
              </div>
            </div>

            {/* 6. Bentuk & Style Komponen (Grid Card Compact) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
                  6
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Style Komponen</h2>
                  <p className="text-[11px] text-slate-500">Sesuaikan kelengkungan sudut, style tombol, dan preferensi tema.</p>
                </div>
              </div>

              {/* Corner Radius Grid */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Corner Radius
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
                        className={`p-2 rounded-xl border text-center transition flex flex-col items-center gap-1.5 cursor-pointer ${
                          isSelected 
                            ? "border-indigo-600 bg-indigo-50/70 font-bold text-indigo-900 ring-2 ring-indigo-500/20 shadow-2xs" 
                            : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                        }`}
                      >
                        <div 
                          className="w-5 h-5 border-2 border-indigo-600 bg-indigo-100/50"
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

              {/* Button Style Grid */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Button Style
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(['solid', 'outline', 'soft', 'ghost'] as const).map((style) => {
                    const isSelected = buttonStyle === style;
                    return (
                      <button
                        key={style}
                        type="button"
                        onClick={() => setButtonStyle(style)}
                        className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-2 cursor-pointer ${
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

              {/* Theme Preference Grid */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Preferensi Tema
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'light', label: 'Light', icon: Sun, desc: 'Tampilan bersih terang' },
                    { id: 'dark', label: 'Dark', icon: Moon, desc: 'Tampilan elegan gelap' },
                    { id: 'system', label: 'System', icon: Laptop, desc: 'Sesuai preferensi OS' },
                  ].map((theme) => {
                    const isSelected = themePreference === theme.id;
                    const IconComponent = theme.icon;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setThemePreference(theme.id as any)}
                        className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                          isSelected 
                            ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-2xs" 
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <IconComponent className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? "text-indigo-600" : "text-slate-500"}`} />
                        <div>
                          <div className="text-xs font-bold text-slate-800">{theme.label}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{theme.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Pengaturan Animasi */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Animasi Header & Logo</h2>
                  <p className="text-[11px] text-slate-500">Atur perilaku animasi untuk elemen header dan navigasi.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                {[
                  { label: "Header saat Scroll", value: headerScrollEffect, onChange: setHeaderScrollEffect },
                  { label: "Efek Hover Logo", value: logoHoverEffect, onChange: setLogoHoverEffect },
                  { label: "Indikator Navigasi", value: navIndicator, onChange: setNavIndicator },
                ].map((ctrl) => (
                  <div key={ctrl.label} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-200/60">
                    <span className="text-[11px] font-bold text-slate-700">{ctrl.label}</span>
                    <button
                      type="button"
                      onClick={() => ctrl.onChange(!ctrl.value)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                        ctrl.value ? 'bg-indigo-600' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${ctrl.value ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Save Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Perubahan langsung diterapkan ke pratinjau di samping kanan.
              </span>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-xs disabled:opacity-50 cursor-pointer"
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
          </form>
        </div>

        {/* Right Column: Live Interactive Website Preview (5 cols on desktop, sticky) */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-4">
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
                {/* Navbar Mockup */}
                <div 
                  className="px-3 py-2.5 flex items-center justify-between border shadow-2xs transition-all relative z-10"
                  style={{ 
                    backgroundColor: previewSurface, 
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

                  <div className="flex items-center gap-1.5">
                    <span 
                      className="text-[9px] font-bold px-2 py-0.5"
                      style={{ 
                        backgroundColor: `${primaryColor}15`, 
                        color: primaryColor,
                        borderRadius: getRadiusStyle('badge')
                      }}
                    >
                      {previewTab === "homepage" ? "Beranda" : "Top Up"}
                    </span>
                    <span 
                      className="text-[9px] font-medium px-1.5 py-0.5"
                      style={{ color: previewTextSecondary }}
                    >
                      Lacak Pesanan
                    </span>
                  </div>
                </div>

                {previewTab === "homepage" ? (
                  <>
                    {/* Hero Banner Mockup */}
                    <div 
                      className="p-4 border text-center space-y-2.5 relative overflow-hidden transition-all shadow-xs"
                      style={{ 
                        backgroundColor: previewSurface, 
                        borderColor: previewBorder,
                        borderRadius: getRadiusStyle('container')
                      }}
                    >
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                        style={{ 
                          backgroundColor: `${primaryColor}15`, 
                          color: primaryColor,
                          borderRadius: '9999px'
                        }}
                      >
                        <ShieldCheck className="w-2.5 h-2.5" /> Transaksi Aman & Terverifikasi
                      </div>

                      <div>
                        <h3 className="text-xs font-black tracking-tight leading-snug" style={{ color: previewText }}>
                          {displayName}
                        </h3>
                        <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: previewTextSecondary }}>
                          {displayTagline}
                        </p>
                      </div>

                      <div className="flex items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          className="px-3 py-1 text-[10px] font-bold transition shadow-2xs"
                          style={{
                            backgroundColor: buttonStyle === 'solid' ? primaryColor : buttonStyle === 'soft' ? `${primaryColor}20` : 'transparent',
                            color: buttonStyle === 'solid' ? '#ffffff' : primaryColor,
                            border: buttonStyle === 'outline' ? `1px solid ${primaryColor}` : 'none',
                            borderRadius: getRadiusStyle('button')
                          }}
                        >
                          Beli Diamond
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1 text-[10px] font-semibold border transition"
                          style={{
                            borderColor: previewBorder,
                            color: previewTextSecondary,
                            borderRadius: getRadiusStyle('button')
                          }}
                        >
                          Cek Status
                        </button>
                      </div>
                    </div>

                    {/* Product Card Showcase Mockup */}
                    <div 
                      className="p-3 border flex items-center justify-between shadow-2xs transition-all"
                      style={{ 
                        backgroundColor: previewSurface, 
                        borderColor: previewBorder,
                        borderRadius: getRadiusStyle('container')
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div 
                          className="w-9 h-9 flex items-center justify-center text-white shrink-0 shadow-2xs"
                          style={{ 
                            backgroundColor: primaryColor, 
                            borderRadius: getRadiusStyle('badge') 
                          }}
                        >
                          <ShoppingBag className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold truncate" style={{ color: previewText }}>
                            Mobile Legends 86 💎
                          </div>
                          <div className="text-[9px] font-medium" style={{ color: previewTextSecondary }}>
                            Proses Otomatis 1 Detik
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span 
                          className="text-[8px] font-bold text-white px-1.5 py-0.5"
                          style={{ 
                            backgroundColor: accentColor,
                            borderRadius: getRadiusStyle('badge')
                          }}
                        >
                          PROMO
                        </span>
                        <div className="text-xs font-black mt-0.5" style={{ color: previewBrandText }}>
                          Rp 22.500
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Form Transaksi Mockup */
                  <div 
                    className="p-3.5 border space-y-3 transition-all relative z-10 shadow-sm"
                    style={{ 
                      backgroundColor: hexToRgba(previewTransactionCardColor, transactionCardOpacity),
                      backdropFilter: transactionCardBlur === "none" ? "none" : transactionCardBlur === "sm" ? "blur(4px)" : transactionCardBlur === "lg" ? "blur(16px)" : "blur(12px)",
                      WebkitBackdropFilter: transactionCardBlur === "none" ? "none" : transactionCardBlur === "sm" ? "blur(4px)" : transactionCardBlur === "lg" ? "blur(16px)" : "blur(12px)",
                      borderColor: previewBorder,
                      borderRadius: getRadiusStyle('container')
                    }}
                  >
                    <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: previewBorder }}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-sky-500 text-white flex items-center justify-center font-bold text-xs">
                          ML
                        </div>
                        <div>
                          <div className="text-xs font-bold" style={{ color: previewText }}>Mobile Legends: Bang Bang</div>
                          <div className="text-[9px]" style={{ color: previewTextSecondary }}>Moonton • Top Up Resmi Instant</div>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded-full">
                        Layer: {transactionCardOpacity}%
                      </span>
                    </div>

                    {/* Step 1: Input Data Akun */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: previewText }}>
                        <span className="w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center text-[9px]">1</span>
                        <span>Masukkan Data Akun</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div 
                          className="p-1.5 border rounded-lg text-[10px] font-mono"
                          style={{
                            backgroundColor: isPreviewDark ? "#1e293b" : "rgba(255,255,255,0.9)",
                            borderColor: previewBorder,
                            color: previewTextSecondary
                          }}
                        >
                          User ID (12345678)
                        </div>
                        <div 
                          className="p-1.5 border rounded-lg text-[10px] font-mono"
                          style={{
                            backgroundColor: isPreviewDark ? "#1e293b" : "rgba(255,255,255,0.9)",
                            borderColor: previewBorder,
                            color: previewTextSecondary
                          }}
                        >
                          Zone ID (1234)
                        </div>
                      </div>
                    </div>

                    {/* Step 2: Pilih Nominal */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: previewText }}>
                        <span className="w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center text-[9px]">2</span>
                        <span>Pilih Nominal Top Up</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div 
                          className="p-2 border-2 rounded-lg text-left relative shadow-2xs"
                          style={{ 
                            borderColor: primaryColor,
                            backgroundColor: isPreviewDark ? "#1e293b" : "#ffffff"
                          }}
                        >
                          <div className="text-[10px] font-bold" style={{ color: primaryColor }}>86 Diamonds</div>
                          <div className="text-[9px] font-extrabold" style={{ color: previewText }}>Rp 22.500</div>
                          <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                        </div>
                        <div 
                          className="p-2 border rounded-lg text-left"
                          style={{
                            borderColor: previewBorder,
                            backgroundColor: isPreviewDark ? "#1e293b" : "rgba(255,255,255,0.8)"
                          }}
                        >
                          <div className="text-[10px] font-bold" style={{ color: previewText }}>172 Diamonds</div>
                          <div className="text-[9px] font-medium" style={{ color: previewTextSecondary }}>Rp 45.000</div>
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Metode Pembayaran */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: previewText }}>
                        <span className="w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center text-[9px]">3</span>
                        <span>Pilih Metode Pembayaran</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div 
                          className="p-1.5 border rounded-lg flex items-center justify-between shadow-2xs"
                          style={{ 
                            borderColor: primaryColor,
                            backgroundColor: isPreviewDark ? "#1e293b" : "#ffffff"
                          }}
                        >
                          <span className="text-[9px] font-bold" style={{ color: previewText }}>QRIS Instant</span>
                          <span className="text-[8px] font-extrabold" style={{ color: primaryColor }}>Rp 22.500</span>
                        </div>
                        <div 
                          className="p-1.5 border rounded-lg flex items-center justify-between"
                          style={{
                            borderColor: previewBorder,
                            backgroundColor: isPreviewDark ? "#1e293b" : "rgba(255,255,255,0.8)"
                          }}
                        >
                          <span className="text-[9px] font-medium" style={{ color: previewText }}>BCA VA</span>
                          <span className="text-[8px]" style={{ color: previewTextSecondary }}>Rp 22.500</span>
                        </div>
                      </div>
                    </div>

                    {/* Tombol Beli */}
                    <div className="pt-1">
                      <button
                        type="button"
                        className="w-full py-2 text-[10px] font-bold text-white shadow-xs flex items-center justify-center gap-1 transition"
                        style={{
                          backgroundColor: primaryColor,
                          borderRadius: getRadiusStyle('button')
                        }}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        Bayar Sekarang (Rp 22.500)
                      </button>
                    </div>
                  </div>
                )}

                {/* Footer Mockup */}
                <div 
                  className="p-3 text-center border-t space-y-1 transition-all relative z-10"
                  style={{ 
                    borderColor: previewBorder,
                    color: previewTextSecondary,
                    backgroundColor: footerBackgroundMode === 'color' && footerBackgroundColor ? footerBackgroundColor : (footerBackgroundMode === 'image' ? 'transparent' : '#0f172a'),
                    backgroundImage: footerBackgroundMode === 'image' && footerBackgroundImage ? `url("${footerBackgroundImage}")` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  <div className="text-[10px] font-extrabold" style={{ color: previewBrandText }}>
                    {displayName}
                  </div>
                  <p className="text-[8px] leading-tight opacity-80">
                    {displayDesc}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-indigo-50/60 rounded-xl p-3 border border-indigo-100/80 flex items-start gap-2 text-indigo-900 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-600" />
              <span>
                Pratinjau di atas merender data nyata secara real-time sesuai palet warna, nama toko, logo, dan bentuk komponen yang sedang Anda tentukan.
              </span>
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
                      } else if (activeMediaTarget === "authBg") {
                        setAuthBackgroundImage(m.url);
                      } else if (activeMediaTarget === "footerBg") {
                        setFooterBackgroundImage(m.url);
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

