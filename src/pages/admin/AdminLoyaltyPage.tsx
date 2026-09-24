import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../store/auth-store";
import { Award, Settings, Users, History, PlusCircle, CheckCircle2, AlertCircle, Save, DollarSign } from "lucide-react";

interface LoyaltyConfig {
  earnRateRp: number;
  redeemRateIdr: number;
  minRedeemPoints: number;
  maxRedeemPercent: number;
  enabled: boolean;
}

interface PointTransaction {
  id: string;
  customerId: string;
  type: 'EARN' | 'REDEEM' | 'REFUND_REVERSAL' | 'ADMIN_ADJUSTMENT';
  points: number;
  reference: string;
  orderId?: string;
  reason?: string;
  createdAt: string;
  createdBy: string;
}

export default function AdminLoyaltyPage() {
  const { user } = useAuthStore();
  const [config, setConfig] = useState<LoyaltyConfig>({
    earnRateRp: 10000,
    redeemRateIdr: 100,
    minRedeemPoints: 10,
    maxRedeemPercent: 50,
    enabled: true
  });
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Adjustment Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adjCustomerId, setAdjCustomerId] = useState("");
  const [adjPoints, setAdjPoints] = useState<number>(0);
  const [adjReason, setAdjReason] = useState("");
  const [submittingAdj, setSubmittingAdj] = useState(false);

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

      const [cfgRes, txRes] = await Promise.all([
        fetch("/api/admin/loyalty/config", { headers }),
        fetch("/api/admin/loyalty/transactions", { headers })
      ]);

      const cfgData = await cfgRes.json();
      const txData = await txRes.json();

      if (cfgData.success) setConfig(cfgData.data);
      if (txData.success) setTransactions(txData.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingConfig(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = await (user as any).getIdToken();
      const res = await fetch("/api/admin/loyalty/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
        setSuccessMsg("Konfigurasi loyalty berhasil disimpan.");
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || "Gagal menyimpan konfigurasi");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleOpenAdjust = () => {
    setAdjCustomerId("");
    setAdjPoints(0);
    setAdjReason("");
    setIsModalOpen(true);
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmittingAdj(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = await (user as any).getIdToken();
      const res = await fetch("/api/admin/loyalty/adjust", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          customerId: adjCustomerId,
          points: Number(adjPoints),
          reason: adjReason
        })
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMsg("Adjustment poin berhasil dilakukan.");
        setIsModalOpen(false);
        fetchData();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || "Gagal melakukan adjustment poin");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingAdj(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="ui-page-title text-gray-900">Poin & Loyalty Management</h1>
          <p className="text-sm text-gray-500">Kelola aturan earning, penukaran poin, dan riwayat transaksi poin pelanggan.</p>
        </div>
        <button
          onClick={handleOpenAdjust}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4" />
          Adjustment Poin Manual
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

      {/* Config Form */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600" />
          Konfigurasi Aturan Loyalitas
        </h2>

        <form onSubmit={handleSaveConfig} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Status Loyalty</label>
            <select
              value={config.enabled ? "true" : "false"}
              onChange={(e) => setConfig({ ...config, enabled: e.target.value === "true" })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Rasio Belanja per 1 Poin (Rp)</label>
            <input
              type="number"
              min={1}
              value={config.earnRateRp}
              onChange={(e) => setConfig({ ...config, earnRateRp: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">Contoh: 10000 = Rp 10.000 belanja mendapat 1 poin</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nilai Tukar 1 Poin (Rp Diskon)</label>
            <input
              type="number"
              min={1}
              value={config.redeemRateIdr}
              onChange={(e) => setConfig({ ...config, redeemRateIdr: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">Contoh: 100 = 1 poin bernilai Rp 100</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Minimum Poin Penukaran</label>
            <input
              type="number"
              min={1}
              value={config.minRedeemPoints}
              onChange={(e) => setConfig({ ...config, minRedeemPoints: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Maksimum Diskon Poin (%)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={config.maxRedeemPercent}
              onChange={(e) => setConfig({ ...config, maxRedeemPercent: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={savingConfig}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingConfig ? "Menyimpan..." : "Simpan Konfigurasi"}
            </button>
          </div>
        </form>
      </div>

      {/* Transactions Ledger */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            Riwayat Transaksi Poin (Immutable Ledger)
          </h2>
          <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
            {transactions.length} Transaksi Terbaru
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">Memuat riwayat transaksi...</div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-gray-500">Belum ada transaksi poin.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Customer ID</th>
                  <th className="py-3 px-4">Tipe</th>
                  <th className="py-3 px-4">Poin</th>
                  <th className="py-3 px-4">Referensi / Alasan</th>
                  <th className="py-3 px-4">Aktor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition">
                    <td className="py-4 px-4 text-xs text-gray-500">{new Date(tx.createdAt).toLocaleString()}</td>
                    <td className="py-4 px-4 font-mono text-xs text-gray-700">{tx.customerId}</td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                        tx.type === 'EARN' ? 'bg-emerald-50 text-emerald-700' :
                        tx.type === 'REDEEM' ? 'bg-blue-50 text-blue-700' :
                        tx.type === 'REFUND_REVERSAL' ? 'bg-amber-50 text-amber-700' :
                        'bg-purple-50 text-purple-700'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className={`py-4 px-4 font-bold ${tx.points >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {tx.points >= 0 ? `+${tx.points}` : tx.points}
                    </td>
                    <td className="py-4 px-4 text-gray-600 text-xs">
                      <div>{tx.reason || tx.reference}</div>
                      {tx.orderId && <div className="font-mono text-gray-400">Order: {tx.orderId}</div>}
                    </td>
                    <td className="py-4 px-4 text-xs font-mono text-gray-500">{tx.createdBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Adjustment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-950">Adjustment Poin Manual</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdjustmentSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Customer UID</label>
                <input
                  type="text"
                  required
                  placeholder="Firebase Auth UID customer"
                  value={adjCustomerId}
                  onChange={(e) => setAdjCustomerId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Jumlah Poin (+ / -)</label>
                <input
                  type="number"
                  required
                  placeholder="Contoh: 100 atau -50"
                  value={adjPoints}
                  onChange={(e) => setAdjPoints(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Gunakan angka positif untuk menambah, negatif untuk mengurangi.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Alasan Adjustment (Audit Trail)</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Contoh: Kompensasi gangguan sistem"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
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
                  disabled={submittingAdj}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {submittingAdj ? "Memproses..." : "Kirim Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
