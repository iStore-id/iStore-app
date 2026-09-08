import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Save, X, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../store/auth-store';

interface FeatureFlag {
  key: string;
  enabled: boolean;
  name: string;
  description: string;
  updatedAt?: string;
  updatedBy?: string;
}

const AVAILABLE_FLAGS: Pick<FeatureFlag, 'key' | 'name' | 'description'>[] = [
  { key: 'new_checkout_flow', name: 'New Checkout Flow', description: 'Enable the experimental multi-step checkout flow.' },
  { key: 'ai_product_search', name: 'AI Product Search', description: 'Enable semantic AI search in the catalog.' },
  { key: 'loyalty_program', name: 'Loyalty & Rewards', description: 'Enable customer points, rewards, and redemption system.' },
  { key: 'maintenance_mode', name: 'Maintenance Mode', description: 'Put the public storefront into maintenance mode (blocks purchases).' }
];

export function AdminFeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [originalFlags, setOriginalFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const { user } = useAuthStore();

  const fetchFlags = async () => {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      if (!user) throw new Error("Authentication required");
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch('/api/admin/feature-flags', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        const dbFlags: FeatureFlag[] = data.data || [];
        const merged = AVAILABLE_FLAGS.map(avail => {
          const found = dbFlags.find(f => f.key === avail.key);
          if (found) return found;
          return {
            key: avail.key,
            name: avail.name,
            description: avail.description,
            enabled: false
          };
        });
        setFlags(merged);
        setOriginalFlags(JSON.parse(JSON.stringify(merged)));
        setIsDirty(false);
      } else {
        setErrorMsg(data.message);
      }
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const handleToggle = (key: string, checked: boolean) => {
    const updated = flags.map(f => f.key === key ? { ...f, enabled: checked } : f);
    setFlags(updated);
    setIsDirty(JSON.stringify(updated) !== JSON.stringify(originalFlags));
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      if (!user) throw new Error("Authentication required");
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch('/api/admin/feature-flags', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ flags })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Feature flags updated successfully');
        setOriginalFlags(JSON.parse(JSON.stringify(flags)));
        setIsDirty(false);
      } else {
        setErrorMsg(data.message);
      }
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFlags(JSON.parse(JSON.stringify(originalFlags)));
    setIsDirty(false);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Feature Flags</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Manage experimental and optional features across the platform.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-800 dark:hover:text-slate-50 h-10 px-4 py-2"
            onClick={fetchFlags} 
            disabled={loading || saving}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {isDirty && (
            <button 
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50 h-10 px-4 py-2"
              onClick={handleCancel} 
              disabled={saving}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </button>
          )}
          <button 
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-slate-900 text-slate-50 hover:bg-slate-900/90 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-50/90 h-10 px-4 py-2"
            onClick={handleSave} 
            disabled={!isDirty || saving}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200 p-4 rounded-lg flex items-center">
          <AlertTriangle className="h-5 w-5 mr-3 shrink-0" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      )}

      {successMsg && (
        <div className="bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-900 text-green-800 dark:text-green-200 p-4 rounded-lg flex items-center">
          <p className="text-sm">{successMsg}</p>
        </div>
      )}

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 p-4 rounded-lg flex items-start">
        <AlertTriangle className="h-5 w-5 mr-3 mt-0.5 shrink-0" />
        <div>
          <h3 className="font-semibold text-sm">Warning</h3>
          <p className="text-sm mt-1">
            Enabling these flags may introduce unstable features to the storefront. Please ensure the feature is fully implemented before enabling.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="grid gap-6">
          {flags.map((flag) => (
            <div 
              key={flag.key} 
              className={`rounded-xl border p-6 transition-all ${
                flag.enabled 
                  ? 'border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20' 
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {flag.name}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {flag.description}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={flag.enabled}
                  onClick={() => handleToggle(flag.key, !flag.enabled)}
                  className={`${
                    flag.enabled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
                  } relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950`}
                >
                  <span
                    className={`${
                      flag.enabled ? 'translate-x-5' : 'translate-x-0'
                    } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                  />
                </button>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center">
                  <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                    {flag.key}
                  </span>
                </div>
                {flag.updatedAt && (
                  <div className="text-xs flex items-center border-l border-slate-200 dark:border-slate-700 pl-4">
                    Last updated: {new Date(flag.updatedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {flags.length === 0 && (
            <div className="text-center py-12 text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              No feature flags configured.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
