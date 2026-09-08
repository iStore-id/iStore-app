import { adminDb } from "./firebase-admin";
import { logCoreAudit } from "./core-service";
import { MembershipPlan, CustomerMembership, MembershipStatus, MembershipStats } from "../types/membership";

export class MembershipService {
  private static instance: MembershipService;

  private constructor() {}

  public static getInstance(): MembershipService {
    if (!MembershipService.instance) {
      MembershipService.instance = new MembershipService();
    }
    return MembershipService.instance;
  }

  // ============================================================================
  // PLAN MANAGEMENT
  // ============================================================================

  async getPlans(includeInactive = false): Promise<MembershipPlan[]> {
    let query: FirebaseFirestore.Query = adminDb.collection("membershipPlans");
    if (!includeInactive) {
      query = query.where("status", "==", "ACTIVE");
    }
    const snap = await query.orderBy("tierLevel", "asc").get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MembershipPlan));
  }

  async getPlanById(planId: string): Promise<MembershipPlan | null> {
    const doc = await adminDb.collection("membershipPlans").doc(planId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as MembershipPlan;
  }

  async createPlan(data: Omit<MembershipPlan, 'id' | 'createdAt' | 'updatedAt'>, actor: { uid: string; email: string }): Promise<MembershipPlan> {
    const ref = adminDb.collection("membershipPlans").doc();
    const now = new Date().toISOString();
    
    const plan: MembershipPlan = {
      id: ref.id,
      ...data,
      createdAt: now,
      updatedAt: now,
      updatedBy: actor.email
    };

    await ref.set(plan);
    await logCoreAudit(actor, "admin", "MEMBERSHIP_PLAN_CREATED", `membershipPlans/${ref.id}`, null, plan);
    return plan;
  }

  async updatePlan(planId: string, data: Partial<MembershipPlan>, actor: { uid: string; email: string }): Promise<MembershipPlan> {
    const ref = adminDb.collection("membershipPlans").doc(planId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Plan not found");
    
    const before = snap.data();
    const updates = {
      ...data,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.email
    };

    await ref.update(updates);
    const after = (await ref.get()).data();
    await logCoreAudit(actor, "admin", "MEMBERSHIP_PLAN_UPDATED", `membershipPlans/${planId}`, before, after);
    return { id: planId, ...after } as MembershipPlan;
  }

  // ============================================================================
  // CUSTOMER MEMBERSHIP LIFECYCLE
  // ============================================================================

  async getCustomerMembership(userId: string): Promise<CustomerMembership | null> {
    const doc = await adminDb.collection("customerMemberships").doc(userId).get();
    if (!doc.exists) return null;
    return doc.data() as CustomerMembership;
  }

  /**
   * Main activation logic (used by Order Engine or Manual Assign)
   */
  async activateMembership(
    userId: string, 
    planId: string, 
    source: 'PURCHASE' | 'MANUAL', 
    orderId?: string,
    reason?: string,
    actor?: { uid: string; email: string }
  ): Promise<CustomerMembership> {
    const plan = await this.getPlanById(planId);
    if (!plan) throw new Error("Membership plan not found");
    if (plan.status !== 'ACTIVE' && source === 'PURCHASE') throw new Error("Membership plan is currently inactive");

    return await adminDb.runTransaction(async (transaction) => {
      const memRef = adminDb.collection("customerMemberships").doc(userId);
      const memSnap = await transaction.get(memRef);
      const existing = memSnap.exists ? memSnap.data() as CustomerMembership : null;

      // Idempotency check for purchase
      if (source === 'PURCHASE' && orderId && existing?.orderId === orderId && existing.status === 'ACTIVE') {
        return existing;
      }

      const now = new Date();
      const startDate = now.toISOString();
      const expiryDate = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000).toISOString();

      const newMembership: CustomerMembership = {
        id: userId,
        userId,
        planId,
        status: 'ACTIVE',
        startDate,
        expiryDate,
        assignedAt: startDate,
        updatedAt: startDate,
        source,
        orderId,
        reason: reason || (source === 'PURCHASE' ? `Purchase order ${orderId}` : "Manual assignment"),
        metadata: {
          tierLevel: plan.tierLevel,
          planName: plan.name,
          pointMultiplier: plan.pointMultiplier,
          discountRate: plan.discountRate
        }
      };

      transaction.set(memRef, newMembership);

      // Audit Log
      const auditActor = actor || { uid: "SYSTEM", email: "system@istore.co.id" };
      const auditAction = existing ? "MEMBERSHIP_UPGRADED" : "MEMBERSHIP_ACTIVATED";
      
      const auditRef = adminDb.collection("auditLogs").doc();
      transaction.set(auditRef, {
        id: auditRef.id,
        actor: auditActor,
        role: "system",
        action: auditAction,
        target: `customerMemberships/${userId}`,
        before: existing,
        after: newMembership,
        reason: newMembership.reason,
        timestamp: startDate
      });

      return newMembership;
    });
  }

  async updateMembershipStatus(
    userId: string, 
    newStatus: MembershipStatus, 
    reason: string, 
    actor: { uid: string; email: string }
  ): Promise<void> {
    await adminDb.runTransaction(async (transaction) => {
      const ref = adminDb.collection("customerMemberships").doc(userId);
      const snap = await transaction.get(ref);
      if (!snap.exists) throw new Error("Membership record not found");

      const before = snap.data();
      const updates = {
        status: newStatus,
        reason: reason,
        updatedAt: new Date().toISOString()
      };

      transaction.update(ref, updates);

      const auditRef = adminDb.collection("auditLogs").doc();
      transaction.set(auditRef, {
        id: auditRef.id,
        actor,
        role: "admin",
        action: `MEMBERSHIP_${newStatus}`,
        target: `customerMemberships/${userId}`,
        before,
        after: { ...before, ...updates },
        reason,
        timestamp: updates.updatedAt
      });
    });
  }

  // ============================================================================
  // JOB RUNNER: EXPIRY CHECK
  // ============================================================================

  async runExpiryCheck(): Promise<{ expiredCount: number }> {
    const now = new Date().toISOString();
    // Simplified query to avoid composite index requirement for MVP
    const snap = await adminDb.collection("customerMemberships")
      .where("status", "==", "ACTIVE")
      .get();

    let expiredCount = 0;
    const batch = adminDb.batch();

    for (const doc of snap.docs) {
      const mem = doc.data() as CustomerMembership;
      
      // Filter in memory
      if (!mem.expiryDate || mem.expiryDate > now) continue;

      batch.update(doc.ref, {
        status: 'EXPIRED',
        updatedAt: now
      });

      const auditRef = adminDb.collection("auditLogs").doc();
      batch.set(auditRef, {
        id: auditRef.id,
        actor: { uid: "SYSTEM", email: "system@istore.co.id" },
        role: "system",
        action: "MEMBERSHIP_EXPIRED",
        target: `customerMemberships/${mem.userId}`,
        before: mem,
        after: { ...mem, status: 'EXPIRED', updatedAt: now },
        reason: "Automatic expiry by system",
        timestamp: now
      });

      expiredCount++;
    }

    if (expiredCount > 0) {
      await batch.commit();
    }

    return { expiredCount };
  }

  // ============================================================================
  // INTEGRATION FACTS
  // ============================================================================

  async getEffectiveBenefit(userId: string): Promise<{ pointMultiplier: number; discountRate: number; tierLevel: number } | null> {
    const mem = await this.getCustomerMembership(userId);
    if (!mem || mem.status !== 'ACTIVE') return null;

    // Check expiry again just in case (runtime protection)
    const now = new Date().toISOString();
    if (mem.expiryDate && mem.expiryDate <= now) return null;

    return {
      pointMultiplier: mem.metadata?.pointMultiplier || 1,
      discountRate: mem.metadata?.discountRate || 0,
      tierLevel: mem.metadata?.tierLevel || 0
    };
  }

  async getStats(): Promise<MembershipStats> {
    const snap = await adminDb.collection("customerMemberships").get();
    const stats: MembershipStats = {
      totalActive: 0,
      totalExpired: 0,
      totalSuspended: 0,
      distribution: {},
      expiringSoon: 0
    };

    const now = new Date();
    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    snap.forEach(doc => {
      const m = doc.data() as CustomerMembership;
      if (m.status === 'ACTIVE') {
        stats.totalActive++;
        if (m.expiryDate && m.expiryDate <= soon) {
          stats.expiringSoon++;
        }
        const planId = m.planId;
        stats.distribution[planId] = (stats.distribution[planId] || 0) + 1;
      } else if (m.status === 'EXPIRED') {
        stats.totalExpired++;
      } else if (m.status === 'SUSPENDED') {
        stats.totalSuspended++;
      }
    });

    return stats;
  }
}
