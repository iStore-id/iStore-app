import { Response } from "express";
import { AuthenticatedRequest } from "./middleware";
import { supabaseAdmin } from "./supabase-admin";
import { reconcileOrder, runReconciliationBatch } from "./reconciliation-service";
import { logCoreAudit } from "./core-service";
import { OrderRepository } from "./supabase/order-repository";

export async function getReconciliationOverviewApi(req: AuthenticatedRequest, res: Response) {
  try {
    const [
      totalRunsRes,
      totalRecordsRes,
      openMismatchesRes,
      resolvedMismatchesRes,
      statusMismatchCountRes,
      amountMismatchCountRes,
      providerPendingCountRes,
      lastRunRes
    ] = await Promise.all([
      supabaseAdmin!.from("reconciliation_runs").select("id", { count: "exact", head: true }),
      supabaseAdmin!.from("reconciliation_records").select("id", { count: "exact", head: true }),
      supabaseAdmin!.from("reconciliation_records").select("id", { count: "exact", head: true }).eq("resolution_status", "OPEN"),
      supabaseAdmin!.from("reconciliation_records").select("id", { count: "exact", head: true }).eq("resolution_status", "RESOLVED"),
      supabaseAdmin!.from("reconciliation_records").select("id", { count: "exact", head: true }).eq("type", "STATUS_MISMATCH"),
      supabaseAdmin!.from("reconciliation_records").select("id", { count: "exact", head: true }).eq("type", "AMOUNT_MISMATCH"),
      supabaseAdmin!.from("reconciliation_records").select("id", { count: "exact", head: true }).eq("type", "PROVIDER_PENDING"),
      supabaseAdmin!.from("reconciliation_runs").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle()
    ]);

    const openMismatches = openMismatchesRes.count || 0;
    
    return res.status(200).json({
      success: true,
      data: {
        totalRuns: totalRunsRes.count || 0,
        totalRecordsChecked: totalRecordsRes.count || 0,
        openMismatches,
        resolvedMismatches: resolvedMismatchesRes.count || 0,
        statusMismatchCount: statusMismatchCountRes.count || 0,
        amountMismatchCount: amountMismatchCountRes.count || 0,
        providerPendingCount: providerPendingCountRes.count || 0,
        lastRun: lastRunRes.data ? {
          id: lastRunRes.data.id,
          executedBy: lastRunRes.data.executed_by,
          status: lastRunRes.data.status,
          createdAt: lastRunRes.data.created_at
        } : null,
        healthStatus: openMismatches === 0 ? "HEALTHY" : "ATTENTION_REQUIRED"
      }
    });
  } catch (error: any) {
    console.error("[Reconciliation Overview Error]", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch reconciliation overview" });
  }
}

export async function getReconciliationRunsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { data } = await supabaseAdmin!.from("reconciliation_runs").select("*").order("created_at", { ascending: false }).limit(50);
    const runs = (data || []).map(row => ({
      id: row.id,
      executedBy: row.executed_by,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      status: row.status,
      totalOrdersScanned: row.total_orders_scanned,
      mismatchCount: row.mismatch_count,
      createdAt: row.created_at
    }));
    
    return res.status(200).json({
      success: true,
      data: runs
    });
  } catch (error: any) {
    console.error("[Reconciliation Runs Error]", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch reconciliation runs" });
  }
}

export async function getReconciliationRunDetailApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    
    const { data: runData } = await supabaseAdmin!.from("reconciliation_runs").select("*").eq("id", id).maybeSingle();
    if (!runData) {
      return res.status(404).json({ success: false, message: "Reconciliation run not found" });
    }
    
    const { data: recordsData } = await supabaseAdmin!.from("reconciliation_records").select("*").eq("run_id", id);
    const records = (recordsData || []).map(row => ({
      id: row.id,
      runId: row.run_id,
      orderId: row.order_id,
      mismatchType: row.type,
      resolution: row.resolution_status,
      localState: row.local_state,
      providerState: row.provider_state,
      expectedAmount: row.expected_amount,
      actualAmount: row.actual_amount,
      resolutionReason: row.resolution_reason,
      createdAt: row.created_at
    }));

    return res.status(200).json({
      success: true,
      data: {
        run: {
          id: runData.id,
          executedBy: runData.executed_by,
          startedAt: runData.started_at,
          completedAt: runData.completed_at,
          status: runData.status,
          totalOrdersScanned: runData.total_orders_scanned,
          mismatchCount: runData.mismatch_count,
          createdAt: runData.created_at
        },
        records
      }
    });
  } catch (error: any) {
    console.error("[Reconciliation Run Detail Error]", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch run detail" });
  }
}

