import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../store/auth-store";
import { Wallet, Save, Loader2, ShieldCheck, CheckCircle2, XCircle, AlertCircle, Trash2, Play, RefreshCw, KeyRound, Server, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function AdminTokoVoucherIntegrationPage() {
  const { role, user } = useAuthStore();
  const [memberCode, setMemberCode] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [secretKeyMasked, setSecretKeyMasked] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);
  const [lastTestResult, setLastTestResult] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/integrations/tokovoucher", {
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success) {
        setMemberCode(data.data.memberCode || "");
        setIsEnabled(data.data.isEnabled !== undefined ? data.data.isEnabled : true);
        setConfigured(data.data.configured || false);
        setSecretKeyMasked(data.data.secretKeyMasked || "");
        setMemberName(data.data.memberName || null);
        setBalance(data.data.balance !== undefined ? data.data.balance : null);
        setLastTestedAt(data.data.lastTestedAt || null);
        setLastTestResult(data.data.lastTestResult || null);
      } else {
        setError(data.message || "Gagal memuat konfigurasi TokoVoucher");
      }
    } catch (err: any) {
      setError(err.message);
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
      const res = await fetch("/api/admin/integrations/tokovoucher", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          memberCode,
          secretKey: secretKey.trim() || undefined,
          isEnabled
        })
      });
      const data = await res.json();
      if (data.success) {
        setConfigured(data.data.configured);
        setSecretKeyMasked(data.data.secretKeyMasked || secretKeyMasked);
        setSecretKey("");
        setSuccessMsg("Konfigurasi TokoVoucher berhasil disimpan secara aman.");
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
    if (!configured) {
      setError("Konfigurasi TokoVoucher belum disimpan ke basis data. Silakan klik 'Simpan Konfigurasi' terlebih dahulu sebelum melakukan Test Connection.");
      return;
    }

    setTesting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/integrations/tokovoucher/test", {
        method: "POST",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Tes koneksi berhasil! ${data.message}`);
        setLastTestedAt(new Date().toISOString());
        setLastTestResult("SUCCESS");
        if (data.data?.memberName) setMemberName(data.data.memberName);
        if (data.data?.balance !== undefined) setBalance(data.data.balance);
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setError(data.message || "Tes koneksi TokoVoucher gagal.");
        setLastTestResult("FAILED");
        setLastTestedAt(new Date().toISOString());
      }
    } catch (err: any) {
      setError(err.message);
      setLastTestResult("FAILED");
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus konfigurasi TokoVoucher dari database?")) return;
    setRemoving(true);
    setError(null);
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/integrations/tokovoucher", {
        method: "DELETE",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success) {
        setMemberCode("");
        setSecretKey("");
        setSecretKeyMasked("");
        setConfigured(false);
        setMemberName(null);
        setBalance(null);
        setSuccessMsg("Konfigurasi TokoVoucher berhasil dihapus.");
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || "Gagal menghapus konfigurasi");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRemoving(false);
    }
  };

  if (role !== "pemilik" && role !== "admin") {
    return (
      <div className="bg-white p-8 rounded-2xl border border-red-200 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Akses Ditolak</h2>
        <p className="text-slate-500">Anda tidak memiliki izin untuk mengelola integrasi TokoVoucher.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/integrations"
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            title="Kembali ke Integrations"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <Wallet className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold text-slate-900">TokoVoucher Integration Management</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">Kelola kredensial, status, dan konektivitas official supplier TokoVoucher.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5 ${configured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {configured ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {configured ? 'Configured' : 'Not Configured'}
          </span>
          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${isEnabled ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
            {isEnabled ? 'Provider Active' : 'Provider Disabled'}
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3 text-sm">
          <XCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-3 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Account Info Card if Configured */}
      {configured && (
        <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <p className="text-purple-200 text-xs uppercase tracking-wider font-semibold">TokoVoucher Account Status</p>
            <h2 className="text-xl font-bold">{memberName || "TokoVoucher Member"}</h2>
            <p className="text-sm text-purple-200 font-mono">Member Code: {memberCode}</p>
          </div>
          <div className="flex items-center gap-6 bg-white/10 px-5 py-3 rounded-xl backdrop-blur-sm">
            <div>
              <p className="text-xs text-purple-200">Saldo Akun</p>
              <p className="text-lg font-bold font-mono">{balance !== null ? `Rp ${balance.toLocaleString("id-ID")}` : "---"}</p>
            </div>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="px-3 py-2 bg-white text-purple-900 rounded-lg hover:bg-purple-50 font-semibold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh Saldo
            </button>
          </div>
        </div>
      )}

      {/* Configuration Form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-slate-900">Pengaturan Kredensial & Enkripsi</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">AES-256 Secure Vault Storage</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Member Code / ID</label>
            <input
              type="text"
              value={memberCode}
              onChange={(e) => setMemberCode(e.target.value)}
              placeholder="Contoh: TV12345"
              required
              className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 text-slate-800 font-mono text-sm"
            />
            <p className="text-xs text-slate-400">ID Member resmi yang diberikan oleh TokoVoucher.</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Secret Key {configured && "(Kosongkan jika tidak diubah)"}
            </label>
            <input
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder={configured ? "••••••••••••••••••••" : "Masukkan Secret Key API"}
              className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 text-slate-800 font-mono text-sm"
            />
            <p className="text-xs text-slate-400">Disimpan secara terenkripsi di Firestore (tidak pernah terekspos ke frontend).</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
            />
            <span className="text-sm font-medium text-slate-700">Aktifkan Provider TokoVoucher di Routing & Checkout Engine</span>
          </label>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          {configured ? (
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
            >
              {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Hapus Konfigurasi
            </button>
          ) : <div />}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              title={!configured ? "Konfigurasi TokoVoucher belum disimpan. Klik untuk petunjuk." : "Uji koneksi ke API TokoVoucher"}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 text-purple-600" />}
              Test Connection
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan Konfigurasi
            </button>
          </div>
        </div>
      </form>

      {/* Webhook & IP Whitelist Security Info */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-slate-800 font-semibold">
          <Server className="w-5 h-5 text-purple-600" />
          <h4>Webhook & IP Whitelist Security (TokoVoucher)</h4>
        </div>
        <p className="text-sm text-slate-600">
          Untuk menerima callback otomatis transaksi dari TokoVoucher, pastikan endpoint webhook backend terdaftar di panel TokoVoucher Anda:
        </p>
        <div className="bg-white p-3 rounded-xl border border-slate-200 font-mono text-xs text-purple-700 select-all">
          {window.location.origin}/api/webhooks/tokovoucher
        </div>
        <div className="text-xs text-slate-500 space-y-1">
          <p><strong className="text-slate-700">Official Server IP Whitelist:</strong> <code>188.166.243.56</code></p>
          <p><strong className="text-slate-700">Signature Validation:</strong> <code>md5(MEMBER_CODE:SECRET:REF_ID)</code> pada header <code>X-TokoVoucher-Authorization</code>.</p>
        </div>
      </div>
    </div>
  );
}
