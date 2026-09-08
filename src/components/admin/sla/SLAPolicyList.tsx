import { 
  Settings, 
  Trash2, 
  Edit3, 
  ToggleLeft, 
  ToggleRight,
  Clock,
  AlertCircle,
  ShieldAlert,
  ChevronRight,
  Plus
} from "lucide-react";
import { SLAPolicy } from "../../../types/core";

interface SLAPolicyListProps {
  policies: SLAPolicy[];
  loading: boolean;
  onEdit: (policy: SLAPolicy) => void;
  onRefresh: () => void;
}

export default function SLAPolicyList({ policies, loading, onEdit, onRefresh }: SLAPolicyListProps) {
  const togglePolicy = async (policy: SLAPolicy) => {
    try {
      const res = await fetch(`/api/admin/sla/policies/${policy.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('istore_session')}` 
        },
        body: JSON.stringify({ enabled: !policy.enabled })
      });
      if (res.ok) onRefresh();
    } catch (err) {
      console.error("Failed to toggle policy", err);
    }
  };

  const deletePolicy = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus policy SLA ini?")) return;
    try {
      const res = await fetch(`/api/admin/sla/policies/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('istore_session')}` }
      });
      if (res.ok) onRefresh();
    } catch (err) {
      console.error("Failed to delete policy", err);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Memuat Kebijakan SLA...</p>
      </div>
    );
  }

  if (policies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-dashed border-slate-300">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
          <Settings className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-800">Belum ada Kebijakan SLA</h3>
        <p className="text-slate-500 mb-6 max-w-sm text-center">
          Buat kebijakan SLA pertama Anda untuk mulai memantau performa operasional.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {policies.map((policy) => (
        <div 
          key={policy.id} 
          className={`group bg-white rounded-3xl border transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/60 flex flex-col ${
            policy.enabled ? 'border-slate-200' : 'border-slate-100 opacity-75 grayscale-[0.5]'
          }`}
        >
          <div className="p-6 flex-1">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${
                  policy.resource === 'PAYMENT' ? 'bg-emerald-50 text-emerald-600' :
                  policy.resource === 'FULFILLMENT' ? 'bg-blue-50 text-blue-600' :
                  policy.resource === 'PROVIDER' ? 'bg-amber-50 text-amber-600' :
                  'bg-purple-50 text-purple-600'
                }`}>
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{policy.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{policy.resource}</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    <span className="text-xs text-slate-500 font-medium">Priority: {policy.priority}</span>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => togglePolicy(policy)}
                className={`p-1.5 rounded-lg transition-all ${
                  policy.enabled ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-300 hover:bg-slate-100'
                }`}
              >
                {policy.enabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Target</p>
                <p className="text-sm font-bold text-slate-800">{formatDuration(policy.targetDuration)}</p>
              </div>
              <div className="p-3 bg-amber-50/50 rounded-2xl border border-amber-100">
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">Warning</p>
                <p className="text-sm font-bold text-amber-700">{formatDuration(policy.warningThreshold)}</p>
              </div>
              <div className="p-3 bg-red-50/50 rounded-2xl border border-red-100">
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">Critical</p>
                <p className="text-sm font-bold text-red-700">{formatDuration(policy.criticalThreshold)}</p>
              </div>
            </div>

            {policy.scope && (Object.values(policy.scope).some(v => v && v.length > 0)) && (
              <div className="flex flex-wrap gap-2 mt-2">
                {policy.scope.providerIds?.map(p => (
                  <span key={p} className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md border border-slate-200">PROVIDER: {p}</span>
                ))}
                {policy.scope.gameIds?.map(g => (
                  <span key={g} className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-md border border-blue-100">GAME: {g}</span>
                ))}
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between rounded-b-3xl">
            <span className="text-xs text-slate-400 font-medium italic">
              Terakhir diubah: {new Date(policy.updatedAt).toLocaleDateString()}
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onEdit(policy)}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200 shadow-sm"
                title="Edit Policy"
              >
                <Edit3 className="w-4.5 h-4.5" />
              </button>
              <button 
                onClick={() => deletePolicy(policy.id!)}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200 shadow-sm"
                title="Hapus Policy"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
