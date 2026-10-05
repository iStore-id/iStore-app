import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RotateCcw, ArrowLeft, ShieldCheck, AlertCircle, HelpCircle, CheckCircle2, MessageCircle, Mail } from "lucide-react";
import { useSEO } from "../lib/seo";

export default function RefundPolicyPage() {
  const [contactInfo, setContactInfo] = useState<{
    name?: string;
    whatsapp?: string;
    email?: string;
  }>({});

  useSEO({
    title: "Kebijakan Pengembalian Dana (Refund) - ist.web.id",
    description: "Kebijakan resmi pengembalian dana, pembatalan pesanan, dan prosedur garansi transaksi produk digital di ist.web.id.",
    keywords: ["kebijakan refund", "pengembalian dana istore", "garansi top up game", "komplain transaksi istore id"],
    canonicalPath: "/refund",
    ogType: "website"
  });

  useEffect(() => {
    fetch("/api/public/store-config")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setContactInfo({
            name: json.data.name || "ist.web.id",
            whatsapp: json.data.contactInformation?.whatsapp || "",
            email: json.data.contactInformation?.email || ""
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen py-8 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Beranda</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/terms"
              className="text-xs sm:text-sm font-medium text-brand-600 hover:underline"
            >
              Syarat & Ketentuan →
            </Link>
            <span className="text-slate-300">|</span>
            <Link
              to="/privacy"
              className="text-xs sm:text-sm font-medium text-brand-600 hover:underline"
            >
              Kebijakan Privasi →
            </Link>
          </div>
        </div>

        {/* Header Hero */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold mb-1">
                <ShieldCheck className="w-3 h-3 text-amber-600" />
                <span>Garansi Transaksi Resmi</span>
              </div>
              <h1 className="ui-page-title text-slate-900">
                Kebijakan Pengembalian Dana (Refund)
              </h1>
            </div>
          </div>

          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed pt-2 border-t border-slate-100">
            Kami berkomitmen memberikan pengalaman transaksi produk digital yang aman, transparan, dan terpercaya. Halaman ini menjelaskan syarat, batasan, serta prosedur resmi pengembalian dana (*refund*) atas transaksi di ist.web.id.
          </p>
        </div>

        {/* Content Body */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-8 text-slate-800 text-sm sm:text-base leading-relaxed">
          
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-bold">1</span>
              Sifat Produk Digital & Ketentuan Umum
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm">
              Seluruh produk yang dipasarkan di ist.web.id merupakan produk digital (mata uang game, voucher digital, pulsa, dan token listrik) yang diproses dan dikirimkan secara otomatis melalui koneksi server resmi publisher/distributor:
            </p>
            <ul className="list-disc pl-5 text-xs sm:text-sm text-slate-600 space-y-1.5">
              <li>Karena sifat pengiriman produk digital yang instan dan langsung terikat ke akun game penerima, seluruh transaksi yang telah berhasil terkirim (*DELIVERED*) dinyatakan <strong>final dan tidak dapat dibatalkan atau dikembalikan</strong>.</li>
              <li>Pengembalian dana hanya dapat dipertimbangkan apabila terjadi kendala sistem internal atau kegagalan pemenuhan pesanan dari pihak kami/provider resmi.</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold">2</span>
              Kondisi yang Memenuhi Syarat Refund (Eligible)
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm">
              Pengembalian dana dapat disetujui apabila memenuhi salah satu kondisi berikut:
            </p>
            <div className="grid grid-cols-1 gap-3 pt-1">
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">
                  <strong className="text-emerald-950 block">Kegagalan Sistem Provider (SLA Exceeded)</strong>
                  <span className="text-emerald-800">Pembayaran telah terkonfirmasi lunas, namun item gagal terkirim oleh sistem provider dan tidak dapat diselesaikan dalam batas waktu toleransi maksimal 1x24 jam.</span>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">
                  <strong className="text-emerald-950 block">Stok Produk Habis Permanen</strong>
                  <span className="text-emerald-800">Produk atau denominasi yang dipesan mengalami kehabisan pasokan dari publisher sehingga pesanan tidak dapat diselesaikan.</span>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">
                  <strong className="text-emerald-950 block">Kelebihan Pembayaran / Debit Ganda (Double Charge)</strong>
                  <span className="text-emerald-800">Terjadi pemotongan saldo berulang oleh payment gateway atas nomor invoice pesanan yang sama akibat anomali jaringan perbankan.</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-red-50 text-red-600 flex items-center justify-center text-xs font-bold">3</span>
              Kondisi yang Tidak Memenuhi Syarat Refund (Non-Eligible)
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm">
              Kami tidak dapat menyetujui permohonan pengembalian dana dalam kondisi berikut:
            </p>
            <div className="p-4 rounded-2xl bg-red-50/50 border border-red-100 text-xs sm:text-sm text-red-900 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span><strong>Kesalahan Data Akun oleh Pembeli:</strong> Kesalahan input User ID, Zone ID, Server ID, atau nomor tujuan yang dimasukkan saat checkout. Apabila item telah sukses terkirim ke ID yang salah namun ID tersebut valid di server game, transaksi tidak dapat dibatalkan atau direfund.</span>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span><strong>Perubahan Keputusan:</strong> Pembeli berubah pikiran atau salah memilih denominasi setelah pembayaran terverifikasi dan pesanan telah masuk ke antrean pemrosesan otomatis.</span>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span><strong>Pembayaran Belum Berhasil:</strong> Pesanan berstatus belum dibayar (*UNPAID* atau *EXPIRED*).</span>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span><strong>Tidak Memiliki Bukti Sah:</strong> Pembeli tidak dapat menunjukkan nomor Invoice resmi iStore.id dan bukti pembayaran yang valid.</span>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">4</span>
              Prosedur & Batas Waktu Pengajuan Refund
            </h2>
            <div className="space-y-3 text-xs sm:text-sm text-slate-600">
              <p>
                Untuk mengajukan kendala transaksi atau permohonan pengembalian dana, pembeli wajib memenuhi ketentuan administratif berikut:
              </p>
              <ol className="list-decimal pl-5 space-y-2 text-slate-700">
                <li>
                  <strong>Batas Waktu Komplain:</strong> Pengajuan komplain wajib dilakukan maksimal <strong>1x24 jam</strong> terhitung sejak transaksi dilakukan.
                </li>
                <li>
                  <strong>Nomor Invoice Resmi:</strong> Sertakan nomor pesanan resmi ist.web.id (contoh: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-brand-700 font-mono text-xs">INV-YYYYMMDD-XXXX</code>).
                </li>
                <li>
                  <strong>Bukti Pembayaran Valid:</strong> Lampirkan bukti transfer perbankan, mutasi rekening, atau receipt e-wallet/QRIS yang memperlihatkan tanggal, jam, nominal, dan nomor referensi transaksi.
                </li>
                <li>
                  <strong>Screenshot Bukti Akun:</strong> Lampirkan tangkapan layar akun game yang memperlihatkan riwayat top-up atau bukti item belum bertambah.
                </li>
              </ol>
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold">5</span>
              Metode & Estimasi Pencairan Pengembalian Dana
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm">
              Setelah klaim diverifikasi dan dinyatakan sah oleh tim investigasi kami:
            </p>
            <ul className="list-disc pl-5 text-xs sm:text-sm text-slate-600 space-y-1.5">
              <li>Pengembalian dana diproses melalui sistem pembalik pembayaran resmi (*payment gateway reversal*) atau transfer langsung ke rekening bank/e-wallet pembeli sesuai kesepakatan verifikasi.</li>
              <li>Estimasi waktu dana masuk kembali ke rekening pembeli:
                <ul className="list-circle pl-5 pt-1 space-y-1 text-slate-600">
                  <li><strong>QRIS & E-Wallet:</strong> 1 hingga 3 hari kerja (bergantung pada regulasi penerbit e-wallet).</li>
                  <li><strong>Virtual Account / Transfer Bank:</strong> 1 hingga 7 hari kerja operasional bank.</li>
                </ul>
              </li>
            </ul>
          </section>

        </div>

        {/* Contact Support Box */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 sm:p-8 space-y-4 shadow-md">
          <div className="flex items-center gap-2 text-brand-400 text-xs font-bold uppercase tracking-wider">
            <HelpCircle className="w-4 h-4" />
            <span>Kanal Bantuan & Layanan Pelanggan</span>
          </div>
          <h2 className="text-lg font-bold text-white">Butuh Bantuan Mengenai Pesanan Anda?</h2>
          <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
            Tim Customer Service resmi kami siap membantu verifikasi pesanan Anda 24 jam nonstop. Silakan hubungi kami dengan menyertakan Nomor Invoice transaksi Anda.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            {contactInfo.whatsapp ? (
              <a
                href={`https://wa.me/${contactInfo.whatsapp.replace(/\D/g, "")}?text=Halo%20Admin%20${encodeURIComponent(contactInfo.name || "ist.web.id")},%20saya%20ingin%20mengajukan%20komplain%20pesanan`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-sm"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp Customer Support</span>
              </a>
            ) : null}
            {contactInfo.email ? (
              <a
                href={`mailto:${contactInfo.email}?subject=Permohonan%20Bantuan%20/%20Refund%20Pesanan`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs transition"
              >
                <Mail className="w-4 h-4" />
                <span>Email Dukungan</span>
              </a>
            ) : null}
            <Link
              to="/faq"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs transition"
            >
              <span>Pertanyaan Umum (FAQ)</span>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
