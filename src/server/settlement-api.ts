import { Response } from "express";
import crypto from "crypto";
import { AuthenticatedRequest } from "./middleware";
import { adminDb } from "./firebase-admin";
import { processSettlementCsv, logAudit } from "./settlement-service";
import { SettlementBatch, SettlementRecord, SettlementAdjustment, SettlementAdjustmentType } from "../types/core";
import { safeRecordSettlementClosed, safeRecordTypedSettlementAdjustment } from "./ledger-service";

export async function importSettlement(req: AuthenticatedRequest, res: Response) {
  try {
    const { fileName, fileContent } = req.body;

    if (!fileName || !fileContent) {
      return res.status(400).json({ success: false, message: "Missing fileName or fileContent." });
    }

    // Decode base64 to buffer safely
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

    if (!result.success) {
      return res.status(result.code === "DUPLICATE_FILE" ? 409 : 400).json(result);
    }

    return res.status(201).json(result);
  } catch (err: any) {
    console.error("Error importing settlement:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function getSettlementBatches(req: AuthenticatedRequest, res: Response) {
  try {
    const snapshot = await adminDb.collection("settlementBatches")
      .orderBy("createdAt", "desc")
      .get();

    const batches: SettlementBatch[] = [];
    snapshot.forEach(doc => {
      batches.push(doc.data() as SettlementBatch);
    });

    return res.status(200).json({ success: true, data: batches });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to retrieve batches." });
  }
}

export async function getSettlementBatchDetail(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const batchSnap = await adminDb.collection("settlementBatches").doc(id).get();

    if (!batchSnap.exists) {
      return res.status(404).json({ success: false, message: "Batch settlement not found." });
    }

    const recordsSnap = await adminDb.collection("settlementRecords")
      .where("batchId", "==", id)
      .get();

    const records: SettlementRecord[] = [];
    recordsSnap.forEach(doc => {
      records.push(doc.data() as SettlementRecord);
    });

    return res.status(200).json({
      success: true,
      data: {
        batch: batchSnap.data() as SettlementBatch,
        records
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to retrieve batch details." });
  }
}

export async function verifySettlementBatch(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const ipAddress = req.ip || "";

    const result = await adminDb.runTransaction(async (transaction) => {
      const batchRef = adminDb.collection("settlementBatches").doc(id);
      const batchSnap = await transaction.get(batchRef);

      if (!batchSnap.exists) {
        throw new Error("BATCH_NOT_FOUND");
      }

      const batchData = batchSnap.data() as SettlementBatch;

      if (batchData.status === "SETTLED") {
        throw new Error("BATCH_ALREADY_SETTLED");
      }

      const updatedBatch = {
        ...batchData,
        status: "VERIFIED",
        verifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      transaction.update(batchRef, {
        status: "VERIFIED",
        verifiedAt: updatedBatch.verifiedAt,
        updatedAt: updatedBatch.updatedAt
      });

      return updatedBatch;
    });

    await logAudit(userId, "SETTLEMENT_BATCH_VERIFIED", "settlementBatches", id, {}, ipAddress);

    return res.status(200).json({
      success: true,
      message: "Batch settlement berhasil diverifikasi.",
      data: result
    });
  } catch (err: any) {
    if (err.message === "BATCH_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Batch settlement tidak ditemukan." });
    }
    if (err.message === "BATCH_ALREADY_SETTLED") {
      return res.status(400).json({ success: false, message: "Batch yang sudah Settled tidak dapat diverifikasi kembali." });
    }
    return res.status(500).json({ success: false, message: err.message || "Failed to verify batch." });
  }
}

export async function settleSettlementBatch(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const ipAddress = req.ip || "";

    const result = await adminDb.runTransaction(async (transaction) => {
      const batchRef = adminDb.collection("settlementBatches").doc(id);
      const batchSnap = await transaction.get(batchRef);

      if (!batchSnap.exists) {
        throw new Error("BATCH_NOT_FOUND");
      }

      const batchData = batchSnap.data() as SettlementBatch;

      if (batchData.status !== "VERIFIED") {
        throw new Error("BATCH_NOT_VERIFIED");
      }

      const updatedBatch = {
        ...batchData,
        status: "SETTLED",
        settledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      transaction.update(batchRef, {
        status: "SETTLED",
        settledAt: updatedBatch.settledAt,
        updatedAt: updatedBatch.updatedAt
      });

      return updatedBatch;
    });

    await logAudit(userId, "SETTLEMENT_BATCH_SETTLED", "settlementBatches", id, {}, ipAddress);

    // Post-commit Ledger Hook: Record SETTLEMENT_CLOSED event safely
    const grossAmount = result.grossAmount || 0;
    const mdrFeeAmount = result.mdrFeeAmount || 0;
    const netAmount = grossAmount - mdrFeeAmount;

    await safeRecordSettlementClosed(
      id,
      grossAmount,
      mdrFeeAmount,
      netAmount,
      req.user?.email || req.user?.uid || "ADMIN",
      { sourceFileName: result.sourceFileName }
    );

    return res.status(200).json({
      success: true,
      message: "Batch settlement resmi ditutup dan ditandai sebagai Settled.",
      data: result
    });
  } catch (err: any) {
    if (err.message === "BATCH_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Batch settlement tidak ditemukan." });
    }
    if (err.message === "BATCH_NOT_VERIFIED") {
      return res.status(400).json({ success: false, message: "Hanya batch berstatus VERIFIED yang dapat ditandai sebagai SETTLED." });
    }
    return res.status(500).json({ success: false, message: err.message || "Failed to settle batch." });
  }
}

