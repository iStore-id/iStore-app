import { Response } from "express";
import { AuthenticatedRequest } from "./middleware";
import { queryAuditLogs, getAuditMetrics, sanitizeAuditData } from "./audit-service";
import { logCoreAudit } from "./core-service";
import { adminDb } from "./firebase-admin";

export async function getAuditLogsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      page,
      limit,
      startDate,
      endDate,
      actorEmail,
      role,
      action,
      module,
      search
    } = req.query;

    const result = await queryAuditLogs({
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 25,
      startDate: startDate as string,
      endDate: endDate as string,
      actorEmail: actorEmail as string,
      role: role as string,
      action: action as string,
      module: module as string,
      search: search as string
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error("[Audit API Error] getAuditLogsApi:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal mengambil daftar audit log"
    });
  }
}

export async function getAuditMetricsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const metrics = await getAuditMetrics();
    return res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error: any) {
    console.error("[Audit API Error] getAuditMetricsApi:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal mengambil ringkasan metrik audit"
    });
  }
}

export async function getAuditDetailApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: "ID audit log diperlukan" });
    }

    const docSnap = await adminDb.collection("auditLogs").doc(id).get();
    if (!docSnap.exists) {
      return res.status(404).json({ success: false, message: "Catatan audit tidak ditemukan" });
    }

    const data = docSnap.data()!;
    const log = {
      id: docSnap.id,
      actor: data.actor || { uid: "unknown", email: "system" },
      role: data.role || "system",
      action: data.action || "UNKNOWN",
      target: data.target || "-",
      before: sanitizeAuditData(data.before),
      after: sanitizeAuditData(data.after),
      reason: data.reason || "-",
      timestamp: data.timestamp || new Date().toISOString()
    };

    return res.status(200).json({
      success: true,
      data: log
    });
  } catch (error: any) {
    console.error("[Audit API Error] getAuditDetailApi:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal mengambil detail catatan audit"
    });
  }
}

export async function exportAuditLogsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = {
      uid: req.user?.uid || "unknown",
      email: req.user?.email || "system"
    };
    const role = req.user?.role || "admin";

    const {
      startDate,
      endDate,
      actorEmail,
      role: filterRole,
      action,
      module,
      search,
      format = "json"
    } = req.body || {};

    const result = await queryAuditLogs({
      page: 1,
      limit: 500, // Safe export limit
      startDate,
      endDate,
      actorEmail,
      role: filterRole,
      action,
      module,
      search
    });

    // Record audit of this export action itself
    await logCoreAudit(
      actor,
      role,
      "EXPORT_AUDIT_LOGS",
      "auditLogs",
      null,
      {
        totalExported: result.logs.length,
        format,
        filtersApplied: { startDate, endDate, actorEmail, filterRole, action, module, search }
      },
      `Audit log data exported by ${actor.email} (${format.toUpperCase()})`
    );

    return res.status(200).json({
      success: true,
      message: "Data audit log berhasil diekspor",
      data: {
        totalExported: result.logs.length,
        format,
        exportedAt: new Date().toISOString(),
        exportedBy: actor.email,
        logs: result.logs
      }
    });
  } catch (error: any) {
    console.error("[Audit API Error] exportAuditLogsApi:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal mengekspor data audit log"
    });
  }
}
