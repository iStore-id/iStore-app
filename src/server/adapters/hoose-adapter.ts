import * as crypto from "crypto";
import QRCode from "qrcode";
import { SystemConfigRepository } from "../supabase/system-config-repository.js";
import { decryptSecret } from "../midtrans.js";
import {
  PaymentProviderAdapter, CreatePaymentInput, PaymentResult,
  PaymentStatusInput, PaymentStatusResult, WebhookRequest,
  NormalizedPaymentEvent, RefundPaymentInput, RefundResult
} from "./payment-provider-interface.js";

const API_BASE = "https://qris.hoose.id";

type HooseConfig = { apiKey: string; isActive: boolean; callbackUrl: string };

function headerValue(headers: any, name: string): string {
  const value = headers?.[name.toLowerCase()] ?? headers?.[name] ?? "";
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

function safeEqualHex(actual: string, expected: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(actual) || !/^[a-f0-9]{64}$/i.test(expected)) return false;
  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function unwrap(payload: any): any {
  return payload?.data && typeof payload.data === "object" ? payload.data : payload;
}

function normalizeHooseStatus(value: unknown): NormalizedPaymentEvent["status"] {
  const status = String(value || "").trim().toLowerCase();
  if (status === "paid" || status === "settlement" || status === "success") return "PAID";
  if (status === "expired") return "EXPIRED";
  if (status === "failed" || status === "cancelled" || status === "canceled") return "FAILED";
  if (status === "refunded") return "REFUNDED";
  return "PENDING";
}

function resolveBaseAmount(data: any): number {
  const baseAmount = Number(data?.base_amount);
  if (Number.isSafeInteger(baseAmount) && baseAmount > 0) return baseAmount;

  const finalAmount = Number(data?.final_amount);
  const uniqueCode = Number(data?.unique_code);
  if (Number.isSafeInteger(finalAmount) && finalAmount > 0 && Number.isSafeInteger(uniqueCode) && uniqueCode >= 0 && uniqueCode <= 999) {
    return finalAmount - uniqueCode;
  }

  const amount = Number(data?.amount);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
}

export class HooseProviderAdapter implements PaymentProviderAdapter {
  private static instance: HooseProviderAdapter;
  private constructor() {}

  public static getInstance(): HooseProviderAdapter {
    if (!HooseProviderAdapter.instance) HooseProviderAdapter.instance = new HooseProviderAdapter();
    return HooseProviderAdapter.instance;
  }

  private async getConfig(): Promise<HooseConfig> {
    const saved = await SystemConfigRepository.getInstance().getConfig("hoose_integration").catch(() => null);
    return {
      apiKey: saved?.encryptedApiKey
        ? decryptSecret(saved.encryptedApiKey)
        : String(saved?.apiKey || process.env.QRIS_API_KEY || ""),
      isActive: saved?.isActive === true,
      callbackUrl: String(saved?.callbackUrl || "https://www.tega.biz.id/api/webhooks/hoose")
    };
  }

  private async request(path: string, init: RequestInit = {}): Promise<any> {
    const config = await this.getConfig();
    if (!config.apiKey) throw new Error("API Key Hoose.id belum dikonfigurasi.");
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "x-api-key": config.apiKey,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers || {})
      },
      signal: init.signal || AbortSignal.timeout(15000)
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false || payload?.error) {
      const code = String(payload?.code || payload?.error?.code || "");
      const message = String(payload?.message || payload?.error?.message || `Hoose.id API error (HTTP ${response.status})`);
      const error: any = new Error(message);
      error.status = response.status;
      error.code = code;
      throw error;
    }
    return payload;
  }

  public async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    if (!Number.isSafeInteger(input.grossAmount) || input.grossAmount <= 0) {
      return { success: false, message: "Nominal pembayaran Hoose.id tidak valid." };
    }
    if (input.paymentMethod && !["qris", "qr", "hoose"].includes(input.paymentMethod.toLowerCase())) {
      return { success: false, message: "Hoose.id hanya mendukung pembayaran QRIS." };
    }

    try {
      const config = await this.getConfig();
      const payload = await this.request("/api/qris", {
        method: "POST",
        body: JSON.stringify({
          amount: input.grossAmount,
          order_id: input.orderId,
          callback_url: input.callbackUrl || config.callbackUrl
        })
      });
      const data = unwrap(payload);
      const transactionId = String(data?.transaction_id || "").trim();
      const returnedOrderId = String(data?.order_id || "").trim();
      const baseAmount = Number(data?.amount);
      const uniqueCode = Number(data?.unique_code);
      const finalAmount = Number(data?.final_amount);
      const expiresAt = data?.expired_at ? String(data.expired_at) : undefined;
      const qrString = String(data?.qris_string || "").trim();
      let qrImage = String(data?.qr_image || "").trim();

      if (!transactionId || returnedOrderId !== input.orderId) {
        return { success: false, message: "Respons Hoose.id tidak memiliki transaction_id atau order_id yang cocok.", rawResponse: payload };
      }
      if (
        !Number.isSafeInteger(baseAmount) || baseAmount !== input.grossAmount ||
        !Number.isSafeInteger(uniqueCode) || uniqueCode < 0 || uniqueCode > 999 ||
        !Number.isSafeInteger(finalAmount) || finalAmount !== baseAmount + uniqueCode
      ) {
        return { success: false, message: "Nominal atau kode unik dari Hoose.id tidak valid.", rawResponse: payload };
      }
      if (!qrImage && qrString) {
        qrImage = await QRCode.toDataURL(qrString, { errorCorrectionLevel: "M", margin: 2, scale: 8 });
      }
      if (!qrImage && !qrString) {
        return { success: false, message: "Respons Hoose.id tidak menyertakan QR image atau QRIS string.", rawResponse: payload };
      }

      return {
        success: true,
        token: transactionId,
        qrImage: qrImage || undefined,
        rail: "qris",
        totalAmount: finalAmount,
        feeAmount: uniqueCode,
        expiresAt,
        rawResponse: { ...payload, data: { ...data, base_amount: baseAmount, unique_code: uniqueCode, final_amount: finalAmount, qris_string: qrString } }
      };
    } catch (error: any) {
      return { success: false, message: error?.message || "Gagal membuat tagihan QRIS Hoose.id." };
    }
  }

  public async getPaymentStatus(input: PaymentStatusInput): Promise<PaymentStatusResult> {
    const transactionId = String(input.transactionId || "").trim();
    if (!transactionId) throw new Error("Transaction ID Hoose.id tidak tersedia.");
    const payload = await this.request(`/api/qris/${encodeURIComponent(transactionId)}/status`, { method: "GET" });
    const data = unwrap(payload);
    const status = normalizeHooseStatus(data?.status);
    return {
      status,
      transactionStatus: String(data?.status || status).toLowerCase(),
      grossAmount: resolveBaseAmount(data),
      rawData: data
    };
  }

  public async verifyWebhook(request: WebhookRequest): Promise<NormalizedPaymentEvent> {
    const config = await this.getConfig();
    if (!config.apiKey) throw new Error("API Key Hoose.id belum dikonfigurasi untuk webhook.");
    const rawBody = Buffer.isBuffer(request.body)
      ? request.body
      : Buffer.from(typeof request.body === "string" ? request.body : JSON.stringify(request.body ?? {}), "utf8");
    const suppliedSignature = headerValue(request.headers, "x-signature").trim().toLowerCase();
    const expectedSignature = crypto.createHmac("sha256", config.apiKey).update(rawBody).digest("hex");
    if (!safeEqualHex(suppliedSignature, expectedSignature)) throw new Error("Invalid Hoose.id webhook signature.");

    const payload: any = JSON.parse(rawBody.toString("utf8"));
    const headerEvent = headerValue(request.headers, "x-event").trim();
    const bodyEvent = String(payload?.event || "").trim();
    if (!bodyEvent || !headerEvent || headerEvent !== bodyEvent) throw new Error("Hoose.id webhook event header mismatch.");
    if (bodyEvent === "test" || bodyEvent === "webhook.test") {
      return {
        provider: "hoose",
        orderId: "",
        transactionId: String(payload?.transaction_id || "test"),
        status: "PENDING",
        amount: 0,
        rawPayload: payload
      };
    }
    if (bodyEvent !== "transaction.paid") throw new Error("Unsupported Hoose.id webhook event.");

    const orderId = String(payload?.order_id || "").trim();
    const transactionId = String(payload?.transaction_id || "").trim();
    const amount = Number(payload?.base_amount);
    const finalAmount = Number(payload?.amount);
    const uniqueCode = Number(payload?.unique_code);
    if (!orderId || !transactionId) throw new Error("Hoose.id webhook is missing order_id or transaction_id.");
    if (
      !Number.isSafeInteger(amount) || amount <= 0 ||
      !Number.isSafeInteger(uniqueCode) || uniqueCode < 0 || uniqueCode > 999 ||
      !Number.isSafeInteger(finalAmount) || finalAmount !== amount + uniqueCode
    ) throw new Error("Hoose.id webhook amount or unique code is invalid.");

    const normalizedStatus = normalizeHooseStatus(payload?.status);
    if (normalizedStatus !== "PAID") throw new Error("Hoose.id transaction.paid event does not contain a paid status.");

    return {
      provider: "hoose",
      orderId,
      transactionId,
      status: normalizedStatus,
      amount,
      rawPayload: payload
    };
  }

  public async refundPayment(_input: RefundPaymentInput): Promise<RefundResult> {
    return { success: false, message: "Refund otomatis Hoose.id belum didokumentasikan; gunakan prosedur refund manual." };
  }
}
