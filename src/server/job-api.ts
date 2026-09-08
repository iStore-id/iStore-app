import { JobService } from "./job-service";
import { adminDb } from "./firebase-admin";

const jobService = JobService.getInstance();

export async function getAdminJobs(req: any, res: any) {
  try {
    const { status, type, priority, limit = 50 } = req.query;
    
    let query: any = adminDb.collection("jobs")
      .orderBy("createdAt", "desc")
      .limit(Number(limit));

    if (status) query = query.where("status", "==", status);
    if (type) query = query.where("type", "==", type);
    if (priority) query = query.where("priority", "==", priority);
    
    const snap = await query.get();
    const jobs = snap.docs.map((doc: any) => doc.data());
    
    res.json({ success: true, data: jobs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getAdminJobDetail(req: any, res: any) {
  try {
    const snap = await adminDb.collection("jobs").doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ success: false, message: "Job not found" });
    
    const job = snap.data();
    res.json({ success: true, data: job });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function retryJob(req: any, res: any) {
  try {
    await jobService.manualRetry(req.params.id, req.user.uid);
    res.json({ success: true, message: "Job scheduled for retry" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function cancelJob(req: any, res: any) {
  try {
    await jobService.cancelJob(req.params.id, req.user.uid);
    res.json({ success: true, message: "Job cancelled" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function triggerJobWorker(req: any, res: any) {
  try {
    const count = await jobService.processJobs(`manual_${req.user.uid}`, 10);
    res.json({ success: true, message: `Worker triggered, processed ${count} jobs` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
