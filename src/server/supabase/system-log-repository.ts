import { supabaseAdmin, isSupabaseAdminConfigured } from "../supabase-admin.js";
import { SystemLog } from "../../types/core.js";
import { sanitizeSystemLogMetadata } from "../system-log-service.js";

export class SystemLogRepository {
  private static instance: SystemLogRepository;

  private constructor() {}

  public static getInstance(): SystemLogRepository {
    if (!SystemLogRepository.instance) {
      SystemLogRepository.instance = new SystemLogRepository();
    }
    return SystemLogRepository.instance;
  }

  private get client() {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      throw new Error("Supabase Admin client is not configured.");
    }
    return supabaseAdmin;
  }

  async createLog(log: SystemLog): Promise<string> {
    const id = log.id || `syslog_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const row = {
      id,
      timestamp: log.timestamp || new Date().toISOString(),
      level: log.level,
      category: log.category,
      event: log.event,
      message: log.message,
      service: log.service,
      request_id: log.requestId || null,
      correlation_id: log.correlationId || null,
      order_id: log.orderId || null,
      job_id: log.jobId || null,
      provider: log.provider || null,
      http_status: log.httpStatus || null,
      duration_ms: log.durationMs || null,
      retry_count: log.retryCount || null,
      outcome: log.outcome || null,
      stack_trace: log.stackTrace || null,
      metadata: log.metadata || null,
      created_at: new Date().toISOString()
    };

    try {
      const { error } = await this.client.from("system_logs").insert(row);
      if (error) {
        console.warn("[SystemLogRepository] Failed to insert into Supabase system_logs:", error.message);
      }
    } catch (err) {
      console.warn("[SystemLogRepository] Supabase insert exception:", err);
    }
    return id;
  }

  async queryLogs(limit: number = 1000): Promise<SystemLog[]> {
    try {
      const { data, error } = await this.client
        .from("system_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(limit);

      if (error || !data) {
        return [];
      }

      return data.map((d: any) => ({
        id: d.id,
        timestamp: d.timestamp || new Date().toISOString(),
        level: d.level || "INFO",
        category: d.category || "APPLICATION",
        event: d.event || "UNKNOWN_EVENT",
        message: d.message || "",
        service: d.service || "unknown",
        requestId: d.request_id || d.requestId,
        correlationId: d.correlation_id || d.correlationId,
        orderId: d.order_id || d.orderId,
        jobId: d.job_id || d.jobId,
        provider: d.provider,
        httpStatus: d.http_status || d.httpStatus,
        durationMs: d.duration_ms || d.durationMs,
        retryCount: d.retry_count || d.retryCount,
        outcome: d.outcome,
        stackTrace: d.stack_trace || d.stackTrace,
        metadata: sanitizeSystemLogMetadata(d.metadata)
      }));
    } catch (err) {
      console.warn("[SystemLogRepository] Failed to query system_logs from Supabase:", err);
      return [];
    }
  }

  async getLogById(id: string): Promise<SystemLog | null> {
    try {
      const { data, error } = await this.client
        .from("system_logs")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      const d = data;
      return {
        id: d.id,
        timestamp: d.timestamp || new Date().toISOString(),
        level: d.level || "INFO",
        category: d.category || "APPLICATION",
        event: d.event || "UNKNOWN_EVENT",
        message: d.message || "",
        service: d.service || "unknown",
        requestId: d.request_id || d.requestId,
        correlationId: d.correlation_id || d.correlationId,
        orderId: d.order_id || d.orderId,
        jobId: d.job_id || d.jobId,
        provider: d.provider,
        httpStatus: d.http_status || d.httpStatus,
        durationMs: d.duration_ms || d.durationMs,
        retryCount: d.retry_count || d.retryCount,
        outcome: d.outcome,
        stackTrace: d.stack_trace || d.stackTrace,
        metadata: sanitizeSystemLogMetadata(d.metadata)
      };
    } catch (err) {
      console.warn("[SystemLogRepository] Failed to get system log by ID from Supabase:", err);
      return null;
    }
  }
}
