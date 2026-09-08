import React, { useState, useEffect } from "react";
import { 
  Copy, 
  Check, 
  Share2, 
  Users, 
  Gift, 
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ReferralStats {
  totalReferrals: number;
  convertedReferrals: number;
}

interface ReferralMeData {
  referralCode: string | null;
  referredBy: string | null;
  stats: ReferralStats;
}

export default function ReferralDashboard() {
  const [data, setData] = useState<ReferralMeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetchMe();
  }, []);

  const fetchMe = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/referral/me");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (error) {
      console.error("Failed to fetch referral me", error);
    } finally {
      setLoading(false);
    }
  };

  const joinProgram = async () => {
    setJoining(true);
    try {
      const res = await fetch("/api/referral/join", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        await fetchMe();
      }
    } catch (error) {
      console.error("Failed to join referral program", error);
    } finally {
      setJoining(false);
    }
  };

  const copyToClipboard = () => {
    if (!data?.referralCode) return;
    const url = `${window.location.origin}?ref=${data.referralCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!data?.referralCode) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-gray-100 p-8 text-center space-y-6 shadow-sm"
      >
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
          <Gift className="w-8 h-8 text-blue-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-gray-900">Dapatkan Poin Gratis!</h2>
          <p className="text-gray-500 max-w-sm mx-auto">
            Ajak temanmu bergabung di iStore dan dapatkan hadiah poin loyalitas setiap kali mereka bertransaksi.
          </p>
        </div>
        <button
          onClick={joinProgram}
          disabled={joining}
          className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
        >
          {joining ? <RefreshCw className="w-5 h-5 animate-spin" /> : "Mulai Ajak Teman"}
          {!joining && <ArrowRight className="w-5 h-5" />}
        </button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Referral Card */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-blue-600" />
              Bagikan Kode Referral
            </h3>
            <span className="px-3 py-1 bg-green-50 text-green-600 text-[10px] font-bold uppercase rounded-full">
              Aktif
            </span>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between group">
            <div className="space-y-1">
              <p className="text-xs text-gray-500 font-medium uppercase">Link Referral Anda</p>
              <p className="text-sm font-semibold text-gray-900 truncate max-w-[200px] sm:max-w-md">
                {window.location.origin}/?ref={data.referralCode}
              </p>
            </div>
            <button 
              onClick={copyToClipboard}
              className={`p-3 rounded-lg transition-all ${copied ? 'bg-green-100 text-green-600' : 'bg-white text-gray-400 hover:text-blue-600 shadow-sm border border-gray-200'}`}
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
             <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-blue-600 shadow-sm">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-medium uppercase">Total Teman</p>
                  <p className="text-xl font-bold text-gray-900">{data.stats.totalReferrals}</p>
                </div>
             </div>
             <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-purple-600 shadow-sm">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-purple-600 font-medium uppercase">Berhasil Konversi</p>
                  <p className="text-xl font-bold text-gray-900">{data.stats.convertedReferrals}</p>
                </div>
             </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-gray-900 rounded-2xl p-6 text-white space-y-6 relative overflow-hidden">
          <div className="relative z-10 space-y-4">
            <h4 className="font-bold text-lg">Cara Kerja</h4>
            <div className="space-y-4 text-sm text-gray-300">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 font-bold text-xs">1</div>
                <p>Bagikan link atau kode referral unikmu ke teman-teman.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 font-bold text-xs">2</div>
                <p>Pastikan mereka mendaftar dan melakukan transaksi pertama.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 font-bold text-xs">3</div>
                <p>Dapatkan reward poin otomatis setelah pesanan mereka selesai!</p>
              </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Info className="w-32 h-32" />
          </div>
        </div>
      </div>
    </div>
  );
}
