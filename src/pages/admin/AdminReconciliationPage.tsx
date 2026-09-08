import React, { useState, useEffect } from 'react';
import { 
  Scale, RefreshCw, Search, CheckCircle2, AlertTriangle, Clock, 
  ShieldCheck, Eye, Play, FileText, ArrowRight, Activity, Database
} from 'lucide-react';
import { useAuthStore } from '../../store/auth-store';

interface ReconciliationOverview {
  totalRuns: number;
  totalRecordsChecked: number;
  openMismatches: number;
  resolvedMismatches: number;
  statusMismatchCount: number;
  amountMismatchCount: number;
  providerPendingCount: number;
  lastRun: any | null;
  healthStatus: string;
}

interface ReconciliationRun {
  id: string;
  executedBy: string;
  startedAt: string;
  completedAt: string;
  status: string;
  totalOrdersScanned: number;
  mismatchCount: number;
  createdAt: string;
}

interface MismatchRecord {
  id: string;
  runId?: string;
  orderId: string;
  mismatchType: string;
  expectedValue: string;
  actualValue: string;
  resolution: 'OPEN' | 'RESOLVED';
  detectedAt: string;
  resolvedAt?: string;
  message?: string;
}

export function AdminReconciliationPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'runs' | 'mismatches'>('overview');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<ReconciliationOverview | null>(null);
  const [runs, setRuns] = useState<ReconciliationRun[]>([]);
  const [records, setRecords] = useState<MismatchRecord[]>([]);
  
  // Filters & Pagination for Mismatches
  const [resolutionFilter, setResolutionFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals & Action states
  const [selectedRunDetail, setSelectedRunDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { user } = useAuthStore();

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const token = await (user as any)?.getIdToken?.();
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch Overview
      const resOv = await fetch('/api/admin/reconciliation/overview', { headers });
      const dataOv = await resOv.json();
      if (resOv.ok && dataOv.success) {
        setOverview(dataOv.data);
      }

      // Fetch Runs
      const resRuns = await fetch('/api/admin/reconciliation/runs', { headers });
      const dataRuns = await resRuns.json();
      if (resRuns.ok && dataRuns.success) {
        setRuns(dataRuns.data);
      }

      // Fetch Records
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        resolution: resolutionFilter,
        mismatchType: typeFilter,
        search
      });
      const resRec = await fetch(`/api/admin/reconciliation/records?${params.toString()}`, { headers });
      const dataRec = await resRec.json();
      if (resRec.ok && dataRec.success) {
        setRecords(dataRec.data.records);
        setTotalPages(dataRec.data.pagination.totalPages);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to load reconciliation data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, page, resolutionFilter, typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  const handleTriggerBatch = async () => {
    if (!confirm('Jalankan batch rekonsiliasi manual sekarang?')) return;
    setBatchRunning(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch('/api/admin/reconciliation/runs', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to trigger batch');
      setSuccessMsg('Batch rekonsiliasi berhasil diantrekan.');
      fetchData();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setBatchRunning(false);
    }
  };

  const handleReconcileOrder = async (orderId: string) => {
    setReconcilingId(orderId);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/reconciliation/orders/${orderId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to reconcile order');
      setSuccessMsg(`Order ${orderId} berhasil direkonsiliasi melalui Engine.`);
      fetchData();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setReconcilingId(null);
    }
  };

  const openRunDetail = async (runId: string) => {
    setLoadingDetail(true);
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/reconciliation/runs/${runId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedRunDetail(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const getMismatchBadge = (type: string) => {
    const colors: Record<string, string> = {
      STATUS_MISMATCH: 'bg-amber-100 text-amber-800 border-amber-200',
      AMOUNT_MISMATCH: 'bg-red-100 text-red-800 border-red-200',
      PROVIDER_PENDING: 'bg-blue-100 text-blue-800 border-blue-200',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${colors[type] || 'bg-slate-100 text-slate-800 border-slate-200'}`}>
        {type}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Scale className="w-7 h-7 text-indigo-600" />
            Reconciliation Control Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Audit and reconcile order state discrepancies between iStore database, Payment Gateway, and Digital Providers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleTriggerBatch}
            disabled={batchRunning}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
          >
            {batchRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Batch Reconciliation
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-medium">
          {successMsg}
        </div>
      )}

      {/* Overview Cards */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-500">System Health</span>
              <span className={`p-2.5 rounded-xl ${overview.healthStatus === 'HEALTHY' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                <Activity className="w-5 h-5" />
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {overview.healthStatus === 'HEALTHY' ? 'Healthy' : 'Attention Required'}
            </div>
            <p className="text-xs text-slate-500 mt-2">Open Mismatches: {overview.openMismatches}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-500">Total Runs Executed</span>
              <span className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Database className="w-5 h-5" />
              </span>
            </div>
            <div className="text-3xl font-bold text-slate-900">{overview.totalRuns}</div>
            <p className="text-xs text-slate-500 mt-2">Records Checked: {overview.totalRecordsChecked}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-500">Status / Amount Mismatches</span>
              <span className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </span>
            </div>
            <div className="text-3xl font-bold text-amber-600">{overview.statusMismatchCount + overview.amountMismatchCount}</div>
            <p className="text-xs text-slate-500 mt-2">Status: {overview.statusMismatchCount} | Amount: {overview.amountMismatchCount}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-500">Resolved Discrepancies</span>
              <span className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <ShieldCheck className="w-5 h-5" />
              </span>
            </div>
            <div className="text-3xl font-bold text-emerald-600">{overview.resolvedMismatches}</div>
            <p className="text-xs text-slate-500 mt-2">Auto & Manual Safe Resolutions</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 pt-4 gap-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-4 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'overview' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Overview & Summary
          </button>
          <button
            onClick={() => setActiveTab('runs')}
            className={`pb-4 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'runs' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Reconciliation Runs ({runs.length})
          </button>
          <button
            onClick={() => setActiveTab('mismatches')}
            className={`pb-4 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'mismatches' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Mismatch Records ({overview?.openMismatches || 0} Open)
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-6 space-y-3">
                <h3 className="font-semibold text-indigo-900 text-base flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  Safe Reconciliation Engine Principles
                </h3>
                <p className="text-sm text-indigo-800 leading-relaxed">
                  The reconciliation engine verifies order state consistency against Payment Gateway (Midtrans) and Fulfillment Providers (API Games, TokoVoucher). Safe auto-resolution rules apply strictly without bypassing the Order State Machine or Fulfillment Dispatcher.
                </p>
              </div>

              {overview?.lastRun ? (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <h4 className="font-semibold text-slate-900 text-sm">Last Run Information</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-slate-400 block font-sans">Run ID</span>
                      {overview.lastRun.id}
                    </div>
                    <div>
                      <span className="text-slate-400 block font-sans">Status</span>
                      <span className="font-sans font-semibold text-emerald-600">{overview.lastRun.status}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-sans">Executed By</span>
                      {overview.lastRun.executedBy}
                    </div>
                    <div>
                      <span className="text-slate-400 block font-sans">Started At</span>
                      {new Date(overview.lastRun.startedAt || overview.lastRun.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  No reconciliation runs executed yet. Click 'Run Batch Reconciliation' to start.
                </div>
              )}
            </div>
          )}

          {activeTab === 'runs' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Run ID</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Executed By</th>
                    <th className="px-6 py-3">Started At</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {runs.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-indigo-600">{r.id}</td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">{r.executedBy}</td>
                      <td className="px-6 py-4 text-xs text-slate-500">{new Date(r.createdAt || r.startedAt).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openRunDetail(r.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-medium transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" /> Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                  {runs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        No reconciliation runs found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'mismatches' && (
            <div className="space-y-4">
              <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <input
                    type="text"
                    placeholder="Search Order ID / Mismatch ID..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <select
                    value={resolutionFilter}
                    onChange={e => { setResolutionFilter(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="ALL">All Resolutions</option>
                    <option value="OPEN">OPEN</option>
                    <option value="RESOLVED">RESOLVED</option>
                  </select>
                </div>
                <div>
                  <select
                    value={typeFilter}
                    onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="ALL">All Mismatch Types</option>
                    <option value="STATUS_MISMATCH">STATUS_MISMATCH</option>
                    <option value="AMOUNT_MISMATCH">AMOUNT_MISMATCH</option>
                    <option value="PROVIDER_PENDING">PROVIDER_PENDING</option>
                  </select>
                </div>
              </form>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3">Order ID</th>
                      <th className="px-6 py-3">Mismatch Type</th>
                      <th className="px-6 py-3">Expected vs Actual</th>
                      <th className="px-6 py-3">Resolution</th>
                      <th className="px-6 py-3">Detected At</th>
                      <th className="px-6 py-3 text-right">Safe Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {records.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-mono text-xs font-semibold text-indigo-600">{rec.orderId}</td>
                        <td className="px-6 py-4">{getMismatchBadge(rec.mismatchType)}</td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-600">
                          <div>Expected: {rec.expectedValue}</div>
                          <div>Actual: {rec.actualValue}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            rec.resolution === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {rec.resolution}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">{new Date(rec.detectedAt).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right">
                          {rec.resolution === 'OPEN' ? (
                            <button
                              onClick={() => handleReconcileOrder(rec.orderId)}
                              disabled={reconcilingId === rec.orderId}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                              {reconcilingId === rec.orderId && <RefreshCw className="w-3 h-3 animate-spin" />}
                              Reconcile Now
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">Resolved</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {records.length === 0 && !loading && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                          No mismatch records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Run Detail Modal */}
      {selectedRunDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Reconciliation Run Detail
              </h3>
              <button onClick={() => setSelectedRunDetail(null)} className="text-slate-400 hover:text-slate-600 text-lg">
                &times;
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 text-xs block">Run ID</span>
                  <span className="font-mono text-xs font-semibold">{selectedRunDetail.run.id}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">Status</span>
                  <span className="font-semibold text-emerald-600">{selectedRunDetail.run.status}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">Orders Scanned</span>
                  <span className="font-semibold">{selectedRunDetail.run.totalOrdersScanned}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">Started At</span>
                  <span className="text-xs">{new Date(selectedRunDetail.run.startedAt).toLocaleString()}</span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 text-sm mb-3">Associated Discrepancies ({selectedRunDetail.records.length})</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2">Order ID</th>
                        <th className="px-4 py-2">Type</th>
                        <th className="px-4 py-2">Resolution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono">
                      {selectedRunDetail.records.map((rec: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-indigo-600">{rec.orderId}</td>
                          <td className="px-4 py-2">{rec.mismatchType}</td>
                          <td className="px-4 py-2">{rec.resolution}</td>
                        </tr>
                      ))}
                      {selectedRunDetail.records.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                            No mismatches found in this run.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedRunDetail(null)}
                className="px-5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
