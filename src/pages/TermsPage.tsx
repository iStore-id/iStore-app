import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, ArrowLeft, RefreshCw, AlertCircle, Calendar, Clock, FileCheck, ShieldCheck } from "lucide-react";
import { PublicPrivacySettings } from "../types/privacy";
import { useSEO } from "../lib/seo";

export default function TermsPage() {
  const [privacyData, setPrivacyData] = useState<PublicPrivacySettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useSEO({
    title: privacyData?.termsOfService.title || "Syarat & Ketentuan Layanan",
    description: "Syarat & Ketentuan resmi layanan top up game, voucher digital, dan pemrosesan transaksi di iStore.id.",
    keywords: ["syarat dan ketentuan", "terms of service istore", "aturan transaksi istore id", "ketentuan top up game"],
    canonicalPath: "/terms",
    ogType: "website"
  });

  const fetchTerms = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/public/privacy");
      const json = await res.json();
      if (json.success && json.data) {
        setPrivacyData(json.data);
      } else {
        setError(json.message || "Syarat & Ketentuan sedang tidak dapat dimuat.");
      }
    } catch (e: any) {
      setError("Gagal menghubungi server untuk memuat Syarat & Ketentuan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTerms();
  }, []);

  return (
    <div className="min-h-screen py-8 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Beranda</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/privacy"
              className="text-xs sm:text-sm font-medium text-brand-600 hover:underline"
            >
              Kebijakan Privasi →
            </Link>
            <span className="text-slate-300">|</span>
            <Link
              to="/refund"
              className="text-xs sm:text-sm font-medium text-brand-600 hover:underline"
            >
              Kebijakan Refund →
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="py-24 text-center space-y-3 bg-white border border-slate-200 rounded-3xl shadow-xs">
            <RefreshCw className="w-8 h-8 text-brand-600 animate-spin mx-auto" />
            <p className="text-slate-500 text-sm font-medium">Memuat Syarat & Ketentuan...</p>
          </div>
        ) : error || !privacyData ? (
          <div className="p-8 bg-red-50 border border-red-200 rounded-3xl text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <h3 className="text-base font-bold text-red-800">Gagal Memuat Halaman</h3>
            <p className="text-red-700 text-sm font-medium">{error || "Syarat & Ketentuan sedang tidak dapat dimuat."}</p>
            <button
              type="button"
              onClick={fetchTerms}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Coba Lagi</span>
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Header Hero */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 border border-brand-100">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold mb-1">
                    <FileCheck className="w-3 h-3 text-brand-600" />
                    <span>Versi {privacyData.termsOfService.version || "1.0.0"}</span>
                  </div>
                  <h1 className="ui-page-title text-slate-900">
                    {privacyData.termsOfService.title || "Syarat & Ketentuan Layanan"}
                  </h1>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Diperbarui: {new Date(privacyData.termsOfService.lastUpdated).toLocaleDateString("id-ID", { dateStyle: "long" })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Berlaku efektif untuk setiap transaksi</span>
                </div>
              </div>
            </div>

            {/* Content Body */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-6">
              <div className="text-slate-800 text-sm sm:text-base leading-relaxed space-y-4 whitespace-pre-wrap font-sans">
                {privacyData.termsOfService.content}
              </div>
            </div>

            {/* Summary Notice Box */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 sm:p-8 space-y-4 shadow-md">
              <div className="flex items-center gap-2 text-brand-400 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Komitmen Layanan & Garansi Transaksi</span>
              </div>
              <h2 className="text-lg font-bold text-white">Butuh Informasi Pengembalian Dana atau Bantuan?</h2>
              <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
                Seluruh pesanan Anda diproses melalui payment gateway berizin resmi dan terhubung langsung ke server provider terpercaya. Jika Anda mengalami kendala pada pesanan atau membutuhkan verifikasi pembayaran, silakan pelajari kebijakan pengembalian dana kami atau hubungi tim bantuan.
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Link
                  to="/refund"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition shadow-sm"
                >
                  <span>Baca Kebijakan Refund</span>
                </Link>
                <Link
                  to="/faq"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs transition"
                >
                  <span>Pertanyaan Umum (FAQ)</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
