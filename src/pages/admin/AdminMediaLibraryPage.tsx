import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../store/auth-store";
import { Library, Upload, Search, Trash2, Copy, CheckCircle2, AlertCircle, FileText, Folder, Image as ImageIcon } from "lucide-react";

interface MediaItem {
  id: string;
  fileName: string;
  originalName: string;
  url: string;
  mimeType: string;
  size: number;
  altText?: string;
  folder?: string;
  createdAt: string;
}

export default function AdminMediaLibraryPage() {
  const { user } = useAuthStore();
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("");

  // Upload Modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFolder, setUploadFolder] = useState("general");
  const [altText, setAltText] = useState("");
  const [uploading, setUploading] = useState(false);

  // Preview Modal
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<MediaItem | null>(null);

  useEffect(() => {
    fetchMedia();
  }, [selectedFolder, search]);

  const fetchMedia = async () => {
    try {
      setLoading(true);
      const token = await (user as any)?.getIdToken?.();
      const params = new URLSearchParams();
      if (selectedFolder) params.append("folder", selectedFolder);
      if (search) params.append("search", search);

      const res = await fetch(`/api/admin/media?${params.toString()}`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setMediaList(data.data || []);
      } else {
        setError(data.message);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = await (user as any)?.getIdToken?.();
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("folder", uploadFolder);
      formData.append("altText", altText);

      const res = await fetch("/api/admin/media", {
        method: "POST",
        headers: { Authorization: token ? `Bearer ${token}` : "" },
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMsg("Asset berhasil diunggah.");
        setIsUploadModalOpen(false);
        setUploadFile(null);
        setAltText("");
        fetchMedia();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || "Gagal mengunggah asset");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (item: MediaItem) => {
    setError(null);
    setItemToDelete(item);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      setError(null);
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/media/${itemToDelete.id}`, {
        method: "DELETE",
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Asset berhasil dihapus.");
        setItemToDelete(null);
        fetchMedia();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || "Gagal menghapus asset");
        setItemToDelete(null);
      }
    } catch (err: any) {
      setError(err.message);
      setItemToDelete(null);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setSuccessMsg("URL asset berhasil disalin ke clipboard!");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="ui-page-title text-gray-900">Media Library</h1>
          <p className="text-sm text-gray-500">Pusat penyimpanan dan pengelolaan asset gambar untuk banner, popup, blog, dan landing page.</p>
        </div>
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition"
        >
          <Upload className="w-4 h-4" />
          Upload Asset Baru
        </button>
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

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama file atau alt text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Folder className="w-4 h-4 text-gray-400" />
          <select
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
            className="w-full sm:w-48 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Semua Folder</option>
            <option value="general">General</option>
            <option value="banners">Banners</option>
            <option value="popups">Popups</option>
            <option value="blog">Blog</option>
            <option value="landings">Landing Pages</option>
          </select>
        </div>
      </div>

      {/* Media Grid */}
      {loading ? (
        <div className="p-12 text-center text-gray-500">Memuat media library...</div>
      ) : mediaList.length === 0 ? (
        <div className="p-12 bg-white rounded-xl border border-gray-200 text-center text-gray-500">
          <ImageIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">Belum ada asset media.</p>
          <p className="text-xs text-gray-400 mt-1">Klik "Upload Asset Baru" untuk mulai menambahkan gambar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {mediaList.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col group transition hover:shadow-md">
              <div 
                className="relative aspect-square bg-gray-100 cursor-pointer overflow-hidden"
                onClick={() => setPreviewItem(item)}
              >
                <img
                  src={item.url}
                  alt={item.altText || item.originalName}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full uppercase">
                  {item.folder}
                </div>
              </div>

              <div className="p-3 flex flex-col flex-1 justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-gray-900 truncate" title={item.originalName}>
                    {item.originalName}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {(item.size / 1024).toFixed(1)} KB • {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleCopyUrl(item.url)}
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    title="Salin URL"
                  >
                    <Copy className="w-3.5 h-3.5" /> Salin URL
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="text-gray-400 hover:text-red-600 transition p-1"
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Konfirmasi Hapus Asset</h3>
            <p className="text-sm text-gray-600">
              Apakah Anda yakin ingin menghapus asset <strong className="text-gray-900">{itemToDelete.originalName}</strong>? Asset yang sedang digunakan oleh banner aktif tidak dapat dihapus.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-950">Upload Asset Media</h3>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-semibold">✕</button>
            </div>

            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Pilih File Gambar</label>
                <input
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                <p className="text-[11px] text-gray-400 mt-1">Format: JPEG, PNG, WEBP, GIF, SVG. Maks 5MB.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Folder Penempatan</label>
                <select
                  value={uploadFolder}
                  onChange={(e) => setUploadFolder(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="general">General</option>
                  <option value="banners">Banners</option>
                  <option value="popups">Popups</option>
                  <option value="blog">Blog</option>
                  <option value="landings">Landing Pages</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Alt Text (Opsional)</label>
                <input
                  type="text"
                  placeholder="Deskripsi singkat gambar untuk SEO"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {uploading ? "Mengunggah..." : "Upload Sekarang"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewItem(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 truncate">{previewItem.originalName}</h3>
              <button onClick={() => setPreviewItem(null)} className="text-gray-400 hover:text-gray-600 font-semibold">✕</button>
            </div>
            <div className="max-h-96 bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center">
              <img src={previewItem.url} alt={previewItem.altText} className="max-h-80 object-contain" referrerPolicy="no-referrer" />
            </div>
            <div className="text-xs space-y-1 text-gray-600">
              <p><strong>URL:</strong> <span className="font-mono text-indigo-600 select-all">{previewItem.url}</span></p>
              <p><strong>Mime Type:</strong> {previewItem.mimeType} | <strong>Ukuran:</strong> {(previewItem.size / 1024).toFixed(1)} KB</p>
              <p><strong>Folder:</strong> {previewItem.folder} | <strong>Diupload:</strong> {new Date(previewItem.createdAt).toLocaleString()}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => handleCopyUrl(previewItem.url)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg"
              >
                Salin URL
              </button>
              <button
                onClick={() => setPreviewItem(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
