import { useState, useEffect, FormEvent } from "react";
import { CalendarException, TimeWindow, CalendarExceptionType } from "../../../types/core";
import { X, Save, Plus, Trash2 } from "lucide-react";
import { useAuthStore } from "../../../store/auth-store";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  exception?: CalendarException;
  onRefresh: () => void;
}

export default function ExceptionDialog({ isOpen, onClose, exception, onRefresh }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CalendarExceptionType>('HOLIDAY');
  const [date, setDate] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [reason, setReason] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [windows, setWindows] = useState<TimeWindow[]>([{ open: "08:00", close: "22:00" }]);
  const [loading, setLoading] = useState(false);
  
  const { user } = useAuthStore();

  useEffect(() => {
    if (exception) {
      setName(exception.name);
      setType(exception.type);
      setDate(exception.date || "");
      setStartAt(exception.startAt ? new Date(exception.startAt).toISOString().slice(0, 16) : "");
      setEndAt(exception.endAt ? new Date(exception.endAt).toISOString().slice(0, 16) : "");
      setReason(exception.reason || "");
      setIsEnabled(exception.isEnabled);
      setWindows(exception.windows || [{ open: "08:00", close: "22:00" }]);
    } else {
      setName("");
      setType('HOLIDAY');
      setDate("");
      setStartAt("");
      setEndAt("");
      setReason("");
      setIsEnabled(true);
      setWindows([{ open: "08:00", close: "22:00" }]);
    }
  }, [exception, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = await user?.getIdToken();
      const payload: Partial<CalendarException> = {
        id: exception?.id,
        name,
        type,
        date: type === 'HOLIDAY' || type === 'SPECIAL_OPERATING_DAY' ? date : undefined,
        startAt: type === 'BLACKOUT' || type === 'MAINTENANCE' ? new Date(startAt).toISOString() : undefined,
        endAt: type === 'BLACKOUT' || type === 'MAINTENANCE' ? new Date(endAt).toISOString() : undefined,
        reason,
        isEnabled,
        windows: type === 'SPECIAL_OPERATING_DAY' ? windows : undefined
      };

      const res = await fetch('/api/admin/calendar/exceptions', {
        method: exception?.id ? 'PUT' : 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (result.success) {
        onRefresh();
        onClose();
      } else {
        alert(result.message);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addWindow = () => setWindows([...windows, { open: "08:00", close: "22:00" }]);
  const removeWindow = (idx: number) => setWindows(windows.filter((_, i) => i !== idx));
  const updateWindow = (idx: number, field: 'open' | 'close', val: string) => {
    setWindows(windows.map((w, i) => i === idx ? { ...w, [field]: val } : w));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">
            {exception ? 'Edit Pengecualian' : 'Tambah Pengecualian'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700">Nama Pengecualian</label>
            <input 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Idul Fitri, Maintenance Server"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-700">Tipe</label>
              <select 
                value={type}
                onChange={(e) => setType(e.target.value as CalendarExceptionType)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm"
              >
                <option value="HOLIDAY">Holiday (Closed)</option>
                <option value="SPECIAL_OPERATING_DAY">Special Operating Day</option>
                <option value="BLACKOUT">Blackout Period</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
            <div className="space-y-1 flex items-end">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input 
                  type="checkbox" 
                  checked={isEnabled} 
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-semibold text-gray-700">Enabled</span>
              </label>
            </div>
          </div>

          {(type === 'HOLIDAY' || type === 'SPECIAL_OPERATING_DAY') && (
            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-700">Tanggal</label>
              <input 
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm"
              />
            </div>
          )}

          {(type === 'BLACKOUT' || type === 'MAINTENANCE') && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">Mulai</label>
                <input 
                  type="datetime-local"
                  required
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">Selesai</label>
                <input 
                  type="datetime-local"
                  required
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {type === 'SPECIAL_OPERATING_DAY' && (
            <div className="space-y-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-blue-900">Jendela Operasional Khusus</label>
                <button 
                  type="button"
                  onClick={addWindow}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  + Tambah
                </button>
              </div>
              {windows.map((w, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input type="time" value={w.open} onChange={(e) => updateWindow(idx, 'open', e.target.value)} className="flex-1 bg-white border border-blue-200 rounded p-1 text-sm" />
                  <span className="text-gray-400">-</span>
                  <input type="time" value={w.close} onChange={(e) => updateWindow(idx, 'close', e.target.value)} className="flex-1 bg-white border border-blue-200 rounded p-1 text-sm" />
                  {windows.length > 1 && (
                    <button type="button" onClick={() => removeWindow(idx)} className="text-red-500 p-1"><Trash2 className="w-3 h-3" /></button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700">Alasan / Catatan</label>
            <textarea 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </form>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white transition-colors"
          >
            Batal
          </button>
          <button 
            type="submit"
            disabled={loading}
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <span className="animate-spin">⌛</span> : <Save className="w-4 h-4" />}
            Simpan Pengecualian
          </button>
        </div>
      </div>
    </div>
  );
}
