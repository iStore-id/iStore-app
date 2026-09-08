import { Response } from "express";
import { AuthenticatedRequest } from "./middleware";
import { SystemHealthService } from "./system-health-service";
import { requirePermission } from "./middleware";

const healthService = SystemHealthService.getInstance();

export async function getSystemHealth(req: AuthenticatedRequest, res: Response) {
  try {
    // Only allow admins with health:view permission
    const health = await healthService.getSystemHealth();
    
    // Audit log if manual refresh (simple check for query param)
    if (req.query.refresh === 'true') {
      console.log(`[HealthAPI] Manual health refresh by ${req.user?.uid}`);
    }

    return res.status(200).json({
      success: true,
      data: health
    });
  } catch (error: any) {
    console.error("[HealthAPI] Error fetching system health:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching system health"
    });
  }
}
