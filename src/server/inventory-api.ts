import { Request, Response } from "express";
import { AuthenticatedRequest } from "./middleware.js";
import { InventoryService } from "./inventory-service.js";
import { AuditLogRepository } from "./supabase/audit-log-repository.js";
import { supabaseAdmin } from "./supabase-admin.js";

const inventoryService = InventoryService.getInstance();

export async function getQuotas(req: AuthenticatedRequest, res: Response) {
  try {
    const quotas = await inventoryService.getQuotas();
    return res.status(200).json({ success: true, data: quotas });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getStocks(req: AuthenticatedRequest, res: Response) {
  try {
    const stocks = await inventoryService.getAllStocks();
    return res.status(200).json({ success: true, data: stocks });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function saveQuota(req: AuthenticatedRequest, res: Response) {
  try {
    const quota = await inventoryService.saveQuota(req.body);
    
    await AuditLogRepository.getInstance().createLog({
      actor: { uid: req.user.uid, email: req.user.email || "system" },
      role: req.user.role || "admin",
      action: req.body.id ? "UPDATE_QUOTA" : "CREATE_QUOTA",
      target: `quotas/${quota.id!}`,
      after: req.body,
      reason: req.body.reason || "Quota operation",
      timestamp: new Date().toISOString()
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
    
    await AuditLogRepository.getInstance().createLog({
      actor: { uid: req.user.uid, email: req.user.email || "system" },
      role: req.user.role || "admin",
      action: "ADJUST_STOCK",
      target: `stocks/${stock.id!}`,
      after: req.body,
      reason: reason || "Manual adjustment",
      timestamp: new Date().toISOString()
    });
    return res.status(200).json({ success: true, data: stock });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getStockMovements(req: AuthenticatedRequest, res: Response) {
  try {
    const { variantId } = req.params;
    let query = supabaseAdmin!.from("stock_movements").select("*");
    
    if (variantId) {
      query = query.eq("variant_id", variantId);
    }
    
    const { data } = await query.order("created_at", { ascending: false }).limit(100);
    
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getReservations(req: AuthenticatedRequest, res: Response) {
  try {
    const { variantId } = req.params;
    let query = supabaseAdmin!.from("reservations").select("*");
    
    if (variantId) {
      query = query.eq("variant_id", variantId);
    }
    
    const { data } = await query.order("created_at", { ascending: false }).limit(100);
    
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
