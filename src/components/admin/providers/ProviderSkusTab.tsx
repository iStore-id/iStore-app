import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { ProviderSku, Provider } from '../../../types/core';
import { useAuthStore } from '../../../store/auth-store';
import { Package, Search, Edit2, X, AlertCircle, Plus, Upload, CheckCircle2, AlertTriangle, HelpCircle, ArrowRight, Link } from 'lucide-react';

interface ProviderSkusTabProps {
  addTrigger?: { tab: string; timestamp: number } | null;
}

export default function ProviderSkusTab({ addTrigger }: ProviderSkusTabProps) {
  const [skus, setSkus] = useState<ProviderSku[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal & Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSku, setEditingSku] = useState<ProviderSku | null>(null);
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Bulk Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importProviderId, setImportProviderId] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'SKIP_DUPLICATES' | 'UPDATE_EXISTING'>('SKIP_DUPLICATES');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSession, setImportSession] = useState<any | null>(null);
  const [importSuccessResult, setImportSuccessResult] = useState<any | null>(null);
  
  // Smart Bulk Mapping States
  const [selectedSkuIds, setSelectedSkuIds] = useState<Set<string>>(new Set());
  const [isBulkMapModalOpen, setIsBulkMapModalOpen] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  
  const [gamesList, setGamesList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [variantsList, setVariantsList] = useState<any[]>([]);
  
  const [confidenceFilter, setConfidenceFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NO_MATCH'>('ALL');
  const [mappingDuplicateMode, setMappingDuplicateMode] = useState<'SKIP' | 'UPDATE'>('SKIP');
  const [submittingBulkMap, setSubmittingBulkMap] = useState(false);
  const [bulkMapSuccessResult, setBulkMapSuccessResult] = useState<any | null>(null);
  const [bulkMapError, setBulkMapError] = useState('');
  
  const { user } = useAuthStore();

  // Form Fields
  const [providerId, setProviderId] = useState('');
  const [providerSku, setProviderSku] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('topup');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [metadataJson, setMetadataJson] = useState('{}');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (addTrigger && addTrigger.tab === 'skus') {
      handleOpenCreate();
    }
  }, [addTrigger]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [skusSnap, provSnap] = await Promise.all([
        getDocs(query(collection(db, 'providerSkus'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'providers'))
      ]);
      setSkus(skusSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProviderSku)));
      setProviders(provSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Provider)));
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getProviderCode = (providerId: string) => {
    return providers.find(p => p.id === providerId)?.code || 'Unknown';
  };

  const handleOpenCreate = () => {
    setEditingSku(null);
    setProviderId(providers[0]?.id || '');
    setProviderSku('');
    setName('');
    setType('topup');
    setStatus('active');
    setMetadataJson('{}');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sku: ProviderSku) => {
    setEditingSku(sku);
    setProviderId(sku.providerId);
    setProviderSku(sku.providerSku);
    setName(sku.name);
    setType(sku.type || 'topup');
    setStatus(sku.status);
    setMetadataJson(JSON.stringify(sku.metadata || {}, null, 2));
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    try {
      // Validate JSON metadata
      let parsedMetadata = {};
      try {
        parsedMetadata = JSON.parse(metadataJson);
      } catch (err) {
        throw new Error('Format JSON metadata tidak valid.');
      }

      if (!providerId) throw new Error('Provider wajib dipilih.');
      if (!providerSku.trim()) throw new Error('SKU Code wajib diisi.');
      if (!name.trim()) throw new Error('Product Name wajib diisi.');

      const token = await user?.getIdToken();
      if (!token) throw new Error('Autentikasi gagal. Silakan login kembali.');

      const payload = {
        providerId,
        providerSku: providerSku.trim(),
        name: name.trim(),
        type,
        status,
        metadata: parsedMetadata,
      };

      const url = editingSku 
        ? `/api/admin/providers/skus/${editingSku.id}`
        : `/api/admin/providers/skus`;
        
      const method = editingSku ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Gagal menyimpan Provider SKU.');
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportError('');
      setImportSession(null);
      setImportSuccessResult(null);
    }
  };

  const handleValidate = async () => {
    if (!importFile || !importProviderId) return;
    setImporting(true);
    setImportError('');
    setImportSession(null);
    setImportSuccessResult(null);
    
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const rawResult = reader.result as string;
          const base64Content = rawResult.split(',')[1];
          
          const token = await user?.getIdToken();
          const response = await fetch('/api/admin/providers/skus/import/validate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              providerId: importProviderId,
              fileName: importFile.name,
              fileContent: base64Content
            })
          });
          
          const resData = await response.json();
          if (!response.ok) {
            throw new Error(resData.message || 'Gagal melakukan validasi file.');
          }
          
          setImportSession(resData.data);
        } catch (err: any) {
          setImportError(err.message || 'Terjadi kesalahan saat memproses data.');
        } finally {
          setImporting(false);
        }
      };
      
      reader.onerror = () => {
        setImportError('Gagal membaca file.');
        setImporting(false);
      };
      
      reader.readAsDataURL(importFile);
    } catch (err: any) {
      setImportError(err.message || 'Terjadi kesalahan sistem.');
      setImporting(false);
    }
  };

  const handleImportExecute = async () => {
    if (!importSession) return;
    setImporting(true);
    setImportError('');
    
    try {
      const token = await user?.getIdToken();
      const response = await fetch(`/api/admin/providers/skus/import/${importSession.id}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          mode: importMode
        })
      });
      
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || 'Gagal melakukan proses impor.');
      }
      
      setImportSuccessResult(resData.data);
      fetchData();
    } catch (err: any) {
      setImportError(err.message || 'Terjadi kesalahan saat melakukan impor.');
    } finally {
      setImporting(false);
    }
  };

  const openBulkMapping = async () => {
    if (selectedSkuIds.size === 0) return;
    setIsBulkMapModalOpen(true);
    setLoadingSuggestions(true);
    setBulkMapError('');
    setBulkMapSuccessResult(null);
    setConfidenceFilter('ALL');
    
    try {
      const token = await user?.getIdToken();
      
      const firstSelectedSku = skus.find(s => s.id === Array.from(selectedSkuIds)[0]);
      const currentProvId = firstSelectedSku?.providerId || '';
      
      const suggestResp = await fetch('/api/admin/providers/mappings/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          providerId: currentProvId,
          providerSkuIds: Array.from(selectedSkuIds)
        })
      });
      
      const suggestData = await suggestResp.json();
      if (!suggestResp.ok) {
        throw new Error(suggestData.message || 'Gagal menghasilkan rekomendasi pemetaan.');
      }
      
      const mappedSuggestions = suggestData.data.map((item: any) => ({
        ...item,
        selectedVariantId: item.candidateVariantId || '',
        skipped: !item.candidateVariantId || item.confidenceScore === 'NO_MATCH'
      }));
      setSuggestions(mappedSuggestions);
      
      const [gamesSnap, productsSnap, variantsSnap] = await Promise.all([
        getDocs(collection(db, 'games')),
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'productVariants'))
      ]);
      
      setGamesList(gamesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setProductsList(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setVariantsList(variantsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
    } catch (err: any) {
      setBulkMapError(err.message || 'Gagal menyiapkan data pemetaan.');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleBulkMapSubmit = async () => {
    const readyItems = suggestions.filter(s => !s.skipped && s.selectedVariantId);
    if (readyItems.length === 0) {
      setBulkMapError('Tidak ada item pemetaan yang siap untuk dikirim.');
      return;
    }

    setSubmittingBulkMap(true);
    setBulkMapError('');
    
    try {
      const token = await user?.getIdToken();
      const firstSelectedSku = skus.find(s => s.id === Array.from(selectedSkuIds)[0]);
      const currentProvId = firstSelectedSku?.providerId || '';

      const payload = {
        providerId: currentProvId,
        duplicateHandling: mappingDuplicateMode,
        mappings: readyItems.map(item => ({
          providerSkuId: item.providerSkuId,
          variantId: item.selectedVariantId,
          priority: 0,
          status: 'active',
          routingEligibility: true,
          notes: `Dipetakan secara massal via Smart Match (${item.confidenceScore})`
        }))
      };

      const response = await fetch('/api/admin/providers/mappings/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || 'Gagal menyelesaikan pemetaan massal.');
      }

      setBulkMapSuccessResult(resData.data);
      setSelectedSkuIds(new Set());
      fetchData();
    } catch (err: any) {
      setBulkMapError(err.message || 'Terjadi kesalahan saat memproses pemetaan massal.');
    } finally {
      setSubmittingBulkMap(false);
    }
  };

  const groupedVariantOptions = React.useMemo(() => {
    const groups: Record<string, { label: string; options: { id: string; name: string }[] }> = {};
    variantsList.forEach(v => {
      const prod = productsList.find(p => p.id === v.productId);
      if (!prod) return;
      const game = gamesList.find(g => g.id === prod.gameId);
      if (!game) return;
      
      if (!groups[game.id]) {
        groups[game.id] = { label: game.name, options: [] };
      }
      groups[game.id].options.push({
        id: v.id!,
        name: `${prod.name} - ${v.displayName || v.name}`
      });
    });
    return Object.values(groups);
  }, [variantsList, productsList, gamesList]);

  const filteredSkus = skus.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.providerSku.toLowerCase().includes(search.toLowerCase())
  );

  const allFilteredSkuIds = filteredSkus.map(s => s.id!).filter(Boolean);
  const isAllSelected = allFilteredSkuIds.length > 0 && allFilteredSkuIds.every(id => selectedSkuIds.has(id));
  
  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      const next = new Set(selectedSkuIds);
      allFilteredSkuIds.forEach(id => next.delete(id));
      setSelectedSkuIds(next);
    } else {
      const next = new Set(selectedSkuIds);
      allFilteredSkuIds.forEach(id => next.add(id));
      setSelectedSkuIds(next);
    }
  };
  
  const handleSelectRowToggle = (id: string) => {
    const next = new Set(selectedSkuIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedSkuIds(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari SKU atau nama produk provider..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          />
        </div>
        <div className="flex w-full sm:w-auto gap-2 flex-wrap items-center justify-end">
          <button 
            onClick={() => {
              setImportProviderId(providers[0]?.id || '');
              setImportFile(null);
              setImportSession(null);
              setImportSuccessResult(null);
              setImportError('');
              setIsImportModalOpen(true);
            }}
            className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors border border-slate-200 shadow-sm"
          >
            <Upload className="w-4 h-4" />
            <span>Impor Pricelist</span>
          </button>
          {selectedSkuIds.size > 0 && (
            <button 
              onClick={openBulkMapping}
              className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors shadow-sm"
            >
              <Link className="w-4 h-4" />
              <span>Petakan Massal ({selectedSkuIds.size})</span>
            </button>
          )}
          <button 
            onClick={handleOpenCreate}
            className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah SKU</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={isAllSelected} 
                    onChange={handleSelectAllToggle}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                  />
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-900">Provider</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-900">SKU Code</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-900">Product Name</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-900">Type</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-900">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-900 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">Loading SKUs...</td></tr>
              ) : filteredSkus.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                    Belum ada Provider SKU
                  </td>
                </tr>
              ) : (
                filteredSkus.map(sku => (
                  <tr key={sku.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedSkuIds.has(sku.id!)} 
                        onChange={() => handleSelectRowToggle(sku.id!)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                        {getProviderCode(sku.providerId)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-900">
                      {sku.providerSku}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {sku.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 capitalize">
                      {sku.type || 'topup'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        sku.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {sku.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleOpenEdit(sku)}
                        className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors inline-flex items-center"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {editingSku ? 'Edit Provider SKU' : 'Tambah Provider SKU'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-lg text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Provider</label>
                <select 
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  disabled={!!editingSku}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="" disabled>Pilih Provider</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">SKU Code (Provider-side)</label>
                <input 
                  type="text"
                  value={providerSku}
                  onChange={(e) => setProviderSku(e.target.value)}
                  placeholder="Contoh: ML25 atau weekly-diamond-pass"
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Product Name</label>
                <input 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Mobile Legends 25 Diamonds"
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Type</label>
                  <select 
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="topup">Top-up</option>
                    <option value="voucher">Voucher</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Status</label>
                  <select 
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-slate-700">Metadata (JSON format)</label>
                  <span className="text-xs text-slate-400">Optional</span>
                </div>
                <textarea 
                  rows={4}
                  value={metadataJson}
                  onChange={(e) => setMetadataJson(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-sm"
                  placeholder="{}"
                />
              </div>

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
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {formSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal Dialog */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`bg-white rounded-xl shadow-xl border border-slate-200 w-full overflow-hidden flex flex-col max-h-[90vh] transition-all duration-300 ${importSession ? 'max-w-5xl' : 'max-w-xl'}`}>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                <span>Impor Pricelist Massal</span>
              </h3>
              <button 
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                disabled={importing}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {importError && (
                <div className="p-3.5 bg-red-50 border border-red-100 text-red-700 rounded-lg text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="break-all whitespace-normal">{importError}</span>
                </div>
              )}

              {importSuccessResult ? (
                /* STEP 4: SUCCESS SUMMARY SCREEN */
                <div className="text-center py-6 space-y-6">
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-500 border border-green-200">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-bold text-slate-900">Impor Selesai Diproses</h4>
                    <p className="text-sm text-slate-500 max-w-md mx-auto">
                      Sistem berhasil merekonsiliasi berkas pricelist provider dan memperbarui basis data referensi.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                    <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-center">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-green-700">Tersimpan / Update</p>
                      <p className="text-2xl font-extrabold text-green-600 mt-1">{importSuccessResult.successCount || 0}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-center">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Dilewati</p>
                      <p className="text-2xl font-extrabold text-slate-700 mt-1">{importSuccessResult.skippedCount || 0}</p>
                    </div>
                    <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-center">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-red-700">Gagal</p>
                      <p className="text-2xl font-extrabold text-red-600 mt-1">{importSuccessResult.failedCount || 0}</p>
                    </div>
                  </div>

                  <div className="pt-4 max-w-xs mx-auto">
                    <button
                      type="button"
                      onClick={() => setIsImportModalOpen(false)}
                      className="w-full px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                      Selesai
                    </button>
                  </div>
                </div>
              ) : importSession ? (
                /* STEP 3: PREVIEW & REVIEW SCREEN */
                <div className="space-y-5">
                  {importSession.idempotencyWarning && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{importSession.idempotencyWarning}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Total Baris</span>
                      <p className="text-lg font-bold text-slate-800 mt-0.5">{importSession.rowCount}</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-center">
                      <span className="text-[10px] uppercase font-bold text-green-700">Valid</span>
                      <p className="text-lg font-bold text-green-700 mt-0.5">{importSession.validCount}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-center">
                      <span className="text-[10px] uppercase font-bold text-amber-700">Duplikat / Exist</span>
                      <p className="text-lg font-bold text-amber-700 mt-0.5">{importSession.duplicateCount}</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-center">
                      <span className="text-[10px] uppercase font-bold text-red-700">Tidak Valid</span>
                      <p className="text-lg font-bold text-red-700 mt-0.5">{importSession.invalidCount}</p>
                    </div>
                  </div>

                  <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <span>Pilihan Perilaku Duplikat</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Tentukan tindakan ketika menemukan SKU yang sudah ada di basis data untuk provider ini.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input 
                          type="radio" 
                          name="importMode"
                          checked={importMode === 'SKIP_DUPLICATES'}
                          onChange={() => setImportMode('SKIP_DUPLICATES')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>Lewati (Skip)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input 
                          type="radio" 
                          name="importMode"
                          checked={importMode === 'UPDATE_EXISTING'}
                          onChange={() => setImportMode('UPDATE_EXISTING')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>Perbarui (Update)</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-700">Pratinjau Data Row</span>
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 shadow-sm">
                      <div className="overflow-x-auto max-h-[30vh] overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 z-10">
                            <tr>
                              <th className="px-4 py-2 text-slate-700 font-bold">Baris</th>
                              <th className="px-4 py-2 text-slate-700 font-bold">Provider SKU</th>
                              <th className="px-4 py-2 text-slate-700 font-bold">Product Name</th>
                              <th className="px-4 py-2 text-slate-700 font-bold">Base Cost</th>
                              <th className="px-4 py-2 text-slate-700 font-bold">Type</th>
                              <th className="px-4 py-2 text-slate-700 font-bold">Status</th>
                              <th className="px-4 py-2 text-slate-700 font-bold">Result / Error</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 bg-white">
                            {importSession.rows.map((row: any) => (
                              <tr key={row.rowNumber} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-2 font-mono text-slate-400">{row.rowNumber}</td>
                                <td className="px-4 py-2 font-mono text-slate-900 font-bold">{row.skuCode || "-"}</td>
                                <td className="px-4 py-2 text-slate-700 whitespace-normal min-w-[150px]">{row.name || "-"}</td>
                                <td className="px-4 py-2 font-mono text-slate-800">Rp {(row.baseCost || 0).toLocaleString()}</td>
                                <td className="px-4 py-2 capitalize text-slate-500">{row.type}</td>
                                <td className="px-4 py-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    row.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-slate-600'
                                  }`}>
                                    {row.status.toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-4 py-2 min-w-[200px]">
                                  {row.rowStatus === 'READY' && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-50 text-green-700 text-[10px] font-bold">
                                      READY TO IMPORT
                                    </span>
                                  )}
                                  {row.rowStatus === 'DUPLICATE' && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-bold">
                                      DUPLICATE IN FILE
                                    </span>
                                  )}
                                  {row.rowStatus === 'WARNING' && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold">
                                      EXISTING IN DB
                                    </span>
                                  )}
                                  {row.rowStatus === 'INVALID' && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-bold">
                                      INVALID
                                    </span>
                                  )}
                                  {row.errors && row.errors.length > 0 && (
                                    <div className="text-[10px] text-red-500 mt-1 list-disc pl-3 leading-relaxed break-normal whitespace-normal">
                                      {row.errors.map((err: string, i: number) => (
                                        <div key={i}>{err}</div>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                    <button 
                      type="button"
                      onClick={() => setImportSession(null)}
                      disabled={importing}
                      className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
                    >
                      Batal / Unggah Ulang
                    </button>
                    
                    <button 
                      type="button"
                      onClick={handleImportExecute}
                      disabled={importing || (importSession.validCount === 0 && importMode === 'SKIP_DUPLICATES')}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 flex items-center gap-2 shadow-sm"
                    >
                      {importing ? 'Memproses Impor...' : 'Mulai Impor Baris Valid'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* STEP 1 & 2: SELECT PROVIDER & UPLOAD */
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-700">Pilih Target Provider</label>
                    <select 
                      value={importProviderId}
                      onChange={(e) => setImportProviderId(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      {providers.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-700">Unggah Berkas Pricelist</label>
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative group">
                      <input 
                        type="file" 
                        accept=".csv,.json"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3 group-hover:text-blue-500 transition-colors" />
                      {importFile ? (
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-800 break-all">{importFile.name}</p>
                          <p className="text-xs text-slate-500">{(importFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-700">Klik atau Seret berkas di sini</p>
                          <p className="text-[10px] text-slate-400">Mendukung format UTF-8 .CSV atau .JSON (Maksimal 1000 Baris)</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-slate-400" />
                      <span>Format Header CSV yang Didukung:</span>
                    </h4>
                    <p className="text-[11px] font-mono bg-slate-100 p-2 rounded text-slate-700 border border-slate-200 select-all whitespace-pre-wrap break-all">
                      providerSku,name,type,baseCost,status,targetFields,metadata
                    </p>
                    <div className="text-[11px] text-slate-500 list-disc pl-3.5 space-y-1">
                      <div><strong className="text-slate-700">providerSku & name:</strong> Wajib diisi untuk setiap item baris.</div>
                      <div><strong className="text-slate-700">baseCost:</strong> Desimal atau angka riil (contoh: 25000), default 0.</div>
                      <div><strong className="text-slate-700">type:</strong> topup / voucher / other.</div>
                      <div><strong className="text-slate-700">status:</strong> active / inactive.</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsImportModalOpen(false)}
                      disabled={importing}
                      className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
                    >
                      Batal
                    </button>
                    <button 
                      type="button"
                      onClick={handleValidate}
                      disabled={importing || !importFile || !importProviderId}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-sm"
                    >
                      {importing ? "Memproses..." : "Validasi & Review"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Smart Bulk Mapping Modal Dialog */}
      {isBulkMapModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] transition-all duration-300">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Link className="w-5 h-5 text-emerald-600" />
                <span>Smart Bulk Mapping & Matching</span>
              </h3>
              <button 
                onClick={() => setIsBulkMapModalOpen(false)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                disabled={submittingBulkMap}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {bulkMapError && (
                <div className="p-3.5 bg-red-50 border border-red-100 text-red-700 rounded-lg text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="whitespace-normal">{bulkMapError}</span>
                </div>
              )}

              {loadingSuggestions ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-sm font-semibold text-slate-500 animate-pulse">Menghasilkan rekomendasi pemetaan pintar...</p>
                </div>
              ) : bulkMapSuccessResult ? (
                /* SUCCESS SUMMARY SCREEN */
                <div className="text-center py-6 space-y-6">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500 border border-emerald-200">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-bold text-slate-900 font-display">Pemetaan Massal Selesai</h4>
                    <p className="text-sm text-slate-500 max-w-md mx-auto">
                      Hubungan pemetaan SKU TokoVoucher ke Varian Produk iStore.id berhasil disimpan secara modular.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Berhasil</p>
                      <p className="text-2xl font-extrabold text-emerald-600 mt-1">{bulkMapSuccessResult.successCount || 0}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-center">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Dilewati (Skip)</p>
                      <p className="text-2xl font-extrabold text-slate-700 mt-1">{bulkMapSuccessResult.skippedCount || 0}</p>
                    </div>
                    <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-center">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-red-700">Gagal</p>
                      <p className="text-2xl font-extrabold text-red-600 mt-1">{bulkMapSuccessResult.failedCount || 0}</p>
                    </div>
                  </div>

                  <div className="pt-4 max-w-xs mx-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setIsBulkMapModalOpen(false);
                        setSelectedSkuIds(new Set());
                      }}
                      className="w-full px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                    >
                      Selesai
                    </button>
                  </div>
                </div>
              ) : (
                /* MAIN SMART MATCH DIALOG */
                <div className="space-y-4">
                  {/* Summary Metric Stats */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Total Terpilih</span>
                      <p className="text-lg font-bold text-slate-800 mt-0.5">{suggestions.length}</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-center">
                      <span className="text-[10px] uppercase font-bold text-green-700">Siap Dipetakan</span>
                      <p className="text-lg font-bold text-green-700 mt-0.5">
                        {suggestions.filter(s => !s.skipped && s.selectedVariantId).length}
                      </p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-center">
                      <span className="text-[10px] uppercase font-bold text-amber-700">Butuh Review (LOW)</span>
                      <p className="text-lg font-bold text-amber-700 mt-0.5">
                        {suggestions.filter(s => !s.skipped && (s.confidenceScore === 'LOW' || !s.selectedVariantId)).length}
                      </p>
                    </div>
                    <div className="bg-slate-100 border border-slate-200 p-3 rounded-lg text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-600">Dilewati</span>
                      <p className="text-lg font-bold text-slate-700 mt-0.5">
                        {suggestions.filter(s => s.skipped).length}
                      </p>
                    </div>
                  </div>

                  {/* Inline settings & filter bar */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Penyaring Akurasi (Confidence)</label>
                      <select
                        value={confidenceFilter}
                        onChange={(e: any) => setConfidenceFilter(e.target.value)}
                        className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                      >
                        <option value="ALL">Semua Tingkat Akurasi</option>
                        <option value="HIGH">Akurasi HIGH</option>
                        <option value="MEDIUM">Akurasi MEDIUM</option>
                        <option value="LOW">Akurasi LOW</option>
                        <option value="NO_MATCH">Akurasi NO_MATCH</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Perilaku Duplikat</label>
                      <select
                        value={mappingDuplicateMode}
                        onChange={(e: any) => setMappingDuplicateMode(e.target.value)}
                        className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                      >
                        <option value="SKIP">Lompati Hubungan yang Sudah Ada (Skip)</option>
                        <option value="UPDATE">Perbarui Hubungan yang Sudah Ada (Update)</option>
                      </select>
                    </div>
                  </div>

                  {/* Suggestions table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    <div className="overflow-x-auto max-h-[40vh] overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                          <tr>
                            <th className="px-4 py-3 w-12 text-center text-slate-700 font-bold">Pilih</th>
                            <th className="px-4 py-3 text-slate-700 font-bold">Provider SKU & Nama</th>
                            <th className="px-4 py-3 text-slate-700 font-bold">Harga Beli</th>
                            <th className="px-4 py-3 text-slate-700 font-bold w-1/4">Akurasi Rekomendasi</th>
                            <th className="px-4 py-3 text-slate-700 font-bold w-1/3">Hubungkan ke Varian iStore.id</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {suggestions
                            .filter(item => {
                              if (confidenceFilter !== "ALL" && item.confidenceScore !== confidenceFilter) {
                                return false;
                              }
                              return true;
                            })
                            .map((item) => {
                              const isHigh = item.confidenceScore === "HIGH";
                              const isMedium = item.confidenceScore === "MEDIUM";
                              const isLow = item.confidenceScore === "LOW";

                              return (
                                <tr key={item.providerSkuId} className={`hover:bg-slate-50 transition-colors ${item.skipped ? 'opacity-60 bg-slate-50/50' : ''}`}>
                                  <td className="px-4 py-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={!item.skipped}
                                      onChange={(e) => {
                                        const next = [...suggestions];
                                        const foundIdx = next.findIndex(s => s.providerSkuId === item.providerSkuId);
                                        if (foundIdx !== -1) {
                                          next[foundIdx].skipped = !e.target.checked;
                                          setSuggestions(next);
                                        }
                                      }}
                                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="font-bold text-slate-800">{item.name}</p>
                                    <p className="font-mono text-[10px] text-slate-400 mt-0.5">{item.providerSku}</p>
                                    <div className="text-[10px] text-slate-500 mt-1 max-w-[250px]">
                                      {item.matchReasons.join(", ")}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 font-mono text-slate-800">
                                    Rp {(item.baseCost || 0).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                      isHigh ? "bg-green-50 text-green-700 border-green-200" :
                                      isMedium ? "bg-blue-50 text-blue-700 border-blue-200" :
                                      isLow ? "bg-amber-50 text-amber-700 border-amber-200" :
                                      "bg-slate-100 text-slate-600 border-slate-200"
                                    }`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${
                                        isHigh ? "bg-green-500" :
                                        isMedium ? "bg-blue-500" :
                                        isLow ? "bg-amber-500" :
                                        "bg-slate-400"
                                      }`}></span>
                                      {item.confidenceScore}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <select
                                      value={item.selectedVariantId}
                                      disabled={item.skipped}
                                      onChange={(e) => {
                                        const next = [...suggestions];
                                        const foundIdx = next.findIndex(s => s.providerSkuId === item.providerSkuId);
                                        if (foundIdx !== -1) {
                                          next[foundIdx].selectedVariantId = e.target.value;
                                          if (e.target.value) {
                                            next[foundIdx].skipped = false;
                                          }
                                          setSuggestions(next);
                                        }
                                      }}
                                      className="w-full p-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 text-xs font-semibold text-slate-700 max-w-[320px]"
                                    >
                                      <option value="">-- Hubungkan Varian Manual --</option>
                                      {groupedVariantOptions.map(group => (
                                        <optgroup key={group.label} label={group.label}>
                                          {group.options.map(opt => (
                                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                                          ))}
                                        </optgroup>
                                      ))}
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Dialog Action Buttons */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                    <button 
                      type="button"
                      onClick={() => setIsBulkMapModalOpen(false)}
                      disabled={submittingBulkMap}
                      className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
                    >
                      Batal
                    </button>
                    
                    <button 
                      type="button"
                      onClick={handleBulkMapSubmit}
                      disabled={submittingBulkMap || suggestions.filter(s => !s.skipped && s.selectedVariantId).length === 0}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 flex items-center gap-2 shadow-sm"
                    >
                      {submittingBulkMap ? 'Menyimpan Pemetaan...' : 'Konfirmasi & Petakan Massal'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
