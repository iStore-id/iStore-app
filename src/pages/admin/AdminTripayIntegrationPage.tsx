import { useEffect, useState } from "react";
import { Save, Loader2, ShieldCheck, AlertCircle, Activity } from "lucide-react";
import { useAuthStore } from "../../store/auth-store";

type Channel = { code: string; name: string };

export default function AdminTripayIntegrationPage() {
  const { user } = useAuthStore();
  const [apiKey, setApiKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [privateKeyConfigured, setPrivateKeyConfigured] = useState(false);
  const [merchantCode, setMerchantCode] = useState("");
  const [isProduction, setIsProduction] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
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
    const response = await fetch("/api/admin/integrations/tripay", { headers: await authHeaders() });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || "Gagal memuat konfigurasi TriPay.");
    setApiKeyMasked(result.data.apiKeyMasked || "");
    setPrivateKeyConfigured(result.data.privateKeyConfigured === true);
    setMerchantCode(result.data.merchantCode || "");
    setIsProduction(result.data.isProduction === true);
    setIsActive(result.data.isActive === true);
    setConfigured(result.data.configured === true);
    setChannels(Array.isArray(result.data.availableChannels) ? result.data.availableChannels.filter((item: any) => item.active !== false).map((item: any) => ({ code: String(item.code), name: String(item.name || item.code) })) : []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadConfig();
      } catch (error: any) {
        if (!cancelled) setMessage(error.message || "Gagal memuat konfigurasi TriPay.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/integrations/tripay", {
        method: "PUT",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ apiKey, privateKey, merchantCode, isProduction, isActive })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Gagal menyimpan konfigurasi TriPay.");
      setApiKey("");
      setPrivateKey("");
      setMessage(result.message || "Konfigurasi TriPay tersimpan.");
      await loadConfig();
    } catch (error: any) {
      setMessage(error.message || "Gagal menyimpan konfigurasi TriPay.");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/integrations/tripay/test", { method: "POST", headers: await authHeaders() });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Tes koneksi TriPay gagal.");
      const found = Array.isArray(result.data?.channels) ? result.data.channels as Channel[] : [];
      setChannels(found);
      const names = found.slice(0, 8).map(channel => channel.name).join(", ");
      setMessage(`${result.message || "Koneksi TriPay berhasil."} ${result.data?.isProduction ? "Mode produksi." : "Mode Sandbox."} ${found.length} kanal aktif: ${names}${found.length > 8 ? ", …" : ""}`);
    } catch (error: any) {
      setMessage(error.message || "Tes koneksi TriPay gagal.");
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="p-8 flex items-center gap-3"><Loader2 className="animate-spin" /> Memuat konfigurasi TriPay…</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">TriPay Integration</h1>
        <p className="text-sm text-slate-500 mt-1">Integrasi gateway TriPay terpisah, menggunakan adapter, konfigurasi, dan webhook khusus.</p>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Sandbox dan nonaktif secara default.</strong> Mengaktifkan TriPay akan menonaktifkan gateway lain untuk transaksi baru sesuai kebijakan iStore yang hanya mengizinkan satu gateway aktif. Riwayat order lama tidak diubah. Uji kredensial dan alur transaksi terlebih dahulu.
      </div>
      {message && <div className="rounded-xl border p-3 text-sm flex gap-2 items-start"><AlertCircle size={18} className="shrink-0 mt-0.5" /><span>{message}</span></div>}
      <div className="rounded-2xl border bg-white p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold mb-2">Kode Merchant</label>
          <input value={merchantCode} onChange={e => setMerchantCode(e.target.value)} autoComplete="off" placeholder="Kode Merchant dari dashboard TriPay" className="w-full rounded-xl border px-3 py-2.5 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">API Key</label>
          {apiKeyMasked && <p className="text-xs text-slate-500 mb-2">Kredensial sudah tersimpan secara terenkripsi.</p>}
          <input value={apiKey} onChange={e => setApiKey(e.target.value)} autoComplete="off" placeholder="Masukkan API Key untuk menyimpan atau mengganti" className="w-full rounded-xl border px-3 py-2.5 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">Private Key</label>
          {privateKeyConfigured && <p className="text-xs text-slate-500 mb-2">Private Key sudah tersimpan secara terenkripsi.</p>}
          <input type="password" value={privateKey} onChange={e => setPrivateKey(e.target.value)} autoComplete="new-password" placeholder="Masukkan Private Key untuk menyimpan atau mengganti" className="w-full rounded-xl border px-3 py-2.5 text-sm" />
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <div className="font-semibold">Webhook URL</div>
          <code className="break-all">https://ist.web.id/api/webhooks/tripay</code>
          <p className="text-xs text-slate-500 mt-2">Daftarkan URL ini pada pengaturan callback TriPay. Signature callback wajib diverifikasi.</p>
        </div>
        <label className="flex items-start gap-3 rounded-xl border p-3">
          <input type="checkbox" checked={isProduction} onChange={e => setIsProduction(e.target.checked)} className="mt-1" />
          <span><span className="font-semibold block">Mode produksi TriPay</span><span className="text-xs text-slate-500">Tidak dicentang berarti Sandbox. Gunakan kredensial yang sesuai dengan mode yang dipilih.</span></span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border p-3">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="mt-1" />
          <span><span className="font-semibold block">Aktifkan TriPay untuk transaksi baru</span><span className="text-xs text-slate-500">Biarkan tidak dicentang sampai tes Sandbox dan checkout end-to-end berhasil.</span></span>
        </label>
        <div className="flex flex-wrap gap-3">
          <button onClick={save} disabled={saving || (isActive && (!configured && (!apiKey.trim() || !privateKey.trim() || !merchantCode.trim())))} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Konfigurasi
          </button>
          <button onClick={testConnection} disabled={saving || testing || !configured || !!apiKey.trim() || !!privateKey.trim()} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
            {testing ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />} {testing ? "Menguji Koneksi…" : "Tes Koneksi"}
          </button>
        </div>
        <p className="text-xs text-slate-500 flex gap-2"><ShieldCheck size={15} />API Key dan Private Key dienkripsi sebelum disimpan. Nilai rahasia tidak dikembalikan ke browser.</p>
        <p className="text-xs text-slate-500">Tes koneksi memakai kredensial yang sudah tersimpan. Simpan perubahan kredensial atau mode terlebih dahulu.</p>
      </div>
      {channels.length > 0 && (
        <div className="rounded-2xl border p-5 space-y-3">
          <h2 className="font-bold">Kanal pembayaran yang terdeteksi</h2>
          <div className="flex flex-wrap gap-2">
            {channels.map(channel => <span key={channel.code} className="rounded-full border px-3 py-1.5 text-xs">{channel.name} <span className="text-slate-400">({channel.code})</span></span>)}
          </div>
          <p className="text-xs text-slate-500">Daftar ini berasal dari akun TriPay yang diuji; kanal dapat berbeda menurut status merchant dan mode.</p>
        </div>
      )}
      <div className="text-xs text-slate-500">Status: {configured ? "Kredensial tersedia" : "Belum lengkap"} · Mode: {isProduction ? "Produksi" : "Sandbox"} · Gateway: {isActive ? "Aktif" : "Nonaktif"}</div>
    </div>
  );
}
