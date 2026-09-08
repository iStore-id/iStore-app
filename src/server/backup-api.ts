import { Response } from "express";
import { AuthenticatedRequest } from "./middleware";
import { getBackupStatus, triggerManualBackup } from "./backup-service";

export async function getAdminBackupStatusApi(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = {
      uid: req.user.uid,
      email: req.user.email
    };
    const role = req.user.role || 'admin';
    const status = await getBackupStatus(actor, role);
    res.json({ success: true, data: status });
  } catch (error: any) {
    console.error("[BackupApi] Get Status Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch backup status", error: error.message });
  }
}

export async function triggerAdminBackupApi(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = {
      uid: req.user.uid,
      email: req.user.email
    };
    const role = req.user.role || 'admin';
    await triggerManualBackup(actor, role);
    // Code should not reach here since it throws
    res.json({ success: true, message: "Backup triggered successfully" });
  } catch (error: any) {
    console.error("[BackupApi] Trigger Backup Error:", error);
    // Note: returning 400 or 501 for not implemented/external infra required
    res.status(501).json({ success: false, message: error.message });
  }
}
