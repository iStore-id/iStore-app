import { useState, useEffect } from "react";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldAlert,
  Search,
  ChevronRight,
  ExternalLink,
  Filter,
  BarChart3,
  TrendingUp,
  Activity
} from "lucide-react";
import { OrderSLA, SLAPolicy, SLAStatus, SLAResource } from "../../../types/core";

interface SLAMonitorProps {
  policies: SLAPolicy[];
}

export default function SLAMonitor({ policies }: SLAMonitorProps) {
  const [monitorData, setMonitorData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const fetchMonitorData = async () => {
    try {
      setLoading(true);
      const url = new URL("/api/admin/sla/monitor", window.location.origin);
      if (statusFilter) url.searchParams.append("status", statusFilter);
      
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('istore_session')}` }
      });
      const result = await res.json();
      if (result.success) {
        setMonitorData(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch monitor data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitorData();
    const interval = setInterval(fetchMonitorData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [statusFilter]);

  const filteredData = monitorData.filter(item => 
    item.orderInvoice?.toLowerCase().includes(search.toLowerCase()) ||
    item.productName?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusConfig = (status: SLAStatus) => {
    switch (status) {
      case 'COMPLETED': return { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100', label: 'Completed' };
      case 'WARNING': return { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100', label: 'Warning' };
      case 'BREACHED': return { icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100', label: 'Breached' };
      case 'RUNNING': return { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100', label: 'Running' };
      default: return { icon: Activity, color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-100', label: 'N/A' };
    }
  };

  const formatElapsedTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  // Calculate summary stats
  const stats = {
    total: monitorData.length,
    breached: monitorData.filter(d => d.overallStatus === 'BREACHED').length,
    warning: monitorData.filter(d => d.overallStatus === 'WARNING').length,
    healthy: monitorData.filter(d => d.overallStatus === 'COMPLETED' || d.overallStatus === 'RUNNING').length,
  };

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Pesanan', value: stats.total, color: 'blue', icon: BarChart3 },
          { label: 'SLA Breached', value: stats.breached, color: 'red', icon: ShieldAlert },
          { label: 'Warning Status', value: stats.warning, color: 'amber', icon: AlertTriangle },
          { label: 'On Track', value: stats.healthy, color: 'emerald', icon: TrendingUp },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-xl bg-${stat.color}-50 text-${stat.color}-600`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <span className={`text-xs font-bold text-${stat.color}-600 bg-${stat.color}-50 px-2 py-0.5 rounded-full`}>Live</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
            <p className="text-sm font-medium text-slate-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Cari Invoice atau Produk..."
            className="w-full pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select 
            className="px-6 py-3 bg-white border border-slate-200 rounded-2xl font-semibold text-slate-700 outline-none focus:border-blue-500 transition-all appearance-none"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">Semua Status</option>
            <option value="BREACHED">Breached</option>
            <option value="WARNING">Warning</option>
            <option value="RUNNING">Running</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <button 
            onClick={fetchMonitorData}
            className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all"
          >
            <Filter className="w-5 h-5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Monitor List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Order & Product</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Payment SLA</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Fulfillment SLA</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Overall Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                      <p className="text-slate-500 font-medium tracking-tight">Memuat Monitor SLA...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                    Tidak ada data yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredData.map((orderSla) => (
                  <tr key={orderSla.orderId} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">#{orderSla.orderInvoice}</p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{orderSla.productName}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                orderSla.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500'
                            }`}>{orderSla.paymentStatus}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                orderSla.transactionStatus === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                                orderSla.transactionStatus === 'processing' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-100 text-slate-500'
                            }`}>{orderSla.transactionStatus}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <SLAMeasurementCell measurement={orderSla.measurements.PAYMENT} />
                    </td>
                    <td className="px-6 py-4">
                      <SLAMeasurementCell measurement={orderSla.measurements.FULFILLMENT} />
                    </td>
                    <td className="px-6 py-4">
                      <SLAOverallStatus status={orderSla.overallStatus} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        onClick={() => window.open(`/admin/orders/${orderSla.orderId}`, '_blank')}
                      >
                        <ExternalLink className="w-4.5 h-4.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SLAMeasurementCell({ measurement }: { measurement: any }) {
  if (!measurement || measurement.status === 'EXCLUDED') return <span className="text-slate-300 text-xs font-medium">-</span>;
  if (measurement.status === 'NOT_STARTED') return <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Not Started</span>;

  const isBreached = measurement.status === 'BREACHED';
  const isWarning = measurement.status === 'WARNING';
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-bold ${
            isBreached ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-700'
        }`}>{formatDuration(measurement.elapsedTime)}</span>
        <span className="text-[10px] text-slate-400 font-medium italic">Target: {formatDuration(measurement.targetTime)}</span>
      </div>
      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 ${
            isBreached ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-blue-500'
          }`}
          style={{ width: `${Math.min(100, (measurement.elapsedTime / measurement.criticalTime) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function SLAOverallStatus({ status }: { status: SLAStatus }) {
  const config = getStatusConfig(status);
  const Icon = config.icon;
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${config.bg} ${config.color} ${config.border}`}>
      <Icon className="w-3.5 h-3.5" />
      <span className="text-[10px] font-bold uppercase tracking-wider">{config.label}</span>
    </div>
  );
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}j ${Math.floor((seconds % 3600) / 60)}m`;
}

function getStatusConfig(status: SLAStatus) {
    switch (status) {
      case 'COMPLETED': return { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100', label: 'Completed' };
      case 'WARNING': return { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100', label: 'Warning' };
      case 'BREACHED': return { icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100', label: 'Breached' };
      case 'RUNNING': return { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100', label: 'Running' };
      default: return { icon: Activity, color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-100', label: 'N/A' };
    }
}
