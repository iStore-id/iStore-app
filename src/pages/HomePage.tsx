import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../lib/firebase";
import { Search, Gamepad2, Smartphone, Wifi, Zap, Wallet, Receipt, AlertTriangle, Megaphone, ArrowRight, HelpCircle, ShieldCheck, Clock3, Sparkles, CheckCircle } from "lucide-react";
import { Game } from "../types/core";
import CustomerPopupModal from "../components/CustomerPopupModal";
import FaqAccordion from "../components/FaqAccordion";
import { PublicFAQItem } from "../types/faq";
import { useSEO } from "../lib/seo";

export default function HomePage() {
  const [storeName, setStoreName] = useState("iStore.id");
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

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

  useSEO({
    canonicalPath: "/",
    ogType: "website",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${baseUrl}/#organization`,
          "name": storeName,
          "url": baseUrl,
          "logo": "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop",
          "description": "Platform top up game dan voucher digital terpercaya di Indonesia."
        },
        {
          "@type": "WebSite",
          "@id": `${baseUrl}/#website`,
          "url": baseUrl,
          "name": storeName,
          "publisher": { "@id": `${baseUrl}/#organization` },
          "potentialAction": {
            "@type": "SearchAction",
            "target": `${baseUrl}/games?search={search_term_string}`,
            "query-input": "required name=search_term_string"
          }
        }
      ]
    }
  });

  const [popularGames, setPopularGames] = useState<Game[]>([]);
  const [activeCategories, setActiveCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [heroBanners, setHeroBanners] = useState<any[]>([]);
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);
  const [homeFaqs, setHomeFaqs] = useState<PublicFAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [gamesRes, categoriesRes, bannersRes, campaignsRes, faqsRes] = await Promise.all([
          fetch("/api/public/catalog/games"),
          fetch("/api/public/catalog/categories"),
          fetch("/api/public/banners?placement=homepage_hero"),
          fetch("/api/public/campaigns"),
          fetch("/api/public/faq")
        ]);
        const gamesData = await gamesRes.json();
        const categoriesData = await categoriesRes.json();
        const bannersData = await bannersRes.json();
        const campaignsData = await campaignsRes.json();
        const faqsData = await faqsRes.json();
        
        if (gamesData.success) {
          setPopularGames(gamesData.data || []);
        }
        if (categoriesData.success) {
          setActiveCategories(categoriesData.data || []);
        }
        if (bannersData.success) {
          setHeroBanners(bannersData.data || []);
        }
        if (campaignsData.success) {
          setActiveCampaigns(campaignsData.data || []);
        }
        if (faqsData.success) {
          setHomeFaqs(faqsData.data?.slice(0, 4) || []);
        }
      } catch (error) {
        console.warn("Notice: Data could not be fetched:", error);
        setErrorState("service_error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  function getCategoryVisuals(name: string): { icon: any; color: string } {
    const norm = name.toLowerCase().trim();
    if (norm.includes("game")) {
      return { icon: Gamepad2, color: "bg-blue-50 text-blue-600 border-blue-200" };
    }
    if (norm.includes("pulsa") || norm.includes("phone")) {
      return { icon: Smartphone, color: "bg-green-50 text-green-600 border-green-200" };
    }
    if (norm.includes("data") || norm.includes("internet")) {
      return { icon: Wifi, color: "bg-purple-50 text-purple-600 border-purple-200" };
    }
    if (norm.includes("pln") || norm.includes("token") || norm.includes("electricity") || norm.includes("listrik")) {
      return { icon: Zap, color: "bg-amber-50 text-amber-600 border-amber-200" };
    }
    if (norm.includes("wallet") || norm.includes("dana") || norm.includes("gopay") || norm.includes("shopee") || norm.includes("linkaja") || norm.includes("ovo")) {
      return { icon: Wallet, color: "bg-blue-50 text-primary border-indigo-200" };
    }
    if (norm.includes("voucher")) {
      return { icon: Smartphone, color: "bg-rose-50 text-rose-600 border-rose-200" };
    }
    return { icon: Gamepad2, color: "bg-slate-50 text-slate-600 border-slate-200" };
  }

  const filteredGames = popularGames.filter((game) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = game.name.toLowerCase().includes(q);
      const slugMatch = game.slug.toLowerCase().includes(q);
      const descMatch = game.description?.toLowerCase().includes(q) || false;
      if (!nameMatch && !slugMatch && !descMatch) {
        return false;
      }
    }
    if (selectedCategoryId) {
      if (!game.categoryIds || !game.categoryIds.includes(selectedCategoryId)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50/50">
      <CustomerPopupModal placement="homepage" />
      
      {/* Premium Hero Section */}
      <section className="w-full bg-slate-950 py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden border-b border-slate-900">
        {/* Subtle Decorative Background Light Blobs */}
        <div className="absolute top-1/4 left-1/10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          {heroBanners.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {heroBanners.map((banner) => (
                <div key={banner.id} className="relative rounded-2xl overflow-hidden shadow-2xl aspect-[16/9] sm:aspect-[21/9] group bg-slate-900 border border-slate-800/80">
                  <img 
                    src={banner.mediaUrl} 
                    alt={banner.altText || banner.name} 
                    className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-700" 
                    referrerPolicy="no-referrer" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent flex flex-col justify-end p-6 md:p-8">
                    {banner.title && <h2 className="text-xl md:text-2xl font-bold text-white mb-3 tracking-tight">{banner.title}</h2>}
                    {banner.target && (
                      <a 
                        href={banner.target} 
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl w-max shadow-lg shadow-blue-500/25 transition duration-300"
                      >
                        Lihat Detail <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 py-16 md:py-24 px-6 sm:px-12 lg:px-16 text-center text-white border border-slate-900 shadow-2xl">
              {/* Internal abstract grid line texture */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30"></div>
              
              <div className="max-w-3xl mx-auto relative z-10 space-y-6 sm:space-y-8">
                {/* Micro badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 text-xs font-semibold tracking-wider uppercase mx-auto animate-pulse">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Platform Top Up & Voucher Tercepat</span>
                </div>
                
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-indigo-200 leading-tight">
                  Top Up Game & Voucher Digital Otomatis 24/7
                </h1>
                
                <p className="text-base sm:text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
                  Top up game favorit, pulsa, token PLN, e-wallet, dan kebutuhan digital lainnya secara instan. Pembayaran aman dan terverifikasi.
                </p>
                
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
                  <a 
                    href="#katalog" 
                    className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35 transition-all duration-300 transform hover:-translate-y-0.5 text-sm"
                  >
                    Mulai Top Up Game
                  </a>
                  <Link 
                    to="/transactions" 
                    className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 hover:bg-slate-850 text-slate-100 font-bold rounded-xl border border-slate-800 hover:border-slate-750 transition-all duration-300 transform hover:-translate-y-0.5 text-sm"
                  >
                    Cek Riwayat Transaksi
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Active Campaign Banner */}
      {activeCampaigns.length > 0 && (
        <section className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-950 py-4 px-4 sm:px-6 lg:px-8 text-white border-b border-slate-900">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-indigo-500/10 border border-indigo-400/20 rounded-xl flex-shrink-0">
                <Megaphone className="w-5 h-5 text-indigo-300" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] tracking-widest font-bold uppercase bg-indigo-500/25 border border-indigo-400/30 text-indigo-300 px-2 py-0.5 rounded-md">Kampanye</span>
                  <p className="text-sm font-bold text-white leading-none">{activeCampaigns[0].title}</p>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-snug">{activeCampaigns[0].description}</p>
              </div>
            </div>
            
            {activeCampaigns[0].targetUrl ? (
              <a
                href={activeCampaigns[0].targetUrl}
                className="w-full md:w-auto inline-flex items-center justify-center gap-2 text-xs font-bold bg-white text-slate-950 hover:bg-slate-100 px-5 py-2.5 rounded-xl transition-all duration-200 shadow-sm flex-shrink-0"
              >
                Ikuti Sekarang <ArrowRight className="w-3.5 h-3.5" />
              </a>
            ) : (
              <a
                href="#katalog"
                className="w-full md:w-auto inline-flex items-center justify-center gap-2 text-xs font-bold bg-white text-slate-950 hover:bg-slate-100 px-5 py-2.5 rounded-xl transition-all duration-200 shadow-sm flex-shrink-0"
              >
                Lihat Promo <ArrowRight className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </section>
      )}

      {/* Categories Dock */}
      {activeCategories.length > 0 && (
        <section className="py-8 bg-white px-4 sm:px-6 lg:px-8 border-b border-slate-200/50">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-center items-center gap-3 sm:gap-4 flex-wrap">
              {activeCategories.map((cat) => {
                const visual = getCategoryVisuals(cat.name);
                const isSelected = selectedCategoryId === cat.id;
                const IconComponent = visual.icon;
                return (
                  <button
                    key={cat.id || cat.slug || cat.name}
                    onClick={() => setSelectedCategoryId(isSelected ? null : cat.id)}
                    className={`flex items-center gap-2.5 px-4.5 py-2.5 rounded-2xl transition-all duration-200 border cursor-pointer ${
                      isSelected
                        ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/15"
                        : "border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg ${isSelected ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Popular Games / Catalog */}
      <section id="katalog" className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
            <div className="text-left">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
                {selectedCategoryId ? "Katalog Kategori" : searchQuery ? "Hasil Pencarian" : "Katalog Terpopuler"}
              </h2>
              <p className="text-slate-500 mt-2 text-sm max-w-xl">
                {selectedCategoryId
                  ? `Menampilkan produk dari kategori: ${activeCategories.find((c) => c.id === selectedCategoryId)?.name || ""}`
                  : searchQuery
                  ? `Menampilkan hasil pencarian untuk kata kunci: "${searchQuery}"`
                  : "Pilih game favorit atau layanan digital Anda untuk memulai proses top up otomatis."}
              </p>
            </div>

            {/* Filter Controls */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari game atau voucher..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition shadow-xs placeholder:text-slate-400"
                />
              </div>
              {(searchQuery || selectedCategoryId) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategoryId(null);
                  }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-500 transition-colors whitespace-nowrap px-2 underline cursor-pointer"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {/* Catalog Grid State */}
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-5">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="animate-pulse bg-white rounded-3xl p-2 sm:p-3.5 border border-slate-150 aspect-[3/4] flex flex-col justify-between">
                  <div className="bg-slate-200/80 w-full aspect-square rounded-2xl mb-4"></div>
                  <div className="space-y-2">
                    <div className="bg-slate-200/80 h-4 w-5/6 rounded-lg"></div>
                    <div className="bg-slate-200/80 h-3 w-1/2 rounded-lg"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : errorState === "configuration_error" ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm max-w-xl mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Konfigurasi Database Diperlukan</h3>
              <p className="text-slate-500 text-sm">Hubungkan basis data Firebase melalui konsol kontrol untuk memuat katalog dan produk iStore.id.</p>
            </div>
          ) : errorState === "service_error" ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm max-w-xl mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-red-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Gagal Memuat Katalog</h3>
              <p className="text-slate-500 text-sm">Terjadi kegagalan komunikasi sistem. Silakan coba memuat ulang halaman ini dalam beberapa saat.</p>
            </div>
          ) : filteredGames.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-5">
              {filteredGames.map((game) => (
                <Link 
                  to={`/games/${game.slug}`} 
                  key={game.id} 
                  className="group bg-white rounded-3xl p-2 sm:p-3.5 border border-slate-200/60 shadow-xs hover:shadow-xl hover:shadow-slate-200/30 hover:border-slate-300 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                >
                  <div className="space-y-3.5">
                    <div className="aspect-square w-full rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 relative">
                      <img 
                        src={game.image || "https://placehold.co/400x400/f8fafc/64748b?text=Game"} 
                        alt={game.name}
                        className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-500"
                        loading="lazy"
                      />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug whitespace-normal break-words min-w-0 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {game.name}
                      </h3>
                    </div>
                  </div>
                  
                  {/* Small Action Button Indicator */}
                  <div className="mt-3.5 pt-3.5 border-t border-slate-50 flex items-center justify-between text-slate-400 group-hover:text-blue-600 transition-colors text-[11px] font-bold">
                    <span>Top Up</span>
                    <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs max-w-md mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Gamepad2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-slate-800 font-bold text-sm">Produk Tidak Ditemukan</p>
                <p className="text-xs text-slate-500">Sesuaikan filter atau gunakan kata kunci pencarian yang berbeda.</p>
              </div>
              {(searchQuery || selectedCategoryId) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategoryId(null);
                  }}
                  className="px-5 py-2.5 bg-slate-950 hover:bg-slate-850 text-white rounded-xl text-xs font-bold transition duration-200 shadow-sm cursor-pointer"
                >
                  Tampilkan Semua Layanan
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Premium Bento Value / Trust Section */}
      <section className="py-20 bg-white px-4 sm:px-6 lg:px-8 border-t border-slate-150 relative overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Section Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-blue-50 text-blue-600 border border-blue-100">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Sistem Terverifikasi</span>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-950 tracking-tight sm:text-4xl">
              Mengapa Memilih iStore.id?
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base">
              Kami menjamin keamanan transaksi, kecepatan pengiriman barang digital, dan fleksibilitas metode bayar Anda.
            </p>
          </div>

          {/* Bento Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-50/50 hover:bg-slate-50 border border-slate-200/60 p-8 rounded-3xl transition duration-300 text-left space-y-4">
              <div className="w-12 h-12 bg-blue-50 border border-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                <Clock3 className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-lg text-slate-950">Fulfillment Instan 24/7</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Pesanan diproses secara real-time oleh server otomatis kami dalam hitungan detik setelah pembayaran dikonfirmasi, tanpa intervensi manual.
                </p>
              </div>
            </div>

            <div className="bg-slate-50/50 hover:bg-slate-50 border border-slate-200/60 p-8 rounded-3xl transition duration-300 text-left space-y-4">
              <div className="w-12 h-12 bg-green-50 border border-green-100 text-green-600 rounded-2xl flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-lg text-slate-950">Gerbang Pembayaran Aman</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Integrasi resmi gerbang pembayaran (Payment Gateway) bersertifikasi untuk menjamin keamanan dana dan enkripsi data pribadi Anda.
                </p>
              </div>
            </div>

            <div className="bg-slate-50/50 hover:bg-slate-50 border border-slate-200/60 p-8 rounded-3xl transition duration-300 text-left space-y-4">
              <div className="w-12 h-12 bg-purple-50 border border-purple-100 text-purple-600 rounded-2xl flex items-center justify-center">
                <Receipt className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-lg text-slate-950">Pelacakan Transaksi Terbuka</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Pantau setiap progres pesanan dari pengumpulan data, pengisian provider, hingga pengiriman kode digital dalam satu halaman audit transparan.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Customer FAQ Preview Section */}
      {homeFaqs.length > 0 && (
        <section className="py-20 bg-slate-50 px-4 sm:px-6 lg:px-8 border-t border-slate-150">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-blue-50 text-blue-600 border border-blue-100 mx-auto">
                <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                <span>Pusat Informasi</span>
              </div>
              <h2 className="text-3xl font-extrabold text-slate-950 tracking-tight sm:text-4xl">
                Pertanyaan Umum (FAQ)
              </h2>
              <p className="text-slate-500 text-sm sm:text-base max-w-xl mx-auto">
                Butuh bantuan cepat? Temukan rangkuman jawaban untuk kendala pengisian, metode transaksi, dan jaminan keamanan.
              </p>
            </div>

            <FaqAccordion
              items={homeFaqs}
              allowMultiple={false}
              showCategoryBadge={true}
            />

            <div className="text-center pt-4">
              <Link
                to="/faq"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs sm:text-sm border border-slate-200 shadow-sm hover:shadow-md transition duration-200 cursor-pointer"
              >
                <span>Lihat Semua FAQ Selengkapnya</span>
                <ArrowRight className="w-4 h-4 text-blue-600" />
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
