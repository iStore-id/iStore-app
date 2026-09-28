import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { useAuthStore } from "../store/auth-store";
import { AlertCircle, LogIn, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    fetch("/api/public/store-config")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setConfig(data.data);
        }
      })
      .catch(err => console.error("Failed to fetch store config:", err));
  }, []);

  useEffect(() => {
    if (user) {
      if (role === "pemilik") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    }
  }, [user, role, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured || !supabase) {
      setError("Konfigurasi Supabase belum lengkap.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (loginError) throw loginError;
      navigate("/");
    } catch (err: any) {
      console.error("Supabase Login error:", err);
      let errorMsg = "Gagal masuk. Periksa kembali email dan password Anda.";
      if (err.message === "Invalid login credentials") {
        errorMsg = "Email atau password salah.";
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Konfigurasi Supabase belum lengkap.");
      return;
    }
    setError("");
    setGoogleLoading(true);
    try {
      const redirectUrl = typeof window !== "undefined" ? `${window.location.origin}/login` : "https://ist.web.id/login";
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: "offline",
            prompt: "consent"
          }
        }
      });
      if (googleError) throw googleError;
    } catch (err: any) {
      console.error("Supabase Google Sign-In error:", err);
      setError(err.message || "Gagal melakukan autentikasi Google.");
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError("Masukkan email Anda terlebih dahulu untuk mengatur ulang password.");
      return;
    }
    if (!supabase) return;
    setError("");
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setResetSent(true);
    } catch (err: any) {
      console.error("Password reset error:", err);
      setError(err.message || "Gagal mengirim email reset password.");
    }
  };

  const getAuthBackgroundStyle = () => {
    if (!config) return {};
    
    if (config.authBackgroundMode === "image" && config.authBackgroundImage) {
      return {
        backgroundImage: `url("${config.authBackgroundImage}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed"
      };
    }
    
    if (config.authBackgroundColor) {
      return { backgroundColor: config.authBackgroundColor };
    }
    
    return {};
  };

  const primaryColor = config?.primaryColor || "#ff4400";
  const storeName = config?.name || "iStore.id";
  const storeLogo = config?.logo;

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12" style={getAuthBackgroundStyle()}>
      <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-slate-100">
        <div className="text-center mb-8">
          {storeLogo ? (
            <img 
              src={storeLogo} 
              alt={storeName} 
              className="h-16 max-w-[180px] object-contain mx-auto mb-4"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg"
              style={{ backgroundColor: primaryColor, boxShadow: `0 10px 15px -3px ${primaryColor}40` }}
            >
              {storeName.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="ui-page-title text-slate-900">Masuk ke {storeName}</h1>
          <p className="text-slate-500 mt-2 text-sm">Silakan masuk menggunakan akun Anda</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl mb-6 flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="font-semibold leading-snug">{error}</p>
          </div>
        )}

        {resetSent && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-xl mb-6 flex items-start gap-3 text-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="font-medium leading-snug">
              Tautan reset password telah dikirim ke <strong>{email}</strong>. Silakan periksa email Anda.
            </p>
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": primaryColor } as any}
              placeholder="nama@email.com"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs font-medium hover:opacity-80"
                style={{ color: primaryColor }}
              >
                Lupa Password?
              </button>
            </div>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": primaryColor } as any}
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || googleLoading}
            className="w-full text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 shadow-lg active:scale-[0.98]"
            style={{ backgroundColor: primaryColor, boxShadow: `0 10px 15px -3px ${primaryColor}40` }}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Masuk Sekarang
              </>
            )}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-slate-400 font-medium">Atau</span>
          </div>
        </div>

        <button 
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading || googleLoading}
          className="w-full bg-white border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3 shadow-sm disabled:opacity-70 group"
        >
          {googleLoading ? (
            <div className="w-5 h-5 border-2 border-slate-400 border-t-slate-700 rounded-full animate-spin"></div>
          ) : (
            <>
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span className="group-hover:text-slate-900 transition-colors">Masuk dengan Google</span>
            </>
          )}
        </button>

        <p className="text-center text-sm text-slate-600 mt-8">
          Belum punya akun? <Link to="/register" className="font-semibold hover:opacity-80 transition-colors" style={{ color: primaryColor }}>Daftar sekarang</Link>
        </p>
      </div>
    </div>
  );
}
