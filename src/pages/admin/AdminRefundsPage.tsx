import React, { useEffect, useState } from "react";
import { useAuthStore } from "../../store/auth-store";
import { formatRupiah } from "../../lib/utils";
import { 
  Search, 
  Filter, 
  RefreshCw, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  ArrowRight, 
  Plus, 
  X, 
  Calendar, 
  User, 
  SlidersHorizontal, 
  Eye, 
  Copy, 
  Check, 
  HelpCircle, 
  FileText, 
  TrendingUp, 
  AlertTriangle,
  Lock,
  ArrowLeftRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function AdminRefundsPage() {
  const { user, can, loading: authLoading } = useAuthStore();
  const [refunds, setRefunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Selected Refund & Order details for Drawer
  const [selectedRefund, setSelectedRefund] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [orderDetail, setOrderDetail] = useState<any | null>(null);
  const [orderRefunds, setOrderRefunds] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Create Refund Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formOrderId, setFormOrderId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formRefundKey, setFormRefundKey] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchRefunds = async () => {
    setRefreshing(true);
    try {
      const token = await (user as any)?.getIdToken?.();
      const response = await fetch("/api/admin/refunds", {
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      if (!response.ok) {
        throw new Error("Gagal mengambil data refund dari server.");
      }
      const result = await response.json();
      setRefunds(result.data);
      setError(null);
    } catch (err: any) {
      console.error("Gagal memuat log refund:", err);
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        fetchRefunds();
      } else {
        setLoading(false);
      }
    }
  }, [authLoading, user]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Pulls original order and sibling refunds to calculate financial metrics in detail drawer
  const loadRefundDetailAndOrder = async (refund: any) => {
    setLoadingDetail(true);
    setOrderDetail(null);
    setOrderRefunds([]);
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/orders/${refund.orderId}`, {
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      if (res.ok) {
        const result = await res.json();
        if (result.order) {
          setOrderDetail(result.order);
        }
        if (Array.isArray(result.refunds)) {
          setOrderRefunds(result.refunds);
        }
      }
    } catch (err) {
      console.error("Gagal memuat data order/detail pendukung:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (selectedRefund) {
      loadRefundDetailAndOrder(selectedRefund);
    }
  }, [selectedRefund]);

  // Client-side filtering & searching for responsiveness and stability
  const filteredRefunds = refunds.filter(ref => {
    const searchLower = searchQuery.toLowerCase();
    const matchesId = ref.refundId?.toLowerCase().includes(searchLower) || ref.id?.toLowerCase().includes(searchLower);
    const matchesKey = ref.refundKey?.toLowerCase().includes(searchLower);
    const matchesOrder = ref.orderId?.toLowerCase().includes(searchLower);
    const matchesReason = ref.reason?.toLowerCase().includes(searchLower);

    const matchesSearch = !searchQuery || matchesId || matchesKey || matchesOrder || matchesReason;
    const matchesStatus = statusFilter === "all" || ref.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Dynamic Dashboard Stats directly derived from live dataset
  const stats = {
    totalCount: refunds.length,
    succeededCount: refunds.filter(r => r.status === "SUCCEEDED").length,
    processingCount: refunds.filter(r => r.status === "PROCESSING" || r.status === "PENDING").length,
    failedCount: refunds.filter(r => r.status === "FAILED").length,
    totalSucceededAmount: refunds.reduce((sum, r) => r.status === "SUCCEEDED" ? sum + (r.amount || 0) : sum, 0),
  };

  // Financial calculations for Selected Order Drawer
  const orderFinancials = () => {
    if (!orderDetail) return null;
    const originalPaid = orderDetail.totalAmount || 0;
    
    const succeededRefunds = orderRefunds.filter(r => r.status === "SUCCEEDED");
    const totalSucceededRefunded = succeededRefunds.reduce((sum, r) => sum + (r.amount || 0), 0);

    const activeProcessingRefunds = orderRefunds.filter(r => r.status === "PROCESSING" || r.status === "PENDING");
    const totalProcessingRefunded = activeProcessingRefunds.reduce((sum, r) => sum + (r.amount || 0), 0);

    const remainingRefundable = originalPaid - totalSucceededRefunded - totalProcessingRefunded;

    return {
      originalPaid,
      totalSucceededRefunded,
      totalProcessingRefunded,
      remainingRefundable
    };
  };

  const handleCreateRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formOrderId.trim()) {
      setCreateError("ID Pesanan wajib diisi.");
      return;
    }
    const parsedAmount = parseInt(formAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setCreateError("Nominal refund harus berupa angka bulat positif.");
      return;
    }
    if (!formReason.trim()) {
      setCreateError("Alasan refund wajib dicantumkan.");
      return;
    }

    setCreateLoading(true);
    setCreateError(null);

    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/refunds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          orderId: formOrderId.trim(),
          amount: parsedAmount,
          reason: formReason.trim(),
          refundKey: formRefundKey.trim() || undefined
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsCreateModalOpen(false);
        setFormOrderId("");
        setFormAmount("");
        setFormReason("");
        setFormRefundKey("");
        await fetchRefunds();
      } else {
        setCreateError(data.message || "Gagal memproses pengembalian dana.");
      }
    } catch (err: any) {
      setCreateError(err.message || "Terjadi kesalahan koneksi saat memanggil API.");
    } finally {
      setCreateLoading(false);
    }
  };

  const generateRandomRefundKey = () => {
    const rand = Math.random().toString(36).substring(2, 10);
    setFormRefundKey(`ref_manual_${rand}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case "SUCCEEDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Succeeded
          </span>
        );
      case "PROCESSING":
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Processing
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <HelpCircle className="w-3.5 h-3.5" />
            {status || "Unknown"}
          </span>
        );
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleString("id-ID", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Manajemen Pengembalian Dana (Refund)</h1>
          <p className="text-slate-500 mt-1">Kelola permohonan, riwayat pencatatan, dan mutasi saldo refund transaksi secara terpusat.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchRefunds}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl transition-all shadow-sm font-semibold text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            <span>Segarkan</span>
          </button>
          
          {can("finance", "edit") && (
            <button
              onClick={() => {
                setCreateError(null);
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition-all shadow-md font-bold text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Refund Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-rose-800">{error}</p>
        </div>
      )}

      {/* Overview Analytics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Total Refund</p>
            <p className="text-2xl font-black text-slate-900">{stats.totalCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-100">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between col-span-1 lg:col-span-2">
          <div className="space-y-1">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Total Nominal Sukses</p>
            <p className="text-2xl font-black text-emerald-600">{formatRupiah(stats.totalSucceededAmount)}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Sedang Diproses</p>
            <p className="text-2xl font-black text-amber-600">{stats.processingCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Pengajuan Gagal</p>
            <p className="text-2xl font-black text-rose-600">{stats.failedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Filter and Table area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Controls Bar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/40 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari berdasarkan Refund ID, Refund Key, ID Pesanan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all text-sm font-medium"
            />
          </div>

          <div className="flex items-center gap-3">
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="SUCCEEDED">Status: Succeeded</option>
              <option value="PROCESSING">Status: Processing</option>
              <option value="FAILED">Status: Failed</option>
            </select>
          </div>
        </div>

        {/* List Content */}
        {loading ? (
          <div className="p-16 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-sm text-slate-500 font-medium">Memuat log pengembalian dana...</p>
          </div>
        ) : filteredRefunds.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center mx-auto mb-4">
              <ArrowLeftRight className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Tidak ada pengajuan ditemukan</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Tidak ada rekaman transaksi refund yang sesuai dengan filter pencarian Anda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/20">
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Refund ID / Key</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">ID Pesanan</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Nominal</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Provider</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Dibuat Oleh</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Tanggal</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRefunds.map((ref) => (
                  <tr key={ref.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-900 font-mono">
                        {ref.refundId?.substring(0, 16)}...
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        Key: {ref.refundKey}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-slate-700 font-mono">
                        {ref.orderId}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-sm font-extrabold text-slate-900">
                        {formatRupiah(ref.amount || 0)}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-600 rounded-lg uppercase">
                        {ref.provider || "midtrans"}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {getStatusBadge(ref.status)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-xs font-medium text-slate-600 font-mono">
                        {ref.requestedBy?.substring(0, 8) || "system"}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="text-xs text-slate-600 font-medium">
                        {formatDate(ref.createdAt).split(",")[0]}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                        {formatDate(ref.createdAt).split(",")[1]?.trim() || "-"}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <button 
                        onClick={() => {
                          setSelectedRefund(ref);
                          setIsDetailOpen(true);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Rincian
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Refund Detail Drawer Component */}
      <AnimatePresence>
        {isDetailOpen && selectedRefund && (
          <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            <div className="absolute inset-y-0 right-0 max-w-full pl-10 flex">
              <motion.div 
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 26, stiffness: 210 }}
                className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between"
              >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">Rincian Pengembalian</h2>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {selectedRefund.refundId}</p>
                  </div>
                  <button 
                    onClick={() => setIsDetailOpen(false)}
                    className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Status Block */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status Mutasi</span>
                    {getStatusBadge(selectedRefund.status)}
                  </div>

                  {/* Refund Core Information */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-slate-400" />
                      Detail Dokumen
                    </h3>
                    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">ID Dokumen</span>
                        <span className="font-bold text-slate-800 font-mono text-xs">{selectedRefund.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Kunci Idempotensi</span>
                        <span className="font-semibold text-slate-800 font-mono text-xs">{selectedRefund.refundKey}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Alasan Pengembalian</span>
                        <span className="font-semibold text-slate-800 text-right">{selectedRefund.reason}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Permintaan Oleh</span>
                        <span className="font-medium text-slate-700 font-mono text-xs">{selectedRefund.requestedBy}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Tanggal Diajukan</span>
                        <span className="font-medium text-slate-700">{formatDate(selectedRefund.createdAt)}</span>
                      </div>
                      {selectedRefund.processedAt && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Selesai Diproses</span>
                          <span className="font-medium text-slate-700">{formatDate(selectedRefund.processedAt)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial Reconciliation Audit */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-slate-400" />
                      Pemeriksaan Rekonsiliasi
                    </h3>
                    
                    {loadingDetail ? (
                      <div className="p-4 bg-slate-50 rounded-2xl text-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-[10px] text-slate-400 mt-1">Mengambil rincian finansial order...</p>
                      </div>
                    ) : orderDetail ? (
                      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">ID Pesanan</span>
                          <span className="font-mono text-xs font-bold text-slate-800">{orderDetail.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Produk</span>
                          <span className="font-semibold text-slate-800">{orderDetail.productName || "Produk"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Original Paid Amount</span>
                          <span className="font-bold text-slate-800">{formatRupiah(orderFinancials()?.originalPaid || 0)}</span>
                        </div>
                        <div className="flex justify-between text-rose-600">
                          <span className="text-slate-400">Total Succeeded Refunded</span>
                          <span className="font-bold">-{formatRupiah(orderFinancials()?.totalSucceededRefunded || 0)}</span>
                        </div>
                        {orderFinancials()?.totalProcessingRefunded > 0 && (
                          <div className="flex justify-between text-amber-600">
                            <span className="text-slate-400">Active Reservation Lock</span>
                            <span className="font-semibold">-{formatRupiah(orderFinancials()?.totalProcessingRefunded || 0)}</span>
                          </div>
                        )}
                        <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                          <span className="font-bold text-slate-900">Remaining Refundable</span>
                          <span className="text-sm font-black text-blue-600">
                            {formatRupiah(orderFinancials()?.remainingRefundable || 0)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-700">
                        Gagal mengaitkan data finansial order. Pastikan dokumen order `{selectedRefund.orderId}` masih ada di database.
                      </div>
                    )}
                  </div>

                  {/* Provider Meta-Data */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowLeftRight className="w-4 h-4 text-slate-400" />
                      Metadata Provider (Midtrans)
                    </h3>
                    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Provider Name</span>
                        <span className="font-bold text-slate-700 uppercase">{selectedRefund.provider || "midtrans"}</span>
                      </div>
                      {selectedRefund.providerRefundId && (
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-sans">Provider Refund ID</span>
                          <span className="font-bold text-slate-800">{selectedRefund.providerRefundId}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Failure Logs if present */}
                  {selectedRefund.status === "FAILED" && (
                    <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-2">
                      <div className="flex items-center gap-1.5 text-rose-800">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <h4 className="font-bold text-xs">Informasi Kegagalan</h4>
                      </div>
                      <div className="text-xs text-rose-700 space-y-1">
                        <p><span className="font-bold">Failure Code:</span> {selectedRefund.failureCode || "UNKNOWN_ERROR"}</p>
                        <p><span className="font-bold">Failure Message:</span> {selectedRefund.failureMessage || "Midtrans API rejected or connection interrupted."}</p>
                        <p className="text-[10px] text-rose-500 italic mt-1">Sesuai kontrak keamanan iStore, untuk melakukan retry permohonan ini, Anda diwajibkan menggunakan Kunci Refund baru.</p>
                      </div>
                    </div>
                  )}

                  {/* Warnings for processing states */}
                  {(selectedRefund.status === "PROCESSING" || selectedRefund.status === "PENDING") && (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
                      <div className="flex items-center gap-1.5 text-amber-800">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <h4 className="font-bold text-xs">Peringatan Transaksi Aktif</h4>
                      </div>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        Pengembalian dana ini masih berstatus <strong>PROCESSING</strong> di tingkat provider. Jangan mengirimkan permohonan baru dengan nominal atau kunci baru hingga proses rekonsiliasi selesai demi menghindari transaksi ganda.
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50">
                  <button 
                    onClick={() => setIsDetailOpen(false)}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold transition-all shadow-sm"
                  >
                    Tutup
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Refund Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden" role="dialog" aria-modal="true">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!createLoading) setIsCreateModalOpen(false);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden relative z-10 border border-slate-100"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-extrabold text-slate-900">Ajukan Refund Baru</h3>
                </div>
                <button 
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={createLoading}
                  className="p-1 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Area */}
              <form onSubmit={handleCreateRefund} className="p-6 space-y-4">
                {createError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-semibold text-rose-700 flex items-start gap-2 animate-in fade-in duration-200">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{createError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ID Pesanan (Order ID / Invoice)</label>
                  <input 
                    type="text"
                    required
                    placeholder="Contoh: ord123abc456"
                    value={formOrderId}
                    onChange={(e) => setFormOrderId(e.target.value)}
                    disabled={createLoading}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-blue-500 transition-all font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nominal Pengembalian (IDR)</label>
                  <input 
                    type="number"
                    required
                    placeholder="Contoh: 15000"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    disabled={createLoading}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black outline-none focus:bg-white focus:border-blue-500 transition-all font-mono text-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Alasan Pengembalian</label>
                  <textarea 
                    required
                    placeholder="Contoh: Pembatalan pesanan karena stok provider kosong"
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    rows={2}
                    disabled={createLoading}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kunci Idempotensi (Opsional)</label>
                    <button 
                      type="button"
                      onClick={generateRandomRefundKey}
                      disabled={createLoading}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800"
                    >
                      Acak Kunci
                    </button>
                  </div>
                  <input 
                    type="text"
                    placeholder="Biarkan kosong jika ingin dibuat otomatis"
                    value={formRefundKey}
                    onChange={(e) => setFormRefundKey(e.target.value)}
                    disabled={createLoading}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:bg-white focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-2.5 mt-2">
                  <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] leading-relaxed text-blue-800">
                    <strong>PEMBERITAHUAN KEAMANAN:</strong> Tindakan ini akan secara nyata memicu pengajuan pengembalian saldo di server Midtrans. Seluruh nominal sisa akan divalidasi silang oleh database sebelum dieksekusi.
                  </p>
                </div>

                <div className="flex gap-3 pt-3 border-t border-slate-100">
                  <button 
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    disabled={createLoading}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={createLoading}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {createLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      "Kirim Pengajuan"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
