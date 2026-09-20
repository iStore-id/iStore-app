import { Response } from "express";
import { AuthenticatedRequest } from "./middleware.js";
import { SupabaseCatalogSyncService } from "./supabase/catalog-sync-service.js";

/**
 * Controller for Supabase Catalog Sync (STEP 4.5B)
 * 
 * Strict Invariants:
 * - Requires Admin authentication with 'providers' permission.
 * - Supports DRY_RUN and bounded LIVE_TEST (hard cap 10 items).
 * - Live test only executes when explicitly invoked with mode === 'LIVE_TEST'.
 */
export async function triggerSupabaseCatalogSyncApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { providerId, mode, filterCode, limit } = req.body;

    if (!providerId || (providerId !== "tokovoucher" && providerId !== "apigames")) {
      return res.status(400).json({
        success: false,
        message: "Invalid providerId. Must be either 'tokovoucher' or 'apigames'.",
      });
    }

    if (!mode || (mode !== "DRY_RUN" && mode !== "LIVE_TEST")) {
      return res.status(400).json({
        success: false,
        message: "Invalid mode. Must be either 'DRY_RUN' or 'LIVE_TEST'.",
      });
    }

    const syncService = SupabaseCatalogSyncService.getInstance();
    const result = await syncService.executeSync({
      providerId,
      mode,
      filterCode: typeof filterCode === "string" ? filterCode.trim() : undefined,
      limit: typeof limit === "number" ? Math.min(10, Math.max(1, limit)) : 10,
    });

    return res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    console.error("[Supabase Catalog Sync Error]:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to execute catalog sync",
    });
  }
}
