import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../store/auth-store";
import { Globe, Save, Loader2, Info, Check, Shield, ShieldAlert, Link as LinkIcon, RefreshCw, AlertTriangle, ExternalLink, HelpCircle } from "lucide-react";
import { SEOSettings } from "../../types/seo";

export default function AdminDomainPage() {
  const { user } = useAuthStore();
  const [seoSettings, setSeoSettings] = useState<SEOSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Field
  const [canonicalBaseUrl, setCanonicalBaseUrl] = useState("");

  // Client Detection
  const [currentOrigin, setCurrentOrigin] = useState("");
  const [currentHost, setCurrentHost] = useState("");
  const [isHttps, setIsHttps] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentOrigin(window.location.origin);
      setCurrentHost(window.location.host);
      setIsHttps(window.location.protocol === "https:");
    }
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/seo", {
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success && data.data) {
        setSeoSettings(data.data);
        setCanonicalBaseUrl(data.data.canonicalBaseUrl || "");
      } else {
        setError(data.message || "Gagal memuat pengaturan domain");
      }
    } catch (err: any) {
      setError(err.message || "Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  };

  const validateAndNormalizeUrl = (urlStr: string): { isValid: boolean; normalizedUrl?: string; errorMsg?: string } => {
    const trimmed = urlStr.trim();
    if (!trimmed) {
      return { isValid: false, errorMsg: "URL domain tidak boleh kosong" };
    }

    // Must be absolute
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      return { isValid: false, errorMsg: "URL harus diawali dengan http:// atau https://" };
    }

    try {
      const url = new URL(trimmed);
      
      // Prevent malicious/non-http protocols
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { isValid: false, errorMsg: "Protokol tidak valid, hanya mendukung HTTP/HTTPS" };
      }

      // Check for valid hostname structure
      const hostname = url.hostname;
      if (!hostname || hostname.split(".").length < 2 && hostname !== "localhost") {
        return { isValid: false, errorMsg: "Format hostname tidak valid" };
      }

      // Consistent trailing slash normalization
      // Normalize: remove trailing slashes for clean base path (standardized in iStore seo-service)
      const cleanUrl = `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}`;

      return { isValid: true, normalizedUrl: cleanUrl };
    } catch (e) {
      return { isValid: false, errorMsg: "Format URL tidak valid" };
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seoSettings) return;

    setError(null);
    setSuccessMsg(null);

    const { isValid, normalizedUrl, errorMsg } = validateAndNormalizeUrl(canonicalBaseUrl);
    if (!isValid || !normalizedUrl) {
      setError(errorMsg || "Validasi URL gagal");
      return;
    }

    // Force HTTPS for production URL
    const isProductionUrl = !normalizedUrl.includes("localhost") && !normalizedUrl.includes("run.app") && !normalizedUrl.includes("staging") && !normalizedUrl.includes("preview") && !normalizedUrl.includes("dev");
    if (isProductionUrl && normalizedUrl.startsWith("http://")) {
      setError("Wajib menggunakan protokol HTTPS (https://) yang aman untuk domain utama produksi.");
      return;
    }

    setSaving(true);
    const updatedPayload = {
      ...seoSettings,
      canonicalBaseUrl: normalizedUrl,
      reason: "Pembaruan domain utama (Canonical URL) via Panel Domain"
    };

    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/seo", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(updatedPayload)
      });
      const data = await res.json();
      if (data.success && data.data) {
        setSeoSettings(data.data);
        setCanonicalBaseUrl(data.data.canonicalBaseUrl || "");
        setSuccessMsg("Domain utama berhasil diperbarui!");
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(data.message || "Gagal menyimpan domain baru");
      }
    } catch (err: any) {
      setError(err.message || "Gagal mengirim pembaruan domain");
    } finally {
      setSaving(false);
    }
  };

  // Environment Detection Helper
  const getEnvironmentType = (host: string) => {
    const h = host.toLowerCase();
    if (h.includes("localhost") || h.includes("127.0.0.1")) {
      return { name: "Development", color: "bg-slate-100 text-slate-800 border-slate-200" };
    }
    if (h.includes("run.app") || h.includes("staging") || h.includes("preview") || h.includes("dev")) {
      return { name: "Staging / Preview", color: "bg-amber-50 text-amber-800 border-amber-200" };
    }
    return { name: "Production", color: "bg-emerald-50 text-emerald-800 border-emerald-200" };
  };

  const getMatchStatus = () => {
    if (!canonicalBaseUrl || !currentOrigin) return null;
    const { normalizedUrl } = validateAndNormalizeUrl(canonicalBaseUrl);
    const cleanCurrent = currentOrigin.replace(/\/+$/, "");
    const cleanCanonical = normalizedUrl ? normalizedUrl.replace(/\/+$/, "") : "";
    
    if (cleanCurrent === cleanCanonical) {
      return { matches: true, message: "Domain aktif cocok dengan Domain Utama", color: "text-emerald-700 bg-emerald-50 border-emerald-100" };
    }
    return { matches: false, message: "Akses domain aktif berbeda dengan Domain Utama", color: "text-amber-700 bg-amber-50 border-amber-100" };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-medium text-gray-500">Memuat konfigurasi domain...</p>
      </div>
    );
  }

  const env = getEnvironmentType(currentHost);
  const match = getMatchStatus();
  const canonicalWithoutProtocol = canonicalBaseUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Globe className="w-6 h-6 text-indigo-600" />
            Pengaturan Domain & SSL
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Kelola nama domain utama, verifikasi status kecocokan SSL, serta sinkronisasi alamat canonical toko Anda.
          </p>
        </div>
        <button
          onClick={fetchSettings}
          title="Segarkan data"
          className="p-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
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
        {/* Left: Configuration Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
            <h2 className="text-md font-semibold text-gray-900 border-b pb-2">Konfigurasi Domain Utama</h2>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Domain Utama (Canonical URL)</label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <LinkIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={canonicalBaseUrl}
                    onChange={(e) => setCanonicalBaseUrl(e.target.value)}
                    placeholder="https://istore.id"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Alamat URL utama (misal: <code className="font-mono bg-gray-100 px-1 py-0.5 rounded text-indigo-600">https://istore.id</code>) yang digunakan oleh perayap Google, generator sitemap, metadata Open Graph, serta tautan canonical.
                </p>
              </div>

              <div className="pt-2 border-t flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Simpan Domain
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* DNS/SSL Guidance */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="text-md font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-500" />
              Panduan Pemetaan Domain & SSL
            </h2>
            <div className="space-y-3 text-xs text-gray-600 leading-relaxed">
              <p>
                Konfigurasi di atas hanya bertindak sebagai deklarasi penentuan **Domain Utama (Canonical URL)** untuk kebutuhan metadata SEO, Sitemap, dan Robots aplikasi iStore.id.
              </p>
              <div className="p-3 bg-slate-50 border rounded-xl space-y-2">
                <div className="flex items-start gap-2">
                  <span className="h-4 w-4 bg-indigo-100 text-indigo-700 font-bold rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                  <p>
                    **Konfigurasi DNS Registrar**: Penyambungan rekor domain kustom Anda (misalnya membuat record **CNAME** mengarah ke server atau record **A** mengarah ke alamat IP publik penampung) **wajib dilakukan secara manual di luar aplikasi** melalui akun penyedia domain/registrar Anda (seperti Niagahoster, Namecheap, Cloudflare, dsb).
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="h-4 w-4 bg-indigo-100 text-indigo-700 font-bold rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                  <p>
                    **Penerbitan Sertifikat SSL/TLS**: Penerbitan sertifikat SSL/TLS (HTTPS) dan pemetaan domain kustom dikelola oleh provider hosting yang digunakan untuk deployment production setelah konfigurasi DNS domain diarahkan dengan benar.
                  </p>
                </div>
              </div>
              <p className="text-amber-700 bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
                *Catatan: iStore Admin Panel tidak memiliki wewenang langsung untuk membuat rekaman DNS baru di registrar domain Anda atau menerbitkan sertifikat SSL eksternal secara mandiri.*
              </p>
            </div>
          </div>
        </div>

        {/* Right: Monitoring & Preview Panel */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Environment Monitor */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="text-md font-semibold text-gray-900 border-b pb-2">Status & Konektivitas Aktif</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs border-b pb-2.5">
                <span className="text-gray-500 font-medium">Hostname Aktif</span>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-mono font-semibold text-gray-800 bg-slate-50 border px-2 py-1 rounded">{currentHost || "Mencari..."}</span>
                  {(currentHost.includes("run.app") || currentHost.includes("staging") || currentHost.includes("preview")) && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded">
                      Hostname Preview/Staging Aktif (bukan production domain)
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center text-xs border-b pb-2.5">
                <span className="text-gray-500 font-medium">Lingkungan Sistem</span>
                <span className={`px-2 py-1 border text-[10px] font-bold uppercase rounded-full ${env.color}`}>
                  {env.name}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs border-b pb-2.5">
                <span className="text-gray-500 font-medium">Protokol Keamanan (SSL)</span>
                <span className="flex items-center gap-1 font-semibold">
                  {isHttps ? (
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded flex items-center gap-1 text-[10px]">
                      <Shield className="w-3 h-3" />
                      HTTPS Aktif
                    </span>
                  ) : (
                    <span className="text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded flex items-center gap-1 text-[10px]">
                      <ShieldAlert className="w-3 h-3" />
                      HTTP Tidak Aman
                    </span>
                  )}
                </span>
              </div>

              {match && (
                <div className={`p-3 border rounded-xl text-xs font-medium ${match.color}`}>
                  {match.message}
                </div>
              )}
            </div>
          </div>

          {/* Canonical preview and dynamic sitemaps */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="text-md font-semibold text-gray-900 border-b pb-2">Pratinjau Integrasi SEO</h2>
            
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-gray-500 block mb-1">Pratinjau Link Canonical:</span>
                <div className="bg-slate-50 border rounded-lg p-2 font-mono text-[11px] text-indigo-600 break-all">
                  &lt;link rel="canonical" href="{canonicalBaseUrl || "https://istore.id"}/games/mobile-legends" /&gt;
                </div>
              </div>

              <div>
                <span className="text-gray-500 block mb-1">Pratinjau Og:Url Metadata:</span>
                <div className="bg-slate-50 border rounded-lg p-2 font-mono text-[11px] text-gray-700 break-all">
                  &lt;meta property="og:url" content="{canonicalBaseUrl || "https://istore.id"}/games/mobile-legends" /&gt;
                </div>
              </div>

              <div className="pt-2 border-t space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Peta Situs (Sitemap):</span>
                  <a
                    href="/sitemap.xml"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5 font-medium"
                  >
                    /sitemap.xml
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Kebijakan Robot (Robots.txt):</span>
                  <a
                    href="/robots.txt"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5 font-medium"
                  >
                    /robots.txt
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
