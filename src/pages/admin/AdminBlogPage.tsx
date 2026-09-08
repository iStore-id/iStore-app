import React, { useEffect, useState } from "react";
import { useAuthStore } from "../../store/auth-store";
import { Link } from "react-router-dom";
import {
  FileText,
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
  Calendar,
  Image as ImageIcon,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  Smartphone,
  Monitor,
  Tag,
  Gamepad2,
  Flame,
  Layout,
  BookOpen,
  User,
  Share2,
  ChevronLeft,
  ChevronRight,
  Bold,
  Italic,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  Lightbulb,
  Link as LinkIcon
} from "lucide-react";
import { BlogPost, BlogStatus } from "../../types/blog";
import BlogContentRenderer from "../../components/BlogContentRenderer";

interface MediaItem {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

const PREDEFINED_CATEGORIES = [
  "Berita",
  "Tips & Tutorial",
  "Event & Turnamen",
  "Update Game",
  "Promo & Voucher",
  "Review & Komunitas"
];

export default function AdminBlogPage() {
  const { user } = useAuthStore();

  // State List & Filtering
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // Components reference data (Games, Promos, Campaigns, Landings)
  const [componentsData, setComponentsData] = useState<{
    games: Array<{ id: string; name: string; slug: string; image: string }>;
    promos: Array<{ id: string; name: string; code: string; discountType: string; discountValue: number }>;
    campaigns: Array<{ id: string; title: string; slug?: string }>;
    landings: Array<{ id: string; title: string; slug: string }>;
  }>({ games: [], promos: [], campaigns: [], landings: [] });

  // Modal Create / Edit State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogPost | null>(null);
  const [modalTab, setModalTab] = useState<"info" | "content" | "related" | "schedule">("info");
  const [contentViewMode, setContentViewMode] = useState<"edit" | "preview">("edit");

  // Form Fields
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("Berita");
  const [customCategory, setCustomCategory] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [author, setAuthor] = useState("Tim Editorial iStore");
  const [coverMediaId, setCoverMediaId] = useState("");
  const [coverMediaUrl, setCoverMediaUrl] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [relatedGameId, setRelatedGameId] = useState("");
  const [relatedPromoId, setRelatedPromoId] = useState("");
  const [relatedCampaignId, setRelatedCampaignId] = useState("");
  const [relatedLandingId, setRelatedLandingId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [published, setPublished] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Media Picker Modal State
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<"cover" | "inline">("cover");
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [mediaSearch, setMediaSearch] = useState("");

  // Live Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewBlog, setPreviewBlog] = useState<any | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Delete modal state
  const [deleteConfirmBlog, setDeleteConfirmBlog] = useState<BlogPost | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchBlogs();
    fetchComponentsData();
  }, [page, statusFilter, categoryFilter, search]);

