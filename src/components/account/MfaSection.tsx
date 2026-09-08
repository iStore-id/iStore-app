import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Smartphone, 
  QrCode, 
  Key, 
  Copy, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Lock, 
  Eye, 
  EyeOff, 
  Trash2, 
  ArrowRight, 
  X,
  ExternalLink,
  Shield
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  multiFactor, 
  TotpMultiFactorGenerator, 
  TotpSecret, 
  EmailAuthProvider, 
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  MultiFactorInfo
} from "firebase/auth";
import QRCode from "qrcode";
import { auth } from "../../lib/firebase";
import { useAuthStore } from "../../store/auth-store";

export default function MfaSection() {
  const { user } = useAuthStore();
  const [enrolledFactors, setEnrolledFactors] = useState<MultiFactorInfo[]>([]);
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(true);
  const [sendingVerification, setSendingVerification] = useState(false);

  // Enrollment State (Kept in-memory only, strictly cleared on completion or cancellation)
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentStep, setEnrollmentStep] = useState<"idle" | "reauth" | "scan" | "verifying">("idle");
  const [totpSecret, setTotpSecret] = useState<TotpSecret | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secretKeyDisplay, setSecretKeyDisplay] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState(false);

  // Reauth State
  const [reauthPassword, setReauthPassword] = useState("");
  const [showReauthPassword, setShowReauthPassword] = useState(false);
  const [reauthLoading, setReauthLoading] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [pendingActionAfterReauth, setPendingActionAfterReauth] = useState<"enroll" | "unenroll" | null>(null);

  // Unenroll confirmation modal state
  const [showUnenrollConfirm, setShowUnenrollConfirm] = useState(false);
  const [unenrollLoading, setUnenrollLoading] = useState(false);

  // Feedback alerts
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Determine if user has email/password provider or Google provider
  const isPasswordUser = useMemo(() => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser || !firebaseUser.providerData) return true;
    return firebaseUser.providerData.some((p) => p.providerId === "password");
  }, [user]);

  // Clean in-memory secrets on unmount
  useEffect(() => {
    return () => {
      setTotpSecret(null);
      setQrCodeDataUrl(null);
      setSecretKeyDisplay("");
      setVerificationCode("");
    };
  }, []);

  // Fetch enrolled MFA factors directly from Firebase currentUser
  const refreshMfaFactors = useCallback(async () => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) {
      setEnrolledFactors([]);
      setLoadingFactors(false);
      setIsEmailVerified(false);
      return;
    }

    try {
      await firebaseUser.reload();
      setIsEmailVerified(!!firebaseUser.emailVerified);
      const mfaUser = multiFactor(firebaseUser);
      setEnrolledFactors(mfaUser.enrolledFactors || []);
    } catch (err: any) {
      console.warn("Could not reload Firebase user factors:", err);
      // Fallback to cached enrolledFactors without reload if token was refreshed
      if (firebaseUser) {
        setIsEmailVerified(!!firebaseUser.emailVerified);
        const mfaUser = multiFactor(firebaseUser);
        setEnrolledFactors(mfaUser.enrolledFactors || []);
      }
    } finally {
      setLoadingFactors(false);
    }
  }, []);

  useEffect(() => {
    refreshMfaFactors();
  }, [refreshMfaFactors]);

  // Handler to send email verification
  const handleSendVerificationEmail = async () => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) return;
    setSendingVerification(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await sendEmailVerification(firebaseUser);
      setActionSuccess(`Email verifikasi telah dikirim ke ${firebaseUser.email}. Silakan periksa inbox/spam email Anda lalu muat ulang halaman.`);
    } catch (err: any) {
      setActionError(mapFirebaseError(err, "enroll"));
    } finally {
      setSendingVerification(false);
    }
  };

  // Map Firebase errors to user-friendly indonesian messages
  const mapFirebaseError = (err: any, context: "enroll" | "verify" | "unenroll" | "reauth"): string => {
    const code = err?.code || "";
    if (code === "auth/requires-recent-login") {
      return "Sesi Anda telah kedaluwarsa. Diperlukan autentikasi ulang untuk melanjutkan tindakan keamanan ini.";
    }
    if (code === "auth/invalid-verification-code") {
      return "Kode verifikasi 6-digit salah atau telah kedaluwarsa. Pastikan jam pada perangkat Anda sinkron dan masukkan kode terbaru.";
    }
    if (code === "auth/operation-not-allowed" || code === "auth/configuration-not-found") {
      return "Fitur Authenticator App (TOTP) belum diaktifkan pada konfigurasi proyek Firebase. Silakan hubungi administrator.";
    }
    if (code === "auth/unsupported-first-factor") {
      return "Metode autentikasi yang Anda gunakan belum mendukung pendaftaran MFA.";
    }
    if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
      return "Kata sandi yang Anda masukkan tidak sesuai.";
    }
    if (code === "auth/too-many-requests") {
      return "Terlalu banyak percobaan gagal. Demi keamanan akun, silakan tunggu beberapa saat sebelum mencoba kembali.";
    }
    if (code === "auth/network-request-failed") {
      return "Koneksi jaringan terputus. Pastikan perangkat Anda terhubung ke internet.";
    }
    if (code === "auth/popup-closed-by-user") {
      return "Jendela autentikasi Google ditutup sebelum proses selesai.";
    }
    if (err?.message && typeof err.message === "string" && err.message.length < 120 && !err.message.includes("api/")) {
      return err.message;
    }
    return "Terjadi kesalahan saat memproses keamanan akun. Silakan coba kembali.";
  };

  // Safe Audit Logger (Zero Secret / Zero OTP Leakage)
  const logMfaAudit = async (action: "MFA_ENROLL" | "MFA_UNENROLL", result: "SUCCESS" | "FAILED", reason?: string) => {
    try {
      const firebaseUser = auth?.currentUser;
      if (!firebaseUser) return;
      const token = await firebaseUser.getIdToken();
      await fetch("/api/auth/audit-mfa-change", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action,
          result,
          reason: reason ? reason.substring(0, 100) : undefined
        })
      });
    } catch {
      // Non-blocking notice for audit recording
    }
  };

  // Cancel Enrollment Flow and Clear In-Memory Secrets
  const handleCancelEnrollment = () => {
    setIsEnrolling(false);
    setEnrollmentStep("idle");
    setTotpSecret(null);
    setQrCodeDataUrl(null);
    setSecretKeyDisplay("");
    setVerificationCode("");
    setActionError(null);
    setReauthError(null);
    setReauthPassword("");
  };

  // Begin TOTP Enrollment
  const handleStartEnrollment = async () => {
    setActionError(null);
    setActionSuccess(null);

    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) {
      setActionError("Sesi Anda tidak ditemukan. Silakan masuk kembali terlebih dahulu.");
      return;
    }

    // Security Gate: Ensure email is verified before initiating MFA enrollment
    try {
      await firebaseUser.reload();
      setIsEmailVerified(!!firebaseUser.emailVerified);
    } catch {
      // Non-blocking catch for user reload
    }

    if (!firebaseUser.emailVerified) {
      setActionError(
        "Email akun Anda belum diverifikasi. Demi standar keamanan, Autentikasi Dua Faktor (MFA) hanya dapat diaktifkan setelah alamat email Anda terverifikasi."
      );
      return;
    }

    setIsEnrolling(true);
    setEnrollmentStep("idle");

    try {
      // 1. Get MFA session from Firebase Auth
      let session;
      try {
        session = await multiFactor(firebaseUser).getSession();
      } catch (sessErr: any) {
        if (sessErr.code === "auth/requires-recent-login") {
          setPendingActionAfterReauth("enroll");
          setEnrollmentStep("reauth");
          return;
        }
        throw sessErr;
      }

      // 2. Generate TOTP secret through Firebase Identity Platform
      const secret = await TotpMultiFactorGenerator.generateSecret(session);
      
      // 3. Generate QR code URL using standard otpauth URI
      const appIssuer = "iStore.id";
      const userAccount = firebaseUser.email || "User";
      const otpauthUrl = secret.generateQrCodeUrl(userAccount, appIssuer);

      // 4. Render QR code purely client-side into base64 data URL
      const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
        width: 220,
        margin: 2,
        color: {
          dark: "#0f172a",
          light: "#ffffff"
        }
      });

      // 5. Format secret key with spaces for easy manual entry (e.g. ABCD EFGH 1234 5678)
      const rawSecret = secret.secretKey || "";
      const formatted = rawSecret.replace(/(.{4})/g, "$1 ").trim();

      // Set in memory ONLY
      setTotpSecret(secret);
      setQrCodeDataUrl(qrDataUrl);
      setSecretKeyDisplay(formatted);
      setEnrollmentStep("scan");
    } catch (err: any) {
      console.error("Error generating TOTP secret:", err);
      if (err.code === "auth/requires-recent-login") {
        setPendingActionAfterReauth("enroll");
        setEnrollmentStep("reauth");
      } else {
        setActionError(mapFirebaseError(err, "enroll"));
        setIsEnrolling(false);
        setEnrollmentStep("idle");
      }
    }
  };

  // Execute Re-authentication for sensitive security action
  const handleReauthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReauthError(null);

    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) {
      setReauthError("Sesi berakhir. Silakan masuk kembali.");
      return;
    }

    setReauthLoading(true);
    try {
      if (isPasswordUser) {
        if (!reauthPassword) {
          setReauthError("Kata sandi wajib diisi untuk verifikasi.");
          setReauthLoading(false);
          return;
        }
        const credential = EmailAuthProvider.credential(firebaseUser.email!, reauthPassword);
        await reauthenticateWithCredential(firebaseUser, credential);
      } else {
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(firebaseUser, provider);
      }

      // Reauth success! Reset reauth password state
      setReauthPassword("");
      setReauthLoading(false);

      if (pendingActionAfterReauth === "enroll") {
        // Continue to secret generation
        handleStartEnrollment();
      } else if (pendingActionAfterReauth === "unenroll") {
        // Continue to unenrollment
        setShowUnenrollConfirm(false);
        setEnrollmentStep("idle");
        executeUnenroll();
      } else {
        setEnrollmentStep("idle");
      }
    } catch (err: any) {
      console.error("Reauthentication failure:", err);
      setReauthLoading(false);
      setReauthError(mapFirebaseError(err, "reauth"));
    }
  };

  // Verify 6-digit Code & Enroll into Firebase
  const handleVerifyAndEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    const cleanedCode = verificationCode.replace(/\s+/g, "").trim();
    if (!cleanedCode || cleanedCode.length !== 6 || !/^\d{6}$/.test(cleanedCode)) {
      setActionError("Masukkan 6 digit angka dari aplikasi authenticator Anda.");
      return;
    }

    if (!totpSecret) {
      setActionError("Sesi pendaftaran tidak ditemukan. Silakan mulai ulang pendaftaran.");
      return;
    }

    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) {
      setActionError("Sesi akun tidak aktif.");
      return;
    }

    setEnrollmentStep("verifying");

    try {
      // 1. Create assertion from secret and user-entered 6 digit OTP
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(totpSecret, cleanedCode);

      // 2. Enroll factor into Firebase MultiFactorUser
      const displayName = "Authenticator App (TOTP)";
      await multiFactor(firebaseUser).enroll(assertion, displayName);

      // 3. Reload Firebase User to refresh authentication tokens and factors
      await firebaseUser.reload();

      // 4. Record safe audit log (NO secret or OTP logged)
      await logMfaAudit("MFA_ENROLL", "SUCCESS", "User completed TOTP enrollment");

      // 5. Clean in-memory secrets immediately
      setTotpSecret(null);
      setQrCodeDataUrl(null);
      setSecretKeyDisplay("");
      setVerificationCode("");
      setIsEnrolling(false);
      setEnrollmentStep("idle");

      // 6. Refresh factors list & show success notice
      await refreshMfaFactors();
      setActionSuccess("Autentikasi Dua Faktor (MFA) berhasil diaktifkan! Akun Anda kini terlindungi dengan verifikasi aplikasi authenticator.");
    } catch (err: any) {
      console.error("Error finalizing TOTP enrollment:", err);
      setEnrollmentStep("scan");
      
      if (err.code === "auth/requires-recent-login") {
        setPendingActionAfterReauth("enroll");
        setEnrollmentStep("reauth");
        return;
      }

      await logMfaAudit("MFA_ENROLL", "FAILED", err.code || "UNKNOWN_ERROR");
      setActionError(mapFirebaseError(err, "verify"));
    }
  };

  // Unenroll MFA Factor
  const executeUnenroll = async () => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) return;

    setUnenrollLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const mfaUser = multiFactor(firebaseUser);
      const factorToUnenroll = mfaUser.enrolledFactors.find(
        (f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID
      ) || mfaUser.enrolledFactors[0];

      if (!factorToUnenroll) {
        setShowUnenrollConfirm(false);
        setUnenrollLoading(false);
        return;
      }

      // Unenroll via Firebase Auth SDK
      await mfaUser.unenroll(factorToUnenroll);
      await firebaseUser.reload();

      // Record safe audit log
      await logMfaAudit("MFA_UNENROLL", "SUCCESS", "User unenrolled TOTP Authenticator");

      await refreshMfaFactors();
      setShowUnenrollConfirm(false);
      setActionSuccess("Autentikasi Dua Faktor telah dinonaktifkan dari akun Anda.");
    } catch (err: any) {
      console.error("Error unenrolling MFA:", err);
      if (err.code === "auth/requires-recent-login") {
        setShowUnenrollConfirm(false);
        setPendingActionAfterReauth("unenroll");
        setIsEnrolling(true);
        setEnrollmentStep("reauth");
      } else {
        await logMfaAudit("MFA_UNENROLL", "FAILED", err.code || "UNKNOWN_ERROR");
        setActionError(mapFirebaseError(err, "unenroll"));
      }
    } finally {
      setUnenrollLoading(false);
    }
  };

  const isMfaActive = enrolledFactors.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div className="flex items-start gap-3.5">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
            isMfaActive ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-blue-50 text-primary border border-blue-100"
          }`}>
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Autentikasi Dua Faktor (MFA)</h2>
              {/* Status Badge */}
              {loadingFactors ? (
                <div className="w-16 h-5 bg-slate-100 rounded-full animate-pulse" />
              ) : isMfaActive ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Aktif
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                  Belum Aktif
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Tambahkan lapisan perlindungan ekstra menggunakan aplikasi authenticator pihak ketiga (Google Authenticator, Microsoft Authenticator, dll.)
            </p>
          </div>
        </div>

        {/* Top Action Button */}
        {!isEnrolling && (
          <div className="shrink-0 flex items-center gap-2">
            {isMfaActive ? (
              <button
                type="button"
                id="unenroll-mfa-init-btn"
                onClick={() => setShowUnenrollConfirm(true)}
                disabled={loadingFactors}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Nonaktifkan MFA</span>
              </button>
            ) : (
              <button
                type="button"
                id="start-mfa-enrollment-btn"
                onClick={handleStartEnrollment}
                disabled={loadingFactors}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-primary hover:bg-blue-700 rounded-xl transition shadow-xs"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Aktifkan MFA</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Global Alerts */}
      <div className="mt-6 space-y-3">
        {actionError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            id="mfa-error-alert"
            className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-xs text-red-800"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed flex-1">{actionError}</div>
            <button 
              type="button" 
              onClick={() => setActionError(null)}
              className="text-red-400 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {actionSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            id="mfa-success-alert"
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-xs text-emerald-800"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-medium flex-1">{actionSuccess}</div>
            <button 
              type="button" 
              onClick={() => setActionSuccess(null)}
              className="text-emerald-400 hover:text-emerald-600"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </div>

      {/* Main Content Area */}
      {!isEnrolling ? (
        <div className="mt-6">
          {isMfaActive ? (
            <div className="p-4 sm:p-5 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="text-xs">
                  <h3 className="font-semibold text-emerald-950 text-sm">Akun Anda Telah Terlindungi MFA</h3>
                  <p className="text-emerald-800/80 mt-1 leading-relaxed">
                    Setiap kali Anda masuk ke iStore.id, Anda akan diminta memasukkan kode 6-digit yang dihasilkan dari aplikasi authenticator di ponsel Anda.
                  </p>
                </div>
              </div>

              {/* Factors Details List */}
              <div className="bg-white rounded-xl border border-emerald-200/60 p-4 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Faktor Keamanan Terdaftar:
                </div>
                {enrolledFactors.map((factor, index) => (
                  <div key={factor.uid || index} className="flex items-center justify-between py-1 text-xs">
                    <div className="flex items-center gap-2 text-slate-700 font-medium">
                      <Smartphone className="w-4 h-4 text-primary" />
                      <span>{factor.displayName || "Aplikasi Authenticator (TOTP)"}</span>
                    </div>
                    {factor.enrollmentTime && (
                      <span className="text-[11px] text-slate-400">
                        Terdaftar: {new Date(factor.enrollmentTime).toLocaleDateString("id-ID")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200/80 rounded-2xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1 text-xs text-slate-600">
                  <h3 className="font-semibold text-slate-800 text-sm">Mengapa Mengaktifkan MFA?</h3>
                  <p className="leading-relaxed text-slate-500 max-w-xl">
                    Autentikasi dua faktor memblokir upaya masuk ilegal bahkan jika seseorang mengetahui kata sandi Anda. Anda dapat menggunakan Google Authenticator, Microsoft Authenticator, atau aplikasi sejenis secara gratis.
                  </p>
                </div>
                <button
                  type="button"
                  id="activate-mfa-inline-btn"
                  onClick={handleStartEnrollment}
                  className="shrink-0 px-4 py-2 bg-white border border-slate-300 hover:border-primary text-slate-700 hover:text-primary font-semibold text-xs rounded-xl transition shadow-2xs"
                >
                  Mulai Pengaturan
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Enrollment Active Card */
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-6 bg-slate-50 border border-slate-200 rounded-2xl"
        >
          {/* STEP: Reauthentication Required */}
          {enrollmentStep === "reauth" && (
            <div className="max-w-md mx-auto py-2">
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">Konfirmasi Identitas Anda</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Demi keamanan akun, silakan verifikasi identitas Anda sebelum mengubah pengaturan keamanan MFA.
                </p>
              </div>

              {reauthError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{reauthError}</span>
                </div>
              )}

              {isPasswordUser ? (
                <form onSubmit={handleReauthSubmit} className="space-y-4">
                  <div>
                    <label 
                      htmlFor="reauth-password-input"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Kata Sandi Saat Ini <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="reauth-password-input"
                        type={showReauthPassword ? "text" : "password"}
                        value={reauthPassword}
                        onChange={(e) => setReauthPassword(e.target.value)}
                        placeholder="Masukkan kata sandi akun"
                        disabled={reauthLoading}
                        className="w-full pl-3 pr-10 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowReauthPassword(!showReauthPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {showReauthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      id="cancel-reauth-btn"
                      onClick={handleCancelEnrollment}
                      disabled={reauthLoading}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      id="submit-reauth-btn"
                      disabled={reauthLoading}
                      className="px-5 py-2 text-xs font-semibold text-white bg-primary hover:bg-blue-700 rounded-xl transition flex items-center gap-2 shadow-xs"
                    >
                      {reauthLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Memverifikasi...</span>
                        </>
                      ) : (
                        <span>Lanjutkan</span>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4 text-center">
                  <p className="text-xs text-slate-600">
                    Akun Anda terhubung dengan Google Sign-In. Silakan klik tombol di bawah untuk memverifikasi sesi Google Anda.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleCancelEnrollment}
                      disabled={reauthLoading}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      id="reauth-google-btn"
                      onClick={handleReauthSubmit}
                      disabled={reauthLoading}
                      className="px-5 py-2 text-xs font-semibold text-white bg-primary hover:bg-blue-700 rounded-xl transition flex items-center gap-2 shadow-xs"
                    >
                      {reauthLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>Verifikasi Akun Google</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP: Scan QR Code & Enter 6-Digit Code */}
          {(enrollmentStep === "scan" || enrollmentStep === "verifying") && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-primary flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm">
                    Pindai Kode QR atau Masukkan Kunci Rahasia
                  </h3>
                </div>
                <button
                  type="button"
                  id="cancel-mfa-enrollment-x-btn"
                  onClick={handleCancelEnrollment}
                  className="text-slate-400 hover:text-slate-600 p-1"
                  title="Batalkan pendaftaran"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Instructions & QR Visual Layout */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* QR Code Container */}
                <div className="md:col-span-5 flex flex-col items-center justify-center p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
                  {qrCodeDataUrl ? (
                    <img 
                      id="totp-qr-image"
                      src={qrCodeDataUrl} 
                      alt="Pindai QR Code untuk Authenticator" 
                      className="w-48 h-48 rounded-lg shadow-2xs"
                    />
                  ) : (
                    <div className="w-48 h-48 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    </div>
                  )}
                  <span className="text-[11px] font-medium text-slate-500 mt-3 text-center">
                    Kompatibel dengan Google Authenticator, Microsoft Authenticator, & 1Password
                  </span>
                </div>

                {/* Steps & Manual Key */}
                <div className="md:col-span-7 space-y-4">
                  <div className="space-y-2 text-xs text-slate-600">
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-slate-900 shrink-0">Langkah A:</span>
                      <span>Buka aplikasi Authenticator di smartphone Anda.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-slate-900 shrink-0">Langkah B:</span>
                      <span>Pindai kode QR di samping, atau salin kunci rahasia manual di bawah jika kamera Anda tidak dapat memindai.</span>
                    </div>
                  </div>

                  {/* Manual Key Block */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Kunci Rahasia Manual:
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <code 
                        id="totp-secret-key-display"
                        className="font-mono text-xs text-slate-900 font-bold tracking-wider break-all select-all"
                      >
                        {secretKeyDisplay || "Memuat..."}
                      </code>
                      {totpSecret?.secretKey && (
                        <button
                          type="button"
                          id="copy-totp-secret-btn"
                          onClick={() => {
                            navigator.clipboard.writeText(totpSecret.secretKey);
                            setCopiedKey(true);
                            setTimeout(() => setCopiedKey(false), 2000);
                          }}
                          className="shrink-0 p-1.5 text-xs text-slate-500 hover:text-primary hover:bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-1 transition"
                          title="Salin kunci rahasia"
                        >
                          {copiedKey ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-[10px] text-emerald-600 font-semibold">Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span className="text-[10px]">Salin</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Step 2: Verification Input Form */}
                  <div className="pt-2 border-t border-slate-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-primary flex items-center justify-center font-bold text-xs">
                        2
                      </div>
                      <h3 className="font-semibold text-slate-900 text-sm">
                        Masukkan 6 Digit Kode dari Authenticator
                      </h3>
                    </div>

                    <form onSubmit={handleVerifyAndEnroll} className="space-y-4">
                      <div>
                        <label 
                          htmlFor="mfa-verification-code-input"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Kode Verifikasi 6-Digit <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="mfa-verification-code-input"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          value={verificationCode}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            setVerificationCode(val);
                          }}
                          placeholder="Contoh: 123456"
                          disabled={enrollmentStep === "verifying"}
                          className="w-full sm:w-60 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-center text-lg font-mono font-bold tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary transition"
                          autoFocus
                          autoComplete="one-time-code"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          id="cancel-mfa-enroll-btn"
                          onClick={handleCancelEnrollment}
                          disabled={enrollmentStep === "verifying"}
                          className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                        >
                          Batalkan
                        </button>
                        <button
                          type="submit"
                          id="submit-mfa-verification-btn"
                          disabled={enrollmentStep === "verifying" || verificationCode.length !== 6}
                          className="px-6 py-2.5 text-xs font-semibold text-white bg-primary hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition flex items-center gap-2 shadow-xs"
                        >
                          {enrollmentStep === "verifying" ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Memverifikasi Kode...</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-4 h-4" />
                              <span>Verifikasi & Aktifkan MFA</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Unenroll Confirmation Modal */}
      <AnimatePresence>
        {showUnenrollConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold text-slate-900">Nonaktifkan Autentikasi Dua Faktor?</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Apakah Anda yakin ingin menonaktifkan MFA? Akun Anda tidak lagi dilindungi oleh faktor keamanan kedua saat masuk.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  id="cancel-unenroll-btn"
                  onClick={() => setShowUnenrollConfirm(false)}
                  disabled={unenrollLoading}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  id="confirm-unenroll-btn"
                  onClick={executeUnenroll}
                  disabled={unenrollLoading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl transition flex items-center gap-2 shadow-xs"
                >
                  {unenrollLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menonaktifkan...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Ya, Nonaktifkan</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
