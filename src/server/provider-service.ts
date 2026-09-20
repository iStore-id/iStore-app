import { SupabaseProviderRepository } from "./supabase/provider-repository";
import { SupabaseCatalogRepository } from "./supabase/catalog-repository";
import { 
  Provider, 
  ProviderSku, 
  ProviderMapping, 
  RoutingDecision, 
  RoutingPolicy,
  ProviderHealthState
} from "../types/core";
import { ProviderAdapterRegistry, ProviderFulfillmentRequest } from "./provider-adapters";
import { ApiGamesAdapter } from "./adapters/apigames-adapter";
import { TokoVoucherAdapter } from "./adapters/tokovoucher-adapter";
import { v4 as uuidv4 } from "uuid";
import { generateDeterministicProviderSkuUuid } from "./supabase/provider-sku-identity";
export { generateDeterministicProviderSkuUuid as generateDeterministicProviderSkuId };

const providerRepo = SupabaseProviderRepository.getInstance();
const catalogRepo = SupabaseCatalogRepository.getInstance();

// Register adapters
const registry = ProviderAdapterRegistry.getInstance();
registry.registerAdapter(new ApiGamesAdapter());
registry.registerAdapter(new TokoVoucherAdapter());

export class ProviderService {
  private static instance: ProviderService;

  private constructor() {}

  public static getInstance(): ProviderService {
    if (!ProviderService.instance) {
      ProviderService.instance = new ProviderService();
    }
    return ProviderService.instance;
  }

  // ===================
  // PROVIDER REGISTRY
  // ===================

  async createProvider(data: Partial<Provider>): Promise<Provider> {
    if (data.code) {
      const providers = await providerRepo.listProviders();
      const existing = providers.find(p => p.code === data.code);
      if (existing) throw new Error(`Provider with code '${data.code}' already exists`);
    }

    const providerId = data.id || uuidv4();
    const provider: Provider = {
      id: providerId,
      name: data.name || "",
      code: data.code || "",
      description: data.description || "",
      status: data.status || "inactive",
      priority: data.priority ?? 0,
      capabilities: data.capabilities || [],
      health: {
        state: "unknown",
        ...data.health
      },
      configMetadata: data.configMetadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };

    await providerRepo.upsertProvider(provider as any);
    return provider;
  }

  async updateProvider(id: string, data: Partial<Provider>): Promise<void> {
    const provider = await providerRepo.getProvider(id);
    if (!provider) throw new Error("Provider not found");

    await providerRepo.upsertProvider({
      ...provider,
      ...data,
      id,
      updatedAt: new Date().toISOString()
    } as any);
  }

  async listProviders(): Promise<Provider[]> {
    return providerRepo.listProviders();
  }

  // ===================
  // PROVIDER SKU
  // ===================

  async createProviderSku(data: Partial<ProviderSku>): Promise<ProviderSku> {
    // Validate provider existence
    if (!data.providerId) throw new Error("providerId is required");
    const provider = await providerRepo.getProvider(data.providerId);
    if (!provider) throw new Error("Provider not found");

    // SKU uniqueness within provider
    if (data.providerSku) {
      const existing = await providerRepo.getProviderSku(data.providerId, data.providerSku);
      if (existing) throw new Error(`SKU '${data.providerSku}' already exists for this provider`);
    }

    const docId = data.providerSku ? generateDeterministicProviderSkuUuid(data.providerId, data.providerSku) : (data.id || uuidv4());
    
    // Check if deterministic ID already exists
    if (data.providerSku) {
      const idCheck = await providerRepo.getProviderSkuById(docId);
      if (idCheck) throw new Error(`SKU ID collision or already exists: ${docId}`);
    }

    const sku: ProviderSku = {
      id: docId,
      providerId: data.providerId,
      providerSku: data.providerSku || "",
      name: data.name || "",
      type: data.type || "other",
      status: data.status || "inactive",
      metadata: data.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };

    await providerRepo.upsertProviderSku(sku as any);
    return sku;
  }

  async updateProviderSku(id: string, data: Partial<ProviderSku>): Promise<void> {
    const sku = await providerRepo.getProviderSkuById(id);
    if (!sku) throw new Error("Provider SKU not found");

    if (data.providerSku && data.providerSku !== sku.providerSku) {
      const existing = await providerRepo.getProviderSku(sku.providerId, data.providerSku);
      if (existing) throw new Error(`SKU '${data.providerSku}' already exists for this provider`);
    }

    await providerRepo.upsertProviderSku({
      ...sku,
      ...data,
      id,
      updatedAt: new Date().toISOString()
    } as any);
  }

  async listProviderSkus(providerId?: string): Promise<ProviderSku[]> {
    return providerRepo.listProviderSkus(providerId);
  }

  async deleteProviderSku(id: string): Promise<void> {
    await providerRepo.deleteProviderSku(id);
  }

  // ===================
  // PROVIDER MAPPING
  // ===================

