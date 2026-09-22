import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../../store/auth-store';
import { 
  X, 
  Send, 
  Paperclip, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Lock,
  ChevronRight,
  MoreVertical,
  Reply,
  ShieldAlert,
  ArrowLeft
} from 'lucide-react';
import { Support360, SupportMessage, SupportStatus, SupportPriority } from '../../../types/support';
import Support360Sidebar from './Support360Sidebar';

interface SupportCaseDetailProps {
  caseId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export default function SupportCaseDetail({ caseId, onClose, onUpdate }: SupportCaseDetailProps) {
  const [data, setData] = useState<Support360 | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuthStore();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/support/cases/${caseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error("Failed to fetch case detail", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [caseId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.messages]);

  const handleSend = async () => {
    if (!replyText.trim() || submitting) return;
    try {
      setSubmitting(true);
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/support/cases/${caseId}/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          text: replyText,
          isInternal,
          idempotencyKey: `reply-${Date.now()}`
        })
      });
      
      if (res.ok) {
        setReplyText('');
        fetchData();
        onUpdate();
      }
    } catch (err) {
      console.error("Failed to send reply", err);
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (status: SupportStatus) => {
    try {
      const token = await user?.getIdToken();
      await fetch(`/api/admin/support/cases/${caseId}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ status })
      });
      fetchData();
      onUpdate();
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  if (loading || !data) {
    return <div className="flex-1 flex items-center justify-center text-slate-500">Memuat detail tiket...</div>;
  }

  const { case: supportCase, messages } = data as any;

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Detail Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="lg:hidden p-2 hover:bg-slate-50 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-bold text-slate-900 line-clamp-1">{supportCase.subject}</h3>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 uppercase tracking-tighter">
                {supportCase.id}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><User className="w-3 h-3" /> {supportCase.customerName}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(supportCase.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {supportCase.status !== 'RESOLVED' && supportCase.status !== 'CLOSED' && (
            <button 
              onClick={() => updateStatus('RESOLVED')}
              className="px-3 py-1.5 bg-green-50 text-green-700 text-xs font-bold rounded-lg hover:bg-green-100 border border-green-100 transition-colors"
            >
              Resolve
            </button>
          )}
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-lg hidden lg:block">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Messages & Composer */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50/30">
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* System Description Message */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 max-w-[85%]">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-sm font-bold text-slate-900">{supportCase.customerName}</span>
                  <span className="text-[10px] text-slate-400">Original Request</span>
                </div>
                <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm text-sm text-slate-700 whitespace-pre-wrap">
                  {supportCase.description}
                </div>
              </div>
            </div>

            {/* Conversation Messages */}
            {messages.map((m: any) => (
              <div key={m.id} className={`flex gap-3 ${m.senderType === 'USER' ? '' : 'flex-row-reverse'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  m.isInternal ? 'bg-amber-100' : (m.senderType === 'USER' ? 'bg-blue-100' : 'bg-primary/10')
                }`}>
                  {m.isInternal ? <Lock className="w-4 h-4 text-amber-600" /> : <User className={`w-4 h-4 ${m.senderType === 'USER' ? 'text-blue-600' : 'text-primary'}`} />}
                </div>
                <div className={`flex-1 max-w-[85%] ${m.senderType === 'USER' ? '' : 'text-right'}`}>
                  <div className={`flex items-baseline gap-2 mb-1 ${m.senderType === 'USER' ? '' : 'justify-end'}`}>
                    <span className="text-sm font-bold text-slate-900">{m.senderName}</span>
                    <span className="text-[10px] text-slate-400">{new Date(m.createdAt).toLocaleTimeString()}</span>
                    {m.isInternal && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1 rounded uppercase tracking-tighter">Internal Note</span>}
                  </div>
                  <div className={`p-4 rounded-2xl text-sm whitespace-pre-wrap shadow-sm border ${
                    m.isInternal 
                      ? 'bg-amber-50 border-amber-100 text-amber-900 rounded-tr-none' 
                      : (m.senderType === 'USER' ? 'bg-white border-slate-100 text-slate-700 rounded-tl-none' : 'bg-primary text-white border-primary rounded-tr-none')
                  }`}>
                    {m.text}
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Composer */}
          <div className="p-4 bg-white border-t border-slate-100 shrink-0">
            <div className="flex items-center gap-4 mb-3">
              <button 
                onClick={() => setIsInternal(false)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${!isInternal ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-100'}`}
              >
                Public Reply
              </button>
              <button 
                onClick={() => setIsInternal(true)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors ${isInternal ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:bg-slate-100'}`}
              >
                <Lock className="w-3 h-3" />
                Internal Note
              </button>
            </div>
            <div className="relative group">
              <textarea 
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={isInternal ? "Tulis catatan internal yang hanya bisa dilihat oleh agen..." : "Tulis balasan untuk pelanggan..."}
                className={`w-full p-4 pr-12 text-sm border rounded-2xl focus:ring-2 resize-none transition-all ${
                  isInternal 
                    ? 'border-amber-200 focus:ring-amber-200 bg-amber-50/30' 
                    : 'border-slate-200 focus:ring-primary/20 bg-white'
                }`}
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button 
                onClick={handleSend}
                disabled={!replyText.trim() || submitting}
                className={`absolute right-3 bottom-3 p-2 rounded-xl transition-all disabled:opacity-50 ${
                  isInternal ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-primary hover:bg-primary-dark text-white'
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
              <span>Press Enter to send, Shift+Enter for new line</span>
              <button className="flex items-center gap-1 hover:text-slate-600 transition-colors">
                <Paperclip className="w-3 h-3" />
                Attach files (Images only)
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar: Customer 360 */}
        <div className="w-80 border-l border-slate-100 hidden xl:flex flex-col shrink-0">
          <Support360Sidebar context={data} />
        </div>
      </div>
    </div>
  );
}
