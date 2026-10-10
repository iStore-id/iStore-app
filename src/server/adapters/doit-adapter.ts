import * as crypto from "crypto";
import QRCode from "qrcode";
import { SystemConfigRepository } from "../supabase/system-config-repository.js";
import { isSupabaseAdminConfigured } from "../supabase-admin.js";
import { decryptSecret } from "../midtrans.js";
import { logSystem } from "../system-log-service.js";
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

/** Convert provider error payloads into safe, human-readable text. Never stringify arbitrary objects. */
export function normalizeDoitErrorMessage(value: unknown, fallback: string): string {
  const visit = (candidate: unknown, depth: number): string => {
    if (depth > 4 || candidate == null) return "";
    if (typeof candidate === "string") return candidate.trim();
    if (typeof candidate === "number" || typeof candidate === "boolean") return "";
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const message = visit(item, depth + 1);
        if (message) return message;
      }
      return "";
    }
    if (typeof candidate === "object") {
      const record = candidate as Record<string, unknown>;
      for (const key of ["message", "error", "detail", "description", "title"]) {
        const message = visit(record[key], depth + 1);
        if (message) return message;
      }
    }
    return "";
  };
  const message = visit(value, 0);
  if (message && message !== "[object Object]" && !message.startsWith("{") && !message.startsWith("[")) return message;
  const safeFallback = typeof fallback === "string" ? fallback.trim() : "";
  return safeFallback && safeFallback !== "[object Object]" ? safeFallback : "Pembayaran gagal. Silakan coba lagi.";
}

export interface DoitConfig {
  apiKey: string;
  webhookSecret: string;
  isActive: boolean;
  isProduction: boolean;
  baseUrl?: string;
  decryptResult?: "NONEMPTY_NONCIPHERTEXT" | "FALLBACK_CIPHERTEXT" | "PLAIN_FALLBACK" | "ENV_FALLBACK" | "EMPTY";
}

export class DoitProviderAdapter implements PaymentProviderAdapter {
  private static instance: DoitProviderAdapter;

  private constructor() {}

  public static getInstance(): DoitProviderAdapter {
    if (!DoitProviderAdapter.instance) {
      DoitProviderAdapter.instance = new DoitProviderAdapter();
    }
    return DoitProviderAdapter.instance;
  }

  public async getConfig(): Promise<DoitConfig> {
    try {
      if (isSupabaseAdminConfigured) {
        const repo = SystemConfigRepository.getInstance();
        const config = await repo.getConfig("doit_integration");
        if (config) {
          const encryptedKey = config.encryptedApiKey || "";
          const apiKey = encryptedKey ? decryptSecret(encryptedKey) : (config.apiKey || process.env.DOIT_API_KEY || "");
          const encryptedSecret = config.encryptedWebhookSecret || "";

          let webhookSecret = "";
          let decryptResult: DoitConfig["decryptResult"] = "EMPTY";

          if (encryptedSecret) {
            const decrypted = decryptSecret(encryptedSecret);
            if (decrypted === encryptedSecret && encryptedSecret.includes(":")) {
              decryptResult = "FALLBACK_CIPHERTEXT";
              webhookSecret = decrypted;
            } else if (decrypted) {
              decryptResult = "NONEMPTY_NONCIPHERTEXT";
              webhookSecret = decrypted;
            } else {
              decryptResult = "EMPTY";
              webhookSecret = "";
            }
          } else if (config.webhookSecret) {
            decryptResult = "PLAIN_FALLBACK";
            webhookSecret = config.webhookSecret;
          } else if (process.env.DOIT_WEBHOOK_SECRET) {
            decryptResult = "ENV_FALLBACK";
            webhookSecret = process.env.DOIT_WEBHOOK_SECRET;
          }

          const isActive = config.isActive === true || process.env.DOIT_IS_ACTIVE === "true";
          const isProduction = config.isProduction === true || process.env.DOIT_IS_PRODUCTION === "true";
          const baseUrl = config.baseUrl || process.env.DOIT_BASE_URL || "https://pay.doit.id";

          return { apiKey, webhookSecret, isActive, isProduction, baseUrl, decryptResult };
        }
      }
    } catch (e) {
      // Fallback to environment variables
    }

    const envSecret = process.env.DOIT_WEBHOOK_SECRET || "";
    return {
      apiKey: process.env.DOIT_API_KEY || "",
      webhookSecret: envSecret,
      decryptResult: envSecret ? "ENV_FALLBACK" : "EMPTY",
      isActive: process.env.DOIT_IS_ACTIVE === "true",
      isProduction: process.env.DOIT_IS_PRODUCTION === "true",
      baseUrl: process.env.DOIT_BASE_URL || "https://pay.doit.id"
    };
  }

