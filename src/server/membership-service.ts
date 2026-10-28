import { supabaseAdmin } from "./supabase-admin.js";
import * as crypto from "crypto";

type PlanInput = {
  id?: string;
  name?: string;
  description?: string;
  tierLevel?: number;
  status?: "ACTIVE" | "INACTIVE";
  price?: number;
  durationDays?: number;
  pointMultiplier?: number;
  discountRate?: number;
  accessTags?: string[];
  updatedBy?: string;
};

const PLAN_FIELDS = "id,name,description,tier_level,status,price,duration_days,point_multiplier,discount_rate,access_tags,created_at,updated_at,updated_by";
const MEMBERSHIP_FIELDS = "id,plan_id,status,start_date,expiry_date,assigned_at,updated_at,source,order_id,reason,metadata";

function mapPlan(row: any) {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    description: row.description || "",
    tierLevel: Number(row.tier_level || 0),
    status: row.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    price: Number(row.price || 0),
    durationDays: Number(row.duration_days || 0),
    pointMultiplier: Number(row.point_multiplier || 1),
    discountRate: Number(row.discount_rate || 0),
    accessTags: Array.isArray(row.access_tags) ? row.access_tags : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by || ""
  };
}

function mapMembership(row: any, plan?: any) {
  const metadata = row.metadata || {};
  const resolvedPlan = plan || metadata;
  return {
    id: String(row.id),
    userId: String(row.id),
    planId: String(row.plan_id || ""),
    status: row.status,
    startDate: row.start_date || undefined,
    expiryDate: row.expiry_date || undefined,
    assignedAt: row.assigned_at || row.start_date || row.created_at,
    updatedAt: row.updated_at,
    source: row.source === "PURCHASE" ? "PURCHASE" : "MANUAL",
    orderId: row.order_id || undefined,
    reason: row.reason || undefined,
    metadata: {
      ...metadata,
      planName: resolvedPlan.name || metadata.planName || "VIP Membership",
      pointMultiplier: Number(resolvedPlan.point_multiplier ?? resolvedPlan.pointMultiplier ?? metadata.pointMultiplier ?? 1),
      discountRate: Number(resolvedPlan.discount_rate ?? resolvedPlan.discountRate ?? metadata.discountRate ?? 0),
      tierLevel: Number(resolvedPlan.tier_level ?? resolvedPlan.tierLevel ?? metadata.tierLevel ?? 0),
      accessTags: Array.isArray(resolvedPlan.access_tags) ? resolvedPlan.access_tags : (resolvedPlan.accessTags || metadata.accessTags || [])
    }
  };
}

export class MembershipService {
  private static instance: MembershipService;
  private constructor() {}

  public static getInstance(): MembershipService {
    if (!MembershipService.instance) MembershipService.instance = new MembershipService();
    return MembershipService.instance;
  }

  async getMembershipPlans(): Promise<any[]> {
    const { data, error } = await supabaseAdmin!
      .from("membership_plans").select(PLAN_FIELDS).order("tier_level", { ascending: true });
    if (error) throw new Error(`Gagal memuat paket membership: ${error.message}`);
    return (data || []).map(mapPlan);
  }

  async getMembershipPlan(planId: string): Promise<any | null> {
    const { data, error } = await supabaseAdmin!
      .from("membership_plans").select(PLAN_FIELDS).eq("id", planId).maybeSingle();
    if (error) throw new Error(`Gagal membaca paket membership: ${error.message}`);
    return data ? mapPlan(data) : null;
  }

  async createMembershipPlan(payload: PlanInput): Promise<any> {
    const normalized = this.validatePlan(payload);
    const now = new Date().toISOString();
    const row = {
      id: crypto.randomUUID(),
      name: normalized.name,
      description: normalized.description,
      tier_level: normalized.tierLevel,
      status: normalized.status,
      price: normalized.price,
      duration_days: normalized.durationDays,
      point_multiplier: normalized.pointMultiplier,
      discount_rate: normalized.discountRate,
      access_tags: normalized.accessTags,
      created_at: now,
      updated_at: now,
      updated_by: normalized.updatedBy || null
    };
    const { data, error } = await supabaseAdmin!
      .from("membership_plans").insert(row).select(PLAN_FIELDS).single();
    if (error) throw new Error(`Gagal membuat paket membership: ${error.message}`);
    return mapPlan(data);
  }

