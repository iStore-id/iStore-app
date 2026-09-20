/**
 * Supabase Data Layer Facade for Catalog and Provider Domains (STEP 4.5A)
 * 
 * Provides unified, isolated access to Supabase-backed repositories for:
 * 1. Catalog: Games, Categories, Game Categories, Products, Product Variants
 * 2. Provider: Providers, Provider SKUs, Provider Mappings, Routing
 * 
 * DESIGN CONSTRAINTS:
 * - Dedicated server-side adapter.
 * - Leaves Firestore production services (order-engine, fulfillment-dispatcher) completely untouched.
 * - Does not perform data migration or catalog synchronization.
 */

export * from "./provider-sku-identity";
export * from "./catalog-repository";
export * from "./provider-repository";
export * from "./catalog-sync-service";
export * from "./cms-repository";
export * from "./media-repository";
export * from "./order-repository";
export * from "./payment-repository";
export * from "./reconciliation-repository";
export * from "./system-config-repository";
export * from "./promo-repository";
export * from "./flash-sale-repository";
export * from "./wishlist-repository";
export * from "./review-repository";
export * from "./ledger-repository";
