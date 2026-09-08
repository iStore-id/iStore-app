import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Stock, ProductVariant } from '../../../types/core';
import { useAuthStore } from '../../../store/auth-store';
import { Package, Search, Plus, RefreshCw, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function StockTab() {
  const [stocks, setStocks] = useState<(Stock & { variantName: string })[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const { user } = useAuthStore();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const variantsSnap = await getDocs(collection(db, 'productVariants'));
      const variantsData = variantsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProductVariant));
      setVariants(variantsData);

      const stocksSnap = await getDocs(collection(db, 'stocks'));
      const stocksData = stocksSnap.docs.map(d => {
        const data = d.data() as Stock;
        const v = variantsData.find(v => v.id === data.variantId);
        return {
          id: d.id,
          ...data,
          variantName: v ? `${v.displayName || v.name} (${v.sku})` : 'Unknown Variant'
        };
      });
      setStocks(stocksData);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariantId || adjustAmount === 0) return;
    
    try {
      setAdjusting(true);
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/variants/${selectedVariantId}/stock/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantityChange: adjustAmount, reason: adjustReason })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to adjust stock');
      }
      
      setShowAdjustModal(false);
      setSelectedVariantId('');
      setAdjustAmount(0);
      setAdjustReason('');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdjusting(false);
    }
  };

  const filteredStocks = stocks.filter(s => s.variantName.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="text-center py-10 text-slate-500">Loading stock data...</div>;
  if (error) return <div className="text-center py-10 text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by variant name or SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
          />
        </div>
        <button
          onClick={() => setShowAdjustModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Adjust Stock
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 font-medium">Variant</th>
              <th className="px-6 py-3 font-medium text-right">Physical Qty</th>
              <th className="px-6 py-3 font-medium text-right">Reserved</th>
              <th className="px-6 py-3 font-medium text-right">Available</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium text-right">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredStocks.map((stock) => (
              <tr key={stock.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-900">{stock.variantName}</td>
                <td className="px-6 py-4 text-right text-slate-600">{stock.quantity}</td>
                <td className="px-6 py-4 text-right text-amber-600">{stock.reservedQuantity}</td>
                <td className="px-6 py-4 text-right font-medium text-green-600">{stock.availableQuantity}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    stock.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {stock.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-slate-500">
                  {new Date(stock.updatedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {filteredStocks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                  No stock records found. Click 'Adjust Stock' to initialize stock for a variant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-semibold text-slate-900">Adjust Stock</h3>
              <button onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-slate-500">
                &times;
              </button>
            </div>
            <form onSubmit={handleAdjustStock} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Variant</label>
                <select
                  required
                  value={selectedVariantId}
                  onChange={e => setSelectedVariantId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">Select a variant...</option>
                  {variants.map(v => (
                    <option key={v.id} value={v.id!}>{v.displayName || v.name} ({v.sku})</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Adjustment Amount (+/-)</label>
                <input
                  type="number"
                  required
                  value={adjustAmount || ''}
                  onChange={e => setAdjustAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="e.g. 10 or -5"
                />
                <p className="text-xs text-slate-500 mt-1">Use negative values to deduct stock.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="e.g. Restock from supplier, Damaged item"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjusting || !selectedVariantId || adjustAmount === 0}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {adjusting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Confirm Adjust
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