  async updateMembershipPlan(planId: string, payload: PlanInput): Promise<any> {
    const normalized = this.validatePlan(payload, true);
    const row: Record<string, any> = { updated_at: new Date().toISOString() };
    if (normalized.name !== undefined) row.name = normalized.name;
    if (normalized.description !== undefined) row.description = normalized.description;
    if (normalized.tierLevel !== undefined) row.tier_level = normalized.tierLevel;
    if (normalized.status !== undefined) row.status = normalized.status;
    if (normalized.price !== undefined) row.price = normalized.price;
    if (normalized.durationDays !== undefined) row.duration_days = normalized.durationDays;
    if (normalized.pointMultiplier !== undefined) row.point_multiplier = normalized.pointMultiplier;
    if (normalized.discountRate !== undefined) row.discount_rate = normalized.discountRate;
    if (normalized.accessTags !== undefined) row.access_tags = normalized.accessTags;
    if (normalized.updatedBy !== undefined) row.updated_by = normalized.updatedBy;
    const { data, error } = await supabaseAdmin!
      .from("membership_plans").update(row).eq("id", planId).select(PLAN_FIELDS).maybeSingle();
    if (error) throw new Error(`Gagal memperbarui paket membership: ${error.message}`);
    if (!data) throw new Error("Paket membership tidak ditemukan.");
    return mapPlan(data);
  }

  private validatePlan(payload: PlanInput, partial = false): PlanInput {
    const result: PlanInput = {};
    const stringValue = (key: "name" | "description" | "updatedBy", value: unknown) =>
      typeof value === "string" ? value.trim() : undefined;
    if (!partial || payload.name !== undefined) {
      const name = stringValue("name", payload.name);
      if (!name) throw new Error("Nama paket wajib diisi.");
      result.name = name;
    }
    if (payload.description !== undefined) result.description = String(payload.description).trim();
    if (!partial || payload.tierLevel !== undefined) {
      const v = Number(payload.tierLevel);
      if (!Number.isInteger(v) || v < 1) throw new Error("Level paket harus bilangan bulat minimal 1.");
      result.tierLevel = v;
    }
    if (!partial || payload.price !== undefined) {
      const v = Number(payload.price);
      if (!Number.isFinite(v) || v < 0) throw new Error("Harga paket tidak valid.");
      result.price = Math.round(v);
    }
    if (!partial || payload.durationDays !== undefined) {
      const v = Number(payload.durationDays);
      if (!Number.isInteger(v) || v < 0) throw new Error("Durasi harus bilangan bulat 0 atau lebih; 0 berarti tanpa batas waktu.");
      result.durationDays = v;
    }
    if (!partial || payload.pointMultiplier !== undefined) {
      const v = Number(payload.pointMultiplier);
      if (!Number.isFinite(v) || v < 1 || v > 100) throw new Error("Pengali poin harus antara 1x dan 100x.");
      result.pointMultiplier = v;
    }
    if (!partial || payload.discountRate !== undefined) {
      const v = Number(payload.discountRate);
      if (!Number.isFinite(v) || v < 0 || v > 100) throw new Error("Diskon harus antara 0% dan 100%.");
      result.discountRate = v;
    }
    if (!partial || payload.status !== undefined) {
      if (payload.status !== "ACTIVE" && payload.status !== "INACTIVE") throw new Error("Status paket tidak valid.");
      result.status = payload.status;
    }
    if (payload.accessTags !== undefined) {
      result.accessTags = Array.isArray(payload.accessTags)
        ? payload.accessTags.map(tag => String(tag).trim()).filter(Boolean)
        : [];
    } else if (!partial) result.accessTags = [];
    if (payload.updatedBy !== undefined) result.updatedBy = stringValue("updatedBy", payload.updatedBy);
    return result;
  }

  async getCustomerMembership(userId: string): Promise<any | null> {
    if (!userId) return null;
    const { data, error } = await supabaseAdmin!
      .from("customer_memberships").select(MEMBERSHIP_FIELDS).eq("id", userId).maybeSingle();
    if (error) throw new Error(`Gagal membaca status membership: ${error.message}`);
    if (!data) return null;
    const plan = await this.getMembershipPlan(String(data.plan_id));
    return mapMembership(data, plan || undefined);
  }

  async getCustomerMemberships(): Promise<any[]> {
    const { data, error } = await supabaseAdmin!
      .from("customer_memberships").select(MEMBERSHIP_FIELDS).order("assigned_at", { ascending: false });
    if (error) throw new Error(`Gagal memuat daftar member: ${error.message}`);
    const planIds = [...new Set((data || []).map(row => String(row.plan_id)).filter(Boolean))];
    const plans = planIds.length
      ? await supabaseAdmin!.from("membership_plans").select(PLAN_FIELDS).in("id", planIds)
      : { data: [], error: null };
    if (plans.error) throw new Error(`Gagal memuat detail paket: ${plans.error.message}`);
    const planMap = new Map((plans.data || []).map((row: any) => [String(row.id), row]));
    return (data || []).map(row => mapMembership(row, planMap.get(String(row.plan_id))));
  }

