import * as crypto from "crypto";
import { SystemConfigRepository } from "../supabase/system-config-repository.js";
import { decryptSecret } from "../midtrans.js";
import {
  PaymentProviderAdapter,
  CreatePaymentInput,
  PaymentResult,
  PaymentStatusInput,
  PaymentStatusResult,
  WebhookRequest,
  NormalizedPaymentEvent,
  RefundPaymentInput,
  RefundResult
} from "./payment-provider-interface.js";

interface IpaymuConfig {
  va: string;
  apiKey: string;
  isProduction: boolean;
  isActive: boolean;
  callbackUrl?: string;
}

export class IpaymuProviderAdapter implements PaymentProviderAdapter {
  private static instance: IpaymuProviderAdapter;

  private constructor() {}

  public static getInstance(): IpaymuProviderAdapter {
    if (!IpaymuProviderAdapter.instance) {
      IpaymuProviderAdapter.instance = new IpaymuProviderAdapter();
    }
    return IpaymuProviderAdapter.instance;
  }

  private async getConfig(): Promise<IpaymuConfig> {
    try {
      const repo = SystemConfigRepository.getInstance();
      const config = await repo.getConfig("ipaymu_integration");
      if (config) {
        const va = config.va || process.env.IPAYMU_VA || "";
        const encryptedKey = config.encryptedApiKey || "";
        const apiKey = encryptedKey ? decryptSecret(encryptedKey) : (config.apiKey || process.env.IPAYMU_API_KEY || "");
        const isProduction = config.isProduction === true || process.env.IPAYMU_IS_PRODUCTION === "true";
        const isActive = config.isActive === true;
        const callbackUrl = config.callbackUrl || process.env.IPAYMU_CALLBACK_URL || "https://ist.web.id/api/webhooks/ipaymu";

        return { va, apiKey, isProduction, isActive, callbackUrl };
      }
    } catch (e) {
      // fallback
    }

    return {
      va: process.env.IPAYMU_VA || "",
      apiKey: process.env.IPAYMU_API_KEY || "",
      isProduction: process.env.IPAYMU_IS_PRODUCTION === "true",
      isActive: process.env.IPAYMU_IS_ACTIVE === "true",
      callbackUrl: process.env.IPAYMU_CALLBACK_URL || "https://ist.web.id/api/webhooks/ipaymu"
    };
  }

  private mapPaymentMethodAndChannel(paymentMethod?: string): { paymentMethod: string; channel: string } {
    const method = (paymentMethod || "qris").toLowerCase().trim();
    if (method === "qris") {
      return { paymentMethod: "qris", channel: "qris" };
    }
    if (method === "bca_va" || method === "bca") {
      return { paymentMethod: "va", channel: "bca" };
    }
    if (method === "bni_va" || method === "bni") {
      return { paymentMethod: "va", channel: "bni" };
    }
    if (method === "bri_va" || method === "bri") {
      return { paymentMethod: "va", channel: "bri" };
    }
    if (method === "mandiri_va" || method === "echannel" || method === "mandiri") {
      return { paymentMethod: "va", channel: "mandiri" };
    }
    if (method === "permata_va" || method === "permata") {
      return { paymentMethod: "va", channel: "permata" };
    }
    if (method === "cimb_va" || method === "cimb") {
      return { paymentMethod: "va", channel: "cimb" };
    }
    // Default supported direct payment fallback
    return { paymentMethod: "qris", channel: "qris" };
  }

  private getTimestamp(): string {
    const d = new Date();
    const YYYY = d.getUTCFullYear().toString();
    const MM = String(d.getUTCMonth() + 1).padStart(2, '0');
    const DD = String(d.getUTCDate()).padStart(2, '0');
    const HH = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return `${YYYY}${MM}${DD}${HH}${mm}${ss}`;
  }

  private generateSignature(bodyString: string, va: string, apiKey: string): string {
    const hashBody = crypto.createHash('sha256').update(bodyString).digest('hex');
    const stringToSign = `POST:${va}:${hashBody}:${apiKey}`;
    return crypto.createHmac('sha256', apiKey).update(stringToSign).digest('hex');
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    const config = await this.getConfig();
    if (!config.isActive) {
      return { success: false, message: "iPaymu Payment Gateway sedang dinonaktifkan." };
    }
    if (!config.va || !config.apiKey) {
      return { success: false, message: "iPaymu Virtual Account atau API Key belum dikonfigurasi." };
    }

    const proxyUrl = process.env.IPAYMU_PROXY_URL;
    const proxyToken = process.env.IPAYMU_PROXY_TOKEN;
    const useProxy = !!proxyUrl;

    const baseUrl = useProxy ? proxyUrl : (config.isProduction ? "https://my.ipaymu.com" : "https://sandbox.ipaymu.com");
    const sanitizedBaseUrl = (baseUrl || '').replace(/\/$/, '').replace(/\/api\/v2$/, '');
    const endpoint = `${sanitizedBaseUrl}/api/v2/payment/direct`;

    const mapped = this.mapPaymentMethodAndChannel(input.paymentMethod);

    const payload = {
      name: input.customerDetails.first_name || "Customer",
      phone: input.customerDetails.phone || "08123456789",
      email: input.customerDetails.email || "customer@istore.id",
      amount: input.grossAmount,
      comments: `Order ${input.orderId}`,
      referenceId: input.orderId,
      returnUrl: input.returnUrl || `https://istore.id/transactions/${input.orderId}`,
      cancelUrl: input.returnUrl || `https://istore.id/transactions/${input.orderId}`,
      notifyUrl: config.callbackUrl || `https://ist.web.id/api/webhooks/ipaymu`,
      paymentMethod: mapped.paymentMethod,
      paymentChannel: mapped.channel,
      channel: mapped.channel
    };

    const bodyString = JSON.stringify(payload);
    
    // Headers setup
    const headers: Record<string, string> = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "va": config.va
    };