  /**
   * Create Payment (hosted checkout: rail "any") on doit.id
   * POST https://pay.doit.id/v1/payments
   */
  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    const config = await this.getConfig();

    if (!config.apiKey) {
      logSystem("ERROR", "PAYMENT", "DOIT_API_KEY_MISSING", "Doit.id API Key belum dikonfigurasi.", "doit-adapter", {
        orderId: input.orderId,
        outcome: "FAILURE"
      });
      return { success: false, message: "Doit.id API Key belum dikonfigurasi." };
    }

    const baseUrl = (config.baseUrl || "https://pay.doit.id").replace(/\/$/, "");
    const endpoint = `${baseUrl}/v1/payments`;
    const idempotencyKey = `${input.orderId}-PAYMENT`;

    const DOIT_VA_MAP: Record<string, string> = {
      mandiri_va: "bmri",
      bmri: "bmri",
      bni_va: "bnia",
      bnia: "bnia",
      bri_va: "brin",
      brin: "brin",
      bsi_va: "bsyi",
      bsyi: "bsyi",
      cimb_va: "cimb",
      cimb: "cimb",
      permata_va: "permata",
      permata: "permata",
      maybank_va: "maybank",
      maybank: "maybank",
      danamon_va: "danamon",
      danamon: "danamon"
    };

    const DOIT_TRANSFER_MAP: Record<string, string> = {
      bca_transfer: "bca",
      mandiri_transfer: "mandiri",
      bni_transfer: "bni",
      bsi_transfer: "bsi"
    };

    const method = String(input.paymentMethod || "").toLowerCase().trim();
    let payload: Record<string, any>;

    if (method === "qris") {
      payload = {
        amount: Math.round(input.grossAmount),
        rail: "qris",
        reference: input.orderId
      };
    } else if (DOIT_VA_MAP[method]) {
      payload = {
        amount: Math.round(input.grossAmount),
        rail: "va",
        va_bank: DOIT_VA_MAP[method],
        reference: input.orderId
      };
    } else if (DOIT_TRANSFER_MAP[method]) {
      payload = {
        amount: Math.round(input.grossAmount),
        rail: "transfer",
        va_bank: DOIT_TRANSFER_MAP[method],
        reference: input.orderId
      };
    } else {
      payload = {
        amount: Math.round(input.grossAmount),
        rail: "any",
        reference: input.orderId
      };
    }

    const bodyString = JSON.stringify(payload);

