# Phase 5B.1 — Payout Batch Schema & Runtime Audit Report

## A. Actual PostgreSQL Schema
* **`public.payout_batches`**: **TIDAK ADA**. Berdasarkan hasil inspeksi schema dan file DDL `commission-migration.sql`, tabel ini belum eksis di PostgreSQL. Seluruh data batch saat ini murni hidup di Firestore.
* **`public.commission_records`**: 
  * Kolom `payout_batch_id` (VARCHAR 255) sudah ada di PostgreSQL.
  * *Foreign key constraint* (`commission_records_payout_batch_id_fkey`) sengaja didrop (loose coupling).
  * Check constraint `chk_commission_records_payout_status` memastikan status IN ('UNPAID', 'ALLOCATED', 'PAID').

## B. Firestore Payout Usage Inventory
Ditemukan banyak penggunaan `adminDb.collection("payoutBatches")` dalam `src/server/commission-service.ts`:
1. `createPayoutBatch`: `.set()`
2. `submitPayoutBatch`: `.get()`, `.update({ status: 'PENDING_APPROVAL' })`
3. `approvePayoutBatch`: `.get()`, `.update({ status: 'PROCESSING' })`
4. `confirmPayoutPaid`: `.get()`, `.update({ status: 'PAID' })`
5. `cancelPayoutBatch`: `.get()`, `.update({ status: 'CANCELLED' })`
6. `failPayoutBatch`: `.get()`, `.update({ status: 'FAILED' })`
7. `exportPayoutCSV`: `.get()`

## C. Field Mapping (Firestore -> Proposed PostgreSQL)
| Legacy Firestore Field | PostgreSQL Field | Type | Required |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `VARCHAR(255) PK` | YES |
| `batchNumber` | `batch_number` | `VARCHAR(100) UNIQUE` | YES |
| `recipientId` | `recipient_id` | `VARCHAR(255) FK` | YES |
| `recipientSnapshot` | `recipient_snapshot` | `JSONB` | YES |
| `allocations` | `allocations` | `JSONB` | YES |
| `totalCommissionAmount` | `total_commission_amount` | `INTEGER` | YES |
| `payoutFee` | `payout_fee` | `INTEGER` | YES |
| `netPayoutAmount` | `net_payout_amount` | `INTEGER` | YES |
| `status` | `status` | `VARCHAR(50)` | YES |
| `payoutMethod` | `payout_method` | `VARCHAR(50)` | YES |
| `transferReference` | `transfer_reference` | `VARCHAR(255)` | NO |
| `ledgerJournalId` | `ledger_journal_id` | `VARCHAR(255)` | NO |
| `createdAt` / `By` | `created_at` / `created_by` | `TIMESTAMPTZ` / `VARCHAR` | YES |
| `submittedAt` / `By` | `submitted_at` / `submitted_by` | `TIMESTAMPTZ` / `VARCHAR` | NO |
| `approvedAt` / `By` | `approved_at` / `approved_by` | `TIMESTAMPTZ` / `VARCHAR` | NO |
| `paidAt` / `By` | `paid_at` / `paid_by` | `TIMESTAMPTZ` / `VARCHAR` | NO |

## D. State Machine Audit
Alur transisi statik (DRAFT ➔ PENDING_APPROVAL ➔ PROCESSING ➔ PAID) dikawal melalui Application Logic di TypeScript (contoh: `if (currentBatch.status !== 'PROCESSING') throw`).
* **Maker-Checker**: Ditegakkan via `actor.uid !== batch.createdBy` (kecuali Owner).

## E. Commission Locking Audit
* **Locking**: Dilakukan secara atomik via `supabase.from("commission_records").update({payout_status: 'ALLOCATED'}).eq('payout_status', 'UNPAID')`.
* Jika jumlah row yang diupdate tidak sama dengan jumlah requested, service akan memicu *rollback*.
* **Split-Brain Risk**: Lock Postgres dieksekusi **sebelum** insert batch ke Firestore. Jika Firestore timeout/gagal, record komisi di Postgres akan terkunci permanen (`ALLOCATED`) ke `payout_batch_id` yang tidak eksis.

## F. Refund Race Condition (TOCTOU)
Terdapat jendela race-condition antara eksekusi *Refund* (`handle_commission_refund_atomic` RPC) dan `confirmPayoutPaid`.
* `confirmPayoutPaid` (Gate 7) memvalidasi `remainingPayableAmount` secara in-memory.
* Jika valid, eksekusi berlanjut menyimpan ke Firestore dan Ledger.
* Tepat setelah Gate 7 dan sebelum Update Status PAID di Postgres, RPC Refund bisa saja ter-trigger dan mengurangi `remainingPayableAmount`. Update `payout_status = PAID` di akhir metode akan tetap sukses, menutupi fakta bahwa sebagian komisi sebenarnya sudah direfund, mengakibatkan pendarahan *cash* (*over-payout*).

## G. Idempotency Audit
* Pembuatan ID (`payout_batch_${recipientId}_${Date.now()}`) berisiko memicu retry duplicate bila terjadi network glitch.
* Konfirmasi bayar (`confirmPayoutPaid`) sudah bersifat idempotent dengan mengecek status akhir & matching `transferReference`.

## H. Accounting Trace
`confirmPayoutPaid` ➔ memanggil `adapterPostLedgerJournal` mem-posting Jurnal:
* **DEBIT** 2100_COMMISSION_PAYABLE ➔ `2000` (Canonical)
* **CREDIT** 1200_BANK_PRIMARY ➔ `1000` (Canonical)
* **Economic Intent**: Sesuai & Balance.

## I. Findings (Risk Level)
* 🚨 **[P0] Split-Brain Allocation (Orphan Lock)**: Pemisahan state Firestore (Batch) dan Postgres (Locking status) menyebabkan risiko *orphan lock*.
* 🚨 **[P0] TOCTOU Refund vs Payout Payment**: Pengecekan sisa payable di aplikasi (memory) tidak atomik terhadap eksekusi mutasi.

## J. Exact Files That Must Change
1. `supabase/payout-migration.sql` (File SQL DDL baru untuk table `payout_batches`).
2. `src/server/commission-service.ts` (Full rewrite dari Firestore `adminDb.collection("payoutBatches")` ke akses langsung `supabase.from("payout_batches")`).
3. `src/server/commission-api.ts` (API route queries).
4. Pembuatan RPC SQL baru (seperti `create_payout_batch_atomic` dan `confirm_payout_paid_atomic`) untuk mengunci atomicity.

## K. Recommended Phase 5B.2 Implementation Order
1. **Schema Generation**: Buat file `payout-migration.sql` berisi DDL `public.payout_batches` berserta relasi FK yang utuh ke `commission_records`.
2. **PostgreSQL RPC Setup**: Siapkan RPC untuk `create_batch` dan `confirm_paid` guna menghilangkan TOCTOU dan split-brain risk.
3. **Data Backfill**: Migrasikan dokumen dari Firestore `payoutBatches` ke PostgreSQL.
4. **Code Switch-Over**: Modifikasi `commission-service.ts` (Write) dan `commission-api.ts` (Read) agar 100% menggunakan PostgreSQL + RPC baru.
