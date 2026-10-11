# Production Hardening Notes — Current Architecture

**Updated:** 2026-10-12  
**Purpose:** Current repository-level notes. Earlier Firebase-era implementation claims were superseded and must not be used as proof of current runtime behavior.

## Authentication and authorization

- Frontend authentication uses Supabase Auth in `src/App.tsx`.
- `src/server/middleware.ts` verifies Supabase access tokens and resolves authorization using Supabase-backed profile data.
- Frontend helpers may retain a compatibility method named `getIdToken`; the name alone does not imply Firebase SDK usage. Confirm the implementation in `src/App.tsx` and `src/lib/supabase-auth.ts`.

## Database and transaction boundaries

- The current declared database client is Supabase JS. Firebase client/Admin SDK packages are not declared in `package.json`.
- Do not rely on obsolete statements in this file's earlier version that described Firestore rules or Firestore transactions as the current order/payment security boundary.
- Payment webhooks, order transitions, provider dispatch, ledger operations, commissions, and payouts are high-risk paths. Any migration work must preserve idempotency and the existing server-authoritative flow; this document does not authorize changes to those paths.

## Verification limits

- This is a source-repository review, not a live database migration report.
- Absence of Firebase packages and deployment files does not by itself prove that all historical data has been migrated or that no indirect legacy reference remains.
- Ledger identifiers such as `ledgerJournalEntries` must be classified by call-path tracing; comments or strings alone are insufficient evidence of a live Firestore connection.
- Re-check the current production deployment and relevant read-only health checks after source changes. Never mark production verified while a deployment is still building or has failed.

## Required follow-up

1. Classify remaining Firebase/Firestore strings as executable code, compatibility naming, historical documentation, or generated snapshots.
2. Update or remove only obsolete documentation and unreferenced generated artifacts.
3. Test build and relevant authentication/authorization paths before considering runtime cleanup complete.
4. Treat data migration completeness as a separate claim requiring evidence from source and destination counts/reconciliation.
