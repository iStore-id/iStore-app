import { ProviderMapping, ProviderSku } from "../types/core.js";
import { SupabaseProviderRepository } from "./supabase/provider-repository.js";
import { SupabaseCatalogRepository } from "./supabase/catalog-repository.js";
import { AuditLogRepository } from "./supabase/audit-log-repository.js";
import { PricingService } from "./pricing-service.js";
import { v4 as uuidv4 } from "uuid";

export type MappingStatus = 'UNMAPPED' | 'CANDIDATE' | 'NEEDS_REVIEW' | 'MAPPED' | 'APPROVED' | 'REJECTED';

const providerRepo = SupabaseProviderRepository.getInstance();
const catalogRepo = SupabaseCatalogRepository.getInstance();

export class ProviderMappingService {
  private static instance: ProviderMappingService;

  private constructor() {}

  private async logAudit(uid: string, email: string, action: string, resourceId: string, before: any, after: any, reason: string) {
    await AuditLogRepository.getInstance().createLog({
      actor: { uid, email },
      role: "admin",
      action,
      target: `providerMappings/${resourceId}`,
      before,
      after,
      reason,
      timestamp: new Date().toISOString()
    });
  }

  public static getInstance(): ProviderMappingService {
    if (!ProviderMappingService.instance) {
      ProviderMappingService.instance = new ProviderMappingService();
    }
    return ProviderMappingService.instance;
  }

  async getMapping(id: string): Promise<ProviderMapping | null> {
    return providerRepo.getMapping(id);
  }

  async createMapping(data: Omit<ProviderMapping, 'id' | 'createdAt' | 'updatedAt'>, actor: { uid: string, email: string }): Promise<string> {
    // Uniqueness constraint: One APPROVED mapping per provider SKU
    if (data.status === 'APPROVED') {
        const existing = await providerRepo.getMappingBySkuAndStatus(data.providerSkuId, 'APPROVED');
        if (existing) throw new Error("An APPROVED mapping already exists for this provider SKU.");
    }

    const mappingId = uuidv4();
    const now = new Date().toISOString();
    const mapping: ProviderMapping = {
      ...data,
      id: mappingId,
      createdAt: now,
      updatedAt: now,
      updatedBy: actor.email
    };

    await providerRepo.upsertMapping(mapping as any);
    await this.logAudit(actor.uid, actor.email, "CREATE_MAPPING", mappingId, {}, mapping, "Provider mapping created");
    
    if (data.status === 'APPROVED') {
      await this.syncVariantCost(data.variantId, actor);
    }

    return mappingId;
  }

  async approveMapping(id: string, actor: { uid: string, email: string }): Promise<void> {
    const mapping = await providerRepo.getMapping(id);
    if (!mapping) throw new Error("Mapping not found");
    
    // Check uniqueness constraint before approval
    const existingApproved = await providerRepo.getMappingBySkuAndStatus(mapping.providerSkuId, 'APPROVED');
    if (existingApproved && existingApproved.id !== id) {
        throw new Error("An APPROVED mapping already exists for this provider SKU.");
    }

    const now = new Date().toISOString();
    const updatedMapping = { ...mapping, status: 'APPROVED' as const, routingEligibility: true, updatedAt: now, updatedBy: actor.email };
    await providerRepo.upsertMapping(updatedMapping as any);
    await this.logAudit(actor.uid, actor.email, "APPROVE_MAPPING", id, mapping, updatedMapping, "Provider mapping approved");

    // Sync Cost to Variant
    await this.syncVariantCost(mapping.variantId, actor);
  }

