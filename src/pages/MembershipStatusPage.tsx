import React, { useState, useEffect } from "react";
import { 
  Crown, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Zap, 
  Tag, 
  ShieldCheck,
  Package
} from "lucide-react";
import { motion } from "motion/react";
import { useAuthStore } from "../store/auth-store";
import { MembershipPlan, CustomerMembership } from "../types/membership";
import { Link } from "react-router-dom";

export default function MembershipStatusPage() {
  const { user, loading: authLoading } = useAuthStore();
  const [membership, setMembership] = useState<CustomerMembership | null>(null);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [user, authLoading]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Plans are public and should remain visible before login.
      const plansRes = await fetch('/api/membership/plans', { cache: 'no-store' });
      if (!plansRes.ok) throw new Error('Gagal memuat paket membership.');
      const plansData = await plansRes.json();
      setPlans(Array.isArray(plansData) ? plansData : []);

      if (user) {
        const token = await user.getIdToken();
        const statusRes = await fetch('/api/membership/status', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        if (!statusRes.ok) throw new Error('Gagal memuat status membership.');
        const statusData = await statusRes.json();
        setMembership(statusData?.status && statusData.status !== 'NONE' ? statusData : null);
      } else {
        setMembership(null);
      }
    } catch (error) {
      console.error("Failed to fetch membership info", error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || (loading && user)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-10">
        <div className="text-center space-y-4">
          <Crown className="w-14 h-14 text-primary mx-auto" />
          <h1 className="ui-page-title text-gray-900 mb-2">VIP Membership</h1>
          <p className="text-gray-500 max-w-2xl mx-auto">Lihat paket, diskon member, dan pengali poin sebelum masuk ke akun Anda.</p>
          <Link to="/login?redirect=/membership" className="inline-flex bg-primary text-white px-8 py-3 rounded-full font-bold hover:bg-brand-700 transition-all">
            Login Sekarang
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map(plan => (
            <div key={plan.id} className="bg-white border border-gray-100 rounded-3xl p-7 flex flex-col shadow-sm">
              <p className="text-primary font-bold text-sm uppercase tracking-widest">LEVEL {plan.tierLevel}</p>
              <h2 className="text-2xl font-bold text-gray-900 mt-2">{plan.name}</h2>
              {plan.description && <p className="text-sm text-gray-500 mt-2">{plan.description}</p>}
              <p className="text-3xl font-black text-gray-900 mt-6">Rp {Number(plan.price).toLocaleString('id-ID')}</p>
              <p className="text-sm text-gray-400 mb-6">{plan.durationDays > 0 ? `/ ${plan.durationDays} hari` : 'Tanpa batas waktu'}</p>
              <ul className="space-y-3 mb-6">
                <BenefitItem icon={Zap} text={`${plan.pointMultiplier}x poin setiap transaksi`} />
                <BenefitItem icon={Tag} text={`Diskon member ${plan.discountRate}%`} />
                {plan.accessTags.map(tag => <BenefitItem key={tag} icon={Package} text={`Benefit: ${tag}`} />)}
              </ul>
              <Link to="/login?redirect=/membership" className="mt-auto w-full py-3 rounded-xl font-bold text-center bg-primary text-white hover:bg-brand-700">
                Login untuk melanjutkan
              </Link>
            </div>
          ))}
          {plans.length === 0 && <p className="md:col-span-3 text-center text-gray-500 py-10">Belum ada paket VIP aktif. Silakan periksa kembali nanti.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-12">
      {/* Header & Hero */}
      <div className="text-center space-y-4">
        <h1 className="ui-page-title text-gray-900">VIP Membership</h1>
        <p className="text-gray-500 max-w-2xl mx-auto">Nikmati harga khusus member, multiplier poin lebih tinggi, dan akses eksklusif ke berbagai produk digital.</p>
      </div>

      {/* Current Status Card */}
      {membership && membership.status === 'ACTIVE' ? (
        <motion.div 
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gradient-to-br from-primary to-brand-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden"
        >
          {/* Decorative Background */}
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-brand-400/20 rounded-full blur-3xl"></div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full w-fit backdrop-blur-sm">
                <ShieldCheck className="w-4 h-4 text-brand-200" />
                <span className="text-xs font-bold uppercase tracking-widest text-brand-100">Member Aktif</span>
              </div>
              <h2 className="text-4xl font-black">{membership.metadata?.planName}</h2>
              <div className="flex flex-wrap gap-6 text-sm text-brand-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Berlaku hingga: <b>{membership.expiryDate ? new Date(membership.expiryDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Selamanya'}</b></span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10">
                <p className="text-[10px] uppercase font-bold text-brand-200 mb-1">Point Multiplier</p>
                <p className="text-2xl font-black">{membership.metadata?.pointMultiplier}x</p>
              </div>
              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10">
                <p className="text-[10px] uppercase font-bold text-brand-200 mb-1">Special Discount</p>
                <p className="text-2xl font-black">{membership.metadata?.discountRate}%</p>
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center space-y-6">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-gray-300" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-gray-900">Anda belum memiliki Membership aktif</h3>
            <p className="text-gray-500 max-w-sm mx-auto text-sm">Pilih plan di bawah ini untuk mengaktifkan berbagai benefit eksklusif dari Toko.</p>
          </div>
        </div>
      )}

      {/* Available Plans */}
      <div className="space-y-8">
        <h3 className="text-2xl font-bold text-gray-900 text-center">Pilih Paket Keanggotaan</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, idx) => (
            <motion.div 
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`bg-white border rounded-3xl p-8 flex flex-col h-full shadow-sm hover:shadow-xl transition-all group ${
                membership?.planId === plan.id ? 'border-primary ring-1 ring-primary' : 'border-gray-100'
              }`}
            >
              <div className="space-y-1 mb-6">
                <div className="text-primary font-bold text-sm uppercase tracking-widest">LEVEL {plan.tierLevel}</div>
                <h4 className="text-2xl font-bold text-gray-900">{plan.name}</h4>
              </div>

              <div className="mb-8">
                <span className="text-3xl font-black text-gray-900">Rp {plan.price.toLocaleString()}</span>
                <span className="text-gray-400 text-sm"> / {plan.durationDays} Hari</span>
              </div>

              <ul className="space-y-4 mb-8 flex-grow">
                <BenefitItem icon={Zap} text={`${plan.pointMultiplier}x Poin setiap transaksi`} />
                <BenefitItem icon={Tag} text={`Diskon Member ${plan.discountRate}%`} />
                <BenefitItem icon={CheckCircle2} text={`Akses ke produk bertanda khusus`} />
                {plan.accessTags.map(tag => (
                  <BenefitItem key={tag} icon={Package} text={`Benefit: ${tag}`} />
                ))}
              </ul>

              <button
                type="button"
                disabled
                title="Checkout membership belum tersedia karena gateway pembayaran aktif belum terkonfigurasi."
                className={`w-full py-4 rounded-2xl font-bold text-center flex items-center justify-center gap-2 ${
                  membership?.planId === plan.id ? 'bg-gray-100 text-gray-500' : 'bg-gray-100 text-gray-500 cursor-not-allowed'
                }`}
              >
                {membership?.planId === plan.id ? 'Plan Aktif' : 'Pembelian belum tersedia'}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

const BenefitItem: React.FC<{ icon: any, text: string }> = ({ icon: Icon, text }) => {
  return (
    <li className="flex items-start gap-3">
      <div className="p-1 bg-brand-50 rounded-lg shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <span className="text-sm text-gray-600">{text}</span>
    </li>
  );
}
