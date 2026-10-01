import React from "react";
import { Link } from "react-router-dom";
import { CreditCard, Gamepad2, Wallet, ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuthStore } from "../../store/auth-store";

export default function AdminIntegrationsHubPage() {
  const { role } = useAuthStore();

  const integrations = [
    {
      id: "midtrans",
      title: "Midtrans Integration",
      description: "Payment gateway utama untuk QRIS, Virtual Account, Credit Card, dan E-Wallet.",
      icon: CreditCard,
      status: "ACTIVE",
      href: "/admin/integrations/midtrans",
      badge: "Configured / Secure"
    },
    {
      id: "ipaymu",
      title: "iPaymu Integration",
      description: "Payment gateway alternatif untuk QRIS dan Virtual Account.",
      icon: Wallet,
      status: "ACTIVE",
      href: "/admin/integrations/ipaymu",
      badge: "Configured / Secure"
    },
    {
      id: "apigames",
      title: "API Games Provider",
      description: "Supplier produk top-up game otomatis dengan signature verification v2 dan Secret Manager.",
      icon: Gamepad2,
      status: "ACTIVE",
      href: "/admin/integrations/apigames",
      badge: "Configured / Secure"
    },
    {
      id: "tokovoucher",
      title: "TokoVoucher Provider",
      description: "Supplier voucher game dan produk digital cadangan.",
      icon: Wallet,
      status: "ACTIVE",
      href: "/admin/integrations/tokovoucher",
      badge: "Active Provider"
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="ui-page-title text-slate-900">Integrations Hub</h1>
        <p className="text-sm text-slate-500 mt-1">Pusat resmi untuk mengelola seluruh koneksi layanan pihak ketiga, payment gateway, dan supplier produk digital.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                  <item.icon className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {item.badge}
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">{item.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">{item.description}</p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Server-side secure</span>
              <Link
                to={item.href}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
              >
                <span>Kelola</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-center gap-4">
        <div className="p-3 bg-blue-100 text-blue-700 rounded-xl shrink-0">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h4 className="font-semibold text-slate-800 text-sm">Keamanan Kredensial Terjamin</h4>
          <p className="text-xs text-slate-500 mt-0.5">Seluruh API secret key dan token dienkripsi menggunakan AES-256 dan hanya dapat diakses oleh role Owner (Pemilik).</p>
        </div>
      </div>
    </div>
  );
}
