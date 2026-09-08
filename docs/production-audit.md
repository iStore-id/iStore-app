# Production Readiness Audit - iStore.id

Berdasarkan audit komprehensif terhadap source code aktual, berikut adalah hasil evaluasi untuk setiap requirement.

## 1. Architecture Status
**Status: PARTIAL**
- **Frontend**: Menggunakan React 18, Vite, dan Tailwind CSS. (PASS)
- **Backend**: Menggunakan Node.js/Express di `server.ts` yang dibundel dengan `esbuild` menjadi `dist/server.cjs`. Ini berjalan sebagai **Cloud Run** container, bukan Firebase Cloud Functions. (PARTIAL - *Perlu dicatat bahwa di ekosistem AI Studio Build, aplikasi full-stack dieksekusi di Cloud Run, sehingga Express adalah cara yang tepat. Namun, jika target absolut adalah Firebase Cloud Functions, `server.ts` perlu diekspor ke environment Firebase Functions*).
- **Frontend-Backend Comm**: Frontend memanggil endpoint Express (`/api/checkout`). (PASS)
- **Local Dev vs Prod**: Konfigurasi Vite Middleware vs Static file serving sudah ditangani dengan baik di `server.ts`. (PASS)

## 2. Firebase Security Status
**Status: PASS**
- **Authentication**: Terhubung dengan baik.
- **Firestore Rules**: Rule (`firestore.rules`) sudah sangat ketat:
  - `orders` collection HANYA bisa ditulis oleh Admin (Server). Customer hanya bisa membaca. `allow write: if isAdmin();` (PASS)
  - Modifikasi status harga, payment status, dan transaction status di sisi klien sepenuhnya mustahil karena Firestore Rules. (PASS)
  - `users` collection memblokir modifikasi field sensitif seperti `role` dan `balance`. (PASS)

## 3. Order Engine Status
**Status: PASS**
- **Calculation Validation**: Frontend TIDAK dapat mengirimkan harga. Endpoint `/api/checkout` hanya menerima `productId` dan `variantId`. (PASS)
- **Backend Logic**: Harga ditarik murni dari Firestore snapshot, dihitung (basePrice + markup + adminFee) di backend, lalu dikunci dalam Order dokumen. (PASS)
- **Locking & Validation**: Data divalidasi dan order ID diproduksi dengan aman. (PASS)

## 4. Midtrans Status
**Status: PASS**
- **Integration**: Berada di `src/server/midtrans.ts` dan di-trigger di `/api/checkout`. (PASS)
- **Verification**: Signature HANYA diverifikasi di server menggunakan fungsi `verifySignatureKey`. (PASS)
- **Credentials**: `MIDTRANS_SERVER_KEY` dipisahkan di `.env` dan tidak bocor ke klien. (PASS)
- **Webhooks**: Status transisi (*settlement*, *capture*, *cancel*, *expire*) di-map secara robust. (PASS)

## 5. API Games Status
**Status: PARTIAL -> PASS (FIXED)**
- **Kondisi Awal**: Provider masih menggunakan mock API response (`// MOCK RESPONSE`). (FAIL)
- **Perbaikan**: Telah diperbaiki menggunakan implementasi *fetch* dengan URL sebenarnya (`https://v1.apigames.id/v2/transaksi`).
- **Signature**: Menggunakan `md5(merchant_id:secret_key:ref_id)` sesuai dokumentasi standar.
- **Status Check**: Endpoint pemeriksaan status juga telah ditambahkan menggunakan autentikasi yang sama.

## 6. TokoVoucher Status
**Status: PARTIAL -> PASS (FIXED)**
- **Kondisi Awal**: Menggunakan *fake response*. (FAIL)
- **Perbaikan**: Diubah memanggil endpoint aslinya (`https://api.tokovoucher.net/v1/transaksi`).
- **Authentication**: Menggunakan `md5(member_code:secret:ref_id)`. 
- **Error Handling**: Timeout dan kode error telah diperlakukan sebagai status PENDING sehingga tidak memutus alur yang memerlukan pemeriksaan asinkron.

## 7. Webhook & Idempotency Status (Duplicate Transactions)
**Status: FAIL -> PASS (FIXED)**
- **Kondisi Awal (FAIL)**: `midtransWebhook` memperbarui Firestore menggunakan transaction block, tetapi *post-transaction action* (memanggil provider) dilakukan di luar lock block. Jika ada *race condition* (2 webhook masuk sangat cepat), keduanya akan membaca status `pending` dan men-trigger provider API DUA KALI.
- **Perbaikan (PASS)**: `webhooks.ts` telah diubah. Firestore transaction lock digunakan untuk mengubah `transactionStatus` menjadi `processing` BERSAMAAN dengan pengecekan kelayakan *trigger provider*. Hanya satu eksekusi webhook yang akan memegang *lock* ini, memastikan pemanggilan ke TokoVoucher/API Games bersifat **mutually exclusive** dan mencegah *duplicate transactions*.

## 8. Admin Security Status
**Status: PARTIAL**
- **Firestore Roles**: Rule Firestore dengan mulus memisahkan `admin` dan `customer`. (PASS)
- **Admin Dashboard**: Tampilan dasbor telah diperbaiki untuk membaca data agregasi sesungguhnya (20 pesanan terakhir) dari Firestore alih-alih `// MOCK DATA`. (PASS)
- **Admin Backend APIs**: Belum ada rute khusus (seperti CRUD Produk) yang ditangani secara tertutup via backend/Express. Sebagian besar mengandalkan Firestore dari klien dengan proteksi Rule. Ini aman secara teknis, tetapi kurang fleksibel dibanding pola *backend-mediated*. (PARTIAL)

## 9. Environment Variables
**Status: PASS (FIXED)**
- Semua variabel secret backend (`APIGAMES_SECRET`, `TOKOVOUCHER_SECRET`, `MIDTRANS_SERVER_KEY`) tidak memiliki awalan `VITE_` dan hanya dieksekusi di Node.js.
- `.env.example` telah diperbarui dengan field yang akurat (`APIGAMES_MERCHANT_ID`, `TOKOVOUCHER_MEMBER_CODE`).

## 10. Security & Error Handling
**Status: PASS**
- **XSS / Injection**: React menangani XSS. Express endpoints memeriksa kelengkapan body.
- **Client-side Price Manipulation**: Diblokir via arsitektur (Order Engine ditaruh di backend).
- **Error Output**: Backend melempar JSON seragam dan tidak mengekspos *stack trace* maupun API keys di response.

---

## Daftar Pekerjaan Lanjutan (Future Fixes)

Meski fungsionalitas inti (Pembayaran & Top Up Otomatis) kini **Aman dan Siap Produksi**, berikut adalah hal yang masih dapat dikembangkan:
1. **Cron Job / Schedulers**: Membuat sistem *worker* untuk melakukan ping ke endpoint status TokoVoucher/APIGames (`checkTransaction`) setiap 10 menit bagi order yang tertahan di status `processing`.
2. **Admin API Routes**: Membangun `/api/admin/*` di `server.ts` untuk abstraksi manajemen produk dan user yang lebih rumit dibandingkan dengan penggunaan koneksi langsung Firebase Admin SDK.
3. **Optimisasi Query**: Melakukan pemisahan *Firestore collection* khusus `stats` untuk perhitungan agregasi Admin (omzet, total), agar *dashboard* admin memuat dengan O(1) query tanpa perlu membaca collection utuh.
