import React, { useState, useEffect } from 'react';
import { Database, DownloadCloud, AlertTriangle, ShieldCheck, HardDrive, RefreshCw, Activity, AlertCircle, Clock, Server, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/auth-store';

interface BackupStatus {
  projectId: string;
  databaseId: string;
  firestoreDetected: boolean;
  storageBucketDetected: boolean;
  pitrEnabled: boolean | 'unknown';
  scheduledBackupEnabled: boolean | 'unknown';
  lastKnownBackup: string | null;
  infrastructureStatus: 'HEALTHY' | 'NEEDS_CONFIGURATION' | 'UNKNOWN';
}

export function AdminBackupPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState({ type: '', text: '' });
  const { user } = useAuthStore();

  const fetchStatus = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      if (!user) throw new Error("Authentication required");
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch('/api/admin/backup/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch backup status');
      setStatus(data.data);
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [user]);

  const handleManualBackup = async () => {
    setTriggerLoading(true);
    setTriggerMsg({ type: '', text: '' });
    try {
      if (!user) throw new Error("Authentication required");
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch('/api/admin/backup/trigger', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to trigger backup');
      setTriggerMsg({ type: 'success', text: data.message });
    } catch (error: any) {
      setTriggerMsg({ type: 'error', text: error.message });
    } finally {
      setTriggerLoading(false);
    }
  };

  if (loading && !status) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="ui-page-title text-slate-900">Backup & Recovery</h1>
          <p className="text-sm text-slate-500 mt-1">Configure and monitor database backups and disaster recovery readiness.</p>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Status
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-red-50 p-4 border border-red-200 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <p className="text-sm text-red-600 font-medium">{errorMsg}</p>
        </div>
      )}

      {/* Health Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${status?.infrastructureStatus === 'HEALTHY' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
              <Activity className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-900">Overall Status</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {status?.infrastructureStatus === 'HEALTHY' ? 'Ready' : 'Setup Required'}
          </p>
          <p className="text-sm text-slate-500 mt-1">Infrastructure readiness</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <Database className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-900">Firestore PITR</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {status?.pitrEnabled === 'unknown' ? 'Unknown' : status?.pitrEnabled ? 'Enabled' : 'Disabled'}
          </p>
          <p className="text-sm text-slate-500 mt-1">Point-in-Time Recovery</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
              <Clock className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-900">Scheduled Backup</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {status?.scheduledBackupEnabled === 'unknown' ? 'Unknown' : status?.scheduledBackupEnabled ? 'Active' : 'Not Set'}
          </p>
          <p className="text-sm text-slate-500 mt-1">Daily snapshot schedules</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-900">Last Backup</h3>
          </div>
          <p className="text-lg font-bold text-slate-900 truncate">
            {status?.lastKnownBackup || 'No record'}
          </p>
          <p className="text-sm text-slate-500 mt-1">Latest valid snapshot</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Infrastructure Checklist */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/50 p-5">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-slate-600" />
              <h2 className="font-semibold text-slate-900">Infrastructure Checklist</h2>
            </div>
          </div>
          <div className="p-5">
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className={`mt-0.5 rounded-full p-1 ${status?.firestoreDetected ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                  {status?.firestoreDetected ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Firestore Database (default)</p>
                  <p className="text-xs text-slate-500">Connected and responding to queries.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className={`mt-0.5 rounded-full p-1 ${status?.storageBucketDetected ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                  {status?.storageBucketDetected ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Cloud Storage Bucket</p>
                  <p className="text-xs text-slate-500">Available for media and export dumps.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full p-1 bg-amber-100 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">GCP PITR (Point-in-Time Recovery)</p>
                  <p className="text-xs text-slate-500">Cannot be verified automatically. Must be configured in GCP Console.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full p-1 bg-amber-100 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Scheduled Backups</p>
                  <p className="text-xs text-slate-500">External Infrastructure Required. Configure in Firebase/GCP Console.</p>
                </div>
              </li>
            </ul>

            <div className="mt-6 pt-5 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Manual Export (Snapshot)</h3>
              <p className="text-xs text-slate-500 mb-4">
                Attempt to trigger a manual database snapshot. Note: Application-level exports are disabled for safety and performance reasons. Rely on GCP-managed exports.
              </p>
              
              {triggerMsg.text && (
                <div className={`mb-4 p-3 rounded-md border text-sm ${triggerMsg.type === 'error' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                  {triggerMsg.text}
                </div>
              )}

              <button
                onClick={handleManualBackup}
                disabled={triggerLoading}
                className="w-full flex justify-center items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {triggerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadCloud className="h-4 w-4" />}
                Trigger Manual Backup
              </button>
            </div>
          </div>
        </div>

        {/* Recovery Runbook */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="border-b border-slate-200 bg-slate-50/50 p-5">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-slate-600" />
              <h2 className="font-semibold text-slate-900">Recovery Runbook</h2>
            </div>
          </div>
          <div className="p-5 flex-1 bg-slate-900 text-slate-300 font-mono text-sm overflow-y-auto">
            <p className="text-amber-400 font-bold mb-4">!!! CRITICAL WARNING !!!</p>
            <p className="mb-4">Database restoration is a destructive operation. Any data written AFTER the backup point will be PERMANENTLY LOST.</p>
            
            <p className="font-bold text-white mb-2">Pre-Recovery Checklist:</p>
            <ul className="list-disc pl-5 mb-4 space-y-1">
              <li>Verify the exact timestamp of the incident.</li>
              <li>Identify the closest safe backup snapshot or PITR timestamp.</li>
              <li>Notify customers of impending downtime/maintenance.</li>
              <li>Halt all running background workers (Jobs/Queue).</li>
            </ul>

            <p className="font-bold text-white mb-2">Impact Analysis:</p>
            <ul className="list-disc pl-5 mb-4 space-y-1">
              <li><span className="text-white">Payments:</span> Midtrans webhooks received after the backup will be lost. You MUST reconcile via Midtrans Dashboard post-recovery.</li>
              <li><span className="text-white">Fulfillment:</span> Vouchers issued after backup will remain consumed at the provider but missing from the database.</li>
              <li><span className="text-white">Ledger:</span> Financial balances will revert. Manual adjustment required.</li>
            </ul>

            <p className="font-bold text-white mb-2">Recovery Procedure:</p>
            <p className="mb-2">1. Application-level direct restore is <span className="text-red-400">DISABLED</span> by architecture design.</p>
            <p className="mb-2">2. Owner must login to <a href="https://console.cloud.google.com/firestore" target="_blank" rel="noreferrer" className="text-blue-400 underline">Google Cloud Console</a>.</p>
            <p className="mb-2">3. Navigate to Firestore {'->'} Databases {'->'} Import/Export or PITR.</p>
            <p className="mb-4">4. Follow GCP standard procedures to restore the default database.</p>

            <p className="font-bold text-white mb-2">Post-Recovery:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Restart all Node.js instances to clear memory cache.</li>
              <li>Run Webhook Reconciliation script manually.</li>
              <li>Verify Ledger integrity.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Ensure Loader2 is imported above (it is)
