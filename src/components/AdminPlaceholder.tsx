import { ModuleStatus } from "../types/admin-nav";
import { AlertCircle, Construction, Wrench, Ban, Layers, Link as LinkIcon } from "lucide-react";

interface AdminPlaceholderProps {
  title: string;
  status: ModuleStatus;
  description?: string;
  dependencies?: string[];
  group?: string;
}

export default function AdminPlaceholder({ 
  title, 
  status = "IN_DEVELOPMENT", 
  description, 
  dependencies = [],
  group
}: AdminPlaceholderProps) {
  
  const statusConfig = {
    ACTIVE: {
      label: "Aktif",
      color: "bg-emerald-500",
      textColor: "text-emerald-700",
      bgColor: "bg-emerald-50",
      icon: AlertCircle,
    },
    IN_DEVELOPMENT: {
      label: "Dalam Pengembangan",
      color: "bg-blue-500",
      textColor: "text-blue-700",
      bgColor: "bg-blue-50",
      icon: Construction,
    },
    MAINTENANCE: {
      label: "Maintenance",
      color: "bg-amber-500",
      textColor: "text-amber-700",
      bgColor: "bg-amber-50",
      icon: Wrench,
    },
    DISABLED: {
      label: "Nonaktif",
      color: "bg-slate-500",
      textColor: "text-slate-700",
      bgColor: "bg-slate-50",
      icon: Ban,
    }
  };

  const config = statusConfig[status];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Card */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative">
        <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-2xl font-bold text-xs uppercase tracking-widest ${config.color} text-white`}>
          {config.label}
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className={`w-16 h-16 rounded-2xl ${config.bgColor} flex items-center justify-center shrink-0`}>
            <config.icon className={`w-8 h-8 ${config.textColor}`} />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
              {group && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 uppercase tracking-tighter">
                  {group}
                </span>
              )}
            </div>
            <p className="text-slate-500 max-w-2xl leading-relaxed">
              {description || `Modul ${title} sedang dalam tahap perancangan dan pengembangan arsitektur bisnis.`}
            </p>
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Architecture Box */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Layers className="w-5 h-5 text-slate-600" />
            </div>
            <h3 className="font-bold text-slate-800">Arsitektur Sistem</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Position</p>
                <p className="text-sm font-medium text-slate-700">{group || "General"} Module</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Router</p>
                <p className="text-sm font-medium text-slate-700">src/App.tsx</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dependencies Box */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <LinkIcon className="w-5 h-5 text-slate-600" />
            </div>
            <h3 className="font-bold text-slate-800">Dependensi Terkait</h3>
          </div>

          <div className="flex flex-wrap gap-2">
            {dependencies.length > 0 ? (
              dependencies.map((dep) => (
                <span key={dep} className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium text-slate-600 flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-slate-400"></div>
                  {dep}
                </span>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic">Tidak ada dependensi eksternal yang terdaftar.</p>
            )}
          </div>
        </div>
      </div>

      {/* Roadmap Warning */}
      <div className="p-6 rounded-3xl bg-blue-50/50 border border-blue-100 border-dashed flex items-start gap-4">
        <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 leading-relaxed">
          <p className="font-bold mb-1">Catatan Roadmap</p>
          Halaman ini merupakan representasi transparan dari peta jalan pengembangan iStore. Belum ada data produksi yang diproses dalam modul ini sampai status berubah menjadi <span className="font-bold">Aktif</span>.
        </div>
      </div>
    </div>
  );
}
