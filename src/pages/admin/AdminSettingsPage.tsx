import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../store/auth-store";
import { Store, Save, Loader2, Info, ArrowUp, ArrowDown, Eye, EyeOff, RotateCcw } from "lucide-react";
import { StoreConfiguration } from "../../types/core";

const DEFAULT_HOMEPAGE_LAYOUT = [
  { id: "hero", order: 0, visible: true },
  { id: "ticker", order: 1, visible: true },
  { id: "flashSale", order: 2, visible: true },
  { id: "campaign", order: 3, visible: true },
  { id: "landing", order: 4, visible: true },
  { id: "navigation", order: 5, visible: true },
  { id: "catalog", order: 6, visible: true },
  { id: "blog", order: 7, visible: true },
  { id: "faq", order: 8, visible: true }
] as const;

const HOMEPAGE_LAYOUT_LABELS: Record<string, string> = {
  hero: "Hero / Banner",
  ticker: "Teks Berjalan / Pengumuman",
  flashSale: "Flash Sale",
  campaign: "Campaign Announcement",
  landing: "Landing / Informasi",
  navigation: "Navigasi Kategori",
  catalog: "Katalog Produk",
  blog: "Blog & Berita",
  faq: "FAQ"
};

function normalizeHomepageLayout(value: any) {
  const defaults = DEFAULT_HOMEPAGE_LAYOUT.map(item => ({ ...item }));
  if (!Array.isArray(value?.items)) return defaults;
  const ids = new Set(value.items.map((item: any) => item?.id));
  const valid = value.items.length === defaults.length &&
    value.items.every((item: any) => ids.has(item.id) && typeof item.visible === "boolean");
  if (!valid || ids.size !== defaults.length) return defaults;
  return value.items
    .map((item: any) => ({ id: item.id, order: Number.isInteger(item.order) ? item.order : 999, visible: item.visible }))
    .sort((a: any, b: any) => a.order - b.order)
    .map((item: any, index: number) => ({ ...item, order: index }));
}

