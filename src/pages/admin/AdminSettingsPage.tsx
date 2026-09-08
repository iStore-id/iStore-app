import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../store/auth-store";
import { Store, Save, Loader2, Info } from "lucide-react";
import { StoreConfiguration } from "../../types/core";

export default function AdminSettingsPage() {
  const { role, user } = useAuthStore();
  const [config, setConfig] = useState<StoreConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nama Toko</label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
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
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Deskripsi Utama</label>
            <textarea
              value={config.description}
              onChange={(e) => setConfig({ ...config, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
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
