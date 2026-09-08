import { Request, Response } from "express";
import { AuthenticatedRequest } from "./middleware";
import { getFeatureFlags, updateFeatureFlags, FeatureFlag } from "./feature-flag-service";

export async function getAdminFeatureFlags(req: AuthenticatedRequest, res: Response) {
  try {
    const flags = await getFeatureFlags();
    res.json({ success: true, data: flags });
  } catch (error: any) {
    console.error("[FeatureFlagApi] Get Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch feature flags", error: error.message });
  }
}

export async function updateAdminFeatureFlags(req: AuthenticatedRequest, res: Response) {
  try {
    const { flags } = req.body;
    if (!Array.isArray(flags)) {
      return res.status(400).json({ success: false, message: "Invalid payload: 'flags' must be an array" });
    }

    // Validation
    for (const f of flags) {
      if (typeof f.key !== 'string' || typeof f.enabled !== 'boolean' || typeof f.name !== 'string') {
        return res.status(400).json({ success: false, message: "Invalid payload: flag items must have key, enabled, and name" });
      }
    }

    const actor = {
      uid: req.user.uid,
      email: req.user.email
    };
    const role = req.user.role || 'admin';

    const updated = await updateFeatureFlags(actor, role, flags as FeatureFlag[]);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("[FeatureFlagApi] Update Error:", error);
    res.status(500).json({ success: false, message: "Failed to update feature flags", error: error.message });
  }
}
