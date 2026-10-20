import { SystemConfigRepository } from "../supabase/system-config-repository.js";
import { decryptSecret } from "../midtrans.js";
import { createNasionalPaySignature, mapNasionalPayStatus, normalizeNasionalPayAmount, safeNasionalPaySignatureEqual } from "../nasionalpay-contract.js";
import {
  PaymentProviderAdapter, CreatePaymentInput, PaymentResult,
  PaymentStatusInput, PaymentStatusResult, WebhookRequest,
  NormalizedPaymentEvent, RefundPaymentInput, RefundResult
} from "./payment-provider-interface.js";

const API_BASE = "https://merchant.nasionalpay.com/api/payment";

type NasionalPayConfig = { storeKey: string; isActive: boolean; callbackUrl: string };

function headerValue(headers: any, name: string): string {
  const value = headers?.[name.toLowerCase()] ?? headers?.[name] ?? "";
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

export class NasionalPayProviderAdapter implements PaymentProviderAdapter {
  private static instance: NasionalPayProviderAdapter;
  private constructor() {}

  public static getInstance(): NasionalPayProviderAdapter {
    if (!NasionalPayProviderAdapter.instance) NasionalPayProviderAdapter.instance = new NasionalPayProviderAdapter();
    return NasionalPayProviderAdapter.instance;
  }

  private async getConfig(): Promise<NasionalPayConfig> {
    const saved = await SystemConfigRepository.getInstance().getConfig("nasionalpay_integration").catch(() => null);
    return {
      storeKey: saved?.encryptedStoreKey
        ? decryptSecret(saved.encryptedStoreKey)
        : String(saved?.storeKey || process.env.NASIONALPAY_STORE_KEY || ""),
      isActive: saved?.isActive === true,
      callbackUrl: String(saved?.callbackUrl || "https://www.tega.biz.id/api/webhooks/nasionalpay")
    };
  }

  private async request(path: string, storeKey: string, payload: Record<string, unknown>): Promise<any> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ key: storeKey, ...payload }),
      signal: AbortSignal.timeout(15000)
    });
    const result: any = await response.json().catch(() => ({}));
    if (!response.ok || result?.success !== true) {
      throw new Error(String(result?.message || `NasionalPay API error (HTTP ${response.status})`));
    }
    return result.data ?? result;
  }

  public async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    const config = await this.getConfig();
    if (!config.storeKey) return { success: false, message: "Store Key NasionalPay belum dikonfigurasi." };
    if (!Number.isSafeInteger(input.grossAmount) || input.grossAmount <= 0) {
      return { success: false, message: "Nominal pembayaran NasionalPay tidak valid." };
    }
    const channel = String(input.paymentMethod || "qris").trim().toUpperCase();
    if (channel !== "QRIS" && channel !== "DANA") {
      return { success: false, message: "NasionalPay saat ini hanya mendokumentasikan metode QRIS dan DANA." };
    }
    const username = String(input.playerUsername || "").trim();
    if (!username) return { success: false, message: "Identitas pemain/pelanggan wajib tersedia untuk NasionalPay." };

    try {
      const data = await this.request("/generate", config.storeKey, {
        channel,
        amount: input.grossAmount,
        player_username: username
      });
      const transactionId = String(data.transaction_id || "").trim();
      const paymentUrl = String(data.payment_url || "").trim();
      const qrisImage = String(data.qris_image || "").trim();
      const qrisData = String(data.qris_data || "").trim();
      if (!transactionId || (channel === "QRIS" && !qrisImage && !qrisData) || (channel === "DANA" && !paymentUrl)) {
        return { success: false, message: "Respons NasionalPay tidak memiliki ID transaksi atau instruksi pembayaran yang valid.", rawResponse: data };
      }
      return {
        success: true,
        token: transactionId,
        redirectUrl: paymentUrl || undefined,
        qrImage: qrisImage || undefined,
        rail: channel.toLowerCase(),
        totalAmount: input.grossAmount,
        feeAmount: Number.isSafeInteger(Number(data.fee_mdr)) && Number(data.fee_mdr) >= 0 ? Number(data.fee_mdr) : undefined,
        expiresAt: data.expired_at ? String(data.expired_at) : undefined,
        rawResponse: { ...data, qris_data: qrisData || undefined }
      };
    } catch (error: any) {
      return { success: false, message: error?.message || "Gagal membuat pembayaran NasionalPay." };
    }
  }

  public async getPaymentStatus(input: PaymentStatusInput): Promise<PaymentStatusResult> {
    const config = await this.getConfig();
    if (!config.storeKey) throw new Error("Store Key NasionalPay belum dikonfigurasi.");
    const transactionId = String(input.transactionId || input.orderId || "").trim();
    if (!transactionId) throw new Error("ID transaksi NasionalPay tidak tersedia.");
    const data = await this.request("/status", config.storeKey, { transaction_id: transactionId });
    return {
      status: mapNasionalPayStatus(data.status),
      transactionStatus: String(data.status || "pending"),
      grossAmount: normalizeNasionalPayAmount(data.amount),
      rawData: data
    };
  }

  public async verifyWebhook(request: WebhookRequest): Promise<NormalizedPaymentEvent> {
    const config = await this.getConfig();
    if (!config.storeKey) throw new Error("Store Key NasionalPay belum dikonfigurasi untuk callback.");
    const rawBody = Buffer.isBuffer(request.body)
      ? request.body
      : Buffer.from(typeof request.body === "string" ? request.body : JSON.stringify(request.body ?? {}), "utf8");
    const supplied = headerValue(request.headers, "x-nasionalpay-signature").trim().toLowerCase();
    const expected = createNasionalPaySignature(rawBody, config.storeKey);
    if (!safeNasionalPaySignatureEqual(supplied, expected)) throw new Error("Invalid NasionalPay callback signature.");

    const payload: any = JSON.parse(rawBody.toString("utf8"));
    const data = payload?.data;
    const transactionId = String(data?.transaction_id || "").trim();
    const orderId = String(data?.order_id || data?.merchant_ref || "").trim();
    if (payload?.success !== true || !data || !transactionId) {
      throw new Error("NasionalPay callback missing required transaction identity.");
    }
    return {
      provider: "nasionalpay",
      orderId,
      transactionId,
      status: mapNasionalPayStatus(data.status),
      amount: normalizeNasionalPayAmount(data.amount),
      rawPayload: payload
    };
  }

  public async refundPayment(_input: RefundPaymentInput): Promise<RefundResult> {
    return { success: false, message: "Refund otomatis NasionalPay belum didokumentasikan; gunakan prosedur refund manual." };
  }
}
