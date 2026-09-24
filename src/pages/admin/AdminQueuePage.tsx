import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/auth-store';
import { 
  ListRestart, 
  Filter, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Play, 
  Eye,
  RefreshCw,
  Ban
} from 'lucide-react';
import JobDetailModal from '../../components/admin/queue/JobDetailModal';

export default function AdminQueuePage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [filter, setFilter] = useState({
    status: '',
    type: '',
    priority: ''
  });
  const { user } = useAuthStore();

  const fetchJobs = async () => {
    try {
      setRefreshing(true);
      const token = await user?.getIdToken();
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.type) params.append('type', filter.type);
      if (filter.priority) params.append('priority', filter.priority);

      const res = await fetch(`/api/admin/jobs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        setJobs(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch jobs", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [filter]);

  const triggerWorker = async () => {
    try {
      setRefreshing(true);
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/jobs/trigger-worker`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      alert(result.message);
      fetchJobs();
    } catch (err: any) {
      alert("Failed to trigger worker: " + err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const retryJob = async (jobId: string) => {
    if (!confirm("Retry this job?")) return;
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      alert(result.message);
      fetchJobs();
    } catch (err: any) {
      alert("Failed to retry job: " + err.message);
    }
  };

  const cancelJob = async (jobId: string) => {
    if (!confirm("Cancel this job?")) return;
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      alert(result.message);
      fetchJobs();
    } catch (err: any) {
      alert("Failed to cancel job: " + err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'QUEUED':
        return <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700"><Clock className="w-3 h-3" /> QUEUED</span>;
      case 'PROCESSING':
        return <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><RefreshCw className="w-3 h-3 animate-spin" /> PROCESSING</span>;
      case 'SUCCEEDED':
        return <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3" /> SUCCEEDED</span>;
      case 'RETRYING':
        return <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><RefreshCw className="w-3 h-3" /> RETRYING</span>;
      case 'FAILED':
        return <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle className="w-3 h-3" /> FAILED</span>;
      case 'DEAD_LETTER':
        return <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-200 text-red-900 font-bold"><AlertCircle className="w-3 h-3" /> DEAD_LETTER</span>;
      case 'CANCELLED':
        return <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-600"><Ban className="w-3 h-3" /> CANCELLED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="ui-page-title text-slate-900">Queue / Jobs</h1>
          <p className="text-slate-500">Orkestrasi pekerjaan latar belakang dan pemulihan otomatis.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchJobs}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button 
            onClick={triggerWorker}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            Trigger Worker
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Filter:</span>
        </div>
        
        <select 
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="text-sm border-slate-200 rounded-lg focus:ring-primary focus:border-primary"
        >
          <option value="">Semua Status</option>
          <option value="QUEUED">QUEUED</option>
          <option value="PROCESSING">PROCESSING</option>
          <option value="SUCCEEDED">SUCCEEDED</option>
          <option value="RETRYING">RETRYING</option>
          <option value="FAILED">FAILED</option>
          <option value="DEAD_LETTER">DEAD LETTER</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>

        <select 
          value={filter.type}
          onChange={(e) => setFilter({ ...filter, type: e.target.value })}
          className="text-sm border-slate-200 rounded-lg focus:ring-primary focus:border-primary"
        >
          <option value="">Semua Tipe</option>
          <option value="FULFILLMENT">FULFILLMENT</option>
          <option value="RECONCILIATION">RECONCILIATION</option>
          <option value="DELIVERY_RECOVERY">DELIVERY RECOVERY</option>
        </select>

        <select 
          value={filter.priority}
          onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
          className="text-sm border-slate-200 rounded-lg focus:ring-primary focus:border-primary"
        >
          <option value="">Semua Prioritas</option>
          <option value="HIGH">HIGH</option>
          <option value="NORMAL">NORMAL</option>
          <option value="LOW">LOW</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Job ID / Type</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Attempts</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reference</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Timestamps</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">Loading jobs...</td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">Tidak ada pekerjaan ditemukan.</td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs font-bold text-slate-900">{job.id}</div>
                      <div className="text-xs text-slate-500 mt-1">{job.type}</div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(job.status)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium ${
                        job.priority === 'HIGH' ? 'text-red-600' :
                        job.priority === 'LOW' ? 'text-slate-400' : 'text-blue-600'
                      }`}>
                        {job.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-900">{job.attempts} / {job.maxAttempts}</div>
                      {job.nextRetryAt && (
                        <div className="text-[10px] text-amber-600 mt-1">
                          Next: {new Date(job.nextRetryAt).toLocaleTimeString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-slate-600 font-mono">{job.referenceId || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[10px] text-slate-500">
                        Created: {new Date(job.createdAt).toLocaleString()}
                      </div>
                      {job.startedAt && (
                        <div className="text-[10px] text-blue-500">
                          Started: {new Date(job.startedAt).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => setSelectedJob(job)}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                          title="Inspect"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(job.status === 'FAILED' || job.status === 'DEAD_LETTER' || job.status === 'CANCELLED') && (
                          <button 
                            onClick={() => retryJob(job.id)}
                            className="p-1.5 text-slate-400 hover:text-green-600 transition-colors"
                            title="Retry"
                          >
                            <ListRestart className="w-4 h-4" />
                          </button>
                        )}
                        {(job.status === 'QUEUED' || job.status === 'RETRYING' || job.status === 'FAILED' || job.status === 'DEAD_LETTER') && (
                          <button 
                            onClick={() => cancelJob(job.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                            title="Cancel"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedJob && (
        <JobDetailModal 
          job={selectedJob} 
          onClose={() => setSelectedJob(null)}
          onActionComplete={fetchJobs}
        />
      )}
    </div>
  );
}
