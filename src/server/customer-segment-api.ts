import express, { Response } from "express";
import { AuthenticatedRequest, requireAuth, requirePermission } from "./middleware";
import { CustomerSegmentService } from "./customer-segment-service";
import { SEGMENT_FIELD_CATALOG } from "../types/customer-segment";

export const customerSegmentRouter = express.Router();
const segmentService = CustomerSegmentService.getInstance();

/**
 * Helper to extract actor from request
 */
function getActor(req: AuthenticatedRequest) {
  return {
    uid: req.user?.uid || "system",
    email: req.user?.email || "system@istore.co.id"
  };
}

function getActorRole(req: AuthenticatedRequest) {
  return req.user?.role || "admin";
}

/**
 * GET /api/admin/customer-segments/field-catalog
 * Get field catalog metadata for the dynamic rule builder
 */
customerSegmentRouter.get("/field-catalog", requireAuth, requirePermission("users", "view"), (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: SEGMENT_FIELD_CATALOG
  });
});

/**
 * GET /api/admin/customer-segments
 * List customer segments with search, filter, pagination, and metrics
 */
customerSegmentRouter.get("/", requireAuth, requirePermission("users", "view"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      search = "",
      type = "ALL",
      status = "ALL",
      page = "1",
      limit = "20",
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    const result = await segmentService.getSegments({
      search: search as string,
      type: type as any,
      status: status as any,
      page: parseInt(page as string, 10) || 1,
      limit: parseInt(limit as string, 10) || 20,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any
    });

    res.json({
      success: true,
      ...result
    });
  } catch (err: any) {
    console.error("[Get Customer Segments Error]", err);
    res.status(500).json({ success: false, message: err.message || "Gagal memuat daftar segmen pelanggan." });
  }
});

/**
 * POST /api/admin/customer-segments
 * Create a new customer segment (Static or Dynamic)
 */
customerSegmentRouter.post("/", requireAuth, requirePermission("users", "create"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actor = getActor(req);
    const actorRole = getActorRole(req);
    const { name, description, type, ruleGroup, initialMembers } = req.body;

    const segment = await segmentService.createSegment(
      { name, description, type, ruleGroup, initialMembers },
      actor,
      actorRole
    );

    res.status(201).json({
      success: true,
      message: `Segmen '${segment.name}' berhasil dibuat.`,
      data: segment
    });
  } catch (err: any) {
    console.error("[Create Customer Segment Error]", err);
    res.status(400).json({ success: false, message: err.message || "Gagal membuat segmen pelanggan." });
  }
});

/**
 * GET /api/admin/customer-segments/:id
 * Get segment details by ID
 */
customerSegmentRouter.get("/:id", requireAuth, requirePermission("users", "view"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const segment = await segmentService.getSegmentById(req.params.id);
    if (!segment) {
      return res.status(404).json({ success: false, message: "Segmen tidak ditemukan." });
    }

    res.json({
      success: true,
      data: segment
    });
  } catch (err: any) {
    console.error("[Get Segment Detail Error]", err);
    res.status(500).json({ success: false, message: err.message || "Gagal memuat detail segmen." });
  }
});

/**
 * PUT /api/admin/customer-segments/:id
 * Update segment metadata or dynamic ruleGroup
 */
customerSegmentRouter.put("/:id", requireAuth, requirePermission("users", "edit"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actor = getActor(req);
    const actorRole = getActorRole(req);
    const { name, description, ruleGroup } = req.body;

    const updated = await segmentService.updateSegment(
      req.params.id,
      { name, description, ruleGroup },
      actor,
      actorRole
    );

    res.json({
      success: true,
      message: `Segmen '${updated.name}' berhasil diperbarui.`,
      data: updated
    });
  } catch (err: any) {
    console.error("[Update Segment Error]", err);
    res.status(400).json({ success: false, message: err.message || "Gagal memperbarui segmen." });
  }
});

/**
 * POST /api/admin/customer-segments/:id/activate
 * Activate a segment
 */
customerSegmentRouter.post("/:id/activate", requireAuth, requirePermission("users", "edit"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actor = getActor(req);
    const actorRole = getActorRole(req);

    const segment = await segmentService.activateSegment(req.params.id, actor, actorRole);
    res.json({
      success: true,
      message: `Segmen '${segment.name}' sekarang AKTIF.`,
      data: segment
    });
  } catch (err: any) {
    console.error("[Activate Segment Error]", err);
    res.status(400).json({ success: false, message: err.message || "Gagal mengaktifkan segmen." });
  }
});

/**
 * POST /api/admin/customer-segments/:id/deactivate
 * Deactivate a segment
 */
