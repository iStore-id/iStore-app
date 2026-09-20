import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Shield, ArrowLeft, RefreshCw, AlertCircle, Mail, Phone, MapPin, Calendar, Clock, FileCheck } from "lucide-react";
import { PublicPrivacySettings } from "../types/privacy";
import { useSEO } from "../lib/seo";

export default function PrivacyPolicyPage() {
  const [privacyData, setPrivacyData] = useState<PublicPrivacySettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useSEO({
    title: privacyData?.privacyPolicy.title || "Kebijakan Privasi",
    description: "Kebijakan Privasi resmi Toko Kami mengenai pengumpulan, perlindungan, penggunaan, dan keamanan data pengguna saat transaksi top up game.",
    keywords: ["kebijakan privasi", "privacy policy istore", "keamanan data transaksi", "dpo istore id"],
    canonicalPath: "/privacy",
    ogType: "website"
  });

  const fetchPrivacy = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/public/privacy");
      const json = await res.json();
      if (json.success && json.data) {
        setPrivacyData(json.data);
      } else {
        setError(json.message || "Gagal memuat kebijakan privasi.");
      }
    } catch (e: any) {
      setError("Gagal menghubungi server untuk memuat kebijakan privasi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrivacy();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 py-8 sm:py-12">
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
          <Link
            to="/terms"
            className="text-xs sm:text-sm font-medium text-brand-600 hover:underline"
          >
            Lihat Syarat & Ketentuan →
          </Link>
        </div>

        {loading ? (
          <div className="py-24 text-center space-y-3 bg-white border border-slate-200 rounded-3xl shadow-xs">
            <RefreshCw className="w-8 h-8 text-brand-600 animate-spin mx-auto" />
            <p className="text-slate-500 text-sm font-medium">Memuat Kebijakan Privasi...</p>
          </div>
        ) : error || !privacyData ? (
          <div className="p-8 bg-red-50 border border-red-200 rounded-3xl text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <h3 className="text-base font-bold text-red-800">Gagal Memuat Halaman</h3>
            <p className="text-red-700 text-sm font-medium">{error || "Terjadi kesalahan sistem."}</p>
            <button
              type="button"
              onClick={fetchPrivacy}
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
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold mb-1">
                    <FileCheck className="w-3 h-3 text-brand-600" />
                    <span>Versi {privacyData.privacyPolicy.version || "1.0.0"}</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {privacyData.privacyPolicy.title || "Kebijakan Privasi"}
                  </h1>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Diperbarui: {new Date(privacyData.privacyPolicy.lastUpdated).toLocaleDateString("id-ID", { dateStyle: "long" })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Berlaku efektif sejak publikasi</span>
                </div>
              </div>
            </div>

            {/* Content Body */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-6">
              <div className="text-slate-800 text-sm sm:text-base leading-relaxed space-y-4 whitespace-pre-wrap font-sans">
                {privacyData.privacyPolicy.content}
              </div>
            </div>

            {/* DPO & Contact Information Box */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 sm:p-8 space-y-4 shadow-md">
              <div className="flex items-center gap-2 text-brand-400 text-xs font-bold uppercase tracking-wider">
                <Shield className="w-4 h-4" />
                <span>Petugas Perlindungan Data (DPO)</span>
              </div>
              <h2 className="text-lg font-bold text-white">Ada Pertanyaan Mengenai Privasi Anda?</h2>
              <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
                Jika Anda ingin mengajukan pertanyaan seputar perlakuan data pribadi Anda, permohonan ekspor data, atau penutupan akun, silakan hubungi tim perlindungan data resmi kami:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                {privacyData.dpoContact.name && (
                  <div className="flex items-center gap-2 text-slate-200">
                    <span className="font-semibold text-slate-400">Kontak:</span>
                    <span>{privacyData.dpoContact.name}</span>
                  </div>
                )}
                {privacyData.dpoContact.email && (
                  <div className="flex items-center gap-2 text-slate-200">
                    <Mail className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                    <a href={`mailto:${privacyData.dpoContact.email}`} className="text-brand-300 hover:underline">
                      {privacyData.dpoContact.email}
                    </a>
                  </div>
                )}
                {privacyData.dpoContact.phone && (
                  <div className="flex items-center gap-2 text-slate-200">
                    <Phone className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                    <span>{privacyData.dpoContact.phone}</span>
                  </div>
                )}
                {privacyData.dpoContact.address && (
                  <div className="flex items-start gap-2 text-slate-200 sm:col-span-2">
                    <MapPin className="w-3.5 h-3.5 text-brand-400 shrink-0 mt-0.5" />
                    <span>{privacyData.dpoContact.address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
