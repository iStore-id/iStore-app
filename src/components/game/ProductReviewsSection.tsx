import React, { useState, useEffect, useCallback } from "react";
import { 
  Star, 
  MessageSquare, 
  ShieldCheck, 
  User, 
  Send, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  LogIn 
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../store/auth-store";
import { supabaseGetAccessToken } from "../../lib/supabase-auth";

export interface ReviewItem {
  id: string;
  customerId: string;
  customerName?: string;
  productId: string;
  variantId?: string;
  orderId?: string;
  rating: number;
  content: string;
  status: "published" | "hidden" | "rejected";
  verifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSummary {
  averageRating: number;
  reviewCount: number;
}

interface ProductReviewsSectionProps {
  productId: string;
  productName?: string;
  variantId?: string;
  cardColor?: string;
  cardOpacity?: number;
  cardBlur?: string;
}

export const ProductReviewsSection: React.FC<ProductReviewsSectionProps> = ({
  productId,
  productName,
  variantId,
  cardColor = "#ffffff",
  cardOpacity = 100,
  cardBlur = "none",
}) => {
  const { user } = useAuthStore();

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>({ averageRating: 0, reviewCount: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [content, setContent] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [orderId, setOrderId] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Initialize customer name from user profile
  useEffect(() => {
    if (user?.displayName) {
      setCustomerName(user.displayName);
    } else if (user?.email) {
      setCustomerName(user.email.split("@")[0]);
    }
  }, [user]);

  // Fetch reviews for this productId
  const fetchReviews = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setFetchError(null);
    try {
      const resp = await fetch(`/api/products/${productId}/reviews`);
      const json = await resp.json();
      if (!resp.ok || !json.success) {
        throw new Error(json.error || "Gagal memuat ulasan produk");
      }
      setReviews(json.data?.reviews || []);
      setSummary(json.data?.summary || { averageRating: 0, reviewCount: 0 });
    } catch (err: any) {
      setFetchError(err.message || "Terjadi kesalahan saat memuat ulasan.");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Handle submit review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setSubmitError("Silakan login terlebih dahulu untuk memberikan ulasan.");
      return;
    }
    if (!content.trim()) {
      setSubmitError("Isi ulasan tidak boleh kosong.");
      return;
    }
    if (rating < 1 || rating > 5) {
      setSubmitError("Rating harus antara 1 sampai 5 bintang.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const token = await supabaseGetAccessToken();
      if (!token) {
        throw new Error("Sesi login Anda tidak valid atau telah berakhir. Silakan login kembali.");
      }

      const payload: Record<string, any> = {
        productId,
        rating,
        content: content.trim(),
      };

      if (customerName.trim()) {
        payload.customerName = customerName.trim();
      }
      if (variantId) {
        payload.variantId = variantId;
      }
      if (orderId.trim()) {
        payload.orderId = orderId.trim();
      }

      const resp = await fetch("/api/customer/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await resp.json();
      if (!resp.ok || !json.success) {
        throw new Error(json.error || "Gagal mengirim ulasan.");
      }

      setSubmitSuccess("Terima kasih! Ulasan Anda berhasil diterbitkan.");
      setContent("");
      setOrderId("");
      
      // Refresh list
      await fetchReviews();

      // Close modal after brief delay
      setTimeout(() => {
        setIsModalOpen(false);
        setSubmitSuccess(null);
      }, 1500);
    } catch (err: any) {
      setSubmitError(err.message || "Gagal mengirim ulasan.");
    } finally {
      setSubmitting(false);
    }
  };

  const getRatingLabel = (stars: number) => {
    switch (stars) {
      case 5: return "Sangat Puas ⭐⭐⭐⭐⭐";
      case 4: return "Puas ⭐⭐⭐⭐";
      case 3: return "Cukup ⭐⭐⭐";
      case 2: return "Kurang ⭐⭐";
      case 1: return "Kecewa ⭐";
      default: return "";
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div 
      id="product-reviews-section"
      className="rounded-3xl p-6 md:p-8 shadow-sm border mt-8 transition-all bg-white border-slate-100"
    >
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="w-2 h-6 bg-brand-600 rounded-full" />
            Ulasan Pelanggan
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Ulasan asli dari pembeli {productName ? `layanan ${productName}` : "produk ini"}
          </p>
        </div>

        {/* Action Button */}
        <div>
          <button
            type="button"
            id="btn-open-review-modal"
            onClick={() => {
              setSubmitError(null);
              setSubmitSuccess(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-sm transition-all active:scale-[0.98]"
          >
            <MessageSquare className="w-4 h-4" />
            Tulis Ulasan
          </button>
        </div>
      </div>

      {/* Summary Score Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6 p-4 md:p-6 bg-slate-50 rounded-2xl border border-slate-100">
        {/* Average Rating Big */}
        <div className="flex flex-col items-center justify-center text-center py-2 md:border-r border-slate-200">
          <div className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
            {summary.averageRating > 0 ? summary.averageRating.toFixed(1) : "0.0"}
          </div>
          <div className="flex items-center gap-1 my-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 ${
                  star <= Math.round(summary.averageRating)
                    ? "text-amber-400 fill-amber-400"
                    : "text-slate-300"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Berdasarkan {summary.reviewCount} ulasan pembeli
          </span>
        </div>

        {/* Feature Highlights */}
        <div className="md:col-span-2 flex flex-col justify-center gap-3 py-1 px-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Ulasan Terverifikasi</h4>
              <p className="text-[11px] text-slate-500">
                Ulasan ditandai khusus jika sistem mengonfirmasi riwayat transaksi pelanggan.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
              <Star className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Transparan & Real-Time</h4>
              <p className="text-[11px] text-slate-500">
                Semua ulasan yang tampil merupakan testimoni publik yang telah melalui proses moderasi.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Review List Content */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs">Memuat ulasan pelanggan...</p>
          </div>
        ) : fetchError ? (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{fetchError}</span>
          </div>
        ) : reviews.length === 0 ? (
          <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Belum Ada Ulasan</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
              Jadilah pelanggan pertama yang membagikan pengalaman bertransaksi untuk produk ini!
            </p>
            <button
              type="button"
              onClick={() => {
                setSubmitError(null);
                setSubmitSuccess(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              Tulis Ulasan Pertama
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.map((rev) => (
              <div
                key={rev.id}
                id={`review-card-${rev.id}`}
                className="p-5 rounded-2xl border border-slate-100 bg-white hover:border-slate-200 transition-shadow hover:shadow-sm flex flex-col justify-between"
              >
                <div>
                  {/* Review Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-sm shrink-0 border border-brand-100">
                        {rev.customerName ? rev.customerName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs md:text-sm font-bold text-slate-900">
                            {rev.customerName || "Pelanggan iStore"}
                          </span>
                          {rev.verifiedPurchase && (
                            <span 
                              id={`badge-verified-${rev.id}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                              title="Transaksi terverifikasi di sistem"
                            >
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              Verified
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {formatDate(rev.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Star Rating */}
                    <div className="flex items-center gap-0.5 shrink-0 bg-amber-50/80 px-2 py-1 rounded-lg border border-amber-100/80">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= rev.rating
                              ? "text-amber-400 fill-amber-400"
                              : "text-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Review Content */}
                  <p className="text-xs md:text-sm text-slate-700 leading-relaxed whitespace-pre-line mt-2">
                    {rev.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal / Dialog Tulis Ulasan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div 
            id="review-modal-card"
            className="w-full max-w-lg bg-white rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto"
          >
            {/* Close Button */}
            <button
              type="button"
              id="btn-close-review-modal"
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Title */}
            <div className="mb-6">
              <h3 className="text-lg md:text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-brand-600 rounded-full" />
                Beri Ulasan Produk
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Ceritakan kepuasan Anda bertransaksi di iStore
              </p>
            </div>

            {/* State if user not logged in */}
            {!user ? (
              <div className="py-6 px-4 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mx-auto">
                  <LogIn className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Perlu Masuk Akun</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Untuk menjamin keaslian ulasan, Anda harus login terlebih dahulu sebelum memberikan rating.
                  </p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Batal
                  </button>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    Masuk Sekarang
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-5">
                {/* Notification Alerts */}
                {submitError && (
                  <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{submitError}</span>
                  </div>
                )}
                {submitSuccess && (
                  <div className="p-3.5 bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
                    <span>{submitSuccess}</span>
                  </div>
                )}

                {/* Rating Stars Picker */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Rating Pelayanan & Kecepatan <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = star <= (hoverRating || rating);
                      return (
                        <button
                          key={star}
                          type="button"
                          disabled={submitting}
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-1 rounded-lg transition-transform hover:scale-110 focus:outline-none"
                        >
                          <Star
                            className={`w-7 h-7 md:w-8 md:h-8 transition-colors ${
                              active
                                ? "text-amber-400 fill-amber-400"
                                : "text-slate-200"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[11px] font-semibold text-brand-600 mt-1 block">
                    {getRatingLabel(hoverRating || rating)}
                  </span>
                </div>

                {/* Customer Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nama Tampilan <span className="text-[10px] text-slate-400 font-normal">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    disabled={submitting}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nama Anda yang tampil di ulasan publik"
                    className="w-full px-4 py-2.5 text-xs md:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                {/* Order ID (Optional for verified badge) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>ID Pesanan / Invoice</span>
                    <span className="text-[10px] text-slate-400 font-normal">Opsional (Untuk Badge Verified)</span>
                  </label>
                  <input
                    type="text"
                    value={orderId}
                    disabled={submitting}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="Contoh: ORD-12345678"
                    className="w-full px-4 py-2.5 text-xs md:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Jika diisi dengan ID pesanan yang Anda selesaikan, ulasan Anda akan diberi lencana Pembelian Terverifikasi.
                  </p>
                </div>

                {/* Content TextArea */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Ulasan Anda <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={content}
                    disabled={submitting}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Tuliskan pengalaman Anda mengenai kecepatan proses, keramahan layanan, dan keberhasilan top-up..."
                    className="w-full px-4 py-3 text-xs md:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    id="btn-submit-customer-review"
                    disabled={submitting || !content.trim()}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md shadow-brand-200 transition-all disabled:opacity-50 disabled:shadow-none"
                  >
                    {submitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Mengirim...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Kirim Ulasan
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
