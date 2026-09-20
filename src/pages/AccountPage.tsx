import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/auth-store";
import { User, Mail, Phone, ShieldCheck, KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff, RefreshCw, Check, LogOut } from "lucide-react";

export default function AccountPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const policy = { minPasswordLength: 8 };
  const policyStatus = {
    hasMinLength: newPassword.length >= 8,
    hasNumber: /\d/.test(newPassword),
    isMatching: newPassword === confirmPassword && confirmPassword.length > 0,
    allPassed: false
  };
  policyStatus.allPassed = policyStatus.hasMinLength && policyStatus.hasNumber;

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await fetch(`/api/customer/profile/${user.uid}`, {
           headers: { 'Authorization': `Bearer ${user.uid}` }
        });
        const data = await response.json();
        if (data.success) {
          setProfile(data.data);
          setName(data.data.name || "");
          setPhone(data.data.phone || "");
        }
      } catch (err) {
        console.warn("Failed to fetch profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, navigate]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      // Update Supabase metadata
      const { error: sbError } = await supabase.auth.updateUser({
        data: { full_name: name }
      });
      if (sbError) throw sbError;

      // Update backend
      const response = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user?.uid}`
        },
        body: JSON.stringify({ name, phone })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      setSuccessMessage("Profil berhasil diperbarui.");
      if (user) {
        setUser({ ...user, displayName: name }, data.data?.role);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal memperbarui profil.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyStatus.allPassed || !policyStatus.isMatching) return;

    setSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setSuccessMessage("Password berhasil diperbarui.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal memperbarui password.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null, null);
    navigate("/");
  };

  if (loading) return <div className="p-12 text-center">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="md:w-1/3">
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center">
            <div className="w-24 h-24 bg-brand-600 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
              {name.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-xl font-bold text-slate-900">{name}</h2>
            <p className="text-slate-500 text-sm mb-6">{user?.email}</p>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-3 border border-red-100 text-red-600 rounded-xl hover:bg-red-50 transition-colors font-semibold"
            >
              <LogOut className="w-4 h-4" />
              Keluar Sesi
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="md:w-2/3 space-y-8">
          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 p-4 rounded-2xl flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">{successMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Profile Form */}
          <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-3">
              <User className="w-5 h-5 text-brand-600" />
              Informasi Profil
            </h3>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nama Lengkap</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">WhatsApp</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="bg-brand-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 transition-all shadow-lg shadow-brand-600/20"
              >
                Simpan Perubahan
              </button>
            </form>
          </section>

          {/* Password Form */}
          <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-3">
              <KeyRound className="w-5 h-5 text-brand-600" />
              Keamanan Akun
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="relative">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Password Baru</label>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-10 text-slate-400">
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Konfirmasi</label>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-10 text-slate-400">
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
               </div>
               
               <div className="bg-slate-50 p-4 rounded-2xl space-y-2">
                 <div className="flex items-center gap-2 text-xs">
                    {policyStatus.hasMinLength ? <Check className="w-3 h-3 text-green-600" /> : <RefreshCw className="w-3 h-3" />}
                    <span>Minimal 8 karakter</span>
                 </div>
                 <div className="flex items-center gap-2 text-xs">
                    {policyStatus.hasNumber ? <Check className="w-3 h-3 text-green-600" /> : <RefreshCw className="w-3 h-3" />}
                    <span>Mengandung angka</span>
                 </div>
               </div>

               <button
                type="submit"
                disabled={submitting || !policyStatus.allPassed || !policyStatus.isMatching}
                className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
              >
                Ganti Password
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