customerSegmentRouter.post("/:id/deactivate", requireAuth, requirePermission("users", "edit"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actor = getActor(req);
    const actorRole = getActorRole(req);

    const segment = await segmentService.deactivateSegment(req.params.id, actor, actorRole);
    res.json({
      success: true,
      message: `Segmen '${segment.name}' dinonaktifkan.`,
      data: segment
    });
  } catch (err: any) {
    console.error("[Deactivate Segment Error]", err);
    res.status(400).json({ success: false, message: err.message || "Gagal menonaktifkan segmen." });
  }
});

/**
 * POST /api/admin/customer-segments/:id/evaluate
 * Trigger on-demand rule evaluation for dynamic segment
 */
customerSegmentRouter.post("/:id/evaluate", requireAuth, requirePermission("users", "edit"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actor = getActor(req);
    const actorRole = getActorRole(req);

    const result = await segmentService.evaluateSegment(req.params.id, actor, actorRole);
    const updated = await segmentService.getSegmentById(req.params.id);

    res.json({
      success: true,
      message: `Evaluasi selesai: ${result.qualifiedCount} pelanggan memenuhi kualifikasi (${result.disqualifiedCount} dikeluarkan).`,
      data: updated,
      metrics: result
    });
  } catch (err: any) {
    console.error("[Evaluate Segment Error]", err);
    res.status(400).json({ success: false, message: err.message || "Gagal melakukan evaluasi aturan segmen." });
  }
});

/**
 * GET /api/admin/customer-segments/:id/members
 * Get segment members with masked PII, pagination, and search
 */
customerSegmentRouter.get("/:id/members", requireAuth, requirePermission("users", "view"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search = "", status = "ACTIVE", page = "1", limit = "20" } = req.query;

    const result = await segmentService.getSegmentMembers(
      req.params.id,
      {
        search: search as string,
        status: status as any,
        page: parseInt(page as string, 10) || 1,
        limit: parseInt(limit as string, 10) || 20
      },
      true // Mask PII by default
    );

    res.json({
      success: true,
      ...result
    });
  } catch (err: any) {
    console.error("[Get Segment Members Error]", err);
    res.status(500).json({ success: false, message: err.message || "Gagal memuat anggota segmen." });
  }
});

/**
 * POST /api/admin/customer-segments/:id/members
 * Add a static member by UID
 */
customerSegmentRouter.post("/:id/members", requireAuth, requirePermission("users", "edit"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actor = getActor(req);
    const actorRole = getActorRole(req);
    const { customerUid } = req.body;

    if (!customerUid || typeof customerUid !== "string") {
      return res.status(400).json({ success: false, message: "Field 'customerUid' wajib diisi." });
    }

    const membership = await segmentService.addStaticMember(req.params.id, customerUid.trim(), actor, actorRole);
    res.json({
      success: true,
      message: "Anggota berhasil ditambahkan ke segmen statis.",
      data: membership
    });
  } catch (err: any) {
    console.error("[Add Static Member Error]", err);
    res.status(400).json({ success: false, message: err.message || "Gagal menambahkan anggota segmen." });
  }
});

/**
 * DELETE /api/admin/customer-segments/:id/members/:uid
 * Remove a static member by UID
 */
customerSegmentRouter.delete("/:id/members/:uid", requireAuth, requirePermission("users", "edit"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actor = getActor(req);
    const actorRole = getActorRole(req);

    const result = await segmentService.removeStaticMember(req.params.id, req.params.uid, actor, actorRole);
    res.json({
      success: true,
      message: result.message
    });
  } catch (err: any) {
    console.error("[Remove Static Member Error]", err);
    res.status(400).json({ success: false, message: err.message || "Gagal mengeluarkan anggota dari segmen." });
  }
});

/**
 * POST /api/admin/customer-segments/:id/export
 * Export segment members to CSV
 */
customerSegmentRouter.post("/:id/export", requireAuth, requirePermission("users", "export"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actor = getActor(req);
    const actorRole = getActorRole(req);

    const csvContent = await segmentService.exportSegmentMembersCsv(req.params.id, actor, actorRole);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="segment_${req.params.id}_members.csv"`);
    res.status(200).send(csvContent);
  } catch (err: any) {
    console.error("[Export Segment Members Error]", err);
    res.status(500).json({ success: false, message: err.message || "Gagal mengekspor data anggota segmen." });
  }
});

/**
 * DELETE /api/admin/customer-segments/:id
 * Delete a customer segment
 */
customerSegmentRouter.delete("/:id", requireAuth, requirePermission("users", "delete"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actor = getActor(req);
    const actorRole = getActorRole(req);

    const result = await segmentService.deleteSegment(req.params.id, actor, actorRole);
    res.json({
      success: true,
      message: result.message
    });
  } catch (err: any) {
    console.error("[Delete Segment Error]", err);
    res.status(400).json({ success: false, message: err.message || "Gagal menghapus segmen." });
  }
});
