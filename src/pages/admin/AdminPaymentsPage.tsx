import React, { useEffect, useState } from "react";
import { useAuthStore } from "../../store/auth-store";
import { formatRupiah } from "../../lib/utils";
import { 
  Search, 
  Filter, 
  CreditCard, 
  Calendar, 
  User, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Eye, 
  X, 
  ExternalLink, 
  Lock, 
  RefreshCw, 
  Copy, 
  Check, 
  SlidersHorizontal,
  ChevronRight,
  Shield,
  Clock,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function AdminPaymentsPage() {
  const { user, can } = useAuthStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [transactionFilter, setTransactionFilter] = useState("all");
  
  // Selected Order for Detail View
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Administrative Override State
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [overridePaymentStatus, setOverridePaymentStatus] = useState("pending");
  const [overrideTransactionStatus, setOverrideTransactionStatus] = useState("pending");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const fetchOrders = async () => {
    setRefreshing(true);
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/orders?limit=200", {
        headers: {
          Authorization: token ? `Bearer ${token}` : ""
        }
      });
      if (!res.ok) {
        throw new Error("Gagal mengambil data log pembayaran.");
      }
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setOrders(json.data);
        setError(null);
      } else {
        throw new Error(json.message || "Gagal memuat log pembayaran.");
      }
    } catch (err: any) {
      console.error("Gagal mengambil data log pembayaran:", err);
      setError("Gagal memuat log pembayaran. Pastikan Anda memiliki akses administrator.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Client-side filtering & searching for maximum robustness and index error avoidance
  const filteredOrders = orders.filter(order => {
    // 1. Search Query
    const searchLower = searchQuery.toLowerCase();
    const matchesInvoice = order.invoice?.toLowerCase().includes(searchLower) || order.id?.toLowerCase().includes(searchLower);
    const matchesProductName = order.productName?.toLowerCase().includes(searchLower);
    const matchesVariantName = order.variantName?.toLowerCase().includes(searchLower);
    const matchesUserId = order.userId?.toLowerCase().includes(searchLower);
    
    // Customer Details search
    const customer = order.customerData || {};
    const matchesCustomerTarget = customer.target?.toLowerCase().includes(searchLower) || customer.zone?.toLowerCase().includes(searchLower);
    const matchesCustomerEmail = customer.email?.toLowerCase().includes(searchLower);
    const matchesCustomerPhone = customer.whatsapp?.toLowerCase().includes(searchLower) || customer.phone?.toLowerCase().includes(searchLower);
    
    const matchesSearch = !searchQuery || 
      matchesInvoice || 
      matchesProductName || 
      matchesVariantName || 
      matchesUserId || 
      matchesCustomerTarget || 
      matchesCustomerEmail || 
      matchesCustomerPhone;

    // 2. Payment Filter
    const matchesPayment = paymentFilter === "all" || order.paymentStatus === paymentFilter;

    // 3. Transaction Filter
    const matchesTransaction = transactionFilter === "all" || order.transactionStatus === transactionFilter;

    return matchesSearch && matchesPayment && matchesTransaction;
  });

  // Calculate stats from filtered or raw data
  const stats = {
    total: orders.length,
    revenue: orders.reduce((sum, o) => o.paymentStatus === "paid" ? sum + (o.totalAmount || 0) : sum, 0),
    paidCount: orders.filter(o => o.paymentStatus === "paid").length,
    pendingCount: orders.filter(o => o.paymentStatus === "pending").length,
    failedCount: orders.filter(o => o.paymentStatus === "failed" || o.paymentStatus === "expired").length,
  };

  // Execute manual administrative override using server-side security authorization endpoint
  const handleStateOverride = async () => {
    if (!selectedOrder) return;
    if (!overrideReason.trim()) {
      setOverrideError("Alasan perubahan status wajib diisi.");
      return;
    }

    setOverrideLoading(true);
    setOverrideError(null);

    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}/override`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          paymentStatus: overridePaymentStatus,
          transactionStatus: overrideTransactionStatus,
          reason: overrideReason
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Success
        setIsOverrideOpen(false);
        setOverrideReason("");
        // Re-fetch orders to reflect the update
        await fetchOrders();
        // Update selected order view
        const updatedOrder = orders.find(o => o.id === selectedOrder.id);
        if (updatedOrder) {
          setSelectedOrder({
            ...selectedOrder,
            paymentStatus: overridePaymentStatus,
            transactionStatus: overrideTransactionStatus,
            updatedAt: new Date().toISOString()
          });
        } else {
          setIsDetailOpen(false);
        }
      } else {
        setOverrideError(data.message || "Gagal mengubah status pesanan secara manual.");
      }
    } catch (err: any) {
      setOverrideError(err.message || "Terjadi kesalahan koneksi.");
    } finally {
      setOverrideLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "paid":
      case "success":
      case "settled":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Paid
          </span>
        );
      case "pending":
      case "pending_payment":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </span>
        );
      case "failed":
      case "deny":
      case "cancel":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="w-3.5 h-3.5" />
            Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <AlertCircle className="w-3.5 h-3.5" />
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
        minute: "2-digit",
        second: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="ui-page-title text-slate-900">Log Pembayaran & Transaksi</h1>
          <p className="text-slate-500 mt-1">Pantau rincian rekonsiliasi, detail pesanan, dan siklus transaksi iStore secara *real-time*.</p>
        </div>
        <button 
          onClick={fetchOrders}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl transition-all shadow-sm font-semibold text-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          <span>{refreshing ? "Memperbarui..." : "Segarkan"}</span>
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-rose-800">{error}</p>
        </div>
      )}

      {/* Financial Overview stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Pesanan</p>
            <p className="text-2xl font-black text-slate-900">{stats.total}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Penerimaan</p>
            <p className="text-2xl font-black text-emerald-600">{formatRupiah(stats.revenue)}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Menunggu Pembayaran</p>
            <p className="text-2xl font-black text-amber-600">{stats.pendingCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gagal / Expired</p>
            <p className="text-2xl font-black text-slate-600">{stats.failedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main filter container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Controls Bar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari berdasarkan Invoice, Email, WhatsApp, Game ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter:</span>
            </div>
            
            {/* Payment Status Dropdown */}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 outline-none focus:border-blue-500 transition-all cursor-pointer"
            >
              <option value="all">Semua Pembayaran</option>
              <option value="pending">Status: Pending</option>
              <option value="paid">Status: Paid</option>
              <option value="expired">Status: Expired</option>
              <option value="failed">Status: Failed</option>
            </select>

            {/* Transaction Status Dropdown */}
            <select
              value={transactionFilter}
              onChange={(e) => setTransactionFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 outline-none focus:border-blue-500 transition-all cursor-pointer"
            >
              <option value="all">Semua Transaksi Provider</option>
              <option value="pending">Provider: Pending</option>
              <option value="success">Provider: Success</option>
              <option value="failed">Provider: Failed</option>
            </select>
          </div>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="p-16 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-sm text-slate-500 font-medium">Memuat pesanan dan log pembayaran...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <CreditCard className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Tidak ada transaksi ditemukan</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Kami tidak dapat menemukan kecocokan transaksi untuk pencarian atau filter yang Anda terapkan.</p>
          </div>
        ) : (
          /* Payment Log Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/20">
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Invoice / ID</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Pelanggan & Target</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Produk</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Nominal</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Status Bayar</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Status Kirim</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Waktu</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 font-mono">
                          {order.invoice || order.id?.substring(0, 10)}
                        </span>
                        <button 
                          onClick={() => handleCopy(order.invoice || order.id, order.id)}
                          className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                          title="Salin ID Invoice"
                        >
                          {copiedId === order.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        {order.id}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm font-semibold text-slate-900">
                        {order.customerData?.target || "No-Target"} 
                        {order.customerData?.zone && <span className="text-slate-400 text-xs font-normal"> ({order.customerData.zone})</span>}
                      </div>
                      <div className="text-xs text-slate-500 flex flex-col mt-0.5">
                        <span>{order.customerData?.email || order.userId || "guest"}</span>
                        {order.customerData?.whatsapp && (
                          <span className="text-[10px] text-slate-400">{order.customerData.whatsapp}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm font-semibold text-slate-900 truncate max-w-[180px]">
                        {order.productName || "Product"}
                      </div>
                      <span className="text-xs text-slate-500 block mt-0.5">
                        {order.variantName || "Variant"}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="text-sm font-black text-slate-900">
                        {formatRupiah(order.totalAmount || 0)}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Biaya: {formatRupiah(order.adminFee || 0)}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {getStatusBadge(order.paymentStatus)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {getStatusBadge(order.transactionStatus)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="text-xs text-slate-600 font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {formatDate(order.createdAt).split(",")[0]}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-300" />
                        {formatDate(order.createdAt).split(",")[1]?.trim() || "-"}
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <button 
                        onClick={() => {
                          setSelectedOrder(order);
                          setIsDetailOpen(true);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction Detail Drawer Component */}
      <AnimatePresence>
        {isDetailOpen && selectedOrder && (
          <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => {
                if (!isOverrideOpen) setIsDetailOpen(false);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            <div className="absolute inset-y-0 right-0 max-w-full pl-10 flex">
              <motion.div 
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="w-screen max-w-xl bg-white shadow-2xl flex flex-col justify-between"
              >
                {/* Drawer Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">Rincian Transaksi</h2>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">Invoice: {selectedOrder.invoice || selectedOrder.id}</p>
                  </div>
                  <button 
                    onClick={() => setIsDetailOpen(false)}
                    className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Drawer Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Status Block */}
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Status Pembayaran</p>
                      {getStatusBadge(selectedOrder.paymentStatus)}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Status Pengiriman</p>
                      {getStatusBadge(selectedOrder.transactionStatus)}
                    </div>
                  </div>

                  {/* Customer Information */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-500" />
                      Informasi Pelanggan
                    </h3>
                    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Target ID</span>
                        <span className="font-bold text-slate-800">{selectedOrder.customerData?.target || "-"}</span>
                      </div>
                      {selectedOrder.customerData?.zone && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Zone ID</span>
                          <span className="font-bold text-slate-800">{selectedOrder.customerData.zone}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-400">Email Pelanggan</span>
                        <span className="font-semibold text-slate-800">{selectedOrder.customerData?.email || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">ID Pengguna</span>
                        <span className="font-semibold text-slate-800 font-mono text-xs">{selectedOrder.userId || "guest"}</span>
                      </div>
                      {selectedOrder.customerData?.whatsapp && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">No. WhatsApp</span>
                          <span className="font-semibold text-slate-800">{selectedOrder.customerData.whatsapp}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Product Details & Items */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                      Rincian Produk
                    </h3>
                    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-800">{selectedOrder.productName || "Product"}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{selectedOrder.variantName || "Variant"}</p>
                        </div>
                        <span className="px-2.5 py-1 bg-slate-50 text-slate-700 font-bold rounded-lg text-xs border border-slate-200">
                          Qty: {selectedOrder.quantity || 1}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pricing Snapshot breakdown */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-slate-500" />
                      Detail Tagihan & Biaya
                    </h3>
                    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Harga Jual</span>
                        <span className="font-medium text-slate-800">
                          {formatRupiah((selectedOrder.totalAmount || 0) - (selectedOrder.adminFee || 0))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Biaya Administrasi</span>
                        <span className="font-medium text-slate-800">{formatRupiah(selectedOrder.adminFee || 0)}</span>
                      </div>
                      {selectedOrder.discount > 0 && (
                        <div className="flex justify-between text-rose-600">
                          <span>Diskon</span>
                          <span>-{formatRupiah(selectedOrder.discount)}</span>
                        </div>
                      )}
                      <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                        <span className="font-bold text-slate-900">Total Nominal</span>
                        <span className="text-base font-extrabold text-blue-600">
                          {formatRupiah(selectedOrder.totalAmount || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Integration Metadata */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      Meta Data & Integrasi
                    </h3>
                    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Provider ID</span>
                        <span className="font-bold text-slate-700">{selectedOrder.providerId || "manual"}</span>
                      </div>
                      {selectedOrder.providerSku && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">SKU Provider</span>
                          <span className="font-bold text-slate-700">{selectedOrder.providerSku}</span>
                        </div>
                      )}
                      {selectedOrder.routingDecisionCode && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Routing Code</span>
                          <span className="font-bold text-slate-700">{selectedOrder.routingDecisionCode}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-400">Dibuat</span>
                        <span className="font-medium text-slate-700">{formatDate(selectedOrder.createdAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Diperbarui</span>
                        <span className="font-medium text-slate-700">{formatDate(selectedOrder.updatedAt)}</span>
                      </div>
                      {selectedOrder.snapToken && (
                        <div className="flex flex-col gap-1 border-t border-slate-100 pt-2.5">
                          <span className="text-slate-400 text-[10px]">Snap Token</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="bg-slate-50 p-1.5 rounded-lg border border-slate-100 font-mono text-[10px] text-slate-700 flex-1 truncate">
                              {selectedOrder.snapToken}
                            </span>
                            <button 
                              onClick={() => handleCopy(selectedOrder.snapToken, "token-detail")}
                              className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-700 transition-all shrink-0"
                            >
                              {copiedId === "token-detail" ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                      {selectedOrder.paymentUrl && (
                        <div className="pt-2">
                          <a 
                            href={selectedOrder.paymentUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-semibold text-xs font-sans"
                          >
                            <span>Buka Halaman Pembayaran Snap</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Administrative Override trigger area */}
                  {can("orders", "edit") ? (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-3">
                      <div className="flex items-center gap-2 text-amber-800">
                        <Shield className="w-5 h-5" />
                        <h4 className="font-bold text-sm">Administrative Override</h4>
                      </div>
                      <p className="text-xs text-amber-700">
                        Sebagai pemilik atau staf dengan hak akses khusus, Anda diizinkan untuk mengubah status pesanan ini secara manual. Gunakan ini hanya untuk rekonsiliasi manual!
                      </p>
                      
                      {!isOverrideOpen ? (
                        <button 
                          onClick={() => {
                            setOverridePaymentStatus(selectedOrder.paymentStatus || "pending");
                            setOverrideTransactionStatus(selectedOrder.transactionStatus || "pending");
                            setIsOverrideOpen(true);
                          }}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <span>Mulai Perubahan Status Manual</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <div className="bg-white p-4 rounded-xl border border-amber-100 space-y-4 animate-in slide-in-from-top-2 duration-250">
                          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                            <span className="text-xs font-extrabold text-slate-800">Ubah Status Pesanan</span>
                            <button 
                              onClick={() => {
                                setIsOverrideOpen(false);
                                setOverrideError(null);
                              }}
                              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          {overrideError && (
                            <p className="text-xs text-rose-600 font-semibold p-2 bg-rose-50 border border-rose-100 rounded-lg">
                              {overrideError}
                            </p>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Status Pembayaran</label>
                              <select 
                                value={overridePaymentStatus}
                                onChange={(e) => setOverridePaymentStatus(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-amber-500"
                              >
                                <option value="pending">pending</option>
                                <option value="paid">paid</option>
                                <option value="expired">expired</option>
                                <option value="failed">failed</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Status Pengiriman</label>
                              <select 
                                value={overrideTransactionStatus}
                                onChange={(e) => setOverrideTransactionStatus(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-amber-500"
                              >
                                <option value="pending">pending</option>
                                <option value="success">success</option>
                                <option value="failed">failed</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Alasan Perubahan (Audit Trail)</label>
                            <textarea 
                              placeholder="Contoh: Bukti transfer manual terverifikasi / Koreksi double transaction"
                              value={overrideReason}
                              onChange={(e) => setOverrideReason(e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:border-amber-500"
                            />
                          </div>

                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                setIsOverrideOpen(false);
                                setOverrideError(null);
                              }}
                              className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                            >
                              Batal
                            </button>
                            <button 
                              onClick={handleStateOverride}
                              disabled={overrideLoading}
                              className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              {overrideLoading ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                "Simpan"
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3 text-slate-500">
                      <Lock className="w-5 h-5 shrink-0 text-slate-400 mt-0.5" />
                      <p className="text-xs leading-relaxed">
                        Anda tidak memiliki hak akses khusus (`orders:edit`) untuk melakukan perubahan manual pada pesanan ini.
                      </p>
                    </div>
                  )}
                </div>

                {/* Drawer Footer */}
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
    </div>
  );
}
