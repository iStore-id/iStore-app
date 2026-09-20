import React, { useState, useEffect } from 'react';
import { PaymentGateway } from '../../types/core';
import { useAuthStore } from '../../store/auth-store';
import { CreditCard, Activity, RefreshCw, Power } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminPaymentGatewaysPage() {
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchGateways();
  }, []);

  const fetchGateways = async () => {
    try {
      setLoading(true);
      const token = await user?.getIdToken?.();
      const res = await fetch('/api/admin/gateways', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setGateways(data.data || []);
      } else {
        throw new Error(data.message || 'Failed to fetch gateways');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (gateway: PaymentGateway) => {
    try {
      const newStatus = gateway.status === 'active' ? 'inactive' : 'active';
      const token = await user?.getIdToken?.();
      const res = await fetch(`/api/admin/gateways/${gateway.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus, enabled: newStatus === 'active' })
      });
      if (!res.ok) throw new Error('Failed to update gateway status');
      fetchGateways();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const testConnection = async (gateway: PaymentGateway) => {
    try {
      setTestingId(gateway.id || null);
      const token = await user?.getIdToken?.();
      
      let endpoint = '';
      if (gateway.code === 'midtrans') {
        endpoint = '/api/admin/integrations/midtrans/test';
      } else {
        throw new Error('Test connection not implemented for this gateway');
      }
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Test failed');
      
      alert(`Success: ${data.message || 'Connection OK'}`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment Gateways</h1>
          <p className="text-slate-500">Pusat pengelolaan operasional payment gateway iStore.</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          {loading ? (
             <div className="text-center py-10 text-slate-500">Loading gateways...</div>
          ) : error ? (
             <div className="text-center py-10 text-red-500">{error}</div>
          ) : gateways.length === 0 ? (
             <div className="text-center py-10 text-slate-500">No payment gateways found.</div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
               {gateways.map(gateway => (
                  <div key={gateway.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{gateway.name}</h3>
                        <p className="text-sm text-slate-500 font-mono">{gateway.code}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        gateway.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {gateway.status.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-slate-500">Environment:</span>
                         <span className="font-medium text-slate-900 capitalize">{gateway.environment}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-slate-500">Type:</span>
                         <span className="font-medium text-slate-900 capitalize">{gateway.type}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-slate-500">Priority:</span>
                         <span className="font-medium text-slate-900">{gateway.priority}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-slate-500">Enabled:</span>
                         <span className="font-medium text-slate-900">{gateway.enabled ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => testConnection(gateway)}
                        disabled={testingId === gateway.id}
                        className="flex-1 flex justify-center items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {testingId === gateway.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                        Test Connection
                      </button>
                      <button
                        onClick={() => handleToggleStatus(gateway)}
                        className={`flex-1 flex justify-center items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          gateway.status === 'active'
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-green-50 text-green-600 hover:bg-green-100'
                        }`}
                      >
                        <Power className="w-4 h-4" />
                        {gateway.status === 'active' ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </div>
               ))}
             </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
