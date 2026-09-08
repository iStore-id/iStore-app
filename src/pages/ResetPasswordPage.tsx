import React, { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { 
  KeyRound, 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  ArrowRight, 
  Shield, 
  Check, 
  LogIn
} from "lucide-react";
import { motion } from "motion/react";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { auth } from "../lib/firebase";

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

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  // Read oobCode from URL parameters (Firebase standard parameter)
  // Used only in-memory; never stored in localStorage, sessionStorage, or logs
  const oobCode = searchParams.get("oobCode") || searchParams.get("code") || "";

  // Verification states
  const [verifying, setVerifying] = useState(true);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Form states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status states
  const [policy, setPolicy] = useState<PasswordPolicy>(DEFAULT_POLICY);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 1. Fetch active password policy from systemConfigs/security_settings
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
      } catch {
        // Safe fallback to defaults if network issues occur
      }
    }
    fetchPolicy();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Verify oobCode using Firebase Client SDK on component mount
  useEffect(() => {
    let isMounted = true;

    async function verifyCode() {
      if (!oobCode || !oobCode.trim()) {
        if (isMounted) {
          setVerificationError("Tautan reset password tidak valid atau tidak lengkap. Silakan minta tautan baru melalui halaman masuk.");
          setVerifying(false);
        }
        return;
      }

      if (!auth) {
        if (isMounted) {
          setVerificationError("Layanan autentikasi belum siap. Silakan muat ulang halaman.");
          setVerifying(false);
        }
        return;
      }

      try {
        // Firebase Client SDK verifies code cryptographic integrity and expiration
        const email = await verifyPasswordResetCode(auth, oobCode);
        if (isMounted) {
          setVerifiedEmail(email);
          setVerifying(false);
        }
      } catch (err: any) {
        if (isMounted) {
          // Do not log oobCode or internal code details
          if (err?.code === "auth/invalid-action-code" || err?.code === "auth/expired-action-code") {
            setVerificationError("Tautan reset password tidak valid atau sudah kedaluwarsa. Silakan minta tautan reset baru.");
          } else {
            setVerificationError("Gagal memverifikasi tautan reset password. Silakan coba minta tautan baru.");
          }
          setVerifying(false);
        }
      }
    }

    verifyCode();
    return () => {
      isMounted = false;
    };
  }, [oobCode]);

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

  // Handle password reset submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!oobCode) {
      setErrorMessage("Kode reset password tidak ditemukan. Silakan minta tautan baru.");
      return;
    }

    if (!auth) {
      setErrorMessage("Layanan autentikasi belum terinisialisasi.");
      return;
    }

    // Step A: Input validations
    if (!newPassword) {
      setErrorMessage("Password baru wajib diisi.");
      return;
    }
    if (!confirmPassword) {
      setErrorMessage("Konfirmasi password baru wajib diisi.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Konfirmasi password tidak cocok.");
      return;
    }

    setSubmitting(true);

    try {
      // Step B: Strict Server-Side Validation via existing validatePasswordPolicy (/api/auth/validate-password)
      let valResult: { success?: boolean; valid?: boolean; errors?: string[] };
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

        valResult = await valRes.json();
      } catch (netErr) {
        // Fail-Closed: block update if policy service is unreachable
        console.error("Password policy validation unreachable during reset:", netErr);
        setErrorMessage("Layanan validasi kebijakan password tidak dapat dijangkau. Demi keamanan, pengaturan ulang password ditolak.");
        setSubmitting(false);
        return;
      }

      // Check response structure integrity
      if (typeof valResult !== "object" || valResult === null || typeof valResult.valid !== "boolean") {
        setErrorMessage("Respon validasi keamanan tidak valid. Pengaturan ulang password dibatalkan.");
        setSubmitting(false);
        return;
      }

      // If policy failed, show errors and block
      if (valResult.valid !== true) {
        const violationText = valResult.errors && valResult.errors.length > 0
          ? valResult.errors.join(". ")
          : "Password baru tidak memenuhi kebijakan keamanan.";
        setErrorMessage(violationText);
        setSubmitting(false);
        return;
      }

      // Step C: Update password in Firebase Auth via confirmPasswordReset
      try {
        await confirmPasswordReset(auth, oobCode, newPassword);
      } catch (fbErr: any) {
        // Record failed audit attempt with safe metadata (no credentials logged)
        if (verifiedEmail) {
          try {
            await fetch("/api/auth/audit-password-reset", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: verifiedEmail,
                result: "FAILED",
                reason: "Firebase reset failed: " + (fbErr?.code || "unknown"),
              }),
            });
          } catch {}
        }

        if (fbErr?.code === "auth/invalid-action-code" || fbErr?.code === "auth/expired-action-code") {
          setErrorMessage("Tautan reset password sudah kedaluwarsa atau telah digunakan. Silakan minta tautan baru.");
        } else if (fbErr?.code === "auth/weak-password") {
          setErrorMessage("Password tidak memenuhi kualifikasi keamanan Firebase.");
        } else if (fbErr?.code === "auth/too-many-requests") {
          setErrorMessage("Terlalu banyak percobaan gagal. Silakan tunggu beberapa saat lagi.");
        } else {
          setErrorMessage("Gagal mengatur ulang kata sandi. Silakan coba lagi atau minta tautan baru.");
        }
        setSubmitting(false);
        return;
      }

      // Step D: Record safe audit log on success
      if (verifiedEmail) {
        try {
          await fetch("/api/auth/audit-password-reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: verifiedEmail,
              result: "SUCCESS",
              reason: "User completed custom password reset flow",
            }),
          });
        } catch {}
      }

      // Step E: Reset in-memory password inputs and show success UI
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMessage("Kata sandi akun Anda berhasil diperbarui! Silakan masuk kembali dengan kata sandi baru Anda.");
    } catch {
      setErrorMessage("Terjadi kesalahan sistem yang tidak terduga. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  // State 1: Verifying action code
  if (verifying) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-primary rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-medium text-slate-600">
          Memverifikasi tautan pengaturan ulang kata sandi...
        </p>
      </div>
    );
  }

  // State 2: Verification Error (invalid/expired/missing oobCode)
  if (verificationError) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-16 bg-slate-50">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-sm border border-slate-200 text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl border border-amber-100 flex items-center justify-center mx-auto mb-5 text-amber-600">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            Tautan Tidak Valid atau Kedaluwarsa
          </h1>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            {verificationError}
          </p>
          <div className="space-y-3">
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 w-full bg-primary text-white py-3 px-6 rounded-xl font-semibold text-sm hover:bg-blue-700 transition shadow-sm"
            >
              <LogIn className="w-4 h-4" />
              <span>Kembali ke Halaman Masuk</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // State 3: Password Reset Successful
  if (successMessage) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-16 bg-slate-50">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-sm border border-slate-200 text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-center mx-auto mb-5 text-emerald-600">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            Kata Sandi Berhasil Diperbarui
          </h1>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            {successMessage}
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 w-full bg-primary text-white py-3 px-6 rounded-xl font-semibold text-sm hover:bg-blue-700 transition shadow-sm"
          >
            <span>Masuk Sekarang</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // State 4: Active Reset Form
  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-16 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-primary">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Atur Ulang Kata Sandi</h1>
          <p className="text-xs text-slate-500 mt-1">
            Buat kata sandi baru yang memenuhi kebijakan keamanan iStore.id
          </p>
          {verifiedEmail && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
              <span>Akun:</span>
              <span className="font-semibold text-slate-900 truncate max-w-[220px]">{verifiedEmail}</span>
            </div>
          )}
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 mb-5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-medium">{errorMessage}</div>
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Field 1: New Password */}
          <div>
            <label 
              htmlFor="reset-new-password-input"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Kata Sandi Baru <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="reset-new-password-input"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Masukkan kata sandi baru"
                disabled={submitting}
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                id="toggle-reset-new-password-btn"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Dynamic Policy Checklist */}
            <div className="mt-2.5 p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-[11px] text-slate-600">
              <div className="font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-primary" />
                <span>Kebijakan Keamanan Kata Sandi:</span>
              </div>
              <div className="flex items-center gap-2">
                {policyStatus.hasMinLength ? (
                  <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                )}
                <span className={policyStatus.hasMinLength ? "text-green-700 font-medium" : "text-slate-500"}>
                  Minimal {policy.minPasswordLength || 8} karakter
                </span>
              </div>
              {policy.requirePasswordNumbers && (
                <div className="flex items-center gap-2">
                  {policyStatus.hasNumber ? (
                    <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                  )}
                  <span className={policyStatus.hasNumber ? "text-green-700 font-medium" : "text-slate-500"}>
                    Mengandung minimal 1 angka (0-9)
                  </span>
                </div>
              )}
              {policy.requirePasswordSymbols && (
                <div className="flex items-center gap-2">
                  {policyStatus.hasSymbol ? (
                    <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                  )}
                  <span className={policyStatus.hasSymbol ? "text-green-700 font-medium" : "text-slate-500"}>
                    Mengandung minimal 1 karakter simbol khusus
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Field 2: Confirm Password */}
          <div>
            <label 
              htmlFor="reset-confirm-password-input"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Konfirmasi Kata Sandi Baru <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="reset-confirm-password-input"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang kata sandi baru"
                disabled={submitting}
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                id="toggle-reset-confirm-password-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && (
              <div className="mt-1 text-[11px] flex items-center gap-1.5">
                {policyStatus.isMatching ? (
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" /> Konfirmasi cocok
                  </span>
                ) : (
                  <span className="text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Konfirmasi belum cocok
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              id="submit-reset-password-btn"
              disabled={submitting}
              className="w-full bg-primary text-white font-semibold py-2.5 px-4 rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2 text-sm shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Memvalidasi & Menyimpan...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Simpan Kata Sandi Baru</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Back to login */}
        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <Link
            to="/login"
            className="text-xs text-slate-500 hover:text-slate-800 font-medium transition"
          >
            Batal dan kembali ke Halaman Masuk
          </Link>
        </div>
      </div>
    </div>
  );
}
