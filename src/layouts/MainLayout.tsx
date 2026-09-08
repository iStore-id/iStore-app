import { Outlet, Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuthStore } from "../store/auth-store";
import { 
  LogOut, 
  Receipt, 
  Menu, 
  X, 
  Bell,
  Crown,
  Mail,
  Phone,
  MapPin,
  MessageSquare,
  Instagram,
  Facebook,
  Youtube,
  Send,
  Twitter,
  Globe,
  Search,
  Gamepad2,
  Loader2,
  User
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import NotificationBell from "../components/NotificationBell";

interface BrandingConfig {
  name: string;
  logo: string;
  favicon: string;
  description: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  brandTextColor?: string;
  operationalStatus?: 'open' | 'closed' | 'maintenance';
  closedMessage?: string;
  maintenanceMessage?: string;
  contactInformation?: {
    email?: string;
    phone?: string;
    whatsapp?: string;
    address?: string;
  };
  socialMedia?: Record<string, string>;
}

export default function MainLayout() {
  const { user, role, loading, setUser } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [branding, setBranding] = useState<BrandingConfig | null>(null);

  // Global Header Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [allGames, setAllGames] = useState<any[]>([]);
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/public/store-config")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setBranding(data.data);
        }
      })
      .catch(err => console.error("Gagal mengambil branding publik:", err));
  }, []);

  useEffect(() => {
    if (branding?.name) {
      document.title = `${branding.name} - ${branding.tagline || 'Top up game cepat dan aman'}`;
    }
    if (branding?.favicon) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = branding.favicon;
    }
  }, [branding]);

  // Handle click outside & ESC key for Search
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSearchOpen(false);
        setIsMobileSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Debounced Global Search Logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setIsSearchOpen(true);

    const timer = setTimeout(async () => {
      try {
        let gamesData = allGames;
        let categoriesData = allCategories;

        if (gamesData.length === 0) {
          const resG = await fetch("/api/public/catalog/games");
          const jsonG = await resG.json();
          if (jsonG.success && jsonG.data) {
            gamesData = jsonG.data;
            setAllGames(jsonG.data);
          }
        }

        if (categoriesData.length === 0) {
          const resC = await fetch("/api/public/catalog/categories");
          const jsonC = await resC.json();
          if (jsonC.success && jsonC.data) {
            categoriesData = jsonC.data;
            setAllCategories(jsonC.data);
          }
        }

        const q = searchQuery.toLowerCase().trim();

        const matchedGames = gamesData
          .filter((g: any) => g.name.toLowerCase().includes(q) || (g.slug && g.slug.toLowerCase().includes(q)))
          .map((g: any) => ({
            type: "game",
            id: g.id,
            name: g.name,
            slug: g.slug,
            image: g.image,
          }));

        const matchedCategories = categoriesData
          .filter((c: any) => c.name.toLowerCase().includes(q) || (c.slug && c.slug.toLowerCase().includes(q)))
          .map((c: any) => ({
            type: "category",
            id: c.id,
            name: c.name,
            slug: c.slug,
          }));

        setSearchResults([...matchedGames, ...matchedCategories]);
      } catch (e) {
        console.error("Global search error:", e);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, allGames, allCategories]);

  const handleSelectResult = (item: { type: string; id: string; name: string; slug: string }) => {
    setIsSearchOpen(false);
    setIsMobileSearchOpen(false);
    setSearchQuery("");
    if (item.type === "game") {
      navigate(`/games/${item.slug}`);
    } else if (item.type === "category") {
      navigate(`/?category=${item.id}#katalog`);
    }
  };

  const handleLogout = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
    } catch (e) {
      console.error("Sign out error:", e);
    }
    sessionStorage.removeItem('istore_session');
    setUser(null, null);
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* Dynamic Branding Style Injection */}
      {branding && (
        <style>{`
          :root {
            --primary-color: ${branding.primaryColor || '#3b82f6'};
            --secondary-color: ${branding.secondaryColor || '#1d4ed8'};
            --brand-text-color: ${branding.brandTextColor || branding.primaryColor || '#1e3a8a'};
          }
          .bg-primary { background-color: var(--primary-color) !important; }
          .text-primary { color: var(--primary-color) !important; }
          .text-brand { color: var(--brand-text-color) !important; }
          .bg-blue-600 {
            background-color: var(--primary-color) !important;
          }
          .text-blue-600 {
            color: var(--primary-color) !important;
          }
          .hover\\:bg-blue-700:hover {
            background-color: var(--secondary-color) !important;
          }
          .hover\\:text-blue-600:hover {
            color: var(--primary-color) !important;
          }
          .bg-blue-50 {
            background-color: color-mix(in srgb, var(--primary-color) 8%, transparent) !important;
          }
          .shadow-blue-200 {
            --tw-shadow-color: color-mix(in srgb, var(--primary-color) 20%, transparent) !important;
          }
        `}</style>
      )}

      {/* Header */}
      {branding?.operationalStatus && branding.operationalStatus !== 'open' && (
        <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium sticky top-0 z-[60]">
          {branding.operationalStatus === 'maintenance' 
            ? (branding.maintenanceMessage?.trim() || "iStore sedang dalam maintenance. Layanan akan kembali normal setelah proses selesai.")
            : (branding.closedMessage?.trim() || "Maaf, toko sedang tutup sementara. Silakan kembali beberapa saat lagi.")}
        </div>
      )}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center gap-2 lg:gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              {branding?.logo ? (
                <img src={branding.logo} alt="Logo" className="h-8 w-auto object-contain animate-fade-in" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-xl">
                  {branding?.name ? branding.name.charAt(0).toUpperCase() : "i"}
                </div>
              )}
              <span className="font-bold text-xl tracking-tight text-brand truncate max-w-[140px] sm:max-w-none">{branding?.name || "iStore.id"}</span>
            </Link>

            {/* Desktop Global Search */}
            <div className="relative flex-1 max-w-xs lg:max-w-sm hidden md:block mx-2 lg:mx-4" ref={searchRef}>
              <div className="relative flex items-center">
                <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchQuery.trim()) setIsSearchOpen(true);
                  }}
                  placeholder="Cari game atau produk..."
                  aria-label="Cari game atau produk"
                  className="w-full pl-9 pr-8 py-1.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400"
                />
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 p-0.5"
                    aria-label="Bersihkan pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : isSearching ? (
                  <Loader2 className="w-3.5 h-3.5 absolute right-3 text-blue-600 animate-spin" />
                ) : null}
              </div>

              {/* Search Results Dropdown Panel */}
              {isSearchOpen && searchQuery.trim().length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {isSearching ? (
                    <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Mencari katalog...</span>
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((item) => (
                      <button
                        key={`${item.type}-${item.id}`}
                        onClick={() => handleSelectResult(item)}
                        className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-blue-50/60 transition-colors cursor-pointer group"
                      >
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-9 h-9 rounded-lg object-cover shrink-0 group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                            <Gamepad2 className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 text-xs sm:text-sm truncate">{item.name}</p>
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded capitalize">
                            {item.type === 'game' ? 'Game' : 'Kategori'}
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500">
                      <p className="font-medium text-slate-700">Tidak ada hasil ditemukan.</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Coba kata kunci lain.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex space-x-6 xl:space-x-8 shrink-0">
              <Link to="/" className="text-slate-600 hover:text-blue-600 font-medium transition-colors text-sm">Beranda</Link>
              <Link to="/membership" className="text-slate-600 hover:text-blue-600 font-medium transition-colors text-sm flex items-center gap-1">
                <Crown className="w-4 h-4 text-amber-500" />
                VIP
              </Link>
              <Link to="/blog" className="text-slate-600 hover:text-blue-600 font-medium transition-colors text-sm">Blog</Link>
              <Link to="/faq" className="text-slate-600 hover:text-blue-600 font-medium transition-colors text-sm">FAQ</Link>
              <Link to="/transactions" className="text-slate-600 hover:text-blue-600 font-medium transition-colors text-sm">Cek Transaksi</Link>
            </nav>

            {/* Desktop Auth */}
            <div className="hidden md:flex items-center space-x-3 shrink-0">
              {!loading && user ? (
                <div className="flex items-center gap-3">
                  {(role === 'admin' || role === 'pemilik') && (
                    <Link to="/admin" className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full transition-all">Panel Admin</Link>
                  )}
                  <NotificationBell />
                  <Link to="/transactions/history" className="text-slate-600 hover:text-blue-600 p-2 hover:bg-slate-100 rounded-full transition-all" title="Riwayat Transaksi">
                    <Receipt className="w-5 h-5" />
                  </Link>
                  <Link to="/account" className="text-slate-600 hover:text-blue-600 p-2 hover:bg-slate-100 rounded-full transition-all" title="Akun & Keamanan">
                    <User className="w-5 h-5" />
                  </Link>
                  <button onClick={handleLogout} className="text-slate-600 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition-all" title="Logout">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <>
                  <Link to="/login" className="text-slate-600 hover:text-blue-600 font-medium text-sm transition-colors">Login</Link>
                  <Link to="/register" className="bg-blue-600 text-white px-4 py-1.5 rounded-full font-medium text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
                    Daftar
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Actions: Search Trigger & Menu Toggle */}
            <div className="md:hidden flex items-center gap-1">
              <button 
                onClick={() => {
                  setIsMobileSearchOpen(!isMobileSearchOpen);
                  if (isMobileMenuOpen) setIsMobileMenuOpen(false);
                }}
                aria-label="Cari game atau produk"
                className="p-2 text-slate-600 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-all"
              >
                <Search className="w-5 h-5" />
              </button>
              <button 
                onClick={() => {
                  setIsMobileMenuOpen(!isMobileMenuOpen);
                  if (isMobileSearchOpen) setIsMobileSearchOpen(false);
                }}
                aria-label="Buka menu navigasi"
                className="text-slate-600 hover:text-blue-600 focus:outline-none p-2 rounded-lg hover:bg-slate-100 transition-all"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Search Bar Dropdown Overlay */}
        {isMobileSearchOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 p-3 shadow-lg absolute w-full z-50 animate-fade-in">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari game atau produk..."
                autoFocus
                aria-label="Cari game atau produk"
                className="w-full pl-9 pr-8 py-2 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-sm text-slate-900"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 text-slate-400 hover:text-slate-600"
                  aria-label="Bersihkan pencarian"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search Results in Mobile Overlay */}
            {searchQuery.trim().length > 0 && (
              <div className="mt-2 bg-white rounded-xl border border-slate-200 shadow-sm max-h-72 overflow-y-auto divide-y divide-slate-100">
                {isSearching ? (
                  <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Mencari katalog...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((item) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => handleSelectResult(item)}
                      className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-blue-50/50 transition-colors cursor-pointer"
                    >
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-9 h-9 rounded-lg object-cover shrink-0" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                          <Gamepad2 className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 text-xs sm:text-sm truncate">{item.name}</p>
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded capitalize">
                          {item.type === 'game' ? 'Game' : 'Kategori'}
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500">
                    <p className="font-medium text-slate-700">Tidak ada hasil ditemukan.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Coba kata kunci lain.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 px-4 pt-2 pb-4 space-y-1 shadow-lg absolute w-full">
            <Link to="/" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50">Beranda</Link>
            <Link to="/membership" className="block px-3 py-2 rounded-md text-base font-medium text-amber-600 hover:bg-amber-50 flex items-center gap-2">
              <Crown className="w-4 h-4" />
              VIP Membership
            </Link>
            <Link to="/blog" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50">Blog & Berita</Link>
            <Link to="/faq" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50">FAQ</Link>
            <Link to="/transactions" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50">Cek Transaksi</Link>
            
            <div className="mt-4 pt-4 border-t border-slate-200">
              {!loading && user ? (
                <>
                  {(role === 'admin' || role === 'pemilik') && (
                    <Link to="/admin" className="block px-3 py-2 rounded-md text-base font-medium text-blue-600 hover:bg-blue-50">Panel Admin</Link>
                  )}
                  <Link to="/notifications" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50">Notifikasi</Link>
                  <Link to="/transactions/history" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50">Riwayat Transaksi</Link>
                  <Link to="/account" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50">Akun & Keamanan</Link>
                  <button onClick={handleLogout} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50">Logout</button>
                </>
              ) : (
                <div className="flex flex-col gap-2 mt-2">
                  <Link to="/login" className="block text-center px-3 py-2 rounded-md text-base font-medium text-blue-600 bg-blue-50">Login</Link>
                  <Link to="/register" className="block text-center px-3 py-2 rounded-md text-base font-medium text-white bg-blue-600">Daftar</Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow w-full">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-1 space-y-4">
            <div>
              <span className="font-bold text-2xl text-white tracking-tight">{branding?.name || "iStore.id"}</span>
              <p className="mt-2 text-sm text-slate-400">
                {branding?.description || "Platform top up game & PPOB tercepat, termurah, dan terpercaya di Indonesia."}
              </p>
            </div>

            {/* Official Contact Info */}
            <div className="space-y-1.5 text-xs text-slate-400">
              {branding?.contactInformation?.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <span>{branding.contactInformation.address}</span>
                </div>
              )}
              {branding?.contactInformation?.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <a href={`mailto:${branding.contactInformation.email}`} className="hover:text-white transition-colors">
                    {branding.contactInformation.email}
                  </a>
                </div>
              )}
              {branding?.contactInformation?.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{branding.contactInformation.phone}</span>
                </div>
              )}
            </div>

            {/* Verified Social Media Links */}
            {branding?.socialMedia && Object.values(branding.socialMedia).some(url => typeof url === "string" && url.startsWith("https://")) && (
              <div className="pt-2">
                <div className="text-xs font-semibold text-slate-300 mb-2">Ikuti Kami:</div>
                <div className="flex flex-wrap items-center gap-2.5">
                  {branding.socialMedia.instagram?.startsWith("https://") && (
                    <a
                      href={branding.socialMedia.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-pink-600 hover:text-white flex items-center justify-center text-slate-400 transition-all"
                      title="Instagram"
                    >
                      <Instagram className="w-4 h-4" />
                    </a>
                  )}
                  {branding.socialMedia.facebook?.startsWith("https://") && (
                    <a
                      href={branding.socialMedia.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-blue-600 hover:text-white flex items-center justify-center text-slate-400 transition-all"
                      title="Facebook"
                    >
                      <Facebook className="w-4 h-4" />
                    </a>
                  )}
                  {branding.socialMedia.tiktok?.startsWith("https://") && (
                    <a
                      href={branding.socialMedia.tiktok}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-neutral-700 hover:text-white flex items-center justify-center text-slate-400 transition-all"
                      title="TikTok"
                    >
                      <Globe className="w-4 h-4" />
                    </a>
                  )}
                  {branding.socialMedia.youtube?.startsWith("https://") && (
                    <a
                      href={branding.socialMedia.youtube}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-red-600 hover:text-white flex items-center justify-center text-slate-400 transition-all"
                      title="YouTube"
                    >
                      <Youtube className="w-4 h-4" />
                    </a>
                  )}
                  {branding.socialMedia.telegram?.startsWith("https://") && (
                    <a
                      href={branding.socialMedia.telegram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-sky-500 hover:text-white flex items-center justify-center text-slate-400 transition-all"
                      title="Telegram"
                    >
                      <Send className="w-4 h-4" />
                    </a>
                  )}
                  {branding.socialMedia.twitter?.startsWith("https://") && (
                    <a
                      href={branding.socialMedia.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 hover:text-white flex items-center justify-center text-slate-400 transition-all"
                      title="Twitter / X"
                    >
                      <Twitter className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Layanan</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="hover:text-white transition-colors">Top Up Game</Link></li>
              <li><Link to="/blog" className="hover:text-white transition-colors">Blog & Tips Gaming</Link></li>
              <li><span className="text-slate-600 cursor-not-allowed">Pulsa & Data (Soon)</span></li>
              <li><span className="text-slate-600 cursor-not-allowed">Token PLN (Soon)</span></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Bantuan</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/transactions" className="hover:text-white transition-colors">Cek Transaksi</Link></li>
              <li>
                {branding?.contactInformation?.whatsapp ? (
                  <a
                    href={`https://wa.me/${branding.contactInformation.whatsapp.replace(/\D/g, "")}?text=Halo%20Admin%20${encodeURIComponent(branding.name || "iStore.id")},%20saya%20butuh%20bantuan`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors flex items-center gap-1.5 text-emerald-400 font-medium"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Hubungi Kami (WhatsApp)</span>
                  </a>
                ) : branding?.contactInformation?.email ? (
                  <a
                    href={`mailto:${branding.contactInformation.email}`}
                    className="hover:text-white transition-colors"
                  >
                    Hubungi Kami (Email)
                  </a>
                ) : (
                  <Link to="/faq" className="hover:text-white transition-colors">
                    Hubungi Kami
                  </Link>
                )}
              </li>
              <li><Link to="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/privacy" className="hover:text-white transition-colors">Kebijakan Privasi</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-slate-800 text-sm text-center">
          &copy; {new Date().getFullYear()} {branding?.name || "iStore.id"}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
