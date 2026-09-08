import React, { useEffect, useState } from "react";
import {
  Globe,
  Clock,
  Coins,
  Languages,
  Calendar,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Info,
  Sliders,
  ShieldAlert,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { StoreConfiguration } from "../../types/core";

const TIMEZONE_OPTIONS = [
  { value: "Asia/Jakarta", label: "Asia/Jakarta (WIB - UTC+7)", desc: "Waktu Indonesia Barat (Sumatra, Jawa, Kalimantan Barat & Tengah)" },
  { value: "Asia/Makassar", label: "Asia/Makassar (WITA - UTC+8)", desc: "Waktu Indonesia Tengah (Sulawesi, Bali, NTT, NTB, Kalimantan Selatan & Timur)" },
  { value: "Asia/Jayapura", label: "Asia/Jayapura (WIT - UTC+9)", desc: "Waktu Indonesia Timur (Maluku, Papua)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT - UTC+8)", desc: "Singapura / Standard Waktu Regional" },
  { value: "Asia/Bangkok", label: "Asia/Bangkok (ICT - UTC+7)", desc: "Bangkok, Indochina Time" },
  { value: "Asia/Kuala_Lumpur", label: "Asia/Kuala_Lumpur (MYT - UTC+8)", desc: "Kuala Lumpur, Malaysia Time" },
  { value: "UTC", label: "UTC (Coordinated Universal Time - UTC+0)", desc: "Standar Universal Waktu Dunia" },
];

const DATE_FORMAT_OPTIONS = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (Contoh: 04/09/2026)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (Contoh: 2026-09-04)" },
  { value: "D MMMM YYYY", label: "D MMMM YYYY (Contoh: 4 September 2026)" },
];

