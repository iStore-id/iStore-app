import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../store/auth-store";
import { Palette, Save, Loader2, Info, Image as ImageIcon, Eye, RefreshCw, Sparkles, Check } from "lucide-react";
import { StoreConfiguration } from "../../types/core";

interface MediaItem {
  id: string;
  originalName: string;
  url: string;
}

const COLOR_PRESETS = [
  { name: "Ocean Blue", primary: "#3b82f6", secondary: "#1d4ed8", brandText: "#1e3a8a" },
  { name: "Emerald Green", primary: "#10b981", secondary: "#047857", brandText: "#064e3b" },
  { name: "Amber Gold", primary: "#f59e0b", secondary: "#b45309", brandText: "#78350f" },
  { name: "Crimson Red", primary: "#ef4444", secondary: "#b91c1c", brandText: "#7f1d1d" },
  { name: "Midnight Indigo", primary: "#6366f1", secondary: "#4338ca", brandText: "#312e81" },
  { name: "Deep Orchid", primary: "#8b5cf6", secondary: "#6d28d9", brandText: "#4c1d95" }
];

export default function AdminBrandingPage() {
  const { user } = useAuthStore();
  const [config, setConfig] = useState<StoreConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState("");
  const [favicon, setFavicon] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#3b82f6");
  const [secondaryColor, setSecondaryColor] = useState("#1d4ed8");
  const [brandTextColor, setBrandTextColor] = useState("#1e3a8a");

  // Media Library Picker Modal
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [activeMediaTarget, setActiveMediaTarget] = useState<"logo" | "favicon" | null>(null);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);

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
        setLogo(cfg.logo || "");
        setFavicon(cfg.favicon || "");
        setPrimaryColor(cfg.primaryColor || "#3b82f6");
        setSecondaryColor(cfg.secondaryColor || "#1d4ed8");
        setBrandTextColor(cfg.brandTextColor || cfg.primaryColor || "#1e3a8a");
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

  const openMediaPicker = (target: "logo" | "favicon") => {
    setActiveMediaTarget(target);
    setIsMediaPickerOpen(true);
    fetchMediaLibrary();
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
      primaryColor,
      secondaryColor,
      brandTextColor,
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-medium text-gray-500">Memuat preferensi branding...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Palette className="w-6 h-6 text-indigo-600" />
            Pengaturan Branding
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Kelola identitas visual iStore Anda, mulai dari logo, nama toko, tagline, hingga palet warna utama.
          </p>
        </div>
        <button
          onClick={fetchConfig}
          title="Segarkan data"
          className="p-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-800 text-sm font-medium rounded-xl border border-emerald-100 flex items-start gap-2">
          <Check className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Configuration Form */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <h2 className="text-md font-semibold text-gray-900 border-b pb-2 mb-4">Identitas Dasar Toko</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nama Toko</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: iStore.id"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Tagline Toko</label>
                  <input
                    type="text"
                    required
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="Contoh: Top up game cepat dan aman"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Deskripsi Toko</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tuliskan deskripsi singkat toko Anda..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-md font-semibold text-gray-900 border-b pb-2 mb-4">Aset Visual (Media Library)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Logo Toko</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      placeholder="Pilih logo dari media..."
                      value={logo}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => openMediaPicker("logo")}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap transition"
                    >
                      Pilih
                    </button>
                  </div>
                  {logo && (
                    <div className="mt-2 w-32 h-16 rounded-lg overflow-hidden border bg-gray-50 flex items-center justify-center">
                      <img src={logo} alt="Logo Toko" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Favicon Toko</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      placeholder="Pilih favicon..."
                      value={favicon}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => openMediaPicker("favicon")}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap transition"
                    >
                      Pilih
                    </button>
                  </div>
                  {favicon && (
                    <div className="mt-2 w-10 h-10 rounded-lg overflow-hidden border bg-gray-50 flex items-center justify-center">
                      <img src={favicon} alt="Favicon Toko" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-md font-semibold text-gray-900 border-b pb-2 mb-4">Skema Warna & Tema</h2>
              
              {/* Presets Grid */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Preset Pilihan Warna</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {COLOR_PRESETS.map((p) => {
                    const isSelected = primaryColor === p.primary && secondaryColor === p.secondary;
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => {
                          setPrimaryColor(p.primary);
                          setSecondaryColor(p.secondary);
                          setBrandTextColor(p.brandText);
                        }}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-left text-xs font-medium transition ${
                          isSelected ? "border-indigo-600 bg-indigo-50/50" : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex shrink-0">
                          <div className="w-4 h-4 rounded-l-md" style={{ backgroundColor: p.primary }} />
                          <div className="w-4 h-4 rounded-r-md" style={{ backgroundColor: p.secondary }} />
                        </div>
                        <span className="truncate">{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Color Pickers */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Warna Utama (Primary)</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-10 h-9 p-0 border border-gray-300 rounded-lg cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      maxLength={7}
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg uppercase font-mono focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Warna Sekunder (Secondary)</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-10 h-9 p-0 border border-gray-300 rounded-lg cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      maxLength={7}
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg uppercase font-mono focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Warna Teks Brand</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={brandTextColor}
                      onChange={(e) => setBrandTextColor(e.target.value)}
                      className="w-10 h-9 p-0 border border-gray-300 rounded-lg cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      maxLength={7}
                      value={brandTextColor}
                      onChange={(e) => setBrandTextColor(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg uppercase font-mono focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition shadow-sm disabled:opacity-50"
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

        {/* Right Side: Interactive Preview */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex-1">
            <h2 className="text-md font-semibold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-500" />
              Live Preview Website Publik
            </h2>
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col min-h-[350px]">
              {/* Header Preview */}
              <div className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center shadow-xs">
                <div className="flex items-center gap-2">
                  {logo ? (
                    <img src={logo} alt="Store logo" className="h-6 w-auto object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-6 w-6 rounded flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: primaryColor }}>
                      {name ? name.charAt(0).toUpperCase() : "I"}
                    </div>
                  )}
                  <span className="font-bold text-sm" style={{ color: brandTextColor }}>{name || "iStore.id"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 hover:text-gray-800 cursor-pointer">Catalog</span>
                  <span className="text-xs text-gray-500 hover:text-gray-800 cursor-pointer">Track</span>
                </div>
              </div>

              {/* Hero Banner Preview */}
              <div className="p-6 flex-1 flex flex-col justify-center items-center text-center bg-gray-50">
                <div className="max-w-xs space-y-3">
                  <h3 className="text-lg font-extrabold text-gray-900 tracking-tight leading-snug">
                    Selamat Datang di <span style={{ color: brandTextColor }}>{name || "iStore.id"}</span>
                  </h3>
                  <p className="text-xs text-gray-600 leading-normal">
                    {tagline || "Top up game cepat dan aman"}
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      className="px-4 py-2 text-xs font-semibold text-white rounded-lg transition"
                      style={{ backgroundColor: primaryColor }}
                      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = secondaryColor)}
                      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = primaryColor)}
                    >
                      Beli Sekarang
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer Preview */}
              <div className="bg-gray-100 px-4 py-3 border-t text-center">
                <p className="text-[10px] text-gray-500 font-medium">
                  © 2026 {name || "iStore.id"}. {description || "Platform Top Up Game Terpercaya"}
                </p>
              </div>
            </div>

            <div className="mt-4 bg-amber-50 rounded-xl p-3 border border-amber-100 flex items-start gap-2 text-amber-800 text-xs">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <span>
                Pratinjau di atas merepresentasikan bagaimana komponen website publik Anda akan disesuaikan secara dinamis berdasarkan warna, logo, dan nama yang Anda simpan.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Media Picker Modal */}
      {isMediaPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 text-sm">Pilih Aset untuk {activeMediaTarget === "logo" ? "Logo Toko" : "Favicon Toko"}</h3>
              <button
                onClick={() => setIsMediaPickerOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-semibold text-lg"
              >
                ✕
              </button>
            </div>
            
            {mediaLoading ? (
              <div className="flex flex-col items-center justify-center p-8 flex-1 gap-2">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                <span className="text-xs text-gray-500 font-medium">Mengambil media library...</span>
              </div>
            ) : mediaList.length === 0 ? (
              <div className="p-8 text-center flex-1 text-gray-500 text-xs">
                Tidak ada aset media yang ditemukan. Silakan unggah aset melalui halaman Media Library terlebih dahulu.
              </div>
            ) : (
              <div className="p-4 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-3 flex-1">
                {mediaList.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      if (activeMediaTarget === "logo") {
                        setLogo(m.url);
                      } else {
                        setFavicon(m.url);
                      }
                      setIsMediaPickerOpen(false);
                    }}
                    className="cursor-pointer group bg-white border border-gray-200 rounded-xl overflow-hidden hover:ring-2 hover:ring-indigo-500 transition"
                  >
                    <div className="aspect-square bg-gray-50 overflow-hidden flex items-center justify-center p-2">
                      <img src={m.url} alt={m.originalName} className="max-w-full max-h-full object-contain group-hover:scale-105 transition" referrerPolicy="no-referrer" />
                    </div>
                    <p className="p-2 text-[10px] truncate text-gray-700 font-medium border-t">{m.originalName}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
