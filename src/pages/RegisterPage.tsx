import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { useAuthStore } from "../store/auth-store";
import { AlertCircle, UserPlus, Mail, Smartphone } from "lucide-react";
import { normalizePhone, isValidIndonesianPhone } from "../lib/utils/phone";
import { OtpInput } from "../components/auth/OtpInput";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [regMethod, setRegMethod] = useState<"email" | "phone">("email");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [config, setConfig] = useState<any>(null);
  
  // OTP States
  const [showOtp, setShowOtp] = useState(false);
  const [normalizedPhone, setNormalizedPhone] = useState("");

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

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured || !supabase) {
      setError("Konfigurasi Supabase belum lengkap.");
      return;
    }

    if (!isValidIndonesianPhone(phone)) {
      setError("Nomor telepon tidak valid. Gunakan format Indonesia (contoh: 0812...).");
      return;
    }

    const e164 = normalizePhone(phone);
    setNormalizedPhone(e164);
    setError("");
    setLoading(true);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: e164,
      });

      if (otpError) throw otpError;
      setShowOtp(true);
    } catch (err: any) {
      console.error("OTP send error:", err);
      setError(err.message || "Gagal mengirim kode OTP. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (otp: string) => {
    if (!supabase) return;
    setLoading(true);
    setError("");

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: otp,
        type: "sms",
      });

      if (verifyError) throw verifyError;
      if (!data.user) throw new Error("Gagal verifikasi OTP.");

      const sbUser = data.user;

      // Sync to backend
      await syncUser(sbUser, name.trim(), normalizedPhone);

      navigate("/");
    } catch (err: any) {
      console.error("OTP verification error:", err);
      setError(err.message || "Kode OTP salah atau sudah kedaluwarsa.");
    } finally {
      setLoading(false);
    }
  };

  const syncUser = async (sbUser: any, fullName: string, userPhone?: string) => {
    const userEmail = sbUser.email || "";
    // Owner check (server will also check)
    const role = userEmail.trim().toLowerCase() === "chokerbayu@gmail.com" ? "pemilik" : "customer";
    
    try {
      const response = await fetch("/api/auth/sync-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sbUser.id}`
        },
        body: JSON.stringify({ 
          name: fullName || userEmail.split("@")[0] || "User", 
          email: userEmail, 
          phone: userPhone 
        })
      });
      
      const syncData = await response.json();
      
      const userData = {
        uid: sbUser.id,
        email: userEmail,
        displayName: fullName || userEmail.split("@")[0] || "User"
      };
      setUser(userData, syncData.role || role);
    } catch (apiErr) {
      console.warn("Backend sync notice error:", apiErr);
      // Fallback local set if sync fails but auth succeeded
      setUser({
        uid: sbUser.id,
        email: userEmail,
        displayName: fullName
      }, role);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured || !supabase) {
      setError("Konfigurasi Supabase belum lengkap.");
      return;
    }

    setError("");
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
      const finalPhone = phone.trim() ? normalizePhone(phone.trim()) : undefined;
      // 2. Supabase Sign Up
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
            phone: finalPhone
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error("Gagal mendaftarkan akun.");

      await syncUser(authData.user, name.trim(), finalPhone);

      const role = email.trim().toLowerCase() === "chokerbayu@gmail.com" ? "pemilik" : "customer";
      if (role === "pemilik") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (err: any) {
      console.error("Registration error:", err);
      setError(err.message || "Gagal mendaftarkan akun. Silakan coba lagi.");
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

  if (showOtp) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-slate-50" style={getAuthBackgroundStyle()}>
        <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-slate-100">
          <OtpInput 
            phone={normalizedPhone}
            loading={loading}
            onVerify={handleVerifyOtp}
            onResend={() => supabase!.auth.signInWithOtp({ phone: normalizedPhone }).then(() => {})}
          />
          <button 
            onClick={() => setShowOtp(false)}
            className="w-full mt-6 text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
            style={{ color: primaryColor }}
          >
            Kembali ke Pendaftaran
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-slate-50" style={getAuthBackgroundStyle()}>
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
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-md"
              style={{ backgroundColor: primaryColor, boxShadow: `0 8px 12px -3px ${primaryColor}40` }}
            >
              {storeName.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="ui-page-title text-slate-900">Buat Akun Baru</h1>
          <p className="text-slate-500 mt-2 text-sm">Daftar untuk bertransaksi di {storeName}</p>
        </div>

        {/* Method Toggle */}
        <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
          <button
            onClick={() => { setRegMethod("email"); setError(""); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${regMethod === "email" ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            style={regMethod === "email" ? { color: primaryColor } : {}}
          >
            <Mail className="w-4 h-4" />
            Email
          </button>
          <button
            onClick={() => { setRegMethod("phone"); setError(""); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${regMethod === "phone" ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            style={regMethod === "phone" ? { color: primaryColor } : {}}
          >
            <Smartphone className="w-4 h-4" />
            WhatsApp
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl mb-6 flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={regMethod === "email" ? handleRegister : handleSendOtp} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nama Lengkap</label>
            <input 
              type="text" 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": primaryColor } as any}
              placeholder="John Doe"
            />
          </div>

          {regMethod === "email" ? (
            <>
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
                  placeholder="Minimal 6 karakter"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">No WhatsApp</label>
              <input 
                type="tel" 
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2"
                style={{ "--tw-ring-color": primaryColor } as any}
                placeholder="081234567890"
              />
              <p className="text-[10px] text-slate-400 mt-1 px-1">Kode OTP akan dikirimkan ke nomor ini.</p>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 mt-2 shadow-lg active:scale-[0.98]"
            style={{ backgroundColor: primaryColor, boxShadow: `0 10px 15px -3px ${primaryColor}40` }}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                {regMethod === "email" ? "Daftar Akun" : "Kirim Kode OTP"}
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
