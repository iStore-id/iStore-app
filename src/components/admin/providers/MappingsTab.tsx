import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { ProviderMapping, Provider, ProductVariant, ProviderSku } from '../../../types/core';
import { useAuthStore } from '../../../store/auth-store';
import { Link as LinkIcon, Search, Edit2, X, AlertCircle, Plus } from 'lucide-react';

interface MappingsTabProps {
  addTrigger?: { tab: string; timestamp: number } | null;
}

export default function MappingsTab({ addTrigger }: MappingsTabProps) {
  const [mappings, setMappings] = useState<ProviderMapping[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [providerSkus, setProviderSkus] = useState<ProviderSku[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal & Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<ProviderMapping | null>(null);
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const { user } = useAuthStore();

  // Form Fields
  const [variantId, setVariantId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [providerSkuId, setProviderSkuId] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'testing'>('active');
  const [priority, setPriority] = useState<number>(0);
  const [routingEligibility, setRoutingEligibility] = useState<boolean>(true);
  const [notes, setNotes] = useState('');
  const [metadataJson, setMetadataJson] = useState('{}');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (addTrigger && addTrigger.tab === 'mappings') {
      handleOpenCreate();
    }
  }, [addTrigger]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [mapSnap, provSnap, varSnap, skusSnap] = await Promise.all([
        getDocs(query(collection(db, 'providerMappings'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'providers')),
        getDocs(collection(db, 'productVariants')),
        getDocs(collection(db, 'providerSkus'))
      ]);
      setMappings(mapSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProviderMapping)));
      setProviders(provSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Provider)));
      setVariants(varSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductVariant)));
      setProviderSkus(skusSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProviderSku)));
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getProviderCode = (providerId: string) => {
    return providers.find(p => p.id === providerId)?.code || 'Unknown';
  };

  const getVariantName = (variantId: string) => {
    return variants.find(v => v.id === variantId)?.name || 'Unknown Variant';
  };

  const handleOpenCreate = () => {
    setEditingMapping(null);
    setVariantId(variants[0]?.id || '');
    setProviderId(providers[0]?.id || '');
    setProviderSkuId('');
    setStatus('active');
    setPriority(0);
    setRoutingEligibility(true);
    setNotes('');
    setMetadataJson('{}');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (mapping: ProviderMapping) => {
    setEditingMapping(mapping);
    setVariantId(mapping.variantId);
    setProviderId(mapping.providerId);
    setProviderSkuId(mapping.providerSkuId);
    setStatus(mapping.status);
    setPriority(mapping.priority || 0);
    setRoutingEligibility(mapping.routingEligibility);
    setNotes(mapping.notes || '');
    setMetadataJson(JSON.stringify(mapping.metadata || {}, null, 2));
    setFormError('');
    setIsModalOpen(true);
  };

  // Filter provider SKUs based on the currently selected provider in form
  const filteredProviderSkusInForm = providerSkus.filter(sku => sku.providerId === providerId);

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

      if (!variantId) throw new Error('Variant wajib dipilih.');
      if (!providerId) throw new Error('Provider wajib dipilih.');
      if (!providerSkuId) throw new Error('Provider SKU wajib dipilih.');

      const token = await user?.getIdToken();
      if (!token) throw new Error('Autentikasi gagal. Silakan login kembali.');

      const payload = {
        variantId,
        providerId,
        providerSkuId,
        status,
        priority: Number(priority),
        routingEligibility,
        notes: notes.trim(),
        metadata: parsedMetadata,
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
      if (!response.ok) {
        throw new Error(data.message || 'Gagal menyimpan Provider Mapping.');
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const filteredMappings = mappings.filter(m => 
    m.providerSku.toLowerCase().includes(search.toLowerCase()) || 
    getVariantName(m.variantId).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari Variant atau Provider SKU..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          />
        </div>
        <button 
          onClick={handleOpenCreate}
          className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Mapping</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-900">iStore Variant</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-900">Provider</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-900">Provider SKU</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-900 text-center">Priority</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-900 text-center">Routing</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-900">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-900 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">Loading Mappings...</td></tr>
              ) : filteredMappings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <LinkIcon className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                    Belum ada Provider Mapping
                  </td>
                </tr>
              ) : (
                filteredMappings.map(mapping => (
                  <tr key={mapping.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {getVariantName(mapping.variantId)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                        {getProviderCode(mapping.providerId)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-600">
                      {mapping.providerSku}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 text-center font-semibold">
                      {mapping.priority}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        mapping.routingEligibility ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {mapping.routingEligibility ? 'Eligible' : 'Excluded'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        mapping.status === 'active' ? 'bg-green-100 text-green-700' : 
                        mapping.status === 'testing' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {mapping.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleOpenEdit(mapping)}
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
                {editingMapping ? 'Edit Provider Mapping' : 'Tambah Provider Mapping'}
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
                <label className="text-sm font-semibold text-slate-700">iStore Variant</label>
                <select 
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                  disabled={!!editingMapping}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="" disabled>Pilih Variant</option>
                  {variants.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.sku})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Provider</label>
                <select 
                  value={providerId}
                  onChange={(e) => {
                    setProviderId(e.target.value);
                    setProviderSkuId(''); // Reset selected SKU when provider changes
                  }}
                  disabled={!!editingMapping}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="" disabled>Pilih Provider</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Provider SKU</label>
                <select 
                  value={providerSkuId}
                  onChange={(e) => setProviderSkuId(e.target.value)}
                  disabled={!providerId}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                >
                  <option value="" disabled>Pilih Provider SKU</option>
                  {filteredProviderSkusInForm.map(sku => (
                    <option key={sku.id} value={sku.id}>{sku.providerSku} - {sku.name}</option>
                  ))}
                </select>
                {providerId && filteredProviderSkusInForm.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Belum ada Provider SKU terdaftar untuk provider ini.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Priority (Order)</label>
                  <input 
                    type="number"
                    min="0"
                    max="100"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <p className="text-xs text-slate-400">Nilai lebih tinggi didahulukan.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Routing Eligibility</label>
                  <select 
                    value={routingEligibility ? 'true' : 'false'}
                    onChange={(e) => setRoutingEligibility(e.target.value === 'true')}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="true">Eligible</option>
                    <option value="false">Excluded / Disable Fallback</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Status</label>
                  <select 
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="testing">Testing</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Notes / Deskripsi Internal</label>
                <input 
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Jalur utama API Games untuk ML 25"
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
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
    </div>
  );
}