  const fetchBlogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await (user as any)?.getIdToken?.();
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        status: statusFilter,
        category: categoryFilter,
        search: search.trim()
      });

      const res = await fetch(`/api/admin/blog?${params.toString()}`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const json = await res.json();
      if (json.success) {
        setBlogs(json.data || []);
        setTotalPages(json.totalPages || 1);
        setTotalItems(json.total || 0);
        if (json.categories) {
          setAvailableCategories(json.categories);
        }
      } else {
        setError(json.message);
      }
    } catch (err: any) {
      setError(err.message || "Gagal mengambil daftar artikel.");
    } finally {
      setLoading(false);
    }
  };

  const fetchComponentsData = async () => {
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/blog/components-data", {
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

  const handleOpenMediaPicker = (target: "cover" | "inline") => {
    setMediaTarget(target);
    fetchMediaLibrary();
    setIsMediaPickerOpen(true);
  };

  const handleSelectMedia = (item: MediaItem) => {
    if (mediaTarget === "cover") {
      setCoverMediaId(item.id);
      setCoverMediaUrl(item.url);
    } else {
      // Insert inline image markdown to content
      const imageMarkdown = `\n![${item.name}](${item.url})\n`;
      setContent((prev) => prev + imageMarkdown);
    }
    setIsMediaPickerOpen(false);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!editingBlog && !slug) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generated);
    }
  };

  const openCreateModal = () => {
    setEditingBlog(null);
    setTitle("");
    setSlug("");
    setExcerpt("");
    setContent("");
    setCategory("Berita");
    setCustomCategory("");
    setTagsInput("");
    setAuthor(user?.displayName || "Tim Editorial iStore");
    setCoverMediaId("");
    setCoverMediaUrl("");
    setSeoTitle("");
    setSeoDescription("");
    setRelatedGameId("");
    setRelatedPromoId("");
    setRelatedCampaignId("");
    setRelatedLandingId("");
    setStartAt("");
    setEndAt("");
    setEnabled(true);
    setPublished(false);
    setFormError(null);
    setModalTab("info");
    setContentViewMode("edit");
    setIsModalOpen(true);
  };

  const openEditModal = (blog: BlogPost) => {
    setEditingBlog(blog);
    setTitle(blog.title || "");
    setSlug(blog.slug || "");
    setExcerpt(blog.excerpt || "");
    setContent(blog.content || "");

    if (PREDEFINED_CATEGORIES.includes(blog.category)) {
      setCategory(blog.category);
      setCustomCategory("");
    } else {
      setCategory("CUSTOM");
      setCustomCategory(blog.category || "");
    }

    setTagsInput(Array.isArray(blog.tags) ? blog.tags.join(", ") : "");
    setAuthor(blog.author || "Tim Editorial iStore");
    setCoverMediaId(blog.coverMediaId || "");
    setCoverMediaUrl(blog.coverMediaUrl || "");
    setSeoTitle(blog.seoTitle || "");
    setSeoDescription(blog.seoDescription || "");
    setRelatedGameId(blog.relatedGameId || "");
    setRelatedPromoId(blog.relatedPromoId || "");
    setRelatedCampaignId(blog.relatedCampaignId || "");
    setRelatedLandingId(blog.relatedLandingId || "");
    setStartAt(blog.startAt ? blog.startAt.slice(0, 16) : "");
    setEndAt(blog.endAt ? blog.endAt.slice(0, 16) : "");
    setEnabled(blog.enabled);
    setPublished(blog.published);
    setFormError(null);
    setModalTab("info");
    setContentViewMode("edit");
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const finalCategory = category === "CUSTOM" ? customCategory.trim() : category;

    if (!title.trim() || !slug.trim() || !excerpt.trim() || !content.trim()) {
      setFormError("Judul, slug, ringkasan (excerpt), dan konten artikel wajib diisi.");
      return;
    }

    if (!finalCategory) {
      setFormError("Kategori artikel wajib diisi.");
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const payload: any = {
      title: title.trim(),
      slug: slug.trim().toLowerCase(),
      excerpt: excerpt.trim(),
      content,
      category: finalCategory,
      tags,
      author: author.trim() || "Tim Editorial iStore",
      coverMediaId: coverMediaId || "",
      coverMediaUrl: coverMediaUrl || "",
      seoTitle: seoTitle.trim() || title.trim(),
      seoDescription: seoDescription.trim() || excerpt.trim(),
      relatedGameId: relatedGameId || "",
      relatedPromoId: relatedPromoId || "",
      relatedCampaignId: relatedCampaignId || "",
      relatedLandingId: relatedLandingId || "",
      startAt: startAt ? new Date(startAt).toISOString() : "",
      endAt: endAt ? new Date(endAt).toISOString() : "",
      enabled,
      published
    };

    try {
      setFormSubmitting(true);
      const token = await (user as any)?.getIdToken?.();
      const url = editingBlog ? `/api/admin/blog/${editingBlog.id}` : "/api/admin/blog";
      const method = editingBlog ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || "Gagal menyimpan artikel.");
      }

      setIsModalOpen(false);
      fetchBlogs();
    } catch (err: any) {
      setFormError(err.message || "Terjadi kesalahan sistem saat menyimpan artikel.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleTogglePublish = async (blog: BlogPost) => {
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/blog/${blog.id}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ published: !blog.published })
      });
      const json = await res.json();
      if (json.success) {
        fetchBlogs();
      } else {
        alert(json.message || "Gagal mengubah status publikasi.");
      }
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan.");
    }
  };

  const handleToggleEnabled = async (blog: BlogPost) => {
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/blog/${blog.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ enabled: !blog.enabled })
      });
      const json = await res.json();
      if (json.success) {
        fetchBlogs();
      } else {
        alert(json.message || "Gagal mengubah status aktif.");
      }
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan.");
    }
  };

  const handleArchive = async (blog: BlogPost) => {
    if (!confirm(`Arsipkan artikel "${blog.title}"? Artikel tidak akan lagi tampil ke publik.`)) return;
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/blog/${blog.id}/archive`, {
        method: "POST",
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const json = await res.json();
      if (json.success) {
        fetchBlogs();
      } else {
        alert(json.message || "Gagal mengarsipkan artikel.");
      }
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan.");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmBlog) return;
    try {
      setDeleteLoading(true);
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/blog/${deleteConfirmBlog.id}`, {
        method: "DELETE",
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const json = await res.json();
      if (json.success) {
        setDeleteConfirmBlog(null);
        fetchBlogs();
      } else {
        alert(json.message || "Gagal menghapus artikel.");
      }
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleOpenPreviewModal = async (blog: BlogPost) => {
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/blog/${blog.id}/preview`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const json = await res.json();
      if (json.success) {
        setPreviewBlog(json.data);
        setPreviewModalOpen(true);
      } else {
        alert(json.message || "Gagal memuat pratinjau artikel.");
      }
    } catch (e: any) {
      alert(e.message || "Gagal memuat pratinjau.");
    }
  };

  const handleCopyLink = (slugString: string) => {
    const fullUrl = `${window.location.origin}/blog/${slugString}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedSlug(slugString);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  // Helper insertion for content editor
  const insertContentSnippet = (before: string, after: string = "") => {
    setContent((prev) => prev + `\n${before}${after}\n`);
  };

  const getStatusBadge = (status?: BlogStatus) => {
    switch (status) {
      case "PUBLISHED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Tayang (Published)
          </span>
        );
      case "SCHEDULED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Clock className="w-3.5 h-3.5" />
            Terjadwal
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            Draft
          </span>
        );
      case "ENDED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Selesai Tayang
          </span>
        );
      case "INACTIVE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
            <XCircle className="w-3.5 h-3.5" />
            Dinonaktifkan
          </span>
        );
      case "ARCHIVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-800 border border-slate-300">
            <Archive className="w-3.5 h-3.5" />
            Arsip
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl flex-shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight whitespace-normal break-words">Blog & Artikel</h1>
              <p className="text-sm text-slate-500 mt-0.5 truncate">
                Kelola artikel, berita promosi, tips game, dan tutorial untuk customer iStore.id
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <Link
            to="/blog"
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-semibold transition-colors shadow-sm"
          >
            <ExternalLink className="w-4 h-4 text-slate-500" />
            Buka Blog Publik
          </Link>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm shadow-blue-200 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tulis Artikel Baru
          </button>
        </div>
      </div>

      {/* Filter & Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari judul, slug, atau penulis..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Category selector */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
            >
              <option value="ALL">Semua Kategori</option>
              {PREDEFINED_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              {availableCategories
                .filter((c) => !PREDEFINED_CATEGORIES.includes(c))
                .map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-t border-slate-100 pt-3">
          {[
            { id: "ALL", label: "Semua" },
            { id: "PUBLISHED", label: "Tayang (Published)" },
            { id: "SCHEDULED", label: "Terjadwal" },
            { id: "DRAFT", label: "Draft" },
            { id: "ENDED", label: "Selesai" },
            { id: "INACTIVE", label: "Nonaktif" },
            { id: "ARCHIVED", label: "Arsip" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Blog List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm">Memuat artikel blog...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto text-red-500" />
            <p className="font-semibold">{error}</p>
          </div>
        ) : blogs.length === 0 ? (
          <div className="p-16 text-center text-slate-500 space-y-3">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">Belum ada artikel</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Mulai buat artikel berita, panduan top up, atau info promosi pertama untuk toko Anda.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tulis Artikel Sekarang
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Artikel & Info</th>
                  <th className="py-3.5 px-4">Kategori & Tag</th>
                  <th className="py-3.5 px-4">Penulis & Baca</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Jadwal & Publikasi</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {blogs.map((blog) => (
                  <tr key={blog.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {blog.coverMediaUrl ? (
                            <img
                              src={blog.coverMediaUrl}
                              alt={blog.title}
                              className="w-full h-full object-cover"
                              onError={(e) => ((e.target as HTMLElement).style.display = "none")}
                            />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-slate-900 line-clamp-1 hover:text-blue-600">
                            {blog.title}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-mono text-slate-400">/blog/{blog.slug}</span>
                            <button
                              onClick={() => handleCopyLink(blog.slug)}
                              title="Salin tautan publik"
                              className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                            >
                              {copiedSlug === blog.slug ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-1 max-w-sm">{blog.excerpt}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="space-y-1.5">
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          {blog.category || "Berita"}
                        </span>
                        {blog.tags && blog.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {blog.tags.slice(0, 2).map((t, idx) => (
                              <span key={idx} className="text-[11px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                                #{t}
                              </span>
                            ))}
                            {blog.tags.length > 2 && (
                              <span className="text-[10px] text-slate-400">+{blog.tags.length - 2}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="space-y-0.5 text-xs text-slate-600">
                        <div className="flex items-center gap-1 font-medium text-slate-800">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {blog.author || "Editorial"}
                        </div>
                        <div className="text-slate-400">~{blog.readTime || 1} mnt baca</div>
                      </div>
                    </td>

                    <td className="py-4 px-4">{getStatusBadge(blog.status)}</td>

                    <td className="py-4 px-4">
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTogglePublish(blog)}
                            className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                              blog.published
                                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {blog.published ? "Published" : "Draft"}
                          </button>
                          <button
                            onClick={() => handleToggleEnabled(blog)}
                            className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                              blog.enabled
                                ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                                : "bg-red-100 text-red-800 hover:bg-red-200"
                            }`}
                          >
                            {blog.enabled ? "Aktif" : "Nonaktif"}
                          </button>
                        </div>
                        {blog.startAt && (
                          <div className="text-slate-400 text-[11px]">
                            Mulai: {new Date(blog.startAt).toLocaleDateString("id-ID")}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenPreviewModal(blog)}
                          title="Pratinjau Artikel"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(blog)}
                          title="Edit Artikel"
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleArchive(blog)}
                          title="Arsipkan"
                          className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmBlog(blog)}
                          title="Hapus Artikel"
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
            <span>
              Menampilkan {blogs.length} dari {totalItems} artikel
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2">
                Halaman {page} dari {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CREATE / EDIT ARTICLE */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">
                    {editingBlog ? "Edit Artikel Blog" : "Tulis Artikel Baru"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Gunakan Media Library untuk aset visual dan hubungkan konten komersial.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="flex border-b border-slate-200 bg-white px-6 gap-6 text-sm font-semibold text-slate-500">
              <button
                type="button"
                onClick={() => setModalTab("info")}
                className={`py-3.5 border-b-2 cursor-pointer transition-colors ${
                  modalTab === "info"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent hover:text-slate-800"
                }`}
              >
                1. Informasi & Header
              </button>
              <button
                type="button"
                onClick={() => setModalTab("content")}
                className={`py-3.5 border-b-2 cursor-pointer transition-colors ${
                  modalTab === "content"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent hover:text-slate-800"
                }`}
              >
                2. Konten Artikel
              </button>
              <button
                type="button"
                onClick={() => setModalTab("related")}
                className={`py-3.5 border-b-2 cursor-pointer transition-colors ${
                  modalTab === "related"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent hover:text-slate-800"
                }`}
              >
                3. Konten Terkait
              </button>
              <button
                type="button"
                onClick={() => setModalTab("schedule")}
                className={`py-3.5 border-b-2 cursor-pointer transition-colors ${
                  modalTab === "schedule"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent hover:text-slate-800"
                }`}
              >
                4. Publikasi & SEO
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmitForm} className="flex-1 overflow-y-auto p-6 space-y-6">
              {formError && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                  <span>{formError}</span>
                </div>
              )}

              {/* TAB 1: INFORMASI UTAMA */}
              {modalTab === "info" && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Judul Artikel <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: 5 Tips Push Rank Mythic Mobile Legends Terbaru 2026"
                      value={title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      URL Slug <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center">
                      <span className="bg-slate-100 border border-r-0 border-slate-200 text-slate-500 px-3.5 py-2.5 rounded-l-xl text-xs font-mono">
                        /blog/
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="tips-push-rank-mythic-mlbb-2026"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-r-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Hanya huruf kecil, angka, dan tanda hubung (-). Contoh: tips-topup-ff
                    </p>
                  </div>

                  {/* Kategori & Penulis */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Kategori <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      >
                        {PREDEFINED_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                        <option value="CUSTOM">+ Kategori Baru / Kustom</option>
                      </select>
                      {category === "CUSTOM" && (
                        <input
                          type="text"
                          required
                          placeholder="Masukkan nama kategori baru..."
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                          className="mt-2 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Nama Penulis
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Tim Editorial iStore"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Tag artikel */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Tags (Pisahkan dengan koma)
                    </label>
                    <input
                      type="text"
                      placeholder="mobile-legends, tips, diamond, promo"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Excerpt */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Ringkasan Singkat (Excerpt) <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Tulis ringkasan singkat 1-2 kalimat untuk kartu artikel dan cuplikan media sosial..."
                      value={excerpt}
                      onChange={(e) => setExcerpt(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
                    />
                  </div>

                  {/* Cover Media Library Picker */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Gambar Sampul (Cover Image)
                    </label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {coverMediaUrl ? (
                        <div className="relative w-40 h-24 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 shadow-sm shrink-0">
                          <img src={coverMediaUrl} alt="Cover preview" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-40 h-24 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 shrink-0">
                          <ImageIcon className="w-6 h-6 mb-1" />
                          <span className="text-xs">Belum ada cover</span>
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenMediaPicker("cover")}
                            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                          >
                            <ImageIcon className="w-4 h-4 text-blue-600" />
                            Pilih dari Media Library
                          </button>
                          {coverMediaUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setCoverMediaId("");
                                setCoverMediaUrl("");
                              }}
                              className="px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Hapus Cover
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          Cover diambil langsung dari Media Library tanpa duplikasi asset storage.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: KONTEN ARTIKEL */}
              {modalTab === "content" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-slate-500 uppercase mr-2">Editor Format:</span>
                      <button
                        type="button"
                        onClick={() => insertContentSnippet("## Judul Bagian")}
                        title="Heading 2"
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        <Heading2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertContentSnippet("### Sub-judul")}
                        title="Heading 3"
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        <Heading3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertContentSnippet("**Teks Tebal**")}
                        title="Tebal"
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        <Bold className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertContentSnippet("*Teks Miring*")}
                        title="Miring"
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        <Italic className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertContentSnippet("> Kutipan penting di sini")}
                        title="Kutipan (Quote)"
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        <Quote className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertContentSnippet("- Poin pertama\n- Poin kedua\n- Poin ketiga")}
                        title="Daftar Poin"
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        <List className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertContentSnippet("1. Langkah pertama\n2. Langkah kedua")}
                        title="Daftar Nomor"
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        <ListOrdered className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertContentSnippet(":::tip\nTips Penting: Pastikan akun game Anda tidak sedang login saat proses pengiriman.\n:::")}
                        title="Kotak Tips"
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        <Lightbulb className="w-4 h-4 text-amber-600" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenMediaPicker("inline")}
                        title="Sisipkan Gambar dari Media Library"
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer flex items-center gap-1 text-xs"
                      >
                        <ImageIcon className="w-4 h-4 text-blue-600" />
                        <span className="hidden sm:inline font-medium">Gambar</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setContentViewMode("edit")}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          contentViewMode === "edit" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                        }`}
                      >
                        Editor
                      </button>
                      <button
                        type="button"
                        onClick={() => setContentViewMode("preview")}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          contentViewMode === "preview" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                        }`}
                      >
                        Pratinjau Hasil
                      </button>
                    </div>
                  </div>

                  {contentViewMode === "edit" ? (
                    <div>
                      <textarea
                        rows={16}
                        required
                        placeholder={`Tulis isi artikel di sini...\n\n## Pendahuluan\nJelaskan topik yang dibahas secara mendalam.\n\n- Gunakan format markdown yang aman\n- Gunakan toolbar di atas untuk menyisipkan gambar Media Library dan kotak tips`}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-mono leading-relaxed focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50/40"
                      />
                      <div className="flex justify-between items-center text-xs text-slate-400 mt-1">
                        <span>
                          Perkiraan waktu baca: ~{Math.max(1, Math.ceil(content.trim().split(/\s+/).filter(Boolean).length / 200))} menit
                        </span>
                        <span>{content.length} karakter</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl border border-slate-200 bg-white min-h-[380px] max-h-[460px] overflow-y-auto">
                      <BlogContentRenderer content={content} />
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: KONTEN TERKAIT */}
              {modalTab === "related" && (
                <div className="space-y-5">
                  <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs leading-relaxed">
                    <p className="font-semibold mb-1">Hubungkan Artikel dengan Ekosistem iStore.id</p>
                    Customer yang membaca artikel dapat langsung diarahkan ke halaman top up game, voucher promo, kampanye, atau landing page. Data harga dan stok diambil langsung dari source of truth tanpa duplikasi.
                  </div>

                  {/* Game Terkait */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Gamepad2 className="w-4 h-4 text-blue-600" />
                      Game Terkait (Direct Top Up CTA)
                    </label>
                    <select
                      value={relatedGameId}
                      onChange={(e) => setRelatedGameId(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                    >
                      <option value="">-- Tidak ada game terkait --</option>
                      {componentsData.games.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} (/games/{g.slug})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Promo Voucher Terkait */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-emerald-600" />
                      Promo / Voucher Terkait
                    </label>
                    <select
                      value={relatedPromoId}
                      onChange={(e) => setRelatedPromoId(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                    >
                      <option value="">-- Tidak ada voucher terkait --</option>
                      {componentsData.promos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Kode: {p.code} - Diskon {p.discountValue}{p.discountType === "percentage" ? "%" : " IDR"})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Kampanye Terkait */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-amber-600" />
                      Kampanye Pemasaran Terkait
                    </label>
                    <select
                      value={relatedCampaignId}
                      onChange={(e) => setRelatedCampaignId(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                    >
                      <option value="">-- Tidak ada kampanye terkait --</option>
                      {componentsData.campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Landing Page Terkait */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Layout className="w-4 h-4 text-purple-600" />
                      Landing Page Promosi Terkait
                    </label>
                    <select
                      value={relatedLandingId}
                      onChange={(e) => setRelatedLandingId(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                    >
                      <option value="">-- Tidak ada landing page terkait --</option>
                      {componentsData.landings.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.title} (/promo/{l.slug})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* TAB 4: PUBLIKASI & SEO */}
              {modalTab === "schedule" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Toggle Published */}
                    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sm text-slate-900">Publikasikan Artikel</div>
                        <div className="text-xs text-slate-500">
                          Bila aktif, artikel dapat dibaca publik sesuai jadwal
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={published}
                        onChange={(e) => setPublished(e.target.checked)}
                        className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                      />
                    </div>

                    {/* Toggle Enabled */}
                    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sm text-slate-900">Status Aktif (Enabled)</div>
                        <div className="text-xs text-slate-500">
                          Matikan sementara jika ingin menyembunyikan artikel
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                        className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Scheduling Datetime */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Mulai Tayang (Jadwal Otomatis)
                      </label>
                      <input
                        type="datetime-local"
                        value={startAt}
                        onChange={(e) => setStartAt(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <p className="text-xs text-slate-400 mt-1">Kosongkan jika tayang langsung.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Berakhir Tayang (Opsional)
                      </label>
                      <input
                        type="datetime-local"
                        value={endAt}
                        onChange={(e) => setEndAt(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <p className="text-xs text-slate-400 mt-1">Kosongkan jika berlaku selamanya.</p>
                    </div>
                  </div>

                  {/* SEO Metadata */}
                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Optimasi Mesin Pencari (SEO Metadata)
                    </h4>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Judul SEO (Meta Title)
                      </label>
                      <input
                        type="text"
                        placeholder="Otomatis menggunakan Judul Artikel jika kosong"
                        value={seoTitle}
                        onChange={(e) => setSeoTitle(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Deskripsi SEO (Meta Description)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Otomatis menggunakan Ringkasan jika kosong"
                        value={seoDescription}
                        onChange={(e) => setSeoDescription(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm shadow-blue-200 cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? "Menyimpan..." : editingBlog ? "Simpan Perubahan" : "Buat Artikel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MEDIA LIBRARY PICKER */}
      {/* ========================================================================= */}
      {isMediaPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900">
                  Pilih Aset dari Media Library
                </h3>
              </div>
              <button
                onClick={() => setIsMediaPickerOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama file media..."
                  value={mediaSearch}
                  onChange={(e) => setMediaSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {mediaList.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  Belum ada aset gambar di Media Library. Silakan unggah di menu Media Library terlebih dahulu.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {mediaList
                    .filter((m) => m.name.toLowerCase().includes(mediaSearch.toLowerCase()))
                    .map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectMedia(item)}
                        className="group border border-slate-200 rounded-xl overflow-hidden hover:border-blue-500 hover:shadow-md cursor-pointer transition-all flex flex-col bg-slate-50"
                      >
                        <div className="h-28 bg-slate-100 overflow-hidden">
                          <img
                            src={item.url}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        </div>
                        <div className="p-2 bg-white flex-1">
                          <div className="text-xs font-semibold text-slate-800 truncate" title={item.name}>
                            {item.name}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {(item.size / 1024).toFixed(0)} KB
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-xs text-slate-500">
              <span>Klik gambar untuk memilih langsung ke artikel.</span>
              <button
                onClick={() => setIsMediaPickerOpen(false)}
                className="px-4 py-1.5 border border-slate-200 bg-white rounded-lg font-semibold hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: LIVE PREVIEW MODAL */}
      {/* ========================================================================= */}
      {previewModalOpen && previewBlog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-slate-100 rounded-3xl border border-slate-300 shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
            {/* Preview Toolbar */}
            <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  Pratinjau Admin
                </span>
                <span className="text-sm font-bold text-slate-800 truncate max-w-xs sm:max-w-md">
                  {previewBlog.title}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Viewport switch */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setPreviewDevice("desktop")}
                    className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                      previewDevice === "desktop" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Desktop</span>
                  </button>
                  <button
                    onClick={() => setPreviewDevice("mobile")}
                    className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                      previewDevice === "mobile" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Mobile</span>
                  </button>
                </div>

                <Link
                  to={`/admin/blog/${previewBlog.id}/preview`}
                  target="_blank"
                  className="p-1.5 text-slate-600 hover:text-blue-600 rounded-lg hover:bg-slate-50 text-xs font-semibold flex items-center gap-1"
                  title="Buka tab baru pratinjau"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>

                <button
                  onClick={() => setPreviewModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-full"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Preview Frame Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-slate-100">
              <div
                className={`bg-white rounded-2xl shadow-md border border-slate-200 transition-all duration-300 overflow-hidden ${
                  previewDevice === "desktop" ? "w-full max-w-4xl" : "w-full max-w-sm"
                }`}
              >
                {/* Article Header */}
                <div className="p-6 sm:p-10 border-b border-slate-100">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {previewBlog.category}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      ~{previewBlog.readTime || 1} menit baca
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
                    {previewBlog.title}
                  </h1>

                  <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-6 font-medium">
                    {previewBlog.excerpt}
                  </p>

                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100 text-xs text-slate-500">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                      {previewBlog.author ? previewBlog.author.charAt(0).toUpperCase() : "I"}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{previewBlog.author}</div>
                      <div>
                        {previewBlog.publishedAt
                          ? new Date(previewBlog.publishedAt).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "long",
                              year: "numeric"
                            })
                          : "Draft belum dipublikasikan"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cover Image */}
                {previewBlog.coverMediaUrl && (
                  <div className="w-full bg-slate-100 max-h-[420px] overflow-hidden border-b border-slate-100">
                    <img
                      src={previewBlog.coverMediaUrl}
                      alt={previewBlog.title}
                      className="w-full h-auto object-cover max-h-[420px]"
                    />
                  </div>
                )}

                {/* Content Body */}
                <div className="p-6 sm:p-10">
                  <BlogContentRenderer content={previewBlog.content} />

                  {/* Related Content Preview */}
                  {(previewBlog.relatedGame || previewBlog.relatedPromo) && (
                    <div className="mt-12 pt-8 border-t border-slate-200 space-y-4">
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Rekomendasi Terkait
                      </h4>

                      {previewBlog.relatedGame && (
                        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                              <Gamepad2 className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{previewBlog.relatedGame.name}</div>
                              <div className="text-xs text-slate-600">Top Up Instan & Bergaransi di iStore.id</div>
                            </div>
                          </div>
                          <span className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">
                            Top Up Sekarang
                          </span>
                        </div>
                      )}

                      {previewBlog.relatedPromo && (
                        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-600 text-white rounded-xl">
                              <Tag className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="font-bold text-emerald-950">{previewBlog.relatedPromo.name}</div>
                              <div className="text-xs text-emerald-700">
                                Gunakan kode voucher: <strong className="font-mono">{previewBlog.relatedPromo.code}</strong>
                              </div>
                            </div>
                          </div>
                          <span className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold font-mono">
                            {previewBlog.relatedPromo.code}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE CONFIRMATION (REFERENCE SAFETY) */}
      {/* ========================================================================= */}
      {deleteConfirmBlog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">Hapus Artikel Blog?</h3>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                Anda akan menghapus artikel <strong className="text-slate-900">"{deleteConfirmBlog.title}"</strong>.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 space-y-1">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Prinsip Reference Safety
              </span>
              <p>
                Menghapus artikel ini <strong>TIDAK AKAN</strong> menghapus aset gambar di Media Library, Katalog Game, Promo, atau Kampanye terkait.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setDeleteConfirmBlog(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-slate-700 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleteLoading ? "Menghapus..." : "Ya, Hapus Artikel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
