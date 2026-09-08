import { Response } from "express";
import { SLAService } from "./sla-service";
import { AuthenticatedRequest } from "./middleware";
import { adminDb } from "./firebase-admin";
import { logCoreAudit } from "./core-service";
import { Job } from "../types/core";

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
    const policy = await slaService.createPolicy(req.body, req.user.uid);
    const actor = { uid: req.user.uid, email: req.user.email || req.user.uid };
    await logCoreAudit(actor, req.user.role || "admin", "CREATE_SLA_POLICY", `slaPolicies/${policy.id}`, null, policy, "Created SLA policy");
    return res.status(201).json({ success: true, data: policy });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateSLAPolicy(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const policyRef = adminDb.collection("slaPolicies").doc(id);
    const beforeSnap = await policyRef.get();
    if (!beforeSnap.exists) return res.status(404).json({ success: false, message: "Policy not found" });

    await slaService.updatePolicy(id, req.body, req.user.uid);
    const afterSnap = await policyRef.get();
    
    const actor = { uid: req.user.uid, email: req.user.email || req.user.uid };
    await logCoreAudit(actor, req.user.role || "admin", "UPDATE_SLA_POLICY", `slaPolicies/${id}`, beforeSnap.data(), afterSnap.data(), "Updated SLA policy");
    
    return res.json({ success: true, message: "Policy updated" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteSLAPolicy(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const policyRef = adminDb.collection("slaPolicies").doc(id);
    const beforeSnap = await policyRef.get();
    if (!beforeSnap.exists) return res.status(404).json({ success: false, message: "Policy not found" });

    await slaService.deletePolicy(id);
    const actor = { uid: req.user.uid, email: req.user.email || req.user.uid };
    await logCoreAudit(actor, req.user.role || "admin", "DELETE_SLA_POLICY", `slaPolicies/${id}`, beforeSnap.data(), null, "Deleted SLA policy");
    
    return res.json({ success: true, message: "Policy deleted" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getSLAMonitor(req: AuthenticatedRequest, res: Response) {
  try {
    const { status, limit = "50" } = req.query;
    const policies = await slaService.getPolicies();
    
    // Fetch recent orders
    let query = adminDb.collection("orders").orderBy("createdAt", "desc").limit(parseInt(limit as string));
    
    const ordersSnap = await query.get();
    const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    
    // Fetch associated fulfillment jobs
    const orderIds = orders.map(o => o.id);
    let allJobs: Job[] = [];
    
    // Firestore "in" query limit is 30
    if (orderIds.length > 0) {
      const chunks = [];
      for (let i = 0; i < orderIds.length; i += 30) {
        chunks.push(orderIds.slice(i, i + 30));
      }
      
      const jobPromises = chunks.map(chunk => 
        adminDb.collection("jobs")
          .where("referenceId", "in", chunk)
          .where("type", "==", "FULFILLMENT")
          .get()
      );
      
      const jobSnaps = await Promise.all(jobPromises);
      jobSnaps.forEach(snap => {
        snap.docs.forEach(doc => allJobs.push(doc.data() as Job));
      });
    }

    const slaPromises = orders.map(async (order) => {
        const orderJobs = allJobs.filter(j => j.referenceId === order.id);
        const calculation = await slaService.calculateSLA(order, orderJobs, policies);
        // Enrich with some order info for the UI
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
        filtered = filtered.filter(r => r.overallStatus === status);
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
    const orderSnap = await adminDb.collection("orders").doc(orderId).get();
    if (!orderSnap.exists) return res.status(404).json({ success: false, message: "Order not found" });
    
    const order = { id: orderSnap.id, ...orderSnap.data() };
    const policies = await slaService.getPolicies();
    
    const jobsSnap = await adminDb.collection("jobs")
      .where("referenceId", "==", orderId)
      .where("type", "==", "FULFILLMENT")
      .get();
    const jobs = jobsSnap.docs.map(doc => doc.data() as Job);
    
    const calculation = await slaService.calculateSLA(order, jobs, policies);
    
    return res.json({ success: true, data: calculation });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
