import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { formatRupiah, loadMidtransSnap } from "../lib/utils";
import { CheckCircle2, Clock, XCircle, Copy, AlertTriangle, AlertCircle, Key, Truck, Check } from "lucide-react";
import { useAuthStore } from "../store/auth-store";
import { trackPurchase } from "../lib/gtag";
import QRCode from "qrcode";

async function loadDoitEmbed(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.doit) return true;

  const scriptId = "doit-embed-script";
  const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (existingScript) {
    if (window.doit) return true;
    return new Promise((resolve) => {
      existingScript.addEventListener("load", () => resolve(!!window.doit), { once: true });
      existingScript.addEventListener("error", () => resolve(false), { once: true });
      setTimeout(() => resolve(!!window.doit), 3000);
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://doit.id/embed.js";
    script.async = true;
    script.onload = () => resolve(!!window.doit);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
    setTimeout(() => resolve(!!window.doit), 5000);
  });
}

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

const getBankInfo = (bankCode?: string) => {
  const code = (bankCode || "").toLowerCase();
  if (code === "bmri" || code === "mandiri" || code === "mandiri_va") {
    return { name: "Bank Mandiri", logo: "/payment-logos/mandiri.svg" };
  }
  if (code === "bnia" || code === "bni" || code === "bni_va") {
    return { name: "Bank BNI", logo: "/payment-logos/bni.svg" };
  }
  if (code === "brin" || code === "bri" || code === "bri_va") {
    return { name: "Bank BRI (BRIVA)", logo: "/payment-logos/bri.svg" };
  }
  if (code === "bsyi" || code === "bsi" || code === "bsi_va") {
    return { name: "Bank Syariah Indonesia (BSI)", logo: "/payment-logos/bsi.svg" };
  }
  if (code === "cimb" || code === "cimb_va") {
    return { name: "Bank CIMB Niaga", logo: "/payment-logos/cimb-niaga.svg" };
  }
  if (code === "permata" || code === "permata_va") {
    return { name: "Bank Permata", logo: "/payment-logos/permata.svg" };
  }
  if (code === "maybank" || code === "maybank_va") {
    return { name: "Bank Maybank", logo: "/payment-logos/bi-fast.svg" };
  }
  if (code === "danamon" || code === "danamon_va") {
    return { name: "Bank Danamon", logo: "/payment-logos/danamon.svg" };
  }
  return { name: bankCode ? `Bank ${bankCode.toUpperCase()}` : "Virtual Account", logo: "/payment-logos/bi-fast.svg" };
};

