import { useState, useEffect } from "react";
import { 
  Activity, 
  Settings, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldAlert,
  Plus,
  RefreshCcw,
  BarChart3,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SLAPolicy, OrderSLA, SLAStatus } from "../../types/core";
import SLAPolicyList from "../../components/admin/sla/SLAPolicyList";
import SLAMonitor from "../../components/admin/sla/SLAMonitor";
import SLAPolicyDialog from "../../components/admin/sla/SLAPolicyDialog";

export default function SLAPage() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'policies'>('monitor');
  const [policies, setPolicies] = useState<SLAPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<SLAPolicy | undefined>();

  const fetchPolicies = async () => {
    try {
      const res = await fetch("/api/admin/sla/policies", {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('istore_session')}` }
      });
      const result = await res.json();
      if (result.success) {
        setPolicies(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch policies", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleCreatePolicy = () => {
    setSelectedPolicy(undefined);
    setIsDialogOpen(true);
  };

  const handleEditPolicy = (policy: SLAPolicy) => {
    setSelectedPolicy(policy);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
              <Activity className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Service Level Agreement</h1>
          </div>
          <p className="text-slate-500 max-w-2xl">
            Pantau dan kelola kebijakan SLA operasional untuk memastikan kualitas layanan pengiriman produk digital tetap dalam target.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchPolicies}
            className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-slate-200 bg-white"
            title="Refresh Data"
          >
            <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {activeTab === 'policies' && (
            <button 
              onClick={handleCreatePolicy}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              Buat Policy Baru
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-200/50 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('monitor')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all ${
            activeTab === 'monitor'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <BarChart3 className="w-4.5 h-4.5" />
          Real-time Monitor
        </button>
        <button
          onClick={() => setActiveTab('policies')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all ${
            activeTab === 'policies'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Settings className="w-4.5 h-4.5" />
          SLA Policies
        </button>
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === 'monitor' ? (
          <SLAMonitor policies={policies} />
        ) : (
          <SLAPolicyList 
            policies={policies} 
            loading={loading} 
            onEdit={handleEditPolicy}
            onRefresh={fetchPolicies}
          />
        )}
      </motion.div>

      <SLAPolicyDialog 
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        policy={selectedPolicy}
        onSaved={fetchPolicies}
      />
    </div>
  );
}
