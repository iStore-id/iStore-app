import { supabaseAdmin, isSupabaseAdminConfigured } from "./supabase-admin.js";
import { SystemConfigRepository } from "./supabase/system-config-repository.js";
import { SLAPolicy, SLAStatus, SLAMeasurement, SLAResource, OrderSLA, Job } from "../types/core.js";
import { BusinessCalendarService } from "./business-calendar-service.js";

const SLA_POLICIES_KEY = "sla_policies";

export class SLAService {
  private static instance: SLAService;
  private calendarService = BusinessCalendarService.getInstance();

  private constructor() {}

  static getInstance(): SLAService {
    if (!SLAService.instance) {
      SLAService.instance = new SLAService();
    }
    return SLAService.instance;
  }

  async getPolicies(): Promise<SLAPolicy[]> {
    const raw = await SystemConfigRepository.getInstance().getConfig(SLA_POLICIES_KEY);
    const list: SLAPolicy[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.policies) ? raw.policies : []);
    return list.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  async getPolicyById(id: string): Promise<SLAPolicy | null> {
    const policies = await this.getPolicies();
    return policies.find(p => p.id === id) || null;
  }

  async createPolicy(policy: Partial<SLAPolicy>, actorUid: string): Promise<SLAPolicy> {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      throw new Error("Supabase Admin client is not configured.");
    }
    const now = new Date().toISOString();
    const id = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `sla_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const policyData: SLAPolicy = {
      id,
      name: policy.name || "Unnamed Policy",
      resource: policy.resource || "ORDER_TOTAL",
      targetDuration: policy.targetDuration || 300,
      warningThreshold: policy.warningThreshold || 240,
      criticalThreshold: policy.criticalThreshold || 600,
      enabled: policy.enabled ?? true,
      priority: policy.priority || 0,
      scope: policy.scope || {},
      createdAt: now,
      updatedAt: now,
      createdBy: actorUid,
      updatedBy: actorUid,
      ...(policy.useBusinessHours !== undefined ? { useBusinessHours: policy.useBusinessHours } : {})
    };

    const currentPolicies = await this.getPolicies();
    const updatedPolicies = [...currentPolicies, policyData];

    try {
      await SystemConfigRepository.getInstance().upsertConfig(SLA_POLICIES_KEY, updatedPolicies);
    } catch (error: any) {
      throw new Error(`Failed to save SLA policy to SystemConfigRepository: ${error.message}`);
    }

    return policyData;
  }

  async updatePolicy(id: string, policy: Partial<SLAPolicy>, actorUid: string): Promise<void> {
    const now = new Date().toISOString();
    const currentPolicies = await this.getPolicies();
    const index = currentPolicies.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error(`SLA Policy ${id} not found.`);
    }

    currentPolicies[index] = {
      ...currentPolicies[index],
      ...policy,
      id,
      updatedAt: now,
      updatedBy: actorUid
    };

    try {
      await SystemConfigRepository.getInstance().upsertConfig(SLA_POLICIES_KEY, currentPolicies);
    } catch (error: any) {
      throw new Error(`Failed to update SLA policy in SystemConfigRepository: ${error.message}`);
    }
  }

  async deletePolicy(id: string): Promise<void> {
    const now = new Date().toISOString();
    const currentPolicies = await this.getPolicies();
    const filtered = currentPolicies.filter(p => p.id !== id);

    try {
      await SystemConfigRepository.getInstance().upsertConfig(SLA_POLICIES_KEY, filtered);
    } catch (error: any) {
      throw new Error(`Failed to delete SLA policy from SystemConfigRepository: ${error.message}`);
    }
  }

  /**
   * Calculates SLA status for an order based on available policies and its lifecycle data.
   * This is deterministic and doesn't rely on timers.
   */
  async calculateSLA(order: any, jobs: Job[], policies: SLAPolicy[]): Promise<OrderSLA> {
    const measurements: Partial<Record<SLAResource, SLAMeasurement>> = {};
    const now = new Date();

    const resources: SLAResource[] = ['PAYMENT', 'FULFILLMENT', 'PROVIDER', 'ORDER_TOTAL'];

    for (const resource of resources) {
      const policy = this.findMatchingPolicy(order, resource, policies);
      measurements[resource] = await this.measureSegment(order, jobs, resource, policy);
    }

    // Determine overall status (most critical status)
    const statuses = Object.values(measurements).map(m => m!.status);
    let overallStatus: SLAStatus = 'NOT_STARTED';
    
    if (statuses.includes('BREACHED')) overallStatus = 'BREACHED';
    else if (statuses.includes('WARNING')) overallStatus = 'WARNING';
    else if (statuses.includes('RUNNING')) overallStatus = 'RUNNING';
    else if (statuses.includes('COMPLETED')) overallStatus = 'COMPLETED';
    else if (statuses.includes('EXCLUDED')) overallStatus = 'EXCLUDED';

    return {
      orderId: order.id,
      measurements: measurements as Record<SLAResource, SLAMeasurement>,
      overallStatus,
      updatedAt: now.toISOString()
    };
  }

  async calculateSupportSLA(supportCase: any, policies: SLAPolicy[]): Promise<any> {
    const measurements: Partial<Record<SLAResource, SLAMeasurement>> = {};
    const now = new Date();

    const resources: SLAResource[] = ['SUPPORT_FIRST_RESPONSE', 'SUPPORT_RESOLUTION'];

    for (const resource of resources) {
      const policy = this.findMatchingPolicyForSupport(supportCase, resource, policies);
      measurements[resource] = await this.measureSegment(supportCase, [], resource, policy);
    }

    const statuses = Object.values(measurements).map(m => m!.status);
    let overallStatus: SLAStatus = 'NOT_STARTED';
    
    if (statuses.includes('BREACHED')) overallStatus = 'BREACHED';
    else if (statuses.includes('WARNING')) overallStatus = 'WARNING';
    else if (statuses.includes('RUNNING')) overallStatus = 'RUNNING';
    else if (statuses.includes('COMPLETED')) overallStatus = 'COMPLETED';
    else if (statuses.includes('EXCLUDED')) overallStatus = 'EXCLUDED';

    return {
      caseId: supportCase.id,
      measurements,
      overallStatus,
      updatedAt: now.toISOString()
    };
  }

  private findMatchingPolicyForSupport(supportCase: any, resource: SLAResource, policies: SLAPolicy[]): SLAPolicy | undefined {
    return policies.find(p => {
      if (!p.enabled || p.resource !== resource) return false;
      return true;
    });
  }

  private findMatchingPolicy(order: any, resource: SLAResource, policies: SLAPolicy[]): SLAPolicy | undefined {
    return policies.find(p => {
      if (!p.enabled || p.resource !== resource) return false;
      
      // Check scope
      if (p.scope) {
        if (p.scope.providerIds?.length && !p.scope.providerIds.includes(order.providerId)) return false;
        if (p.scope.gameIds?.length && !p.scope.gameIds.includes(order.gameId)) return false;
        if (p.scope.productIds?.length && !p.scope.productIds.includes(order.productId)) return false;
      }
      
      return true;
    });
  }

  private async measureSegment(order: any, jobs: Job[], resource: SLAResource, policy?: SLAPolicy): Promise<SLAMeasurement> {
    const now = new Date();
    const defaultMeasurement = (status: SLAStatus = 'EXCLUDED'): SLAMeasurement => ({
      policyId: policy?.id || 'default',
      policyName: policy?.name || 'No Policy',
      resource,
      status: policy ? status : 'EXCLUDED',
      elapsedTime: 0,
      targetTime: policy?.targetDuration || 0,
      warningTime: policy?.warningThreshold || 0,
      criticalTime: policy?.criticalThreshold || 0,
      breachDuration: 0,
      startedAt: null,
      completedAt: null
    });

    if (!policy) return defaultMeasurement();

    let startedAt: string | null = null;
    let completedAt: string | null = null;

    // FULFILLMENT job is the best source of timing for fulfillment/provider segments
    const fulfillmentJob = jobs.find(j => j.type === 'FULFILLMENT' && j.referenceId === order.id);

    switch (resource) {
      case 'PAYMENT':
        startedAt = order.createdAt;
        if (order.paymentStatus === 'paid' || order.paymentStatus === 'success') {
          completedAt = fulfillmentJob?.createdAt || order.updatedAt;
        } else if (order.paymentStatus === 'expired' || order.paymentStatus === 'failed') {
          completedAt = order.updatedAt;
        }
        break;

      case 'FULFILLMENT':
        // Start when PAID (FULFILLMENT job enqueued)
        if (order.paymentStatus === 'paid' || order.paymentStatus === 'success') {
          startedAt = fulfillmentJob?.createdAt || order.updatedAt;
          if (order.transactionStatus === 'processing' || order.transactionStatus === 'success' || order.transactionStatus === 'failed') {
            completedAt = fulfillmentJob?.startedAt || order.updatedAt;
          }
        }
        break;

      case 'PROVIDER':
        // Start when processing (Worker claimed job)
        if (order.transactionStatus === 'processing' || order.transactionStatus === 'success' || order.transactionStatus === 'failed') {
          startedAt = fulfillmentJob?.startedAt || order.updatedAt;
          if (order.transactionStatus === 'success' || order.transactionStatus === 'failed') {
            completedAt = fulfillmentJob?.completedAt || order.updatedAt;
          }
        }
        break;

      case 'ORDER_TOTAL':
        startedAt = order.createdAt;
        if (['success', 'failed', 'expired'].includes(order.transactionStatus) || ['success', 'failed', 'expired'].includes(order.paymentStatus)) {
          completedAt = order.updatedAt;
        }
        break;
      
      case 'SUPPORT_FIRST_RESPONSE':
        startedAt = order.createdAt; // For support cases, order is actually the support case object
        completedAt = order.firstResponseAt || null;
        break;
      
      case 'SUPPORT_RESOLUTION':
        startedAt = order.createdAt;
        completedAt = order.resolvedAt || order.closedAt || null;
        break;
    }

    if (!startedAt) return defaultMeasurement('NOT_STARTED');

    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : now;
    
    let elapsed = 0;
    if (policy.useBusinessHours) {
        elapsed = await this.calendarService.calculateBusinessDuration(start, end);
    } else {
        elapsed = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
    }

    let status: SLAStatus = 'RUNNING';
    if (completedAt) {
      status = 'COMPLETED';
    } else {
      if (elapsed >= policy.criticalThreshold) status = 'BREACHED';
      else if (elapsed >= policy.warningThreshold) status = 'WARNING';
    }

    const breachDuration = Math.max(0, elapsed - policy.targetDuration);

    return {
      policyId: policy.id!,
      policyName: policy.name,
      resource,
      status,
      elapsedTime: elapsed,
      targetTime: policy.targetDuration,
      warningTime: policy.warningThreshold,
      criticalTime: policy.criticalThreshold,
      breachDuration,
      startedAt: startedAt,
      completedAt: completedAt || null
    };
  }
}
