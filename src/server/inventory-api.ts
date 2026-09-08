import { Request, Response } from "express";
import { adminDb } from "./firebase-admin";
import { AuthenticatedRequest } from "./middleware";
import { InventoryService } from "./inventory-service";

const inventoryService = InventoryService.getInstance();

export async function getQuotas(req: AuthenticatedRequest, res: Response) {
  try {
    const quotas = await inventoryService.getQuotas();
    return res.status(200).json({ success: true, data: quotas });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function saveQuota(req: AuthenticatedRequest, res: Response) {
  try {
    const quota = await inventoryService.saveQuota(req.body);
    
    // Log audit
    const auditRef = adminDb.collection("auditLogs").doc();
    await auditRef.set({
      id: auditRef.id,
      adminUid: req.user.uid,
      action: req.body.id ? "UPDATE_QUOTA" : "CREATE_QUOTA",
      resource: "quotas",
      resourceId: quota.id!,
      payload: req.body,
      createdAt: new Date().toISOString()
    });

    return res.status(200).json({ success: true, data: quota });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getVariantStock(req: AuthenticatedRequest, res: Response) {
  try {
    const { variantId } = req.params;
    const stock = await inventoryService.getStockForVariant(variantId);
    return res.status(200).json({ success: true, data: stock });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function adjustStock(req: AuthenticatedRequest, res: Response) {
  try {
    const { variantId } = req.params;
    const { quantityChange, reason } = req.body;
    
    if (typeof quantityChange !== 'number' || quantityChange === 0) {
      return res.status(400).json({ success: false, message: "quantityChange must be a non-zero number" });
    }

    const actor = req.user.email || req.user.uid;
    const stock = await inventoryService.adjustStock(variantId, quantityChange, actor, reason || "Manual adjustment");
    
    // Log audit
    const auditRef = adminDb.collection("auditLogs").doc();
    await auditRef.set({
      id: auditRef.id,
      adminUid: req.user.uid,
      action: "ADJUST_STOCK",
      resource: "stocks",
      resourceId: stock.id!,
      payload: req.body,
      createdAt: new Date().toISOString()
    });

    return res.status(200).json({ success: true, data: stock });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getStockMovements(req: AuthenticatedRequest, res: Response) {
  try {
    const { variantId } = req.params;
    let query = adminDb.collection("stockMovements");
    if (variantId) {
      query = query.where("variantId", "==", variantId) as any;
    }
    const snap = await query.orderBy("timestamp", "desc").limit(100).get();
    
    const data = snap.docs.map(doc => doc.data());
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getReservations(req: AuthenticatedRequest, res: Response) {
  try {
    const { variantId } = req.params;
    let query = adminDb.collection("reservations");
    if (variantId) {
      query = query.where("variantId", "==", variantId) as any;
    }
    const snap = await query.orderBy("createdAt", "desc").limit(100).get();
    
    const data = snap.docs.map(doc => doc.data());
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
