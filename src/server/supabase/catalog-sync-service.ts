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
   * Discovers catalog items directly from the chosen upstream provider.
   * Does NOT read or use Firebase catalog data.
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
        ) {
          validLogo = trimmedLogo;
        }
      }

      return {
        id: uuid,
        providerId,
        providerSku: cleanSku,
        name: (item.name || "Unknown").trim(),
        type: "topup",
        baseCost: typeof item.baseCost === "number" && !isNaN(item.baseCost) ? Math.max(0, item.baseCost) : 0,
        isActive: Boolean(item.isActive),
        metadata: {
          category: item.metadata?.category ? String(item.metadata.category) : undefined,
          operator: item.metadata?.operator ? String(item.metadata.operator) : undefined,
          type: item.metadata?.type ? String(item.metadata.type) : undefined,
          description: item.metadata?.description ? String(item.metadata.description) : undefined,
          targetFields: Array.isArray(item.targetFields) ? item.targetFields.map(String) : [],
          logo: validLogo,
        },
      };
    });
  }

  /**
   * Executes sync runner in DRY_RUN or bounded LIVE_TEST mode.
   * 
   * Strict Safety Invariants:
   * 1. DRY_RUN never touches Supabase database (0 mutations).
   * 2. LIVE_TEST enforces a strict server-side hard cap of <= 10 SKUs.
   * 3. Sync is strictly additive/upsert. Never deletes old SKUs.
   * 4. Does NOT create public games, products, or variants.
   * 5. Does NOT compute or touch public selling prices.
   */
  public async executeSync(options: SyncOptions): Promise<SyncResult> {
    const timestamp = new Date().toISOString();
    const { providerId, mode, filterCode } = options;

    console.log(`[Supabase Catalog Sync] Initiating ${mode} for provider: ${providerId}`);

    // 1. Fetch live catalog directly from provider
    let discoveredItems: DiscoveryResult[] = [];
    try {
      discoveredItems = await this.fetchFromProvider(providerId, filterCode);
    } catch (err: any) {
      const isNotConfigured = err.message === "NOT_CONFIGURED" || err.message?.includes("not configured");
      return {
        success: false,
        providerId,
        mode,
        configured: !isNotConfigured,
        totalDiscovered: 0,
        candidateItemsCount: 0,
        upsertedCount: 0,
        sampleCandidates: [],
        message: isNotConfigured
          ? `Provider credentials for '${providerId}' are not configured. Live discovery cannot proceed.`
          : `Provider discovery failed: ${err.message}`,
        timestamp,
      };
    }

    // 2. Normalize and compute deterministic UUID v5
    const candidates = this.normalizeCandidateItems(providerId, discoveredItems);

    // 3. Handle DRY_RUN mode
    if (mode === "DRY_RUN") {
      const sample = candidates.slice(0, 5);
      return {
        success: true,
        providerId,
        mode: "DRY_RUN",
        configured: true,
        totalDiscovered: discoveredItems.length,
        candidateItemsCount: candidates.length,
        upsertedCount: 0, // 0 mutations in DRY_RUN
        sampleCandidates: sample,
        message: `DRY_RUN succeeded: Discovered ${discoveredItems.length} items from ${providerId}. 0 mutations applied to Supabase.`,
        timestamp,
      };
    }

    // 4. Handle LIVE_TEST mode (Strict Hard Cap Enforcement)
    if (mode === "LIVE_TEST") {
      const boundedLimit = Math.min(
        HARD_CAP_LIVE_TEST,
        typeof options.limit === "number" && options.limit > 0 ? options.limit : HARD_CAP_LIVE_TEST
      );

      const itemsToUpsert = candidates.slice(0, boundedLimit);
      if (itemsToUpsert.length === 0) {
        return {
          success: true,
          providerId,
          mode: "LIVE_TEST",
          configured: true,
          totalDiscovered: 0,
          candidateItemsCount: 0,
          upsertedCount: 0,
          sampleCandidates: [],
          message: `LIVE_TEST: No items available to upsert from ${providerId}.`,
          timestamp,
        };
      }

      const providerRepo = SupabaseProviderRepository.getInstance();

      // Ensure deterministic provider record exists first
      await providerRepo.upsertProvider({
        id: providerId,
        code: providerId,
        name: providerId === "tokovoucher" ? "TokoVoucher" : "API Games",
        description: `Upstream direct provider: ${providerId}`,
        status: "active",
        priority: providerId === "tokovoucher" ? 10 : 20,
      });

      // Bounded upsert of provider SKUs
      let upsertedCount = 0;
      for (const item of itemsToUpsert) {
        await providerRepo.upsertProviderSku({
          providerId: item.providerId,
          providerSku: item.providerSku,
          name: item.name,
          type: item.type,
          status: item.isActive ? "active" : "inactive",
          metadata: {
            ...item.metadata,
            baseCost: item.baseCost,
            syncedAt: timestamp,
          },
        });
        upsertedCount++;
      }

      return {
        success: true,
        providerId,
        mode: "LIVE_TEST",
        configured: true,
        totalDiscovered: discoveredItems.length,
        candidateItemsCount: candidates.length,
        upsertedCount,
        sampleCandidates: itemsToUpsert,
        message: `LIVE_TEST completed: Successfully upserted ${upsertedCount} SKUs (capped at ${HARD_CAP_LIVE_TEST}) to Supabase provider_skus.`,
        timestamp,
      };
    }

    throw new Error(`Unsupported mode: ${mode}`);
  }
}
