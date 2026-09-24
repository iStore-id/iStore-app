import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../store/auth-store";
import { Sparkles, Plus, Trash2, Edit2, CheckCircle2, AlertCircle, Eye, Calendar, Megaphone } from "lucide-react";

interface Popup {
  id: string;
  name: string;
  title: string;
  content: string;
  mediaId?: string;
  mediaUrl?: string;
  placement: 'homepage' | 'all_pages' | 'checkout';
  trigger: 'immediate' | 'delay_3s' | 'exit_intent';
  target?: string;
  priority: number;
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

export default function AdminPopupsPage() {
  const { user } = useAuthStore();
  const [popups, setPopups] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPopup, setEditingPopup] = useState<Popup | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [placement, setPlacement] = useState<'homepage' | 'all_pages' | 'checkout'>('homepage');
  const [trigger, setTrigger] = useState<'immediate' | 'delay_3s' | 'exit_intent'>('immediate');
  const [target, setTarget] = useState("");
  const [priority, setPriority] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [published, setPublished] = useState(true);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  // Media Library Picker Modal
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);

  useEffect(() => {
    fetchPopups();
  }, []);

  const fetchPopups = async () => {
    try {
      setLoading(true);
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/popups", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setPopups(data.data || []);
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
      const token = await (user as any)?.getIdToken?.();
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
    setEditingPopup(null);
    setName("");
    setTitle("");
    setContent("");
    setMediaUrl("");
    setMediaId("");
    setPlacement("homepage");
    setTrigger("immediate");
    setTarget("");
    setPriority(0);
    setEnabled(true);
    setPublished(true);
    setStartAt("");
    setEndAt("");
    setIsModalOpen(true);
  };

  const openEditModal = (p: Popup) => {
    setEditingPopup(p);
    setName(p.name);
    setTitle(p.title);
    setContent(p.content);
    setMediaUrl(p.mediaUrl || "");
    setMediaId(p.mediaId || "");
    setPlacement(p.placement);
    setTrigger(p.trigger);
    setTarget(p.target || "");
    setPriority(p.priority || 0);
    setEnabled(p.enabled);
    setPublished(p.published);
    setStartAt(p.startAt || "");
    setEndAt(p.endAt || "");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    try {
      const token = await (user as any)?.getIdToken?.();
      const payload = {
        name,
        title,
        content,
        mediaUrl,
        mediaId,
        placement,
        trigger,
        target,
        priority: Number(priority),
        enabled,
        published,
        startAt,
        endAt
      };

      const url = editingPopup ? `/api/admin/popups/${editingPopup.id}` : "/api/admin/popups";
      const method = editingPopup ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(editingPopup ? "Popup berhasil diperbarui." : "Popup berhasil dibuat.");
        setIsModalOpen(false);
        fetchPopups();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || "Gagal menyimpan popup");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus popup ini?")) return;
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/popups/${id}`, {
        method: "DELETE",
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Popup berhasil dihapus.");
        fetchPopups();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || "Gagal menghapus popup");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="ui-page-title text-gray-900">Popup Management</h1>
          <p className="text-sm text-gray-500">Kelola popup promosi dan pengumuman untuk pelanggan.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Buat Popup Baru
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

      {loading ? (
        <div className="p-12 text-center text-gray-500">Memuat data popup...</div>
      ) : popups.length === 0 ? (
        <div className="p-12 bg-white rounded-xl border border-gray-200 text-center text-gray-500">
          <Megaphone className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">Belum ada popup dikonfigurasi.</p>
          <p className="text-xs text-gray-400 mt-1">Klik "Buat Popup Baru" untuk mulai menambahkan.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Popup</th>
                  <th className="py-3 px-4">Placement</th>
                  <th className="py-3 px-4">Trigger</th>
                  <th className="py-3 px-4">Prioritas</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {popups.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 flex items-center gap-3">
                      {p.mediaUrl ? (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                          <img src={p.mediaUrl} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          POP
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-500 font-medium">{p.title}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {p.placement}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {p.trigger}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-600">{p.priority}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${p.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                          {p.enabled ? 'Active' : 'Disabled'}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${p.published ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800'}`}>
                          {p.published ? 'Published' : 'Draft'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button onClick={() => openEditModal(p)} className="text-gray-600 hover:text-indigo-600 p-1" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="text-gray-400 hover:text-red-600 p-1" title="Hapus">
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
              <h3 className="text-lg font-bold text-gray-950">{editingPopup ? "Edit Popup" : "Buat Popup Baru"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-semibold">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nama Internal Popup</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Popup Flash Sale Lebaran"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Judul Popup</label>
                <input
                  type="text"
                  required
                  placeholder="Judul banner/pengumuman"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Konten / Pesan</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Isi pesan atau deskripsi popup..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Asset Media (Dari Media Library - Opsional)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
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
                {mediaUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="w-20 h-14 rounded-lg overflow-hidden border bg-gray-100">
                      <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <button type="button" onClick={() => { setMediaUrl(""); setMediaId(""); }} className="text-xs text-red-600 hover:underline">Hapus Gambar</button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Placement</label>
                  <select
                    value={placement}
                    onChange={(e) => setPlacement(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="homepage">Homepage</option>
                    <option value="all_pages">Semua Halaman (All Pages)</option>
                    <option value="checkout">Checkout</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Trigger</label>
                  <select
                    value={trigger}
                    onChange={(e) => setTrigger(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="immediate">Langsung (Immediate)</option>
                    <option value="delay_3s">Delay 3 Detik</option>
                    <option value="exit_intent">Exit Intent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Target Link / CTA (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: /games atau https://..."
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Prioritas (Priority)</label>
                  <input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
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
                  Simpan Popup
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
                  <div className="aspect-square bg-gray-100 overflow-hidden">
                    <img src={m.url} alt={m.originalName} className="w-full h-full object-cover group-hover:scale-105 transition" referrerPolicy="no-referrer" />
                  </div>
                  <p className="p-2 text-xs truncate text-gray-700 font-medium">{m.originalName}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
