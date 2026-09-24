import React, { useState, useEffect } from "react";
import { Plus, Search, Edit2, Trash2, XCircle, Settings, Target, Zap, Globe, Layout, Package, Tag, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuthStore } from "../../store/auth-store";
import { PricingRule, PricingMethod } from "../../types/core";

export default function AdminPricingRulesPage() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  
  const { user } = useAuthStore();

  const fetchRules = async () => {
    try {
      setLoading(true);
      const idToken = await user?.getIdToken();
      const res = await fetch("/api/admin/pricing/rules", {
        headers: { "Authorization": `Bearer ${idToken}` }
      });
      const result = await res.json();
      if (result.success) {
        setRules(result.data);
      }
    } catch (err) {
      console.error("Error fetching rules:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleSaveRule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setNotification(null);
    const formData = new FormData(e.currentTarget);
    const idToken = await user?.getIdToken();
    
    const ruleData = {
      name: formData.get("name") as string,
      method: formData.get("method") as PricingMethod,
      value: parseFloat(formData.get("value") as string) || 0,
      scope: formData.get("scope") as any,
      scopeId: formData.get("scopeId") as string || null,
      priority: parseInt(formData.get("priority") as string) || 1,
      status: formData.get("status") as any,
      effectiveFrom: formData.get("effectiveFrom") as string || null,
      effectiveUntil: formData.get("effectiveUntil") as string || null,
    };

    try {
      const url = editingRule ? `/api/admin/pricing/rules/${editingRule.id}` : "/api/admin/pricing/rules";
      const method = editingRule ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
        body: JSON.stringify(ruleData)
      });

      const result = await res.json();
      
      if (res.ok && result.success) {
        const isRuleActive = ruleData.status === 'active';
        setNotification({
          message: isRuleActive ? "✓ Aturan harga berhasil disimpan dan diterapkan." : "✓ Aturan harga berhasil disimpan.",
          type: 'success'
        });
        setIsModalOpen(false);
        setEditingRule(null);
        fetchRules();
      } else {
        setNotification({
          message: `✕ Gagal menyimpan aturan harga. ${result.message || "Terjadi kesalahan."}`,
          type: 'error'
        });
      }
    } catch (err) {
      console.error("Error saving rule:", err);
      setNotification({
        message: "✕ Gagal menyimpan aturan harga. Periksa koneksi dan coba lagi.",
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`fixed top-4 right-4 z-[60] px-6 py-4 rounded-xl shadow-lg border ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {notification.message}
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="ui-page-title text-slate-800">Pricing Rules</h1>
          <p className="text-slate-500">Atur otomatisasi harga berdasarkan markup atau target margin.</p>
        </div>
        <button 
          onClick={() => { setEditingRule(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition-all shadow-sm font-medium"
        >
          <Plus className="w-5 h-5" />
          Tambah Aturan
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Aturan</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Metode</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Scope</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Prioritas</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-8 bg-slate-50/50"></td>
                  </tr>
                ))
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <Zap className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    Belum ada aturan harga.
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{rule.name}</div>
                      <div className="text-[10px] text-slate-400 max-w-[200px] truncate">{rule.description || "No description"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700 uppercase">{rule.method.replace('_', ' ')}</span>
                        <span className="text-xs text-blue-600 font-bold">
                          {rule.method.includes('percentage') || rule.method === 'target_margin' ? `${rule.value}%` : `+${rule.value}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {rule.scope === 'global' && <Globe className="w-4 h-4 text-slate-400" />}
                        {rule.scope === 'game' && <Target className="w-4 h-4 text-slate-400" />}
                        {rule.scope === 'category' && <Layout className="w-4 h-4 text-slate-400" />}
                        {rule.scope === 'product' && <Package className="w-4 h-4 text-slate-400" />}
                        {rule.scope === 'variant' && <Tag className="w-4 h-4 text-slate-400" />}
                        <span className="text-sm text-slate-600 capitalize">{rule.scope}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-600">{rule.priority}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                        rule.status === 'active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {rule.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => { setEditingRule(rule); setIsModalOpen(true); }}
                        className="p-2 hover:bg-white hover:text-blue-600 text-slate-400 rounded-lg transition-all border border-transparent hover:border-slate-200"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative z-10">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">{editingRule ? "Edit Aturan" : "Tambah Aturan Baru"}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><XCircle className="w-6 h-6 text-slate-400" /></button>
              </div>
              <form onSubmit={handleSaveRule} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Nama Aturan</label>
                  <input name="name" defaultValue={editingRule?.name} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200" placeholder="Global 5% Margin" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Metode</label>
                    <select name="method" defaultValue={editingRule?.method || "markup_percentage"} className="w-full px-4 py-2.5 rounded-xl border border-slate-200">
                      <option value="markup_fixed">Fixed Markup (IDR)</option>
                      <option value="markup_percentage">Percentage Markup (%)</option>
                      <option value="target_margin">Target Margin (%)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Nilai</label>
                    <input name="value" type="number" step="0.01" defaultValue={editingRule?.value} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Scope</label>
                    <select name="scope" defaultValue={editingRule?.scope || "global"} className="w-full px-4 py-2.5 rounded-xl border border-slate-200">
                      <option value="global">Global</option>
                      <option value="category">Category</option>
                      <option value="game">Game</option>
                      <option value="product">Product</option>
                      <option value="variant">Variant</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Scope ID (Optional)</label>
                    <input name="scopeId" defaultValue={editingRule?.scopeId} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-mono text-xs" placeholder="ID (jika bukan global)" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Prioritas</label>
                    <input name="priority" type="number" defaultValue={editingRule?.priority || 1} className="w-full px-4 py-2.5 rounded-xl border border-slate-200" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Status</label>
                    <select name="status" defaultValue={editingRule?.status || "active"} className="w-full px-4 py-2.5 rounded-xl border border-slate-200">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Berlaku Mulai</label>
                    <input name="effectiveFrom" type="datetime-local" defaultValue={editingRule?.effectiveFrom?.substring(0, 16)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Berlaku Sampai</label>
                    <input name="effectiveUntil" type="datetime-local" defaultValue={editingRule?.effectiveUntil?.substring(0, 16)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs" />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold">Batal</button>
                  <button type="submit" disabled={saving} className="flex-1 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50">{saving ? "Menyimpan..." : "Simpan Aturan"}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