export default function TransactionDetailPage() {
  const { invoice } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [delivery, setDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorState, setErrorState] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedVa, setCopiedVa] = useState(false);
  const [omqrisQrImage, setOmqrisQrImage] = useState("");
  const [omqrisSecondsRemaining, setOmqrisSecondsRemaining] = useState<number | null>(null);
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
    const qrContent = String(order?.gatewayResponse?.qrContent || "");
    if (order?.paymentGatewayCode !== "omqris" || !qrContent) {
      setOmqrisQrImage("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(qrContent, { width: 320, margin: 2 })
      .then((url) => { if (!cancelled) setOmqrisQrImage(url); })
      .catch(() => { if (!cancelled) setOmqrisQrImage(""); });
    return () => { cancelled = true; };
  }, [order?.paymentGatewayCode, order?.gatewayResponse?.qrContent]);

  useEffect(() => {
    if (order?.paymentGatewayCode !== "omqris" || order?.paymentStatus !== "pending") {
      setOmqrisSecondsRemaining(null);
      return;
    }
    const storedExpiry = order?.gatewayResponse?.expiresAt || order?.expiresAt;
    const createdAt = order?.createdAt ? Date.parse(order.createdAt) : NaN;
    const deadline = storedExpiry ? Date.parse(String(storedExpiry)) : (Number.isFinite(createdAt) ? createdAt + 60 * 60 * 1000 : NaN);
    if (!Number.isFinite(deadline)) {
      setOmqrisSecondsRemaining(null);
      return;
    }
    const updateRemaining = () => setOmqrisSecondsRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [order?.paymentGatewayCode, order?.paymentStatus, order?.gatewayResponse?.expiresAt, order?.expiresAt, order?.createdAt]);

  useEffect(() => {
    loadMidtransSnap();
    loadDoitEmbed();
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

  // OmQris has a server-side status inquiry fallback if the provider webhook is delayed or missed.
  // The backend only persists PAID after authoritative provider status and base-amount validation.
  useEffect(() => {
    if (
      !invoice ||
      order?.paymentGatewayCode !== "omqris" ||
      String(order?.paymentStatus || "").toLowerCase() !== "pending"
    ) return;

    let stopped = false;
    let inFlight = false;

    const checkOmqrisStatus = async () => {
      if (stopped || inFlight) return;
      inFlight = true;
      try {
        const statusResponse = await fetch(`/api/orders/${encodeURIComponent(invoice)}/payment-status`);
        if (!statusResponse.ok) return;
        const statusJson = await statusResponse.json();
        const providerStatus = String(statusJson?.data?.status || "").toUpperCase();
        const persistedStatus = String(statusJson?.data?.orderPaymentStatus || "").toLowerCase();

        if (providerStatus !== "PAID" && persistedStatus !== "paid") return;

        const orderResponse = await fetch(`/api/orders/${encodeURIComponent(invoice)}`);
        if (!orderResponse.ok) return;
        const orderJson = await orderResponse.json();
        if (!stopped && orderJson?.success && orderJson?.data) {
          setOrder(orderJson.data);
        }
      } catch (statusError) {
        // A temporary inquiry failure must not alter the displayed payment state.
        console.warn("OmQris status inquiry temporarily unavailable:", statusError);
      } finally {
        inFlight = false;
      }
    };

    void checkOmqrisStatus();
    const timer = window.setInterval(() => { void checkOmqrisStatus(); }, 15000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [invoice, order?.id, order?.paymentGatewayCode, order?.paymentStatus]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Disalin!");
  };

  if (loading) return <div className="p-12 text-center">Mencari transaksi...</div>;

  if (errorState === "configuration_error") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-5 sm:py-8 md:py-12">
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
          <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Konfigurasi Belum Lengkap</h2>
          <p className="text-slate-600 mb-6">Layanan detail transaksi belum siap. Silakan coba lagi nanti.</p>
        </div>
      </div>
    );
  }

  if (errorState === "service_error") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-5 sm:py-8 md:py-12">
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
    <div className="max-w-2xl mx-auto px-4 py-5 sm:py-8 md:py-12">
      <div 
        className="rounded-3xl overflow-hidden shadow-sm border border-slate-200/80"
        style={{ backgroundColor: 'var(--surface-color)' }}
      >
        
        {/* Status Header */}
        <div className={`p-5 sm:p-8 text-center border-b ${
          order.transactionStatus === 'success' ? 'bg-green-50 border-green-100' :
          order.transactionStatus === 'failed' ? 'bg-red-50 border-red-100' :
          order.paymentStatus === 'expired' || order.transactionStatus === 'expired' ? 'bg-amber-50 border-amber-100' :
          'bg-brand-50 border-brand-100'
        }`}>
          {order.transactionStatus === 'success' ? <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" /> :
           order.transactionStatus === 'failed' ? <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" /> :
           order.paymentStatus === 'expired' || order.transactionStatus === 'expired' ? <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" /> :
           <Clock className="w-16 h-16 text-brand-500 mx-auto mb-4" />}
          
          <h1 className="ui-page-title text-slate-900 mb-2">
            {order.transactionStatus === 'success' ? 'Transaksi Berhasil' :
             order.transactionStatus === 'failed' ? 'Transaksi Gagal' :
             order.paymentStatus === 'expired' || order.transactionStatus === 'expired' ? 'Pembayaran Kedaluwarsa' :
             order.paymentStatus === 'paid' ? 'Sedang Diproses' :
             'Menunggu Pembayaran'}
          </h1>
          <p className="mt-2 inline-flex max-w-full items-center justify-center rounded-2xl border border-brand-100 bg-white px-5 py-3 text-lg font-extrabold tabular-nums text-slate-900 shadow-sm sm:text-xl">{formatRupiah(order.paymentGatewayCode === "omqris" ? (order.gatewayResponse?.totalAmount || order.totalAmount) : order.totalAmount)}</p>
          
          {order.paymentStatus === 'pending' && (
            <div className="mt-6 flex w-full flex-col items-center gap-5 sm:gap-6">
              {(() => {
                const gwResp = order.gatewayResponse || {};
                const isDoit = order.paymentGatewayCode === 'doit';
                const doitRail = gwResp.rail || order.gatewayPaymentType;
                const doitQrImage = gwResp.qrImage || order.qrImage;
                const doitVaNumber = gwResp.vaNumber;
                const doitVaBank = gwResp.vaBank;
                const bankInfo = getBankInfo(doitVaBank);
                const displayTotal = gwResp.totalAmount || order.totalAmount;

                if (order.paymentGatewayCode === "omqris") {
                  return (
                    <div className="flex w-full max-w-sm flex-col items-center space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                      <div className="text-center space-y-1">
                        <h3 className="text-sm font-bold text-slate-900">Scan QRIS Untuk Membayar</h3>
                        <p className="text-[11px] text-slate-500">Gunakan aplikasi bank atau e-wallet yang mendukung QRIS.</p>
                      </div>
                      {omqrisQrImage ? (
                        <>
                          <div className="bg-white p-3 rounded-2xl border-2 border-brand-100 shadow-sm">
                            <img src={omqrisQrImage} alt="QRIS" className="w-48 h-48 sm:w-56 sm:h-56 object-contain" />
                          </div>
                          <a
                            href={omqrisQrImage}
                            download={`QRIS-${String(order.invoice || order.id || "transaksi").replace(/[^a-zA-Z0-9_-]/g, "-")}.png`}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
                          >
                            Unduh QRIS
                          </a>
                        </>
                      ) : order.paymentUrl ? (
                        <a href={order.paymentUrl} target="_blank" rel="noreferrer" className="bg-brand-600 text-white font-semibold px-6 py-3 rounded-xl">Buka halaman pembayaran QRIS</a>
                      ) : (
                        <p className="p-4 bg-amber-50 rounded-xl text-xs text-amber-700 text-center">QRIS belum tersedia. Silakan muat ulang atau hubungi bantuan.</p>
                      )}
                      <div className="text-base font-black text-brand-600">{formatRupiah(order.gatewayResponse?.totalAmount || order.totalAmount)}</div>
                      {omqrisSecondsRemaining !== null && (
                        <div className={`w-full rounded-xl border p-3 text-center ${omqrisSecondsRemaining === 0 ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                          <div className="text-xs font-semibold">Batas waktu pembayaran</div>
                          {omqrisSecondsRemaining > 0 ? (
                            <>
                              <div className="mt-1 font-mono text-xl font-bold tabular-nums">
                                {String(Math.floor(omqrisSecondsRemaining / 3600)).padStart(2, "0")}:{String(Math.floor((omqrisSecondsRemaining % 3600) / 60)).padStart(2, "0")}:{String(omqrisSecondsRemaining % 60).padStart(2, "0")}
                              </div>
                              <div className="mt-1 text-[11px]">QRIS berlaku maksimal 1 jam sejak invoice dibuat.</div>
                            </>
                          ) : (
                            <div className="mt-1 text-xs font-medium">Waktu pembayaran telah habis. Periksa status transaksi sebelum mencoba membayar lagi.</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                if (order.paymentGatewayCode === "tripay") {
                  const tripayQrImage = gwResp.qrImage || order.qrImage;
                  const tripayVaNumber = gwResp.vaNumber;
                  const tripayVaBank = String(gwResp.vaBank || "").toUpperCase();
                  const tripayBankInfo = getBankInfo(tripayVaBank);
                  if (tripayQrImage) {
                    return (
                      <div className="flex flex-col items-center space-y-4 w-full max-w-sm mx-auto">
                        <div className="text-center space-y-1">
                          <h3 className="text-sm font-bold text-slate-900">Bayar melalui TriPay</h3>
                          <p className="text-[11px] text-slate-500">Scan QRIS menggunakan aplikasi bank atau e-wallet yang mendukung QRIS.</p>
                        </div>
                        <div className="bg-white p-3 rounded-2xl border-2 border-brand-100 shadow-sm">
                          <img src={tripayQrImage} alt="TriPay QRIS" className="w-48 h-48 sm:w-56 sm:h-56 object-contain" />
                        </div>
                        <div className="text-base font-black text-brand-600">{formatRupiah(displayTotal)}</div>
                        {order.paymentUrl && <a href={order.paymentUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-brand-600 text-white px-5 py-3 text-sm font-semibold">Buka halaman pembayaran TriPay</a>}
                      </div>
                    );
                  }
                  if (tripayVaNumber) {
                    return (
                      <div className="flex flex-col items-center space-y-4 w-full max-w-md mx-auto">
                        <div className="w-full bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-5 space-y-4">
                          <div className="font-bold text-sm text-slate-800">{tripayBankInfo.name} Virtual Account</div>
                          <div>
                            <span className="text-[11px] font-medium text-slate-500 block mb-1">Nomor Virtual Account</span>
                            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
                              <span className="font-mono text-base sm:text-lg font-bold text-slate-900 tracking-wider break-all">{tripayVaNumber}</span>
                              <button type="button" onClick={() => { navigator.clipboard.writeText(String(tripayVaNumber)); setCopiedVa(true); setTimeout(() => setCopiedVa(false), 2000); }} className="ml-3 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-semibold">
                                {copiedVa ? "Tersalin!" : "Salin"}
                              </button>
                            </div>
                          </div>
                          <div className="text-base font-black text-brand-600">{formatRupiah(displayTotal)}</div>
                        </div>
                        {order.paymentUrl && <a href={order.paymentUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-brand-600 text-white px-5 py-3 text-sm font-semibold">Buka halaman pembayaran TriPay</a>}
                      </div>
                    );
                  }
                  if (order.paymentUrl) {
                    return <a href={order.paymentUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-brand-600 text-white px-6 py-3 text-sm font-semibold">Lanjutkan Pembayaran TriPay</a>;
                  }
                }

                if (isDoit) {
                  if (doitRail === 'qris' || doitQrImage) {
                    return (
                      <div className="flex flex-col items-center space-y-4 w-full max-w-sm mx-auto">
                        <div className="text-center space-y-1">
                          <h3 className="text-sm font-bold text-slate-900">Scan QRIS Untuk Membayar</h3>
                          <p className="text-[11px] text-slate-500">Mendukung seluruh Mobile Banking &amp; E-Wallet berstandar QRIS</p>
                        </div>
                        {doitQrImage ? (
                          <div className="bg-white p-3 rounded-2xl border-2 border-brand-100 shadow-sm">
                            <img src={doitQrImage} alt="QRIS" className="w-48 h-48 sm:w-56 sm:h-56 object-contain" />
                          </div>
                        ) : (
                          <div className="p-4 bg-amber-50 rounded-xl text-xs text-amber-700 text-center">
                            Memuat QR Code pembayaran...
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-[10px] text-brand-600 font-bold bg-brand-50 px-3 py-1.5 rounded-full animate-pulse">
                          <Clock className="w-3 h-3" />
                          <span>MENUNGGU PEMBAYARAN</span>
                        </div>
                        <div className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                          <span className="text-xs text-slate-500 block">Total Tagihan</span>
                          <span className="text-base font-black text-brand-600">{formatRupiah(displayTotal)}</span>
                        </div>
                      </div>
                    );
                  }

                  if (doitRail === 'va' || doitVaNumber) {
                    return (
                      <div className="flex flex-col items-center space-y-4 w-full max-w-md mx-auto">
                        <div className="w-full bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-5 space-y-4">
                          {/* Header Bank */}
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-3">
                              <img 
                                src={bankInfo.logo} 
                                alt={bankInfo.name} 
                                className="h-6 w-auto max-w-[80px] object-contain" 
                              />
                              <span className="font-bold text-sm text-slate-800">{bankInfo.name}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Virtual Account
                            </span>
                          </div>

                          {/* Nomor VA */}
                          <div>
                            <span className="text-[11px] font-medium text-slate-500 block mb-1">Nomor Virtual Account</span>
                            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
                              <span className="font-mono text-base sm:text-lg font-bold text-slate-900 tracking-wider">
                                {doitVaNumber || "Menyiapkan nomor VA..."}
                              </span>
                              {doitVaNumber && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(String(doitVaNumber));
                                    setCopiedVa(true);
                                    setTimeout(() => setCopiedVa(false), 2000);
                                  }}
                                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                                >
                                  {copiedVa ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                  <span>{copiedVa ? "Tersalin!" : "Salin"}</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Total Nominal Transfer */}
                          <div className="flex justify-between items-center py-2 px-1 border-t border-slate-100">
                            <span className="text-xs text-slate-500">Total Pembayaran</span>
                            <span className="text-base font-black text-brand-600">{formatRupiah(displayTotal)}</span>
                          </div>

                          {/* Petunjuk Transfer */}
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600 space-y-1">
                            <p className="font-semibold text-slate-800">Petunjuk Singkat:</p>
                            <ul className="list-disc list-inside space-y-0.5 text-slate-500 text-[10px]">
                              <li>Buka m-Banking atau ATM {bankInfo.name}</li>
                              <li>Pilih menu Transfer &gt; Virtual Account</li>
                              <li>Masukkan nomor VA di atas dan pastikan nominal sesuai</li>
                            </ul>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-brand-600 font-bold bg-brand-50 px-3 py-1.5 rounded-full animate-pulse">
                          <Clock className="w-3 h-3" />
                          <span>MENUNGGU PEMBAYARAN</span>
                        </div>
                      </div>
                    );
                  }

                  // Controlled recovery state if neither QR nor VA data is available
                  return (
                    <div className="flex flex-col items-center space-y-3 p-6 bg-slate-50 border border-slate-200 rounded-2xl max-w-md mx-auto text-center">
                      <Clock className="w-8 h-8 text-brand-600 animate-spin" />
                      <h4 className="text-sm font-bold text-slate-800">Memproses Sesi Pembayaran</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Sistem sedang menghubungkan instruksi pembayaran resmi.
                      </p>
                      {order.paymentUrl && (
                        <button
                          onClick={async () => {
                            setActionError(null);
                            await loadDoitEmbed();
                            if (window.doit && typeof window.doit.open === "function") {
                              window.doit.open(order.paymentUrl!, {
                                closeDelay: 1500,
                                onPaid: () => window.location.reload(),
                                onExpired: () => setActionError("Sesi pembayaran telah kedaluwarsa."),
                                onClose: () => {}
                              });
                            } else {
                              window.location.href = order.paymentUrl!;
                            }
                          }}
                          className="mt-2 text-xs font-semibold px-4 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors shadow-sm"
                        >
                          Buka Pembayaran Alternatif (Doit)
                        </button>
                      )}
                    </div>
                  );
                }

                // Existing Midtrans and other gateways
                const tripayQrImage = order.qrImage || order.gatewayResponse?.qrImage;
                if (tripayQrImage) {
                  return (
                    <div className="flex flex-col items-center space-y-4 w-full">
                      <div className="text-center space-y-1">
                        <h3 className="text-sm font-bold text-slate-900">Scan QRIS Untuk Membayar</h3>
                        <p className="text-[11px] text-slate-500">Silakan scan kode QR di bawah ini</p>
                      </div>
                      <div className="bg-white p-3 rounded-2xl border-2 border-brand-100 shadow-sm">
                        <img src={tripayQrImage} alt="QRIS" className="w-48 h-48 sm:w-56 sm:h-56 object-contain" />
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-brand-600 font-bold bg-brand-50 px-3 py-1.5 rounded-full animate-pulse">
                        <Clock className="w-3 h-3" />
                        <span>MENUNGGU PEMBAYARAN</span>
                      </div>
                    </div>
                  );
                }

                return (
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
                      } else {
                        setActionError("Token atau URL pembayaran tidak ditemukan. Silakan hubungi customer support.");
                      }
                    }}
                    className="bg-brand-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-brand-700 transition-colors shadow-sm"
                  >
                    Lanjutkan Pembayaran
                  </button>
                );
              })()}

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
        <div className="p-5 sm:p-8 space-y-5 sm:space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Detail Produk</h3>
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-sm">
                <span className="text-slate-500">Produk</span>
                <span className="font-medium text-slate-900">{order.productName}</span>
              </div>
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-sm">
                <span className="text-slate-500">Nominal</span>
                <span className="font-medium text-slate-900">{order.quantity ? `${order.quantity} Item` : 'Default'}</span>
              </div>
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-sm">
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
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                <span className="text-slate-500">No. Invoice</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-slate-900">{order.invoice || order.id}</span>
                  <button onClick={() => copyToClipboard(order.invoice || order.id)} className="text-brand-600 hover:text-brand-700"><Copy className="w-4 h-4"/></button>
                </div>
              </div>
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-sm">
                <span className="text-slate-500">Tanggal</span>
                <span className="font-medium text-slate-900">{new Date(order.createdAt).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-sm">
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
