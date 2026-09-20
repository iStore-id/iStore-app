import { JobService } from "./job-service.js";
import { ProviderService } from "./provider-service.js";
import { BusinessCalendarService } from "./business-calendar-service.js";
import { testMidtransConnection, getMidtransServerConfig } from "./midtrans.js";
import { SystemHealthAggregation, ComponentHealth, HealthState } from "../types/health.js";
import { IncidentService } from "./incident-service.js";
import { supabaseAdmin } from "./supabase-admin.js";

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
      const dbStart = Date.now();
      const { error } = await supabaseAdmin!.from("_health").select("*").limit(1);
      
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
        message: err.message,
        isCritical: true
      });
    }

    // 3. Authentication
    try {
      components.push({
        id: 'auth',
        name: 'Authentication',
        state: 'HEALTHY',
        lastChecked: new Date().toISOString(),
        isCritical: true
      });
    } catch (err: any) {
      components.push({
        id: 'auth',
        name: 'Authentication',
        state: 'DEGRADED',
        lastChecked: new Date().toISOString(),
        message: 'Auth service communication issue',
        isCritical: true
      });
    }

    // 4. Queue / Worker
    const lastHeartbeat = await this.jobService.getLastHeartbeat();
    const stats = await this.jobService.getQueueStats();
    let workerState: HealthState = 'HEALTHY';
    let workerMsg = 'Worker loop is active';
    
    if (!lastHeartbeat) {
      workerState = 'UNKNOWN';
      workerMsg = 'Worker has not started yet';
    } else {
      const heartbeatTime = new Date(lastHeartbeat).getTime();
      const diffMs = Date.now() - heartbeatTime;
      if (diffMs > 120000) {
        workerState = 'DEGRADED';
        workerMsg = `Worker is stale (last cycle: ${Math.round(diffMs / 1000)}s ago)`;
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

    // 5. Midtrans
    try {
      const midtransConfig = await getMidtransServerConfig();
      if (midtransConfig.configured) {
        const midtransTest = await testMidtransConnection(midtransConfig.serverKey, midtransConfig.isProduction);
        components.push({
          id: 'midtrans',
          name: 'Midtrans Gateway',
          state: midtransTest.success ? 'HEALTHY' : 'DEGRADED',
          lastChecked: new Date().toISOString(),
          message: midtransTest.message,
          isCritical: true
        });
      } else {
        components.push({
          id: 'midtrans',
          name: 'Midtrans Gateway',
          state: 'UNKNOWN',
          lastChecked: new Date().toISOString(),
          message: 'Midtrans not configured',
          isCritical: true
        });
      }
    } catch (err: any) {
      components.push({
        id: 'midtrans',
        name: 'Midtrans Gateway',
        state: 'DEGRADED',
        lastChecked: new Date().toISOString(),
        message: err.message,
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
      'provider_apigames': 'PROVIDER',
      'business_calendar': 'OTHER'
    };
    return map[compId] || 'OTHER';
  }
}
