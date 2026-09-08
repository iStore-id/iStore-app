export type HealthState = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

export interface ComponentHealth {
  id: string;
  name: string;
  state: HealthState;
  lastChecked: string;
  latencyMs?: number;
  message?: string;
  details?: Record<string, any>;
  isCritical: boolean;
}

export interface SystemHealthAggregation {
  overallState: HealthState;
  timestamp: string;
  components: ComponentHealth[];
}
