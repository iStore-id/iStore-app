import React, { useEffect, useState, useRef } from "react";
import { useAuthStore } from "../../store/auth-store";
import { formatRupiah } from "../../lib/utils";
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Eye, 
  Calendar, 
  RefreshCw, 
  DollarSign, 
  ArrowRight,
  ShieldAlert,
  Loader2,
  Lock,
  Plus,
  TrendingUp,
  FileText,
  User,
  Hash,
  AlertTriangle,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SettlementBatch, SettlementRecord } from "../../types/core";

export default function AdminSettlementPage() {
  const { user, can } = useAuthStore();
  const [batches, setBatches] = useState<SettlementBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected Batch Detail
  const [selectedBatch, setSelectedBatch] = useState<SettlementBatch | null>(null);
  const [selectedBatchRecords, setSelectedBatchRecords] = useState<SettlementRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");

  // Adjustment Modal
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
  const [adjustmentType, setAdjustmentType] = useState<'MDR_CORRECTION' | 'BANK_FEE' | 'REVENUE_ADJUSTMENT' | 'RECEIVABLE_WRITE_OFF'>('MDR_CORRECTION');
  const [adjustmentDirection, setAdjustmentDirection] = useState<'POSITIVE' | 'NEGATIVE'>('POSITIVE');
  const [adjustmentReason, setAdjustmentReason] = useState<string>("");
  const [adjustmentLoading, setAdjustmentLoading] = useState(false);
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);

  const hasViewPermission = can("finance", "view");
  const hasEditPermission = can("finance", "edit");

  const fetchBatches = async () => {
    if (!hasViewPermission) return;
    setRefreshing(true);
    try {
      const token = await user?.getIdToken?.();
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch("/api/admin/settlement/batches", { headers });
      const resData = await res.json();
      if (resData.success) {
        setBatches(resData.data);
        setError(null);
      } else {
        setError(resData.message || "Gagal memuat batch settlement.");
      }
    } catch (err: any) {
      console.error("Gagal memuat settlement:", err);
      setError("Terjadi kesalahan jaringan saat memuat data settlement.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [hasViewPermission]);

  const fetchBatchDetail = async (batchId: string) => {
    setDetailLoading(true);
    try {
      const token = await user?.getIdToken?.();
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/admin/settlement/batches/${batchId}`, { headers });
      const resData = await res.json();
      if (resData.success) {
        setSelectedBatch(resData.data.batch);
        setSelectedBatchRecords(resData.data.records);
        setIsDetailOpen(true);
      } else {
        alert(resData.message || "Gagal memuat detail batch settlement.");
      }
    } catch (err: any) {
      console.error("Error loading detail:", err);
      alert("Gagal memuat detail dari server.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!hasEditPermission) {
      alert("Anda tidak memiliki izin untuk mengimpor data finansial.");
      return;
    }

    if (!file.name.endsWith(".csv")) {
      setUploadResult({ success: false, message: "Hanya file format CSV resmi yang didukung untuk saat ini." });
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Content = (reader.result as string).split(",")[1];
      await uploadFile(file.name, base64Content);
    };
    reader.onerror = () => {
      setUploadResult({ success: false, message: "Gagal membaca berkas." });
    };
  };

  const uploadFile = async (fileName: string, fileContent: string) => {
    setIsUploading(true);
    setUploadResult(null);
    try {
      const token = await user?.getIdToken?.();
      const headers: HeadersInit = {
        "Content-Type": "application/json"
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/admin/settlement/import", {
        method: "POST",
        headers,
        body: JSON.stringify({ fileName, fileContent })
      });

      const resData = await res.json();
      if (res.status === 201) {
        setUploadResult({ success: true, message: resData.message });
        fetchBatches();
      } else {
        setUploadResult({ success: false, message: resData.message || "Impor laporan settlement gagal." });
      }
    } catch (err: any) {
      setUploadResult({ success: false, message: "Terjadi kesalahan koneksi saat mengunggah laporan." });
    } finally {
      setIsUploading(false);
    }
  };

  const handleVerify = async (batchId: string) => {
    if (!hasEditPermission) return;
    if (!confirm("Apakah Anda yakin ingin memverifikasi batch ini?")) return;

    try {
      const token = await user?.getIdToken?.();
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/admin/settlement/batches/${batchId}/verify`, {
        method: "POST",
        headers
      });

      const resData = await res.json();
      if (resData.success) {
        alert(resData.message);
        fetchBatches();
        if (selectedBatch && selectedBatch.id === batchId) {
          fetchBatchDetail(batchId);
        }
      } else {
        alert(resData.message || "Gagal memverifikasi batch.");
      }
    } catch (err: any) {
      alert("Kesalahan koneksi saat memverifikasi.");
    }
  };

  const handleSettle = async (batchId: string) => {
    if (!hasEditPermission) return;
    if (!confirm("Konfirmasi akhir: Apakah Anda yakin ingin menandai batch ini sebagai SETTLED? Tindakan ini bersifat permanen dan mengunci rekam finansial.")) return;

    try {
      const token = await user?.getIdToken?.();
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/admin/settlement/batches/${batchId}/settle`, {
        method: "POST",
        headers
      });

      const resData = await res.json();
      if (resData.success) {
        alert(resData.message);
        fetchBatches();
        if (selectedBatch && selectedBatch.id === batchId) {
          fetchBatchDetail(batchId);
        }
      } else {
        alert(resData.message || "Gagal menandai batch sebagai settled.");
      }
    } catch (err: any) {
      alert("Kesalahan koneksi saat merubah status ke settled.");
    }
  };

  const handleAddAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch || !hasEditPermission) return;
    if (adjustmentAmount <= 0) {
      setAdjustmentError("Nominal penyesuaian harus berupa angka positif.");
      return;
    }
    if (!adjustmentReason.trim()) {
      setAdjustmentError("Alasan penyesuaian wajib diisi.");
      return;
    }

    setAdjustmentLoading(true);
    setAdjustmentError(null);

    try {
      const token = await user?.getIdToken?.();
      const headers: HeadersInit = {
        "Content-Type": "application/json"
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const isPost = selectedBatch.status === "SETTLED";
      const endpoint = isPost
        ? `/api/admin/settlement/batches/${selectedBatch.id}/post-settlement-adjustment`
        : `/api/admin/settlement/batches/${selectedBatch.id}/adjustment`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          amount: Math.abs(adjustmentAmount),
          type: adjustmentType,
          direction: adjustmentDirection,
          reason: adjustmentReason.trim()
        })
      });

      const resData = await res.json();
      if (resData.success) {
        alert(resData.message);
        setIsAdjustmentOpen(false);
        setAdjustmentAmount(0);
        setAdjustmentReason("");
        fetchBatches();
        fetchBatchDetail(selectedBatch.id);
      } else {
        setAdjustmentError(resData.message || "Gagal menambahkan adjustment.");
      }
    } catch (err: any) {
      setAdjustmentError("Kesalahan koneksi sistem.");
    } finally {
      setAdjustmentLoading(false);
    }
  };

  const filteredBatches = batches.filter(batch => {
    const matchesStatus = statusFilter === "all" || batch.status === statusFilter;
    const matchesDate = !dateFilter || batch.periodDate === dateFilter;
    return matchesStatus && matchesDate;
  });

  const aggregateStats = {
    gross: batches.reduce((acc, b) => acc + (b.grossAmount || 0), 0),
    mdr: batches.reduce((acc, b) => acc + (b.mdrFeeAmount || 0), 0),
    refund: batches.reduce((acc, b) => acc + (b.refundAmount || 0), 0),
    adjustment: batches.reduce((acc, b) => acc + (b.adjustmentAmount || 0), 0),
    net: batches.reduce((acc, b) => acc + (b.netSettledAmount || 0), 0),
    count: batches.reduce((acc, b) => acc + (b.orderCount || 0), 0),
  };

  if (!hasViewPermission) {
    return (
      <div id="unauthorized-settlement" className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
        <Lock className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Akses Ditolak</h2>
        <p className="text-gray-500 max-w-md">Anda tidak memiliki izin yang diperlukan untuk melihat modul Settlement Keuangan.</p>
      </div>
    );
  }

  return (
    <div id="settlement-page-container" className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div id="settlement-header" className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 id="settlement-page-title" className="text-3xl font-bold text-gray-900 tracking-tight">Penyelesaian Finansial</h1>
          <p id="settlement-page-subtitle" className="text-sm text-gray-500 mt-1">Rekonsiliasi berkas harian Midtrans Merchant Portal, pelaporan MDR, dan audit dana bersih.</p>
        </div>
        <button
          id="btn-refresh-settlements"
          onClick={fetchBatches}
          disabled={refreshing}
          className="flex items-center gap-2 self-start md:self-auto px-4 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-medium text-sm rounded-lg transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Perbarui Data
        </button>
      </div>

      {/* Aggregate Stats Bar */}
      <div id="settlement-dashboard-stats" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div id="stat-gross" className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase">GROSS TRANSACTION</span>
          <span className="text-xl font-bold text-gray-900 mt-2">{formatRupiah(aggregateStats.gross)}</span>
          <div className="flex items-center gap-1 text-xs text-gray-500 mt-3">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
            <span>Akumulasi bruto harian</span>
          </div>
        </div>

        <div id="stat-mdr" className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase">MIDTRANS MDR / FEE</span>
          <span className="text-xl font-bold text-amber-600 mt-2">-{formatRupiah(aggregateStats.mdr)}</span>
          <div className="flex items-center gap-1 text-xs text-gray-500 mt-3">
            <Info className="w-3.5 h-3.5 text-amber-500" />
            <span>Gateway processing fee</span>
          </div>
        </div>

        <div id="stat-refund" className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase">REFUNDS</span>
          <span className="text-xl font-bold text-rose-600 mt-2">-{formatRupiah(aggregateStats.refund)}</span>
          <div className="flex items-center gap-1 text-xs text-gray-500 mt-3">
            <Info className="w-3.5 h-3.5 text-rose-500" />
            <span>Dana dikembalikan</span>
          </div>
        </div>

        <div id="stat-adjustments" className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase">ADJUSTMENTS</span>
          <span className={`text-xl font-bold mt-2 ${aggregateStats.adjustment >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {aggregateStats.adjustment >= 0 ? "+" : ""}{formatRupiah(aggregateStats.adjustment)}
          </span>
          <div className="flex items-center gap-1 text-xs text-gray-500 mt-3">
            <Info className="w-3.5 h-3.5 text-blue-500" />
            <span>Penyesuaian manual</span>
          </div>
        </div>

        <div id="stat-net" className="bg-white p-5 rounded-xl border border-indigo-100 bg-indigo-50/20 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-indigo-600 tracking-wider uppercase">NET SETTLED</span>
          <span className="text-xl font-bold text-indigo-900 mt-2">{formatRupiah(aggregateStats.net)}</span>
          <div className="flex items-center gap-1 text-xs text-indigo-600/70 mt-3">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>{aggregateStats.count} Transaksi sukses</span>
          </div>
        </div>
      </div>

      {/* Main Content Split: Import and Table */}
      <div id="settlement-main-split" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Upload & Guidelines */}
        <div id="settlement-sidebar-section" className="lg:col-span-4 space-y-6">
          {hasEditPermission ? (
            <div 
              id="settlement-import-card" 
              className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm"
            >
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                Impor Laporan Resmi
              </h3>
              
              <div 
                id="dropzone-midtrans-csv"
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
                  dragActive 
                    ? "border-emerald-500 bg-emerald-50/30" 
                    : "border-gray-200 hover:border-emerald-400 bg-gray-50/40"
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileInput}
                  className="hidden" 
                  accept=".csv"
                />
                
                {isUploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                    <p className="text-sm font-semibold text-gray-700">Sedang memproses file...</p>
                    <p className="text-xs text-gray-400">Verifikasi tanda tangan & hitung hash...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="w-10 h-10 text-gray-400 mb-3" />
                    <p className="text-sm font-semibold text-gray-700">Seret file CSV di sini atau</p>
                    <p className="text-xs font-medium text-emerald-600 hover:underline mt-1">Pilih dari folder Anda</p>
                    <p className="text-[10px] text-gray-400 mt-4">Hanya mendukung format CSV asli Midtrans Merchant Admin Portal</p>
                  </div>
                )}
              </div>

              {uploadResult && (
                <div 
                  id="upload-result-container"
                  className={`mt-4 p-4 rounded-lg flex items-start gap-3 border ${
                    uploadResult.success 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                      : "bg-rose-50 border-rose-200 text-rose-800"
                  }`}
                >
                  {uploadResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-xs font-bold">{uploadResult.success ? "Impor Berhasil" : "Impor Ditolak"}</p>
                    <p className="text-xs mt-1 leading-relaxed">{uploadResult.message}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div id="unauthorized-import-box" className="bg-gray-50 p-6 rounded-xl border border-gray-100 text-center">
              <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xs text-gray-500">Anda tidak memiliki hak akses finansial tingkat edit untuk mengimpor berkas eksternal.</p>
            </div>
          )}

          {/* Operational Guidelines */}
          <div id="settlement-info-box" className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <h4 className="text-xs font-bold tracking-wider text-gray-400 uppercase">PANDUAN SETTLEMENT</h4>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                <p className="text-xs text-gray-600 leading-relaxed">Ekspor berkas rekonsiliasi harian melalui portal <strong>Midtrans MAP</strong>.</p>
              </div>
              <div className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                <p className="text-xs text-gray-600 leading-relaxed">Unggah berkas mentah. Sistem dilarang merubah/menebak kolom sembarangan.</p>
              </div>
              <div className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
                <p className="text-xs text-gray-600 leading-relaxed">Tinjau saksama jika status batch masuk ke kategori <strong>DISPUTED</strong> atau <strong>CONFIGURATION REQUIRED</strong>.</p>
              </div>
              <div className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">4</span>
                <p className="text-xs text-gray-600 leading-relaxed">Status <strong>SETTLED</strong> akan mengunci semua nominal harian selamanya (immutable).</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Batches History & Filters */}
        <div id="settlement-batches-section" className="lg:col-span-8 space-y-6">
          
          {/* Filters Bar */}
          <div id="settlement-filters" className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Filter Batch:</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <select
                id="filter-batch-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 outline-none hover:border-gray-300 transition-colors"
              >
                <option value="all">Semua Status</option>
                <option value="CALCULATED">Calculated (Menunggu Verifikasi)</option>
                <option value="VERIFIED">Verified (Terverifikasi)</option>
                <option value="SETTLED">Settled (Locked/Selesai)</option>
                <option value="DISPUTED">Disputed (Masalah Data)</option>
              </select>

              <input
                id="filter-batch-date"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 outline-none hover:border-gray-300 transition-colors"
              />

              {(statusFilter !== "all" || dateFilter) && (
                <button
                  id="btn-clear-settlement-filters"
                  onClick={() => {
                    setStatusFilter("all");
                    setDateFilter("");
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Batches Table List */}
          <div id="batches-table-card" className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-sm text-gray-500">Memuat riwayat batch settlement...</p>
              </div>
            ) : error ? (
              <div className="p-12 text-center text-rose-600 flex flex-col items-center justify-center gap-2">
                <AlertCircle className="w-10 h-10" />
                <p className="text-sm font-semibold">{error}</p>
              </div>
            ) : filteredBatches.length === 0 ? (
              <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
                <FileText className="w-12 h-12 text-gray-200" />
                <p className="text-sm font-medium">Belum ada batch settlement untuk filter ini.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table id="table-settlement-batches" className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Tanggal Periode</th>
                      <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Nama Berkas</th>
                      <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Gross Amount</th>
                      <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Net Settled</th>
                      <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Status</th>
                      <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredBatches.map((batch) => (
                      <tr 
                        id={`row-batch-${batch.id}`}
                        key={batch.id} 
                        className="hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="p-4 text-sm font-semibold text-gray-900">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {batch.periodDate}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-xs font-medium text-gray-700 max-w-[150px] truncate" title={batch.sourceFileName}>
                            {batch.sourceFileName}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5 truncate max-w-[150px]">
                            Hash: {batch.sourceFileHash.substring(0, 10)}...
                          </div>
                        </td>
                        <td className="p-4 text-sm text-gray-600 text-right font-medium">
                          {formatRupiah(batch.grossAmount)}
                        </td>
                        <td className="p-4 text-sm text-indigo-900 text-right font-bold">
                          {formatRupiah(batch.netSettledAmount)}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            batch.status === "SETTLED" 
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                              : batch.status === "VERIFIED"
                              ? "bg-blue-50 border-blue-200 text-blue-800"
                              : batch.status === "DISPUTED"
                              ? "bg-rose-50 border-rose-200 text-rose-800"
                              : "bg-amber-50 border-amber-200 text-amber-800"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              batch.status === "SETTLED" 
                                ? "bg-emerald-500" 
                                : batch.status === "VERIFIED"
                                ? "bg-blue-500"
                                : batch.status === "DISPUTED"
                                ? "bg-rose-500"
                                : "bg-amber-500"
                            }`} />
                            {batch.status}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            id={`btn-view-detail-${batch.id}`}
                            onClick={() => fetchBatchDetail(batch.id)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-gray-200 hover:border-indigo-400 hover:text-indigo-600 text-gray-700 text-xs font-semibold rounded-md transition-all shadow-sm"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Detail
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
      </div>

      {/* Batch Detail Modal Panel */}
      <AnimatePresence>
        {isDetailOpen && selectedBatch && (
          <div 
            id="batch-detail-overlay"
            className="fixed inset-0 z-50 bg-black/40 flex justify-end"
          >
            <motion.div
              id="batch-detail-panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Rincian Batch Settlement</h3>
                  <p className="text-xs text-gray-400 mt-1 font-mono">{selectedBatch.id}</p>
                </div>
                <button
                  id="btn-close-batch-modal"
                  onClick={() => setIsDetailOpen(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* File & Processing Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-5 rounded-xl border border-gray-100 text-xs">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-500">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span className="font-semibold text-gray-700">Nama Berkas:</span>
                      <span className="text-gray-900 font-medium truncate max-w-[200px]" title={selectedBatch.sourceFileName}>
                        {selectedBatch.sourceFileName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 font-mono">
                      <Hash className="w-4 h-4 text-gray-400" />
                      <span>Hash berkas: {selectedBatch.sourceFileHash}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <User className="w-4 h-4 text-indigo-500" />
                      <span>Diproses oleh: UID {selectedBatch.processedBy.substring(0, 10)}...</span>
                    </div>
                  </div>
                  <div className="space-y-2 md:border-l md:border-gray-200 md:pl-6">
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-medium">Tanggal Dibuat:</span>
                      <span className="text-gray-900 font-semibold">{new Date(selectedBatch.createdAt).toLocaleString()}</span>
                    </div>
                    {selectedBatch.verifiedAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-medium">Diverifikasi:</span>
                        <span className="text-gray-900 font-semibold">{new Date(selectedBatch.verifiedAt).toLocaleString()}</span>
                      </div>
                    )}
                    {selectedBatch.settledAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-medium">Dana Cair (Settled):</span>
                        <span className="text-emerald-700 font-bold">{new Date(selectedBatch.settledAt).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Batch Status Bar Warning */}
                {selectedBatch.status === "DISPUTED" && (
                  <div id="dispute-alert-box" className="bg-rose-50 border border-rose-200 rounded-xl p-5 flex items-start gap-3">
                    <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-rose-800">Batch Terdeteksi Masalah (DISPUTED)</h4>
                      <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                        Ditemukan minimal satu baris rekonsiliasi yang datanya tidak sinkron dengan data internal iStore.id 
                        (seperti order ID tidak ditemukan, jumlah bayar tidak sama, atau sudah pernah diclearing pada periode sebelumnya).
                      </p>
                    </div>
                  </div>
                )}

                {/* Financial Summary Breakdown */}
                <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
                  <h4 className="text-xs font-bold text-gray-400 tracking-wider uppercase">PERHITUNGAN NOMINAL BATCH</h4>
                  <div className="divide-y divide-gray-100 text-sm">
                    <div className="py-2.5 flex justify-between">
                      <span className="text-gray-600">Total Kotor (Gross)</span>
                      <span className="font-medium text-gray-900">{formatRupiah(selectedBatch.grossAmount)}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-gray-600">Potongan Gateway / MDR Resmi</span>
                      <span className="font-semibold text-amber-600">-{formatRupiah(selectedBatch.mdrFeeAmount)}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-gray-600">Refund Berhasil</span>
                      <span className="font-semibold text-rose-600">-{formatRupiah(selectedBatch.refundAmount)}</span>
                    </div>
                    <div className="py-2.5 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">Penyesuaian (Adjustment)</span>
                        {selectedBatch.status !== "SETTLED" && hasEditPermission && (
                          <button
                            id="btn-trigger-adjustment"
                            onClick={() => setIsAdjustmentOpen(true)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 text-[10px] font-bold rounded-md transition-all"
                          >
                            <Plus className="w-3 h-3" />
                            Tambah
                          </button>
                        )}
                      </div>
                      <span className={`font-bold ${selectedBatch.adjustmentAmount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {selectedBatch.adjustmentAmount >= 0 ? "+" : ""}{formatRupiah(selectedBatch.adjustmentAmount)}
                      </span>
                    </div>
                    <div className="pt-4 pb-2 flex justify-between items-center text-base border-t border-dashed border-gray-200">
                      <span className="font-bold text-gray-900">Total Net Settled</span>
                      <span className="font-extrabold text-indigo-900 text-lg">{formatRupiah(selectedBatch.netSettledAmount)}</span>
                    </div>
                  </div>
                </div>

                {/* Records list mapping */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 tracking-wider uppercase flex items-center justify-between">
                    <span>DAFTAR TRANSAKSI DI DALAM BATCH</span>
                    <span>{selectedBatchRecords.length} Items</span>
                  </h4>
                  
                  <div className="border border-gray-100 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="p-3 font-semibold text-gray-500">Order ID</th>
                          <th className="p-3 font-semibold text-gray-500 text-right">Gross</th>
                          <th className="p-3 font-semibold text-gray-500 text-right">MDR</th>
                          <th className="p-3 font-semibold text-gray-500 text-right">Net</th>
                          <th className="p-3 font-semibold text-gray-500 text-center">Status Padanan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {selectedBatchRecords.map((rec) => (
                          <tr key={rec.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-3 font-mono font-bold text-gray-800">{rec.orderId}</td>
                            <td className="p-3 text-right text-gray-600">{formatRupiah(rec.grossAmount)}</td>
                            <td className="p-3 text-right text-amber-600">-{formatRupiah(rec.mdrFeeAmount)}</td>
                            <td className="p-3 text-right text-gray-900 font-semibold">{formatRupiah(rec.netAmount)}</td>
                            <td className="p-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                rec.gatewayTransactionStatus === "SUCCESS" 
                                  ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                                  : "bg-rose-50 border-rose-100 text-rose-700"
                              }`}>
                                {rec.gatewayTransactionStatus === "SUCCESS" ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <AlertTriangle className="w-3 h-3 text-rose-500" />
                                )}
                                {rec.gatewayTransactionStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Footer Controls */}
              {hasEditPermission && (
                <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    {selectedBatch.status === "CALCULATED" && (
                      <p className="text-xs text-gray-500 max-w-sm">Diverifikasi menunjukkan bahwa semua rekam audit internal dirasa sudah cocok dan benar.</p>
                    )}
                    {selectedBatch.status === "VERIFIED" && (
                      <p className="text-xs text-amber-600 max-w-sm font-semibold">Perhatian: Menandai sebagai Settled akan membekukan data batch selamanya.</p>
                    )}
                  </div>
                  
                  <div className="flex gap-3 w-full sm:w-auto">
                    {selectedBatch.status === "CALCULATED" && (
                      <button
                        id="btn-verify-batch-final"
                        onClick={() => handleVerify(selectedBatch.id)}
                        className="flex-1 sm:flex-initial px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-all shadow-sm flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Verifikasi Batch
                      </button>
                    )}

                    {selectedBatch.status === "VERIFIED" && (
                      <button
                        id="btn-settle-batch-final"
                        onClick={() => handleSettle(selectedBatch.id)}
                        className="flex-1 sm:flex-initial px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg transition-all shadow-sm flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Tandai Sebagai SETTLED
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Adjustment Overlay Modal */}
      <AnimatePresence>
        {isAdjustmentOpen && selectedBatch && (
          <div 
            id="adjustment-overlay"
            className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
          >
            <motion.div
              id="adjustment-box"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl relative"
            >
              <h4 className="text-lg font-bold text-gray-900 mb-1">Tambah Penyesuaian (Adjustment)</h4>
              <p className="text-xs text-gray-400 mb-4">
                Pilih klasifikasi akuntansi dan nominal positif (IDR). Sistem secara otomatis mengalokasikan akun Debit & Kredit GL yang tepat.
              </p>
              
              <form onSubmit={handleAddAdjustmentSubmit} className="space-y-4">
                <div>
                  <label htmlFor="select-adjustment-type" className="block text-xs font-semibold text-gray-500 mb-1">Klasifikasi Adjustment (GL Account)</label>
                  <select
                    id="select-adjustment-type"
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500 bg-white font-medium"
                  >
                    <option value="MDR_CORRECTION">MDR_CORRECTION (Koreksi Fee Gateway / MDR)</option>
                    <option value="BANK_FEE">BANK_FEE (Biaya Bank / Admin Payout)</option>
                    <option value="REVENUE_ADJUSTMENT">REVENUE_ADJUSTMENT (Koreksi Pendapatan Sales)</option>
                    <option value="RECEIVABLE_WRITE_OFF">RECEIVABLE_WRITE_OFF (Hapusbuku Piutang Gateway)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="select-adjustment-direction" className="block text-xs font-semibold text-gray-500 mb-1">Arah Dampak Finansial</label>
                  <select
                    id="select-adjustment-direction"
                    value={adjustmentDirection}
                    onChange={(e) => setAdjustmentDirection(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500 bg-white font-medium"
                  >
                    <option value="POSITIVE">POSITIF (+) — Penambahan Hasil Neto / Pengurangan Biaya</option>
                    <option value="NEGATIVE">NEGATIF (-) — Pengurangan Hasil Neto / Penambahan Biaya</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="input-adjustment-amount" className="block text-xs font-semibold text-gray-500 mb-1">Nominal Positif Integer (IDR)</label>
                  <input
                    id="input-adjustment-amount"
                    type="number"
                    min="1"
                    step="1"
                    value={adjustmentAmount || ""}
                    onChange={(e) => setAdjustmentAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500 font-semibold"
                    placeholder="Rp 0"
                  />
                </div>

                <div>
                  <label htmlFor="input-adjustment-reason" className="block text-xs font-semibold text-gray-500 mb-1">Alasan Penyesuaian (Wajib)</label>
                  <textarea
                    id="input-adjustment-reason"
                    rows={2}
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                    placeholder="Contoh: Selisih MDR Bank Transfer, Pajak Payout, Koreksi Refund..."
                  />
                </div>

                <div className="p-2.5 bg-gray-50 border border-gray-200/80 rounded-lg text-xs text-gray-600">
                  <span className="font-bold text-gray-700">Otomatisasi GL: </span>
                  {adjustmentType === "MDR_CORRECTION" && (adjustmentDirection === "POSITIVE" ? "DR 1100_BANK_CLEARING | CR 5000_GATEWAY_MDR_FEE" : "DR 5000_GATEWAY_MDR_FEE | CR 1100_BANK_CLEARING")}
                  {adjustmentType === "BANK_FEE" && "DR 5100_SETTLEMENT_ADJUSTMENT | CR 1100_BANK_CLEARING"}
                  {adjustmentType === "REVENUE_ADJUSTMENT" && (adjustmentDirection === "POSITIVE" ? "DR 1100_BANK_CLEARING | CR 4000_SALES_REVENUE" : "DR 4000_SALES_REVENUE | CR 1100_BANK_CLEARING")}
                  {adjustmentType === "RECEIVABLE_WRITE_OFF" && "DR 5100_SETTLEMENT_ADJUSTMENT | CR 1000_GATEWAY_RECEIVABLE"}
                </div>

                {adjustmentError && (
                  <p className="text-xs text-rose-600 font-semibold">{adjustmentError}</p>
                )}

                <div className="flex gap-3 justify-end pt-2">
                  <button
                    id="btn-cancel-adjustment"
                    type="button"
                    onClick={() => {
                      setIsAdjustmentOpen(false);
                      setAdjustmentError(null);
                    }}
                    className="px-4 py-2 border border-gray-200 hover:border-gray-300 text-gray-700 text-sm font-semibold rounded-lg"
                  >
                    Batal
                  </button>
                  <button
                    id="btn-submit-adjustment"
                    type="submit"
                    disabled={adjustmentLoading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5"
                  >
                    {adjustmentLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Simpan Penyesuaian
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
