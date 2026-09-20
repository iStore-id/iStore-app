import { Response } from "express";
import { SLAService } from "./sla-service.js";
import { AuthenticatedRequest } from "./middleware.js";
import { logCoreAudit } from "./core-service.js";
import { Job } from "../types/core.js";
import { OrderRepository } from "./supabase/order-repository.js";
import { supabaseAdmin } from "./supabase-admin.js";

const slaService = SLAService.getInstance();

export async function getSLAPolicies(req: AuthenticatedRequest, res: Response) {
  try {
    const policies = await slaService.getPolicies();
    return res.json({ success: true, data: policies });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createSLAPolicy(req: AuthenticatedRequest, res: Response) {
  try {
    const policy = await slaService.createPolicy(req.body, req.user!.uid);
    const actor = { uid: req.user!.uid, email: req.user!.email || req.user!.uid };
    await logCoreAudit(actor, req.user!.role || "admin", "CREATE_SLA_POLICY", `slaPolicies/${policy.id}`, null, policy, "Created SLA policy");
    return res.status(201).json({ success: true, data: policy });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateSLAPolicy(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const before = await slaService.getPolicyById(id);
    if (!before) return res.status(404).json({ success: false, message: "Policy not found" });
    await slaService.updatePolicy(id, req.body, req.user!.uid);
    const after = await slaService.getPolicyById(id);
    
    const actor = { uid: req.user!.uid, email: req.user!.email || req.user!.uid };
    await logCoreAudit(actor, req.user!.role || "admin", "UPDATE_SLA_POLICY", `slaPolicies/${id}`, before, after, "Updated SLA policy");
    
    return res.json({ success: true, message: "Policy updated" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteSLAPolicy(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const before = await slaService.getPolicyById(id);
    if (!before) return res.status(404).json({ success: false, message: "Policy not found" });
    await slaService.deletePolicy(id);
    const actor = { uid: req.user!.uid, email: req.user!.email || req.user!.uid };
    await logCoreAudit(actor, req.user!.role || "admin", "DELETE_SLA_POLICY", `slaPolicies/${id}`, before, null, "Deleted SLA policy");
    
    return res.json({ success: true, message: "Policy deleted" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getSLAMonitor(req: AuthenticatedRequest, res: Response) {
  try {
    const { status, limit = "50" } = req.query;
    const policies = await slaService.getPolicies();
    
    const orders = await OrderRepository.getInstance().getRecentOrders(parseInt(limit as string));
    const orderIds = orders.map(o => o.id);
    let allJobs: Job[] = [];

    if (orderIds.length > 0) {
      const { data: jobsData } = await supabaseAdmin!
        .from("jobs")
        .select("*")
        .in("reference_id", orderIds)
        .eq("type", "FULFILLMENT");
      
      if (jobsData) {
        allJobs = jobsData.map(j => ({
          id: j.id,
          type: j.type,
          referenceId: j.reference_id,
          payload: j.payload,
          status: j.status,
          attempts: j.attempts,
          maxAttempts: j.max_attempts,
          lastError: j.last_error,
          nextRunAt: j.next_run_at,
          startedAt: j.started_at,
          completedAt: j.completed_at,
          createdAt: j.created_at,
          updatedAt: j.updated_at
        } as unknown as Job));
      }
    }

    const slaPromises = orders.map(async (order) => {
        const orderJobs = allJobs.filter(j => j.referenceId === order.id);
        const calculation = await slaService.calculateSLA(order, orderJobs, policies);
        return {
          ...calculation,
          orderInvoice: order.invoice,
          productName: order.productName,
          totalAmount: order.totalAmount,
          paymentStatus: order.paymentStatus,
          transactionStatus: order.transactionStatus,
          createdAt: order.createdAt
        };
    });

    const slaResults = await Promise.all(slaPromises);
    let filtered = slaResults;
    if (status) {
        filtered = filtered.filter(r => (r.overallStatus as any) === status);
    }
    return res.json({ success: true, data: filtered });
  } catch (err: any) {
    console.error("[SLA API Error]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getOrderSLADetail(req: AuthenticatedRequest, res: Response) {
  try {
    const { orderId } = req.params;
    const order = await OrderRepository.getInstance().getOrderById(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    
    const policies = await slaService.getPolicies();
    
    const { data: jobsData } = await supabaseAdmin!
      .from("jobs")
      .select("*")
      .eq("reference_id", orderId)
      .eq("type", "FULFILLMENT");
    
    const jobs = (jobsData || []).map(j => ({
      id: j.id,
      type: j.type,
      referenceId: j.reference_id,
      payload: j.payload,
      status: j.status,
      attempts: j.attempts,
      maxAttempts: j.max_attempts,
      lastError: j.last_error,
      nextRunAt: j.next_run_at,
      startedAt: j.started_at,
      completedAt: j.completed_at,
      createdAt: j.created_at,
      updatedAt: j.updated_at
    } as unknown as Job));
    
    const calculation = await slaService.calculateSLA(order, jobs, policies);
    return res.json({ success: true, data: calculation });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
