import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../store/auth-store";
import { QrCode, Save, Loader2, ShieldCheck, CheckCircle2, XCircle, AlertCircle, Trash2, Play } from "lucide-react";

export default function AdminDoitIntegrationPage() {
  const { user } = useAuthStore();
  const [apiKey, setApiKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookSecretMasked, setWebhookSecretMasked] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://pay.doit.id");
  const [isProduction, setIsProduction] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("https://ist.web.id/api/webhooks/doit");
  const [configured, setConfigured] = useState(false);
  const [hasWebhookSecret, setHasWebhookSecret] = useState(false);
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);
  const [lastTestResult, setLastTestResult] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/integrations/doit", {
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      
      const contentType = res.headers.get("content-type");
      if (!res.ok || !contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Backend error (non-JSON):", text);
        setError(`Server returned an error (${res.status}). Silakan coba restart server.`);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setIsProduction(data.data.isProduction || false);
        setIsActive(data.data.isActive === true);
        setBaseUrl(data.data.baseUrl || "https://pay.doit.id");
        setCallbackUrl(data.data.callbackUrl || "https://ist.web.id/api/webhooks/doit");
        setConfigured(data.data.configured || false);
        setHasWebhookSecret(data.data.hasWebhookSecret || false);
        setApiKeyMasked(data.data.apiKeyMasked || "");
        setWebhookSecretMasked(data.data.webhookSecretMasked || "");
        setLastTestedAt(data.data.lastTestedAt || null);
        setLastTestResult(data.data.lastTestResult || null);
      } else {
        setError(data.message || "Gagal memuat konfigurasi Doit.id");
      }
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError("Gagal menghubungi server. Pastikan koneksi internet stabil.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/integrations/doit", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          apiKey: apiKey.trim() || undefined,
          webhookSecret: webhookSecret.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
          isProduction,
          isActive,
          callbackUrl: callbackUrl.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setConfigured(data.data.configured);
        setHasWebhookSecret(data.data.hasWebhookSecret);
        if (data.data.apiKeyMasked) setApiKeyMasked(data.data.apiKeyMasked);
        if (data.data.webhookSecretMasked) setWebhookSecretMasked(data.data.webhookSecretMasked);
        if (data.data.callbackUrl) setCallbackUrl(data.data.callbackUrl);
        if (data.data.baseUrl) setBaseUrl(data.data.baseUrl);
        setApiKey(""); // clear plaintext input
        setWebhookSecret(""); // clear plaintext input
        setSuccessMsg("Konfigurasi Doit.id berhasil disimpan secara aman (server-side).");
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || "Gagal menyimpan konfigurasi");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/integrations/doit/test", {
        method: "POST",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message || "Koneksi ke Doit.id berhasil!");
        setLastTestedAt(new Date().toISOString());
        setLastTestResult("SUCCESS");
      } else {
        setError(data.message || "Koneksi ke Doit.id gagal.");
        setLastTestedAt(new Date().toISOString());
        setLastTestResult("FAILED");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm("Apakah Anda yakin ingin menghapus konfigurasi Doit.id?")) return;
    setSaving(true);
    setError(null);
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/integrations/doit", {
        method: "DELETE",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success) {
        setApiKey("");
        setApiKeyMasked("");
        setWebhookSecret("");
        setWebhookSecretMasked("");
        setBaseUrl("https://pay.doit.id");
        setIsProduction(false);
        setIsActive(false);
        setConfigured(false);
        setHasWebhookSecret(false);
        setSuccessMsg("Konfigurasi Doit.id berhasil dihapus.");
      } else {
        setError(data.message || "Gagal menghapus konfigurasi.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Memuat konfigurasi Doit.id...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="ui-page-title text-slate-900 flex items-center gap-2">
            <QrCode className="w-7 h-7 text-indigo-600" />
            Doit.id Integration
          </h1>
          <p className="text-slate-500 text-sm mt-1">Kelola kredensial API Key, Webhook Secret, dan environment payment gateway QRIS dinamis Doit.id.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            configured ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}>
            <ShieldCheck className="w-3.5 h-3.5" />
            {configured ? "Configured & Secured" : "Not Configured"}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-center gap-3">
          <XCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">Pengaturan Kredensial Doit.id</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">API Key / Bearer Token</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={apiKeyMasked ? "•••••••••••••••• (tersimpan)" : "Masukkan API Key Doit.id"}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {apiKeyMasked ? `Terenkripsi di database (${apiKeyMasked}). Kosongkan jika tidak ingin mengubah.` : "API Key rahasia dari dasbor merchant Doit.id."}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Webhook Secret (PayBridge Signature)</label>
                <input
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder={hasWebhookSecret ? "•••••••••••••••• (tersimpan)" : "Masukkan Webhook Secret Doit.id"}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {hasWebhookSecret ? "Secret webhook tersimpan secara terenkripsi. Kosongkan jika tidak ingin mengubah." : "Secret key untuk memvalidasi HMAC-SHA256 PayBridge-Signature."}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Base API URL</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://pay.doit.id"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  required
                />
                <p className="text-xs text-slate-400 mt-1">
                  URL gateway Doit.id (default: https://pay.doit.id).
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Callback URL (Webhook)</label>
                <input
                  type="text"
                  value={callbackUrl}
                  onChange={(e) => setCallbackUrl(e.target.value)}
                  placeholder="https://ist.web.id/api/webhooks/doit"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">
                  URL webhook yang akan digunakan Doit.id untuk mengirim notifikasi pembayaran.
                </p>
              </div>

              <div className="pt-2 space-y-4 border-t border-slate-100">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">Environment Production</h4>
                    <p className="text-xs text-slate-500">Aktifkan untuk menggunakan mode production live merchant.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isProduction}
                      onChange={(e) => setIsProduction(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">Status Aktif Gateway</h4>
                    <p className="text-xs text-slate-500">Aktifkan Doit.id sebagai gateway pembayaran aktif tunggal (otomatis menonaktifkan Midtrans & iPaymu).</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              {configured && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={saving}
                  className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-xl transition-colors inline-flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus Konfigurasi
                </button>
              )}
              <div className="ml-auto">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Simpan Konfigurasi
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-semibold text-slate-900 text-sm">Status Tes Koneksi</h3>
            
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Terakhir Diuji:</span>
                <span className="font-medium text-slate-800">{lastTestedAt ? new Date(lastTestedAt).toLocaleString() : "Belum pernah"}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Hasil:</span>
                <span className={`font-semibold ${lastTestResult === "SUCCESS" ? "text-emerald-600" : lastTestResult === "FAILED" ? "text-red-600" : "text-slate-400"}`}>
                  {lastTestResult || "Belum diuji"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !configured}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-xl transition-colors shadow-sm inline-flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Test Koneksi API
            </button>
            <p className="text-xs text-slate-400 text-center">Memverifikasi keabsahan API Key dan keterjangkauan server Doit.id.</p>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-indigo-900 font-semibold text-sm">
              <AlertCircle className="w-4 h-4 text-indigo-600" />
              <span>Panduan Callback Doit.id</span>
            </div>
            <p className="text-xs text-indigo-700 leading-relaxed">
              Pastikan Anda mendaftarkan URL Webhook berikut di panel merchant Doit.id Anda:
            </p>
            <div className="p-2.5 bg-white rounded-lg border border-indigo-200 text-xs font-mono text-indigo-900 break-all select-all">
              {callbackUrl || "https://ist.web.id/api/webhooks/doit"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
