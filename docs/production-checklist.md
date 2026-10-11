# Production Checklist — iStore

This checklist reflects the current Supabase + Vercel application architecture. Mark items only after verifying the live environment.

## Deployment and configuration

- [ ] GitHub production branch is `main` and contains the intended commit.
- [ ] Latest Vercel production deployment for that commit is `READY`.
- [ ] Production domain `https://ist.web.id` serves the intended deployment.
- [ ] Required server-side environment variables are configured in Vercel; no secrets are exposed through `VITE_*` variables.
- [ ] HTTPS and domain configuration verified.
- [ ] Server health endpoint and production logs checked.

## Supabase

- [ ] Correct production Supabase project and region verified.
- [ ] Required schema/migrations are applied; migration history reconciled with repository migrations.
- [ ] Authentication and role checks verified using Supabase Auth and profile data.
- [ ] Read-only checks confirm critical tables and expected data are accessible.
- [ ] Backup and recovery procedure documented and tested.

## Payments, orders, and fulfillment

- [ ] Active payment gateway matches the production configuration.
- [ ] Payment webhook signature and amount validation verified.
- [ ] Order state transitions and idempotency verified.
- [ ] Provider fulfillment and reconciliation paths verified.
- [ ] Ledger, commissions, and payouts reconciled before any migration or cleanup affecting them.

## Application quality and operations

- [ ] Catalog/provider synchronization tested.
- [ ] Error logging and monitoring configured.
- [ ] Rate limiting and admin authorization verified.
- [ ] SEO metadata, sitemap, and robots.txt verified.

## Legacy Firebase/Firestore cleanup

- [ ] No executable source path depends on Firebase client/Admin SDK or Firestore.
- [ ] Remaining references are classified as historical documentation, compatibility identifiers, or generated artifacts.
- [ ] Historical Firebase setup instructions are clearly labelled obsolete or removed.
- [ ] Historical data migration is reconciled separately; source-code cleanup alone is not proof of data migration.
