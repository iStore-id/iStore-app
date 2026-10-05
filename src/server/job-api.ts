import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./middleware.js";
import { supabaseAdmin } from "./supabase-admin.js";
import { JobService } from "./job-service.js";

export async function listJobsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { status, type, priority, limit = "50" } = req.query;
    
    if (!supabaseAdmin) {
      return res.status(200).json({ success: true, data: [] });
    }

    let query = supabaseAdmin.from("jobs").select("*");
    
    if (status && status !== "ALL") query = query.eq("status", status);
    if (type && type !== "ALL") query = query.eq("type", type);
    if (priority && priority !== "ALL") query = query.eq("priority", priority);
    
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(parseInt(limit as string, 10));
    
    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.status(200).json({ success: true, data: data || [] });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getJobDetailApi(req: AuthenticatedRequest, res: Response) {
  try {
    if (!supabaseAdmin) {
      return res.status(404).json({ success: false, message: "Database not configured" });
    }

    const { data, error } = await supabaseAdmin
      .from("jobs")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error || !data) return res.status(404).json({ success: false, message: "Job not found" });
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function triggerWorkerApi(req: AuthenticatedRequest, res: Response) {
  try {
    const jobService = JobService.getInstance();
    const processedCount = await jobService.processBatch(10);
    return res.status(200).json({
      success: true,
      message: `Worker executed successfully. Processed ${processedCount} job(s).`,
      processedCount
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function retryJobApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    if (!supabaseAdmin) {
      return res.status(404).json({ success: false, message: "Database not configured" });
    }

    const { data: job, error } = await supabaseAdmin
      .from("jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("jobs")
      .update({
        status: "QUEUED",
        attempts: 0,
        next_retry_at: null,
        locked_at: null,
        locked_by: null,
        last_error: null,
        updated_at: now
      })
      .eq("id", id);

    // Trigger immediate execution
    JobService.getInstance().processNextJob().catch(console.error);

    return res.status(200).json({ success: true, message: `Job ${id} reset to QUEUED and worker triggered.` });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function cancelJobApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    if (!supabaseAdmin) {
      return res.status(404).json({ success: false, message: "Database not configured" });
    }

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("jobs")
      .update({
        status: "CANCELLED",
        locked_at: null,
        locked_by: null,
        updated_at: now
      })
      .eq("id", id);

    return res.status(200).json({ success: true, message: `Job ${id} cancelled successfully.` });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Authentication middleware for worker execution endpoint.
 * Strictly requires:
 * 1. Authorization: Bearer <WORKER_SECRET> or <CRON_SECRET> (dedicated worker credential)
 * 2. OR an authenticated admin user via Supabase JWT with 'system:edit' permission.
 * 
 * STRICT SECURITY CONSTRAINTS:
 * - Never accept SUPABASE_SERVICE_ROLE_KEY or SESSION_SECRET as HTTP Bearer credentials.
 * - No bypass in production.
 */
export async function workerAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";

  // 1. Dedicated worker / cron secret verification
  const dedicatedSecret = process.env.WORKER_SECRET || process.env.CRON_SECRET;
  if (dedicatedSecret && token && token === dedicatedSecret) {
    return next();
  }

  // 2. Authenticated Admin / System permission via Supabase JWT
  if (token) {
    try {
      const { verifySupabaseAccessToken } = await import("./supabase-auth-verifier.js");
      const result = await verifySupabaseAccessToken(token);
      if (result.valid && result.identity) {
        const { can, isOwnerIdentity } = await import("./auth-service.js");
        const email = (result.identity.email || "").toLowerCase();
        if (isOwnerIdentity(email) || await can(result.identity.uid, email, "system", "edit", "global")) {
          return next();
        }
      }
    } catch {
      // Ignored token failure
    }
  }

  // 3. Test bypass strictly isolated to test environment
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-bypass'] === 'supersecret') {
    return next();
  }

  return res.status(401).json({
    success: false,
    message: "Unauthorized: Invalid or missing worker authorization credentials."
  });
}

// Backward-compatible alias
export const cronWorkerAuth = workerAuth;

/**
 * Worker endpoint for bounded batch processing of eligible QUEUED/RETRYING jobs.
 * Can be called via HTTP POST or GET by external scheduler, admin trigger, or serverless invocation.
 */
export async function processWorkerBatchApi(req: Request, res: Response) {
  try {
    const jobService = JobService.getInstance();
    // Bounded batch of up to 5 jobs to stay within serverless execution budget
    const maxBatch = 5;
    const processedCount = await jobService.processBatch(maxBatch);
    const stats = await jobService.getQueueStats();

    return res.status(200).json({
      success: true,
      message: `Worker executed successfully. Processed ${processedCount} job(s).`,
      processedCount,
      queueStats: stats,
      executedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[Worker Batch Error]", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// Backward-compatible alias
export const cronProcessJobsApi = processWorkerBatchApi;

