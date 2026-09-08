import { Response } from "express";
import { AuthenticatedRequest } from "./middleware";
import { CustomerService } from "./customer-service";
import { CustomerStatus } from "../types/customer";
import { adminDb } from "./firebase-admin";

const customerService = CustomerService.getInstance();

async function getActorRole(uid: string): Promise<string> {
  const userDoc = await adminDb.collection("users").doc(uid).get();
  return userDoc.exists ? userDoc.data()?.role || "admin" : "admin";
}

/**
 * GET /api/admin/customers
 * Returns paginated customer directory with aggregations and metrics
 */
export async function getCustomersDirectoryApi(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      search,
      status,
      role,
      tag,
      page,
      limit,
      sortBy,
      sortOrder,
      cursor
    } = req.query;

    const query = {
      search: search ? String(search) : undefined,
      status: status ? String(status) : undefined,
      role: role ? String(role) : undefined,
      tag: tag ? String(tag) : undefined,
      page: page ? parseInt(String(page), 10) : 1,
      limit: limit ? parseInt(String(limit), 10) : 20,
      sortBy: (sortBy as any) || "createdAt",
      sortOrder: (sortOrder as any) || "desc",
      cursor: cursor ? String(cursor) : undefined
    };

    const result = await customerService.getCustomerDirectory(query, true);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error("[Customer API Error] getCustomersDirectoryApi:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to load customers" });
  }
}

/**
 * GET /api/admin/customers/:id
 * Returns Customer 360° Profile detail
 */
export async function getCustomer360ProfileApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const actor = { uid: req.user.uid, email: req.user.email };
    const actorRole = await getActorRole(actor.uid);

    const profile = await customerService.getCustomer360Profile(id, actor, actorRole, true);
    return res.status(200).json({ success: true, data: profile });
  } catch (error: any) {
    console.error(`[Customer API Error] getCustomer360ProfileApi (${req.params.id}):`, error);
    return res.status(error.message?.includes("not found") ? 404 : 500).json({
      success: false,
      message: error.message || "Failed to load customer profile"
    });
  }
}

/**
 * POST /api/admin/customers/:id/status
 * Updates customer account lifecycle status (ACTIVE, SUSPENDED, DISABLED)
 */
export async function updateCustomerStatusApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: "Status parameter is required" });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: "Reason for status change is mandatory" });
    }

    const actor = { uid: req.user.uid, email: req.user.email };
    const actorRole = await getActorRole(actor.uid);

    const updated = await customerService.updateCustomerStatus(
      id, 
      status as CustomerStatus, 
      reason, 
      actor, 
      actorRole
    );

    return res.status(200).json({ 
      success: true, 
      message: `Status pelanggan berhasil diubah menjadi ${status}`,
      data: updated 
    });
  } catch (error: any) {
    console.error(`[Customer API Error] updateCustomerStatusApi (${req.params.id}):`, error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update customer status"
    });
  }
}

/**
 * POST /api/admin/customers/:id/notes
 * Adds an internal note to the customer account
 */
export async function addCustomerNoteApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, message: "Catatan tidak boleh kosong" });
    }

    const actor = { uid: req.user.uid, email: req.user.email };
    const actorRole = await getActorRole(actor.uid);

    const createdNote = await customerService.addCustomerNote(id, note, actor, actorRole);
    return res.status(201).json({ success: true, data: createdNote });
  } catch (error: any) {
    console.error(`[Customer API Error] addCustomerNoteApi (${req.params.id}):`, error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to add customer note"
    });
  }
}

/**
 * PUT /api/admin/customers/:id/tags
 * Updates tags for customer
 */
export async function updateCustomerTagsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { tags } = req.body;

    if (!Array.isArray(tags)) {
      return res.status(400).json({ success: false, message: "Tags must be an array of strings" });
    }

    const actor = { uid: req.user.uid, email: req.user.email };
    const actorRole = await getActorRole(actor.uid);

    const updatedTags = await customerService.updateCustomerTags(id, tags, actor, actorRole);
    return res.status(200).json({ success: true, data: updatedTags });
  } catch (error: any) {
    console.error(`[Customer API Error] updateCustomerTagsApi (${req.params.id}):`, error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update customer tags"
    });
  }
}

/**
 * POST /api/admin/customers/:id/unmask
 * Privileged unmask of PII data (audit logged)
 */
export async function unmaskCustomerPiiApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const actor = { uid: req.user.uid, email: req.user.email };
    const actorRole = await getActorRole(actor.uid);

    const unmasked = await customerService.unmaskCustomerPii(id, actor, actorRole);
    return res.status(200).json({ success: true, data: unmasked });
  } catch (error: any) {
    console.error(`[Customer API Error] unmaskCustomerPiiApi (${req.params.id}):`, error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to unmask customer PII"
    });
  }
}

/**
 * POST /api/admin/customers/export
 * Exports customer directory to CSV (audit logged)
 */
export async function exportCustomersCsvApi(req: AuthenticatedRequest, res: Response) {
  try {
    const query = req.body || {};
    const actor = { uid: req.user.uid, email: req.user.email };
    const actorRole = await getActorRole(actor.uid);

    const csvData = await customerService.exportCustomersCsv(query, actor, actorRole);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=istore-customers-${Date.now()}.csv`);
    return res.status(200).send(csvData);
  } catch (error: any) {
    console.error("[Customer API Error] exportCustomersCsvApi:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to export customer directory"
    });
  }
}