export default function AdminSettingsPage() {
  const { role, user } = useAuthStore();
  const [config, setConfig] = useState<StoreConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [homepageLayout, setHomepageLayout] = useState<any[]>(DEFAULT_HOMEPAGE_LAYOUT.map(item => ({ ...item })));
  const [layoutSaving, setLayoutSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      // In a real full-stack we'd call the API, but since Firebase client SDK is used heavily,
      // we can fetch via API to respect the new layered architecture.
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/store-config", {
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
        setHomepageLayout(normalizeHomepageLayout(data.data.homepageLayout));
      } else {
        setError(data.message || "Gagal memuat konfigurasi");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/store-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          name: config.name,
          operationalStatus: config.operationalStatus,
          closedMessage: config.closedMessage,
          maintenanceMessage: config.maintenanceMessage,
          description: config.description,
          contactInformation: config.contactInformation
        })
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
        setSuccessMsg("Konfigurasi berhasil disimpan");
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(data.message || "Gagal menyimpan konfigurasi");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const moveHomepageItem = (index: number, direction: -1 | 1) => {
    setHomepageLayout(current => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((item, itemIndex) => ({ ...item, order: itemIndex }));
    });
  };

  const resetHomepageLayout = () => {
    setHomepageLayout(DEFAULT_HOMEPAGE_LAYOUT.map(item => ({ ...item })));
  };

  const handleSaveHomepageLayout = async () => {
    setLayoutSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/store-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ homepageLayout: { items: homepageLayout.map((item, index) => ({ ...item, order: index })) } })
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
        setHomepageLayout(normalizeHomepageLayout(data.data.homepageLayout));
        setSuccessMsg("Tata letak Homepage berhasil disimpan");
        window.dispatchEvent(new Event("store-config-updated"));
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(data.message || "Gagal menyimpan tata letak Homepage");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLayoutSaving(false);
    }
  };

  if (role !== "pemilik") {
    return (
      <div className="bg-white p-8 rounded-2xl border border-red-200 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
        <Info className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">Akses Ditolak</h2>
        <p className="text-slate-500">Hanya Owner (pemilik) yang dapat mengakses halaman ini.</p>
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

  if (!config) {
    return (
      <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-red-600">
        Gagal memuat konfigurasi. {error}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Pengaturan Sistem</h2>
          <p className="text-sm text-slate-500 mt-1">Kelola informasi utama dan konfigurasi platform</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-xl text-sm">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <Store className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-800">Store Configuration</h3>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">Nama Toko</label>
                <Link to="/admin/branding" className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline">
                  Kelola di Branding →
                </Link>
              </div>
              <div className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-medium text-sm flex items-center justify-between">
                <span className="truncate">{config.name || "Belum diatur"}</span>
                <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded shrink-0">Identitas Toko</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Status Operasional</label>
              <select
                value={config.operationalStatus}
                onChange={(e) => setConfig({ ...config, operationalStatus: e.target.value as any })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="open">Buka (Beroperasi Normal)</option>
                <option value="closed">Tutup Sementara</option>
                <option value="maintenance">Maintenance</option>
              </select>

              {config.operationalStatus === "closed" && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Pesan Tutup Sementara</label>
                  <textarea
                    value={config.closedMessage || ""}
                    onChange={(e) => setConfig({ ...config, closedMessage: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    rows={2}
                    maxLength={500}
                    placeholder="Maaf, toko sedang tutup sementara. Silakan kembali beberapa saat lagi."
                  />
                  <p className="text-xs text-slate-500 mt-1">Pesan yang ditampilkan pada banner website saat toko ditutup sementara (maks. 500 karakter).</p>
                </div>
              )}

              {config.operationalStatus === "maintenance" && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Pesan Maintenance</label>
                  <textarea
                    value={config.maintenanceMessage || ""}
                    onChange={(e) => setConfig({ ...config, maintenanceMessage: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    rows={2}
                    maxLength={500}
                    placeholder="iStore sedang dalam maintenance. Layanan akan kembali normal setelah proses selesai."
                  />
                  <p className="text-xs text-slate-500 mt-1">Pesan yang ditampilkan pada banner website saat sistem dalam pemeliharaan (maks. 500 karakter).</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-700">Deskripsi Toko</label>
              <Link to="/admin/branding" className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline">
                Kelola di Branding →
              </Link>
            </div>
            <div className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-sm leading-relaxed">
              {config.description ? (
                <span>{config.description}</span>
              ) : (
                <span className="text-slate-400 italic">Deskripsi toko belum diatur. Kelola melalui menu Pengaturan Branding.</span>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <h4 className="font-medium text-slate-800 mb-4">Informasi Kontak</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Support</label>
                <input
                  type="email"
                  value={config.contactInformation.email}
                  onChange={(e) => setConfig({
                    ...config,
                    contactInformation: { ...config.contactInformation, email: e.target.value }
                  })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">WhatsApp Admin</label>
                <input
                  type="text"
                  value={config.contactInformation.whatsapp}
                  onChange={(e) => setConfig({
                    ...config,
                    contactInformation: { ...config.contactInformation, whatsapp: e.target.value }
                  })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="628123456789"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
            <div>
              <h4 className="font-medium text-slate-800">Tata Letak Homepage</h4>
              <p className="text-xs text-slate-500 mt-1">Atur urutan dan tampil/sembunyikan bagian Homepage. Fungsi dan rantai data setiap bagian tetap sama.</p>
            </div>
            <button type="button" onClick={resetHomepageLayout} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50">
              <RotateCcw className="w-3.5 h-3.5" />
              Urutan Default
            </button>
          </div>
          <div className="space-y-2">
            {homepageLayout.map((item, index) => (
              <div key={item.id} className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-white">
                <div className="w-7 text-center text-xs font-bold text-slate-400">{index + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800">{HOMEPAGE_LAYOUT_LABELS[item.id] || item.id}</div>
                  <div className="text-[11px] text-slate-400">{item.visible ? "Tampil" : "Disembunyikan"}</div>
                </div>
                <button type="button" onClick={() => moveHomepageItem(index, -1)} disabled={index === 0 || layoutSaving} className="p-2 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30" aria-label="Pindah ke atas"><ArrowUp className="w-4 h-4" /></button>
                <button type="button" onClick={() => moveHomepageItem(index, 1)} disabled={index === homepageLayout.length - 1 || layoutSaving} className="p-2 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30" aria-label="Pindah ke bawah"><ArrowDown className="w-4 h-4" /></button>
                <button type="button" onClick={() => setHomepageLayout(current => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, visible: !entry.visible } : entry))} disabled={layoutSaving} className="p-2 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30" aria-label={item.visible ? "Sembunyikan bagian" : "Tampilkan bagian"}>
                  {item.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-4">
            <button type="button" onClick={handleSaveHomepageLayout} disabled={layoutSaving} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-70">
              {layoutSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Simpan Tata Letak
            </button>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-70"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Simpan Perubahan
          </button>
        </div>
      </form>
    </div>
  );
}
