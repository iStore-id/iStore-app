import { adminDb } from "./firebase-admin";
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

// Register adapters
const registry = ProviderAdapterRegistry.getInstance();
registry.registerAdapter(new ApiGamesAdapter());

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
    const providersRef = adminDb.collection("providers");
    
    if (data.code) {
      const existing = await providersRef.where("code", "==", data.code).limit(1).get();
      if (!existing.empty) throw new Error(`Provider with code '${data.code}' already exists`);
    }

    const docRef = providersRef.doc();
    const provider: Provider = {
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
      id: docRef.id
    };

    await docRef.set(provider);
    return provider;
  }

  async updateProvider(id: string, data: Partial<Provider>): Promise<void> {
    const docRef = adminDb.collection("providers").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error("Provider not found");

    await docRef.update({
      ...data,
      updatedAt: new Date().toISOString()
    });
  }

  // ===================
  // PROVIDER SKU
  // ===================

  async createProviderSku(data: Partial<ProviderSku>): Promise<ProviderSku> {
    const skusRef = adminDb.collection("providerSkus");
    
    // Validate provider existence
    if (!data.providerId) throw new Error("providerId is required");
    const providerSnap = await adminDb.collection("providers").doc(data.providerId).get();
    if (!providerSnap.exists) throw new Error("Provider not found");

    // SKU uniqueness within provider
    if (data.providerSku) {
      const existing = await skusRef
        .where("providerId", "==", data.providerId)
        .where("providerSku", "==", data.providerSku)
        .limit(1)
        .get();
      if (!existing.empty) throw new Error(`SKU '${data.providerSku}' already exists for this provider`);
    }

    const docRef = skusRef.doc();
    const sku: ProviderSku = {
      providerId: data.providerId,
      providerSku: data.providerSku || "",
      name: data.name || "",
      type: data.type || "other",
      status: data.status || "inactive",
      metadata: data.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
      id: docRef.id
    };

    await docRef.set(sku);
    return sku;
  }

  async updateProviderSku(id: string, data: Partial<ProviderSku>): Promise<void> {
    const docRef = adminDb.collection("providerSkus").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error("Provider SKU not found");

    if (data.providerSku && data.providerSku !== snap.data()?.providerSku) {
      const skusRef = adminDb.collection("providerSkus");
      const existing = await skusRef
        .where("providerId", "==", snap.data()?.providerId)
        .where("providerSku", "==", data.providerSku)
        .limit(1)
        .get();
      if (!existing.empty) throw new Error(`SKU '${data.providerSku}' already exists for this provider`);
    }

    await docRef.update({
      ...data,
      updatedAt: new Date().toISOString()
    });
  }

  // ===================
  // PROVIDER MAPPING
  // ===================

  async createMapping(data: Partial<ProviderMapping>, userId: string): Promise<ProviderMapping> {
    const mappingsRef = adminDb.collection("providerMappings");
    
    // Validations
    if (!data.variantId) throw new Error("variantId is required");
    if (!data.providerId) throw new Error("providerId is required");
    if (!data.providerSkuId) throw new Error("providerSkuId is required");

    const [variantSnap, providerSnap, skuSnap] = await Promise.all([
      adminDb.collection("productVariants").doc(data.variantId).get(),
      adminDb.collection("providers").doc(data.providerId).get(),
      adminDb.collection("providerSkus").doc(data.providerSkuId).get()
    ]);

    if (!variantSnap.exists) throw new Error("Variant not found");
    if (!providerSnap.exists) throw new Error("Provider not found");
    if (!skuSnap.exists) throw new Error("Provider SKU not found");

    const skuData = skuSnap.data() as ProviderSku;
    if (skuData.providerId !== data.providerId) {
      throw new Error("Provider SKU does not belong to the specified Provider");
    }

    const docRef = mappingsRef.doc();
    const mapping: ProviderMapping = {
      productId: variantSnap.data()?.productId || "",
      variantId: data.variantId,
      sku: variantSnap.data()?.sku || "",
      providerId: data.providerId,
      providerSkuId: data.providerSkuId,
      providerSku: skuData.providerSku,
      status: data.status || "UNMAPPED",
      priority: data.priority ?? 0,
      routingEligibility: data.routingEligibility ?? true,
      metadata: data.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
      ...data,
      id: docRef.id
    };

    await docRef.set(mapping);
    return mapping;
  }

  async updateMapping(id: string, data: Partial<ProviderMapping>, userId: string): Promise<void> {
    const docRef = adminDb.collection("providerMappings").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error("Mapping not found");

    await docRef.update({
      ...data,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    });
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

    // 2. Resolve adapter
    const adapter = registry.getAdapter(routing.selectedProviderId);
    if (!adapter) {
      throw new Error(`No adapter found for provider: ${routing.selectedProviderId}`);
    }

    // 3. Prepare request with idempotency key
    const request: ProviderFulfillmentRequest = {
      orderId,
      providerSku,
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
    const timestamp = new Date().toISOString();
    
    // 1. Fetch eligible mappings (active & eligible)
    const mappingsSnap = await adminDb.collection("providerMappings")
      .where("variantId", "==", variantId)
      .where("status", "==", "APPROVED")
      .where("routingEligibility", "==", true)
      .get();

    if (mappingsSnap.empty) {
      return {
        productVariantId: variantId,
        selectedMappingId: "",
        selectedProviderId: "",
        selectedProviderSkuId: "",
        selectedProviderSku: "",
        reason: "No active mappings found for this variant",
        code: "NO_MAPPING",
        isFallback: false,
        attempt: 1,
        timestamp
      };
    }

    const allMappings = mappingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProviderMapping));

    // 2. Fetch providers to check status and health
    const providerIds = [...new Set(allMappings.map(m => m.providerId))];
    const providersSnap = await Promise.all(
      providerIds.map(id => adminDb.collection("providers").doc(id).get())
    );

    const providerMap = new Map<string, Provider>();
    providersSnap.forEach(snap => {
      if (snap.exists) {
        providerMap.set(snap.id, { id: snap.id, ...snap.data() } as Provider);
      }
    });

    // 3. Filter mappings by provider status
    const eligibleMappings = allMappings.filter(m => {
      const provider = providerMap.get(m.providerId);
      if (!provider) return false;
      
      // Provider must be active
      if (provider.status !== "active") return false;
      
      // If maintenance exclusion is on, check health
      if (provider.health.state === "maintenance") return false;

      return true;
    });

    if (eligibleMappings.length === 0) {
      return {
        productVariantId: variantId,
        selectedMappingId: "",
        selectedProviderId: "",
        selectedProviderSkuId: "",
        selectedProviderSku: "",
        reason: "All eligible providers are inactive or in maintenance",
        code: "PROVIDER_INACTIVE",
        isFallback: false,
        attempt: 1,
        timestamp
      };
    }

    // 4. Sort by priority (Mapping Priority > Provider Priority)
    // Deterministic Sort
    const sortedMappings = eligibleMappings.sort((a, b) => {
      // 1. Higher mapping priority first
      if (b.priority !== a.priority) return b.priority - a.priority;
      
      // 2. Higher provider priority first
      const provA = providerMap.get(a.providerId)!;
      const provB = providerMap.get(b.providerId)!;
      if (provB.priority !== provA.priority) return provB.priority - provA.priority;
      
      // 3. Tie-breaker: creation date (older first) or ID
      return a.createdAt.localeCompare(b.createdAt) || (a.id || "").localeCompare(b.id || "");
    });

    const selectedMapping = sortedMappings[0];
    const selectedProvider = providerMap.get(selectedMapping.providerId)!;

    return {
      productVariantId: variantId,
      selectedMappingId: selectedMapping.id!,
      selectedProviderId: selectedMapping.providerId,
      selectedProviderSkuId: selectedMapping.providerSkuId,
      selectedProviderSku: selectedMapping.providerSku,
      reason: `Routing success via mapping ${selectedMapping.id} (Provider: ${selectedProvider.code})`,
      code: "SUCCESS",
      isFallback: false,
      attempt: 1,
      timestamp
    };
  }
}
