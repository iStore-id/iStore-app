import React, { useState, useEffect } from "react";
import { KeyRound, RefreshCw, CheckCircle2 } from "lucide-react";

interface OtpInputProps {
  onVerify: (otp: string) => Promise<void>;
  onResend: () => Promise<void>;
  loading: boolean;
  phone: string;
}

export function OtpInput({ onVerify, onResend, loading, phone }: OtpInputProps) {
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleResend = async () => {
    if (!canResend) return;
    setCanResend(false);
    setTimer(60);
    await onResend();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) return;
    onVerify(otp);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 mx-auto mb-4">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Verifikasi Kode OTP</h2>
        <p className="text-slate-500 mt-2 text-sm">
          Kode verifikasi telah dikirim melalui WhatsApp/SMS ke <span className="font-semibold text-slate-700">{phone}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5 text-center">Masukkan 6 Digit Kode</label>
          <input
            type="text"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="w-full px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-200"
            required
            autoFocus
          />
        </div>

        <button
          type="submit"
          disabled={loading || otp.length < 6}
          className="w-full bg-brand-600 text-white font-semibold py-3 rounded-xl hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 shadow-lg shadow-brand-600/20"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Verifikasi OTP
            </>
          )}
        </button>
      </form>

      <div className="text-center">
        {canResend ? (
          <button
            onClick={handleResend}
            className="text-sm font-medium text-brand-600 hover:text-brand-700 flex items-center justify-center gap-1.5 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Kirim Ulang Kode
          </button>
        ) : (
          <p className="text-xs text-slate-400">
            Kirim ulang kode tersedia dalam <span className="font-semibold">{timer} detik</span>
          </p>
        )}
      </div>
    </div>
  );
}
