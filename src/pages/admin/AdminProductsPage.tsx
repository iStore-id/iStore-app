import React, { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Product, Game, ProductVariant, Category } from "../../types/core";
import { 
  Plus, Search, Edit2, Trash2, CheckCircle2, XCircle, 
  ChevronRight, Package, Tag, DollarSign, Settings,
  AlertTriangle, ArrowRight, BarChart3, Database, Clock, Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuthStore } from "../../store/auth-store";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);

  const { user } = useAuthStore();

  const fetchData = async () => {
    try {
      setLoading(true);
      const prodSnap = await getDocs(query(collection(db, "products"), orderBy("sortOrder", "asc")));
      setProducts(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));

      const gameSnap = await getDocs(query(collection(db, "games"), orderBy("name", "asc")));
      setGames(gameSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game)));

      const catSnap = await getDocs(query(collection(db, "categories"), orderBy("name", "asc")));
      setCategories(catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVariants = async (productId: string) => {
    try {
      setLoadingVariants(true);
      const q = query(collection(db, "productVariants"), where("productId", "==", productId), orderBy("sortOrder", "asc"));
      const snap = await getDocs(q);
      setVariants(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductVariant)));
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
            <h1 className="text-2xl font-bold text-slate-800">Produk & SKU</h1>
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
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditingProduct(p); setIsProductModalOpen(true); }}
                          className="p-2 hover:bg-white hover:text-blue-600 text-slate-400 rounded-lg transition-all border border-transparent hover:border-slate-200"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
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
              <button 
                onClick={() => { setEditingVariant(null); setIsVariantModalOpen(true); }}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl transition-all shadow-sm font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                Tambah Varian
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
                    <div key={v.id} className="p-4 hover:bg-slate-50 transition-colors group">
                      <div className="flex items-start justify-between gap-4">
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
    </div>
  );
}
