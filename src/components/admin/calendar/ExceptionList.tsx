import { useState } from "react";
import { CalendarException } from "../../../types/core";
import { Plus, Edit2, Trash2, Calendar, ShieldAlert, Zap, AlertTriangle } from "lucide-react";
import ExceptionDialog from "./ExceptionDialog";
import { useAuthStore } from "../../../store/auth-store";

interface Props {
  exceptions: CalendarException[];
  onRefresh: () => void;
}

export default function ExceptionList({ exceptions, onRefresh }: Props) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedException, setSelectedException] = useState<CalendarException | undefined>();
  const { user } = useAuthStore();

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus pengecualian ini?")) return;
    
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/calendar/exceptions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'HOLIDAY': return <Calendar className="w-5 h-5 text-red-500" />;
      case 'SPECIAL_OPERATING_DAY': return <Zap className="w-5 h-5 text-yellow-500" />;
      case 'BLACKOUT': return <ShieldAlert className="w-5 h-5 text-gray-700" />;
      case 'MAINTENANCE': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      default: return <Calendar className="w-5 h-5 text-blue-500" />;
    }
  };

  const sortedExceptions = [...exceptions].sort((a, b) => {
    const dateA = a.date || a.startAt || "";
    const dateB = b.date || b.startAt || "";
    return dateB.localeCompare(dateA); // Newest first
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-900">Daftar Pengecualian</h3>
        <button 
          onClick={() => { setSelectedException(undefined); setIsDialogOpen(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Tambah Pengecualian
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Pengecualian</th>
              <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Tipe</th>
              <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Waktu / Tanggal</th>
              <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedExceptions.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-500 italic">
                  Belum ada pengecualian yang dikonfigurasi.
                </td>
              </tr>
            ) : sortedExceptions.map(ex => (
              <tr key={ex.id} className="hover:bg-gray-50/50 group">
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    {getIcon(ex.type)}
                    <div>
                      <div className="font-bold text-gray-900">{ex.name}</div>
                      {ex.reason && <div className="text-xs text-gray-500">{ex.reason}</div>}
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                    {ex.type.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <div className="text-sm text-gray-600">
                    {ex.date ? ex.date : (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-gray-400 font-medium">Dari: {ex.startAt ? new Date(ex.startAt).toLocaleString() : '-'}</span>
                        <span className="text-xs text-gray-400 font-medium">Ke: {ex.endAt ? new Date(ex.endAt).toLocaleString() : '-'}</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-4 px-4">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    ex.isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {ex.isEnabled ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => { setSelectedException(ex); setIsDialogOpen(true); }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => ex.id && handleDelete(ex.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ExceptionDialog 
        isOpen={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)} 
        exception={selectedException}
        onRefresh={onRefresh}
      />
    </div>
  );
}
