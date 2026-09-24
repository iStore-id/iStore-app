import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth-store';
import { 
  Headset, 
  Plus, 
  MessageSquare, 
  Clock, 
  ChevronRight,
  ArrowLeft,
  Send,
  HelpCircle,
  FileText,
  AlertCircle,
  User
} from 'lucide-react';
import { SupportCase, SupportCategory } from '../types/support';

export default function SupportPage() {
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'LIST' | 'CREATE' | 'DETAIL'>('LIST');
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [newCase, setNewCase] = useState({
    subject: '',
    category: 'OTHER' as SupportCategory,
    description: '',
    orderId: ''
  });
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuthStore();

  const fetchCases = async () => {
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/support/cases', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setCases(data);
    } catch (err) {
      console.error("Failed to fetch cases", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCaseDetail = async (id: string) => {
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/support/cases/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSelectedCase(data);
      setView('DETAIL');
    } catch (err) {
      console.error("Failed to fetch case detail", err);
    }
  };

  useEffect(() => {
    if (user) fetchCases();
  }, [user]);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    try {
      setSubmitting(true);
      const token = await user?.getIdToken();
      const res = await fetch('/api/support/cases', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          ...newCase,
          idempotencyKey: `case-${Date.now()}`
        })
      });
      if (res.ok) {
        setView('LIST');
        fetchCases();
      }
    } catch (err) {
      console.error("Failed to create case", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || submitting) return;
    try {
      setSubmitting(true);
      const token = await user?.getIdToken();
      const res = await fetch(`/api/support/cases/${selectedCase.id}/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          text: replyText,
          idempotencyKey: `reply-${Date.now()}`
        })
      });
      if (res.ok) {
        setReplyText('');
        fetchCaseDetail(selectedCase.id);
      }
    } catch (err) {
      console.error("Failed to send reply", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Headset className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Pusat Bantuan</h2>
        <p className="text-slate-500 mb-8">Silakan masuk untuk melihat tiket bantuan Anda atau membuat laporan baru.</p>
        <a href="/login" className="inline-block w-full bg-primary text-white font-bold py-3 px-6 rounded-xl hover:bg-primary-dark transition-colors">
          Masuk ke Akun
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          {view !== 'LIST' && (
            <button onClick={() => setView('LIST')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </button>
          )}
          <div>
            <h1 className="ui-page-title text-slate-900">Bantuan & Dukungan</h1>
            <p className="text-sm text-slate-500">Kami siap membantu kendala Anda.</p>
          </div>
        </div>
        {view === 'LIST' && (
          <button 
            onClick={() => setView('CREATE')}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-primary-dark transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Buat Tiket
          </button>
        )}
      </div>

      {view === 'LIST' && (
        <div className="space-y-6">
          {/* FAQ Link Card */}
          <a href="/faq" className="flex items-center justify-between p-4 bg-primary/5 border border-primary/10 rounded-2xl group hover:bg-primary/10 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">Butuh jawaban cepat?</p>
                <p className="text-xs text-slate-500">Lihat Pertanyaan Umum (FAQ) untuk solusi instan.</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" />
          </a>

          {/* Cases List */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                Tiket Saya
              </h3>
            </div>
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-sm">Memuat riwayat bantuan...</div>
            ) : cases.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-900">Belum ada tiket bantuan</p>
                <p className="text-xs text-slate-500">Tiket yang Anda buat akan muncul di sini.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {cases.map((c) => (
                  <div 
                    key={c.id} 
                    onClick={() => fetchCaseDetail(c.id)}
                    className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">{c.id}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        c.status === 'OPEN' ? 'bg-brand-100 text-brand-700' :
                        c.status === 'ACKNOWLEDGED' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {c.status}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 group-hover:text-primary transition-colors">{c.subject}</h4>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        Update: {new Date(c.updatedAt).toLocaleDateString()}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1.5">
                        <MessageSquare className="w-3 h-3" />
                        {c.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'CREATE' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm animate-in slide-in-from-bottom-4 duration-300">
          <form onSubmit={handleCreateCase} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Kategori Kendala</label>
                <select 
                  required
                  value={newCase.category}
                  onChange={(e) => setNewCase(prev => ({ ...prev, category: e.target.value as SupportCategory }))}
                  className="w-full p-3 bg-slate-50 border-slate-200 rounded-xl focus:ring-primary focus:border-primary text-sm"
                >
                  <option value="ORDER">Pesanan & Transaksi</option>
                  <option value="PAYMENT">Pembayaran</option>
                  <option value="MEMBERSHIP">Membership VIP</option>
                  <option value="LOYALTY">Poin & Reward</option>
                  <option value="TECHNICAL">Kendala Teknis</option>
                  <option value="ACCOUNT">Akun & Profil</option>
                  <option value="REFUND">Pengembalian Dana (Refund)</option>
                  <option value="OTHER">Lainnya</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">ID Pesanan (Opsional)</label>
                <input 
                  type="text"
                  placeholder="Misal: INV-12345"
                  value={newCase.orderId}
                  onChange={(e) => setNewCase(prev => ({ ...prev, orderId: e.target.value }))}
                  className="w-full p-3 bg-slate-50 border-slate-200 rounded-xl focus:ring-primary focus:border-primary text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Subjek</label>
              <input 
                required
                type="text"
                placeholder="Judul singkat kendala Anda"
                value={newCase.subject}
                onChange={(e) => setNewCase(prev => ({ ...prev, subject: e.target.value }))}
                className="w-full p-3 bg-slate-50 border-slate-200 rounded-xl focus:ring-primary focus:border-primary text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Deskripsi Lengkap</label>
              <textarea 
                required
                placeholder="Ceritakan detail kendala yang Anda alami..."
                rows={5}
                value={newCase.description}
                onChange={(e) => setNewCase(prev => ({ ...prev, description: e.target.value }))}
                className="w-full p-3 bg-slate-50 border-slate-200 rounded-xl focus:ring-primary focus:border-primary text-sm resize-none"
              />
            </div>

            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Tim CS kami akan merespons tiket Anda dalam waktu maksimal 24 jam kerja. Pastikan detail yang Anda berikan sudah benar.
              </p>
            </div>

            <button 
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 shadow-md"
            >
              {submitting ? 'Mengirim...' : 'Kirim Laporan'}
            </button>
          </form>
        </div>
      )}

      {view === 'DETAIL' && selectedCase && (
        <div className="flex flex-col h-[70vh] bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-lg animate-in fade-in zoom-in-95 duration-300">
          {/* Detail Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">{selectedCase.subject}</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{selectedCase.id} • {selectedCase.category}</p>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                selectedCase.status === 'OPEN' ? 'bg-brand-100 text-brand-700' :
                selectedCase.status === 'ACKNOWLEDGED' ? 'bg-amber-100 text-amber-700' :
                'bg-green-100 text-green-700'
              }`}>
                {selectedCase.status}
              </span>
            </div>
          </div>

          {/* Conversation */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/20">
            {/* Initial Case */}
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-bold text-slate-900 text-sm">Saya</span>
                  <span className="text-[10px] text-slate-400">{new Date(selectedCase.createdAt).toLocaleString()}</span>
                </div>
                <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm text-sm text-slate-700">
                  {selectedCase.description}
                </div>
              </div>
            </div>

            {selectedCase.messages?.map((m: any) => (
              <div key={m.id} className={`flex gap-4 ${m.senderType === 'USER' ? '' : 'flex-row-reverse'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  m.senderType === 'USER' ? 'bg-slate-100' : 'bg-primary/10'
                }`}>
                  <User className={`w-5 h-5 ${m.senderType === 'USER' ? 'text-slate-400' : 'text-primary'}`} />
                </div>
                <div className={`flex-1 ${m.senderType === 'USER' ? '' : 'text-right'}`}>
                  <div className={`flex items-baseline gap-2 mb-1 ${m.senderType === 'USER' ? '' : 'justify-end'}`}>
                    <span className="font-bold text-slate-900 text-sm">{m.senderType === 'USER' ? 'Saya' : 'CS Admin'}</span>
                    <span className="text-[10px] text-slate-400">{new Date(m.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div className={`p-4 rounded-2xl text-sm shadow-sm ${
                    m.senderType === 'USER' 
                      ? 'bg-white border border-slate-100 text-slate-700 rounded-tl-none' 
                      : 'bg-primary text-white rounded-tr-none'
                  }`}>
                    {m.text}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Reply Box */}
          {selectedCase.status !== 'CLOSED' && (
            <div className="p-4 border-t border-slate-100 shrink-0 bg-white">
              <div className="relative">
                <textarea 
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Balas pesan..."
                  rows={2}
                  className="w-full p-4 pr-14 border-slate-200 rounded-2xl focus:ring-primary focus:border-primary text-sm resize-none bg-slate-50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                />
                <button 
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || submitting}
                  className="absolute right-3 bottom-3 p-2 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
