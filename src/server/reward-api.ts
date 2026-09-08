import { Request, Response } from "express";
import { AuthenticatedRequest } from "./middleware";
import { RewardService } from "./reward-service";
import { adminDb } from "./firebase-admin";

const rewardService = RewardService.getInstance();

async function logAudit(req: AuthenticatedRequest, action: string, resource: string, resourceId: string, payload: any) {
  const auditRef = adminDb.collection("auditLogs").doc();
  await auditRef.set({
    id: auditRef.id,
    actorUid: req.user?.uid || "system",
    actorEmail: req.user?.email || "system",
    action,
    resource,
    resourceId,
    payload,
    timestamp: new Date().toISOString()
  });
}

export async function getPublicRewards(req: Request, res: Response) {
  try {
    const rewards = await rewardService.getAllRewards(false);
    return res.status(200).json({ success: true, data: rewards });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function redeemCustomerReward(req: AuthenticatedRequest, res: Response) {
  try {
    const customerId = req.user.uid;
    const { rewardId } = req.body;
    if (!rewardId) {
      return res.status(400).json({ success: false, message: "Reward ID wajib diisi." });
    }

    const redemption = await rewardService.redeemReward(customerId, rewardId);
    await logAudit(req, "REWARD_REDEMPTION", "rewardRedemptions", redemption.id, { rewardId, customerId, pointsCost: redemption.pointsCost });

    return res.status(201).json({ success: true, data: redemption });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || "Gagal menukar reward" });
  }
}

export async function getCustomerRedemptionsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const customerId = req.user.uid;
    const redemptions = await rewardService.getCustomerRedemptions(customerId);
    return res.status(200).json({ success: true, data: redemptions });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAdminRewards(req: AuthenticatedRequest, res: Response) {
  try {
    const rewards = await rewardService.getAllRewards(true);
    return res.status(200).json({ success: true, data: rewards });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function createAdminReward(req: AuthenticatedRequest, res: Response) {
  try {
    const reward = await rewardService.createReward(req.body);
    await logAudit(req, "CREATE_REWARD", "rewards", reward.id, reward);
    return res.status(201).json({ success: true, data: reward });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateAdminReward(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const reward = await rewardService.updateReward(id, req.body);
    await logAudit(req, "UPDATE_REWARD", "rewards", id, reward);
    return res.status(200).json({ success: true, data: reward });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function deleteAdminReward(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await rewardService.deleteReward(id);
    await logAudit(req, "DEACTIVATE_REWARD", "rewards", id, {});
    return res.status(200).json({ success: true, message: "Reward berhasil dinonaktifkan." });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAdminRedemptions(req: AuthenticatedRequest, res: Response) {
  try {
    const redemptions = await rewardService.getAllRedemptions();
    return res.status(200).json({ success: true, data: redemptions });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
