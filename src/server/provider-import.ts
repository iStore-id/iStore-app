import { supabaseAdmin } from "./supabase-admin";
import { Request, Response } from "express";

interface AuthenticatedRequest extends Request {
  user?: any;
}

export async function getAllProviderSkus(req: AuthenticatedRequest, res: Response) {
  try {
    const { providerId } = req.params;
    const { data } = await supabaseAdmin!.from("provider_skus").select("*").eq("provider_id", providerId);
    return res.status(200).json({ success: true, data: data || [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function validateBulkImport(req: AuthenticatedRequest, res: Response) {
  return res.status(200).json({ success: true, validCount: 0, invalidCount: 0, errors: [] });
}

export async function commitBulkImport(req: AuthenticatedRequest, res: Response) {
  return res.status(200).json({ success: true, count: 0 });
}

export async function cleanupStaleSessions() {
  // stub
}
