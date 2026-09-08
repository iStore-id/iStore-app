import React, { useState, useEffect } from "react";
import { 
  Users, 
  Crown, 
  Plus, 
  Search, 
  MoreVertical, 
  Edit, 
  Pause, 
  Play, 
  XCircle, 
  ShieldCheck, 
  Calendar,
  AlertCircle,
  TrendingUp,
  CreditCard,
  History,
  FileDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuthStore } from "../../store/auth-store";
import { MembershipPlan, CustomerMembership, MembershipStats } from "../../types/membership";

export default function AdminMembershipPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'plans' | 'members' | 'audit'>('overview');
  const [stats, setStats] = useState<MembershipStats | null>(null);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [members, setMembers] = useState<CustomerMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modals state
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [targetUserUid, setTargetUserUid] = useState("");

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = await user?.getIdToken();
      const headers = { 'Authorization': `Bearer ${token}` };

      if (activeTab === 'overview') {
        const res = await fetch('/api/admin/membership/stats', { headers });
        const data = await res.json();
        setStats(data);
      } else if (activeTab === 'plans') {
        const res = await fetch('/api/admin/membership/plans', { headers });
        const data = await res.json();
        setPlans(data);
      } else if (activeTab === 'members') {
        const res = await fetch('/api/admin/membership/members', { headers });
        const data = await res.json();
        setMembers(data);
      }
    } catch (error) {
      console.error("Failed to fetch membership data", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const planData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      tierLevel: parseInt(formData.get('tierLevel') as string),
      price: parseFloat(formData.get('price') as string),
      durationDays: parseInt(formData.get('durationDays') as string),
      pointMultiplier: parseFloat(formData.get('pointMultiplier') as string),
      discountRate: parseFloat(formData.get('discountRate') as string),
      accessTags: (formData.get('accessTags') as string).split(',').map(t => t.trim()).filter(Boolean),
      status: formData.get('status') as 'ACTIVE' | 'INACTIVE'
    };

    try {
      const token = await user?.getIdToken();
      const url = editingPlan ? `/api/admin/membership/plans/${editingPlan.id}` : '/api/admin/membership/plans';
      const method = editingPlan ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(planData)
      });

      if (res.ok) {
        setIsPlanModalOpen(false);
        setEditingPlan(null);
        fetchData();
      }
    } catch (error) {
      console.error("Failed to save plan", error);
    }
  };

  const handleMemberAction = async (uid: string, action: 'suspend' | 'resume' | 'cancel', reason: string = "Manual action") => {
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/membership/members/${uid}/${action}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error(`Failed to ${action} membership`, error);
    }
  };

  const handleManualAssign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      planId: formData.get('planId') as string,
      reason: formData.get('reason') as string
    };

    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/membership/members/${targetUserUid}/assign`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        setIsAssignModalOpen(false);
        setTargetUserUid("");
        fetchData();
      }
    } catch (error) {
      console.error("Failed to assign membership", error);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Crown className="w-8 h-8 text-amber-500" />
            Membership Management
          </h1>
          <p className="text-gray-500 mt-1">Kelola program keanggotaan VIP, tier, dan benefit pelanggan.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => { setEditingPlan(null); setIsPlanModalOpen(true); }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tambah Plan
          </button>
          <button 
            onClick={() => fetchData()}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <History className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'Overview', icon: TrendingUp },
          { id: 'plans', label: 'Membership Plans', icon: Crown },
          { id: 'members', label: 'Members', icon: Users },
          { id: 'audit', label: 'Audit Log', icon: ShieldCheck },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-4 border-b-2 font-medium text-sm transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Section */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <p>Memuat data...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'overview' && stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard 
                    label="Member Aktif" 
                    value={stats.totalActive} 
                    icon={Users} 
                    color="text-indigo-600" 
                    bg="bg-indigo-50"
                  />
                  <StatCard 
                    label="Segera Expired" 
                    value={stats.expiringSoon} 
                    icon={AlertCircle} 
                    color="text-amber-600" 
                    bg="bg-amber-50"
                  />
                  <StatCard 
                    label="Total Expired" 
                    value={stats.totalExpired} 
                    icon={XCircle} 
                    color="text-red-600" 
                    bg="bg-red-50"
                  />
                  <StatCard 
                    label="Suspended" 
                    value={stats.totalSuspended} 
                    icon={Pause} 
                    color="text-gray-600" 
                    bg="bg-gray-50"
                  />
                </div>
              )}

              {activeTab === 'plans' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {plans.map(plan => (
                    <div key={plan.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            plan.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {plan.status}
                          </div>
                          <button 
                            onClick={() => { setEditingPlan(plan); setIsPlanModalOpen(true); }}
                            className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                        <p className="text-gray-500 text-sm mb-4 line-clamp-2">{plan.description || "No description"}</p>
                        
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Tier Level</span>
                            <span className="font-bold text-gray-700">Lvl {plan.tierLevel}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Harga</span>
                            <span className="font-bold text-indigo-600">Rp {plan.price.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Durasi</span>
                            <span className="font-medium text-gray-700">{plan.durationDays} Hari</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Point Multiplier</span>
                            <span className="font-medium text-amber-600">{plan.pointMultiplier}x</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Discount Rate</span>
                            <span className="font-medium text-green-600">{plan.discountRate}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gray-50 px-6 py-4 flex flex-wrap gap-2">
                        {plan.accessTags.length > 0 ? plan.accessTags.map(tag => (
                          <span key={tag} className="text-[10px] bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded uppercase font-bold tracking-tighter">
                            {tag}
                          </span>
                        )) : <span className="text-[10px] text-gray-300 italic">No access tags</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'members' && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder="Cari UID, Order ID..." 
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <button 
                      onClick={() => setIsAssignModalOpen(true)}
                      className="text-sm font-medium text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors border border-indigo-100"
                    >
                      Assign Manual
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4">Pelanggan</th>
                          <th className="px-6 py-4">Plan</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Expiry</th>
                          <th className="px-6 py-4">Source</th>
                          <th className="px-6 py-4 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm divide-y divide-gray-100 text-gray-600">
                        {members.filter(m => m.userId.includes(searchTerm) || m.orderId?.includes(searchTerm)).map(m => (
                          <tr key={m.userId} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-mono text-xs text-gray-900 truncate w-24">{m.userId}</div>
                              <div className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-tighter">UID</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-gray-900">{m.metadata?.planName || m.planId}</div>
                              <div className="text-[10px] text-gray-400 uppercase tracking-tighter">Lvl {m.metadata?.tierLevel}</div>
                            </td>
                            <td className="px-6 py-4">
                              <StatusBadge status={m.status} />
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3 h-3 text-gray-400" />
                                <span>{m.expiryDate ? new Date(m.expiryDate).toLocaleDateString() : '∞'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-medium">{m.source}</span>
                                {m.orderId && <span className="text-[10px] text-gray-400 font-mono">#{m.orderId.substring(0, 8)}</span>}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-1">
                                {m.status === 'ACTIVE' && (
                                  <button 
                                    onClick={() => handleMemberAction(m.userId, 'suspend')}
                                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded"
                                    title="Suspend"
                                  >
                                    <Pause className="w-4 h-4" />
                                  </button>
                                )}
                                {m.status === 'SUSPENDED' && (
                                  <button 
                                    onClick={() => handleMemberAction(m.userId, 'resume')}
                                    className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                                    title="Resume"
                                  >
                                    <Play className="w-4 h-4" />
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleMemberAction(m.userId, 'cancel')}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                  title="Cancel"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {members.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-6 py-20 text-center text-gray-400">
                              Belum ada anggota yang terdaftar.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'audit' && (
                <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
                  <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Audit log terintegrasi dengan Central Audit Logs.</p>
                  <button className="mt-4 text-indigo-600 font-medium text-sm hover:underline">
                    Lihat di Central Audit Log
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Plan Modal */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">{editingPlan ? 'Edit' : 'Tambah'} Membership Plan</h2>
              <button onClick={() => setIsPlanModalOpen(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handlePlanSubmit} className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nama Plan</label>
                  <input name="name" required defaultValue={editingPlan?.name} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="VIP Silver" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Tier Level</label>
                  <input name="tierLevel" type="number" required defaultValue={editingPlan?.tierLevel || 1} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Deskripsi</label>
                  <textarea name="description" defaultValue={editingPlan?.description} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]" placeholder="Benefit detail..." />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Harga (Rp)</label>
                  <input name="price" type="number" required defaultValue={editingPlan?.price || 0} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Durasi (Hari)</label>
                  <input name="durationDays" type="number" required defaultValue={editingPlan?.durationDays || 30} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Point Multiplier</label>
                  <input name="pointMultiplier" type="number" step="0.1" required defaultValue={editingPlan?.pointMultiplier || 1} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Discount Rate (%)</label>
                  <input name="discountRate" type="number" required defaultValue={editingPlan?.discountRate || 0} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Access Tags (Comma separated)</label>
                  <input name="accessTags" defaultValue={editingPlan?.accessTags?.join(', ')} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="EXCLUSIVE, VIP_ONLY" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Status</label>
                  <select name="status" defaultValue={editingPlan?.status || 'ACTIVE'} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>
              <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setIsPlanModalOpen(false)} className="px-6 py-2 rounded-lg text-gray-500 font-medium hover:bg-gray-100 transition-colors">Batal</button>
                <button type="submit" className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors">Simpan Plan</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Manual Assign Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Assign Membership</h2>
              <button onClick={() => setIsAssignModalOpen(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleManualAssign} className="p-6 space-y-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Customer UID</label>
                <input 
                  required 
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm" 
                  value={targetUserUid}
                  onChange={(e) => setTargetUserUid(e.target.value)}
                  placeholder="Paste user UID here..." 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Pilih Plan</label>
                <select name="planId" required className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                  <option value="">-- Pilih Plan --</option>
                  {plans.filter(p => p.status === 'ACTIVE').map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Lvl {p.tierLevel})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Alasan</label>
                <textarea name="reason" required className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]" placeholder="Contoh: Reward event khusus" />
              </div>
              <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setIsAssignModalOpen(false)} className="px-6 py-2 rounded-lg text-gray-500 font-medium hover:bg-gray-100 transition-colors">Batal</button>
                <button type="submit" className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors">Assign Sekarang</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`${bg} ${color} p-3 rounded-lg`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: any = {
    ACTIVE: 'bg-green-100 text-green-700',
    PENDING: 'bg-amber-100 text-amber-700',
    EXPIRED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-600',
    SUSPENDED: 'bg-purple-100 text-purple-700'
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status] || styles.CANCELLED}`}>
      {status}
    </span>
  );
}
