import React, { useEffect, useState } from "react";
import { useAuthStore } from "../../store/auth-store";
import { Link } from "react-router-dom";
import {
  Layout,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Archive,
  CheckCircle2,
  XCircle,
  Clock,
  Globe,
  ExternalLink,
  Copy,
  Check,
  ImageIcon,
  ArrowUp,
  ArrowDown,
  Trash,
  Gamepad2,
  Tag,
  AlertCircle,
  HelpCircle,
  FileText,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Monitor
} from "lucide-react";
import { LandingPage, LandingBlock, LandingBlockType, LandingStatus } from "../../types/landing";

interface MediaItem {
  id: string;
  originalName: string;
  url: string;
  mimeType: string;
  size: number;
}

export default function AdminLandingsPage() {
  const { user } = useAuthStore();

  // State List & Filtering
  const [landings, setLandings] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Components Data Reference
  const [componentsData, setComponentsData] = useState<{
    games: any[];
    promos: any[];
    flashSales: any[];
    campaigns: any[];
  }>({ games: [], promos: [], flashSales: [], campaigns: [] });

  // Media Library Modal
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [mediaTargetField, setMediaTargetField] = useState<{ type: "cover" | "block"; blockIndex?: number } | null>(null);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [mediaSearch, setMediaSearch] = useState("");

  // Editor Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "blocks" | "schedule">("info");
  const [editingLanding, setEditingLanding] = useState<LandingPage | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [gameId, setGameId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [published, setPublished] = useState(false);
  const [sections, setSections] = useState<LandingBlock[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Live Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewLanding, setPreviewLanding] = useState<any | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  useEffect(() => {
    fetchLandings();
    fetchComponentsData();
  }, [page, statusFilter, search]);

  const fetchLandings = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await (user as any)?.getIdToken?.();
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        status: statusFilter,
        search: search.trim()
      });

      const res = await fetch(`/api/admin/landings?${params.toString()}`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const json = await res.json();
      if (json.success) {
        setLandings(json.data || []);
        setTotalPages(json.totalPages || 1);
        setTotalItems(json.total || 0);
      } else {
        setError(json.message);
      }
    } catch (err: any) {
      setError(err.message || "Gagal mengambil daftar Landing Pages.");
    } finally {
      setLoading(false);
    }
  };

  const fetchComponentsData = async () => {
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/landings/components-data", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const json = await res.json();
      if (json.success && json.data) {
        setComponentsData(json.data);
      }
    } catch (e) {
      console.error("Error loading component references:", e);
    }
  };

  const fetchMediaLibrary = async () => {
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/media?limit=50", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const json = await res.json();
      if (json.success) {
        setMediaList(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenMediaPicker = (target: { type: "cover" | "block"; blockIndex?: number }) => {
    setMediaTargetField(target);
    fetchMediaLibrary();
    setIsMediaPickerOpen(true);
  };

  const handleSelectMedia = (item: MediaItem) => {
    if (!mediaTargetField) return;
    if (mediaTargetField.type === "cover") {
      setMediaId(item.id);
      setMediaUrl(item.url);
    } else if (mediaTargetField.type === "block" && mediaTargetField.blockIndex !== undefined) {
      const updated = [...sections];
      updated[mediaTargetField.blockIndex].data = {
        ...updated[mediaTargetField.blockIndex].data,
        mediaId: item.id,
        mediaUrl: item.url
      };
      setSections(updated);
    }
    setIsMediaPickerOpen(false);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!editingLanding && !slug) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generated);
    }
  };

  const openCreateModal = () => {
    setEditingLanding(null);
    setName("");
    setTitle("");
    setSlug("");
    setDescription("");
    setSeoTitle("");
    setSeoDescription("");
    setMediaId("");
    setMediaUrl("");
    setCtaText("");
    setCtaUrl("");
    setCampaignId("");
    setGameId("");
    setCategoryId("");
    setStartAt(new Date().toISOString().substring(0, 16));
    setEndAt("");
    setEnabled(true);
    setPublished(false);
    setSections([
      {
        id: `block_${Date.now()}_1`,
        type: "HERO",
        order: 0,
        data: {
          title: "Promo Spesial",
          subtitle: "Dapatkan penawaran top up terbaik hanya di iStore.id",
          badge: "Event Terbatas",
          alignment: "center",
          ctaText: "Lihat Penawaran",
          ctaUrl: "#katalog"
        }
      }
    ]);
    setActiveTab("info");
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (landing: LandingPage) => {
    setEditingLanding(landing);
    setName(landing.name);
    setTitle(landing.title);
    setSlug(landing.slug);
    setDescription(landing.description);
    setSeoTitle(landing.seoTitle || "");
    setSeoDescription(landing.seoDescription || "");
    setMediaId(landing.mediaId || "");
    setMediaUrl(landing.mediaUrl || "");
    setCtaText(landing.ctaText || "");
    setCtaUrl(landing.ctaUrl || "");
    setCampaignId(landing.campaignId || "");
    setGameId(landing.gameId || "");
    setCategoryId(landing.categoryId || "");
    setStartAt(landing.startAt ? landing.startAt.substring(0, 16) : "");
    setEndAt(landing.endAt ? landing.endAt.substring(0, 16) : "");
    setEnabled(landing.enabled);
    setPublished(landing.published);
    setSections(landing.sections || []);
    setActiveTab("info");
    setFormError(null);
    setIsModalOpen(true);
  };

  const addBlock = (type: LandingBlockType) => {
    const newBlock: LandingBlock = {
      id: `block_${Date.now()}_${sections.length + 1}`,
      type,
      order: sections.length,
      data: getDefaultBlockData(type)
    };
    setSections([...sections, newBlock]);
  };

  const getDefaultBlockData = (type: LandingBlockType) => {
    switch (type) {
      case "HERO":
        return {
          title: title || "Judul Hero",
          subtitle: "Penjelasan singkat promosi",
          badge: "Eksklusif",
          alignment: "center",
          ctaText: "Mulai Top Up",
          ctaUrl: "/#katalog"
        };
      case "TEXT":
        return {
          heading: "Syarat & Ketentuan",
          content: "1. Berlaku untuk seluruh pengguna iStore.id\n2. Penawaran dapat berubah sewaktu-waktu.",
          alignment: "left"
        };
      case "IMAGE":
        return {
          mediaUrl: "",
          caption: "Banner promosi resmi",
          altText: "Promo Banner"
        };
      case "CTA":
        return {
          title: "Jangan Sampai Ketinggalan!",
          description: "Top up game favoritmu sekarang dan dapatkan bonus saldo instan.",
          buttonText: "Top Up Sekarang",
          targetUrl: "/#katalog"
        };
      case "PRODUCT_HIGHLIGHT":
        return {
          gameId: componentsData.games[0]?.id || "",
          customTitle: "Game Pilihan Hari Ini",
          customDescription: "Nikmati kemudahan transaksi top up secepat kilat"
        };
      case "PROMO_HIGHLIGHT":
        return {
          promoId: componentsData.promos[0]?.id || "",
          customTitle: "Voucher Diskon Spesial",
          customDescription: "Gunakan kode voucher saat melakukan pembayaran"
        };
    }
  };

  const removeBlock = (index: number) => {
    const updated = sections.filter((_, i) => i !== index);
    setSections(updated.map((b, i) => ({ ...b, order: i })));
  };

  const moveBlock = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === sections.length - 1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...sections];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setSections(updated.map((b, i) => ({ ...b, order: i })));
  };

  const updateBlockData = (index: number, newFieldData: any) => {
    const updated = [...sections];
    updated[index].data = { ...updated[index].data, ...newFieldData };
    setSections(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !title.trim() || !slug.trim() || !description.trim()) {
      setFormError("Nama internal, judul publik, slug, dan deskripsi wajib diisi.");
      return;
    }

    try {
      setSaving(true);
      const token = await (user as any)?.getIdToken?.();
      const payload = {
        name,
        title,
        slug,
        description,
        seoTitle,
        seoDescription,
        mediaId,
        mediaUrl,
        ctaText,
        ctaUrl,
        campaignId,
        gameId,
        categoryId,
        startAt: startAt ? new Date(startAt).toISOString() : "",
        endAt: endAt ? new Date(endAt).toISOString() : "",
        enabled,
        published,
        sections
      };

      const url = editingLanding ? `/api/admin/landings/${editingLanding.id}` : "/api/admin/landings";
      const method = editingLanding ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json.success) {
        setIsModalOpen(false);
        setSuccessMsg(editingLanding ? "Landing page berhasil diperbarui." : "Landing page berhasil dibuat.");
        fetchLandings();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setFormError(json.message || "Gagal menyimpan landing page.");
      }
    } catch (err: any) {
      setFormError(err.message || "Terjadi kesalahan sistem saat menyimpan.");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (landing: LandingPage) => {
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/landings/${landing.id}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ published: !landing.published })
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg(`Status publikasi berhasil diubah menjadi ${!landing.published ? "Publik" : "Draft"}.`);
        fetchLandings();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        alert(json.message);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin mengarsipkan landing page ini? Halaman ini tidak akan tampil ke publik.")) return;
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/landings/${id}/archive`, {
        method: "POST",
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg("Landing page berhasil diarsipkan.");
        fetchLandings();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        alert(json.message);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus landing page ini secara permanen? Referensi media dan katalog tetap aman.")) return;
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/landings/${id}`, {
        method: "DELETE",
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg("Landing page berhasil dihapus.");
        fetchLandings();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        alert(json.message);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleOpenPreview = async (landing: LandingPage) => {
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/landings/${landing.id}/preview`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const json = await res.json();
      if (json.success) {
        setPreviewLanding(json.data);
        setPreviewModalOpen(true);
      } else {
        alert(json.message);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCopyLink = (slugName: string) => {
    const fullUrl = `${window.location.origin}/promo/${slugName}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedSlug(slugName);
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  const getStatusBadge = (status: LandingStatus) => {
    switch (status) {
      case "ACTIVE":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">AKTIF</span>;
      case "SCHEDULED":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">TERJADWAL</span>;
      case "DRAFT":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">DRAFT</span>;
      case "ENDED":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">BERAKHIR</span>;
      case "INACTIVE":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">NONAKTIF</span>;
      case "ARCHIVED":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-200 text-zinc-700">ARSIP</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">{status}</span>;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Layout className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Landing Pages</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Bangun dan publikasikan halaman kampanye promosi dan event khusus iStore.id
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> Buat Landing Page
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          {error}
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama, judul, atau slug..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs font-semibold rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="SCHEDULED">Terjadwal</option>
            <option value="DRAFT">Draft</option>
            <option value="ENDED">Berakhir</option>
            <option value="INACTIVE">Nonaktif</option>
            <option value="ARCHIVED">Arsip</option>
          </select>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm text-slate-500">Memuat landing pages...</p>
          </div>
        ) : landings.length === 0 ? (
          <div className="py-20 text-center">
            <Layout className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900">Belum Ada Landing Page</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              Buat landing page pertama Anda untuk mempromosikan event game dan voucher iStore.id.
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Buat Sekarang
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Halaman & Slug</th>
                  <th className="px-4 py-3.5">Blok</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Jadwal Tayang</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {landings.map((landing) => (
                  <tr key={landing.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                          {landing.mediaUrl ? (
                            <img
                              src={landing.mediaUrl}
                              alt={landing.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <Layout className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm line-clamp-1">{landing.name}</p>
                          <p className="text-xs text-slate-500 line-clamp-1">{landing.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                              /promo/{landing.slug}
                            </span>
                            <button
                              onClick={() => handleCopyLink(landing.slug)}
                              title="Salin tautan publik"
                              className="text-slate-400 hover:text-slate-700 text-xs"
                            >
                              {copiedSlug === landing.slug ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                            {landing.status === "ACTIVE" && (
                              <a
                                href={`/promo/${landing.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Lihat halaman publik"
                                className="text-slate-400 hover:text-indigo-600"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-700">
                        {landing.sections?.length || 0} Blok
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      {getStatusBadge(landing.status)}
                    </td>

                    <td className="px-4 py-4 text-xs text-slate-500">
                      {landing.startAt ? (
                        <div>
                          <p>{new Date(landing.startAt).toLocaleDateString("id-ID")}</p>
                          {landing.endAt ? (
                            <p className="text-[11px] text-slate-400">s/d {new Date(landing.endAt).toLocaleDateString("id-ID")}</p>
                          ) : (
                            <p className="text-[11px] text-slate-400">Tidak terbatas</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">Langsung Tayang</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenPreview(landing)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition"
                          title="Pratinjau Draft"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleTogglePublish(landing)}
                          className={`p-1.5 rounded-lg transition ${
                            landing.published
                              ? "text-emerald-600 hover:bg-emerald-50"
                              : "text-slate-400 hover:bg-slate-100"
                          }`}
                          title={landing.published ? "Tarik Publikasi (Jadikan Draft)" : "Publikasikan Sekarang"}
                        >
                          <Globe className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(landing)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {!landing.isArchived && (
                          <button
                            onClick={() => handleArchive(landing.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition"
                            title="Arsipkan"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(landing.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                          title="Hapus Aman"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Menampilkan {landings.length} dari {totalItems} halaman
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>Halaman {page} dari {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-xl border border-slate-200 overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingLanding ? "Edit Landing Page" : "Buat Landing Page Baru"}
                </h3>
                <p className="text-xs text-slate-500">
                  Susun konten promosi terstruktur dengan blok terverifikasi
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-100 bg-slate-50/50 px-6">
              <button
                type="button"
                onClick={() => setActiveTab("info")}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition ${
                  activeTab === "info"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                1. Informasi & Header
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("blocks")}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === "blocks"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                2. Blok Konten ({sections.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("schedule")}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition ${
                  activeTab === "schedule"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                3. Jadwal, Publikasi & SEO
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="p-6 max-h-[68vh] overflow-y-auto space-y-6">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {formError}
                  </div>
                )}

                {/* TAB 1: INFO & HEADER */}
                {activeTab === "info" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Nama Internal (Admin) *
                        </label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Promo MLBB Diamond Rush Sept"
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Judul Publik (Customer) *
                        </label>
                        <input
                          type="text"
                          required
                          value={title}
                          onChange={(e) => handleTitleChange(e.target.value)}
                          placeholder="e.g. Diamond Rush Spesial Musim Ini"
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        URL Slug *
                      </label>
                      <div className="flex items-center">
                        <span className="bg-slate-100 border border-r-0 border-slate-200 px-3 py-2 text-xs text-slate-500 rounded-l-xl font-mono">
                          /promo/
                        </span>
                        <input
                          type="text"
                          required
                          value={slug}
                          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                          placeholder="diamond-rush-sept"
                          className="w-full px-3 py-2 text-sm rounded-r-xl border border-slate-200 font-mono text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Hanya huruf kecil, angka, dan tanda hubung (-).
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Deskripsi Singkat *
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Deskripsi singkat tentang promosi ini untuk preview sosial dan pelanggan..."
                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Cover Media Picker */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Gambar Sampul (Media Library)
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="w-24 h-16 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0 flex items-center justify-center">
                          {mediaUrl ? (
                            <img src={mediaUrl} alt="Cover" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-slate-400" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() => handleOpenMediaPicker({ type: "cover" })}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                          >
                            Pilih dari Media Library
                          </button>
                          {mediaUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setMediaId("");
                                setMediaUrl("");
                              }}
                              className="block text-[11px] text-red-500 hover:underline"
                            >
                              Hapus Gambar Sampul
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Global CTA */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Teks Tombol CTA Utama (Opsional)
                        </label>
                        <input
                          type="text"
                          value={ctaText}
                          onChange={(e) => setCtaText(e.target.value)}
                          placeholder="e.g. Belanja Sekarang"
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Target URL CTA Utama (Opsional)
                        </label>
                        <input
                          type="text"
                          value={ctaUrl}
                          onChange={(e) => setCtaUrl(e.target.value)}
                          placeholder="e.g. /games/mobile-legends atau #katalog"
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: BLOK KONTEN */}
                {activeTab === "blocks" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500">
                        Susun konten dengan menambahkan blok terstruktur. Tidak ada kode executable yang diizinkan.
                      </p>
                      <div className="relative group">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition"
                        >
                          <Plus className="w-3.5 h-3.5" /> Tambah Blok
                        </button>
                        <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-2xl shadow-lg p-2 hidden group-hover:block group-focus-within:block z-30 space-y-1">
                          <button
                            type="button"
                            onClick={() => addBlock("HERO")}
                            className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                          >
                            <Sparkles className="w-4 h-4 text-indigo-500" /> Hero Banner
                          </button>
                          <button
                            type="button"
                            onClick={() => addBlock("TEXT")}
                            className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                          >
                            <FileText className="w-4 h-4 text-blue-500" /> Paragraf Teks
                          </button>
                          <button
                            type="button"
                            onClick={() => addBlock("IMAGE")}
                            className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                          >
                            <ImageIcon className="w-4 h-4 text-emerald-500" /> Banner / Gambar
                          </button>
                          <button
                            type="button"
                            onClick={() => addBlock("CTA")}
                            className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4 text-purple-500" /> Call-To-Action Box
                          </button>
                          <button
                            type="button"
                            onClick={() => addBlock("PRODUCT_HIGHLIGHT")}
                            className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                          >
                            <Gamepad2 className="w-4 h-4 text-amber-500" /> Sorot Game
                          </button>
                          <button
                            type="button"
                            onClick={() => addBlock("PROMO_HIGHLIGHT")}
                            className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                          >
                            <Tag className="w-4 h-4 text-rose-500" /> Voucher & Promo
                          </button>
                        </div>
                      </div>
                    </div>

                    {sections.length === 0 ? (
                      <div className="py-12 border-2 border-dashed border-slate-200 rounded-2xl text-center">
                        <Layout className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-500">Belum ada blok konten. Tambahkan blok pertama di atas.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {sections.map((block, idx) => (
                          <div
                            key={block.id}
                            className="border border-slate-200 rounded-2xl bg-white p-4 shadow-sm space-y-3"
                          >
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                                  Blok: {block.type}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => moveBlock(idx, "up")}
                                  className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                >
                                  <ArrowUp className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === sections.length - 1}
                                  onClick={() => moveBlock(idx, "down")}
                                  className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                >
                                  <ArrowDown className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeBlock(idx)}
                                  className="p-1 rounded text-red-400 hover:text-red-600"
                                >
                                  <Trash className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Block Specific Form Fields */}
                            {block.type === "HERO" && (
                              <div className="space-y-3 text-xs">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="font-semibold text-slate-600 mb-1 block">Judul Hero</label>
                                    <input
                                      type="text"
                                      value={block.data?.title || ""}
                                      onChange={(e) => updateBlockData(idx, { title: e.target.value })}
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                                    />
                                  </div>
                                  <div>
                                    <label className="font-semibold text-slate-600 mb-1 block">Badge Teks</label>
                                    <input
                                      type="text"
                                      value={block.data?.badge || ""}
                                      onChange={(e) => updateBlockData(idx, { badge: e.target.value })}
                                      placeholder="e.g. Promo Spesial"
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="font-semibold text-slate-600 mb-1 block">Subtitle</label>
                                  <input
                                    type="text"
                                    value={block.data?.subtitle || ""}
                                    onChange={(e) => updateBlockData(idx, { subtitle: e.target.value })}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="font-semibold text-slate-600 mb-1 block">Teks Tombol</label>
                                    <input
                                      type="text"
                                      value={block.data?.ctaText || ""}
                                      onChange={(e) => updateBlockData(idx, { ctaText: e.target.value })}
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                                    />
                                  </div>
                                  <div>
                                    <label className="font-semibold text-slate-600 mb-1 block">Target URL</label>
                                    <input
                                      type="text"
                                      value={block.data?.ctaUrl || ""}
                                      onChange={(e) => updateBlockData(idx, { ctaUrl: e.target.value })}
                                      placeholder="/#katalog"
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenMediaPicker({ type: "block", blockIndex: idx })}
                                    className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                                  >
                                    {block.data?.mediaUrl ? "Ubah Background Hero" : "Pilih Background dari Media Library"}
                                  </button>
                                  {block.data?.mediaUrl && (
                                    <span className="text-[11px] text-emerald-600 truncate max-w-xs">Asset terhubung</span>
                                  )}
                                </div>
                              </div>
                            )}

                            {block.type === "TEXT" && (
                              <div className="space-y-3 text-xs">
                                <div>
                                  <label className="font-semibold text-slate-600 mb-1 block">Heading (Opsional)</label>
                                  <input
                                    type="text"
                                    value={block.data?.heading || ""}
                                    onChange={(e) => updateBlockData(idx, { heading: e.target.value })}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                                  />
                                </div>
                                <div>
                                  <label className="font-semibold text-slate-600 mb-1 block">Konten Paragraf</label>
                                  <textarea
                                    rows={4}
                                    value={block.data?.content || ""}
                                    onChange={(e) => updateBlockData(idx, { content: e.target.value })}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                                    placeholder="Tuliskan teks atau informasi pendukung di sini..."
                                  />
                                </div>
                              </div>
                            )}

                            {block.type === "IMAGE" && (
                              <div className="space-y-3 text-xs">
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenMediaPicker({ type: "block", blockIndex: idx })}
                                    className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-bold"
                                  >
                                    Pilih Gambar dari Media Library
                                  </button>
                                  {block.data?.mediaUrl && (
                                    <img
                                      src={block.data.mediaUrl}
                                      alt="Preview"
                                      className="w-16 h-10 object-cover rounded-lg border border-slate-200"
                                    />
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="font-semibold text-slate-600 mb-1 block">Caption (Opsional)</label>
                                    <input
                                      type="text"
                                      value={block.data?.caption || ""}
                                      onChange={(e) => updateBlockData(idx, { caption: e.target.value })}
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                                    />
                                  </div>
                                  <div>
                                    <label className="font-semibold text-slate-600 mb-1 block">Alt Text</label>
                                    <input
                                      type="text"
                                      value={block.data?.altText || ""}
                                      onChange={(e) => updateBlockData(idx, { altText: e.target.value })}
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {block.type === "CTA" && (
                              <div className="space-y-3 text-xs">
                                <div>
                                  <label className="font-semibold text-slate-600 mb-1 block">Judul Kotak CTA</label>
                                  <input
                                    type="text"
                                    value={block.data?.title || ""}
                                    onChange={(e) => updateBlockData(idx, { title: e.target.value })}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                                  />
                                </div>
                                <div>
                                  <label className="font-semibold text-slate-600 mb-1 block">Deskripsi Pendukung</label>
                                  <input
                                    type="text"
                                    value={block.data?.description || ""}
                                    onChange={(e) => updateBlockData(idx, { description: e.target.value })}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="font-semibold text-slate-600 mb-1 block">Teks Tombol</label>
                                    <input
                                      type="text"
                                      value={block.data?.buttonText || ""}
                                      onChange={(e) => updateBlockData(idx, { buttonText: e.target.value })}
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                                    />
                                  </div>
                                  <div>
                                    <label className="font-semibold text-slate-600 mb-1 block">Target URL</label>
                                    <input
                                      type="text"
                                      value={block.data?.targetUrl || ""}
                                      onChange={(e) => updateBlockData(idx, { targetUrl: e.target.value })}
                                      placeholder="/#katalog"
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {block.type === "PRODUCT_HIGHLIGHT" && (
                              <div className="space-y-3 text-xs">
                                <div>
                                  <label className="font-semibold text-slate-600 mb-1 block">Pilih Game dari Katalog</label>
                                  <select
                                    value={block.data?.gameId || ""}
                                    onChange={(e) => updateBlockData(idx, { gameId: e.target.value })}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                                  >
                                    <option value="">-- Pilih Game --</option>
                                    {componentsData.games.map((g) => (
                                      <option key={g.id} value={g.id}>
                                        {g.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="font-semibold text-slate-600 mb-1 block">Judul Khusus</label>
                                    <input
                                      type="text"
                                      value={block.data?.customTitle || ""}
                                      onChange={(e) => updateBlockData(idx, { customTitle: e.target.value })}
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                                    />
                                  </div>
                                  <div>
                                    <label className="font-semibold text-slate-600 mb-1 block">Deskripsi Khusus</label>
                                    <input
                                      type="text"
                                      value={block.data?.customDescription || ""}
                                      onChange={(e) => updateBlockData(idx, { customDescription: e.target.value })}
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {block.type === "PROMO_HIGHLIGHT" && (
                              <div className="space-y-3 text-xs">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="font-semibold text-slate-600 mb-1 block">Pilih Promo Voucher</label>
                                    <select
                                      value={block.data?.promoId || ""}
                                      onChange={(e) => updateBlockData(idx, { promoId: e.target.value })}
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                                    >
                                      <option value="">-- Tidak ada --</option>
                                      {componentsData.promos.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.name} ({p.code})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="font-semibold text-slate-600 mb-1 block">Pilih Flash Sale</label>
                                    <select
                                      value={block.data?.flashSaleId || ""}
                                      onChange={(e) => updateBlockData(idx, { flashSaleId: e.target.value })}
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                                    >
                                      <option value="">-- Tidak ada --</option>
                                      {componentsData.flashSales.map((fs) => (
                                        <option key={fs.id} value={fs.id}>
                                          {fs.name} - Rp {fs.salePrice?.toLocaleString("id-ID")}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="font-semibold text-slate-600 mb-1 block">Judul Khusus</label>
                                    <input
                                      type="text"
                                      value={block.data?.customTitle || ""}
                                      onChange={(e) => updateBlockData(idx, { customTitle: e.target.value })}
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                                    />
                                  </div>
                                  <div>
                                    <label className="font-semibold text-slate-600 mb-1 block">Deskripsi Khusus</label>
                                    <input
                                      type="text"
                                      value={block.data?.customDescription || ""}
                                      onChange={(e) => updateBlockData(idx, { customDescription: e.target.value })}
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: JADWAL & PUBLIKASI */}
                {activeTab === "schedule" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Waktu Mulai Tayang
                        </label>
                        <input
                          type="datetime-local"
                          value={startAt}
                          onChange={(e) => setStartAt(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">Kosongkan jika ingin segera aktif.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Waktu Berakhir Tayang
                        </label>
                        <input
                          type="datetime-local"
                          value={endAt}
                          onChange={(e) => setEndAt(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">Kosongkan jika tayang tanpa batas waktu.</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-6">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => setEnabled(e.target.checked)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <span className="text-sm font-bold text-slate-800">Status Aktif (Enabled)</span>
                          <p className="text-xs text-slate-400">Nonaktifkan untuk menangguhkan halaman sementara.</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={published}
                          onChange={(e) => setPublished(e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <span className="text-sm font-bold text-slate-800">Publikasikan (Published)</span>
                          <p className="text-xs text-slate-400">Jika tidak dicentang, berstatus DRAFT (hanya preview admin).</p>
                        </div>
                      </label>
                    </div>

                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        SEO Metadata Reference
                      </h4>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">SEO Title Override</label>
                        <input
                          type="text"
                          value={seoTitle}
                          onChange={(e) => setSeoTitle(e.target.value)}
                          placeholder="Jika kosong, menggunakan judul publik"
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">SEO Description Override</label>
                        <textarea
                          rows={2}
                          value={seoDescription}
                          onChange={(e) => setSeoDescription(e.target.value)}
                          placeholder="Jika kosong, menggunakan deskripsi singkat"
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Hubungkan ke Campaign</label>
                      <select
                        value={campaignId}
                        onChange={(e) => setCampaignId(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200"
                      >
                        <option value="">-- Tidak ada Campaign terkait --</option>
                        {componentsData.campaigns.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Batal
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 transition"
                  >
                    {saving ? "Menyimpan..." : editingLanding ? "Simpan Perubahan" : "Simpan & Buat"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MEDIA LIBRARY PICKER MODAL */}
      {isMediaPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Pilih dari Media Library</h4>
                <p className="text-xs text-slate-400">Semua gambar merujuk ke pustaka media resmi</p>
              </div>
              <button
                onClick={() => setIsMediaPickerOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-100">
              <input
                type="text"
                placeholder="Cari file media..."
                value={mediaSearch}
                onChange={(e) => setMediaSearch(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200"
              />
            </div>

            <div className="p-4 overflow-y-auto flex-1 grid grid-cols-3 sm:grid-cols-4 gap-3">
              {mediaList
                .filter((m) => m.originalName.toLowerCase().includes(mediaSearch.toLowerCase()))
                .map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectMedia(item)}
                    className="group border border-slate-200 rounded-xl p-1.5 cursor-pointer hover:border-indigo-500 hover:shadow-md transition text-center"
                  >
                    <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden mb-1">
                      <img
                        src={item.url}
                        alt={item.originalName}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                    </div>
                    <p className="text-[11px] font-medium text-slate-700 truncate">{item.originalName}</p>
                  </div>
                ))}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 text-right">
              <button
                onClick={() => setIsMediaPickerOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIVE PREVIEW MODAL */}
      {previewModalOpen && previewLanding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Pratinjau Draft:</span>
                <span className="text-sm font-semibold truncate max-w-xs">{previewLanding.name}</span>
                {getStatusBadge(previewLanding.status)}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-slate-800 rounded-lg p-0.5 text-xs">
                  <button
                    onClick={() => setPreviewDevice("desktop")}
                    className={`px-2 py-1 rounded-md flex items-center gap-1 ${
                      previewDevice === "desktop" ? "bg-indigo-600 text-white font-bold" : "text-slate-400"
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" /> Desktop
                  </button>
                  <button
                    onClick={() => setPreviewDevice("mobile")}
                    className={`px-2 py-1 rounded-md flex items-center gap-1 ${
                      previewDevice === "mobile" ? "bg-indigo-600 text-white font-bold" : "text-slate-400"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" /> Mobile
                  </button>
                </div>

                <Link
                  to={`/admin/landings/${previewLanding.id}/preview`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1 transition"
                >
                  Buka Tab Khusus <ExternalLink className="w-3.5 h-3.5" />
                </Link>

                <button
                  onClick={() => setPreviewModalOpen(false)}
                  className="text-slate-400 hover:text-white ml-2"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Frame */}
            <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6 flex justify-center">
              <div
                className={`bg-slate-50 min-h-full rounded-2xl shadow-sm overflow-hidden transition-all duration-300 ${
                  previewDevice === "mobile" ? "w-[380px] border-8 border-slate-800 rounded-[32px]" : "w-full max-w-4xl"
                }`}
              >
                {/* Simulated Content Rendering */}
                <div className="p-4 sm:p-6 space-y-6">
                  {previewLanding.sections?.map((block: LandingBlock, idx: number) => {
                    switch (block.type) {
                      case "HERO":
                        return (
                          <div
                            key={idx}
                            className={`rounded-2xl bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 ${
                              block.data?.alignment === "center" ? "text-center" : "text-left"
                            }`}
                          >
                            {block.data?.badge && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200 mb-2 inline-block">
                                {block.data.badge}
                              </span>
                            )}
                            <h2 className="text-xl font-bold mb-2">{block.data?.title || previewLanding.title}</h2>
                            <p className="text-xs text-slate-300 mb-4">{block.data?.subtitle}</p>
                            {block.data?.ctaText && (
                              <button className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-xs font-bold">
                                {block.data.ctaText}
                              </button>
                            )}
                          </div>
                        );
                      case "TEXT":
                        return (
                          <div key={idx} className="bg-white rounded-2xl p-4 border border-slate-200">
                            {block.data?.heading && <h4 className="font-bold text-sm mb-2">{block.data.heading}</h4>}
                            <p className="text-xs text-slate-600 whitespace-pre-line">{block.data?.content}</p>
                          </div>
                        );
                      case "IMAGE":
                        return (
                          <div key={idx} className="bg-white rounded-2xl p-2 border border-slate-200">
                            <img
                              src={block.data?.mediaUrl || "https://placehold.co/600x300"}
                              alt="preview"
                              className="w-full rounded-xl object-cover"
                            />
                            {block.data?.caption && <p className="text-[10px] text-center text-slate-400 mt-1">{block.data.caption}</p>}
                          </div>
                        );
                      case "PRODUCT_HIGHLIGHT":
                        return (
                          <div key={idx} className="bg-white rounded-2xl p-4 border border-slate-200">
                            <h4 className="font-bold text-xs mb-2 text-slate-900">{block.data?.customTitle || "Game Sorotan"}</h4>
                            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl">
                              <Gamepad2 className="w-8 h-8 text-indigo-600" />
                              <div className="flex-1">
                                <p className="font-bold text-xs text-slate-900">
                                  {block.data?.resolvedGame?.name || "Game Terhubung"}
                                </p>
                                <p className="text-[10px] text-slate-500">{block.data?.customDescription}</p>
                              </div>
                              <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg">
                                Top Up
                              </span>
                            </div>
                          </div>
                        );
                      case "PROMO_HIGHLIGHT":
                        return (
                          <div key={idx} className="bg-white rounded-2xl p-4 border border-slate-200">
                            <h4 className="font-bold text-xs mb-2 text-slate-900">{block.data?.customTitle || "Promo Terhubung"}</h4>
                            <div className="bg-amber-50 border border-dashed border-amber-300 p-3 rounded-xl flex items-center justify-between">
                              <div>
                                <p className="font-bold text-xs text-amber-900">
                                  {block.data?.resolvedPromo?.name || "Voucher Promo Aktif"}
                                </p>
                                <p className="text-[10px] font-mono text-slate-700">
                                  Kode: {block.data?.resolvedPromo?.code || "PROMO123"}
                                </p>
                              </div>
                              <span className="px-2 py-1 bg-amber-600 text-white text-[10px] font-bold rounded">
                                Gunakan
                              </span>
                            </div>
                          </div>
                        );
                      case "CTA":
                        return (
                          <div key={idx} className="bg-slate-900 text-white p-6 rounded-2xl text-center">
                            <h4 className="font-bold text-sm mb-1">{block.data?.title}</h4>
                            <p className="text-xs text-slate-300 mb-3">{block.data?.description}</p>
                            <button className="px-4 py-2 bg-white text-slate-900 rounded-xl text-xs font-bold">
                              {block.data?.buttonText || "Ambil Promo"}
                            </button>
                          </div>
                        );
                      default:
                        return null;
                    }
                  })}
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-900 text-slate-400 text-xs flex justify-between items-center border-t border-slate-800 px-6">
              <span>Status: <strong className="text-white">{previewLanding.status}</strong></span>
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 text-white font-semibold hover:bg-slate-700"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
