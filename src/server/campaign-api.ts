import { Request, Response } from "express";
import { AuthenticatedRequest } from "./middleware";
import { CampaignService } from "./campaign-service";
import { AuditLogRepository } from "./supabase/audit-log-repository";

const campaignService = CampaignService.getInstance();

async function logAudit(req: AuthenticatedRequest, action: string, resourceId: string, payload: any) {
  await AuditLogRepository.getInstance().createLog({
    actor: { uid: req.user?.uid || "system", email: req.user?.email || "system" },
    role: req.user?.role || "admin",
    action,
    target: `campaigns/${resourceId}`,
    after: payload,
    reason: payload?.reason || "Campaign operation",
    timestamp: new Date().toISOString()
  });
}

export async function getPublicCampaignsApi(req: Request, res: Response) {
  try {
    const campaigns = await campaignService.getPublicCampaigns();
    // Sanitize public response (exclude admin metadata, createdBy, updatedBy, internal notes)
    const sanitized = campaigns.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      slug: c.slug,
      mediaUrl: c.mediaUrl,
      promoIds: c.promoIds,
      flashSaleIds: c.flashSaleIds,
      bannerIds: c.bannerIds,
      popupIds: c.popupIds,
      targetType: c.targetType,
      targetId: c.targetId,
      targetUrl: c.targetUrl,
      priority: c.priority,
      startAt: c.startAt,
      endAt: c.endAt,
      status: c.status
    }));
    return res.status(200).json({ success: true, data: sanitized });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getPublicCampaignDetailApi(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const campaign = await campaignService.getCampaignById(id);
    if (!campaign || !campaign.published || !campaign.enabled || campaign.isArchived || campaign.status !== 'ACTIVE') {
      return res.status(404).json({ success: false, message: "Campaign tidak ditemukan atau tidak aktif." });
    }
    const sanitized = {
      id: campaign.id,
      title: campaign.title,
      description: campaign.description,
      slug: campaign.slug,
      mediaUrl: campaign.mediaUrl,
      promoIds: campaign.promoIds,
      flashSaleIds: campaign.flashSaleIds,
      bannerIds: campaign.bannerIds,
      popupIds: campaign.popupIds,
      targetType: campaign.targetType,
      targetId: campaign.targetId,
      targetUrl: campaign.targetUrl,
      priority: campaign.priority,
      startAt: campaign.startAt,
      endAt: campaign.endAt,
      status: campaign.status
    };
    return res.status(200).json({ success: true, data: sanitized });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAdminCampaignsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const includeArchived = req.query.includeArchived !== 'false';
    const campaigns = await campaignService.getCampaigns(includeArchived);
    return res.status(200).json({ success: true, data: campaigns });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getCampaignComponentsDataApi(req: AuthenticatedRequest, res: Response) {
  try {
    const components = await campaignService.getAvailableComponents();
    return res.status(200).json({ success: true, data: components });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function createCampaignApi(req: AuthenticatedRequest, res: Response) {
  try {
    const campaign = await campaignService.createCampaign(req.body, req.user.uid);
    await logAudit(req, "CAMPAIGN_CREATE", campaign.id, {
      name: campaign.name,
      title: campaign.title,
      startAt: campaign.startAt,
      endAt: campaign.endAt,
      promoIds: campaign.promoIds,
      flashSaleIds: campaign.flashSaleIds,
      bannerIds: campaign.bannerIds,
      popupIds: campaign.popupIds
    });
    return res.status(201).json({ success: true, data: campaign });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function updateCampaignApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const updated = await campaignService.updateCampaign(id, req.body, req.user.uid);
    await logAudit(req, "CAMPAIGN_UPDATE", id, req.body);
    return res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function archiveCampaignApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const archived = await campaignService.archiveCampaign(id, req.user.uid);
    await logAudit(req, "CAMPAIGN_ARCHIVE", id, { isArchived: true });
    return res.status(200).json({ success: true, data: archived });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function deleteCampaignApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await campaignService.deleteCampaign(id);
    await logAudit(req, "CAMPAIGN_DELETE", id, {});
    return res.status(200).json({ success: true, message: "Campaign berhasil dihapus." });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}
