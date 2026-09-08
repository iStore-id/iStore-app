export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CLOSED';
export type IncidentCategory = 
  | 'APPLICATION' 
  | 'DATABASE' 
  | 'AUTHENTICATION' 
  | 'PAYMENT' 
  | 'PROVIDER' 
  | 'QUEUE' 
  | 'STORAGE' 
  | 'WEBHOOK' 
  | 'FULFILLMENT' 
  | 'SECURITY' 
  | 'SLA' 
  | 'RECONCILIATION' 
  | 'OTHER';

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  category: IncidentCategory;
  status: IncidentStatus;
  source: string;
  sourceKey: string;
  component: string;
  detectedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
  resolvedBy?: string;
  assignedTo?: string;
  resolutionNote?: string;
  metadataSafe?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
