import { useState } from "react";
import { useAuthStore } from "../../../store/auth-store";
import { Clock, Search, CheckCircle2, XCircle, Info, Loader2 } from "lucide-react";

export default function CalendarPreviewTab() {
  const [timestamp, setTimestamp] = useState(new Date().toISOString().slice(0, 16));
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  const handleTest = async () => {
    setLoading(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/calendar/preview?timestamp=${new Date(timestamp).toISOString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Simulasi Kalender Bisnis</h3>
        <p className="text-gray-500 text-sm">Uji kebijakan operasional untuk tanggal dan waktu tertentu secara server-side.</p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            Pilih Waktu Simulasi
          </label>
          <div className="flex gap-3">
            <input 
              type="datetime-local" 
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button 
              onClick={handleTest}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-all"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              Uji Status
            </button>
          </div>
        </div>

        {result && (
          <div className={`p-6 rounded-2xl border-2 animate-in fade-in slide-in-from-top-4 duration-300 ${
            result.isOpen ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'
          }`}>
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${result.isOpen ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700'}`}>
                {result.isOpen ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
              </div>
              <div className="flex-1">
                <div className="text-2xl font-black uppercase tracking-tight mb-1">
                  {result.isOpen ? 'OPEN' : 'CLOSED'}
                </div>
                <div className="text-sm font-medium opacity-80 mb-4">
                  {result.isOpen ? 'Sistem beroperasi normal sesuai jadwal.' : (result.reason || 'Sistem tidak beroperasi pada waktu ini.')}
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-black/5">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Simulated Time</div>
                    <div className="text-xs font-mono font-bold">{new Date(result.timestamp).toLocaleString()}</div>
                  </div>
                  {result.nextEvent && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Next Event</div>
                      <div className="text-xs font-mono font-bold">{result.nextEvent}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gray-50 p-4 rounded-xl flex gap-3 border border-gray-100">
          <Info className="w-5 h-5 text-gray-400 shrink-0" />
          <div className="text-xs text-gray-500 leading-relaxed">
            Status operasional ditentukan berdasarkan prioritas: <br/>
            <span className="font-bold">Blackout</span> &gt; <span className="font-bold">Holiday</span> &gt; <span className="font-bold">Special Day</span> &gt; <span className="font-bold">Weekly Schedule</span>.
          </div>
        </div>
      </div>
    </div>
  );
}
