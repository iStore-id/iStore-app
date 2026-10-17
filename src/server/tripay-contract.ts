import * as crypto from "crypto";

export const TRIPAY_METHOD_CODES: Record<string, string> = {
  qris: "QRIS",
  gopay: "GOPAY",
  shopeepay: "SHOPEEPAY",
  bca_va: "BCAVA",
  bni_va: "BNIVA",
  bri_va: "BRIVA",
  echannel: "MANDIRIVA",
  permata_va: "PERMATAVA",
  bsi_va: "BSIVA",
  cimb_va: "CIMBVA",
  danamon_va: "DANAMONVA"
};

export function mapTripayMethod(method?: string, availableCodes?: string[]): string {
  const raw = String(method || "").trim();
  const key = raw.toLowerCase();
  const mappedCode = TRIPAY_METHOD_CODES[key];
  const available = Array.isArray(availableCodes) ? new Set(availableCodes.map((code) => String(code || "").trim().toUpperCase()).filter(Boolean)) : null;
  const code = mappedCode || raw.toUpperCase();
  if (!code || (available && !available.has(code)) || (!available && !mappedCode)) throw new Error("Metode pembayaran TriPay tidak tersedia pada kanal akun ini.");
  return code;
}

export function createTripayTransactionSignature(
  merchantCode: string,
  merchantRef: string,
  amount: number,
  privateKey: string
): string {
  return crypto.createHmac("sha256", privateKey)
    .update(String(merchantCode) + String(merchantRef) + String(amount))
    .digest("hex");
}

export function createTripayCallbackSignature(rawBody: Buffer | string, privateKey: string): string {
  return crypto.createHmac("sha256", privateKey).update(rawBody).digest("hex");
}

export function safeTripaySignatureEqual(actual: string, expected: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(actual) || !/^[a-f0-9]{64}$/i.test(expected)) return false;
  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * TriPay's documented transaction-create response exposes amount and fee_customer.
 * total_amount is not part of that documented response and can be inconsistent in
 * sandbox responses, so calculate the customer-facing bill from the documented fields.
 */
export function resolveTripayCustomerTotal(amountValue: unknown, feeCustomerValue: unknown): number {
  const amount = Number(amountValue);
  const feeCustomer = Number(feeCustomerValue ?? 0);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Nominal dasar transaksi TriPay tidak valid.");
  }
  if (!Number.isSafeInteger(feeCustomer) || feeCustomer < 0) {
    throw new Error("Biaya pelanggan TriPay tidak valid.");
  }
  const total = amount + feeCustomer;
  if (!Number.isSafeInteger(total) || total <= 0) {
    throw new Error("Total tagihan pelanggan TriPay tidak valid.");
  }
  return total;
}

export function mapTripayStatus(status: unknown): "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED" {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "PAID") return "PAID";
  if (normalized === "EXPIRED") return "EXPIRED";
  if (normalized === "FAILED" || normalized === "CANCELLED" || normalized === "CANCELED") return "FAILED";
  if (normalized === "REFUND" || normalized === "REFUNDED") return "REFUNDED";
  return "PENDING";
}

export function buildTripayWebhookEventKey(reference: unknown, status: unknown): string {
  const id = String(reference || "").trim();
  return id ? `${id}:${mapTripayStatus(status)}` : "";
}
