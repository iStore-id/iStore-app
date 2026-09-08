import { Response } from "express";
import { AuthenticatedRequest } from "./middleware";
import { IncidentService } from "./incident-service";
import { IncidentStatus, IncidentSeverity, IncidentCategory } from "../types/incident";

const incidentService = IncidentService.getInstance();

export async function getAdminIncidents(req: AuthenticatedRequest, res: Response) {
  try {
    const { status, severity, category, limit, offset } = req.query;
    
    const incidents = await incidentService.getIncidents({
      status: status as IncidentStatus,
      severity: severity as IncidentSeverity,
      category: category as IncidentCategory,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0
    });

    const summary = await incidentService.getIncidentSummary();

    return res.status(200).json({
      success: true,
      data: {
        incidents,
        summary
      }
    });
  } catch (error: any) {
    console.error("[IncidentAPI] Error fetching incidents:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function acknowledgeIncidentApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });
    
    await incidentService.acknowledgeIncident(id, req.user.uid);
    return res.status(200).json({ success: true, message: "Incident acknowledged" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function assignIncidentApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { adminUid } = req.body;
    
    await incidentService.assignIncident(id, adminUid);
    return res.status(200).json({ success: true, message: "Incident assigned" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function resolveIncidentApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { note } = req.body;
    if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });
    
    await incidentService.resolveIncident(id, req.user.uid, note);
    return res.status(200).json({ success: true, message: "Incident resolved" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function closeIncidentApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { note } = req.body;
    if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });
    
    await incidentService.closeIncident(id, req.user.uid, note);
    return res.status(200).json({ success: true, message: "Incident closed" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
