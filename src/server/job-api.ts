import { Response } from "express";
import { AuthenticatedRequest } from "./middleware";
import { supabaseAdmin } from "./supabase-admin";

export async function listJobsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { status, type, limit = "50" } = req.query;
    
    let query = supabaseAdmin!.from("jobs").select("*");
    
    if (status && status !== "ALL") query = query.eq("status", status);
    if (type && type !== "ALL") query = query.eq("type", type);
    
    const { data } = await query.order("created_at", { ascending: false }).limit(parseInt(limit as string, 10));
    
    return res.status(200).json({ success: true, data: data || [] });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getJobDetailApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { data } = await supabaseAdmin!.from("jobs").select("*").eq("id", req.params.id).maybeSingle();
    if (!data) return res.status(404).json({ success: false, message: "Not found" });
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
