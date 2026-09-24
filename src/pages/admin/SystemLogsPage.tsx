import React, { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "../../store/auth-store";
import {
  Terminal,
  Activity,
  AlertTriangle,
  AlertOctagon,
  Info,
  Bug,
  Search,
  Filter,
  RefreshCw,
  Download,
  Calendar,
  Clock,
  Server,
  Zap,
  Globe,
  CreditCard,
  Layers,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Eye,
  X,
  PlayCircle,
  Hash,
  Database,
  CheckCircle2,
  AlertCircle,
  Flame,
  FileCode
} from "lucide-react";
import { SystemLog, SystemLogLevel, SystemLogCategory } from "../../types/core";

interface SystemLogMetrics {
  totalLogs: number;
  todayCount: number;
  errorCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  debugCount: number;
  errorRatePercentage: number;
  categoryDistribution: { category: string; count: number }[];
  levelDistribution: { level: string; count: number }[];
  topFailingServices: { service: string; count: number }[];
  recentCriticalEvents: SystemLog[];
}

export default function SystemLogsPage() {
  const { user } = useAuthStore();

  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [metrics, setMetrics] = useState<SystemLogMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [metricsLoading, setMetricsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filter states
  const [search, setSearch] = useState<string>("");
  const [level, setLevel] = useState<SystemLogLevel | "ALL">("ALL");
  const [category, setCategory] = useState<SystemLogCategory | "ALL">("ALL");
  const [service, setService] = useState<string>("");
  const [provider, setProvider] = useState<string>("ALL");
  const [outcome, setOutcome] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Modal states
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showSimulateModal, setShowSimulateModal] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<"json" | "csv">("json");
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simulateForm, setSimulateForm] = useState<{
    level: SystemLogLevel;
    category: SystemLogCategory;
    event: string;
    message: string;
  }>({
    level: "INFO",
    category: "APPLICATION",
    event: "DIAGNOSTIC_HEALTH_CHECK",
    message: "Verifikasi integrasi runtime log oleh Owner"
  });

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setMetricsLoading(true);
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/system-logs/metrics", {
        headers: {
          Authorization: token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success) {
        setMetrics(data.data);
      }
    } catch (err: any) {
      console.error("Failed to fetch system log metrics:", err);
    } finally {
      setMetricsLoading(false);
    }
  }, [user]);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await user?.getIdToken();

      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", limit.toString());
      if (search) params.append("search", search);
      if (level !== "ALL") params.append("level", level);
      if (category !== "ALL") params.append("category", category);
      if (service) params.append("service", service);
      if (provider !== "ALL") params.append("provider", provider);
      if (outcome !== "ALL") params.append("outcome", outcome);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(`/api/admin/system-logs?${params.toString()}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : ""
        }
      });

      const data = await res.json();
      if (data.success) {
        setLogs(data.data.logs);
        setTotal(data.data.total);
        setTotalPages(data.data.totalPages);
      } else {
        setError(data.message || "Gagal memuat log sistem.");
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan jaringan saat memuat log sistem.");
    } finally {
      setLoading(false);
    }
  }, [user, page, limit, search, level, category, service, provider, outcome, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const handleCopy = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const token = await user?.getIdToken();

      const res = await fetch("/api/admin/system-logs/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          level: level !== "ALL" ? level : undefined,
          category: category !== "ALL" ? category : undefined,
          service: service || undefined,
          provider: provider !== "ALL" ? provider : undefined,
          search: search || undefined,
          format: exportFormat
        })
      });

      const data = await res.json();
      if (data.success) {
        const exportedLogs = data.data.logs;
        let content = "";
        let mimeType = "application/json";
        let fileName = `system-logs-${new Date().toISOString().slice(0, 10)}.json`;

        if (exportFormat === "json") {
          content = JSON.stringify(exportedLogs, null, 2);
        } else {
          mimeType = "text/csv;charset=utf-8;";
          fileName = `system-logs-${new Date().toISOString().slice(0, 10)}.csv`;
          const headers = ["Timestamp", "Level", "Category", "Event", "Service", "Outcome", "Message", "OrderId", "JobId", "RequestId"];
          const rows = exportedLogs.map((l: SystemLog) => [
            `"${l.timestamp}"`,
            `"${l.level}"`,
            `"${l.category}"`,
            `"${l.event}"`,
            `"${l.service}"`,
            `"${l.outcome || ""}"`,
            `"${(l.message || "").replace(/"/g, '""')}"`,
            `"${l.orderId || ""}"`,
            `"${l.jobId || ""}"`,
            `"${l.requestId || l.correlationId || ""}"`
          ]);
          content = [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setShowExportModal(false);
      } else {
        alert(data.message || "Gagal mengekspor log sistem.");
      }
    } catch (err: any) {
      alert("Kesalahan saat mengekspor: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleSimulateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSimulating(true);
      const token = await user?.getIdToken();

      const res = await fetch("/api/admin/system-logs/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(simulateForm)
      });

      const data = await res.json();
      if (data.success) {
        setShowSimulateModal(false);
        fetchLogs();
        fetchMetrics();
      } else {
        alert(data.message || "Gagal mencatat event diagnostik.");
      }
    } catch (err: any) {
      alert("Kesalahan simulasi: " + err.message);
    } finally {
      setSimulating(false);
    }
  };

  const getLevelBadge = (lvl: SystemLogLevel) => {
    switch (lvl) {
      case "CRITICAL":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950 text-red-300 border border-red-800 animate-pulse">
            <Flame className="w-3 h-3 text-red-400" />
            CRITICAL
          </span>
        );
      case "ERROR":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900/40 text-red-300 border border-red-800/60">
            <AlertOctagon className="w-3 h-3 text-red-400" />
            ERROR
          </span>
        );
      case "WARN":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-900/40 text-amber-300 border border-amber-800/60">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            WARN
          </span>
        );
      case "INFO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-900/40 text-sky-300 border border-sky-800/60">
            <Info className="w-3 h-3 text-sky-400" />
            INFO
          </span>
        );
      case "DEBUG":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
            <Bug className="w-3 h-3 text-slate-400" />
            DEBUG
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-300">
            {lvl}
          </span>
        );
    }
  };

  const getCategoryIcon = (cat: SystemLogCategory) => {
    switch (cat) {
      case "APPLICATION":
        return <Server className="w-3.5 h-3.5 text-indigo-400" />;
      case "API":
        return <Globe className="w-3.5 h-3.5 text-blue-400" />;
      case "PAYMENT":
        return <CreditCard className="w-3.5 h-3.5 text-emerald-400" />;
      case "PROVIDER":
        return <Zap className="w-3.5 h-3.5 text-amber-400" />;
      case "WEBHOOK":
        return <Activity className="w-3.5 h-3.5 text-purple-400" />;
      case "QUEUE":
        return <Layers className="w-3.5 h-3.5 text-cyan-400" />;
      case "FULFILLMENT":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case "SECURITY":
        return <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />;
      case "SYSTEM":
        return <Database className="w-3.5 h-3.5 text-zinc-400" />;
      default:
        return <Terminal className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  const getOutcomeBadge = (out?: string) => {
    if (!out) return null;
    switch (out) {
      case "SUCCESS":
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">SUCCESS</span>;
      case "FAILURE":
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-950/60 text-red-400 border border-red-800/50">FAILURE</span>;
      case "BLOCKED":
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-950/60 text-rose-400 border border-rose-800/50">BLOCKED</span>;
      case "PENDING":
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-950/60 text-amber-400 border border-amber-800/50">PENDING</span>;
      case "WARNING":
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-yellow-950/60 text-yellow-400 border border-yellow-800/50">WARNING</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-300">{out}</span>;
    }
  };

  return (
    <div id="system-logs-container" className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-emerald-400 shadow-sm">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h1 className="ui-page-title text-white">System Logs</h1>
              <p className="text-sm text-zinc-400">
                Pemantauan telemetri runtime, eksekusi API, webhook, dispatch provider, dan keamanan server.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-simulate-log"
            onClick={() => setShowSimulateModal(true)}
            className="px-3.5 py-2 text-xs font-medium rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <PlayCircle className="w-4 h-4 text-emerald-400" />
            Uji Diagnostik
          </button>
          <button
            id="btn-export-logs"
            onClick={() => setShowExportModal(true)}
            className="px-3.5 py-2 text-xs font-medium rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-sky-400" />
            Ekspor
          </button>
          <button
            id="btn-refresh-logs"
            onClick={() => {
              fetchLogs();
              fetchMetrics();
            }}
            disabled={loading}
            className="p-2 text-zinc-400 hover:text-white rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors disabled:opacity-50"
            title="Muat ulang"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Total Runtime Events</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {metricsLoading ? "..." : (metrics?.totalLogs ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Hari ini: <span className="text-zinc-300 font-medium">{metrics?.todayCount ?? 0}</span> event
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Error & Critical</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400">
            {metricsLoading ? "..." : ((metrics?.errorCount ?? 0) + (metrics?.criticalCount ?? 0))}
          </div>
          <div className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
            <span>Critical: {metrics?.criticalCount ?? 0}</span>
            <span>•</span>
            <span>Warning: {metrics?.warningCount ?? 0}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Failure Rate</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {metricsLoading ? "..." : `${metrics?.errorRatePercentage ?? 0}%`}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Persentase error terhadap total throughput
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Service Teratas</span>
            <Server className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-sm font-medium text-zinc-200 truncate">
            {metrics?.topFailingServices && metrics.topFailingServices.length > 0
              ? `${metrics.topFailingServices[0].service} (${metrics.topFailingServices[0].count} err)`
              : "Semua service stabil"}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Total kategori aktif: {metrics?.categoryDistribution?.length ?? 0}
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              id="input-system-log-search"
              type="text"
              placeholder="Cari pesan, event, ID pesanan, ID job, correlation..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>

          {/* Level Filter */}
          <div className="md:col-span-2">
            <select
              id="select-system-log-level"
              value={level}
              onChange={(e) => {
                setLevel(e.target.value as any);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
            >
              <option value="ALL">Semua Level</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="ERROR">ERROR</option>
              <option value="WARN">WARN</option>
              <option value="INFO">INFO</option>
              <option value="DEBUG">DEBUG</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="md:col-span-2">
            <select
              id="select-system-log-category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as any);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
            >
              <option value="ALL">Semua Kategori</option>
              <option value="APPLICATION">APPLICATION</option>
              <option value="API">API</option>
              <option value="PAYMENT">PAYMENT</option>
              <option value="PROVIDER">PROVIDER</option>
              <option value="WEBHOOK">WEBHOOK</option>
              <option value="QUEUE">QUEUE</option>
              <option value="FULFILLMENT">FULFILLMENT</option>
              <option value="SECURITY">SECURITY</option>
              <option value="SYSTEM">SYSTEM</option>
            </select>
          </div>

          {/* Outcome Filter */}
          <div className="md:col-span-2">
            <select
              id="select-system-log-outcome"
              value={outcome}
              onChange={(e) => {
                setOutcome(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
            >
              <option value="ALL">Semua Outcome</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILURE">FAILURE</option>
              <option value="BLOCKED">BLOCKED</option>
              <option value="PENDING">PENDING</option>
              <option value="WARNING">WARNING</option>
            </select>
          </div>

          {/* Page Limit */}
          <div className="md:col-span-2">
            <select
              id="select-system-log-limit"
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value));
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
            >
              <option value="10">10 per halaman</option>
              <option value="25">25 per halaman</option>
              <option value="50">50 per halaman</option>
              <option value="100">100 per halaman</option>
            </select>
          </div>
        </div>

        {/* Date Filter Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-800/60 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            <span>Rentang Tanggal:</span>
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-600"
          />
          <span>s/d</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 text-xs focus:outline-none focus:border-zinc-600"
          />
          {(startDate || endDate || search || level !== "ALL" || category !== "ALL" || outcome !== "ALL") && (
            <button
              onClick={() => {
                setSearch("");
                setLevel("ALL");
                setCategory("ALL");
                setService("");
                setProvider("ALL");
                setOutcome("ALL");
                setStartDate("");
                setEndDate("");
                setPage(1);
              }}
              className="text-xs text-emerald-400 hover:underline ml-auto flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchLogs}
            className="px-3 py-1 bg-red-900/60 hover:bg-red-800 rounded text-xs font-medium text-white transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Logs Table */}
      <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase border-b border-zinc-800 tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Waktu & Level</th>
                <th className="py-3 px-4 font-semibold">Kategori & Event</th>
                <th className="py-3 px-4 font-semibold">Service / Komponen</th>
                <th className="py-3 px-4 font-semibold">Pesan Log & Referensi</th>
                <th className="py-3 px-4 font-semibold">Outcome</th>
                <th className="py-3 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3.5 px-4"><div className="h-4 w-28 bg-zinc-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-24 bg-zinc-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-20 bg-zinc-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-64 bg-zinc-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-16 bg-zinc-800 rounded" /></td>
                    <td className="py-3.5 px-4 text-right"><div className="h-4 w-10 bg-zinc-800 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500 font-sans">
                    <Terminal className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                    <p className="text-sm font-medium text-zinc-400">Tidak ada log sistem yang cocok</p>
                    <p className="text-xs text-zinc-600 mt-1">Coba sesuaikan filter atau rentang tanggal pencarian.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => (
                  <tr
                    key={log.id || idx}
                    className="hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                    onClick={() => setSelectedLog(log)}
                  >
                    {/* Timestamp & Level */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <div>{getLevelBadge(log.level)}</div>
                        <div className="text-[11px] text-zinc-400 flex items-center gap-1 font-sans">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          <span className="text-[10px] text-zinc-600">({new Date(log.timestamp).toLocaleDateString()})</span>
                        </div>
                      </div>
                    </td>

                    {/* Category & Event */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-zinc-300 font-medium font-sans">
                          {getCategoryIcon(log.category)}
                          <span className="text-xs">{log.category}</span>
                        </div>
                        <span className="text-[11px] text-zinc-400 tracking-tight">{log.event}</span>
                      </div>
                    </td>

                    {/* Service */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="text-zinc-300 font-sans font-medium text-xs">
                        {log.service}
                      </div>
                      {log.provider && (
                        <div className="text-[10px] text-amber-400 mt-0.5">
                          prov: {log.provider}
                        </div>
                      )}
                    </td>

                    {/* Message & References */}
                    <td className="py-3 px-4 max-w-md">
                      <p className="text-xs text-zinc-200 font-sans line-clamp-2">{log.message}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-zinc-500">
                        {log.orderId && (
                          <span className="px-1.5 py-0.5 bg-zinc-950 rounded border border-zinc-800 text-sky-400">
                            order: {log.orderId}
                          </span>
                        )}
                        {log.jobId && (
                          <span className="px-1.5 py-0.5 bg-zinc-950 rounded border border-zinc-800 text-cyan-400">
                            job: {log.jobId}
                          </span>
                        )}
                        {log.requestId && (
                          <span className="px-1.5 py-0.5 bg-zinc-950 rounded border border-zinc-800 text-zinc-400">
                            req: {log.requestId}
                          </span>
                        )}
                        {log.durationMs !== undefined && (
                          <span className="px-1.5 py-0.5 bg-zinc-950 rounded border border-zinc-800 text-emerald-400">
                            {log.durationMs}ms
                          </span>
                        )}
                        {log.httpStatus !== undefined && (
                          <span className={`px-1.5 py-0.5 bg-zinc-950 rounded border ${log.httpStatus >= 400 ? "border-red-800 text-red-400" : "border-zinc-800 text-zinc-400"}`}>
                            HTTP {log.httpStatus}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Outcome */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getOutcomeBadge(log.outcome)}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                        title="Lihat Detail"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400 font-sans">
          <div>
            Menampilkan <span className="text-zinc-200 font-medium">{logs.length}</span> dari{" "}
            <span className="text-zinc-200 font-medium">{total}</span> total catatan log (Halaman {page} dari {totalPages})
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 font-mono">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Log Detail Drawer / Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                  <Terminal className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Detail System Log
                    {getLevelBadge(selectedLog.level)}
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono">
                    ID: {selectedLog.id || "N/A"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-zinc-300 font-sans">
              {/* Top Overview Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">Kategori</span>
                  <div className="text-sm font-medium text-white mt-0.5">{selectedLog.category}</div>
                </div>
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">Event</span>
                  <div className="text-sm font-medium text-white mt-0.5">{selectedLog.event}</div>
                </div>
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">Service</span>
                  <div className="text-sm font-medium text-white mt-0.5">{selectedLog.service}</div>
                </div>
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">Outcome</span>
                  <div className="mt-0.5">{getOutcomeBadge(selectedLog.outcome)}</div>
                </div>
              </div>

              {/* Message */}
              <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase font-semibold">Pesan Log</span>
                <p className="text-sm text-zinc-100 font-normal leading-relaxed">{selectedLog.message}</p>
              </div>

              {/* Correlation & Traceability Grid */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase">Konteks & Traceability</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
                  <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                    <span className="text-zinc-500">Timestamp:</span>
                    <span className="text-zinc-200">{selectedLog.timestamp}</span>
                  </div>

                  {selectedLog.requestId && (
                    <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                      <span className="text-zinc-500">Request ID:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-zinc-200 truncate max-w-[150px]">{selectedLog.requestId}</span>
                        <button
                          onClick={() => handleCopy(selectedLog.requestId!, "requestId")}
                          className="text-zinc-400 hover:text-white"
                        >
                          {copiedField === "requestId" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedLog.correlationId && (
                    <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                      <span className="text-zinc-500">Correlation ID:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-zinc-200 truncate max-w-[150px]">{selectedLog.correlationId}</span>
                        <button
                          onClick={() => handleCopy(selectedLog.correlationId!, "correlationId")}
                          className="text-zinc-400 hover:text-white"
                        >
                          {copiedField === "correlationId" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedLog.orderId && (
                    <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                      <span className="text-zinc-500">Order ID:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-sky-400 font-semibold">{selectedLog.orderId}</span>
                        <button
                          onClick={() => handleCopy(selectedLog.orderId!, "orderId")}
                          className="text-zinc-400 hover:text-white"
                        >
                          {copiedField === "orderId" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedLog.jobId && (
                    <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                      <span className="text-zinc-500">Job ID:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-cyan-400 font-semibold">{selectedLog.jobId}</span>
                        <button
                          onClick={() => handleCopy(selectedLog.jobId!, "jobId")}
                          className="text-zinc-400 hover:text-white"
                        >
                          {copiedField === "jobId" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedLog.provider && (
                    <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                      <span className="text-zinc-500">Provider:</span>
                      <span className="text-amber-400 font-semibold">{selectedLog.provider}</span>
                    </div>
                  )}

                  {selectedLog.httpStatus !== undefined && (
                    <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                      <span className="text-zinc-500">HTTP Status:</span>
                      <span className={selectedLog.httpStatus >= 400 ? "text-red-400 font-bold" : "text-emerald-400"}>
                        {selectedLog.httpStatus}
                      </span>
                    </div>
                  )}

                  {selectedLog.durationMs !== undefined && (
                    <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                      <span className="text-zinc-500">Latency Duration:</span>
                      <span className="text-zinc-200">{selectedLog.durationMs} ms</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-zinc-400 uppercase">Sanitized Safe Metadata</span>
                    <button
                      onClick={() => handleCopy(JSON.stringify(selectedLog.metadata, null, 2), "metaJson")}
                      className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                    >
                      {copiedField === "metaJson" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      Salin JSON
                    </button>
                  </div>
                  <pre className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Stack Trace */}
              {selectedLog.stackTrace && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-rose-400 uppercase flex items-center gap-1.5">
                      <FileCode className="w-4 h-4" />
                      Stack Trace (Sanitized)
                    </span>
                    <button
                      onClick={() => handleCopy(selectedLog.stackTrace!, "stackTrace")}
                      className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                    >
                      {copiedField === "stackTrace" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      Salin Stack
                    </button>
                  </div>
                  <pre className="p-3.5 rounded-lg bg-red-950/20 border border-red-900/40 text-[11px] font-mono text-red-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {selectedLog.stackTrace}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-950/60 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-sky-400" />
                Ekspor System Logs
              </h3>
              <button onClick={() => setShowExportModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Ekspor log runtime sistem berdasarkan filter yang aktif. Aktivitas ekspor ini akan dicatat ke dalam Audit Log untuk kepatuhan keamanan.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Format Berkas</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportFormat("json")}
                    className={`py-2 px-3 rounded-lg border text-center font-medium transition-colors ${
                      exportFormat === "json"
                        ? "bg-sky-950/60 border-sky-600 text-sky-300"
                        : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                    }`}
                  >
                    JSON (Lengkap)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat("csv")}
                    className={`py-2 px-3 rounded-lg border text-center font-medium transition-colors ${
                      exportFormat === "csv"
                        ? "bg-sky-950/60 border-sky-600 text-sky-300"
                        : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                    }`}
                  >
                    CSV (Tabel Spreadsheet)
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-3.5 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="px-4 py-2 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-500 disabled:opacity-50 flex items-center gap-1.5"
              >
                {exporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Unduh Berkas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulate Modal */}
      {showSimulateModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PlayCircle className="w-5 h-5 text-emerald-400" />
                Uji Coba Emisi Event Diagnostik
              </h3>
              <button onClick={() => setShowSimulateModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Kirim event uji coba ke pipeline System Logs untuk memverifikasi pencatatan runtime secara real-time.
            </p>

            <form onSubmit={handleSimulateLog} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Level Log</label>
                  <select
                    value={simulateForm.level}
                    onChange={(e) => setSimulateForm({ ...simulateForm, level: e.target.value as any })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-zinc-600"
                  >
                    <option value="INFO">INFO</option>
                    <option value="WARN">WARN</option>
                    <option value="ERROR">ERROR</option>
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="DEBUG">DEBUG</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Kategori</label>
                  <select
                    value={simulateForm.category}
                    onChange={(e) => setSimulateForm({ ...simulateForm, category: e.target.value as any })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-zinc-600"
                  >
                    <option value="APPLICATION">APPLICATION</option>
                    <option value="API">API</option>
                    <option value="PAYMENT">PAYMENT</option>
                    <option value="PROVIDER">PROVIDER</option>
                    <option value="WEBHOOK">WEBHOOK</option>
                    <option value="QUEUE">QUEUE</option>
                    <option value="FULFILLMENT">FULFILLMENT</option>
                    <option value="SECURITY">SECURITY</option>
                    <option value="SYSTEM">SYSTEM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Event Code</label>
                <input
                  type="text"
                  value={simulateForm.event}
                  onChange={(e) => setSimulateForm({ ...simulateForm, event: e.target.value })}
                  placeholder="e.g. DIAGNOSTIC_HEALTH_CHECK"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 font-mono text-xs focus:outline-none focus:border-zinc-600"
                  required
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Pesan Log</label>
                <textarea
                  rows={2}
                  value={simulateForm.message}
                  onChange={(e) => setSimulateForm({ ...simulateForm, message: e.target.value })}
                  placeholder="Deskripsi uji coba..."
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none focus:border-zinc-600"
                  required
                />
              </div>

              <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSimulateModal(false)}
                  className="px-3.5 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={simulating}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {simulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                  Kirim Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
