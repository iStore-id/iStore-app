import React, { useState, useEffect, useMemo, FormEvent } from "react";
import { useAuthStore } from "../../store/auth-store";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Key,
  Globe,
  Radio,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Save,
  RotateCcw,
  UserCheck,
  Eye,
  EyeOff,
  Server,
  Activity,
  Zap,
  Filter,
  Plus,
  Trash2,
  Info,
  Check
} from "lucide-react";
import { SecuritySettings } from "../../types/core";

const DEFAULT_SETTINGS_FALLBACK: SecuritySettings = {
  auth: {
    allowPasswordAuth: true,
    allowGoogleAuth: true,
    sessionTimeoutMinutes: 120,
    minPasswordLength: 8,
    requirePasswordNumbers: true,
    requirePasswordSymbols: false,
    maxFailedLoginAttempts: 5,
    lockoutDurationMinutes: 15,
    requireReauthForSensitiveOps: true,
    mfaPolicy: "optional"
  },
  rateLimiting: {
    enablePublicRateLimit: true,
    publicApiMaxRequestsPerMinute: 60,
    enableCheckoutRateLimit: true,
    checkoutMaxRequestsPerMinute: 15,
    enableAdminRateLimit: true,
    adminMaxRequestsPerMinute: 120,
    enableBotProtection: true
  },
  network: {
    ipWhitelistEnabled: false,
    ipWhitelist: [],
    ipBlacklistEnabled: false,
    ipBlacklist: [],
    enforceMidtransIpWhitelist: true,
    enforceTokoVoucherIpWhitelist: true
  },
  dataProtection: {
    maskCustomerDataInLogs: true,
    logAllAdminMutations: true,
    requireReasonForRefunds: true,
    requireReasonForConfigChanges: true,
    allowExportSensitiveData: false,
    secretMaskingStrict: true
  },
  emergency: {
    lockdownMode: false,
    lockdownReason: ""
  }
};

