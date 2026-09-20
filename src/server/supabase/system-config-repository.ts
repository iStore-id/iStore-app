import { supabaseAdmin, isSupabaseAdminConfigured } from "../supabase-admin";

export interface SystemConfigRecord {
  key: string;
  value: any;
  updatedAt?: string;
}

export class SystemConfigRepository {
  private static instance: SystemConfigRepository;

  private constructor() {}

  public static getInstance(): SystemConfigRepository {
    if (!SystemConfigRepository.instance) {
      SystemConfigRepository.instance = new SystemConfigRepository();
    }
    return SystemConfigRepository.instance;
  }

  private get client() {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      throw new Error("Supabase Admin client is not configured.");
    }
    return supabaseAdmin;
  }

  async getConfig(key: string): Promise<any | null> {
    try {
      const { data, error } = await this.client
        .from("system_configs")
        .select("*")
        .eq("key", key)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return typeof data.value === "string" ? JSON.parse(data.value) : (data.value || data);
    } catch (err) {
      console.warn(`[SystemConfigRepository] Failed to fetch config for key "${key}":`, err);
      return null;
    }
  }

  async upsertConfig(key: string, value: any): Promise<void> {
    const { error } = await this.client
      .from("system_configs")
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString()
      }, { onConflict: "key" });

    if (error) {
      throw new Error(`[SystemConfigRepository] Failed to upsert config for key "${key}": ${error.message}`);
    }
  }

  async getApiGamesConfig(): Promise<{
    encryptedMerchantId: string;
    encryptedSecretKey: string;
    merchantId?: string;
    secretKey?: string;
  } | null> {
    const raw = await this.getConfig("apigames_integration");
    if (!raw) return null;
    return {
      encryptedMerchantId: raw.encryptedMerchantId || "",
      encryptedSecretKey: raw.encryptedSecretKey || "",
      merchantId: raw.merchantId,
      secretKey: raw.secretKey || raw.secret
    };
  }

  async getTokoVoucherConfig(): Promise<{
    memberCode: string;
    encryptedSecretKey: string;
    isEnabled: boolean;
  } | null> {
    const raw = await this.getConfig("tokovoucher_integration");
    if (!raw) return null;
    return {
      memberCode: raw.memberCode || "",
      encryptedSecretKey: raw.encryptedSecretKey || "",
      isEnabled: raw.isEnabled !== undefined ? raw.isEnabled : true
    };
  }

  async getAllConfigs(): Promise<any[]> {
    try {
      const { data, error } = await this.client
        .from("system_configs")
        .select("*");
      if (error || !data) return [];
      return data.map(row => ({
        key: row.key,
        value: typeof row.value === "string" ? JSON.parse(row.value) : row.value,
        updatedAt: row.updated_at
      }));
    } catch (err) {
      console.warn("[SystemConfigRepository] Failed to fetch all configs:", err);
      return [];
    }
  }

  async deleteConfig(key: string): Promise<void> {
    const { error } = await this.client
      .from("system_configs")
      .delete()
      .eq("key", key);
    if (error) {
      throw new Error(`[SystemConfigRepository] Failed to delete config for key "${key}": ${error.message}`);
    }
  }
}
