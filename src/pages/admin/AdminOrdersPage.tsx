import React, { useState, useEffect } from "react";
import { 
  ShoppingCart, Search, Filter, Eye, RefreshCw, CheckCircle2, 
  XCircle, Clock, AlertTriangle, ShieldCheck, FileText, ChevronRight 
} from "lucide-react";
import { useAuthStore } from "../../store/auth-store";
import { formatRupiah } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [transactionFilter, setTransactionFilter] = useState("all");
  
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orderDetail, setOrderDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [targetState, setTargetState] = useState("SUCCESS");
  const [actionLoading, setActionLoading] = useState(false);

  const { user } = useAuthStore();

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const idToken = await user?.getIdToken();
      const queryParams = new URLSearchParams();
      if (search) queryParams.append("search", search);
      if (paymentFilter !== "all") queryParams.append("paymentStatus", paymentFilter);
      if (transactionFilter !== "all") queryParams.append("transactionStatus", transactionFilter);

      const res = await fetch(`/api/admin/orders?${queryParams.toString()}`, {
        headers: { "Authorization": `Bearer ${idToken}` }
      });
      const result = await res.json();
      if (result.success) {
        setOrders(result.data);
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [paymentFilter, transactionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  const fetchOrderDetail = async (orderId: string) => {
    try {
      setLoadingDetail(true);
      const idToken = await user?.getIdToken();
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        headers: { "Authorization": `Bearer ${idToken}` }
      });
      const result = await res.json();
      if (result.success) {
        setOrderDetail(result.data);
      }
    } catch (err) {
      console.error("Error fetching order detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleRetryFulfillment = async (orderId: string) => {
    if (!confirm("Coba kirim ulang fulfillment ke provider?")) return;
    try {
      setActionLoading(true);
      const idToken = await user?.getIdToken();
      const res = await fetch(`/api/admin/orders/${orderId}/retry-fulfillment`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${idToken}` }
      });
      const result = await res.json();
      if (result.success) {
        alert("Fulfillment berhasil dipicu ulang.");
        fetchOrderDetail(orderId);
        fetchOrders();
      } else {
        alert(result.message);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOverrideState = async (orderId: string) => {
    if (!overrideReason.trim()) {
      alert("Alasan perubahan status wajib diisi.");
      return;
    }
    if (!confirm(`Yakin ingin mengubah status pesanan menjadi ${targetState}?`)) return;

    try {
      setActionLoading(true);
      const idToken = await user?.getIdToken();
      let transactionStatus = "pending";
      let paymentStatus = "paid";

      if (targetState === "SUCCESS") {
        transactionStatus = "success";
        paymentStatus = "paid";
      } else if (targetState === "FAILED") {
        transactionStatus = "failed";
      } else if (targetState === "EXPIRED") {
        paymentStatus = "expired";
      } else if (targetState === "PROCESSING") {
        transactionStatus = "processing";
      }

      const res = await fetch(`/api/admin/orders/${orderId}/override`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}` 
        },
        body: JSON.stringify({
          paymentStatus,
          transactionStatus,
          reason: overrideReason
        })
      });
      const result = await res.json();
      if (result.success) {
        alert("Status pesanan berhasil diperbarui via state machine.");
        setOverrideReason("");
        fetchOrderDetail(orderId);
        fetchOrders();
      } else {
        alert(result.message);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase">Paid</span>;
      case 'pending': return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 uppercase">Pending Payment</span>;
      case 'expired': return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">Expired</span>;
      case 'failed': return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 uppercase">Failed</span>;
      default: return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">{status}</span>;
    }
  };

  const getTransactionStatusBadge = (status: string) => {
    switch (status) {
      case 'success': return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase">Success</span>;
      case 'processing': return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200 uppercase">Processing</span>;
      case 'pending': return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 uppercase">Pending</span>;
      case 'failed': return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 uppercase">Failed</span>;
      default: return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="ui-page-title text-slate-800">Manajemen Pesanan</h1>
          <p className="text-slate-500">Monitor transaksi, status pembayaran, dan fulfillment provider real-time.</p>
        </div>
        <button 
          onClick={fetchOrders}
          className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl transition-all shadow-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Data
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Cari berdasarkan Order ID, Invoice, Produk, atau User ID..." 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
        <div className="flex flex-wrap gap-2">
          <select 
            className="px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="all">Semua Pembayaran</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="expired">Expired</option>
            <option value="failed">Failed</option>
          </select>
          <select 
            className="px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            value={transactionFilter}
            onChange={(e) => setTransactionFilter(e.target.value)}
          >
            <option value="all">Semua Fulfillment</option>
            <option value="success">Success</option>
            <option value="processing">Processing</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Order ID / Invoice</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produk & Varian</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pelanggan</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pembayaran</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fulfillment</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-6 py-8 h-16 bg-slate-50/50"></td>
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <ShoppingCart className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    Belum ada data pesanan yang ditemukan.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono font-bold text-slate-800 text-xs">{order.invoice || order.id}</div>
                      <div className="text-[11px] text-slate-400">{new Date(order.createdAt).toLocaleString('id-ID')}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800 text-sm">{order.productName}</div>
                      <div className="text-xs text-slate-500">{order.variantName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-medium text-slate-700">{order.customerData?.userId || order.userId || "Guest"}</div>
                      {order.customerData?.zoneId && <div className="text-[11px] text-slate-400">Server: {order.customerData.zoneId}</div>}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900 text-sm">
                      {formatRupiah(order.totalAmount)}
                    </td>
                    <td className="px-6 py-4">
                      {getPaymentStatusBadge(order.paymentStatus)}
                    </td>
                    <td className="px-6 py-4">
                      {getTransactionStatusBadge(order.transactionStatus)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => { setSelectedOrder(order); fetchOrderDetail(order.id); }}
                        className="inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-xl font-medium text-xs transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setSelectedOrder(null)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden relative z-10 max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Detail Pesanan</h2>
                  <p className="text-xs font-mono text-slate-400">ID: {selectedOrder.id}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {loadingDetail ? (
                  <div className="p-12 text-center text-slate-500">Memuat detail pesanan...</div>
                ) : (
                  <>
                    {/* Status Overview */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div>
                        <div className="text-[11px] font-semibold text-slate-400 uppercase">Status Pembayaran</div>
                        <div className="mt-1">{getPaymentStatusBadge(selectedOrder.paymentStatus)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-slate-400 uppercase">Status Transaksi</div>
                        <div className="mt-1">{getTransactionStatusBadge(selectedOrder.transactionStatus)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-slate-400 uppercase">Provider</div>
                        <div className="mt-1 font-mono text-xs font-bold text-slate-700 uppercase">{selectedOrder.providerId || "Manual"}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-slate-400 uppercase">Total Pembayaran</div>
                        <div className="mt-1 font-bold text-slate-900 text-sm">{formatRupiah(selectedOrder.totalAmount)}</div>
                      </div>
                    </div>

                    {/* Snapshot & Customer Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" /> Snapshot Produk & Varian
                        </h3>
                        <div className="text-xs space-y-1 text-slate-600">
                          <div><span className="font-semibold">Produk:</span> {selectedOrder.productName}</div>
                          <div><span className="font-semibold">Varian:</span> {selectedOrder.variantName}</div>
                          <div><span className="font-semibold">Harga Satuan:</span> {formatRupiah(selectedOrder.price)}</div>
                          <div><span className="font-semibold">Jumlah:</span> {selectedOrder.quantity}</div>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" /> Data Target Pelanggan
                        </h3>
                        <div className="text-xs space-y-1 text-slate-600">
                          <div><span className="font-semibold">User ID / Tujuan:</span> {selectedOrder.customerData?.userId || selectedOrder.customerData?.destination || "-"}</div>
                          <div><span className="font-semibold">Server ID / Zone:</span> {selectedOrder.customerData?.zoneId || selectedOrder.customerData?.serverId || "-"}</div>
                          <div><span className="font-semibold">Waktu Dibuat:</span> {new Date(selectedOrder.createdAt).toLocaleString('id-ID')}</div>
                        </div>
                      </div>
                    </div>

                    {/* Operational Actions (Retry Fulfillment & State Override) */}
                    <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 space-y-4">
                      <h3 className="font-bold text-slate-800 text-sm">Aksi Operasional & Pemulihan</h3>
                      <div className="flex flex-wrap items-center gap-3">
                        {selectedOrder.paymentStatus === 'paid' && selectedOrder.transactionStatus !== 'success' && (
                          <button
                            onClick={() => handleRetryFulfillment(selectedOrder.id)}
                            disabled={actionLoading}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all shadow-sm"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Retry Fulfillment Dispatch
                          </button>
                        )}
                      </div>

                      <div className="border-t border-blue-200/60 pt-4 space-y-3">
                        <div className="text-xs font-semibold text-slate-700">Admin State Override (State Machine Protected)</div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <select 
                            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none"
                            value={targetState}
                            onChange={(e) => setTargetState(e.target.value)}
                          >
                            <option value="SUCCESS">Set to SUCCESS</option>
                            <option value="PROCESSING">Set to PROCESSING</option>
                            <option value="FAILED">Set to FAILED</option>
                            <option value="EXPIRED">Set to EXPIRED</option>
                          </select>
                          <input 
                            type="text"
                            placeholder="Alasan perubahan status wajib diisi (untuk audit log)..."
                            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none bg-white"
                            value={overrideReason}
                            onChange={(e) => setOverrideReason(e.target.value)}
                          />
                          <button
                            onClick={() => handleOverrideState(selectedOrder.id)}
                            disabled={actionLoading}
                            className="bg-slate-800 hover:bg-slate-900 text-white font-medium px-4 py-2 rounded-xl text-xs transition-all"
                          >
                            Override State
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Audit Trail & Refunds */}
                    {orderDetail?.auditLogs && orderDetail.auditLogs.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="font-bold text-slate-800 text-sm">Riwayat Audit & State Transition</h3>
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 max-h-40 overflow-y-auto">
                          {orderDetail.auditLogs.map((log: any) => (
                            <div key={log.id} className="text-xs border-b border-slate-200/60 pb-2 last:border-0">
                              <div className="flex justify-between font-medium text-slate-700">
                                <span className="font-mono text-blue-600">{log.action}</span>
                                <span className="text-slate-400">{new Date(log.createdAt).toLocaleString('id-ID')}</span>
                              </div>
                              {log.reason && <div className="text-slate-500 mt-0.5">Alasan: {log.reason}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