export default function AdminRegionalPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"timezone" | "currency" | "language">("timezone");

  // Form State
  const [config, setConfig] = useState<StoreConfiguration | null>(null);
  const [initialConfig, setInitialConfig] = useState<StoreConfiguration | null>(null);

  // Live Time Clock
  const [currentClientTime, setCurrentClientTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentClientTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/store-config");
      const json = await res.json();
      if (json.success && json.data) {
        const fullConfig: StoreConfiguration = {
          ...json.data,
          timezone: json.data.timezone || "Asia/Jakarta",
          currency: json.data.currency || "IDR",
          currencySymbol: json.data.currencySymbol || "Rp",
          currencyPosition: json.data.currencyPosition || "prefix",
          decimalSeparator: json.data.decimalSeparator || ",",
          thousandSeparator: json.data.thousandSeparator || ".",
          decimalPlaces: json.data.decimalPlaces ?? 0,
          locale: json.data.locale || "id-ID",
          defaultLanguage: json.data.defaultLanguage || "id",
          supportedLanguages: json.data.supportedLanguages || ["id", "en"],
          dateFormat: json.data.dateFormat || "DD/MM/YYYY",
          timeFormat: json.data.timeFormat || "24h"
        };
        setConfig(fullConfig);
        setInitialConfig(fullConfig);
      } else {
        setError(json.message || "Gagal mengambil konfigurasi toko.");
      }
    } catch (e: any) {
      setError("Gagal menghubungi server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const isDirty = JSON.stringify(config) !== JSON.stringify(initialConfig);

  const handleSave = async () => {
    if (!config) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/admin/store-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setSuccess("Pengaturan Regional, Bahasa & Mata Uang berhasil disimpan.");
        setConfig(json.data);
        setInitialConfig(json.data);
      } else {
        setError(json.message || "Gagal menyimpan perubahan.");
      }
    } catch (e: any) {
      setError("Terjadi kesalahan jaringan saat menyimpan konfigurasi.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (initialConfig) {
      setConfig({ ...initialConfig });
      setError(null);
      setSuccess("Form dikembalikan ke pengaturan yang tersimpan terakhir.");
    }
  };

  // Preview Helpers
  const formatSampleCurrency = (sampleAmount: number = 75000) => {
    if (!config) return "Rp 75.000";
    const dec = config.decimalPlaces || 0;
    const parts = sampleAmount.toFixed(dec).split(".");
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, config.thousandSeparator || ".");
    const decimalPart = parts[1] ? (config.decimalSeparator || ",") + parts[1] : "";
    const formattedNumber = integerPart + decimalPart;

    if (config.currencyPosition === "suffix") {
      return `${formattedNumber} ${config.currencySymbol || "Rp"}`;
    }
    return `${config.currencySymbol || "Rp"} ${formattedNumber}`;
  };

  const formatSampleTime = () => {
    if (!config) return currentClientTime.toLocaleString();
    try {
      return new Intl.DateTimeFormat(config.locale || "id-ID", {
        timeZone: config.timezone || "Asia/Jakarta",
        dateStyle: "full",
        timeStyle: "medium",
        hourCycle: config.timeFormat === "12h" ? "h12" : "h23"
      }).format(currentClientTime);
    } catch (e) {
      return currentClientTime.toLocaleString();
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="py-24 text-center space-y-3 bg-white border border-slate-200 rounded-3xl shadow-xs">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-slate-500 text-sm font-medium">Memuat Pengaturan Regional & Lokalisasi...</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="p-8 bg-red-50 border border-red-200 rounded-3xl text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <h3 className="text-base font-bold text-red-800">Gagal Memuat Konfigurasi</h3>
          <p className="text-red-700 text-sm font-medium">{error || "Data konfigurasi tidak tersedia."}</p>
          <button
            type="button"
            onClick={fetchConfig}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Coba Lagi</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
              Pengaturan Sistem
            </span>
            {isDirty && (
              <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200 animate-pulse">
                Ada Perubahan Belum Disimpan
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Globe className="w-6 h-6 text-blue-600" />
            Regional, Bahasa & Mata Uang
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm">
            Atur zona waktu operasional, mata uang display transaksi, format angka & tanggal, serta preferensi lokalisasi iStore.id.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={handleReset}
            disabled={!isDirty || saving}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-semibold transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Batalkan</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-bold shadow-xs transition"
          >
            {saving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Perubahan</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-emerald-800 text-xs font-medium animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button type="button" onClick={() => setSuccess(null)} className="text-emerald-600 hover:text-emerald-800 text-xs">
            Tutup
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between gap-3 text-red-800 text-xs font-medium animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-red-600 hover:text-red-800 text-xs">
            Tutup
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("timezone")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition ${
            activeTab === "timezone"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Zona Waktu & Kalender Operasional</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("currency")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition ${
            activeTab === "currency"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Mata Uang & Format Angka</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("language")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition ${
            activeTab === "language"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Languages className="w-4 h-4" />
          <span>Bahasa & Format Tanggal</span>
        </button>
      </div>

      {/* Tab 1: Timezone */}
      {activeTab === "timezone" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Zona Waktu Toko (Store Timezone)
              </h2>
              <p className="text-slate-500 text-xs">
                Zona waktu ini digunakan sebagai acuan operasional untuk jam buka toko, batas cut-off SLA pesanan, log audit, serta laporan settlement finansial.
              </p>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Pilih Zona Waktu Resmi (IANA Standard)
              </label>
              
              <div className="grid grid-cols-1 gap-3">
                {TIMEZONE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition ${
                      config.timezone === opt.value
                        ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="timezone"
                      value={opt.value}
                      checked={config.timezone === opt.value}
                      onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
                      className="mt-1 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-900">{opt.label}</p>
                      <p className="text-[11px] text-slate-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Konektivitas dengan Business Calendar & SLA</span>
              </div>
              <p className="leading-relaxed">
                iStore.id mengintegrasikan zona waktu ini secara otomatis dengan <strong>Business Calendar Engine</strong>. Perubahan zona waktu akan menyelaraskan perhitungan waktu SLA komplain, jam operasional toko, dan batasan batch settlement harian tanpa menduplikasi engine waktu.
              </p>
            </div>
          </div>

          {/* Timezone Simulation Card */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-md space-y-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span>Simulasi Waktu Real-Time</span>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Sync
                </span>
              </div>

              <div className="space-y-1">
                <div className="text-3xl font-black tracking-tight text-white font-mono">
                  {new Intl.DateTimeFormat(config.locale || "id-ID", {
                    timeZone: config.timezone || "Asia/Jakarta",
                    timeStyle: "medium",
                    hourCycle: config.timeFormat === "12h" ? "h12" : "h23"
                  }).format(currentClientTime)}
                </div>
                <div className="text-xs text-blue-400 font-medium">
                  {new Intl.DateTimeFormat(config.locale || "id-ID", {
                    timeZone: config.timezone || "Asia/Jakarta",
                    dateStyle: "full"
                  }).format(currentClientTime)}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-700/50 space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Timezone Aktif:</span>
                  <span className="font-semibold text-white">{config.timezone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Format Jam:</span>
                  <span className="font-semibold text-white">{config.timeFormat === "12h" ? "12 Jam (AM/PM)" : "24 Jam (Standard)"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Currency */}
      {activeTab === "currency" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Coins className="w-4 h-4 text-blue-600" />
                Mata Uang & Format Angka
              </h2>
              <p className="text-slate-500 text-xs">
                Konfigurasi simbol, kode mata uang, serta penempatan separator angka pada seluruh tampilan katalog, invoice, dan checkout.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Currency Code */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Kode Mata Uang (ISO 4217)
                </label>
                <input
                  type="text"
                  maxLength={3}
                  value={config.currency}
                  onChange={(e) => setConfig({ ...config, currency: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs font-bold tracking-wider uppercase focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="IDR"
                />
                <p className="text-[11px] text-slate-500">Mata uang transaksi resmi iStore.id saat ini adalah IDR.</p>
              </div>

              {/* Currency Symbol */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Simbol Mata Uang
                </label>
                <input
                  type="text"
                  value={config.currencySymbol || "Rp"}
                  onChange={(e) => setConfig({ ...config, currencySymbol: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Rp"
                />
              </div>

              {/* Symbol Position */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Posisi Simbol
                </label>
                <select
                  value={config.currencyPosition || "prefix"}
                  onChange={(e) => setConfig({ ...config, currencyPosition: e.target.value as "prefix" | "suffix" })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="prefix">Prefix (Depan: Rp 50.000)</option>
                  <option value="suffix">Suffix (Belakang: 50.000 IDR)</option>
                </select>
              </div>

              {/* Decimal Places */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Jumlah Desimal (Decimal Places)
                </label>
                <select
                  value={config.decimalPlaces ?? 0}
                  onChange={(e) => setConfig({ ...config, decimalPlaces: parseInt(e.target.value, 10) })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value={0}>0 (Standar Rupiah IDR - Rp 50.000)</option>
                  <option value={2}>2 (Dua Desimal - Rp 50.000,00)</option>
                </select>
              </div>

              {/* Thousand Separator */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Pemisah Ribuan (Thousand Separator)
                </label>
                <select
                  value={config.thousandSeparator || "."}
                  onChange={(e) => setConfig({ ...config, thousandSeparator: e.target.value as "." | "," })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value=".">Titik [ . ] (Standar Indonesia: 1.000.000)</option>
                  <option value=",">Koma [ , ] (Standar US/International: 1,000,000)</option>
                </select>
              </div>

              {/* Decimal Separator */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Pemisah Desimal (Decimal Separator)
                </label>
                <select
                  value={config.decimalSeparator || ","}
                  onChange={(e) => setConfig({ ...config, decimalSeparator: e.target.value as "," | "." })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value=",">Koma [ , ] (Standar Indonesia: 50,50)</option>
                  <option value=".">Titik [ . ] (Standar US: 50.50)</option>
                </select>
              </div>
            </div>

            {/* Note on Pricing Engine & Payment Safety */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-2 text-xs text-blue-950">
              <div className="flex items-center gap-2 font-bold text-blue-900">
                <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Keamanan Finansial & Pricing Engine</span>
              </div>
              <p className="leading-relaxed">
                Format mata uang di atas mengatur presentasi visual (*display formatting*). Nilai nominal asli harga dasar, margin keuntungan, nilai transaksi Midtrans, dan catatan Ledger tetap dihitung secara presisi dalam bilangan bulat (*integer*) oleh <strong>Pricing Engine</strong> untuk menjamin keamanan mutlak akuntansi.
              </p>
            </div>
          </div>

          {/* Currency Preview Card */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Live Preview Tampilan Harga</span>
              </div>

              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <p className="text-[11px] text-slate-500 font-medium">Contoh Nominal Sedang (75.000):</p>
                  <p className="text-xl font-black text-slate-900 font-sans">{formatSampleCurrency(75000)}</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <p className="text-[11px] text-slate-500 font-medium">Contoh Nominal Besar (1.500.000):</p>
                  <p className="text-xl font-black text-blue-600 font-sans">{formatSampleCurrency(1500000)}</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <p className="text-[11px] text-slate-500 font-medium">Contoh Nominal Kecil (3.500):</p>
                  <p className="text-base font-bold text-emerald-600 font-sans">{formatSampleCurrency(3500)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Language & Date */}
      {activeTab === "language" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Languages className="w-4 h-4 text-blue-600" />
                Bahasa & Format Tanggal
              </h2>
              <p className="text-slate-500 text-xs">
                Tentukan bahasa default toko dan gaya penyajian format tanggal pada histori pesanan dan faktur.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Default Language */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Bahasa Utama Platform (Default)
                </label>
                <select
                  value={config.defaultLanguage || "id"}
                  onChange={(e) => setConfig({ ...config, defaultLanguage: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="id">Bahasa Indonesia (id-ID) - Utama</option>
                  <option value="en">English (en-US)</option>
                </select>
                <p className="text-[11px] text-slate-500">Bahasa acuan untuk seluruh konten email notifikasi dan interface default.</p>
              </div>

              {/* Locale code */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Kode Lokalisasi (Locale ID)
                </label>
                <input
                  type="text"
                  value={config.locale || "id-ID"}
                  onChange={(e) => setConfig({ ...config, locale: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="id-ID"
                />
              </div>

              {/* Date Format */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Format Tanggal
                </label>
                <select
                  value={config.dateFormat || "DD/MM/YYYY"}
                  onChange={(e) => setConfig({ ...config, dateFormat: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  {DATE_FORMAT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Time Format */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Format Waktu (Jam)
                </label>
                <select
                  value={config.timeFormat || "24h"}
                  onChange={(e) => setConfig({ ...config, timeFormat: e.target.value as "24h" | "12h" })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="24h">24 Jam (Contoh: 21:45)</option>
                  <option value="12h">12 Jam AM/PM (Contoh: 09:45 PM)</option>
                </select>
              </div>
            </div>

            {/* Language Architecture Status */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs text-slate-700">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Status Multi-Language Platform</span>
              </div>
              <p className="leading-relaxed text-slate-600">
                Platform saat ini menggunakan <strong>Bahasa Indonesia</strong> sebagai basis sistem transaksi dan konfirmasi pesanan resmi. Konfigurasi default language dan locale di atas disimpan secara konsisten untuk standarisasi format tanggal/waktu sistem.
              </p>
            </div>
          </div>

          {/* Date Sample Preview */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Live Preview Format Tanggal</span>
              </div>

              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <p className="text-[11px] text-slate-500 font-medium">Contoh Tampilan Tanggal Penuh:</p>
                  <p className="text-sm font-bold text-slate-900 leading-relaxed">{formatSampleTime()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
