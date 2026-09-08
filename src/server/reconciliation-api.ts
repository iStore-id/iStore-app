import { Response } from "express";
import { AuthenticatedRequest } from "./middleware";
import { adminDb } from "./firebase-admin";
import { reconcileOrder, runReconciliationBatch } from "./reconciliation-service";
import { logCoreAudit } from "./core-service";

export async function getReconciliationOverviewApi(req: AuthenticatedRequest, res: Response) {
  try {
    const [
      totalRuns,
      totalRecordsChecked,
      openMismatches,
      resolvedMismatches,
      statusMismatchCount,
      amountMismatchCount,
      providerPendingCount,
      lastRunSnap
    ] = await Promise.all([
      adminDb.collection("reconciliationRuns").count().get().then(s => s.data().count),
      adminDb.collection("reconciliationRecords").count().get().then(s => s.data().count),
      adminDb.collection("reconciliationRecords").where("resolution", "==", "OPEN").count().get().then(s => s.data().count),
      adminDb.collection("reconciliationRecords").where("resolution", "==", "RESOLVED").count().get().then(s => s.data().count),
      adminDb.collection("reconciliationRecords").where("mismatchType", "==", "STATUS_MISMATCH").count().get().then(s => s.data().count),
      adminDb.collection("reconciliationRecords").where("mismatchType", "==", "AMOUNT_MISMATCH").count().get().then(s => s.data().count),
      adminDb.collection("reconciliationRecords").where("mismatchType", "==", "PROVIDER_PENDING").count().get().then(s => s.data().count),
      adminDb.collection("reconciliationRuns").orderBy("createdAt", "desc").limit(1).get()
    ]);

    const lastRun = !lastRunSnap.empty ? lastRunSnap.docs[0].data() : null;

    return res.status(200).json({
      success: true,
      data: {
        totalRuns,
        totalRecordsChecked,
        openMismatches,
        resolvedMismatches,
        statusMismatchCount,
        amountMismatchCount,
        providerPendingCount,
        lastRun,
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
    const snapshot = await adminDb.collection("reconciliationRuns").orderBy("createdAt", "desc").limit(50).get();
    const runs = snapshot.docs.map(doc => doc.data());

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
    const doc = await adminDb.collection("reconciliationRuns").doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: "Reconciliation run not found" });
    }

    const recordsSnap = await adminDb.collection("reconciliationRecords").where("runId", "==", id).get();
    const records = recordsSnap.docs.map(d => d.data());

    return res.status(200).json({
      success: true,
      data: {
        run: doc.data(),
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

    let query: FirebaseFirestore.Query = adminDb.collection("reconciliationRecords");

    if (resolution && resolution !== "ALL") {
      query = query.where("resolution", "==", resolution);
    }

    if (mismatchType && mismatchType !== "ALL") {
      query = query.where("mismatchType", "==", mismatchType);
    }

    query = query.orderBy("detectedAt", "desc");

    const snapshot = await query.get();
    let records = snapshot.docs.map(doc => doc.data());

    if (search && typeof search === "string" && search.trim() !== "") {
      const term = search.toLowerCase();
      records = records.filter(r => 
        r.orderId?.toLowerCase().includes(term) ||
        r.id?.toLowerCase().includes(term) ||
        r.message?.toLowerCase().includes(term)
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

    const beforeSnap = await adminDb.collection("orders").doc(id).get();
    const beforeData = beforeSnap.exists ? beforeSnap.data() : null;

    const result = await reconcileOrder(id, actorUid);

    const afterSnap = await adminDb.collection("orders").doc(id).get();
    const afterData = afterSnap.exists ? afterSnap.data() : null;

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
      "reconciliationRuns/batch",
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
