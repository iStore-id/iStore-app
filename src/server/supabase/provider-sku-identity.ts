import * as crypto from "crypto";

/**
 * Generates a deterministic, collision-resistant UUID (v5) from a namespace
 * and a deterministic key string (provider_id + provider_sku).
 * 
 * Complies with PostgreSQL UUID type format and maintains 1:1 deterministic mapping.
 */
const PROVIDER_SKU_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"; // Standard DNS namespace UUID

export function generateDeterministicProviderSkuUuid(providerId: string, providerSku: string): string {
  if (!providerId || !providerSku) {
    throw new Error("providerId and providerSku are required for deterministic UUID generation");
  }

  const cleanProvider = String(providerId).toLowerCase().trim();
  const cleanSku = String(providerSku).trim();
  const identityString = `${cleanProvider}:${cleanSku}`;

  // Generate SHA-1 hash over namespace + value (RFC 4122 UUID v5)
  const nsBytes = Buffer.from(PROVIDER_SKU_NAMESPACE.replace(/-/g, ""), "hex");
  const valueBytes = Buffer.from(identityString, "utf8");

  const hash = crypto.createHash("sha1").update(Buffer.concat([nsBytes, valueBytes])).digest();

  // Set version to 5 (0101)
  hash[6] = (hash[6] & 0x0f) | 0x50;
  // Set variant to RFC 4122 (10xx)
  hash[8] = (hash[8] & 0x3f) | 0x80;

  const hex = hash.toString("hex").substring(0, 32);
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`;
}

/**
 * Legacy string format helper (used in older Firestore keys).
 * Maintained for backward compatibility.
 */
export function generateLegacyDeterministicSkuKey(providerId: string, providerSku: string): string {
  if (!providerId || !providerSku) return "";
  const pId = String(providerId).toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  const sku = String(providerSku).trim();
  const readableSku = sku.toLowerCase().replace(/[^a-z0-9]/g, "_").substring(0, 40);
  const hash = crypto.createHash("md5").update(sku).digest("hex").substring(0, 8);
  return `${pId}_${readableSku}_${hash}`;
}
