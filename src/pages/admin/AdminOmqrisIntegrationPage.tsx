import { useEffect, useState } from "react";
import { Save, Loader2, ShieldCheck, AlertCircle, Trash2 } from "lucide-react";
import { useAuthStore } from "../../store/auth-store";

export default function AdminOmqrisIntegrationPage() {
  const { role } = useAuthStore();
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [apiSecretConfigured, setApiSecretConfigured] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/integrations/omqris");
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Gagal memuat konfigurasi.");
        if (cancelled) return;
        setApiKeyMasked(result.data.apiKeyMasked || "");
        setApiSecretConfigured(result.data.apiSecretConfigured === true);
        setIsActive(result.data.isActive === true);
        setConfigured(result.data.configured === true);
      } catch (error: any) {
        if (!cancelled) setMessage(error.message || "Gagal memuat konfigurasi OmQris.");
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
      const response = await fetch("/api/admin/integrations/omqris", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, apiSecret, isActive })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Gagal menyimpan konfigurasi.");
      setConfigured(result.data.configured === true);
      setIsActive(result.data.isActive === true);
      setApiKey("");
      setApiSecret("");
      setMessage(result.message || "Konfigurasi tersimpan.");
      const refreshed = await fetch("/api/admin/integrations/omqris").then(r => r.json());
      if (refreshed.success) {
        setApiKeyMasked(refreshed.data.apiKeyMasked || "");
        setApiSecretConfigured(refreshed.data.apiSecretConfigured === true);
      }
    } catch (error: any) {
      setMessage(error.message || "Gagal menyimpan konfigurasi OmQris.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Hapus konfigurasi OmQris? Gateway akan dinonaktifkan.")) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/integrations/omqris", { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Gagal menghapus konfigurasi.");
      setApiKey(""); setApiSecret(""); setApiKeyMasked(""); setApiSecretConfigured(false);
      setConfigured(false); setIsActive(false); setMessage(result.message || "Konfigurasi dihapus.");
    } catch (error: any) {
      setMessage(error.message || "Gagal menghapus konfigurasi.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 flex items-center gap-3"><Loader2 className="animate-spin" /> Memuat konfigurasi OmQris…</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">OmQris Integration</h1>
        <p className="text-sm text-slate-500 mt-1">Gateway QRIS terpisah. Doit.id dan Midtrans tetap menggunakan adapter serta webhook masing-masing.</p>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Nonaktif secara default.</strong> Aktivasi OmQris akan menonaktifkan gateway lain untuk transaksi baru. Transaksi lama iPaymu tetap memakai jalur legacy.
      </div>
      {message && <div className="rounded-xl border p-3 text-sm flex gap-2 items-start"><AlertCircle size={18} />{message}</div>}
      <div className="rounded-2xl border bg-white p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold mb-2">API Key</label>
          {apiKeyMasked && <p className="text-xs text-slate-500 mb-2">Tersimpan: {apiKeyMasked}</p>}
          <input value={apiKey} onChange={e => setApiKey(e.target.value)} autoComplete="off" placeholder="Masukkan API Key baru jika ingin mengganti" className="w-full rounded-xl border px-3 py-2.5 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">API Secret</label>
          {apiSecretConfigured && <p className="text-xs text-slate-500 mb-2">Secret sudah tersimpan dan terenkripsi.</p>}
          <input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} autoComplete="new-password" placeholder="Masukkan API Secret baru jika ingin mengganti" className="w-full rounded-xl border px-3 py-2.5 text-sm" />
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <div className="font-semibold">Webhook URL</div>
          <code className="break-all">https://ist.web.id/api/webhooks/omqris</code>
        </div>
        <label className="flex items-start gap-3 rounded-xl border p-3">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="mt-1" />
          <span><span className="font-semibold block">Aktifkan OmQris untuk transaksi baru</span><span className="text-xs text-slate-500">Hanya aktifkan setelah kredensial disimpan dan diuji di lingkungan OmQris.</span></span>
        </label>
        <div className="flex flex-wrap gap-3">
          <button onClick={save} disabled={saving || (isActive && !configured && (!apiKey.trim() || !apiSecret.trim()))} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Konfigurasi
          </button>
          <button onClick={remove} disabled={saving || !configured} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm disabled:opacity-50"><Trash2 size={16} /> Hapus Konfigurasi</button>
        </div>
        <p className="text-xs text-slate-500 flex gap-2"><ShieldCheck size={15} />Kredensial disimpan terenkripsi di konfigurasi sistem.</p>
      </div>
      <div className="text-xs text-slate-500">Status konfigurasi: {configured ? "Kredensial tersedia" : "Belum lengkap"} · Gateway: {isActive ? "Aktif" : "Nonaktif"}</div>
    </div>
  );
}
