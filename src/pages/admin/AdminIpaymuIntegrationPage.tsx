import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../store/auth-store";
import { Wallet, Save, Loader2, ShieldCheck, CheckCircle2, XCircle, AlertCircle, Trash2, Play } from "lucide-react";

export default function AdminIpaymuIntegrationPage() {
  const { role, user } = useAuthStore();
  const [va, setVa] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [isProduction, setIsProduction] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [callbackUrl, setCallbackUrl] = useState("https://ist.web.id/api/webhooks/ipaymu");
  const [configured, setConfigured] = useState(false);
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
      const res = await fetch("/api/admin/integrations/ipaymu", {
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
        setVa(data.data.va || "");
        setIsProduction(data.data.isProduction || false);
        setIsActive(data.data.isActive !== false);
        setCallbackUrl(data.data.callbackUrl || "https://ist.web.id/api/webhooks/ipaymu");
        setConfigured(data.data.configured || false);
        setApiKeyMasked(data.data.apiKeyMasked || "");
        setLastTestedAt(data.data.lastTestedAt || null);
        setLastTestResult(data.data.lastTestResult || null);
      } else {
        setError(data.message || "Gagal memuat konfigurasi iPaymu");
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
      const res = await fetch("/api/admin/integrations/ipaymu", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          va: va.trim(),
          apiKey: apiKey.trim() || undefined,
          isProduction,
          isActive,
          callbackUrl: callbackUrl.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setConfigured(data.data.configured);
        setApiKeyMasked(data.data.apiKeyMasked || apiKeyMasked);
        if (data.data.callbackUrl) {
          setCallbackUrl(data.data.callbackUrl);
        }
        setApiKey(""); // clear plaintext input
        setSuccessMsg("Konfigurasi iPaymu berhasil disimpan secara aman (server-side).");
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
      const res = await fetch("/api/admin/integrations/ipaymu/test", {
        method: "POST",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message || "Koneksi ke iPaymu berhasil!");
        setLastTestedAt(new Date().toISOString());
        setLastTestResult("SUCCESS");
      } else {
        setError(data.message || "Koneksi ke iPaymu gagal.");
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
    if (!confirm("Apakah Anda yakin ingin menghapus konfigurasi iPaymu?")) return;
    setSaving(true);
    setError(null);
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/integrations/ipaymu", {
        method: "DELETE",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success) {
        setVa("");
        setApiKey("");
        setApiKeyMasked("");
        setIsProduction(false);
        setIsActive(true);
        setConfigured(false);
        setSuccessMsg("Konfigurasi iPaymu berhasil dihapus.");
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
        Memuat konfigurasi iPaymu...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="ui-page-title text-slate-900 flex items-center gap-2">
            <Wallet className="w-7 h-7 text-indigo-600" />
            iPaymu Integration
          </h1>
          <p className="text-slate-500 text-sm mt-1">Kelola kredensial Virtual Account dan API Key iPaymu untuk gateway pembayaran kedua.</p>
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
            <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">Pengaturan Kredensial iPaymu</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Virtual Account (VA)</label>
                <input
                  type="text"
                  value={va}
                  onChange={(e) => setVa(e.target.value)}
                  placeholder="Contoh: 000000XXXXXXXXXX"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  required
                />
                <p className="text-xs text-slate-400 mt-1">Nomor Virtual Account / Merchant ID iPaymu Anda.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">API Key / Secret</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={apiKeyMasked ? "•••••••••••••••• (tersimpan)" : "Masukkan API Key iPaymu"}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {apiKeyMasked ? `Terenkripsi di database (${apiKeyMasked}). Kosongkan jika tidak ingin mengubah.` : "API Key rahasia dari panel iPaymu."}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Callback</label>
                <input
                  type="text"
                  value={callbackUrl}
                  onChange={(e) => setCallbackUrl(e.target.value)}
                  placeholder="https://ist.web.id/api/webhooks/ipaymu"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">
                  URL webhook yang akan digunakan iPaymu untuk mengirim notifikasi transaksi.
                </p>
              </div>

              <div className="pt-2 space-y-4 border-t border-slate-100">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">Environment Production</h4>
                    <p className="text-xs text-slate-500">Aktifkan untuk menggunakan endpoint production (my.ipaymu.com).</p>
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
                    <p className="text-xs text-slate-500">Izinkan sistem menggunakan iPaymu jika dipilih.</p>
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
            <p className="text-xs text-slate-400 text-center">Memverifikasi koneksi API key dan VA ke server iPaymu.</p>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-indigo-900 font-semibold text-sm">
              <AlertCircle className="w-4 h-4 text-indigo-600" />
              <span>Panduan Callback iPaymu</span>
            </div>
            <p className="text-xs text-indigo-700 leading-relaxed">
              Pastikan Anda mendaftarkan URL Webhook berikut di panel iPaymu Anda:
            </p>
            <div className="p-2.5 bg-white rounded-lg border border-indigo-200 text-xs font-mono text-indigo-900 break-all select-all">
              {callbackUrl || "https://ist.web.id/api/webhooks/ipaymu"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