  /**
   * Propagates baseCost from the best available provider SKU to the product variant.
   */
  async syncVariantCost(variantId: string, actor: { uid: string, email: string }): Promise<{ success: boolean, reason?: string, baseCost?: number }> {
    try {
      const decision = await providerRepo.resolveRoutingDecision(variantId);
      if (decision.code !== 'SUCCESS' || !decision.selectedProviderSkuId) {
        return { success: false, reason: decision.reason || "No routing decision" };
      }

      const sku = await providerRepo.getProviderSkuById(decision.selectedProviderSkuId);
      if (!sku) return { success: false, reason: "Provider SKU not found" };

      // Extract baseCost from metadata
      let baseCost = 0;
      if (sku.metadata?.baseCost !== undefined) {
        baseCost = Number(sku.metadata.baseCost);
      }
      
      if (baseCost === 0 && sku.metadata?.originalData?.baseCost !== undefined) {
        baseCost = Number(sku.metadata.originalData.baseCost);
      }

      if (baseCost > 0) {
        const variant = await catalogRepo.getVariant(variantId);
        if (variant) {
          // Update base_cost in the variant
          const updatedPricing = {
            ...(variant.pricing || {}),
            baseCost: baseCost,
            lastCostUpdate: new Date().toISOString()
          };

          await catalogRepo.upsertVariant({
            ...variant,
            pricing: updatedPricing as any,
            updatedAt: new Date().toISOString(),
            updatedBy: actor.email
          } as any);

          // Trigger Pricing Refresh (Calculate selling price based on rules)
          await PricingService.getInstance().refreshVariantPrice(variantId, actor);
          return { success: true, baseCost };
        }
        return { success: false, reason: "Variant not found" };
      }
      return { success: false, reason: "No valid baseCost in provider SKU metadata" };
    } catch (error: any) {
      console.error(`[syncVariantCost] Failed for variant ${variantId}:`, error);
      return { success: false, reason: error.message };
    }
  }

  /**
   * Systematic backfill for all existing APPROVED mappings.
   */
  async backfillApprovedMappingsCost(actor: { uid: string, email: string }): Promise<any> {
    const mappings = await providerRepo.listMappingsByProvider("ALL", "APPROVED");
    const variantIds = Array.from(new Set(mappings.map(m => m.variantId)));
    
    const results = {
      totalVariants: variantIds.length,
      totalApprovedMappings: mappings.length,
      processed: 0,
      propagated: 0,
      unresolved: 0,
      errors: 0,
      details: [] as any[]
    };

    for (const variantId of variantIds) {
      results.processed++;
      const res = await this.syncVariantCost(variantId, actor);
      if (res.success) {
        results.propagated++;
      } else {
        if (res.reason === "No valid baseCost in provider SKU metadata") {
          results.unresolved++;
        } else {
          results.errors++;
        }
      }
      results.details.push({ variantId, ...res });
    }

    return results;
  }

  async listMappings(providerId: string, status: MappingStatus | 'ALL', page: number = 1, pageSize: number = 20, lastDoc?: any): Promise<{ data: ProviderMapping[], lastDoc: any }> {
    const data = await providerRepo.listMappingsByProvider(providerId, status);
    // Simple pagination for now (Supabase query doesn't use lastDoc)
    return { data, lastDoc: null };
  }

  async mapSku(skuId: string, variantId: string, actor: { uid: string, email: string }): Promise<string> {
    const sku = await providerRepo.getProviderSkuById(skuId);
    if (!sku) throw new Error("Provider SKU not found");
    
    const variant = await catalogRepo.getVariant(variantId);
    if (!variant) throw new Error("Variant not found");
    
    const mappingId = uuidv4();
    const now = new Date().toISOString();
    const mapping: ProviderMapping = {
      id: mappingId,
      productId: variant.productId,
      variantId: variantId,
      sku: variant.sku,
      providerId: sku.providerId,
      providerSkuId: skuId,
      providerSku: sku.providerSku,
      status: 'MAPPED',
      priority: 1,
      routingEligibility: false,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      updatedBy: actor.email
    };
    
    await providerRepo.upsertMapping(mapping as any);
    await this.logAudit(actor.uid, actor.email, "CREATE_MAPPING", mappingId, {}, mapping, "Provider mapping created");
    return mappingId;
  }

  async rejectMapping(id: string, actor: { uid: string, email: string }): Promise<void> {
    const mapping = await providerRepo.getMapping(id);
    if (!mapping) throw new Error("Mapping not found");
    
    const now = new Date().toISOString();
    const updatedMapping = { ...mapping, status: 'REJECTED' as const, updatedAt: now, updatedBy: actor.email };
    await providerRepo.upsertMapping(updatedMapping as any);
    await this.logAudit(actor.uid, actor.email, "REJECT_MAPPING", id, mapping, updatedMapping, "Provider mapping rejected");
  }

  async unmap(id: string, actor: { uid: string, email: string }): Promise<void> {
    const mapping = await providerRepo.getMapping(id);
    if (!mapping) throw new Error("Mapping not found");
    
    await providerRepo.deleteMapping(id);
    await this.logAudit(actor.uid, actor.email, "UNMAP_MAPPING", id, mapping, {}, "Provider mapping deleted");
  }
}

