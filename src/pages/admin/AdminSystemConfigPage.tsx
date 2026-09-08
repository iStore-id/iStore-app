import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Settings, Shield, ToggleLeft, CreditCard, Plug, 
  Bell, Lock, Globe, AlertTriangle, CheckCircle, 
  RefreshCw, Loader2, Info
} from 'lucide-react';
import { useAuthStore } from '../../store/auth-store';

interface SystemConfigOverview {
  store: 'configured' | 'incomplete';
  security: 'configured' | 'incomplete';
  featureFlags: 'configured' | 'incomplete';
  payment: 'configured' | 'incomplete';
  provider: 'configured' | 'incomplete';
  regional: 'configured' | 'incomplete';
  notification: 'configured' | 'incomplete';
  privacy: 'configured' | 'incomplete';
  details: {
    midtrans: boolean;
    tokovoucher: boolean;
    apigames: boolean;
  };
}

export function AdminSystemConfigPage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<SystemConfigOverview | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const { user } = useAuthStore();

  const fetchOverview = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      if (!user) throw new Error("Authentication required");
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch('/api/admin/system-config/overview', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch config overview');
      setOverview(data.data);
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [user]);

  if (loading && !overview) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const getConfigStatus = (status?: string) => {
    if (status === 'configured') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
          <CheckCircle className="h-3.5 w-3.5" />
          Configured
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
        <AlertTriangle className="h-3.5 w-3.5" />
        Needs Verification
      </span>
    );
  };

  const navItems = [
    { name: 'Store Profile', icon: Settings, route: '/admin/settings', status: overview?.store, desc: 'Toko, kontak & operasional' },
    { name: 'Security Policy', icon: Shield, route: '/admin/security', status: overview?.security, desc: 'Login & Data Protection' },
    { name: 'Feature Flags', icon: ToggleLeft, route: '/admin/feature-flags', status: overview?.featureFlags, desc: 'Toggle fitur platform' },
    { name: 'Integrations Hub', icon: Plug, route: '/admin/integrations', status: overview?.provider, desc: 'API Provider & Secret Manager' },
    { name: 'Payment Gateways', icon: CreditCard, route: '/admin/gateways', status: overview?.payment, desc: 'Midtrans & Metode Bayar' },
    { name: 'Regional & Currency', icon: Globe, route: '/admin/regional', status: overview?.regional, desc: 'Lokasi & Format mata uang' },
    { name: 'Notifications', icon: Bell, route: '/admin/notification-settings', status: overview?.notification, desc: 'Email, WA, & Template' },
    { name: 'Privacy Policy', icon: Lock, route: '/admin/privacy', status: overview?.privacy, desc: 'Kebijakan privasi platform' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Configuration</h1>
          <p className="text-sm text-slate-500 mt-1">System-wide Configuration Control Center.</p>
        </div>
        <button
          onClick={fetchOverview}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-600 font-medium">
          {errorMsg}
        </div>
      )}

      {/* System Variables Notice */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-semibold text-blue-900">Global System Variables</h3>
          <p className="text-sm text-blue-800 mt-1">
            There are currently no standalone global system variables required. 
            All active configurations are routed to their respective authoritative modules. 
            Secrets and credentials are securely managed server-side via the Secret Manager.
          </p>
        </div>
      </div>

      {/* Quick Navigation Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {navItems.map((item) => (
          <Link 
            key={item.route} 
            to={item.route}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-blue-300 relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                <item.icon className="h-5 w-5" />
              </div>
              {getConfigStatus(item.status)}
            </div>
            <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{item.name}</h3>
            <p className="text-xs text-slate-500 mt-1.5">{item.desc}</p>
          </Link>
        ))}
      </div>

      {/* Connectivity Deep Dive */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/50 p-5">
          <h2 className="font-semibold text-slate-900">Third-Party Secrets Readiness</h2>
          <p className="text-sm text-slate-500 mt-1">Monitors the presence of credentials in the secure Secret Manager.</p>
        </div>
        <div className="p-5">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-2 p-4 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-slate-700">Midtrans Payment</span>
                {overview?.details.midtrans ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
              </div>
              <span className="text-xs text-slate-500">
                {overview?.details.midtrans ? 'Credentials verified' : 'Requires configuration'}
              </span>
            </div>
            
            <div className="flex flex-col gap-2 p-4 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-slate-700">TokoVoucher Provider</span>
                {overview?.details.tokovoucher ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
              </div>
              <span className="text-xs text-slate-500">
                {overview?.details.tokovoucher ? 'Credentials verified' : 'Requires configuration'}
              </span>
            </div>

            <div className="flex flex-col gap-2 p-4 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-slate-700">APIGames Provider</span>
                {overview?.details.apigames ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
              </div>
              <span className="text-xs text-slate-500">
                {overview?.details.apigames ? 'Credentials verified' : 'Requires configuration'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