export async function addBatchAdjustment(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { amount, type, direction = "POSITIVE", reason } = req.body;
    const userId = req.user.uid;
    const userEmail = req.user.email || userId;
    const ipAddress = req.ip || "";

    if (!amount || typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "Amount harus berupa integer IDR positif." });
    }

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ success: false, message: "Reason penyesuaian wajib diisi." });
    }

    const validTypes: SettlementAdjustmentType[] = [
      'MDR_CORRECTION',
      'BANK_FEE',
      'REVENUE_ADJUSTMENT',
      'RECEIVABLE_WRITE_OFF',
      'OTHER'
    ];

    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: "Tipe adjustment tidak valid." });
    }

    if (type === "OTHER") {
      return res.status(400).json({
        success: false,
        message: "Tipe adjustment 'OTHER' tidak memiliki mapping GL otomatis. Mohon pilih tipe yang terklasifikasi (MDR_CORRECTION, BANK_FEE, REVENUE_ADJUSTMENT, RECEIVABLE_WRITE_OFF)."
      });
    }

    const validDirections = ["POSITIVE", "NEGATIVE"];
    const adjDirection = validDirections.includes(direction) ? direction : "POSITIVE";

    // Server-generated deterministic unique adjustment ID
    const adjustmentId = `sett_adj_${id}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const result = await adminDb.runTransaction(async (transaction) => {
      const batchRef = adminDb.collection("settlementBatches").doc(id);
      const batchSnap = await transaction.get(batchRef);

      if (!batchSnap.exists) {
        throw new Error("BATCH_NOT_FOUND");
      }

      const batchData = batchSnap.data() as SettlementBatch;

      if (batchData.status === "SETTLED") {
        throw new Error("BATCH_ALREADY_SETTLED");
      }

      const signedAmount = adjDirection === "POSITIVE" ? amount : -amount;
      const currentAdjustment = batchData.adjustmentAmount || 0;
      const newAdjustment = currentAdjustment + signedAmount;
      const newNet = (batchData.netSettledAmount || 0) + signedAmount;

      const adjDocRef = batchRef.collection("adjustments").doc(adjustmentId);
      const adjustmentDoc: SettlementAdjustment = {
        id: adjustmentId,
        batchId: id,
        amount, // Positive integer IDR
        type: type as SettlementAdjustmentType,
        direction: adjDirection as "POSITIVE" | "NEGATIVE",
        reason: reason.trim(),
        createdBy: userEmail,
        createdAt: new Date().toISOString(),
        isPostSettlement: false,
        ledgerRecorded: false // Folded into netSettledAmount and posted during SETTLEMENT_CLOSED
      };

      transaction.set(adjDocRef, adjustmentDoc);

      transaction.update(batchRef, {
        adjustmentAmount: newAdjustment,
        netSettledAmount: newNet,
        updatedAt: new Date().toISOString()
      });

      return {
        batch: {
          ...batchData,
          adjustmentAmount: newAdjustment,
          netSettledAmount: newNet
        },
        adjustmentDoc
      };
    });

    await logAudit(
      userId,
      "SETTLEMENT_ADJUSTMENT_CREATED",
      "settlementBatches",
      id,
      {
        adjustmentId,
        amount,
        type,
        direction: adjDirection,
        reason
      },
      ipAddress
    );

    return res.status(200).json({
      success: true,
      message: "Adjustment berhasil ditambahkan ke batch settlement.",
      data: result.adjustmentDoc
    });
  } catch (err: any) {
    if (err.message === "BATCH_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Batch settlement tidak ditemukan." });
    }
    if (err.message === "BATCH_ALREADY_SETTLED") {
      return res.status(400).json({ success: false, message: "Batch yang sudah Settled tidak dapat diubah via pre-settlement adjustment. Gunakan post-settlement adjustment." });
    }
    return res.status(500).json({ success: false, message: err.message || "Failed to add adjustment." });
  }
}

export async function addPostSettlementAdjustment(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { amount, type, direction = "POSITIVE", reason } = req.body;
    const userId = req.user.uid;
    const userEmail = req.user.email || userId;
    const ipAddress = req.ip || "";

    if (!amount || typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "Amount harus berupa integer IDR positif." });
    }

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ success: false, message: "Reason penyesuaian wajib diisi." });
    }

    const validTypes: SettlementAdjustmentType[] = [
      'MDR_CORRECTION',
      'BANK_FEE',
      'REVENUE_ADJUSTMENT',
      'RECEIVABLE_WRITE_OFF',
      'OTHER'
    ];

    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: "Tipe adjustment tidak valid." });
    }

    if (type === "OTHER") {
      return res.status(400).json({
        success: false,
        message: "Tipe adjustment 'OTHER' tidak memiliki mapping GL otomatis. Mohon pilih tipe yang terklasifikasi."
      });
    }

    const validDirections = ["POSITIVE", "NEGATIVE"];
    const adjDirection = validDirections.includes(direction) ? direction : "POSITIVE";

    const adjustmentId = `sett_adj_${id}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const result = await adminDb.runTransaction(async (transaction) => {
      const batchRef = adminDb.collection("settlementBatches").doc(id);
      const batchSnap = await transaction.get(batchRef);

      if (!batchSnap.exists) {
        throw new Error("BATCH_NOT_FOUND");
      }

      const batchData = batchSnap.data() as SettlementBatch;

      if (batchData.status !== "SETTLED") {
        throw new Error("BATCH_NOT_SETTLED");
      }

      // Post-settlement adjustment document: immutable event, does NOT mutate historical batch totals
      const adjDocRef = batchRef.collection("adjustments").doc(adjustmentId);
      const adjustmentDoc: SettlementAdjustment = {
        id: adjustmentId,
        batchId: id,
        amount,
        type: type as SettlementAdjustmentType,
        direction: adjDirection as "POSITIVE" | "NEGATIVE",
        reason: reason.trim(),
        createdBy: userEmail,
        createdAt: new Date().toISOString(),
        isPostSettlement: true,
        ledgerRecorded: true
      };

      transaction.set(adjDocRef, adjustmentDoc);

      return adjustmentDoc;
    });

    await logAudit(
      userId,
      "POST_SETTLEMENT_ADJUSTMENT_CREATED",
      "settlementBatches",
      id,
      {
        adjustmentId,
        amount,
        type,
        direction: adjDirection,
        reason
      },
      ipAddress
    );

    // Post-commit Ledger Hook: Post independent financial journal entry for post-settlement adjustment
    await safeRecordTypedSettlementAdjustment(
      id,
      adjustmentId,
      amount,
      type as SettlementAdjustmentType,
      adjDirection as "POSITIVE" | "NEGATIVE",
      reason.trim(),
      userEmail,
      { isPostSettlement: true }
    );

    return res.status(200).json({
      success: true,
      message: "Post-settlement adjustment berhasil dicatat dan diposting ke Ledger.",
      data: result
    });
  } catch (err: any) {
    if (err.message === "BATCH_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Batch settlement tidak ditemukan." });
    }
    if (err.message === "BATCH_NOT_SETTLED") {
      return res.status(400).json({ success: false, message: "Hanya batch berstatus SETTLED yang dapat diposting post-settlement adjustment." });
    }
    return res.status(500).json({ success: false, message: err.message || "Failed to add post-settlement adjustment." });
  }
}

export async function reconcileSettlementAdjustments(req: AuthenticatedRequest, res: Response) {
  try {
    const batchesSnap = await adminDb.collection("settlementBatches").get();
    let reconciledCount = 0;

    for (const batchDoc of batchesSnap.docs) {
      const batchId = batchDoc.id;
      const adjsSnap = await adminDb.collection("settlementBatches").doc(batchId).collection("adjustments").get();

      for (const adjDoc of adjsSnap.docs) {
        const adj = adjDoc.data() as SettlementAdjustment;
        if (adj.isPostSettlement && adj.type !== "OTHER") {
          const res = await safeRecordTypedSettlementAdjustment(
            batchId,
            adj.id,
            adj.amount,
            adj.type,
            adj.direction,
            adj.reason,
            adj.createdBy,
            { reconciledAt: new Date().toISOString() }
          );
          if (res && !res.duplicate) {
            reconciledCount++;
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Reconciled ${reconciledCount} missing post-settlement adjustment ledger entries.`,
      reconciledCount
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Reconciliation failed." });
  }
}
