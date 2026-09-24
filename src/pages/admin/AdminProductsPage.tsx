import React, { useState, useEffect } from "react";
import { Product, Game, ProductVariant, Category } from "../../types/core";
import { 
  Plus, Search, Edit2, Trash2, CheckCircle2, XCircle, 
  ChevronRight, Package, Tag, DollarSign, Settings,
  AlertTriangle, ArrowRight, BarChart3, Database, Clock, Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuthStore } from "../../store/auth-store";
import { useSearchParams } from "react-router-dom";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchParams] = useSearchParams();
  const gameIdFilter = searchParams.get("gameId");
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);

  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [isBulkPricingModalOpen, setIsBulkPricingModalOpen] = useState(false);
  const [bulkPricingScope, setBulkPricingScope] = useState<'product' | 'variant'>('product');
  const [bulkPricingMethod, setBulkPricingMethod] = useState<'fixed' | 'markup_fixed' | 'markup_percentage' | 'target_margin'>('markup_percentage');
  const [bulkPricingValue, setBulkPricingValue] = useState<number>(10);
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const [resetModal, setResetModal] = useState<{
    isOpen: boolean;
    productId: string;
    productName: string;
    loading: boolean;
    preview: {
      productName: string;
      variantCount: number;
      mappingCount: number;
      hasTransactions: boolean;
      linkedOrders: string[];
    } | null;
    error: string | null;
  }>({
    isOpen: false,
    productId: "",
    productName: "",
    loading: false,
    preview: null,
    error: null
  });

  const { user } = useAuthStore();

  const fetchResetPreview = async (productId: string) => {
    try {
      const idToken = await user?.getIdToken();
      const res = await fetch(`/api/admin/products/${productId}/reset-preview`, {
        headers: { "Authorization": `Bearer ${idToken}` }
      });
      const json = await res.json();
      if (json.success) {
        setResetModal(prev => ({
          ...prev,
          loading: false,
          preview: json.data,
          error: null
        }));
      } else {
        setResetModal(prev => ({
          ...prev,
          loading: false,
          error: json.message
        }));
      }
    } catch (err: any) {
      setResetModal(prev => ({
        ...prev,
        loading: false,
        error: err.message || "Gagal memuat preview reset."
      }));
    }
  };

  const handleResetProduct = async () => {
    try {
      setResetModal(prev => ({ ...prev, loading: true }));
      const idToken = await user?.getIdToken();
      const res = await fetch(`/api/admin/products/${resetModal.productId}/reset`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${idToken}` }
      });
      const json = await res.json();
      if (json.success) {
        setResetModal({
          isOpen: false,
          productId: "",
          productName: "",
          loading: false,
          preview: null,
          error: null
        });
        setSelectedProduct(null);
        fetchData();
      } else {
        setResetModal(prev => ({
          ...prev,
          loading: false,
          error: json.message
        }));
      }
    } catch (err: any) {
      setResetModal(prev => ({
        ...prev,
        loading: false,
        error: err.message || "Gagal melakukan reset produk."
      }));
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const idToken = await user?.getIdToken();

      const prodUrl = gameIdFilter 
        ? `/api/admin/catalog/products?gameId=${gameIdFilter}` 
        : "/api/admin/catalog/products";

      const [prodRes, gameRes, catRes] = await Promise.all([
        fetch(prodUrl, { headers: { "Authorization": `Bearer ${idToken}` } }),
        fetch("/api/admin/catalog/games", { headers: { "Authorization": `Bearer ${idToken}` } }),
        fetch("/api/admin/catalog/categories", { headers: { "Authorization": `Bearer ${idToken}` } })
      ]);

      const [prodJson, gameJson, catJson] = await Promise.all([
        prodRes.json(),
        gameRes.json(),
        catRes.json()
      ]);

      if (prodJson.success) setProducts(prodJson.data || []);
      if (gameJson.success) setGames(gameJson.data || []);
      if (catJson.success) setCategories(catJson.data || []);

    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVariants = async (productId: string) => {
    try {
      setLoadingVariants(true);
      const idToken = await user?.getIdToken();

      const res = await fetch(`/api/admin/catalog/variants?productId=${productId}`, {
        headers: { "Authorization": `Bearer ${idToken}` }
      });
      const json = await res.json();
      
      if (json.success) {
        setVariants(json.data || []);
      }
    } catch (err) {
      console.error("Error fetching variants:", err);
    } finally {
      setLoadingVariants(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setSelectedVariantIds([]);
    if (selectedProduct) {
      fetchVariants(selectedProduct.id!);
    }
  }, [selectedProduct]);

  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const idToken = await user?.getIdToken();
    
    const prodData = {
      gameId: formData.get("gameId") as string,
      categoryIds: (formData.get("categoryIds") as string).split(",").filter(Boolean),
      name: formData.get("name") as string,
      slug: (formData.get("slug") as string).toLowerCase().replace(/\s+/g, '-'),
      type: formData.get("type") as any,
      status: formData.get("status") as any,
      availability: formData.get("availability") as any,
      sortOrder: parseInt(formData.get("sortOrder") as string) || 0,
      description: formData.get("description") as string,
      image: formData.get("image") as string,
    };

    try {
      const url = editingProduct ? `/api/admin/products/${editingProduct.id}` : "/api/admin/products";
      const method = editingProduct ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
        body: JSON.stringify(prodData)
      });

      const result = await res.json();
      if (result.success) {
        setIsProductModalOpen(false);
        setEditingProduct(null);
        fetchData();
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error("Error saving product:", err);
    }
  };

  const handleSaveVariant = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const formData = new FormData(e.currentTarget);
    const idToken = await user?.getIdToken();
    
    const varData = {
      productId: selectedProduct.id,
      name: formData.get("name") as string,
      displayName: formData.get("displayName") as string,
      sku: formData.get("sku") as string,
      status: formData.get("status") as any,
      availability: formData.get("availability") as any,
      sortOrder: parseInt(formData.get("sortOrder") as string) || 0,
      pricing: {
        baseCost: parseFloat(formData.get("baseCost") as string) || 0,
        sellingPrice: parseFloat(formData.get("pricingValue") as string) || 0, // This is 'value' in the engine
        pricingMethod: formData.get("pricingMethod") as any,
        currency: "IDR"
      }
    };

    try {
      const url = editingVariant ? `/api/admin/product-variants/${editingVariant.id}` : "/api/admin/product-variants";
      const method = editingVariant ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
        body: JSON.stringify(varData)
      });

      const result = await res.json();
      if (result.success) {
        setIsVariantModalOpen(false);
        setEditingVariant(null);
        fetchVariants(selectedProduct.id!);
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error("Error saving variant:", err);
    }
  };

  const [pricingPreview, setPricingPreview] = useState<any>(null);
  
  const calculatePreview = async (cost: number, method: string, value: number) => {
    try {
      const idToken = await user?.getIdToken();
      const res = await fetch("/api/admin/pricing/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
        body: JSON.stringify({ cost, method, value })
      });
      const result = await res.json();
      if (result.success) {
        setPricingPreview(result.data);
      }
    } catch (err) {
      console.error("Error calculating preview:", err);
    }
  };

  const handleSaveBulkPricing = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProduct) return;

    let variantIdsToSend: string[] = [];
    if (bulkPricingScope === 'product') {
      variantIdsToSend = variants.map(v => v.id!);
    } else {
      variantIdsToSend = selectedVariantIds;
    }

    if (variantIdsToSend.length === 0) {
      setBulkError("Silakan pilih minimal satu varian terlebih dahulu.");
      return;
    }

    try {
      setIsSubmittingBulk(true);
      setBulkError(null);
      const idToken = await user?.getIdToken();

      const payload = {
        scope: bulkPricingScope,
        scopeId: bulkPricingScope === 'product' ? selectedProduct.id : undefined,
        variantIds: variantIdsToSend,
        rule: {
          name: bulkPricingScope === 'product'
            ? `Bulk Product Rule - ${selectedProduct.name}`
            : `Bulk Variant Rule - ${selectedProduct.name}`,
          description: `Aturan harga massal bertipe ${bulkPricingMethod} bernilai ${bulkPricingValue}`,
          method: bulkPricingMethod,
          value: bulkPricingValue,
          priority: bulkPricingScope === 'product' ? 10 : 20
        }
      };

      const res = await fetch("/api/admin/pricing/bulk-refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (result.success) {
        setIsBulkPricingModalOpen(false);
        setSelectedVariantIds([]);
        fetchVariants(selectedProduct.id!);
      } else {
        setBulkError(result.message || "Gagal menerapkan harga massal.");
      }
    } catch (err: any) {
      console.error("Error applying bulk pricing:", err);
      setBulkError(err.message || "Gagal menerapkan harga massal.");
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-screen">
      {/* Products List Section */}
      <div className={`xl:col-span-7 space-y-6 ${selectedProduct ? 'hidden xl:block' : 'block'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="ui-page-title text-slate-800">Produk & SKU</h1>
            <p className="text-slate-500">Kelola item jualan dan varian nominal.</p>
          </div>
          <button 
            onClick={() => { setEditingProduct(null); setIsProductModalOpen(true); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition-all shadow-sm font-medium"
          >
            <Plus className="w-5 h-5" />
            Tambah Produk
          </button>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Cari produk..." 
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produk</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Game</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipe</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="px-6 py-8 bg-slate-50/50"></td>
                    </tr>
                  ))
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                      Belum ada data produk.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr 
                      key={p.id} 
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedProduct?.id === p.id ? 'bg-blue-50/50' : ''}`}
                      onClick={() => setSelectedProduct(p)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0">
                            <img src={p.image || "https://placehold.co/100x100"} className="w-full h-full object-cover" alt="" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">{p.name}</div>
                            <div className="text-[10px] font-mono text-slate-400">{p.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600 font-medium">
                          {games.find(g => g.id === p.gameId)?.name || "Unknown Game"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200 uppercase">
                          {p.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                          p.status === 'active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => { setEditingProduct(p); setIsProductModalOpen(true); }}
                            className="p-2 hover:bg-white hover:text-blue-600 text-slate-400 rounded-lg transition-all border border-transparent hover:border-slate-200"
                            title="Edit Produk"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setResetModal({
                                isOpen: true,
                                productId: p.id!,
                                productName: p.name,
                                loading: true,
                                preview: null,
                                error: null
                              });
                              fetchResetPreview(p.id!);
                            }}
                            className="p-2 hover:bg-white hover:text-rose-600 text-slate-400 rounded-lg transition-all border border-transparent hover:border-slate-200"
                            title="Reset Produk & Mapping"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Variants List Section */}
      <div className={`xl:col-span-5 space-y-6 ${selectedProduct ? 'block' : 'hidden xl:block'}`}>
        {!selectedProduct ? (
          <div className="h-full bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-12 text-center">
            <Package className="w-16 h-16 text-slate-200 mb-4" />
            <h3 className="text-lg font-bold text-slate-400">Pilih Produk</h3>
            <p className="text-slate-400 max-w-xs mt-2">Pilih produk di sebelah kiri untuk mengelola varian nominal dan harga.</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="xl:hidden flex items-center gap-1 text-blue-600 font-bold text-xs mb-1"
                >
                  <ArrowRight className="w-3 h-3 rotate-180" /> Kembali
                </button>
                <h2 className="text-xl font-bold text-slate-800 truncate max-w-[200px] md:max-w-none">
                  Varian: {selectedProduct.name}
                </h2>
                <p className="text-xs text-slate-500">Kelola nominal top up dan mapping SKU.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {variants.length > 0 && (
                  <button 
                    onClick={() => {
                      setBulkPricingScope(selectedVariantIds.length > 0 ? 'variant' : 'product');
                      setBulkError(null);
                      setIsBulkPricingModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-all shadow-sm font-medium text-sm"
                  >
                    <Settings className="w-4 h-4" />
                    Atur Harga Massal {selectedVariantIds.length > 0 ? `(${selectedVariantIds.length})` : ''}
                  </button>
                )}
                <button 
                  onClick={() => { setEditingVariant(null); setIsVariantModalOpen(true); }}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl transition-all shadow-sm font-medium text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Varian
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {variants.length > 0 && !loadingVariants && (
                <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium font-sans">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={variants.length > 0 && selectedVariantIds.length === variants.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedVariantIds(variants.map(v => v.id!));
                        } else {
                          setSelectedVariantIds([]);
                        }
                      }}
                      className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>Pilih Semua Varian ({variants.length})</span>
                  </label>
                  {selectedVariantIds.length > 0 && (
                    <span className="text-blue-600 font-bold bg-blue-50 px-2.5 py-1 rounded-full">{selectedVariantIds.length} varian terpilih</span>
                  )}
                </div>
              )}
              <div className="divide-y divide-slate-100">
                {loadingVariants ? (
                  <div className="p-12 text-center text-slate-400 animate-pulse">Memuat varian...</div>
                ) : variants.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <Database className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    Belum ada varian untuk produk ini.
                  </div>
                ) : (
                  variants.map((v) => (
                    <div key={v.id} className="p-4 hover:bg-slate-50 transition-colors group flex items-start gap-3">
                      <input 
                        type="checkbox" 
                        checked={selectedVariantIds.includes(v.id!)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedVariantIds(prev => [...prev, v.id!]);
                          } else {
                            setSelectedVariantIds(prev => prev.filter(id => id !== v.id!));
                          }
                        }}
                        className="mt-1.5 w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer shrink-0"
                      />
                      <div className="flex-1 flex items-start justify-between gap-4 font-sans">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{v.displayName}</span>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                              v.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {v.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-500">
                            <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> SKU: <span className="font-mono font-bold text-slate-700">{v.sku}</span></span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Order: {v.sortOrder}</span>
                          </div>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                              <div className="text-[8px] text-slate-400 font-bold uppercase">Harga Jual</div>
                              <div className="text-sm font-bold text-blue-600">{formatRupiah(v.pricing?.sellingPrice || 0)}</div>
                            </div>
                            <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                              <div className="text-[8px] text-slate-400 font-bold uppercase">Modal</div>
                              <div className="text-sm font-bold text-slate-600">{formatRupiah(v.pricing?.baseCost || 0)}</div>
                            </div>
                            <div className="px-2 py-1">
                              <div className="text-[8px] text-slate-400 font-bold uppercase">Margin</div>
                              <div className="text-sm font-bold text-emerald-600">+{formatRupiah((v.pricing?.sellingPrice || 0) - (v.pricing?.baseCost || 0))}</div>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => { setEditingVariant(v); setIsVariantModalOpen(true); }}
                          className="p-2 hover:bg-white hover:text-blue-600 text-slate-300 group-hover:text-slate-400 rounded-lg transition-all border border-transparent hover:border-slate-200"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3 items-start">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700 leading-relaxed">
                <strong>Tips:</strong> SKU harus unik secara global. Penentuan harga jual sebaiknya mempertimbangkan margin minimal 2% untuk menutupi biaya payment gateway.
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Product Modal */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsProductModalOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden relative z-10">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">{editingProduct ? "Edit Produk" : "Tambah Produk Baru"}</h2>
                <button onClick={() => setIsProductModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><XCircle className="w-6 h-6 text-slate-400" /></button>
              </div>
              <form onSubmit={handleSaveProduct} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[80vh]">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Pilih Game</label>
                  <select name="gameId" defaultValue={editingProduct?.gameId} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none">
                    <option value="">Pilih Game...</option>
                    {games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Tipe Produk</label>
                  <select name="type" defaultValue={editingProduct?.type || "game_currency"} className="w-full px-4 py-2.5 rounded-xl border border-slate-200">
                    <option value="game_currency">Game Currency</option>
                    <option value="membership">Membership / Pass</option>
                    <option value="gift_card">Gift Card</option>
                    <option value="voucher">Voucher</option>
                    <option value="digital_product">Digital Product</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Nama Produk</label>
                  <input name="name" defaultValue={editingProduct?.name} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200" placeholder="Contoh: Diamonds" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Slug</label>
                  <input name="slug" defaultValue={editingProduct?.slug} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-mono" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Kategori IDs (koma)</label>
                  <input name="categoryIds" defaultValue={editingProduct?.categoryIds?.join(",")} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-mono" placeholder="cat1,cat2" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Status</label>
                  <select name="status" defaultValue={editingProduct?.status || "active"} className="w-full px-4 py-2.5 rounded-xl border border-slate-200">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Availability</label>
                  <select name="availability" defaultValue={editingProduct?.availability || "available"} className="w-full px-4 py-2.5 rounded-xl border border-slate-200">
                    <option value="available">Available</option>
                    <option value="unavailable">Unavailable</option>
                    <option value="limited">Limited</option>
                  </select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Image URL</label>
                  <input name="image" defaultValue={editingProduct?.image} className="w-full px-4 py-2.5 rounded-xl border border-slate-200" />
                </div>
                <div className="mt-8 flex gap-3 md:col-span-2">
                  <button type="button" onClick={() => setIsProductModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold">Batal</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold">Simpan Produk</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Variant Modal */}
      <AnimatePresence>
        {isVariantModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsVariantModalOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative z-10">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">{editingVariant ? "Edit Varian" : "Tambah Varian Baru"}</h2>
                <button onClick={() => setIsVariantModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><XCircle className="w-6 h-6 text-slate-400" /></button>
              </div>
              <form onSubmit={handleSaveVariant} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Internal Name</label>
                    <input name="name" defaultValue={editingVariant?.name} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200" placeholder="ml_86" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Display Name</label>
                    <input name="displayName" defaultValue={editingVariant?.displayName} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200" placeholder="86 Diamonds" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Internal SKU</label>
                  <input name="sku" defaultValue={editingVariant?.sku} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-mono" placeholder="ML-86-DIA" />
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700">Harga Modal (IDR)</label>
                      <input 
                        name="baseCost" 
                        type="number" 
                        step="0.01" 
                        defaultValue={editingVariant?.pricing?.baseCost} 
                        required 
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200" 
                        onChange={(e) => {
                          const cost = parseFloat(e.target.value) || 0;
                          const method = (document.querySelector('select[name="pricingMethod"]') as HTMLSelectElement)?.value;
                          const value = parseFloat((document.querySelector('input[name="pricingValue"]') as HTMLInputElement)?.value) || 0;
                          calculatePreview(cost, method, value);
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700">Metode Harga</label>
                      <select 
                        name="pricingMethod" 
                        defaultValue={editingVariant?.pricing?.pricingMethod || "fixed"} 
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                        onChange={(e) => {
                          const cost = parseFloat((document.querySelector('input[name="baseCost"]') as HTMLInputElement)?.value) || 0;
                          const method = e.target.value;
                          const value = parseFloat((document.querySelector('input[name="pricingValue"]') as HTMLInputElement)?.value) || 0;
                          calculatePreview(cost, method, value);
                        }}
                      >
                        <option value="fixed">Fixed Price</option>
                        <option value="markup_fixed">Fixed Markup</option>
                        <option value="markup_percentage">Percentage Markup</option>
                        <option value="target_margin">Target Margin (%)</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Nilai / Harga Jual</label>
                    <input 
                      name="pricingValue" 
                      type="number" 
                      step="0.01" 
                      defaultValue={editingVariant?.pricing?.pricingMethod === 'fixed' || !editingVariant?.pricing?.pricingMethod ? editingVariant?.pricing?.sellingPrice : 0} 
                      required 
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200" 
                      onChange={(e) => {
                        const cost = parseFloat((document.querySelector('input[name="baseCost"]') as HTMLInputElement)?.value) || 0;
                        const method = (document.querySelector('select[name="pricingMethod"]') as HTMLSelectElement)?.value;
                        const value = parseFloat(e.target.value) || 0;
                        calculatePreview(cost, method, value);
                      }}
                    />
                  </div>

                  {pricingPreview && (
                    <div className={`p-4 rounded-2xl border transition-all ${
                      pricingPreview.status === 'negative_margin' ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'
                    }`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">Preview Kalkulasi</span>
                        {pricingPreview.status === 'negative_margin' && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 uppercase">
                            <AlertTriangle className="w-3 h-3" /> Jual Rugi
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase font-bold">Harga Jual</div>
                          <div className="text-lg font-black text-slate-900">{formatRupiah(pricingPreview.sellingPrice)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase font-bold">Margin</div>
                          <div className={`text-lg font-black ${pricingPreview.margin < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {pricingPreview.margin > 0 ? '+' : ''}{formatRupiah(pricingPreview.margin)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase font-bold">Margin %</div>
                          <div className={`text-lg font-black ${pricingPreview.marginPercentage < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {pricingPreview.marginPercentage}%
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Status</label>
                    <select name="status" defaultValue={editingVariant?.status || "active"} className="w-full px-4 py-2.5 rounded-xl border border-slate-200">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Sort Order</label>
                    <input name="sortOrder" type="number" defaultValue={editingVariant?.sortOrder || 0} className="w-full px-4 py-2.5 rounded-xl border border-slate-200" />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsVariantModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold">Batal</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold">Simpan Varian</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Product and Mapping Modal */}
      <AnimatePresence>
        {resetModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !resetModal.loading && setResetModal(prev => ({ ...prev, isOpen: false }))} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative z-10">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">Reset Produk & Mapping</h2>
                <button disabled={resetModal.loading} onClick={() => setResetModal(prev => ({ ...prev, isOpen: false }))} className="p-2 hover:bg-slate-100 rounded-full disabled:opacity-50"><XCircle className="w-6 h-6 text-slate-400" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="text-sm text-slate-600">
                  Anda akan mereset produk <strong className="text-slate-800">{resetModal.productName}</strong>. Tindakan ini akan membersihkan produk, varian, dan mapping-nya untuk keperluan import ulang.
                </div>

                {resetModal.loading && !resetModal.preview && !resetModal.error && (
                  <div className="py-8 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-slate-500 font-medium">Memeriksa dependensi produk...</span>
                  </div>
                )}

                {resetModal.error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl space-y-2">
                    <div className="flex gap-2 items-center text-rose-800 font-bold text-sm">
                      <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
                      Gagal Memvalidasi Reset
                    </div>
                    <div className="text-xs text-rose-700 leading-relaxed">
                      {resetModal.error}
                    </div>
                  </div>
                )}

                {resetModal.preview && (
                  <div className="space-y-4">
                    {resetModal.preview.hasTransactions ? (
                      <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl space-y-2">
                        <div className="flex gap-2 items-start text-rose-800 font-bold text-sm">
                          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                          <span>Reset Dibatalkan (Dependensi Aktif)</span>
                        </div>
                        <p className="text-xs text-rose-700 leading-relaxed">
                          Produk ini memiliki riwayat transaksi aktif. Demi menjaga integritas data finansial, Anda tidak diizinkan menghapus atau mereset produk ini.
                        </p>
                        {resetModal.preview.linkedOrders.length > 0 && (
                          <div className="pt-1.5 space-y-1">
                            <div className="text-[10px] uppercase font-bold text-rose-800">Invoice Terkait:</div>
                            <div className="flex flex-wrap gap-1">
                              {resetModal.preview.linkedOrders.map(invoice => (
                                <span key={invoice} className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-mono font-bold">
                                  {invoice}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                          <div className="text-xs text-emerald-800 font-bold mb-2 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Produk Aman untuk Direset
                          </div>
                          <p className="text-xs text-emerald-700 leading-relaxed">
                            Tidak ditemukan dependensi transaksi. Anda aman untuk melakukan reset bersih.
                          </p>
                        </div>

                        <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                          <div className="p-3 bg-slate-50 flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-500 uppercase">Item yang akan Dihapus</span>
                          </div>
                          <div className="p-3 flex justify-between items-center text-sm">
                            <span className="text-slate-600">iStore Product</span>
                            <span className="font-bold text-slate-800">1</span>
                          </div>
                          <div className="p-3 flex justify-between items-center text-sm">
                            <span className="text-slate-600">iStore Variant SKU</span>
                            <span className="font-bold text-slate-800">{resetModal.preview.variantCount}</span>
                          </div>
                          <div className="p-3 flex justify-between items-center text-sm">
                            <span className="text-slate-600">Provider Mapping</span>
                            <span className="font-bold text-slate-800">{resetModal.preview.mappingCount}</span>
                          </div>
                        </div>

                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl text-[11px] text-amber-800 leading-relaxed">
                          <strong>Note:</strong> Game, Kategori, Provider, dan data Provider SKU tidak akan dihapus. Hanya produk lokal iStore ini beserta mapping variannya yang akan di-reset.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    disabled={resetModal.loading}
                    onClick={() => setResetModal(prev => ({ ...prev, isOpen: false }))} 
                    className="flex-1 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button 
                    type="button"
                    disabled={resetModal.loading || !resetModal.preview || resetModal.preview.hasTransactions}
                    onClick={handleResetProduct}
                    className="flex-1 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {resetModal.loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      'Reset Sekarang'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Pricing Modal */}
      <AnimatePresence>
        {isBulkPricingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
              onClick={() => setIsBulkPricingModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative z-10 font-sans"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">Atur Harga Massal</h2>
                <button 
                  onClick={() => setIsBulkPricingModalOpen(false)} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <XCircle className="w-6 h-6 text-slate-400 hover:text-slate-600" />
                </button>
              </div>
              <form onSubmit={handleSaveBulkPricing} className="p-6 space-y-4">
                
                {bulkError && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-700">
                    {bulkError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Scope Penerapan</label>
                  <select 
                    value={bulkPricingScope} 
                    onChange={(e) => setBulkPricingScope(e.target.value as any)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-sm font-medium focus:border-blue-500 transition-colors"
                  >
                    <option value="product">Semua Varian pada Produk ({variants.length} item)</option>
                    <option value="variant">Hanya Varian Terpilih ({selectedVariantIds.length} item)</option>
                  </select>
                  {bulkPricingScope === 'variant' && selectedVariantIds.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">⚠️ Anda belum mencentang varian apa pun. Silakan centang varian terlebih dahulu atau pilih mode 'Semua Varian'.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Metode Harga</label>
                    <select 
                      value={bulkPricingMethod} 
                      onChange={(e) => setBulkPricingMethod(e.target.value as any)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:border-blue-500 transition-colors"
                    >
                      <option value="fixed">Fixed Price</option>
                      <option value="markup_fixed">Fixed Markup (IDR)</option>
                      <option value="markup_percentage">Percentage Markup (%)</option>
                      <option value="target_margin">Target Margin (%)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Nilai Aturan</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={bulkPricingValue} 
                      onChange={(e) => setBulkPricingValue(parseFloat(e.target.value) || 0)}
                      required 
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500 transition-colors" 
                      placeholder="Contoh: 10 atau 5000"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500 leading-relaxed space-y-1">
                  <span className="font-bold text-slate-700">Penjelasan Metode:</span>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li><strong>Fixed Price:</strong> Harga jual langsung ditetapkan seharga nilai ini.</li>
                    <li><strong>Fixed Markup:</strong> Harga jual = modal + nilai rupiah ini.</li>
                    <li><strong>Percentage Markup:</strong> Harga jual = modal + markup % dari modal.</li>
                    <li><strong>Target Margin:</strong> Harga jual dihitung agar memperoleh % margin target.</li>
                  </ul>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsBulkPricingModalOpen(false)} 
                    className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmittingBulk || (bulkPricingScope === 'variant' && selectedVariantIds.length === 0)}
                    className="flex-1 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  >
                    {isSubmittingBulk ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      'Terapkan & Refresh'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
