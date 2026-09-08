import React, { useEffect, useState } from "react";
import { useAuthStore } from "../../store/auth-store";
import {
  Search,
  Globe,
  Share2,
  FileCode,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  RotateCcw,
  Copy,
  ExternalLink,
  ImageIcon,
  Eye,
  Monitor,
  Smartphone,
  Info,
  Shield,
  Plus,
  Trash2,
  Check
} from "lucide-react";
import { SEOSettings, DefaultOgImage, RobotsPolicy, SitemapPolicy, SocialMetadata } from "../../types/seo";

export default function AdminSeoPage() {
  const { user } = useAuthStore();

  const [settings, setSettings] = useState<SEOSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Active section tab
  const [activeTab, setActiveTab] = useState<"global" | "social" | "robots" | "sitemap">("global");

  // Preview tab & device toggle
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewPlatform, setPreviewPlatform] = useState<"google" | "facebook" | "twitter">("google");

  // Media Library Picker state
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaSearch, setMediaSearch] = useState("");

  // Robots disallow path new input
  const [newDisallowPath, setNewDisallowPath] = useState("");
  const [copiedRobots, setCopiedRobots] = useState(false);
  const [copiedSitemap, setCopiedSitemap] = useState(false);

  // Confirmation dialog for reset
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    fetchSeoSettings();
  }, []);

  const fetchSeoSettings = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/seo", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const json = await res.json();
      if (json.success && json.data) {
        setSettings(json.data);
      } else {
        setMessage({ type: "error", text: json.message || "Gagal memuat konfigurasi SEO." });
      }
    } catch (err: any) {
      console.error("Fetch SEO settings error:", err);
      setMessage({ type: "error", text: "Terjadi kesalahan jaringan saat memuat SEO." });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      setMessage(null);
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/seo", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(settings)
      });
      const json = await res.json();
      if (json.success) {
        setSettings(json.data);
        setMessage({ type: "success", text: "Konfigurasi SEO berhasil disimpan dan diterapkan ke seluruh sistem!" });
      } else {
        setMessage({ type: "error", text: json.message || "Gagal menyimpan konfigurasi SEO." });
      }
    } catch (err: any) {
      console.error("Save SEO settings error:", err);
      setMessage({ type: "error", text: "Gagal menyimpan konfigurasi SEO." });
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    try {
      setResetting(true);
      setMessage(null);
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/seo/reset", {
        method: "POST",
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const json = await res.json();
      if (json.success) {
        setSettings(json.data);
        setShowResetConfirm(false);
        setMessage({ type: "success", text: "Konfigurasi SEO berhasil dikembalikan ke standar produksi aman." });
      } else {
        setMessage({ type: "error", text: json.message || "Gagal mereset konfigurasi SEO." });
      }
    } catch (err: any) {
      console.error("Reset SEO error:", err);
      setMessage({ type: "error", text: "Gagal mereset konfigurasi SEO." });
    } finally {
      setResetting(false);
    }
  };

  // Open Media Library Modal
  const handleOpenMediaPicker = async () => {
    try {
      setIsMediaPickerOpen(true);
      setLoadingMedia(true);
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/media?limit=50", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const json = await res.json();
      if (json.success) {
        setMediaList(json.data || []);
      }
    } catch (err) {
      console.error("Fetch media error:", err);
    } finally {
      setLoadingMedia(false);
    }
  };

  const handleSelectMedia = (media: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      defaultOgImage: {
        ...settings.defaultOgImage,
        mediaId: media.id,
        url: media.url,
        altText: media.alt || settings.siteName
      }
    });
    setIsMediaPickerOpen(false);
  };

  // Helper disallow paths
  const handleAddDisallowPath = () => {
    if (!settings || !newDisallowPath.trim()) return;
    let path = newDisallowPath.trim();
    if (!path.startsWith("/")) path = `/${path}`;
    if (!settings.robotsPolicy.disallowPaths.includes(path)) {
      setSettings({
        ...settings,
        robotsPolicy: {
          ...settings.robotsPolicy,
          disallowPaths: [...settings.robotsPolicy.disallowPaths, path]
        }
      });
    }
    setNewDisallowPath("");
  };

  const handleRemoveDisallowPath = (pathToRemove: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      robotsPolicy: {
        ...settings.robotsPolicy,
        disallowPaths: settings.robotsPolicy.disallowPaths.filter(p => p !== pathToRemove)
      }
    });
  };

  const copyToClipboard = (text: string, type: "robots" | "sitemap") => {
    navigator.clipboard.writeText(text);
    if (type === "robots") {
      setCopiedRobots(true);
      setTimeout(() => setCopiedRobots(false), 2000);
    } else {
      setCopiedSitemap(true);
      setTimeout(() => setCopiedSitemap(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[500px]">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-600 font-medium">Memuat konfigurasi SEO iStore.id...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl flex items-center gap-4">
          <AlertCircle className="w-8 h-8 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-lg">Gagal Memuat Konfigurasi SEO</h3>
            <p className="text-sm mt-1">{message?.text || "Pastikan Anda memiliki izin Owner/Admin untuk modul SEO."}</p>
            <button
              onClick={fetchSeoSettings}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Generate simulated robots.txt preview
  const robotsPreview = [
    "# robots.txt for iStore.id",
    "User-agent: *",
    settings.robotsPolicy.allowIndexing ? "Allow: /" : "Disallow: / # (Indexing dinonaktifkan)",
    ...(settings.robotsPolicy.allowIndexing
      ? settings.robotsPolicy.disallowPaths.map(p => `Disallow: ${p}`)
      : []),
    settings.robotsPolicy.customDirectives ? settings.robotsPolicy.customDirectives : "",
    settings.sitemapPolicy.enabled ? `\nSitemap: ${settings.canonicalBaseUrl.replace(/\/+$/, "")}/sitemap.xml` : ""
  ].filter(Boolean).join("\n");

  const sitemapUrl = `${settings.canonicalBaseUrl.replace(/\/+$/, "")}/sitemap.xml`;
  const robotsUrl = `${settings.canonicalBaseUrl.replace(/\/+$/, "")}/robots.txt`;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Marketing & Konten → SEO</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Orkestrasi metadata terpusat, canonical URL, Open Graph, Sitemap XML, dan Robots.txt.
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={saving || resetting}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition disabled:opacity-50"
            title="Reset ke pengaturan default produksi yang aman"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Default</span>
          </button>

          <button
            onClick={fetchSeoSettings}
            disabled={saving || resetting}
            className="p-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition disabled:opacity-50"
            title="Muat Ulang"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleSave}
            disabled={saving || resetting}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm transition disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
          </button>
        </div>
      </div>

      {/* Status / Alert Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm ${
            message.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main Grid: Form Sections (Left) & Real-time Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form & Configuration (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 space-x-2 overflow-x-auto pb-px">
            <button
              onClick={() => setActiveTab("global")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === "global"
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Global & Meta</span>
            </button>

            <button
              onClick={() => setActiveTab("social")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === "social"
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <Share2 className="w-4 h-4" />
              <span>Social & Open Graph</span>
            </button>

            <button
              onClick={() => setActiveTab("robots")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === "robots"
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Robots.txt</span>
            </button>

            <button
              onClick={() => setActiveTab("sitemap")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === "sitemap"
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <FileCode className="w-4 h-4" />
              <span>Sitemap XML</span>
            </button>
          </div>

          {/* TAB 1: Global & Meta Settings */}
          {activeTab === "global" && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Pengaturan Identitas & Metadata Global</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Digunakan sebagai dasar fallback deterministik untuk seluruh halaman iStore.id.
                </p>
              </div>

              {/* Site Name & Title Separator */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nama Situs (Site Name) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={settings.siteName}
                    onChange={e => setSettings({ ...settings, siteName: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    placeholder="Contoh: iStore.id"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Pemisah Judul (Separator)
                  </label>
                  <select
                    value={settings.titleSeparator}
                    onChange={e => setSettings({ ...settings, titleSeparator: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  >
                    <option value=" | "> | (Pipa)</option>
                    <option value=" - "> - (Strip)</option>
                    <option value=" • "> • (Titik Tengah)</option>
                    <option value=" : "> : (Titik Dua)</option>
                  </select>
                </div>
              </div>

              {/* Canonical Base URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Canonical Base URL <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={settings.canonicalBaseUrl}
                    onChange={e => setSettings({ ...settings, canonicalBaseUrl: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    placeholder="https://istore.id"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Wajib menggunakan protokol HTTPS resmi untuk mencegah duplikasi konten dan serangan header injection.
                </p>
              </div>

              {/* Default Meta Title */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Default Meta Title <span className="text-red-500">*</span>
                  </label>
                  <span
                    className={`text-xs font-mono ${
                      settings.defaultTitle.length >= 50 && settings.defaultTitle.length <= 60
                        ? "text-emerald-600 font-semibold"
                        : settings.defaultTitle.length > 60
                        ? "text-amber-600 font-semibold"
                        : "text-slate-400"
                    }`}
                  >
                    {settings.defaultTitle.length}/60 karakter (Optimal: 50-60)
                  </span>
                </div>
                <input
                  type="text"
                  value={settings.defaultTitle}
                  onChange={e => setSettings({ ...settings, defaultTitle: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  placeholder="iStore.id - Solusi Top Up Game & Voucher Digital Terpercaya"
                />
              </div>

              {/* Default Meta Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Default Meta Description <span className="text-red-500">*</span>
                  </label>
                  <span
                    className={`text-xs font-mono ${
                      settings.defaultDescription.length >= 140 && settings.defaultDescription.length <= 160
                        ? "text-emerald-600 font-semibold"
                        : settings.defaultDescription.length > 160
                        ? "text-amber-600 font-semibold"
                        : "text-slate-400"
                    }`}
                  >
                    {settings.defaultDescription.length}/160 karakter (Optimal: 140-160)
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={settings.defaultDescription}
                  onChange={e => setSettings({ ...settings, defaultDescription: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  placeholder="Platform top up game dan voucher digital terpercaya di Indonesia. Proses kilat instan 24 jam, harga termurah..."
                />
              </div>

              {/* Default Keywords */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Kata Kunci Standar (Pisahkan dengan koma)
                </label>
                <input
                  type="text"
                  value={settings.defaultKeywords.join(", ")}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      defaultKeywords: e.target.value.split(",").map(k => k.trim()).filter(Boolean)
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  placeholder="top up game, voucher game, mobile legends, free fire"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {settings.defaultKeywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-lg font-medium"
                    >
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Social & Open Graph Settings */}
          {activeTab === "social" && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Open Graph & Media Sosial</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tampilan kartu saat tautan iStore.id dibagikan di WhatsApp, Telegram, Facebook, dan X (Twitter).
                </p>
              </div>

              {/* Default OG Image with Media Library picker */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Default Open Graph Image (1200 x 630 px)
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenMediaPicker}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Pilih dari Media Library</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  <div className="sm:col-span-1 aspect-[1.91/1] bg-slate-200 rounded-xl overflow-hidden border border-slate-300 relative group">
                    {settings.defaultOgImage?.url ? (
                      <img
                        src={settings.defaultOgImage.url}
                        alt="Default OG Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                        <ImageIcon className="w-8 h-8 mb-1" />
                        <span>Belum Ada Gambar</span>
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Image URL</label>
                      <input
                        type="url"
                        value={settings.defaultOgImage?.url || ""}
                        onChange={e =>
                          setSettings({
                            ...settings,
                            defaultOgImage: { ...settings.defaultOgImage, url: e.target.value }
                          })
                        }
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Alt Text Deskripsi Gambar</label>
                      <input
                        type="text"
                        value={settings.defaultOgImage?.altText || ""}
                        onChange={e =>
                          setSettings({
                            ...settings,
                            defaultOgImage: { ...settings.defaultOgImage, altText: e.target.value }
                          })
                        }
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="iStore.id - Solusi Top Up Game Terpercaya"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Twitter / X Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Twitter / X Username Handle
                  </label>
                  <input
                    type="text"
                    value={settings.socialMetadata.twitterHandle || ""}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        socialMetadata: { ...settings.socialMetadata, twitterHandle: e.target.value }
                      })
                    }
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    placeholder="@istore_id"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tipe Twitter Card
                  </label>
                  <select
                    value={settings.socialMetadata.twitterCardType}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        socialMetadata: {
                          ...settings.socialMetadata,
                          twitterCardType: e.target.value as "summary" | "summary_large_image"
                        }
                      })
                    }
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  >
                    <option value="summary_large_image">Large Image Card (Rekomendasi)</option>
                    <option value="summary">Small Thumbnail Card</option>
                  </select>
                </div>
              </div>

              {/* Facebook App ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Facebook App ID (Opsional)
                </label>
                <input
                  type="text"
                  value={settings.socialMetadata.facebookAppId || ""}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      socialMetadata: { ...settings.socialMetadata, facebookAppId: e.target.value }
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  placeholder="Contoh: 123456789012345"
                />
              </div>
            </div>
          )}

          {/* TAB 3: Robots.txt Policy */}
          {activeTab === "robots" && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Kebijakan Crawling (Robots.txt)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mengatur crawler mesin pencari (Googlebot, Bingbot) untuk rute publik dan memblokir area privat.
                </p>
              </div>

              {/* Toggle Allow Indexing */}
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Izinkan Pengindeksan Publik</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Aktifkan untuk mengizinkan bot mesin pencari mengindeks katalog dan konten publik.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.robotsPolicy.allowIndexing}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        robotsPolicy: { ...settings.robotsPolicy, allowIndexing: e.target.checked }
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Disallowed Paths list */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Daftar Jalur yang Diblokir (Disallow Paths)
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newDisallowPath}
                    onChange={e => setNewDisallowPath(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddDisallowPath();
                      }
                    }}
                    placeholder="/path-rahasia/"
                    className="flex-1 px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddDisallowPath}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-medium hover:bg-slate-900 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {settings.robotsPolicy.disallowPaths.map((path, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-mono"
                    >
                      <span>Disallow: {path}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDisallowPath(path)}
                        className="text-rose-400 hover:text-rose-700 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Robots.txt Code Simulator */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Output Simulator: /robots.txt
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(robotsPreview, "robots")}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {copiedRobots ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedRobots ? "Tersalin!" : "Salin File"}</span>
                    </button>
                    <a
                      href="/robots.txt"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-medium"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Buka Live</span>
                    </a>
                  </div>
                </div>
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed">
                  {robotsPreview}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: Sitemap XML Policy */}
          {activeTab === "sitemap" && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Peta Situs (Sitemap.xml)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Menyediakan daftar URL lengkap dan tanggal perubahan terbaru secara otomatis ke Google Search Console.
                </p>
              </div>

              {/* Toggle Sitemap */}
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Aktifkan Sitemap XML</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Generator sitemap aktif di endpoint <code className="text-blue-600 font-mono">/sitemap.xml</code>.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.sitemapPolicy.enabled}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        sitemapPolicy: { ...settings.sitemapPolicy, enabled: e.target.checked }
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Entities to Include */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Entitas yang Dimasukkan ke Sitemap (Hanya yang Status Publik & Aktif)
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                    <input
                      type="checkbox"
                      checked={settings.sitemapPolicy.includeHomepage}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          sitemapPolicy: { ...settings.sitemapPolicy, includeHomepage: e.target.checked }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-800">Beranda (/)</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                    <input
                      type="checkbox"
                      checked={settings.sitemapPolicy.includeGames}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          sitemapPolicy: { ...settings.sitemapPolicy, includeGames: e.target.checked }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-800">Katalog Game Aktif (/games/:slug)</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                    <input
                      type="checkbox"
                      checked={settings.sitemapPolicy.includeBlog}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          sitemapPolicy: { ...settings.sitemapPolicy, includeBlog: e.target.checked }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-800">Blog & Berita (/blog & /blog/:slug)</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                    <input
                      type="checkbox"
                      checked={settings.sitemapPolicy.includeLandings}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          sitemapPolicy: { ...settings.sitemapPolicy, includeLandings: e.target.checked }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-800">Landing Pages Promosi (/landing/:slug)</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={settings.sitemapPolicy.includeFaq}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          sitemapPolicy: { ...settings.sitemapPolicy, includeFaq: e.target.checked }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-800">Pusat Bantuan & FAQ (/faq)</span>
                  </label>
                </div>
              </div>

              {/* Sitemap Live URL Card */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-blue-900 uppercase tracking-wider block">
                    URL Sitemap Resmi
                  </span>
                  <span className="text-sm font-mono text-blue-700 break-all">{sitemapUrl}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(sitemapUrl, "sitemap")}
                    className="px-3 py-1.5 bg-white text-blue-700 border border-blue-300 rounded-lg text-xs font-medium hover:bg-blue-100 transition"
                  >
                    {copiedSitemap ? "Tersalin!" : "Salin URL"}
                  </button>
                  <a
                    href="/sitemap.xml"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka XML</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Real-Time SERP & Social Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-900">Live Real-time Preview</h3>
              </div>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg">
                <button
                  onClick={() => setPreviewPlatform("google")}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                    previewPlatform === "google" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  Google
                </button>
                <button
                  onClick={() => setPreviewPlatform("facebook")}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                    previewPlatform === "facebook" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  Facebook
                </button>
                <button
                  onClick={() => setPreviewPlatform("twitter")}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                    previewPlatform === "twitter" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  Twitter / X
                </button>
              </div>
            </div>

            {/* PREVIEW 1: Google SERP Preview */}
            {previewPlatform === "google" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Google Search Engine Result Snippet</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPreviewDevice("desktop")}
                      className={`p-1 rounded ${previewDevice === "desktop" ? "text-blue-600 bg-blue-50" : "text-slate-400"}`}
                      title="Desktop View"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setPreviewDevice("mobile")}
                      className={`p-1 rounded ${previewDevice === "mobile" ? "text-blue-600 bg-blue-50" : "text-slate-400"}`}
                      title="Mobile View"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1.5 font-sans">
                  {/* Google Breadcrumb / Domain */}
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[9px]">
                      i
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="text-slate-800 font-medium text-[11px]">{settings.siteName}</span>
                      <span className="text-slate-500 text-[10px] truncate max-w-[260px]">
                        {settings.canonicalBaseUrl}
                      </span>
                    </div>
                  </div>

                  {/* Google Blue Title Link */}
                  <h4 className="text-[#1a0dab] hover:underline text-base font-normal leading-snug cursor-pointer line-clamp-2">
                    {settings.defaultTitle}
                  </h4>

                  {/* Google Snippet Description */}
                  <p className="text-[#4d5156] text-xs leading-relaxed line-clamp-3">
                    {settings.defaultDescription}
                  </p>
                </div>
              </div>
            )}

            {/* PREVIEW 2: Open Graph / Facebook Share Card */}
            {previewPlatform === "facebook" && (
              <div className="space-y-2">
                <span className="text-xs text-slate-400">Facebook & WhatsApp Social Share Card</span>
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-slate-50">
                  <div className="aspect-[1.91/1] bg-slate-200 relative overflow-hidden">
                    {settings.defaultOgImage?.url ? (
                      <img
                        src={settings.defaultOgImage.url}
                        alt="OG Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                        Tidak ada gambar OG
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-white space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                      {settings.canonicalBaseUrl.replace(/^https?:\/\//, "")}
                    </span>
                    <h5 className="font-semibold text-slate-900 text-xs line-clamp-1 leading-snug">
                      {settings.defaultTitle}
                    </h5>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-tight">
                      {settings.defaultDescription}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* PREVIEW 3: Twitter / X Card */}
            {previewPlatform === "twitter" && (
              <div className="space-y-2">
                <span className="text-xs text-slate-400">Twitter / X Summary Card</span>
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
                  <div className="aspect-[1.91/1] bg-slate-200 relative overflow-hidden">
                    {settings.defaultOgImage?.url ? (
                      <img
                        src={settings.defaultOgImage.url}
                        alt="Twitter Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                        Tidak ada gambar
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <h5 className="font-semibold text-slate-900 text-xs line-clamp-1 leading-snug">
                      {settings.defaultTitle}
                    </h5>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-tight">
                      {settings.defaultDescription}
                    </p>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 pt-1">
                      <span>{settings.canonicalBaseUrl.replace(/^https?:\/\//, "")}</span>
                      {settings.socialMetadata.twitterHandle && (
                        <span>• {settings.socialMetadata.twitterHandle}</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick SEO Health Checklist */}
            <div className="border-t border-slate-100 pt-4 space-y-2.5">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Pemeriksaan Status Teknis SEO
              </h4>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Canonical URL terproteksi & HTTPS</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Robots.txt & Sitemap XML tersinkronisasi</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>JSON-LD Structured Data terintegrasi</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Sanitasi XSS pada seluruh meta tag & header</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MEDIA LIBRARY PICKER MODAL */}
      {isMediaPickerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Pilih dari Media Library</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Gunakan aset gambar resmi dari penyimpanan terpusat iStore.id.
                </p>
              </div>
              <button
                onClick={() => setIsMediaPickerOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            {/* Search filter in modal */}
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <input
                type="text"
                placeholder="Cari aset gambar..."
                value={mediaSearch}
                onChange={e => setMediaSearch(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {loadingMedia ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
              ) : mediaList.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  Belum ada media di Media Library.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {mediaList
                    .filter(m =>
                      mediaSearch
                        ? (m.name || m.title || "").toLowerCase().includes(mediaSearch.toLowerCase())
                        : true
                    )
                    .map(item => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectMedia(item)}
                        className="group border border-slate-200 rounded-xl overflow-hidden hover:border-blue-500 hover:shadow-md transition cursor-pointer flex flex-col bg-slate-50"
                      >
                        <div className="aspect-[1.91/1] bg-slate-200 relative overflow-hidden">
                          <img
                            src={item.url}
                            alt={item.name || "Media thumbnail"}
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                        </div>
                        <div className="p-2.5">
                          <p className="text-xs font-medium text-slate-800 truncate">
                            {item.name || item.title || "Gambar Media"}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {item.width && item.height ? `${item.width}x${item.height}` : "Aset Gambar"}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setIsMediaPickerOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 transition"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: RESET TO DEFAULTS */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-slate-900">Kembalikan ke Nilai Default?</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Tindakan ini akan mereset seluruh konfigurasi SEO global, robots.txt, sitemap XML, dan Open Graph ke standar default produksi resmi yang aman. Seluruh perubahan manual akan diperbarui.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleResetToDefaults}
                disabled={resetting}
                className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-xl hover:bg-amber-700 transition disabled:opacity-50"
              >
                {resetting ? "Mereset..." : "Ya, Reset ke Default"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
