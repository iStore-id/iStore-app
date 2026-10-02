import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { formatRupiah, loadMidtransSnap } from "../lib/utils";
import { CheckCircle2, Clock, XCircle, Copy, AlertTriangle, AlertCircle, Key, Truck } from "lucide-react";
import { useAuthStore } from "../store/auth-store";
import { trackPurchase } from "../lib/gtag";

function hexToRgba(hex: string, opacity: number) {
  let c = (hex || "#ffffff").replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(char => char + char).join('');
  }
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
}

export default function TransactionDetailPage() {
  const { invoice } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [delivery, setDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorState, setErrorState] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { user } = useAuthStore();
  const [revealCode, setRevealCode] = useState(false);
  const [hasCustomBg, setHasCustomBg] = useState(false);
  const [cardColor, setCardColor] = useState("#ffffff");
  const [cardOpacity, setCardOpacity] = useState(85);
  const [cardBlur, setCardBlur] = useState<"none" | "sm" | "md" | "lg">("md");

  useEffect(() => {
    fetch("/api/public/store-config")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          const isColor = data.data.homepageBackgroundMode === "color" && Boolean(data.data.homepageBackgroundColor);
          const isImage = data.data.homepageBackgroundMode === "image" && Boolean(data.data.homepageBackgroundImage);
          setHasCustomBg(isColor || isImage);
          if (data.data.transactionCardColor) {
            setCardColor(data.data.transactionCardColor);
          }
          if (typeof data.data.transactionCardOpacity === "number") {
            setCardOpacity(Math.max(50, Math.min(100, data.data.transactionCardOpacity)));
          }
          if (data.data.transactionCardBlur) {
            setCardBlur(data.data.transactionCardBlur);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadMidtransSnap();
  }, []);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!invoice) {
        setError("Transaksi tidak ditemukan.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(invoice)}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Transaksi tidak ditemukan.");
          } else {
            setErrorState("service_error");
          }
          setLoading(false);
          return;
        }

        const json = await res.json();
        if (!json.success || !json.data) {
          setError("Transaksi tidak ditemukan.");
          setLoading(false);
          return;
        }

        const orderData = json.data;
        setOrder(orderData);

        // Track purchase event in GA4 if paid / settled
        const txStatus = (orderData.transactionStatus || orderData.status || "").toUpperCase();
        if (txStatus === "PAID" || txStatus === "SUCCESS" || txStatus === "COMPLETED" || txStatus === "SETTLEMENT") {
          const totalVal = Number(orderData.grossAmount || orderData.totalAmount || orderData.price || 0);
          trackPurchase(
            orderData.id || orderData.orderId || invoice || "",
            totalVal,
            [
              {
                id: orderData.productId || "item",
                name: orderData.productName || orderData.gameName || "Voucher Game",
                price: totalVal,
                quantity: 1
              }
            ]
          );
        }

        // Fetch Delivery Data if Authorized
        if (user && orderData.userId === user.uid) {
           try {
             const token = await user.getIdToken();
             const deliveryRes = await fetch(`/api/customer/orders/${orderData.id}/delivery`, {
               headers: { Authorization: `Bearer ${token}` }
             });
             if (deliveryRes.ok) {
               const deliveryJson = await deliveryRes.json();
               if (deliveryJson.success && deliveryJson.data) {
                 setDelivery(deliveryJson.data);
               }
             }
           } catch (e) {
             console.error("Failed to load delivery data", e);
           }
        }

      } catch (err) {
        console.warn("Notice: Order fetch error:", err);
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
      <div 
        className="rounded-3xl overflow-hidden shadow-sm border border-slate-200/80"
        style={{ backgroundColor: 'var(--surface-color)' }}
      >
        
        {/* Status Header */}
        <div className={`p-8 text-center border-b ${
          order.transactionStatus === 'success' ? 'bg-green-50 border-green-100' :
          order.transactionStatus === 'failed' ? 'bg-red-50 border-red-100' :
          'bg-brand-50 border-brand-100'
        }`}>
          {order.transactionStatus === 'success' ? <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" /> :
           order.transactionStatus === 'failed' ? <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" /> :
           <Clock className="w-16 h-16 text-brand-500 mx-auto mb-4" />}
          
          <h1 className="ui-page-title text-slate-900 mb-2">
            {order.transactionStatus === 'success' ? 'Transaksi Berhasil' :
             order.transactionStatus === 'failed' ? 'Transaksi Gagal' :
             order.paymentStatus === 'paid' ? 'Sedang Diproses' :
             'Menunggu Pembayaran'}
          </h1>
          <p className="text-slate-600 font-medium">{formatRupiah(order.totalAmount)}</p>
          
          {order.paymentStatus === 'pending' && (
            <div className="mt-6 flex flex-col items-center gap-6">
              {order.qrImage ? (
                <div className="flex flex-col items-center space-y-4 w-full">
                  <div className="text-center space-y-1">
                    <h3 className="text-sm font-bold text-slate-900">Scan QRIS Untuk Membayar</h3>
                    <p className="text-[11px] text-slate-500">Silakan scan kode QR di bawah ini</p>
                  </div>
                  <div className="bg-white p-3 rounded-2xl border-2 border-brand-100 shadow-sm">
                    <img src={order.qrImage} alt="QRIS" className="w-48 h-48 sm:w-56 sm:h-56 object-contain" />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-brand-600 font-bold bg-brand-50 px-3 py-1.5 rounded-full animate-pulse">
                    <Clock className="w-3 h-3" />
                    <span>MENUNGGU PEMBAYARAN</span>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={async () => {
                    setActionError(null);
                    let snapReady = !!window.snap;
                    if (!snapReady) {
                      snapReady = await loadMidtransSnap();
                    }

                    if (snapReady && window.snap && order.snapToken) {
                      window.snap.pay(order.snapToken, {
                        onSuccess: () => window.location.reload(),
                        onPending: () => window.location.reload(),
                        onError: () => setActionError("Pembayaran gagal. Silakan coba lagi."),
                        onClose: () => {}
                      });
                    } else if (order.paymentUrl) {
                      window.location.href = order.paymentUrl;
                    } else if (order.paymentGatewayCode === 'ipaymu') {
                      try {
                        const res = await fetch(`/api/orders/${order.invoice || order.id}/payment-status`);
                        const result = await res.json();
                        if (result.success && result.data.status !== 'pending') {
                          window.location.reload();
                        } else {
                          setActionError("Sesi pembayaran tidak tersedia. Transaksi masih tertunda.");
                        }
                      } catch (e) {
                        setActionError("Gagal memeriksa status pembayaran.");
                      }
                    } else {
                      setActionError("Token atau URL pembayaran tidak ditemukan. Silakan hubungi customer support.");
                    }
                  }}
                  className="bg-brand-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-brand-700 transition-colors shadow-sm"
                >
                  Lanjutkan Pembayaran
                </button>
              )}

              {actionError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 max-w-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{actionError}</span>
                </div>
              )}
            </div>
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
                  <button onClick={() => copyToClipboard(order.invoice || order.id)} className="text-brand-600 hover:text-brand-700"><Copy className="w-4 h-4"/></button>
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
                    <span className="font-mono font-bold text-brand-600">{order.serialNumber}</span>
                    <button onClick={() => copyToClipboard(order.serialNumber)} className="text-brand-600 hover:text-brand-700"><Copy className="w-4 h-4"/></button>
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
              <div className="bg-brand-50 border border-brand-100 p-5 rounded-2xl space-y-4">
                <div className="flex justify-between border-b border-brand-200/50 pb-3">
                  <span className="text-sm text-slate-600">Status Delivery</span>
                  <span className={`font-semibold text-sm ${
                    delivery.status === 'DELIVERED' ? 'text-green-600' :
                    delivery.status === 'FAILED' ? 'text-red-600' : 'text-brand-600'
                  }`}>
                    {delivery.status}
                  </span>
                </div>
                
                {delivery.deliveredAt && (
                  <div className="flex justify-between border-b border-brand-200/50 pb-3">
                    <span className="text-sm text-slate-600">Waktu Selesai</span>
                    <span className="text-sm font-medium text-slate-900">{new Date(delivery.deliveredAt).toLocaleString('id-ID')}</span>
                  </div>
                )}

                {delivery.providerTransactionId && (
                  <div className="flex justify-between border-b border-brand-200/50 pb-3">
                    <span className="text-sm text-slate-600">No. Referensi / SN</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-medium text-slate-900">{delivery.providerTransactionId}</span>
                      <button onClick={() => copyToClipboard(delivery.providerTransactionId)} className="text-brand-600 hover:text-brand-700">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {delivery.digitalCode !== undefined && (
                  <div className="pt-2">
                    <span className="text-sm font-medium text-slate-900 block mb-2">Kode Voucher / Akses Digital</span>
                    {revealCode ? (
                      <div className="bg-white border border-brand-200 p-4 rounded-xl font-mono text-sm text-slate-900 flex justify-between items-center break-all shadow-sm">
                        <span>{delivery.digitalCode || <span className="text-slate-400 italic font-sans">Kode tidak tersedia</span>}</span>
                        {delivery.digitalCode && (
                          <button onClick={() => copyToClipboard(delivery.digitalCode)} className="text-brand-600 hover:text-brand-700 ml-2 shrink-0 bg-brand-50 p-2 rounded-lg">
                            <Copy className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <button 
                        onClick={() => setRevealCode(true)}
                        className="w-full flex items-center justify-center gap-2 bg-white border border-brand-200 p-4 rounded-xl text-sm text-brand-600 font-semibold hover:bg-brand-50 shadow-sm transition-colors"
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
