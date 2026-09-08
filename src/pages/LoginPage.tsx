import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  sendPasswordResetEmail 
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "../lib/firebase";
import { useAuthStore } from "../store/auth-store";
import { LogIn, AlertCircle, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  const { setUser } = useAuthStore();
  const navigate = useNavigate();

  // Helper to sync user to Firestore and state store
  const syncUserSession = async (firebaseUser: any, fallbackEmail: string) => {
    const userEmail = (firebaseUser.email || fallbackEmail || "").toLowerCase().trim();
    const isOwner = userEmail === "chokerbayu@gmail.com";
    let role: 'customer' | 'admin' | 'pemilik' = isOwner ? "pemilik" : "customer";

    // Synchronize to Firestore
    if (db) {
      try {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const existingRole = userDoc.data().role;
          if (isOwner) {
            role = "pemilik";
            if (existingRole !== "pemilik") {
              await setDoc(userDocRef, { role: "pemilik" }, { merge: true });
            }
          } else if (existingRole) {
            role = existingRole;
          }
        } else {
          await setDoc(userDocRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email || userEmail,
            name: firebaseUser.displayName || userEmail.split("@")[0],
            role: role,
            createdAt: new Date().toISOString()
          }, { merge: true });
        }
      } catch (dbErr) {
        console.warn("Firestore sync notice:", dbErr);
      }
    }

    // Also notify backend sync API with ID Token
    try {
      const idToken = await firebaseUser.getIdToken();
      await fetch("/api/auth/sync-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          name: firebaseUser.displayName || userEmail.split("@")[0]
        })
      });
    } catch (apiErr) {
      console.warn("Backend sync notification non-critical error:", apiErr);
    }

    const userData = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || userEmail,
      displayName: firebaseUser.displayName || userEmail.split("@")[0]
    };

    // Store in auth store
    setUser(userData, role);

    if (role === 'pemilik' || role === 'admin') {
      navigate("/admin");
    } else {
      navigate("/");
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFirebaseConfigured || !auth) {
      setError("Konfigurasi Firebase belum lengkap.");
      return;
    }

    setError("");
    setResetSent(false);
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      await syncUserSession(userCredential.user, email);
    } catch (err: any) {
      console.error("Firebase email login error:", err);
      let errorMsg = "Gagal masuk. Periksa kembali email dan password Anda.";
      if (
        err.code === 'auth/user-not-found' || 
        err.code === 'auth/wrong-password' || 
        err.code === 'auth/invalid-credential'
      ) {
        errorMsg = "Email atau password salah.";
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = "Format email tidak valid.";
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMsg = "Login dengan Email/Password belum diaktifkan di Firebase Console.";
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!isFirebaseConfigured || !auth) {
      setError("Konfigurasi Firebase belum lengkap.");
      return;
    }

    setError("");
    setResetSent(false);
    setGoogleLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      // Enforce Google account chooser prompt
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      const result = await signInWithPopup(auth, provider);
      await syncUserSession(result.user, result.user.email || "");
    } catch (err: any) {
      console.error("Firebase Google Sign-In error:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Login Google dibatalkan karena jendela popup ditutup.");
      } else if (err.code === 'auth/cancelled-popup-request') {
        // Ignored, duplicate popup attempt
      } else if (err.code === 'auth/operation-not-allowed') {
        setError("Provider Google Sign-In belum diaktifkan di Firebase Console. Harap aktifkan Google provider di Firebase Authentication.");
      } else if (err.code === 'auth/unauthorized-domain') {
        setError("Domain aplikasi ini belum terdaftar di Authorized Domains Firebase Authentication Console.");
      } else if (err.message) {
        setError(err.message);
      } else {
        setError("Gagal melakukan autentikasi Google melalui Firebase.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError("Masukkan email Anda terlebih dahulu di kolom Email untuk mengatur ulang password.");
      return;
    }
    if (!auth) return;

    setError("");
    try {
      // Direct reset link to the custom /reset-password page using runtime application origin
      const actionCodeSettings = {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true,
      };
      await sendPasswordResetEmail(auth, email.trim(), actionCodeSettings);
      setResetSent(true);
    } catch (err: any) {
      console.error("Password reset error:", err);
      if (err.code === 'auth/user-not-found') {
        setError("Akun dengan email tersebut tidak ditemukan.");
      } else {
        setError(err.message || "Gagal mengirim email reset password.");
      }
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg shadow-blue-600/20">
            i
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Masuk ke iStore.id</h1>
          <p className="text-slate-500 mt-2 text-sm">Masuk dengan Email & Password atau Akun Google</p>
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
              Tautan reset password telah dikirim ke <strong>{email}</strong>. Silakan periksa kotak masuk atau spam email Anda.
            </p>
          </div>
        )}

        {/* Email + Password Form using Firebase Authentication */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              placeholder="nama@email.com"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Lupa Password?
              </button>
            </div>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || googleLoading}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Login
              </>
            )}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-slate-400 font-medium">Atau lanjutkan dengan</span>
          </div>
        </div>

        {/* Official Firebase Google Sign-In Option */}
        <div className="space-y-4">
          <button 
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || googleLoading}
            className="w-full bg-white border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-3 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed group"
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
                <span className="group-hover:text-slate-900 transition-colors">Login dengan Google</span>
              </>
            )}
          </button>
        </div>

        <p className="text-center text-sm text-slate-600 mt-8">
          Belum punya akun? <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700">Daftar sekarang</Link>
        </p>
      </div>
    </div>
  );
}
