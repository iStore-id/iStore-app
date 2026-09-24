import React, { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/auth-store";
import {
  BookOpen,
  Clock,
  Calendar,
  ArrowLeft,
  Share2,
  Copy,
  Check,
  Tag,
  Gamepad2,
  Flame,
  Layout,
  Eye,
  CheckCircle2
} from "lucide-react";
import { PublicBlogDetail, PublicBlogItem } from "../types/blog";
import BlogContentRenderer from "../components/BlogContentRenderer";
import BlogCard from "../components/blog/BlogCard";
import { useSEO } from "../lib/seo";

export default function BlogDetailPage() {
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const location = useLocation();
  const { user } = useAuthStore();

  const isPreviewMode = location.pathname.includes("/admin/blog/") && location.pathname.includes("/preview");

  const [articlesList, setArticlesList] = useState<PublicBlogItem[]>([]);
  const [blog, setBlog] = useState<PublicBlogDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPromo, setCopiedPromo] = useState(false);
  const [storeName, setStoreName] = useState("Toko Kami");
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  // 1. Fetch store configuration
  useEffect(() => {
    fetch("/api/public/store-config")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data?.name) {
          setStoreName(data.data.name);
        }
      })
      .catch(() => {});
  }, []);

  // 2. Fetch list of all published articles to determine unread sequence
  useEffect(() => {
    let isMounted = true;
    const fetchArticlesList = async () => {
      try {
        const res = await fetch("/api/public/blog?limit=50");
        if (!res.ok) return;
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data)) {
          setArticlesList(json.data);
        }
      } catch (err) {
        console.warn("Notice: Failed to load published articles list", err);
      }
    };

    fetchArticlesList();
    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Fetch Full Article Content for the active article (slug / id)
  useEffect(() => {
    let isCurrent = true;
    const currentIdentifier = isPreviewMode ? (id || slug) : slug;

    if (!currentIdentifier) {
      setError("Slug artikel tidak valid atau tidak ditemukan.");
      setLoading(false);
      return;
    }

    const fetchBlogDetail = async () => {
      try {
        setLoading(true);
        setError(null);

        let url = "";
        const headers: Record<string, string> = {};

        if (isPreviewMode) {
          url = `/api/admin/blog/${encodeURIComponent(currentIdentifier)}/preview`;
          const token = await (user as any)?.getIdToken?.();
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }
        } else {
          url = `/api/public/blog/${encodeURIComponent(currentIdentifier)}`;
        }

        const res = await fetch(url, { headers });
        const json = await res.json();

        if (!isCurrent) return;

        if (json.success && json.data) {
          setBlog(json.data);
        } else {
          setBlog(null);
          setError(json.message || "Artikel tidak ditemukan atau belum aktif.");
        }
      } catch (err: any) {
        if (!isCurrent) return;
        setBlog(null);
        setError(err.message || "Terjadi kesalahan saat memuat artikel.");
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    };

    fetchBlogDetail();
    window.scrollTo({ top: 0, behavior: "smooth" });

    return () => {
      isCurrent = false;
    };
  }, [slug, id, isPreviewMode, user]);

  // SEO
  useSEO({
    title: blog ? (blog.seoTitle || blog.title) : undefined,
    description: blog ? (blog.seoDescription || blog.excerpt) : undefined,
    keywords: blog?.tags && blog.tags.length > 0 ? blog.tags : undefined,
    canonicalPath: blog?.slug ? `/blog/${blog.slug}` : undefined,
    ogImage: blog?.coverMediaUrl || undefined,
    ogType: "article",
    publishedTime: blog?.publishedAt,
    modifiedTime: blog?.updatedAt,
    author: blog?.author,
    noindex: isPreviewMode,
    jsonLd: blog ? {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": blog.title,
      "description": blog.excerpt || blog.seoDescription,
      "image": blog.coverMediaUrl ? [blog.coverMediaUrl] : undefined,
      "datePublished": blog.publishedAt || blog.createdAt,
      "dateModified": blog.updatedAt || blog.publishedAt,
      "author": {
        "@type": "Person",
        "name": blog.author || `Tim Redaksi ${storeName}`
      },
      "publisher": {
        "@type": "Organization",
        "name": storeName,
        "url": baseUrl
      }
    } : undefined
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyPromoCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedPromo(true);
    setTimeout(() => setCopiedPromo(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!blog) return;
    const text = encodeURIComponent(`Baca artikel menarik: "${blog.title}" di ${storeName}\n${window.location.href}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleShareTwitter = () => {
    if (!blog) return;
    const text = encodeURIComponent(`Baca "${blog.title}" di @istoreid`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(window.location.href)}`, "_blank");
  };

  // Find index of current active article to derive unread articles
  const currentIdentifier = isPreviewMode ? (id || slug) : slug;
  const currentIndex = articlesList.findIndex(
    b => b.slug === currentIdentifier || b.id === currentIdentifier
  );

  // Unread articles are the remaining articles after the current active article
  const unreadArticles: PublicBlogItem[] =
    currentIndex !== -1
      ? articlesList.slice(currentIndex + 1)
      : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-medium text-slate-500">Memuat artikel...</p>
        </div>
      </div>
    );
  }

  if (error || !blog) {
    return (
      <div className="min-h-[70vh] bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <BookOpen className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Artikel Tidak Ditemukan</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            {error || "Artikel ini tidak tersedia, sudah kadaluarsa, atau URL yang Anda masukkan salah."}
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24">
      {/* Admin Preview Mode Banner */}
      {isPreviewMode && (
        <div className="bg-amber-500 text-slate-950 px-4 py-3 text-center text-xs sm:text-sm font-bold flex items-center justify-center gap-2 sticky top-0 z-40 shadow-md">
          <Eye className="w-4 h-4" />
          <span>
            Mode Pratinjau Admin — Status Artikel: <u>{blog.status}</u>. Artikel ini hanya dapat dilihat oleh pengelola.
          </span>
          <Link
            to="/admin/blog"
            className="ml-3 px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
          >
            Tutup Pratinjau
          </Link>
        </div>
      )}

      {/* Top Breadcrumb Bar */}
      <div className="bg-white border-b border-slate-200/80">
        <div className="max-w-[1600px] mx-auto px-2 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
            <Link to="/" className="hover:text-brand-600 transition-colors">
              Beranda
            </Link>
            <span>/</span>
            <Link to="/" className="hover:text-brand-600 transition-colors">
              Blog & Berita
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-medium truncate">{blog.category || "Berita"}</span>
          </div>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-brand-600 transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Beranda
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ARTIKEL AKTIF (FULL CONTENT ARTIKEL) */}
      {/* ========================================================================= */}
      <article className="max-w-[1600px] mx-auto px-2 sm:px-6 pt-8 sm:pt-12">
        {/* Article Meta & Header */}
        <header className="space-y-4 text-left">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200">
              {blog.category || "Berita"}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {blog.readTime || 1} menit baca
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {new Date(blog.publishedAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric"
              })}
            </span>
          </div>

          <h1 className="ui-page-title text-slate-900 mb-2">
            {blog.title}
          </h1>

          {blog.excerpt && (
            <p className="ui-subheading text-slate-500 pt-1">
              {blog.excerpt}
            </p>
          )}

          {/* Author Info & Share */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                {blog.author ? blog.author.charAt(0).toUpperCase() : "I"}
              </div>
              <div>
                <div className="font-bold text-sm text-slate-900">{blog.author || "Tim Editorial"}</div>
                <div className="text-xs text-slate-400">Tim Editorial {storeName}</div>
              </div>
            </div>

            {/* Social Share Buttons */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
                <Share2 className="w-3.5 h-3.5" /> Bagikan:
              </span>
              <button
                onClick={handleShareWhatsApp}
                title="Bagikan ke WhatsApp"
                className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer border border-emerald-200"
              >
                <span className="text-xs font-bold">WA</span>
              </button>
              <button
                onClick={handleShareTwitter}
                title="Bagikan ke Twitter / X"
                className="p-2 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer border border-slate-200"
              >
                <span className="text-xs font-bold">X</span>
              </button>
              <button
                onClick={handleCopyLink}
                title="Salin Tautan Artikel"
                className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer border border-slate-200"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </header>

        {/* Cover Image from Media Library */}
        {blog.coverMediaUrl && (
          <figure className="my-8 rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm">
            <img
              src={blog.coverMediaUrl}
              alt={blog.title}
              className="w-full h-auto max-h-[520px] object-cover"
            />
          </figure>
        )}

        {/* Article Body Content */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-10 border border-slate-200/80 shadow-xs my-8">
          <BlogContentRenderer content={blog.content} />

          {/* Tags */}
          {blog.tags && blog.tags.length > 0 && (
            <div className="mt-12 pt-6 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Tags:</span>
              {blog.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Related Commerce & Promo Sections */}
        {(blog.relatedGame || blog.relatedPromo || blog.relatedCampaign || blog.relatedLanding) && (
          <section className="space-y-4 my-10">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Rekomendasi Terkait Artikel</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Game Card */}
              {blog.relatedGame && (
                <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-brand-900 to-brand-900 text-white flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md overflow-hidden border border-white/20 shrink-0 flex items-center justify-center">
                      {blog.relatedGame.image ? (
                        <img
                          src={blog.relatedGame.image}
                          alt={blog.relatedGame.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Gamepad2 className="w-7 h-7 text-white" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-brand-300 uppercase tracking-wide">
                        Top Up Game Resmi
                      </div>
                      <h4 className="font-bold text-base text-white">{blog.relatedGame.name}</h4>
                      <p className="text-xs text-brand-200">Proses otomatis detik ini juga</p>
                    </div>
                  </div>

                  <Link
                    to={`/games/${blog.relatedGame.slug}`}
                    className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-colors shrink-0 shadow-sm"
                  >
                    Beli Sekarang
                  </Link>
                </div>
              )}

              {/* Promo Voucher Card */}
              {blog.relatedPromo && (
                <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-emerald-50 border border-emerald-200 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Tag className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                        Voucher Diskon
                      </div>
                      <h4 className="font-bold text-sm text-emerald-950">{blog.relatedPromo.name}</h4>
                      <div className="text-xs text-emerald-800">
                        Hemat {blog.relatedPromo.discountValue}
                        {blog.relatedPromo.discountType === "percentage" ? "%" : " IDR"}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopyPromoCode(blog.relatedPromo!.code)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    {copiedPromo ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Tersalin
                      </>
                    ) : (
                      <>
                        <span>{blog.relatedPromo.code}</span>
                        <Copy className="w-3 h-3 opacity-80" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Landing Page Card */}
              {blog.relatedLanding && (
                <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-brand-50 border border-brand-200 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center shrink-0">
                      <Layout className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-brand-700 uppercase tracking-wide">
                        Halaman Khusus
                      </div>
                      <h4 className="font-bold text-sm text-brand-950">{blog.relatedLanding.title}</h4>
                      <p className="text-xs text-brand-800">Lihat event dan penawaran eksklusif</p>
                    </div>
                  </div>

                  <Link
                    to={`/promo/${blog.relatedLanding.slug}`}
                    className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-colors shrink-0"
                  >
                    Buka Halaman
                  </Link>
                </div>
              )}

              {/* Campaign Card */}
              {blog.relatedCampaign && (
                <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center shrink-0">
                      <Flame className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                        Kampanye Aktif
                      </div>
                      <h4 className="font-bold text-sm text-amber-950">{blog.relatedCampaign.title}</h4>
                      <p className="text-xs text-amber-800">Ikuti promo flash sale dan diskon besar</p>
                    </div>
                  </div>

                  <Link
                    to="/"
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shrink-0"
                  >
                    Jelajahi Promo
                  </Link>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* ARTIKEL YANG BELUM DIBACA (PREVIEW MENGGUNAKAN BLOGCARD HOMEPAGE) */}
        {/* ========================================================================= */}
        {unreadArticles.length > 0 && (
          <div className="pt-10 border-t border-slate-200/80">
            {/* 
              Responsive & Adaptive container matching homepage layout:
              - Mobile (< 640px): Flexible horizontal snap-carousel with compact cards (w-[230px] to w-[250px]).
              - Tablet & Desktop (>= 640px): CSS Auto-fill grid (minmax 260px, 1fr) adapting fluidly.
            */}
            <div className="flex sm:grid sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5 sm:gap-5 lg:gap-6 overflow-x-auto sm:overflow-visible pb-3 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory no-scrollbar scroll-smooth">
              {unreadArticles.map((unreadItem) => (
                <BlogCard
                  key={unreadItem.id}
                  blog={unreadItem}
                  className="w-[230px] xs:w-[250px] sm:w-auto shrink-0 snap-start"
                  headingLevel="h3"
                />
              ))}
            </div>
          </div>
        )}

        {/* Bottom Back to Home Button */}
        <div className="pt-10 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-bold transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Beranda
          </Link>
        </div>
      </article>
    </div>
  );
}
