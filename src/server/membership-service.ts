import { supabaseAdmin } from "./supabase-admin.js";
import * as crypto from "crypto";

export class MembershipService {
  private static instance: MembershipService;
  private constructor() {}

  public static getInstance(): MembershipService {
    if (!MembershipService.instance) {
      MembershipService.instance = new MembershipService();
    }
    return MembershipService.instance;
  }

  async getMembershipPlans(): Promise<any[]> {
    const { data } = await supabaseAdmin!.from("membership_plans").select("*");
    return data || [];
  }

  async getMembershipPlan(planId: string): Promise<any | null> {
    const { data } = await supabaseAdmin!.from("membership_plans").select("*").eq("id", planId).maybeSingle();
    return data || null;
  }

  async createMembershipPlan(payload: any): Promise<any> {
    const id = crypto.randomUUID();
    const plan = { ...payload, id, created_at: new Date().toISOString() };
    await supabaseAdmin!.from("membership_plans").insert(plan);
    return plan;
  }

  async updateMembershipPlan(planId: string, payload: any): Promise<void> {
    await supabaseAdmin!.from("membership_plans").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", planId);
  }

  async getCustomerMembership(userId: string): Promise<any | null> {
    const { data } = await supabaseAdmin!.from("customer_memberships").select("*").eq("id", userId).maybeSingle();
    return data || null;
  }

  async assignMembership(userId: string, planId: string): Promise<any> {
    const payload = {
      id: userId,
      plan_id: planId,
      status: "ACTIVE",
      start_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data: existing } = await supabaseAdmin!.from("customer_memberships").select("id").eq("id", userId).maybeSingle();
    if (existing) {
      await supabaseAdmin!.from("customer_memberships").update(payload).eq("id", userId);
    } else {
      await supabaseAdmin!.from("customer_memberships").insert(payload);
    }
    return payload;
  }

  async revokeMembership(userId: string): Promise<void> {
    await supabaseAdmin!.from("customer_memberships").update({ status: "REVOKED", updated_at: new Date().toISOString() }).eq("id", userId);
  }

  async runExpiryCheck(): Promise<void> {
    // stub
  }

  async getEffectiveBenefit(userId: string): Promise<any> {
    return null;
  }

  async getPlans(...args: any[]): Promise<any[]> { return []; }
  async createPlan(...args: any[]): Promise<any> { return {}; }
  async updatePlan(...args: any[]): Promise<any> { return {}; }
  async activateMembership(...args: any[]): Promise<void> {}
  async getStats(): Promise<any> { return {}; }
  async updateMembershipStatus(...args: any[]): Promise<void> {}
}
