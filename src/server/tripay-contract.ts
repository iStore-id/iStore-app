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

export function mapTripayMethod(method?: string): string {
  const key = String(method || "").trim().toLowerCase();
  const code = TRIPAY_METHOD_CODES[key];
  if (!code) throw new Error("Metode pembayaran TriPay tidak didukung atau belum dipilih.");
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
