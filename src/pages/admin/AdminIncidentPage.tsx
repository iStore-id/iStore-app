import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { 
  AlertTriangle, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  User, 
  MoreVertical,
  ExternalLink,
  ShieldAlert,
  History,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Incident, IncidentStatus, IncidentSeverity, IncidentCategory } from "../../types/incident";

const SEVERITY_COLORS = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
  LOW: "bg-blue-100 text-blue-700 border-blue-200",
  INFO: "bg-gray-100 text-gray-700 border-gray-200"
};

const STATUS_COLORS = {
  OPEN: "bg-red-50 text-red-600 border-red-100",
  ACKNOWLEDGED: "bg-blue-50 text-blue-600 border-blue-100",
  RESOLVED: "bg-green-50 text-green-600 border-green-100",
  CLOSED: "bg-gray-50 text-gray-600 border-gray-100"
};

const CATEGORY_ICONS: Record<string, any> = {
  APPLICATION: ShieldAlert,
  DATABASE: History,
  AUTHENTICATION: User,
  PAYMENT: AlertCircle,
  PROVIDER: ExternalLink,
  QUEUE: Clock,
  DEFAULT: AlertTriangle
};

export default function AdminIncidentPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ status?: IncidentStatus; severity?: IncidentSeverity }>({});
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      const params = new URLSearchParams(filter as any);
      const res = await fetch(`/api/admin/incidents?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setIncidents(data.data.incidents);
        setSummary(data.data.summary);
      }
    } catch (error) {
      console.error("Failed to fetch incidents:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [filter]);

  const handleAction = async (action: 'acknowledge' | 'resolve' | 'close', id: string) => {
    try {
      setProcessing(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      const res = await fetch(`/api/admin/incidents/${id}/${action}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ note: resolutionNote })
      });
      const data = await res.json();
      if (data.success) {
        setResolutionNote("");
        setSelectedIncident(null);
        fetchIncidents();
      }
    } catch (error) {
      console.error(`Failed to ${action} incident:`, error);
    } finally {
      setProcessing(false);
    }
  };

  if (loading && !incidents.length) {
    return <div className="flex items-center justify-center h-64">Loading incidents...</div>;
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="ui-page-title text-gray-900 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-600" />
            Incident Management
          </h1>
          <p className="text-gray-500 mt-1">Pantau dan kelola insiden operasional platform.</p>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-red-50 p-4 rounded-3xl border border-red-100">
            <div className="text-[10px] font-black text-red-400 uppercase tracking-widest">Open Critical</div>
            <div className="text-3xl font-black text-red-600 mt-1">{summary.openCritical}</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-3xl border border-orange-100">
            <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Open High</div>
            <div className="text-3xl font-black text-orange-600 mt-1">{summary.openHigh}</div>
          </div>
          <div className="bg-amber-50 p-4 rounded-3xl border border-amber-100">
            <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Open Medium</div>
            <div className="text-3xl font-black text-amber-600 mt-1">{summary.openMedium}</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-3xl border border-blue-100">
            <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Acknowledged</div>
            <div className="text-3xl font-black text-blue-600 mt-1">{summary.acknowledged}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Open</div>
            <div className="text-3xl font-black text-gray-600 mt-1">{summary.totalOpen}</div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <select 
          className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700"
          value={filter.status || ""}
          onChange={(e) => setFilter({ ...filter, status: (e.target.value as any) || undefined })}
        >
          <option value="">Semua Status</option>
          <option value="OPEN">Open</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select 
          className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700"
          value={filter.severity || ""}
          onChange={(e) => setFilter({ ...filter, severity: (e.target.value as any) || undefined })}
        >
          <option value="">Semua Severity</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <th className="px-6 py-4">Incident</th>
              <th className="px-6 py-4">Severity</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Detected At</th>
              <th className="px-6 py-4">Assignment</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-sm">
            {incidents.map((incident) => {
              const Icon = CATEGORY_ICONS[incident.category] || CATEGORY_ICONS.DEFAULT;
              return (
                <tr key={incident.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-gray-50 rounded-xl group-hover:bg-white transition-colors">
                        <Icon className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 leading-tight">{incident.title}</div>
                        <div className="text-[11px] text-gray-400 mt-1 font-medium">{incident.source} &middot; {incident.component}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${SEVERITY_COLORS[incident.severity]}`}>
                      {incident.severity}
                    </span>
                  </td>
                  <td className="px-6 py-5 font-bold text-gray-600 text-xs">
                    {incident.category}
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${STATUS_COLORS[incident.status]}`}>
                      {incident.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-[11px] text-gray-500 font-bold">
                    {format(new Date(incident.detectedAt), "dd MMM, HH:mm", { locale: idLocale })}
                  </td>
                  <td className="px-6 py-5 text-xs text-gray-600 font-bold">
                    {incident.assignedTo || "Unassigned"}
                  </td>
                  <td className="px-6 py-5">
                    <button 
                      onClick={() => setSelectedIncident(incident)}
                      className="px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-black text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm"
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!incidents.length && (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <h3 className="mt-4 text-lg font-bold text-gray-900">No Incidents Found</h3>
            <p className="text-gray-500 mt-1">Semua sistem berjalan dengan normal.</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-8 space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${SEVERITY_COLORS[selectedIncident.severity]}`}>
                      {selectedIncident.severity}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${STATUS_COLORS[selectedIncident.status]}`}>
                      {selectedIncident.status}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 mt-3">{selectedIncident.title}</h2>
                </div>
                <button onClick={() => setSelectedIncident(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <XCircle className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6 p-6 bg-gray-50 rounded-3xl border border-gray-100">
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Source</div>
                  <div className="text-sm font-bold text-gray-700 mt-1">{selectedIncident.source}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Component</div>
                  <div className="text-sm font-bold text-gray-700 mt-1">{selectedIncident.component}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Detected At</div>
                  <div className="text-sm font-bold text-gray-700 mt-1">
                    {format(new Date(selectedIncident.detectedAt), "dd MMMM yyyy, HH:mm:ss", { locale: idLocale })}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Incident ID</div>
                  <div className="text-xs font-mono text-gray-500 mt-1 truncate">{selectedIncident.id}</div>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Description</div>
                <div className="p-4 bg-white border border-gray-100 rounded-2xl text-sm text-gray-600 leading-relaxed font-medium">
                  {selectedIncident.description}
                </div>
              </div>

              {selectedIncident.resolutionNote && (
                <div>
                  <div className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-2">Resolution Note</div>
                  <div className="p-4 bg-green-50/50 border border-green-100 rounded-2xl text-sm text-green-700 leading-relaxed font-medium">
                    {selectedIncident.resolutionNote}
                  </div>
                </div>
              )}

              {selectedIncident.status !== 'RESOLVED' && selectedIncident.status !== 'CLOSED' && (
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Resolusi Manual</div>
                  <textarea 
                    className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24"
                    placeholder="Masukkan catatan resolusi..."
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                  />
                  <div className="flex gap-3">
                    {selectedIncident.status === 'OPEN' && (
                      <button 
                        onClick={() => handleAction('acknowledge', selectedIncident.id)}
                        disabled={processing}
                        className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button 
                      onClick={() => handleAction('resolve', selectedIncident.id)}
                      disabled={processing || !resolutionNote}
                      className="flex-1 px-6 py-3 bg-green-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-green-200 hover:bg-green-700 transition-all disabled:opacity-50"
                    >
                      Resolve Incident
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
