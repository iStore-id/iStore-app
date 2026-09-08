import React, { useEffect, useState } from "react";
import { useAuthStore } from "../../store/auth-store";
import {
  HelpCircle,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  Archive,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Bold,
  Italic,
  List,
  Link as LinkIcon,
  Tag,
  Gamepad2,
  Copy,
  Check
} from "lucide-react";
import { FAQAdminItem, FAQStatus } from "../../types/faq";
import FaqAccordion from "../../components/FaqAccordion";

const PREDEFINED_CATEGORIES = [
  "Transaksi & Pengiriman",
  "Pembayaran",
  "Akun & Keamanan",
  "Promo & Voucher",
  "Kemitraan & Reseller",
  "Umum"
];

export default function AdminFaqPage() {
  const { user } = useAuthStore();

  // State List & Filtering
  const [faqs, setFaqs] = useState<FAQAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // Components reference data (Games, Promos)
  const [componentsData, setComponentsData] = useState<{
    games: Array<{ id: string; name: string; slug: string; image: string }>;
    promos: Array<{ id: string; name: string; code: string; discountType: string; discountValue: number }>;
  }>({ games: [], promos: [] });

  // Modal Create / Edit State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQAdminItem | null>(null);
  const [modalTab, setModalTab] = useState<"edit" | "preview">("edit");

  // Form Fields
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("Transaksi & Pengiriman");
  const [customCategory, setCustomCategory] = useState("");
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [published, setPublished] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [relatedGameId, setRelatedGameId] = useState("");
  const [relatedPromoId, setRelatedPromoId] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal Delete State
  const [deletingFaq, setDeletingFaq] = useState<FAQAdminItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Reorder saving indicator
  const [isReordering, setIsReordering] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch FAQs list
  const fetchFaqs = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await user?.getIdToken();
      if (!token) return;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: "12",
        status: statusFilter,
        includeArchived: "true"
      });
      if (search.trim()) params.append("search", search.trim());
      if (categoryFilter !== "ALL") params.append("category", categoryFilter);

      const res = await fetch(`/api/admin/faq?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.success) {
        setFaqs(data.data || []);
        setTotalPages(data.totalPages || 1);
        setTotalItems(data.total || 0);
        if (data.categories && data.categories.length > 0) {
          setAvailableCategories(data.categories);
        }
      } else {
        setError(data.message || "Gagal memuat FAQ.");
      }
    } catch (err: any) {
      console.error("[Admin FAQ Fetch Error]:", err);
      setError("Terjadi kesalahan jaringan saat memuat FAQ.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch Reference Components Data (Games, Promos)
  const fetchComponentsData = async () => {
    try {
      const token = await user?.getIdToken();
      if (!token) return;
      const res = await fetch("/api/admin/faq/components-data", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success && json.data) {
        setComponentsData(json.data);
      }
    } catch (err) {
      console.warn("Notice: Components data fetch error:", err);
    }
  };

  useEffect(() => {
    fetchFaqs();
  }, [page, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchComponentsData();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchFaqs();
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingFaq(null);
    setQuestion("");
    setAnswer("");
    setCategory("Transaksi & Pengiriman");
    setCustomCategory("");
    // Default sortOrder to next integer
    const maxSort = faqs.reduce((acc, curr) => Math.max(acc, curr.sortOrder || 0), 0);
    setSortOrder(maxSort + 1);
    setPublished(true);
    setEnabled(true);
    setRelatedGameId("");
    setRelatedPromoId("");
    setFormError(null);
    setModalTab("edit");
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (item: FAQAdminItem) => {
    setEditingFaq(item);
    setQuestion(item.question);
    setAnswer(item.answer);
    if (PREDEFINED_CATEGORIES.includes(item.category)) {
      setCategory(item.category);
      setCustomCategory("");
    } else {
      setCategory("OTHER");
      setCustomCategory(item.category);
    }
    setSortOrder(item.sortOrder || 0);
    setPublished(item.published);
    setEnabled(item.enabled);
    setRelatedGameId(item.relatedGameId || "");
    setRelatedPromoId(item.relatedPromoId || "");
    setFormError(null);
    setModalTab("edit");
    setIsModalOpen(true);
  };

  // Insert markdown snippet into answer
  const insertFormatting = (prefix: string, suffix: string = "") => {
    const textarea = document.getElementById("faq-answer-textarea") as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;
    const selectedText = currentVal.substring(start, end) || "teks";
    const replacement = `${prefix}${selectedText}${suffix}`;

    const newVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);
    setAnswer(newVal);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 50);
  };

  // Submit Create or Update
  const handleSubmitFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      setFormError("Pertanyaan FAQ wajib diisi.");
      return;
    }
    if (!answer.trim()) {
      setFormError("Jawaban FAQ wajib diisi.");
      return;
    }

    const resolvedCategory =
      category === "OTHER" ? customCategory.trim() || "Umum" : category;

    try {
      setFormSubmitting(true);
      setFormError(null);
      const token = await user?.getIdToken();
      if (!token) throw new Error("Sesi login berakhir. Silakan login kembali.");

      const payload = {
        question: question.trim(),
        answer: answer.trim(),
        category: resolvedCategory,
        sortOrder: Number(sortOrder) || 0,
        published,
        enabled,
        relatedGameId: relatedGameId || undefined,
        relatedPromoId: relatedPromoId || undefined
      };

      const url = editingFaq ? `/api/admin/faq/${editingFaq.id}` : "/api/admin/faq";
      const method = editingFaq ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchFaqs();
      } else {
        setFormError(data.message || "Gagal menyimpan FAQ.");
      }
    } catch (err: any) {
      console.error("[Submit FAQ Error]:", err);
      setFormError(err.message || "Terjadi kesalahan sistem.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Quick Action: Publish / Unpublish Toggle
  const handleTogglePublish = async (item: FAQAdminItem) => {
    try {
      const token = await user?.getIdToken();
      if (!token) return;
      const targetState = !item.published;

      const res = await fetch(`/api/admin/faq/${item.id}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ published: targetState })
      });
      const data = await res.json();
      if (data.success) {
        fetchFaqs();
      } else {
        alert(data.message || "Gagal mengubah status publikasi.");
      }
    } catch (err) {
      console.error("[Publish Error]:", err);
    }
  };

  // Quick Action: Enable / Disable Toggle
  const handleToggleEnable = async (item: FAQAdminItem) => {
    try {
      const token = await user?.getIdToken();
      if (!token) return;
      const targetState = !item.enabled;

      const res = await fetch(`/api/admin/faq/${item.id}/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: targetState })
      });
      const data = await res.json();
      if (data.success) {
        fetchFaqs();
      } else {
        alert(data.message || "Gagal mengubah status aktif.");
      }
    } catch (err) {
      console.error("[Toggle Enable Error]:", err);
    }
  };

  // Quick Action: Archive FAQ
  const handleArchiveFaq = async (item: FAQAdminItem) => {
    if (!confirm(`Arsipkan FAQ "${item.question}"? FAQ ini tidak akan tampil ke publik.`)) {
      return;
    }

    try {
      const token = await user?.getIdToken();
      if (!token) return;

      const res = await fetch(`/api/admin/faq/${item.id}/archive`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        fetchFaqs();
      } else {
        alert(data.message || "Gagal mengarsipkan FAQ.");
      }
    } catch (err) {
      console.error("[Archive Error]:", err);
    }
  };

  // Quick Action: Reorder (Move Up / Down)
  const handleMoveOrder = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= faqs.length) return;

    const currentItem = faqs[index];
    const targetItem = faqs[targetIndex];

    const updatedFaqs = [...faqs];
    // Swap sortOrder
    const tempOrder = currentItem.sortOrder;
    currentItem.sortOrder = targetItem.sortOrder;
    targetItem.sortOrder = tempOrder;

    // In case they had identical sortOrders
    if (currentItem.sortOrder === targetItem.sortOrder) {
      if (direction === "up") {
        currentItem.sortOrder = Math.max(0, targetItem.sortOrder - 1);
      } else {
        currentItem.sortOrder = targetItem.sortOrder + 1;
      }
    }

    updatedFaqs[index] = targetItem;
    updatedFaqs[targetIndex] = currentItem;
    setFaqs(updatedFaqs);

    try {
      setIsReordering(true);
      const token = await user?.getIdToken();
      if (!token) return;

      await fetch("/api/admin/faq/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          items: [
            { id: currentItem.id, sortOrder: currentItem.sortOrder },
            { id: targetItem.id, sortOrder: targetItem.sortOrder }
          ]
        })
      });
      fetchFaqs();
    } catch (err) {
      console.error("[Reorder Error]:", err);
    } finally {
      setIsReordering(false);
    }
  };

  // Delete Action
  const handleDeleteFaq = async () => {
    if (!deletingFaq) return;
    try {
      setDeleteSubmitting(true);
      const token = await user?.getIdToken();
      if (!token) return;

      const res = await fetch(`/api/admin/faq/${deletingFaq.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setDeletingFaq(null);
        fetchFaqs();
      } else {
        alert(data.message || "Gagal menghapus FAQ.");
      }
    } catch (err) {
      console.error("[Delete Error]:", err);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper for status badge
  const renderStatusBadge = (status: FAQStatus) => {
    switch (status) {
      case "PUBLISHED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Terbit</span>
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Draft</span>
          </span>
        );
      case "INACTIVE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <XCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>Nonaktif</span>
          </span>
        );
      case "ARCHIVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <Archive className="w-3.5 h-3.5 text-red-600" />
            <span>Arsip</span>
          </span>
        );
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Manajemen FAQ</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
              {totalItems} Pertanyaan
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Kelola daftar pertanyaan yang sering diajukan pelanggan, urutan, status terbit, dan referensi promo.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Pertanyaan Baru</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            {[
              { label: "Semua", value: "ALL" },
              { label: "Terbit", value: "PUBLISHED" },
              { label: "Draft", value: "DRAFT" },
              { label: "Nonaktif", value: "INACTIVE" },
              { label: "Arsip", value: "ARCHIVED" }
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.value);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  statusFilter === tab.value
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input & Category Filter */}
          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">Semua Kategori</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari FAQ..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </form>
          </div>

        </div>
      </div>

      {/* FAQs List Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-500">Memuat daftar FAQ...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
            <p className="text-sm font-semibold text-red-700">{error}</p>
            <button
              type="button"
              onClick={fetchFaqs}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
            >
              Muat Ulang
            </button>
          </div>
        ) : faqs.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">Tidak ada pertanyaan ditemukan.</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Belum ada FAQ dengan kriteria filter saat ini, atau klik tombol Tambah untuk membuat FAQ baru.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-16 text-center">Urutan</th>
                  <th className="py-3.5 px-4 min-w-[280px]">Pertanyaan & Jawaban</th>
                  <th className="py-3.5 px-4 min-w-[150px]">Kategori</th>
                  <th className="py-3.5 px-4 w-28 text-center">Status</th>
                  <th className="py-3.5 px-4 w-28 text-center">Aktif</th>
                  <th className="py-3.5 px-4 w-36 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {faqs.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    {/* Sort Order Control */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          #{item.sortOrder}
                        </span>
                        <div className="flex items-center gap-0.5 mt-0.5">
                          <button
                            type="button"
                            disabled={index === 0 || isReordering}
                            onClick={() => handleMoveOrder(index, "up")}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-30 transition"
                            title="Naikkan Urutan"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === faqs.length - 1 || isReordering}
                            onClick={() => handleMoveOrder(index, "down")}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-30 transition"
                            title="Turunkan Urutan"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Question & Answer Excerpt */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900 leading-snug line-clamp-2">
                          {item.question}
                        </p>
                        <p className="text-xs text-slate-500 line-clamp-1">
                          {item.answer.replace(/\*\*/g, "").replace(/- /g, "• ")}
                        </p>
                        {/* Reference tags if any */}
                        {(item.relatedGameId || item.relatedPromoId) && (
                          <div className="flex items-center gap-2 pt-1">
                            {item.relatedGameId && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                <Gamepad2 className="w-3 h-3" />
                                <span>Ref Game</span>
                              </span>
                            )}
                            {item.relatedPromoId && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                <Tag className="w-3 h-3" />
                                <span>Ref Promo</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700">
                        {item.category || "Umum"}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 text-center">
                      {renderStatusBadge(item.status)}
                    </td>

                    {/* Enabled Toggle Switch */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleEnable(item)}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          item.enabled ? "bg-indigo-600" : "bg-slate-200"
                        }`}
                        title={item.enabled ? "Klik untuk nonaktifkan" : "Klik untuk aktifkan"}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            item.enabled ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Quick Publish / Unpublish */}
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(item)}
                          className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                            item.published
                              ? "text-amber-600 hover:bg-amber-50"
                              : "text-emerald-600 hover:bg-emerald-50"
                          }`}
                          title={item.published ? "Tarik ke Draft" : "Publikasikan"}
                        >
                          {item.published ? <Clock className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Edit Pertanyaan"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Archive Button */}
                        {!item.archived && (
                          <button
                            type="button"
                            onClick={() => handleArchiveFaq(item)}
                            className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                            title="Arsipkan"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => setDeletingFaq(item)}
                          className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Hapus Permanen"
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

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Halaman {page} dari {totalPages} ({totalItems} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />
                Sebelumnya
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                Selanjutnya
                <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL CREATE / EDIT FAQ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingFaq ? "Edit Pertanyaan FAQ" : "Tambah Pertanyaan FAQ Baru"}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lengkapi pertanyaan dan jawaban dengan formatting yang jelas dan aman.
                </p>
              </div>

              {/* Edit / Preview Tabs */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setModalTab("edit")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                    modalTab === "edit"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Editor
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab("preview")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    modalTab === "preview"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Pratinjau</span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{formError}</span>
                </div>
              )}

              {modalTab === "edit" ? (
                <form id="faq-form" onSubmit={handleSubmitFaq} className="space-y-4">
                  {/* Question */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Pertanyaan (Question) *
                    </label>
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Contoh: Berapa lama diamond masuk setelah pembayaran?"
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    />
                  </div>

                  {/* Category & Sort Order */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Kategori Topik
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      >
                        {PREDEFINED_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                        <option value="OTHER">+ Tambah Kategori Baru</option>
                      </select>
                      {category === "OTHER" && (
                        <input
                          type="text"
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                          placeholder="Nama kategori baru..."
                          className="mt-2 w-full px-4 py-2 bg-white border border-indigo-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Urutan Tampil (Sort Order)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={sortOrder}
                        onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Angka lebih kecil tampil lebih awal.</p>
                    </div>
                  </div>

                  {/* Answer with Safe Markdown Helper Toolbar */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Jawaban (Answer) *
                      </label>
                      {/* Markdown Toolbar */}
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() => insertFormatting("**", "**")}
                          className="p-1 hover:bg-white rounded text-slate-600"
                          title="Tebal (Bold)"
                        >
                          <Bold className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting("*", "*")}
                          className="p-1 hover:bg-white rounded text-slate-600"
                          title="Miring (Italic)"
                        >
                          <Italic className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting("\n- ")}
                          className="p-1 hover:bg-white rounded text-slate-600"
                          title="Daftar Poin (List)"
                        >
                          <List className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting("[Teks Link](", ")")}
                          className="p-1 hover:bg-white rounded text-slate-600"
                          title="Tautan Aman (Link)"
                        >
                          <LinkIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <textarea
                      id="faq-answer-textarea"
                      rows={6}
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Tuliskan jawaban yang ringkas dan jelas. Anda dapat menggunakan tanda kurung siku untuk tautan atau - untuk poin."
                      required
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-sans leading-relaxed"
                    />
                  </div>

                  {/* Optional Reference Links (Game / Promo) */}
                  <div className="pt-2 border-t border-slate-100 space-y-3">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Referensi Entitas Terkait (Opsional)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">
                          Hubungkan ke Game:
                        </label>
                        <select
                          value={relatedGameId}
                          onChange={(e) => setRelatedGameId(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">-- Tidak Terhubung ke Game --</option>
                          {componentsData.games.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-500 mb-1">
                          Hubungkan ke Voucher Promo:
                        </label>
                        <select
                          value={relatedPromoId}
                          onChange={(e) => setRelatedPromoId(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">-- Tidak Terhubung ke Promo --</option>
                          {componentsData.promos.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code} - {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Status Checkboxes */}
                  <div className="pt-3 border-t border-slate-100 flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={published}
                        onChange={(e) => setPublished(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-semibold text-slate-700">Langsung Terbitkan (Published)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-semibold text-slate-700">Status Aktif (Enabled)</span>
                    </label>
                  </div>
                </form>
              ) : (
                /* Interactive Live Preview Tab */
                <div className="space-y-4">
                  <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-800 flex items-center justify-between">
                    <span>Pratinjau tampilan accordion yang akan dilihat pelanggan:</span>
                    <span className="px-2 py-0.5 rounded bg-indigo-200/60 font-semibold">Live Mode</span>
                  </div>

                  <FaqAccordion
                    items={[
                      {
                        id: "preview-1",
                        question: question || "Pertanyaan Anda akan muncul di sini...",
                        answer: answer || "Jawaban format aman akan muncul di sini...",
                        category: category === "OTHER" ? customCategory || "Umum" : category,
                        sortOrder,
                        relatedGame: relatedGameId
                          ? componentsData.games.find((g) => g.id === relatedGameId) || null
                          : null,
                        relatedPromo: relatedPromoId
                          ? componentsData.promos.find((p) => p.id === relatedPromoId) || null
                          : null
                      }
                    ]}
                    defaultOpenIndex={0}
                    showCategoryBadge={true}
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Batal
              </button>
              <button
                type="submit"
                form="faq-form"
                disabled={formSubmitting}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition flex items-center gap-2"
              >
                {formSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{editingFaq ? "Simpan Perubahan" : "Simpan FAQ"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DELETE CONFIRMATION */}
      {deletingFaq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-base font-bold text-slate-900">Hapus FAQ Permanen?</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Pertanyaan <span className="font-semibold text-slate-800">"{deletingFaq.question}"</span> akan dihapus dari Firestore. Seluruh entity atau promo yang direferensikan tetap aman dan tidak akan terhapus.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingFaq(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={handleDeleteFaq}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {deleteSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Hapus Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
