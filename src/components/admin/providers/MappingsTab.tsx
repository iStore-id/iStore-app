import React, { useState, useEffect, useMemo } from 'react';
import { ProviderMapping, Provider, Product, ProductVariant, ProviderSku, Category, Game } from '../../../types/core';
import { useAuthStore } from '../../../store/auth-store';
import { 
  Link as LinkIcon, 
  Search, 
  Edit2, 
  X, 
  AlertCircle, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Power,
  RefreshCw,
  Info
} from 'lucide-react';

interface MappingsTabProps {
  addTrigger?: { tab: string; timestamp: number } | null;
}

export default function MappingsTab({ addTrigger }: MappingsTabProps) {
  const { user } = useAuthStore();

  // Core Data
  const [mappings, setMappings] = useState<ProviderMapping[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerSkus, setProviderSkus] = useState<ProviderSku[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [games, setGames] = useState<Game[]>([]);

  // UI States
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<ProviderMapping | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Fields (Alur Sederhana: Produk iStore -> Variant -> Supplier -> Produk Supplier -> Kode Supplier -> Status)
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formGameId, setFormGameId] = useState('');
  const [formProductId, setFormProductId] = useState('');
  const [formVariantId, setFormVariantId] = useState('');
  const [formProviderId, setFormProviderId] = useState('');
  const [formProviderSkuId, setFormProviderSkuId] = useState('');
  const [formSkuSearch, setFormSkuSearch] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (addTrigger && addTrigger.tab === 'mappings') {
      handleOpenCreate();
    }
  }, [addTrigger]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = await user?.getIdToken();
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      const [mapRes, prodRes, varRes, provRes, skusRes, catRes, gameRes] = await Promise.all([
        fetch('/api/admin/providers/mappings', { headers }),
        fetch('/api/admin/catalog/products', { headers }),
        fetch('/api/admin/catalog/variants', { headers }),
        fetch('/api/admin/providers', { headers }),
        fetch('/api/admin/providers/skus', { headers }),
        fetch('/api/admin/catalog/categories', { headers }),
        fetch('/api/admin/catalog/games', { headers })
      ]);

      const [mapData, prodData, varData, provData, skusData, catData, gameData] = await Promise.all([
        mapRes.json(),
        prodRes.json(),
        varRes.json(),
        provRes.json(),
        skusRes.json(),
        catRes.json(),
        gameRes.json()
      ]);

      if (mapData.success) {
        const mappingList = Array.isArray(mapData.data)
          ? mapData.data
          : Array.isArray(mapData.data?.data)
            ? mapData.data.data
            : Array.isArray(mapData.mappings)
              ? mapData.mappings
              : [];
        setMappings(mappingList);
      }
      if (prodData.success) setProducts(Array.isArray(prodData.data) ? prodData.data : []);
      if (varData.success) setVariants(Array.isArray(varData.data) ? varData.data : []);
      if (provData.success) setProviders(Array.isArray(provData.data) ? provData.data : []);
      if (skusData.success) setProviderSkus(Array.isArray(skusData.data) ? skusData.data : []);
      if (catData.success) setCategories(Array.isArray(catData.data) ? catData.data : []);
      if (gameData.success) setGames(Array.isArray(gameData.data) ? gameData.data : []);
    } catch (err: any) {
      console.error('Error fetching mappings data:', err);
      showNotification('error', 'Gagal memuat data pemetaan produk.');
    } finally {
      setLoading(false);
    }
  };

  // Lookup Maps
  const productsMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const variantsMap = useMemo(() => new Map(variants.map(v => [v.id, v])), [variants]);
  const providersMap = useMemo(() => new Map(providers.map(p => [p.id, p])), [providers]);
  const skusMap = useMemo(() => new Map(providerSkus.map(s => [s.id, s])), [providerSkus]);
  const skusByCodeMap = useMemo(() => new Map(providerSkus.map(s => [s.providerSku, s])), [providerSkus]);

  // Filter Games by Category
  const availableGames = useMemo(() => {
    if (!formCategoryId) return [];
    return games.filter(g => g.categoryIds.includes(formCategoryId));
  }, [games, formCategoryId]);

  // Filter Products by Game
  const availableProducts = useMemo(() => {
    if (!formGameId) return [];
    return products.filter(p => p.gameId === formGameId);
  }, [products, formGameId]);

  // Form: Variants filtered by selected Product iStore
  const availableVariants = useMemo(() => {
    if (!formProductId) return [];
    return variants.filter(v => v.productId === formProductId);
  }, [variants, formProductId]);

  // Form: Provider SKUs filtered by selected Supplier
  const availableProviderSkus = useMemo(() => {
    if (!formProviderId) return [];
    let list = providerSkus.filter(s => s.providerId === formProviderId);
    if (formSkuSearch.trim()) {
      const term = formSkuSearch.toLowerCase();
      list = list.filter(s => 
        (s.name && s.name.toLowerCase().includes(term)) ||
        (s.providerSku && s.providerSku.toLowerCase().includes(term))
      );
    }
    return list;
  }, [providerSkus, formProviderId, formSkuSearch]);

  // Form: Automatically determine Supplier Code from selected Supplier Product
  const selectedProviderSkuObj = useMemo(() => {
    if (!formProviderSkuId) return null;
    return skusMap.get(formProviderSkuId) || null;
  }, [skusMap, formProviderSkuId]);

  // Check whether a mapping is considered "Aktif"
  const isMappingActive = (mapping: ProviderMapping) => {
    const isApprovedOrMapped = mapping.status === 'APPROVED' || mapping.status === 'MAPPED';
    const isEligible = mapping.routingEligibility !== false;
    return isApprovedOrMapped && isEligible;
  };

  // Open Create Form Modal
  const handleOpenCreate = () => {
    setEditingMapping(null);
    setFormCategoryId('');
    setFormGameId('');
    setFormProductId('');
    setFormVariantId('');
    setFormProviderId(providers[0]?.id || '');
    setFormProviderSkuId('');
    setFormSkuSearch('');
    setFormIsActive(true);
    setFormError('');
    setIsModalOpen(true);
  };

  // Open Edit Form Modal
  const handleOpenEdit = (mapping: ProviderMapping) => {
    setEditingMapping(mapping);
    const variant = variantsMap.get(mapping.variantId);
    const productId = variant?.productId || '';
    const product = productsMap.get(productId);
    const gameId = product?.gameId || '';
    
    setFormProductId(productId);
    setFormVariantId(mapping.variantId);
    setFormGameId(gameId);
    setFormCategoryId(product?.categoryIds[0] || '');
    setFormProviderId(mapping.providerId);
    setFormProviderSkuId(mapping.providerSkuId || '');
    setFormSkuSearch('');
    setFormIsActive(isMappingActive(mapping));
    setFormError('');
    setIsModalOpen(true);
  };

  // Submit Save/Edit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formProductId) {
      setFormError('Pilih Produk iStore terlebih dahulu.');
      return;
    }
    if (!formVariantId) {
      setFormError('Pilih Variant iStore terlebih dahulu.');
      return;
    }
    if (!formProviderId) {
      setFormError('Pilih Supplier terlebih dahulu.');
      return;
    }
    if (!formProviderSkuId) {
      setFormError('Pilih Produk Supplier terlebih dahulu.');
      return;
    }

    const selectedSku = skusMap.get(formProviderSkuId);
    if (!selectedSku) {
      setFormError('Data Produk Supplier yang dipilih tidak ditemukan.');
      return;
    }

    const selectedVariant = variantsMap.get(formVariantId);
    const selectedProduct = productsMap.get(formProductId);

    try {
      setFormSubmitting(true);
      const token = await user?.getIdToken();
      if (!token) throw new Error('Autentikasi gagal. Silakan login kembali.');

      const payload = {
        productId: formProductId,
        variantId: formVariantId,
        sku: selectedVariant?.sku || '',
        providerId: formProviderId,
        providerSkuId: selectedSku.id,
        providerSku: selectedSku.providerSku,
        status: formIsActive ? 'APPROVED' : 'REJECTED',
        priority: 1,
        routingEligibility: formIsActive,
        metadata: {
          productName: selectedProduct?.name || '',
          variantName: selectedVariant?.name || '',
          supplierProductName: selectedSku.name || '',
          supplierCode: selectedSku.providerSku || '',
        }
      };

      const url = editingMapping
        ? `/api/admin/providers/mappings/${editingMapping.id}`
        : `/api/admin/providers/mappings`;
      const method = editingMapping ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Gagal menyimpan pemetaan produk.');
      }

      setIsModalOpen(false);
      showNotification('success', editingMapping ? 'Pemetaan produk berhasil diperbarui.' : 'Pemetaan produk berhasil disimpan.');
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Quick Toggle Status (Aktif / Tidak Aktif)
  const handleToggleStatus = async (mapping: ProviderMapping) => {
    const currentlyActive = isMappingActive(mapping);
    const newStatus = currentlyActive ? 'REJECTED' : 'APPROVED';
    const newEligibility = !currentlyActive;

    try {
      const token = await user?.getIdToken();
      if (!token) return;

      const response = await fetch(`/api/admin/providers/mappings/${mapping.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: newStatus,
          routingEligibility: newEligibility
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Gagal mengubah status pemetaan.');
      }

      showNotification('success', `Status pemetaan diubah menjadi ${newEligibility ? 'Aktif' : 'Tidak Aktif'}.`);
      fetchData();
    } catch (err: any) {
      showNotification('error', err.message || 'Gagal mengubah status.');
    }
  };

  // Delete Mapping
  const handleDeleteMapping = async (id: string) => {
    try {
      const token = await user?.getIdToken();
      if (!token) return;

      const response = await fetch(`/api/admin/providers/mappings/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Gagal menghapus pemetaan produk.');
      }

      setDeletingId(null);
      showNotification('success', 'Pemetaan produk berhasil dihapus.');
      fetchData();
    } catch (err: any) {
      showNotification('error', err.message || 'Gagal menghapus pemetaan.');
    }
  };

  // Filtered Table Mappings
  const filteredMappings = useMemo(() => {
    return mappings.filter(m => {
      const variant = variantsMap.get(m.variantId);
      const product = variant ? productsMap.get(variant.productId) : null;
      const provider = providersMap.get(m.providerId);
      const sku = skusMap.get(m.providerSkuId) || (m.providerSku ? skusByCodeMap.get(m.providerSku) : null);

      const productName = product?.name || '';
      const variantName = variant?.name || variant?.displayName || '';
      const supplierName = provider?.name || provider?.code || m.providerId;
      const supplierProductName = sku?.name || m.metadata?.supplierProductName || '';
      const supplierCode = m.providerSku || sku?.providerSku || '';

      // Text search
      if (search.trim()) {
        const term = search.toLowerCase();
        const matches = 
          productName.toLowerCase().includes(term) ||
          variantName.toLowerCase().includes(term) ||
          supplierName.toLowerCase().includes(term) ||
          supplierProductName.toLowerCase().includes(term) ||
          supplierCode.toLowerCase().includes(term);
        if (!matches) return false;
      }

      // Supplier filter
      if (filterSupplier !== 'ALL' && m.providerId !== filterSupplier) {
        return false;
      }

      // Status filter
      if (filterStatus === 'ACTIVE' && !isMappingActive(m)) return false;
      if (filterStatus === 'INACTIVE' && isMappingActive(m)) return false;

      return true;
    });
  }, [mappings, variantsMap, productsMap, providersMap, skusMap, skusByCodeMap, search, filterSupplier, filterStatus]);

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium transition-all ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari Produk, Variant, Supplier, atau Kode..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          {/* Supplier Filter */}
          <select 
            value={filterSupplier}
            onChange={(e) => setFilterSupplier(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="ALL">Semua Supplier</option>
            {providers.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </select>

          {/* Status Filter */}
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Tidak Aktif</option>
          </select>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchData}
            title="Refresh Data"
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Pemetaan</span>
          </button>
        </div>
      </div>

      {/* Info Callout */}
      <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-lg flex items-start gap-2.5 text-xs text-blue-800">
        <Info className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
        <div>
          <span className="font-semibold">Alur Pemetaan Sederhana:</span> Setiap varian produk iStore dipetakan ke satu produk supplier. Saat pesanan masuk, sistem otomatis menggunakan <strong>Kode Supplier</strong> yang dipetakan untuk melakukan transaksi ke API supplier.
        </div>
      </div>

      {/* Tabel Pemetaan Produk */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5 font-semibold text-slate-900">Produk iStore</th>
                <th className="px-5 py-3.5 font-semibold text-slate-900">Variant</th>
                <th className="px-5 py-3.5 font-semibold text-slate-900">Supplier</th>
                <th className="px-5 py-3.5 font-semibold text-slate-900">Produk Supplier</th>
                <th className="px-5 py-3.5 font-semibold text-slate-900">Kode Supplier</th>
                <th className="px-5 py-3.5 font-semibold text-slate-900 text-center">Status</th>
                <th className="px-5 py-3.5 font-semibold text-slate-900 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
                    Memuat pemetaan produk...
                  </td>
                </tr>
              ) : filteredMappings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    <LinkIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-medium text-slate-700">Belum ada Pemetaan Produk</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Klik tombol &ldquo;Tambah Pemetaan&rdquo; di atas untuk menghubungkan varian ke produk supplier.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredMappings.map(mapping => {
                  const variant = variantsMap.get(mapping.variantId);
                  const product = variant ? productsMap.get(variant.productId) : null;
                  const provider = providersMap.get(mapping.providerId);
                  const sku = skusMap.get(mapping.providerSkuId) || (mapping.providerSku ? skusByCodeMap.get(mapping.providerSku) : null);
                  const active = isMappingActive(mapping);

                  return (
                    <tr key={mapping.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* 1. Produk iStore */}
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {product?.name || (
                          <span className="text-slate-400 italic text-xs">Produk tidak terhubung</span>
                        )}
                      </td>

                      {/* 2. Variant */}
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-900">
                          {variant?.name || variant?.displayName || (
                            <span className="text-slate-400 italic text-xs">Variant ID: {mapping.variantId.slice(0, 8)}</span>
                          )}
                        </div>
                        {variant?.sku && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            SKU: {variant.sku}
                          </div>
                        )}
                      </td>

                      {/* 3. Supplier */}
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium text-xs border border-blue-100">
                          {provider?.name || provider?.code || mapping.providerId}
                        </span>
                      </td>

                      {/* 4. Produk Supplier */}
                      <td className="px-5 py-3.5 text-slate-700">
                        {sku?.name || mapping.metadata?.supplierProductName || (
                          <span className="text-slate-400 italic text-xs">Produk SKU: {mapping.providerSkuId.slice(0, 8)}</span>
                        )}
                      </td>

                      {/* 5. Kode Supplier */}
                      <td className="px-5 py-3.5">
                        <span className="inline-block px-2.5 py-1 rounded bg-slate-100 text-slate-800 font-mono font-semibold text-xs border border-slate-200">
                          {mapping.providerSku || sku?.providerSku || '–'}
                        </span>
                      </td>

                      {/* 6. Status */}
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          active 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          {active ? 'Aktif' : 'Tidak Aktif'}
                        </span>
                      </td>

                      {/* 7. Aksi */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          {/* Quick Toggle Status */}
                          <button
                            onClick={() => handleToggleStatus(mapping)}
                            title={active ? 'Nonaktifkan Pemetaan' : 'Aktifkan Pemetaan'}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              active
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 border-slate-200'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border-slate-200'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button 
                            onClick={() => handleOpenEdit(mapping)}
                            title="Edit Pemetaan"
                            className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 border border-slate-200 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeletingId(mapping.id)}
                            title="Hapus Pemetaan"
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 border border-slate-200 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h4 className="text-base font-bold text-slate-900">Hapus Pemetaan?</h4>
            </div>
            <p className="text-sm text-slate-600">
              Apakah Anda yakin ingin menghapus pemetaan produk ini? Varian iStore tidak akan lagi terhubung ke kode supplier ini.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="px-3.5 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeleteMapping(deletingId)}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Tambah / Edit Modal (Alur Sederhana 6 Langkah) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingMapping ? 'Edit Pemetaan Produk' : 'Tambah Pemetaan Produk'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hubungkan varian iStore dengan produk dan kode supplier.
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-lg text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Langkah 1: Pilih Kategori */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 inline-flex items-center justify-center text-[11px] font-bold">1</span>
                  Kategori
                </label>
                <select 
                  value={formCategoryId}
                  onChange={(e) => {
                    setFormCategoryId(e.target.value);
                    setFormGameId('');
                    setFormProductId('');
                    setFormVariantId('');
                  }}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="" disabled>-- Pilih Kategori --</option>
                  {categories.filter(c => c.status === 'active').map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Langkah 2: Pilih Game */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 inline-flex items-center justify-center text-[11px] font-bold">2</span>
                  Game
                </label>
                <select 
                  value={formGameId}
                  onChange={(e) => {
                    setFormGameId(e.target.value);
                    setFormProductId('');
                    setFormVariantId('');
                  }}
                  disabled={!formCategoryId}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="" disabled>
                    {formCategoryId ? '-- Pilih Game --' : '-- Pilih Kategori Terlebih Dahulu --'}
                  </option>
                  {availableGames.filter(g => g.status === 'active').map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Langkah 3: Pilih Produk iStore */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 inline-flex items-center justify-center text-[11px] font-bold">3</span>
                  Produk iStore
                </label>
                <select 
                  value={formProductId}
                  onChange={(e) => {
                    setFormProductId(e.target.value);
                    setFormVariantId('');
                  }}
                  disabled={!formGameId}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="" disabled>
                    {formGameId ? '-- Pilih Produk --' : '-- Pilih Game Terlebih Dahulu --'}
                  </option>
                  {availableProducts.filter(p => p.status === 'active').map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Langkah 4: Pilih Variant */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 inline-flex items-center justify-center text-[11px] font-bold">4</span>
                  Variant iStore
                </label>
                <select 
                  value={formVariantId}
                  onChange={(e) => setFormVariantId(e.target.value)}
                  disabled={!formProductId}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="" disabled>
                    {formProductId ? '-- Pilih Variant --' : '-- Pilih Produk Terlebih Dahulu --'}
                  </option>
                  {availableVariants.filter(v => v.status === 'active').map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name || v.displayName} {v.sku ? `(${v.sku})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Langkah 3: Pilih Supplier */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 inline-flex items-center justify-center text-[11px] font-bold">3</span>
                  Supplier
                </label>
                <select 
                  value={formProviderId}
                  onChange={(e) => {
                    setFormProviderId(e.target.value);
                    setFormProviderSkuId('');
                    setFormSkuSearch('');
                  }}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="" disabled>-- Pilih Supplier --</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              {/* Langkah 4: Pilih Produk Supplier */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 inline-flex items-center justify-center text-[11px] font-bold">4</span>
                    Produk Supplier
                  </span>
                  {availableProviderSkus.length > 0 && (
                    <span className="text-[11px] text-slate-400 font-normal">
                      {availableProviderSkus.length} produk tersedia
                    </span>
                  )}
                </label>

                {/* Filter / Search Produk Supplier */}
                {formProviderId && (
                  <input
                    type="text"
                    value={formSkuSearch}
                    onChange={(e) => setFormSkuSearch(e.target.value)}
                    placeholder="Saring nama atau kode supplier..."
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
                  />
                )}

                <select 
                  value={formProviderSkuId}
                  onChange={(e) => setFormProviderSkuId(e.target.value)}
                  disabled={!formProviderId}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="" disabled>
                    {formProviderId ? '-- Pilih Produk Supplier --' : '-- Pilih Supplier Terlebih Dahulu --'}
                  </option>
                  {availableProviderSkus.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} [{s.providerSku}]
                    </option>
                  ))}
                </select>
                {formProviderId && availableProviderSkus.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Tidak ditemukan SKU untuk supplier ini. Pastikan SKU supplier sudah diimpor pada tab Provider SKUs.
                  </p>
                )}
              </div>

              {/* Langkah 5: Kode Supplier (Otomatis) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 inline-flex items-center justify-center text-[11px] font-bold">5</span>
                  Kode Supplier (Otomatis)
                </label>
                <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-800">
                  <span className="text-slate-400 font-sans font-normal text-xs">Kode:</span>
                  <span>{selectedProviderSkuObj?.providerSku || (editingMapping?.providerSku ? editingMapping.providerSku : '–')}</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Kode ini otomatis mengikuti produk supplier yang dipilih dan akan diteruskan ke API supplier saat transaksi.
                </p>
              </div>

              {/* Status Pemetaan */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Status Pemetaan
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                    formIsActive 
                      ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900' 
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input 
                      type="radio" 
                      name="mapping_status" 
                      checked={formIsActive} 
                      onChange={() => setFormIsActive(true)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="text-sm font-semibold">Aktif</div>
                      <div className="text-[11px] text-slate-500">Dapat digunakan saat transaksi</div>
                    </div>
                  </label>

                  <label className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                    !formIsActive 
                      ? 'border-slate-400 bg-slate-100 text-slate-900' 
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input 
                      type="radio" 
                      name="mapping_status" 
                      checked={!formIsActive} 
                      onChange={() => setFormIsActive(false)}
                      className="text-slate-600 focus:ring-slate-500"
                    />
                    <div>
                      <div className="text-sm font-semibold">Tidak Aktif</div>
                      <div className="text-[11px] text-slate-500">Dinonaktifkan sementara</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 shadow-sm"
                >
                  {formSubmitting ? 'Menyimpan...' : 'Simpan Mapping'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
