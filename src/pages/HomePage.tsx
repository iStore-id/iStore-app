import { useEffect, useState } from "react";
import { fetchStoreConfig } from "../lib/utils";
import { Link, useLocation } from "react-router-dom";
import { motion } from "motion/react";


import { Search, Gamepad2, Smartphone, Wifi, Zap, Wallet, Receipt, AlertTriangle, Megaphone, ArrowRight, HelpCircle, ShieldCheck, Clock3, Sparkles, CheckCircle } from "lucide-react";
import { Game, ProductVariant } from "../types/core";
import CustomerPopupModal from "../components/CustomerPopupModal";
import FaqAccordion from "../components/FaqAccordion";
import HeroBannerCarousel from "../components/HeroBannerCarousel";
import { FlashSaleGrid } from "../components/home/FlashSaleGrid";
import { CampaignAnnouncement } from "../components/home/CampaignAnnouncement";
import { LandingPreviewSection } from "../components/home/LandingPreviewSection";
import BlogPreviewSection from "../components/home/BlogPreviewSection";
import { PublicFAQItem } from "../types/faq";
import { useSEO } from "../lib/seo";

export default function HomePage() {
  const [storeName, setStoreName] = useState("Toko Kami");
  const [catalogMarqueeText, setCatalogMarqueeText] = useState("Pilih game favorit atau layanan digital Anda untuk memulai proses top up otomatis.");
  const [showCatalogMarquee, setShowCatalogMarquee] = useState<boolean>(true);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const location = useLocation();

  useEffect(() => {
    const loadConfig = () => {
      fetchStoreConfig().then(config => {
        if (config) {
          if (config.name) {
            setStoreName(config.name);
          }
          if (config.catalogMarqueeText && config.catalogMarqueeText.trim() !== "") {
            setCatalogMarqueeText(config.catalogMarqueeText.trim());
          }
          if (config.showCatalogMarquee !== undefined) {
            setShowCatalogMarquee(config.showCatalogMarquee);
          }
        }
      });
    };

    loadConfig();

    window.addEventListener("store-config-updated", loadConfig);
    return () => {
      window.removeEventListener("store-config-updated", loadConfig);
    };
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
  type NavFilter = 
    | { type: "all" }
    | { type: "game"; id: string; name?: string }
    | { type: "category"; id: string; name?: string };
  const [navFilter, setNavFilter] = useState<NavFilter>({ type: "all" });
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (location.pathname === "/" && !location.search && !location.hash) {
      setNavFilter({ type: "all" });
      setSearchQuery("");
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [location.key]);

  const [heroBanners, setHeroBanners] = useState<any[]>([]);
  const [bannersLoaded, setBannersLoaded] = useState(false);
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);
  const [homeFaqs, setHomeFaqs] = useState<PublicFAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [catalogErrorState, setCatalogErrorState] = useState<string | null>(null);

  useEffect(() => {
    // 1. Fetch light data (categories, banners, campaigns, faq) immediately
    const fetchLightData = async () => {
      try {
        setLoading(true);
        const [categoriesRes, bannersRes, campaignsRes, faqsRes] = await Promise.all([
          fetch("/api/public/catalog/categories"),
          fetch("/api/public/banners?placement=homepage_hero"),
          fetch("/api/public/campaigns"),
          fetch("/api/public/faq")
        ]);
        const categoriesData = await categoriesRes.json();
        const bannersData = await bannersRes.json();
        const campaignsData = await campaignsRes.json();
        const faqsData = await faqsRes.json();
        
        if (categoriesData.success) {
          const sortedCategories = (categoriesData.data || []).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
          setActiveCategories(sortedCategories);
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
        console.warn("Notice: Light data could not be fetched:", error);
        setErrorState("service_error");
      } finally {
        setLoading(false);
        setBannersLoaded(true);
      }
    };

    // 2. Fetch catalog games independently in parallel
    const fetchCatalogGames = async () => {
      try {
        setCatalogLoading(true);
        const gamesRes = await fetch("/api/public/catalog/games");
        const gamesData = await gamesRes.json();
        if (gamesData.success) {
          setPopularGames(gamesData.data || []);
        } else {
          setCatalogErrorState("service_error");
        }
      } catch (error) {
        console.warn("Notice: Catalog games could not be fetched:", error);
        setCatalogErrorState("service_error");
      } finally {
        setCatalogLoading(false);
      }
    };

    fetchLightData();
    fetchCatalogGames();
  }, []);

  // Hash Scroll Handler for Async Data Load
  useEffect(() => {
    if (!loading && location.hash) {
      const targetId = location.hash.slice(1);
      const element = document.getElementById(targetId);
      if (element) {
        // Small delay to ensure DOM is fully painted after loading state changes
        const timer = setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth" });
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, location.hash]);

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
    if (navFilter.type === "game") {
      if (game.id !== navFilter.id) {
        return false;
      }
    } else if (navFilter.type === "category") {
      if (!game.categoryIds || !game.categoryIds.includes(navFilter.id)) {
        return false;
      }
    }
    return true;
  });

  // Helper to render Lucide icon by name or fallback
  const CategoryIcon = ({ iconName, className }: { iconName: string, className?: string }) => {
    const icons: Record<string, any> = {
      Smartphone, Wifi, Zap, Wallet, Receipt, Gamepad2, HelpCircle, ShieldCheck, Clock3, Sparkles, CheckCircle
    };
    const Icon = icons[iconName] || Gamepad2;
    return <Icon className={className} />;
  };

  const activeCampaignsWithBanners = activeCampaigns.filter(c => Array.isArray(c.bannerIds) && c.bannerIds.length > 0);
  const bannerIdsFilter = activeCampaignsWithBanners.length > 0
    ? activeCampaignsWithBanners.flatMap(c => c.bannerIds)
    : undefined;

  const activeCampaignsWithFlashSales = activeCampaigns.filter(c => Array.isArray(c.flashSaleIds) && c.flashSaleIds.length > 0);
  const flashSaleIdsFilter = activeCampaignsWithFlashSales.length > 0
    ? activeCampaignsWithFlashSales.flatMap(c => c.flashSaleIds)
    : undefined;

  const activeCampaignsWithPopups = activeCampaigns.filter(c => Array.isArray(c.popupIds) && c.popupIds.length > 0);
  const popupIdsFilter = activeCampaignsWithPopups.length > 0
    ? activeCampaignsWithPopups.flatMap(c => c.popupIds)
    : undefined;

  const displayedBanners = bannerIdsFilter
    ? heroBanners.filter(b => bannerIdsFilter.includes(b.id))
    : heroBanners;

  return (
    <div className="flex flex-col w-full min-h-screen">
      <CustomerPopupModal placement="homepage" allowedIds={popupIdsFilter} />
      
      {/* Premium Hero Section */}
      {displayedBanners.length > 0 && (
        <section className="w-full relative overflow-hidden border-b border-slate-200/80 [.public-storefront[data-theme='dark']_&]:border-slate-900 transition-colors duration-300">
          <HeroBannerCarousel banners={displayedBanners} />
        </section>
      )}


      {/* Homepage Store Announcement Ticker */}
      {showCatalogMarquee && (
        <div className="overflow-hidden w-full max-w-7xl mx-auto px-4 py-1.5 sm:py-2">
          <motion.div
            animate={{ x: ["100%", "-100%"] }}
            transition={{
              repeat: Infinity,
              repeatType: "loop",
              duration: 16,
              ease: "linear",
            }}
            className="whitespace-nowrap inline-block text-slate-500 text-xs sm:text-sm will-change-transform"
          >
            {catalogMarqueeText}
          </motion.div>
        </div>
      )}

      {/* Flash Sale Section */}
      <FlashSaleGrid allowedIds={flashSaleIdsFilter} />

      {/* Campaign Announcement */}
      <CampaignAnnouncement campaigns={activeCampaigns} />

      <LandingPreviewSection />

      {/* Unified Storefront Navigation Dock */}
      {(popularGames.length > 0 || activeCategories.length > 0) && (
        <section className="py-2 sm:py-2.5 bg-white/95 backdrop-blur-md px-4 border-b border-slate-200/80 sticky top-16 z-20 shadow-xs">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth">
              {/* Dynamic Active Non-Game Categories */}
              {activeCategories.map((cat) => {
                const isSelected = navFilter.type === "category" && navFilter.id === cat.id;
                return (
                  <button
                    key={cat.id || cat.slug || cat.name}
                    type="button"
                    onClick={() => setNavFilter(isSelected ? { type: "all" } : { type: "category", id: cat.id, name: cat.name })}
                    className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg sm:rounded-xl transition-all duration-150 border cursor-pointer shrink-0 text-xs font-semibold whitespace-nowrap select-none ${
                      isSelected
                        ? "bg-brand-600 border-brand-600 text-white shadow-xs font-bold"
                        : "border-slate-200/80 bg-slate-50/80 text-slate-600 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300"
                    }`}
                  >
                    <CategoryIcon 
                    iconName={cat.icon} 
                      className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-white" : "text-slate-500"}`} 
                    />
                    <span>{cat.name.toUpperCase()}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Flash Sale Section */}
      <FlashSaleGrid allowedIds={flashSaleIdsFilter} />

      {/* Popular Games / Catalog */}
      <section id="katalog" className="pt-4 sm:pt-6 pb-8 sm:pb-10 lg:pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-3 sm:mb-4 gap-3 sm:gap-4">
            <div className="text-left">
              {(navFilter.type !== "all" || searchQuery) && (
                <h2 className="ui-section-title text-slate-950">
                  {navFilter.type === "game"
                    ? `Game: ${popularGames.find((g) => g.id === navFilter.id)?.name || "Katalog Game"}`
                    : navFilter.type === "category"
                    ? `Kategori: ${activeCategories.find((c) => c.id === navFilter.id)?.name || "Katalog Kategori"}`
                    : "Hasil Pencarian"}
                </h2>
              )}
              {navFilter.type === "all" && !searchQuery ? null : (
                <p className="text-slate-500 mt-1 sm:mt-1.5 text-xs sm:text-sm max-w-xl">
                  {navFilter.type === "game"
                    ? `Menampilkan produk untuk game: ${popularGames.find((g) => g.id === navFilter.id)?.name || ""}`
                    : navFilter.type === "category"
                    ? `Menampilkan produk dari kategori: ${activeCategories.find((c) => c.id === navFilter.id)?.name || ""}`
                    : `Menampilkan hasil pencarian untuk kata kunci: "${searchQuery}"`}
                </p>
              )}
            </div>

            {/* Filter Controls */}
            {navFilter.type !== "all" && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setNavFilter({ type: "all" });
                  }}
                  className="text-xs font-bold text-brand-600 hover:text-brand-500 transition-colors whitespace-nowrap px-2 underline cursor-pointer"
                >
                  Reset Filter
                </button>
              </div>
            )}
          </div>

          {/* Catalog Grid State */}
          {catalogLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-5">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="animate-pulse bg-slate-100 dark:bg-slate-800 rounded-2xl aspect-[1/1.38] overflow-hidden relative border" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="absolute inset-0 bg-slate-200/50 dark:bg-slate-700/50"></div>
                  <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-slate-300/30 dark:from-slate-900/30 to-transparent"></div>
                </div>
              ))}
            </div>
          ) : catalogErrorState === "configuration_error" ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm max-w-xl mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Konfigurasi Database Diperlukan</h3>
              <p className="text-slate-500 text-sm">Hubungkan basis data Firebase melalui konsol kontrol untuk memuat katalog dan produk Toko Kami.</p>
            </div>
          ) : catalogErrorState === "service_error" ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm max-w-xl mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-red-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Gagal Memuat Katalog</h3>
              <p className="text-slate-500 text-sm">Terjadi kegagalan komunikasi sistem. Silakan coba memuat ulang halaman ini dalam beberapa saat.</p>
            </div>
          ) : filteredGames.length > 0 ? (
            <div className="space-y-5 sm:space-y-7">
              {(() => {
                let categoriesToRender = activeCategories;
                if (navFilter.type === "category") {
                  categoriesToRender = activeCategories.filter(c => c.id === navFilter.id);
                }

                const isDefaultHome = navFilter.type === "all" && !searchQuery;

                return categoriesToRender.map(category => {
                  let gamesInCategory = filteredGames.filter(game => game.categoryIds?.includes(category.id));
                  if (gamesInCategory.length === 0) return null;

                  const isTopUp = category.id === "15b131f7-ef27-4df4-a788-e8d87fa4a5e6" || category.slug === "pilih-nominal" || category.name?.toUpperCase() === "TOP UP";
                  if (isTopUp) {
                    const popularSlugs = [
                      "mobile-legends",
                      "free-fire-ffmax",
                      "pubg-mobile",
                      "valorant",
                      "genshin-impact",
                      "honor-of-kings",
                      "call-of-duty-mobile",
                      "arena-of-valor-aov",
                      "point-blank",
                      "garena-undawn",
                      "clash-of-clans",
                      "brawl-stars",
                      "ragnarok-origin",
                      "ragnarok-m-eternal-love",
                      "ragnarok-x-next-generation",
                      "honkai-star-rail",
                      "zenless-zone-zero",
                      "ea-sports-fc-mobile"
                    ];
                    gamesInCategory = [...gamesInCategory].sort((a, b) => {
                      const idxA = popularSlugs.indexOf(a.slug);
                      const idxB = popularSlugs.indexOf(b.slug);
                      const rankA = idxA !== -1 ? idxA : 1000 + (a.sortOrder || 0);
                      const rankB = idxB !== -1 ? idxB : 1000 + (b.sortOrder || 0);
                      if (rankA !== rankB) return rankA - rankB;
                      return a.name.localeCompare(b.name);
                    });
                  }
                  
                  const catSlug = category.slug;
                  const isUtility = ['pulsa', 'token-listrik', 'paket-data', 'voucher-data', 'telpon-sms'].includes(catSlug || '');
                  const displayGames = isDefaultHome ? gamesInCategory.slice(0, 9) : gamesInCategory;

                  return (
                    <div key={category.id} className="scroll-mt-24" id={`cat-${category.slug}`}>
                      <div className="flex items-center gap-3 mb-2 sm:mb-3">
                        <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                          {category.name}
                        </h3>
                        <div className="h-px bg-slate-200/60 flex-grow rounded-full hidden sm:block"></div>
                      </div>
                      
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-5">
                        {displayGames.map((game) => {
                          const fallbackImg = isUtility 
                            ? "https://placehold.co/400x400/f8fafc/64748b?text=Layanan" 
                            : "https://placehold.co/400x400/f8fafc/64748b?text=Game";

                          return (
                            <Link 
                              to={`/games/${game.slug}`} 
                              key={game.id} 
                              className="group flex flex-col aspect-[1/1.38] rounded-2xl overflow-hidden border shadow-2xs hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
                              style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}
                            >
                              {/* Zona 1: Clean Artwork (74% height) */}
                              <div 
                                className="relative w-full h-[74%] overflow-hidden bg-slate-100 dark:bg-slate-800 border-b"
                                style={{ borderColor: 'var(--border-color)' }}
                              >
                                <img 
                                  src={game.image || fallbackImg} 
                                  alt={game.name}
                                  className="w-full h-full object-cover object-top transition-transform duration-500 will-change-transform group-hover:scale-105"
                                  loading="lazy"
                                />
                              </div>
                              
                              {/* Zona 2: Dedicated Editorial Plinth (26% height) */}
                              <div className="w-full h-[26%] flex items-center justify-center px-1.5 sm:px-2 py-1 text-center bg-white dark:bg-slate-900 transition-colors">
                                <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-[11px] sm:text-xs leading-tight line-clamp-2 tracking-tight group-hover:text-brand-600 transition-colors">
                                  {game.name}
                                </h3>
                              </div>
                            </Link>
                          );
                        })}
                      </div>

                      {isDefaultHome && gamesInCategory.length > 9 && (
                        <div className="mt-2.5 sm:mt-3 flex justify-center">
                          <button
                            onClick={() => setNavFilter({ type: "category", id: category.id, name: category.name })}
                            className="inline-flex items-center text-[11px] sm:text-xs font-bold text-slate-500 hover:text-brand-600 transition-colors cursor-pointer"
                          >
                            <span>Tampilkan Semua ({gamesInCategory.length})</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
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
              {(searchQuery || navFilter.type !== "all") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setNavFilter({ type: "all" });
                  }}
                  className="storefront-btn-secondary px-5 py-2.5 bg-slate-950 hover:bg-slate-850 text-white rounded-xl text-xs font-bold transition duration-200 shadow-sm cursor-pointer"
                >
                  Tampilkan Semua Layanan
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Blog & Berita Preview Section */}
      <BlogPreviewSection />

      {/* Customer FAQ Preview Section */}
      {homeFaqs.length > 0 && (
        <section className="py-8 sm:py-10 lg:py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-150">
          <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
            <div className="text-center space-y-2 sm:space-y-2.5">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase text-brand-600 mx-auto">
                <HelpCircle className="w-3.5 h-3.5 text-brand-600" />
                <span>Pusat Informasi</span>
              </div>
              <h2 className="ui-section-title text-slate-950">
                Pertanyaan Umum (FAQ)
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm max-w-xl mx-auto">
                Butuh bantuan cepat? Temukan rangkuman jawaban untuk kendala pengisian, metode transaksi, dan jaminan keamanan.
              </p>
            </div>

            <FaqAccordion
              items={homeFaqs}
              allowMultiple={false}
              showCategoryBadge={true}
            />

            <div className="text-center pt-2">
              <Link
                to="/faq"
                className="storefront-btn-secondary inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs sm:text-sm border border-slate-200 shadow-xs hover:shadow-sm transition duration-200 cursor-pointer"
              >
                <span>Lihat Semua FAQ Selengkapnya</span>
                <ArrowRight className="w-4 h-4 text-brand-600" />
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
