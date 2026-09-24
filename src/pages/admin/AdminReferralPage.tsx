import React, { useState, useEffect } from "react";
import { 
  Users, 
  Settings, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  UserPlus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ReferralConfig, 
  ReferralRelationship 
} from "../../types/referral";
import { useAuthStore } from "../../store/auth-store";

export default function AdminReferralPage() {
  const { user } = useAuthStore();
  const [config, setConfig] = useState<ReferralConfig | null>(null);
  const [relationships, setRelationships] = useState<ReferralRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'RELATIONSHIPS' | 'SETTINGS'>('OVERVIEW');
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("ALL");

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      
      const [configRes, relRes] = await Promise.all([
        fetch("/api/admin/referral/config", { headers }),
        fetch("/api/admin/referral/relationships", { headers })
      ]);
      const configJson = await configRes.json();
      const relJson = await relRes.json();
      
      if (configJson.success) setConfig(configJson.data);
      if (relJson.success) setRelationships(relJson.data);
    } catch (error) {
      console.error("Failed to fetch referral data", error);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (newConfig: ReferralConfig) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/referral/config", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ config: newConfig })
      });
      const json = await res.json();
      if (json.success) setConfig(json.data);
    } catch (error) {
      console.error("Failed to update config", error);
    }
  };

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const stats = {
    total: relationships.length,
    converted: relationships.filter(r => r.status === 'CONVERTED').length,
    pending: relationships.filter(r => r.status === 'PENDING').length,
    conversionRate: relationships.length > 0 ? (relationships.filter(r => r.status === 'CONVERTED').length / relationships.length * 100).toFixed(1) : 0
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="ui-page-title text-gray-900">Referral Engine</h1>
          <p className="text-gray-500">Manajemen program ajak teman dan reward atribusi.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchData}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto whitespace-nowrap scrollbar-hide">
        {[
          { id: 'OVERVIEW', label: 'Ringkasan', icon: TrendingUp },
          { id: 'RELATIONSHIPS', label: 'Hubungan & Atribusi', icon: Users },
          { id: 'SETTINGS', label: 'Konfigurasi Program', icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors shrink-0 ${
              activeTab === tab.id 
                ? "border-blue-600 text-blue-600" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <AnimatePresence mode="wait">
          {activeTab === 'OVERVIEW' && (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"
            >
              <StatCard title="Total Atribusi" value={stats.total} icon={UserPlus} color="blue" />
              <StatCard title="Berhasil Konversi" value={stats.converted} icon={CheckCircle2} color="green" />
              <StatCard title="Menunggu (Pending)" value={stats.pending} icon={ClockIcon} color="yellow" />
              <StatCard title="Tingkat Konversi" value={`${stats.conversionRate}%`} icon={ArrowUpRight} color="purple" />
            </motion.div>
          )}

          {activeTab === 'RELATIONSHIPS' && (
            <motion.div 
              key="relationships"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-xl border border-gray-200">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Cari UID atau kode..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <select 
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">Semua Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="CONVERTED">Converted</option>
                    <option value="EXPIRED">Expired</option>
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Referrer</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Referred Customer</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Reward</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Tanggal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {relationships
                        .filter(r => filter === 'ALL' || r.status === filter)
                        .filter(r => !search || r.referrerUid.includes(search) || r.referredUid.includes(search) || r.referralCode.includes(search))
                        .map((rel) => (
                        <tr key={rel.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900">{rel.referrerUid.substring(0, 8)}...</span>
                              <span className="text-xs text-gray-500 uppercase font-bold tracking-tight">{rel.referralCode}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-700">{rel.referredUid.substring(0, 8)}...</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={rel.status} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <RewardBadge status={rel.rewardStatus} type={rel.rewardType} />
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                            {new Date(rel.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'SETTINGS' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full lg:max-w-4xl space-y-8"
            >
              <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Status Program</h3>
                    <p className="text-sm text-gray-500">Aktifkan atau nonaktifkan seluruh mesin referral.</p>
                  </div>
                  <Switch 
                    checked={config?.enabled || false} 
                    onChange={(val) => config && updateConfig({ ...config, enabled: val })}
                  />
                </div>

                <div className="pt-6 border-t border-gray-100 space-y-4">
                  <h4 className="text-sm font-bold text-gray-900 uppercase">Hadiah Referrer (Ajak Teman)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase">Tipe Reward</label>
                      <select 
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none"
                        value={config?.referrerRewardType}
                        onChange={(e) => config && updateConfig({ ...config, referrerRewardType: e.target.value as any })}
                      >
                        <option value="NONE">Tidak Ada</option>
                        <option value="POINTS">Poin Loyalitas</option>
                        <option value="COMMISSION">Komisi Saldo (Affiliate)</option>
                        <option value="BOTH">Keduanya (Poin & Komisi)</option>
                      </select>
                    </div>
                    {(config?.referrerRewardType === 'POINTS' || config?.referrerRewardType === 'BOTH') && (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase">Jumlah Poin</label>
                        <input 
                          type="number" 
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none"
                          value={config?.referrerRewardPoints}
                          onChange={(e) => config && updateConfig({ ...config, referrerRewardPoints: Number(e.target.value) })}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 space-y-4">
                  <h4 className="text-sm font-bold text-gray-900 uppercase">Hadiah Referred (Teman Baru)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase">Tipe Reward</label>
                      <select 
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none"
                        value={config?.referredRewardType}
                        onChange={(e) => config && updateConfig({ ...config, referredRewardType: e.target.value as any })}
                      >
                        <option value="NONE">Tidak Ada</option>
                        <option value="POINTS">Poin Bonus Selamat Datang</option>
                      </select>
                    </div>
                    {config?.referredRewardType === 'POINTS' && (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase">Jumlah Poin</label>
                        <input 
                          type="number" 
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none"
                          value={config?.referredRewardPoints}
                          onChange={(e) => config && updateConfig({ ...config, referredRewardPoints: Number(e.target.value) })}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 space-y-4">
                  <h4 className="text-sm font-bold text-gray-900 uppercase">Aturan Kualifikasi</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase">Min. Belanja Transaksi Pertama (Rp)</label>
                      <input 
                        type="number" 
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none"
                        value={config?.minQualifyingOrderAmount}
                        onChange={(e) => config && updateConfig({ ...config, minQualifyingOrderAmount: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string, value: string | number, icon: any, color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-200 flex flex-col justify-between h-full space-y-3 md:space-y-4">
      <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg ${colors[color]} flex items-center justify-center shrink-0`}>
        <Icon className="w-4 h-4 md:w-5 md:h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] md:text-sm font-semibold text-gray-500 uppercase tracking-wider truncate">{title}</p>
        <p className="text-lg md:text-2xl font-bold text-gray-900 truncate" title={String(value)}>{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string, classes: string }> = {
    PENDING: { label: 'Pending', classes: 'bg-yellow-100 text-yellow-700' },
    CONVERTED: { label: 'Converted', classes: 'bg-green-100 text-green-700' },
    EXPIRED: { label: 'Expired', classes: 'bg-gray-100 text-gray-700' },
  };
  const v = variants[status] || { label: status, classes: 'bg-gray-100 text-gray-700' };
  return <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider whitespace-nowrap ${v.classes}`}>{v.label}</span>;
}

function RewardBadge({ status, type }: { status: string, type: string }) {
  if (status === 'PENDING') return <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded border border-amber-100">Menunggu...</span>;
  if (status === 'REVERSED') return <span className="text-xs text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded border border-rose-100">Dibatalkan</span>;
  
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-bold text-emerald-600">Diberikan</span>
      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{type}</span>
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean, onChange: (val: boolean) => void }) {
  return (
    <button 
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function ClockIcon(props: any) {
  return (
    <svg 
      {...props}
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