  async assignMembership(userId: string, planId: string, options: { source?: "PURCHASE" | "MANUAL"; orderId?: string; reason?: string } = {}): Promise<any> {
    if (!userId || !planId) throw new Error("ID pelanggan dan paket wajib diisi.");
    const plan = await this.getMembershipPlan(planId);
    if (!plan) throw new Error("Paket membership tidak ditemukan.");
    if (plan.status !== "ACTIVE") throw new Error("Paket membership sedang tidak aktif.");
    const now = new Date();
    const startDate = now.toISOString();
    const expiryDate = plan.durationDays > 0
      ? new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000).toISOString()
      : null;
    const payload = {
      id: userId,
      plan_id: planId,
      status: "ACTIVE",
      start_date: startDate,
      expiry_date: expiryDate,
      assigned_at: startDate,
      updated_at: startDate,
      source: options.source || "MANUAL",
      order_id: options.orderId || null,
      reason: options.reason || null,
      metadata: {
        planName: plan.name,
        pointMultiplier: plan.pointMultiplier,
        discountRate: plan.discountRate,
        tierLevel: plan.tierLevel,
        accessTags: plan.accessTags
      }
    };
    const { data, error } = await supabaseAdmin!
      .from("customer_memberships").upsert(payload, { onConflict: "id" }).select(MEMBERSHIP_FIELDS).single();
    if (error) throw new Error(`Gagal mengaktifkan membership: ${error.message}`);
    return mapMembership(data, plan);
  }

  async revokeMembership(userId: string): Promise<void> {
    const { error } = await supabaseAdmin!
      .from("customer_memberships").update({ status: "CANCELLED", updated_at: new Date().toISOString() }).eq("id", userId);
    if (error) throw new Error(`Gagal membatalkan membership: ${error.message}`);
  }

  async runExpiryCheck(): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin!
      .from("customer_memberships").update({ status: "EXPIRED", updated_at: now })
      .eq("status", "ACTIVE").not("expiry_date", "is", null).lte("expiry_date", now);
    if (error) throw new Error(`Gagal memperbarui membership kedaluwarsa: ${error.message}`);
  }

  async getEffectiveBenefit(userId: string): Promise<any | null> {
    if (!userId) return null;
    const membership = await this.getCustomerMembership(userId);
    if (!membership || membership.status !== "ACTIVE") return null;
    if (membership.expiryDate && new Date(membership.expiryDate).getTime() <= Date.now()) {
      await supabaseAdmin!.from("customer_memberships")
        .update({ status: "EXPIRED", updated_at: new Date().toISOString() }).eq("id", userId).eq("status", "ACTIVE");
      return null;
    }
    const plan = await this.getMembershipPlan(membership.planId);
    if (!plan || plan.status !== "ACTIVE") return null;
    return {
      planId: plan.id,
      planName: plan.name,
      tierLevel: plan.tierLevel,
      pointMultiplier: Math.max(1, Number(plan.pointMultiplier) || 1),
      discountRate: Math.min(100, Math.max(0, Number(plan.discountRate) || 0)),
      accessTags: plan.accessTags || []
    };
  }

  async getPlans(..._args: any[]): Promise<any[]> {
    return (await this.getMembershipPlans()).filter(plan => plan.status === "ACTIVE");
  }

  async createPlan(payload: PlanInput, ..._args: any[]): Promise<any> {
    return this.createMembershipPlan(payload);
  }

  async updatePlan(planId: string, payload: PlanInput, ..._args: any[]): Promise<any> {
    return this.updateMembershipPlan(planId, payload);
  }

  async activateMembership(userId: string, planId: string, ..._args: any[]): Promise<void> {
    await this.assignMembership(userId, planId);
  }

  async getStats(): Promise<any> {
    await this.runExpiryCheck();
    const { data, error } = await supabaseAdmin!.from("customer_memberships").select("status,expiry_date");
    if (error) throw new Error(`Gagal memuat statistik membership: ${error.message}`);
    const rows = data || [];
    const soon = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const distribution: Record<string, number> = {};
    for (const row of rows) distribution[row.status] = (distribution[row.status] || 0) + 1;
    const totalActive = distribution.ACTIVE || 0;
    const totalExpired = distribution.EXPIRED || 0;
    const totalSuspended = distribution.SUSPENDED || 0;
    const expiringSoon = rows.filter(row => row.status === "ACTIVE" && row.expiry_date && new Date(row.expiry_date).getTime() <= soon).length;
    return { totalActive, totalExpired, totalSuspended, expiringSoon, totalMembers: rows.length, plansCount: (await this.getMembershipPlans()).length, distribution };
  }

  async updateMembershipStatus(userId: string, status: "ACTIVE" | "SUSPENDED" | "CANCELLED" | "EXPIRED", reason?: string): Promise<void> {
    const { error } = await supabaseAdmin!.from("customer_memberships")
      .update({ status, reason: reason || null, updated_at: new Date().toISOString() }).eq("id", userId);
    if (error) throw new Error(`Gagal memperbarui status membership: ${error.message}`);
  }
}
