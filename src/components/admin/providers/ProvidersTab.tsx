import React, { useState, useEffect } from 'react';
import { Provider } from '../../../types/core';
import { useAuthStore } from '../../../store/auth-store';
import { Activity, CheckCircle2, XCircle, AlertCircle, RefreshCw, Power } from 'lucide-react';

export default function ProvidersTab() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuthStore();
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const token = await user?.getIdToken();
      if (!token) return;

      const res = await fetch('/api/admin/providers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch providers');
      
      setProviders(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (provider: Provider) => {
    try {
      const newStatus = provider.status === 'active' ? 'inactive' : 'active';
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/providers/${provider.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Failed to update provider status');
      fetchProviders();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const testConnection = async (provider: Provider) => {
    try {
      setTestingId(provider.id || null);
      const token = await user?.getIdToken();
      
      let endpoint = '';
      if (provider.code === 'apigames') {
        endpoint = '/api/admin/providers/test/apigames';
      } else if (provider.code === 'tokovoucher') {
        endpoint = '/api/admin/integrations/tokovoucher/test'; // Use existing TokoVoucher test endpoint
      } else {
        throw new Error('Test connection not implemented for this provider');
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Test failed');
      
      alert(`Success: ${data.message || 'Connection OK'}`);
      fetchProviders();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setTestingId(null);
    }
  };

  if (loading) return <div className="text-center py-10 text-slate-500">Loading providers...</div>;
  if (error) return <div className="text-center py-10 text-red-500">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {providers.map(provider => (
          <div key={provider.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm min-w-0">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{provider.name}</h3>
                <p className="text-sm text-slate-500 font-mono">{provider.code}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                provider.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
              }`}>
                {provider.status.toUpperCase()}
              </span>
            </div>
            
            <p className="text-sm text-slate-600 mb-6">{provider.description}</p>
            
            <div className="bg-slate-50 p-3 rounded-lg flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600">Health:</span>
                <span className={`text-sm font-medium ${
                  provider.health?.state === 'healthy' ? 'text-green-600' : 
                  provider.health?.state === 'degraded' ? 'text-amber-600' : 
                  provider.health?.state === 'unknown' ? 'text-slate-500' : 'text-red-600'
                }`}>
                  {provider.health?.state?.toUpperCase() || 'UNKNOWN'}
                </span>
              </div>
              {provider.health?.lastCheckedAt && (
                <span className="text-xs text-slate-400">
                  {new Date(provider.health.lastCheckedAt).toLocaleString()}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => testConnection(provider)}
                disabled={testingId === provider.id}
                className="flex-1 flex justify-center items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {testingId === provider.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                Test Connection
              </button>
              <button
                onClick={() => handleToggleStatus(provider)}
                className={`flex-1 flex justify-center items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  provider.status === 'active'
                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                    : 'bg-green-50 text-green-600 hover:bg-green-100'
                }`}
              >
                <Power className="w-4 h-4" />
                {provider.status === 'active' ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {providers.length === 0 && (
        <div className="text-center py-10 text-slate-500">
          No providers found. Please initialize the database with basic providers.
        </div>
      )}
    </div>
  );
}
