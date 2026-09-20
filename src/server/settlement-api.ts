import { Response } from "express";
import * as crypto from "crypto";
import { AuthenticatedRequest } from "./middleware.js";
import { supabaseAdmin } from "./supabase-admin.js";
import { processSettlementCsv, logAudit } from "./settlement-service.js";
import { SettlementBatch, SettlementRecord, SettlementAdjustment, SettlementAdjustmentType } from "../types/core.js";
import { safeRecordSettlementClosed, safeRecordTypedSettlementAdjustment } from "./ledger-service.js";

export async function importSettlement(req: AuthenticatedRequest, res: Response) {
  try {
    const { fileName, fileContent } = req.body;
    if (!fileName || !fileContent) {
      return res.status(400).json({ success: false, message: "Missing fileName or fileContent." });
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = Buffer.from(fileContent, "base64");
    } catch (e) {
      return res.status(400).json({ success: false, message: "Invalid base64 content." });
    }

    const userId = req.user.uid;
    const ipAddress = req.ip || "";
    
    await logAudit(userId, "SETTLEMENT_IMPORT_STARTED", "settlements", "none", { fileName }, ipAddress);

    const result = await processSettlementCsv(fileBuffer, fileName, userId, ipAddress);

    return res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    console.error("[Settlement API] importSettlement error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to import settlement." });
  }
}

export async function getSettlementOverviewApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { data: snapshot } = await supabaseAdmin!.from("settlement_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
      
    const recentBatches = (snapshot || []).map((doc: any) => ({
      id: doc.id,
      providerId: doc.provider_id,
      periodStart: doc.period_start,
      periodEnd: doc.period_end,
      totalAmount: doc.total_amount,
      totalCount: doc.total_count,
      status: doc.status,
      settledAt: doc.settled_at,
      createdAt: doc.created_at
    }));

    return res.status(200).json({
      success: true,
      data: { recentBatches }
    });
  } catch (err: any) {
    console.error("[Settlement API] getSettlementOverviewApi error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch settlement overview." });
  }
}

export async function getSettlementBatchDetailApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const { data: batchData } = await supabaseAdmin!.from("settlement_batches").select("*").eq("id", id).maybeSingle();
    if (!batchData) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }
    
    const batch = {
      id: batchData.id,
      providerId: batchData.provider_id,
      periodStart: batchData.period_start,
      periodEnd: batchData.period_end,
      totalAmount: batchData.total_amount,
      totalCount: batchData.total_count,
      status: batchData.status,
      settledAt: batchData.settled_at,
      createdAt: batchData.created_at,
      referenceId: batchData.reference_id,
      notes: batchData.notes
    };

    const { data: recordsData } = await supabaseAdmin!.from("settlement_records")
      .select("*")
      .eq("batch_id", id)
      .order("created_at", { ascending: false });
      
    const records = (recordsData || []).map((doc: any) => ({
      id: doc.id,
      batchId: doc.batch_id,
      orderId: doc.order_id,
      providerId: doc.provider_id,
      amount: doc.amount,
      fee: doc.fee,
      netAmount: doc.net_amount,
      status: doc.status,
      createdAt: doc.created_at
    }));
    
    return res.status(200).json({
      success: true,
      data: { batch, records }
    });
  } catch (err: any) {
    console.error("[Settlement API] getSettlementBatchDetailApi error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch batch detail." });
  }
}

export async function processSettlementBatchApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    
    const { data: batchData } = await supabaseAdmin!.from("settlement_batches").select("status").eq("id", id).maybeSingle();
    if (!batchData) throw new Error("Batch not found");
    if (batchData.status !== "PENDING" && batchData.status !== "FAILED") {
      throw new Error("Only PENDING or FAILED batches can be processed");
    }
    
    await supabaseAdmin!.from("settlement_batches").update({
      status: "PROCESSING",
      updated_at: new Date().toISOString()
    }).eq("id", id);
    
    const result = { id, status: "PROCESSING" };
    
    const userId = req.user.uid;
    const ipAddress = req.ip || "";
    await logAudit(userId, "SETTLEMENT_BATCH_PROCESSED", "settlements", id, { previousStatus: batchData.status }, ipAddress);

    return res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    console.error("[Settlement API] processSettlementBatchApi error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to process batch." });
  }
}