export default function SecurityPage() {
  const { user } = useAuthStore();
  const isOwner = user?.email?.toLowerCase() === "chokerbayu@gmail.com";

  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SETTINGS_FALLBACK);
  const [initialSettings, setInitialSettings] = useState<SecuritySettings>(DEFAULT_SETTINGS_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"auth" | "rateLimit" | "network" | "data" | "emergency" | "audits">("auth");
  
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [auditReason, setAuditReason] = useState("");
  const [recentAudits, setRecentAudits] = useState<any[]>([]);

  // IP Testing Tool state
  const [testIpInput, setTestIpInput] = useState("");
  const [testingIp, setTestingIp] = useState(false);
  const [testIpResult, setTestIpResult] = useState<any | null>(null);

  // New IP inputs
  const [newBlacklistIp, setNewBlacklistIp] = useState("");
  const [newWhitelistIp, setNewWhitelistIp] = useState("");

  const hasChanges = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(initialSettings);
  }, [settings, initialSettings]);

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const fetchSecurityData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/security/overview", {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (json.success && json.data) {
        const fetchedSettings = json.data.settings || DEFAULT_SETTINGS_FALLBACK;
        setSettings(fetchedSettings);
        setInitialSettings(JSON.parse(JSON.stringify(fetchedSettings)));
        setRecentAudits(json.data.recentAudits || []);
      } else {
        setErrorMessage(json.message || "Gagal memuat konfigurasi keamanan");
      }
    } catch (err: any) {
      setErrorMessage("Terjadi kesalahan jaringan saat memuat konfigurasi");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!isOwner) {
      setErrorMessage("Hanya Pemilik Sistem (Owner) yang berhak mengubah konfigurasi keamanan.");
      return;
    }

    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/security/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          settings,
          reason: auditReason.trim() || "Pembaruan Kebijakan Keamanan via Security Panel"
        })
      });

      const json = await res.json();
      if (json.success) {
        setSuccessMessage("Konfigurasi keamanan berhasil diperbarui dan diterapkan ke seluruh sistem.");
        setInitialSettings(JSON.parse(JSON.stringify(settings)));
        setAuditReason("");
        // Refresh overview and audit trail
        fetchSecurityData();
      } else {
        setErrorMessage(json.message || "Gagal menyimpan konfigurasi keamanan");
      }
    } catch (err: any) {
      setErrorMessage("Terjadi kesalahan saat menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    if (window.confirm("Apakah Anda yakin ingin mengatur ulang seluruh konfigurasi keamanan ke standar sistem yang direkomendasikan?")) {
      setSettings(JSON.parse(JSON.stringify(DEFAULT_SETTINGS_FALLBACK)));
      setSuccessMessage("Pengaturan telah direset ke nilai default pada form. Klik 'Simpan Perubahan' untuk menerapkan.");
    }
  };

  const handleTestIp = async () => {
    if (!testIpInput.trim()) return;
    setTestingIp(true);
    setTestIpResult(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/security/test-ip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ ip: testIpInput.trim() })
      });
      const json = await res.json();
      if (json.success) {
        setTestIpResult(json.data);
      } else {
        setTestIpResult({ error: json.message });
      }
    } catch (e: any) {
      setTestIpResult({ error: e.message });
    } finally {
      setTestingIp(false);
    }
  };

  const addBlacklistIp = () => {
    const val = newBlacklistIp.trim();
    if (!val) return;
    if (settings.network.ipBlacklist.includes(val)) return;
    setSettings(prev => ({
      ...prev,
      network: {
        ...prev.network,
        ipBlacklist: [...prev.network.ipBlacklist, val]
      }
    }));
    setNewBlacklistIp("");
  };

  const removeBlacklistIp = (ip: string) => {
    setSettings(prev => ({
      ...prev,
      network: {
        ...prev.network,
        ipBlacklist: prev.network.ipBlacklist.filter(x => x !== ip)
      }
    }));
  };

  const addWhitelistIp = () => {
    const val = newWhitelistIp.trim();
    if (!val) return;
    if (settings.network.ipWhitelist.includes(val)) return;
    setSettings(prev => ({
      ...prev,
      network: {
        ...prev.network,
        ipWhitelist: [...prev.network.ipWhitelist, val]
      }
    }));
    setNewWhitelistIp("");
  };

  const removeWhitelistIp = (ip: string) => {
    setSettings(prev => ({
      ...prev,
      network: {
        ...prev.network,
        ipWhitelist: prev.network.ipWhitelist.filter(x => x !== ip)
      }
    }));
  };

  if (loading) {
    return (
      <div id="security-loading" className="flex items-center justify-center min-h-[450px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-600">Memuat konfigurasi keamanan iStore...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="admin-security-page" className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="ui-page-title text-slate-900">Pusat Keamanan & Kebijakan Akses (Security)</h1>
              <p className="text-sm text-slate-500">
                Kelola perlindungan otentikasi, rate limit anti-abuse, firewall IP, isolasi pelanggan, dan mode darurat.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="btn-refresh-security"
            type="button"
            onClick={fetchSecurityData}
            disabled={loading || saving}
            className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            Segarkan
          </button>

          <button
            id="btn-reset-security"
            type="button"
            onClick={handleResetToDefault}
            disabled={loading || saving || !isOwner}
            className="px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Default
          </button>

          <button
            id="btn-save-security"
            type="button"
            onClick={() => handleSaveSettings()}
            disabled={loading || saving || !isOwner || !hasChanges}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Perubahan
          </button>
        </div>
      </div>

      {/* Owner Protection & Security Posture Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
          <UserCheck className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider">Owner Safeguard Protection</h3>
            <p className="text-xs text-blue-800 leading-relaxed">
              Akun Owner (<strong className="font-mono">{user?.email || "chokerbayu@gmail.com"}</strong>) dilindungi secara mutlak di backend dari demotion, penguncian, dan kehilangan hak akses.
            </p>
          </div>
        </div>

        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
          <Shield className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Secret Isolation</h3>
            <p className="text-xs text-emerald-800 leading-relaxed">
              API Keys (Midtrans, TokoVoucher, ApiGames) diproses secara terisolasi di sisi server. Kredensial tidak pernah dikirim ke browser maupun log publik.
            </p>
          </div>
        </div>

        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-start gap-3">
          <Activity className="w-5 h-5 text-purple-700 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-purple-900 uppercase tracking-wider">Real-time Defense</h3>
            <p className="text-xs text-purple-800 leading-relaxed">
              Rate limiter aktif melindungi endpoint publik ({settings.rateLimiting.publicApiMaxRequestsPerMinute} req/m) dan checkout ({settings.rateLimiting.checkoutMaxRequestsPerMinute} req/m).
            </p>
          </div>
        </div>
      </div>

      {/* Emergency Lockdown Notice (if active) */}
      {settings.emergency.lockdownMode && (
        <div className="p-4 bg-red-600 text-white rounded-xl shadow-md flex items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-white shrink-0" />
            <div>
              <h2 className="font-bold text-base">MODE ISOLASI DARURAT KEAMANAN (LOCKDOWN) AKTIF</h2>
              <p className="text-xs text-red-100">
                Alasan: {settings.emergency.lockdownReason || "Insiden keamanan aktif"}. Transaksi publik ditangguhkan sementara.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSettings(prev => ({
                ...prev,
                emergency: { ...prev.emergency, lockdownMode: false, lockdownReason: "" }
              }));
            }}
            className="px-3 py-1.5 bg-white text-red-700 text-xs font-bold rounded-lg shadow-xs hover:bg-red-50"
          >
            Nonaktifkan Lockdown
          </button>
        </div>
      )}

      {/* Feedback Messages */}
      {successMessage && (
        <div id="security-success-alert" className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div id="security-error-alert" className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("auth")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "auth"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Key className="w-4 h-4" />
          Otentikasi & Sesi
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("rateLimit")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "rateLimit"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Zap className="w-4 h-4" />
          Rate Limit & Anti-Abuse
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("network")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "network"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Globe className="w-4 h-4" />
          Firewall & Filter IP
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("data")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "data"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Lock className="w-4 h-4" />
          Data & Operasi Sensitif
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("emergency")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "emergency"
              ? "border-red-600 text-red-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Mode Darurat
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audits")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "audits"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Activity className="w-4 h-4" />
          Log Audit Keamanan
        </button>
      </div>

      {/* TAB CONTENT: AUTHENTICATION */}
      {activeTab === "auth" && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">Kebijakan Otentikasi & Manajemen Sesi</h2>
            <p className="text-xs text-slate-500">Atur metode login yang diizinkan, durasi timeout sesi, serta kompleksitas password.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Metode Login */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-800">Metode Otentikasi</h3>
              
              <label className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.auth.allowPasswordAuth}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    auth: { ...prev.auth, allowPasswordAuth: e.target.checked }
                  }))}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-800">Email & Password Sign-in</div>
                  <div className="text-xs text-slate-500">Izinkan pelanggan dan staf masuk menggunakan email dan password.</div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.auth.allowGoogleAuth}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    auth: { ...prev.auth, allowGoogleAuth: e.target.checked }
                  }))}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-800">Google OAuth Sign-in</div>
                  <div className="text-xs text-slate-500">Izinkan login instan satu klik menggunakan akun Google yang terverifikasi.</div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.auth.requireReauthForSensitiveOps}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    auth: { ...prev.auth, requireReauthForSensitiveOps: e.target.checked }
                  }))}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-800">Re-authentication untuk Tindakan Sensitif</div>
                  <div className="text-xs text-slate-500">Minta konfirmasi password/re-auth sebelum melakukan refund atau perubahan konfigurasi penting.</div>
                </div>
              </label>
            </div>

            {/* Session Timeout & Password Policy */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-800">Kebijakan Sesi & Password</h3>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Durasi Session Timeout (Menit)</label>
                <select
                  value={settings.auth.sessionTimeoutMinutes}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    auth: { ...prev.auth, sessionTimeoutMinutes: parseInt(e.target.value) || 120 }
                  }))}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={30}>30 Menit (Sangat Ketat)</option>
                  <option value={60}>1 Jam</option>
                  <option value={120}>2 Jam (Direkomendasikan)</option>
                  <option value={240}>4 Jam</option>
                  <option value={480}>8 Jam</option>
                  <option value={1440}>24 Jam (1 Hari)</option>
                  <option value={10080}>7 Hari</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Sesi pengguna admin akan otomatis kedaluwarsa setelah durasi ini jika tidak ada aktivitas.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Panjang Minimum Password: {settings.auth.minPasswordLength} Karakter</label>
                <input
                  type="range"
                  min={6}
                  max={20}
                  value={settings.auth.minPasswordLength}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    auth: { ...prev.auth, minPasswordLength: parseInt(e.target.value) || 8 }
                  }))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>6 (Standar)</span>
                  <span>8 (Disarankan)</span>
                  <span>12+ (Ketat)</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={settings.auth.requirePasswordNumbers}
                    onChange={e => setSettings(prev => ({
                      ...prev,
                      auth: { ...prev.auth, requirePasswordNumbers: e.target.checked }
                    }))}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Wajib memuat angka (0-9)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={settings.auth.requirePasswordSymbols}
                    onChange={e => setSettings(prev => ({
                      ...prev,
                      auth: { ...prev.auth, requirePasswordSymbols: e.target.checked }
                    }))}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Wajib memuat simbol (@, #, $)</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Kebijakan Multi-Factor Authentication (MFA)</label>
                <select
                  value={settings.auth.mfaPolicy}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    auth: { ...prev.auth, mfaPolicy: e.target.value as any }
                  }))}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="optional">Opsional (Pengguna dapat mengaktifkan mandiri)</option>
                  <option value="required_admins">Wajib untuk Seluruh Admin & Staff</option>
                  <option value="required_all">Wajib untuk Seluruh Pengguna & Pelanggan</option>
                  <option value="disabled">Dinonaktifkan</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: RATE LIMITING */}
      {activeTab === "rateLimit" && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">Perlindungan Frekuensi & Anti-Abuse (Rate Limiting)</h2>
            <p className="text-xs text-slate-500">Cegah serangan brute-force, scraping, spam order, dan kelebihan beban server secara real-time.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Public Rate Limit */}
            <div className="p-4 border border-slate-200 rounded-xl space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">Public API Rate Limit</span>
                <input
                  type="checkbox"
                  checked={settings.rateLimiting.enablePublicRateLimit}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    rateLimiting: { ...prev.rateLimiting, enablePublicRateLimit: e.target.checked }
                  }))}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-slate-500">Membatasi frekuensi pencarian katalog dan polling harga publik per IP.</p>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Maksimum Permintaan / Menit</label>
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={settings.rateLimiting.publicApiMaxRequestsPerMinute}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    rateLimiting: { ...prev.rateLimiting, publicApiMaxRequestsPerMinute: parseInt(e.target.value) || 60 }
                  }))}
                  className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {/* Checkout Rate Limit */}
            <div className="p-4 border border-blue-200 rounded-xl space-y-3 bg-blue-50/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">Checkout / Order Rate Limit</span>
                <input
                  type="checkbox"
                  checked={settings.rateLimiting.enableCheckoutRateLimit}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    rateLimiting: { ...prev.rateLimiting, enableCheckoutRateLimit: e.target.checked }
                  }))}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-slate-500">Mencegah spam pembuatan invoice transaksi atau fraud bot checkout.</p>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Maksimum Checkout / Menit</label>
                <input
                  type="number"
                  min={2}
                  max={60}
                  value={settings.rateLimiting.checkoutMaxRequestsPerMinute}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    rateLimiting: { ...prev.rateLimiting, checkoutMaxRequestsPerMinute: parseInt(e.target.value) || 15 }
                  }))}
                  className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {/* Admin Rate Limit */}
            <div className="p-4 border border-slate-200 rounded-xl space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">Admin API Rate Limit</span>
                <input
                  type="checkbox"
                  checked={settings.rateLimiting.enableAdminRateLimit}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    rateLimiting: { ...prev.rateLimiting, enableAdminRateLimit: e.target.checked }
                  }))}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-slate-500">Membatasi panggilan mutasi admin per menit untuk stabilitas sistem.</p>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Maksimum Admin Req / Menit</label>
                <input
                  type="number"
                  min={30}
                  max={600}
                  value={settings.rateLimiting.adminMaxRequestsPerMinute}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    rateLimiting: { ...prev.rateLimiting, adminMaxRequestsPerMinute: parseInt(e.target.value) || 120 }
                  }))}
                  className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          <label className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={settings.rateLimiting.enableBotProtection}
              onChange={e => setSettings(prev => ({
                ...prev,
                rateLimiting: { ...prev.rateLimiting, enableBotProtection: e.target.checked }
              }))}
              className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
            />
            <div>
              <div className="text-sm font-semibold text-slate-800">Perlindungan Anti-Bot & Scraping Header Verification</div>
              <div className="text-xs text-slate-500">Verifikasi user-agent dan header standar peramban untuk mendeteksi crawling otomatis yang tidak sah.</div>
            </div>
          </label>
        </div>
      )}

      {/* TAB CONTENT: NETWORK & IP FIREWALL */}
      {activeTab === "network" && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">Firewall & Kontrol Akses IP</h2>
            <p className="text-xs text-slate-500">Kelola daftar IP terblokir (Blacklist), IP terpercaya (Whitelist), serta uji coba filter IP secara langsung.</p>
          </div>

          {/* Quick IP Diagnosis Tester */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-blue-600" />
              Uji Coba Diagnosis Akses IP (IP Simulator)
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Masukkan alamat IP (misal: 180.252.120.45)"
                value={testIpInput}
                onChange={e => setTestIpInput(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono"
              />
              <button
                type="button"
                onClick={handleTestIp}
                disabled={testingIp || !testIpInput.trim()}
                className="px-4 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {testingIp ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Uji Status IP"}
              </button>
            </div>

            {testIpResult && (
              <div className={`p-3 rounded-lg text-xs font-mono border ${
                testIpResult.verdict === "ALLOW"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}>
                {testIpResult.verdict === "ALLOW" ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>HASIL: <strong>DIIZINKAN (ALLOW)</strong>. IP {testIpResult.ip} lolos seluruh filter keamanan.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>HASIL: <strong>DIBLOKIR ({testIpResult.verdict})</strong>. Permintaan dari IP ini akan ditolak server (HTTP 403).</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* IP Blacklist */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Daftar Blokir IP (Blacklist)</h3>
                  <p className="text-xs text-slate-500">IP dalam daftar ini ditolak aksesnya secara instan.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.network.ipBlacklistEnabled}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    network: { ...prev.network, ipBlacklistEnabled: e.target.checked }
                  }))}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tambah IP ke blacklist..."
                  value={newBlacklistIp}
                  onChange={e => setNewBlacklistIp(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                />
                <button
                  type="button"
                  onClick={addBlacklistIp}
                  disabled={!newBlacklistIp.trim()}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 rounded-lg flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Blokir
                </button>
              </div>

              <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100 bg-slate-50">
                {settings.network.ipBlacklist.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">Tidak ada IP dalam daftar blokir</div>
                ) : (
                  settings.network.ipBlacklist.map(ip => (
                    <div key={ip} className="p-2.5 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-800">{ip}</span>
                      <button
                        type="button"
                        onClick={() => removeBlacklistIp(ip)}
                        className="text-rose-600 hover:text-rose-800 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Admin IP Whitelist */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Daftar Putih IP Admin (Whitelist)</h3>
                  <p className="text-xs text-slate-500">Jika aktif, hanya IP terdaftar yang dapat mengakses portal admin.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.network.ipWhitelistEnabled}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    network: { ...prev.network, ipWhitelistEnabled: e.target.checked }
                  }))}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tambah IP admin terpercaya..."
                  value={newWhitelistIp}
                  onChange={e => setNewWhitelistIp(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                />
                <button
                  type="button"
                  onClick={addWhitelistIp}
                  disabled={!newWhitelistIp.trim()}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 rounded-lg flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah
                </button>
              </div>

              <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100 bg-slate-50">
                {settings.network.ipWhitelist.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">Semua IP diizinkan (Whitelist kosong)</div>
                ) : (
                  settings.network.ipWhitelist.map(ip => (
                    <div key={ip} className="p-2.5 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-800">{ip}</span>
                      <button
                        type="button"
                        onClick={() => removeWhitelistIp(ip)}
                        className="text-rose-600 hover:text-rose-800 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: DATA PROTECTION */}
      {activeTab === "data" && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">Perlindungan Data & Operasi Sensitif</h2>
            <p className="text-xs text-slate-500">Kebijakan audit logging, penyembunyian data pribadi pelanggan, dan proteksi mutasi finansial.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={settings.dataProtection.maskCustomerDataInLogs}
                onChange={e => setSettings(prev => ({
                  ...prev,
                  dataProtection: { ...prev.dataProtection, maskCustomerDataInLogs: e.target.checked }
                }))}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="text-sm font-semibold text-slate-800">Sensor Data Pribadi Pelanggan di Log</div>
                <div className="text-xs text-slate-500">Nomor WhatsApp dan email disamarkan (misal: 0812****89) pada log publik demi kepatuhan privasi (UU PDP).</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={settings.dataProtection.logAllAdminMutations}
                onChange={e => setSettings(prev => ({
                  ...prev,
                  dataProtection: { ...prev.dataProtection, logAllAdminMutations: e.target.checked }
                }))}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="text-sm font-semibold text-slate-800">Catat Seluruh Mutasi Admin ke Audit Log</div>
                <div className="text-xs text-slate-500">Setiap perubahan harga, stok, katalog, role, dan konfigurasi tercatat permanen di collection auditLogs.</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={settings.dataProtection.requireReasonForRefunds}
                onChange={e => setSettings(prev => ({
                  ...prev,
                  dataProtection: { ...prev.dataProtection, requireReasonForRefunds: e.target.checked }
                }))}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="text-sm font-semibold text-slate-800">Wajib Alasan untuk Refund / Koreksi Saldo</div>
                <div className="text-xs text-slate-500">Staf wajib memasukkan alasan bisnis sebelum memproses pengembalian dana transaksi.</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={settings.dataProtection.secretMaskingStrict}
                onChange={e => setSettings(prev => ({
                  ...prev,
                  dataProtection: { ...prev.dataProtection, secretMaskingStrict: e.target.checked }
                }))}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="text-sm font-semibold text-slate-800">Penyensoran Kredensial Server-Side Ketat</div>
                <div className="text-xs text-slate-500">Server otomatis membuang token rahasia sebelum payload dikirimkan ke frontend.</div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* TAB CONTENT: EMERGENCY */}
      {activeTab === "emergency" && (
        <div className="bg-white p-6 rounded-xl border border-red-200 shadow-xs space-y-6">
          <div className="border-b border-red-100 pb-4">
            <h2 className="text-base font-bold text-red-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Protokol & Isolasi Darurat Keamanan
            </h2>
            <p className="text-xs text-slate-500">Gunakan kontrol ini saat terjadi serangan siber aktif, kebocoran akun, atau kegagalan gateway pembayaran eksternal.</p>
          </div>

          <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-red-950">Mode Isolasi Darurat (Security Lockdown Mode)</h3>
                <p className="text-xs text-red-800">Jika diaktifkan, pembuatan pesanan baru dan checkout publik akan segera ditangguhkan sementara.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.emergency.lockdownMode}
                onChange={e => setSettings(prev => ({
                  ...prev,
                  emergency: {
                    ...prev.emergency,
                    lockdownMode: e.target.checked,
                    lockdownStartedAt: e.target.checked ? new Date().toISOString() : undefined
                  }
                }))}
                className="rounded text-red-600 focus:ring-red-500 w-5 h-5"
              />
            </div>

            {settings.emergency.lockdownMode && (
              <div>
                <label className="block text-xs font-bold text-red-900 mb-1">Alasan Penangguhan / Instruksi untuk Pelanggan</label>
                <input
                  type="text"
                  placeholder="Contoh: Pemeliharaan darurat gateway pembayaran..."
                  value={settings.emergency.lockdownReason || ""}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    emergency: { ...prev.emergency, lockdownReason: e.target.value }
                  }))}
                  className="w-full px-3 py-2 text-sm bg-white border border-red-300 rounded-lg text-red-900"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: AUDIT LOGS */}
      {activeTab === "audits" && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">Log Aktivitas Keamanan Terbaru</h2>
            <p className="text-xs text-slate-500">Daftar mutasi konfigurasi keamanan, hak akses, dan tindakan sensitif pada sistem.</p>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
            {recentAudits.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">Belum ada catatan audit keamanan</div>
            ) : (
              recentAudits.map((item: any) => (
                <div key={item.id} className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{item.action}</span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[11px]">{item.target}</span>
                    </div>
                    <div className="text-slate-500">
                      Oleh: <strong className="text-slate-700">{item.actorEmail}</strong> • Alasan: {item.reason}
                    </div>
                  </div>
                  <div className="text-slate-400 font-mono text-[11px] shrink-0">
                    {new Date(item.timestamp).toLocaleString("id-ID")}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Optional Reason Dialog / Prompt on Save */}
      {hasChanges && (
        <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Terdapat perubahan konfigurasi yang belum disimpan</p>
              <p className="text-xs text-slate-400">Masukkan alasan perubahan untuk pencatatan audit sebelum menyimpan.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <input
              type="text"
              placeholder="Alasan perubahan (opsional)..."
              value={auditReason}
              onChange={e => setAuditReason(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 flex-1 md:w-64"
            />
            <button
              type="button"
              onClick={() => handleSaveSettings()}
              disabled={saving || !isOwner}
              className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shrink-0 flex items-center gap-1.5 shadow-xs"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Terapkan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