    if (useProxy) {
      // VPS Proxy Authentication
      headers["Authorization"] = `Bearer ${proxyToken}`;
    } else {
      // Legacy Direct Signature
      headers["signature"] = this.generateSignature(bodyString, config.va, config.apiKey);
      headers["timestamp"] = this.getTimestamp();
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: headers,
        body: bodyString
      });

      const data = await response.json();

      const status = data.Status ?? data.status;
      const message = data.Message ?? data.message;
      const resData = data.Data ?? data.data ?? {};

      if (!response.ok || (status !== 200 && status !== "200")) {
        return {
          success: false,
          message: message || `iPaymu Error (${response.status})`
        };
      }

      const redirectUrl = resData.Url || resData.QrImage || resData.paymentUrl || resData.url;

      return {
        success: true,
        token: String(resData.TransactionId || resData.SessionId || ""),
        redirectUrl: redirectUrl,
        rawResponse: data
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "Gagal terhubung ke iPaymu API"
      };
    }
  }

  async getPaymentStatus(input: PaymentStatusInput): Promise<PaymentStatusResult> {
    const config = await this.getConfig();
    
    const proxyUrl = process.env.IPAYMU_PROXY_URL;
    const proxyToken = process.env.IPAYMU_PROXY_TOKEN;
    const useProxy = !!proxyUrl;

    const baseUrl = useProxy ? proxyUrl : (config.isProduction ? "https://my.ipaymu.com" : "https://sandbox.ipaymu.com");
    const sanitizedBaseUrl = (baseUrl || '').replace(/\/$/, '').replace(/\/api\/v2$/, '');
    const endpoint = `${sanitizedBaseUrl}/api/v2/transaction`;

    const payload = {
      transactionId: input.transactionId || undefined,
      referenceId: input.orderId
    };

    const bodyString = JSON.stringify(payload);
    
    // Headers setup
    const headers: Record<string, string> = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "va": config.va
    };

    if (useProxy) {
      headers["Authorization"] = `Bearer ${proxyToken}`;
    } else {
      headers["signature"] = this.generateSignature(bodyString, config.va, config.apiKey);
      headers["timestamp"] = this.getTimestamp();
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: headers,
        body: bodyString
      });

      const data = await response.json();
      const trx = data.Data ?? data.data ?? {};

      let strStatus = String(trx.Status || trx.status || "").toLowerCase().trim();
      let statusCode = trx.status_code !== undefined ? parseInt(String(trx.status_code), 10) : (trx.StatusCode !== undefined ? parseInt(String(trx.StatusCode), 10) : undefined);
      let numStatus = typeof trx.status === "number" ? trx.status : (typeof trx.Status === "number" ? trx.Status : undefined);

      let normalized = "pending";
      if (strStatus === "berhasil" || strStatus === "paid" || strStatus === "success" || statusCode === 1 || numStatus === 1) {
        normalized = "settlement";
      } else if (strStatus === "expired" || statusCode === -2 || numStatus === -2) {
        normalized = "expire";
      } else if (strStatus === "cancelled" || strStatus === "batal") {
        normalized = "cancel";
      } else if (strStatus === "failed" || strStatus === "gagal") {
        normalized = "deny";
      }

      return {
        status: normalized,
        transactionStatus: normalized,
        grossAmount: parseFloat(trx.Total || trx.total || trx.amount || trx.Amount || "0"),
        rawData: data
      };
    } catch (err: any) {
      return {
        status: "pending",
        transactionStatus: "pending",
        grossAmount: 0
      };
    }
  }

  async verifyWebhook(request: WebhookRequest): Promise<NormalizedPaymentEvent> {
    const config = await this.getConfig();
    const data = request.body || {};
    const signatureHeader = String(request.headers["x-signature"] || request.headers["signature"] || "").trim().toLowerCase();

    if (!config.va) {
      throw new Error("iPaymu Merchant VA is not configured for webhook verification");
    }

    if (!signatureHeader) {
      throw new Error("Missing iPaymu webhook signature header (X-Signature)");
    }

    // 1. Normalize Payload according to iPaymu webhook contract
    const normalizedPayload: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      if (key.toLowerCase() === "signature" || key.toLowerCase() === "x-signature") continue;

      const val = data[key];
      if (key === "trx_id" || key === "status_code" || key === "transaction_status_code" || key === "paid_off") {
        normalizedPayload[key] = typeof val === "number" ? val : parseInt(String(val), 10);
      } else if (key === "is_escrow") {
        normalizedPayload[key] = Boolean(val === true || val === "true" || val === 1 || val === "1");
      } else if (key === "additional_info") {
        normalizedPayload[key] = Array.isArray(val) ? val : [];
      } else if (val !== null && val !== undefined) {
        normalizedPayload[key] = String(val);
      }
    }

    if (!("additional_info" in normalizedPayload)) {
      normalizedPayload["additional_info"] = [];
    }

    // 2. Sort keys alphabetically A-Z
    const sortedKeys = Object.keys(normalizedPayload).sort();
    const sortedPayload: Record<string, any> = {};
    for (const k of sortedKeys) {
      sortedPayload[k] = normalizedPayload[k];
    }

    // 3. Compute HMAC-SHA256 using Merchant VA as secret key
    const calculatedSignature = crypto
      .createHmac("sha256", config.va)
      .update(JSON.stringify(sortedPayload))
      .digest("hex")
      .toLowerCase();

    // 4. Constant-time comparison
    const sigBuf = Buffer.from(signatureHeader, "hex");
    const calcBuf = Buffer.from(calculatedSignature, "hex");
    if (sigBuf.length !== calcBuf.length || !crypto.timingSafeEqual(sigBuf, calcBuf)) {
      throw new Error("Invalid iPaymu webhook signature");
    }

    const referenceId = data.referenceId || data.reference_id || data.orderId;
    const rawStatus = String(data.status || "").toLowerCase().trim();
    const rawStatusCode = data.status_code !== undefined ? parseInt(String(data.status_code), 10) : undefined;
    const rawTrxStatusCode = data.transaction_status_code !== undefined ? parseInt(String(data.transaction_status_code), 10) : undefined;
    const amount = parseFloat(data.total || data.amount || "0");

    let normalizedStatus: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED' = 'PENDING';

    // Official iPaymu contract mapping:
    // status: "berhasil" | "pending" | "expired"
    // status_code: 1 (Success) | 0 (Pending) | -2 (Expired)
    // transaction_status_code: 1 (direct payment settled) | 6 (payment received / pending settlement)
    if (rawStatus === "berhasil" || rawStatusCode === 1 || rawTrxStatusCode === 1) {
      normalizedStatus = "PAID";
    } else if (rawStatus === "expired" || rawStatusCode === -2) {
      normalizedStatus = "EXPIRED";
    } else if (rawStatus === "pending" || rawStatusCode === 0 || rawTrxStatusCode === 6) {
      normalizedStatus = "PENDING";
    } else if (rawStatus === "refund" || rawStatus === "refunded") {
      normalizedStatus = "REFUNDED";
    } else if (rawStatus === "cancelled" || rawStatus === "batal") {
      normalizedStatus = "CANCELLED";
    } else if (rawStatus === "failed" || rawStatus === "gagal") {
      normalizedStatus = "FAILED";
    } else {
      normalizedStatus = "PENDING";
    }

    return {
      provider: 'ipaymu',
      orderId: referenceId,
      transactionId: data.transactionId || data.trx_id || referenceId,
      status: normalizedStatus,
      amount: amount,
      rawPayload: data
    };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundResult> {
    const config = await this.getConfig();
    
    const proxyUrl = process.env.IPAYMU_PROXY_URL;
    const proxyToken = process.env.IPAYMU_PROXY_TOKEN;
    const useProxy = !!proxyUrl;

    const baseUrl = useProxy ? proxyUrl : (config.isProduction ? "https://my.ipaymu.com" : "https://sandbox.ipaymu.com");
    const sanitizedBaseUrl = (baseUrl || '').replace(/\/$/, '').replace(/\/api\/v2$/, '');
    const endpoint = `${sanitizedBaseUrl}/api/v2/payment/refund`;

    const payload = {
      transactionId: input.transactionId,
      amount: input.amount,
      reason: input.reason || "Admin refund"
    };

    const bodyString = JSON.stringify(payload);
    
    // Headers setup
    const headers: Record<string, string> = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "va": config.va
    };

    if (useProxy) {
      headers["Authorization"] = `Bearer ${proxyToken}`;
    } else {
      headers["signature"] = this.generateSignature(bodyString, config.va, config.apiKey);
      headers["timestamp"] = this.getTimestamp();
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: headers,
        body: bodyString
      });

      const data = await response.json();
      const status = data.Status ?? data.status;
      const message = data.Message ?? data.message;
      const resData = data.Data ?? data.data ?? {};

      if (!response.ok || (status !== 200 && status !== "200")) {
        return { success: false, message: message || "iPaymu refund rejected" };
      }

      return {
        success: true,
        refundId: resData.refundId || resData.RefundId || input.transactionId,
        message: "Refund berhasil diproses oleh iPaymu"
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "iPaymu refund timeout"
      };
    }
  }
}
