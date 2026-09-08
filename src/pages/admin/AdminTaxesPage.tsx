import React, { useState, useEffect } from 'react';
import { 
  Receipt, Percent, ShieldCheck, AlertTriangle, Save, RefreshCw, 
  HelpCircle, Layers, CreditCard, CheckCircle2, Info, Building2
} from 'lucide-react';
import { useAuthStore } from '../../store/auth-store';

interface PaymentFeeItem {
  name: string;
  percentage: number;
  flat: number;
  enabled: boolean;
}

interface TaxConfig {
  enabled: boolean;
  taxName: string;
  percentage: number;
  mode: 'inclusive' | 'exclusive';
  effectiveDate: string;
  description: string;
}

export function AdminTaxesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [taxConfig, setTaxConfig] = useState<TaxConfig>({
    enabled: false,
    taxName: 'PPN',
    percentage: 11,
    mode: 'inclusive',
    effectiveDate: new Date().toISOString().split('T')[0],
    description: ''
  });

  const [paymentFees, setPaymentFees] = useState<Record<string, PaymentFeeItem>>({});

  const { user } = useAuthStore();

  const fetchConfig = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch('/api/admin/taxes/config', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTaxConfig(data.data.taxConfig);
        setPaymentFees(data.data.paymentFees);
      } else {
        throw new Error(data.message || 'Failed to fetch tax and fee configurations');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch('/api/admin/taxes/config', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taxConfig,
          paymentFees
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save configuration');
      setSuccessMsg('Konfigurasi Fee & Pajak berhasil disimpan dan diterapkan ke sistem.');
      fetchConfig();
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handlePaymentFeeChange = (key: string, field: keyof PaymentFeeItem, value: any) => {
    setPaymentFees(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-7 h-7 text-indigo-600" />
            Fee & Pajak Control Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola konfigurasi PPN (Pajak Pertambahan Nilai) dan biaya pemrosesan pembayaran (MDR / Gateway Fee Fallback).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchConfig}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
            Muat Ulang
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Architectural Separation Info Banner */}
      <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-6 space-y-3">
        <h3 className="font-semibold text-indigo-900 text-base flex items-center gap-2">
          <Info className="w-5 h-5 text-indigo-600" />
          Arsitektur Pemisahan Biaya & Pajak
        </h3>
        <p className="text-sm text-indigo-800 leading-relaxed">
          Sistem ini secara ketat memisahkan <strong className="font-semibold">Customer-Facing Pricing</strong>, <strong className="font-semibold">Gateway/MDR Internal Cost</strong>, dan <strong className="font-semibold">Pajak (PPN)</strong>. Konfigurasi MDR di bawah bertindak sebagai *fallback* otomatis saat laporan settlement CSV dari Midtrans tidak menyertakan rincian fee, serta dicatat secara terpisah pada akun ledger <code className="bg-indigo-100 px-1.5 py-0.5 rounded font-mono text-xs">5000_GATEWAY_MDR_FEE</code> tanpa double-charging ke customer.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Tax Configuration Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Percent className="w-5 h-5 text-indigo-600" />
              Konfigurasi Pajak (PPN)
            </h2>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={taxConfig.enabled}
                onChange={e => setTaxConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              <span className="ml-3 text-sm font-semibold text-slate-700">
                {taxConfig.enabled ? 'Aktif' : 'Nonaktif'}
              </span>
            </label>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">Nama Pajak</label>
              <input
                type="text"
                value={taxConfig.taxName}
                onChange={e => setTaxConfig(prev => ({ ...prev, taxName: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="cth. PPN"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">Persentase Pajak (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={taxConfig.percentage}
                onChange={e => setTaxConfig(prev => ({ ...prev, percentage: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">Mode Pajak</label>
              <select
                value={taxConfig.mode}
                onChange={e => setTaxConfig(prev => ({ ...prev, mode: e.target.value as any }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="inclusive">Inclusive (Sudah termasuk dalam harga jual)</option>
                <option value="exclusive">Exclusive (Ditambahkan di luar harga jual saat checkout)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">Tanggal Efektif</label>
              <input
                type="date"
                value={taxConfig.effectiveDate}
                onChange={e => setTaxConfig(prev => ({ ...prev, effectiveDate: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">Deskripsi / Catatan Peraturan</label>
              <textarea
                rows={2}
                value={taxConfig.description}
                onChange={e => setTaxConfig(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="cth. Berdasarkan undang-undang perpajakan yang berlaku..."
              />
            </div>
          </div>
        </div>

        {/* Payment Method Fees (MDR Fallback) Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              Biaya Metode Pembayaran (MDR / Gateway Fee Fallback)
            </h2>
            <span className="text-xs text-slate-500 font-medium">Digunakan untuk rekonsiliasi & kalkulasi settlement otomatis</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Metode Pembayaran</th>
                  <th className="px-6 py-3">Persentase (%)</th>
                  <th className="px-6 py-3">Flat Fee (Rp)</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {Object.entries(paymentFees).map(([key, val]) => {
                  const item = val as PaymentFeeItem;
                  return (
                  <tr key={key} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-semibold text-slate-800">
                      {item.name || key}
                      <span className="block font-mono text-xs text-slate-400 font-normal">{key}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 max-w-[140px]">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={item.percentage}
                          onChange={e => handlePaymentFeeChange(key, 'percentage', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <span className="text-slate-400 text-xs">%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 max-w-[160px]">
                        <span className="text-slate-400 text-xs">Rp</span>
                        <input
                          type="number"
                          step="100"
                          min="0"
                          value={item.flat}
                          onChange={e => handlePaymentFeeChange(key, 'flat', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.enabled !== false}
                          onChange={e => handlePaymentFeeChange(key, 'enabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                        <span className="ml-2 text-xs font-medium text-slate-600">
                          {item.enabled !== false ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </label>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        </div>

        {/* Save Action Bar */}
        <div className="flex items-center justify-end gap-4 bg-white p-4 border border-slate-200 rounded-2xl shadow-sm">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Konfigurasi Fee & Pajak
          </button>
        </div>
      </form>
    </div>
  );
}
