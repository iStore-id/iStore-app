import { useEffect, useState } from "react";
import { Save, Loader2, ShieldCheck, AlertCircle, Activity, QrCode } from "lucide-react";
import { useAuthStore } from "../../store/auth-store";

export default function AdminHooseIntegrationPage() {
  const { user } = useAuthStore();
  const [apiKey, setApiKey] = useState("");
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [lastTestResult, setLastTestResult] = useState("");
  const [lastTestedAt, setLastTestedAt] = useState("");
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
    const response = await fetch("/api/admin/integrations/hoose", { headers: await authHeaders() });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || "Gagal memuat konfigurasi Hoose.id.");
    setApiKeyConfigured(result.data.apiKeyConfigured === true);
    setConfigured(result.data.configured === true);
    setIsActive(result.data.isActive === true);
    setLastTestResult(result.data.lastTestResult || "");
    setLastTestedAt(result.data.lastTestedAt || "");
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await loadConfig(); }
      catch (error: any) { if (!cancelled) setMessage(error.message || "Gagal memuat konfigurasi Hoose.id."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/integrations/hoose", {
        method: "PUT",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ apiKey, isActive })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Gagal menyimpan konfigurasi Hoose.id.");
      setApiKey("");
      setMessage(result.message || "Konfigurasi Hoose.id tersimpan.");
      await loadConfig();
    } catch (error: any) {
      setMessage(error.message || "Gagal menyimpan konfigurasi Hoose.id.");
    } finally { setSaving(false); }
  };

  const testConnection = async () => {
    setTesting(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/integrations/hoose/test", {
        method: "POST",
        headers: await authHeaders()
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Tes koneksi Hoose.id gagal.");
      setMessage(result.message || "Koneksi Hoose.id berhasil.");
      await loadConfig();
    } catch (error: any) {
      setMessage(error.message || "Tes koneksi Hoose.id gagal.");
    } finally { setTesting(false); }
  };

  if (loading) return <div className="p-8 flex items-center gap-3"><Loader2 className="animate-spin" /> Memuat konfigurasi Hoose.id…</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600"><QrCode className="w-6 h-6" /></div>
          <div>
            <h1 className="text-2xl font-bold">Hoose.id QRIS Integration</h1>
            <p className="text-sm text-slate-500 mt-1">QRIS dinamis menggunakan QRIS utama milik toko yang dikonfigurasi di dashboard Hoose.id, dengan kode unik otomatis.</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <strong>Mode QRIS sendiri.</strong> API pembuatan QRIS menggunakan QRIS toko berstatus Utama di dashboard Hoose.id secara bawaan. QRIS lain tidak dipilih oleh integrasi ini. Pastikan QRIS KABAY.iD milik toko Anda tetap ditandai sebagai Utama di Hoose.id.
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Nonaktif secara default.</strong> Simpan API Key dalam keadaan nonaktif, tes koneksi, lalu aktifkan. Saat Hoose.id diaktifkan, gateway lain dinonaktifkan untuk transaksi baru. Pesanan lama tetap menggunakan gateway asalnya.
      </div>

      {message && <div className="rounded-xl border p-3 text-sm flex gap-2 items-start"><AlertCircle size={18} className="shrink-0 mt-0.5" /><span>{message}</span></div>}

      <div className="rounded-2xl border bg-white p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold mb-2">API Key Hoose.id</label>
          {apiKeyConfigured && <p className="text-xs text-slate-500 mb-2">API Key sudah tersimpan secara terenkripsi. Isi hanya jika ingin mengganti.</p>}
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            autoComplete="new-password"
            placeholder="Masukkan API Key dari dashboard Hoose.id"
            className="w-full rounded-xl border px-3 py-2.5 text-sm"
          />
        </div>

        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <div className="font-semibold">Webhook URL</div>
          <code className="break-all">https://www.tega.biz.id/api/webhooks/hoose</code>
          <p className="text-xs text-slate-500 mt-2">Daftarkan sebagai URL webhook toko di dashboard Hoose.id. Event pembayaran: transaction.paid. Signature X-Signature diverifikasi menggunakan HMAC-SHA256 dan API Key.</p>
        </div>

        <label className="flex items-start gap-3 rounded-xl border p-3">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="mt-1" />
          <span>
            <span className="font-semibold block">Aktifkan Hoose.id untuk transaksi baru</span>
            <span className="text-xs text-slate-500">Hanya dapat diaktifkan setelah tes koneksi berhasil dan API Key tidak berubah sejak tes terakhir.</span>
          </span>
        </label>

        <div className="flex flex-wrap gap-3">
          <button onClick={save} disabled={saving || (isActive && (!configured || !!apiKey.trim()))} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Konfigurasi
          </button>
          <button onClick={testConnection} disabled={saving || testing || !configured || !!apiKey.trim()} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
            {testing ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />} {testing ? "Menguji Koneksi…" : "Tes Koneksi"}
          </button>
        </div>

        <p className="text-xs text-slate-500 flex gap-2"><ShieldCheck size={15} />API Key dienkripsi sebelum disimpan. Nilai rahasia tidak pernah dikirim kembali ke browser.</p>
        <p className="text-xs text-slate-500">Urutan aktivasi: masukkan API Key → Simpan saat nonaktif → Tes Koneksi → centang Aktifkan → Simpan.</p>
      </div>

      <div className="text-xs text-slate-500">
        Status: {configured ? "API Key tersedia" : "Belum dikonfigurasi"} · Tes: {lastTestResult === "success" ? "Berhasil" : lastTestResult === "failed" ? "Gagal" : "Belum dilakukan"} · Gateway: {isActive ? "Aktif" : "Nonaktif"}
        {lastTestedAt ? ` · Terakhir diuji: ${new Date(lastTestedAt).toLocaleString("id-ID")}` : ""}
      </div>
    </div>
  );
}
