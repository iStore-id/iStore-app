import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "../lib/firebase";
import { formatRupiah } from "../lib/utils";
import { useAuthStore } from "../store/auth-store";
import { ShieldCheck, Zap, AlertCircle, AlertTriangle, ChevronRight } from "lucide-react";
import { Game, Product, ProductVariant } from "../types/core";
import { useSEO } from "../lib/seo";

export default function GameDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [game, setGame] = useState<Game | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  useSEO({
    title: game ? `${game.name} - Top Up Murah & Instan` : undefined,
    description: game
      ? `Top up ${game.name} resmi murah, aman, dan instan 24 jam. Pilihan item terlengkap dengan berbagai metode pembayaran di iStore.id.`
      : undefined,
    keywords: game ? [game.name.toLowerCase(), `top up ${game.name.toLowerCase()}`, `voucher ${game.name.toLowerCase()}`, "istore id"] : undefined,
    canonicalPath: slug ? `/games/${slug}` : undefined,
    ogImage: game?.image || undefined,
    ogType: "product",
    jsonLd: game ? {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": `Top Up ${game.name}`,
      "image": game.image || undefined,
      "description": `Layanan top up resmi untuk ${game.name} dengan pengiriman instan.`,
      "brand": {
        "@type": "Brand",
        "name": game.publisher || game.name
      },
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "IDR",
        "offerCount": variants.length || 1,
        "availability": "https://schema.org/InStock"
      }
    } : undefined
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorState, setErrorState] = useState<string | null>(null);
  
  const [customerInput, setCustomerInput] = useState<Record<string, string>>({});
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchGameData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/public/catalog/games/${slug}`);
        const data = await response.json();
        
        if (!data.success) {
          setError(data.message || "Game tidak ditemukan.");
          return;
        }

        const { game, products } = data.data;
        setGame(game);
        setProducts(products);

        if (products.length > 0) {
          const firstProd = products[0];
          setSelectedProduct(firstProd);
          
          const vResp = await fetch(`/api/public/catalog/products/${firstProd.id}/variants`);
          const vData = await vResp.json();
          if (vData.success) {
            setVariants(vData.data);
          }
        }
      } catch (err) {
        console.error("Error fetching game data:", err);
        setErrorState("service_error");
      } finally {
        setLoading(false);
      }
    };
    fetchGameData();
  }, [slug]);

  const handleProductChange = async (prod: Product) => {
    setSelectedProduct(prod);
    setSelectedVariant(null);
    try {
      const vResp = await fetch(`/api/public/catalog/products/${prod.id}/variants`);
      const vData = await vResp.json();
      if (vData.success) {
        setVariants(vData.data);
      }
    } catch (err) {
      console.error("Error fetching variants:", err);
    }
  };

  const handleInputChange = (name: string, value: string) => {
    setCustomerInput(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckout = async () => {
    if (!selectedProduct || !selectedVariant) {
      alert("Pilih produk dan nominal.");
      return;
    }

    setProcessing(true);
    try {
      let token = "";
      if (auth?.currentUser) {
        token = await auth.currentUser.getIdToken();
      }

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          productId: selectedProduct.id,
          variantId: selectedVariant.id,
          customerInput,
          promoCode: promoCode.trim() || undefined
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Gagal membuat pesanan");

      if (window.snap && data.snapToken) {
        window.snap.pay(data.snapToken, {
          onSuccess: () => navigate(`/transactions/${data.orderId}`),
          onPending: () => navigate(`/transactions/${data.orderId}`),
          onError: () => alert("Pembayaran gagal!"),
          onClose: () => navigate(`/transactions/${data.orderId}`)
        });
      } else {
        navigate(`/transactions/${data.orderId}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Terjadi kesalahan saat checkout");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="p-12 text-center">Memuat detail game...</div>;
  if (errorState === "configuration_error") return <div className="p-12 text-center">Konfigurasi Firebase belum lengkap.</div>;
  if (errorState === "service_error") return <div className="p-12 text-center text-red-500">Gagal memuat data. Silakan coba lagi.</div>;
  if (error) return <div className="p-12 text-center text-slate-500">{error}</div>;
  if (!game) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Header Game */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 mb-8 flex flex-col md:flex-row gap-6 items-start">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
          <img src={game.image || "https://placehold.co/400x400/f8fafc/64748b?text=Game"} alt={game.name} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{game.name}</h1>
          <p className="text-slate-500 text-sm mb-4 line-clamp-2">{game.description}</p>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-3 py-1 rounded-full">
              <Zap className="w-4 h-4" />
              <span className="font-semibold">Otomatis</span>
            </div>
            <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              <ShieldCheck className="w-4 h-4" />
              <span className="font-semibold">Legal & Aman</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Section 1: Data Akun */}
          <section className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">1</div>
              <h2 className="text-xl font-bold text-slate-900">Data Akun</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">User ID</label>
                <input
                  type="text"
                  placeholder="Masukkan User ID"
                  onChange={(e) => handleInputChange("userId", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Zone ID / Server</label>
                <input
                  type="text"
                  placeholder="Masukkan Zone ID"
                  onChange={(e) => handleInputChange("zoneId", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Pilih Produk (if multiple) */}
          {products.length > 1 && (
            <section className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">2</div>
                <h2 className="text-xl font-bold text-slate-900">Pilih Layanan</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleProductChange(p)}
                    className={`px-6 py-2.5 rounded-xl border-2 font-bold transition-all ${
                      selectedProduct?.id === p.id 
                        ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-200" 
                        : "border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Section 3: Pilih Nominal */}
          <section className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">{products.length > 1 ? 3 : 2}</div>
              <h2 className="text-xl font-bold text-slate-900">Pilih Nominal</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVariant(v)}
                  className={`text-left p-4 rounded-2xl border-2 transition-all relative overflow-hidden ${
                    selectedVariant?.id === v.id 
                      ? "border-blue-600 bg-blue-50/50 shadow-inner" 
                      : "border-slate-100 hover:border-blue-200"
                  }`}
                >
                  <div className="font-bold text-slate-900 mb-1">{v.displayName}</div>
                  <div className="text-blue-600 font-extrabold text-sm">{formatRupiah(v.sellingPrice || 0)}</div>
                  {selectedVariant?.id === v.id && (
                    <div className="absolute top-0 right-0 p-1">
                      <div className="bg-blue-600 text-white rounded-bl-lg p-0.5">
                        <ShieldCheck className="w-3 h-3" />
                      </div>
                    </div>
                  )}
                </button>
              ))}
              {variants.length === 0 && (
                <div className="col-span-full py-8 text-center text-slate-400">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  Belum ada nominal tersedia untuk layanan ini.
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar: Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 sticky top-24">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
              Checkout
            </h2>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Layanan</span>
                <span className="font-bold text-slate-900">{selectedProduct?.name || "-"}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Nominal</span>
                <span className="font-bold text-slate-900 truncate max-w-[150px]">{selectedVariant?.displayName || "-"}</span>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Kode Promo / Voucher</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="KODE PROMO"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-xs uppercase border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <span className="font-bold text-slate-900">Total Pembayaran</span>
                <span className="font-black text-2xl text-blue-600">
                  {selectedVariant ? formatRupiah(selectedVariant.sellingPrice || 0) : "-"}
                </span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={!selectedVariant || processing}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 group"
            >
              {processing ? "Memproses..." : (
                <>
                  Beli Sekarang
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-slate-400 mt-6 leading-relaxed">
              Dengan melanjutkan, Anda menyetujui <span className="text-blue-600 underline">Syarat & Ketentuan</span> iStore.id
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
