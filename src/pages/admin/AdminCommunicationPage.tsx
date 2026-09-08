import React, { useEffect, useState } from "react";
import { useAuthStore } from "../../store/auth-store";
import {
  Mail,
  Phone,
  MessageSquare,
  MapPin,
  Globe,
  Instagram,
  Facebook,
  Youtube,
  Send,
  Twitter,
  Save,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Info,
  Settings,
  Link,
  ShieldCheck,
  Server
} from "lucide-react";
import { StoreConfiguration } from "../../types/core";

export default function AdminCommunicationPage() {
  const { user } = useAuthStore();

  const [config, setConfig] = useState<StoreConfiguration | null>(null);
  const [initialConfig, setInitialConfig] = useState<StoreConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchStoreConfig();
  }, []);

  const fetchStoreConfig = async () => {
    try {
      setLoading(true);
      setMessage(null);
      setValidationErrors({});
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/store-config", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const json = await res.json();
      if (json.success && json.data) {
        setConfig(json.data);
        setInitialConfig(JSON.parse(JSON.stringify(json.data)));
      } else {
        setMessage({ type: "error", text: json.message || "Gagal memuat konfigurasi toko." });
      }
    } catch (err: any) {
      console.error("Fetch config error:", err);
      setMessage({ type: "error", text: "Terjadi kesalahan jaringan saat memuat data." });
    } finally {
      setLoading(false);
    }
  };

  const validateUrl = (url: string, platform: string): string | null => {
    if (!url || url.trim() === "") return null;
    const trimmed = url.trim();
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "https:") {
        return `URL ${platform} harus menggunakan skema aman HTTPS (https://).`;
      }
      if (["javascript:", "data:", "blob:"].includes(parsed.protocol)) {
        return `Skema protokol pada URL ${platform} tidak aman/didukung.`;
      }
      return null;
    } catch (e) {
      return `Format URL ${platform} tidak valid. Pastikan menyertakan protokol lengkap (e.g., https://instagram.com/akun).`;
    }
  };

  const validateAll = (): boolean => {
    if (!config) return false;
    const errors: Record<string, string> = {};

    // Validate email format if provided
    const email = config.contactInformation?.email;
    if (email && email.trim() !== "") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors["email"] = "Format alamat email tidak valid.";
      }
    }

    // Validate social media URLs
    const social = config.basicInformation?.socialMedia || {};
    const platforms = ["instagram", "facebook", "tiktok", "youtube", "telegram", "twitter"];
    
    platforms.forEach((p) => {
      const url = social[p];
      const error = validateUrl(url, p.charAt(0).toUpperCase() + p.slice(1));
      if (error) {
        errors[p] = error;
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!config) return;
    if (!validateAll()) {
      setMessage({ type: "error", text: "Harap perbaiki beberapa kesalahan masukan terlebih dahulu." });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/store-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(config)
      });
      const json = await res.json();
      if (json.success && json.data) {
        setConfig(json.data);
        setInitialConfig(JSON.parse(JSON.stringify(json.data)));
        setMessage({ type: "success", text: "Pengaturan komunikasi berhasil disimpan dan diperbarui!" });
      } else {
        setMessage({ type: "error", text: json.message || "Gagal menyimpan pengaturan." });
      }
    } catch (err: any) {
      console.error("Save config error:", err);
      setMessage({ type: "error", text: "Terjadi kesalahan jaringan saat menyimpan konfigurasi." });
    } finally {
      setSaving(false);
    }
  };

  const isDirty = () => {
    if (!config || !initialConfig) return false;
    return JSON.stringify(config) !== JSON.stringify(initialConfig);
  };

  const updateContactField = (field: keyof StoreConfiguration["contactInformation"], value: string) => {
    if (!config) return;
    setConfig({
      ...config,
      contactInformation: {
        ...config.contactInformation,
        [field]: value
      }
    });
  };

  const updateSocialField = (platform: string, value: string) => {
    if (!config) return;
    const social = config.basicInformation?.socialMedia || {};
    setConfig({
      ...config,
      basicInformation: {
        ...config.basicInformation,
        socialMedia: {
          ...social,
          [platform]: value
        }
      }
    });
  };

  if (loading) {
    return (
      <div id="loading-container" className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <RefreshCw className="h-8 w-8 text-neutral-400 animate-spin" />
        <p className="text-sm text-neutral-500 font-medium">Memuat pengaturan komunikasi...</p>
      </div>
    );
  }

  return (
    <div id="communication-settings-page" className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div id="page-header" className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-neutral-100 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings className="h-5 w-5 text-neutral-400" />
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Pengaturan</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Kanal Komunikasi & Kontak</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Kelola data kontak resmi toko, tautan media sosial, serta tinjau status infrastruktur pesan otomatis.
          </p>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3">
          {isDirty() && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-medium border border-amber-100 animate-pulse">
              Ada Perubahan Belum Disimpan
            </span>
          )}
          <button
            id="btn-save-communication"
            onClick={handleSave}
            disabled={saving || !isDirty()}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              isDirty() 
                ? "bg-neutral-900 text-white hover:bg-neutral-800 shadow-md shadow-neutral-200" 
                : "bg-neutral-100 text-neutral-400 cursor-not-allowed"
            }`}
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Simpan Perubahan
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {message && (
        <div
          id="alert-message"
          className={`flex items-start gap-3 p-4 rounded-xl border ${
            message.type === "success" 
              ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
              : "bg-rose-50 border-rose-100 text-rose-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="text-sm">
            <p className="font-semibold">{message.type === "success" ? "Berhasil" : "Gagal"}</p>
            <p className="text-neutral-600 mt-0.5">{message.text}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Column 1 & 2: Forms */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Section A: Official Contact Info */}
          <div className="bg-white border border-neutral-100 rounded-xl p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                <Phone className="h-5 w-5 text-neutral-500" />
                <span>Informasi Kontak Resmi Toko</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Detail kontak ini ditampilkan kepada pelanggan pada halaman bantuan, footer situs, dan tanda terima pesanan.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Email Support */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-neutral-400" /> Email Bantuan (Support)
                </label>
                <input
                  type="email"
                  className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:ring-1 focus:ring-neutral-900 focus:outline-none transition-all ${
                    validationErrors["email"] ? "border-rose-300 bg-rose-50/10 focus:ring-rose-400" : "border-neutral-200"
                  }`}
                  placeholder="e.g., support@istore.id"
                  value={config?.contactInformation?.email || ""}
                  onChange={(e) => updateContactField("email", e.target.value)}
                />
                {validationErrors["email"] && (
                  <p className="text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {validationErrors["email"]}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-neutral-400" /> Nomor Telepon Kantor
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 text-sm focus:ring-1 focus:ring-neutral-900 focus:outline-none transition-all"
                  placeholder="e.g., 021-12345678"
                  value={config?.contactInformation?.phone || ""}
                  onChange={(e) => updateContactField("phone", e.target.value)}
                />
              </div>

              {/* WhatsApp Bantuan */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-neutral-400" /> WhatsApp Admin (Pelanggan)
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 text-sm focus:ring-1 focus:ring-neutral-900 focus:outline-none transition-all"
                  placeholder="e.g., 6281234567890 (Gunakan kode negara)"
                  value={config?.contactInformation?.whatsapp || ""}
                  onChange={(e) => updateContactField("whatsapp", e.target.value)}
                />
                <p className="text-[10px] text-neutral-400">
                  Digunakan untuk mengarahkan tombol "Hubungi Kami" atau bantuan instan via obrolan WA.
                </p>
              </div>

              {/* Alamat Kantor */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-neutral-400" /> Alamat Fisik / Kantor Pusat
                </label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 text-sm focus:ring-1 focus:ring-neutral-900 focus:outline-none transition-all resize-none"
                  placeholder="e.g., Gedung iStore Lt. 5, Jl. Sudirman No. 21, Jakarta Selatan, 12190"
                  value={config?.contactInformation?.address || ""}
                  onChange={(e) => updateContactField("address", e.target.value)}
                />
              </div>

            </div>
          </div>

          {/* Section B: Social Media Profiles */}
          <div className="bg-white border border-neutral-100 rounded-xl p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                <Globe className="h-5 w-5 text-neutral-500" />
                <span>Profil Media Sosial Toko</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Tautkan profil media sosial resmi toko Anda. Kosongkan isian URL untuk menyembunyikan ikon sosial media tersebut pada halaman situs publik.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Instagram */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Instagram className="h-3.5 w-3.5 text-neutral-400" /> Instagram
                </label>
                <input
                  type="text"
                  className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:ring-1 focus:ring-neutral-900 focus:outline-none transition-all ${
                    validationErrors["instagram"] ? "border-rose-300 bg-rose-50/10 focus:ring-rose-400" : "border-neutral-200"
                  }`}
                  placeholder="https://instagram.com/akun-toko"
                  value={config?.basicInformation?.socialMedia?.instagram || ""}
                  onChange={(e) => updateSocialField("instagram", e.target.value)}
                />
                {validationErrors["instagram"] && (
                  <p className="text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {validationErrors["instagram"]}
                  </p>
                )}
              </div>

              {/* Facebook */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Facebook className="h-3.5 w-3.5 text-neutral-400" /> Facebook Page
                </label>
                <input
                  type="text"
                  className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:ring-1 focus:ring-neutral-900 focus:outline-none transition-all ${
                    validationErrors["facebook"] ? "border-rose-300 bg-rose-50/10 focus:ring-rose-400" : "border-neutral-200"
                  }`}
                  placeholder="https://facebook.com/halaman-toko"
                  value={config?.basicInformation?.socialMedia?.facebook || ""}
                  onChange={(e) => updateSocialField("facebook", e.target.value)}
                />
                {validationErrors["facebook"] && (
                  <p className="text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {validationErrors["facebook"]}
                  </p>
                )}
              </div>

              {/* TikTok */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-neutral-400" /> TikTok
                </label>
                <input
                  type="text"
                  className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:ring-1 focus:ring-neutral-900 focus:outline-none transition-all ${
                    validationErrors["tiktok"] ? "border-rose-300 bg-rose-50/10 focus:ring-rose-400" : "border-neutral-200"
                  }`}
                  placeholder="https://tiktok.com/@akun-toko"
                  value={config?.basicInformation?.socialMedia?.tiktok || ""}
                  onChange={(e) => updateSocialField("tiktok", e.target.value)}
                />
                {validationErrors["tiktok"] && (
                  <p className="text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {validationErrors["tiktok"]}
                  </p>
                )}
              </div>

              {/* YouTube */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Youtube className="h-3.5 w-3.5 text-neutral-400" /> YouTube Channel
                </label>
                <input
                  type="text"
                  className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:ring-1 focus:ring-neutral-900 focus:outline-none transition-all ${
                    validationErrors["youtube"] ? "border-rose-300 bg-rose-50/10 focus:ring-rose-400" : "border-neutral-200"
                  }`}
                  placeholder="https://youtube.com/c/saluran-toko"
                  value={config?.basicInformation?.socialMedia?.youtube || ""}
                  onChange={(e) => updateSocialField("youtube", e.target.value)}
                />
                {validationErrors["youtube"] && (
                  <p className="text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {validationErrors["youtube"]}
                  </p>
                )}
              </div>

              {/* Telegram */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 text-neutral-400" /> Telegram Group / Channel
                </label>
                <input
                  type="text"
                  className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:ring-1 focus:ring-neutral-900 focus:outline-none transition-all ${
                    validationErrors["telegram"] ? "border-rose-300 bg-rose-50/10 focus:ring-rose-400" : "border-neutral-200"
                  }`}
                  placeholder="https://t.me/grup-toko"
                  value={config?.basicInformation?.socialMedia?.telegram || ""}
                  onChange={(e) => updateSocialField("telegram", e.target.value)}
                />
                {validationErrors["telegram"] && (
                  <p className="text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {validationErrors["telegram"]}
                  </p>
                )}
              </div>

              {/* Twitter / X */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Twitter className="h-3.5 w-3.5 text-neutral-400" /> Twitter / X
                </label>
                <input
                  type="text"
                  className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:ring-1 focus:ring-neutral-900 focus:outline-none transition-all ${
                    validationErrors["twitter"] ? "border-rose-300 bg-rose-50/10 focus:ring-rose-400" : "border-neutral-200"
                  }`}
                  placeholder="https://x.com/akun-toko"
                  value={config?.basicInformation?.socialMedia?.twitter || ""}
                  onChange={(e) => updateSocialField("twitter", e.target.value)}
                />
                {validationErrors["twitter"] && (
                  <p className="text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {validationErrors["twitter"]}
                  </p>
                )}
              </div>

            </div>
          </div>

        </div>

        {/* Column 3: Sidebar Details */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Section C: Live Delivery Infrastructure Honesty Card */}
          <div className="bg-white border border-neutral-100 rounded-xl p-6 shadow-sm space-y-5">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                <Server className="h-4.5 w-4.5 text-neutral-500" />
                <span>Infrastruktur Notifikasi Otomatis</span>
              </h3>
              <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                Status pengiriman pesan transaksional & real-time sistem otomatis kepada pelanggan.
              </p>
            </div>

            <div className="space-y-3.5">
              
              {/* Email Gateway */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50/50 border border-neutral-100">
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-neutral-400" />
                  <span className="text-xs font-bold text-neutral-700">Email Gateway</span>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 border border-neutral-200 uppercase tracking-wide">
                  Belum Dikonfigurasi
                </span>
              </div>

              {/* WhatsApp Messaging */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50/50 border border-neutral-100">
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="h-4 w-4 text-neutral-400" />
                  <span className="text-xs font-bold text-neutral-700">WhatsApp Messaging</span>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 border border-neutral-200 uppercase tracking-wide">
                  Belum Dikonfigurasi
                </span>
              </div>

              {/* Push Notifications */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50/50 border border-neutral-100">
                <div className="flex items-center gap-2.5">
                  <Globe className="h-4 w-4 text-neutral-400" />
                  <span className="text-xs font-bold text-neutral-700">Web Push Gateway</span>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 border border-neutral-200 uppercase tracking-wide">
                  Belum Dikonfigurasi
                </span>
              </div>

              {/* SMS Gateway */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50/50 border border-neutral-100 opacity-60">
                <div className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 text-neutral-400" />
                  <span className="text-xs font-bold text-neutral-400">SMS Gateway</span>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-100 uppercase tracking-wide">
                  Belum Tersedia
                </span>
              </div>

            </div>

            <div className="p-4 rounded-lg bg-amber-50/30 border border-amber-100/60 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-700 leading-relaxed">
                <strong>Catatan Penting:</strong> Email Bantuan & WhatsApp Admin di sebelah kiri hanyalah informasi kontak statis toko. Sistem transmisi notifikasi transaksional otomatis tetap memerlukan konfigurasi SMTP & API Gateway di tingkat infrastruktur server.
              </p>
            </div>
          </div>

          {/* Incident / Chat Assistance */}
          <div className="bg-white border border-neutral-100 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-neutral-400" /> Live Chat Bantuan
            </h3>
            <div className="p-3.5 rounded-xl border border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-500">Fitur Live Chat Bantuan</span>
              <span className="text-[10px] font-bold bg-neutral-100 text-neutral-400 px-2 py-0.5 rounded border border-neutral-200 uppercase">
                Belum Tersedia
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 leading-relaxed">
              Dukungan integrasi Live Chat widget pihak ketiga saat ini belum aktif. Pelanggan dapat dialihkan secara aman menggunakan kontak WhatsApp Admin resmi di panel sebelah kiri.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
