import { supabaseAdmin } from "../supabase-admin.js";

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
    const row: any = {};
    if (typeof actor === 'object' && !action && !details) {
      const payload = actor;
      row.actor_uid = payload.actor?.uid || null;
      row.actor_email = payload.actor?.email || null;
      row.role = payload.role || null;
      row.action = payload.action || null;
      row.target = payload.target || null;
      row.target_id = payload.target_id || null;
      row.before_data = payload.before || null;
      row.after_data = payload.after || null;
      row.reason = payload.reason || null;
      row.ip_address = payload.ip_address || null;
      row.created_at = payload.timestamp || new Date().toISOString();
    } else {
      row.actor_uid = (typeof actor === 'object' ? actor.uid : actor) || null;
      row.actor_email = (typeof actor === 'object' ? actor.email : null) || null;
      row.action = action || null;
      row.after_data = details || null;
      row.created_at = new Date().toISOString();
    }

    const { error } = await supabaseAdmin!.from("audit_logs").insert(row);
    if (error) {
      console.error("[AuditLogRepository] addLog error:", error);
      throw error;
    }
  }

  async log(action: string, entity: string, entityId: string, actor: string, details: any): Promise<void> {
    const row = {
      action,
      target: entity,
      target_id: entityId,
      actor_uid: actor,
      after_data: details,
      created_at: new Date().toISOString()
    };
    const { error } = await supabaseAdmin!.from("audit_logs").insert(row);
    if (error) {
      console.error("[AuditLogRepository] log error:", error);
      throw error;
    }
  }

  async queryLogs(limit?: number): Promise<any[]> {
    const finalLimit = limit || 1000;
    const { data, error } = await supabaseAdmin!
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(finalLimit);

    if (error) {
      console.error("[AuditLogRepository] queryLogs error:", error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      actor: {
        uid: row.actor_uid || "unknown",
        email: row.actor_email || "system"
      },
      role: row.role || "unknown",
      action: row.action || "",
      target: row.target || "",
      target_id: row.target_id || "",
      before: row.before_data || null,
      after: row.after_data || null,
      reason: row.reason || "",
      ip_address: row.ip_address || "",
      timestamp: row.created_at || ""
    }));
  }

  async getLogById(id: string): Promise<any> {
    const { data, error } = await supabaseAdmin!
      .from("audit_logs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[AuditLogRepository] getLogById error:", error);
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      actor: {
        uid: data.actor_uid || "unknown",
        email: data.actor_email || "system"
      },
      role: data.role || "unknown",
      action: data.action || "",
      target: data.target || "",
      target_id: data.target_id || "",
      before: data.before_data || null,
      after: data.after_data || null,
      reason: data.reason || "",
      ip_address: data.ip_address || "",
      timestamp: data.created_at || ""
    };
  }
}
