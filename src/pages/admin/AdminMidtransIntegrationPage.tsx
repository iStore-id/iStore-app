import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../store/auth-store";
import { CreditCard, Save, Loader2, ShieldCheck, CheckCircle2, XCircle, AlertCircle, Trash2, Play } from "lucide-react";

export default function AdminMidtransIntegrationPage() {
  const { role, user } = useAuthStore();
  const [merchantId, setMerchantId] = useState("");
  const [clientKey, setClientKey] = useState("");
  const [serverKey, setServerKey] = useState("");
  const [serverKeyMasked, setServerKeyMasked] = useState("");
  const [isProduction, setIsProduction] = useState(false);
  const [isActive, setIsActive] = useState(true);
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
      const res = await fetch("/api/admin/integrations/midtrans", {
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      
      const contentType = res.headers.get("content-type");
      if (!res.ok || !contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Backend error (non-JSON):", text);
        setError(`Server returned an error (${res.status}). Silakan coba restart server atau hubungi developer.`);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setMerchantId(data.data.merchantId || "");
        setClientKey(data.data.clientKey || "");
        setIsProduction(data.data.isProduction || false);
        setIsActive(data.data.isActive !== false);
        setConfigured(data.data.configured || false);
        setServerKeyMasked(data.data.serverKeyMasked || "");
        setLastTestedAt(data.data.lastTestedAt || null);
        setLastTestResult(data.data.lastTestResult || null);
      } else {
        setError(data.message || "Gagal memuat konfigurasi Midtrans");
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
      const res = await fetch("/api/admin/integrations/midtrans", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          merchantId,
          clientKey: clientKey.trim(),
          serverKey: serverKey.trim() || undefined,
          isProduction,
          isActive
        })
      });
      const data = await res.json();
      if (data.success) {
        setConfigured(data.data.configured);
        setServerKeyMasked(data.data.serverKeyMasked || serverKeyMasked);
        setServerKey(""); // clear plaintext input
        setSuccessMsg("Konfigurasi Midtrans berhasil disimpan secara aman (server-side).");
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
      const res = await fetch("/api/admin/integrations/midtrans/test", {
        method: "POST",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message || "Koneksi ke Midtrans berhasil!");
        setLastTestedAt(new Date().toISOString());
        setLastTestResult("SUCCESS");
      } else {
        setError(data.message || "Koneksi ke Midtrans gagal.");
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
    if (!confirm("Apakah Anda yakin ingin menghapus konfigurasi Midtrans? Sistem akan kembali ke environment default.")) return;
    setSaving(true);
    setError(null);
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/integrations/midtrans", {
        method: "DELETE",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success) {
        setMerchantId("");
        setClientKey("");
        setServerKey("");
        setServerKeyMasked("");
        setIsProduction(false);
        setIsActive(true);
        setConfigured(false);
        setSuccessMsg("Konfigurasi Midtrans berhasil dihapus.");
      } else {
        setError(data.message || "Gagal menghapus konfigurasi.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (role !== "pemilik") {
    return (
      <div className="bg-white p-8 rounded-2xl border border-red-200 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">Akses Ditolak</h2>
        <p className="text-slate-500">Hanya Owner (pemilik) yang dapat mengelola integrasi pembayaran.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Integrasi Midtrans Payment Gateway</h2>
          <p className="text-sm text-slate-500 mt-1">Kelola kredensial Midtrans, environment, dan uji koneksi secara aman tanpa developer.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${configured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            <span className={`w-2 h-2 rounded-full ${configured ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            {configured ? 'Configured' : 'Not Configured'}
          </span>
          {lastTestResult && (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${lastTestResult === 'SUCCESS' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
              {lastTestResult === 'SUCCESS' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {lastTestResult === 'SUCCESS' ? 'Connected' : 'Connection Failed'}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
          <XCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Kredensial Midtrans & Environment</h3>
              <p className="text-xs text-slate-500">Disimpan secara aman di server terenkripsi (AES-256)</p>
            </div>
          </div>
          {configured && (
            <button
              type="button"
              onClick={handleRemove}
              className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg border border-red-200 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus Konfigurasi
            </button>
          )}
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Merchant ID</label>
              <input
                type="text"
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                placeholder="Contoh: G123456789"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                required
              />
              <p className="text-xs text-slate-400 mt-1">Merchant ID resmi dari dashboard Midtrans.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Client Key</label>
              <input
                type="text"
                value={clientKey}
                onChange={(e) => setClientKey(e.target.value)}
                placeholder="Contoh: Mid-client-..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                required
              />
              <p className="text-xs text-slate-400 mt-1">Client Key publik dari dashboard Midtrans.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Environment</label>
              <select
                value={isProduction ? "production" : "sandbox"}
                onChange={(e) => setIsProduction(e.target.value === "production")}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
              >
                <option value="sandbox">Sandbox (Testing / Uji Coba)</option>
                <option value="production">Production (Live / Transaksi Nyata)</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">Pilih Sandbox untuk pengujian atau Production untuk operasional live.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`w-full px-4 py-2.5 rounded-xl border font-medium flex items-center justify-between ${isActive ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
              >
                {isActive ? 'ACTIVE' : 'INACTIVE'}
                <div className={`w-10 h-5 rounded-full p-1 transition-all flex ${isActive ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'}`}>
                  <div className="w-3 h-3 bg-white rounded-full"></div>
                </div>
              </button>
              <p className="text-xs text-slate-400 mt-1">Nonaktifkan untuk menghentikan penggunaan gateway ini di runtime.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Server Key</label>
            <input
              type="password"
              value={serverKey}
              onChange={(e) => setServerKey(e.target.value)}
              placeholder={serverKeyMasked ? `Terkonfigurasi (${serverKeyMasked}). Masukkan baru jika ingin mengganti.` : "Masukkan Midtrans Server Key (SB-Mid-server-...) ..."}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">
              Server Key tidak pernah dikirim kembali ke browser dan dienkripsi secara ketat di server backend.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Dilindungi autentikasi ketat owner & enkripsi server-side.</span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {configured && (
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin text-slate-700" /> : <Play className="w-4 h-4 text-slate-700" />}
                  Test Connection
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Save className="w-4 h-4" />}
                Simpan Konfigurasi
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-6 space-y-3">
        <h4 className="font-semibold text-indigo-900 text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          Panduan Keamanan Kredensial Midtrans
        </h4>
        <ul className="text-xs text-indigo-800 space-y-1.5 list-disc list-inside">
          <li>Server Key disimpan menggunakan enkripsi AES-256 di database backend.</li>
          <li>Kredensial tidak pernah bocor ke client browser, logs, atau audit trail.</li>
          <li>Uji koneksi menggunakan request status API non-transaksional yang aman tanpa melakukan charge atau membuat transaksi nyata.</li>
        </ul>
      </div>
    </div>
  );
}
