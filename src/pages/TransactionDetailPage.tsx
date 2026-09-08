import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../lib/firebase";
import { formatRupiah } from "../lib/utils";
import { CheckCircle2, Clock, XCircle, Copy, AlertTriangle, Key, Truck } from "lucide-react";
import { useAuthStore } from "../store/auth-store";

export default function TransactionDetailPage() {
  const { invoice } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [delivery, setDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorState, setErrorState] = useState<string | null>(null);
  const { user } = useAuthStore();
  const [revealCode, setRevealCode] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!isFirebaseConfigured || !db) {
        setErrorState("configuration_error");
        setLoading(false);
        return;
      }

      try {
        const q = query(collection(db, "orders"), where("invoice", "==", invoice));
        const snapshot = await getDocs(q);
        
        // Fallback to searching by ID if invoice not found
        let orderData = null;
        if (snapshot.empty) {
          const qById = query(collection(db, "orders"), where("id", "==", invoice));
          const snapshotById = await getDocs(qById);
          if (snapshotById.empty) {
            setError("Transaksi tidak ditemukan.");
            setLoading(false);
            return;
          }
          orderData = { id: snapshotById.docs[0].id, ...snapshotById.docs[0].data() };
        } else {
          orderData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        }
        setOrder(orderData);

        // Fetch Delivery Data if Authorized
        if (user && orderData.userId === user.uid) {
           try {
             const token = await user.getIdToken();
             const res = await fetch(`/api/customer/orders/${orderData.id}/delivery`, {
               headers: { Authorization: `Bearer ${token}` }
             });
             if (res.ok) {
               const data = await res.json();
               if (data.success && data.data) {
                 setDelivery(data.data);
               }
             }
           } catch (e) {
             console.error("Failed to load delivery data", e);
           }
        }

      } catch (err) {
        console.warn("Notice: Order fetch from Firestore:", err);
        setErrorState("service_error");
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [invoice, user]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Disalin!");
  };

  if (loading) return <div className="p-12 text-center">Mencari transaksi...</div>;

  if (errorState === "configuration_error") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
          <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Konfigurasi Belum Lengkap</h2>
          <p className="text-slate-600 mb-6">Hubungkan Firebase untuk memuat detail transaksi ini.</p>
        </div>
      </div>
    );
  }

  if (errorState === "service_error") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Gagal Memuat Transaksi</h2>
          <p className="text-slate-600 mb-6">Terjadi kesalahan pada layanan saat mengambil detail transaksi.</p>
        </div>
      </div>
    );
  }

  if (error) return <div className="p-12 text-center text-red-600">{error}</div>;
  if (!order) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
      <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100">
        
        {/* Status Header */}
        <div className={`p-8 text-center border-b ${
          order.transactionStatus === 'success' ? 'bg-green-50 border-green-100' :
          order.transactionStatus === 'failed' ? 'bg-red-50 border-red-100' :
          'bg-blue-50 border-blue-100'
        }`}>
          {order.transactionStatus === 'success' ? <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" /> :
           order.transactionStatus === 'failed' ? <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" /> :
           <Clock className="w-16 h-16 text-blue-500 mx-auto mb-4" />}
          
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {order.transactionStatus === 'success' ? 'Transaksi Berhasil' :
             order.transactionStatus === 'failed' ? 'Transaksi Gagal' :
             order.paymentStatus === 'paid' ? 'Sedang Diproses' :
             'Menunggu Pembayaran'}
          </h1>
          <p className="text-slate-600 font-medium">{formatRupiah(order.totalAmount)}</p>
          
          {order.paymentStatus === 'pending' && (
            <button 
              onClick={() => {
                if (window.snap && order.snapToken) {
                  window.snap.pay(order.snapToken);
                } else {
                  alert("Token pembayaran tidak ditemukan atau sudah kadaluarsa.");
                }
              }}
              className="mt-6 bg-blue-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-blue-700 transition-colors"
            >
              Lanjutkan Pembayaran
            </button>
          )}
        </div>

        {/* Details */}
        <div className="p-8 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Detail Produk</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Produk</span>
                <span className="font-medium text-slate-900">{order.productName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Nominal</span>
                <span className="font-medium text-slate-900">{order.quantity ? `${order.quantity} Item` : 'Default'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Data Akun</span>
                <span className="font-medium text-slate-900">
                  {Object.entries(order.customerData || {}).map(([k, v]) => `${v}`).join(" | ")}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Detail Transaksi</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">No. Invoice</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-slate-900">{order.invoice || order.id}</span>
                  <button onClick={() => copyToClipboard(order.invoice || order.id)} className="text-blue-600 hover:text-blue-700"><Copy className="w-4 h-4"/></button>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Tanggal</span>
                <span className="font-medium text-slate-900">{new Date(order.createdAt).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Status Pembayaran</span>
                <span className="font-medium uppercase text-slate-900">{order.paymentStatus}</span>
              </div>
              {order.serialNumber && (
                <div className="flex justify-between items-center text-sm mt-4 p-4 bg-slate-50 rounded-xl">
                  <span className="font-semibold text-slate-900">Serial Number / Kode:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-600">{order.serialNumber}</span>
                    <button onClick={() => copyToClipboard(order.serialNumber)} className="text-blue-600 hover:text-blue-700"><Copy className="w-4 h-4"/></button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {delivery && (
            <div className="pt-6 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Truck className="w-4 h-4 text-slate-500" />
                Informasi Pengiriman (Delivery)
              </h3>
              <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl space-y-4">
                <div className="flex justify-between border-b border-blue-200/50 pb-3">
                  <span className="text-sm text-slate-600">Status Delivery</span>
                  <span className={`font-semibold text-sm ${
                    delivery.status === 'DELIVERED' ? 'text-green-600' :
                    delivery.status === 'FAILED' ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    {delivery.status}
                  </span>
                </div>
                
                {delivery.deliveredAt && (
                  <div className="flex justify-between border-b border-blue-200/50 pb-3">
                    <span className="text-sm text-slate-600">Waktu Selesai</span>
                    <span className="text-sm font-medium text-slate-900">{new Date(delivery.deliveredAt).toLocaleString('id-ID')}</span>
                  </div>
                )}

                {delivery.providerTransactionId && (
                  <div className="flex justify-between border-b border-blue-200/50 pb-3">
                    <span className="text-sm text-slate-600">No. Referensi / SN</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-medium text-slate-900">{delivery.providerTransactionId}</span>
                      <button onClick={() => copyToClipboard(delivery.providerTransactionId)} className="text-blue-600 hover:text-blue-700">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {delivery.digitalCode !== undefined && (
                  <div className="pt-2">
                    <span className="text-sm font-medium text-slate-900 block mb-2">Kode Voucher / Akses Digital</span>
                    {revealCode ? (
                      <div className="bg-white border border-blue-200 p-4 rounded-xl font-mono text-sm text-slate-900 flex justify-between items-center break-all shadow-sm">
                        <span>{delivery.digitalCode || <span className="text-slate-400 italic font-sans">Kode tidak tersedia</span>}</span>
                        {delivery.digitalCode && (
                          <button onClick={() => copyToClipboard(delivery.digitalCode)} className="text-blue-600 hover:text-blue-700 ml-2 shrink-0 bg-blue-50 p-2 rounded-lg">
                            <Copy className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <button 
                        onClick={() => setRevealCode(true)}
                        className="w-full flex items-center justify-center gap-2 bg-white border border-blue-200 p-4 rounded-xl text-sm text-blue-600 font-semibold hover:bg-blue-50 shadow-sm transition-colors"
                      >
                        <Key className="w-4 h-4" />
                        Tampilkan Kode Rahasia
                      </button>
                    )}
                    <p className="text-xs text-amber-600 mt-3 flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="w-4 h-4" />
                      Mohon simpan kode ini dengan aman. Akses dicatat oleh sistem.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
