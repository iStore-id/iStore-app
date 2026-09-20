import { supabaseAdmin } from "./supabase-admin.js";
import * as crypto from "crypto";

export class JobService {
  private static instance: JobService;
  private constructor() {}

  static getInstance(): JobService {
    if (!JobService.instance) {
      JobService.instance = new JobService();
    }
    return JobService.instance;
  }

  async enqueueJob(type: string, payload: any): Promise<string> {
    const id = crypto.randomUUID();
    await supabaseAdmin!.from("jobs").insert({
      id,
      type,
      payload,
      status: "QUEUED",
      created_at: new Date().toISOString()
    });
    return id;
  }

  async getJobs(): Promise<any[]> {
    const { data } = await supabaseAdmin!.from("jobs").select("*").order("created_at", { ascending: false });
    return data || [];
  }

  async processNextJob(): Promise<boolean> {
    return false;
  }

  async markJobFailed(id: string, reason: string): Promise<void> {
    await supabaseAdmin!.from("jobs").update({ 
      status: "FAILED", 
      error: reason, 
      updated_at: new Date().toISOString() 
    }).eq("id", id);
  }

  async enqueue(typeOrConfig: any, payload?: any): Promise<void> {
    // Overloaded to handle enqueue(type, payload) and enqueue({ type, payload, ... })
    let type: string;
    let finalPayload: any;

    if (typeof typeOrConfig === 'string') {
      type = typeOrConfig;
      finalPayload = payload || {};
    } else {
      type = typeOrConfig.type;
      finalPayload = typeOrConfig.payload || typeOrConfig;
    }

    await this.enqueueJob(type, finalPayload);
  }

  async startWorkerLoop(): Promise<void> {}
  async getLastHeartbeat(): Promise<any> { return null; }
  async getQueueStats(): Promise<any> { return {}; }
}
