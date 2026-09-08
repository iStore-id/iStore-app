import { adminDb } from "./firebase-admin";
import { ProviderMapping } from "../types/core";

export type MappingStatus = 'UNMAPPED' | 'CANDIDATE' | 'NEEDS_REVIEW' | 'MAPPED' | 'APPROVED' | 'REJECTED';

export class ProviderMappingService {
  private static instance: ProviderMappingService;

  private constructor() {}

  private async logAudit(uid: string, email: string, action: string, resourceId: string, before: any, after: any, reason: string) {
    await adminDb.collection("auditLogs").add({
      actor: { uid, email },
      action,
      resource: "providerMappings",
      resourceId,
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
    const doc = await adminDb.collection("providerMappings").doc(id).get();
    return doc.exists ? ({ id: doc.id, ...doc.data() } as ProviderMapping) : null;
  }

  async createMapping(data: Omit<ProviderMapping, 'id' | 'createdAt' | 'updatedAt'>, actor: { uid: string, email: string }): Promise<string> {
    // Uniqueness constraint: One APPROVED mapping per provider SKU
    if (data.status === 'APPROVED') {
        const existing = await adminDb.collection("providerMappings")
            .where("providerSkuId", "==", data.providerSkuId)
            .where("status", "==", "APPROVED")
            .get();
        if (!existing.empty) throw new Error("An APPROVED mapping already exists for this provider SKU.");
    }

    const ref = adminDb.collection("providerMappings").doc();
    const now = new Date().toISOString();
    const mapping = {
      ...data,
      createdAt: now,
      updatedAt: now,
      updatedBy: actor.email
    };

    await ref.set(mapping);
    await this.logAudit(actor.uid, actor.email, "CREATE_MAPPING", ref.id, {}, mapping, "Provider mapping created");
    
    return ref.id;
  }

  async approveMapping(id: string, actor: { uid: string, email: string }): Promise<void> {
    const ref = adminDb.collection("providerMappings").doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new Error("Mapping not found");
    
    const data = doc.data() as ProviderMapping;
    
    // Check uniqueness constraint before approval
    const existingApproved = await adminDb.collection("providerMappings")
        .where("providerSkuId", "==", data.providerSkuId)
        .where("status", "==", "APPROVED")
        .get();
    if (!existingApproved.empty && existingApproved.docs[0].id !== id) {
        throw new Error("An APPROVED mapping already exists for this provider SKU.");
    }

    const now = new Date().toISOString();
    await ref.update({ status: 'APPROVED', updatedAt: now, updatedBy: actor.email });
    await this.logAudit(actor.uid, actor.email, "APPROVE_MAPPING", id, data, { ...data, status: 'APPROVED' }, "Provider mapping approved");
  }

  async listMappings(providerId: string, status: MappingStatus | 'ALL', page: number = 1, pageSize: number = 20, lastDoc?: any): Promise<{ data: ProviderMapping[], lastDoc: any }> {
    let query = adminDb.collection("providerMappings").where("providerId", "==", providerId);
    if (status !== 'ALL') {
        query = query.where("status", "==", status);
    }
    
    query = query.orderBy("createdAt", "desc").limit(pageSize);
    if (lastDoc) {
        query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProviderMapping));
    return { data, lastDoc: snap.docs[snap.docs.length - 1] };
  }

  async mapSku(skuId: string, variantId: string, actor: { uid: string, email: string }): Promise<string> {
    const skuDoc = await adminDb.collection("providerSkus").doc(skuId).get();
    const skuData = skuDoc.data() as any; // ProviderSku
    
    const variantDoc = await adminDb.collection("productVariants").doc(variantId).get();
    const variantData = variantDoc.data();
    
    const ref = adminDb.collection("providerMappings").doc();
    const now = new Date().toISOString();
    const mapping: ProviderMapping = {
      productId: variantData!.productId,
      variantId: variantId,
      sku: variantData!.sku,
      providerId: skuData.providerId,
      providerSkuId: skuId,
      providerSku: skuData.providerSku,
      status: 'MAPPED',
      priority: 1,
      routingEligibility: false,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      updatedBy: actor.email
    };
    
    await ref.set(mapping);
    await this.logAudit(actor.uid, actor.email, "CREATE_MAPPING", ref.id, {}, mapping, "Provider mapping created");
    return ref.id;
  }

  async rejectMapping(id: string, actor: { uid: string, email: string }): Promise<void> {
    const ref = adminDb.collection("providerMappings").doc(id);
    const doc = await ref.get();
    const data = doc.data() as ProviderMapping;
    await ref.update({ status: 'REJECTED', updatedAt: new Date().toISOString(), updatedBy: actor.email });
    await this.logAudit(actor.uid, actor.email, "REJECT_MAPPING", id, data, { ...data, status: 'REJECTED' }, "Provider mapping rejected");
  }

  async unmap(id: string, actor: { uid: string, email: string }): Promise<void> {
    const ref = adminDb.collection("providerMappings").doc(id);
    const doc = await ref.get();
    const data = doc.data() as ProviderMapping;
    await ref.delete();
    await this.logAudit(actor.uid, actor.email, "UNMAP_MAPPING", id, data, {}, "Provider mapping deleted");
  }
}

