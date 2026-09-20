import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  ArrowLeft, 
  ExternalLink, 
  Gamepad2, 
  Tag, 
  Sparkles, 
  Clock, 
  Check, 
  Copy, 
  AlertCircle,
  Zap,
  ChevronRight
} from "lucide-react";
import { LandingBlock } from "../types/landing";
import { useSEO } from "../lib/seo";

export default function PublicLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [landing, setLanding] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useSEO({
    title: landing ? (landing.seoTitle || landing.title) : undefined,
    description: landing ? (landing.seoDescription || landing.description) : undefined,
    canonicalPath: slug ? `/landing/${slug}` : undefined,
    ogImage: landing?.mediaUrl || undefined,
    ogType: "website"
  });

  useEffect(() => {
    const fetchLanding = async () => {
      if (!slug) return;
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/public/landings/${encodeURIComponent(slug)}`);
        const json = await res.json();
        if (json.success && json.data) {
          setLanding(json.data);
        } else {
          setError(json.message || "Landing page tidak ditemukan atau sudah berakhir.");
        }
      } catch (err: any) {
        console.error("Fetch landing page error:", err);
        setError("Gagal memuat halaman promosi.");
      } finally {
        setLoading(false);
      }
    };

    fetchLanding();
  }, [slug]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="h-10 bg-slate-200 rounded-xl animate-pulse w-1/3"></div>
          <div className="h-72 bg-slate-200 rounded-2xl animate-pulse w-full"></div>
          <div className="space-y-3">
            <div className="h-5 bg-slate-200 rounded w-full"></div>
            <div className="h-5 bg-slate-200 rounded w-5/6"></div>
            <div className="h-5 bg-slate-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !landing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Halaman Tidak Ditemukan</h2>
          <p className="text-sm text-slate-500 mb-6">
            {error || "Halaman promosi ini mungkin telah dinonaktifkan atau masa berlakunya telah berakhir."}
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Top breadcrumb navigation */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Beranda Toko
          </Link>
          <span className="text-xs text-slate-400">Promo & Event</span>
        </div>
      </div>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-8">
        {/* Render Blocks sequentially */}
        {landing.sections && Array.isArray(landing.sections) && landing.sections.length > 0 ? (
          landing.sections.map((block: LandingBlock, idx: number) => {
            switch (block.type) {
              case "HERO":
                return (
                  <div
                    key={block.id || idx}
                    className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-slate-900 to-brand-950 text-white p-8 sm:p-12 shadow-md border border-slate-800/50 ${
                      block.data?.alignment === "center" ? "text-center" : "text-left"
                    }`}
                  >
                    {block.data?.mediaUrl && (
                      <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay">
                        <img
                          src={block.data.mediaUrl}
                          alt="Hero background"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="relative z-10 max-w-2xl mx-auto">
                      {block.data?.badge && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-500/20 text-brand-300 border border-brand-400/30 mb-4 backdrop-blur-sm">
                          <Sparkles className="w-3.5 h-3.5" />
                          {block.data.badge}
                        </span>
                      )}
                      <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
                        {block.data?.title || landing.title}
                      </h1>
                      {block.data?.subtitle && (
                        <p className="text-sm sm:text-base text-slate-300 mb-6 leading-relaxed">
                          {block.data.subtitle}
                        </p>
                      )}
                      {block.data?.ctaText && block.data?.ctaUrl && (
                        <a
                          href={block.data.ctaUrl}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary hover:bg-primary text-white font-semibold text-sm shadow-md shadow-brand-500/20 transition transform active:scale-95"
                        >
                          {block.data.ctaText}
                          <ChevronRight className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                );

              case "TEXT":
                return (
                  <div
                    key={block.id || idx}
                    className={`bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm ${
                      block.data?.alignment === "center" ? "text-center" : "text-left"
                    }`}
                  >
                    {block.data?.heading && (
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">
                        {block.data.heading}
                      </h2>
                    )}
                    <div className="text-slate-600 text-sm sm:text-base leading-relaxed space-y-3 whitespace-pre-line">
                      {block.data?.content}
                    </div>
                  </div>
                );

              case "IMAGE":
                return (
                  <div key={block.id || idx} className="bg-white rounded-3xl p-3 sm:p-4 border border-slate-100 shadow-sm">
                    <div className="rounded-2xl overflow-hidden bg-slate-100 aspect-video relative">
                      <img
                        src={block.data?.mediaUrl}
                        alt={block.data?.altText || "Landing image"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://placehold.co/800x450/f8fafc/64748b?text=Image+Unavailable";
                        }}
                      />
                    </div>
                    {block.data?.caption && (
                      <p className="text-xs text-center text-slate-400 mt-2 italic">
                        {block.data.caption}
                      </p>
                    )}
                  </div>
                );

              case "PRODUCT_HIGHLIGHT":
                const game = block.data?.resolvedGame;
                return (
                  <div key={block.id || idx} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          {block.data?.customTitle || "Game Rekomendasi"}
                        </h3>
                        {block.data?.customDescription && (
                          <p className="text-xs text-slate-500 mt-0.5">{block.data.customDescription}</p>
                        )}
                      </div>
                      <span className="p-2 bg-brand-50 text-primary rounded-xl">
                        <Gamepad2 className="w-5 h-5" />
                      </span>
                    </div>

                    {game ? (
                      <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
                        <img
                          src={game.image || "https://placehold.co/120x120/f8fafc/64748b?text=Game"}
                          alt={game.name}
                          className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover bg-white shadow-sm flex-shrink-0"
                        />
                        <div className="flex-1 text-center sm:text-left">
                          <h4 className="font-bold text-slate-900 text-base">{game.name}</h4>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                            {game.description || "Layanan top up instan dan terpercaya di Toko Kami"}
                          </p>
                        </div>
                        <Link
                          to={`/games/${game.slug}`}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary hover:bg-brand-700 text-white text-xs font-bold text-center transition flex-shrink-0"
                        >
                          Top Up Sekarang
                        </Link>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Game yang direferensikan belum tersedia.</p>
                    )}
                  </div>
                );

              case "PROMO_HIGHLIGHT":
                const promo = block.data?.resolvedPromo;
                const flashSale = block.data?.resolvedFlashSale;
                return (
                  <div key={block.id || idx} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          {block.data?.customTitle || "Voucher & Penawaran Spesial"}
                        </h3>
                        {block.data?.customDescription && (
                          <p className="text-xs text-slate-500 mt-0.5">{block.data.customDescription}</p>
                        )}
                      </div>
                      <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                        <Tag className="w-5 h-5" />
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {promo && (
                        <div className="border border-dashed border-amber-300 bg-amber-50/50 p-4 rounded-2xl flex flex-col justify-between gap-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-md">
                              Kode Promo
                            </span>
                            <h5 className="font-bold text-slate-900 text-sm mt-2">{promo.name}</h5>
                            <p className="text-xs text-amber-900/80 mt-0.5">
                              Diskon {promo.discountType === "PERCENTAGE" ? `${promo.discountValue}%` : `Rp ${promo.discountValue.toLocaleString("id-ID")}`}
                            </p>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-amber-200/60">
                            <span className="font-mono font-bold text-sm text-slate-800">{promo.code}</span>
                            <button
                              onClick={() => handleCopyCode(promo.code)}
                              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition"
                            >
                              {copiedCode === promo.code ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-white" /> Tersalin
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" /> Salin Kode
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {flashSale && (
                        <div className="border border-red-200 bg-red-50/40 p-4 rounded-2xl flex flex-col justify-between gap-3">
                          <div>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-100 px-2 py-0.5 rounded-md">
                              <Zap className="w-3 h-3" /> Flash Sale
                            </span>
                            <h5 className="font-bold text-slate-900 text-sm mt-2">{flashSale.name}</h5>
                            <p className="text-xs text-slate-500 mt-0.5">Harga Spesial Event</p>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-red-200/60">
                            <span className="font-bold text-red-600 text-sm">
                              Rp {flashSale.salePrice?.toLocaleString("id-ID")}
                            </span>
                            <Link
                              to="/#katalog"
                              className="text-xs font-bold text-primary hover:text-brand-800"
                            >
                              Beli Sekarang &rarr;
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );

              case "CTA":
                return (
                  <div
                    key={block.id || idx}
                    className="bg-gradient-to-r from-slate-900 to-brand-950 text-white rounded-3xl p-8 sm:p-10 text-center shadow-sm"
                  >
                    {block.data?.title && (
                      <h3 className="text-xl sm:text-2xl font-bold mb-2 text-white">
                        {block.data.title}
                      </h3>
                    )}
                    {block.data?.description && (
                      <p className="text-sm text-slate-300 max-w-lg mx-auto mb-6">
                        {block.data.description}
                      </p>
                    )}
                    <a
                      href={block.data?.targetUrl || "#"}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-slate-900 font-bold text-sm hover:bg-slate-100 transition shadow-sm transform active:scale-95"
                    >
                      {block.data?.buttonText || "Ambil Penawaran"}
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                );

              default:
                return null;
            }
          })
        ) : (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-100">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{landing.title}</h1>
            <p className="text-slate-600 text-sm">{landing.description}</p>
          </div>
        )}

        {/* Global Landing CTA if configured */}
        {landing.ctaText && landing.ctaUrl && (
          <div className="text-center pt-4">
            <a
              href={landing.ctaUrl}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition transform active:scale-95"
            >
              {landing.ctaText}
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
