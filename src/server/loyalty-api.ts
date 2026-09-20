import { Response } from "express";
import { AuthenticatedRequest } from "./middleware.js";
import { LoyaltyService } from "./loyalty-service.js";
import { AuditLogRepository } from "./supabase/audit-log-repository.js";

const loyaltyService = LoyaltyService.getInstance();

async function logAudit(req: AuthenticatedRequest, action: string, resource: string, resourceId: string, payload: any) {
  await AuditLogRepository.getInstance().createLog({
    actor: { uid: req.user?.uid || "system", email: req.user?.email || "system" },
    role: req.user?.role || "admin",
    action,
    target: `${resource}/${resourceId}`,
    after: payload,
    reason: payload?.reason || "Loyalty operation",
    timestamp: new Date().toISOString()
  });
}

export async function getLoyaltyConfigAdmin(req: AuthenticatedRequest, res: Response) {
  try {
    const config = await loyaltyService.getConfig();
    return res.status(200).json({ success: true, data: config });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateLoyaltyConfigAdmin(req: AuthenticatedRequest, res: Response) {
  try {
    const updated = await loyaltyService.updateConfig(req.body, req.user.uid);
    await logAudit(req, "UPDATE_LOYALTY_CONFIG", "loyaltyConfigs", "main", updated);
    return res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAllLoyaltyTransactionsAdmin(req: AuthenticatedRequest, res: Response) {
  try {
    const txs = await loyaltyService.getAllTransactions();
    return res.status(200).json({ success: true, data: txs });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function adjustCustomerPointsAdmin(req: AuthenticatedRequest, res: Response) {
  try {
    const { customerId, points, reason } = req.body;
    const tx = await loyaltyService.adminAdjustPoints(customerId, Number(points), reason, req.user.uid);
    await logAudit(req, "POINTS_ADJUSTMENT", "pointTransactions", tx.id, { customerId, points, reason });
    return res.status(201).json({ success: true, data: tx });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getCustomerPointsInfo(req: AuthenticatedRequest, res: Response) {
  try {
    const customerId = req.user.uid;
    const balance = await loyaltyService.getCustomerBalance(customerId);
    const transactions = await loyaltyService.getCustomerTransactions(customerId);
    const config = await loyaltyService.getConfig();
    return res.status(200).json({
      success: true,
      data: {
        balance,
        transactions,
        config: {
          redeemRateIdr: config.redeemRateIdr,
          minRedeemPoints: config.minRedeemPoints,
          maxRedeemPercent: config.maxRedeemPercent
        }
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
