import React from 'react';
import { SupportCase, SupportStatus, SupportPriority } from '../../../types/support';
import { Clock, CheckCircle2, AlertCircle, User, MessageSquare } from 'lucide-react';

interface SupportCaseListProps {
  cases: SupportCase[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function SupportCaseList({ cases, loading, selectedId, onSelect }: SupportCaseListProps) {
  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-slate-500">Memuat data...</div>;
  }

  if (cases.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
        <MessageSquare className="w-12 h-12 text-slate-200 mb-4" />
        <p className="font-medium text-slate-900">Tidak ada tiket bantuan</p>
        <p className="text-sm">Semua tiket telah tertangani atau filter tidak cocok.</p>
      </div>
    );
  }

  const getStatusColor = (status: SupportStatus) => {
    switch (status) {
      case 'OPEN': return 'bg-blue-100 text-blue-700';
      case 'ACKNOWLEDGED': return 'bg-amber-100 text-amber-700';
      case 'RESOLVED': return 'bg-green-100 text-green-700';
      case 'CLOSED': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getPriorityColor = (priority: SupportPriority) => {
    switch (priority) {
      case 'URGENT': return 'text-red-600';
      case 'HIGH': return 'text-amber-600';
      case 'NORMAL': return 'text-blue-600';
      case 'LOW': return 'text-slate-400';
      default: return 'text-slate-600';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="divide-y divide-slate-100">
        {cases.map((c) => (
          <div 
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors border-l-4 ${
              selectedId === c.id ? 'bg-slate-50 border-primary' : 'border-transparent'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">{c.id}</span>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(c.status)}`}>
                  {c.status}
                </span>
                <span className={`text-[10px] font-bold uppercase ${getPriorityColor(c.priority)}`}>
                  {c.priority}
                </span>
              </div>
            </div>
            
            <h4 className="font-bold text-slate-900 line-clamp-1 mb-1">{c.subject}</h4>
            <p className="text-xs text-slate-500 line-clamp-1 mb-3">{c.lastMessagePreview || c.description}</p>
            
            <div className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-2 text-slate-400">
                <User className="w-3 h-3" />
                <span className="font-medium truncate max-w-[120px]">{c.customerName}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <Clock className="w-3 h-3" />
                <span>{new Date(c.updatedAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
