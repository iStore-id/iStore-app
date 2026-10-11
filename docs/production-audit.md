# iStore Production Architecture Audit

**Document status:** Current migration note, updated 2026-10-12. This replaces earlier Firebase-era assumptions; it is not a substitute for a live production data audit.

## Verified repository facts

- The application backend is Node.js/Express in `server.ts`, built by the `build` script in `package.json` into `dist/server.cjs`.
- The repository's declared database client is `@supabase/supabase-js`; `package.json` does not declare the Firebase client/Admin SDK.
- Frontend authentication in `src/App.tsx` uses Supabase Auth. `src/server/middleware.ts` verifies Supabase access tokens and obtains role information from Supabase-backed profiles.
- The TokoVoucher integration settings handler reads and writes through `SystemConfigRepository`; the repository implementation is `src/server/supabase/system-config-repository.ts`.
- Firebase deployment configuration files previously targeted for removal, including `firebase.json` and `firestore.rules`, are absent from the current `main` branch.

## Migration status and boundaries

**Status: legacy-reference cleanup in progress; full historical-data migration is not certified by this document.**

- Old reports and generated snapshots may contain Firebase/Firestore language that no longer describes the current architecture. Do not treat those documents as evidence of live runtime dependencies.
- `server.cjs.require.txt` is a tracked source/bundle snapshot, not the build output configured by the current `package.json`. Its references must be checked against current source before being treated as runtime behavior.
- `src/server/ledger-service.ts` contains legacy ledger-preservation comments and the identifier `ledgerJournalEntries`. These references alone do not prove an active Firestore connection; do not remove ledger code or alter financial records without tracing the call paths and validating the Supabase implementation.
- This repository audit does not verify whether every historical Firebase record has been migrated, nor does it certify production database row counts.

## Safety requirements for further cleanup

1. Trace executable imports and call paths before removing a suspected legacy reference.
2. Preserve payment gateway routing, checkout, order state transitions, provider fulfillment, ledger posting, commission/payout behavior, and audit logging.
3. Do not run destructive production data operations as part of a source/documentation cleanup.
4. Verify GitHub `main`, Vercel deployment state, and relevant read-only production health checks after code changes.
5. Keep historical reports only when clearly labelled historical; do not leave obsolete Firebase instructions presented as current setup requirements.

## Current conclusion

The repository has moved to Supabase-backed authentication and data-access patterns in the inspected areas, and the old Firebase deployment/rules files are absent. Remaining historical strings and ledger compatibility identifiers require source-level classification. **Do not claim that every Firebase/Firestore dependency or every legacy data record has been eliminated until those checks are complete.**
