import React, { useState, useEffect } from "react";
import { 
  Bell, 
  Check, 
  Trash2, 
  Inbox,
  ExternalLink,
  ChevronLeft
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Notification } from "../types/notification";

export default function NotificationPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastId, setLastId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const navigate = useNavigate();

  const fetchNotifications = async (isLoadMore = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (isLoadMore && lastId) params.append("lastId", lastId);
      params.append("limit", "20");

      const token = await (window as any).firebaseAuth?.currentUser?.getIdToken();
      const res = await fetch(`/api/customer/notifications?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.success) {
        if (isLoadMore) {
          setNotifications(prev => [...prev, ...data.data.notifications]);
        } else {
          setNotifications(data.data.notifications);
        }
        setUnreadCount(data.data.unreadCount);
        setHasMore(data.data.notifications.length === 20);
        if (data.data.notifications.length > 0) {
          setLastId(data.data.notifications[data.data.notifications.length - 1].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markRead = async (id: string) => {
    try {
      const token = await (window as any).firebaseAuth?.currentUser?.getIdToken();
      const res = await fetch(`/api/customer/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'READ' } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to mark read:", error);
    }
  };

  const markAllRead = async () => {
    try {
      const token = await (window as any).firebaseAuth?.currentUser?.getIdToken();
      const res = await fetch(`/api/customer/notifications/mark-all-read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, status: 'READ' })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Failed to mark all read:", error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-white rounded-xl transition-colors border border-transparent hover:border-slate-200"
        >
          <ChevronLeft className="w-6 h-6 text-slate-600" />
        </button>
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            Notifikasi Saya
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-blue-600 text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Update pesanan, pembayaran, dan promo terbaru.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-bold text-slate-700">Kotak Masuk</span>
          </div>
          {unreadCount > 0 && (
            <button 
              onClick={markAllRead}
              className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors"
            >
              <Check className="w-4 h-4" />
              Tandai Semua Dibaca
            </button>
          )}
        </div>

        {notifications.length === 0 && !loading ? (
          <div className="py-20 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Inbox className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Belum Ada Notifikasi</h3>
            <p className="text-slate-500 max-w-xs mx-auto mt-2 font-medium">
              Kami akan memberitahumu di sini saat ada pembaruan pada pesananmu.
            </p>
            <Link 
              to="/"
              className="mt-8 inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-bold rounded-2xl text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
            >
              Mulai Belanja
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {notifications.map((notif) => {
              const isUnread = notif.status === 'UNREAD';
              
              return (
                <div 
                  key={notif.id}
                  className={`p-6 transition-all flex gap-5 ${isUnread ? 'bg-blue-50/30 border-l-4 border-l-blue-600' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={`text-lg font-bold ${isUnread ? 'text-slate-900' : 'text-slate-600'}`}>
                            {notif.title}
                          </h3>
                        </div>
                        <p className={`mt-1.5 text-base leading-relaxed ${isUnread ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                          {notif.message}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-slate-400">
                          {format(new Date(notif.createdAt), "dd MMM, HH:mm", { locale: idLocale })}
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-4">
                      {notif.actionUrl && (
                        <Link 
                          to={notif.actionUrl}
                          className="inline-flex items-center gap-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-2xl transition-all shadow-md shadow-blue-100"
                        >
                          Lihat Detail
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      )}
                      
                      {isUnread && (
                        <button 
                          onClick={() => markRead(notif.id!)}
                          className="text-sm font-bold text-slate-600 hover:text-slate-900 px-4 py-2.5 rounded-2xl hover:bg-slate-100 transition-colors"
                        >
                          Tandai Dibaca
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasMore && (
          <div className="p-6 border-t border-slate-50 text-center bg-slate-50/10">
            <button 
              onClick={() => fetchNotifications(true)}
              disabled={loading}
              className="text-base font-bold text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Memuat..." : "Muat Lebih Banyak"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
