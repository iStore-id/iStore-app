import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  KeyRound, 
  ShieldCheck, 
  ShieldAlert, 
  Eye, 
  EyeOff, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Mail, 
  Shield, 
  ArrowRight,
  ExternalLink,
  Check,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Pencil,
  X
} from "lucide-react";
import { motion } from "motion/react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile } from "firebase/auth";
import { useAuthStore } from "../store/auth-store";
import { auth } from "../lib/firebase";
import MfaSection from "../components/account/MfaSection";

interface PasswordPolicy {
  minPasswordLength: number;
  requirePasswordNumbers: boolean;
  requirePasswordSymbols: boolean;
}

const DEFAULT_POLICY: PasswordPolicy = {
  minPasswordLength: 8,
  requirePasswordNumbers: true,
  requirePasswordSymbols: false,
};

export default function AccountPage() {
  const { user, role, loading: authLoading, setUser } = useAuthStore();
  const navigate = useNavigate();

  // Name edit states
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.displayName || "");
  const [nameSubmitting, setNameSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Form states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Sync name state with user data
  useEffect(() => {
    if (user?.displayName && !isEditingName) {
      setNewName(user.displayName);
    }
  }, [user?.displayName, isEditingName]);

  // Handle Profile Name Update
  const handleUpdateName = async () => {
    if (!newName.trim()) {
      setNameError("Nama tidak boleh kosong");
      return;
    }
    
    if (newName === user?.displayName) {
      setIsEditingName(false);
      return;
    }

    setNameSubmitting(true);
    setNameError(null);

    try {
      const firebaseUser = auth?.currentUser;
      if (!firebaseUser) throw new Error("Sesi tidak valid");
      
      // 1. Client-side update (directly to Firebase project)
      await updateProfile(firebaseUser, { displayName: newName });
      
      // 2. Server-side update (Firestore + Audit)
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newName })
      });

      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal memperbarui nama");
      }

      // Success: Update Auth Store
      if (user) {
        setUser({
          ...user,
          displayName: newName
        }, role);
      }
      
      setIsEditingName(false);
    } catch (err: any) {
      console.error("Profile update error:", err);
      setNameError(err.message || "Gagal memperbarui profil");
    } finally {
      setNameSubmitting(false);
    }
  };

  // Toggle visibility
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & feedback
  const [policy, setPolicy] = useState<PasswordPolicy>(DEFAULT_POLICY);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Determine if user has email/password provider
  const isPasswordUser = useMemo(() => {
    if (!user) return false;
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser || !firebaseUser.providerData) return true; // default allow for password form
    return firebaseUser.providerData.some((p: any) => p.providerId === "password");
  }, [user]);

  // Fetch active password policy from systemConfigs/security_settings
  useEffect(() => {
    let isMounted = true;
    async function fetchPolicy() {
      try {
        const res = await fetch("/api/auth/password-policy");
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.policy && isMounted) {
            setPolicy(data.policy);
          }
        }
      } catch (err) {
        console.warn("Could not fetch latest password policy, using safe defaults:", err);
      }
    }
    fetchPolicy();
    return () => {
      isMounted = false;
    };
  }, []);

  // Real-time policy evaluation for UI indicators
  const policyStatus = useMemo(() => {
    const hasMinLength = newPassword.length >= (policy.minPasswordLength || 8);
    const hasNumber = !policy.requirePasswordNumbers || /\d/.test(newPassword);
    const hasSymbol = !policy.requirePasswordSymbols || /[^A-Za-z0-9]/.test(newPassword);
    const isMatching = confirmPassword.length > 0 && newPassword === confirmPassword;

    return {
      hasMinLength,
      hasNumber,
      hasSymbol,
      isMatching,
      allPassed: hasMinLength && hasNumber && hasSymbol,
    };
  }, [newPassword, confirmPassword, policy]);

  // Handle password change submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // 1. Must be authenticated
    const firebaseUser = auth?.currentUser;
    if (!user || !firebaseUser || !firebaseUser.email) {
      setErrorMessage("Pengguna belum login atau sesi telah berakhir. Silakan login kembali.");
      return;
    }

    // 2. Validate input presence
    if (!currentPassword.trim()) {
      setErrorMessage("Password saat ini wajib diisi.");
      return;
    }
    if (!newPassword) {
      setErrorMessage("Password baru wajib diisi.");
      return;
    }
    if (!confirmPassword) {
      setErrorMessage("Konfirmasi password baru wajib diisi.");
      return;
    }

    // 3. Validate confirmation match
    if (newPassword !== confirmPassword) {
      setErrorMessage("Konfirmasi password tidak cocok.");
      return;
    }

    // 4. Validate new password is not identical to current password
    if (newPassword === currentPassword) {
      setErrorMessage("Password baru tidak boleh sama dengan password saat ini.");
      return;
    }

    setSubmitting(true);

    try {
      // 5. Strict Server-Side Validation using existing validatePasswordPolicy via /api/auth/validate-password
      let validationResult: { success?: boolean; valid?: boolean; errors?: string[] };
      try {
        const valRes = await fetch("/api/auth/validate-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password: newPassword }),
        });

        if (!valRes.ok) {
          throw new Error(`Server returned HTTP ${valRes.status}`);
        }

        validationResult = await valRes.json();
      } catch (networkErr: any) {
        // Strict fail-closed: block if validation service is unreachable
        console.error("Password policy validation unreachable:", networkErr);
        setErrorMessage("Layanan validasi kebijakan password tidak dapat dijangkau. Demi keamanan, penggantian password ditolak.");
        setSubmitting(false);
        return;
      }

      if (typeof validationResult !== "object" || validationResult === null || typeof validationResult.valid !== "boolean") {
        setErrorMessage("Respon validasi keamanan tidak valid. Penggantian password dibatalkan.");
        setSubmitting(false);
        return;
      }

      if (validationResult.valid !== true) {
        const violationText = validationResult.errors && validationResult.errors.length > 0
          ? validationResult.errors.join(". ")
          : "Password baru tidak memenuhi kebijakan keamanan.";
        setErrorMessage(violationText);
        setSubmitting(false);
        return;
      }

      // 6. Verify current password through Firebase Reauthentication
      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
      try {
        await reauthenticateWithCredential(firebaseUser, credential);
      } catch (authErr: any) {
        // Record failed audit attempt with safe metadata (no passwords logged)
        try {
          const token = await firebaseUser.getIdToken();
          await fetch("/api/auth/audit-password-change", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              result: "FAILED",
              reason: "WRONG_CURRENT_PASSWORD",
            }),
          });
        } catch {}

        if (authErr.code === "auth/wrong-password" || authErr.code === "auth/invalid-credential") {
          setErrorMessage("Password saat ini tidak benar.");
        } else if (authErr.code === "auth/too-many-requests") {
          setErrorMessage("Terlalu banyak percobaan gagal. Silakan coba beberapa saat lagi.");
        } else {
          setErrorMessage("Gagal memverifikasi password saat ini. Silakan coba lagi.");
        }
        setSubmitting(false);
        return;
      }

      // 7. Update Password in Firebase Auth
      try {
        await updatePassword(firebaseUser, newPassword);
      } catch (updErr: any) {
        // Record failed update attempt
        try {
          const token = await firebaseUser.getIdToken();
          await fetch("/api/auth/audit-password-change", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              result: "FAILED",
              reason: "FIREBASE_UPDATE_ERROR",
            }),
          });
        } catch {}

        if (updErr.code === "auth/requires-recent-login") {
          setErrorMessage("Sesi autentikasi telah kedaluwarsa. Silakan keluar dan masuk kembali sebelum mengubah kata sandi.");
        } else if (updErr.code === "auth/weak-password") {
          setErrorMessage("Password tidak memenuhi syarat keamanan Firebase.");
        } else {
          setErrorMessage("Gagal memperbarui password. Silakan coba lagi.");
        }
        setSubmitting(false);
        return;
      }

      // 8. Record audit log for successful password change
      try {
        const token = await firebaseUser.getIdToken();
        await fetch("/api/auth/audit-password-change", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            result: "SUCCESS",
            reason: "User initiated password update",
          }),
        });
      } catch (auditErr) {
        console.warn("Notice: could not record audit log:", auditErr);
      }

      // 9. Reset sensitive inputs and show success feedback
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMessage("Kata sandi akun Anda berhasil diperbarui!");
    } catch (err: any) {
      console.error("Unhandled error during password update:", err);
      setErrorMessage("Terjadi kesalahan sistem yang tidak terduga. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <User className="w-8 h-8 text-slate-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Masuk ke Akun Anda</h1>
        <p className="text-slate-500 mb-8 text-sm leading-relaxed">
          Silakan masuk terlebih dahulu untuk mengelola pengaturan profil dan keamanan akun Anda di iStore.id.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center justify-center gap-2 w-full bg-primary text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition shadow-sm"
        >
          Masuk Sekarang
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const roleLabel = role === "pemilik" ? "Pemilik Toko" : role === "admin" ? "Administrator" : "Pelanggan";
  const roleBadgeColor = role === "pemilik" 
    ? "bg-amber-100 text-amber-800 border-amber-200" 
    : role === "admin" 
    ? "bg-purple-100 text-purple-800 border-purple-200" 
    : "bg-blue-100 text-blue-800 border-blue-200";

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <div className="max-w-5xl mx-auto px-4 pt-10 pb-6">
        {/* Header section with minimal branding */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Pengaturan Akun</h1>
          <p className="text-slate-500 mt-2 text-sm max-w-2xl">
            Kelola profil pribadi, keamanan autentikasi, dan akses layanan iStore.id Anda dalam satu tempat yang aman.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Identity & Quick Actions */}
          <div className="lg:col-span-4 space-y-6">
            {/* 1. Profile Header Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="h-20 bg-primary/5 border-b border-slate-100 flex items-end justify-center pb-0">
                <div className="translate-y-1/2 p-1 bg-white rounded-full border border-slate-200">
                  <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white font-bold text-2xl shadow-inner">
                    {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
                  </div>
                </div>
              </div>
              
              <div className="pt-10 pb-6 px-6 text-center">
                {isEditingName ? (
                  <div className="space-y-2 mb-4">
                    <div className="relative group">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        disabled={nameSubmitting}
                        autoFocus
                        className={`w-full px-4 py-2 bg-slate-50 border ${nameError ? "border-red-300 ring-red-100" : "border-slate-200 focus:ring-primary/20"} rounded-xl text-sm font-bold text-center focus:outline-none focus:ring-4 transition`}
                        placeholder="Masukkan nama baru"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdateName();
                          if (e.key === "Escape") {
                            setIsEditingName(false);
                            setNewName(user?.displayName || "");
                            setNameError(null);
                          }
                        }}
                      />
                      {nameSubmitting && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
                        </div>
                      )}
                    </div>
                    {nameError && (
                      <p className="text-[10px] font-bold text-red-600">{nameError}</p>
                    )}
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={handleUpdateName}
                        disabled={nameSubmitting}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition"
                      >
                        <Check className="w-3 h-3" />
                        Simpan
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingName(false);
                          setNewName(user?.displayName || "");
                          setNameError(null);
                        }}
                        disabled={nameSubmitting}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 disabled:opacity-50 transition"
                      >
                        <X className="w-3 h-3" />
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group relative inline-block max-w-full">
                    <h2 className="text-lg font-bold text-slate-900 truncate px-6">
                      {user.displayName || "Pengguna iStore"}
                    </h2>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="absolute -right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white border border-slate-200 rounded-full shadow-sm text-slate-400 hover:text-primary hover:border-primary transition-all transform scale-100"
                      title="Ubah Nama"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div className="mt-1 mb-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${roleBadgeColor}`}>
                    {roleLabel}
                  </span>
                </div>
                
                <div className="space-y-3 pt-4 border-t border-slate-50">
                  <div className="flex items-center justify-center gap-2 text-slate-600 text-xs">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate max-w-[200px]">{user.email || "-"}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-slate-600 text-xs">
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {isPasswordUser ? "Email & Kata Sandi" : "Login via Google OAuth"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Quick Actions Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Akses Cepat</h3>
              <div className="grid grid-cols-1 gap-3">
                {(role === "admin" || role === "pemilik") && (
                  <Link
                    to="/admin"
                    className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-primary hover:shadow-md transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-slate-900">Panel Admin</div>
                      <div className="text-[10px] text-slate-500">Kelola operasional toko</div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                  </Link>
                )}

                <Link
                  to="/transactions/history"
                  className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:shadow-md transition-all group"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-slate-900">Riwayat Pesanan</div>
                    <div className="text-[10px] text-slate-500">Pantau transaksi terakhir Anda</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                </Link>

                <Link
                  to="/membership"
                  className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-amber-500 hover:shadow-md transition-all group"
                >
                  <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-slate-900">Membership VIP</div>
                    <div className="text-[10px] text-slate-500">Lihat keuntungan membership Anda</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 transition-colors" />
                </Link>
              </div>
            </div>
          </div>

          {/* Right Column: Security Section */}
          <div className="lg:col-span-8 space-y-10">
            {/* 3. Security Section Header */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1.5 h-8 bg-primary rounded-full"></div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Keamanan Akun</h2>
              </div>

              <div className="space-y-6">
                {/* 4. MFA prominent security card (MfaSection internal handles its own card container) */}
                <MfaSection />

                {/* 5. Password Section Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 sm:p-8">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                        <KeyRound className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">Kata Sandi Akun</h3>
                        <p className="text-xs text-slate-500">Perbarui kata sandi secara berkala untuk perlindungan maksimal</p>
                      </div>
                    </div>

                    {!isPasswordUser ? (
                      <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 mb-1">Dikelola oleh Google</h4>
                            <p className="text-xs text-slate-500 leading-relaxed max-w-lg">
                              Akun Anda terhubung langsung menggunakan <strong>Google OAuth</strong>. Keamanan kata sandi dan autentikasi dikelola sepenuhnya oleh Google. Anda tidak memerlukan kata sandi terpisah untuk layanan iStore.id.
                            </p>
                            <div className="mt-4">
                              <a 
                                href="https://myaccount.google.com/security" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline"
                              >
                                Kelola Keamanan Akun Google
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
                        {/* Feedback Alerts */}
                        {errorMessage && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-xs text-red-800"
                          >
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <div className="leading-relaxed font-medium">{errorMessage}</div>
                          </motion.div>
                        )}

                        {successMessage && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-xs text-emerald-800"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <div className="leading-relaxed font-bold">{successMessage}</div>
                          </motion.div>
                        )}

                        <div className="grid grid-cols-1 gap-6">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Password Saat Ini</label>
                            <div className="relative group">
                              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                                <Lock className="w-4 h-4" />
                              </div>
                              <input
                                type={showCurrentPassword ? "text" : "password"}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Masukkan password lama"
                                disabled={submitting}
                                className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
                              />
                              <button
                                type="button"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                              >
                                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Password Baru</label>
                              <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                                  <KeyRound className="w-4 h-4" />
                                </div>
                                <input
                                  type={showNewPassword ? "text" : "password"}
                                  value={newPassword}
                                  onChange={(e) => setNewPassword(e.target.value)}
                                  placeholder="Password baru"
                                  disabled={submitting}
                                  className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowNewPassword(!showNewPassword)}
                                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                                >
                                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Konfirmasi Password</label>
                              <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                                  <CheckCircle2 className="w-4 h-4" />
                                </div>
                                <input
                                  type={showConfirmPassword ? "text" : "password"}
                                  value={confirmPassword}
                                  onChange={(e) => setConfirmPassword(e.target.value)}
                                  placeholder="Ulangi password baru"
                                  disabled={submitting}
                                  className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                                >
                                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Password Strength Indicators */}
                        <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-3">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Standar Keamanan</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                            <div className="flex items-center gap-2.5">
                              {policyStatus.hasMinLength ? (
                                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 shadow-sm"><Check className="w-3 h-3 text-emerald-600" /></div>
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-slate-200 shrink-0" />
                              )}
                              <span className={`text-[11px] font-medium ${policyStatus.hasMinLength ? "text-slate-900" : "text-slate-400"}`}>Minimal {policy.minPasswordLength || 8} Karakter</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                              {policyStatus.hasNumber ? (
                                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 shadow-sm"><Check className="w-3 h-3 text-emerald-600" /></div>
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-slate-200 shrink-0" />
                              )}
                              <span className={`text-[11px] font-medium ${policyStatus.hasNumber ? "text-slate-900" : "text-slate-400"}`}>Mengandung Angka</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                              {policyStatus.isMatching ? (
                                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 shadow-sm"><Check className="w-3 h-3 text-emerald-600" /></div>
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-slate-200 shrink-0" />
                              )}
                              <span className={`text-[11px] font-medium ${policyStatus.isMatching ? "text-slate-900" : "text-slate-400"}`}>Konfirmasi Cocok</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2">
                          <button
                            type="submit"
                            disabled={submitting || !policyStatus.allPassed || !policyStatus.isMatching}
                            className="w-full sm:w-auto px-10 py-3.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-3"
                          >
                            {submitting ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Menyimpan...</span>
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-4 h-4" />
                                <span>Update Password</span>
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
