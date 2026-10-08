import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Truck, 
  Package, 
  Link as LinkIcon, 
  GitBranch, 
  Activity,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Check,
  X,
  AlertTriangle,
  HelpCircle,
  ListChecks,
  RefreshCw,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ProvidersTab from '../../components/admin/providers/ProvidersTab';
import ProviderSkusTab from '../../components/admin/providers/ProviderSkusTab';
import MappingsTab from '../../components/admin/providers/MappingsTab';
import { useAuthStore } from '../../store/auth-store';

const AdminProvidersPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'providers';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [addTrigger, setAddTrigger] = useState<{ tab: string; timestamp: number } | null>(null);

  const tabs = [
    { id: 'providers', title: 'Supplier', icon: Truck },
    { id: 'skus', title: 'Produk Supplier', icon: Package },
    { id: 'mappings', title: 'Hubungan Produk', icon: LinkIcon },
    { id: 'routing', title: 'Pengaturan Jalur', icon: GitBranch },
    { id: 'discovery', title: 'Tarik Produk', icon: Activity },
  ];

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['providers', 'skus', 'mappings', 'routing', 'discovery'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', newTab);
      return next;
    });
    setImportSuccessResult(null);
    setImportError("");
  };

  // Catalog Discovery States
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSkus, setSelectedSkus] = useState<Record<string, boolean>>({});
  const [selectedProvider, setSelectedProvider] = useState<string>("tokovoucher");
  const [discoveryMode, setDiscoveryMode] = useState<"brand" | "50" | "100" | "full">("brand");
  
  // Review/Import States
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [importMode, setImportMode] = useState<'SKIP_DUPLICATES' | 'UPDATE_EXISTING'>('SKIP_DUPLICATES');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccessResult, setImportSuccessResult] = useState<any | null>(null);

  const { user } = useAuthStore();

  const handleAddClick = () => {
    setAddTrigger({ tab: activeTab, timestamp: Date.now() });
  };

  const handleDiscover = async () => {
    if (discoveryMode === "brand" && search.trim() === "") {
      setImportError("Masukkan kode/prefix produk terlebih dahulu. Contoh: ML, FF, PLN.");
      return;
    }

    setLoading(true);
    setResults([]);
    setSelectedSkus({});
    setImportSuccessResult(null);
    setImportError("");
    
    try {
      const token = await user?.getIdToken();
      if (!token) {
        setImportError("Sesi otentikasi tidak ditemukan. Silakan muat ulang halaman atau login kembali.");
        setLoading(false);
        return;
      }

      // Query discovery for selected provider
      const response = await fetch(`/api/admin/providers/catalog-discovery?provider=${selectedProvider}&code=${encodeURIComponent(search)}&limit=${discoveryMode}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      let data: any = {};
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        // Handle non-json
      }

      if (response.ok && data.success) {
        setResults(data.data || []);
      } else {
        setImportError(data.message || `Gagal melakukan discovery dari ${selectedProvider} (Status: ${response.status}).`);
      }
    } catch (e: any) {
      setImportError(e.message || "Koneksi ke server terputus.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    const nextSelected: Record<string, boolean> = {};
    results.forEach(item => {
      nextSelected[item.providerSku] = true;
    });
    setSelectedSkus(nextSelected);
  };

  const handleDeselectAll = () => {
    setSelectedSkus({});
  };

  const toggleSelectSku = (providerSku: string) => {
    setSelectedSkus(prev => ({
      ...prev,
      [providerSku]: !prev[providerSku]
    }));
  };

  const selectedItems = results.filter(item => selectedSkus[item.providerSku]);

  const handleOpenReview = () => {
    if (selectedItems.length === 0) return;
    setImportError("");
    setImportSuccessResult(null);
    setIsReviewOpen(true);
  };

  const handleExecuteImport = async () => {
    if (selectedItems.length === 0) return;
    setImporting(true);
    setImportError("");
    
    try {
      const token = await user?.getIdToken();
      const response = await fetch('/api/admin/providers/catalog-discovery/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          providerId: selectedProvider,
          items: selectedItems,
          mode: importMode
        })
      });

      let responseJson: any = {};
      try {
        const text = await response.text();
        responseJson = text ? JSON.parse(text) : {};
      } catch (e) {
        // Handle non-json
      }

      if (!response.ok) {
        throw new Error(responseJson.message || `Gagal melakukan proses impor (Status: ${response.status})`);
      }

      setImportSuccessResult(responseJson.data);
      
      // Clean selections
      setSelectedSkus({});
    } catch (err: any) {
      setImportError(err.message || "Terjadi kesalahan saat memproses impor.");
    } finally {
      setImporting(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'providers':
        return <ProvidersTab />;
      case 'skus':
        return <ProviderSkusTab addTrigger={addTrigger} />;
      case 'mappings':
        return <MappingsTab addTrigger={addTrigger} />;
      case 'routing':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-xl flex items-start gap-3">
              <GitBranch className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-blue-900">Routing Observability (Read-Only)</h3>
                <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                  Tampilan ini hanya membaca mapping yang ada. Owner dapat melihat Variant → Supplier → Provider SKU → status mapping → status SKU → kesiapan routing.
                  Algoritma routing dan data transaksi tidak diubah dari halaman ini.
                </p>
              </div>
            </div>
            <MappingsTab readOnly />
          </div>
        );
      case 'discovery':
        return (
          <div className="space-y-6">
            <div className="bg-slate-50/50 border border-slate-200 p-4 rounded-xl space-y-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="w-full lg:w-64">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Pilih Provider</label>
                  <select 
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                  >
                    <option value="tokovoucher">TokoVoucher (Full Support)</option>
                    <option value="apigames">ApiGames (Limited Discovery)</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Parameter Discovery</label>
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="w-full md:w-48">
                      <select
                        value={discoveryMode}
                        onChange={(e) => setDiscoveryMode(e.target.value as any)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                      >
                        <option value="brand">Per Brand / Kategori</option>
                        <option value="50">50 Item</option>
                        <option value="100">100 Item</option>
                        <option value="full">Full Catalog</option>
                      </select>
                    </div>
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                      <input 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={discoveryMode === "brand" ? "WAJIB: Masukkan prefix produk (contoh: ML, FF)..." : "Cari Product Code (opsional)..."}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <button 
                      onClick={handleDiscover} 
                      disabled={loading}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors flex items-center gap-2 justify-center shadow-sm"
                    >
                      {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                      <span>{loading ? `Menghubungkan ${selectedProvider}...` : "Ambil Katalog (Discover)"}</span>
                    </button>
                  </div>
                </div>
              </div>
              
              {discoveryMode === "full" && (
                <div className="p-3 bg-amber-50 border border-amber-100 text-amber-800 rounded-lg text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span><strong>Warning:</strong> Full Catalog berisi 11.000+ item dan tidak melakukan pengecekan duplikat ke database demi menjaga kuota. Gunakan mode ini hanya untuk inspeksi/sinkronisasi bertahap.</span>
                </div>
              )}
              
              <div className="flex items-center gap-4 text-xs text-slate-500 bg-white/50 p-2 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-500" />
                  <span>Mode: <strong>Read-Only</strong>. Data katalog diambil langsung dari provider API.</span>
                </div>
                <div className="w-px h-3 bg-slate-200" />
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-green-500" />
                  <span>Status: <strong>Connected</strong></span>
                </div>
              </div>
            </div>

            {importError && (
              <div className="p-3.5 bg-red-50 border border-red-100 text-red-700 rounded-lg text-sm flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{importError}</span>
              </div>
            )}

            {results.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleSelectAll}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors border border-slate-200"
                    >
                      Pilih Semua
                    </button>
                    <button 
                      onClick={handleDeselectAll}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors border border-slate-200"
                    >
                      Batal Semua
                    </button>
                    <span className="text-xs font-medium text-slate-500 ml-2">
                      Terpilih: <strong>{selectedItems.length}</strong> dari {results.length} item
                    </span>
                  </div>

                  <button
                    onClick={handleOpenReview}
                    disabled={selectedItems.length === 0}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <span>Tinjau Item Terpilih ({selectedItems.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[800px]">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-5 py-3 w-12 text-center">
                            <input 
                              type="checkbox"
                              checked={results.length > 0 && selectedItems.length === results.length}
                              onChange={(e) => {
                                if (e.target.checked) handleSelectAll();
                                else handleDeselectAll();
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </th>
                          <th className="px-5 py-3">Provider SKU</th>
                          <th className="px-5 py-3">Nama Produk</th>
                          <th className="px-5 py-3">Harga Provider</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3">Kategori</th>
                          <th className="px-5 py-3">Jenis</th>
                          <th className="px-5 py-3">Penanganan Duplikasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {results.map((item) => {
                          const isAlreadyExist = item.isExisting === true;
                          return (
                            <tr key={item.providerSku} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3 text-center">
                                <input 
                                  type="checkbox"
                                  checked={!!selectedSkus[item.providerSku]}
                                  onChange={() => toggleSelectSku(item.providerSku)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>
                              <td className="px-5 py-3 font-mono font-bold text-slate-900 select-all">{item.providerSku}</td>
                              <td className="px-5 py-3 text-slate-800 font-medium whitespace-normal max-w-xs break-words">{item.name}</td>
                              <td className="px-5 py-3 font-mono text-slate-900 font-bold">Rp {item.baseCost.toLocaleString()}</td>
                              <td className="px-5 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.isActive ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {item.isActive ? "AKTIF" : "NONAKTIF"}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-slate-500 font-medium capitalize">{item.metadata?.category || "-"}</td>
                              <td className="px-5 py-3 text-slate-500 font-medium capitalize">{item.metadata?.type || "-"}</td>
                              <td className="px-5 py-3">
                                {item.isExisting === null ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    <Info className="w-3 h-3 shrink-0" />
                                    <span>UNCHECKED</span>
                                  </span>
                                ) : item.isExisting === true ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    <span>EXISTING IN DB</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                                    <Check className="w-3 h-3 shrink-0" />
                                    <span>NEW SKU</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              !loading && (
                <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                  <Activity className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h4 className="text-sm font-semibold text-slate-900">Belum Ada Katalog Terbuka</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Masukkan kata kunci produk atau kosongkan pencarian dan klik tombol Ambil Katalog di atas untuk mensinkronisasi data langsung.
                  </p>
                </div>
              )
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="ui-page-title text-slate-900">
            Provider & Integrasi Supplier
          </h1>
          <p className="text-slate-500 text-sm">
            Manajemen koneksi supplier, pemetaan SKU, dan kebijakan routing otomatis.
          </p>
        </div>
        {['skus', 'mappings'].includes(activeTab) && (
          <button 
            onClick={handleAddClick}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah {activeTab === 'skus' ? 'Provider SKU' : 'Mapping'}</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-all whitespace-nowrap text-sm ${
              activeTab === tab.id 
                ? 'border-blue-600 text-blue-600 font-bold' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <tab.icon className="w-4.5 h-4.5" />
            <span>{tab.title}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-6"
          >
            {/* Filter Bar (Only for tables except routing policy, discovery page, and mappings) */}
            {!['routing', 'discovery', 'mappings'].includes(activeTab) && (
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder={`Cari ${tabs.find(t => t.id === activeTab)?.title.toLowerCase()}...`}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                  />
                </div>
                <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors text-sm font-semibold">
                  <Filter className="w-4 h-4" />
                  <span>Filter</span>
                </button>
              </div>
            )}

            {/* Content Based on Tab */}
            <div className="mt-2">
              {renderTabContent()}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 text-sm">Deterministic Routing</h4>
              <p className="text-xs text-blue-700 mt-1 leading-relaxed">Sistem menggunakan algoritma deterministik berdasarkan prioritas dan eligibility untuk memilih provider terbaik.</p>
            </div>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-900 text-sm">Idempotency Ready</h4>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">Setiap routing decision memiliki unique reference untuk mencegah double fulfillment di tingkat provider API.</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-slate-900 text-sm">Audit Trail</h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">Semua perubahan pada pemetaan SKU dan status provider dicatat secara otomatis dalam Audit Log sistem secara lengkap.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Discovery Review & Import Modal Dialog */}
      {isReviewOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-blue-600" />
                <span>Tinjau Impor Hasil Discovery ({selectedItems.length} Item)</span>
              </h3>
              <button 
                onClick={() => setIsReviewOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                disabled={importing}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {importError && (
                <div className="p-3.5 bg-red-50 border border-red-100 text-red-700 rounded-lg text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}

              {importSuccessResult ? (
                <div className="text-center py-6 space-y-6">
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-500 border border-green-200">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-lg font-bold text-slate-900">Sinkronisasi Selesai</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Katalog TokoVoucher berhasil diimpor ke dalam basis data referensi Provider SKU.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
                    <div className="bg-green-50 border border-green-100 p-3 rounded-lg text-center">
                      <span className="text-[10px] font-bold text-green-700 uppercase">Tersimpan / Update</span>
                      <p className="text-xl font-bold text-green-600 mt-1">{importSuccessResult.successCount || 0}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg text-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Dilewati</span>
                      <p className="text-xl font-bold text-slate-700 mt-1">{importSuccessResult.skippedCount || 0}</p>
                    </div>
                    <div className="bg-red-50 border border-red-100 p-3 rounded-lg text-center">
                      <span className="text-[10px] font-bold text-red-700 uppercase">Gagal</span>
                      <p className="text-xl font-bold text-red-600 mt-1">{importSuccessResult.failedCount || 0}</p>
                    </div>
                  </div>

                  <div className="pt-4 max-w-xs mx-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setIsReviewOpen(false);
                        setResults([]);
                        handleDiscover();
                      }}
                      className="w-full px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                    >
                      Kembali ke Discovery
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Duplication Action Header */}
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Pilihan Perilaku Duplikat</h4>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Sistem mendeteksi jika beberapa SKU yang dipilih sudah terdaftar di basis data. Tentukan tindakannya:
                      </p>
                    </div>
                    <div className="flex gap-4 shrink-0">
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

                  {/* Summary Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-slate-50">
                    <div className="max-h-[40vh] overflow-y-auto overflow-x-auto">
                      <table className="w-full text-left text-xs bg-white">
                        <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-2">Provider SKU</th>
                            <th className="px-4 py-2">Nama Produk</th>
                            <th className="px-4 py-2">Harga Dasar</th>
                            <th className="px-4 py-2">Status</th>
                            <th className="px-4 py-2">Kategori</th>
                            <th className="px-4 py-2">Hasil Deteksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedItems.map((item) => {
                            const isAlreadyExist = item.isExisting === true;
                            return (
                              <tr key={item.providerSku} className="hover:bg-slate-50/50">
                                <td className="px-4 py-2 font-mono font-bold text-slate-800">{item.providerSku}</td>
                                <td className="px-4 py-2 font-medium text-slate-700 whitespace-normal max-w-xs break-words">{item.name}</td>
                                <td className="px-4 py-2 font-mono text-slate-800">Rp {item.baseCost.toLocaleString()}</td>
                                <td className="px-4 py-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    item.isActive ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {item.isActive ? "AKTIF" : "NONAKTIF"}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-slate-500 capitalize">{item.metadata?.category || "-"}</td>
                                <td className="px-4 py-2">
                                  {isAlreadyExist ? (
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${
                                      importMode === 'SKIP_DUPLICATES' 
                                        ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                                        : 'bg-blue-50 text-blue-800 border border-blue-200'
                                    }`}>
                                      <AlertTriangle className="w-3 h-3 shrink-0" />
                                      <span>{importMode === 'SKIP_DUPLICATES' ? 'Akan Dilewati (Skip)' : 'Akan Diperbarui (Update)'}</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                                      <Check className="w-3 h-3 shrink-0" />
                                      <span>Akan Ditambahkan</span>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Confirmation Buttons */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                    <button 
                      type="button"
                      onClick={() => setIsReviewOpen(false)}
                      disabled={importing}
                      className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors"
                    >
                      Batal
                    </button>
                    
                    <button 
                      type="button"
                      onClick={handleExecuteImport}
                      disabled={importing}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-40 flex items-center gap-2 shadow-sm"
                    >
                      {importing ? "Sedang Memproses Sinkronisasi..." : `Mulai Konfirmasi Impor (${selectedItems.length} SKU)`}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProvidersPage;
