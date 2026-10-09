import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { useAuthStore } from "../store/auth-store";
import { AlertCircle, UserPlus, Mail } from "lucide-react";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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

  const syncUser = async (sbUser: any, accessToken: string, fullName: string) => {
    const userEmail = sbUser.email || "";

    const response = await fetch("/api/auth/sync-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        name: fullName || userEmail.split("@")[0] || "User",
        email: userEmail,
      })
    });

    const syncData = await response.json();
    if (!response.ok || !syncData?.success) {
      throw new Error(syncData?.message || syncData?.error || "Gagal menyinkronkan profil akun.");
    }

    const userData = {
      uid: sbUser.id,
      email: userEmail,
      displayName: fullName || userEmail.split("@")[0] || "User"
    };
    setUser(userData, syncData.role || "customer");
    return syncData.role || "customer";
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured || !supabase) {
      setError("Konfigurasi Supabase belum lengkap.");
      return;
    }

    setError("");
    setNotice("");
    setLoading(true);

    // 1. Password Policy Validation via Backend API
    let validationPassed = false;
    try {
      const valRes = await fetch("/api/auth/validate-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      
      let valData;
      try {
        valData = await valRes.json();
      } catch {
        setError("Validasi keamanan tidak dapat dilakukan. Silakan coba lagi.");
        setLoading(false);
        return;
      }

      if (!valRes.ok) {
        const errorMsg = valData?.errors?.join(". ") || valData?.message || "Password tidak memenuhi kebijakan keamanan.";
        setError(errorMsg);
        setLoading(false);
        return;
      }
      validationPassed = valData.valid === true;
    } catch {
      setError("Validasi keamanan tidak dapat dilakukan. Silakan coba lagi.");
      setLoading(false);
      return;
    }

    if (!validationPassed) {
      setError("Validasi keamanan tidak dapat dilakukan.");
      setLoading(false);
      return;
    }

    try {
      // 2. Supabase Sign Up
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: name.trim(),
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error("Gagal mendaftarkan akun.");

      if (!authData.session?.access_token) {
        setNotice("Jika email ini dapat didaftarkan, tautan konfirmasi akan dikirim ke alamat tersebut. Periksa kotak masuk dan folder spam. Jika Anda sudah memiliki akun, silakan masuk.");
        return;
      }

      const role = await syncUser(authData.user, authData.session.access_token, name.trim());

      if (role === "pemilik") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (err: any) {
      console.error("Registration error:", err);
      const errorCode = typeof err?.code === "string" ? err.code : "";
      const errorMessage = typeof err?.message === "string" ? err.message : "";
      if (
        errorCode === "user_already_exists" ||
        /user already (registered|exists)|email.*already.*(registered|exists)/i.test(errorMessage)
      ) {
        setError("Email ini sudah terdaftar. Silakan masuk menggunakan akun Anda.");
      } else {
        setError(errorMessage || "Gagal mendaftarkan akun. Silakan coba lagi.");
      }
    } finally {
      setLoading(false);
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
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12" style={getAuthBackgroundStyle()}>
      <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-slate-100">
        <div className="text-center mb-8">
          {storeLogo ? (
            <img 
              src={storeLogo} 
              alt={storeName} 
              className="h-14 sm:h-16 max-w-[180px] object-contain mx-auto mb-4"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-md"
              style={{ backgroundColor: primaryColor, boxShadow: `0 8px 12px -3px ${primaryColor}40` }}
            >
              {storeName.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="ui-page-title text-slate-900">Buat Akun Baru</h1>
          <p className="text-slate-500 mt-2 text-sm">Daftar untuk bertransaksi di {storeName}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl mb-6 flex items-start gap-3 text-sm" role="alert">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {notice && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 px-4 py-3 rounded-xl mb-6 flex items-start gap-3 text-sm" role="status" aria-live="polite">
            <Mail className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="font-medium">{notice}</p>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nama Lengkap</label>
            <input 
              type="text" 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": primaryColor } as any}
              placeholder="John Doe"
            />
          </div>

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
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": primaryColor } as any}
              placeholder="Minimal 8 karakter dan 1 angka"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full min-h-[44px] text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 mt-2 shadow-lg active:scale-[0.98]"
            style={{ backgroundColor: primaryColor, boxShadow: `0 10px 15px -3px ${primaryColor}40` }}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                Daftar Akun
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-slate-600 mt-8">
          Sudah punya akun? <Link to="/login" className="font-semibold hover:opacity-80 transition-colors" style={{ color: primaryColor }}>Masuk di sini</Link>
        </p>
      </div>
    </div>
  );
}
