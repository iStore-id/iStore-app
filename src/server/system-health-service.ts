import { JobService } from "./job-service.js";
import { ProviderService } from "./provider-service.js";
import { BusinessCalendarService } from "./business-calendar-service.js";
import { PaymentRouter } from "./payment-router.js";
import { DoitProviderAdapter } from "./adapters/doit-adapter.js";
import { SystemConfigRepository } from "./supabase/system-config-repository.js";
import { SystemHealthAggregation, ComponentHealth, HealthState } from "../types/health.js";
import { IncidentService } from "./incident-service.js";
import { supabaseAdmin } from "./supabase-admin.js";


async function checkDoitHealth(): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  const start = Date.now();
  try {
    const config = await DoitProviderAdapter.getInstance().getConfig();
    if (!config.apiKey) return { success: false, message: "Doit.id API Key is not configured." };

    const baseUrl = new URL(config.baseUrl || "https://pay.doit.id");
    if (baseUrl.protocol !== "https:" || baseUrl.hostname !== "pay.doit.id" || baseUrl.port) {
      return { success: false, message: "Doit.id health check blocked an unapproved API base URL." };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${baseUrl.origin}/v1/payments?reference=TEST_CONN_PING`, {
        method: "GET",
        headers: { Authorization: `Bearer ${config.apiKey}`, Accept: "application/json" },
        signal: controller.signal
      });
      if (response.status === 401 || response.status === 403) {
        return { success: false, message: "Doit.id API authentication failed.", latencyMs: Date.now() - start };
      }
      // A 404 does not prove that the API credentials were accepted; fail closed.
      // The health check must not report the active payment gateway healthy on an
      // unknown-reference response whose authentication semantics are unverified.
      if (response.status === 404) {
        return { success: false, message: "Doit.id returned HTTP 404; API authentication and endpoint health could not be verified.", latencyMs: Date.now() - start };
      }
      if (response.status !== 200) {
        return { success: false, message: `Doit.id returned HTTP ${response.status} to the read-only connection check.`, latencyMs: Date.now() - start };
      }
      const payload: any = await response.json().catch(() => null);
      const valid = Array.isArray(payload) ||
        (payload && typeof payload === "object" && (Array.isArray(payload.data) ||
          typeof payload.id === "string" || typeof payload.reference === "string"));
      if (!valid) {
        return { success: false, message: "Doit.id returned an unexpected response format.", latencyMs: Date.now() - start };
      }
      return { success: true, message: "Doit.id read-only API connection verified.", latencyMs: Date.now() - start };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err: any) {
    return {
      success: false,
      message: err?.name === "AbortError" ? "Doit.id connection check timed out." : "Doit.id connection check failed.",
      latencyMs: Date.now() - start
    };
  }
}

async function checkMidtransHealth(): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  const { testMidtransConnection, getMidtransServerConfig } = await import("./midtrans.js");
  const start = Date.now();
  try {
    const config = await getMidtransServerConfig();
    const result = await testMidtransConnection(config.serverKey, config.isProduction);
    return { ...result, latencyMs: Date.now() - start };
  } catch {
    return { success: false, message: "Midtrans connection check failed.", latencyMs: Date.now() - start };
  }
}

export class SystemHealthService {
  private static instance: SystemHealthService;
  private jobService = JobService.getInstance();
  private providerService = ProviderService.getInstance();
  private calendarService = BusinessCalendarService.getInstance();
  private incidentService = IncidentService.getInstance();

  private constructor() {}

  static getInstance(): SystemHealthService {
    if (!SystemHealthService.instance) {
      SystemHealthService.instance = new SystemHealthService();
    }
    return SystemHealthService.instance;
  }

  async getSystemHealth(): Promise<SystemHealthAggregation> {
    const components: ComponentHealth[] = [];

    // 1. Application (Liveness)
    components.push({
      id: 'application',
      name: 'Application Server',
      state: 'HEALTHY',
      lastChecked: new Date().toISOString(),
      isCritical: true,
      message: 'Server is running'
    });

    // 2. Supabase (Readiness)
    try {
      if (!supabaseAdmin) {
        throw new Error("Supabase admin client is not configured.");
      }

      const dbStart = Date.now();
      const { error } = await supabaseAdmin.from("jobs").select("id").limit(1);
      if (error) {
        throw error;
      }

      components.push({
        id: 'supabase',
        name: 'Supabase Database',
        state: 'HEALTHY',
        lastChecked: new Date().toISOString(),
        latencyMs: Date.now() - dbStart,
        isCritical: true
      });
    } catch (err: any) {
      components.push({
        id: 'supabase',
        name: 'Supabase Database',
        state: 'UNHEALTHY',
        lastChecked: new Date().toISOString(),
        message: err?.message || "Supabase readiness check failed.",
        isCritical: true
      });
    }

    // 3. Authentication: verify the Supabase Auth admin endpoint without exposing user data.
    try {
      if (!supabaseAdmin) throw new Error("Supabase admin client is not configured.");
      const authStart = Date.now();
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
      if (error || !data) throw error || new Error("Supabase Auth returned no response.");
      components.push({
        id: 'auth',
        name: 'Authentication',
        state: 'HEALTHY',
        lastChecked: new Date().toISOString(),
        latencyMs: Date.now() - authStart,
        message: 'Supabase Auth endpoint responded successfully',
        isCritical: true
      });
    } catch {
      components.push({
        id: 'auth',
        name: 'Authentication',
        state: 'DEGRADED',
        lastChecked: new Date().toISOString(),
        message: 'Supabase Auth endpoint check failed',
        isCritical: true
      });
    }

    // 4. Queue / Worker: use the persistent heartbeat written by the authenticated worker endpoint.
    const heartbeatConfig = await SystemConfigRepository.getInstance().getConfig("worker_heartbeat");
    const lastHeartbeat = heartbeatConfig?.lastHeartbeatAt || null;
    const stats = await this.jobService.getQueueStats();
    let workerState: HealthState = 'HEALTHY';
    let workerMsg = 'Worker endpoint executed recently';

    if (!lastHeartbeat) {
      workerState = 'UNKNOWN';
      workerMsg = 'No successful worker endpoint heartbeat has been recorded yet';
    } else {
      const heartbeatTime = new Date(lastHeartbeat).getTime();
      const diffMs = Date.now() - heartbeatTime;
      if (!Number.isFinite(heartbeatTime) || diffMs > 600000) {
        workerState = 'DEGRADED';
        workerMsg = !Number.isFinite(heartbeatTime)
          ? 'Persisted worker heartbeat is invalid'
          : `Worker endpoint heartbeat is stale (${Math.round(diffMs / 1000)}s ago)`;
      }
    }
    components.push({
      id: 'queue_worker',
      name: 'Background Worker',
      state: workerState,
      lastChecked: new Date().toISOString(),
      message: workerMsg,
      details: stats,
      isCritical: true
    });

    // 5. Payment gateway health follows the owner's active PaymentRouter configuration.
    try {
      const gatewayCode = await PaymentRouter.getInstance().getActiveGateway();
      const disabledGateway = (id: string, name: string): ComponentHealth => ({
        id, name, state: 'DISABLED', lastChecked: new Date().toISOString(),
        message: 'Intentionally inactive; not checked.', isCritical: false
      });

      if (gatewayCode === 'doit') {
        const doitHealth = await checkDoitHealth();
        components.push({
          id: 'doit',
          name: 'Doit.id Gateway',
          state: doitHealth.success ? 'HEALTHY' : 'DEGRADED',
          lastChecked: new Date().toISOString(),
          latencyMs: doitHealth.latencyMs,
          message: doitHealth.message,
          isCritical: true
        });
        components.push({
          ...disabledGateway('midtrans', 'Midtrans Gateway'),
          message: 'Intentionally disabled by owner; not checked.'
        });
        components.push({
          ...disabledGateway('ipaymu', 'iPaymu Gateway'),
          message: 'Intentionally disabled by owner; not checked.'
        });
      } else if (gatewayCode === 'midtrans') {
        const midtransTest = await checkMidtransHealth();
        components.push({
          id: 'midtrans',
          name: 'Midtrans Gateway',
          state: midtransTest.success ? 'HEALTHY' : 'DEGRADED',
          lastChecked: new Date().toISOString(),
          latencyMs: midtransTest.latencyMs,
          message: midtransTest.message,
          isCritical: true
        });
        components.push(disabledGateway('doit', 'Doit.id Gateway'));
        components.push(disabledGateway('ipaymu', 'iPaymu Gateway'));
      } else if (gatewayCode === 'ipaymu') {
        components.push({
          id: 'ipaymu',
          name: 'iPaymu Gateway',
          state: 'DEGRADED',
          lastChecked: new Date().toISOString(),
          message: 'Active iPaymu gateway health check is not implemented.',
          isCritical: true
        });
        components.push(disabledGateway('doit', 'Doit.id Gateway'));
        components.push(disabledGateway('midtrans', 'Midtrans Gateway'));
      } else {
        throw new Error(`Unsupported active payment gateway: ${gatewayCode}`);
      }
    } catch (err: any) {
      components.push({
        id: 'payment_gateway',
        name: 'Active Payment Gateway',
        state: 'UNHEALTHY',
        lastChecked: new Date().toISOString(),
        message: err?.message || 'Unable to resolve active payment gateway.',
        isCritical: true
      });
    }

    // 6. Providers
    try {
      const apiGamesHealth = await this.providerService.testApiGamesConnection();
      components.push({
        id: 'provider_apigames',
        name: 'API Games',
        state: apiGamesHealth.success ? 'HEALTHY' : 'DEGRADED',
        lastChecked: new Date().toISOString(),
        latencyMs: apiGamesHealth.latencyMs,
        message: apiGamesHealth.message,
        isCritical: false
      });
    } catch (err: any) {
      components.push({
        id: 'provider_apigames',
        name: 'API Games',
        state: 'UNKNOWN',
        lastChecked: new Date().toISOString(),
        message: err.message,
        isCritical: false
      });
    }

    // 7. Business Calendar
    const calendarStatus = this.calendarService.isOpen(new Date());
    components.push({
      id: 'business_calendar',
      name: 'Business Calendar',
      state: 'HEALTHY',
      lastChecked: new Date().toISOString(),
      message: calendarStatus.isOpen ? 'Store is OPEN' : `Store is CLOSED (${calendarStatus.reason})`,
      details: calendarStatus,
      isCritical: false
    });

    let overallState: HealthState = 'HEALTHY';
    if (components.some(c => c.isCritical && c.state === 'UNHEALTHY')) {
      overallState = 'UNHEALTHY';
    } else if (components.some(c => c.state === 'DEGRADED' || (c.isCritical && c.state === 'UNKNOWN'))) {
      overallState = 'DEGRADED';
    }

    this.evaluateIncidents(components).catch(err => console.error("[SystemHealth] Error evaluating incidents:", err));

    return {
      overallState,
      timestamp: new Date().toISOString(),
      components
    };
  }

  private async evaluateIncidents(components: ComponentHealth[]) {
    for (const comp of components) {
      if (comp.state === 'UNHEALTHY' || (comp.isCritical && comp.state === 'DEGRADED')) {
        await this.incidentService.reportIncident({
          title: `System Component Alert: ${comp.name}`,
          description: comp.message || `Component ${comp.name} is in state ${comp.state}`,
          severity: comp.state === 'UNHEALTHY' ? 'CRITICAL' : 'HIGH',
          category: this.mapComponentToCategory(comp.id),
          source: 'HEALTH_CHECK',
          sourceKey: `health:${comp.id}:${comp.state}`,
          component: comp.id,
          metadataSafe: comp.details
        });
      }
    }
  }

  private mapComponentToCategory(compId: string): any {
    const map: Record<string, string> = {
      'application': 'APPLICATION',
      'supabase': 'DATABASE',
      'auth': 'AUTHENTICATION',
      'queue_worker': 'QUEUE',
      'midtrans': 'PAYMENT',
      'doit': 'PAYMENT',
      'ipaymu': 'PAYMENT',
      'payment_gateway': 'PAYMENT',
      'provider_apigames': 'PROVIDER',
      'business_calendar': 'OTHER'
    };
    return map[compId] || 'OTHER';
  }
}
