import React from 'react';
import { X, Clock, AlertCircle, History, Info } from 'lucide-react';

interface JobDetailModalProps {
  job: any;
  onClose: () => void;
  onActionComplete: () => void;
}

export default function JobDetailModal({ job, onClose, onActionComplete }: JobDetailModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm text-left">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              Job Details
            </h2>
            <p className="text-xs text-slate-500 font-mono uppercase mt-0.5">{job.id}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-w-0">
          {/* Main Info */}
          <div className="grid grid-cols-2 gap-4 min-w-0">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 min-w-0">
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1 whitespace-normal break-words">Type</div>
              <div className="text-sm font-semibold text-slate-900 whitespace-normal break-words">{job.type}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 min-w-0">
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1 whitespace-normal break-words">Status</div>
              <div className="text-sm font-semibold text-slate-900 whitespace-normal break-words">{job.status}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 min-w-0">
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1 whitespace-normal break-words">Priority</div>
              <div className="text-sm font-semibold text-slate-900 whitespace-normal break-words">{job.priority}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 min-w-0">
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1 whitespace-normal break-words">Attempts</div>
              <div className="text-sm font-semibold text-slate-900 whitespace-normal break-words">{job.attempts} / {job.maxAttempts}</div>
            </div>
          </div>

          {/* Payload */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <Clock className="w-4 h-4" />
              Payload Data
            </div>
            <div className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs font-mono overflow-x-auto">
              <pre>{JSON.stringify(job.payload, null, 2)}</pre>
            </div>
          </div>

          {/* Last Error */}
          {job.lastError && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-red-700">
                <AlertCircle className="w-4 h-4" />
                Last Error Message
              </div>
              <div className="bg-red-50 text-red-700 p-4 rounded-xl text-xs font-mono border border-red-100">
                {job.lastError}
              </div>
            </div>
          )}

          {/* Logs */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <History className="w-4 h-4" />
              Execution Logs
            </div>
            <div className="space-y-2">
              {(job.logs || []).slice().reverse().map((log: any, idx: number) => (
                <div key={idx} className="text-xs p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-start gap-3">
                  <span className="text-slate-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className="text-slate-700 flex-1">{log.message}</span>
                </div>
              ))}
              {(!job.logs || job.logs.length === 0) && (
                <div className="text-xs text-slate-400 italic">Belum ada log tersedia.</div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
