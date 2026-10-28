import { supabaseAdmin } from "./supabase-admin.js";
import { LoyaltyService } from "./loyalty-service.js";
import * as crypto from "crypto";

const loyaltyService = LoyaltyService.getInstance();

export interface RewardItem {
  id: string;
  name: string;
  description: string;
  image?: string;
  pointsCost: number;
  status: 'active' | 'inactive';
  quota?: number | null;
  remainingQuota?: number | null;
  perCustomerLimit?: number | null;
  rewardType: 'voucher' | 'item' | 'benefit';
  voucherCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RewardRedemption {
  id: string;
  rewardId: string;
  rewardName: string;
  customerId: string;
  pointsCost: number;
  rewardType: string;
  voucherCode?: string;
  status: 'SUCCESS' | 'FAILED';
  createdAt: string;
}

export class RewardService {
  private static instance: RewardService;

  public static getInstance(): RewardService {
    if (!RewardService.instance) {
      RewardService.instance = new RewardService();
    }
    return RewardService.instance;
  }

  async getAllRewards(includeInactive = false): Promise<RewardItem[]> {
    let query = supabaseAdmin.from("rewards").select("*");
    if (!includeInactive) {
      query = query.eq("status", "active");
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      description: row.description || "",
      image: row.image || undefined,
      pointsCost: row.points_cost,
      status: row.status as 'active' | 'inactive',
      quota: row.quota,
      remainingQuota: row.remaining_quota,
      perCustomerLimit: row.per_customer_limit,
      rewardType: row.reward_type as 'voucher' | 'item' | 'benefit',
      voucherCode: row.voucher_code || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async getRewardById(rewardId: string): Promise<RewardItem | null> {
    const { data, error } = await supabaseAdmin.from("rewards").select("*").eq("id", rewardId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      description: data.description || "",
      image: data.image || undefined,
      pointsCost: data.points_cost,
      status: data.status as 'active' | 'inactive',
      quota: data.quota,
      remainingQuota: data.remaining_quota,
      perCustomerLimit: data.per_customer_limit,
      rewardType: data.reward_type as 'voucher' | 'item' | 'benefit',
      voucherCode: data.voucher_code || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async createReward(data: Omit<RewardItem, 'id' | 'createdAt' | 'updatedAt' | 'remainingQuota'>): Promise<RewardItem> {
    this.validateRewardInput(data);
    const id = crypto.randomUUID();
    const remainingQuota = data.quota !== undefined && data.quota !== null ? data.quota : null;
    const createdAt = new Date().toISOString();
    const updatedAt = new Date().toISOString();

    const { data: inserted, error } = await supabaseAdmin.from("rewards").insert({
      id,
      name: data.name,
      description: data.description,
      image: data.image,
      points_cost: data.pointsCost,
      status: data.status,
      quota: data.quota,
      remaining_quota: remainingQuota,
      per_customer_limit: data.perCustomerLimit,
      reward_type: data.rewardType,
      voucher_code: data.voucherCode,
      created_at: createdAt,
      updated_at: updatedAt
    }).select().single();

    if (error) throw new Error(error.message);

    return {
      id: inserted.id,
      name: inserted.name,
      description: inserted.description || "",
      image: inserted.image || undefined,
      pointsCost: inserted.points_cost,
      status: inserted.status as 'active' | 'inactive',
      quota: inserted.quota,
      remainingQuota: inserted.remaining_quota,
      perCustomerLimit: inserted.per_customer_limit,
      rewardType: inserted.reward_type as 'voucher' | 'item' | 'benefit',
      voucherCode: inserted.voucher_code || undefined,
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at
    };
  }

  async updateReward(rewardId: string, data: Partial<RewardItem>): Promise<RewardItem> {
    this.validateRewardInput(data, true);
    const updateObj: any = {
      updated_at: new Date().toISOString()
    };
    if (data.name !== undefined) updateObj.name = data.name;
    if (data.description !== undefined) updateObj.description = data.description;
    if (data.image !== undefined) updateObj.image = data.image;
    if (data.pointsCost !== undefined) updateObj.points_cost = data.pointsCost;
    if (data.status !== undefined) updateObj.status = data.status;
    if (data.quota !== undefined) updateObj.quota = data.quota;
    if (data.remainingQuota !== undefined) updateObj.remaining_quota = data.remainingQuota;
    if (data.perCustomerLimit !== undefined) updateObj.per_customer_limit = data.perCustomerLimit;
    if (data.rewardType !== undefined) updateObj.reward_type = data.rewardType;
    if (data.voucherCode !== undefined) updateObj.voucher_code = data.voucherCode;

    const { data: updated, error } = await supabaseAdmin.from("rewards")
      .update(updateObj)
      .eq("id", rewardId)
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Reward tidak ditemukan");

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description || "",
      image: updated.image || undefined,
      pointsCost: updated.points_cost,
      status: updated.status as 'active' | 'inactive',
      quota: updated.quota,
      remainingQuota: updated.remaining_quota,
      perCustomerLimit: updated.per_customer_limit,
      rewardType: updated.reward_type as 'voucher' | 'item' | 'benefit',
      voucherCode: updated.voucher_code || undefined,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at
    };
  }

  private validateRewardInput(data: Partial<RewardItem>, partial = false): void {
    if (!partial || data.name !== undefined) {
      if (typeof data.name !== "string" || !data.name.trim() || data.name.trim().length > 255) {
        throw new Error("Nama reward wajib diisi dan maksimal 255 karakter.");
      }
    }
    if (!partial || data.pointsCost !== undefined) {
      if (!Number.isSafeInteger(data.pointsCost) || Number(data.pointsCost) < 0) {
        throw new Error("Biaya poin reward harus bilangan bulat dan tidak boleh negatif.");
      }
    }
    if (!partial || data.rewardType !== undefined) {
      if (!["voucher", "item", "benefit"].includes(String(data.rewardType))) {
        throw new Error("Tipe reward tidak valid.");
      }
    }
    if (!partial || data.status !== undefined) {
      if (!["active", "inactive"].includes(String(data.status))) {
        throw new Error("Status reward tidak valid.");
      }
    }
    if (data.quota !== undefined && data.quota !== null &&
        (!Number.isSafeInteger(data.quota) || data.quota < 0)) {
      throw new Error("Kuota reward harus bilangan bulat nol atau lebih.");
    }
    if (data.perCustomerLimit !== undefined && data.perCustomerLimit !== null &&
        (!Number.isSafeInteger(data.perCustomerLimit) || data.perCustomerLimit < 1)) {
      throw new Error("Batas penukaran per pelanggan harus bilangan bulat minimal 1.");
    }
    if (data.name !== undefined && data.name.trim().length > 255) {
      throw new Error("Nama reward maksimal 255 karakter.");
    }
    if (data.description !== undefined && data.description.length > 5000) {
      throw new Error("Deskripsi reward maksimal 5.000 karakter.");
    }
    if (data.rewardType === "voucher" && data.voucherCode !== undefined &&
        (!data.voucherCode.trim() || data.voucherCode.length > 255)) {
      throw new Error("Kode voucher wajib diisi dan maksimal 255 karakter.");
    }
  }

  async deleteReward(rewardId: string): Promise<void> {
    const { error } = await supabaseAdmin.from("rewards")
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq("id", rewardId);
    if (error) throw new Error(error.message);
  }

  async redeemReward(customerId: string, rewardId: string): Promise<RewardRedemption> {
    if (!customerId || customerId === 'guest') {
      throw new Error("Silakan login untuk menukar reward.");
    }
    const config = await loyaltyService.getConfig();
    if (!config.enabled) {
      throw new Error("Program Poin & Loyalty sedang nonaktif.");
    }

    const redemptionId = crypto.randomUUID();

    const { error } = await supabaseAdmin.rpc("redeem_reward_atomic", {
      p_reward_id: rewardId,
      p_customer_id: customerId,
      p_redemption_id: redemptionId
    });

    if (error) {
      throw new Error(error.message);
    }

    const { data: redemptionRow, error: selectError } = await supabaseAdmin.from("reward_redemptions")
      .select("*")
      .eq("id", redemptionId)
      .single();

    if (selectError || !redemptionRow) {
      throw new Error(selectError ? selectError.message : "Gagal memproses detail penukaran.");
    }

    return {
      id: redemptionRow.id,
      rewardId: redemptionRow.reward_id,
      rewardName: redemptionRow.reward_name,
      customerId: redemptionRow.customer_id,
      pointsCost: redemptionRow.points_cost,
      rewardType: redemptionRow.reward_type,
      voucherCode: redemptionRow.voucher_code || undefined,
      status: redemptionRow.status as 'SUCCESS' | 'FAILED',
      createdAt: redemptionRow.created_at
    };
  }

  async getAllRedemptions(): Promise<RewardRedemption[]> {
    const { data, error } = await supabaseAdmin.from("reward_redemptions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);

    return (data || []).map(row => ({
      id: row.id,
      rewardId: row.reward_id,
      rewardName: row.reward_name,
      customerId: row.customer_id,
      pointsCost: row.points_cost,
      rewardType: row.reward_type,
      voucherCode: row.voucher_code || undefined,
      status: row.status as 'SUCCESS' | 'FAILED',
      createdAt: row.created_at
    }));
  }

  async getCustomerRedemptions(customerId: string): Promise<RewardRedemption[]> {
    if (!customerId || customerId === 'guest') return [];

    const { data, error } = await supabaseAdmin.from("reward_redemptions")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (data || []).map(row => ({
      id: row.id,
      rewardId: row.reward_id,
      rewardName: row.reward_name,
      customerId: row.customer_id,
      pointsCost: row.points_cost,
      rewardType: row.reward_type,
      voucherCode: row.voucher_code || undefined,
      status: row.status as 'SUCCESS' | 'FAILED',
      createdAt: row.created_at
    }));
  }
}
