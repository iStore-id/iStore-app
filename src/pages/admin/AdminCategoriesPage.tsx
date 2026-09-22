import React, { useState, useEffect } from "react";
import { Category } from "../../types/core";
import { supabase } from "../../lib/supabase";
import { 
  Plus, Search, Edit2, Trash2, CheckCircle2, XCircle, 
  Layers, Filter, Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuthStore } from "../../store/auth-store";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  const { user } = useAuthStore();

  const fetchCategories = async () => {
    try {
      setLoading(true);
      if (!supabase) return;
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });
        
      if (error) throw error;
      
      const list = (data || []).map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description || "",
        icon: row.icon || "",
        status: row.status,
        sortOrder: row.sort_order
      } as Category));
      
      setCategories(list);
    } catch (err) {
      console.error("Error fetching categories:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSaveCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const idToken = await user?.getIdToken();
    
    const catData = {
      name: formData.get("name") as string,
      slug: (formData.get("slug") as string).toLowerCase().replace(/\s+/g, '-'),
      description: formData.get("description") as string,
      icon: formData.get("icon") as string,
      status: formData.get("status") as any,
      sortOrder: parseInt(formData.get("sortOrder") as string) || 0,
    };

    try {
      const url = editingCategory ? `/api/admin/categories/${editingCategory.id}` : "/api/admin/categories";
      const method = editingCategory ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify(catData)
      });

      const result = await res.json();
      if (result.success) {
        setIsModalOpen(false);
        setEditingCategory(null);
        fetchCategories();
      } else {
        alert(result.message || "Gagal menyimpan kategori");
      }
    } catch (err: any) {
      console.error("Error saving category:", err);
      alert(err.message || "Terjadi kesalahan saat menyimpan kategori");
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!category.id) return;
    const isConfirmed = window.confirm(`Apakah Anda yakin ingin menghapus kategori "${category.name}"?`);
    if (!isConfirmed) return;

    try {
      const idToken = await user?.getIdToken();
      const res = await fetch(`/api/admin/categories/${category.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });

      const result = await res.json();
      if (result.success) {
        fetchCategories();
      } else {
        alert(result.message || "Gagal menghapus kategori");
      }
    } catch (err: any) {
      console.error("Error deleting category:", err);
      alert(err.message || "Terjadi kesalahan saat menghapus kategori");
    }
  };

  const filtered = categories.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Kategori</h1>
          <p className="text-slate-500">Kelola pengelompokan produk dan game.</p>
        </div>
        <button 
          onClick={() => { setEditingCategory(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition-all shadow-sm font-medium"
        >
          <Plus className="w-5 h-5" />
          Tambah Kategori
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Cari kategori..." 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kategori</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Urutan</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={4} className="px-6 py-8 h-16 bg-slate-50/50"></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                  <Layers className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  Belum ada data kategori.
                </td>
              </tr>
            ) : (
              filtered.map((cat) => (
                <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold border border-blue-100">
                        {cat.icon || <Layers className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 truncate">{cat.name}</div>
                        <div className="text-xs text-slate-400 font-mono truncate">{cat.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                      cat.status === 'active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {cat.status || 'inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {cat.sortOrder}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => { setEditingCategory(cat); setIsModalOpen(true); }}
                        className="p-2 hover:bg-white hover:text-blue-600 text-slate-400 rounded-lg transition-all border border-transparent hover:border-slate-200"
                        title="Edit Kategori"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteCategory(cat)}
                        className="p-2 hover:bg-white hover:text-rose-600 text-slate-400 rounded-lg transition-all border border-transparent hover:border-slate-200"
                        title="Hapus Kategori"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative z-10"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">
                  {editingCategory ? "Edit Kategori" : "Tambah Kategori Baru"}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Nama Kategori</label>
                  <input 
                    name="name" 
                    defaultValue={editingCategory?.name} 
                    required 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Slug</label>
                  <input 
                    name="slug" 
                    defaultValue={editingCategory?.slug} 
                    required 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Ikon (Emoji atau text)</label>
                  <input 
                    name="icon" 
                    defaultValue={editingCategory?.icon} 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Status</label>
                    <select name="status" defaultValue={editingCategory?.status || "active"} className="w-full px-4 py-2.5 rounded-xl border border-slate-200">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Sort Order</label>
                    <input name="sortOrder" type="number" defaultValue={editingCategory?.sortOrder || 0} className="w-full px-4 py-2.5 rounded-xl border border-slate-200" />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors">
                    Batal
                  </button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors">
                    Simpan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
