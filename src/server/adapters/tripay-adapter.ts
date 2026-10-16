import QRCode from "qrcode";
import { SystemConfigRepository } from "../supabase/system-config-repository.js";
import { decryptSecret } from "../midtrans.js";
import {
  PaymentProviderAdapter, CreatePaymentInput, PaymentResult,
  PaymentStatusInput, PaymentStatusResult, WebhookRequest,
  NormalizedPaymentEvent, RefundPaymentInput, RefundResult
} from "./payment-provider-interface.js";
import {
  createTripayTransactionSignature, createTripayCallbackSignature,
  safeTripaySignatureEqual, mapTripayMethod, mapTripayStatus
} from "../tripay-contract.js";

type TripayConfig = {
  apiKey: string;
  privateKey: string;
  merchantCode: string;
  isProduction: boolean;
  isActive: boolean;
  callbackUrl: string;
};

function headerValue(headers: any, name: string): string {
  const value = headers?.[name.toLowerCase()] ?? headers?.[name] ?? "";
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

export class TripayProviderAdapter implements PaymentProviderAdapter {
  private static instance: TripayProviderAdapter;
  private constructor() {}

  public static getInstance(): TripayProviderAdapter {
    if (!TripayProviderAdapter.instance) TripayProviderAdapter.instance = new TripayProviderAdapter();
    return TripayProviderAdapter.instance;
  }

  private async getConfig(): Promise<TripayConfig> {
    const saved = await SystemConfigRepository.getInstance().getConfig("tripay_integration").catch(() => null);
    return {
      apiKey: saved?.encryptedApiKey ? decryptSecret(saved.encryptedApiKey) : String(saved?.apiKey || process.env.TRIPAY_API_KEY || ""),
      privateKey: saved?.encryptedPrivateKey ? decryptSecret(saved.encryptedPrivateKey) : String(saved?.privateKey || process.env.TRIPAY_PRIVATE_KEY || ""),
      merchantCode: String(saved?.merchantCode || process.env.TRIPAY_MERCHANT_CODE || ""),
      isProduction: saved?.isProduction !== undefined ? saved.isProduction === true : process.env.TRIPAY_IS_PRODUCTION === "true",
      isActive: saved?.isActive === true,
      callbackUrl: String(saved?.callbackUrl || "https://ist.web.id/api/webhooks/tripay")
    };
  }

  private apiBase(config: TripayConfig): string {
    return config.isProduction ? "https://tripay.co.id/api" : "https://tripay.co.id/api-sandbox";
  }

  private async request(config: TripayConfig, path: string, init: RequestInit = {}): Promise<any> {
    const response = await fetch(`${this.apiBase(config)}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...(init.headers || {})
      },
      signal: init.signal || AbortSignal.timeout(15000)
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      const message = typeof payload?.message === "string" ? payload.message : `TriPay API error (HTTP ${response.status})`;
      throw new Error(message);
    }
    return payload?.data ?? payload;
  }

  public async getPaymentChannels(): Promise<any[]> {
    const config = await this.getConfig();
    if (!config.apiKey) throw new Error("API Key TriPay belum dikonfigurasi.");
    const data = await this.request(config, "/merchant/payment-channel", { method: "GET" });
    return Array.isArray(data) ? data.filter((item: any) => item && item.active !== false) : [];
  }

  public async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    const config = await this.getConfig();
    if (!config.apiKey || !config.privateKey || !config.merchantCode) {
      return { success: false, message: "API Key, Private Key, dan Kode Merchant TriPay harus dikonfigurasi." };
    }
    if (!Number.isSafeInteger(input.grossAmount) || input.grossAmount <= 0) {
      return { success: false, message: "Nominal pembayaran TriPay tidak valid." };
    }

    let method: string;
    try {
      method = mapTripayMethod(input.paymentMethod);
    } catch (error: any) {
      return { success: false, message: error.message };
    }

    const merchantRef = String(input.orderId);
    const signature = createTripayTransactionSignature(config.merchantCode, merchantRef, input.grossAmount, config.privateKey);
    const form = new URLSearchParams();
    form.set("method", method);
    form.set("merchant_ref", merchantRef);
    form.set("amount", String(input.grossAmount));
    form.set("customer_name", input.customerDetails.first_name || "Customer");
    form.set("customer_email", input.customerDetails.email || "customer@ist.web.id");
    if (input.customerDetails.phone) form.set("customer_phone", input.customerDetails.phone);
    form.set("callback_url", input.callbackUrl || config.callbackUrl);
    form.set("return_url", input.returnUrl || `https://ist.web.id/transactions/${encodeURIComponent(merchantRef)}`);
    form.set("expired_time", String(Math.floor(Date.now() / 1000) + 24 * 60 * 60));
    form.set("signature", signature);
    input.itemDetails.slice(0, 20).forEach((item, index) => {
      form.set(`order_items[${index}][sku]`, String(item.id).slice(0, 100));
      form.set(`order_items[${index}][name]`, String(item.name).slice(0, 100));
      form.set(`order_items[${index}][price]`, String(Math.round(item.price)));
      form.set(`order_items[${index}][quantity]`, String(Math.max(1, Math.floor(item.quantity))));
    });

    try {
      const data = await this.request(config, "/transaction/create", { method: "POST", body: form.toString() });
      const reference = String(data.reference || "");
      const checkoutUrl = String(data.checkout_url || data.pay_url || "");
      const qrUrl = String(data.qr_url || "");
      const qrString = String(data.qr_string || "");
      const qrImage = qrUrl || (qrString ? await QRCode.toDataURL(qrString, { errorCorrectionLevel: "M", margin: 2, scale: 8 }) : "");
      const payCode = String(data.pay_code || "");
      if (!reference || (!checkoutUrl && !qrImage && !payCode)) {
        return { success: false, message: "Respons TriPay tidak memiliki referensi atau detail pembayaran yang dapat digunakan.", rawResponse: data };
      }
      return {
        success: true,
        token: reference,
        redirectUrl: checkoutUrl || undefined,
        qrImage: qrImage || undefined,
        vaNumber: payCode || undefined,
        vaBank: method.endsWith("VA") ? method.replace(/VA$/, "") : undefined,
        rail: method,
        totalAmount: Number(data.total_amount ?? (Number(data.amount || input.grossAmount) + Number(data.fee_customer || 0))),
        feeAmount: Number(data.total_fee || data.fee_merchant || 0),
        expiresAt: data.expired_time ? new Date(Number(data.expired_time) * 1000).toISOString() : undefined,
        rawResponse: data
      };
    } catch (error: any) {
      return { success: false, message: error?.message || "Gagal membuat transaksi TriPay." };
    }
  }

  public async getPaymentStatus(input: PaymentStatusInput): Promise<PaymentStatusResult> {
    const config = await this.getConfig();
    if (!config.apiKey) throw new Error("API Key TriPay belum dikonfigurasi.");
    const reference = String(input.transactionId || input.orderId || "").trim();
    if (!reference) throw new Error("Referensi transaksi TriPay tidak tersedia.");
    const data = await this.request(config, `/transaction/check-status?reference=${encodeURIComponent(reference)}`, { method: "GET" });
    const status = mapTripayStatus(data.status);
    return {
      status,
      transactionStatus: String(data.status || status),
      grossAmount: Number(data.amount ?? data.total_amount ?? 0) || 0,
      rawData: data
    };
  }

  public async verifyWebhook(request: WebhookRequest): Promise<NormalizedPaymentEvent> {
    const config = await this.getConfig();
    if (!config.privateKey) throw new Error("TriPay private key belum dikonfigurasi untuk callback.");
    const rawBody = Buffer.isBuffer(request.body)
      ? request.body
      : Buffer.from(typeof request.body === "string" ? request.body : JSON.stringify(request.body ?? {}), "utf8");
    const supplied = headerValue(request.headers, "x-callback-signature").trim().toLowerCase();
    const expected = createTripayCallbackSignature(rawBody, config.privateKey);
    if (!safeTripaySignatureEqual(supplied, expected)) throw new Error("Invalid TriPay callback signature.");

    const payload: any = JSON.parse(rawBody.toString("utf8"));
    const eventName = headerValue(request.headers, "x-callback-event");
    if (eventName && eventName !== "payment_status") throw new Error("Unsupported TriPay callback event.");
    const data = payload?.data || payload;
    const merchantRef = String(data.merchant_ref || "").trim();
    const reference = String(data.reference || "").trim();
    if (!merchantRef || !reference) throw new Error("TriPay callback is missing merchant_ref or reference.");
    const totalAmount = Number(data.total_amount);
    const customerFee = Number(data.fee_customer || 0);
    const amount = totalAmount - customerFee;
    if (
      !Number.isSafeInteger(totalAmount) || totalAmount <= 0 ||
      !Number.isSafeInteger(customerFee) || customerFee < 0 ||
      !Number.isSafeInteger(amount) || amount <= 0
    ) throw new Error("TriPay callback amount is invalid.");

    return {
      provider: "tripay",
      orderId: merchantRef,
      transactionId: reference,
      status: mapTripayStatus(data.status),
      amount,
      rawPayload: payload
    };
  }

  public async refundPayment(_input: RefundPaymentInput): Promise<RefundResult> {
    return { success: false, message: "Refund otomatis TriPay belum diimplementasikan; gunakan prosedur refund manual." };
  }
}
