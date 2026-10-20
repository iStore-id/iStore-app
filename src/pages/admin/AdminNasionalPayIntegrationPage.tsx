import { useEffect, useState } from "react";
import { Save, Loader2, ShieldCheck, AlertCircle, Activity } from "lucide-react";
import { useAuthStore } from "../../store/auth-store";

export default function AdminNasionalPayIntegrationPage() {
  const { user } = useAuthStore();
  const [storeKey, setStoreKey] = useState("");
  const [storeKeyMasked, setStoreKeyMasked] = useState("");
  const [configured, setConfigured] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [lastTestResult, setLastTestResult] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");

  const authHeaders = async (headers: Record<string, string> = {}) => {
    const token = await (user as any)?.getIdToken?.();
    if (!token) throw new Error("Sesi admin tidak memiliki token autentikasi. Silakan login ulang.");
    return { ...headers, Authorization: `Bearer ${token}` };
  };

  const loadConfig = async () => {
    const response = await fetch("/api/admin/integrations/nasionalpay", { headers: await authHeaders() });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || "Gagal memuat konfigurasi NasionalPay.");
    setStoreKeyMasked(result.data.storeKeyMasked || "");
    setConfigured(result.data.configured === true);
    setIsActive(result.data.isActive === true);
    setLastTestResult(result.data.lastTestResult || "");
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await loadConfig(); }
      catch (error: any) { if (!cancelled) setMessage(error.message || "Gagal memuat konfigurasi NasionalPay."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/admin/integrations/nasionalpay", {
        method: "PUT",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ storeKey, isActive })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Gagal menyimpan konfigurasi NasionalPay.");
      setStoreKey("");
      setMessage(result.message || "Konfigurasi NasionalPay tersimpan.");
      await loadConfig();
    } catch (error: any) { setMessage(error.message || "Gagal menyimpan konfigurasi NasionalPay."); }
    finally { setSaving(false); }
  };

  const testConnection = async () => {
    setTesting(true); setMessage("");
    try {
      const response = await fetch("/api/admin/integrations/nasionalpay/test", { method: "POST", headers: await authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({}) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Tes koneksi NasionalPay gagal.");
      setLastTestResult("success");
      setMessage(result.message || "Kredensial NasionalPay berhasil diuji.");
      await loadConfig();
    } catch (error: any) { setLastTestResult("failed"); setMessage(error.message || "Tes koneksi NasionalPay gagal."); }
    finally { setTesting(false); }
  };

  if (loading) return <div className="p-8 flex items-center gap-3"><Loader2 className="animate-spin" /> Memuat konfigurasi NasionalPay…</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">NasionalPay Integration</h1>
        <p className="text-sm text-slate-500 mt-1">Integrasi server-side sesuai dokumentasi API NasionalPay untuk QRIS dan DANA.</p>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Nonaktif secara default.</strong> Simpan Store Key saat gateway nonaktif, uji koneksi, lalu aktifkan setelah pengujian checkout dan callback. Aktivasi akan menonaktifkan gateway lain untuk transaksi baru.
      </div>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <strong>Penting — Fee Merchant NasionalPay harus 0%.</strong> iStore sudah menghitung harga jual dan margin. Markup tambahan di dashboard NasionalPay dapat membuat nominal yang dibayar pelanggan berbeda dari nominal order; callback akan ditolak bila nominal status tidak cocok. Jangan aktifkan gateway sebelum pengaturan ini dikonfirmasi.
      </div>
      {message && <div className="rounded-xl border p-3 text-sm flex gap-2 items-start"><AlertCircle size={18} className="shrink-0 mt-0.5" /><span>{message}</span></div>}
      <div className="rounded-2xl border bg-white p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold mb-2">Store Key</label>
          {storeKeyMasked && <p className="text-xs text-slate-500 mb-2">Store Key sudah tersimpan secara terenkripsi.</p>}
          <input type="password" value={storeKey} onChange={e => setStoreKey(e.target.value)} autoComplete="new-password" placeholder="Masukkan Store Key dari dashboard NasionalPay" className="w-full rounded-xl border px-3 py-2.5 text-sm" />
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <div className="font-semibold">Callback URL</div>
          <code className="break-all">https://www.tega.biz.id/api/webhooks/nasionalpay</code>
          <p className="text-xs text-slate-500 mt-2">Daftarkan URL ini di dashboard NasionalPay. Callback harus menyertakan header X-NasionalPay-Signature.</p>
        </div>
        <div className="rounded-xl border p-3 text-sm">
          <div className="font-semibold">Metode terdokumentasi</div>
          <p className="text-slate-600 mt-1">QRIS (menampilkan QRIS image/data) dan DANA (payment URL). Metode lain tidak diaktifkan karena tidak tercakup dalam kontrak API yang diberikan.</p>
        </div>
        <div className="rounded-xl border p-3 text-sm">
          <div className="font-semibold">Tes kredensial tanpa transaksi</div>
          <p className="text-slate-600 mt-1">Tes Koneksi menggunakan endpoint resmi <code>/merchantbalance</code> yang hanya memerlukan Store Key. Anda tidak perlu membuat atau mencari ID transaksi untuk memeriksa akses API.</p>
        </div>
        <label className="flex items-start gap-3 rounded-xl border p-3">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="mt-1" />
          <span><span className="font-semibold block">Aktifkan NasionalPay untuk transaksi baru</span><span className="text-xs text-slate-500">Perlu Store Key tersimpan dan tes kredensial berhasil. Biarkan nonaktif sampai checkout end-to-end terverifikasi.</span></span>
        </label>
        <div className="flex flex-wrap gap-3">
          <button onClick={save} disabled={saving || (isActive && !configured && !storeKey.trim())} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Konfigurasi
          </button>
          <button onClick={testConnection} disabled={saving || testing || !configured || !!storeKey.trim()} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
            {testing ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />} {testing ? "Menguji Koneksi…" : "Tes Koneksi"}
          </button>
        </div>
        <p className="text-xs text-slate-500 flex gap-2"><ShieldCheck size={15} />Store Key dienkripsi sebelum disimpan dan tidak dikembalikan ke browser.</p>
      </div>
      <div className="text-xs text-slate-500">Status: {configured ? "Store Key tersedia" : "Belum dikonfigurasi"} · Tes: {lastTestResult || "Belum diuji"} · Gateway: {isActive ? "Aktif" : "Nonaktif"}</div>
    </div>
  );
}
