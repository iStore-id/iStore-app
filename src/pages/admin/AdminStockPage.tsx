import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/auth-store';
import { Database, Package, ShieldAlert } from 'lucide-react';
import StockTab from '../../components/admin/stock/StockTab';
import QuotaTab from '../../components/admin/stock/QuotaTab';

export default function AdminStockPage() {
  const [activeTab, setActiveTab] = useState<'stock' | 'quota'>('stock');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="ui-page-title text-slate-900">Stock & Quota</h1>
          <p className="text-slate-500">Pusat pengelolaan operasional inventory (Stock) dan limits (Quota) iStore.</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-amber-800">
        <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold mb-1">Perbedaan Stock dan Quota:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Stock:</strong> Digunakan untuk inventory nyata (voucher fisik/digital preloaded) yang dikelola oleh iStore. Validasi saat checkout akan memotong stock secara nyata.</li>
            <li><strong>Quota:</strong> Digunakan untuk limitasi operasional provider pihak ketiga (e.g., limit transaksi harian API Games).</li>
          </ul>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('stock')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === 'stock' 
                ? 'border-b-2 border-primary text-primary bg-primary/5' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Package className="w-4 h-4" />
            Inventory Stock
          </button>
          <button
            onClick={() => setActiveTab('quota')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === 'quota' 
                ? 'border-b-2 border-primary text-primary bg-primary/5' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Database className="w-4 h-4" />
            Provider Quota
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'stock' ? <StockTab /> : <QuotaTab />}
        </div>
      </div>
    </div>
  );
}
