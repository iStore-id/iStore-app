import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { ShieldCheck, AlertCircle, CheckCircle2, Lock, Eye, EyeOff, Check, Shield, AlertTriangle } from "lucide-react";
import { motion } from "motion/react";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  const [policy, setPolicy] = useState<any>({
    minPasswordLength: 8,
    requirePasswordNumbers: true,
    requirePasswordSymbols: false
  });

  const policyStatus = {
    hasMinLength: newPassword.length >= (policy.minPasswordLength || 8),
    hasNumber: !policy.requirePasswordNumbers || /\d/.test(newPassword),
    hasSymbol: !policy.requirePasswordSymbols || /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
    isMatching: newPassword === confirmPassword && confirmPassword.length > 0,
    allPassed: false
  };
  policyStatus.allPassed = policyStatus.hasMinLength && policyStatus.hasNumber && policyStatus.hasSymbol;

  useEffect(() => {
    // Fetch password policy if needed
    const fetchPolicy = async () => {
       try {
         const res = await fetch("/api/auth/password-policy");
         const data = await res.json();
         if (data.success && data.policy) setPolicy(data.policy);
       } catch (e) {
         console.warn("Failed to fetch password policy", e);
       }
    };
    fetchPolicy();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyStatus.allPassed) {
      setErrorMessage("Kata sandi tidak memenuhi kriteria keamanan.");
      return;
    }
    if (!policyStatus.isMatching) {
      setErrorMessage("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: any) {
      console.error("Supabase Reset Password error:", err);
      setErrorMessage(err.message || "Gagal mereset kata sandi. Tautan mungkin kedaluwarsa.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-3xl p-10 text-center shadow-sm border border-slate-100">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="ui-page-title text-slate-900 mb-2">Berhasil!</h1>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Kata sandi Anda telah berhasil diperbarui. Silakan gunakan kata sandi baru untuk masuk ke akun Anda.
          </p>
          <Link
            to="/login"
            className="inline-block w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-brand-700 transition shadow-lg shadow-primary/20"
          >
            Masuk Sekarang
          </Link>
          <p className="text-xs text-slate-400 mt-6 italic">Anda akan dialihkan secara otomatis dalam 3 detik...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="ui-page-title text-slate-900">Atur Ulang Kata Sandi</h1>
          <p className="text-slate-500 text-sm mt-1">
            Buat kata sandi baru yang memenuhi kebijakan keamanan Toko Kami
          </p>
        </div>

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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Kata Sandi Baru <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Masukkan kata sandi baru"
                disabled={submitting}
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
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
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Konfirmasi Kata Sandi Baru <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang kata sandi baru"
                disabled={submitting}
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
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

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting || !policyStatus.allPassed || !policyStatus.isMatching}
              className="w-full bg-primary text-white font-semibold py-2.5 px-4 rounded-xl hover:bg-brand-700 transition flex items-center justify-center gap-2 text-sm shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Menyimpan...</span>
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
