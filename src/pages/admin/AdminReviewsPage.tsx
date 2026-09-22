import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../store/auth-store";
import { Star, CheckCircle2, XCircle, AlertCircle, Trash2, Eye, EyeOff, MessageSquare } from "lucide-react";

interface ReviewItem {
  id: string;
  customerId: string;
  productId: string;
  rating: number;
  content: string;
  status: 'published' | 'hidden' | 'rejected';
  verifiedPurchase: boolean;
  createdAt: string;
}

export default function AdminReviewsPage() {
  const { user } = useAuthStore();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch("/api/admin/reviews", {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setReviews(data.data || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'published' | 'hidden' | 'rejected') => {
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/reviews/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Status ulasan berhasil diubah menjadi ${status}.`);
        fetchReviews();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(data.message);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus ulasan ini?")) return;
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "DELETE",
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Ulasan berhasil dihapus.");
        fetchReviews();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(data.message);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Review Management</h1>
          <p className="text-sm text-gray-500">Moderasi ulasan produk dan pantau rating kepuasan pelanggan.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{successMsg}</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Memuat ulasan...</div>
        ) : reviews.length === 0 ? (
          <div className="p-12 text-center text-gray-500">Belum ada ulasan produk.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Customer UID</th>
                  <th className="py-3 px-4">Rating</th>
                  <th className="py-3 px-4">Ulasan</th>
                  <th className="py-3 px-4">Verified</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {reviews.map((rev) => (
                  <tr key={rev.id} className="hover:bg-gray-50 transition">
                    <td className="py-4 px-4 text-xs text-gray-500">{new Date(rev.createdAt).toLocaleString()}</td>
                    <td className="py-4 px-4 font-mono text-xs text-gray-700">{rev.customerId}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1 text-amber-500 font-bold">
                        <Star className="w-4 h-4 fill-amber-500" />
                        <span>{rev.rating}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-900 max-w-xs truncate" title={rev.content}>
                      {rev.content}
                    </td>
                    <td className="py-4 px-4">
                      {rev.verifiedPurchase ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Verified</span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Standard</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                        rev.status === 'published' ? 'bg-emerald-50 text-emerald-700' :
                        rev.status === 'hidden' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {rev.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      {rev.status !== 'published' && (
                        <button
                          onClick={() => handleUpdateStatus(rev.id, 'published')}
                          className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                          title="Publish"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {rev.status !== 'hidden' && (
                        <button
                          onClick={() => handleUpdateStatus(rev.id, 'hidden')}
                          className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                          title="Hide"
                        >
                          <EyeOff className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(rev.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
