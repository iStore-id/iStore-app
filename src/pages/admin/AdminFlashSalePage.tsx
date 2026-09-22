import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../store/auth-store";
import { Zap, Plus, Search, CheckCircle2, XCircle, AlertCircle, Edit3, Trash2, Calendar, DollarSign, Tag } from "lucide-react";

interface FlashSale {
  id: string;
  name: string;
  productId: string;
  variantId: string;
  salePrice: number;
  startAt: string;
  endAt: string;
  status: 'active' | 'inactive';
  totalQuota?: number | null;
  remainingQuota?: number | null;
  perCustomerLimit?: number | null;
  usageCount: number;
  createdAt: string;
}

export default function AdminFlashSalePage() {
  const { user } = useAuthStore();
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Selector data
  const [products, setProducts] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(false);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFs, setEditingFs] = useState<FlashSale | null>(null);

  // Form
  const [name, setName] = useState("");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [salePrice, setSalePrice] = useState<number>(0);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [totalQuota, setTotalQuota] = useState<string>("");
  const [perCustomerLimit, setPerCustomerLimit] = useState<string>("1");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchFlashSales();
    fetchProducts();
  }, []);

  const fetchFlashSales = async () => {
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/flash-sales", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setFlashSales(data.data || []);
      } else {
        setError(data.message || "Gagal memuat data flash sale");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/catalog/products", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const json = await res.json();
      if (json.success) {
        setProducts(json.data || []);
      }
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchVariants = async (prodId: string) => {
    if (!prodId) {
      setVariants([]);
      return;
    }
    try {
      setLoadingVariants(true);
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/catalog/variants?productId=${prodId}`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const json = await res.json();
      if (json.success) {
        setVariants(json.data || []);
      }
    } catch (err) {
      console.error("Error fetching variants:", err);
      setVariants([]);
    } finally {
      setLoadingVariants(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingFs(null);
    setName("");
    setProductId("");
    setVariantId("");
    setVariants([]);
    setSalePrice(0);
    const now = new Date();
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    setStartAt(now.toISOString().slice(0, 16));
    setEndAt(future.toISOString().slice(0, 16));
    setStatus("active");
    setTotalQuota("");
    setPerCustomerLimit("1");
    fetchProducts();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (fs: FlashSale) => {
    setEditingFs(fs);
    setName(fs.name);
    setProductId(fs.productId);
    setVariantId(fs.variantId);
    setSalePrice(fs.salePrice);
    setStartAt(fs.startAt ? fs.startAt.slice(0, 16) : "");
    setEndAt(fs.endAt ? fs.endAt.slice(0, 16) : "");
    setStatus(fs.status);
    setTotalQuota(fs.totalQuota !== null && fs.totalQuota !== undefined ? fs.totalQuota.toString() : "");
    setPerCustomerLimit(fs.perCustomerLimit !== null && fs.perCustomerLimit !== undefined ? fs.perCustomerLimit.toString() : "1");
    fetchProducts();
    fetchVariants(fs.productId);
    setIsModalOpen(true);
  };

  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProdId = e.target.value;
    setProductId(newProdId);
    setVariantId("");
    setVariants([]);
    if (newProdId) {
      fetchVariants(newProdId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = await (user as any)?.getIdToken?.();
      const payload = {
        name,
        productId,
        variantId,
        salePrice: Number(salePrice),
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        status,
        totalQuota: totalQuota ? Number(totalQuota) : null,
        perCustomerLimit: perCustomerLimit ? Number(perCustomerLimit) : null
      };

      const url = editingFs ? `/api/admin/flash-sales/${editingFs.id}` : "/api/admin/flash-sales";
      const method = editingFs ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMsg(editingFs ? "Flash Sale berhasil diperbarui." : "Flash Sale berhasil dibuat.");
        setIsModalOpen(false);
        fetchFlashSales();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || "Gagal menyimpan flash sale");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menonaktifkan flash sale ini?")) return;
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/flash-sales/${id}`, {
        method: "DELETE",
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Flash sale berhasil dinonaktifkan.");
        fetchFlashSales();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || "Gagal menonaktifkan flash sale");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filtered = flashSales.filter(fs => 
    fs.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    fs.variantId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 whitespace-normal break-words">Flash Sale Management</h1>
          <p className="text-sm text-gray-500">Kelola kampanye flash sale terbatas dan kuota khusus produk.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Buat Flash Sale Baru
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{successMsg}</span>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama flash sale atau variant ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Memuat data flash sale...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">Belum ada flash sale yang dibuat.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Nama Kampanye</th>
                  <th className="py-3 px-4">Variant ID</th>
                  <th className="py-3 px-4">Harga Flash Sale</th>
                  <th className="py-3 px-4">Periode</th>
                  <th className="py-3 px-4">Kuota Tersisa</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {filtered.map((fs) => (
                  <tr key={fs.id} className="hover:bg-gray-50 transition">
                    <td className="py-4 px-4 font-semibold text-gray-900 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                      {fs.name}
                    </td>
                    <td className="py-4 px-4 text-xs font-mono text-gray-600">{fs.variantId}</td>
                    <td className="py-4 px-4 font-bold text-indigo-600">
                      Rp {fs.salePrice.toLocaleString("id-ID")}
                    </td>
                    <td className="py-4 px-4 text-xs text-gray-600">
                      <div>Mulai: {new Date(fs.startAt).toLocaleString()}</div>
                      <div>Selesai: {new Date(fs.endAt).toLocaleString()}</div>
                    </td>
                    <td className="py-4 px-4 text-gray-900 font-medium">
                      {fs.remainingQuota !== null && fs.remainingQuota !== undefined ? `${fs.remainingQuota} / ${fs.totalQuota}` : "Tanpa Kuota"} ({fs.usageCount} terjual)
                    </td>
                    <td className="py-4 px-4">
                      {fs.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          <XCircle className="w-3.5 h-3.5" /> Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(fs)}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        title="Edit Flash Sale"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(fs.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Nonaktifkan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-950">
                {editingFs ? "Edit Flash Sale" : "Buat Flash Sale Baru"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nama Kampanye Flash Sale</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Flash Sale Tengah Malam"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Pilih Produk</label>
                  <select
                    required
                    value={productId}
                    onChange={handleProductChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">{loadingProducts ? "Memuat produk..." : "-- Pilih Produk --"}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Pilih Variant</label>
                  <select
                    required
                    disabled={!productId || loadingVariants}
                    value={variantId}
                    onChange={(e) => setVariantId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-gray-100"
                  >
                    <option value="">
                      {!productId 
                        ? "-- Pilih produk terlebih dahulu --" 
                        : loadingVariants 
                        ? "Memuat variant..." 
                        : variants.length === 0 
                        ? "Tidak ada variant" 
                        : "-- Pilih Variant --"}
                    </option>
                    {variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name || v.displayName || v.sku} {v.pricing?.sellingPrice ? `(Rp ${v.pricing.sellingPrice.toLocaleString("id-ID")})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Harga Flash Sale (Rp)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={salePrice}
                  onChange={(e) => setSalePrice(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Total Kuota (Opsional)</label>
                  <input
                    type="number"
                    placeholder="Tanpa kuota"
                    value={totalQuota}
                    onChange={(e) => setTotalQuota(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Batas Per Customer</label>
                  <input
                    type="number"
                    value={perCustomerLimit}
                    onChange={(e) => setPerCustomerLimit(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Waktu Mulai</label>
                  <input
                    type="datetime-local"
                    required
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Waktu Berakhir</label>
                  <input
                    type="datetime-local"
                    required
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e: any) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {submitting ? "Menyimpan..." : "Simpan Flash Sale"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
