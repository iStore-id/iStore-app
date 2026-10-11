import { DiscoveryResult } from "../../types/discovery.js";
import { TokoVoucherDiscoveryAdapter } from "../adapters/tokovoucher-discovery-adapter.js";
import { ApiGamesDiscoveryAdapter } from "../adapters/apigames-discovery-adapter.js";
import { SupabaseProviderRepository } from "./provider-repository.js";
import { generateDeterministicProviderSkuUuid } from "./provider-sku-identity.js";

export interface SyncOptions {
  providerId: "tokovoucher" | "apigames";
  mode: "DRY_RUN" | "LIVE_TEST";
  /** Optional filter prefix for TokoVoucher, e.g. "MLBB", "FF", etc. */
  filterCode?: string;
  /** Hard cap for live test execution (Default & Max: 10) */
  limit?: number;
}

export interface SyncCandidateItem {
  id: string; // Deterministic UUID v5
  providerId: string;
  providerSku: string;
  name: string;
  type: string;
  baseCost: number;
  isActive: boolean;
  metadata: {
    category?: string;
    operator?: string;
    type?: string;
    description?: string;
    targetFields?: string[];
    logo?: string;
  };
}

export interface SyncResult {
  success: boolean;
  providerId: string;
  mode: "DRY_RUN" | "LIVE_TEST";
  configured: boolean;
  totalDiscovered: number;
  candidateItemsCount: number;
  upsertedCount: number;
  sampleCandidates: SyncCandidateItem[];
  message: string;
  timestamp: string;
}

const HARD_CAP_LIVE_TEST = 10;

export class SupabaseCatalogSyncService {
  private static instance: SupabaseCatalogSyncService;

  private constructor() {}

  public static getInstance(): SupabaseCatalogSyncService {
    if (!SupabaseCatalogSyncService.instance) {
      SupabaseCatalogSyncService.instance = new SupabaseCatalogSyncService();
    }
    return SupabaseCatalogSyncService.instance;
  }

  /**
   * Discovers catalog items directly from the selected upstream provider.
   */
  private async fetchFromProvider(providerId: "tokovoucher" | "apigames", filterCode?: string): Promise<DiscoveryResult[]> {
    if (providerId === "tokovoucher") {
      const adapter = new TokoVoucherDiscoveryAdapter();
      return await adapter.discoverProducts(filterCode);
    } else if (providerId === "apigames") {
      const adapter = new ApiGamesDiscoveryAdapter();
      return await adapter.discoverProducts(filterCode);
    }
    throw new Error(`Unsupported provider for sync: ${providerId}`);
  }

  /**
   * Normalizes provider discovery output into candidate items with deterministic UUID v5.
   */
  public normalizeCandidateItems(providerId: string, items: DiscoveryResult[]): SyncCandidateItem[] {
    return items.map((item) => {
      const cleanSku = (item.providerSku || "").trim();
      const uuid = generateDeterministicProviderSkuUuid(providerId, cleanSku);

      let validLogo: string | undefined = undefined;
      if (typeof item.metadata?.logo === "string") {
        const trimmedLogo = item.metadata.logo.trim();
        if (
          (trimmedLogo.startsWith("http://") || trimmedLogo.startsWith("https://")) &&
          trimmedLogo !== "-" &&
          trimmedLogo !== "null"