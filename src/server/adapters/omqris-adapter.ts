import * as crypto from "crypto";
import { SystemConfigRepository } from "../supabase/system-config-repository.js";
import { decryptSecret } from "../midtrans.js";
import { isOmqrisApiError, isOmqrisPersonalMode, mapOmqrisStatus, normalizeOmqrisAmounts, validateOmqrisAmounts } from "../omqris-contract.js";
import {
  PaymentProviderAdapter, CreatePaymentInput, PaymentResult,
  PaymentStatusInput, PaymentStatusResult, WebhookRequest,
  NormalizedPaymentEvent, RefundPaymentInput, RefundResult
} from "./payment-provider-interface.js";

type OmqrisConfig = {
  apiKey: string;
  apiSecret: string;
  isActive: boolean;
  baseUrl: string;
  webhookUrl: string;
};

const API_BASE = "https://omqris.id";

function headerValue(headers: any, name: string): string {
  const value = headers?.[name.toLowerCase()] ?? headers?.[name] ?? "";
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

function safeEqualHex(actual: string, expected: string): boolean {
  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}


export class OmqrisProviderAdapter implements PaymentProviderAdapter {
  private static instance: OmqrisProviderAdapter;
  private constructor() {}

  public static getInstance(): OmqrisProviderAdapter {
    if (!OmqrisProviderAdapter.instance) OmqrisProviderAdapter.instance = new OmqrisProviderAdapter();
    return OmqrisProviderAdapter.instance;
  }

  private async getConfig(): Promise<OmqrisConfig> {
    const repo = SystemConfigRepository.getInstance();
    const saved = await repo.getConfig("omqris_integration").catch(() => null);
    const apiKey = saved?.encryptedApiKey
      ? decryptSecret(saved.encryptedApiKey)
      : String(saved?.apiKey || process.env.OMQRIS_API_KEY || "");
    const apiSecret = saved?.encryptedApiSecret
      ? decryptSecret(saved.encryptedApiSecret)
      : String(saved?.apiSecret || process.env.OMQRIS_API_SECRET || "");
    return {
      apiKey,
      apiSecret,
      isActive: saved?.isActive === true,
      baseUrl: String(saved?.baseUrl || API_BASE).replace(/\/$/, ""),
      webhookUrl: String(saved?.webhookUrl || "https://ist.web.id/api/webhooks/omqris")
    };
  }

  private signRequest(config: OmqrisConfig): string {
    return crypto.createHash("sha256").update(config.apiKey + config.apiSecret).digest("hex");
  }

  /** Recover a transaction when create was accepted by OmQris but the response was lost,
   * or when OmQris rejects a repeated merchant_ref. Docs explicitly support lookup by merchant_ref.
   */
  private async recoverExistingTransaction(
    config: OmqrisConfig,
    merchantRef: string,
    requestedAmount: number
  ): Promise<PaymentResult | null> {
    try {
      const response = await fetch(
        `${config.baseUrl}/api/v1/transactions/${encodeURIComponent(merchantRef)}`,
        {
          method: "GET",
          headers: {
            "X-Api-Key": config.apiKey,
            "X-Signature": this.signRequest(config)
          }
        }
      );
      const result: any = await response.json().catch(() => ({}));
      if (isOmqrisApiError(response.ok, result)) return null;
      const data = result?.data || result;
      const returnedMerchantRef = String(data.merchant_ref || data.merchantRef || "");
      const invoiceNo = String(data.invoice_no || data.invoiceNo || "");
      const qrString = String(data.qris_string || data.qrisString || data.qr_string || "");
      const invoiceUrl = String(data.invoice_url || data.invoiceUrl || "");

      // Fail closed if the lookup response cannot be tied to this order or used by the customer.
      if (returnedMerchantRef !== merchantRef || !invoiceNo || (!qrString && !invoiceUrl)) return null;
      const recoveredStatus = mapOmqrisStatus(data.status);
      if (recoveredStatus === "EXPIRED" || recoveredStatus === "FAILED") return null;
      const amountValidationError = validateOmqrisAmounts(data, requestedAmount);
      if (amountValidationError) {
        console.error(`[OmQris Recovery] Recovered transaction failed validation for ${merchantRef}: ${amountValidationError}`);
        return null;
      }

      const expiresAt = data.expired_at || data.expires_at || null;
      const amounts = normalizeOmqrisAmounts(data, requestedAmount);
      return {
        success: true,
        token: invoiceNo,
        redirectUrl: invoiceUrl || undefined,
        qrImage: undefined,
        rail: "qris",
        feeAmount: amounts.feeAmount,
        mdrAmount: amounts.mdrAmount,
        mdrBearer: amounts.mdrBearer,
        totalAmount: amounts.totalAmount,
        expiresAt: expiresAt ? String(expiresAt) : undefined,
        rawResponse: { ...result, data: { ...data, qr_string: qrString, invoice_no: invoiceNo } }
      };
    } catch (error) {
      console.error(`[OmQris Recovery] Lookup failed for ${merchantRef}.`, error);
      return null;
    }
  }

  public async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    const config = await this.getConfig();
    if (!config.apiKey || !config.apiSecret) return { success: false, message: "Kredensial OmQris belum dikonfigurasi." };
    if (!Number.isInteger(input.grossAmount) || input.grossAmount < 100 || input.grossAmount > 100000000) {
      return { success: false, message: "Nominal OmQris harus berupa bilangan bulat Rp100–Rp100.000.000." };
    }
    if (input.paymentMethod && !["qris", "omqris", "qr"].includes(input.paymentMethod.toLowerCase())) {
      return { success: false, message: "OmQris hanya mendukung metode QRIS." };
    }

    const payload = {
      amount: input.grossAmount,
      item: input.itemDetails?.[0]?.name || "Pembayaran iStore",
      merchant_ref: input.orderId,
      webhook_url: config.webhookUrl,
      expire_minutes: 60,
      // Explicitly use the store's own GoPay QRIS through OmQris personal mode.
      pg_mode: "pribadi",
    };
    let response: Response;
    let result: any;
    try {
      response = await fetch(`${config.baseUrl}/api/v1/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": config.apiKey,
          "X-Signature": this.signRequest(config)
        },
        body: JSON.stringify(payload)
      });
      result = await response.json().catch(() => ({}));
    } catch (createError) {
      // A timeout/network error is ambiguous: OmQris may already have created the invoice.
      // Recover by the documented merchant_ref endpoint before surfacing the error.
      const recovered = await this.recoverExistingTransaction(config, input.orderId, input.grossAmount);
      if (recovered) return recovered;
      throw createError;
    }
    const data = result?.data || result;
    if (isOmqrisApiError(response.ok, result)) {
      // A duplicate ref is expected on a retry; 5xx responses can also be ambiguous.
      if (String(result?.code || "") === "DUPLICATE_MERCHANT_REF" || response.status >= 500) {
        const recovered = await this.recoverExistingTransaction(config, input.orderId, input.grossAmount);
        if (recovered) return recovered;
      }
      return { success: false, message: String(result?.message || result?.error || `OmQris API error (${response.status})`), rawResponse: result };
    }

    if (data.pg_mode && !isOmqrisPersonalMode(data.pg_mode)) {
      return {
        success: false,
        message: "OmQris mengembalikan mode pembayaran selain QRIS pribadi. Invoice tidak dapat digunakan.",
        rawResponse: result
      };
    }
    const invoiceNo = String(data.invoice_no || data.invoiceNo || "");
    const qrString = String(data.qris_string || data.qrisString || "");
    const invoiceUrl = String(data.invoice_url || data.invoiceUrl || "");
    if (!invoiceNo || (!qrString && !invoiceUrl)) {
      const recovered = await this.recoverExistingTransaction(config, input.orderId, input.grossAmount);
      if (recovered) return recovered;
      return { success: false, message: "Respons OmQris tidak memiliki invoice atau QRIS yang dapat digunakan.", rawResponse: result };
    }
    const amountValidationError = validateOmqrisAmounts(data, input.grossAmount);
    if (amountValidationError) {
      const recovered = await this.recoverExistingTransaction(config, input.orderId, input.grossAmount);
      if (recovered) return recovered;
      return { success: false, message: amountValidationError, rawResponse: result };
    }
    const expiresAt = data.expired_at || data.expires_at || null;
    const amounts = normalizeOmqrisAmounts(data, input.grossAmount);
    return {
      success: true,
      token: invoiceNo,
      redirectUrl: invoiceUrl || undefined,
      qrImage: undefined,
      rail: "qris",
      feeAmount: amounts.feeAmount,
      mdrAmount: amounts.mdrAmount,
      mdrBearer: amounts.mdrBearer,
      totalAmount: amounts.totalAmount,
      expiresAt: expiresAt ? String(expiresAt) : undefined,
      rawResponse: { ...result, data: { ...data, qr_string: qrString, invoice_no: invoiceNo } }
    };
  }

  public async getPaymentStatus(input: PaymentStatusInput): Promise<PaymentStatusResult> {
    const config = await this.getConfig();
    if (!config.apiKey || !config.apiSecret) throw new Error("Kredensial OmQris belum dikonfigurasi.");
    const identifier = encodeURIComponent(input.transactionId || input.orderId);
    const response = await fetch(`${config.baseUrl}/api/v1/transactions/${identifier}`, {
      method: "GET",
      headers: { "X-Api-Key": config.apiKey, "X-Signature": this.signRequest(config) }
    });
    const result: any = await response.json().catch(() => ({}));
    if (isOmqrisApiError(response.ok, result)) {
      throw new Error(String(result?.message || result?.error || `OmQris inquiry failed (${response.status})`));
    }
    const data = result?.data || result;
    const status = mapOmqrisStatus(data.status);
    return {
      status,
      transactionStatus: String(data.status || status),
      grossAmount: Number(data.base_amount ?? data.amount ?? 0) || 0,
      rawData: result
    };
  }

  public async verifyWebhook(request: WebhookRequest): Promise<NormalizedPaymentEvent> {
    const config = await this.getConfig();
    if (!config.apiSecret) throw new Error("OmQris webhook secret is not configured.");
    const raw = Buffer.isBuffer(request.body)
      ? request.body
      : Buffer.from(typeof request.body === "string" ? request.body : JSON.stringify(request.body ?? {}), "utf8");
    const signatureHeader = headerValue(request.headers, "x-omqris-signature").trim();
    const supplied = signatureHeader.replace(/^sha256=/i, "").trim().toLowerCase();
    const expected = crypto.createHmac("sha256", config.apiSecret).update(raw).digest("hex");
    if (!safeEqualHex(supplied, expected)) {
      // Diagnostic only: never accept a signature over a re-serialized body.
      // This distinguishes raw-body serialization differences from secret/header mismatches
      // without logging the secret, supplied signature, expected signature, or payload.
      let normalizedJsonMatch = false;
      try {
        const parsed = JSON.parse(raw.toString("utf8"));
        const normalizedRaw = Buffer.from(JSON.stringify(parsed), "utf8");
        const normalizedExpected = crypto.createHmac("sha256", config.apiSecret).update(normalizedRaw).digest("hex");
        normalizedJsonMatch = safeEqualHex(supplied, normalizedExpected);
      } catch {
        // Keep the diagnostic false when the request body is not valid JSON.
      }
      throw new Error(
        `Invalid OmQris webhook signature (headerPresent=${Boolean(signatureHeader)}, digestLength=${supplied.length}, rawBodyBytes=${raw.length}, normalizedJsonMatch=${normalizedJsonMatch}).`
      );
    }

    const payload: any = JSON.parse(raw.toString("utf8"));
    const data = payload?.data || payload;
    const merchantRef = String(data.merchant_ref || data.merchantRef || "").trim();
    if (!merchantRef) throw new Error("OmQris webhook is missing merchant_ref.");
    const status = mapOmqrisStatus(data.status || headerValue(request.headers, "x-omqris-event"));
    return {
      provider: "omqris",
      orderId: merchantRef,
      transactionId: String(data.invoice_no || data.ref_id || merchantRef),
      status,
      amount: Number(data.base_amount ?? data.amount ?? 0) || 0,
      rawPayload: payload
    };
  }

  public async refundPayment(_input: RefundPaymentInput): Promise<RefundResult> {
    return { success: false, message: "Refund otomatis OmQris belum didukung; proses melalui prosedur manual." };
  }
}
