import { Response } from "express";
import { BusinessCalendarService } from "./business-calendar-service.js";
import { AuthenticatedRequest } from "./middleware.js";
import { logCoreAudit } from "./core-service.js";

const calendarService = BusinessCalendarService.getInstance();

export async function getCalendarConfig(req: AuthenticatedRequest, res: Response) {
  try {
    const config = await calendarService.getConfig();
    const exceptions = await calendarService.getAllExceptionsAdmin();
    return res.json({ success: true, data: { config, exceptions } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateCalendarConfig(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = { uid: req.user.uid, email: req.user.email || req.user.uid };
    const before = await calendarService.getConfig();
    await calendarService.updateConfig(req.body, req.user.uid);
    const after = await calendarService.getConfig();
    
    await logCoreAudit(actor, req.user.role || "admin", "UPDATE_CALENDAR_CONFIG", "businessCalendarConfig/default", before, after, "Updated business calendar config");
    
    return res.json({ success: true, message: "Calendar config updated" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function upsertCalendarException(req: AuthenticatedRequest, res: Response) {
  try {
    const actor = { uid: req.user.uid, email: req.user.email || req.user.uid };
    const { id } = req.body;
    
    let before = null;
    if (id) {
      before = await calendarService.getExceptionById(id);
    }
    
    await calendarService.upsertException(req.body, req.user.uid);
    
    await logCoreAudit(actor, req.user.role || "admin", id ? "UPDATE_CALENDAR_EXCEPTION" : "CREATE_CALENDAR_EXCEPTION", `businessCalendarExceptions/${id || 'new'}`, before, req.body, "Upserted calendar exception");
    
    return res.json({ success: true, message: "Calendar exception saved" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteCalendarException(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const actor = { uid: req.user.uid, email: req.user.email || req.user.uid };
    
    const before = await calendarService.getExceptionById(id);
    
    await calendarService.deleteException(id);
    
    await logCoreAudit(actor, req.user.role || "admin", "DELETE_CALENDAR_EXCEPTION", `businessCalendarExceptions/${id}`, before, null, "Deleted calendar exception");
    
    return res.json({ success: true, message: "Calendar exception deleted" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getCalendarPreview(req: AuthenticatedRequest, res: Response) {
  try {
    const { timestamp } = req.query;
    const date = timestamp ? new Date(timestamp as string) : new Date();
    await calendarService.ensureLoaded();
    const status = calendarService.isOpen(date);
    return res.json({ success: true, data: { ...status, timestamp: date.toISOString() } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