export async function getReconciliationRecordsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      page = "1",
      limit = "25",
      resolution,
      mismatchType,
      search
    } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = Math.min(parseInt(limit as string, 10) || 25, 100);

    let query = supabaseAdmin!.from("reconciliation_records").select("*");

    if (resolution && resolution !== "ALL") {
      query = query.eq("resolution_status", resolution);
    }

    if (mismatchType && mismatchType !== "ALL") {
      query = query.eq("type", mismatchType);
    }

    // Since we fetch all and paginate in memory like before for search
    const { data: recordsData } = await query.order("created_at", { ascending: false });

    let records = (recordsData || []).map(row => ({
      id: row.id,
      runId: row.run_id,
      orderId: row.order_id,
      mismatchType: row.type,
      resolution: row.resolution_status,
      localState: row.local_state,
      providerState: row.provider_state,
      expectedAmount: row.expected_amount,
      actualAmount: row.actual_amount,
      resolutionReason: row.resolution_reason,
      createdAt: row.created_at,
      detectedAt: row.created_at, // Map detectedAt to createdAt for frontend compat
      message: row.resolution_reason // Map message
    }));

    if (search && typeof search === "string" && search.trim() !== "") {
      const term = search.toLowerCase();
      records = records.filter(r => 
        (r.orderId && r.orderId.toLowerCase().includes(term)) ||
        (r.id && r.id.toLowerCase().includes(term)) ||
        (r.message && r.message.toLowerCase().includes(term))
      );
    }

    const total = records.length;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedRecords = records.slice(startIndex, startIndex + limitNum);

    return res.status(200).json({
      success: true,
      data: {
        records: paginatedRecords,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum) || 1
        }
      }
    });
  } catch (error: any) {
    console.error("[Reconciliation Records Error]", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch reconciliation records" });
  }
}

export async function reconcileSingleOrder(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const actorUid = req.user?.uid || "system";
    const actorEmail = req.user?.email || "system@istore.local";
    const actorRole = req.user?.role || "admin";
    
    if (!id) {
      return res.status(400).json({ success: false, message: "ID pesanan wajib diisi." });
    }

    const beforeData = await OrderRepository.getInstance().getOrderById(id);
    const result = await reconcileOrder(id, actorUid);
    const afterData = await OrderRepository.getInstance().getOrderById(id);

    await logCoreAudit(
      { uid: actorUid, email: actorEmail },
      actorRole,
      "RECONCILE_ORDER",
      `orders/${id}`,
      beforeData,
      afterData,
      `Manual reconciliation triggered for order ${id}`
    );

    return res.status(200).json({
      success: true,
      message: "Proses rekonsiliasi berhasil diselesaikan.",
      data: result
    });
  } catch (error: any) {
    console.error("[Reconciliation API Error]", error);
    return res.status(500).json({ success: false, message: error.message || "Terjadi kesalahan internal saat rekonsiliasi." });
  }
}

export async function triggerReconciliationBatch(req: AuthenticatedRequest, res: Response) {
  try {
    const actorUid = req.user?.uid || "system";
    const actorEmail = req.user?.email || "system@istore.local";
    const actorRole = req.user?.role || "admin";

    const result = await runReconciliationBatch(actorUid);
    
    await logCoreAudit(
      { uid: actorUid, email: actorEmail },
      actorRole,
      "TRIGGER_RECONCILIATION_BATCH",
      "reconciliation_runs/batch",
      null,
      result,
      "Triggered manual batch reconciliation run"
    );

    return res.status(200).json({
      success: true,
      message: "Proses batch rekonsiliasi berhasil dijalankan.",
      data: result
    });
  } catch (error: any) {
    console.error("[Reconciliation Batch API Error]", error);
    return res.status(500).json({ success: false, message: error.message || "Terjadi kesalahan internal saat batch rekonsiliasi." });
  }
}
