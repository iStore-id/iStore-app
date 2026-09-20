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

export * from "./provider-sku-identity.js";
export * from "./catalog-repository.js";
export * from "./provider-repository.js";
export * from "./catalog-sync-service.js";
export * from "./cms-repository.js";
export * from "./media-repository.js";
export * from "./order-repository.js";
export * from "./payment-repository.js";
export * from "./reconciliation-repository.js";
export * from "./system-config-repository.js";
export * from "./promo-repository.js";
export * from "./flash-sale-repository.js";
export * from "./wishlist-repository.js";
export * from "./review-repository.js";
export * from "./ledger-repository.js";
