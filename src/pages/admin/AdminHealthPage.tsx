import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { 
  Activity, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  HelpCircle,
  Clock,
  Database,
  Cloud,
  Zap,
  Globe,
  Server,
  Calendar,
  AlertOctagon
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { SystemHealthAggregation, ComponentHealth, HealthState } from "../../types/health";

const STATE_COLORS = {
  HEALTHY: "bg-green-50 text-green-700 border-green-200",
  DEGRADED: "bg-amber-50 text-amber-700 border-amber-200",
  UNHEALTHY: "bg-red-50 text-red-700 border-red-200",
  UNKNOWN: "bg-gray-50 text-gray-700 border-gray-200"
};

const STATE_ICONS = {
  HEALTHY: CheckCircle2,
  DEGRADED: AlertTriangle,
  UNHEALTHY: AlertOctagon,
  UNKNOWN: HelpCircle
};

const COMPONENT_ICONS: Record<string, any> = {
  application: Server,
  firestore: Database,
  queue_worker: Zap,
  provider_apigames: Globe,
  business_calendar: Calendar,
  default: Cloud
};

export default function AdminHealthPage() {
  const [health, setHealth] = useState<SystemHealthAggregation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      const res = await fetch(`/api/admin/health${isManual ? '?refresh=true' : ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setHealth(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch health data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!health) return null;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="ui-page-title text-gray-900 flex items-center gap-3">
            <Activity className="w-8 h-8 text-indigo-600" />
            System Health
          </h1>
          <p className="text-gray-500 mt-1">Status real-time infrastruktur dan layanan iStore.</p>
        </div>
        <button 
          onClick={() => fetchHealth(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Status
        </button>
      </div>

      {/* Overall Status Banner */}
      <div className={`p-6 rounded-3xl border-2 flex flex-col md:flex-row items-center gap-6 ${STATE_COLORS[health.overallState]}`}>
        <div className="p-4 bg-white/50 rounded-2xl">
          {React.createElement(STATE_ICONS[health.overallState], { className: "w-12 h-12" })}
        </div>
        <div className="text-center md:text-left">
          <div className="text-sm font-bold uppercase tracking-wider opacity-70">Overall System Status</div>
          <h2 className="text-3xl font-black mt-1 uppercase">{health.overallState}</h2>
          <p className="mt-2 text-sm font-medium">
            Terakhir diperiksa: {format(new Date(health.timestamp), "dd MMMM yyyy, HH:mm:ss", { locale: idLocale })}
          </p>
        </div>
      </div>

      {/* Component Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {health.components.map((component) => {
          const Icon = COMPONENT_ICONS[component.id] || COMPONENT_ICONS.default;
          const StateIcon = STATE_ICONS[component.state];
          
          return (
            <div key={component.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 flex-1">
                <div className="flex items-start justify-between">
                  <div className="p-3 bg-indigo-50 rounded-2xl">
                    <Icon className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${STATE_COLORS[component.state]}`}>
                    {component.state}
                  </div>
                </div>

                <h3 className="mt-4 text-lg font-bold text-gray-900">{component.name}</h3>
                
                {component.message && (
                  <p className="mt-2 text-sm text-gray-600 font-medium leading-relaxed">
                    {component.message}
                  </p>
                )}

                {component.latencyMs !== undefined && (
                  <div className="mt-4 flex items-center gap-2 text-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold">{component.latencyMs}ms Latency</span>
                  </div>
                )}

                {component.details && (
                  <div className="mt-4 pt-4 border-t border-gray-50 space-y-2">
                    {Object.entries(component.details).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-400 font-bold uppercase">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="text-gray-700 font-black">
                          {typeof value === 'boolean' ? (value ? 'YES' : 'NO') : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-50 flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase">
                  {component.isCritical ? 'Critical Dependency' : 'Optional Service'}
                </span>
                <StateIcon className={`w-4 h-4 ${component.state === 'HEALTHY' ? 'text-green-500' : component.state === 'DEGRADED' ? 'text-amber-500' : 'text-red-500'}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
