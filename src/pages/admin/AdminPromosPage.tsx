import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../store/auth-store";
import { Tag, Plus, Search, CheckCircle2, XCircle, AlertCircle, Edit3, Trash2, Calendar, Percent, DollarSign, ShieldCheck } from "lucide-react";

interface Promo {
  id: string;
  code: string;
  name: string;
  description?: string;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  minimumTransaction: number;
  maximumDiscount?: number | null;
  usageLimit?: number | null;
  perCustomerUsageLimit?: number | null;
  startAt: string;
  endAt: string;
  status: 'active' | 'inactive';
  usageCount: number;
  createdAt: string;
}

export default function AdminPromosPage() {
  const { user } = useAuthStore();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null);

  // Form state
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [minimumTransaction, setMinimumTransaction] = useState<number>(0);
  const [maximumDiscount, setMaximumDiscount] = useState<string>("");
  const [usageLimit, setUsageLimit] = useState<string>("");
  const [perCustomerUsageLimit, setPerCustomerUsageLimit] = useState<string>("1");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPromos();
  }, []);

  const fetchPromos = async () => {
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/promos", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setPromos(data.data || []);
      } else {
        setError(data.message || "Gagal memuat data promo");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingPromo(null);
    setCode("");
    setName("");
    setDescription("");
    setDiscountType("percentage");
    setDiscountValue(10);
    setMinimumTransaction(0);
    setMaximumDiscount("");
    setUsageLimit("");
    setPerCustomerUsageLimit("1");
    // Default start now, end 30 days later
    const now = new Date();
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    setStartAt(now.toISOString().slice(0, 16));
    setEndAt(future.toISOString().slice(0, 16));
    setStatus("active");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (promo: Promo) => {
    setEditingPromo(promo);
    setCode(promo.code);
    setName(promo.name);
    setDescription(promo.description || "");
    setDiscountType(promo.discountType);
    setDiscountValue(promo.discountValue);
    setMinimumTransaction(promo.minimumTransaction || 0);
    setMaximumDiscount(promo.maximumDiscount ? promo.maximumDiscount.toString() : "");
    setUsageLimit(promo.usageLimit ? promo.usageLimit.toString() : "");
    setPerCustomerUsageLimit(promo.perCustomerUsageLimit ? promo.perCustomerUsageLimit.toString() : "1");
    setStartAt(promo.startAt ? promo.startAt.slice(0, 16) : "");
    setEndAt(promo.endAt ? promo.endAt.slice(0, 16) : "");
    setStatus(promo.status);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = await (user as any)?.getIdToken?.();
      const payload = {
        code,
        name,
        description,
        discountType,
        discountValue: Number(discountValue),
        minimumTransaction: Number(minimumTransaction),
        maximumDiscount: maximumDiscount ? Number(maximumDiscount) : null,
        usageLimit: usageLimit ? Number(usageLimit) : null,
        perCustomerUsageLimit: perCustomerUsageLimit ? Number(perCustomerUsageLimit) : null,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        status
      };

      const url = editingPromo ? `/api/admin/promos/${editingPromo.id}` : "/api/admin/promos";
      const method = editingPromo ? "PUT" : "POST";

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
        setSuccessMsg(editingPromo ? "Promo berhasil diperbarui." : "Promo berhasil dibuat.");
        setIsModalOpen(false);
        fetchPromos();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || "Gagal menyimpan promo");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menonaktifkan promo ini?")) return;
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/promos/${id}`, {
        method: "DELETE",
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Promo berhasil dinonaktifkan.");
        fetchPromos();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || "Gagal menonaktifkan promo");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredPromos = promos.filter(p => 
    p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Promo & Voucher Management</h1>
          <p className="text-sm text-gray-500">Kelola kupon diskon, voucher, dan batasan penggunaan campaign.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Buat Promo Baru
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

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan kode promo atau nama..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Promos Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Memuat data promo...</div>
        ) : filteredPromos.length === 0 ? (
          <div className="p-12 text-center text-gray-500">Belum ada promo yang dibuat.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Kode & Nama</th>
                  <th className="py-3 px-4">Diskon</th>
                  <th className="py-3 px-4">Min. Transaksi</th>
                  <th className="py-3 px-4">Periode</th>
                  <th className="py-3 px-4">Penggunaan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {filteredPromos.map((promo) => (
                  <tr key={promo.id} className="hover:bg-gray-50 transition">
                    <td className="py-4 px-4">
                      <div className="font-semibold text-indigo-600 font-mono">{promo.code}</div>
                      <div className="text-gray-900 font-medium">{promo.name}</div>
                      {promo.description && <div className="text-xs text-gray-500 truncate max-w-xs">{promo.description}</div>}
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1 font-semibold text-gray-900">
                        {promo.discountType === 'percentage' ? (
                          <><Percent className="w-3.5 h-3.5 text-indigo-500" />{promo.discountValue}%</>
                        ) : (
                          <><DollarSign className="w-3.5 h-3.5 text-emerald-500" />Rp {promo.discountValue.toLocaleString("id-ID")}</>
                        )}
                      </span>
                      {promo.maximumDiscount && promo.discountType === 'percentage' && (
                        <div className="text-xs text-gray-500">Maks. Rp {promo.maximumDiscount.toLocaleString("id-ID")}</div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-gray-600">
                      Rp {promo.minimumTransaction.toLocaleString("id-ID")}
                    </td>
                    <td className="py-4 px-4 text-xs text-gray-600">
                      <div>Mulai: {new Date(promo.startAt).toLocaleDateString()}</div>
                      <div>Selesai: {new Date(promo.endAt).toLocaleDateString()}</div>
                    </td>
                    <td className="py-4 px-4 text-gray-900 font-medium">
                      {promo.usageCount} {promo.usageLimit ? `/ ${promo.usageLimit}` : "x"}
                    </td>
                    <td className="py-4 px-4">
                      {promo.status === 'active' ? (
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
                        onClick={() => handleOpenEdit(promo)}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        title="Edit Promo"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(promo.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Nonaktifkan Promo"
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

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-950">
                {editingPromo ? "Edit Promo & Voucher" : "Buat Promo & Voucher Baru"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Kode Promo</label>
                  <input
                    type="text"
                    required
                    placeholder="CONTOH: LEBARAN2026"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-sm uppercase border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nama Promo</label>
                  <input
                    type="text"
                    required
                    placeholder="Diskon Lebaran"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Deskripsi (Opsional)</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan singkat promo..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Tipe Diskon</label>
                  <select
                    value={discountType}
                    onChange={(e: any) => setDiscountType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="percentage">Persentase (%)</option>
                    <option value="fixed">Nominal Tetap (Rp)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    {discountType === 'percentage' ? "Nilai Diskon (%)" : "Nominal Diskon (Rp)"}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Minimum Transaksi (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={minimumTransaction}
                    onChange={(e) => setMinimumTransaction(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                {discountType === 'percentage' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Maksimum Diskon (Rp)</label>
                    <input
                      type="number"
                      placeholder="Opsional"
                      value={maximumDiscount}
                      onChange={(e) => setMaximumDiscount(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Batas Penggunaan Total</label>
                  <input
                    type="number"
                    placeholder="Tanpa batas"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Batas Per Customer</label>
                  <input
                    type="number"
                    value={perCustomerUsageLimit}
                    onChange={(e) => setPerCustomerUsageLimit(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Mulai Berlaku</label>
                  <input
                    type="datetime-local"
                    required
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Berakhir Pada</label>
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
                  {submitting ? "Menyimpan..." : "Simpan Promo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
