import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../store/auth-store";
import {
  Megaphone,
  Plus,
  Trash2,
  Edit2,
  Archive,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  TicketPercent,
  Zap,
  ImageIcon,
  MousePointer2,
  ExternalLink,
  Search,
  Filter
} from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  title: string;
  description: string;
  slug?: string;
  mediaId?: string;
  mediaUrl?: string;
  promoIds?: string[];
  flashSaleIds?: string[];
  bannerIds?: string[];
  popupIds?: string[];
  targetType?: 'all' | 'game' | 'category' | 'product' | 'custom_url';
  targetId?: string;
  targetUrl?: string;
  priority: number;
  enabled: boolean;
  published: boolean;
  isArchived: boolean;
  startAt: string;
  endAt?: string;
  status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'INACTIVE' | 'ARCHIVED';
  createdAt: string;
}

interface ComponentData {
  promos: Array<{ id: string; name: string; code: string; discountType: string; discountValue: number }>;
  flashSales: Array<{ id: string; name: string; salePrice: number; startAt: string; endAt: string }>;
  banners: Array<{ id: string; name: string; title?: string; mediaUrl: string; placement: string }>;
  popups: Array<{ id: string; name: string; title: string; placement: string; trigger: string }>;
}

interface MediaItem {
  id: string;
  originalName: string;
  url: string;
}

