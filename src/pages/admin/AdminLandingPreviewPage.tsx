import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { auth } from "../../lib/firebase";
import { 
  ArrowLeft, 
  Eye, 
  ExternalLink, 
  Gamepad2, 
  Tag, 
  Sparkles, 
  Zap, 
  AlertCircle,
  Copy,
  Check,
  ChevronRight
} from "lucide-react";
import { LandingBlock } from "../../types/landing";

export default function AdminLandingPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [landing, setLanding] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreview = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`/api/admin/landings/${id}/preview`, {
          headers: {
            Authorization: `Bearer ${token || ""}`
          }
        });
        const json = await res.json();
        if (json.success && json.data) {
          setLanding(json.data);
        } else {
          setError(json.message || "Gagal memuat pratinjau landing page.");
        }
      } catch (err: any) {
        console.error("Preview fetch error:", err);
        setError("Gagal menghubungi server untuk pratinjau.");
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [id]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-medium text-slate-600">Memuat pratinjau aman...</p>
        </div>
      </div>
    );
  }

  if (error || !landing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900 mb-1">Pratinjau Gagal</h2>
          <p className="text-xs text-slate-500 mb-6">{error}</p>
          <Link
            to="/admin/landings"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Manajemen Landing
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">AKTIF</span>;
      case "SCHEDULED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">TERJADWAL</span>;
      case "DRAFT":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">DRAFT</span>;
      case "ENDED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">BERAKHIR</span>;
      case "INACTIVE":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">NONAKTIF</span>;
      case "ARCHIVED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-200 text-zinc-700">ARSIP</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Top Admin Notice Bar */}
      <header className="sticky top-0 z-50 bg-slate-900 text-white px-4 sm:px-6 py-3 shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/landings"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Kembali ke Admin"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">Pratinjau Admin:</span>
              <span className="text-sm font-semibold text-white">{landing.name}</span>
              {getStatusBadge(landing.status)}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>Slug: <code className="text-indigo-300 font-mono">/promo/{landing.slug}</code></span>
            <span className="hidden md:inline text-amber-400 font-medium">Draft ini terisolasi aman dari pelanggan publik.</span>
          </div>
        </div>
      </header>

      {/* Main Content Container matching customer layout */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {landing.sections && Array.isArray(landing.sections) && landing.sections.length > 0 ? (
          landing.sections.map((block: LandingBlock, idx: number) => {
            switch (block.type) {
              case "HERO":
                return (
                  <div
                    key={block.id || idx}
                    className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 text-white p-8 sm:p-12 shadow-md border border-slate-800/50 ${
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
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 mb-4 backdrop-blur-sm">
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
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-sm shadow-md shadow-indigo-500/20 transition transform active:scale-95"
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
                      <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
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
                            {game.description || "Layanan top up instan dan terpercaya di iStore.id"}
                          </p>
                        </div>
                        <Link
                          to={`/games/${game.slug}`}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold text-center transition flex-shrink-0"
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
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
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
                    className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-8 sm:p-10 text-center shadow-sm"
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
