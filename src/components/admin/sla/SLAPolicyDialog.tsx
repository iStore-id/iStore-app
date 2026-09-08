import { useState, useEffect, FormEvent } from "react";
import { 
  X, 
  Save, 
  AlertCircle,
  Clock,
  Target,
  AlertTriangle,
  ShieldAlert,
  HelpCircle
} from "lucide-react";
import { SLAPolicy, SLAResource } from "../../../types/core";

interface SLAPolicyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  policy?: SLAPolicy;
  onSaved: () => void;
}

export default function SLAPolicyDialog({ isOpen, onClose, policy, onSaved }: SLAPolicyDialogProps) {
  const [formData, setFormData] = useState<Partial<SLAPolicy>>({
    name: "",
    resource: "ORDER_TOTAL",
    targetDuration: 300,
    warningThreshold: 600,
    criticalThreshold: 1800,
    priority: 0,
    enabled: true,
    scope: {
        providerIds: [],
        gameIds: [],
        productIds: []
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (policy) {
      setFormData(policy);
    } else {
      setFormData({
        name: "",
        resource: "ORDER_TOTAL",
        targetDuration: 300,
        warningThreshold: 600,
        criticalThreshold: 1800,
        priority: 0,
        enabled: true,
        scope: { providerIds: [], gameIds: [], productIds: [] }
      });
    }
  }, [policy, isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url = policy ? `/api/admin/sla/policies/${policy.id}` : "/api/admin/sla/policies";
      const method = policy ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionStorage.getItem('istore_session')}`
        },
        body: JSON.stringify(formData)
      });
      
      const result = await res.json();
      if (result.success) {
        onSaved();
        onClose();
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{policy ? 'Edit Kebijakan SLA' : 'Buat Kebijakan SLA Baru'}</h2>
            <p className="text-sm text-slate-500 mt-1">Konfigurasi target waktu dan ambang batas peringatan.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Nama Kebijakan</label>
              <input 
                required
                type="text"
                className="w-full px-5 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                placeholder="Contoh: Standard Digital Delivery SLA"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Segment Operasional</label>
              <select 
                className="w-full px-5 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none appearance-none bg-white"
                value={formData.resource}
                onChange={e => setFormData({...formData, resource: e.target.value as SLAResource})}
              >
                <option value="PAYMENT">Payment SLA (Created -&gt; Paid)</option>
                <option value="FULFILLMENT">Fulfillment SLA (Paid -&gt; Processing)</option>
                <option value="PROVIDER">Provider SLA (Processing -&gt; Completed)</option>
                <option value="ORDER_TOTAL">Total Order SLA (Created -&gt; Completed)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Prioritas (Priority)</label>
              <input 
                type="number"
                className="w-full px-5 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                value={formData.priority}
                onChange={e => setFormData({...formData, priority: parseInt(e.target.value)})}
              />
            </div>
          </div>

          <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900">Konfigurasi Ambang Batas (Seconds)</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-slate-400" />
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Target (SLA)</label>
                </div>
                <input 
                  type="number"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 transition-all outline-none font-mono text-sm"
                  value={formData.targetDuration}
                  onChange={e => setFormData({...formData, targetDuration: parseInt(e.target.value)})}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Warning</label>
                </div>
                <input 
                  type="number"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 transition-all outline-none font-mono text-sm"
                  value={formData.warningThreshold}
                  onChange={e => setFormData({...formData, warningThreshold: parseInt(e.target.value)})}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert className="w-4 h-4 text-red-500" />
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Critical</label>
                </div>
                <input 
                  type="number"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 transition-all outline-none font-mono text-sm"
                  value={formData.criticalThreshold}
                  onChange={e => setFormData({...formData, criticalThreshold: parseInt(e.target.value)})}
                />
              </div>
            </div>
            
            <p className="text-[10px] text-slate-400 mt-4 leading-relaxed flex items-center gap-1.5">
              <HelpCircle className="w-3 h-3" />
              Sistem akan menandai status <strong>WARNING</strong> jika waktu &gt;= Warning, dan <strong>BREACHED</strong> jika waktu &gt;= Critical.
            </p>
          </div>
        </form>

        <div className="px-8 py-6 border-t border-slate-100 flex items-center justify-end gap-4 bg-slate-50/50">
          <button 
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-slate-500 font-semibold hover:text-slate-700 transition-colors"
          >
            Batal
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98]"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Simpan Perubahan
          </button>
        </div>
      </div>
    </div>
  );
}
