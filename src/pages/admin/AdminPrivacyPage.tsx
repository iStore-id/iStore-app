import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../store/auth-store";
import {
  Shield,
  FileText,
  Cookie,
  UserCheck,
  Database,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Eye,
  Edit3,
  Mail,
  Phone,
  MapPin,
  Lock,
  Clock,
  Check,
  Info
} from "lucide-react";
import { PrivacySettings } from "../../types/privacy";

export default function AdminPrivacyPage() {
  const { user } = useAuthStore();
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<PrivacySettings | null>(null);
  const [activeTab, setActiveTab] = useState<"policy" | "terms" | "cookie" | "dpo" | "retention">("policy");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<boolean>(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/privacy", {
        headers: {
          Authorization: token ? `Bearer ${token}` : ""
        }
      });
      const json = await res.json();
      if (json.success && json.data) {
        setSettings(json.data);
        setOriginalSettings(JSON.parse(JSON.stringify(json.data)));
      } else {
        setError(json.message || "Gagal memuat pengaturan privasi.");
      }
    } catch (err: any) {
      setError(err.message || "Gagal menghubungi server.");
    } finally {
      setLoading(false);
    }
  };

  const isDirty = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    // Validation
    if (settings.dpoContact.email) {
      const email = settings.dpoContact.email.trim();
      if (email && (!email.includes("@") || !email.includes("."))) {
        setError("Format email kontak DPO tidak valid.");
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMsg(null);
      const token = await (user as any)?.getIdToken?.();

      const res = await fetch("/api/admin/privacy", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(settings)
      });

      const json = await res.json();
      if (json.success && json.data) {
        setSettings(json.data);
        setOriginalSettings(JSON.parse(JSON.stringify(json.data)));
        setSuccessMsg("Pengaturan privasi dan ketentuan layanan berhasil disimpan.");
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(json.message || "Gagal menyimpan pengaturan.");
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan sistem saat menyimpan.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Apakah Anda yakin ingin mengembalikan seluruh kebijakan privasi dan terms ke standar bawaan?")) {
      return;
    }

    try {
      setResetting(true);
      setError(null);
      setSuccessMsg(null);
      const token = await (user as any)?.getIdToken?.();

      const res = await fetch("/api/admin/privacy/reset", {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : ""
        }
      });

      const json = await res.json();
      if (json.success && json.data) {
        setSettings(json.data);
        setOriginalSettings(JSON.parse(JSON.stringify(json.data)));
        setSuccessMsg("Pengaturan privasi berhasil dikembalikan ke standar awal.");
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(json.message || "Gagal mereset pengaturan.");
      }
    } catch (err: any) {
      setError(err.message || "Gagal mereset ke pengaturan default.");
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Memuat konfigurasi kebijakan privasi...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
          <h3 className="text-base font-bold text-red-800">Gagal Memuat Konfigurasi</h3>
          <p className="text-sm text-red-600">{error || "Data konfigurasi tidak tersedia."}</p>
          <button
            onClick={fetchSettings}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Kebijakan Privasi & Legal
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Kelola naskah Kebijakan Privasi, Syarat & Ketentuan, kontak DPO, consent cookie, dan kebijakan retensi data.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting || saving}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
            title="Reset ke pengaturan standar"
          >
            {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            <span>Reset Standar</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition ${
              isDirty
                ? "bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-blue-500/20"
                : "bg-slate-300 cursor-not-allowed"
            }`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-medium animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-800 text-sm font-medium animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("policy")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
            activeTab === "policy"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Kebijakan Privasi</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("terms")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
            activeTab === "terms"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Syarat & Ketentuan (TOS)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("cookie")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
            activeTab === "cookie"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Cookie className="w-4 h-4" />
          <span>Banner Cookie</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("dpo")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
            activeTab === "dpo"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Kontak DPO / Privasi</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("retention")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
            activeTab === "retention"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Retensi & Hak Data</span>
        </button>
      </div>

      {/* Tab 1: Kebijakan Privasi */}
      {activeTab === "policy" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Dokumen Kebijakan Privasi</h2>
                <p className="text-xs text-slate-500">
                  Naskah resmi yang dapat diakses publik pada rute <code className="text-blue-600 font-mono">/privacy</code>.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
                >
                  <span>Buka Halaman Publik</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewMode(!previewMode)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  {previewMode ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{previewMode ? "Mode Edit" : "Live Preview"}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Judul Dokumen</label>
                <input
                  type="text"
                  value={settings.privacyPolicy.title}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      privacyPolicy: { ...settings.privacyPolicy, title: e.target.value }
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  placeholder="e.g., Kebijakan Privasi iStore.id"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Versi Kebijakan</label>
                <input
                  type="text"
                  value={settings.privacyPolicy.version}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      privacyPolicy: { ...settings.privacyPolicy, version: e.target.value }
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  placeholder="e.g., 1.0.0"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700">
                  Isi Kebijakan Privasi (Mendukung Format Markdown & Heading)
                </label>
                <span className="text-[11px] text-slate-400">
                  Terakhir diperbarui: {new Date(settings.privacyPolicy.lastUpdated).toLocaleDateString("id-ID", { dateStyle: "long" })}
                </span>
              </div>

              {previewMode ? (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl prose prose-sm max-w-none text-slate-800 space-y-4 max-h-[500px] overflow-y-auto whitespace-pre-wrap font-sans text-xs sm:text-sm leading-relaxed">
                  {settings.privacyPolicy.content}
                </div>
              ) : (
                <textarea
                  rows={14}
                  value={settings.privacyPolicy.content}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      privacyPolicy: { ...settings.privacyPolicy, content: e.target.value }
                    })
                  }
                  className="w-full p-4 text-xs sm:text-sm border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono leading-relaxed"
                  placeholder="Tuliskan butir-butir kebijakan privasi di sini..."
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Syarat & Ketentuan (TOS) */}
      {activeTab === "terms" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Dokumen Syarat & Ketentuan Layanan</h2>
                <p className="text-xs text-slate-500">
                  Naskah resmi yang dapat diakses publik pada rute <code className="text-blue-600 font-mono">/terms</code>.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
                >
                  <span>Buka Halaman Publik</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewMode(!previewMode)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  {previewMode ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{previewMode ? "Mode Edit" : "Live Preview"}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Judul Dokumen</label>
                <input
                  type="text"
                  value={settings.termsOfService.title}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      termsOfService: { ...settings.termsOfService, title: e.target.value }
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  placeholder="e.g., Syarat & Ketentuan Layanan iStore.id"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Versi Dokumen</label>
                <input
                  type="text"
                  value={settings.termsOfService.version}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      termsOfService: { ...settings.termsOfService, version: e.target.value }
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  placeholder="e.g., 1.0.0"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700">
                  Isi Syarat & Ketentuan
                </label>
                <span className="text-[11px] text-slate-400">
                  Terakhir diperbarui: {new Date(settings.termsOfService.lastUpdated).toLocaleDateString("id-ID", { dateStyle: "long" })}
                </span>
              </div>

              {previewMode ? (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl prose prose-sm max-w-none text-slate-800 space-y-4 max-h-[500px] overflow-y-auto whitespace-pre-wrap font-sans text-xs sm:text-sm leading-relaxed">
                  {settings.termsOfService.content}
                </div>
              ) : (
                <textarea
                  rows={14}
                  value={settings.termsOfService.content}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      termsOfService: { ...settings.termsOfService, content: e.target.value }
                    })
                  }
                  className="w-full p-4 text-xs sm:text-sm border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono leading-relaxed"
                  placeholder="Tuliskan butir-butir syarat & ketentuan layanan di sini..."
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Banner Cookie & Consent */}
      {activeTab === "cookie" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xs">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-slate-900">Pengaturan Consent Cookie Pengunjung</h2>
              <p className="text-xs text-slate-500">
                Kontrol banner persetujuan cookie yang muncul di bagian bawah website publik bagi pengunjung baru.
              </p>
            </div>

            {/* Toggle Enable */}
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="space-y-0.5">
                <div className="text-xs sm:text-sm font-bold text-slate-900">Aktifkan Banner Cookie Consent</div>
                <p className="text-xs text-slate-500">
                  Tampilkan kotak persetujuan cookie kepada pengguna saat pertama kali membuka situs.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.cookieConsent.enabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      cookieConsent: { ...settings.cookieConsent, enabled: e.target.checked }
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Judul Banner Consent</label>
                <input
                  type="text"
                  value={settings.cookieConsent.title}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      cookieConsent: { ...settings.cookieConsent, title: e.target.value }
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  placeholder="e.g., Pemberitahuan Cookie & Privasi"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Pesan Penjelasan Cookie</label>
                <textarea
                  rows={3}
                  value={settings.cookieConsent.message}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      cookieConsent: { ...settings.cookieConsent, message: e.target.value }
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden leading-relaxed"
                  placeholder="Tuliskan pesan penjelasan penggunaan cookie..."
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="space-y-0.5">
                  <div className="text-xs sm:text-sm font-bold text-slate-900">Sediakan Tombol Tolak (Decline)</div>
                  <p className="text-xs text-slate-500">
                    Beri opsi pengguna untuk hanya menggunakan cookie esensial tanpa pelacakan tambahan.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.cookieConsent.allowDecline}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        cookieConsent: { ...settings.cookieConsent, allowDecline: e.target.checked }
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* Live Banner Preview */}
            {settings.cookieConsent.enabled && (
              <div className="pt-4 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-700 mb-2">Simulasi Tampilan Banner Publik:</div>
                <div className="p-4 sm:p-5 bg-slate-900 text-white rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Cookie className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <span className="font-bold text-white block">{settings.cookieConsent.title}</span>
                      <p className="text-slate-300 leading-relaxed">{settings.cookieConsent.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {settings.cookieConsent.allowDecline && (
                      <button
                        type="button"
                        className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      >
                        Tolak
                      </button>
                    )}
                    <button
                      type="button"
                      className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition"
                    >
                      Terima Semua
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Kontak DPO / Privasi */}
      {activeTab === "dpo" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xs">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-slate-900">Kontak Perlindungan Data Resmi (DPO)</h2>
              <p className="text-xs text-slate-500">
                Informasi kontak penanggung jawab privasi yang dicantumkan pada bagian akhir Kebijakan Privasi.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Pejabat / Tim Penanggung Jawab</label>
                <input
                  type="text"
                  value={settings.dpoContact.name}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      dpoContact: { ...settings.dpoContact, name: e.target.value }
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  placeholder="e.g., Data Protection Officer iStore.id"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Khusus Privasi / Permohonan Data</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={settings.dpoContact.email}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        dpoContact: { ...settings.dpoContact, email: e.target.value }
                      })
                    }
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    placeholder="e.g., privacy@istore.co.id"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Telepon / WhatsApp Pengaduan Privasi (Opsional)</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    value={settings.dpoContact.phone}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        dpoContact: { ...settings.dpoContact, phone: e.target.value }
                      })
                    }
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    placeholder="e.g., 081234567890"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Alamat Surat Perlindungan Data (Opsional)</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={settings.dpoContact.address}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        dpoContact: { ...settings.dpoContact, address: e.target.value }
                      })
                    }
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    placeholder="e.g., Gedung Cyber 2 Lt. 15, Jakarta Selatan"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Retensi & Hak Data */}
      {activeTab === "retention" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xs">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-slate-900">Kebijakan Retensi & Perlindungan Data</h2>
              <p className="text-xs text-slate-500">
                Aturan tata kelola penyimpanan data transaksi, opsi pengajuan hak pengguna, dan pengamanan rekonsiliasi.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Periode Retensi Log Transaksi (Bulan)
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={settings.dataRetention.retentionMonths}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        dataRetention: {
                          ...settings.dataRetention,
                          retentionMonths: parseInt(e.target.value) || 0
                        }
                      })
                    }
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Masukkan <strong>0</strong> untuk menyimpan data selamanya tanpa batasan waktu.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Catatan Regulasi / Kebijakan Audit</label>
                <input
                  type="text"
                  value={settings.dataRetention.retentionNote}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      dataRetention: {
                        ...settings.dataRetention,
                        retentionNote: e.target.value
                      }
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  placeholder="e.g., Disimpan sesuai standar audit transaksi keuangan."
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="text-xs font-bold text-slate-900">Hak & Permohonan Pengguna:</div>

              {/* Data Export Request */}
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="space-y-0.5">
                  <div className="text-xs sm:text-sm font-bold text-slate-900">Dukungan Pengajuan Ekspor Data Pengguna</div>
                  <p className="text-xs text-slate-500">
                    Pelanggan dapat meminta salinan riwayat data akun & transaksi mereka melalui dukungan DPO.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.dataRetention.allowCustomerDataExport}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        dataRetention: {
                          ...settings.dataRetention,
                          allowCustomerDataExport: e.target.checked
                        }
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Account Deletion Request */}
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="space-y-0.5">
                  <div className="text-xs sm:text-sm font-bold text-slate-900">Dukungan Permohonan Penghapusan Akun</div>
                  <p className="text-xs text-slate-500">
                    Pelanggan dapat mengajukan permohonan penutupan akun secara permanen.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.dataRetention.allowCustomerAccountDeletion}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        dataRetention: {
                          ...settings.dataRetention,
                          allowCustomerAccountDeletion: e.target.checked
                        }
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Anonymize Deleted Orders */}
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="space-y-0.5">
                  <div className="text-xs sm:text-sm font-bold text-slate-900">Anonimisasi PII pada Transaksi Lama / Terhapus</div>
                  <p className="text-xs text-slate-500">
                    Mengosongkan User ID game, nomor WA, dan email kontak dari arsip lama dengan tetap menjaga keutuhan laporan akuntansi.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.dataRetention.anonymizeDeletedOrders}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        dataRetention: {
                          ...settings.dataRetention,
                          anonymizeDeletedOrders: e.target.checked
                        }
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
