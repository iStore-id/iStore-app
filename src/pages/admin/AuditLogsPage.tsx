import React, { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "../../store/auth-store";
import {
  History,
  Shield,
  Search,
  Filter,
  RefreshCw,
  Download,
  Calendar,
  User,
  Tag,
  FileText,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Eye,
  X,
  Layers,
  Database,
  Lock,
  DollarSign,
  ShoppingCart,
  Megaphone,
  Settings,
  Sparkles
} from "lucide-react";
import { AuditLog } from "../../types/core";

interface AuditMetrics {
  totalAudits: number;
  todayCount: number;
  topActors: { email: string; count: number; role: string }[];
  actionCategories: { category: string; count: number }[];
  recentCriticalEvents: AuditLog[];
}

export default function AuditLogsPage() {
  const { user } = useAuthStore();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [metrics, setMetrics] = useState<AuditMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [metricsLoading, setMetricsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filter states
  const [search, setSearch] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("ALL");
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [actionQuery, setActionQuery] = useState<string>("");

  // Modal detail state
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Export state
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportMessage, setExportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setMetricsLoading(true);
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/audit-logs/metrics", {
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success && data.data) {
        setMetrics(data.data);
      }
    } catch (err: any) {
      console.warn("Failed to load audit metrics:", err);
    } finally {
      setMetricsLoading(false);
    }
  }, [user]);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await user?.getIdToken();

      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", limit.toString());
      if (search.trim()) params.append("search", search.trim());
      if (selectedModule !== "ALL") params.append("module", selectedModule);
      if (selectedRole !== "ALL") params.append("role", selectedRole);
      if (actionQuery.trim()) params.append("action", actionQuery.trim());
      if (startDate) params.append("startDate", new Date(startDate).toISOString());
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        params.append("endDate", end.toISOString());
      }

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || "Gagal memuat catatan audit");
      }

      setLogs(data.data.logs || []);
      setTotal(data.data.total || 0);
      setTotalPages(data.data.totalPages || 1);
    } catch (err: any) {
      console.error("Fetch audit logs error:", err);
      setError(err.message || "Terjadi kesalahan saat memuat data audit log");
    } finally {
      setLoading(false);
    }
  }, [user, page, limit, search, selectedModule, selectedRole, actionQuery, startDate, endDate]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAuditLogs();
  };

  const handleResetFilters = () => {
    setSearch("");
    setSelectedModule("ALL");
    setSelectedRole("ALL");
    setActionQuery("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const handleCopyJson = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleExport = async (format: "json" | "csv") => {
    try {
      setExporting(true);
      setExportMessage(null);
      const token = await user?.getIdToken();

      const body = {
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate + "T23:59:59").toISOString() : undefined,
        role: selectedRole !== "ALL" ? selectedRole : undefined,
        module: selectedModule !== "ALL" ? selectedModule : undefined,
        search: search.trim() || undefined,
        action: actionQuery.trim() || undefined,
        format
      };

      const res = await fetch("/api/admin/audit-logs/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || "Ekspor gagal diproses");
      }

      const exportLogs: AuditLog[] = data.data.logs || [];
      
      let blob: Blob;
      let filename = `istore-audit-logs-${new Date().toISOString().split("T")[0]}`;

      if (format === "csv") {
        const headers = ["ID", "Timestamp", "Actor Email", "Role", "Action", "Target", "Reason"];
        const rows = exportLogs.map(l => [
          `"${l.id || ""}"`,
          `"${l.timestamp || ""}"`,
          `"${l.actor?.email || ""}"`,
          `"${l.role || ""}"`,
          `"${l.action || ""}"`,
          `"${l.target || ""}"`,
          `"${(l.reason || "").replace(/"/g, '""')}"`
        ]);
        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        filename += ".csv";
      } else {
        blob = new Blob([JSON.stringify(data.data, null, 2)], { type: "application/json" });
        filename += ".json";
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportMessage({
        type: "success",
        text: `Berhasil mengekspor ${exportLogs.length} catatan audit (${format.toUpperCase()})`
      });

      // Refresh metrics after export
      fetchMetrics();
    } catch (err: any) {
      console.error("Export audit error:", err);
      setExportMessage({
        type: "error",
        text: err.message || "Gagal mengekspor data audit log"
      });
    } finally {
      setExporting(false);
      setTimeout(() => setExportMessage(null), 5000);
    }
  };

  const getActionBadgeColor = (action: string) => {
    const act = (action || "").toUpperCase();
    if (act.includes("DELETE") || act.includes("REMOVE") || act.includes("BLOCK") || act.includes("LOCK")) {
      return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
    }
    if (act.includes("ROLE") || act.includes("SECURITY") || act.includes("AUTH") || act.includes("CONFIG")) {
      return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800";
    }
    if (act.includes("REFUND") || act.includes("SETTLEMENT") || act.includes("PAYMENT") || act.includes("LEDGER")) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
    }
    if (act.includes("CREATE") || act.includes("INIT") || act.includes("ADD")) {
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
    }
    return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
  };

  const formatDateTime = (iso: string): { dateStr: string; timeStr: string } => {
    if (!iso) return { dateStr: "-", timeStr: "" };
    try {
      const date = new Date(iso);
      return {
        dateStr: date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
        timeStr: date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      };
    } catch {
      return { dateStr: iso, timeStr: "" };
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <History className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Audit Trail & System Logs
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pencatatan mutasi sistem, otentikasi, perizinan, finansial, dan konfigurasi secara permanen & append-only.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { fetchAuditLogs(); fetchMetrics(); }}
            disabled={loading}
            className="px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 inline-flex items-center gap-2 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            Segarkan
          </button>

          <div className="relative inline-flex rounded-lg shadow-sm">
            <button
              onClick={() => handleExport("json")}
              disabled={exporting || logs.length === 0}
              className="px-3.5 py-2 text-sm font-medium rounded-l-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Ekspor JSON
            </button>
            <button
              onClick={() => handleExport("csv")}
              disabled={exporting || logs.length === 0}
              className="px-3.5 py-2 text-sm font-medium rounded-r-lg border-t border-r border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition disabled:opacity-50"
            >
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Export Toast Alert */}
      {exportMessage && (
        <div className={`p-4 rounded-lg text-sm flex items-center gap-2.5 border ${
          exportMessage.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
            : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
        }`}>
          {exportMessage.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{exportMessage.text}</span>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {metricsLoading ? "..." : (metrics?.totalAudits ?? total)}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Riwayat Terekam</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {metricsLoading ? "..." : (metrics?.todayCount ?? 0)}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Aktivitas Hari Ini</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {metricsLoading ? "..." : (metrics?.actionCategories.find(c => c.category === "SYSTEM")?.count || 0)}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Sistem & Security Ops</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {metricsLoading ? "..." : (metrics?.actionCategories.find(c => c.category === "FINANCE")?.count || 0)}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Keuangan & Settlement</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search text */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Cari ID, aksi, target, email aktor, atau alasan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Module Selector */}
          <div>
            <select
              value={selectedModule}
              onChange={(e) => { setSelectedModule(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">Semua Modul</option>
              <option value="system">🛡️ SYSTEM & RBAC</option>
              <option value="finance">💰 FINANCE & RECON</option>
              <option value="commerce">🛍️ COMMERCE & ORDERS</option>
              <option value="marketing">📢 MARKETING & CMS</option>
              <option value="settings">⚙️ SETTINGS & STORE</option>
            </select>
          </div>

          {/* Role Selector */}
          <div>
            <select
              value={selectedRole}
              onChange={(e) => { setSelectedRole(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">Semua Peran</option>
              <option value="pemilik">👑 Pemilik (Owner)</option>
              <option value="admin">👨‍💼 Administrator</option>
              <option value="finance_admin">💵 Finance Admin</option>
              <option value="ops_admin">🛠️ Ops Admin</option>
              <option value="system">🤖 System Bot</option>
            </select>
          </div>

          {/* Search Button */}
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Filter className="w-4 h-4" />
              Terapkan
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              title="Reset Filter"
              className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            >
              Reset
            </button>
          </div>
        </form>

        {/* Date Filter Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Rentang Tanggal:</span>
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <span>s/d</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-500">Tampilkan:</span>
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value={10}>10 per hal</option>
              <option value={20}>20 per hal</option>
              <option value={50}>50 per hal</option>
              <option value={100}>100 per hal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {error && (
          <div className="p-6 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm text-slate-700 dark:text-slate-300">{error}</p>
            <button
              onClick={() => fetchAuditLogs()}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {!error && loading && (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Memuat catatan audit...</p>
          </div>
        )}

        {!error && !loading && logs.length === 0 && (
          <div className="p-12 text-center space-y-3">
            <History className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">Tidak ada catatan audit</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Tidak ditemukan catatan aktivitas yang sesuai dengan filter pencarian saat ini.
            </p>
            <button
              onClick={handleResetFilters}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Reset Filter
            </button>
          </div>
        )}

        {!error && !loading && logs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4">Waktu (WIB)</th>
                  <th className="py-3.5 px-4">Aktor & Role</th>
                  <th className="py-3.5 px-4">Aksi / Operasi</th>
                  <th className="py-3.5 px-4">Target Resource</th>
                  <th className="py-3.5 px-4">Alasan / Catatan</th>
                  <th className="py-3.5 px-4 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((log) => {
                  const { dateStr, timeStr } = formatDateTime(log.timestamp);
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition group cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{dateStr}</div>
                        <div className="text-xs text-slate-400 dark:text-slate-500">{timeStr}</div>
                      </td>

                      {/* Actor & Role */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]" title={log.actor?.email}>
                          {log.actor?.email || "system"}
                        </div>
                        <span className={`inline-block px-1.5 py-0.5 mt-0.5 text-[10px] font-medium rounded border ${
                          log.role === "pemilik" 
                            ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                            : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                        }`}>
                          {log.role}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-medium border ${getActionBadgeColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>

                      {/* Target */}
                      <td className="py-3.5 px-4 max-w-[240px]">
                        <div className="font-mono text-xs text-slate-600 dark:text-slate-300 truncate" title={log.target}>
                          {log.target || "-"}
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="py-3.5 px-4 max-w-[220px]">
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate" title={log.reason}>
                          {log.reason || "-"}
                        </div>
                      </td>

                      {/* Action Detail button */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 inline-flex items-center gap-1 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Forensik
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!error && !loading && logs.length > 0 && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
            <div>
              Menampilkan <span className="font-medium text-slate-900 dark:text-slate-100">{(page - 1) * limit + 1}</span> - <span className="font-medium text-slate-900 dark:text-slate-100">{Math.min(page * limit, total)}</span> dari <span className="font-medium text-slate-900 dark:text-slate-100">{total}</span> catatan
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2.5 py-1 font-medium text-slate-800 dark:text-slate-200">
                Halaman {page} dari {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Event Detail Forensic Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border ${getActionBadgeColor(selectedLog.action)}`}>
                    {selectedLog.action}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">ID: {selectedLog.id}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Detail Forensik Audit Log
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Context Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[11px] font-medium text-slate-400">Aktor & Role</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate" title={selectedLog.actor?.email}>
                    {selectedLog.actor?.email || "system"}
                  </div>
                  <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Peran: {selectedLog.role}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[11px] font-medium text-slate-400">Target Dokumen / URI</div>
                  <div className="text-xs font-mono text-slate-900 dark:text-slate-100 mt-0.5 break-all">
                    {selectedLog.target || "-"}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[11px] font-medium text-slate-400">Timestamp Server</div>
                  <div className="text-xs text-slate-900 dark:text-slate-100 mt-0.5">
                    {formatDateTime(selectedLog.timestamp).dateStr} {formatDateTime(selectedLog.timestamp).timeStr}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{selectedLog.timestamp}</div>
                </div>
              </div>

              {/* Reason / Context */}
              {selectedLog.reason && selectedLog.reason !== "-" && (
                <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50">
                  <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">Alasan / Konteks Operasional:</div>
                  <div className="text-xs text-amber-900 dark:text-amber-200 mt-1">{selectedLog.reason}</div>
                </div>
              )}

              {/* State Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Previous State */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                      Previous State (Before)
                    </div>
                    {selectedLog.before && (
                      <button
                        onClick={() => handleCopyJson(JSON.stringify(selectedLog.before, null, 2), "before")}
                        className="text-[11px] text-slate-500 hover:text-indigo-600 inline-flex items-center gap-1"
                      >
                        {copiedKey === "before" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        {copiedKey === "before" ? "Disalin" : "Salin JSON"}
                      </button>
                    )}
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-60 border border-slate-800">
                    {selectedLog.before ? (
                      <pre>{JSON.stringify(selectedLog.before, null, 2)}</pre>
                    ) : (
                      <span className="text-slate-500 italic">null (Entitas baru dibuat)</span>
                    )}
                  </div>
                </div>

                {/* New State */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      New State (After)
                    </div>
                    {selectedLog.after && (
                      <button
                        onClick={() => handleCopyJson(JSON.stringify(selectedLog.after, null, 2), "after")}
                        className="text-[11px] text-slate-500 hover:text-indigo-600 inline-flex items-center gap-1"
                      >
                        {copiedKey === "after" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        {copiedKey === "after" ? "Disalin" : "Salin JSON"}
                      </button>
                    )}
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-60 border border-slate-800">
                    {selectedLog.after ? (
                      <pre>{JSON.stringify(selectedLog.after, null, 2)}</pre>
                    ) : (
                      <span className="text-slate-500 italic">null (Entitas dihapus)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Immutability & Secret Sanitization Assurance Notice */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Jaminan Integritas & Sanitasi Data:</span> Rekaman audit ini bersifat append-only dan tidak dapat diubah oleh siapapun. Seluruh token rahasia, API key, dan kata sandi telah disanitasi secara otomatis sebelum ditampilkan di antarmuka.
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end bg-slate-50 dark:bg-slate-800/50">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
