import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/auth-store';
import { 
  Search, 
  Filter, 
  RefreshCw, 
  Headset, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MoreHorizontal,
  User,
  MessageSquare,
  Shield
} from 'lucide-react';
import SupportCaseList from '../../components/admin/support/SupportCaseList';
import SupportCaseDetail from '../../components/admin/support/SupportCaseDetail';
import { SupportCase } from '../../types/support';

export default function AdminSupportPage() {
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    category: '',
    assignedTo: ''
  });
  const { user } = useAuthStore();

  const fetchCases = async () => {
    try {
      setRefreshing(true);
      const token = await user?.getIdToken();
      const params = new URLSearchParams(filters);
      const res = await fetch(`/api/admin/support/cases?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setCases(data);
    } catch (err) {
      console.error("Failed to fetch cases", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [filters]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="ui-page-title text-slate-900 flex items-center gap-2">
            <Headset className="w-7 h-7 text-primary" />
            Support & Ticketing
          </h1>
          <p className="text-slate-500">Pusat bantuan pelanggan dan manajemen tiket bantuan.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchCases}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Left Side: Queue */}
        <div className={`flex-1 flex flex-col gap-4 min-w-0 ${selectedCaseId ? 'hidden lg:flex' : 'flex'}`}>
          {/* Filters */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-4 items-center shrink-0">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
              <Filter className="w-4 h-4 text-slate-400" />
              <select 
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="bg-transparent text-sm border-none focus:ring-0 p-0 font-medium text-slate-700"
              >
                <option value="">Semua Status</option>
                <option value="OPEN">OPEN</option>
                <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
              <Shield className="w-4 h-4 text-slate-400" />
              <select 
                value={filters.priority}
                onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                className="bg-transparent text-sm border-none focus:ring-0 p-0 font-medium text-slate-700"
              >
                <option value="">Semua Prioritas</option>
                <option value="LOW">LOW</option>
                <option value="NORMAL">NORMAL</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>

            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Cari ID, Email, atau Subjek..."
                className="w-full pl-10 pr-4 py-2 text-sm border-slate-200 rounded-xl focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-sm">
            <SupportCaseList 
              cases={cases} 
              loading={loading} 
              selectedId={selectedCaseId}
              onSelect={setSelectedCaseId}
            />
          </div>
        </div>

        {/* Right Side: Detail */}
        {selectedCaseId && (
          <div className="flex-[2] bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-w-0">
            <SupportCaseDetail 
              caseId={selectedCaseId} 
              onClose={() => setSelectedCaseId(null)}
              onUpdate={fetchCases}
            />
          </div>
        )}
      </div>
    </div>
  );
}
