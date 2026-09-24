import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { 
  Bell, 
  Search, 
  Filter, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle, 
  Info,
  Archive,
  ExternalLink,
  ChevronRight,
  MoreVertical,
  Check
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Notification, NotificationStatus, NotificationSeverity, NotificationType } from "../../types/notification";

const SEVERITY_COLORS = {
  INFO: "bg-blue-100 text-blue-700 border-blue-200",
  SUCCESS: "bg-green-100 text-green-700 border-green-200",
  WARNING: "bg-amber-100 text-amber-700 border-amber-200",
  ERROR: "bg-red-100 text-red-700 border-red-200",
  CRITICAL: "bg-red-600 text-white border-red-700"
};

const SEVERITY_ICONS = {
  INFO: Info,
  SUCCESS: CheckCircle,
  WARNING: AlertTriangle,
  ERROR: AlertCircle,
  CRITICAL: AlertCircle
};

export default function AdminNotificationPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<NotificationStatus | "ALL">("ALL");
  const [severityFilter, setSeverityFilter] = useState<NotificationSeverity | "ALL">("ALL");
  const [lastId, setLastId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchNotifications = async (isLoadMore = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (severityFilter !== "ALL") params.append("severity", severityFilter);
      if (isLoadMore && lastId) params.append("lastId", lastId);
      params.append("limit", "20");

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      const res = await fetch(`/api/admin/notifications?${params.toString()}`, {
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
  }, [statusFilter, severityFilter]);

  const markRead = async (id: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      const res = await fetch(`/api/admin/notifications/${id}/read`, {
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
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      const res = await fetch(`/api/admin/notifications/mark-all-read?scope=admin`, {
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="ui-page-title text-gray-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-indigo-600" />
            Notifikasi Sistem
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-600 rounded-full">
                {unreadCount} Baru
              </span>
            )}
          </h1>
          <p className="text-gray-500 mt-1">Pantau alert operasional, exception, dan status sistem real-time.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={markAllRead}
            disabled={unreadCount === 0 || loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Tandai Semua Dibaca
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filter:</span>
        </div>
        
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="text-sm border-gray-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="ALL">Semua Status</option>
          <option value="UNREAD">Belum Dibaca</option>
          <option value="READ">Sudah Dibaca</option>
          <option value="ARCHIVED">Diarsipkan</option>
        </select>

        <select 
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as any)}
          className="text-sm border-gray-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="ALL">Semua Keparahan</option>
          <option value="INFO">Info</option>
          <option value="SUCCESS">Success</option>
          <option value="WARNING">Warning</option>
          <option value="ERROR">Error</option>
          <option value="CRITICAL">Critical</option>
        </select>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {notifications.length === 0 && !loading ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Tidak ada notifikasi</h3>
            <p className="text-gray-500 max-w-xs mx-auto mt-1">
              Semua sistem berjalan normal. Notifikasi operasional akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notif) => {
              const Icon = SEVERITY_ICONS[notif.severity] || Info;
              const isUnread = notif.status === 'UNREAD';
              
              return (
                <div 
                  key={notif.id}
                  className={`p-4 md:p-6 transition-colors flex gap-4 ${isUnread ? 'bg-indigo-50/30' : 'hover:bg-gray-50'}`}
                >
                  <div className={`mt-1 w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${SEVERITY_COLORS[notif.severity]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={`font-semibold ${isUnread ? 'text-gray-900' : 'text-gray-700'}`}>
                            {notif.title}
                          </h3>
                          {isUnread && (
                            <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                          )}
                        </div>
                        <p className={`mt-1 text-sm ${isUnread ? 'text-gray-700' : 'text-gray-500'}`}>
                          {notif.message}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs text-gray-400 block">
                          {format(new Date(notif.createdAt), "dd MMM yyyy, HH:mm", { locale: idLocale })}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {notif.actionUrl && (
                        <a 
                          href={notif.actionUrl}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          Lihat Detail
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      
                      {isUnread && (
                        <button 
                          onClick={() => markRead(notif.id!)}
                          className="text-xs font-medium text-gray-600 hover:text-gray-900 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          Tandai Dibaca
                        </button>
                      )}

                      {notif.relatedEntityId && (
                        <span className="text-xs text-gray-400 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
                          {notif.relatedEntityType}: {notif.relatedEntityId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasMore && (
          <div className="p-4 border-t border-gray-100 text-center">
            <button 
              onClick={() => fetchNotifications(true)}
              disabled={loading}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
            >
              {loading ? "Memuat..." : "Lihat Lebih Banyak"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