export async function completeSettlementBatchApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { referenceId, notes } = req.body;
    
    const { data: batchData } = await supabaseAdmin!.from("settlement_batches").select("*").eq("id", id).maybeSingle();
    if (!batchData) throw new Error("Batch not found");
    if (batchData.status !== "PROCESSING") {
      throw new Error("Only PROCESSING batches can be completed");
    }
    
    await supabaseAdmin!.from("settlement_batches").update({
      status: "SETTLED",
      settled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      reference_id: referenceId,
      notes
    }).eq("id", id);
    
    const result = { id, status: "SETTLED" };
    
    const userId = req.user.uid;
    const ipAddress = req.ip || "";
    
    await safeRecordSettlementClosed(
      id,
      batchData.total_amount || 0,
      0,
      batchData.total_amount || 0,
      userId,
      { notes: "System bulk settlement update" }
    );

    await logAudit(userId, "SETTLEMENT_BATCH_COMPLETED", "settlements", id, { referenceId }, ipAddress);

    return res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    console.error("[Settlement API] completeSettlementBatchApi error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to complete batch." });
  }
}

export async function addSettlementAdjustmentApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: batchId } = req.params;
    const { amount, type, description } = req.body as { amount: number; type: SettlementAdjustmentType; description: string };

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount." });
    }
    if (!type) {
      return res.status(400).json({ success: false, message: "Type is required." });
    }

    const { data: batchData } = await supabaseAdmin!.from("settlement_batches").select("*").eq("id", batchId).maybeSingle();
    if (!batchData) throw new Error("Batch not found");
    
    if (batchData.status === "SETTLED") {
      throw new Error("Cannot modify a settled batch");
    }

    const userId = req.user.uid;
    const adjustmentId = crypto.randomUUID();
    const adjustment: SettlementAdjustment = {
      id: adjustmentId,
      batchId,
      amount,
      type: type as any,
      direction: 'POSITIVE',
      reason: description || "Manual adjustment",
      createdBy: userId,
      createdAt: new Date().toISOString()
    };

    await supabaseAdmin!.from("settlement_adjustments").insert({
      id: adjustmentId,
      batch_id: batchId,
      amount,
      type,
      description,
      created_at: new Date().toISOString()
    });

    let diffAmount = true ? amount : -amount;
    
    await supabaseAdmin!.from("settlement_batches").update({
      total_amount: (batchData.total_amount || 0) + diffAmount,
      updated_at: new Date().toISOString()
    }).eq("id", batchId);
    
    const ipAddress = req.ip || "";
    
    await safeRecordTypedSettlementAdjustment(
      batchId,
      adjustmentId,
      amount,
      type as any,
      "POSITIVE",
      description || "Manual adjustment",
      userId
    );

    await logAudit(userId, "SETTLEMENT_ADJUSTMENT_ADDED", "settlements", batchId, { adjustment }, ipAddress);

    return res.status(200).json({ success: true, data: adjustment });
  } catch (err: any) {
    console.error("[Settlement API] addSettlementAdjustmentApi error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to add adjustment." });
  }
}

export async function failSettlementBatchApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const { data: batchData } = await supabaseAdmin!.from("settlement_batches").select("status").eq("id", id).maybeSingle();
    if (!batchData) throw new Error("Batch not found");
    if (batchData.status === "SETTLED") {
      throw new Error("Cannot fail an already settled batch");
    }
    
    await supabaseAdmin!.from("settlement_batches").update({
      status: "FAILED",
      updated_at: new Date().toISOString(),
      notes: reason
    }).eq("id", id);
    
    const result = { id, status: "FAILED" };

    const userId = req.user.uid;
    const ipAddress = req.ip || "";
    await logAudit(userId, "SETTLEMENT_BATCH_FAILED", "settlements", id, { reason }, ipAddress);

    return res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    console.error("[Settlement API] failSettlementBatchApi error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to mark batch as failed." });
  }
}

export async function generateSettlementReportApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { providerId, startDate, endDate } = req.query;

    let query = supabaseAdmin!.from("settlement_batches").select("*");
    
    if (providerId) {
      query = query.eq("provider_id", providerId as string);
    }
    if (startDate) {
      query = query.gte("period_start", startDate as string);
    }
    if (endDate) {
      query = query.lte("period_end", endDate as string);
    }
    
    const { data: batchesData } = await query;
    const batches = (batchesData || []).map(row => ({
      id: row.id,
      providerId: row.provider_id,
      status: row.status,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      totalAmount: row.total_amount,
      totalCount: row.total_count,
      createdAt: row.created_at,
      settledAt: row.settled_at
    }));

    let totalVolume = 0;
    let totalFees = 0; // Not available at batch level directly, but mock it here
    let totalSettled = 0;

    for (const batch of batches) {
      if (batch.status === "SETTLED") {
        totalSettled += batch.totalAmount;
      }
      totalVolume += batch.totalAmount;
    }

    const report = {
      summary: {
        totalVolume,
        totalFees,
        totalSettled,
        batchCount: batches.length
      },
      batches
    };

    return res.status(200).json({ success: true, data: report });
  } catch (err: any) {
    console.error("[Settlement API] generateSettlementReportApi error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to generate report." });
  }
}
