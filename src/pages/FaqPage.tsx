import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, HelpCircle, MessageCircle, ArrowLeft, RefreshCw, AlertCircle, Mail } from "lucide-react";
import FaqAccordion from "../components/FaqAccordion";
import { PublicFAQItem } from "../types/faq";
import { useSEO } from "../lib/seo";

export default function FaqPage() {
  const [faqs, setFaqs] = useState<PublicFAQItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [contactInfo, setContactInfo] = useState<{
    name?: string;
    whatsapp?: string;
    email?: string;
  }>({});

  useEffect(() => {
    fetch("/api/public/store-config")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setContactInfo({
            name: json.data.name || "Toko Kami",
            whatsapp: json.data.contactInformation?.whatsapp || "",
            email: json.data.contactInformation?.email || ""
          });
        }
      })
      .catch(() => {});
  }, []);

  useSEO({
    title: activeCategory !== "ALL" ? `FAQ ${activeCategory} - Pusat Bantuan` : "Pusat Bantuan & FAQ",
    description: "Pertanyaan yang sering diajukan mengenai cara top up game, konfirmasi pembayaran otomatis, pengembalian dana, dan keamanan akun di Toko Kami.",
    keywords: ["faq top up", "bantuan istore", "cara top up game", "pembayaran qris game", "istore id"],
    canonicalPath: "/faq",
    ogType: "website",
    jsonLd: faqs.length > 0 ? {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.slice(0, 10).map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    } : undefined
  });

  const fetchFaqs = async (cat: string = activeCategory, search: string = searchQuery) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (cat !== "ALL") params.append("category", cat);
      if (search.trim()) params.append("search", search.trim());

      const res = await fetch(`/api/public/faq?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setFaqs(json.data || []);
        if (json.categories && json.categories.length > 0) {
          setCategories(json.categories);
        }
      } else {
        setError(json.message || "Gagal memuat daftar FAQ.");
      }
    } catch (e: any) {
      console.error("[FaqPage Error]:", e);
      setError("Terjadi kendala jaringan saat memuat FAQ. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaqs(activeCategory, searchQuery);
  }, [activeCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFaqs(activeCategory, searchQuery);
  };

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link to="/" className="hover:text-slate-800 transition-colors flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Beranda</span>
          </Link>
        </div>

        {/* Hero & Search Header */}
        <div className="text-center space-y-4 pt-2 pb-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-100 text-primary mb-1 shadow-xs">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h1 className="ui-page-title text-slate-900">
            Pusat Bantuan & Pertanyaan Umum
          </h1>
          <p className="text-slate-600 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            Temukan jawaban cepat seputar transaksi, metode pembayaran, keamanan akun, dan panduan top up di Toko Kami.
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto mt-6">
            <div className="relative flex items-center">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari pertanyaan, misal: durasi diamond, QRIS, voucher..."
                className="w-full pl-11 pr-24 py-3.5 bg-white border border-slate-200 rounded-full text-slate-900 placeholder-slate-400 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 shadow-sm transition"
              />
              <button
                type="submit"
                className="absolute right-2 px-4 py-2 bg-primary hover:bg-brand-700 text-white text-xs sm:text-sm font-semibold rounded-full transition shadow-xs"
              >
                Cari
              </button>
            </div>
          </form>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center justify-center flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={() => setActiveCategory("ALL")}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
              activeCategory === "ALL"
                ? "bg-primary text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            Semua Topik
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                activeCategory === cat
                  ? "bg-primary text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* FAQ Accordion Content */}
        <div className="pt-2">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-brand-500 animate-spin mx-auto" />
              <p className="text-slate-500 text-sm font-medium">Memuat pertanyaan umum...</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
              <p className="text-red-700 text-sm font-medium">{error}</p>
              <button
                type="button"
                onClick={() => fetchFaqs(activeCategory, searchQuery)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba Lagi</span>
              </button>
            </div>
          ) : (
            <FaqAccordion
              items={faqs}
              allowMultiple={true}
              defaultOpenIndex={0}
              showCategoryBadge={activeCategory === "ALL"}
            />
          )}
        </div>

        {/* Unresolved Contact Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-xs mt-12">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Belum Menemukan Jawaban?</h2>
            <p className="text-slate-600 text-sm max-w-md mx-auto mt-1">
              Tim Customer Support kami siap membantu Anda 24/7 jika ada kendala dengan pesanan atau pembayaran Anda.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            {contactInfo.whatsapp ? (
              <a
                href={`https://wa.me/${contactInfo.whatsapp.replace(/\D/g, "")}?text=Halo%20Admin%20${encodeURIComponent(contactInfo.name || "Toko Kami")},%20saya%20butuh%20bantuan`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Hubungi WhatsApp Support</span>
              </a>
            ) : contactInfo.email ? (
              <a
                href={`mailto:${contactInfo.email}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-sm transition"
              >
                <Mail className="w-4 h-4" />
                <span>Hubungi Email Support</span>
              </a>
            ) : (
              <a
                href="mailto:support@istore.co.id"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-sm transition"
              >
                <Mail className="w-4 h-4" />
                <span>Hubungi Dukungan Pelanggan</span>
              </a>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
