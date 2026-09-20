import { supabaseAdmin } from "../supabase-admin";

export class AuditLogRepository {
  private static instance: AuditLogRepository;
  private constructor() {}

  public static getInstance(): AuditLogRepository {
    if (!AuditLogRepository.instance) {
      AuditLogRepository.instance = new AuditLogRepository();
    }
    return AuditLogRepository.instance;
  }

  async createLog(actor: any, action?: string, details?: any): Promise<void> {
    await this.addLog(actor, action, details);
  }

  async addLog(actor: any, action?: string, details?: any): Promise<void> {
    // Overloaded to handle both (actor, action, details) and (payload)
    if (typeof actor === 'object' && !action) {
      await supabaseAdmin!.from("audit_logs").insert({ ...actor, created_at: new Date().toISOString() });
    } else {
      await supabaseAdmin!.from("audit_logs").insert({ actor, action, details, created_at: new Date().toISOString() });
    }
  }

  async log(action: string, entity: string, entityId: string, actor: string, details: any): Promise<void> {
    await supabaseAdmin!.from("audit_logs").insert({ 
      action, 
      entity, 
      entity_id: entityId, 
      actor, 
      details, 
      created_at: new Date().toISOString() 
    });
  }

  async queryLogs(query?: any): Promise<any[]> {
    return [];
  }

  async getLogById(id: string): Promise<any> {
    return null;
  }
}
