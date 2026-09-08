import React, { useState, useEffect, useCallback } from "react";
import { 
  Users, Search, Filter, RefreshCw, Download, Eye, EyeOff, Shield, 
  CheckCircle2, AlertTriangle, XCircle, FileText, Tag, ChevronLeft, 
  ChevronRight, ShoppingBag, Award, Clock, ArrowUpRight, Plus,
  Lock, AlertCircle, X, Check, DollarSign, Calendar, Phone, Mail, UserCheck
} from "lucide-react";
import { useAuthStore } from "../../store/auth-store";
import { formatRupiah } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { 
  CustomerUser, 
  Customer360Profile, 
  CustomerStatus 
} from "../../types/customer";

export default function AdminUsersPage() {
  const { user } = useAuthStore();

  // Directory state
  const [customers, setCustomers] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    totalCustomers: 0,
    activeCount: 0,
    suspendedCount: 0,
    disabledCount: 0,
    totalCustomerLtvIdr: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [tagFilter, setTagFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const cursorMapRef = React.useRef<Record<number, string | null>>({ 1: null });

  // Invalidate cursor map on query state changes
  useEffect(() => {
    cursorMapRef.current = { 1: null };
    setPage(1);
  }, [search, statusFilter, roleFilter, tagFilter, sortBy, sortOrder]);

  // Customer 360 Detail State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Customer360Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "orders" | "loyalty" | "notes" | "audit">("overview");

  // Unmasked PII state
  const [unmaskedPii, setUnmaskedPii] = useState<{ email: string; phone: string } | null>(null);
  const [loadingUnmask, setLoadingUnmask] = useState(false);

  // Modals & Action States
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<CustomerStatus>("SUSPENDED");
  const [statusReason, setStatusReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [targetRole, setTargetRole] = useState("customer");

  const [newNoteText, setNewNoteText] = useState("");
  const [newTagInput, setNewTagInput] = useState("");
  const [exporting, setExporting] = useState(false);

  // Fetch Directory
  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await user?.getIdToken();

      const hasSearch = !!search.trim();
      const activeFilterCount = (statusFilter !== "ALL" ? 1 : 0) + (roleFilter !== "ALL" ? 1 : 0) + (tagFilter !== "ALL" ? 1 : 0);
      const isNativeQuery = !hasSearch && sortBy !== "totalSpent" && (
        activeFilterCount === 0 || (activeFilterCount === 1 && sortBy === "createdAt")
      );

      if (isNativeQuery && page > 1 && !cursorMapRef.current[page]) {
        setPage(1);
        return;
      }

      const params = new URLSearchParams();
      if (search.trim()) params.append("search", search.trim());
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (roleFilter !== "ALL") params.append("role", roleFilter);
      if (tagFilter !== "ALL") params.append("tag", tagFilter);
      params.append("page", page.toString());
      params.append("limit", limit.toString());
      params.append("sortBy", sortBy);
      params.append("sortOrder", sortOrder);

      if (isNativeQuery && page > 1) {
        const cursorVal = cursorMapRef.current[page];
        if (cursorVal) {
          params.append("cursor", cursorVal);
        }
      }

      const res = await fetch(`/api/admin/customers?${params.toString()}`, {
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });

      const json = await res.json();
      if (json.success && json.data) {
        setCustomers(json.data.items || []);
        setTotalPages(json.data.totalPages || 1);
        setTotalItems(json.data.total || 0);
        if (json.data.metrics) {
          setMetrics(json.data.metrics);
        }
        if (json.data.nextCursor) {
          cursorMapRef.current[json.data.page + 1] = json.data.nextCursor;
        }
      } else {
        setError(json.message || "Gagal mengambil data pelanggan");
      }
    } catch (err: any) {
      setError(err.message || "Koneksi gagal");
    } finally {
      setLoading(false);
    }
  }, [user, search, statusFilter, roleFilter, tagFilter, page, limit, sortBy, sortOrder]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Fetch Customer 360 Detail
  const fetchCustomerProfile = async (customerId: string) => {
    try {
      setLoadingProfile(true);
      setUnmaskedPii(null);
      setSelectedCustomerId(customerId);
      const token = await user?.getIdToken();

      const res = await fetch(`/api/admin/customers/${customerId}`, {
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });

      const json = await res.json();
      if (json.success && json.data) {
        setProfile(json.data);
      } else {
        alert(json.message || "Gagal memuat profil pelanggan");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Unmask PII
  const handleUnmaskPii = async () => {
    if (!selectedCustomerId) return;
    try {
      setLoadingUnmask(true);
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/customers/${selectedCustomerId}/unmask`, {
        method: "POST",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const json = await res.json();
      if (json.success && json.data) {
        setUnmaskedPii({
          email: json.data.email,
          phone: json.data.phone
        });
      } else {
        alert(json.message || "Gagal unmask data PII");
      }
    } catch (err: any) {
      alert("Error unmask: " + err.message);
    } finally {
      setLoadingUnmask(false);
    }
  };

  // Handle Status Update
  const handleUpdateStatus = async () => {
    if (!selectedCustomerId) return;
    if (!statusReason.trim()) {
      alert("Alasan perubahan status wajib diisi!");
      return;
    }

    try {
      setActionLoading(true);
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/customers/${selectedCustomerId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          status: targetStatus,
          reason: statusReason.trim()
        })
      });

      const json = await res.json();
      if (json.success) {
        alert(json.message || "Status berhasil diperbarui");
        setStatusModalOpen(false);
        setStatusReason("");
        fetchCustomerProfile(selectedCustomerId);
        fetchCustomers();
      } else {
        alert(json.message || "Gagal memperbarui status");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Role Update
  const handleUpdateRole = async () => {
    if (!selectedCustomerId) return;
    try {
      setActionLoading(true);
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/users/${selectedCustomerId}/role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          role: targetRole
        })
      });

      const json = await res.json();
      if (json.success) {
        alert("Role pengguna berhasil diperbarui");
        setRoleModalOpen(false);
        fetchCustomerProfile(selectedCustomerId);
        fetchCustomers();
      } else {
        alert(json.message || "Gagal memperbarui role");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Add Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !newNoteText.trim()) return;

    try {
      setActionLoading(true);
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/customers/${selectedCustomerId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          note: newNoteText.trim()
        })
      });

      const json = await res.json();
      if (json.success) {
        setNewNoteText("");
        fetchCustomerProfile(selectedCustomerId);
      } else {
        alert(json.message || "Gagal menambahkan catatan");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Add Tag
  const handleAddTag = async () => {
    if (!selectedCustomerId || !newTagInput.trim() || !profile) return;
    const currentTags = profile.customer.tags || [];
    const normalized = newTagInput.trim().toUpperCase();
    if (currentTags.includes(normalized)) {
      setNewTagInput("");
      return;
    }

    const updatedTags = [...currentTags, normalized];
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/customers/${selectedCustomerId}/tags`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ tags: updatedTags })
      });

      const json = await res.json();
      if (json.success) {
        setNewTagInput("");
        fetchCustomerProfile(selectedCustomerId);
        fetchCustomers();
      }
    } catch (err: any) {
      alert("Gagal menambahkan tag: " + err.message);
    }
  };

  // Handle Remove Tag
  const handleRemoveTag = async (tagToRemove: string) => {
    if (!selectedCustomerId || !profile) return;
    const currentTags = profile.customer.tags || [];
    const updatedTags = currentTags.filter(t => t !== tagToRemove);

    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/customers/${selectedCustomerId}/tags`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ tags: updatedTags })
      });

      const json = await res.json();
      if (json.success) {
        fetchCustomerProfile(selectedCustomerId);
        fetchCustomers();
      }
    } catch (err: any) {
      alert("Gagal menghapus tag: " + err.message);
    }
  };

  // Export CSV
  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/customers/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          search,
          status: statusFilter,
          role: roleFilter,
          tag: tagFilter
        })
      });

      if (!res.ok) {
        throw new Error("Gagal mengekspor data");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `istore-customers-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Export gagal: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  const getStatusBadge = (status: CustomerStatus) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Aktif
          </span>
        );
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3" />
            Ditangguhkan
          </span>
        );
      case "DISABLED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" />
            Dinonaktifkan
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "pemilik":
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-800 border border-purple-200">Pemilik</span>;
      case "admin":
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-800 border border-blue-200">Admin</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-100 text-slate-700">Pelanggan</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600" />
            Manajemen Pengguna & Pelanggan
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola direktori pelanggan, profil 360°, lifecycle akun, riwayat transaksi, dan catatan investigasi.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchCustomers()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            Segarkan
          </button>

          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Mengekspor..." : "Ekspor CSV"}
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Pelanggan</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{metrics.totalCustomers.toLocaleString("id-ID")}</p>
          <span className="text-xs text-slate-400 mt-1 block">Semua akun terdaftar</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pelanggan Aktif</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{metrics.activeCount.toLocaleString("id-ID")}</p>
          <span className="text-xs text-emerald-600 mt-1 block">Siap bertransaksi</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ditangguhkan</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">{metrics.suspendedCount.toLocaleString("id-ID")}</p>
          <span className="text-xs text-amber-600 mt-1 block">Investigasi / Hold</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Dinonaktifkan</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-700 mt-2">{metrics.disabledCount.toLocaleString("id-ID")}</p>
          <span className="text-xs text-rose-600 mt-1 block">Akses dicekal</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Belanja (LTV)</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900 mt-2 truncate">{formatRupiah(metrics.totalCustomerLtvIdr)}</p>
          <span className="text-xs text-slate-400 mt-1 block">Omset pelanggan tercatat</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama, email, nomor telepon, atau UID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg w-full lg:w-auto overflow-x-auto">
            {["ALL", "ACTIVE", "SUSPENDED", "DISABLED"].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? "bg-white text-slate-900 shadow-sm font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {st === "ALL" ? "Semua Status" : st === "ACTIVE" ? "Aktif" : st === "SUSPENDED" ? "Ditangguhkan" : "Dinonaktifkan"}
              </button>
            ))}
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="w-full lg:w-40 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
          >
            <option value="ALL">Semua Peran</option>
            <option value="customer">Pelanggan</option>
            <option value="admin">Admin</option>
            <option value="pemilik">Pemilik</option>
          </select>

          {/* Tag Filter */}
          <select
            value={tagFilter}
            onChange={(e) => {
              setTagFilter(e.target.value);
              setPage(1);
            }}
            className="w-full lg:w-36 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
          >
            <option value="ALL">Semua Tag</option>
            <option value="VIP">VIP</option>
            <option value="FRAUD_RISK">FRAUD RISK</option>
            <option value="WHOLESALE">WHOLESALE</option>
            <option value="HIGH_VALUE">HIGH VALUE</option>
            <option value="RESELLER">RESELLER</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="w-full lg:w-40 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
          >
            <option value="createdAt">Tanggal Daftar</option>
            <option value="totalSpent">Total Belanja</option>
            <option value="name">Nama</option>
            <option value="lastLogin">Login Terakhir</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
            <p className="text-sm text-slate-500 mt-3 font-medium">Memuat data pengguna...</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
            <p className="text-slate-900 font-medium mt-2">{error}</p>
            <button
              onClick={() => fetchCustomers()}
              className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
            >
              Coba Lagi
            </button>
          </div>
        ) : customers.length === 0 ? (
          <div className="py-20 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-semibold text-slate-900 mt-3">Tidak ada pelanggan ditemukan</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
              Coba sesuaikan kata kunci pencarian atau filter status untuk menemukan pengguna.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Pelanggan</th>
                  <th className="px-6 py-3.5">Kontak</th>
                  <th className="px-6 py-3.5">Peran & Status</th>
                  <th className="px-6 py-3.5 text-right">Pesanan & Belanja</th>
                  <th className="px-6 py-3.5">Tags</th>
                  <th className="px-6 py-3.5">Terdaftar</th>
                  <th className="px-6 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {customers.map((c) => (
                  <tr key={c.uid} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white font-bold flex items-center justify-center text-sm shadow-sm flex-shrink-0">
                          {(c.name || c.displayName || "P").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 line-clamp-1">{c.name || c.displayName || "Pelanggan"}</p>
                          <p className="text-xs text-slate-400 font-mono">ID: {c.uid.substring(0, 10)}...</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-mono">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.email || "-"}</span>
                        </div>
                        {c.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{c.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        {getRoleBadge(c.role)}
                        {getStatusBadge(c.status)}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="font-medium text-slate-900">
                        {formatRupiah(c.totalSpentIdr || 0)}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {c.orderCount || 0} pesanan
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[160px]">
                        {c.tags && c.tags.length > 0 ? (
                          c.tags.map((t: string) => (
                            <span key={t} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-semibold rounded">
                              {t}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(c.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      })}
                    </td>

                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => fetchCustomerProfile(c.uid)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium text-xs rounded-lg transition-colors border border-indigo-200"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Detail 360°
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Menampilkan <span className="font-semibold text-slate-800">{customers.length}</span> dari{" "}
            <span className="font-semibold text-slate-800">{totalItems}</span> pelanggan
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="p-1.5 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed bg-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-slate-700">
              Halaman {page} dari {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed bg-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Customer 360° Modal / Drawer */}
      <AnimatePresence>
        {selectedCustomerId && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-end">
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-3xl bg-white min-h-screen shadow-2xl flex flex-col relative"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white font-bold flex items-center justify-center text-lg shadow-sm">
                    {(profile?.customer.name || profile?.customer.displayName || "P").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">
                        {profile?.customer.name || profile?.customer.displayName || "Profil Pelanggan"}
                      </h2>
                      {profile && getStatusBadge(profile.customer.status)}
                      {profile && getRoleBadge(profile.customer.role)}
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">UID: {selectedCustomerId}</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedCustomerId(null);
                    setProfile(null);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingProfile ? (
                <div className="flex-1 flex items-center justify-center py-32">
                  <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                    <p className="text-sm text-slate-500 mt-2">Memuat profil 360°...</p>
                  </div>
                </div>
              ) : profile ? (
                <div className="flex-1 flex flex-col">
                  {/* Action Quick Bar */}
                  <div className="px-6 py-3 bg-indigo-50/50 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setTargetStatus(profile.customer.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE");
                          setStatusModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 shadow-xs flex items-center gap-1.5"
                      >
                        <Shield className="w-3.5 h-3.5 text-indigo-600" />
                        Ubah Status Akun
                      </button>

                      <button
                        onClick={() => {
                          setTargetRole(profile.customer.role);
                          setRoleModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 shadow-xs flex items-center gap-1.5"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                        Ubah Role
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {unmaskedPii ? (
                        <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 font-medium flex items-center gap-1">
                          <Eye className="w-3 h-3" /> PII Terbuka
                        </span>
                      ) : (
                        <button
                          onClick={handleUnmaskPii}
                          disabled={loadingUnmask}
                          className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-lg hover:bg-amber-100 flex items-center gap-1.5 shadow-xs"
                        >
                          <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                          {loadingUnmask ? "Membuka..." : "Buka Masking PII"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Drawer Navigation Tabs */}
                  <div className="flex border-b border-slate-200 px-6 bg-white overflow-x-auto">
                    {[
                      { id: "overview", label: "Ringkasan", icon: Users },
                      { id: "orders", label: "Pesanan", icon: ShoppingBag },
                      { id: "loyalty", label: "Loyalti & Poin", icon: Award },
                      { id: "notes", label: "Catatan Admin", icon: FileText },
                      { id: "audit", label: "Audit Trail", icon: Clock }
                    ].map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                            activeTab === tab.id
                              ? "border-indigo-600 text-indigo-600"
                              : "border-transparent text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Drawer Tab Content */}
                  <div className="p-6 space-y-6 flex-1 bg-slate-50/50">
                    {/* OVERVIEW TAB */}
                    {activeTab === "overview" && (
                      <div className="space-y-6">
                        {/* Commerce Summary Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                            <span className="text-[11px] font-medium text-slate-400 uppercase">Total Belanja</span>
                            <p className="text-base font-bold text-slate-900 mt-1">
                              {formatRupiah(profile.commerce.totalSpentIdr)}
                            </p>
                          </div>
                          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                            <span className="text-[11px] font-medium text-slate-400 uppercase">Total Pesanan</span>
                            <p className="text-base font-bold text-slate-900 mt-1">
                              {profile.commerce.totalOrders} ({profile.commerce.paidOrdersCount} sukses)
                            </p>
                          </div>
                          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                            <span className="text-[11px] font-medium text-slate-400 uppercase">Rata-rata Order</span>
                            <p className="text-base font-bold text-slate-900 mt-1">
                              {formatRupiah(profile.commerce.averageOrderValueIdr)}
                            </p>
                          </div>
                          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                            <span className="text-[11px] font-medium text-slate-400 uppercase">Poin Reward</span>
                            <p className="text-base font-bold text-indigo-600 mt-1">
                              {profile.loyalty.pointsBalance.toLocaleString("id-ID")} Poin
                            </p>
                          </div>
                        </div>

                        {/* Customer Info Card */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Users className="w-4 h-4 text-indigo-600" />
                            Informasi Identitas & Kontak
                          </h3>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div>
                              <span className="text-slate-400 block mb-0.5">Email</span>
                              <span className="font-mono text-slate-800 font-medium select-all">
                                {unmaskedPii ? unmaskedPii.email : profile.customer.email || "-"}
                              </span>
                            </div>

                            <div>
                              <span className="text-slate-400 block mb-0.5">Nomor Telepon</span>
                              <span className="font-mono text-slate-800 font-medium select-all">
                                {unmaskedPii ? unmaskedPii.phone : profile.customer.phone || "-"}
                              </span>
                            </div>

                            <div>
                              <span className="text-slate-400 block mb-0.5">Tanggal Terdaftar</span>
                              <span className="text-slate-800 font-medium">
                                {new Date(profile.customer.createdAt).toLocaleString("id-ID")}
                              </span>
                            </div>

                            <div>
                              <span className="text-slate-400 block mb-0.5">Status Akun Saat Ini</span>
                              <div>{getStatusBadge(profile.customer.status)}</div>
                            </div>
                          </div>

                          {profile.customer.suspendReason && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                              <span className="font-semibold block">Alasan Penangguhan / Cekal:</span>
                              {profile.customer.suspendReason}
                              {profile.customer.suspendedBy && (
                                <span className="block text-[10px] text-rose-600 mt-1">
                                  Oleh: {profile.customer.suspendedBy} pada{" "}
                                  {profile.customer.suspendedAt ? new Date(profile.customer.suspendedAt).toLocaleString("id-ID") : "-"}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Customer Tags Card */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
                          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Tag className="w-4 h-4 text-indigo-600" />
                            Label & Segmentasi (Tags)
                          </h3>

                          <div className="flex flex-wrap items-center gap-2">
                            {profile.customer.tags && profile.customer.tags.length > 0 ? (
                              profile.customer.tags.map((tag: string) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-800 text-xs font-semibold rounded-lg border border-indigo-200"
                                >
                                  {tag}
                                  <button
                                    onClick={() => handleRemoveTag(tag)}
                                    className="text-indigo-400 hover:text-indigo-800"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400">Belum ada label</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 pt-2">
                            <input
                              type="text"
                              placeholder="Tambah label (cth: VIP, RESELLER)..."
                              value={newTagInput}
                              onChange={(e) => setNewTagInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddTag();
                                }
                              }}
                              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                              onClick={handleAddTag}
                              disabled={!newTagInput.trim()}
                              className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                              Tambah
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ORDERS TAB */}
                    {activeTab === "orders" && (
                      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                        <div className="p-4 border-b border-slate-200">
                          <h3 className="text-sm font-bold text-slate-900">Riwayat Pesanan Terbaru</h3>
                          <p className="text-xs text-slate-500">10 transaksi terakhir yang tercatat atas pelanggan ini.</p>
                        </div>

                        {profile.commerce.recentOrders.length === 0 ? (
                          <div className="p-12 text-center text-slate-400 text-xs">
                            Belum ada riwayat pesanan
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-600">
                              <thead className="bg-slate-50 font-semibold text-slate-500 border-b border-slate-200">
                                <tr>
                                  <th className="px-4 py-3">Invoice</th>
                                  <th className="px-4 py-3">Produk</th>
                                  <th className="px-4 py-3">Nominal</th>
                                  <th className="px-4 py-3">Pembayaran</th>
                                  <th className="px-4 py-3">Tanggal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {profile.commerce.recentOrders.map((o) => (
                                  <tr key={o.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-mono font-medium text-slate-900">{o.invoice}</td>
                                    <td className="px-4 py-3">
                                      <p className="font-semibold text-slate-800">{o.productName}</p>
                                      {o.variantName && <p className="text-[11px] text-slate-400">{o.variantName}</p>}
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-slate-900">
                                      {formatRupiah(o.totalAmount)}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                        o.paymentStatus === "paid" || o.transactionStatus === "success"
                                          ? "bg-emerald-100 text-emerald-800"
                                          : o.paymentStatus === "refunded"
                                          ? "bg-purple-100 text-purple-800"
                                          : "bg-amber-100 text-amber-800"
                                      }`}>
                                        {o.paymentStatus}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-400">
                                      {new Date(o.createdAt).toLocaleDateString("id-ID")}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* LOYALTY TAB */}
                    {activeTab === "loyalty" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                            <span className="text-[11px] font-medium text-slate-400 uppercase">Saldo Poin</span>
                            <p className="text-xl font-bold text-indigo-600 mt-1">
                              {profile.loyalty.pointsBalance.toLocaleString("id-ID")}
                            </p>
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                            <span className="text-[11px] font-medium text-slate-400 uppercase">Total Didapat</span>
                            <p className="text-xl font-bold text-emerald-600 mt-1">
                              +{profile.loyalty.totalEarnedPoints.toLocaleString("id-ID")}
                            </p>
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                            <span className="text-[11px] font-medium text-slate-400 uppercase">Total Ditukar</span>
                            <p className="text-xl font-bold text-rose-600 mt-1">
                              -{profile.loyalty.totalRedeemedPoints.toLocaleString("id-ID")}
                            </p>
                          </div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                          <div className="p-4 border-b border-slate-200">
                            <h3 className="text-sm font-bold text-slate-900">Riwayat Mutasi Poin</h3>
                          </div>

                          {profile.loyalty.recentTransactions.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 text-xs">
                              Belum ada mutasi poin
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs text-slate-600">
                                <thead className="bg-slate-50 font-semibold text-slate-500 border-b border-slate-200">
                                  <tr>
                                    <th className="px-4 py-3">Tipe</th>
                                    <th className="px-4 py-3">Poin</th>
                                    <th className="px-4 py-3">Referensi / Alasan</th>
                                    <th className="px-4 py-3">Tanggal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {profile.loyalty.recentTransactions.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-slate-50">
                                      <td className="px-4 py-3 font-semibold text-slate-800">{tx.type}</td>
                                      <td className={`px-4 py-3 font-bold ${tx.points >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                        {tx.points >= 0 ? `+${tx.points}` : tx.points}
                                      </td>
                                      <td className="px-4 py-3 text-slate-500">{tx.reference || tx.reason || "-"}</td>
                                      <td className="px-4 py-3 text-slate-400">
                                        {new Date(tx.createdAt).toLocaleString("id-ID")}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* NOTES TAB */}
                    {activeTab === "notes" && (
                      <div className="space-y-4">
                        {/* New Note Form */}
                        <form onSubmit={handleAddNote} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                          <label className="text-xs font-bold text-slate-800 block">
                            Tambah Catatan Investigasi / Dukungan Internal
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Tulis catatan penting terkait akun ini (cth: Pengguna meminta konfirmasi transaksi khusus, investigasi fraud, dll)..."
                            value={newNoteText}
                            onChange={(e) => setNewNoteText(e.target.value)}
                            className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <div className="flex justify-end">
                            <button
                              type="submit"
                              disabled={actionLoading || !newNoteText.trim()}
                              className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                              Simpan Catatan
                            </button>
                          </div>
                        </form>

                        {/* Notes List */}
                        <div className="space-y-3">
                          {profile.customer.notes && profile.customer.notes.length > 0 ? (
                            profile.customer.notes.map((n) => (
                              <div key={n.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                                <p className="text-xs text-slate-800 leading-relaxed">{n.note}</p>
                                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-100">
                                  <span>Oleh: <strong className="text-slate-600">{n.authorEmail}</strong></span>
                                  <span>{new Date(n.createdAt).toLocaleString("id-ID")}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                              Belum ada catatan internal untuk pelanggan ini.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* AUDIT TRAIL TAB */}
                    {activeTab === "audit" && (
                      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                        <div className="p-4 border-b border-slate-200">
                          <h3 className="text-sm font-bold text-slate-900">Riwayat Perubahan & Keamanan Akun</h3>
                        </div>

                        {profile.auditTrail.length === 0 ? (
                          <div className="p-12 text-center text-slate-400 text-xs">
                            Belum ada catatan audit tercatat.
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {profile.auditTrail.map((log) => (
                              <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-indigo-700 font-mono">{log.action}</span>
                                  <span className="text-slate-400">{new Date(log.timestamp).toLocaleString("id-ID")}</span>
                                </div>
                                <p className="text-slate-600 mt-1">{log.reason || "Perubahan data akun"}</p>
                                <div className="text-[10px] text-slate-400 mt-1">
                                  Aktor: <span className="font-semibold text-slate-700">{log.actorEmail}</span> ({log.role})
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Status Modal */}
      {statusModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              Ubah Status Akun Pelanggan
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Target Status</label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as CustomerStatus)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800"
                >
                  <option value="ACTIVE">ACTIVE (Aktif Bertransaksi)</option>
                  <option value="SUSPENDED">SUSPENDED (Ditangguhkan Sementara / Investigasi)</option>
                  <option value="DISABLED">DISABLED (Dicekal / Dinonaktifkan Permanen)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Alasan Perubahan Status <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Wajib diisi: Jelaskan alasan perubahan status untuk catatan audit keamanan..."
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={actionLoading || !statusReason.trim()}
                onClick={handleUpdateStatus}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
              >
                {actionLoading ? "Menyimpan..." : "Konfirmasi Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Modal */}
      {roleModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              Ubah Role / Peran Pengguna
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Pilih Peran Baru</label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800"
                >
                  <option value="customer">customer (Pelanggan Biasa)</option>
                  <option value="admin">admin (Staf Administrator)</option>
                  <option value="pemilik">pemilik (Owner Sistem)</option>
                </select>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px]">
                Perhatian: Memberikan peran Admin atau Pemilik akan memberikan hak akses kontrol ke panel administrasi sistem.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRoleModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleUpdateRole}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
              >
                {actionLoading ? "Menyimpan..." : "Ubah Role"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
