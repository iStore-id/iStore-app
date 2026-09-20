import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { useAuthStore } from "../store/auth-store";
import { AlertCircle, UserPlus } from "lucide-react";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      // 2. Supabase Sign Up
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
            phone: phone.trim()
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error("Gagal mendaftarkan akun.");

      const sbUser = authData.user;
      
      // 3. Sync User to Backend (which handles customers table and role assignment)
      const role = email.trim().toLowerCase() === "chokerbayu@gmail.com" ? "pemilik" : "customer";
      
      try {
        await fetch("/api/auth/sync-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${sbUser.id}`
          },
          body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim() })
        });
      } catch (apiErr) {
        console.warn("Backend sync notice error:", apiErr);
      }

      const userData = {
        uid: sbUser.id,
        email: sbUser.email || email.trim(),
        displayName: name.trim()
      };
      setUser(userData, role);

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

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-md shadow-brand-600/20">
            i
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Buat Akun</h1>
          <p className="text-slate-500 mt-2 text-sm">Daftar untuk mulai bertransaksi di Toko Kami</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl mb-6 flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="font-medium">{error}</p>
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
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">No WhatsApp</label>
            <input 
              type="tel" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="081234567890"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Minimal 6 karakter"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-brand-600 text-white font-semibold py-3 rounded-xl hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 mt-2 shadow-lg shadow-brand-600/20"
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
          Sudah punya akun? <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">Masuk di sini</Link>
        </p>
      </div>
    </div>
  );
}
