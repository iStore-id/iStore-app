import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../store/auth-store";
import { supabaseGetAccessToken } from "../../lib/supabase-auth";
import { ImageIcon, Plus, Trash2, Edit2, CheckCircle2, AlertCircle, Eye, Calendar, ArrowUpDown, Globe } from "lucide-react";

interface Banner {
  id: string;
  name: string;
  mediaId: string;
  mediaUrl: string;
  displayMode?: 'fit' | 'fill';
  placement: 'homepage_hero' | 'homepage_promo' | 'game_promo';
  title?: string;
  altText?: string;
  target?: string;
  sortOrder: number;
  enabled: boolean;
  published: boolean;
  startAt?: string;
  endAt?: string;
}

interface MediaItem {
  id: string;
  originalName: string;
  url: string;
}

export default function AdminBannersPage() {
  const { user } = useAuthStore();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [placement, setPlacement] = useState<'homepage_hero' | 'homepage_promo' | 'game_promo'>('homepage_hero');
  const [displayMode, setDisplayMode] = useState<'fit' | 'fill'>('fit');
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [title, setTitle] = useState("");
  const [altText, setAltText] = useState("");
  const [target, setTarget] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [published, setPublished] = useState(true);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  // Media Library Picker Modal
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);

  const [bannerToDelete, setBannerToDelete] = useState<Banner | null>(null);

  useEffect(() => {
    fetchBanners();
  }, []);

  const getAuthToken = async () => {
    const supabaseToken = await supabaseGetAccessToken();
    if (supabaseToken) return supabaseToken;
    return await (user as any)?.getIdToken?.();
  };

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const res = await fetch("/api/admin/banners", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setBanners(data.data || []);
      } else {
        setError(data.message);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMediaLibrary = async () => {
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/media?limit=50", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setMediaList(data.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openCreateModal = () => {
    setEditingBanner(null);
    setName("");
    setPlacement("homepage_hero");
    setDisplayMode("fit");
    setMediaUrl("");
    setMediaId("");
    setTitle("");
    setAltText("");
    setTarget("");
    setSortOrder(0);
    setEnabled(true);
    setPublished(true);
    setStartAt("");
    setEndAt("");
    setIsModalOpen(true);
  };

  const openEditModal = (b: Banner) => {
    setEditingBanner(b);
    setName(b.name);
    setPlacement(b.placement);
    setDisplayMode(b.displayMode || "fit");
    setMediaUrl(b.mediaUrl);
    setMediaId(b.mediaId || "");
    setTitle(b.title || "");
    setAltText(b.altText || "");
    setTarget(b.target || "");
    setSortOrder(b.sortOrder || 0);
    setEnabled(b.enabled);
    setPublished(b.published);
    setStartAt(b.startAt || "");
    setEndAt(b.endAt || "");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    try {
      const token = await getAuthToken();
      const payload = {
        name,
        placement,
        displayMode,
        mediaUrl,
        mediaId,
        title,
        altText,
        target,
        sortOrder: Number(sortOrder),
        enabled,
        published,
        startAt: startAt?.trim() ? startAt : null,
        endAt: endAt?.trim() ? endAt : null
      };

      const url = editingBanner ? `/api/admin/banners/${editingBanner.id}` : "/api/admin/banners";
      const method = editingBanner ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || "Terjadi kesalahan pada server");
      }

      if (data.success) {
        setSuccessMsg(editingBanner ? "Banner berhasil diperbarui." : "Banner berhasil dibuat.");
        setIsModalOpen(false);
        fetchBanners();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || "Gagal menyimpan banner");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const confirmDelete = (b: Banner) => {
    setBannerToDelete(b);
  };

  const handleDeleteConfirmed = async () => {
    if (!bannerToDelete) return;
    const id = bannerToDelete.id;
    setBannerToDelete(null);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/admin/banners/${id}`, {
        method: "DELETE",
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || "Terjadi kesalahan pada server");
      }

      if (data.success) {
        setSuccessMsg("Banner berhasil dihapus.");
        fetchBanners();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || "Gagal menghapus banner");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="ui-page-title text-gray-900">Banner & Placement</h1>
          <p className="text-sm text-gray-500">Kelola banner promosi dan penempatannya di halaman utama dan katalog.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Buat Banner Baru
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{successMsg}</span>
        </div>
      )}

      {/* Banners Table */}
      {loading ? (
        <div className="p-12 text-center text-gray-500">Memuat data banner...</div>
      ) : banners.length === 0 ? (
        <div className="p-12 bg-white rounded-xl border border-gray-200 text-center text-gray-500">
          <ImageIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">Belum ada banner dikonfigurasi.</p>
          <p className="text-xs text-gray-400 mt-1">Klik "Buat Banner Baru" untuk mulai menambahkan.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Banner</th>
                  <th className="py-3 px-4">Placement</th>
                  <th className="py-3 px-4">Urutan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Jadwal Tayang</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {banners.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 flex items-center gap-3">
                      <div
                        className="w-16 h-10 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-700/60 shadow-inner"
                        style={{
                          backgroundImage: `linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)`,
                          backgroundSize: '10px 10px',
                          backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0',
                          backgroundColor: '#0f172a'
                        }}
                      >
                        <img src={b.mediaUrl} alt={b.name} className={`w-full h-full ${b.displayMode === 'fill' ? 'object-cover' : 'object-contain'}`} referrerPolicy="no-referrer" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{b.name}</p>
                        <p className="text-xs text-gray-400 truncate max-w-xs">{b.target || "Tanpa Link"}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {b.placement}
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-700">
                          {b.displayMode || 'fit'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-600">{b.sortOrder}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${b.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                          {b.enabled ? 'Active' : 'Disabled'}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${b.published ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800'}`}>
                          {b.published ? 'Published' : 'Draft'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">
                      {b.startAt ? new Date(b.startAt).toLocaleDateString() : 'Selalu'} s/d {b.endAt ? new Date(b.endAt).toLocaleDateString() : 'Selamanya'}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button onClick={() => openEditModal(b)} className="text-gray-600 hover:text-indigo-600 p-1" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => confirmDelete(b)} className="text-gray-400 hover:text-red-600 p-1" title="Hapus">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col my-8">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-950">{editingBanner ? "Edit Banner" : "Buat Banner Baru"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-semibold">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nama Internal Banner</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Banner Promo Lebaran 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Placement (Penempatan)</label>
                <select
                  value={placement}
                  onChange={(e) => setPlacement(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="homepage_hero">Homepage Hero</option>
                  <option value="homepage_promo">Homepage Promotional Area</option>
                  <option value="game_promo">Game / Category Promotional Area</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Mode Tampilan (Display Mode)</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDisplayMode('fit')}
                    className={`px-3 py-2.5 rounded-xl border text-left transition-all ${
                      displayMode === 'fit'
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-gray-200 bg-gray-50/60 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>FIT</span>
                      {displayMode === 'fit' && <span className="text-indigo-600 font-extrabold text-sm">✓</span>}
                    </div>
                    <p className="text-[10.5px] text-gray-500 mt-0.5 leading-tight">Seluruh gambar terlihat (tanpa crop).</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayMode('fill')}
                    className={`px-3 py-2.5 rounded-xl border text-left transition-all ${
                      displayMode === 'fill'
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-gray-200 bg-gray-50/60 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>FILL</span>
                      {displayMode === 'fill' && <span className="text-indigo-600 font-extrabold text-sm">✓</span>}
                    </div>
                    <p className="text-[10.5px] text-gray-500 mt-0.5 leading-tight">Penuhi frame (boleh crop sisi).</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Asset Media (Dari Media Library)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    required
                    readOnly
                    placeholder="Pilih gambar dari Media Library..."
                    value={mediaUrl}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      fetchMediaLibrary();
                      setIsMediaPickerOpen(true);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap"
                  >
                    Pilih Asset
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">Recommended: Widescreen (Rasio 16:9 atau 21:9) · JPG / WebP</p>
                {mediaUrl && (
                  <div
                    className="mt-2 w-32 h-20 rounded-lg overflow-hidden border border-slate-700/60 shadow-inner flex items-center justify-center"
                    style={{
                      backgroundImage: `linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)`,
                      backgroundSize: '12px 12px',
                      backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0',
                      backgroundColor: '#0f172a'
                    }}
                  >
                    <img src={mediaUrl} alt="Preview" className={`w-full h-full ${displayMode === 'fill' ? 'object-cover' : 'object-contain'}`} referrerPolicy="no-referrer" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Judul Overlay (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Judul banner"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Urutan (Sort Order)</label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Target Link / CTA (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: /games/mobile-legends atau https://..."
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Mulai Tayang (Opsional)</label>
                  <input
                    type="datetime-local"
                    value={startAt ? startAt.substring(0, 16) : ""}
                    onChange={(e) => setStartAt(e.target.value ? new Date(e.target.value).toISOString() : "")}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Berakhir (Opsional)</label>
                  <input
                    type="datetime-local"
                    value={endAt ? endAt.substring(0, 16) : ""}
                    onChange={(e) => setEndAt(e.target.value ? new Date(e.target.value).toISOString() : "")}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Enabled (Aktif)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={published}
                    onChange={(e) => setPublished(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Published (Publikasikan)</span>
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"
                >
                  Simpan Banner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Media Picker Modal */}
      {isMediaPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900">Pilih Asset dari Media Library</h3>
              <button onClick={() => setIsMediaPickerOpen(false)} className="text-gray-400 hover:text-gray-600 font-semibold">✕</button>
            </div>
            <div className="p-4 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-3 flex-1">
              {mediaList.map((m) => (
                <div
                  key={m.id}
                  onClick={() => {
                    setMediaUrl(m.url);
                    setMediaId(m.id);
                    setIsMediaPickerOpen(false);
                  }}
                  className="cursor-pointer group bg-white border border-gray-200 rounded-xl overflow-hidden hover:ring-2 hover:ring-indigo-500 transition"
                >
                  <div
                    className="aspect-square overflow-hidden flex items-center justify-center border-b border-slate-200"
                    style={{
                      backgroundImage: `linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)`,
                      backgroundSize: '12px 12px',
                      backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0',
                      backgroundColor: '#e2e8f0'
                    }}
                  >
                    <img src={m.url} alt={m.originalName} className="w-full h-full object-contain group-hover:scale-105 transition" referrerPolicy="no-referrer" />
                  </div>
                  <p className="p-2 text-xs truncate text-gray-700 font-medium">{m.originalName}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {bannerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600 font-bold shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Konfirmasi Hapus Banner
                </h3>
                <p className="text-sm text-gray-500">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Apakah Anda yakin ingin menghapus banner <strong>{bannerToDelete.name}</strong> ({bannerToDelete.placement})?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setBannerToDelete(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
