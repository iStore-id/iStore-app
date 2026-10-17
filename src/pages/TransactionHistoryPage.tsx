import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth-store";
import { supabaseGetSession } from "../lib/supabase-auth";
import { formatRupiah } from "../lib/utils";
import { Receipt, ChevronRight, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

export default function TransactionHistoryPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchOrders = async () => {
      try {
        if (user) {
          const { session } = await supabaseGetSession();
          if (!session?.access_token) {
            setErrorState("service_error");
            return;
          }

          const response = await fetch("/api/customer/orders", {
            headers: { "Authorization": "Bearer " + session.access_token }
          });
          const data = await response.json();
          if (!response.ok || !data.success) {
            setErrorState("service_error");
            return;
          }
          if (!cancelled) setOrders(data.data || []);
          return;
        }

        let invoices: string[] = [];
        try {
          const stored = JSON.parse(localStorage.getItem("istore_guest_transaction_invoices") || "[]");
          if (Array.isArray(stored)) {
            invoices = [...new Set(stored.filter((value): value is string =>
              typeof value === "string" && value.length > 0 && value.length <= 128
            ))].slice(0, 100);
          }
        } catch {
          invoices = [];
        }

        const results = await Promise.all(invoices.map(async (reference) => {
          try {
            const response = await fetch("/api/public/transactions/" + encodeURIComponent(reference) + "/summary");
            if (!response.ok) return null;
            const data = await response.json();
            return data.success ? data.data : null;
          } catch {
            return null;
          }
        }));
        if (!cancelled) {
          const validOrders = results.filter((order): order is any => Boolean(order));
          setOrders(validOrders);
          const validInvoices = validOrders.map(order => order.invoice || order.id);
          try {
            localStorage.setItem("istore_guest_transaction_invoices", JSON.stringify(validInvoices));
          } catch {
            // Storage may be unavailable or full; history remains usable for this page view.
          }
        }
      } catch (err) {
        console.warn("Notice: orders could not be fetched from API:", err);
        if (!cancelled) setErrorState("service_error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchOrders();
    return () => { cancelled = true; };
  }, [user]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700"><CheckCircle2 className="w-3.5 h-3.5"/> Berhasil</span>;
      case "failed":
        return <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700"><XCircle className="w-3.5 h-3.5"/> Gagal</span>;
      case "expired":
        return <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800"><AlertTriangle className="w-3.5 h-3.5"/> Kedaluwarsa</span>;
      case "processing":
      case "paid":
        return <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-100 text-brand-700"><Clock className="w-3.5 h-3.5"/> Diproses</span>;
      default:
        return <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700"><Clock className="w-3.5 h-3.5"/> Menunggu Pembayaran</span>;
    }
  };

  if (loading) return <div className="p-12 text-center">Loading...</div>;

  if (errorState === "service_error") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <div 
          className="rounded-3xl p-12 text-center border border-slate-200/80 shadow-sm"
          style={{ backgroundColor: 'var(--surface-color)' }}
        >
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Gagal Memuat Riwayat</h2>
          <p className="text-slate-600 mb-6">Terjadi kesalahan pada layanan saat mengambil data transaksi.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
      <h1 className="ui-page-title text-slate-900 mb-6">Riwayat Transaksi</h1>
      
      {orders.length === 0 ? (
        <div 
          className="rounded-3xl p-12 text-center border border-slate-200/80 shadow-sm"
          style={{ backgroundColor: 'var(--surface-color)' }}
        >
          <Receipt className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">Belum ada transaksi</h2>
          <p className="text-slate-500 mb-6">{user ? "Anda belum pernah melakukan top up atau pembelian." : "Belum ada transaksi guest yang tersimpan di browser ini. Riwayat guest hanya tersedia di perangkat yang digunakan saat transaksi."}</p>
          <Link to="/" className="inline-block bg-brand-600 text-white font-medium px-6 py-2.5 rounded-full hover:bg-brand-700 transition-colors">
            Mulai Top Up
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <Link 
              to={`/transactions/${order.invoice || order.id}`} 
              key={order.id}
              className="block rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all hover:border-brand-200"
              style={{ backgroundColor: 'var(--surface-color)' }}
            >
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{order.invoice || order.id}</span>
                    <span className="text-xs text-slate-400">{order.createdAt ? new Date(order.createdAt).toLocaleDateString('id-ID') : '-'}</span>
                  </div>
                  <h3 className="font-bold text-slate-900">{order.productName}</h3>
                  <p className="text-sm text-slate-600">{formatRupiah(order.totalAmount)}</p>
                </div>
                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
                  {getStatusBadge(order.transactionStatus === "success" || order.transactionStatus === "failed" ? order.transactionStatus : order.paymentStatus === "expired" ? "expired" : order.transactionStatus || order.paymentStatus)}
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