export default function AdminCampaignsPage() {
  const { user } = useAuthStore();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Available components for selection
  const [componentsData, setComponentsData] = useState<ComponentData>({
    promos: [],
    flashSales: [],
    banners: [],
    popups: []
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [selectedPromoIds, setSelectedPromoIds] = useState<string[]>([]);
  const [selectedFlashSaleIds, setSelectedFlashSaleIds] = useState<string[]>([]);
  const [selectedBannerIds, setSelectedBannerIds] = useState<string[]>([]);
  const [selectedPopupIds, setSelectedPopupIds] = useState<string[]>([]);
  const [targetType, setTargetType] = useState<'all' | 'game' | 'category' | 'product' | 'custom_url'>('all');
  const [targetUrl, setTargetUrl] = useState("");
  const [priority, setPriority] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [published, setPublished] = useState(true);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  // Media Library Picker Modal
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);

  useEffect(() => {
    fetchCampaigns();
    fetchComponentsData();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/campaigns", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setCampaigns(data.data || []);
      } else {
        setError(data.message);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchComponentsData = async () => {
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/campaigns/components-data", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success && data.data) {
        setComponentsData(data.data);
      }
    } catch (err) {
      console.error("Error loading component references:", err);
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
    setEditingCampaign(null);
    setName("");
    setTitle("");
    setDescription("");
    setSlug("");
    setMediaUrl("");
    setMediaId("");
    setSelectedPromoIds([]);
    setSelectedFlashSaleIds([]);
    setSelectedBannerIds([]);
    setSelectedPopupIds([]);
    setTargetType("all");
    setTargetUrl("");
    setPriority(0);
    setEnabled(true);
    setPublished(true);
    setStartAt(new Date().toISOString().substring(0, 16));
    setEndAt("");
    setIsModalOpen(true);
  };

  const openEditModal = (c: Campaign) => {
    setEditingCampaign(c);
    setName(c.name);
    setTitle(c.title);
    setDescription(c.description);
    setSlug(c.slug || "");
    setMediaUrl(c.mediaUrl || "");
    setMediaId(c.mediaId || "");
    setSelectedPromoIds(c.promoIds || []);
    setSelectedFlashSaleIds(c.flashSaleIds || []);
    setSelectedBannerIds(c.bannerIds || []);
    setSelectedPopupIds(c.popupIds || []);
    setTargetType(c.targetType || "all");
    setTargetUrl(c.targetUrl || "");
    setPriority(c.priority || 0);
    setEnabled(c.enabled);
    setPublished(c.published);
    setStartAt(c.startAt ? c.startAt.substring(0, 16) : "");
    setEndAt(c.endAt ? c.endAt.substring(0, 16) : "");
    setIsModalOpen(true);
  };

  const toggleArrayItem = (item: string, list: string[], setList: (v: string[]) => void) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
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
        description,
        slug: slug || undefined,
        mediaUrl: mediaUrl || undefined,
        mediaId: mediaId || undefined,
        promoIds: selectedPromoIds,
        flashSaleIds: selectedFlashSaleIds,
        bannerIds: selectedBannerIds,
        popupIds: selectedPopupIds,
        targetType,
        targetUrl: targetUrl || undefined,
        priority: Number(priority),
        enabled,
        published,
        startAt: startAt ? new Date(startAt).toISOString() : new Date().toISOString(),
        endAt: endAt ? new Date(endAt).toISOString() : undefined
      };

      const url = editingCampaign ? `/api/admin/campaigns/${editingCampaign.id}` : "/api/admin/campaigns";
      const method = editingCampaign ? "PUT" : "POST";

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
        setSuccessMsg(editingCampaign ? "Campaign berhasil diperbarui." : "Campaign berhasil dibuat.");
        setIsModalOpen(false);
        fetchCampaigns();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || "Gagal menyimpan campaign");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Arsipkan campaign ini? Campaign tidak akan aktif bagi pelanggan.")) return;
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/campaigns/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ isArchived: true })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Campaign berhasil diarsipkan.");
        fetchCampaigns();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || "Gagal mengarsipkan campaign");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus campaign ini secara permanen? Komponen terkait (Promo, Flash Sale, Banner, Popup) TIDAK akan terhapus.")) return;
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/campaigns/${id}`, {
        method: "DELETE",
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Campaign berhasil dihapus.");
        fetchCampaigns();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || "Gagal menghapus campaign");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getStatusBadge = (status: Campaign['status']) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">ACTIVE</span>;
      case 'SCHEDULED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">SCHEDULED</span>;
      case 'DRAFT':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">DRAFT</span>;
      case 'ENDED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">ENDED</span>;
      case 'INACTIVE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">INACTIVE</span>;
      case 'ARCHIVED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">ARCHIVED</span>;
      default:
        return null;
    }
  };

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Campaign Management</h1>
          <p className="text-sm text-gray-500">
            Koordinasi dan orkestrasi kampanye promosi, event musiman, diskon, dan banner terintegrasi.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Buat Campaign Baru
        </button>
      </div>

      {/* Alert Notices */}
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Cari campaign berdasarkan nama atau judul..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Active</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="DRAFT">Draft</option>
            <option value="ENDED">Ended</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      {/* Content Table / Empty state */}
      {loading ? (
        <div className="p-12 text-center text-gray-500">Memuat data campaign...</div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="p-12 bg-white rounded-xl border border-gray-200 text-center text-gray-500">
          <Megaphone className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">Belum ada campaign yang sesuai filter.</p>
          <p className="text-xs text-gray-400 mt-1">Klik "Buat Campaign Baru" untuk meluncurkan kampanye pemasaran.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Campaign</th>
                  <th className="py-3 px-4">Status & Jadwal</th>
                  <th className="py-3 px-4">Komponen Terhubung</th>
                  <th className="py-3 px-4">Prioritas</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {filteredCampaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {c.mediaUrl ? (
                          <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                            <img src={c.mediaUrl} alt={c.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            <Megaphone className="w-6 h-6" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-900">{c.title}</p>
                          <p className="text-xs text-gray-500 font-medium">Internal: {c.name}</p>
                          <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{c.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div>{getStatusBadge(c.status)}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 font-mono">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>{new Date(c.startAt).toLocaleDateString("id-ID")}</span>
                          {c.endAt && <span>- {new Date(c.endAt).toLocaleDateString("id-ID")}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        {c.promoIds && c.promoIds.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium" title="Promo / Voucher">
                            <TicketPercent className="w-3 h-3" /> {c.promoIds.length} Promo
                          </span>
                        )}
                        {c.flashSaleIds && c.flashSaleIds.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-medium" title="Flash Sale">
                            <Zap className="w-3 h-3" /> {c.flashSaleIds.length} Flash Sale
                          </span>
                        )}
                        {c.bannerIds && c.bannerIds.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-medium" title="Banner">
                            <ImageIcon className="w-3 h-3" /> {c.bannerIds.length} Banner
                          </span>
                        )}
                        {c.popupIds && c.popupIds.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-pink-50 text-pink-700 font-medium" title="Popup">
                            <MousePointer2 className="w-3 h-3" /> {c.popupIds.length} Popup
                          </span>
                        )}
                        {(!c.promoIds || c.promoIds.length === 0) && 
                         (!c.flashSaleIds || c.flashSaleIds.length === 0) && 
                         (!c.bannerIds || c.bannerIds.length === 0) && 
                         (!c.popupIds || c.popupIds.length === 0) && (
                          <span className="text-gray-400 text-xs italic">Tanpa komponen</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-600">{c.priority}</td>
                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                      <button onClick={() => openEditModal(c)} className="text-gray-600 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-gray-100 transition" title="Edit Campaign">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {!c.isArchived && (
                        <button onClick={() => handleArchive(c.id)} className="text-gray-500 hover:text-purple-600 p-1.5 rounded-lg hover:bg-purple-50 transition" title="Arsipkan Campaign">
                          <Archive className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(c.id)} className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition" title="Hapus Campaign">
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

      {/* Modal Form: Create / Edit Campaign */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col my-8">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-950">{editingCampaign ? "Edit Campaign" : "Buat Campaign Baru"}</h3>
                <p className="text-xs text-gray-500">Konfigurasi parameter kampanye dan komponen pemasaran terkait.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-semibold">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nama Internal</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Campaign Ramadhan Sale 2026"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Judul Tampilan Publik</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Festival Diskon Berkah Ramadhan"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Deskripsi Kampanye</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Penjelasan ringkas kampanye untuk pelanggan..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Link / Tujuan (Slug) - Opsional</label>
                <input
                  type="text"
                  placeholder="Contoh: ramadhan-sale"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Media Asset (Media Library integration) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Visual Cover (Dari Media Library)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    readOnly
                    placeholder="Pilih visual banner kampanye..."
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
                    <div className="w-24 h-14 rounded-lg overflow-hidden border bg-gray-100">
                      <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <button type="button" onClick={() => { setMediaUrl(""); setMediaId(""); }} className="text-xs text-red-600 hover:underline">Hapus Gambar</button>
                  </div>
                )}
              </div>

              {/* Marketing Components Orchestration */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-sm font-bold text-slate-800">Orkestrasi Komponen Marketing</h4>
                </div>
                <p className="text-xs text-slate-500">Hubungkan promo, flash sale, banner, atau popup yang sudah ada ke dalam kampanye ini.</p>

                {/* Promo Selection */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <TicketPercent className="w-3.5 h-3.5 text-blue-600" /> Hubungkan Promo / Voucher
                      </label>
                      {componentsData.promos.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Belum ada promo aktif di Promo Engine.</p>
                      ) : (
                        <div className="max-h-32 overflow-y-auto space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                          {componentsData.promos.map((p) => (
                            <label key={p.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={selectedPromoIds.includes(p.id)}
                                onChange={() => toggleArrayItem(p.id, selectedPromoIds, setSelectedPromoIds)}
                                className="rounded text-indigo-600"
                              />
                              <span className="font-semibold text-slate-900">{p.code}</span>
                              <span className="text-slate-500">- {p.name} ({p.discountType === 'percentage' ? `${p.discountValue}%` : `Rp ${p.discountValue}`})</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Flash Sale Selection */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-600" /> Hubungkan Flash Sale
                      </label>
                      {componentsData.flashSales.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Belum ada item Flash Sale.</p>
                      ) : (
                        <div className="max-h-32 overflow-y-auto space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                          {componentsData.flashSales.map((fs) => (
                            <label key={fs.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={selectedFlashSaleIds.includes(fs.id)}
                                onChange={() => toggleArrayItem(fs.id, selectedFlashSaleIds, setSelectedFlashSaleIds)}
                                className="rounded text-indigo-600"
                              />
                              <span className="font-semibold text-slate-900">{fs.name}</span>
                              <span className="text-slate-500">- Rp {fs.salePrice.toLocaleString("id-ID")}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Banner Selection */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-purple-600" /> Hubungkan Banner
                      </label>
                      {componentsData.banners.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Belum ada banner terkonfigurasi.</p>
                      ) : (
                        <div className="max-h-32 overflow-y-auto space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                          {componentsData.banners.map((b) => (
                            <label key={b.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={selectedBannerIds.includes(b.id)}
                                onChange={() => toggleArrayItem(b.id, selectedBannerIds, setSelectedBannerIds)}
                                className="rounded text-indigo-600"
                              />
                              <span className="font-semibold text-slate-900">{b.name}</span>
                              <span className="text-slate-500">({b.placement})</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Popup Selection */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <MousePointer2 className="w-3.5 h-3.5 text-pink-600" /> Hubungkan Popup
                      </label>
                      {componentsData.popups.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Belum ada popup terkonfigurasi.</p>
                      ) : (
                        <div className="max-h-32 overflow-y-auto space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                          {componentsData.popups.map((pop) => (
                            <label key={pop.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={selectedPopupIds.includes(pop.id)}
                                onChange={() => toggleArrayItem(pop.id, selectedPopupIds, setSelectedPopupIds)}
                                className="rounded text-indigo-600"
                              />
                              <span className="font-semibold text-slate-900">{pop.name}</span>
                              <span className="text-slate-500">({pop.trigger})</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

              {/* Schedule and Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Mulai Tayang</label>
                  <input
                    type="datetime-local"
                    required
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Berakhir (Opsional)</label>
                  <input
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
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

              {/* Toggles */}
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

              {/* Submit / Cancel Buttons */}
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
                  Simpan Campaign
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
