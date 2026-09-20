import { supabaseAdmin, isSupabaseAdminConfigured } from "../supabase-admin.js";
import { SystemConfigRepository } from "./system-config-repository";
import * as crypto from "crypto";

export interface MidtransConfigData {
  merchantId: string;
  serverKey: string;
  clientKey: string;
  isProduction: boolean;
  configured: boolean;
  lastTestedAt: string | null;
  lastTestResult: string | null;
  isActive: boolean;
}

export interface PaymentGatewayData {
  id: string;
  name: string;
  code: string;
  type: string;
  environment: string;
  status: string;
  enabled: boolean;
  priority: number;
  capabilities: string[];
  createdAt?: string;
  updatedAt?: string;
}

const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.SESSION_SECRET || "istore-secure-midtrans-secret-key-2026",
  "salt",
  32
);
const IV_LENGTH = 16;

function encryptSecret(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decryptSecret(text: string): string {
  if (!text) return "";
  try {
    const parts = text.split(":");
    if (parts.length !== 2) return text;
    const iv = Buffer.from(parts[0], "hex");
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return text;
  }
}

export class SupabasePaymentRepository {
  private static instance: SupabasePaymentRepository;

  private constructor() {}

  public static getInstance(): SupabasePaymentRepository {
    if (!SupabasePaymentRepository.instance) {
      SupabasePaymentRepository.instance = new SupabasePaymentRepository();
    }
    return SupabasePaymentRepository.instance;
  }

  private get client() {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      throw new Error("Supabase Admin client is not configured.");
    }
    return supabaseAdmin;
  }

  async getMidtransConfig(): Promise<MidtransConfigData> {
    try {
      const configJson = await SystemConfigRepository.getInstance().getConfig("midtrans_integration");

      if (configJson) {
        const merchantId = configJson.merchantId || process.env.MIDTRANS_MERCHANT_ID || "";
        const encryptedKey = configJson.encryptedServerKey || "";
        const serverKey = encryptedKey ? decryptSecret(encryptedKey) : (process.env.MIDTRANS_SERVER_KEY || "");
        const clientKey = configJson.clientKey || process.env.VITE_MIDTRANS_CLIENT_KEY || "";
        const isProduction = configJson.isProduction !== undefined 
          ? configJson.isProduction 
          : (process.env.MIDTRANS_IS_PRODUCTION === "true");

        return {
          merchantId,
          serverKey,
          clientKey,
          isProduction,
          configured: !!serverKey,
          lastTestedAt: configJson.lastTestedAt || null,
          lastTestResult: configJson.lastTestResult || null,
          isActive: configJson.isActive !== false // default true
        };
      }
    } catch (err) {
      console.warn("[SupabasePaymentRepository] Failed to read Midtrans config from SystemConfigRepository:", err);
    }

    return {
      merchantId: process.env.MIDTRANS_MERCHANT_ID || "",
      serverKey: process.env.MIDTRANS_SERVER_KEY || "",
      clientKey: process.env.VITE_MIDTRANS_CLIENT_KEY || "",
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
      configured: !!process.env.MIDTRANS_SERVER_KEY,
      isActive: process.env.MIDTRANS_IS_ACTIVE === "false" ? false : true,
      lastTestedAt: null,
      lastTestResult: null
    };
  }

  async saveMidtransConfig(config: Partial<MidtransConfigData> & { serverKey?: string }): Promise<void> {
    const existing = await this.getMidtransConfig();
    const merchantId = config.merchantId !== undefined ? config.merchantId : existing.merchantId;
    const clientKey = config.clientKey !== undefined ? config.clientKey : existing.clientKey;
    const serverKey = config.serverKey !== undefined ? config.serverKey : existing.serverKey;
    const isProduction = config.isProduction !== undefined ? config.isProduction : existing.isProduction;
    const isActive = config.isActive !== undefined ? config.isActive : existing.isActive;

    const payload = {
      merchantId,
      clientKey,
      encryptedServerKey: serverKey ? encryptSecret(serverKey) : "",
      isProduction,
      isActive,
      lastTestedAt: config.lastTestedAt || existing.lastTestedAt,
      lastTestResult: config.lastTestResult || existing.lastTestResult,
      updatedAt: new Date().toISOString()
    };

    try {
      await SystemConfigRepository.getInstance().upsertConfig("midtrans_integration", payload);
    } catch (error: any) {
      throw new Error(`Failed to save Midtrans config to SystemConfigRepository: ${error.message}`);
    }
  }

  async getPaymentGateways(): Promise<PaymentGatewayData[]> {
    const { data, error } = await this.client
      .from("payment_gateways")
      .select("*")
      .order("priority", { ascending: true });

    if (error) {
      // If payment_gateways table is not present, return empty list gracefully
      console.warn("[SupabasePaymentRepository] payment_gateways table error:", error.message);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      name: row.name || "",
      code: row.code || "",
      type: row.type || "aggregator",
      environment: row.environment || "sandbox",
      status: row.status || "inactive",
      enabled: row.enabled ?? false,
      priority: row.priority ?? 0,
      capabilities: row.capabilities || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async savePaymentGateway(gateway: Partial<PaymentGatewayData>): Promise<PaymentGatewayData> {
    const payload = {
      id: gateway.id,
      name: gateway.name || "",
      code: gateway.code || "",
      type: gateway.type || "aggregator",
      environment: gateway.environment || "sandbox",
      status: gateway.status || "inactive",
      enabled: gateway.enabled ?? false,
      priority: gateway.priority ?? 0,
      capabilities: gateway.capabilities || [],
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.client
      .from("payment_gateways")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save payment gateway to Supabase: ${error.message}`);
    }

    return {
      id: data.id,
      name: data.name,
      code: data.code,
      type: data.type,
      environment: data.environment,
      status: data.status,
      enabled: data.enabled,
      priority: data.priority,
      capabilities: data.capabilities,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async updateOrderPaymentDetails(
    orderId: string,
    details: {
      paymentGatewayCode?: string;
      gatewayTransactionId?: string;
      gatewayPaymentType?: string;
      gatewayResponse?: any;
      snapToken?: string;
      paymentUrl?: string;
    }
  ): Promise<void> {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (details.paymentGatewayCode !== undefined) updatePayload.payment_gateway_code = details.paymentGatewayCode;
    if (details.gatewayTransactionId !== undefined) updatePayload.gateway_transaction_id = details.gatewayTransactionId;
    if (details.gatewayPaymentType !== undefined) updatePayload.gateway_payment_type = details.gatewayPaymentType;
    if (details.gatewayResponse !== undefined) updatePayload.gateway_response = details.gatewayResponse;
    if (details.snapToken !== undefined) updatePayload.snap_token = details.snapToken;
    if (details.paymentUrl !== undefined) updatePayload.payment_url = details.paymentUrl;

    const { error } = await this.client
      .from("orders")
      .update(updatePayload)
      .eq("id", orderId);

    if (error) {
      throw new Error(`Failed to update order payment details in Supabase: ${error.message}`);
    }
  }
}
