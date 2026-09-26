import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

export default function TransactionCheckPage() {
  const [invoice, setInvoice] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice.trim()) return;
    setLoading(true);
    // In a real app with strict rules, we'd have a Cloud Function to check limited info
    // For now, redirect to detail page and let the rules handle access (if public or guest mode)
    navigate(`/transactions/${invoice.trim()}`);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-16 md:py-24">
      <div className="text-center mb-10">
        <h1 className="ui-page-title text-slate-900 mb-2">Cek Status Transaksi</h1>
        <p className="text-slate-600">Masukkan nomor invoice Anda untuk melacak status pesanan secara real-time.</p>
      </div>

      <div 
        className="rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/80"
        style={{ backgroundColor: 'var(--surface-color)' }}
      >
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              required
              value={invoice}
              onChange={(e) => setInvoice(e.target.value)}
              placeholder="Contoh: INV-123456789"
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-slate-700"
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="bg-brand-600 text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-70 whitespace-nowrap"
          >
            {loading ? "Mencari..." : "Lacak Pesanan"}
          </button>
        </form>
      </div>
    </div>
  );
}
