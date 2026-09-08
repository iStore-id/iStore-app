import { useState } from "react";
import { BusinessCalendarConfig, DaySchedule } from "../../../types/core";
import { Save, Plus, Trash2, Globe } from "lucide-react";

const DAYS = [
  { id: 1, name: "Senin" },
  { id: 2, name: "Selasa" },
  { id: 3, name: "Rabu" },
  { id: 4, name: "Kamis" },
  { id: 5, name: "Jumat" },
  { id: 6, name: "Sabtu" },
  { id: 0, name: "Minggu" },
];

const TIMEZONES = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "UTC"
];

interface Props {
  config: BusinessCalendarConfig;
  onSave: (config: Partial<BusinessCalendarConfig>) => void;
}

export default function WeeklyScheduleEditor({ config, onSave }: Props) {
  const [schedule, setSchedule] = useState(config.weeklySchedule);
  const [timezone, setTimezone] = useState(config.timezone);

  const toggleDay = (dayId: number) => {
    setSchedule(prev => ({
      ...prev,
      [dayId]: {
        ...prev[dayId],
        isEnabled: !prev[dayId].isEnabled
      }
    }));
  };

  const addWindow = (dayId: number) => {
    setSchedule(prev => ({
      ...prev,
      [dayId]: {
        ...prev[dayId],
        windows: [...prev[dayId].windows, { open: "08:00", close: "22:00" }]
      }
    }));
  };

  const removeWindow = (dayId: number, index: number) => {
    setSchedule(prev => ({
      ...prev,
      [dayId]: {
        ...prev[dayId],
        windows: prev[dayId].windows.filter((_, i) => i !== index)
      }
    }));
  };

  const updateWindow = (dayId: number, index: number, field: 'open' | 'close', value: string) => {
    setSchedule(prev => ({
      ...prev,
      [dayId]: {
        ...prev[dayId],
        windows: prev[dayId].windows.map((w, i) => i === index ? { ...w, [field]: value } : w)
      }
    }));
  };

  return (
    <div className="space-y-8">
      <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-center gap-4">
        <Globe className="w-6 h-6 text-blue-600" />
        <div className="flex-1">
          <label className="block text-sm font-semibold text-blue-900 mb-1">Business Timezone</label>
          <select 
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="bg-white border border-blue-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
        <button 
          onClick={() => onSave({ timezone, weeklySchedule: schedule })}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 transition-colors"
        >
          <Save className="w-4 h-4" />
          Simpan Semua Perubahan
        </button>
      </div>

      <div className="grid gap-6">
        {DAYS.map(day => (
          <div key={day.id} className={`p-4 rounded-xl border transition-all ${
            schedule[day.id]?.isEnabled ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={schedule[day.id]?.isEnabled || false}
                    onChange={() => toggleDay(day.id)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </div>
                <span className={`text-lg font-bold ${schedule[day.id]?.isEnabled ? 'text-gray-900' : 'text-gray-400'}`}>
                  {day.name}
                </span>
              </div>
              
              {schedule[day.id]?.isEnabled && (
                <button 
                  onClick={() => addWindow(day.id)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Jendela Waktu
                </button>
              )}
            </div>

            {schedule[day.id]?.isEnabled && (
              <div className="space-y-3">
                {schedule[day.id].windows.map((window, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Buka</span>
                      <input 
                        type="time" 
                        value={window.open}
                        onChange={(e) => updateWindow(day.id, idx, 'open', e.target.value)}
                        className="bg-white border border-gray-200 rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="w-2 h-px bg-gray-300"></div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Tutup</span>
                      <input 
                        type="time" 
                        value={window.close}
                        onChange={(e) => updateWindow(day.id, idx, 'close', e.target.value)}
                        className="bg-white border border-gray-200 rounded px-2 py-1 text-sm"
                      />
                    </div>
                    {schedule[day.id].windows.length > 1 && (
                      <button 
                        onClick={() => removeWindow(day.id, idx)}
                        className="ml-auto text-red-500 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
