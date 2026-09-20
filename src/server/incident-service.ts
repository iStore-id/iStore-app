import { supabaseAdmin } from "./supabase-admin";
import * as crypto from "crypto";

export class IncidentService {
  private static instance: IncidentService;
  private constructor() {}

  static getInstance(): IncidentService {
    if (!IncidentService.instance) {
      IncidentService.instance = new IncidentService();
    }
    return IncidentService.instance;
  }

  async reportIncident(data: any): Promise<any> {
    const id = crypto.randomUUID();
    const payload = {
      ...data,
      id,
      status: "OPEN",
      created_at: new Date().toISOString()
    };
    await supabaseAdmin!.from("incidents").insert(payload);
    return payload;
  }

  async addLog(incidentId: string, log: any): Promise<void> {
    // stub for incident logs
  }

  async resolveIncident(incidentId: string, actor: string, note?: string): Promise<void> {
    await supabaseAdmin!.from("incidents").update({ 
      status: "RESOLVED", 
      resolution: note, 
      updated_at: new Date().toISOString() 
    }).eq("id", incidentId);
  }

  async getIncidents(filters?: any): Promise<any[]> {
    const { data } = await supabaseAdmin!.from("incidents").select("*").order("created_at", { ascending: false });
    return data || [];
  }

  async getActiveIncidents(): Promise<any[]> {
    const { data } = await supabaseAdmin!.from("incidents").select("*").neq("status", "RESOLVED").order("created_at", { ascending: false });
    return data || [];
  }

  async getIncidentSummary(): Promise<any> { return {}; }
  async acknowledgeIncident(id: string, actor: string): Promise<void> {}
  async assignIncident(id: string, assignee: string): Promise<void> {}
  async closeIncident(id: string, actor: string, note?: string): Promise<void> {}
}