  async createMapping(data: Partial<ProviderMapping>, userId: string): Promise<ProviderMapping> {
    // Validations
    if (!data.variantId) throw new Error("variantId is required");
    if (!data.providerId) throw new Error("providerId is required");
    if (!data.providerSkuId) throw new Error("providerSkuId is required");

    const [variant, provider, sku] = await Promise.all([
      catalogRepo.getVariant(data.variantId),
      providerRepo.getProvider(data.providerId),
      providerRepo.getProviderSkuById(data.providerSkuId)
    ]);

    if (!variant) throw new Error("Variant not found");
    if (!provider) throw new Error("Provider not found");
    if (!sku) throw new Error("Provider SKU not found");

    if (sku.providerId !== data.providerId) {
      throw new Error("Provider SKU does not belong to the specified Provider");
    }

    const mappingId = data.id || uuidv4();
    const mapping: ProviderMapping = {
      id: mappingId,
      productId: variant.productId || "",
      variantId: data.variantId,
      sku: variant.sku || "",
      providerId: data.providerId,
      providerSkuId: data.providerSkuId,
      providerSku: sku.providerSku,
      status: data.status || "UNMAPPED",
      priority: data.priority ?? 0,
      routingEligibility: data.routingEligibility ?? true,
      metadata: data.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
      ...data,
    };

    await providerRepo.upsertMapping(mapping as any);
    return mapping;
  }

  async updateMapping(id: string, data: Partial<ProviderMapping>, userId: string): Promise<void> {
    const mapping = await providerRepo.getMapping(id);
    if (!mapping) throw new Error("Mapping not found");

    let providerSku = data.providerSku || mapping.providerSku;
    if (data.providerSkuId && data.providerSkuId !== mapping.providerSkuId) {
      const sku = await providerRepo.getProviderSkuById(data.providerSkuId);
      if (sku) {
        providerSku = sku.providerSku;
      }
    } else if (!providerSku && (data.providerSkuId || mapping.providerSkuId)) {
      const sku = await providerRepo.getProviderSkuById(data.providerSkuId || mapping.providerSkuId);
      if (sku) {
        providerSku = sku.providerSku;
      }
    }

    await providerRepo.upsertMapping({
      ...mapping,
      ...data,
      providerSku,
      id,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    } as any);
  }

  async deleteMapping(id: string, userId: string): Promise<void> {
    const mapping = await providerRepo.getMapping(id);
    if (!mapping) throw new Error("Mapping not found");
    await providerRepo.deleteMapping(id);
  }

  // ===================
  // FULFILLMENT ENGINE
  // ===================

  async fulfillOrder(orderId: string, variantId: string, providerSku: string, customerData: Record<string, any>): Promise<any> {
    const registry = ProviderAdapterRegistry.getInstance();
    
    // 1. Get routing decision
    const routing = await this.getRoutingDecision(variantId);
    if (routing.code !== "SUCCESS") {
      throw new Error(`Cannot fulfill: ${routing.reason}`);
    }

    // 2. Resolve adapter by provider ID or provider code
    let adapter = registry.getAdapter(routing.selectedProviderId);
    if (!adapter) {
      const provider = await providerRepo.getProvider(routing.selectedProviderId);
      if (provider?.code) {
        adapter = registry.getAdapter(provider.code);
      }
    }
    if (!adapter) {
      throw new Error(`No adapter found for provider: ${routing.selectedProviderId}`);
    }

    // 3. Authoritative SKU validation from routing decision
    if (!routing.selectedProviderSku) {
      throw new Error(`Routing decision SUCCESS but missing selectedProviderSku for variant ${variantId}`);
    }
    const executionSku = routing.selectedProviderSku;

    const request: ProviderFulfillmentRequest = {
      orderId,
      providerSku: executionSku,
      customerData,
      idempotencyKey: `${orderId}-REQ`
    };

    // 4. Submit to provider
    return await adapter.submit(request);
  }

  async testApiGamesConnection(): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const registry = ProviderAdapterRegistry.getInstance();
    const adapter = registry.getAdapter("apigames");
    if (!adapter) throw new Error("ApiGames adapter not found");
    return await adapter.testConnection();
  }

  // ===================
  // ROUTING ENGINE
  // ===================

  async getRoutingDecision(variantId: string, context: any = {}): Promise<RoutingDecision> {
    if (variantId.startsWith("virtual-variant-")) {
      const skuId = variantId.replace("virtual-variant-", "");
      const sku = await providerRepo.getProviderSkuById(skuId);
      if (!sku) {
        return {
          productVariantId: variantId,
          selectedMappingId: "virtual",
          selectedProviderId: "",
          selectedProviderSkuId: skuId,
          selectedProviderSku: "",
          reason: "Virtual SKU not found",
          code: "FAILED",
          isFallback: false,
          attempt: 1,
          timestamp: new Date().toISOString()
        };
      }

      return {
        productVariantId: variantId,
        selectedMappingId: "virtual",
        selectedProviderId: sku.providerId,
        selectedProviderSkuId: sku.id!,
        selectedProviderSku: sku.providerSku,
        reason: "Virtual routing directly to provider SKU",
        code: "SUCCESS",
        isFallback: false,
        attempt: 1,
        timestamp: new Date().toISOString()
      };
    }
    return providerRepo.resolveRoutingDecision(variantId);
  }
}
