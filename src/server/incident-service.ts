import { adminDb } from "./firebase-admin";
import { Incident, IncidentStatus, IncidentSeverity, IncidentCategory } from "../types/incident";
import { NotificationService } from "./notification-service";
import crypto from "crypto";

export class IncidentService {
  private static instance: IncidentService;
  private notificationService = NotificationService.getInstance();

  private constructor() {}

  static getInstance(): IncidentService {
    if (!IncidentService.instance) {
      IncidentService.instance = new IncidentService();
    }
    return IncidentService.instance;
  }

  async reportIncident(params: {
    title: string;
    description: string;
    severity: IncidentSeverity;
    category: IncidentCategory;
    source: string;
    sourceKey: string;
    component: string;
    metadataSafe?: Record<string, any>;
  }): Promise<string> {
    const { source, sourceKey, component } = params;
    
    // Deterministic ID for deduplication
    const incidentId = crypto.createHash("sha256")
      .update(`${source}:${sourceKey}:${component}`)
      .digest("hex");

    const incidentRef = adminDb.collection("incidents").doc(incidentId);
    const now = new Date().toISOString();

    await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(incidentRef);
      
      if (snap.exists) {
        const existing = snap.data() as Incident;
        
        // If already RESOLVED or CLOSED, we might want to re-open it if it's the same problem
        // But for now, if it's OPEN or ACKNOWLEDGED, just update it.
        if (existing.status === 'OPEN' || existing.status === 'ACKNOWLEDGED') {
          transaction.update(incidentRef, {
            description: params.description,
            severity: params.severity,
            metadataSafe: { ...existing.metadataSafe, ...params.metadataSafe },
            updatedAt: now
          });
          return;
        }
      }

      // Create new incident
      const incident: Incident = {
        id: incidentId,
        title: params.title,
        description: params.description,
        severity: params.severity,
        category: params.category,
        status: 'OPEN',
        source,
        sourceKey,
        component,
        detectedAt: now,
        createdAt: now,
        updatedAt: now,
        metadataSafe: params.metadataSafe || {}
      };

      transaction.set(incidentRef, incident);

      // Notification
      this.notificationService.notifyAdmin('INCIDENT_OPENED', `Incident ${incident.severity}: ${incident.title}`, incident.description, {
        severity: incident.severity === 'CRITICAL' || incident.severity === 'HIGH' ? 'CRITICAL' : 'WARNING',
        relatedEntity: { type: 'INCIDENT', id: incidentId },
        actionUrl: `/admin/incidents`,
        idempotencyKey: `notif_incident_open_${incidentId}`
      }).catch(err => console.error("[IncidentService] Notify open error:", err));
    });

    return incidentId;
  }

  async acknowledgeIncident(incidentId: string, actorUid: string): Promise<void> {
    const now = new Date().toISOString();
    await adminDb.collection("incidents").doc(incidentId).update({
      status: 'ACKNOWLEDGED',
      acknowledgedAt: now,
      acknowledgedBy: actorUid,
      updatedAt: now
    });

    this.notificationService.notifyAdmin('INCIDENT_ACKNOWLEDGED', `Incident Acknowledged`, `Incident ${incidentId} telah diakui oleh ${actorUid}`, {
      severity: 'INFO',
      relatedEntity: { type: 'INCIDENT', id: incidentId },
      actionUrl: `/admin/incidents`,
      idempotencyKey: `notif_incident_ack_${incidentId}_${now}`
    }).catch(err => console.error("[IncidentService] Notify ack error:", err));
  }

  async assignIncident(incidentId: string, adminUid: string): Promise<void> {
    const now = new Date().toISOString();
    await adminDb.collection("incidents").doc(incidentId).update({
      assignedTo: adminUid,
      updatedAt: now
    });
  }

  async resolveIncident(incidentId: string, actorUid: string, note?: string): Promise<void> {
    const now = new Date().toISOString();
    await adminDb.collection("incidents").doc(incidentId).update({
      status: 'RESOLVED',
      resolvedAt: now,
      resolvedBy: actorUid,
      resolutionNote: note || "Resolved manually",
      updatedAt: now
    });

    this.notificationService.notifyAdmin('INCIDENT_RESOLVED', `Incident Resolved`, `Incident ${incidentId} telah diselesaikan. Catatan: ${note || '-'}`, {
      severity: 'SUCCESS',
      relatedEntity: { type: 'INCIDENT', id: incidentId },
      actionUrl: `/admin/incidents`,
      idempotencyKey: `notif_incident_res_${incidentId}_${now}`
    }).catch(err => console.error("[IncidentService] Notify resolve error:", err));
  }

  async closeIncident(incidentId: string, actorUid: string, note?: string): Promise<void> {
    const now = new Date().toISOString();
    await adminDb.collection("incidents").doc(incidentId).update({
      status: 'CLOSED',
      updatedAt: now,
      resolutionNote: note || "Closed manually"
    });
  }

  async getIncidents(options: { 
    status?: IncidentStatus; 
    severity?: IncidentSeverity;
    category?: IncidentCategory;
    limit?: number;
    offset?: number;
  } = {}) {
    let query: any = adminDb.collection("incidents").orderBy("createdAt", "desc");
    
    if (options.status) query = query.where("status", "==", options.status);
    if (options.severity) query = query.where("severity", "==", options.severity);
    if (options.category) query = query.where("category", "==", options.category);
    
    if (options.limit) query = query.limit(options.limit);
    
    const snap = await query.get();
    return snap.docs.map((doc: any) => doc.data() as Incident);
  }

  async getIncidentSummary() {
    const snap = await adminDb.collection("incidents").where("status", "!=", "RESOLVED").get();
    const active = snap.docs.map((doc: any) => doc.data() as Incident);
    
    return {
      openCritical: active.filter(i => i.status === 'OPEN' && i.severity === 'CRITICAL').length,
      openHigh: active.filter(i => i.status === 'OPEN' && i.severity === 'HIGH').length,
      openMedium: active.filter(i => i.status === 'OPEN' && i.severity === 'MEDIUM').length,
      totalOpen: active.filter(i => i.status === 'OPEN').length,
      acknowledged: active.filter(i => i.status === 'ACKNOWLEDGED').length
    };
  }
}
