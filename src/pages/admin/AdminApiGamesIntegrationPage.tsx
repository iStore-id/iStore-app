import React from "react";
import { ApiGamesConfig } from "../../components/ApiGamesConfig";
import { Gamepad2, ShieldCheck, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../store/auth-store";

export default function AdminApiGamesIntegrationPage() {
  const { role } = useAuthStore();

  if (role !== "pemilik" && role !== "admin") {
    return (
      <div className="bg-white p-8 rounded-2xl border border-red-200 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Akses Ditolak</h2>
        <p className="text-slate-500">Anda tidak memiliki izin untuk mengelola integrasi API Games.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/integrations"
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            title="Kembali ke Integrations"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Gamepad2 className="w-5 h-5" />
              </span>
              <h1 className="ui-page-title text-slate-900">API Games Integration</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">Kelola kredensial merchant dan secret key untuk supplier top-up game API Games.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Secret Manager Secure
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <ApiGamesConfig />
      </div>

      <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-6 space-y-3">
        <h4 className="font-semibold text-indigo-900 text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          Arsitektur Kredensial Terenkripsi API Games
        </h4>
        <ul className="text-xs text-indigo-800 space-y-1.5 list-disc list-inside">
          <li>Kredensial disimpan langsung ke backend Secret Manager dengan enkripsi penuh.</li>
          <li>Digunakan oleh Provider Engine & Fulfillment Dispatcher secara otomatis saat pesanan game diproses.</li>
          <li>Gunakan tombol Test Connection untuk memverifikasi validitas signature dan koneksi ke v1.apigames.id.</li>
        </ul>
      </div>
    </div>
  );
}
