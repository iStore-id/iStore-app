import { Response } from "express";
import { AuthenticatedRequest } from "./middleware";
import { querySystemLogs, getSystemLogMetrics, sanitizeSystemLogMetadata, logSystem } from "./system-log-service";
import { logCoreAudit } from "./core-service";
import { SystemLogRepository } from "./supabase/system-log-repository";

export async function getSystemLogsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      page,
      limit,
      startDate,
      endDate,
      level,
      category,
      service,
      event,
      provider,
      outcome,
      search,
      orderId,
      jobId,
      correlationId
    } = req.query;

    const result = await querySystemLogs({
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 25,
      startDate: startDate as string,
      endDate: endDate as string,
      level: (level as any) || "ALL",
      category: (category as any) || "ALL",
      service: service as string,
      event: event as string,
      provider: provider as string,
      outcome: outcome as string,
      search: search as string,
      orderId: orderId as string,
      jobId: jobId as string,
      correlationId: correlationId as string
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error("[SystemLog API Error] getSystemLogsApi:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal mengambil daftar system log"
    });
  }
}

export async function getSystemLogMetricsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const metrics = await getSystemLogMetrics();
    return res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error: any) {
    console.error("[SystemLog API Error] getSystemLogMetricsApi:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal mengambil ringkasan metrik system log"
    });
  }
}

export async function getSystemLogDetailApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: "ID log diperlukan" });
    }

    const log = await SystemLogRepository.getInstance().getLogById(id);
    if (!log) {
      return res.status(404).json({ success: false, message: "Catatan system log tidak ditemukan" });
    }

    return res.status(200).json({
      success: true,
      data: log
    });
  } catch (error: any) {
    console.error("[SystemLog API Error] getSystemLogDetailApi:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal mengambil detail system log"
    });
  }
}

export async function exportSystemLogsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = {
      uid: req.user?.uid || "unknown",
      email: req.user?.email || "system"
    };
    const role = req.user?.role || "admin";

    const {
      startDate,
      endDate,
      level,
      category,
      service,
      event,
      provider,
      search,
      format = "json"
    } = req.body || {};

    const result = await querySystemLogs({
      page: 1,
      limit: 500, // Safe batch export limit
      startDate,
      endDate,
      level,
      category,
      service,
      event,
      provider,
      search
    });

    // Record audit of this export action to AuditLog
    await logCoreAudit(
      actor,
      role,
      "EXPORT_SYSTEM_LOGS",
      "systemLogs",
      null,
      {
        totalExported: result.logs.length,
        format,
        filtersApplied: { startDate, endDate, level, category, service, event, provider, search }
      },
      `System runtime logs exported by ${actor.email} (${format.toUpperCase()})`
    );

    return res.status(200).json({
      success: true,
      message: "Data system log berhasil diekspor",
      data: {
        totalExported: result.logs.length,
        format,
        exportedAt: new Date().toISOString(),
        exportedBy: actor.email,
        logs: result.logs
      }
    });
  } catch (error: any) {
    console.error("[SystemLog API Error] exportSystemLogsApi:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal mengekspor system logs"
    });
  }
}

export async function emitDiagnosticLogApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { level = "INFO", category = "APPLICATION", event = "MANUAL_DIAGNOSTIC", message = "Uji coba diagnostik runtime" } = req.body || {};
    
    const logId = await logSystem(level, category, event, message, "diagnostic-tool", {
      requestId: `diag-${Date.now()}`,
      metadata: {
        triggeredBy: req.user?.email,
        environment: "production-container",
        nodeEnv: process.env.NODE_ENV || "development"
      }
    });

    return res.status(200).json({
      success: true,
      message: "Event diagnostik berhasil dicatat ke System Logs",
      logId
    });
  } catch (error: any) {
    console.error("[SystemLog API Error] emitDiagnosticLogApi:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal mencatat event diagnostik"
    });
  }
}
