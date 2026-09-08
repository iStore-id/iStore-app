import { useState, useEffect } from "react";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  CalendarDays,
  ShieldAlert,
  Loader2
} from "lucide-react";
import { useAuthStore } from "../../store/auth-store";
import { BusinessCalendarConfig, CalendarException } from "../../types/core";
import WeeklyScheduleEditor from "../../components/admin/calendar/WeeklyScheduleEditor";
import ExceptionList from "../../components/admin/calendar/ExceptionList";
import CalendarPreviewTab from "../../components/admin/calendar/CalendarPreviewTab";

export default function AdminCalendarPage() {
  const [activeTab, setActiveTab] = useState<'weekly' | 'exceptions' | 'preview'>('weekly');
  const [config, setConfig] = useState<BusinessCalendarConfig | null>(null);
  const [exceptions, setExceptions] = useState<CalendarException[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const { user } = useAuthStore();

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/admin/calendar/config', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        setConfig(result.data.config);
        setExceptions(result.data.exceptions);
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleSaveConfig = async (newConfig: Partial<BusinessCalendarConfig>) => {
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/admin/calendar/config', {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newConfig)
      });
      const result = await res.json();
      if (result.success) {
        setMessage({ type: 'success', text: 'Konfigurasi kalender berhasil disimpan' });
        fetchData();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
        <p className="text-gray-500">Memuat konfigurasi kalender...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon className="w-8 h-8 text-blue-600" />
            Business Calendar
          </h1>
          <p className="text-gray-500">Kelola waktu operasional, hari libur, dan periode blackout sistem.</p>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-auto text-sm font-medium hover:underline">Tutup</button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span>Error: {error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('weekly')}
            className={`px-6 py-4 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'weekly' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Clock className="w-4 h-4" />
            Jadwal Mingguan
          </button>
          <button
            onClick={() => setActiveTab('exceptions')}
            className={`px-6 py-4 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'exceptions' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Pengecualian & Libur
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-6 py-4 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'preview' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Preview & Status
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'weekly' && config && (
            <WeeklyScheduleEditor config={config} onSave={handleSaveConfig} />
          )}
          {activeTab === 'exceptions' && (
            <ExceptionList exceptions={exceptions} onRefresh={fetchData} />
          )}
          {activeTab === 'preview' && (
            <CalendarPreviewTab />
          )}
        </div>
      </div>
    </div>
  );
}
