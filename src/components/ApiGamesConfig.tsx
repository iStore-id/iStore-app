import React, { useState, useEffect } from 'react';
import { Save, Loader2, Key, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store/auth-store';

export const ApiGamesConfig = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [merchantId, setMerchantId] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    const token = await (user as any)?.getIdToken?.();
    const res = await fetch("/api/admin/providers/apigames/credentials/status", {
      headers: { "Authorization": token ? `Bearer ${token}` : "" }
    });
    const data = await res.json();
    if (data.success) {
      setConfigured(data.data.configured);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    const token = await (user as any)?.getIdToken?.();
    const res = await fetch("/api/admin/providers/apigames/credentials", {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": token ? `Bearer ${token}` : "" 
      },
      body: JSON.stringify({ merchantId, secretKey })
    });
    const data = await res.json();
    if (data.success) {
      setSuccess("Credentials updated successfully");
      setConfigured(true);
      setMerchantId('');
      setSecretKey('');
    } else {
      setError(data.message);
    }
    setSaving(false);
  };

  const testConnection = async () => {
    setError(null);
    const token = await (user as any)?.getIdToken?.();
    const res = await fetch("/api/admin/providers/test/apigames", {
      method: "POST",
      headers: { "Authorization": token ? `Bearer ${token}` : "" }
    });
    const data = await res.json();
    if (data.success) {
      setSuccess("Connection Verified!");
    } else {
      setError(data.message);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin w-8 h-8 text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
        <div className={`w-3 h-3 rounded-full ${configured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        <span className="font-medium text-slate-700">Status: {configured ? 'Configured' : 'Not Configured'}</span>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Merchant ID</label>
          <input type="text" value={merchantId} onChange={(e) => setMerchantId(e.target.value)} className="w-full mt-1 p-2 border rounded-md" placeholder="Enter Merchant ID" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Secret Key</label>
          <input type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} className="w-full mt-1 p-2 border rounded-md" placeholder="Enter Secret Key" />
        </div>
        <button type="submit" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg" disabled={saving}>
          {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
          {configured ? 'Update Credentials' : 'Save Credentials'}
        </button>
      </form>

      {configured && (
        <button onClick={testConnection} className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg">
          <RefreshCw className="w-4 h-4" /> Test Connection
        </button>
      )}

      {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>}
      {success && <div className="p-4 bg-emerald-50 text-emerald-600 rounded-lg">{success}</div>}
    </div>
  );
};
