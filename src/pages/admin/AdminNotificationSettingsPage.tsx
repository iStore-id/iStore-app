import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../store/auth-store";
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Save,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Info,
  ShieldAlert,
  ArrowRight,
  Settings,
  XCircle
} from "lucide-react";
import { NotificationType } from "../../types/notification";

interface ChannelConfig {
  enabled: boolean;
  status: "ACTIVE" | "NOT_CONFIGURED";
}

interface NotificationSettings {
  id: string;
  channels: {
    IN_APP: ChannelConfig;
    EMAIL: ChannelConfig;
    WHATSAPP: ChannelConfig;
    PUSH: ChannelConfig;
  };
  events: Record<NotificationType, boolean>;
  updatedAt?: string;
  updatedBy?: string;
}

export default function AdminNotificationSettingsPage() {
  const { user } = useAuthStore();

  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [initialSettings, setInitialSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/notification-settings", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const json = await res.json();
      if (json.success && json.data) {
        setSettings(json.data);
        // Deep copy for dirty state comparison
        setInitialSettings(JSON.parse(JSON.stringify(json.data)));
      } else {
        setMessage({ type: "error", text: json.message || "Gagal memuat konfigurasi notifikasi." });
      }
    } catch (err: any) {
      console.error("Fetch settings error:", err);
      setMessage({ type: "error", text: "Terjadi kesalahan jaringan saat memuat konfigurasi." });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      setMessage(null);
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/notification-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(settings)
      });
      const json = await res.json();
      if (json.success && json.data) {
        setSettings(json.data);
        setInitialSettings(JSON.parse(JSON.stringify(json.data)));
        setMessage({ type: "success", text: "Konfigurasi notifikasi berhasil disimpan dan diterapkan!" });
      } else {
        setMessage({ type: "error", text: json.message || "Gagal menyimpan konfigurasi." });
      }
    } catch (err: any) {
      console.error("Save settings error:", err);
      setMessage({ type: "error", text: "Terjadi kesalahan jaringan saat menyimpan konfigurasi." });
    } finally {
      setSaving(false);
    }
  };

  const isDirty = () => {
    if (!settings || !initialSettings) return false;
    return JSON.stringify(settings) !== JSON.stringify(initialSettings);
  };

  const toggleChannel = (key: keyof NotificationSettings["channels"]) => {
    if (!settings) return;
    // External channels (EMAIL, WHATSAPP, PUSH) are NOT_CONFIGURED, so we prevent toggling or show notice.
    if (settings.channels[key].status === "NOT_CONFIGURED") {
      return;
    }
    setSettings({
      ...settings,
      channels: {
        ...settings.channels,
        [key]: {
          ...settings.channels[key],
          enabled: !settings.channels[key].enabled
        }
      }
    });
  };

  const toggleEvent = (type: NotificationType) => {
    if (!settings) return;
    setSettings({
      ...settings,
      events: {
        ...settings.events,
        [type]: !settings.events[type]
      }
    });
  };

  const setAllEvents = (status: boolean, filterType: "customer" | "admin") => {
    if (!settings) return;
    const newEvents = { ...settings.events };
    
    const customerTypes: NotificationType[] = [
      'ORDER_CREATED', 'PAYMENT_CONFIRMED', 'PAYMENT_FAILED', 'ORDER_PROCESSING', 
      'ORDER_SUCCESS', 'ORDER_FAILED', 'ORDER_EXPIRED', 'REFUND_PROCESSING', 
      'REFUND_SUCCESS', 'REFUND_FAILED'
    ];
    const adminTypes: NotificationType[] = [
      'REFUND_EXCEPTION', 'FAILED_ORDER_ALERT', 'PAYMENT_EXCEPTION', 'FULFILLMENT_EXCEPTION', 
      'QUEUE_DEAD_LETTER', 'SLA_BREACH', 'INCIDENT_OPENED', 'INCIDENT_ACKNOWLEDGED', 
      'INCIDENT_RESOLVED', 'STOCK_ALERT', 'SYSTEM_ALERT'
    ];

    const targets = filterType === "customer" ? customerTypes : adminTypes;
    targets.forEach(t => {
      newEvents[t] = status;
    });

    setSettings({
      ...settings,
      events: newEvents
    });
  };

  const customerEventsList: { type: NotificationType; label: string; desc: string }[] = [
    { type: "ORDER_CREATED", label: "Pesanan Dibuat", desc: "Dikirim ke pelanggan saat pesanan baru berhasil dibuat." },
    { type: "PAYMENT_CONFIRMED", label: "Pembayaran Dikonfirmasi", desc: "Dikirim saat pembayaran pesanan dikonfirmasi oleh Payment Gateway." },
    { type: "PAYMENT_FAILED", label: "Pembayaran Gagal", desc: "Dikirim jika transaksi pembayaran pesanan dinyatakan gagal." },
    { type: "ORDER_PROCESSING", label: "Pesanan Diproses", desc: "Dikirim saat pesanan beralih status ke pemrosesan/antrean otomatis." },
    { type: "ORDER_SUCCESS", label: "Pesanan Sukses", desc: "Dikirim setelah top-up/pengiriman voucher sukses dilakukan." },
    { type: "ORDER_FAILED", label: "Pesanan Gagal", desc: "Dikirim jika proses pengisian pesanan mengalami kegagalan sistem." },
    { type: "ORDER_EXPIRED", label: "Pesanan Kedaluwarsa", desc: "Dikirim jika batas waktu pembayaran pesanan terlampaui." },
    { type: "REFUND_PROCESSING", label: "Refund Diproses", desc: "Dikirim saat permohonan refund dana mulai diproses." },
    { type: "REFUND_SUCCESS", label: "Refund Sukses", desc: "Dikirim setelah dana refund berhasil dikembalikan ke saldo pelanggan." },
    { type: "REFUND_FAILED", label: "Refund Gagal", desc: "Dikirim jika pengembalian dana mengalami kegagalan transfer." }
  ];

  const adminEventsList: { type: NotificationType; label: string; desc: string; severity: string }[] = [
    { type: "REFUND_EXCEPTION", label: "Pengecualian Refund", desc: "Notifikasi anomali refund yang membutuhkan verifikasi manual admin.", severity: "ERROR" },
    { type: "FAILED_ORDER_ALERT", label: "Pemberitahuan Pesanan Gagal", desc: "Notifikasi darurat ketika pesanan mengalami kegagalan eksekusi provider.", severity: "ERROR" },
    { type: "PAYMENT_EXCEPTION", label: "Pengecualian Pembayaran", desc: "Terjadi anomali pada status pembayaran dari payment gateway.", severity: "CRITICAL" },
    { type: "FULFILLMENT_EXCEPTION", label: "Pengecualian Pemenuhan", desc: "Terjadi hambatan koneksi atau kegagalan API provider top-up.", severity: "CRITICAL" },
    { type: "QUEUE_DEAD_LETTER", label: "Dead-Letter Queue (DLQ)", desc: "Antrean tugas otomatis gagal setelah dicoba beberapa kali.", severity: "CRITICAL" },
    { type: "SLA_BREACH", label: "Pelanggaran SLA", desc: "Pesanan melebihi batas waktu penanganan (SLA) yang disepakati.", severity: "WARNING" },
    { type: "INCIDENT_OPENED", label: "Insiden Baru Dibuka", desc: "Laporan insiden operasional atau masalah sistem baru dibuka.", severity: "WARNING" },
    { type: "INCIDENT_ACKNOWLEDGED", label: "Insiden Ditanggapi", desc: "Insiden sistem telah ditugaskan dan ditanggapi oleh tim dukungan.", severity: "INFO" },
    { type: "INCIDENT_RESOLVED", label: "Insiden Selesai", desc: "Insiden sistem telah berhasil diselesaikan dan dinormalisasi.", severity: "INFO" },
    { type: "STOCK_ALERT", label: "Peringatan Stok Rendah", desc: "Stok produk atau sisa saldo provider berada di bawah ambang batas minimum.", severity: "WARNING" },
    { type: "SYSTEM_ALERT", label: "Peringatan Sistem", desc: "Notifikasi kesehatan sistem umum atau restart komponen krusial.", severity: "INFO" }
  ];

  if (loading) {
    return (
      <div id="loading-container" className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <RefreshCw className="h-8 w-8 text-neutral-400 animate-spin" />
        <p className="text-sm text-neutral-500 font-medium">Memuat pengaturan notifikasi...</p>
      </div>
    );
  }

  return (
    <div id="notification-settings-page" className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div id="page-header" className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-neutral-100 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings className="h-5 w-5 text-neutral-400" />
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Pengaturan</span>
          </div>
          <h1 className="ui-page-title text-neutral-900">Konfigurasi Notifikasi</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Kelola saluran pengiriman dan pilih event sistem apa saja yang aktif mengirimkan notifikasi.
          </p>
        </div>
        
        {/* Action Button */}
        <div className="flex items-center gap-3">
          {isDirty() && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-medium border border-amber-100 animate-pulse">
              Ada Perubahan Belum Disimpan
            </span>
          )}
          <button
            id="btn-save-settings"
            onClick={handleSave}
            disabled={saving || !isDirty()}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              isDirty() 
                ? "bg-neutral-900 text-white hover:bg-neutral-800 shadow-md shadow-neutral-200" 
                : "bg-neutral-100 text-neutral-400 cursor-not-allowed"
            }`}
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Simpan Perubahan
          </button>
        </div>
      </div>

      {/* Message Notifications */}
      {message && (
        <div
          id="alert-message"
          className={`flex items-start gap-3 p-4 rounded-xl border ${
            message.type === "success" 
              ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
              : "bg-rose-50 border-rose-100 text-rose-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="text-sm">
            <p className="font-semibold">{message.type === "success" ? "Berhasil" : "Gagal"}</p>
            <p className="text-neutral-600 mt-0.5">{message.text}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Communication Channels */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-neutral-100 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight mb-4 flex items-center gap-2">
              <span>Saluran Komunikasi</span>
            </h2>
            <p className="text-xs text-neutral-400 leading-relaxed mb-6">
              Konfigurasi saluran pengiriman notifikasi yang didukung oleh platform iStore.id.
            </p>

            <div className="space-y-4">
              
              {/* IN-APP */}
              <div className="p-4 rounded-xl border border-neutral-100 bg-neutral-50/50 flex items-start gap-3.5 transition-all">
                <div className="p-2 bg-neutral-100 rounded-lg text-neutral-600 mt-0.5 shrink-0">
                  <Bell className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                    <span className="text-sm font-bold text-neutral-900 truncate">Dalam Aplikasi (In-App)</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        settings?.channels?.IN_APP?.enabled !== false
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-neutral-100 text-neutral-500 border border-neutral-200"
                      }`}>
                        {settings?.channels?.IN_APP?.enabled !== false ? "Aktif" : "Nonaktif"}
                      </span>
                      <button
                        type="button"
                        id="toggle-channel-in-app"
                        onClick={() => toggleChannel("IN_APP")}
                        title={settings?.channels?.IN_APP?.enabled !== false ? "Nonaktifkan In-App" : "Aktifkan In-App"}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 ${
                          settings?.channels?.IN_APP?.enabled !== false ? "bg-neutral-900" : "bg-neutral-300"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            settings?.channels?.IN_APP?.enabled !== false ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                    Notifikasi internal yang muncul langsung pada panel lonceng admin & pelanggan secara real-time.
                  </p>
                </div>
              </div>

              {/* EMAIL */}
              <div className="p-4 rounded-xl border border-neutral-100 bg-neutral-50/30 flex items-start gap-3.5 opacity-80">
                <div className="p-2 bg-neutral-100 rounded-lg text-neutral-400 mt-0.5 shrink-0">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                    <span className="text-sm font-bold text-neutral-500 truncate">Email</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-400 border border-neutral-200 uppercase tracking-wider shrink-0">
                      Belum Dikonfigurasi
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Pengiriman ringkasan transaksi & laporan lewat surat elektronik. Membutuhkan integrasi SMTP server.
                  </p>
                </div>
              </div>

              {/* WHATSAPP */}
              <div className="p-4 rounded-xl border border-neutral-100 bg-neutral-50/30 flex items-start gap-3.5 opacity-80">
                <div className="p-2 bg-neutral-100 rounded-lg text-neutral-400 mt-0.5 shrink-0">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                    <span className="text-sm font-bold text-neutral-500 truncate">WhatsApp</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-400 border border-neutral-200 uppercase tracking-wider shrink-0">
                      Belum Dikonfigurasi
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Notifikasi instan pesanan & resi transaksi ke nomor seluler. Membutuhkan integrasi gateway API WhatsApp.
                  </p>
                </div>
              </div>

              {/* PUSH */}
              <div className="p-4 rounded-xl border border-neutral-100 bg-neutral-50/30 flex items-start gap-3.5 opacity-80">
                <div className="p-2 bg-neutral-100 rounded-lg text-neutral-400 mt-0.5 shrink-0">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                    <span className="text-sm font-bold text-neutral-500 truncate">Web Push</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-400 border border-neutral-200 uppercase tracking-wider shrink-0">
                      Belum Dikonfigurasi
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Notifikasi push langsung di browser pengguna desktop & seluler. Membutuhkan konfigurasi Firebase FCM.
                  </p>
                </div>
              </div>

            </div>

            <div className="mt-6 p-4 rounded-xl bg-neutral-50 border border-neutral-100 flex items-start gap-3">
              <Info className="h-4 w-4 text-neutral-500 shrink-0 mt-0.5" />
              <div className="text-[11px] text-neutral-500 leading-relaxed space-y-1">
                <p>
                  Saluran eksternal (Email, WhatsApp, Push) saat ini masih dalam status <strong>Belum Dikonfigurasi</strong>.
                </p>
                <p>
                  Konfigurasi kredensial provider & API gateway dikelola secara terpisah melalui menu{" "}
                  <Link to="/admin/integrations" className="font-semibold text-neutral-800 hover:text-neutral-900 underline inline-flex items-center gap-0.5">
                    SYSTEM → Integrations <ArrowRight className="h-3 w-3 inline" />
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>

          {/* Last Updated Metadata Info */}
          {settings && (settings.updatedAt || settings.updatedBy) && (
            <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-4 text-xs text-neutral-500 space-y-1.5 shadow-inner">
              <div className="flex justify-between">
                <span>Pembaruan Terakhir:</span>
                <span className="font-semibold text-neutral-700">
                  {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString("id-ID") : "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Diperbarui Oleh:</span>
                <span className="font-semibold text-neutral-700 max-w-[150px] truncate">
                  {settings.updatedBy || "system"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Event Mappings & Toggles */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Section B: Customer Events */}
          <div className="bg-white border border-neutral-100 rounded-xl p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 tracking-tight">Event Pelanggan / Transaksi</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Kontrol notifikasi untuk status transaksi, pembayaran, dan refund pelanggan.</p>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAllEvents(true, "customer")}
                  className="text-xs font-semibold text-neutral-600 bg-neutral-50 hover:bg-neutral-100 px-3 py-1.5 rounded-lg border border-neutral-100 transition"
                >
                  Aktifkan Semua
                </button>
                <button
                  type="button"
                  onClick={() => setAllEvents(false, "customer")}
                  className="text-xs font-semibold text-rose-600 bg-rose-50/50 hover:bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 transition"
                >
                  Matikan Semua
                </button>
              </div>
            </div>

            <div className="divide-y divide-neutral-100">
              {customerEventsList.map((item) => {
                const isEnabled = settings?.events[item.type] ?? true;
                return (
                  <div key={item.type} className="flex items-start justify-between py-4 first:pt-0 last:pb-0 gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-neutral-900">{item.label}</span>
                        <code className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded font-mono">
                          {item.type}
                        </code>
                      </div>
                      <p className="text-xs text-neutral-500 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>

                    <div className="flex items-center shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => toggleEvent(item.type)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                          isEnabled ? "bg-neutral-900" : "bg-neutral-200"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                            isEnabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section C: System & Admin Events */}
          <div className="bg-white border border-neutral-100 rounded-xl p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 tracking-tight">Event Sistem, SLA & Admin</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Kontrol alarm kesalahan, pelanggaran SLA, penanganan insiden, dan stok.</p>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setAllEvents(true, "admin")}
                  className="text-xs font-semibold text-neutral-600 bg-neutral-50 hover:bg-neutral-100 px-3 py-1.5 rounded-lg border border-neutral-100 transition"
                >
                  Aktifkan Semua
                </button>
                <button
                  type="button"
                  onClick={() => setAllEvents(false, "admin")}
                  className="text-xs font-semibold text-rose-600 bg-rose-50/50 hover:bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 transition"
                >
                  Matikan Semua
                </button>
              </div>
            </div>

            <div className="divide-y divide-neutral-100">
              {adminEventsList.map((item) => {
                const isEnabled = settings?.events[item.type] ?? true;
                return (
                  <div key={item.type} className="flex items-start justify-between py-4 first:pt-0 last:pb-0 gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-neutral-900">{item.label}</span>
                        <code className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded font-mono">
                          {item.type}
                        </code>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                          item.severity === "CRITICAL" ? "bg-rose-100 text-rose-800 border border-rose-200" :
                          item.severity === "ERROR" ? "bg-orange-100 text-orange-800 border border-orange-200" :
                          item.severity === "WARNING" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                          "bg-blue-100 text-blue-800 border border-blue-200"
                        }`}>
                          {item.severity}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>

                    <div className="flex items-center shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => toggleEvent(item.type)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                          isEnabled ? "bg-neutral-900" : "bg-neutral-200"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                            isEnabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
