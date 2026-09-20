import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Bell, Check, ExternalLink, Inbox } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Notification } from "../types/notification";
import { motion, AnimatePresence } from "motion/react";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      const res = await fetch('/api/customer/notifications?limit=5', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data.notifications);
        setUnreadCount(data.data.unreadCount);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Refresh every 2 minutes
    const interval = setInterval(fetchNotifications, 120000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAllRead = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      await fetch('/api/customer/notifications/mark-all-read', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, status: 'READ' })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all read:", error);
    }
  };

  const markRead = async (id: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      await fetch(`/api/customer/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'READ' } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark read:", error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-primary hover:bg-brand-50 rounded-full transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden"
          >
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-gray-900">Notifikasi</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs font-medium text-primary hover:text-primary flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  Tandai semua dibaca
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-10 text-center">
                  <Inbox className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Tidak ada notifikasi baru</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-4 hover:bg-gray-50 transition-colors flex gap-3 ${notif.status === 'UNREAD' ? 'bg-brand-50/20' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className={`text-sm font-semibold truncate ${notif.status === 'UNREAD' ? 'text-gray-900' : 'text-gray-600'}`}>
                            {notif.title}
                          </h4>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">
                            {format(new Date(notif.createdAt), "HH:mm", { locale: idLocale })}
                          </span>
                        </div>
                        <p className={`mt-0.5 text-xs line-clamp-2 ${notif.status === 'UNREAD' ? 'text-gray-700' : 'text-gray-500'}`}>
                          {notif.message}
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                          {notif.actionUrl && (
                            <Link
                              to={notif.actionUrl}
                              onClick={() => setIsOpen(false)}
                              className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline"
                            >
                              Lihat
                              <ExternalLink className="w-2.5 h-2.5" />
                            </Link>
                          )}
                          {notif.status === 'UNREAD' && (
                            <button
                              onClick={() => markRead(notif.id!)}
                              className="text-[11px] font-medium text-gray-400 hover:text-gray-600"
                            >
                              Tandai dibaca
                            </button>
                          )}
                        </div>
                      </div>
                      {notif.status === 'UNREAD' && (
                        <div className="mt-1">
                          <div className="w-2 h-2 bg-primary rounded-full"></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="block p-4 text-center text-sm font-bold text-primary hover:bg-gray-50 border-t border-gray-100 transition-colors"
            >
              Lihat Semua Notifikasi
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
