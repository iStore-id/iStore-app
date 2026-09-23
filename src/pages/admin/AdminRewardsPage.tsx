import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../store/auth-store";
import { Gift, Plus, Search, CheckCircle2, XCircle, AlertCircle, Edit3, Trash2, Tag, Layers, Users } from "lucide-react";

interface RewardItem {
  id: string;
  name: string;
  description: string;
  image?: string;
  pointsCost: number;
  status: 'active' | 'inactive';
  quota?: number | null;
  remainingQuota?: number | null;
  perCustomerLimit?: number | null;
  rewardType: 'voucher' | 'item' | 'benefit';
  voucherCode?: string;
}

interface Redemption {
  id: string;
  rewardId: string;
  rewardName: string;
  customerId: string;
  pointsCost: number;
  rewardType: string;
  voucherCode?: string;
  status: string;
  createdAt: string;
}

export default function AdminRewardsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'rewards' | 'redemptions'>('rewards');
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<RewardItem | null>(null);

  // Form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [pointsCost, setPointsCost] = useState<number>(100);
  const [rewardType, setRewardType] = useState<'voucher' | 'item' | 'benefit'>('voucher');
  const [voucherCode, setVoucherCode] = useState("");
  const [quota, setQuota] = useState<string>("");
  const [perCustomerLimit, setPerCustomerLimit] = useState<string>("1");
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    try {
      const token = await (user as any).getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [rewRes, redRes] = await Promise.all([
        fetch("/api/admin/rewards", { headers }),
        fetch("/api/admin/reward-redemptions", { headers })
      ]);

      const rewData = await rewRes.json();
      const redData = await redRes.json();

      if (rewData.success) setRewards(rewData.data || []);
      if (redData.success) setRedemptions(redData.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingReward(null);
    setName("");
    setDescription("");
    setImage("");
    setPointsCost(100);
    setRewardType("voucher");
    setVoucherCode("");
    setQuota("");
    setPerCustomerLimit("1");
    setStatus("active");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rew: RewardItem) => {
    setEditingReward(rew);
    setName(rew.name);
    setDescription(rew.description);
    setImage(rew.image || "");
    setPointsCost(rew.pointsCost);
    setRewardType(rew.rewardType);
    setVoucherCode(rew.voucherCode || "");
    setQuota(rew.quota !== null && rew.quota !== undefined ? rew.quota.toString() : "");
    setPerCustomerLimit(rew.perCustomerLimit !== null && rew.perCustomerLimit !== undefined ? rew.perCustomerLimit.toString() : "1");
    setStatus(rew.status);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = await (user as any).getIdToken();
      const payload = {
        name,
        description,
        image,
        pointsCost: Number(pointsCost),
        rewardType,
        voucherCode: rewardType === 'voucher' ? voucherCode : undefined,
        quota: quota ? Number(quota) : null,
        perCustomerLimit: perCustomerLimit ? Number(perCustomerLimit) : null,
        status
      };

      const url = editingReward ? `/api/admin/rewards/${editingReward.id}` : "/api/admin/rewards";
      const method = editingReward ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMsg(editingReward ? "Reward berhasil diperbarui." : "Reward berhasil dibuat.");
        setIsModalOpen(false);
        fetchData();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || "Gagal menyimpan reward");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (!confirm("Apakah Anda yakin ingin menonaktifkan reward ini?")) return;
    try {
      const token = await (user as any).getIdToken();
      const res = await fetch(`/api/admin/rewards/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Reward berhasil dinonaktifkan.");
        fetchData();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || "Gagal menonaktifkan reward");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Reward & Penukaran Management</h1>
          <p className="text-sm text-gray-500">Kelola katalog reward poin dan pantau riwayat penukaran pelanggan.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Buat Reward Baru
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

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('rewards')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition ${
            activeTab === 'rewards'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Katalog Reward ({rewards.length})
        </button>
        <button
          onClick={() => setActiveTab('redemptions')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition ${
            activeTab === 'redemptions'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Riwayat Penukaran ({redemptions.length})
        </button>
      </div>

      {activeTab === 'rewards' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Memuat reward...</div>
          ) : rewards.length === 0 ? (
            <div className="p-12 text-center text-gray-500">Belum ada reward yang dibuat.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Nama Reward</th>
                    <th className="py-3 px-4">Tipe</th>
                    <th className="py-3 px-4">Biaya Poin</th>
                    <th className="py-3 px-4">Kuota Tersisa</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {rewards.map((rew) => (
                    <tr key={rew.id} className="hover:bg-gray-50 transition">
                      <td className="py-4 px-4 font-semibold text-gray-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                          <Gift className="w-5 h-5" />
                        </div>
                        <div>
                          <div>{rew.name}</div>
                          <div className="text-xs text-gray-500 font-normal line-clamp-1">{rew.description}</div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 uppercase">
                          {rew.rewardType}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-bold text-indigo-600">{rew.pointsCost} Poin</td>
                      <td className="py-4 px-4 text-gray-700">
                        {rew.remainingQuota !== null && rew.remainingQuota !== undefined ? `${rew.remainingQuota} / ${rew.quota}` : "Tanpa Kuota"}
                      </td>
                      <td className="py-4 px-4">
                        {rew.status === 'active' ? (
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
                          onClick={() => handleOpenEdit(rew)}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(rew.id)}
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
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {redemptions.length === 0 ? (
            <div className="p-12 text-center text-gray-500">Belum ada riwayat penukaran reward.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Customer UID</th>
                    <th className="py-3 px-4">Reward</th>
                    <th className="py-3 px-4">Poin Terpotong</th>
                    <th className="py-3 px-4">Kode Voucher / Detail</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {redemptions.map((red) => (
                    <tr key={red.id} className="hover:bg-gray-50 transition">
                      <td className="py-4 px-4 text-xs text-gray-500">{new Date(red.createdAt).toLocaleString()}</td>
                      <td className="py-4 px-4 font-mono text-xs text-gray-700">{red.customerId}</td>
                      <td className="py-4 px-4 font-semibold text-gray-900">{red.rewardName}</td>
                      <td className="py-4 px-4 font-bold text-red-600">-{red.pointsCost} Poin</td>
                      <td className="py-4 px-4 font-mono text-xs text-indigo-600">{red.voucherCode || "-"}</td>
                      <td className="py-4 px-4">
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                          {red.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-950">
                {editingReward ? "Edit Reward" : "Buat Reward Baru"}
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
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nama Reward</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Voucher Diskon Rp 50.000"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Deskripsi</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Deskripsi penukaran reward"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Biaya Poin</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={pointsCost}
                    onChange={(e) => setPointsCost(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Tipe Reward</label>
                  <select
                    value={rewardType}
                    onChange={(e: any) => setRewardType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="voucher">Voucher</option>
                    <option value="item">Item Digital</option>
                    <option value="benefit">Benefit Khusus</option>
                  </select>
                </div>
              </div>

              {rewardType === 'voucher' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Kode Voucher / Promo</label>
                  <input
                    type="text"
                    placeholder="Contoh: DISKON50K"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Total Kuota (Opsional)</label>
                  <input
                    type="number"
                    placeholder="Tanpa kuota"
                    value={quota}
                    onChange={(e) => setQuota(e.target.value)}
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
                  {submitting ? "Menyimpan..." : "Simpan Reward"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
