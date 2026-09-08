import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "../lib/firebase";
import { useAuthStore } from "../store/auth-store";
import { UserPlus, AlertCircle } from "lucide-react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuthStore();
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      setError("Semua field wajib diisi.");
      return;
    }

    if (password.length < 6) {
      setError("Password minimal harus 6 karakter.");
      return;
    }

    if (!isFirebaseConfigured || !auth) {
      setError("Konfigurasi Firebase belum lengkap.");
      return;
    }

    setError("");
    setLoading(true);

    // 1. Validasi Password Policy ke Backend (Strict Fail-Closed)
    let validationPassed = false;
    try {
      const valRes = await fetch("/api/auth/validate-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });

      let valData: any = null;
      try {
        valData = await valRes.json();
      } catch {
        // CONDITION 3: Malformed or non-JSON response -> fail-closed
        setError("Validasi keamanan tidak dapat dilakukan. Silakan coba lagi.");
        setLoading(false);
        return;
      }

      // Check structure: must be an object with boolean 'valid'
      if (!valData || typeof valData !== "object" || typeof valData.valid !== "boolean") {
        // CONDITION 3: Unexpected response structure -> fail-closed
        setError("Validasi keamanan tidak dapat dilakukan. Silakan coba lagi.");
        setLoading(false);
        return;
      }

      if (!valRes.ok) {
        if (valRes.status >= 400 && valRes.status < 500 && valData.valid === false) {
          // CONDITION 2 — POLICY REJECTED (HTTP 4xx)
          const errorMsg = Array.isArray(valData.errors) && valData.errors.length > 0
            ? valData.errors.join(". ")
            : (valData.message || "Password tidak memenuhi kebijakan keamanan platform.");
          setError(errorMsg);
        } else {
          // CONDITION 3 — VALIDATION SERVICE ERROR (HTTP 500, gateway error, etc.)
          setError("Validasi keamanan tidak dapat dilakukan. Silakan coba lagi.");
        }
        setLoading(false);
        return;
      }

      if (valData.valid === true) {
        // CONDITION 1 — VALID
        validationPassed = true;
      } else {
        // CONDITION 2 — POLICY REJECTED (HTTP 200 with valid: false)
        const errorMsg = Array.isArray(valData.errors) && valData.errors.length > 0
          ? valData.errors.join(". ")
          : (valData.message || "Password tidak memenuhi kebijakan keamanan platform.");
        setError(errorMsg);
        setLoading(false);
        return;
      }
    } catch {
      // CONDITION 3 — NETWORK FAILURE / TIMEOUT / SERVER UNREACHABLE
      setError("Validasi keamanan tidak dapat dilakukan. Silakan coba lagi.");
      setLoading(false);
      return;
    }

    if (!validationPassed) {
      setError("Validasi keamanan tidak dapat dilakukan. Silakan coba lagi.");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const firebaseUser = userCredential.user;

      // Update Firebase Auth profile displayName
      try {
        await updateProfile(firebaseUser, { displayName: name.trim() });
      } catch (profileErr) {
        console.warn("Could not set displayName:", profileErr);
      }

      // Check if owner email
      const isOwner = email.trim().toLowerCase() === "chokerbayu@gmail.com";
      const role = isOwner ? "pemilik" : "customer";

      // Save user to Firestore
      if (db) {
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          await setDoc(userDocRef, {
            uid: firebaseUser.uid,
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            role,
            createdAt: new Date().toISOString()
          }, { merge: true });
        } catch (dbErr) {
          console.warn("Firestore user creation notice:", dbErr);
        }
      }

      // Also notify backend sync API
      try {
        const idToken = await firebaseUser.getIdToken();
        await fetch("/api/auth/sync-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`
          },
          body: JSON.stringify({ name: name.trim() })
        });
      } catch (apiErr) {
        console.warn("Backend sync notice error:", apiErr);
      }

      const userData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || email.trim(),
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
      let errorMsg = "Gagal mendaftarkan akun. Silakan coba lagi.";
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = "Email ini sudah terdaftar. Silakan gunakan menu Login.";
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = "Format email tidak valid.";
      } else if (err.code === 'auth/weak-password') {
        errorMsg = "Password terlalu lemah. Gunakan minimal 6 karakter.";
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-md shadow-blue-600/20">
            i
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Buat Akun</h1>
          <p className="text-slate-500 mt-2 text-sm">Daftar untuk mulai bertransaksi di iStore.id</p>
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
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">No WhatsApp</label>
            <input 
              type="tel" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Minimal 6 karakter"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 mt-2"
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
          Sudah punya akun? <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700">Masuk di sini</Link>
        </p>
      </div>
    </div>
  );
}
