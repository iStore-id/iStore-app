import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  Search,
  Clock,
  Calendar,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  User,
  Tag,
  Sparkles,
  Flame,
  Gamepad2
} from "lucide-react";
import { PublicBlogItem } from "../types/blog";
import { useSEO, useSEOSettings, buildCanonicalUrl } from "../lib/seo";

export default function BlogListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [blogs, setBlogs] = useState<PublicBlogItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const currentCategory = searchParams.get("category") || "ALL";
  const currentSearch = searchParams.get("search") || "";

  const [searchInput, setSearchInput] = useState(currentSearch);

  const seoSettings = useSEOSettings();
  const canonicalBase = seoSettings.canonicalBaseUrl || (typeof window !== "undefined" ? window.location.origin : "https://ist.web.id");

  useSEO({
    title: currentCategory !== "ALL" ? `Artikel ${currentCategory} - Blog & Berita Game` : "Blog & Berita Game Terkini",
    description: "Temukan tips bermain, strategi meta game, panduan top up, dan berita update game terhangat di Toko Kami.",
    keywords: ["blog game", "berita game", "tips mobile legends", "update game online", "istore id"],
    canonicalPath: "/blog",
    ogType: "website",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Beranda",
          "item": buildCanonicalUrl(canonicalBase, "/")
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Blog",
          "item": buildCanonicalUrl(canonicalBase, "/blog")
        }
      ]
    }
  });

  useEffect(() => {
    fetchPublicBlogs();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage, currentCategory, currentSearch]);

  const fetchPublicBlogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "9"
      });
      if (currentCategory && currentCategory !== "ALL") {
        params.set("category", currentCategory);
      }
      if (currentSearch) {
        params.set("search", currentSearch);
      }

      const res = await fetch(`/api/public/blog?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setBlogs(json.data || []);
        if (json.categories) {
          setCategories(json.categories);
        }
      } else {
        setError(json.message || "Gagal memuat artikel blog.");
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      newParams.set("search", searchInput.trim());
    } else {
      newParams.delete("search");
    }
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  const handleCategorySelect = (cat: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (cat === "ALL") {
      newParams.delete("category");
    } else {
      newParams.set("category", cat);
    }
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  const featuredBlog = blogs.length > 0 && currentPage === 1 && !currentSearch && currentCategory === "ALL" ? blogs[0] : null;
  const standardBlogs = featuredBlog ? blogs.slice(1) : blogs;

  return (
    <div className="min-h-screen pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white py-16 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        <div className="max-w-6xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            Toko Editorial & Gaming News
          </div>
          <h1 className="ui-page-title text-white">
            Blog, Tips & Wawasan Gaming
          </h1>
          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Dapatkan berita update game terkini, panduan taktik, rekomendasi hero, serta informasi promo top up voucher termurah di Toko Kami.
          </p>

          {/* Search Box */}
          <div className="max-w-xl mx-auto pt-4">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <Search className="w-5 h-5 text-slate-400 absolute left-4" />
              <input
                type="text"
                placeholder="Cari artikel, hero, game, atau promo..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-12 pr-28 py-3.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white/15 transition-all"
              />
              <button
                type="submit"
                className="absolute right-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                Cari
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        {/* Category Pills Bar */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-2 overflow-x-auto scrollbar-none mb-10">
          <button
            onClick={() => handleCategorySelect("ALL")}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              currentCategory === "ALL"
                ? "bg-brand-600 text-white shadow-xs"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            Semua Kategori
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategorySelect(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                currentCategory === cat
                  ? "bg-brand-600 text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-24 text-center space-y-4">
            <div className="w-10 h-10 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-medium text-slate-500">Memuat artikel terbaru...</p>
          </div>
        ) : error ? (
          <div className="bg-white p-12 rounded-3xl border border-red-200 text-center space-y-3 shadow-xs">
            <BookOpen className="w-10 h-10 text-red-400 mx-auto" />
            <h3 className="text-lg font-bold text-slate-800">Gagal memuat artikel</h3>
            <p className="text-sm text-slate-500">{error}</p>
            <button
              onClick={fetchPublicBlogs}
              className="mt-2 px-5 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700"
            >
              Coba Lagi
            </button>
          </div>
        ) : blogs.length === 0 ? (
          <div className="bg-white p-16 rounded-3xl border border-slate-200 text-center space-y-3 shadow-xs my-8">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-lg font-bold text-slate-800">Belum ada artikel ditemukan</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {currentSearch
                ? `Tidak ada artikel yang sesuai dengan kata kunci "${currentSearch}".`
                : "Artikel untuk kategori ini sedang disiapkan oleh tim redaksi Toko Kami."}
            </p>
            {(currentSearch || currentCategory !== "ALL") && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setSearchParams({});
                }}
                className="mt-3 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800"
              >
                Reset Filter
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-12">
            {/* FEATURED ARTICLE HERO (If on first page without filter) */}
            {featuredBlog && (
              <Link
                to={`/blog/${featuredBlog.slug}`}
                className="group block bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-brand-300 transition-all overflow-hidden"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                  <div className="lg:col-span-7 h-64 sm:h-80 lg:h-auto bg-slate-100 overflow-hidden relative">
                    {featuredBlog.coverMediaUrl ? (
                      <img
                        src={featuredBlog.coverMediaUrl}
                        alt={featuredBlog.title}
                        className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-brand-900 to-brand-700 text-white/40">
                        <BookOpen className="w-16 h-16" />
                      </div>
                    )}
                    <span className="absolute top-4 left-4 px-3 py-1 bg-brand-600 text-white text-xs font-extrabold rounded-xl shadow-md uppercase tracking-wider flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-300" />
                      Artikel Utama
                    </span>
                  </div>

                  <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200">
                          {featuredBlog.category}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          ~{featuredBlog.readTime} mnt baca
                        </span>
                      </div>

                      <h2 className="ui-section-title text-slate-900 group-hover:text-brand-600 transition-colors">
                        {featuredBlog.title}
                      </h2>

                      <p className="text-sm sm:text-base text-slate-600 line-clamp-3 leading-relaxed">
                        {featuredBlog.excerpt}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-xs text-slate-500">
                        <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
                          {featuredBlog.author ? featuredBlog.author.charAt(0).toUpperCase() : "I"}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800">{featuredBlog.author}</span>
                          <div className="text-[11px] text-slate-400">
                            {new Date(featuredBlog.publishedAt).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric"
                            })}
                          </div>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 group-hover:translate-x-1 transition-transform">
                        Baca Artikel <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {/* ARTICLES GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {standardBlogs.map((blog) => (
                <Link
                  key={blog.id}
                  to={`/blog/${blog.slug}`}
                  className="group bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-brand-300 transition-all overflow-hidden flex flex-col"
                >
                  {/* Card Cover */}
                  <div className="h-48 bg-slate-100 overflow-hidden relative">
                    {blog.coverMediaUrl ? (
                      <img
                        src={blog.coverMediaUrl}
                        alt={blog.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400">
                        <BookOpen className="w-10 h-10" />
                      </div>
                    )}
                    <span className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-xs text-slate-800 text-xs font-bold rounded-lg shadow-xs border border-slate-200/50">
                      {blog.category}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {new Date(blog.publishedAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          })}
                        </span>
                        <span>•</span>
                        <Clock className="w-3.5 h-3.5" />
                        <span>~{blog.readTime} mnt</span>
                      </div>

                      <h3 className="font-bold text-base sm:text-lg text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-2 leading-snug">
                        {blog.title}
                      </h3>

                      <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                        {blog.excerpt}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-slate-600">
                        <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                          {blog.author ? blog.author.charAt(0).toUpperCase() : "I"}
                        </div>
                        <span className="truncate max-w-[120px] font-medium">{blog.author}</span>
                      </div>

                      <span className="font-bold text-brand-600 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Baca <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
