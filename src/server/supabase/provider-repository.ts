import { supabaseAdmin, isSupabaseAdminConfigured } from "../supabase-admin.js";
import { Provider, ProviderSku, ProviderMapping, RoutingDecision } from "../../types/core.js";
import { generateDeterministicProviderSkuUuid } from "./provider-sku-identity.js";
import { DynamicCatalogService } from "../dynamic-catalog-service.js";

export class SupabaseProviderRepository {
  private static instance: SupabaseProviderRepository;

  private constructor() {}

  public static getInstance(): SupabaseProviderRepository {
    if (!SupabaseProviderRepository.instance) {
      SupabaseProviderRepository.instance = new SupabaseProviderRepository();
    }
    return SupabaseProviderRepository.instance;
  }

  private ensureClient() {
    if (!supabaseAdmin || !isSupabaseAdminConfigured) {
      throw new Error("Supabase Admin is not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    }
    return supabaseAdmin;
  }

  // ==========================================
  // PROVIDERS
  // ==========================================

  async getProvider(id: string): Promise<Provider | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("providers")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Supabase getProvider error: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      code: data.code,
      name: data.name,
      description: data.description || "",
      status: data.status,
      priority: data.priority,
      capabilities: data.capabilities || [],
      health: {
        state: data.health_state || "unknown",
        lastCheckedAt: data.last_checked_at || undefined,
      },
      configMetadata: data.config_metadata || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async listProviders(): Promise<Provider[]> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("providers")
      .select("*")
      .order("priority", { ascending: false });

    if (error) throw new Error(`Supabase listProviders error: ${error.message}`);

    return (data || []).map((row: any) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description || "",
      status: row.status,
      priority: row.priority,
      capabilities: row.capabilities || [],
      health: {
        state: row.health_state || "unknown",
        lastCheckedAt: row.last_checked_at || undefined,
      },
      configMetadata: row.config_metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async upsertProvider(p: Partial<Provider> & { id: string; code: string; name: string }): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.from("providers").upsert({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description || null,
      status: p.status || "active",
      priority: p.priority ?? 1,
      capabilities: p.capabilities || [],
      health_state: p.health?.state || "healthy",
      last_checked_at: p.health?.lastCheckedAt || new Date().toISOString(),
      config_metadata: p.configMetadata || {},
      updated_at: new Date().toISOString(),
    });

    if (error) throw new Error(`Supabase upsertProvider error: ${error.message}`);
  }

  // ==========================================
  // PROVIDER SKUS
  // ==========================================

  async getProviderSku(providerId: string, providerSku: string): Promise<ProviderSku | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("provider_skus")
      .select("*")
      .eq("provider_id", providerId)
      .eq("provider_sku", providerSku)
      .maybeSingle();

    if (error) throw new Error(`Supabase getProviderSku error: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      providerId: data.provider_id,
      providerSku: data.provider_sku,
      name: data.name,
      type: data.type as any,
      status: data.status,
      metadata: data.metadata || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async getProviderSkuById(id: string): Promise<ProviderSku | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("provider_skus")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Supabase getProviderSkuById error: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      providerId: data.provider_id,
      providerSku: data.provider_sku,
      name: data.name,
      type: data.type as any,
      status: data.status,
      metadata: data.metadata || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async listProviderSkus(providerId?: string): Promise<ProviderSku[]> {
    const client = this.ensureClient();
    let query = client.from("provider_skus").select("*").order("created_at", { ascending: false });

    if (providerId) {
      query = query.eq("provider_id", providerId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Supabase listProviderSkus error: ${error.message}`);

    return (data || []).map((row: any) => ({
      id: row.id,
      providerId: row.provider_id,
      providerSku: row.provider_sku,
      name: row.name,
      type: row.type as any,
      status: row.status,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Deterministic upsert for Provider SKU.
   * Derives a stable UUID from (providerId, providerSku) to guarantee idempotency.
   */
  async upsertProviderSku(sku: {
    providerId: string;
    providerSku: string;
    name: string;
    type?: string;
    status?: string;
    metadata?: Record<string, any>;
  }): Promise<string> {
    const client = this.ensureClient();
    const deterministicUuid = generateDeterministicProviderSkuUuid(sku.providerId, sku.providerSku);

    const { error } = await client.from("provider_skus").upsert({
      id: deterministicUuid,
      provider_id: sku.providerId,
      provider_sku: sku.providerSku,
      name: sku.name,
      type: sku.type || "topup",
      status: sku.status || "active",
      metadata: sku.metadata || {},
      updated_at: new Date().toISOString(),
    });

    if (error) throw new Error(`Supabase upsertProviderSku error: ${error.message}`);
    DynamicCatalogService.getInstance().invalidateCache();
    return deterministicUuid;
  }

  // ==========================================
  // PROVIDER MAPPINGS
  // ==========================================

  async getMapping(id: string): Promise<ProviderMapping | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("provider_mappings")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Supabase getMapping error: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      productId: "",
      variantId: data.variant_id,
      sku: "",
      providerId: data.provider_id,
      providerSkuId: data.provider_sku_id,
      providerSku: data.provider_sku,
      status: data.status,
      priority: data.priority,
      routingEligibility: data.routing_eligibility,
      notes: data.notes || undefined,
      metadata: data.metadata || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      updatedBy: "system",
    };
  }

  async listMappingsByVariant(variantId: string): Promise<ProviderMapping[]> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("provider_mappings")
      .select("*")
      .eq("variant_id", variantId)
      .order("priority", { ascending: false });

    if (error) throw new Error(`Supabase listMappingsByVariant error: ${error.message}`);

    return (data || []).map((row: any) => ({
      id: row.id,
      productId: "",
      variantId: row.variant_id,
      sku: "",
      providerId: row.provider_id,
      providerSkuId: row.provider_sku_id,
      providerSku: row.provider_sku,
      status: row.status,
      priority: row.priority,
      routingEligibility: row.routing_eligibility,
      notes: row.notes || undefined,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      updatedBy: "system",
    }));
  }

  async listMappingsByProvider(providerId?: string, status?: string): Promise<ProviderMapping[]> {
    const client = this.ensureClient();
    let query = client
      .from("provider_mappings")
      .select("*");

    if (providerId && providerId !== "ALL") {
      query = query.eq("provider_id", providerId);
    }

    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw new Error(`Supabase listMappingsByProvider error: ${error.message}`);

    return (data || []).map((row: any) => ({
      id: row.id,
      productId: "",
      variantId: row.variant_id,
      sku: "",
      providerId: row.provider_id,
      providerSkuId: row.provider_sku_id,
      providerSku: row.provider_sku,
      status: row.status,
      priority: row.priority,
      routingEligibility: row.routing_eligibility,
      notes: row.notes || undefined,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      updatedBy: "system",
    }));
  }

  async getMappingBySkuAndStatus(skuId: string, status: string): Promise<ProviderMapping | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("provider_mappings")
      .select("*")
      .eq("provider_sku_id", skuId)
      .eq("status", status)
      .maybeSingle();

    if (error) throw new Error(`Supabase getMappingBySkuAndStatus error: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      productId: "",
      variantId: data.variant_id,
      sku: "",
      providerId: data.provider_id,
      providerSkuId: data.provider_sku_id,
      providerSku: data.provider_sku,
      status: data.status,
      priority: data.priority,
      routingEligibility: data.routing_eligibility,
      notes: data.notes || undefined,
      metadata: data.metadata || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      updatedBy: "system",
    };
  }

  /**
   * Upsert Provider Mapping with composite relational integrity verification.
   */
  async upsertMapping(mapping: {
    id?: string;
    variantId: string;
    providerId: string;
    providerSku: string;
    providerSkuId?: string;
    status?: 'UNMAPPED' | 'CANDIDATE' | 'NEEDS_REVIEW' | 'MAPPED' | 'APPROVED' | 'REJECTED';
    priority?: number;
    routingEligibility?: boolean;
    notes?: string;
    metadata?: Record<string, any>;
  }): Promise<string> {
    const client = this.ensureClient();

    // 1. Resolve providerSkuId deterministically if not provided
    const skuUuid = mapping.providerSkuId || generateDeterministicProviderSkuUuid(mapping.providerId, mapping.providerSku);

    // 2. Insert or update mapping adhering to composite foreign key (provider_sku_id, provider_id)
    const payload: any = {
      variant_id: mapping.variantId,
      provider_id: mapping.providerId,
      provider_sku_id: skuUuid,
      provider_sku: mapping.providerSku,
      status: mapping.status || "NEEDS_REVIEW",
      priority: mapping.priority ?? 1,
      routing_eligibility: mapping.routingEligibility ?? true,
      notes: mapping.notes || null,
      metadata: mapping.metadata || {},
      updated_at: new Date().toISOString(),
    };

    if (mapping.id) {
      payload.id = mapping.id;
    }

    const { data, error } = await client
      .from("provider_mappings")
      .upsert(payload)
      .select("id")
      .single();

    if (error) throw new Error(`Supabase upsertMapping error: ${error.message}`);
    return data.id;
  }

  async deleteProvider(id: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.from("providers").delete().eq("id", id);
    if (error) throw new Error(`Supabase deleteProvider error: ${error.message}`);
  }

  async deleteProviderSku(id: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.from("provider_skus").delete().eq("id", id);
    if (error) throw new Error(`Supabase deleteProviderSku error: ${error.message}`);
    DynamicCatalogService.getInstance().invalidateCache();
  }

  async deleteMapping(id: string): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client.from("provider_mappings").delete().eq("id", id);
    if (error) throw new Error(`Supabase deleteMapping error: ${error.message}`);
  }

  // ==========================================
  // DETERMINISTIC ROUTING RESOLVER
  // ==========================================

  /**
   * Resolves the highest-priority eligible provider mapping for a product variant.
   * Semantic rules:
   * 1. Mapping must be status = 'APPROVED'
   * 2. routing_eligibility = true
   * 3. Provider must be status = 'active' and health != 'maintenance'
   * 4. Highest mapping priority, then highest provider priority, then oldest created
   */
  async resolveRoutingDecision(variantId: string): Promise<RoutingDecision> {
    const client = this.ensureClient();
    const timestamp = new Date().toISOString();

    // 1. Fetch approved and eligible mappings
    const { data: mappings, error: mapError } = await client
      .from("provider_mappings")
      .select("*")
      .eq("variant_id", variantId)
      .eq("status", "APPROVED")
      .eq("routing_eligibility", true)
      .order("priority", { ascending: false });

    if (mapError) {
      throw new Error(`Routing error querying mappings: ${mapError.message}`);
    }

    if (!mappings || mappings.length === 0) {
      return {
        productVariantId: variantId,
        selectedMappingId: "",
        selectedProviderId: "",
        selectedProviderSkuId: "",
        selectedProviderSku: "",
        reason: "No APPROVED and eligible provider mappings found",
        code: "NO_MAPPING",
        isFallback: false,
        attempt: 1,
        timestamp,
      };
    }

    // 2. Fetch provider details
    const providerIds = Array.from(new Set(mappings.map(m => m.provider_id)));
    const { data: providers, error: provError } = await client
      .from("providers")
      .select("*")
      .in("id", providerIds);

    if (provError) {
      throw new Error(`Routing error querying providers: ${provError.message}`);
    }

    const providerMap = new Map<string, any>((providers || []).map(p => [p.id, p]));

    // 3. Filter eligible providers
    const eligibleMappings = mappings.filter(m => {
      const p = providerMap.get(m.provider_id);
      if (!p) return false;
      if (p.status !== "active") return false;
      if (p.health_state === "maintenance") return false;
      return true;
    });

    if (eligibleMappings.length === 0) {
      return {
        productVariantId: variantId,
        selectedMappingId: "",
        selectedProviderId: "",
        selectedProviderSkuId: "",
        selectedProviderSku: "",
        reason: "All providers for this variant are inactive or in maintenance",
        code: "PROVIDER_INACTIVE",
        isFallback: false,
        attempt: 1,
        timestamp,
      };
    }

    // 4. Sort: mapping priority DESC -> provider priority DESC -> created_at ASC
    eligibleMappings.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const provA = providerMap.get(a.provider_id);
      const provB = providerMap.get(b.provider_id);
      const prioA = provA?.priority ?? 0;
      const prioB = provB?.priority ?? 0;
      if (prioB !== prioA) return prioB - prioA;
      return String(a.created_at).localeCompare(String(b.created_at));
    });

    const chosen = eligibleMappings[0];
    const prov = providerMap.get(chosen.provider_id);

    return {
      productVariantId: variantId,
      selectedMappingId: chosen.id,
      selectedProviderId: chosen.provider_id,
      selectedProviderSkuId: chosen.provider_sku_id,
      selectedProviderSku: chosen.provider_sku,
      reason: `Routing success via Supabase mapping ${chosen.id} (Provider: ${prov?.code || chosen.provider_id})`,
      code: "SUCCESS",
      isFallback: false,
      attempt: 1,
      timestamp,
    };
  }
}
