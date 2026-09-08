import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Quota, Provider } from '../../../types/core';
import { useAuthStore } from '../../../store/auth-store';
import { Database, Plus, RefreshCw, Power } from 'lucide-react';
import { motion } from 'motion/react';

export default function QuotaTab() {
  const [quotas, setQuotas] = useState<(Quota & { providerName: string })[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<Partial<Quota>>({
    providerId: '',
    dailyTransactionLimit: 0,
    dailyAmountLimit: 0,
    enabled: true,
    status: 'active'
  });
  const [saving, setSaving] = useState(false);

  const { user } = useAuthStore();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const provSnap = await getDocs(collection(db, 'providers'));
      const provData = provSnap.docs.map(d => ({ id: d.id, ...d.data() } as Provider));
      setProviders(provData);

      const quotasSnap = await getDocs(collection(db, 'quotas'));
      const quotasData = quotasSnap.docs.map(d => {
        const data = d.data() as Quota;
        const p = provData.find(prov => prov.id === data.providerId);
        return {
          id: d.id,
          ...data,
          providerName: p ? p.name : 'Unknown Provider'
        };
      });
      setQuotas(quotasData);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.providerId) return;
    
    try {
      setSaving(true);
      const token = await user?.getIdToken();
      const payload = {
        ...formData,
        period: new Date().toISOString().split('T')[0],
        usageTransaction: formData.id ? undefined : 0,
        usageAmount: formData.id ? undefined : 0
      };

      const res = await fetch(`/api/admin/quotas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to save quota');
      }
      
      setShowModal(false);
      setFormData({ providerId: '', dailyTransactionLimit: 0, dailyAmountLimit: 0, enabled: true, status: 'active' });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (quota: Quota) => {
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/quotas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: quota.id, enabled: !quota.enabled })
      });
      if (!res.ok) throw new Error('Failed to update quota status');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loading) return <div className="text-center py-10 text-slate-500">Loading quotas...</div>;
  if (error) return <div className="text-center py-10 text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => {
            setFormData({ providerId: '', dailyTransactionLimit: 0, dailyAmountLimit: 0, enabled: true, status: 'active' });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Quota Limit
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 font-medium">Provider</th>
              <th className="px-6 py-3 font-medium text-right">Trx Limit (Daily)</th>
              <th className="px-6 py-3 font-medium text-right">Trx Usage</th>
              <th className="px-6 py-3 font-medium text-right">Amount Limit (Daily)</th>
              <th className="px-6 py-3 font-medium text-right">Amount Usage</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {quotas.map((quota) => (
              <tr key={quota.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-900">{quota.providerName}</td>
                <td className="px-6 py-4 text-right text-slate-600">{quota.dailyTransactionLimit === 0 ? 'Unlimited' : quota.dailyTransactionLimit}</td>
                <td className="px-6 py-4 text-right text-slate-600">{quota.usageTransaction || 0}</td>
                <td className="px-6 py-4 text-right text-slate-600">{quota.dailyAmountLimit === 0 ? 'Unlimited' : `Rp ${quota.dailyAmountLimit.toLocaleString('id-ID')}`}</td>
                <td className="px-6 py-4 text-right text-slate-600">Rp {(quota.usageAmount || 0).toLocaleString('id-ID')}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    quota.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {quota.enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setFormData(quota); setShowModal(true); }}
                      className="text-primary hover:text-primary/80 font-medium text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleStatus(quota)}
                      className={`${quota.enabled ? 'text-amber-600' : 'text-green-600'} hover:opacity-80 font-medium text-sm`}
                    >
                      {quota.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {quotas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                  No quotas configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-semibold text-slate-900">{formData.id ? 'Edit' : 'Add'} Provider Quota</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-500">
                &times;
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
                <select
                  required
                  disabled={!!formData.id}
                  value={formData.providerId}
                  onChange={e => setFormData({...formData, providerId: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-50"
                >
                  <option value="">Select a provider...</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id!}>{p.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Daily Transaction Limit (0 for Unlimited)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.dailyTransactionLimit}
                  onChange={e => setFormData({...formData, dailyTransactionLimit: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Daily Amount Limit (0 for Unlimited)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.dailyAmountLimit}
                  onChange={e => setFormData({...formData, dailyAmountLimit: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !formData.providerId}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Save Quota
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
