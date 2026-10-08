import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { 
  Game, 
  Category, 
  Product, 
  ProductVariant, 
  ProviderMapping, 
  Provider, 
  ProviderSku 
} from "../../types/core";
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Gamepad2, 
  Layers, 
  ArrowLeft, 
  ArrowRightLeft, 
  Check, 
  X, 
  AlertCircle, 
  Info, 
  ShieldCheck, 
  RefreshCw, 
  ChevronRight, 
  FolderMinus, 
  Package, 
  LayoutGrid, 
  List,
  ExternalLink,
  Upload
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuthStore } from "../../store/auth-store";

export default function AdminGamesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Navigation & View States
  const [activeTab, setActiveTab] = useState<"games" | "categories">("games");
  const [gameViewMode, setGameViewMode] = useState<"table" | "grid">("table");
  const [selectedGameForCatalog, setSelectedGameForCatalog] = useState<Game | null>(null);

  // Master Data
  const [games, setGames] = useState<Game[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [mappings, setMappings] = useState<ProviderMapping[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerSkus, setProviderSkus] = useState<ProviderSku[]>([]);

  // Loading & Feedback
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search & Filter (Level 1: Games & Categories)
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [gameCategoryFilter, setGameCategoryFilter] = useState<string>("all");

  // Search & Filter (Level 2: Game-Centric Product Catalog)
  const [productSearch, setProductSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "active" | "inactive">("ALL");

  // CRUD Modals: Game & Category
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [selectedCategoryIdsInModal, setSelectedCategoryIdsInModal] = useState<string[]>([]);

  // Minimal manual category move
  const [movingGameCategory, setMovingGameCategory] = useState<Game | null>(null);
  const [targetCategoryId, setTargetCategoryId] = useState("");
  const [isSubmittingCategoryMove, setIsSubmittingCategoryMove] = useState(false);

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: "game" | "category";
    id: string;
    name: string;
  }>({ isOpen: false, type: "game", id: "", name: "" });

  // Game-Centric Modals: Tambah Produk ke Game
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalTab, setAddModalTab] = useState<"catalog" | "provider_skus">("catalog");
  const [addModalSearch, setAddModalSearch] = useState("");
  const [addModalOriginFilter, setAddModalOriginFilter] = useState<"ALL" | "UNASSIGNED" | "OTHER_GAMES">("ALL");
  const [selectedProductIdsToAdd, setSelectedProductIdsToAdd] = useState<string[]>([]);
  const [selectedProviderSkuIds, setSelectedProviderSkuIds] = useState<string[]>([]);
  const [importResults, setImportResults] = useState<any[] | null>(null);
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Game-Centric Modals: Pindahkan Produk
  const [movingProduct, setMovingProduct] = useState<Product | null>(null);
  const [targetGameId, setTargetGameId] = useState("");
  const [isSubmittingMove, setIsSubmittingMove] = useState(false);

  // Game-Centric Modals: Hapus/Nonaktifkan dari Katalog Game
  const [removingProduct, setRemovingProduct] = useState<Product | null>(null);
  const [isSubmittingRemove, setIsSubmittingRemove] = useState(false);

  const { user } = useAuthStore();

  // Toast Helper
  const showToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  // Fetch all necessary data
  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      const idToken = await user?.getIdToken();
      const headers = {
        "Content-Type": "application/json",
        ...(idToken ? { "Authorization": `Bearer ${idToken}` } : {})
      };

      const [gamesRes, categoriesRes, prodRes, varRes, mapRes, provRes, skusRes] = await Promise.all([
        fetch("/api/admin/catalog/games", { headers }),
        fetch("/api/admin/catalog/categories", { headers }),
        fetch("/api/admin/catalog/products", { headers }),
        fetch("/api/admin/catalog/variants", { headers }),
        fetch("/api/admin/providers/mappings", { headers }),
        fetch("/api/admin/providers", { headers }),
        fetch("/api/admin/providers/skus", { headers }),
      ]);

      const [gamesJson, categoriesJson, prodJson, varJson, mapJson, provJson, skusJson] = await Promise.all([
        gamesRes.json(),
        categoriesRes.json(),
        prodRes.json(),
        varRes.json(),
        mapRes.json(),
        provRes.json(),
        skusRes.json(),
      ]);

      if (gamesJson.success) setGames(gamesJson.data || []);
      if (categoriesJson.success) setCategories(categoriesJson.data || []);
      if (prodJson.success) setProducts(prodJson.data || []);
      if (varJson.success) setVariants(varJson.data || []);
      if (provJson.success) setProviders(provJson.data || []);
      if (skusJson.success) setProviderSkus(skusJson.data || []);

      if (mapJson.success) {
        const mappingList = Array.isArray(mapJson.data)
          ? mapJson.data
          : Array.isArray(mapJson.data?.data)
            ? mapJson.data.data
            : Array.isArray(mapJson.mappings)
              ? mapJson.mappings
              : [];
        setMappings(mappingList);
      }
    } catch (err: any) {
      console.error("Error fetching catalog data:", err);
      setError(err.message || "Gagal memuat data katalog.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Initialize selected categories when modal opens
  useEffect(() => {
    if (isGameModalOpen) {
      if (editingGame) {
        setSelectedCategoryIdsInModal(editingGame.categoryIds || []);
      } else {
        setSelectedCategoryIdsInModal([]);
      }
    }
  }, [isGameModalOpen, editingGame]);

  // Sync gameId URL parameter with selectedGameForCatalog
  useEffect(() => {
    const gameIdParam = searchParams.get("gameId");
    if (gameIdParam && games.length > 0) {
      const match = games.find(g => g.id === gameIdParam);
      if (match) {
        setSelectedGameForCatalog(match);
      }
    }
  }, [searchParams, games]);

  const handleSelectGameCatalog = (game: Game | null) => {
    setSelectedGameForCatalog(game);
    setProductSearch("");
    setProviderFilter("ALL");
    setStatusFilter("ALL");
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (game?.id) {
        next.set("gameId", game.id);
      } else {
        next.delete("gameId");
      }
      return next;
    });
  };

  // ==========================================
  // MEMOIZED MAPS & HELPERS
  // ==========================================

  const gameMap = useMemo(() => {
    const map = new Map<string, Game>();
    games.forEach(g => {
      if (g.id) map.set(g.id, g);
    });
    return map;
  }, [games]);

  const providerMap = useMemo(() => {
    const map = new Map<string, Provider>();
    providers.forEach(p => {
      if (p.id) map.set(p.id, p);
    });
    return map;
  }, [providers]);

  const variantsByProductId = useMemo(() => {
    const map = new Map<string, ProductVariant[]>();
    variants.forEach(v => {
      if (v.productId) {
        const list = map.get(v.productId) || [];
        list.push(v);
        map.set(v.productId, list);
      }
    });
    return map;
  }, [variants]);

  const mappingsByVariantId = useMemo(() => {
    const map = new Map<string, ProviderMapping[]>();
    mappings.forEach(m => {
      if (m.variantId) {
        const list = map.get(m.variantId) || [];
        list.push(m);
        map.set(m.variantId, list);
      }
    });
    return map;
  }, [mappings]);

  const productCountPerGame = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach(p => {
      if (p.gameId) {
        counts.set(p.gameId, (counts.get(p.gameId) || 0) + 1);
      }
    });
    return counts;
  }, [products]);

  const productsInSelectedGame = useMemo(() => {
    if (!selectedGameForCatalog) return [];
    return products.filter(p => p.gameId === selectedGameForCatalog.id);
  }, [products, selectedGameForCatalog]);

  const filteredProducts = useMemo(() => {
    return productsInSelectedGame.filter(p => {
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase();
        const pVariants = variantsByProductId.get(p.id || "") || [];
        const matchesName = (p.name || "").toLowerCase().includes(q);
        const matchesSlug = (p.slug || "").toLowerCase().includes(q);
        const matchesVariant = pVariants.some(v => 
          (v.name || "").toLowerCase().includes(q) || 
          (v.sku || "").toLowerCase().includes(q)
        );
        if (!matchesName && !matchesSlug && !matchesVariant) return false;
      }

      if (statusFilter !== "ALL") {
        if (p.status !== statusFilter) return false;
      }

      if (providerFilter !== "ALL") {
        const pVariants = variantsByProductId.get(p.id || "") || [];
        const pMappings = pVariants.flatMap(v => mappingsByVariantId.get(v.id || "") || []);
        const hasProvider = pMappings.some(m => m.providerId === providerFilter);
        if (!hasProvider) return false;
      }

      return true;
    });
  }, [productsInSelectedGame, productSearch, statusFilter, providerFilter, variantsByProductId, mappingsByVariantId]);

  const filteredGames = useMemo(() => {
    return games.filter(g => {
      const matchesSearch = (g.name || "").toLowerCase().includes(search.toLowerCase()) || 
                           (g.slug || "").toLowerCase().includes(search.toLowerCase());
      const matchesStatus = filterStatus === "all" || g.status === filterStatus;
      const matchesCategory = gameCategoryFilter === "all" || (g.categoryIds || []).includes(gameCategoryFilter);
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [games, search, filterStatus, gameCategoryFilter]);

  const filteredCategories = useMemo(() => {
    return categories.filter(c => {
      const matchesSearch = (c.name || "").toLowerCase().includes(search.toLowerCase()) || 
                           (c.slug || "").toLowerCase().includes(search.toLowerCase());
      const matchesStatus = filterStatus === "all" || c.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [categories, search, filterStatus]);

  const availableProductsToAdd = useMemo(() => {
    if (!selectedGameForCatalog) return [];
    return products.filter(p => {
      if (p.gameId === selectedGameForCatalog.id) return false;

      if (addModalOriginFilter === "UNASSIGNED") {
        if (p.gameId && gameMap.has(p.gameId)) return false;
      } else if (addModalOriginFilter === "OTHER_GAMES") {
        if (!p.gameId || !gameMap.has(p.gameId)) return false;
      }

      if (addModalSearch.trim()) {
        const q = addModalSearch.toLowerCase();
        const pVariants = variantsByProductId.get(p.id || "") || [];
        const matchesName = (p.name || "").toLowerCase().includes(q);
        const matchesSlug = (p.slug || "").toLowerCase().includes(q);
        const matchesVariant = pVariants.some(v => 
          (v.name || "").toLowerCase().includes(q) || 
          (v.sku || "").toLowerCase().includes(q)
        );
        if (!matchesName && !matchesSlug && !matchesVariant) return false;
      }

      return true;
    });
  }, [products, selectedGameForCatalog, addModalOriginFilter, addModalSearch, gameMap, variantsByProductId]);

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  };

  const getProductProviderInfo = (productId: string) => {
    const pVariants = variantsByProductId.get(productId) || [];
    const pMappings = pVariants.flatMap(v => mappingsByVariantId.get(v.id || "") || []);
    const uniqueProviderIds = Array.from(new Set(pMappings.map(m => m.providerId).filter(Boolean)));
    const providerNames = uniqueProviderIds.map(id => providerMap.get(id)?.name || id);
    const skuCodes = Array.from(new Set(pMappings.map(m => m.providerSku).filter(Boolean)));
    
    const prices = pVariants.map(v => v.pricing?.sellingPrice || 0).filter(p => p > 0);
    let priceDisplay = "-";
    if (prices.length === 1) {
      priceDisplay = formatPrice(prices[0]);
    } else if (prices.length > 1) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      priceDisplay = min === max ? formatPrice(min) : `${formatPrice(min)} - ${formatPrice(max)}`;
    }

    return {
      providerNames,
      skuCodes,
      variantCount: pVariants.length,
      priceDisplay,
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "inactive": return "bg-slate-100 text-slate-700 border-slate-200";
      case "maintenance": return "bg-amber-100 text-amber-700 border-amber-200";
      case "archived": return "bg-rose-100 text-rose-700 border-rose-200";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  // ==========================================
  // GAME CRUD HANDLERS (EXISTING)
  // ==========================================

  const handleSaveGame = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const idToken = await user?.getIdToken();
    
    const gameData = {
      name: formData.get("name") as string,
      slug: (formData.get("slug") as string).toLowerCase().replace(/\s+/g, '-'),
      description: formData.get("description") as string,
      image: formData.get("image") as string,
      icon: formData.get("icon") as string,
      status: formData.get("status") as any,
      availability: formData.get("availability") as any,
      sortOrder: parseInt(formData.get("sortOrder") as string) || 0,
      categoryIds: selectedCategoryIdsInModal,
      searchKeywords: (formData.get("searchKeywords") as string).split(",").map(k => k.trim()).filter(Boolean),
    };

    try {
      const url = editingGame ? `/api/admin/games/${editingGame.id}` : "/api/admin/games";
      const method = editingGame ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
        body: JSON.stringify(gameData)
      });

      const result = await res.json();
      if (result.success) {
        setIsGameModalOpen(false);
        setEditingGame(null);
        showToast(`Game "${gameData.name}" berhasil disimpan.`);
        fetchAllData();
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error("Error saving game:", err);
    }
  };

  const handleExecuteMoveGameCategory = async () => {
    if (!movingGameCategory || !targetCategoryId) return;

    if ((movingGameCategory.categoryIds || []).length === 1 && movingGameCategory.categoryIds?.[0] === targetCategoryId) {
      setError("Game sudah berada di kategori tersebut.");
      return;
    }

    try {
      setIsSubmittingCategoryMove(true);
      setError(null);
      const token = await user?.getIdToken();
      if (!token) throw new Error("Sesi login berakhir.");

      const res = await fetch(`/api/admin/games/${movingGameCategory.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          categoryIds: [targetCategoryId]
        })
      });

      const result = await res.json();
      if (!result.success) {
        throw new Error(result.message || "Gagal memindahkan kategori.");
      }

      const targetCategory = categories.find(c => c.id === targetCategoryId);
      showToast(`Game "${movingGameCategory.name}" dipindahkan ke kategori "${targetCategory?.name || targetCategoryId}".`);
      setMovingGameCategory(null);
      setTargetCategoryId("");
      await fetchAllData();
    } catch (err: any) {
      console.error("Error moving game category:", err);
      setError(err.message || "Gagal memindahkan kategori.");
    } finally {
      setIsSubmittingCategoryMove(false);
    }
  };

  const executeDeleteGame = async (id: string) => {
    try {
      const idToken = await user?.getIdToken();
      const res = await fetch(`/api/admin/games/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${idToken}` }
      });
      const result = await res.json();
      if (result.success) {
        showToast("Game berhasil dihapus.");
        fetchAllData();
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error("Error deleting game:", err);
    }
  };

  // ==========================================
  // GAME-CENTRIC WORKFLOW HANDLERS (REUSED)
  // ==========================================

  // Tambah Produk ke Game
  const handleExecuteAddProducts = async () => {
    if (!selectedGameForCatalog || selectedProductIdsToAdd.length === 0) return;

    try {
      setIsSubmittingAdd(true);
      setError(null);
      const token = await user?.getIdToken();
      if (!token) throw new Error("Sesi login berakhir.");

      const updates = selectedProductIdsToAdd.map(async (productId) => {
        const res = await fetch(`/api/admin/products/${productId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            gameId: selectedGameForCatalog.id,
            status: 'active'
          })
        });
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.message || `Gagal menambahkan produk ${productId}`);
        }
      });

      await Promise.all(updates);

      showToast(`Berhasil menambahkan ${selectedProductIdsToAdd.length} produk ke katalog ${selectedGameForCatalog.name}.`);
      setIsAddModalOpen(false);
      setSelectedProductIdsToAdd([]);
      setAddModalSearch("");
      await fetchAllData();
    } catch (err: any) {
      console.error("Error adding products to game:", err);
      setError(err.message || "Gagal menambahkan produk ke katalog.");
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const handleExecuteBulkImport = async () => {
    if (!selectedGameForCatalog || selectedProviderSkuIds.length === 0) return;
    
    setIsSubmittingImport(true);
    setImportResults(null);
    try {
      const idToken = await user?.getIdToken();
      const response = await fetch("/api/admin/catalog/bulk-import-skus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { "Authorization": `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({ 
          gameId: selectedGameForCatalog.id,
          providerSkuIds: selectedProviderSkuIds
        })
      });

      const res = await response.json();
      if (!res.success && !Array.isArray(res.data)) {
        throw new Error(res.message || "Gagal melakukan import.");
      }

      setImportResults(Array.isArray(res.data) ? res.data : []);
      
      // Refresh data to show new products/variants
      await fetchAllData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmittingImport(false);
    }
  };

  // Pindahkan Produk Antar Game
  const handleExecuteMoveProduct = async () => {
    if (!movingProduct || !targetGameId) return;

    try {
      setIsSubmittingMove(true);
      setError(null);
      const token = await user?.getIdToken();
      if (!token) throw new Error("Sesi login berakhir.");

      const targetGame = gameMap.get(targetGameId);
      const targetGameName = targetGame?.name || "Game Tujuan";

      const res = await fetch(`/api/admin/products/${movingProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          gameId: targetGameId,
          status: 'active'
        })
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || "Gagal memindahkan produk.");
      }

      showToast(`Produk "${movingProduct.name}" berhasil dipindahkan ke katalog ${targetGameName}. Data SKU dan Provider tetap aman.`);
      setMovingProduct(null);
      setTargetGameId("");
      await fetchAllData();
    } catch (err: any) {
      console.error("Error moving product:", err);
      setError(err.message || "Gagal memindahkan produk.");
    } finally {
      setIsSubmittingMove(false);
    }
  };

  // Hapus/Nonaktifkan dari Katalog Game
  const handleExecuteRemoveProduct = async () => {
    if (!removingProduct || !selectedGameForCatalog) return;

    try {
      setIsSubmittingRemove(true);
      setError(null);
      const token = await user?.getIdToken();
      if (!token) throw new Error("Sesi login berakhir.");

      const res = await fetch(`/api/admin/products/${removingProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'inactive'
        })
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || "Gagal menghapus produk dari katalog.");
      }

      showToast(`Produk "${removingProduct.name}" dinonaktifkan dari katalog ${selectedGameForCatalog.name}. Data SKU supplier tetap aman.`);
      setRemovingProduct(null);
      await fetchAllData();
    } catch (err: any) {
      console.error("Error removing product from catalog:", err);
      setError(err.message || "Gagal menghapus produk dari katalog.");
    } finally {
      setIsSubmittingRemove(false);
    }
  };

  const toggleSelectProductToAdd = (id: string) => {
    setSelectedProductIdsToAdd(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllToAdd = () => {
    if (selectedProductIdsToAdd.length === availableProductsToAdd.length) {
      setSelectedProductIdsToAdd([]);
    } else {
      setSelectedProductIdsToAdd(availableProductsToAdd.map(p => p.id || '').filter(Boolean));
    }
  };

  // ==========================================
  // RENDER LEVEL 2: DETAIL KATALOG GAME
  // ==========================================

  if (selectedGameForCatalog) {
    return (
      <div className="space-y-6">
        {/* Feedback Messages */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-800 text-sm shadow-sm"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
              <button 
                onClick={() => setSuccessMessage(null)}
                className="p-1 hover:bg-emerald-100 rounded-lg transition-colors text-emerald-700"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-red-800 text-sm shadow-sm"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
              <button 
                onClick={() => setError(null)}
                className="p-1 hover:bg-red-100 rounded-lg transition-colors text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Level 2 Breadcrumb & Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 border border-slate-200 p-4 sm:p-6 rounded-2xl">
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleSelectGameCatalog(null)}
              className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors shadow-sm shrink-0"
              title="Kembali ke Daftar Game"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0 flex items-center justify-center">
              {selectedGameForCatalog.image || selectedGameForCatalog.icon ? (
                <img 
                  src={selectedGameForCatalog.image || selectedGameForCatalog.icon} 
                  alt={selectedGameForCatalog.name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Gamepad2 className="w-6 h-6 text-slate-400" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">{selectedGameForCatalog.name}</h2>
                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold rounded-full">
                  {productsInSelectedGame.length} Produk
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Slug: <span className="font-mono text-slate-700">{selectedGameForCatalog.slug}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`/admin/products?gameId=${selectedGameForCatalog.id}`}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors text-xs font-semibold"
              title="Buka manajemen teknis varian dan SKU di Master Produk"
            >
              <span>Master Produk</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={() => {
                setSelectedProductIdsToAdd([]);
                setAddModalSearch("");
                setAddModalOriginFilter("ALL");
                setAddModalTab("catalog");
                setIsAddModalOpen(true);
              }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition-all shadow-sm text-sm font-semibold hover:shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Produk</span>
            </button>
          </div>
        </div>

        {/* Quick Game Switcher Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 text-xs">
          <span className="text-slate-400 font-medium whitespace-nowrap pl-1">Pindah Game:</span>
          {games.map(g => (
            <button
              key={g.id}
              onClick={() => handleSelectGameCatalog(g)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all font-medium ${
                g.id === selectedGameForCatalog.id 
                  ? 'bg-blue-600 text-white font-bold shadow-sm' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Cari produk di katalog game ini (nama, slug, SKU)..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
            />
            {productSearch && (
              <button
                onClick={() => setProductSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Provider Filter */}
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">Semua Provider</option>
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Tidak Aktif</option>
            </select>
          </div>
        </div>

        {/* Table of Products in Selected Game */}
        {filteredProducts.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                    <th className="py-3.5 px-4">Nama Produk</th>
                    <th className="py-3.5 px-4">Varian & SKU</th>
                    <th className="py-3.5 px-4">Provider / Supplier</th>
                    <th className="py-3.5 px-4">Harga Katalog</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((product) => {
                    const info = getProductProviderInfo(product.id || '');
                    const isInactive = product.status === 'inactive';

                    return (
                      <tr 
                        key={product.id} 
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isInactive ? 'bg-slate-50/40 text-slate-400' : ''
                        }`}
                      >
                        {/* 1. Nama Produk */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                              {product.image ? (
                                <img 
                                  src={product.image} 
                                  alt={product.name} 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <Package className="w-5 h-5 text-slate-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 leading-tight">
                                {product.name}
                              </p>
                              <p className="text-xs text-slate-400 font-mono mt-0.5">
                                {product.slug}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* 2. Varian & SKU */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold">
                                {info.variantCount} Varian
                              </span>
                            </div>
                            {info.skuCodes.length > 0 && (
                              <p className="text-[11px] text-slate-500 font-mono truncate max-w-xs" title={info.skuCodes.join(', ')}>
                                SKU: {info.skuCodes.slice(0, 2).join(', ')}{info.skuCodes.length > 2 ? '...' : ''}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* 3. Provider / Supplier */}
                        <td className="py-3.5 px-4">
                          {info.providerNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {info.providerNames.map((name, idx) => (
                                <span 
                                  key={idx}
                                  className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-medium"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">Belum terpetakan</span>
                          )}
                        </td>

                        {/* 4. Harga */}
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {info.priceDisplay}
                        </td>

                        {/* 5. Status */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            product.status === 'active' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {product.status === 'active' ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Aktif</span>
                              </>
                            ) : (
                              <>
                                <X className="w-3 h-3 text-slate-400" />
                                <span>Nonaktif</span>
                              </>
                            )}
                          </span>
                        </td>

                        {/* 6. Aksi */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setMovingProduct(product);
                                const otherGames = games.filter(g => g.id !== selectedGameForCatalog.id);
                                setTargetGameId(otherGames[0]?.id || '');
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg text-xs font-semibold transition-colors border border-slate-200"
                              title="Pindahkan ke game/brand lain"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              <span>Pindahkan</span>
                            </button>

                            <button
                              onClick={() => setRemovingProduct(product)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-600 rounded-lg text-xs font-semibold transition-colors border border-slate-200"
                              title="Hapus dari katalog game ini"
                            >
                              <FolderMinus className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Hapus</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 p-8">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-900 text-base">
              Belum Ada Produk di Katalog {selectedGameForCatalog.name}
            </h3>
            <p className="text-slate-500 text-xs mt-1 max-w-md mx-auto leading-relaxed">
              Katalog game ini belum memiliki produk terkait. Klik tombol "+ Tambah Produk" di atas untuk memasukkan produk ke game ini.
            </p>
            <div className="mt-5">
              <button
                onClick={() => {
                  setSelectedProductIdsToAdd([]);
                  setAddModalSearch("");
                  setAddModalOriginFilter("ALL");
                  setAddModalTab("catalog");
                  setIsAddModalOpen(true);
                }}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Produk Sekarang</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal: Tambah Produk ke Game */}
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      Tambah Produk ke {selectedGameForCatalog.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pilih produk yang tersedia untuk dikaitkan ke katalog game ini.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setImportResults(null);
                    setSelectedProviderSkuIds([]);
                  }}
                  className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="flex border-b border-slate-200 bg-white">
                <button
                  onClick={() => setAddModalTab("catalog")}
                  className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                    addModalTab === "catalog" 
                      ? 'border-blue-600 text-blue-600 bg-blue-50/30' 
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Katalog Master
                </button>
                <button
                  onClick={() => setAddModalTab("provider_skus")}
                  className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                    addModalTab === "provider_skus" 
                      ? 'border-blue-600 text-blue-600 bg-blue-50/30' 
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Provider SKUs
                </button>
              </div>

              {addModalTab === "catalog" ? (
                <>
                  <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
                    <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={addModalSearch}
                      onChange={(e) => setAddModalSearch(e.target.value)}
                      placeholder="Cari produk berdasarkan nama atau SKU..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500"
                    />
                  </div>

                  <select
                    value={addModalOriginFilter}
                    onChange={(e) => setAddModalOriginFilter(e.target.value as any)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none"
                  >
                    <option value="ALL">Semua Asal Produk</option>
                    <option value="UNASSIGNED">Produk Belum Terhubung Game</option>
                    <option value="OTHER_GAMES">Produk Dari Game Lain</option>
                  </select>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>
                    {availableProductsToAdd.length} produk tersedia untuk ditambahkan
                  </span>
                  <button
                    onClick={handleSelectAllToAdd}
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    {selectedProductIdsToAdd.length === availableProductsToAdd.length && availableProductsToAdd.length > 0
                      ? 'Batal Pilih Semua'
                      : 'Pilih Semua'}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {availableProductsToAdd.length > 0 ? (
                  availableProductsToAdd.map((prod) => {
                    const isChecked = selectedProductIdsToAdd.includes(prod.id || '');
                    const currentGame = prod.gameId ? gameMap.get(prod.gameId)?.name : null;
                    const info = getProductProviderInfo(prod.id || '');

                    return (
                      <div
                        key={prod.id}
                        onClick={() => toggleSelectProductToAdd(prod.id || '')}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                          isChecked 
                            ? 'bg-blue-50/70 border-blue-300 shadow-xs' 
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 text-sm truncate">
                              {prod.name}
                            </p>
                            {currentGame ? (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded shrink-0">
                                Saat ini di: {currentGame}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-semibold rounded shrink-0">
                                Belum ada game
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                            <span className="font-semibold text-slate-700">{info.priceDisplay}</span>
                            {info.providerNames.length > 0 && (
                              <span>• {info.providerNames.join(', ')}</span>
                            )}
                            <span>• {info.variantCount} Varian</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    Tidak ada produk yang cocok dengan filter pencarian.
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="text-xs text-slate-600 font-medium">
                  <span className="font-bold text-blue-600">{selectedProductIdsToAdd.length}</span> produk dipilih
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleExecuteAddProducts}
                    disabled={selectedProductIdsToAdd.length === 0 || isSubmittingAdd}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:cursor-not-allowed"
                  >
                    {isSubmittingAdd ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Menambahkan...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Tambahkan ({selectedProductIdsToAdd.length})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
                </>
              ) : (
                <>
                  {/* Provider SKUs Import Tab */}
                  <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={addModalSearch}
                          onChange={(e) => setAddModalSearch(e.target.value)}
                          placeholder="Cari SKU provider (nama, kode)..."
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500"
                        />
                      </div>

                      <select
                        value={providerFilter}
                        onChange={(e) => setProviderFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none"
                      >
                        <option value="ALL">Semua Provider</option>
                        {providers.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    {!importResults && (
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                        <span>
                          {providerSkus.filter(s => 
                            (providerFilter === 'ALL' || s.providerId === providerFilter) &&
                            (s.name.toLowerCase().includes(addModalSearch.toLowerCase()) || 
                             s.providerSku.toLowerCase().includes(addModalSearch.toLowerCase()))
                          ).length} SKU tersedia untuk diimport
                        </span>
                        <button
                          onClick={() => {
                            const filtered = providerSkus.filter(s => 
                              (providerFilter === 'ALL' || s.providerId === providerFilter) &&
                              (s.name.toLowerCase().includes(addModalSearch.toLowerCase()) || 
                               s.providerSku.toLowerCase().includes(addModalSearch.toLowerCase()))
                            ).map(s => s.id || '');
                            
                            if (selectedProviderSkuIds.length === filtered.length) {
                              setSelectedProviderSkuIds([]);
                            } else {
                              setSelectedProviderSkuIds(filtered);
                            }
                          }}
                          className="text-blue-600 font-semibold hover:underline"
                        >
                          {selectedProviderSkuIds.length > 0 ? 'Batal Pilih Semua' : 'Pilih Semua'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {importResults ? (
                      <div className="space-y-3">
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-xs font-medium flex items-center gap-2">
                          <Info className="w-4 h-4 shrink-0" />
                          <span>Hasil Import Massal untuk {selectedGameForCatalog.name}</span>
                        </div>
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden">
                          {importResults.map((res, idx) => {
                            const sku = providerSkus.find(s => s.id === res.skuId);
                            return (
                              <div key={idx} className="p-3 flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 text-[11px] truncate">
                                    {sku?.name || res.skuId}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-mono">
                                    {sku?.providerSku}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {res.success ? (
                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-full flex items-center gap-1">
                                      <Check className="w-3 h-3" />
                                      <span>Success</span>
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold rounded-full flex items-center gap-1">
                                      <XCircle className="w-3 h-3" />
                                      <span className="max-w-[100px] truncate">{res.message || 'Failed'}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      providerSkus
                        .filter(s => 
                          (providerFilter === 'ALL' || s.providerId === providerFilter) &&
                          (s.name.toLowerCase().includes(addModalSearch.toLowerCase()) || 
                           s.providerSku.toLowerCase().includes(addModalSearch.toLowerCase()))
                        )
                        .map((sku) => {
                          const isChecked = selectedProviderSkuIds.includes(sku.id || '');
                          const provider = providers.find(p => p.id === sku.providerId);
                          const cost = sku.metadata?.price || 0;

                          return (
                            <div
                              key={sku.id}
                              onClick={() => {
                                if (isChecked) {
                                  setSelectedProviderSkuIds(prev => prev.filter(id => id !== sku.id));
                                } else {
                                  setSelectedProviderSkuIds(prev => [...prev, sku.id || '']);
                                }
                              }}
                              className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                                isChecked 
                                  ? 'bg-blue-50/70 border-blue-300 shadow-xs' 
                                  : 'bg-white border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                              />

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-slate-900 text-sm truncate">
                                    {sku.name}
                                  </p>
                                  {provider && (
                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100 rounded shrink-0">
                                      {provider.code}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                  <span className="font-mono text-slate-400">{sku.providerSku}</span>
                                  <span className="font-semibold text-slate-700 italic">Modal: Rp {cost.toLocaleString()}</span>
                                  <span className="capitalize px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">{sku.type || 'topup'}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>

                  <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                    {importResults ? (
                      <div className="text-xs text-slate-500 font-medium italic">
                        {importResults.filter(r => r.success).length} Berhasil, {importResults.filter(r => !r.success).length} Gagal
                      </div>
                    ) : (
                      <div className="text-xs text-slate-600 font-medium">
                        <span className="font-bold text-blue-600">{selectedProviderSkuIds.length}</span> SKU dipilih
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (importResults) {
                            setImportResults(null);
                            setSelectedProviderSkuIds([]);
                          } else {
                            setIsAddModalOpen(false);
                          }
                        }}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
                      >
                        {importResults ? 'Tutup' : 'Batal'}
                      </button>
                      
                      {!importResults && (
                        <button
                          onClick={handleExecuteBulkImport}
                          disabled={selectedProviderSkuIds.length === 0 || isSubmittingImport}
                          className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:cursor-not-allowed"
                        >
                          {isSubmittingImport ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Mengimport...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4" />
                              <span>Import ke Katalog ({selectedProviderSkuIds.length})</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}

            </motion.div>
          </div>
        )}

        {/* Modal: Pindahkan Produk */}
        {movingProduct && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden"
            >
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Pindahkan Produk</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Pindahkan produk ke katalog game/brand lain.</p>
                  </div>
                </div>

                <button
                  onClick={() => setMovingProduct(null)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-400 font-medium">Nama Produk:</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{movingProduct.name}</p>

                  <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Game saat ini:</span>
                    <span className="font-bold text-slate-700">{selectedGameForCatalog.name}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Pindahkan ke Game:
                  </label>
                  <select
                    value={targetGameId}
                    onChange={(e) => setTargetGameId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="" disabled>-- Pilih Game Tujuan --</option>
                    {games
                      .filter(g => g.id !== selectedGameForCatalog.id)
                      .map(g => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-800">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Memindahkan produk ini <strong>tidak akan menghapus</strong> data SKU supplier maupun mapping provider. Kolom relasi produk akan dialihkan ke game tujuan.
                  </p>
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
                <button
                  onClick={() => setMovingProduct(null)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleExecuteMoveProduct}
                  disabled={!targetGameId || isSubmittingMove}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:cursor-not-allowed"
                >
                  {isSubmittingMove ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Memindahkan...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>Pindahkan Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal: Hapus dari Katalog Game */}
        {removingProduct && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden"
            >
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                    <FolderMinus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Hapus dari Katalog</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{selectedGameForCatalog.name}</p>
                  </div>
                </div>

                <button
                  onClick={() => setRemovingProduct(null)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-3 text-sm">
                <p className="text-slate-700 leading-relaxed">
                  Apakah Anda yakin ingin menonaktifkan produk <strong className="text-slate-900">"{removingProduct.name}"</strong> dari katalog <strong>{selectedGameForCatalog.name}</strong>?
                </p>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-800">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Data SKU dan akun Provider supplier <strong>tetap tersimpan</strong> dan tidak akan terhapus. Anda dapat mengaktifkan kembali produk ini kapan saja.
                  </p>
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
                <button
                  onClick={() => setRemovingProduct(null)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleExecuteRemoveProduct}
                  disabled={isSubmittingRemove}
                  className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  {isSubmittingRemove ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menonaktifkan...</span>
                    </>
                  ) : (
                    <>
                      <FolderMinus className="w-4 h-4" />
                      <span>Hapus dari Katalog</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER LEVEL 1: DAFTAR GAME & KATEGORI
  // ==========================================

  return (
    <div className="space-y-6">
      {/* Feedback Alerts */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-800 text-sm shadow-sm"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button 
              onClick={() => setSuccessMessage(null)}
              className="p-1 hover:bg-emerald-100 rounded-lg transition-colors text-emerald-700"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-red-800 text-sm shadow-sm"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button 
              onClick={() => setError(null)}
              className="p-1 hover:bg-red-100 rounded-lg transition-colors text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="ui-page-title text-slate-800">Manajemen Game & Kategori</h1>
          <p className="text-slate-500">Kelola katalog game, relasi kategori, dan pengelompokan produk.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setRefreshing(true);
              fetchAllData();
            }}
            disabled={refreshing}
            className="p-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors shrink-0"
            title="Segarkan data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          {activeTab === "games" && (
            <button 
              onClick={() => { setEditingGame(null); setIsGameModalOpen(true); }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition-all shadow-sm font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Game</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-8">
        <button
          onClick={() => { setActiveTab("games"); setSearch(""); }}
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "games" 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Gamepad2 className="w-4 h-4" />
          Daftar Game ({games.length})
        </button>
        <button
          onClick={() => { setActiveTab("categories"); setSearch(""); }}
          className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "categories" 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Layers className="w-4 h-4" />
          Kategori ({categories.length})
        </button>
      </div>

      {/* Filter & View Switcher Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder={activeTab === "games" ? "Cari game berdasarkan nama atau slug..." : "Cari kategori..."} 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {activeTab === "games" && (
            <select 
              className="px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 bg-white text-xs font-semibold"
              value={gameCategoryFilter}
              onChange={(e) => setGameCategoryFilter(e.target.value)}
            >
              <option value="all">Semua Kategori</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          )}

          <select 
            className="px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 bg-white text-xs font-semibold"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Semua Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="maintenance">Maintenance</option>
          </select>

          {activeTab === "games" && (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setGameViewMode("table")}
                className={`p-1.5 rounded-lg transition-colors ${
                  gameViewMode === "table" 
                    ? "bg-white text-blue-600 shadow-xs" 
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Tampilan Tabel"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setGameViewMode("grid")}
                className={`p-1.5 rounded-lg transition-colors ${
                  gameViewMode === "grid" 
                    ? "bg-white text-blue-600 shadow-xs" 
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Tampilan Kartu Visual"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === "games" ? (
        gameViewMode === "grid" ? (
          /* ================= GRID VIEW ================= */
          <div className="space-y-4">
            {filteredGames.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredGames.map((game) => {
                  const count = productCountPerGame.get(game.id || '') || game.productCount || 0;
                  return (
                    <div
                      key={game.id}
                      className="group bg-white rounded-2xl border border-slate-200 hover:border-blue-500 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div 
                            onClick={() => handleSelectGameCatalog(game)}
                            className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center cursor-pointer group-hover:scale-105 transition-transform"
                          >
                            {game.image || game.icon ? (
                              <img 
                                src={game.image || game.icon} 
                                alt={game.name} 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <Gamepad2 className="w-7 h-7 text-slate-400" />
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              game.status === 'active' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {game.status === 'active' ? 'Aktif' : 'Nonaktif'}
                            </span>

                            <button
                              onClick={() => {
                                setMovingGameCategory(game);
                                setTargetCategoryId("");
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Pindahkan Kategori"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => { setEditingGame(game); setIsGameModalOpen(true); }}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit Master Game"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => setDeleteModal({ isOpen: true, type: "game", id: game.id!, name: game.name })}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Hapus Game"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <h3 
                          onClick={() => handleSelectGameCatalog(game)}
                          className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition-colors line-clamp-1 cursor-pointer"
                        >
                          {game.name}
                        </h3>
                        <p className="text-slate-400 text-xs mt-0.5 font-mono">
                          {game.slug}
                        </p>
                        {game.description && (
                          <p className="text-slate-500 text-xs mt-2 line-clamp-2 leading-relaxed">
                            {game.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold">
                          <Package className="w-3.5 h-3.5" />
                          <span>{count} Produk</span>
                        </span>

                        <button
                          onClick={() => handleSelectGameCatalog(game)}
                          className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors group-hover:translate-x-0.5"
                        >
                          <span>Katalog Game</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                <Gamepad2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="font-semibold text-slate-800 text-base">Game Tidak Ditemukan</h3>
                <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
                  Tidak ada game yang cocok dengan filter "{search}".
                </p>
              </div>
            )}
          </div>
        ) : (
          /* ================= TABLE VIEW ================= */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Game</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kategori</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produk</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Varian</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Harga</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={7} className="px-6 py-8 h-16 bg-slate-50/50"></td>
                      </tr>
                    ))
                  ) : filteredGames.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        <Gamepad2 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                        Belum ada data game.
                      </td>
                    </tr>
                  ) : (
                    filteredGames.map((game) => {
                      const count = productCountPerGame.get(game.id || '') || game.productCount || 0;
                      return (
                        <tr key={game.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div 
                                onClick={() => handleSelectGameCatalog(game)}
                                className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 cursor-pointer"
                              >
                                {game.image || game.icon ? (
                                  <img src={game.image || game.icon} alt={game.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Gamepad2 className="w-full h-full p-2 text-slate-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div 
                                  onClick={() => handleSelectGameCatalog(game)}
                                  className="font-bold text-slate-800 truncate cursor-pointer hover:text-blue-600"
                                >
                                  {game.name}
                                </div>
                                <div className="text-xs text-slate-400 font-mono truncate">{game.slug}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {game.categoryIds?.map(catId => {
                                const cat = categories.find(c => c.id === catId);
                                return (
                                  <span key={catId} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-100 uppercase">
                                    {cat ? cat.name : catId}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getStatusColor(game.status)}`}>
                              {game.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 font-semibold">{count}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{game.variantCount || 0}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {game.minPrice !== undefined && game.maxPrice !== undefined ? (
                              game.minPrice === game.maxPrice 
                                ? formatPrice(game.minPrice) 
                                : `${formatPrice(game.minPrice)} - ${formatPrice(game.maxPrice)}`
                            ) : '-'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Game-Centric Catalog Button */}
                              <button 
                                onClick={() => handleSelectGameCatalog(game)}
                                className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                title="Buka produk dan manajemen katalog untuk game ini"
                              >
                                Katalog Produk
                              </button>
                              <button 
                                onClick={() => { setEditingGame(game); setIsGameModalOpen(true); }}
                                className="p-2 hover:bg-white hover:text-blue-600 text-slate-400 rounded-lg transition-all border border-transparent hover:border-slate-200"
                                title="Edit Master Game"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setDeleteModal({ isOpen: true, type: "game", id: game.id!, name: game.name })}
                                className="p-2 hover:bg-white hover:text-rose-600 text-slate-400 rounded-lg transition-all border border-transparent hover:border-slate-200"
                                title="Hapus Game"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* ================= CATEGORIES TABLE ================= */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kategori</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Slug</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Urutan</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="px-6 py-8 h-16 bg-slate-50/50"></td>
                    </tr>
                  ))
                ) : filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <Layers className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                      Belum ada data kategori.
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                          {cat.icon || <Layers className="w-4 h-4" />}
                        </div>
                        <div>
                          <div>{cat.name}</div>
                          {cat.description && (
                            <div className="text-xs text-slate-400 font-normal">{cat.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-500">{cat.slug}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{cat.sortOrder ?? 0}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getStatusColor(cat.status)}`}>
                          {cat.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => navigate('/admin/categories')}
                          className="text-blue-600 hover:text-blue-700 font-bold hover:underline transition-all flex items-center gap-1 justify-end ml-auto text-xs"
                        >
                          Kelola di Master Kategori
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Minimal Manual Category Move Modal */}
      <AnimatePresence>
        {movingGameCategory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Pindahkan Kategori</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Game: <span className="font-semibold text-slate-700">{movingGameCategory.name}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMovingGameCategory(null);
                    setTargetCategoryId("");
                  }}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                  aria-label="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Kategori Saat Ini</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(movingGameCategory.categoryIds || []).length > 0 ? (
                      (movingGameCategory.categoryIds || []).map(id => (
                        <span key={id} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
                          {categories.find(c => c.id === id)?.name || id}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">Belum ada kategori</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pindahkan ke</label>
                  <select
                    value={targetCategoryId}
                    onChange={(e) => setTargetCategoryId(e.target.value)}
                    className="mt-2 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Pilih kategori tujuan...</option>
                    {categories
                      .filter(c => c.status === "active")
                      .map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                  <p className="mt-2 text-[11px] text-slate-400">
                    Aksi ini memindahkan Game Master ke satu kategori tujuan. Produk, variant, mapping, dan supplier tidak diubah.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setMovingGameCategory(null);
                    setTargetCategoryId("");
                  }}
                  disabled={isSubmittingCategoryMove}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteMoveGameCategory}
                  disabled={!targetCategoryId || isSubmittingCategoryMove}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmittingCategoryMove ? "Memindahkan..." : "Pindahkan"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Modal (CRUD) */}
      <AnimatePresence>
        {isGameModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsGameModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden relative z-10"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">
                  {editingGame ? "Edit Game" : "Tambah Game Baru"}
                </h2>
                <button onClick={() => setIsGameModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSaveGame} className="p-6 overflow-y-auto max-h-[80vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Nama Game</label>
                    <input 
                      name="name" 
                      defaultValue={editingGame?.name} 
                      required 
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                      placeholder="Contoh: Mobile Legends"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Slug</label>
                    <input 
                      name="slug" 
                      defaultValue={editingGame?.slug} 
                      required 
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
                      placeholder="mobile-legends"
                    />
                  </div>
                  
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Deskripsi</label>
                    <textarea 
                      name="description" 
                      defaultValue={editingGame?.description} 
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                      rows={2}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Cover Image URL</label>
                    <input 
                      name="image" 
                      defaultValue={editingGame?.image} 
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                      placeholder="https://..."
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Recommended: 600 × 600 px · Rasio 1:1 (Persegi) · PNG atau WebP</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Icon URL</label>
                    <input 
                      name="icon" 
                      defaultValue={editingGame?.icon} 
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                      placeholder="https://..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Status</label>
                    <select 
                      name="status" 
                      defaultValue={editingGame?.status || "active"} 
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Availability</label>
                    <select 
                      name="availability" 
                      defaultValue={editingGame?.availability || "available"} 
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="available">Available</option>
                      <option value="unavailable">Unavailable</option>
                      <option value="limited">Limited</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Urutan (Sort Order)</label>
                    <input 
                      type="number"
                      name="sortOrder" 
                      defaultValue={editingGame?.sortOrder || 0} 
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Kategori</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[50px]">
                      {categories.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">Memuat kategori...</span>
                      ) : (
                        categories.map(cat => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setSelectedCategoryIdsInModal(prev => 
                                prev.includes(cat.id!) 
                                  ? prev.filter(id => id !== cat.id) 
                                  : [...prev, cat.id!]
                              );
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                              selectedCategoryIdsInModal.includes(cat.id!)
                                ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:border-blue-400"
                            }`}
                          >
                            {cat.name}
                          </button>
                        ))
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 italic">Pilih kategori yang sesuai untuk game ini. Bisa lebih dari satu.</p>
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Search Keywords (koma)</label>
                    <input 
                      name="searchKeywords" 
                      defaultValue={editingGame?.searchKeywords?.join(",")} 
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                      placeholder="topup, ml, diamond"
                    />
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsGameModalOpen(false)}
                    className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors text-sm"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20 text-sm"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 font-bold">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Konfirmasi Hapus {deleteModal.type === "game" ? "Game" : "Kategori"}
                  </h3>
                  <p className="text-sm text-slate-500">
                    Tindakan ini tidak dapat dibatalkan.
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-200">
                Apakah Anda yakin ingin menghapus <strong className="text-slate-900">"{deleteModal.name}"</strong>?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteModal({ isOpen: false, type: "game", id: "", name: "" })}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors text-sm"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const id = deleteModal.id;
                    const type = deleteModal.type;
                    setDeleteModal({ isOpen: false, type: "game", id: "", name: "" });
                    if (type === "game") {
                      await executeDeleteGame(id);
                    }
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors shadow-lg shadow-rose-900/20 text-sm"
                >
                  Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