    try {
      logSystem("INFO", "PAYMENT", "DOIT_CREATE_PAYMENT_INIT", `Membuat pembayaran doit.id untuk order ${input.orderId} nominal ${input.grossAmount}`, "doit-adapter", {
        orderId: input.orderId,
        outcome: "SUCCESS",
        metadata: { amount: input.grossAmount, rail: payload.rail, vaBank: payload.va_bank }
      });

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`,
          "Idempotency-Key": idempotencyKey
        },
        body: bodyString
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = normalizeDoitErrorMessage(data, `Doit.id Error (${response.status})`);
        logSystem("ERROR", "PAYMENT", "DOIT_CREATE_PAYMENT_FAILED", `Gagal membuat pembayaran Doit.id untuk order ${input.orderId}: ${errorMsg}`, "doit-adapter", {
          orderId: input.orderId,
          httpStatus: response.status,
          outcome: "FAILURE",
          metadata: { status: response.status, responseMessage: errorMsg }
        });
        return {
          success: false,
          message: errorMsg,
          rawResponse: data
        };
      }

      const resData = data.data || data;
      const paymentId = String(resData.id || resData.payment_id || "");
      const qrContent = resData.qr_content || resData.qr_string || resData.qrContent || "";
      const hostedUrl = resData.hosted_url || resData.hostedUrl || resData.url || undefined;
      const responseRail = resData.rail || payload.rail;
      const vaNumber = resData.va_number || resData.vaNumber || undefined;
      const vaBank = resData.va_bank || resData.vaBank || payload.va_bank || undefined;
      const feeAmount = typeof resData.fee_amount === "number" ? resData.fee_amount : (typeof resData.fee === "number" ? resData.fee : undefined);
      const feePayer = resData.fee_payer || resData.feePayer || undefined;
      const totalAmount = typeof resData.total_amount === "number" ? resData.total_amount : (typeof resData.amount === "number" ? resData.amount : Math.round(input.grossAmount));
      const expiresAt = resData.expires_at || resData.expired_at || resData.expiry || undefined;

      let qrImageDataUrl: string | undefined = undefined;
      if (qrContent) {
        try {
          qrImageDataUrl = await QRCode.toDataURL(qrContent, {
            errorCorrectionLevel: "M",
            margin: 2,
            scale: 8
          });
        } catch (qrErr: any) {
          console.error("[DoitAdapter] Gagal generate QRCode data URL:", qrErr);
          // If qrContent itself is already a data URL or image URL, use it directly
          if (qrContent.startsWith("data:") || qrContent.startsWith("http")) {
            qrImageDataUrl = qrContent;
          }
        }
      }

      logSystem("INFO", "PAYMENT", "DOIT_CREATE_PAYMENT_SUCCESS", `Pembayaran Doit.id berhasil dibuat: ${paymentId}`, "doit-adapter", {
        orderId: input.orderId,
        outcome: "SUCCESS",
        metadata: { paymentId, hasQr: !!qrImageDataUrl, hasHostedUrl: !!hostedUrl, rail: responseRail, vaBank }
      });

      return {
        success: true,
        token: paymentId,
        qrImage: qrImageDataUrl,
        redirectUrl: hostedUrl,
        rail: responseRail,
        vaNumber: vaNumber ? String(vaNumber) : undefined,
        vaBank: vaBank ? String(vaBank) : undefined,
        feeAmount,
        feePayer,
        totalAmount,
        expiresAt: expiresAt ? String(expiresAt) : undefined,
        rawResponse: data
      };
    } catch (err: any) {
      logSystem("ERROR", "PAYMENT", "DOIT_CONNECTION_ERROR", `Koneksi ke Doit.id API gagal: ${err.message}`, "doit-adapter", {
        orderId: input.orderId,
        outcome: "FAILURE",
        stackTrace: err.stack
      });
      return {
        success: false,
        message: err.message || "Gagal terhubung ke Doit.id API"
      };
    }
  }

  /**
   * Get Payment Status from doit.id
   * GET /v1/payments/{id} OR GET /v1/payments?reference={reference}
   */
  async getPaymentStatus(input: PaymentStatusInput): Promise<PaymentStatusResult> {
    const config = await this.getConfig();
    const baseUrl = (config.baseUrl || "https://pay.doit.id").replace(/\/$/, "");

    let endpoint = "";
    if (input.transactionId) {
      endpoint = `${baseUrl}/v1/payments/${encodeURIComponent(input.transactionId)}`;
    } else {
      endpoint = `${baseUrl}/v1/payments?reference=${encodeURIComponent(input.orderId)}`;
    }

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${config.apiKey}`
        }
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          status: "pending",
          transactionStatus: "pending",
          grossAmount: 0,
          rawData: data
        };
      }

      // If queried by reference, data might be wrapped in array { data: [...] }
      let payment = data.data || data;
      if (Array.isArray(payment)) {
        payment = payment[0] || {};
      }

      const rawStatus = String(payment.status || "").toLowerCase().trim();
      let normalized = "pending";

      if (rawStatus === "paid" || rawStatus === "success" || rawStatus === "settlement") {
        normalized = "settlement";
      } else if (rawStatus === "expired" || rawStatus === "expire") {
        normalized = "expire";
      } else if (rawStatus === "failed" || rawStatus === "deny") {
        normalized = "deny";
      } else if (rawStatus === "refunded" || rawStatus === "refund") {
        normalized = "refund";
      } else {
        normalized = "pending";
      }

      const amount = parseFloat(String(payment.amount || 0));

      return {
        status: normalized,
        transactionStatus: normalized,
        grossAmount: amount,
        rawData: data
      };
    } catch (err: any) {
      console.error("[DoitAdapter] getPaymentStatus error:", err);
      return {
        status: "pending",
        transactionStatus: "pending",
        grossAmount: 0
      };
    }
  }

  /**
   * Verify Webhook Signature according to doit.id specification
   * Header: PayBridge-Signature: t=<timestamp>,v1=<HMAC-SHA256>
   * Signature calculation: HMAC-SHA256(secret, "${timestamp}.${rawBody}")
   */
  async verifyWebhook(request: WebhookRequest): Promise<NormalizedPaymentEvent> {
    const config = await this.getConfig();

    const signatureHeader = String(
      request.headers["paybridge-signature"] ||
      request.headers["PayBridge-Signature"] ||
      request.headers["x-signature"] ||
      request.headers["signature"] ||
      ""
    ).trim();

    if (!config.webhookSecret) {
      throw new Error("Doit.id Webhook Secret belum dikonfigurasi");
    }

    if (!signatureHeader) {
      throw new Error("Missing PayBridge-Signature header");
    }

    // Parse t=<timestamp> and v1=<signature>
    const parts = signatureHeader.split(",");
    let timestamp = "";
    let receivedSignature = "";

    for (const part of parts) {
      const equalIndex = part.indexOf("=");
      if (equalIndex === -1) continue;
      const key = part.slice(0, equalIndex).trim();
      const val = part.slice(equalIndex + 1).trim();
      if (key === "t") timestamp = val;
      if (key === "v1") receivedSignature = val;
    }

    if (!timestamp || !receivedSignature) {
      throw new Error("Invalid PayBridge-Signature format: missing t or v1");
    }

    // Replay attack prevention: verify timestamp within 5 minutes (300 seconds)
    const eventTimeSec = parseInt(timestamp, 10);
    const currentTimeSec = Math.floor(Date.now() / 1000);
    const timestampDiff = Math.abs(currentTimeSec - eventTimeSec);
    const timestampStatus = isNaN(eventTimeSec) ? "INVALID" : (timestampDiff > 300 ? "EXPIRED" : "VALID");

    if (timestampStatus !== "VALID") {
      throw new Error("Webhook timestamp expired or out of allowed tolerance window (300s)");
    }

    // Obtain exact raw request body string
    let rawBodyString = "";
    let rawBodySource: "BUFFER" | "STRING" | "JSON_FALLBACK" | "EMPTY" = "EMPTY";

    if (typeof request.body === "string") {
      rawBodyString = request.body;
      rawBodySource = "STRING";
    } else if (Buffer.isBuffer(request.body)) {
      rawBodyString = request.body.toString("utf8");
      rawBodySource = "BUFFER";
    } else if ((request as any).rawBody) {
      const rb = (request as any).rawBody;
      rawBodyString = Buffer.isBuffer(rb) ? rb.toString("utf8") : String(rb);
      rawBodySource = Buffer.isBuffer(rb) ? "BUFFER" : "STRING";
    } else if (request.body) {
      rawBodyString = JSON.stringify(request.body);
      rawBodySource = "JSON_FALLBACK";
    }

    const rawBodyByteLength = Buffer.byteLength(rawBodyString, "utf8");
    const payloadToSign = `${timestamp}.${rawBodyString}`;
    const expectedSignature = crypto
      .createHmac("sha256", config.webhookSecret)
      .update(payloadToSign)
      .digest("hex")
      .toLowerCase();

    const sigBuf = Buffer.from(receivedSignature.toLowerCase(), "hex");
    const calcBuf = Buffer.from(expectedSignature, "hex");

    const sigLengthCheck = sigBuf.length === calcBuf.length ? "PASS" : "FAIL";
    const sigMatch = sigLengthCheck === "PASS" && crypto.timingSafeEqual(sigBuf, calcBuf);

    const diagnosticLog = {
      tag: "DOIT_SIGNATURE_DIAGNOSTIC",
      decryptResult: config.decryptResult || "EMPTY",
      rawBodySource,
      rawBodyByteLength,
      timestampStatus,
      sigLengthCheck,
      sigMatch: sigMatch ? "PASS" : "FAIL"
    };

    if (sigMatch) {
      console.info("[DOIT_SIGNATURE_DIAGNOSTIC]", JSON.stringify(diagnosticLog));
    } else {
      console.warn("[DOIT_SIGNATURE_DIAGNOSTIC]", JSON.stringify(diagnosticLog));
    }

    if (!sigMatch) {
      throw new Error("Invalid Doit.id webhook signature");
    }

    // Parse JSON payload
    let eventPayload: any = {};
    try {
      eventPayload = typeof request.body === "object" && !Buffer.isBuffer(request.body)
        ? request.body
        : JSON.parse(rawBodyString);
    } catch (e) {
      throw new Error("Invalid JSON webhook payload");
    }

    const eventType = String(eventPayload.type || "");
    const eventData = eventPayload.data || {};
    const orderReference = eventData.reference || eventData.referenceId || eventData.orderId || "";
    const paymentId = eventData.id || eventData.payment_id || eventPayload.id || "";
    const amount = parseFloat(String(eventData.amount || eventPayload.amount || "0"));
    const rawStatus = String(eventData.status || "").toLowerCase().trim();

    let normalizedStatus: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED' = 'PENDING';

    if (eventType === "payment.paid" || rawStatus === "paid" || rawStatus === "settlement") {
      normalizedStatus = "PAID";
    } else if (eventType === "payment.expired" || rawStatus === "expired") {
      normalizedStatus = "EXPIRED";
    } else if (eventType === "refund.succeeded" || rawStatus === "refunded") {
      normalizedStatus = "REFUNDED";
    } else if (eventType === "payment.failed" || rawStatus === "failed") {
      normalizedStatus = "FAILED";
    } else {
      normalizedStatus = "PENDING";
    }

    return {
      provider: "doit",
      orderId: orderReference,
      transactionId: paymentId,
      status: normalizedStatus,
      amount: amount,
      rawPayload: eventPayload
    };
  }

  /**
   * Refund payment on doit.id
   * POST /v1/payments/{id}/refunds
   */
  async refundPayment(input: RefundPaymentInput): Promise<RefundResult> {
    const config = await this.getConfig();
    const baseUrl = (config.baseUrl || "https://pay.doit.id").replace(/\/$/, "");
    const endpoint = `${baseUrl}/v1/payments/${encodeURIComponent(input.transactionId)}/refunds`;
    const idempotencyKey = `${input.orderId}-${input.transactionId}-REFUND`;

    const payload = {
      amount: Math.round(input.amount),
      reason: input.reason || "Admin requested refund"
    };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`,
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorMsg = normalizeDoitErrorMessage(data, `Doit.id refund rejected (${response.status})`);
        logSystem("ERROR", "PAYMENT", "DOIT_REFUND_FAILED", `Gagal memproses refund Doit.id untuk order ${input.orderId}: ${errorMsg}`, "doit-adapter", {
          orderId: input.orderId,
          outcome: "FAILURE",
          metadata: { status: response.status }
        });
        return { success: false, message: errorMsg };
      }

      const resData = data.data || data;
      const refundId = String(resData.id || resData.refundId || input.transactionId);

      logSystem("INFO", "PAYMENT", "DOIT_REFUND_SUCCESS", `Refund Doit.id berhasil diproses: ${refundId}`, "doit-adapter", {
        orderId: input.orderId,
        outcome: "SUCCESS",
        metadata: { refundId }
      });

      return {
        success: true,
        refundId: refundId,
        message: "Refund berhasil diproses oleh Doit.id"
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "Doit.id refund timeout"
      };
    }
  }
}
